import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocalSuspensionInfo } from '../lib/drivers';
import { SEED_PROFILES } from '../data/demoAccounts';
import { checkQuota } from '../lib/quotas';
import { normalizeCameroonPhone } from '../lib/phone';

export type UserRole = 'client' | 'restaurant' | 'livreur' | 'admin';

export interface AuthUser {
  id: string;
  phone: string;
  email?: string | null;
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
  // Nom complet (optionnel) — renseigné à l'inscription ou propagé depuis la
  // candidature à l'approbation. Affiché anonymisé côté client (« Paul K. »).
  name?: string | null;
  adminRoleCode?: string | null;
  adminRoleName?: string | null;
  adminRoleCodes?: string[];
  adminPermissions?: string[];
  adminScopes?: {
    roleCode: string;
    roleName?: string | null;
    scopeType: string;
    scopeValue?: string | null;
  }[];
  isSuperAdmin?: boolean;
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
  sendOtp: (phone: string) => Promise<{ exists?: boolean } | void>;
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

/** Mot de passe par défaut appliqué à tous les profils mock */
export const ADMIN_DEFAULT_PASSWORD = 'Miamexpress2025';

function emailToken(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'utilisateur';
}

export function getUserEmail(phone: string, name?: string | null, storedEmail?: string | null): string {
  if (storedEmail?.trim()) return storedEmail.trim().toLowerCase();
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  const first = emailToken(parts[0] || 'client');
  const last = emailToken(parts.length > 1 ? parts[parts.length - 1] : normalizeCameroonPhone(phone).slice(-4) || 'miamexpress');
  const domain = `${first}.${last}`.length % 2 === 0 ? 'gmail.com' : 'yahoo.fr';
  return `${last}.${first}@${domain}`;
}
/**
 * Génère un email basé sur le téléphone et stocke le mot de passe
 * par défaut dans le registre des identifiants email.
 * Stocke DEUX entrées pour permettre la connexion par email ET par téléphone :
 *   emailUsers['nom.prenom@gmail.com'] → connexion par email
 *   emailUsers['690000003']            → connexion par téléphone
 */
export function autoGenerateCredentials(phone: string, name?: string | null): void {
  const phoneKey = normalizeCameroonPhone(phone);
  const emailUsers: Record<string, { phone: string; password: string; name: string | null }> =
    JSON.parse(localStorage.getItem(LOCAL_EMAIL_USERS_KEY) ?? '{}');

  // Génère l'email au format nom.prenom@gmail.com/yahoo.fr.
  const email = getUserEmail(phoneKey, name);

  // Définit le même payload pour les deux clés
  const payload = { phone: phoneKey, password: ADMIN_DEFAULT_PASSWORD, name: name ?? null };

  // Par email (connexion email + mot de passe)
  emailUsers[email] = payload;
  // Par téléphone (connexion téléphone + mot de passe)
  emailUsers[phoneKey] = payload;

  localStorage.setItem(LOCAL_EMAIL_USERS_KEY, JSON.stringify(emailUsers));
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
    email: (u.email as string | null) ?? null,
    role: u.role as UserRole,
    isApproved: Boolean(u.isApproved),
    isSuspended: Boolean(u.isSuspended),
    suspensionReason: (u.suspensionReason as string | null) ?? null,
    city: (u.city as string | null) ?? null,
    serviceNeighborhoods: (u.serviceNeighborhoods as string[] | null) ?? null,
    name: (u.fullName as string | null) ?? (u.name as string | null) ?? null,
    adminRoleCode: (u.adminRoleCode as string | null) ?? null,
    adminRoleName: (u.adminRoleName as string | null) ?? null,
    adminRoleCodes: (u.adminRoleCodes as string[] | undefined) ?? [],
    adminPermissions: (u.adminPermissions as string[] | undefined) ?? [],
    adminScopes: (u.adminScopes as AuthUser['adminScopes'] | undefined) ?? [],
    isSuperAdmin: Boolean(u.isSuperAdmin),
  };
}

function readLocalRegistry(): Record<string, AuthUser> {
  const raw = localStorage.getItem(LOCAL_REGISTRY_KEY);
  return raw ? JSON.parse(raw) : {};
}

// Les profils mock pré-seedés (SEED_PROFILES) sont définis dans
// src/data/demoAccounts.ts — partagés avec le seed démo et les pages de
// connexion (react-refresh interdit d'exporter des constantes d'ici).

function seedLocalRegistry() {
  const existing = readLocalRegistry();
  if (Object.keys(existing).length > 0) {
    // Backfill : s'assurer que tous les profils existants ont des credentials
    for (const [phone, user] of Object.entries(existing)) {
      autoGenerateCredentials(phone, user.name);
    }
    return;
  }
  const registry: Record<string, AuthUser> = {};
  for (const p of SEED_PROFILES) {
    const phoneKey = normalizeCameroonPhone(p.phone);
    registry[phoneKey] = { ...p, phone: phoneKey };
    autoGenerateCredentials(phoneKey, p.name);
  }
  localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(registry));
}

