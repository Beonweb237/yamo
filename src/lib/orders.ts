import { supabase, isSupabaseConfigured } from './supabase';
import type { CartItem } from '../contexts/CartContext';

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
  driverId?: string | null;
  contactPhone?: string;
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

export async function createOrder(input: OrderInput): Promise<Order> {
  if (isSupabaseConfigured && supabase) {
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

    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .insert({
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
      })
      .select()
      .single();

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
      status: 'pending',
      createdAt: orderRow.created_at,
      items: input.items.map((ci) => ({ name: ci.item.name, price: ci.item.price, quantity: ci.quantity })),
    };
  }

  // Dev mode fallback: persist the order in localStorage so the "Mes commandes"
  // page has something real to show without a backend configured yet.
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
    status: 'pending',
    createdAt: new Date().toISOString(),
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
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    restaurantId: row.restaurant_id as string,
    restaurantName: '',
    subtotal: row.subtotal as number,
    deliveryFee: row.delivery_fee as number,
    total: row.total as number,
    paymentMethod: row.payment_method as PaymentMethod,
    address: {
      city: addr?.city ?? '',
      neighborhood: addr?.neighborhood ?? '',
      landmark: addr?.landmark ?? '',
      fullText: addr?.full_text ?? '',
    },
    status: row.status as OrderStatus,
    createdAt: row.created_at as string,
    items: orderItems.map((oi) => ({ name: oi.name, price: oi.price, quantity: oi.quantity })),
  };
}

const ORDER_SELECT = '*, order_items(*), addresses(*)';

export async function fetchOrders(customerId: string): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
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
  if (isSupabaseConfigured && supabase) {
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
  if (isSupabaseConfigured && supabase) {
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
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) throw error;
    return;
  }

  const orders = readLocalOrders();
  const updated = orders.map((o) => (o.id === orderId ? { ...o, status } : o));
  writeLocalOrders(updated);
}

// ─────────────────────────────────────────────────────────────
// Livreur : pool de livraisons disponibles + livraisons acceptées
// ─────────────────────────────────────────────────────────────

export async function fetchAvailableDeliveries(): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    // RLS (0002_restaurant_driver_access.sql) already restricts this to
    // 'ready' orders with no assigned driver.
    const { data, error } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('status', 'ready')
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data.map(mapOrderRow);
  }

  return readLocalOrders().filter((o) => o.status === 'ready' && !o.driverId);
}

export async function fetchDriverOrders(driverId: string): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('deliveries')
      .select('*, orders(*, order_items(*), addresses(*))')
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
  if (isSupabaseConfigured && supabase) {
    const { error: deliveryError } = await supabase
      .from('deliveries')
      .insert({ order_id: orderId, driver_id: driverId, status: 'assigned', assigned_at: new Date().toISOString() });
    if (deliveryError) throw deliveryError;

    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'delivering' })
      .eq('id', orderId);
    if (orderError) throw orderError;
    return;
  }

  const orders = readLocalOrders();
  const updated = orders.map((o) =>
    o.id === orderId ? { ...o, driverId, status: 'delivering' as OrderStatus } : o
  );
  writeLocalOrders(updated);
}

export async function markPickedUp(orderId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'picked_up' })
      .eq('id', orderId);
    if (orderError) throw orderError;

    await supabase
      .from('deliveries')
      .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
      .eq('order_id', orderId);
    return;
  }

  await updateOrderStatus(orderId, 'picked_up');
}

export async function markDelivered(orderId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', orderId);
    if (orderError) throw orderError;

    const { error: deliveryError } = await supabase
      .from('deliveries')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('order_id', orderId);
    if (deliveryError) throw deliveryError;
    return;
  }

  await updateOrderStatus(orderId, 'delivered');
}


