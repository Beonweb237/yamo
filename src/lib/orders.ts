import { supabase, isSupabaseConfigured, isSupabaseAuthenticated } from './supabase';
import type { CartItem } from '../contexts/CartContext';
import { restaurants as mockRestaurants } from '../data/mockData';
import { parseCityFromAddress, parseNeighborhoodFromAddress } from '../data/locations';
// Série PTS : réservation/règlement des points au point de passage unique des
// transitions de statut (précédent : CustomerBlockedError). En mode VPS, le
// hold/settle est fait côté serveur dans la même transaction que le statut
// (PTS-08) — les appels ci-dessous ne concernent que le chemin mock.
import { holdPoints, settleHold, hasActiveHold, convertPointsToRefund } from './points';
// Série LOY — MiamPoints : le client gagne des points à la livraison. Best-effort
// (un échec de fidélité ne doit jamais bloquer la livraison de la commande).
import { earnLoyalty, redeemLoyalty, refundLoyalty } from './loyalty';
import { POINTS_CONFIG } from '../data/launchConfig';

/**
 * Crédite les MiamPoints d'une commande livrée — best-effort, jamais bloquant.
 * VPS : le serveur dérive le client et le montant (5 %) depuis la commande en
 * base (idempotent). Mock : on lit la commande locale pour connaître client et
 * sous-total.
 */
async function earnLoyaltyForOrder(orderId: string): Promise<void> {
  try {
    if (isSupabaseConfigured) {
      await earnLoyalty('', orderId, 0); // serveur : dérive client + 5 % du sous-total
      return;
    }
    const o = readLocalOrders().find((x) => x.id === orderId);
    if (o?.customerId) await earnLoyalty(o.customerId, orderId, o.subtotal);
  } catch {
    /* la fidélité ne doit jamais casser le parcours de livraison */
  }
}

/**
 * Débite les MiamPoints utilisés sur une commande fraîchement créée. VPS : le
 * serveur valide (min/plafond/solde) ET crédite la compensation au restaurant.
 * Best-effort : un échec (solde modifié entre-temps) ne bloque pas la commande.
 */
async function maybeRedeemLoyalty(input: OrderInput, orderId: string): Promise<void> {
  const r = input.loyaltyRedeemed ?? 0;
  if (r <= 0) return;
  try {
    await redeemLoyalty(input.customerId, orderId, r, input.subtotal);
  } catch (e) {
    console.warn('[loyalty] débit après création échoué', e);
  }
}

// Série PTS — code marchand effectif d'un resto : mock + overrides locaux
// (précédent yamo_own_drivers : lecture directe pour éviter l'import croisé
// avec catalog.ts). Sans code marchand → pas de garantie, parcours inchangé.
function getRestaurantMerchantInfo(restaurantId: string): { merchantCode?: string; assistanceWhatsapp?: string } {
  let override: Record<string, { merchantCode?: string; assistanceWhatsapp?: string }> = {};
  try {
    override = JSON.parse(localStorage.getItem('yamo_restaurant_overrides') ?? '{}');
  } catch { /* overrides illisibles : on retombe sur le mock */ }
  const base = mockRestaurants.find((r) => r.id === restaurantId);
  return {
    merchantCode: override[restaurantId]?.merchantCode ?? base?.merchantCode,
    assistanceWhatsapp: override[restaurantId]?.assistanceWhatsapp ?? base?.assistanceWhatsapp,
  };
}

/** Garantie initiale à l'acceptation — null si le resto n'a pas de code marchand. */
function initialGuarantee(restaurantId: string): OrderGuarantee | null {
  const { merchantCode } = getRestaurantMerchantInfo(restaurantId);
  if (!merchantCode) return null;
  return { status: 'awaiting_payment', amountFcfa: POINTS_CONFIG.GUARANTEE_AMOUNT_FCFA };
}

export { getRestaurantMerchantInfo };

const LOCAL_USERS_KEY = 'yamo_local_users'; // shared with AuthContext/applications.ts

// LOT-16 (CONF-21) : un client bloqué par l'admin (AdminCustomers) ne peut
// plus passer commande. Erreur dédiée pour un message clair au checkout.
export class CustomerBlockedError extends Error {
  constructor() {
    super('Compte client bloqué');
    this.name = 'CustomerBlockedError';
  }
}

function isCustomerBlocked(customerId: string): boolean {
  try {
    const registry = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) ?? '{}') as Record<string, { id?: string; isSuspended?: boolean }>;
    const entry = Object.values(registry).find((u) => u?.id === customerId);
    return Boolean(entry?.isSuspended);
  } catch {
    return false;
  }
}

function readLocalDriverZone(driverId: string): { city?: string | null; serviceNeighborhoods?: string[] | null } {
  try {
    const registry = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) ?? '{}');
    const entry = Object.values(registry).find((u: any) => u?.id === driverId) as any;
    return { city: entry?.city ?? null, serviceNeighborhoods: entry?.serviceNeighborhoods ?? null };
  } catch {
    return {};
  }
}

// Clé partagée avec drivers.ts (livreurs internes désignés par un restaurant
// pour sa propre livraison) — lue directement ici plutôt qu'importée pour
// éviter un import circulaire (drivers.ts importe déjà orders.ts).
const LOCAL_OWN_DRIVERS_KEY = 'yamo_own_drivers';

function isOwnDriverForRestaurant(restaurantId: string, driverId: string): boolean {
  try {
    const entries = JSON.parse(localStorage.getItem(LOCAL_OWN_DRIVERS_KEY) ?? '[]') as { restaurantId: string; driverId: string }[];
    return entries.some((e) => e.restaurantId === restaurantId && e.driverId === driverId);
  } catch {
    return false;
  }
}

// Un livreur ne doit voir que les commandes de restaurants situés dans sa
// ville — et, s'il a restreint sa zone à des quartiers précis, uniquement
// ceux-là. Pas de ville enregistrée (comptes de démo/anciens) => pas de
// restriction, pour ne pas casser les données de test existantes.
function matchesDriverZone(
  restaurantCity: string | null | undefined,
  restaurantNeighborhood: string | null | undefined,
  driverCity?: string | null,
  driverNeighborhoods?: string[] | null
): boolean {
  if (driverCity && restaurantCity && driverCity !== restaurantCity) return false;
  if (driverNeighborhoods && driverNeighborhoods.length > 0 && restaurantNeighborhood) {
    return driverNeighborhoods.includes(restaurantNeighborhood);
  }
  return true;
}

