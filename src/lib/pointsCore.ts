// ============================================================
// Système de points restaurant — moteur pur (série PTS)
// ============================================================
// Machine à états et ledger IMMUABLE, sans dépendance au DOM ni à
// import.meta : le storage (localStorage ou équivalent en mémoire)
// et la config (POINTS_CONFIG) sont injectés. C'est CE module que
// `npm run verify:points` exécute sous Node — le même code que l'app.
//
// Invariants (points-system-prompts.md §0) :
// 1. Le solde disponible ne peut jamais devenir négatif.
// 2. Chaque mouvement est une écriture append-only ; on ne modifie ni ne
//    supprime jamais une écriture, on compense par une écriture inverse.
// 3. Idempotence : une seule écriture par couple (kind, reference).
// 4. Le solde est toujours DÉRIVÉ du ledger (jamais stocké à part).
//
// Arithmétique du ledger : `available` = somme brute des points de toutes
// les écritures. Un hold s'écrit −ORDER_COST immédiatement ; son règlement
// est une écriture de solde : consume = 0 (les points restent débités),
// release = +ORDER_COST (tout restitué), penalty = +(ORDER_COST − PENALTY).
// `held` (informationnel) = somme des holds sans écriture de règlement.

export type PointsEntryKind =
  | 'recharge'
  | 'welcome_bonus'
  | 'hold'
  | 'consume'
  | 'release'
  | 'penalty'
  | 'convert_refund'
  | 'admin_adjustment'
  /** Dotation promotionnelle (campagne de lancement) — idempotente par (campagne, resto). */
  | 'promo_grant';

export interface PointsLedgerEntry {
  id: string;
  restaurantId: string;
  kind: PointsEntryKind;
  /** Signé : crédit > 0, débit < 0. Peut valoir 0 (règlement `consume`). */
  points: number;
  /** Référence métier unique par (kind, reference) : id commande, recharge, litige… */
  reference: string;
  note?: string;
  createdAt: string;
  createdBy: 'system' | string;
}

export type RechargeMethod = 'momo' | 'cash_partner';
export type RechargeStatus = 'pending' | 'validated' | 'rejected';

export interface RechargeRequest {
  id: string;
  restaurantId: string;
  points: number;
  amountFcfa: number;
  method: RechargeMethod;
  /** Référence courte à rappeler lors du dépôt Mobile Money / chez le partenaire. */
  paymentRef: string;
  status: RechargeStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  rejectionReason?: string;
}

export interface PointsBalance {
  available: number;
  held: number;
}

export type HoldOutcome = 'consume' | 'release' | 'penalty';

export interface PointsEngineConfig {
  /** 1 = le solde est libellé en FCFA (unité de compte = 1 FCFA). */
  POINT_PRICE_FCFA: number;
  /** Pénalité conservée sur la réservation en cas d'annulation par faute du resto (FCFA). */
  PENALTY_RESTAURANT_FAULT_FCFA: number;
  /** Plancher de solde additionnel exigé pour accepter (FCFA, 0 = couvrir juste la commission). */
  MIN_BALANCE_FLOOR_FCFA: number;
  /** Recharge minimale (FCFA). */
  MIN_RECHARGE_FCFA: number;
  /** Crédit de bienvenue offert à l'activation (FCFA, 0 = désactivé). */
  WELCOME_BONUS_FCFA: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class InsufficientPointsError extends Error {
  constructor(message = 'Solde de points insuffisant. Rechargez votre compte pour continuer.') {
    super(message);
    this.name = 'InsufficientPointsError';
  }
}

export class NoActiveHoldError extends Error {
  constructor(orderId: string) {
    super(`Aucune réservation de points active pour la commande ${orderId}.`);
    this.name = 'NoActiveHoldError';
  }
}

export const POINTS_LEDGER_KEY = 'yamo_points_ledger';
export const POINTS_RECHARGES_KEY = 'yamo_points_recharges';

/** Kinds qui règlent un hold (même reference = id de commande). */
const SETTLEMENT_KINDS: PointsEntryKind[] = ['consume', 'release', 'penalty'];

function uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'pts-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function createPointsEngine(storage: KeyValueStorage, config: PointsEngineConfig) {
  const readLedger = (): PointsLedgerEntry[] => {
    const raw = storage.getItem(POINTS_LEDGER_KEY);
    return raw ? (JSON.parse(raw) as PointsLedgerEntry[]) : [];
  };
  const writeLedger = (entries: PointsLedgerEntry[]) => {
    storage.setItem(POINTS_LEDGER_KEY, JSON.stringify(entries));
  };
  const readRecharges = (): RechargeRequest[] => {
    const raw = storage.getItem(POINTS_RECHARGES_KEY);
    return raw ? (JSON.parse(raw) as RechargeRequest[]) : [];
  };
  const writeRecharges = (requests: RechargeRequest[]) => {
    storage.setItem(POINTS_RECHARGES_KEY, JSON.stringify(requests));
  };

