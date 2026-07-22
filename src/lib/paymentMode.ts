// ═══════════════════════════════════════════════════════════════
// Modes de paiement configurables (série PAY)
// ═══════════════════════════════════════════════════════════════
// Un seul réglage global (app_settings.payment_mode) pilote checkout →
// acceptation → livraison → finance. Chaque commande FIGE son mode dans
// orders.fee_breakdown.payment_mode (historique cohérent).
// Défaut : 'cod' = comportement actuel (identique à aujourd'hui).
// Spec figée : app/docs/plan-payment-modes.md.

const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

export type PaymentMode = 'cod' | 'prepaid_platform' | 'prepaid_restaurant';

export const DEFAULT_PAYMENT_MODE: PaymentMode = 'cod';

// v1 : cod + prepaid_restaurant actifs. prepaid_platform réservé (à activer quand
// l'encaissement MoMo plateforme sera prêt).
export const PAYMENT_MODES: { value: PaymentMode; label: string; description: string; available: boolean }[] = [
  { value: 'cod', label: 'Paiement à la livraison (cash)', description: 'Le client paie le livreur. La commission est prélevée du porte-monnaie du restaurant.', available: true },
  { value: 'prepaid_restaurant', label: 'Prépayé au restaurant', description: 'Le client règle le restaurant d\'avance. La plateforme recouvre commission + frais livreur sur le porte-monnaie du restaurant.', available: true },
  { value: 'prepaid_platform', label: 'Prépayé à la plateforme', description: 'Le client paie la plateforme en ligne (bientôt disponible).', available: false },
];

function isPaymentMode(v: unknown): v is PaymentMode {
  return v === 'cod' || v === 'prepaid_platform' || v === 'prepaid_restaurant';
}

/** Mode de paiement global effectif (défaut cod). */
export async function getPaymentMode(): Promise<PaymentMode> {
  if (USE_VPS) {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const s = await res.json();
        if (isPaymentMode(s?.payment_mode)) return s.payment_mode;
      }
    } catch { /* repli défaut */ }
  }
  return DEFAULT_PAYMENT_MODE;
}

/** Enregistre le mode global (admin). */
export async function setPaymentMode(mode: PaymentMode): Promise<void> {
  if (USE_VPS) {
    await fetch('/api/settings/payment_mode', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ value: mode }),
    });
  }
}
