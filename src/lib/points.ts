// ============================================================
// Système de points restaurant — lib applicative (série PTS)
// ============================================================
// Double chemin, comme les autres libs du dépôt :
// - Mode VPS (VITE_USE_VPS_API=true) : routes dédiées /api/points/... —
//   transactionnelles côté serveur (implémentées en PTS-08). On n'utilise
//   PAS le /api/:table générique : les règles de solde doivent être
//   re-vérifiées en base, dans une transaction.
// - Mode mock : moteur pur `pointsCore` branché sur localStorage.
// Règles métier : POINTS_CONFIG (launchConfig.ts) — référence unique §0.

import { POINTS_CONFIG } from '../data/launchConfig';
import {
  createPointsEngine,
  InsufficientPointsError,
  NoActiveHoldError,
  type HoldOutcome,
  type PointsBalance,
  type PointsLedgerEntry,
  type RechargeMethod,
  type RechargeRequest,
  type RechargeStatus,
} from './pointsCore';

export {
  InsufficientPointsError,
  NoActiveHoldError,
  type HoldOutcome,
  type PointsBalance,
  type PointsLedgerEntry,
  type RechargeMethod,
  type RechargeRequest,
  type RechargeStatus,
};

const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';

const engine = createPointsEngine(
  {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v),
  },
  POINTS_CONFIG
);

// ─── Chemin VPS : fetch authentifié sur les routes dédiées ───────────────
function getToken(): string | null {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    return raw ? (JSON.parse(raw)?.access_token as string) ?? null : null;
  } catch {
    return null;
  }
}

async function pointsApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api/points${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const message = json.error || `Erreur API points (${res.status})`;
    if (res.status === 402) throw new InsufficientPointsError(message);
    throw new Error(message);
  }
  return json;
}

// ─── API publique (async des deux côtés) ─────────────────────────────────

export async function getBalance(restaurantId: string): Promise<PointsBalance> {
  if (USE_VPS) return pointsApi<PointsBalance>(`/balance/${restaurantId}`);
  return engine.getBalance(restaurantId);
}

export async function canAcceptOrder(restaurantId: string): Promise<boolean> {
  if (USE_VPS) {
    const { available } = await getBalance(restaurantId);
    return (
      available >= POINTS_CONFIG.ORDER_COST_POINTS &&
      available >= POINTS_CONFIG.MIN_BALANCE_TO_ACCEPT_POINTS
    );
  }
  return engine.canAcceptOrder(restaurantId);
}

export async function hasActiveHold(restaurantId: string, orderId: string): Promise<boolean> {
  if (USE_VPS) {
    const { held } = await pointsApi<PointsBalance & { activeHolds?: string[] }>(
      `/balance/${restaurantId}?orderId=${encodeURIComponent(orderId)}`
    );
    return held > 0;
  }
  return engine.hasActiveHold(restaurantId, orderId);
}

export async function holdPoints(restaurantId: string, orderId: string): Promise<PointsLedgerEntry> {
  if (USE_VPS) return pointsApi<PointsLedgerEntry>('/hold', { method: 'POST', body: JSON.stringify({ restaurantId, orderId }) });
  return engine.holdPoints(restaurantId, orderId);
}

export async function settleHold(
  restaurantId: string,
  orderId: string,
  outcome: HoldOutcome
): Promise<PointsLedgerEntry> {
  if (USE_VPS) return pointsApi<PointsLedgerEntry>('/settle', { method: 'POST', body: JSON.stringify({ restaurantId, orderId, outcome }) });
  return engine.settleHold(restaurantId, orderId, outcome);
}

export async function convertPointsToRefund(
  restaurantId: string,
  disputeId: string,
  amountFcfa: number
): Promise<PointsLedgerEntry> {
  if (USE_VPS) return pointsApi<PointsLedgerEntry>('/convert-refund', { method: 'POST', body: JSON.stringify({ restaurantId, disputeId, amountFcfa }) });
  return engine.convertPointsToRefund(restaurantId, disputeId, amountFcfa);
}

