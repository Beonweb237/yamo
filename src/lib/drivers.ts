import { supabase, isSupabaseConfigured, isSupabaseAuthenticated } from './supabase';
import { fetchDriverOrders } from './orders';

export interface DriverFeedback {
  rating: number;
  comment: string;
}

export interface DriverStats {
  driverId: string;
  isOnline: boolean;
  isSuspended: boolean;
  suspensionReason?: string | null;
  completedDeliveries: number;
  completedThisWeek: number;
  averageRating: number | null;
  ratingCount: number;
  recentFeedback: DriverFeedback[];
}

export type PayoutStatus = 'pending' | 'paid' | 'rejected';

export interface PayoutRequest {
  id: string;
  driverId: string;
  amount: number;
  status: PayoutStatus;
  requestedAt: string;
  processedAt?: string | null;
  processedReason?: string | null;
}

const LOCAL_STATUS_KEY = 'yamo_local_driver_status';
const LOCAL_PAYOUTS_KEY = 'yamo_local_payouts';
const LOCAL_RATINGS_KEY = 'yamo_local_delivery_ratings';

interface LocalDriverStatus {
  isOnline: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
}

function readLocalRatings(): Record<string, DriverFeedback> {
  const raw = localStorage.getItem(LOCAL_RATINGS_KEY);
  return raw ? JSON.parse(raw) : {};
}

function writeLocalRatings(ratings: Record<string, DriverFeedback>) {
  localStorage.setItem(LOCAL_RATINGS_KEY, JSON.stringify(ratings));
}

function readLocalStatusMap(): Record<string, LocalDriverStatus> {
  const raw = localStorage.getItem(LOCAL_STATUS_KEY);
  return raw ? JSON.parse(raw) : {};
}

function writeLocalStatusMap(map: Record<string, LocalDriverStatus>) {
  localStorage.setItem(LOCAL_STATUS_KEY, JSON.stringify(map));
}

function readLocalPayouts(): PayoutRequest[] {
  const raw = localStorage.getItem(LOCAL_PAYOUTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function writeLocalPayouts(payouts: PayoutRequest[]) {
  localStorage.setItem(LOCAL_PAYOUTS_KEY, JSON.stringify(payouts));
}

// ─────────────────────────────────────────────────────────────
// Statut en ligne / suspension
// ─────────────────────────────────────────────────────────────

// Synchronous read used by AuthContext in local/mock mode, where suspension
// must be checked immediately during login/session-restore (no backend round-trip).
export function getLocalSuspensionInfo(driverId: string): { isSuspended: boolean; reason?: string } {
  const status = readLocalStatusMap()[driverId];
  return { isSuspended: status?.isSuspended ?? false, reason: status?.suspensionReason };
}

export async function fetchDriverOnlineStatus(driverId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data } = await supabase.from('profiles').select('is_online').eq('id', driverId).maybeSingle();
    return Boolean(data?.is_online);
  }
  return readLocalStatusMap()[driverId]?.isOnline ?? true;
}

export async function setDriverOnline(driverId: string, isOnline: boolean): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { error } = await supabase.from('profiles').update({ is_online: isOnline }).eq('id', driverId);
    if (error) throw error;
    return;
  }
  const map = readLocalStatusMap();
  map[driverId] = { isOnline, isSuspended: map[driverId]?.isSuspended ?? false };
  writeLocalStatusMap(map);
}

export async function setDriverSuspended(driverId: string, isSuspended: boolean, reason?: string): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { error } = await supabase
      .from('profiles')
      .update({ is_suspended: isSuspended, suspension_reason: isSuspended ? reason ?? null : null })
      .eq('id', driverId);
    if (error) throw error;
    return;
  }
  const map = readLocalStatusMap();
  map[driverId] = {
    isOnline: map[driverId]?.isOnline ?? true,
    isSuspended,
    suspensionReason: isSuspended ? reason : undefined,
  };
  writeLocalStatusMap(map);
}

// ─────────────────────────────────────────────────────────────
// Statistiques livreur (livraisons terminées, note moyenne)
// ─────────────────────────────────────────────────────────────