  const findEntry = (kind: PointsEntryKind, reference: string): PointsLedgerEntry | undefined =>
    readLedger().find((e) => e.kind === kind && e.reference === reference);

  /** Append idempotent : si (kind, reference) existe déjà, renvoie l'existante sans écrire. */
  const appendEntry = (entry: Omit<PointsLedgerEntry, 'id' | 'createdAt'>): PointsLedgerEntry => {
    const existing = findEntry(entry.kind, entry.reference);
    if (existing) return existing;
    const full: PointsLedgerEntry = { ...entry, id: uuid(), createdAt: new Date().toISOString() };
    writeLedger([...readLedger(), full]);
    return full;
  };

  const getBalance = (restaurantId: string): PointsBalance => {
    const entries = readLedger().filter((e) => e.restaurantId === restaurantId);
    const available = entries.reduce((sum, e) => sum + e.points, 0);
    const settledRefs = new Set(
      entries.filter((e) => SETTLEMENT_KINDS.includes(e.kind)).map((e) => e.reference)
    );
    const held = entries
      .filter((e) => e.kind === 'hold' && !settledRefs.has(e.reference))
      .reduce((sum, e) => sum + -e.points, 0);
    return { available, held };
  };

  const hasActiveHold = (restaurantId: string, orderId: string): boolean => {
    const hold = findEntry('hold', orderId);
    if (!hold || hold.restaurantId !== restaurantId) return false;
    return !readLedger().some(
      (e) => SETTLEMENT_KINDS.includes(e.kind) && e.reference === orderId
    );
  };

  /**
   * Le resto peut accepter une commande si son solde couvre la commission de
   * CETTE commande (15 % de son sous-total) plus l'éventuel plancher de caution.
   */
  const canAcceptOrder = (restaurantId: string, commissionFcfa: number): boolean => {
    const { available } = getBalance(restaurantId);
    return available >= commissionFcfa + config.MIN_BALANCE_FLOOR_FCFA;
  };

  /** Réserve la commission (FCFA) de la commande sur le solde du resto. */
  const holdPoints = (
    restaurantId: string,
    orderId: string,
    commissionFcfa: number
  ): PointsLedgerEntry => {
    const existing = findEntry('hold', orderId);
    if (existing) return existing; // idempotent
    const amount = Math.max(0, Math.round(commissionFcfa));
    const { available } = getBalance(restaurantId);
    if (available < amount + config.MIN_BALANCE_FLOOR_FCFA) {
      throw new InsufficientPointsError(
        `Solde insuffisant (${available.toLocaleString()} FCFA) : accepter cette commande réserve ${amount.toLocaleString()} FCFA de commission. Rechargez votre compte.`
      );
    }
    return appendEntry({
      restaurantId,
      kind: 'hold',
      points: -amount,
      reference: orderId,
      note: `Réservation commission (${amount.toLocaleString()} FCFA) — commande #${orderId.slice(0, 8)}`,
      createdBy: 'system',
    });
  };