export async function requestRecharge(
  restaurantId: string,
  points: number,
  method: RechargeMethod
): Promise<RechargeRequest> {
  if (USE_VPS) return pointsApi<RechargeRequest>('/recharges', { method: 'POST', body: JSON.stringify({ restaurantId, points, method }) });
  return engine.requestRecharge(restaurantId, points, method);
}

export async function decideRecharge(
  requestId: string,
  decision: 'validate' | 'reject',
  adminId: string,
  reason?: string
): Promise<RechargeRequest> {
  if (USE_VPS) return pointsApi<RechargeRequest>(`/recharges/${requestId}`, { method: 'PATCH', body: JSON.stringify({ decision, reason }) });
  return engine.decideRecharge(requestId, decision, adminId, reason);
}

export async function grantWelcomeBonus(restaurantId: string): Promise<PointsLedgerEntry | null> {
  if (USE_VPS) return pointsApi<PointsLedgerEntry | null>('/welcome-bonus', { method: 'POST', body: JSON.stringify({ restaurantId }) });
  return engine.grantWelcomeBonus(restaurantId);
}

/**
 * Dotation promotionnelle EN MASSE (lancement) : crédite `points` à chaque resto
 * de la liste, une seule fois par campagne (idempotent — relancer la même
 * campagne ne double-crédite jamais). Renvoie le décompte crédités/déjà servis.
 */
export async function grantPromoBulk(
  restaurantIds: string[],
  points: number,
  campaignId: string,
  note: string,
  adminId: string
): Promise<{ granted: number; alreadyGranted: number }> {
  if (USE_VPS) {
    return pointsApi<{ granted: number; alreadyGranted: number }>('/promo-grant', {
      method: 'POST',
      body: JSON.stringify({ restaurantIds, points, campaignId, note }),
    });
  }
  let granted = 0;
  let alreadyGranted = 0;
  for (const restaurantId of restaurantIds) {
    const result = engine.grantPromo(restaurantId, points, campaignId, note, adminId);
    if (result.alreadyGranted) alreadyGranted++;
    else granted++;
  }
  return { granted, alreadyGranted };
}

export async function adminAdjust(
  restaurantId: string,
  points: number,
  adminId: string,
  note: string
): Promise<PointsLedgerEntry> {
  if (USE_VPS) return pointsApi<PointsLedgerEntry>('/adjust', { method: 'POST', body: JSON.stringify({ restaurantId, points, note }) });
  return engine.adminAdjust(restaurantId, points, adminId, note);
}

export async function fetchLedger(
  restaurantId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<PointsLedgerEntry[]> {
  if (USE_VPS) {
    const { limit = 50, offset = 0 } = opts;
    return pointsApi<PointsLedgerEntry[]>(`/ledger/${restaurantId}?limit=${limit}&offset=${offset}`);
  }
  return engine.fetchLedger(restaurantId, opts);
}

/** Flux global du ledger (admin) : tous restaurants confondus. */
export async function fetchGlobalLedger(
  opts: { limit?: number; offset?: number } = {}
): Promise<PointsLedgerEntry[]> {
  if (USE_VPS) {
    const { limit = 50, offset = 0 } = opts;
    return pointsApi<PointsLedgerEntry[]>(`/ledger?limit=${limit}&offset=${offset}`);
  }
  return engine.fetchGlobalLedger(opts);
}

export async function fetchAllBalances(): Promise<Record<string, PointsBalance>> {
  if (USE_VPS) return pointsApi<Record<string, PointsBalance>>('/balances');
  return engine.fetchAllBalances();
}

export async function listRecharges(
  filter: { status?: RechargeStatus; restaurantId?: string } = {}
): Promise<RechargeRequest[]> {
  if (USE_VPS) {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.restaurantId) params.set('restaurantId', filter.restaurantId);
    return pointsApi<RechargeRequest[]>(`/recharges?${params}`);
  }
  return engine.listRecharges(filter);
}
