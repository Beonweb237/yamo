// ============================================================
// MiamExpress — Calcul de distance Haversine
// Formule mathématique gratuite, pas d'appel API, instantanée
// Précision : ~0.5% pour des distances < 100 km (largement suffisant
// pour de la livraison urbaine au Cameroun)
// ============================================================

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Calcule la distance à vol d'oiseau entre deux points GPS (en km).
 * Formule de Haversine — précision ~0.5%.
 */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Distance à vol d'oiseau (en km), arrondie à 1 décimale.
 */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  return Math.round(haversineDistance(a, b) * 10) / 10;
}

/**
 * Estime le temps de livraison en minutes selon la distance.
 * Base : 5 min/km en ville (embouteillages Douala/Yaoundé) + 10 min fixe (prépa).
 */
export function estimateDeliveryTime(distanceInKm: number): { min: number; max: number; label: string } {
  const speedKmPerMin = 0.2; // 5 min par km (12 km/h en ville)
  const baseMins = Math.ceil(distanceInKm / speedKmPerMin) + 10;

  const min = baseMins;
  const max = Math.ceil(baseMins * 1.5);

  if (distanceInKm < 1.5) return { min: 15, max: 25, label: '15–25 min' };
  if (distanceInKm < 3) return { min: 20, max: 35, label: '20–35 min' };
  if (distanceInKm < 5) return { min: 30, max: 45, label: '30–45 min' };
  if (distanceInKm < 8) return { min: 40, max: 60, label: '40–60 min' };
  return { min, max, label: `${min}–${max} min` };
}

/**
 * Calcule des frais de livraison selon la distance (FCFA).
 * Utilise la config admin si disponible, sinon les valeurs par défaut.
 * Toujours arrondi au multiple de 100 FCFA.
 */
export async function calculateDeliveryFee(distanceInKm: number): Promise<number> {
  try {
    const res = await fetch(`/api/delivery-fee/calculate?km=${distanceInKm.toFixed(1)}`);
    if (res.ok) {
      const data = await res.json();
      return data.fee;
    }
  } catch { /* fallback */ }
  // Fallback si l'API est injoignable
  const raw = distanceInKm * 200;
  const rounded = Math.round(raw / 100) * 100;
  return Math.max(500, Math.min(3000, rounded));
}

/** Version synchrone avec config par défaut (utilisable sans await) */
export function calculateDeliveryFeeSync(distanceInKm: number): number {
  const raw = distanceInKm * 200;
  const rounded = Math.round(raw / 100) * 100;
  return Math.max(500, Math.min(3000, rounded));
}

/**
 * Trie des restaurants par proximité par rapport à une position.
 */
export function sortByDistance<T extends { lat?: number | null; lng?: number | null }>(
  items: T[],
  origin: Coordinates
): (T & { distanceKm: number })[] {
  return items
    .map(item => ({
      ...item,
      distanceKm: item.lat != null && item.lng != null
        ? distanceKm(origin, { lat: item.lat, lng: item.lng })
        : Infinity,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Filtre les éléments dans un rayon donné (km).
 */
export function withinRadius<T extends { lat?: number | null; lng?: number | null }>(
  items: T[],
  origin: Coordinates,
  radiusKm: number
): (T & { distanceKm: number })[] {
  return sortByDistance(items, origin).filter(item => item.distanceKm <= radiusKm);
}
