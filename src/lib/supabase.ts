import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
// Force mock mode in local dev when set to 'true' (useful when you want the
// frontend to stay in simulation even if Supabase keys are present).
const forceMock = (import.meta.env.VITE_FORCE_MOCK_AUTH as string | undefined) === 'true';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !forceMock);

// `supabase` is null until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set
// AND `VITE_FORCE_MOCK_AUTH` is not 'true'. Every caller must check
// `isSupabaseConfigured` first so the app keeps working on mock data during
// local development or when we explicitly force mock mode.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

/**
 * Returns true only when Supabase is configured AND there is a valid
 * authenticated session. Use this guard whenever an operation requires
 * an authenticated user (mutations, profile reads, applications…).
 * Public reads (catalog, restaurants) can skip this check.
 */
export async function isSupabaseAuthenticated(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}
