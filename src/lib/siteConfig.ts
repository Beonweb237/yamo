// ═══════════════════════════════════════════════════════════════
// Apparence du site pilotée en admin (série THEME)
// ═══════════════════════════════════════════════════════════════
// Config d'apparence (template de la Home, et plus tard logo/couleurs/sections).
// Double chemin habituel : VPS app_settings (/api/settings) si VITE_USE_VPS_API,
// sinon localStorage. DÉFAUT = 'classic' → rendu IDENTIQUE à aujourd'hui.
// Même mécanisme que paymentMode.ts / le mode démo du suivi livreur.

const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';
const LS_KEY = 'miamexpress_site_config';
const EVENT = 'miamexpress:siteconfig';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export type HomeTemplate = 'classic' | 'premium';

export interface BrandColors {
  /** Vert primaire (défaut #157F3D). */
  green: string;
  /** Or accent (défaut #D4A843). */
  gold: string;
}

export const DEFAULT_BRAND_COLORS: BrandColors = { green: '#157F3D', gold: '#D4A843' };

export interface SiteConfig {
  /** Template rendu par la Home. 'classic' = l'actuel (défaut, inchangé). */
  homeTemplate: HomeTemplate;
  /** Logo icône personnalisé (navbar). Vide → défaut /logo-icon.png. */
  logoUrl?: string;
  /** Couleurs de marque appliquées via variables CSS runtime. */
  brandColors?: BrandColors;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  homeTemplate: 'classic',
};

function isHomeTemplate(v: unknown): v is HomeTemplate {
  return v === 'classic' || v === 'premium';
}

// #RGB ou #RRGGBB uniquement (garde-fou : pas d'injection de valeur CSS arbitraire).
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && HEX.test(v.trim());
}

function normalizeColors(raw: unknown): BrandColors | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const green = isHexColor(o.green) ? o.green.trim() : DEFAULT_BRAND_COLORS.green;
  const gold = isHexColor(o.gold) ? o.gold.trim() : DEFAULT_BRAND_COLORS.gold;
  return { green, gold };
}

function normalize(raw: unknown): SiteConfig {
  const o = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const cfg: SiteConfig = {
    homeTemplate: isHomeTemplate(o.homeTemplate) ? o.homeTemplate : DEFAULT_SITE_CONFIG.homeTemplate,
  };
  if (typeof o.logoUrl === 'string' && o.logoUrl.trim()) cfg.logoUrl = o.logoUrl.trim();
  const colors = normalizeColors(o.brandColors);
  if (colors) cfg.brandColors = colors;
  return cfg;
}

/** Lecture SYNCHRONE (cache localStorage) — évite le flash au 1er rendu. */
export function readSiteConfigSync(): SiteConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* défaut */ }
  return DEFAULT_SITE_CONFIG;
}

function writeCache(cfg: SiteConfig) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch { /* stockage indispo */ }
}

/** Config effective. VPS : /api/settings ; mock : localStorage. Met le cache à jour. */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (USE_VPS) {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const s = await res.json();
        const base = readSiteConfigSync();
        const cfg = normalize({
          homeTemplate: s?.home_template ?? base.homeTemplate,
          logoUrl: s?.logo_url ?? base.logoUrl,
          brandColors: s?.brand_colors ?? base.brandColors,
        });
        writeCache(cfg); // cache pour un prochain rendu sans flash
        return cfg;
      }
    } catch { /* repli cache/défaut */ }
    return readSiteConfigSync();
  }
  return readSiteConfigSync();
}

/**
 * Applique une modification partielle de la config (admin).
 * Cache local = source de vérité immédiate (reflet sans recharger). En mode VPS,
 * tente aussi de persister côté serveur (best-effort — endpoint à ajouter en CP10).
 */
export async function patchSiteConfig(partial: Partial<SiteConfig>): Promise<void> {
  const next = normalize({ ...readSiteConfigSync(), ...partial });
  writeCache(next);
  if (USE_VPS) {
    try {
      await fetch('/api/settings/site_config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          home_template: next.homeTemplate,
          logo_url: next.logoUrl ?? null,
          brand_colors: next.brandColors ?? null,
        }),
      });
    } catch { /* le cache local reflète déjà le changement */ }
  }
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* SSR */ }
}

/** Change le template de la Home (admin). */
export async function setHomeTemplate(template: HomeTemplate): Promise<void> {
  return patchSiteConfig({ homeTemplate: template });
}

/**
 * Applique les couleurs de marque via des variables CSS sur :root (override runtime
 * des tokens définis dans index.css). Valeurs vides/invalides → retour aux défauts.
 */
export function applyBrandColors(colors?: BrandColors): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (colors && isHexColor(colors.green)) root.style.setProperty('--green-primary', colors.green.trim());
  else root.style.removeProperty('--green-primary');
  if (colors && isHexColor(colors.gold)) root.style.setProperty('--gold-accent', colors.gold.trim());
  else root.style.removeProperty('--gold-accent');
}

export const SITE_CONFIG_EVENT = EVENT;
