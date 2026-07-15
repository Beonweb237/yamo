// ============================================================
// MiamExpress — Auth token helper (indépendant de Supabase)
// Récupère un token d'auth pour les appels API admin
// ============================================================

const LOCAL_SESSION_KEY = 'yamo_local_user';

/**
 * Récupère le token d'authentification pour les appels API admin.
 * - Si Supabase est configuré → utilise le JWT Supabase
 * - Sinon → utilise l'ID de session locale (mock mode VPS autonome)
 */
export async function getAuthToken(): Promise<string> {
  try {
    // Essayer Supabase d'abord
    const { supabase } = await import('./supabase');
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return session.access_token;
    }
  } catch { /* pas de Supabase, on continue */ }

  // Fallback : session locale (mock mode)
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      // L'API accepte l'ID utilisateur comme token en mode local
      return user?.id || user?.phone || '';
    }
  } catch { /* */ }

  return '';
}

/**
 * Headers d'auth prêts à être utilisés dans fetch()
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
