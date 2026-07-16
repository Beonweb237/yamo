// ============================================================
// Système de corbeille — soft-delete avec TTL de 7 jours
// ============================================================
// Avant suppression définitive, tout élément est déplacé dans
// une corbeille horodatée. Passé le TTL (7 jours), l'élément
// est automatiquement nettoyé au prochain chargement.
// ============================================================

const TRASH_KEY = 'yamo_trash';
const TRASH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

export type TrashableType = 'menu_item' | 'address' | 'food_request' | 'order';

export interface TrashEntry {
  id: string;
  type: TrashableType;
  /** Données complètes de l'élément — permet la restauration. */
  data: unknown;
  /** Timestamp de mise en corbeille (ms). */
  trashedAt: number;
  /** Qui a mis en corbeille (phone ou id). */
  trashedBy?: string;
}

function readTrash(): TrashEntry[] {
  try {
    return JSON.parse(localStorage.getItem(TRASH_KEY) ?? '[]') as TrashEntry[];
  } catch {
    return [];
  }
}

function writeTrash(entries: TrashEntry[]): void {
  localStorage.setItem(TRASH_KEY, JSON.stringify(entries));
}

/** Nettoie les entrées expirées (> 7 jours). Appelé au démarrage. */
export function purgeExpiredTrash(): number {
  const now = Date.now();
  const entries = readTrash();
  const kept = entries.filter((e) => now - e.trashedAt < TRASH_TTL_MS);
  const removed = entries.length - kept.length;
  if (removed > 0) writeTrash(kept);
  return removed;
}

/** Déplace un élément dans la corbeille. */
export function trashItem(
  id: string,
  type: TrashableType,
  data: unknown,
  trashedBy?: string
): void {
  const entries = readTrash();
  // Évite les doublons (même id + type)
  const filtered = entries.filter((e) => !(e.id === id && e.type === type));
  filtered.push({
    id,
    type,
    data,
    trashedAt: Date.now(),
    trashedBy,
  });
  writeTrash(filtered);
}

/** Restaure un élément depuis la corbeille. Retourne les données ou null. */
export function restoreFromTrash(id: string, type: TrashableType): unknown | null {
  const entries = readTrash();
  const found = entries.find((e) => e.id === id && e.type === type);
  if (!found) return null;
  writeTrash(entries.filter((e) => !(e.id === id && e.type === type)));
  return found.data;
}

/** Supprime définitivement un élément de la corbeille (sans le restaurer). */
export function permanentlyDelete(id: string, type: TrashableType): void {
  const entries = readTrash();
  writeTrash(entries.filter((e) => !(e.id === id && e.type === type)));
}

/** Liste les éléments dans la corbeille (pour l'admin). */
export function listTrash(type?: TrashableType): TrashEntry[] {
  const entries = readTrash();
  purgeExpiredTrash();
  return type ? entries.filter((e) => e.type === type) : entries;
}

/** Nombre d'éléments dans la corbeille. */
export function trashCount(): number {
  purgeExpiredTrash();
  return readTrash().length;
}

/** Formate le temps restant avant suppression définitive. */
export function trashTimeLeft(trashedAt: number): string {
  const now = Date.now();
  const remaining = TRASH_TTL_MS - (now - trashedAt);
  if (remaining <= 0) return 'Expiré';
  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
  return `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
}
