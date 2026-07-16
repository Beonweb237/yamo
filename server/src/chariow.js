// ============================================================
// Miamexpress — Service Chariow (Mobile Money) V2
// Basé sur la doc officielle : https://chariow.dev/fr
// ============================================================
import axios from 'axios';

const DEFAULT_BASE = 'https://api.chariow.com/v1';

function getConfig() {
  return {
    apiKey: process.env.CHARIOW_API_KEY || '',
    baseURL: process.env.CHARIOW_API_BASE || DEFAULT_BASE,
    appUrl: (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, ''),
  };
}

function client() {
  const { apiKey, baseURL } = getConfig();
  if (!apiKey) throw new Error('CHARIOW_API_KEY non configurée');
  return axios.create({
    baseURL,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
}

/**
 * Chariow fonctionne avec des PRODUITS à prix FIXE (pas de montant dynamique).
 * Pour gérer des commandes à montant variable (livraison de repas), on utilise
 * un produit unique "Commande MiamExpress" créé dans le dashboard Chariow,
 * et on stocke le vrai montant dans custom_metadata.
 *
 * Configuration :
 *   CHARIOW_PRODUCT_ID=prd_xxx    — ID du produit dans le dashboard Chariow
 *   CHARIOW_API_KEY=sk_live_xxx   — Clé API
 *
 * Pour créer le produit dans Chariow :
 *   1. Dashboard → Produits → Nouveau produit
 *   2. Type : Téléchargeable (ou Service selon ce qui est dispo)
 *   3. Prix : 5000 FCFA (montant de référence, le vrai montant est en metadata)
 *   4. Une fois créé, copier l'ID (prd_xxx) dans CHARIOW_PRODUCT_ID
 */

/** Grille de prix pour sélectionner le produit le plus proche (si plusieurs produits) */
const PRICE_TIERS = {
  prd_small: 2000,
  prd_medium: 5000,
  prd_large: 10000,
  prd_xlarge: 20000,
};

/**
 * Sélectionne le produit Chariow adapté au montant de la commande.
 * Prend le produit dont le prix est >= montant commande.
 */
function pickProductId(amount) {
  // Priorité : produit configuré explicitement
  const configured = process.env.CHARIOW_PRODUCT_ID;
  if (configured) return configured;

  // Fallback : sélection automatique par tranche
  const tiers = process.env.CHARIOW_PRICE_TIERS
    ? JSON.parse(process.env.CHARIOW_PRICE_TIERS)
    : PRICE_TIERS;

  let best = null;
  for (const [id, price] of Object.entries(tiers)) {
    if (price >= amount && (!best || price < tiers[best])) {
      best = id;
    }
  }
  return best || Object.keys(tiers)[0];
}

/**
 * Initie un paiement Mobile Money via Chariow.
 * @param {object} params
 * @param {string} params.orderId   — ID de la commande
 * @param {number} params.amount    — Montant réel en FCFA
 * @param {string} params.phone     — Téléphone client (2376XXXXXXX)
 * @param {string} [params.returnUrl]
 * @returns {Promise<{checkoutUrl: string|null, saleId: string|null, step: string}>}
 */
export async function initiatePayment({ orderId, amount, phone, returnUrl }) {
  const http = client();
  const { appUrl } = getConfig();
  const safePhone = phone.replace(/\D/g, '');
  const productId = pickProductId(amount);

  // URL de retour : le client revient sur notre site après paiement
  const redirectUrl = returnUrl || `${appUrl}/confirmation?order=${orderId}`;

  const payload = {
    product_id: productId,
    email: `client${safePhone}@miamexpress.cm`,
    first_name: 'Client',
    last_name: `Miam${safePhone.slice(-4)}`,
    phone: { number: safePhone, country_code: 'CM' },
    redirect_url: redirectUrl,
    custom_metadata: {
      orderId,
      amount: String(amount),
      source: 'miamexpress',
    },
  };

  try {
    const res = await http.post('/checkout', payload);
    const d = res.data?.data;

    // Chariow retourne toujours { message, data, errors }
    // data.step peut être : "payment", "completed", "already_purchased"
    const step = d?.step || 'unknown';
    const saleId = d?.purchase?.id || null;
    const checkoutUrl = d?.payment?.checkout_url || null;

    console.log('Chariow checkout:', { step, saleId, orderId });

    return { checkoutUrl, saleId, step };
  } catch (err) {
    const body = err.response?.data;
    const msg = body?.message || body?.errors?.[Object.keys(body?.errors || {})[0]]?.[0] || err.message;
    console.error('Chariow checkout error:', msg);
    throw new Error(`Paiement indisponible : ${msg}`);
  }
}

/**
 * Vérifie le statut d'une vente Chariow.
 * Endpoint officiel : GET /v1/sales/:saleId
 * @returns {Promise<{status: string, amount: number, metadata: object}>}
 */
export async function getSaleStatus(saleId) {
  const http = client();
  try {
    const res = await http.get(`/sales/${saleId}`);
    const sale = res.data?.data;
    return {
      status: sale?.status || 'unknown',
      amount: sale?.amount?.value || 0,
      phone: sale?.customer?.phone?.number || '',
      metadata: sale?.custom_metadata || {},
    };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('Chariow getSale error:', msg);
    return { status: 'error', amount: 0, phone: '', metadata: {} };
  }
}
