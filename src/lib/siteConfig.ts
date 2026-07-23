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

/** Sections pilotables de la Home Premium (ordre = ordre d'affichage). */
export const HOME_SECTION_IDS = ['categories', 'popular', 'recent_orders', 'promos'] as const;
export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

export interface HomeSectionSetting {
  id: HomeSectionId;
  enabled: boolean;
}

export const DEFAULT_HOME_SECTIONS: HomeSectionSetting[] =
  HOME_SECTION_IDS.map((id) => ({ id, enabled: true }));

export interface SupportConfig {
  /** Numéro d'appel affiché/utilisé par les liens tel: (chiffres). */
  phone?: string;
  /** Numéro WhatsApp international sans '+' (chiffres). */
  whatsapp?: string;
  /** Horaires du support (texte court, ex. « 8h – 22h, 7j/7 »). */
  hours?: string;
}

export interface SiteConfig {
  /** Template rendu par la Home. 'classic' = l'actuel (défaut, inchangé). */
  homeTemplate: HomeTemplate;
  /** Logo icône personnalisé (navbar). Vide → défaut /logo-icon.png. */
  logoUrl?: string;
  /** Couleurs de marque appliquées via variables CSS runtime. */
  brandColors?: BrandColors;
  /** Sections de la Home Premium (ordre + activation). Absent = toutes, ordre par défaut. */
  homeSections?: HomeSectionSetting[];
  /** Titre du hero (accueil classique). Vide = texte par défaut. */
  heroTitle?: string;
  /** Sous-titre du hero (accueil classique). Vide = texte par défaut. */
  heroSubtitle?: string;
  /** Coordonnées support (override de src/data/support.ts). */
  support?: SupportConfig;
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

function isSectionId(v: unknown): v is HomeSectionId {
  return typeof v === 'string' && (HOME_SECTION_IDS as readonly string[]).includes(v);
}

/** Ordre + activation des sections : ids connus uniquement, sans doublon, les
 *  sections manquantes sont rajoutées à la fin (activées) — robuste aux configs
 *  anciennes quand une nouvelle section apparaît dans le code. */
function normalizeSections(raw: unknown): HomeSectionSetting[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<HomeSectionId>();
  const out: HomeSectionSetting[] = [];
  for (const item of raw) {
    const o = (item && typeof item === 'object') ? item as Record<string, unknown> : {};
    if (!isSectionId(o.id) || seen.has(o.id)) continue;
    seen.add(o.id);
    out.push({ id: o.id, enabled: o.enabled !== false });
  }
  for (const id of HOME_SECTION_IDS) {
    if (!seen.has(id)) out.push({ id, enabled: true });
  }
  return out;
}

function cleanText(v: unknown, max = 200): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, max);
  return s || undefined;
}

/** Chiffres uniquement (téléphone/WhatsApp) — tolère espaces et '+' saisis. */
function cleanDigits(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/\D/g, '');
  return s.length >= 8 && s.length <= 15 ? s : undefined;
}

function normalizeSupport(raw: unknown): SupportConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const support: SupportConfig = {};
  const phone = cleanDigits(o.phone);
  const whatsapp = cleanDigits(o.whatsapp);
  const hours = cleanText(o.hours, 80);
  if (phone) support.phone = phone;
  if (whatsapp) support.whatsapp = whatsapp;
  if (hours) support.hours = hours;
  return Object.keys(support).length ? support : undefined;
}

function normalize(raw: unknown): SiteConfig {
  const o = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const cfg: SiteConfig = {
    homeTemplate: isHomeTemplate(o.homeTemplate) ? o.homeTemplate : DEFAULT_SITE_CONFIG.homeTemplate,
  };
  if (typeof o.logoUrl === 'string' && o.logoUrl.trim()) cfg.logoUrl = o.logoUrl.trim();
  const colors = normalizeColors(o.brandColors);
  if (colors) cfg.brandColors = colors;
  const sections = normalizeSections(o.homeSections);
  if (sections) cfg.homeSections = sections;
  const heroTitle = cleanText(o.heroTitle);
  if (heroTitle) cfg.heroTitle = heroTitle;
  const heroSubtitle = cleanText(o.heroSubtitle, 300);
  if (heroSubtitle) cfg.heroSubtitle = heroSubtitle;
  const support = normalizeSupport(o.support);
  if (support) cfg.support = support;
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

/** Config effective. VPS : /api/settings (clé app_settings `site_config`) ;
 *  mock : localStorage. Met le cache à jour. */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (USE_VPS) {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const s = await res.json();
        // La config vit sous la clé `site_config` (contrat générique PATCH
        // /api/settings/:key de tracking-routes.js). Tolère l'ancien format à plat.
        const sc = (s?.site_config && typeof s.site_config === 'object') ? s.site_config : s;
        const base = readSiteConfigSync();
        const cfg = normalize({
          homeTemplate: sc?.home_template ?? base.homeTemplate,
          logoUrl: sc?.logo_url ?? base.logoUrl,
          brandColors: sc?.brand_colors ?? base.brandColors,
          homeSections: sc?.home_sections ?? base.homeSections,
          heroTitle: sc?.hero_title ?? base.heroTitle,
          heroSubtitle: sc?.hero_subtitle ?? base.heroSubtitle,
          support: sc?.support ?? base.support,
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
      // Contrat générique app_settings : PATCH /api/settings/:key { value } (admin).
      await fetch('/api/settings/site_config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          value: {
            home_template: next.homeTemplate,
            logo_url: next.logoUrl ?? null,
            brand_colors: next.brandColors ?? null,
            home_sections: next.homeSections ?? null,
            hero_title: next.heroTitle ?? null,
            hero_subtitle: next.heroSubtitle ?? null,
            support: next.support ?? null,
          },
        }),
      });
    } catch { /* le cache local reflète déjà le changement */ }
  }
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* SSR */ }
}

/** Sections effectives de la Home Premium (config ou défaut). */
export function effectiveHomeSections(cfg: SiteConfig): HomeSectionSetting[] {
  return cfg.homeSections ?? DEFAULT_HOME_SECTIONS;
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