export async function fetchDriversStats(driverIds: string[]): Promise<Record<string, DriverStats>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const result: Record<string, DriverStats> = {};

  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, is_online, is_suspended, suspension_reason')
      .in('id', driverIds);

    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('driver_id, status, delivered_at, rating, rating_comment')
      .in('driver_id', driverIds);

    for (const driverId of driverIds) {
      const profile = profiles?.find((p) => p.id === driverId);
      const driverDeliveries = (deliveries ?? []).filter((d) => d.driver_id === driverId);
      const completed = driverDeliveries.filter((d) => d.status === 'delivered');
      const completedThisWeek = completed.filter((d) => d.delivered_at && d.delivered_at >= sevenDaysAgo);
      const rated = driverDeliveries.filter((d) => typeof d.rating === 'number');
      const averageRating = rated.length
        ? rated.reduce((sum, d) => sum + (d.rating as number), 0) / rated.length
        : null;
      const recentFeedback = rated
        .filter((d) => d.rating_comment)
        .slice(0, 3)
        .map((d) => ({ rating: d.rating as number, comment: d.rating_comment as string }));

      result[driverId] = {
        driverId,
        isOnline: Boolean(profile?.is_online),
        isSuspended: Boolean(profile?.is_suspended),
        suspensionReason: (profile?.suspension_reason as string) ?? null,
        completedDeliveries: completed.length,
        completedThisWeek: completedThisWeek.length,
        averageRating,
        ratingCount: rated.length,
        recentFeedback,
      };
    }
    return result;
  }

  const localStatus = readLocalStatusMap();
  const localRatings = readLocalRatings();
  for (const driverId of driverIds) {
    const driverOrders = await fetchDriverOrders(driverId);
    const completed = driverOrders.filter((o) => o.status === 'delivered');
    const completedThisWeek = completed.filter((o) => new Date(o.createdAt).getTime() >= Date.parse(sevenDaysAgo));
    const rated = completed
      .map((o) => localRatings[o.id])
      .filter((r): r is DriverFeedback => Boolean(r));

    result[driverId] = {
      driverId,
      isOnline: localStatus[driverId]?.isOnline ?? true,
      isSuspended: localStatus[driverId]?.isSuspended ?? false,
      suspensionReason: localStatus[driverId]?.suspensionReason ?? null,
      completedDeliveries: completed.length,
      completedThisWeek: completedThisWeek.length,
      averageRating: rated.length ? rated.reduce((sum, r) => sum + r.rating, 0) / rated.length : null,
      ratingCount: rated.length,
      recentFeedback: rated.filter((r) => r.comment).slice(0, 3),
    };
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Notation de la livraison par le client
// ─────────────────────────────────────────────────────────────

export async function rateDelivery(orderId: string, rating: number, comment?: string): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { error } = await supabase
      .from('deliveries')
      .update({ rating, rating_comment: comment ?? null })
      .eq('order_id', orderId);
    if (error) throw error;
    return;
  }

  const ratings = readLocalRatings();
  ratings[orderId] = { rating, comment: comment ?? '' };
  writeLocalRatings(ratings);
}

// ─────────────────────────────────────────────────────────────
// Demandes de virement
// ─────────────────────────────────────────────────────────────

function mapPayoutRow(row: Record<string, unknown>): PayoutRequest {
  return {
    id: row.id as string,
    driverId: row.driver_id as string,
    amount: row.amount as number,
    status: row.status as PayoutStatus,
    requestedAt: row.requested_at as string,
    processedAt: (row.processed_at as string) ?? null,
    processedReason: (row.processed_reason as string) ?? null,
  };
}

export async function requestPayout(driverId: string, amount: number): Promise<PayoutRequest> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data, error } = await supabase
      .from('payout_requests')
      .insert({ driver_id: driverId, amount })
      .select()
      .single();
    if (error || !data) throw error ?? new Error('Payout request failed');
    return mapPayoutRow(data);
  }

  const payout: PayoutRequest = {
    id: crypto.randomUUID(),
    driverId,
    amount,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };
  const payouts = readLocalPayouts();
  writeLocalPayouts([payout, ...payouts]);
  return payout;
}

