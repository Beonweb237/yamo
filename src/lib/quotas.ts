/**
 * Système de quotas pour limiter le nombre de profils par type.
 * Configurable dans l'espace admin → Quotas.
 */

import type { UserRole } from '../contexts/AuthContext';

/** Clé localStorage pour les quotas configurés */
export const QUOTA_CONFIG_KEY = 'yamo_quota_config';
/** Clé localStorage pour stocker si le quota a bloqué une inscription */
export const QUOTA_BLOCK_KEY = 'yamo_quota_blocked';

/** Quotas par défaut */
export const DEFAULT_QUOTAS: Record<UserRole, number> = {
  client: 30,
  restaurant: 10,
  livreur: 20,
  admin: 5,
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
