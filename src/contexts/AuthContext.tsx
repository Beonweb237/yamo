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
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isSupabaseConfigured: boolean;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string, requestedRole?: UserRole) => Promise<void>;
  // Password sign-in for seeded test accounts (scripts/seed-test-data.mjs) —
  // bypasses phone OTP, which needs an SMS provider that isn't configured yet.
  signInWithPassword: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const LOCAL_SESSION_KEY = 'yamo_local_user';
export const LOCAL_REGISTRY_KEY = 'yamo_local_users'; // phone -> AuthUser, so role/approval sticks across re-logins

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

    if (isSupabaseConfigured && supabase) {
      loadSupabaseSession().then(() => setLoading(false));
      const { data: sub } = supabase.auth.onAuthStateChange(() => {
        loadSupabaseSession();
      });
      return () => sub.subscription.unsubscribe();
    }

    // No backend configured yet: restore a locally simulated session.
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (raw) {
      const session: AuthUser = JSON.parse(raw);
      const { isSuspended, reason } = getLocalSuspensionInfo(session.id);
      setUser({ ...session, isSuspended, suspensionReason: reason ?? null });
    }
    setLoading(false);
  }, [loadSupabaseSession]);

  const sendOtp = useCallback(async (phone: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      return;
    }
    // Dev mode: no SMS provider configured, the code is a no-op — any code works in verifyOtp.
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string, requestedRole: UserRole = 'client') => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
      if (error) throw error;
      if (data.user) {
        const { role, isApproved, isSuspended, suspensionReason, phone: resolvedPhone } = await resolveSupabaseProfile(
          data.user.id,
          data.user.phone ?? phone,
          requestedRole
        );
        setUser({ id: data.user.id, phone: resolvedPhone, role, isApproved, isSuspended, suspensionReason });
      }
      return;
    }

    // Dev mode fallback: simulate a verified session without a real SMS provider.
    // The role/approval are fixed the first time a phone number "signs up" and reused after that.
    const registry = readLocalRegistry();
    const existing = registry[phone];
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

  return (
    <AuthContext.Provider
      value={{ user, loading, isSupabaseConfigured, sendOtp, verifyOtp, signInWithPassword, signOut, refreshUser }}
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