export async function fetchDriverPayouts(driverId: string): Promise<PayoutRequest[]> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data, error } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('driver_id', driverId)
      .order('requested_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapPayoutRow);
  }
  return readLocalPayouts().filter((p) => p.driverId === driverId);
}

export async function fetchAllPayouts(): Promise<PayoutRequest[]> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data, error } = await supabase
      .from('payout_requests')
      .select('*')
      .order('requested_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapPayoutRow);
  }
  return readLocalPayouts();
}

export async function updatePayoutStatus(id: string, status: PayoutStatus, reason?: string): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { error } = await supabase
      .from('payout_requests')
      .update({ status, processed_at: new Date().toISOString(), processed_reason: reason ?? null })
      .eq('id', id);
    if (error) throw error;
    return;
  }
  const payouts = readLocalPayouts();
  writeLocalPayouts(
    payouts.map((p) =>
      p.id === id ? { ...p, status, processedAt: new Date().toISOString(), processedReason: reason ?? null } : p
    )
  );
}

// ─────────────────────────────────────────────────────────────
// Livreurs préférés (restaurant → driver preference)
// ─────────────────────────────────────────────────────────────

const LOCAL_PREFERRED_DRIVERS_KEY = 'yamo_preferred_drivers';
const MAX_PREFERRED_DRIVERS = 5;

interface PreferredEntry {
  restaurantId: string;
  driverId: string;
  createdAt: string;
}

function readLocalPreferred(): PreferredEntry[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_PREFERRED_DRIVERS_KEY) ?? '[]'); } catch { return []; }
}

function writeLocalPreferred(entries: PreferredEntry[]) {
  localStorage.setItem(LOCAL_PREFERRED_DRIVERS_KEY, JSON.stringify(entries));
}

export async function addPreferredDriver(restaurantId: string, driverId: string): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data: existing } = await supabase
      .from('preferred_drivers')
      .select('*')
      .eq('restaurant_id', restaurantId);
    if ((existing?.length ?? 0) >= MAX_PREFERRED_DRIVERS) {
      throw new Error('Maximum ' + MAX_PREFERRED_DRIVERS + ' livreurs preferes.');
    }
    const { error } = await supabase
      .from('preferred_drivers')
      .insert({ restaurant_id: restaurantId, driver_id: driverId });
    if (error) throw error;
    return;
  }

  const entries = readLocalPreferred();
  const existing = entries.filter(e => e.restaurantId === restaurantId).length;
  if (existing >= MAX_PREFERRED_DRIVERS) throw new Error('Maximum ' + MAX_PREFERRED_DRIVERS + ' livreurs preferes.');
  if (entries.some(e => e.restaurantId === restaurantId && e.driverId === driverId)) return;
  entries.push({ restaurantId, driverId, createdAt: new Date().toISOString() });
  writeLocalPreferred(entries);
}

export async function removePreferredDriver(restaurantId: string, driverId: string): Promise<void> {
  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { error } = await supabase
      .from('preferred_drivers')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('driver_id', driverId);
    if (error) throw error;
    return;
  }
  const entries = readLocalPreferred().filter(e => !(e.restaurantId === restaurantId && e.driverId === driverId));
  writeLocalPreferred(entries);
}

export async function getPreferredDrivers(restaurantId: string): Promise<string[]> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from('preferred_drivers')
      .select('driver_id')
      .eq('restaurant_id', restaurantId);
    return (data ?? []).map((r: Record<string, unknown>) => r.driver_id as string);
  }
  return readLocalPreferred().filter(e => e.restaurantId === restaurantId).map(e => e.driverId);
}

export async function getRestaurantsThatPreferMe(driverId: string): Promise<string[]> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from('preferred_drivers')
      .select('restaurant_id')
      .eq('driver_id', driverId);
    return (data ?? []).map((r: Record<string, unknown>) => r.restaurant_id as string);
  }
  return readLocalPreferred().filter(e => e.driverId === driverId).map(e => e.restaurantId);
}
