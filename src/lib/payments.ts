// Paiements & validation de commande — API VPS (Nginx → 127.0.0.1:3002).
// Contrats attendus côté serveur (voir docs/ux-implementation-plan.md CONF-03) :
//
//   POST /api/orders/validate
//     body    { restaurantId, items: [{ menuItemId, quantity }], promoCode? }
//     200     { valid, subtotal, discount, promoCode, deliveryFee, total,
//               currency, minOrderMet? }
//     4xx     { error: "message métier affichable" }   (resto fermé, minimum…)
//
//   POST /api/payments/momo
//     body    { orderId, amount, phone, payerMessage? }
//     200     { success, referenceId, message }
//
// Sans backend VPS (dev mock), ces fonctions ne doivent PAS être appelées :
// les montants restent calculés côté client (voir Checkout.tsx). Le flag
// est volontairement explicite — il n'existe aucun moyen fiable de deviner
// la présence du backend depuis le navigateur sans requête perdue.

import { authHeaders } from './authToken';

/**
 * Mode VPS actif : la validation serveur des montants devient OBLIGATOIRE au
 * checkout (échec réseau = commande bloquée, jamais de repli silencieux sur
 * les montants client — CONF-03 / ux-audit-optimal.md R-02).
 * À activer au build de production : VITE_USE_VPS_API=true.
 */
export const isVpsApiEnabled = import.meta.env.VITE_USE_VPS_API === 'true';

async function apiCall<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
    },
    body: JSON.stringify(body),
  });
  // Le serveur répond en JSON, y compris pour les erreurs métier ({ error }).
  // Une réponse non-JSON (HTML du fallback SPA, page d'erreur Nginx…) est un
  // problème d'infrastructure : on la traite comme une erreur réseau.
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new NetworkPaymentError(`HTTP ${res.status}`);
  }
  if (!res.ok) {
    const message = (data as { error?: string }).error;
    if (message) throw new Error(message); // erreur métier affichable
    throw new NetworkPaymentError(`HTTP ${res.status}`);
  }
  return data as T;
}

/**
 * Échec technique (réseau, serveur injoignable, réponse invalide) — par
 * opposition aux erreurs métier dont le message vient du serveur et peut
 * être montré tel quel à l'utilisateur.
 */
export class NetworkPaymentError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'NetworkPaymentError';
  }
}

export interface OrderValidation {
  valid: boolean;
  subtotal: number;
  discount: number;
  promoCode: string | null;
  deliveryFee: number;
  total: number;
  currency: string;
  minOrderMet?: boolean;
}

/** Valide une commande côté serveur avant soumission — les montants serveur font foi. */
export async function validateOrder(params: {
  restaurantId: string;
  items: { menuItemId: string; quantity: number }[];
  promoCode?: string;
}): Promise<OrderValidation> {
  return apiCall('orders/validate', params);
}

/** Initialise un paiement MTN MoMo (demande de confirmation sur le téléphone). */
export async function initiateMoMoPayment(params: {
  orderId: string;
  amount: number;
  phone: string;
  payerMessage?: string;
}): Promise<{ success: boolean; referenceId: string; message: string }> {
  return apiCall('payments/momo', {
    orderId: params.orderId,
    amount: params.amount,
    phone: params.phone,
    payerMessage: params.payerMessage || 'Commande MiamExpress',
  });
}
