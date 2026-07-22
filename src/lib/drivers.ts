import { supabase, isSupabaseConfigured, isSupabaseAuthenticated } from './supabase';
import { fetchDriverOrders } from './orders';
import { DRIVER_PAY_CONFIG } from '../data/launchConfig';

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
// Série DRV — Règlement automatique + retrait instantané
// ─────────────────────────────────────────────────────────────

export interface AutoSettlementInfo {
  nextSettlementDay: string; // e.g. "Lundi 17 mars 2025"
  daysUntilSettlement: number;
  isToday: boolean;
  minimumFcfa: number;
  eligible: boolean; // solde >= minimum
}

/**
 * Calcule la date du prochain règlement automatique (lundi).
 */
export function getAutoSettlementInfo(currentBalance: number, now: Date = new Date()): AutoSettlementInfo {
  const targetDay = DRIVER_PAY_CONFIG.AUTO_SETTLEMENT_DAY; // 1 = lundi
  const currentDay = now.getDay(); // 0 = dimanche

  // Jours jusqu'au prochain lundi
  let daysUntil = (targetDay - currentDay + 7) % 7;
  if (daysUntil === 0) {
    // C'est lundi aujourd'hui — le règlement est aujourd'hui
    daysUntil = 0;
  }

  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + daysUntil);

  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  return {
    nextSettlementDay: `${dayNames[nextDate.getDay()]} ${nextDate.getDate()} ${monthNames[nextDate.getMonth()]} ${nextDate.getFullYear()}`,
    daysUntilSettlement: daysUntil,
    isToday: daysUntil === 0,
    minimumFcfa: DRIVER_PAY_CONFIG.AUTO_SETTLEMENT_MINIMUM_FCFA,
    eligible: currentBalance >= DRIVER_PAY_CONFIG.AUTO_SETTLEMENT_MINIMUM_FCFA,
  };
}

/**
 * Retrait instantané avec frais (2 % par défaut).
 * Retourne le payout créé et le montant net après frais.
 */
export async function requestInstantCashout(driverId: string, amount: number): Promise<{
  payout: PayoutRequest;
  grossAmount: number;
  fee: number;
  netAmount: number;
}> {
  const fee = Math.round(amount * DRIVER_PAY_CONFIG.INSTANT_CASHOUT_FEE_PERCENT / 100);
  const netAmount = amount - fee;

  if (isSupabaseConfigured && supabase && (await isSupabaseAuthenticated())) {
    const { data, error } = await supabase
      .from('payout_requests')
      .insert({
        driver_id: driverId,
        amount: netAmount,
        gross_amount: amount,
        cashout_fee: fee,
        payout_type: 'instant',
        status: 'pending',
      })
      .select()
      .single();
    if (error || !data) throw error ?? new Error('Instant cashout request failed');
    return {
      payout: mapPayoutRow(data),
      grossAmount: amount,
      fee,
      netAmount,
    };
  }

  const payout: PayoutRequest = {
    id: crypto.randomUUID(),
    driverId,
    amount: netAmount,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };
  const payouts = readLocalPayouts();
  writeLocalPayouts([payout, ...payouts]);
  return { payout, grossAmount: amount, fee, netAmount };
}

/**
 * Vérifie si le règlement automatique doit être déclenché pour un driver.
 * Appelé côté admin ou par un cron job VPS.
 * En mode mock, simule un règlement auto si c'est lundi ET solde ≥ minimum.
 */
export async function processAutoSettlement(
  driverId: string,
  balance: number,
  now: Date = new Date(),
): Promise<PayoutRequest | null> {
  const info = getAutoSettlementInfo(balance, now);
  if (!info.isToday || !info.eligible) return null;

  // Vérifier qu'aucun règlement auto n'a déjà été fait aujourd'hui
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const existingPayouts = readLocalPayouts().filter(
    (p) => p.driverId === driverId && p.requestedAt >= todayStart
  );
  if (existingPayouts.length > 0) return null;

  const payout: PayoutRequest = {
    id: `auto-${crypto.randomUUID()}`,
    driverId,
    amount: balance,
    status: 'pending',
    requestedAt: now.toISOString(),
    processedReason: 'Règlement automatique du lundi',
  };
  const payouts = readLocalPayouts();
  writeLocalPayouts([payout, ...payouts]);
  return payout;
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

// ─────────────────────────────────────────────────────────────
// Livreurs internes (le restaurant assure lui-même la livraison)
// ─────────────────────────────────────────────────────────────
// Un "livreur interne" reste un compte livreur classique (mêmes écrans, même
// code de livraison, même flux) — seule sa visibilité change : quand le
// restaurant marque une commande "Prête" en mode livraison directe
// (orders.ts → updateOrderStatus(..., 'restaurant')), seuls les livreurs
// internes de ce restaurant la voient dans leur pool de livraisons
// disponibles (orders.ts → fetchAvailableDeliveries), au lieu de tous les
// livreurs de la zone. Le client ne voit aucune différence de son côté.
// Pas de branche Supabase ici : nouvelle fonctionnalité, pas de backend VPS
// correspondant pour l'instant (voir CLAUDE.md § VPS, API et secrets).

const LOCAL_OWN_DRIVERS_KEY = 'yamo_own_drivers';
const MAX_OWN_DRIVERS = 5;

interface OwnDriverEntry {
  restaurantId: string;
  driverId: string;
  createdAt: string;
}

function readLocalOwnDrivers(): OwnDriverEntry[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_OWN_DRIVERS_KEY) ?? '[]'); } catch { return []; }
}

function writeLocalOwnDrivers(entries: OwnDriverEntry[]) {
  localStorage.setItem(LOCAL_OWN_DRIVERS_KEY, JSON.stringify(entries));
}

export async function addOwnDriver(restaurantId: string, driverId: string): Promise<void> {
  const entries = readLocalOwnDrivers();
  const existing = entries.filter(e => e.restaurantId === restaurantId).length;
  if (existing >= MAX_OWN_DRIVERS) throw new Error('Maximum ' + MAX_OWN_DRIVERS + ' livreurs internes.');
  if (entries.some(e => e.restaurantId === restaurantId && e.driverId === driverId)) return;
  entries.push({ restaurantId, driverId, createdAt: new Date().toISOString() });
  writeLocalOwnDrivers(entries);
}

export async function removeOwnDriver(restaurantId: string, driverId: string): Promise<void> {
  const entries = readLocalOwnDrivers().filter(e => !(e.restaurantId === restaurantId && e.driverId === driverId));
  writeLocalOwnDrivers(entries);
}

export async function getOwnDriverIds(restaurantId: string): Promise<string[]> {
  return readLocalOwnDrivers().filter(e => e.restaurantId === restaurantId).map(e => e.driverId);
}
