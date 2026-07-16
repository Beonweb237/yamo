import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalSuspensionInfo } from '../lib/drivers';

export type UserRole = 'client' | 'restaurant' | 'livreur' | 'admin';

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  // Clients and admins don't need vetting; restaurant/livreur accounts only
  // become "approved" once an admin validates their application (see
  // src/lib/applications.ts) — until then RoleGate keeps their dashboards locked.
  isApproved: boolean;
  // Set by an admin (see src/pages/admin/AdminDrivers.tsx) to block a driver's
  // access without deleting their account — checked by RoleGate.
  isSuspended: boolean;
  suspensionReason?: string | null;
  // Zone de service (livreurs) — la ville est obligatoire pour recevoir des
  // livraisons ; serviceNeighborhoods vide/absent = dessert toute la ville.
  city?: string | null;
  serviceNeighborhoods?: string[] | null;
}

export interface SignUpParams {
  email?: string;
  password?: string;
  phone: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isSupabaseConfigured: boolean;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string, requestedRole?: UserRole) => Promise<AuthUser>;
  // Password sign-in for seeded test accounts (scripts/seed-test-data.mjs) —
  // bypasses phone OTP, which needs an SMS provider that isn't configured yet.
  signInWithPassword: (phone: string, password: string) => Promise<AuthUser>;
  // Create a new account — Supabase: email+password signup; mock: localStorage registry.
  signUp: (params: SignUpParams) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfileName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const LOCAL_SESSION_KEY = 'yamo_local_user';
export const LOCAL_REGISTRY_KEY = 'yamo_local_users'; // phone -> AuthUser, so role/approval sticks across re-logins
export const LOCAL_EMAIL_USERS_KEY = 'yamo_email_users'; // email -> { phone, password, name } for mock email signup

// Thrown by verifyOtp when a phone number already has an account under a
// different role than the one just selected — the caller should invite the
// user to log in with their existing profile instead of silently switching it.
export class RoleMismatchError extends Error {
  existingRole: UserRole;
  constructor(existingRole: UserRole) {
    super('role-mismatch');
    this.existingRole = existingRole;
  }
}

function isSelfApprovingRole(role: UserRole) {
  return role === 'client' || role === 'admin';
}

// /api/auth/me (exposé via getSession() de l'adaptateur) renvoie déjà le
// profil complet — rôle, approbation, suspension, zone de service — en un
// appel : on construit l'AuthUser directement, sans second aller-retour.
function toAuthUserFromSession(u: Record<string, unknown>): AuthUser {
  return {
    id: u.id as string,
    phone: u.phone as string,
    role: u.role as UserRole,
    isApproved: Boolean(u.isApproved),
    isSuspended: Boolean(u.isSuspended),
    suspensionReason: (u.suspensionReason as string | null) ?? null,
    city: (u.city as string | null) ?? null,
    serviceNeighborhoods: (u.serviceNeighborhoods as string[] | null) ?? null,
  };
}

function readLocalRegistry(): Record<string, AuthUser> {
  const raw = localStorage.getItem(LOCAL_REGISTRY_KEY);
  return raw ? JSON.parse(raw) : {};
}

// Pre-seeded mock profiles for instant testing — all profiles, approved + pending.
// Phone numbers are used as keys (without spaces).
const SEED_PROFILES: AuthUser[] = [
  { id: 'seed-admin', phone: '+237690000001', role: 'admin', isApproved: true, isSuspended: false },
  { id: 'seed-client', phone: '+237690000002', role: 'client', isApproved: true, isSuspended: false },
  { id: 'seed-resto-ok', phone: '+237690000003', role: 'restaurant', isApproved: true, isSuspended: false },
  { id: 'seed-resto-pend', phone: '+237690000004', role: 'restaurant', isApproved: false, isSuspended: false },
  { id: 'seed-livreur-ok', phone: '+237690000005', role: 'livreur', isApproved: true, isSuspended: false },
  { id: 'seed-livreur-pend', phone: '+237690000006', role: 'livreur', isApproved: false, isSuspended: false },
];

