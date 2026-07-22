import { restaurants as mockRestaurants } from '../data/mockData';
import { getNeighborhoodCoords } from '../data/locations';
import { haversineDistance, estimateTime } from './utils';
import type { Order } from './orders';

export interface LatLng {
  lat: number;
  lng: number;
}

// ── Suivi temps réel (série TRK) ─────────────────────────────────────────
const USE_VPS = import.meta.env.VITE_USE_VPS_API === 'true';

function authHeader(): Record<string, string> {
  try {
    const raw = localStorage.getItem('miamexpress_session');
    const token = raw ? JSON.parse(raw)?.access_token : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
}

/** Position réelle du livreur transmise au serveur pendant la livraison. */
export interface DriverPosition extends LatLng {
  updatedAt: string;
  /** true si la position date de plus de 2 min (affichage « en actualisation »). */
  stale: boolean;
}

/** Le livreur publie sa position réelle (best-effort, jamais bloquant). */
export async function sendDriverPosition(orderId: string, lat: number, lng: number): Promise<void> {
  if (!USE_VPS) return;
  try {
    await fetch('/api/tracking/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ orderId, lat, lng }),
    });
  } catch { /* réseau instable : on réessaiera au prochain tick */ }
}

/** Le client lit la vraie position du livreur — null si aucune (repli estimation). */
export async function fetchDriverPosition(orderId: string): Promise<DriverPosition | null> {
  if (!USE_VPS) return null;
  try {
    const res = await fetch(`/api/tracking/position/${encodeURIComponent(orderId)}`, { headers: authHeader() });
    if (!res.ok) return null;
    const json = await res.json();
    return json && typeof json.lat === 'number' ? (json as DriverPosition) : null;
  } catch { return null; }
}

/** Mode démonstration du suivi (réglage plateforme, défaut = false = réel). */
export async function getDemoTracking(): Promise<boolean> {
  if (!USE_VPS) return false;
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json?.demo_tracking);
  } catch { return false; }
}

/** Admin : active/désactive le mode démonstration du suivi. */
export async function setDemoTracking(enabled: boolean): Promise<void> {
  await fetch('/api/settings/demo_tracking', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ value: enabled }),
  });
}

/** Tous les réglages plateforme (app_settings) — { demo_tracking, recharge_momo_number, ... }. */
export async function getAppSettings(): Promise<Record<string, unknown>> {
  if (!USE_VPS) return {};
  try {
    const res = await fetch('/api/settings');
    return res.ok ? await res.json() : {};
  } catch { return {}; }
}

/** Numéro de dépôt Mobile Money pour les recharges resto (null tant que non renseigné). */
export async function getRechargeMomoNumber(): Promise<string | null> {
  const s = await getAppSettings();
  const n = s.recharge_momo_number;
  return typeof n === 'string' && n.trim() ? n.trim() : null;
}

/** Admin : renseigne le numéro de dépôt Mobile Money des recharges. */
export async function setRechargeMomoNumber(num: string): Promise<void> {
  await fetch('/api/settings/recharge_momo_number', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ value: num.trim() }),
  });
}

export function getRestaurantCoords(restaurantId: string): LatLng | null {
  const restaurant = mockRestaurants.find((r) => r.id === restaurantId);
  if (restaurant?.lat != null && restaurant?.lng != null) {
    return { lat: restaurant.lat, lng: restaurant.lng };
  }
  return null;
}

export function getCustomerCoords(order: Pick<Order, 'address'>): LatLng | null {
  if (order.address.lat != null && order.address.lng != null) {
    return { lat: order.address.lat, lng: order.address.lng };
  }
  return getNeighborhoodCoords(order.address.neighborhood) ?? getNeighborhoodCoords(order.address.city) ?? null;
}

/**
 * Position simulée du livreur entre le restaurant et le client, faute de GPS
 * temps réel (pas de backend de tracking). Avant "picked_up" le livreur est
 * au restaurant ; ensuite il progresse linéairement vers le client sur la
 * durée de trajet estimée (haversine × vitesse moyenne ville).
 */
export function simulateDriverPosition(
  restaurant: LatLng,
  customer: LatLng,
  order: Pick<Order, 'status' | 'readyAt' | 'updatedAt'>,
  now: Date = new Date()
): LatLng {
  if (order.status !== 'delivering') return restaurant;

  const startTime = order.readyAt ? new Date(order.readyAt) : order.updatedAt ? new Date(order.updatedAt) : now;
  const elapsedMin = Math.max(0, (now.getTime() - startTime.getTime()) / 60000);

  const distKm = haversineDistance(restaurant.lat, restaurant.lng, customer.lat, customer.lng);
  const travelMin = estimateTime(distKm);
  const progress = travelMin > 0 ? Math.min(1, elapsedMin / travelMin) : 1;

  return {
    lat: restaurant.lat + (customer.lat - restaurant.lat) * progress,
    lng: restaurant.lng + (customer.lng - restaurant.lng) * progress,
  };
}