/**
 * Admin définit ou réinitialise le mot de passe d'un utilisateur (mock localStorage).
 * Stocke sous les deux clés (email + téléphone) dans yamo_email_users pour
 * permettre la connexion par email ou par téléphone.
 * En mode VPS, le mot de passe est géré côté serveur.
 */
export function adminSetPassword(phone: string, newPassword: string): void {
  const phoneKey = normalizeCameroonPhone(phone);
  const emailUsers: Record<string, { phone: string; password: string; name: string | null }> =
    JSON.parse(localStorage.getItem(LOCAL_EMAIL_USERS_KEY) ?? '{}');

  const registry = readLocalRegistry();
  const user = registry[phoneKey];
  const email = getUserEmail(phoneKey, user?.name);
  const payload = { phone: phoneKey, password: newPassword, name: user?.name ?? null };

  // Met à jour les deux entrées
  emailUsers[email] = payload;
  emailUsers[phoneKey] = payload;

  localStorage.setItem(LOCAL_EMAIL_USERS_KEY, JSON.stringify(emailUsers));
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
          // API reachable but no session — user not logged in, no fallback
          setUser(null);
          setLoading(false);
          return;
        } catch {
          // API unreachable — in VPS mode, no fallback to mock
          setUser(null);
          setLoading(false);
          return;
        }
      }

      // 2. Fallback to localStorage session (mock mode only)
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
      const result = await supabase.auth.sendOtp(normalizeCameroonPhone(phone));
      return result;
    }
    // Mock mode: any code works in verifyOtp.
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string, requestedRole: UserRole = 'client') => {
    if (isSupabaseConfigured && supabase) {
      const json = await supabase.auth.verifyOtp(normalizeCameroonPhone(phone), code, requestedRole);
      if (json?.user) {
        const { data } = await supabase.auth.getSession();
        const resolvedUser: AuthUser = data?.session?.user
          ? toAuthUserFromSession(data.session.user as Record<string, unknown>)
          : toAuthUserFromSession(json.user as Record<string, unknown>);
        setUser(resolvedUser);
        return resolvedUser;
      }
      throw new Error('Code invalide.');
    }

    // Dev mode fallback: simulate a verified session without a real SMS provider.
    // The role/approval are fixed the first time a phone number "signs up" and reused after that.
    const registry = readLocalRegistry();
    const phoneKey = normalizeCameroonPhone(phone);
    const existing = registry[phoneKey];
    // Verifie quota avant de creer un nouveau profil
    if (!existing) {
      const quota = checkQuota(requestedRole);
      if (!quota.allowed) {
        throw new Error('QUOTA_EXCEEDED:' + quota.message);
      }
    }
    if (existing && existing.role !== requestedRole) {
      throw new RoleMismatchError(existing.role);
    }
    const localUser: AuthUser = existing ?? {
      id: `local-${phoneKey}`,
      phone: phoneKey,
      email: getUserEmail(phoneKey),
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
    registry[phoneKey] = localUser;
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(registry));
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localUser));
    // Auto-génère email + mot de passe par défaut pour tout nouveau profil
    autoGenerateCredentials(phoneKey, localUser.name);
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
      const phoneKey = normalizeCameroonPhone(phone);
      const { data, error } = await supabase.auth.signUp({ email, phone: phoneKey, password, name, role });
      if (error) throw error;
      if (!data?.user) throw new Error("Échec de l'inscription.");
      const u = data.user as Record<string, unknown>;
      const authUser: AuthUser = {
        id: u.id as string,
        phone: (u.phone as string) || phoneKey,
        role: (u.role as UserRole) || role,
        isApproved: Boolean(u.isApproved ?? isSelfApprovingRole(role)),
        isSuspended: false,
        email: (u.email as string | null) ?? email?.trim().toLowerCase() ?? null,
      };
      setUser(authUser);
      return authUser;
    }

    // Mock mode — store in localStorage so the user can log back in.
    const phoneKey = normalizeCameroonPhone(phone);
    const registry = readLocalRegistry();

    if (registry[phoneKey]) {
      throw new Error('Un compte existe déjà avec ce numéro de téléphone.');
    }

    // Verifie quota avant de creer un nouveau profil
    const quota = checkQuota(role);
    if (!quota.allowed) {
      throw new Error('QUOTA_EXCEEDED:' + quota.message);
    }

    const localUserId = `local-${phoneKey}`;
    const localUser: AuthUser = {
      id: localUserId,
      phone: phoneKey,
      email: email?.trim().toLowerCase() || getUserEmail(phoneKey, name),
      role,
      isApproved: isSelfApprovingRole(role),
      isSuspended: false,
      name: name?.trim() || null,
    };
    registry[phoneKey] = localUser;
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(registry));
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localUser));

    // Auto-génère email + mot de passe par défaut pour tout nouveau profil
    autoGenerateCredentials(phoneKey, name);

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
      const fresh = registry[normalizeCameroonPhone(session.phone)];
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
