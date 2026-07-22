// ============================================================
// MiamPoints — moteur de fidélité CLIENT (série LOY)
// ============================================================
// Ledger IMMUABLE append-only, même philosophie que pointsCore (restaurant),
// mais scoping CLIENT. Storage et config injectés (testable sous Node par
// verify:loyalty). Boucle fermée : points gagnés sur commandes livrées,
// dépensés en réduction au checkout. Non remboursables, non convertibles cash.
//
// Invariants :
// 1. Le solde disponible ne devient jamais négatif.
// 2. Chaque mouvement est append-only ; on compense par écriture inverse.
// 3. Idempotence : une seule écriture par couple (kind, reference).
// 4. Le solde est TOUJOURS dérivé du ledger.
// 5. Expiration : après EXPIRY_MONTHS sans le moindre mouvement, le solde est
//    considéré comme expiré (0). Tout nouveau mouvement relance le compteur.

export type LoyaltyEntryKind =
  | 'earn'
  | 'redeem'
  | 'redeem_refund'
  | 'expiry'
  | 'admin_adjustment';

export interface LoyaltyLedgerEntry {
  id: string;
  customerId: string;
  kind: LoyaltyEntryKind;
  /** Signé : crédit > 0, débit < 0. */
  points: number;
  /** Référence unique par (kind, reference) : id commande, ajustement… */
  reference: string;
  note?: string;
  createdAt: string;
  createdBy: 'system' | string;
}

export interface LoyaltyBalance {
  /** Solde utilisable (0 si expiré). */
  available: number;
  /** Cumul historique gagné (indicatif, ne tient pas compte de l'expiration). */
  lifetimeEarned: number;
  /** Date du dernier mouvement (ISO) ou null. */
  lastActivityAt: string | null;
  /** true si le solde est expiré (inactivité). */
  expired: boolean;
}

export interface LoyaltyEngineConfig {
  EARN_RATE: number;
  POINT_VALUE_FCFA: number;
  MIN_REDEEM_POINTS: number;
  MAX_REDEEM_RATE: number;
  EXPIRY_MONTHS: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class InsufficientLoyaltyError extends Error {
  constructor(message = 'Solde de MiamPoints insuffisant.') {
    super(message);
    this.name = 'InsufficientLoyaltyError';
  }
}

export const LOYALTY_LEDGER_KEY = 'yamo_loyalty_ledger';

function uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'loy-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export function createLoyaltyEngine(storage: KeyValueStorage, config: LoyaltyEngineConfig) {
  const earnFor = (subtotal: number) => Math.round(Math.max(0, subtotal || 0) * config.EARN_RATE);
  const maxRedeemFor = (subtotal: number) => Math.floor(Math.max(0, subtotal || 0) * config.MAX_REDEEM_RATE);

  const readLedger = (): LoyaltyLedgerEntry[] => {
    const raw = storage.getItem(LOYALTY_LEDGER_KEY);
    return raw ? (JSON.parse(raw) as LoyaltyLedgerEntry[]) : [];
  };
  const writeLedger = (entries: LoyaltyLedgerEntry[]) => {
    storage.setItem(LOYALTY_LEDGER_KEY, JSON.stringify(entries));
  };
  const findEntry = (kind: LoyaltyEntryKind, reference: string, customerId: string) =>
    readLedger().find((e) => e.kind === kind && e.reference === reference && e.customerId === customerId);

  const appendEntry = (entry: Omit<LoyaltyLedgerEntry, 'id' | 'createdAt'>): LoyaltyLedgerEntry => {
    const existing = findEntry(entry.kind, entry.reference, entry.customerId);
    if (existing) return existing;
    const full: LoyaltyLedgerEntry = { ...entry, id: uuid(), createdAt: new Date().toISOString() };
    writeLedger([...readLedger(), full]);
    return full;
  };

