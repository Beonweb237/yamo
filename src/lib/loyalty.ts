// ============================================================
// MiamPoints — lib applicative fidélité client (série LOY)
// ============================================================
// Double chemin comme les autres libs :
// - Mode VPS (VITE_USE_VPS_API=true) : routes /api/loyalty/* (transactionnelles,
//   calcul du gain/plafond re-vérifié en base).
// - Mode mock : moteur pur `loyaltyCore` sur localStorage.
import { LOYALTY_CONFIG } from '../data/launchConfig';
import {
  createLoyaltyEngine,
  InsufficientLoyaltyError,
  type LoyaltyBalance,
  type LoyaltyLedgerEntry,
} from './loyaltyCore';

export { InsufficientLoyaltyError, type LoyaltyBalance, type LoyaltyLedgerEntry };

const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';

const engine = createLoyaltyEngine(
  { getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) },
  LOYALTY_CONFIG
);

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    return raw ? (JSON.parse(raw)?.access_token as string) ?? null : null;
  } catch {
    return null;
  }
}

async function loyaltyApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api/loyalty${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const message = json.error || `Erreur API fidélité (${res.status})`;
    if (res.status === 402) throw new InsufficientLoyaltyError(message);
    throw new Error(message);
  }
  return json;
}

export async function getLoyaltyBalance(customerId: string): Promise<LoyaltyBalance> {
  if (USE_VPS) return loyaltyApi<LoyaltyBalance>(`/balance/${customerId}`);
  return engine.getBalance(customerId);
}

/** Crédite les MiamPoints gagnés à la livraison (idempotent par commande). */
export async function earnLoyalty(customerId: string, orderId: string, subtotalFcfa: number): Promise<void> {
  if (USE_VPS) {
    await loyaltyApi('/earn', { method: 'POST', body: JSON.stringify({ customerId, orderId }) });
    return;
  }
  engine.earn(customerId, orderId, subtotalFcfa);
}

/** Utilise des MiamPoints au checkout (débit + validation min/plafond). */
export async function redeemLoyalty(
  customerId: string,
  orderId: string,
  requestedPoints: number,
  orderSubtotalFcfa: number
): Promise<void> {
  if (USE_VPS) {
    await loyaltyApi('/redeem', {
      method: 'POST',
      body: JSON.stringify({ customerId, orderId, points: requestedPoints }),
    });
    return;
  }
  engine.redeem(customerId, orderId, requestedPoints, orderSubtotalFcfa);
}

/**
 * Restitue les points si la commande est annulée (idempotent). VPS : le serveur
 * dérive le client de l'écriture d'origine et reverse la compensation resto ;
 * `customerId` n'est requis que pour le moteur mock.
 */
export async function refundLoyalty(orderId: string, customerId = ''): Promise<void> {
  if (USE_VPS) {
    await loyaltyApi('/refund', { method: 'POST', body: JSON.stringify({ orderId }) });
    return;
  }
  if (customerId) engine.refundRedeem(customerId, orderId);
}

export async function fetchLoyaltyLedger(
  customerId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<LoyaltyLedgerEntry[]> {
  if (USE_VPS) {
    const { limit = 50, offset = 0 } = opts;
    return loyaltyApi<LoyaltyLedgerEntry[]>(`/ledger/${customerId}?limit=${limit}&offset=${offset}`);
  }
  return engine.fetchLedger(customerId, opts);
}