function seedLocalRegistry() {
  const existing = readLocalRegistry();
  if (Object.keys(existing).length > 0) return; // already seeded or user-created
  const registry: Record<string, AuthUser> = {};
  for (const p of SEED_PROFILES) {
    registry[p.phone.replace(/\s/g, '')] = p;
  }
  localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(registry));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSupabaseSession = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.user) {
      setUser(toAuthUserFromSession(session.user as Record<string, unknown>));
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) seedLocalRegistry();

    const initAuth = async () => {
      // 1. Session API VPS (token JWT stocké côté adaptateur)
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            setUser(toAuthUserFromSession(data.session.user as Record<string, unknown>));
            setLoading(false);
            return; // API session found — done
          }
        } catch {
          // API unreachable — fall through
        }
      }

      // 2. Fallback to localStorage session
      const raw = localStorage.getItem(LOCAL_SESSION_KEY);
      if (raw) {
        const session: AuthUser = JSON.parse(raw);
        const { isSuspended, reason } = getLocalSuspensionInfo(session.id);
        setUser({ ...session, isSuspended, suspensionReason: reason ?? null });
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();

    if (isSupabaseConfigured && supabase) {
      const client = supabase;
      const { data: sub } = client.auth.onAuthStateChange(async () => {
        const { data } = await client.auth.getSession();
        if (data.session?.user) {
          setUser(toAuthUserFromSession(data.session.user as Record<string, unknown>));
        }
      });
      return () => sub.subscription.unsubscribe();
    }
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.sendOtp(phone);
        return; // OTP émis par le backend (visible dans ses logs tant qu'aucun SMS n'est branché)
      } catch {
        // Backend injoignable — fall through to mock mode
      }
    }
    // Mock mode or backend unavailable: any code works in verifyOtp.
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string, requestedRole: UserRole = 'client') => {
    if (isSupabaseConfigured && supabase) {
      try {
        const json = await supabase.auth.verifyOtp(phone, code, requestedRole);
        if (json?.user) {
          // Re-lecture via /api/auth/me pour le profil complet (suspension,
          // ville, zones) — la réponse verify-otp ne porte que l'essentiel.
          const { data } = await supabase.auth.getSession();
          const resolvedUser: AuthUser = data?.session?.user
            ? toAuthUserFromSession(data.session.user as Record<string, unknown>)
            : toAuthUserFromSession(json.user as Record<string, unknown>);
          setUser(resolvedUser);
          return resolvedUser;
        }
      } catch (err) {
        if (err instanceof RoleMismatchError) throw err;
        // Backend injoignable ou code invalide — fall through to mock mode
      }
    }

    // Dev mode fallback: simulate a verified session without a real SMS provider.
    // The role/approval are fixed the first time a phone number "signs up" and reused after that.
    const registry = readLocalRegistry();
    const existing = registry[phone];
    if (existing && existing.role !== requestedRole) {
      throw new RoleMismatchError(existing.role);
    }
    const localUser: AuthUser = existing ?? {
      id: `local-${phone}`,
      phone,
      role: requestedRole,
      isApproved: isSelfApprovingRole(requestedRole),
      isSuspended: false,
    };
    // La map de suspension de drivers.ts ne concerne que les livreurs — pour
    // les autres rôles elle écraserait le blocage posé par AdminCustomers
    // directement dans le registre (LOT-16), qui doit survivre à la reconnexion.
    if (localUser.role === 'livreur') {
      const suspensionInfo = getLocalSuspensionInfo(localUser.id);
      localUser.isSuspended = suspensionInfo.isSuspended;
      localUser.suspensionReason = suspensionInfo.reason ?? null;
    }
    registry[phone] = localUser;
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(registry));
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localUser));
    setUser(localUser);
    return localUser;
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error("Password sign-in requires l'API VPS (VITE_USE_VPS_API).");
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.session?.user) throw new Error('Échec de la connexion.');
    // /api/auth/me pour le profil complet (suspension, ville, zones).
    const { data: sessionData } = await supabase.auth.getSession();
    const authUser: AuthUser = sessionData?.session?.user
      ? toAuthUserFromSession(sessionData.session.user as Record<string, unknown>)
      : toAuthUserFromSession(data.session.user as Record<string, unknown>);
    setUser(authUser);
    return authUser;
  }, []);

  // Email + password account creation. In Supabase mode this creates a real
  // auth user + profile row; in mock mode it stores everything in localStorage
  // so the user can log back in with the same email/password on Login.tsx.
  const signUp = useCallback(async ({ email, password, phone, name, role }: SignUpParams): Promise<AuthUser> => {
    if (isSupabaseConfigured && supabase && password) {
      // /api/auth/signup crée le compte avec le rôle et renvoie le JWT —
      // pas de table profiles séparée, tout vit dans users côté API.
      const { data, error } = await supabase.auth.signUp({ email, phone, password, name, role });
      if (error) throw error;
      if (!data?.user) throw new Error("Échec de l'inscription.");
      const u = data.user as Record<string, unknown>;
      const authUser: AuthUser = {
        id: u.id as string,
        phone: (u.phone as string) || phone,
        role: (u.role as UserRole) || role,
        isApproved: Boolean(u.isApproved ?? isSelfApprovingRole(role)),
        isSuspended: false,
      };
      setUser(authUser);
      return authUser;
    }

    // Mock mode — store in localStorage so the user can log back in.
    const phoneKey = phone.replace(/\s/g, '');
    const registry = readLocalRegistry();

    if (registry[phoneKey]) {
      throw new Error('Un compte existe déjà avec ce numéro de téléphone.');
    }

    const localUserId = `local-${phoneKey}`;
    const localUser: AuthUser = {
      id: localUserId,
      phone,
      role,
      isApproved: isSelfApprovingRole(role),
      isSuspended: false,
    };
    registry[phoneKey] = localUser;
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(registry));
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localUser));

    // Also store email credentials for mock email login.
    if (email && password) {
      const emailUsers = JSON.parse(localStorage.getItem(LOCAL_EMAIL_USERS_KEY) ?? '{}');
      emailUsers[email.toLowerCase().trim()] = { phone: phoneKey, password, name };
      localStorage.setItem(LOCAL_EMAIL_USERS_KEY, JSON.stringify(emailUsers));
    }

    setUser(localUser);
    return localUser;
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(LOCAL_SESSION_KEY);
    setUser(null);
  }, []);

  // Lets a page re-pull the current user's approval status (e.g. after
  // submitting an application) without requiring a full re-login.
  const refreshUser = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      await loadSupabaseSession();
      return;
    }
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (raw) {
      const session: AuthUser = JSON.parse(raw);
      const registry = readLocalRegistry();
      const fresh = registry[session.phone];
      if (fresh) {
        const { isSuspended, reason } = getLocalSuspensionInfo(fresh.id);
        fresh.isSuspended = isSuspended;
        fresh.suspensionReason = reason ?? null;
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(fresh));
        setUser(fresh);
      }
    }
  }, [loadSupabaseSession]);

  // Persists the display name to users.full_name (API VPS) so it survives
  // beyond the current browser (Profile.tsx previously only wrote it to
  // localStorage, silently losing it on another device/session).
  // In mock mode, localStorage (see Profile.tsx) remains the source of truth.
  const updateProfileName = useCallback(async (name: string) => {
    if (!user || !isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from('users').update({ full_name: name }).eq('id', user.id);
    if (error) throw error;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{ user, loading, isSupabaseConfigured, sendOtp, verifyOtp, signInWithPassword, signUp, signOut, refreshUser, updateProfileName }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