  const getBalance = (customerId: string, now: Date = new Date()): LoyaltyBalance => {
    const entries = readLedger().filter((e) => e.customerId === customerId);
    const raw = entries.reduce((s, e) => s + e.points, 0);
    const lifetimeEarned = entries.filter((e) => e.kind === 'earn').reduce((s, e) => s + e.points, 0);
    const last = entries.reduce<string | null>((acc, e) => (!acc || e.createdAt > acc ? e.createdAt : acc), null);
    const expired =
      config.EXPIRY_MONTHS > 0 && last !== null && monthsBetween(new Date(last), now) >= config.EXPIRY_MONTHS;
    return {
      available: expired ? 0 : Math.max(0, raw),
      lifetimeEarned,
      lastActivityAt: last,
      expired,
    };
  };

  /** Crédite les points gagnés sur une commande livrée (idempotent par commande). */
  const earn = (customerId: string, orderId: string, subtotalFcfa: number): LoyaltyLedgerEntry | null => {
    const pts = earnFor(subtotalFcfa);
    if (pts <= 0) return null;
    return appendEntry({
      customerId,
      kind: 'earn',
      points: pts,
      reference: orderId,
      note: `+${pts} MiamPoints — commande #${orderId.slice(0, 8)} livrée`,
      createdBy: 'system',
    });
  };

  /**
   * Débite les points utilisés au checkout. Vérifie : solde suffisant, minimum
   * d'utilisation, plafond (part max de la commande). Idempotent par commande.
   */
  const redeem = (
    customerId: string,
    orderId: string,
    requestedPoints: number,
    orderSubtotalFcfa: number,
    now: Date = new Date()
  ): LoyaltyLedgerEntry => {
    const existing = findEntry('redeem', orderId, customerId);
    if (existing) return existing;
    const req = Math.floor(requestedPoints);
    const { available } = getBalance(customerId, now);
    const cap = maxRedeemFor(orderSubtotalFcfa);
    if (req < config.MIN_REDEEM_POINTS) {
      throw new InsufficientLoyaltyError(`Utilisation minimale de ${config.MIN_REDEEM_POINTS} MiamPoints.`);
    }
    if (req > available) {
      throw new InsufficientLoyaltyError(`Solde insuffisant (${available} MiamPoints disponibles).`);
    }
    if (req > cap) {
      throw new InsufficientLoyaltyError(`Vous pouvez utiliser au plus ${cap} MiamPoints sur cette commande.`);
    }
    return appendEntry({
      customerId,
      kind: 'redeem',
      points: -req,
      reference: orderId,
      note: `-${req} MiamPoints utilisés — commande #${orderId.slice(0, 8)}`,
      createdBy: 'system',
    });
  };

  /** Restitue les points utilisés si la commande est annulée (idempotent). */
  const refundRedeem = (customerId: string, orderId: string): LoyaltyLedgerEntry | null => {
    const redeemEntry = findEntry('redeem', orderId, customerId);
    if (!redeemEntry) return null;
    const already = findEntry('redeem_refund', orderId, customerId);
    if (already) return already;
    return appendEntry({
      customerId,
      kind: 'redeem_refund',
      points: -redeemEntry.points, // redeem est négatif → on recrédite
      reference: orderId,
      note: `Commande #${orderId.slice(0, 8)} annulée — ${-redeemEntry.points} MiamPoints restitués`,
      createdBy: 'system',
    });
  };

  const adminAdjust = (customerId: string, points: number, adminId: string, note: string): LoyaltyLedgerEntry => {
    if (!note?.trim()) throw new Error("Le motif de l'ajustement est obligatoire.");
    if (!Number.isInteger(points) || points === 0) throw new Error('Ajustement invalide.');
    if (points < 0) {
      const { available } = getBalance(customerId);
      if (available + points < 0) throw new InsufficientLoyaltyError('Ajustement refusé : solde négatif.');
    }
    return appendEntry({
      customerId,
      kind: 'admin_adjustment',
      points,
      reference: uuid(),
      note: note.trim(),
      createdBy: adminId,
    });
  };

  const fetchLedger = (customerId: string, opts: { limit?: number; offset?: number } = {}): LoyaltyLedgerEntry[] => {
    const { limit = 50, offset = 0 } = opts;
    return readLedger()
      .filter((e) => e.customerId === customerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(offset, offset + limit);
  };

  return { getBalance, earn, redeem, refundRedeem, adminAdjust, fetchLedger, earnFor, maxRedeemFor };
}

export type LoyaltyEngine = ReturnType<typeof createLoyaltyEngine>;
