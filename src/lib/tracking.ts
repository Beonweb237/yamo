import { restaurants as mockRestaurants } from '../data/mockData';
import { getNeighborhoodCoords } from '../data/locations';
import { haversineDistance, estimateTime } from './utils';
import type { Order } from './orders';

export interface LatLng {
  lat: number;
  lng: number;
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