/**
 * Téléphone du livreur assigné à une commande (registre utilisateurs mock).
 * Retourne null si le livreur n'est pas résolvable — l'appelant doit alors
 * proposer le numéro du support à la place.
 */
export function getDriverPhone(driverId: string | null | undefined): string | null {
  if (!driverId) return null;
  try {
    const registry = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) ?? '{}') as Record<string, { id?: string; phone?: string }>;
    const entry = Object.values(registry).find((u) => u?.id === driverId);
    return entry?.phone ?? null;
  } catch {
    return null;
  }
}

/**
 * Nom complet du livreur (registre utilisateurs mock) — null si inconnu.
 * Côté client, préférer `getDriverDisplayName` (anonymisé).
 */
export function getDriverName(driverId: string | null | undefined): string | null {
  if (!driverId) return null;
  try {
    const registry = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) ?? '{}') as Record<string, { id?: string; name?: string | null }>;
    const entry = Object.values(registry).find((u) => u?.id === driverId);
    return entry?.name?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Nom du livreur anonymisé pour l'affichage client (« Paul K. ») — même
 * convention que les auteurs d'avis (CONF-26). Null si le nom est inconnu.
 */
export function getDriverDisplayName(driverId: string | null | undefined): string | null {
  const name = getDriverName(driverId);
  if (!name) return null;
  const parts = name.split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1][0].toUpperCase()}.` : parts[0];
}

export type PaymentMethod = 'cash' | 'mtn_momo' | 'orange_money';
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export interface OrderInput {
  customerId: string;
  restaurantId: string;
  restaurantName: string;
  contactPhone?: string;
  recipient?: {
    name: string;
    phone: string;
    contactInstructions?: string;
  } | null;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  /** Série LOY — MiamPoints utilisés en réduction (FCFA). Déduits du total. */
  loyaltyRedeemed?: number;
  paymentMethod: PaymentMethod;
  address: {
    city: string;
    neighborhood: string;
    landmark: string;
    fullText: string;
    lat?: number;
    lng?: number;
  };
  notes?: string;
  /** Série DRV — pourboire ajouté par le client. 100% livreur. */
  tipAmount?: number;
  /** Série DRV — décomposition de la rémunération livreur estimée. */
  driverEarnings?: {
    distanceKm: number;
    waitMinutes: number;
    basePickup: number;
    distancePay: number;
    waitPay: number;
    surgeMultiplier: number;
    surgeBonus: number;
    subtotal: number;
    final: number;
    surgeActive: boolean;
  };
}

/** Auteur d'une annulation de commande. */
export type CancelledBy = 'customer' | 'restaurant' | 'admin';

/** Palier d'annulation client selon le risque au statut courant. */
export type CustomerCancelTier = 'free' | 'warn' | 'contact' | 'none';

/**
 * Politique d'annulation côté client, bornée par le risque (priorité produit #4 :
 * annuler à tout moment, surtout quand il n'y a pas de risque). Source unique de
 * vérité, réutilisée par l'UI (bouton + avertissement).
 * - `free`    : le resto n'a pas encore engagé la préparation → annulation immédiate.
 * - `warn`    : préparation engagée → annulation possible mais on prévient (plat gâché).
 * - `contact` : commande en route (livreur) → pas d'annulation directe, passer par le support.
 * - `none`    : statut terminal (livrée / déjà annulée).
 */
export function customerCancelPolicy(status: OrderStatus): { tier: CustomerCancelTier; warning?: string } {
  switch (status) {
    case 'pending':
    case 'confirmed':
      return { tier: 'free' };
    case 'preparing':
    case 'ready':
      return {
        tier: 'warn',
        warning:
          "Le restaurant a déjà commencé à préparer votre commande — l'annuler maintenant gâche le plat préparé. Confirmez seulement si c'est vraiment nécessaire.",
      };
    case 'picked_up':
    case 'delivering':
      return { tier: 'contact' };
    default:
      return { tier: 'none' };
  }
}

// ── Série PTS : garantie client ──────────────────────────────────────────
// Sous-état de 'confirmed' (AUCUN nouveau statut global de commande) :
// awaiting_payment → declared (client) → confirmed (resto) → puis, en litige,
// forfeited (rejet abusif) ou refunded (faute resto/livreur). GUARANTEE_MODE
// 'deducted' : dans le cas nominal la garantie est déduite du total à la
// livraison — elle n'est jamais « remboursée », zéro procédure.
export type GuaranteeStatus = 'awaiting_payment' | 'declared' | 'confirmed' | 'forfeited' | 'refunded';

export interface OrderGuarantee {
  status: GuaranteeStatus;
  amountFcfa: number;
  /** Note libre du client à la déclaration (ex. référence de transaction). */
  proofNote?: string | null;
  declaredAt?: string | null;
  confirmedAt?: string | null;
}

export interface Order extends Omit<OrderInput, 'items'> {
  id: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string | null;
  /** Motif d'annulation (obligatoire à l'annulation — CONF-04/CONF-12). */
  cancellationReason?: string | null;
  /** Qui a annulé la commande. */
  cancelledBy?: CancelledBy | null;
  /**
   * Code de livraison à 4 chiffres (CONF-17 — preuve de livraison) : affiché
   * au client pendant la livraison, saisi par le livreur pour clôturer.
   */
  deliveryCode?: string | null;
  /** Clôturée sans code (repli « client sans code ») — visible par l'admin. */
  deliveredWithoutCode?: boolean;
  /** Série LOY — MiamPoints utilisés en réduction sur cette commande (FCFA). */
  loyaltyRedeemed?: number | null;
  /** Litige d'annulation traité par l'admin (CONF-20). */
  disputeResolved?: boolean;
  /** Note de traitement du litige (admin). */
  disputeResolutionNote?: string | null;
  /**
   * Série PTS — garantie client. Absente : commande historique, ou resto sans
   * code marchand (la commande se déroule alors exactement comme avant).
   */
  guarantee?: OrderGuarantee | null;
  confirmedAt?: string | null;
  preparationEtaMinutes?: number | null;
  estimatedReadyAt?: string | null;
  readyAt?: string | null;
  driverId?: string | null;
  /**
   * Mode de livraison choisi par le restaurant au moment de marquer la
   * commande "Prête" — `'restaurant'` restreint la visibilité de la commande
   * aux livreurs internes du restaurant (drivers.ts → getOwnDriverIds) au
   * lieu de la diffuser à tous les livreurs de la zone. Absent/`'platform'` =
   * comportement historique inchangé.
   */
  deliveryMode?: 'platform' | 'restaurant' | null;
  contactPhone?: string;
  recipient?: {
    name: string;
    phone: string;
    contactInstructions?: string;
  } | null;
  items: { name: string; price: number; quantity: number; baseItemId?: string }[];
  /**
   * Série DRV — décomposition des frais de livraison visible côté livreur.
   * Présente quand le calcul décomposé a été appliqué (VPS et mock).
   */
  feeBreakdown?: {
    basePickup: number;
    distancePay: number;
    waitPay: number;
    surgeMultiplier: number;
    surgeBonus: number;
    final: number;
  } | null;
  /**
   * Série DRV — pourboire ajouté par le client au checkout. 100% livreur.
   */
  tipAmount?: number;
  /**
   * Série DRV — indique si le surge pricing était actif au moment de la commande.
   */
  surgeApplied?: boolean;
}

const LOCAL_ORDERS_KEY = 'yamo_local_orders';

function readLocalOrders(): Order[] {
  const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
  return raw ? (JSON.parse(raw) as Order[]) : [];
}

function writeLocalOrders(orders: Order[]) {
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function isSchemaColumnMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST204' ||
    /column .* does not exist/i.test(error.message ?? '') ||
    /Could not find .* column/i.test(error.message ?? '')
  );
}

function normalizeRecipient(recipient?: OrderInput['recipient']): Order['recipient'] {
  if (!recipient) return null;
  const name = recipient.name.trim();
  const phone = recipient.phone.trim();
  const contactInstructions = recipient.contactInstructions?.trim();
  if (!name && !phone && !contactInstructions) return null;
  return {
    name,
    phone,
    contactInstructions: contactInstructions || undefined,
  };
}

function appendRecipientToNotes(notes: string | undefined, recipient: Order['recipient']): string | null {
  const cleanNotes = notes?.trim();
  if (!recipient) return cleanNotes || null;

  const recipientLines = [
    `Bénéficiaire: ${recipient.name || 'Non renseigné'}`,
    `Téléphone bénéficiaire: ${recipient.phone || 'Non renseigné'}`,
    recipient.contactInstructions ? `Instruction bénéficiaire: ${recipient.contactInstructions}` : '',
  ].filter(Boolean);

  return [cleanNotes, ...recipientLines].filter(Boolean).join('\n');
}

function parseLegacyRecipientFromNotes(notes?: string | null): Order['recipient'] {
  if (!notes?.includes('Bénéficiaire:')) return null;
  const lines = notes.split(/\r?\n/);
  const valueAfter = (label: string) => {
    const value = lines.find((line) => line.startsWith(label))?.slice(label.length).trim() ?? '';
    return value === 'Non renseigné' ? '' : value;
  };
  const name = valueAfter('Bénéficiaire:');
  const phone = valueAfter('Téléphone bénéficiaire:');
  const contactInstructions = valueAfter('Instruction bénéficiaire:') || undefined;
  return name || phone || contactInstructions ? { name, phone, contactInstructions } : null;
}

export function getDeliveryContactPhone(order: Pick<Order, 'recipient' | 'contactPhone'>): string {
  return order.recipient?.phone || order.contactPhone || '';
}

export function getRecipientSummary(order: Pick<Order, 'recipient'>): string | null {
  if (!order.recipient) return null;
  return [order.recipient.name, order.recipient.phone].filter(Boolean).join(' · ') || null;
}

export function formatOrderTime(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function getOrderPreparationMessage(order: Order, now = new Date()): string | null {
  if (order.status === 'pending') return 'En attente de confirmation du restaurant';
  if (!order.estimatedReadyAt) return null;

  const readyAt = new Date(order.estimatedReadyAt);
  if (Number.isNaN(readyAt.getTime())) return null;

  const readyTime = formatOrderTime(order.estimatedReadyAt);
  const remainingMinutes = Math.ceil((readyAt.getTime() - now.getTime()) / 60000);

  if (order.status === 'confirmed' || order.status === 'preparing') {
    if (remainingMinutes > 1) return `Repas prêt vers ${readyTime} (${remainingMinutes} min)`;
    if (remainingMinutes === 1) return `Repas prêt vers ${readyTime} (1 min)`;
    return `Prévu prêt depuis ${readyTime}`;
  }

  if (order.status === 'ready') return `Prêt à récupérer depuis ${readyTime}`;
  if (order.status === 'picked_up' || order.status === 'delivering') return `Préparé à ${readyTime}`;
  if (order.status === 'delivered') return `Repas préparé à ${readyTime}`;
  return null;
}

export async function createOrder(input: OrderInput): Promise<Order> {
  // Defense in depth — CartContext already prevents mixing restaurants in the
  // UI, but createOrder is the single choke point every order goes through
  // (mock and Supabase alike), so it re-checks rather than trusting the caller.
  const mismatched = input.items.find((ci) => ci.item.restaurantId !== input.restaurantId);
  if (mismatched) {
    throw new Error(
      `Cannot create order: item "${mismatched.item.name}" belongs to restaurant ${mismatched.item.restaurantId}, not ${input.restaurantId}`
    );
  }

  // LOT-16 (CONF-21) : blocage client vérifié au point de passage unique.
  // Cible VPS : même règle côté serveur (POST /api/orders → 403 si bloqué).
  if (isCustomerBlocked(input.customerId)) {
    throw new CustomerBlockedError();
  }

  const recipient = normalizeRecipient(input.recipient);

  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    let { data: addressRow, error: addressError } = await supabase
      .from('addresses')
      .insert({
        user_id: input.customerId,
        city: input.address.city,
        neighborhood: input.address.neighborhood,
        landmark: input.address.landmark,
        full_text: input.address.fullText,
        lat: input.address.lat ?? null,
        lng: input.address.lng ?? null,
      })
      .select()
      .single();

    if (addressError && isSchemaColumnMissing(addressError)) {
      const legacyAddress = await supabase
        .from('addresses')
        .insert({
          user_id: input.customerId,
          city: input.address.city,
          neighborhood: input.address.neighborhood,
          landmark: input.address.landmark,
          full_text: input.address.fullText,
        })
        .select()
        .single();
      addressRow = legacyAddress.data;
      addressError = legacyAddress.error;
    }

    if (addressError || !addressRow) throw addressError ?? new Error('Address creation failed');

    const orderPayload = {
      customer_id: input.customerId,
      restaurant_id: input.restaurantId,
      address_id: addressRow.id,
      status: 'pending',
      subtotal: input.subtotal,
      delivery_fee: input.deliveryFee,
      total: input.total,
      payment_method: input.paymentMethod,
      payment_status: input.paymentMethod === 'cash' ? 'pending' : 'pending',
      notes: input.notes ?? null,
      contact_phone: input.contactPhone ?? null,
      ordered_for_someone_else: Boolean(recipient),
      recipient_name: recipient?.name || null,
      recipient_phone: recipient?.phone || null,
      recipient_contact_instructions: recipient?.contactInstructions || null,
      // Série DRV — rémunération livreur
      tip_amount: input.tipAmount ?? 0,
      surge_applied: input.driverEarnings?.surgeActive ?? false,
      fee_breakdown: input.driverEarnings ? JSON.stringify({
        basePickup: input.driverEarnings.basePickup,
        distancePay: input.driverEarnings.distancePay,
        waitPay: input.driverEarnings.waitPay,
        surgeMultiplier: input.driverEarnings.surgeMultiplier,
        surgeBonus: input.driverEarnings.surgeBonus,
        final: input.driverEarnings.final,
      }) : null,
    };

    let { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();

    if (orderError && isSchemaColumnMissing(orderError)) {
      const legacyPayload = {
        customer_id: input.customerId,
        restaurant_id: input.restaurantId,
        address_id: addressRow.id,
        status: 'pending',
        subtotal: input.subtotal,
        delivery_fee: input.deliveryFee,
        total: input.total,
        payment_method: input.paymentMethod,
        payment_status: input.paymentMethod === 'cash' ? 'pending' : 'pending',
        notes: appendRecipientToNotes(input.notes, recipient),
      };

      const legacyResult = await supabase
        .from('orders')
        .insert(legacyPayload)
        .select()
        .single();
      orderRow = legacyResult.data;
      orderError = legacyResult.error;
    }

    if (orderError || !orderRow) throw orderError ?? new Error('Order creation failed');

    const orderItemsPayload = input.items.map((ci) => ({
      order_id: orderRow.id,
      // baseItemId = id réel du plat au menu (item.id peut être composite
      // pour un plat personnalisé — voir CartContext).
      menu_item_id: ci.baseItemId ?? ci.item.id,
      name: ci.item.name,
      price: ci.item.price,
      quantity: ci.quantity,
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(orderItemsPayload);
    if (itemsError) throw itemsError;

    await maybeRedeemLoyalty(input, orderRow.id);

    return {
      id: orderRow.id,
      customerId: input.customerId,
      restaurantId: input.restaurantId,
      restaurantName: input.restaurantName,
      subtotal: input.subtotal,
      deliveryFee: input.deliveryFee,
      total: input.total,
      loyaltyRedeemed: input.loyaltyRedeemed ?? null,
      paymentMethod: input.paymentMethod,
      address: input.address,
      notes: input.notes,
      contactPhone: input.contactPhone,
      recipient,
      status: 'pending',
      createdAt: orderRow.created_at,
      updatedAt: orderRow.updated_at,
      confirmedAt: null,
      preparationEtaMinutes: null,
      estimatedReadyAt: null,
      readyAt: null,
      items: input.items.map((ci) => ({ name: ci.item.name, price: ci.item.price, quantity: ci.quantity, baseItemId: ci.baseItemId })),
      // Série DRV
      tipAmount: input.tipAmount ?? 0,
      surgeApplied: input.driverEarnings?.surgeActive ?? false,
      feeBreakdown: input.driverEarnings ? {
        basePickup: input.driverEarnings.basePickup,
        distancePay: input.driverEarnings.distancePay,
        waitPay: input.driverEarnings.waitPay,
        surgeMultiplier: input.driverEarnings.surgeMultiplier,
        surgeBonus: input.driverEarnings.surgeBonus,
        final: input.driverEarnings.final,
      } : null,
    };
  }

  // Dev mode fallback: persist the order in localStorage so the "Mes commandes"
  // page has something real to show without a backend configured yet.
  const now = new Date().toISOString();
  const order: Order = {
    id: crypto.randomUUID(),
    // Preuve de livraison (CONF-17) : code communiqué au client, exigé du
    // livreur à la clôture. Côté VPS : généré par le serveur à la création.
    deliveryCode: String(Math.floor(1000 + Math.random() * 9000)),
    customerId: input.customerId,
    restaurantId: input.restaurantId,
    restaurantName: input.restaurantName,
    subtotal: input.subtotal,
    deliveryFee: input.deliveryFee,
    total: input.total,
    loyaltyRedeemed: input.loyaltyRedeemed ?? null,
    paymentMethod: input.paymentMethod,
    address: input.address,
    notes: input.notes,
    contactPhone: input.contactPhone,
    recipient,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    confirmedAt: null,
    preparationEtaMinutes: null,
    estimatedReadyAt: null,
    readyAt: null,
    items: input.items.map((ci) => ({ name: ci.item.name, price: ci.item.price, quantity: ci.quantity, baseItemId: ci.baseItemId })),
    // Série DRV
    tipAmount: input.tipAmount ?? 0,
    surgeApplied: input.driverEarnings?.surgeActive ?? false,
    feeBreakdown: input.driverEarnings ? {
      basePickup: input.driverEarnings.basePickup,
      distancePay: input.driverEarnings.distancePay,
      waitPay: input.driverEarnings.waitPay,
      surgeMultiplier: input.driverEarnings.surgeMultiplier,
      surgeBonus: input.driverEarnings.surgeBonus,
      final: input.driverEarnings.final,
    } : null,
  };
  const existing = readLocalOrders();
  writeLocalOrders([order, ...existing]);
  await maybeRedeemLoyalty(input, order.id);
  return order;
}

function mapOrderRow(row: Record<string, unknown>): Order {
  const orderItems = (row.order_items as { name: string; price: number; quantity: number }[]) ?? [];
  const addr = row.addresses as {
    city?: string;
    neighborhood?: string;
    landmark?: string;
    full_text?: string;
    lat?: number | null;
    lng?: number | null;
  } | null;
  const restaurant = row.restaurants as { name?: string; phone?: string } | null;
  const notes = (row.notes as string | null) ?? undefined;
  const recipientFromColumns =
    row.ordered_for_someone_else || row.recipient_name || row.recipient_phone || row.recipient_contact_instructions
      ? {
        name: (row.recipient_name as string | null) ?? '',
        phone: (row.recipient_phone as string | null) ?? '',
        contactInstructions: (row.recipient_contact_instructions as string | null) ?? undefined,
      }
      : null;

  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    restaurantId: row.restaurant_id as string,
    restaurantName: restaurant?.name ?? '',
    subtotal: row.subtotal as number,
    deliveryFee: row.delivery_fee as number,
    total: row.total as number,
    paymentMethod: row.payment_method as PaymentMethod,
    notes,
    address: {
      city: addr?.city ?? '',
      neighborhood: addr?.neighborhood ?? '',
      landmark: addr?.landmark ?? '',
      fullText: addr?.full_text ?? '',
      lat: addr?.lat ?? undefined,
      lng: addr?.lng ?? undefined,
    },
    status: row.status as OrderStatus,
    contactPhone: (row.contact_phone as string | null) ?? undefined,
    recipient: recipientFromColumns ?? parseLegacyRecipientFromNotes(notes),
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string | null) ?? null,
    confirmedAt: (row.confirmed_at as string | null) ?? null,
    preparationEtaMinutes: (row.preparation_eta_minutes as number | null) ?? null,
    estimatedReadyAt: (row.estimated_ready_at as string | null) ?? null,
    readyAt: (row.ready_at as string | null) ?? null,
    items: orderItems.map((oi) => ({ name: oi.name, price: oi.price, quantity: oi.quantity })),
    // Série DRV — rémunération livreur décomposée
    feeBreakdown: (row.fee_breakdown as Order['feeBreakdown']) ?? null,
    tipAmount: (row.tip_amount as number) ?? 0,
    surgeApplied: (row.surge_applied as boolean) ?? false,
  };
}

// NB: le schéma réel de `restaurants` n'a pas de colonnes city/neighborhood
// (jamais migrées) — les demander explicitement ici ferait échouer toute la
// requête PostgREST (colonne inexistante = 400 sur l'embed entier, pas juste
// un champ manquant). On sélectionne `address` et on en dérive ville/quartier
// via parseCityFromAddress/parseNeighborhoodFromAddress, comme catalog.ts.
const ORDER_SELECT = '*, order_items(*), addresses(*), restaurants(name, phone, address)';
const DRIVER_ORDER_SELECT = '*, orders(*, order_items(*), addresses(*), restaurants(name, phone))';

export async function fetchOrders(customerId: string): Promise<Order[]> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapOrderRow);
  }

  return readLocalOrders().filter((o) => o.customerId === customerId);
}

export async function fetchAllOrders(): Promise<Order[]> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapOrderRow);
  }

  return readLocalOrders();
}

export async function fetchOrdersByRestaurant(restaurantId: string): Promise<Order[]> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapOrderRow);
  }

  return readLocalOrders().filter((o) => o.restaurantId === restaurantId);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  deliveryMode?: 'platform' | 'restaurant'
): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = { status, updated_at: now };
    if (status === 'ready') payload.ready_at = now;

    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) {
      if (isSchemaColumnMissing(error)) {
        const { error: fallbackError } = await supabase.from('orders').update({ status }).eq('id', orderId);
        if (fallbackError) throw fallbackError;
        if (status === 'delivered') await earnLoyaltyForOrder(orderId);
        return;
      }
      throw error;
    }
    if (status === 'delivered') await earnLoyaltyForOrder(orderId);
    return;
  }

  const now = new Date().toISOString();
  const current = readLocalOrders().find((o) => o.id === orderId);

  // Série PTS — acceptation : réserver les points AVANT d'écrire le statut.
  // InsufficientPointsError remonte à l'appelant et la transition n'a pas lieu.
  if (status === 'confirmed' && current && current.status === 'pending') {
    await holdPoints(current.restaurantId, orderId, current.subtotal);
  }
  // Série PTS — la préparation ne démarre pas tant que la garantie n'est pas
  // confirmée par le resto (sous-état de 'confirmed' ; absente = pas de blocage).
  if (status === 'preparing' && current?.guarantee && current.guarantee.status !== 'confirmed') {
    throw new Error('La garantie du client doit être confirmée avant de lancer la préparation.');
  }
  // Série PTS — livraison : consommer le hold (tolérant pour les commandes
  // historiques acceptées avant le chantier : pas de hold → rien à régler).
  if (status === 'delivered' && current && (await hasActiveHold(current.restaurantId, orderId))) {
    await settleHold(current.restaurantId, orderId, 'consume');
  }

  const updated = readLocalOrders().map((o) =>
    o.id === orderId
      ? {
        ...o,
        status,
        updatedAt: now,
        readyAt: status === 'ready' ? now : o.readyAt,
        deliveryMode: status === 'ready' && deliveryMode ? deliveryMode : o.deliveryMode,
      }
      : o
  );
  writeLocalOrders(updated);
  if (status === 'delivered') await earnLoyaltyForOrder(orderId);
}

/**
 * Annule une commande avec motif obligatoire et auteur (CONF-04/CONF-12).
 * Contrat VPS cible : POST /api/orders/:id/cancel  body { reason, by }
 * (le serveur vérifie que l'auteur a le droit d'annuler au statut courant).
 * En mode mock : écriture directe dans yamo_local_orders.
 */
export async function cancelOrder(orderId: string, reason: string, by: CancelledBy): Promise<void> {
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error("Le motif d'annulation est obligatoire.");

  const now = new Date().toISOString();

  // Série PTS — règlement du hold à l'annulation : pénalité si faute du resto,
  // restitution intégrale sinon. Une commande jamais acceptée (ou antérieure au
  // chantier) n'a pas de hold : rien à régler.
  const current = readLocalOrders().find((o) => o.id === orderId);
  if (current && (await hasActiveHold(current.restaurantId, orderId))) {
    await settleHold(current.restaurantId, orderId, by === 'restaurant' ? 'penalty' : 'release');
  }
  // Série LOY — restituer au client les MiamPoints utilisés (et reverser la
  // compensation resto côté serveur). Best-effort, idempotent, jamais bloquant.
  try {
    await refundLoyalty(orderId, current?.customerId ?? '');
  } catch { /* la restitution fidélité ne doit pas bloquer l'annulation */ }
  // Série PTS — garantie déjà sécurisée : toute annulation la rembourse au
  // client. Faute du resto → remboursement garanti par sa caution points
  // (idempotent sur orderId — pas de double conversion si l'arbitrage admin
  // repasse par ici). Autres auteurs → reversement organisé par l'assistance.
  if (current?.guarantee && ['declared', 'confirmed'].includes(current.guarantee.status)) {
    await settleGuarantee(orderId, 'refunded');
    if (by === 'restaurant') {
      try {
        await convertPointsToRefund(current.restaurantId, orderId, current.guarantee.amountFcfa);
      } catch { /* caution insuffisante : reliquat hors application (phase 1) */ }
    }
  }

  const updated = readLocalOrders().map((o) =>
    o.id === orderId
      ? { ...o, status: 'cancelled' as OrderStatus, cancellationReason: cleanReason, cancelledBy: by, updatedAt: now }
      : o
  );
  writeLocalOrders(updated);
}

/**
 * Marque le litige d'une commande annulée comme traité (admin — CONF-20).
 * Contrat VPS cible : POST /api/admin/orders/:id/resolve-dispute { note? }
 */
export async function resolveOrderDispute(orderId: string, note?: string): Promise<void> {
  const updated = readLocalOrders().map((o) =>
    o.id === orderId
      ? { ...o, disputeResolved: true, disputeResolutionNote: note?.trim() || null }
      : o
  );
  writeLocalOrders(updated);
}

export async function confirmOrderWithPreparation(orderId: string, preparationEtaMinutes: number): Promise<void> {
  const minutes = Math.max(1, Math.min(240, Math.round(preparationEtaMinutes)));
  const confirmedAt = new Date();
  const estimatedReadyAt = addMinutes(confirmedAt, minutes);

  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const payload = {
      status: 'confirmed' as OrderStatus,
      confirmed_at: confirmedAt.toISOString(),
      preparation_eta_minutes: minutes,
      estimated_ready_at: estimatedReadyAt.toISOString(),
      updated_at: confirmedAt.toISOString(),
    };
    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) {
      if (isSchemaColumnMissing(error)) {
        const { error: fallbackError } = await supabase.from('orders').update({ status: 'confirmed' }).eq('id', orderId);
        if (fallbackError) throw fallbackError;
        return;
      }
      throw error;
    }
    return;
  }

  // Série PTS — l'acceptation passe aussi par ici : réserver les points AVANT
  // d'écrire (InsufficientPointsError ⇒ la commande reste en attente).
  const current = readLocalOrders().find((o) => o.id === orderId);
  if (current && current.status === 'pending') {
    await holdPoints(current.restaurantId, orderId, current.subtotal);
  }

  const updated = readLocalOrders().map((o) =>
    o.id === orderId
      ? {
        ...o,
        status: 'confirmed' as OrderStatus,
        updatedAt: confirmedAt.toISOString(),
        confirmedAt: confirmedAt.toISOString(),
        preparationEtaMinutes: minutes,
        estimatedReadyAt: estimatedReadyAt.toISOString(),
        // Série PTS : la garantie naît à l'acceptation (une seule fois).
        guarantee: o.guarantee ?? initialGuarantee(o.restaurantId),
      }
      : o
  );
  writeLocalOrders(updated);
}

// ── Série PTS : cycle de vie de la garantie client ───────────────────────

function updateGuarantee(orderId: string, patch: Partial<OrderGuarantee>): void {
  const now = new Date().toISOString();
  const updated = readLocalOrders().map((o) =>
    o.id === orderId && o.guarantee
      ? { ...o, guarantee: { ...o.guarantee, ...patch }, updatedAt: now }
      : o
  );
  writeLocalOrders(updated);
}

/** Le client déclare avoir payé la garantie au code marchand du resto. */
export async function declareGuaranteePaid(orderId: string, proofNote?: string): Promise<void> {
  const order = readLocalOrders().find((o) => o.id === orderId);
  if (!order?.guarantee) throw new Error('Cette commande ne porte pas de garantie.');
  if (order.guarantee.status !== 'awaiting_payment') return; // idempotent
  updateGuarantee(orderId, {
    status: 'declared',
    proofNote: proofNote?.trim() || null,
    declaredAt: new Date().toISOString(),
  });
}

/** Le resto confirme avoir reçu la garantie sur son compte marchand. */
export async function confirmGuaranteeReceived(orderId: string): Promise<void> {
  const order = readLocalOrders().find((o) => o.id === orderId);
  if (!order?.guarantee) throw new Error('Cette commande ne porte pas de garantie.');
  if (order.guarantee.status === 'confirmed') return; // idempotent
  updateGuarantee(orderId, { status: 'confirmed', confirmedAt: new Date().toISOString() });
}

/** Le resto n'a pas reçu le paiement déclaré : retour à l'attente. */
export async function rejectGuaranteeDeclaration(orderId: string): Promise<void> {
  const order = readLocalOrders().find((o) => o.id === orderId);
  if (!order?.guarantee) throw new Error('Cette commande ne porte pas de garantie.');
  if (order.guarantee.status !== 'declared') return;
  updateGuarantee(orderId, { status: 'awaiting_payment', proofNote: null, declaredAt: null });
}

/** Issue de litige (PTS-05, décision admin) : confiscation ou remboursement. */
export async function settleGuarantee(orderId: string, outcome: 'forfeited' | 'refunded'): Promise<void> {
  const order = readLocalOrders().find((o) => o.id === orderId);
  if (!order?.guarantee) throw new Error('Cette commande ne porte pas de garantie.');
  if (order.guarantee.status === outcome) return; // idempotent
  updateGuarantee(orderId, { status: outcome });
}

/** Reste à payer à la livraison (mode 'deducted') : total − garantie sécurisée. */
export function remainingDueAtDelivery(order: Order): number {
  const g = order.guarantee;
  if (!g || !['declared', 'confirmed'].includes(g.status)) return order.total;
  return Math.max(0, order.total - g.amountFcfa);
}

// ── Série PTS : arbitrage admin des litiges avec garantie ────────────────

/**
 * Strike client pour rejet abusif : compté dans le registre local ; au 2e,
 * le compte est suspendu (contrôlé par CustomerBlockedError à la commande
 * suivante — mécanisme existant LOT-16).
 */
export function markAbusiveRejection(customerId: string): { count: number; suspended: boolean } {
  let registry: Record<string, { id: string; isSuspended?: boolean; suspensionReason?: string | null; abusiveRejections?: number }> = {};
  try {
    registry = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) ?? '{}');
  } catch { /* registre illisible : strike non comptée */ }
  const entry = Object.entries(registry).find(([, u]) => u.id === customerId);
  if (!entry) return { count: 0, suspended: false };
  const [phone, user] = entry;
  const count = (user.abusiveRejections ?? 0) + 1;
  const suspended = count >= 2;
  registry[phone] = {
    ...user,
    abusiveRejections: count,
    isSuspended: suspended ? true : user.isSuspended,
    suspensionReason: suspended
      ? 'Rejets de livraison abusifs répétés (2). Contactez le support MiamExpress.'
      : user.suspensionReason ?? null,
  };
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(registry));
  return { count, suspended };
}

export type GuaranteeDecision = 'abusive_rejection' | 'restaurant_fault' | 'driver_fault';

export interface GuaranteeDecisionResult {
  driverShareFcfa: number;
  restaurantShareFcfa: number;
  refundPointsConverted: number;
  refundShortfallFcfa: number;
  customerStrikes: number;
  customerSuspended: boolean;
}

/**
 * Applique en une action l'issue d'un litige portant sur une commande garantie.
 * Phase 1 : les REVERSEMENTS d'argent (part livreur/resto d'une garantie
 * confisquée, reliquat d'un remboursement) se font hors application — le
 * résultat retourné sert à l'afficher et à le tracer dans le litige.
 */
export async function applyGuaranteeDecision(
  orderId: string,
  decision: GuaranteeDecision
): Promise<GuaranteeDecisionResult> {
  const order = readLocalOrders().find((o) => o.id === orderId);
  if (!order) throw new Error('Commande introuvable.');
  const g = order.guarantee;
  if (!g || !['declared', 'confirmed'].includes(g.status)) {
    throw new Error('Cette commande ne porte pas de garantie active.');
  }

  const result: GuaranteeDecisionResult = {
    driverShareFcfa: 0,
    restaurantShareFcfa: 0,
    refundPointsConverted: 0,
    refundShortfallFcfa: 0,
    customerStrikes: 0,
    customerSuspended: false,
  };

  if (decision === 'abusive_rejection') {
    // Le client a refusé une livraison conforme : garantie confisquée,
    // répartie livreur d'abord (il s'est déplacé), reliquat au resto.
    await settleGuarantee(orderId, 'forfeited');
    if (POINTS_CONFIG.GUARANTEE_FORFEIT_DRIVER_FIRST) {
      result.driverShareFcfa = Math.min(g.amountFcfa, order.deliveryFee);
      result.restaurantShareFcfa = g.amountFcfa - result.driverShareFcfa;
    } else {
      result.restaurantShareFcfa = g.amountFcfa;
    }
    const strike = markAbusiveRejection(order.customerId);
    result.customerStrikes = strike.count;
    result.customerSuspended = strike.suspended;
    if (order.status !== 'cancelled' && order.status !== 'delivered') {
      await cancelOrder(orderId, 'Rejet de livraison jugé abusif (arbitrage MiamExpress)', 'customer');
    }
    return result;
  }

  // Non-livraison : le client est remboursé intégralement.
  await settleGuarantee(orderId, 'refunded');
  if (decision === 'restaurant_fault') {
    // Remboursement garanti par la caution points du resto.
    try {
      const entry = await convertPointsToRefund(order.restaurantId, orderId, g.amountFcfa);
      result.refundPointsConverted = -entry.points;
    } catch {
      // Caution insuffisante : le reliquat se règle hors application (phase 1).
      result.refundShortfallFcfa = g.amountFcfa;
    }
    if (order.status !== 'cancelled' && order.status !== 'delivered') {
      await cancelOrder(orderId, 'Non-livraison — faute du restaurant (arbitrage MiamExpress)', 'restaurant');
    }
  } else {
    // Faute livreur : le resto n'est pas pénalisé ; le reversement de la
    // garantie (encaissée par le resto) au client s'organise via l'assistance.
    result.refundShortfallFcfa = g.amountFcfa;
    if (order.status !== 'cancelled' && order.status !== 'delivered') {
      await cancelOrder(orderId, 'Non-livraison — faute du livreur (arbitrage MiamExpress)', 'admin');
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Livreur : pool de livraisons disponibles + livraisons acceptées
// ─────────────────────────────────────────────────────────────

export async function fetchAvailableDeliveries(driverId: string): Promise<Order[]> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data: driverProfile } = await supabase
      .from('profiles')
      .select('city, service_neighborhoods')
      .eq('id', driverId)
      .maybeSingle();
    const driverCity = driverProfile?.city as string | null | undefined;
    const driverNeighborhoods = driverProfile?.service_neighborhoods as string[] | null | undefined;

    // RLS (0002_restaurant_driver_access.sql) restricts this to 'ready'
    // orders with no assigned driver OR orders already assigned to *this*
    // driver (the "assigned driver reads their order" policy) — the two
    // SELECT policies are OR'd, so a driver who has already accepted a
    // still-'ready' order (not yet marked picked-up) would otherwise see it
    // twice: once here and once under "mine". Exclude anything already in
    // `deliveries` for this driver so a stale duplicate accept can't be
    // attempted (it would 409 on the deliveries_order_id_key constraint).
    const { data: ownDeliveries } = await supabase
      .from('deliveries')
      .select('order_id')
      .eq('driver_id', driverId);
    const ownOrderIds = new Set((ownDeliveries ?? []).map((d) => d.order_id as string));

    const filterByZone = (rows: Record<string, unknown>[]) =>
      rows
        .filter((row) => !ownOrderIds.has(row.id as string))
        .filter((row) => {
          const restaurant = row.restaurants as { address?: string } | null;
          const restaurantCity = restaurant?.address ? parseCityFromAddress(restaurant.address) : undefined;
          const restaurantNeighborhood = restaurant?.address ? parseNeighborhoodFromAddress(restaurant.address, restaurantCity) : undefined;
          return matchesDriverZone(restaurantCity, restaurantNeighborhood, driverCity, driverNeighborhoods);
        });

    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('status', 'ready')
      .order('estimated_ready_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error && isSchemaColumnMissing(error)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('orders')
        .select(ORDER_SELECT)
        .eq('status', 'ready')
        .order('created_at', { ascending: true });
      if (fallbackError || !fallbackData) return [];
      return filterByZone(fallbackData).map(mapOrderRow);
    }

    if (error || !data) return [];
    return filterByZone(data).map(mapOrderRow);
  }

  const { city: driverCity, serviceNeighborhoods: driverNeighborhoods } = readLocalDriverZone(driverId);
  return readLocalOrders()
    .filter((o) => o.status === 'ready' && !o.driverId)
    .filter((o) => {
      // Livraison directe : uniquement visible par les livreurs internes
      // désignés par ce restaurant, sans contrainte de zone (c'est le
      // restaurant qui choisit ses livreurs, pas le matching automatique).
      if (o.deliveryMode === 'restaurant') {
        return isOwnDriverForRestaurant(o.restaurantId, driverId);
      }
      const restaurant = mockRestaurants.find((r) => r.id === o.restaurantId);
      return matchesDriverZone(restaurant?.city, restaurant?.neighborhood, driverCity, driverNeighborhoods);
    })
    .sort((a, b) => (a.estimatedReadyAt ?? a.createdAt).localeCompare(b.estimatedReadyAt ?? b.createdAt));
}

export async function fetchDriverOrders(driverId: string): Promise<Order[]> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data, error } = await supabase
      .from('deliveries')
      .select(DRIVER_ORDER_SELECT)
      .eq('driver_id', driverId)
      .order('assigned_at', { ascending: false });
    if (error || !data) return [];
    return data
      .filter((row) => row.orders)
      .map((row) => ({ ...mapOrderRow(row.orders as Record<string, unknown>), driverId }));
  }

  return readLocalOrders().filter((o) => o.driverId === driverId);
}

export async function acceptDelivery(orderId: string, driverId: string): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    // A `deliveries` row can already exist as an unassigned placeholder
    // (e.g. seeded test data, or a future "mark ready" flow that pre-creates
    // it) — claim it atomically via UPDATE ... WHERE driver_id IS NULL rather
    // than blindly INSERT, which would 409 on the order_id unique constraint.
    // `select=id` + an empty result tells us whether a row was actually
    // claimed (0 rows = either no placeholder exists yet, or someone else
    // claimed it first).
    const { data: claimed, error: claimError } = await supabase
      .from('deliveries')
      .update({ driver_id: driverId, status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .is('driver_id', null)
      .select('id');
    if (claimError) throw claimError;
    if (claimed && claimed.length > 0) return;

    const { error: deliveryError } = await supabase
      .from('deliveries')
      .insert({ order_id: orderId, driver_id: driverId, status: 'assigned', assigned_at: new Date().toISOString() });
    if (deliveryError) throw deliveryError;
    return;
  }

  const updated = readLocalOrders().map((o) =>
    o.id === orderId ? { ...o, driverId } : o
  );
  writeLocalOrders(updated);
}

export async function markPickedUp(orderId: string): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const now = new Date().toISOString();
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'picked_up', updated_at: now })
      .eq('id', orderId);
    if (orderError) throw orderError;

    await supabase
      .from('deliveries')
      .update({ status: 'picked_up', picked_up_at: now })
      .eq('order_id', orderId);
    return;
  }

  await updateOrderStatus(orderId, 'picked_up');
}

/**
 * Clôture une livraison. `withoutCode: true` = repli « le client n'a pas son
 * code » (tracé via `deliveredWithoutCode`, visible par l'admin — CONF-17).
 * Contrat VPS cible : POST /api/orders/:id/deliver  body { code?, withoutCode? }
 * (le serveur vérifie le code ; ici en mock la vérification est faite côté UI).
 */
export async function markDelivered(orderId: string, options?: { withoutCode?: boolean }): Promise<void> {
  const withoutCode = options?.withoutCode === true;

  // Mode VPS EN PREMIER, y compris pour le repli « sans code » : auparavant ce
  // cas n'écrivait QUE dans localStorage, donc en production la livraison n'était
  // jamais persistée côté serveur (commande bloquée « prête » pour tous les
  // autres). Faute de colonne dédiée en base, la clôture sans code est
  // enregistrée comme une livraison normale (statut delivered) — l'essentiel est
  // que la commande soit réellement terminée.
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const now = new Date().toISOString();
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'delivered', updated_at: now })
      .eq('id', orderId);
    if (orderError) throw orderError;

    const { error: deliveryError } = await supabase
      .from('deliveries')
      .update({ status: 'delivered', delivered_at: now })
      .eq('order_id', orderId);
    if (deliveryError) throw deliveryError;
    await earnLoyaltyForOrder(orderId);
    return;
  }

  if (withoutCode) {
    const now = new Date().toISOString();
    const updated = readLocalOrders().map((o) =>
      o.id === orderId
        ? { ...o, status: 'delivered' as OrderStatus, deliveredWithoutCode: true, updatedAt: now }
        : o
    );
    writeLocalOrders(updated);
    await earnLoyaltyForOrder(orderId);
    return;
  }

  await updateOrderStatus(orderId, 'delivered');
}
