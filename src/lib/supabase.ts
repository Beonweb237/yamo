// ============================================================
// MiamExpress — Mode 100% autonome (sans Supabase)
// ============================================================

export const isSupabaseConfigured = false;
export const supabase = null;

export async function isSupabaseAuthenticated(): Promise<boolean> {
  return false;
}