  const settleHold = (
    restaurantId: string,
    orderId: string,
    outcome: HoldOutcome
  ): PointsLedgerEntry => {
    const hold = findEntry('hold', orderId);
    if (!hold || hold.restaurantId !== restaurantId) throw new NoActiveHoldError(orderId);
    const alreadySettled = readLedger().find(
      (e) => SETTLEMENT_KINDS.includes(e.kind) && e.reference === orderId
    );
    if (alreadySettled) return alreadySettled; // idempotent
    const holdAmount = -hold.points;
    if (outcome === 'consume') {
      return appendEntry({
        restaurantId,
        kind: 'consume',
        points: 0,
        reference: orderId,
        note: `Commande #${orderId.slice(0, 8)} livrée — ${holdAmount} points consommés`,
        createdBy: 'system',
      });
    }
    if (outcome === 'release') {
      return appendEntry({
        restaurantId,
        kind: 'release',
        points: holdAmount,
        reference: orderId,
        note: `Commande #${orderId.slice(0, 8)} annulée sans faute — ${holdAmount.toLocaleString()} FCFA restitués`,
        createdBy: 'system',
      });
    }
    const penalty = Math.min(holdAmount, config.PENALTY_RESTAURANT_FAULT_FCFA);
    const restored = holdAmount - penalty;
    return appendEntry({
      restaurantId,
      kind: 'penalty',
      points: restored,
      reference: orderId,
      note: `Annulation par le restaurant — pénalité de ${penalty.toLocaleString()} FCFA conservée, ${restored.toLocaleString()} FCFA restitués`,
      createdBy: 'system',
    });
  };

  const convertPointsToRefund = (
    restaurantId: string,
    disputeId: string,
    amountFcfa: number
  ): PointsLedgerEntry => {
    const existing = findEntry('convert_refund', disputeId);
    if (existing) return existing; // idempotent
    const pts = Math.ceil(amountFcfa / config.POINT_PRICE_FCFA);
    const { available } = getBalance(restaurantId);
    if (available < pts) {
      throw new InsufficientPointsError(
        `Caution insuffisante : le remboursement de ${amountFcfa.toLocaleString()} FCFA exige ${pts} points, solde disponible ${available}. Le reliquat devra être réglé hors application (phase 1).`
      );
    }
    return appendEntry({
      restaurantId,
      kind: 'convert_refund',
      points: -pts,
      reference: disputeId,
      note: `Remboursement garantie client (${amountFcfa.toLocaleString()} FCFA) prélevé sur la caution — litige ${disputeId.slice(0, 8)}`,
      createdBy: 'system',
    });
  };

