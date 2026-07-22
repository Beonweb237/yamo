/**
 * Système de quotas pour limiter le nombre de profils par type.
 * Configurable dans l'espace admin → Quotas.
 */

import type { UserRole } from '../contexts/AuthContext';

const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

/** Clé localStorage pour les quotas configurés */
export const QUOTA_CONFIG_KEY = 'yamo_quota_config';
/** Clé localStorage pour stocker si le quota a bloqué une inscription */
export const QUOTA_BLOCK_KEY = 'yamo_quota_blocked';

/**
 * Quotas par défaut — valeurs de PRODUCTION (au-dessus des comptes réels
 * existants pour ne pas bloquer les inscriptions ; l'admin peut les ajuster).
 * Les anciennes valeurs basses (30/10/20/5) étaient calibrées pour un
 * environnement de test à vide et verrouillaient la prod (déjà 62 clients,
 * 25 restos, 28 livreurs de seed). Le blocage réel n'est actif que si l'admin
 * enregistre une config (app_settings.quota_config).
 */
export const DEFAULT_QUOTAS: Record<UserRole, number> = {
  client: 5000,
  restaurant: 500,
  livreur: 500,
  admin: 20,
};

/** Types de profils avec label */
export const QUOTA_ROLES: { role: UserRole; label: string; icon: string }[] = [
  { role: 'client', label: 'Clients', icon: '👤' },
  { role: 'restaurant', label: 'Restaurants', icon: '🏪' },
  { role: 'livreur', label: 'Livreurs', icon: '🛵' },
  { role: 'admin', label: 'Administrateurs', icon: '👑' },
];

export interface QuotaConfig {
  client: number;
  restaurant: number;
  livreur: number;
  admin: number;
}

/** Récupère la configuration des quotas */
export function getQuotaConfig(): QuotaConfig {
  try {
    const raw = localStorage.getItem(QUOTA_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<QuotaConfig>;
      return {
        client: parsed.client ?? DEFAULT_QUOTAS.client,
        restaurant: parsed.restaurant ?? DEFAULT_QUOTAS.restaurant,
        livreur: parsed.livreur ?? DEFAULT_QUOTAS.livreur,
        admin: parsed.admin ?? DEFAULT_QUOTAS.admin,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_QUOTAS };
}

/** Sauvegarde la configuration des quotas */
export function setQuotaConfig(config: QuotaConfig): void {
  localStorage.setItem(QUOTA_CONFIG_KEY, JSON.stringify(config));
}

/** Récupère le nombre actuel d'utilisateurs par rôle (mock localStorage) */
export function getUserCounts(): Record<UserRole, number> {
  const counts: Record<UserRole, number> = { client: 0, restaurant: 0, livreur: 0, admin: 0 };
  try {
    const raw = localStorage.getItem('yamo_local_users');
    if (raw) {
      const users = JSON.parse(raw) as Record<string, { role?: string }>;
      for (const u of Object.values(users)) {
        const role = u?.role as UserRole;
        if (role && role in counts) counts[role]++;
      }
    }
  } catch { /* ignore */ }
  return counts;
}

/**
 * Nombre RÉEL d'utilisateurs par rôle. En mode VPS, compté EN BASE
 * (`/api/admin/user-counts`) — le mock localStorage était toujours vide en
 * production, d'où des quotas affichés à 0. En mock, lit le registre local.
 */
export async function fetchUserCounts(): Promise<Record<UserRole, number>> {
  if (USE_VPS) {
    try {
      const res = await fetch('/api/admin/user-counts', { headers: authHeader() });
      if (res.ok) {
        const j = await res.json();
        return { client: j.client ?? 0, restaurant: j.restaurant ?? 0, livreur: j.livreur ?? 0, admin: j.admin ?? 0 };
      }
    } catch { /* repli sur le registre local */ }
  }
  return getUserCounts();
}

/** Config des quotas — VPS : app_settings.quota_config ; mock : localStorage. */
export async function fetchQuotaConfig(): Promise<QuotaConfig> {
  if (USE_VPS) {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const s = await res.json();
        const q = s?.quota_config as Partial<QuotaConfig> | undefined;
        if (q) return {
          client: q.client ?? DEFAULT_QUOTAS.client,
          restaurant: q.restaurant ?? DEFAULT_QUOTAS.restaurant,
          livreur: q.livreur ?? DEFAULT_QUOTAS.livreur,
          admin: q.admin ?? DEFAULT_QUOTAS.admin,
        };
      }
    } catch { /* repli défaut */ }
    return { ...DEFAULT_QUOTAS };
  }
  return getQuotaConfig();
}

/** Enregistre la config des quotas — VPS : app_settings (serveur applique au signup). */
export async function saveQuotaConfig(config: QuotaConfig): Promise<void> {
  if (USE_VPS) {
    await fetch('/api/settings/quota_config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ value: config }),
    });
    return;
  }
  setQuotaConfig(config);
}

/**
 * Vérifie si le quota pour un rôle donné est atteint.
 * Retourne un objet { allowed, current, max, message }.
 */
export function checkQuota(role: UserRole): { allowed: boolean; current: number; max: number; message: string } {
  const config = getQuotaConfig();
  const counts = getUserCounts();
  const max = config[role] ?? DEFAULT_QUOTAS[role] ?? 999;
  const current = counts[role] ?? 0;
  const label = QUOTA_ROLES.find(r => r.role === role)?.label ?? role;

  if (current >= max) {
    return {
      allowed: false,
      current,
      max,
      message: ` quota des ${label} atteint (${current}/${max}). Contactez l'administrateur.`,
    };
  }

  return {
    allowed: true,
    current,
    max,
    message: `${current}/${max} ${label}`,
  };
}
