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
  signInWithPassword: (phone: string, password: string) => Promise<void>;
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

// Loads the profile row for a Supabase-authenticated user, creating it with the
// requested role on first login. The role never changes on subsequent logins.
async function resolveSupabaseProfile(
  userId: string,
  phone: string,
  requestedRole: UserRole
): Promise<{ role: UserRole; isApproved: boolean; isSuspended: boolean; suspensionReason: string | null; phone: string }> {
  if (!supabase) return { role: 'client', isApproved: true, isSuspended: false, suspensionReason: null, phone };

  const { data: existing } = await supabase
    .from('profiles')
    .select('role, is_approved, is_suspended, suspension_reason, phone')
    .eq('id', userId)
    .maybeSingle();
  if (existing) {
    const role = existing.role as UserRole;
    return {
      role,
      isApproved: isSelfApprovingRole(role) || existing.is_approved,
      isSuspended: Boolean(existing.is_suspended),
      suspensionReason: existing.suspension_reason ?? null,
      phone: existing.phone ?? phone,
    };
  }

  const { data: inserted } = await supabase
    .from('profiles')
    .insert({ id: userId, phone, role: requestedRole })
    .select('role, is_approved, is_suspended, suspension_reason, phone')
    .single();
  const role = (inserted?.role as UserRole) ?? requestedRole;
  return {
    role,
    isApproved: isSelfApprovingRole(role) || Boolean(inserted?.is_approved),
    isSuspended: Boolean(inserted?.is_suspended),
    suspensionReason: inserted?.suspension_reason ?? null,
    phone: inserted?.phone ?? phone,
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
      const { role, isApproved, isSuspended, suspensionReason, phone } = await resolveSupabaseProfile(session.user.id, session.user.phone ?? '', 'client');
      setUser({ id: session.user.id, phone, role, isApproved, isSuspended, suspensionReason });
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) seedLocalRegistry();

    const initAuth = async () => {
      // 1. Try Supabase session
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            const { role, isApproved, isSuspended, suspensionReason, phone } =
              await resolveSupabaseProfile(data.session.user.id, data.session.user.phone ?? '', 'client');
            setUser({ id: data.session.user.id, phone, role, isApproved, isSuspended, suspensionReason });
            setLoading(false);
            return; // Supabase session found — done
          }
        } catch {
          // Supabase unreachable — fall through
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
          const { role, isApproved, isSuspended, suspensionReason, phone } =
            await resolveSupabaseProfile(data.session.user.id, data.session.user.phone ?? '', 'client');
          setUser({ id: data.session.user.id, phone, role, isApproved, isSuspended, suspensionReason });
        }
      });
      return () => sub.subscription.unsubscribe();
    }
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) throw error;
        return; // SMS sent successfully
      } catch {
        // No SMS provider configured (Twilio) — fall through to mock mode
      }
    }
    // Mock mode or SMS unavailable: any code works in verifyOtp.
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string, requestedRole: UserRole = 'client') => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
        if (!error && data.user) {
          const { role, isApproved, isSuspended, suspensionReason, phone: resolvedPhone } = await resolveSupabaseProfile(
            data.user.id,
            data.user.phone ?? phone,
            requestedRole
          );
          // This phone already has an account under a different role — don't
          // silently switch the session, invite the user to log in as themselves.
          if (role !== requestedRole) {
            throw new RoleMismatchError(role);
          }
          const resolvedUser: AuthUser = { id: data.user.id, phone: resolvedPhone, role, isApproved, isSuspended, suspensionReason };
          setUser(resolvedUser);
          return resolvedUser;
        }
      } catch (err) {
        if (err instanceof RoleMismatchError) throw err;
        // SMS provider unavailable — fall through to mock mode
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
    const suspensionInfo = getLocalSuspensionInfo(localUser.id);
    localUser.isSuspended = suspensionInfo.isSuspended;
    localUser.suspensionReason = suspensionInfo.reason ?? null;
    registry[phone] = localUser;
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(registry));
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localUser));
    setUser(localUser);
    return localUser;
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Password sign-in requires Supabase to be configured.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      const { role, isApproved, isSuspended, suspensionReason, phone } = await resolveSupabaseProfile(data.user.id, '', 'client');
      setUser({ id: data.user.id, phone, role, isApproved, isSuspended, suspensionReason });
    }
  }, []);

  // Email + password account creation. In Supabase mode this creates a real
  // auth user + profile row; in mock mode it stores everything in localStorage
  // so the user can log back in with the same email/password on Login.tsx.
  const signUp = useCallback(async ({ email, password, phone, name, role }: SignUpParams): Promise<AuthUser> => {
    if (isSupabaseConfigured && supabase && email && password) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { phone, full_name: name } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Échec de l'inscription.");
      // Upsert the profile row — the database trigger may have already created
      // one, so we use upsert to avoid duplicate-key errors.
      await supabase
        .from('profiles')
        .upsert({ id: data.user.id, phone, role, full_name: name, is_approved: isSelfApprovingRole(role) });
      const authUser: AuthUser = {
        id: data.user.id,
        phone,
        role,
        isApproved: isSelfApprovingRole(role),
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

  // Persists the display name to profiles.full_name (Supabase) so it
  // survives beyond the current browser (Profile.tsx previously only wrote
  // it to localStorage, silently losing it on another device/session).
  // In mock mode, localStorage (see Profile.tsx) remains the source of truth.
  const updateProfileName = useCallback(async (name: string) => {
    if (!user || !isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
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