  const requestRecharge = (
    restaurantId: string,
    points: number, // montant en FCFA (unité de compte = 1 FCFA)
    method: RechargeMethod
  ): RechargeRequest => {
    if (!Number.isInteger(points) || points < config.MIN_RECHARGE_FCFA) {
      throw new Error(`La recharge minimale est de ${config.MIN_RECHARGE_FCFA.toLocaleString()} FCFA.`);
    }
    const request: RechargeRequest = {
      id: uuid(),
      restaurantId,
      points,
      amountFcfa: points * config.POINT_PRICE_FCFA,
      method,
      paymentRef: 'PTS-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    writeRecharges([request, ...readRecharges()]);
    return request;
  };

  const decideRecharge = (
    requestId: string,
    decision: 'validate' | 'reject',
    adminId: string,
    reason?: string
  ): RechargeRequest => {
    const requests = readRecharges();
    const request = requests.find((r) => r.id === requestId);
    if (!request) throw new Error('Demande de recharge introuvable.');
    if (request.status !== 'pending') return request; // idempotent
    if (decision === 'reject' && !reason?.trim()) {
      throw new Error('Le motif de rejet est obligatoire.');
    }
    const updated: RechargeRequest = {
      ...request,
      status: decision === 'validate' ? 'validated' : 'rejected',
      decidedAt: new Date().toISOString(),
      decidedBy: adminId,
      rejectionReason: decision === 'reject' ? reason?.trim() : undefined,
    };
    writeRecharges(requests.map((r) => (r.id === requestId ? updated : r)));
    if (decision === 'validate') {
      appendEntry({
        restaurantId: request.restaurantId,
        kind: 'recharge',
        points: request.points,
        reference: requestId,
        note: `Recharge ${request.method === 'momo' ? 'Mobile Money' : 'cash partenaire'} — réf. ${request.paymentRef}`,
        createdBy: adminId,
      });
    }
    return updated;
  };

  const grantWelcomeBonus = (restaurantId: string): PointsLedgerEntry | null => {
    if (config.WELCOME_BONUS_FCFA <= 0) return null;
    return appendEntry({
      restaurantId,
      kind: 'welcome_bonus',
      points: config.WELCOME_BONUS_FCFA,
      reference: restaurantId, // une seule fois par resto (idempotent)
      note: `Crédit de bienvenue MiamExpress (${config.WELCOME_BONUS_FCFA.toLocaleString()} FCFA offerts)`,
      createdBy: 'system',
    });
  };

  /**
   * Dotation promotionnelle (lancement) : crédite `points` au resto, une seule
   * fois par campagne — rejouer la même campagne sur le même resto est sans
   * effet (référence `campagne:resto`). L'écriture porte le libellé de campagne.
   */
  const grantPromo = (
    restaurantId: string,
    points: number,
    campaignId: string,
    note: string,
    adminId: string
  ): { entry: PointsLedgerEntry; alreadyGranted: boolean } => {
    if (!Number.isInteger(points) || points <= 0) {
      throw new Error('Dotation invalide : nombre de points entier positif requis.');
    }
    if (!campaignId.trim()) throw new Error('Identifiant de campagne requis.');
    const reference = `${campaignId.trim()}:${restaurantId}`;
    const existing = findEntry('promo_grant', reference);
    if (existing) return { entry: existing, alreadyGranted: true };
    const entry = appendEntry({
      restaurantId,
      kind: 'promo_grant',
      points,
      reference,
      note: note.trim() || `Dotation promotionnelle « ${campaignId.trim()} »`,
      createdBy: adminId,
    });
    return { entry, alreadyGranted: false };
  };

  const adminAdjust = (
    restaurantId: string,
    points: number,
    adminId: string,
    note: string
  ): PointsLedgerEntry => {
    if (!note?.trim()) throw new Error("Le motif de l'ajustement est obligatoire.");
    if (!Number.isInteger(points) || points === 0) {
      throw new Error('Ajustement invalide : nombre de points entier non nul requis.');
    }
    if (points < 0) {
      const { available } = getBalance(restaurantId);
      if (available + points < 0) {
        throw new InsufficientPointsError(
          `Ajustement refusé : le solde deviendrait négatif (${available} + (${points}) < 0).`
        );
      }
    }
    return appendEntry({
      restaurantId,
      kind: 'admin_adjustment',
      points,
      reference: uuid(), // chaque ajustement est unique
      note: note.trim(),
      createdBy: adminId,
    });
  };

  const fetchLedger = (
    restaurantId: string,
    opts: { limit?: number; offset?: number } = {}
  ): PointsLedgerEntry[] => {
    const { limit = 50, offset = 0 } = opts;
    return readLedger()
      .filter((e) => e.restaurantId === restaurantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(offset, offset + limit);
  };

  /** Flux global du ledger (tous restaurants), plus récents d'abord — vue admin. */
  const fetchGlobalLedger = (opts: { limit?: number; offset?: number } = {}): PointsLedgerEntry[] => {
    const { limit = 50, offset = 0 } = opts;
    return readLedger()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(offset, offset + limit);
  };

  const fetchAllBalances = (): Record<string, PointsBalance> => {
    const ids = [...new Set(readLedger().map((e) => e.restaurantId))];
    return Object.fromEntries(ids.map((id) => [id, getBalance(id)]));
  };

  const listRecharges = (
    filter: { status?: RechargeStatus; restaurantId?: string } = {}
  ): RechargeRequest[] =>
    readRecharges()
      .filter((r) => (filter.status ? r.status === filter.status : true))
      .filter((r) => (filter.restaurantId ? r.restaurantId === filter.restaurantId : true))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  return {
    getBalance,
    hasActiveHold,
    canAcceptOrder,
    holdPoints,
    settleHold,
    convertPointsToRefund,
    requestRecharge,
    decideRecharge,
    grantWelcomeBonus,
    grantPromo,
    adminAdjust,
    fetchLedger,
    fetchGlobalLedger,
    fetchAllBalances,
    listRecharges,
  };
}

export type PointsEngine = ReturnType<typeof createPointsEngine>;
