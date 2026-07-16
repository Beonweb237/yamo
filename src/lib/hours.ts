// Horaires d'ouverture structurés (LOT-14 / CONF-36).
//
// Le format de stockage reste la chaîne historique "HH:MM - HH:MM"
// (mockData, overrides localStorage, futur backend VPS) : aucune migration
// de données. Ce module est la seule source de vérité pour parser ce format
// et calculer l'état ouvert/fermé réel :
//   ouvert effectif = toggle manuel `isOpen` ET heure courante dans la plage.
// Un `hours` illisible (ancien texte libre) est toléré : on retombe sur
// `isOpen` seul, comme avant.

export interface ParsedHours {
  /** Heure d'ouverture "HH:MM" */
  open: string;
  /** Heure de fermeture "HH:MM" (peut être après minuit : "02:00") */
  close: string;
}

// Tolère "8:00", "08h00", espaces variables autour du tiret.
const HOURS_RE = /^\s*(\d{1,2})[:hH](\d{2})\s*[-–]\s*(\d{1,2})[:hH](\d{2})\s*$/;

const pad = (n: number) => String(n).padStart(2, '0');

export function parseHours(hours: string | undefined | null): ParsedHours | null {
  if (!hours) return null;
  const m = HOURS_RE.exec(hours);
  if (!m) return null;
  const [, oh, om, ch, cm] = m;
  const openH = Number(oh);
  const closeH = Number(ch);
  if (openH > 23 || Number(om) > 59 || closeH > 24 || Number(cm) > 59) return null;
  return {
    open: `${pad(openH)}:${om}`,
    close: `${pad(closeH % 24)}:${cm}`,
  };
}

export function formatHours(open: string, close: string): string {
  return `${open} - ${close}`;
}

/** Minutes depuis minuit pour "HH:MM". */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * L'heure courante est-elle dans la plage ? `null` si `hours` est illisible.
 * Gère les plages de nuit (ex. "10:00 - 02:00" : ouvert si ≥ 10h OU < 2h).
 */
export function isWithinHours(hours: string | undefined | null, now: Date = new Date()): boolean | null {
  const parsed = parseHours(hours);
  if (!parsed) return null;
  const open = toMinutes(parsed.open);
  const close = toMinutes(parsed.close);
  const cur = now.getHours() * 60 + now.getMinutes();
  if (open === close) return true; // 24h/24
  if (close > open) return cur >= open && cur < close;
  return cur >= open || cur < close; // plage de nuit
}

/**
 * État ouvert réellement affiché au client : le toggle du restaurateur
 * (`isOpen`, fermeture exceptionnelle) ET les horaires du jour.
 */
export function isEffectivelyOpen(
  resto: { isOpen: boolean; hours?: string },
  now: Date = new Date()
): boolean {
  if (!resto.isOpen) return false;
  return isWithinHours(resto.hours, now) ?? true;
}
