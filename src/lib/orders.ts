import { supabase, isSupabaseConfigured, isSupabaseAuthenticated } from './supabase';
import type { CartItem } from '../contexts/CartContext';
import { restaurants as mockRestaurants } from '../data/mockData';

const LOCAL_USERS_KEY = 'yamo_local_users'; // shared with AuthContext/applications.ts

function readLocalDriverZone(driverId: string): { city?: string | null; serviceNeighborhoods?: string[] | null } {
  try {
    const registry = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) ?? '{}');
    const entry = Object.values(registry).find((u: any) => u?.id === driverId) as any;
    return { city: entry?.city ?? null, serviceNeighborhoods: entry?.serviceNeighborhoods ?? null };
  } catch {
    return {};
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
  paymentMethod: PaymentMethod;
  address: {
    city: string;
    neighborhood: string;
    landmark: string;
    fullText: string;
  };
  notes?: string;
}

export interface Order extends Omit<OrderInput, 'items'> {
  id: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string | null;
  confirmedAt?: string | null;
  preparationEtaMinutes?: number | null;
  estimatedReadyAt?: string | null;
  readyAt?: string | null;
  driverId?: string | null;
  contactPhone?: string;
  recipient?: {
    name: string;
    phone: string;
    contactInstructions?: string;
  } | null;
  items: { name: string; price: number; quantity: number }[];
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

  const recipient = normalizeRecipient(input.recipient);

  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data: addressRow, error: addressError } = await supabase
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
      menu_item_id: ci.item.id,
      name: ci.item.name,
      price: ci.item.price,
      quantity: ci.quantity,
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(orderItemsPayload);
    if (itemsError) throw itemsError;

    return {
      id: orderRow.id,
      customerId: input.customerId,
      restaurantId: input.restaurantId,
      restaurantName: input.restaurantName,
      subtotal: input.subtotal,
      deliveryFee: input.deliveryFee,
      total: input.total,
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
      items: input.items.map((ci) => ({ name: ci.item.name, price: ci.item.price, quantity: ci.quantity })),
    };
  }

  // Dev mode fallback: persist the order in localStorage so the "Mes commandes"
  // page has something real to show without a backend configured yet.
  const now = new Date().toISOString();
  const order: Order = {
    id: crypto.randomUUID(),
    customerId: input.customerId,
    restaurantId: input.restaurantId,
    restaurantName: input.restaurantName,
    subtotal: input.subtotal,
    deliveryFee: input.deliveryFee,
    total: input.total,
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
    items: input.items.map((ci) => ({ name: ci.item.name, price: ci.item.price, quantity: ci.quantity })),
  };
  const existing = readLocalOrders();
  writeLocalOrders([order, ...existing]);
  return order;
}

function mapOrderRow(row: Record<string, unknown>): Order {
  const orderItems = (row.order_items as { name: string; price: number; quantity: number }[]) ?? [];
  const addr = row.addresses as {
    city?: string;
    neighborhood?: string;
    landmark?: string;
    full_text?: string;
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
  };
}

const ORDER_SELECT = '*, order_items(*), addresses(*), restaurants(name, phone, city, neighborhood)';
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

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = { status, updated_at: now };
    if (status === 'ready') payload.ready_at = now;

    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) {
      if (isSchemaColumnMissing(error)) {
        const { error: fallbackError } = await supabase.from('orders').update({ status }).eq('id', orderId);
        if (fallbackError) throw fallbackError;
        return;
      }
      throw error;
    }
    return;
  }

  const now = new Date().toISOString();
  const updated = readLocalOrders().map((o) =>
    o.id === orderId
      ? { ...o, status, updatedAt: now, readyAt: status === 'ready' ? now : o.readyAt }
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

  const updated = readLocalOrders().map((o) =>
    o.id === orderId
      ? {
        ...o,
        status: 'confirmed' as OrderStatus,
        updatedAt: confirmedAt.toISOString(),
        confirmedAt: confirmedAt.toISOString(),
        preparationEtaMinutes: minutes,
        estimatedReadyAt: estimatedReadyAt.toISOString(),
      }
      : o
  );
  writeLocalOrders(updated);
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

    // RLS (0002_restaurant_driver_access.sql) already restricts this to
    // 'ready' orders with no assigned driver. The zone match below is a UX
    // filter; the hard guarantee is the deliveries_check_driver_zone trigger
    // (0019) which rejects a mismatched acceptDelivery() at the DB level.
    const filterByZone = (rows: Record<string, unknown>[]) =>
      rows.filter((row) => {
        const restaurant = row.restaurants as { city?: string; neighborhood?: string } | null;
        return matchesDriverZone(restaurant?.city, restaurant?.neighborhood, driverCity, driverNeighborhoods);
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

export async function markDelivered(orderId: string): Promise<void> {
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
    return;
  }

  await updateOrderStatus(orderId, 'delivered');
}
