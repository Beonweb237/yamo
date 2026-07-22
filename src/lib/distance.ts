// ============================================================
// MiamExpress — Calcul de distance Haversine + Rémunération livreur
// Formule mathématique gratuite, pas d'appel API, instantanée
// Précision : ~0.5% pour des distances < 100 km (largement suffisant
// pour de la livraison urbaine au Cameroun)
// ============================================================

import { DRIVER_PAY_CONFIG, estimateDriverEarnings as configEstimateEarnings } from '../data/launchConfig';

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

// ═══════════════════════════════════════════════════════════════
// Frais de livraison CLIENT (ce que le client paie)
// ═══════════════════════════════════════════════════════════════

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
  // Fallback si l'API est injoignable — utilise la config livreur comme référence
  const raw = distanceInKm * DRIVER_PAY_CONFIG.PER_KM_RATE_FCFA;
  const rounded = Math.round(raw / 100) * 100;
  return Math.max(500, Math.min(3000, rounded));
}

/** Version synchrone avec config par défaut (utilisable sans await) */
export function calculateDeliveryFeeSync(distanceInKm: number): number {
  const raw = distanceInKm * DRIVER_PAY_CONFIG.PER_KM_RATE_FCFA;
  const rounded = Math.round(raw / 100) * 100;
  return Math.max(500, Math.min(3000, rounded));
}

// ═══════════════════════════════════════════════════════════════
// Rémunération LIVREUR (décomposition complète — série DRV)
// ═══════════════════════════════════════════════════════════════

/** Décomposition complète de la rémunération d'une course pour le livreur. */
export interface DriverEarningsBreakdown {
  /** Tarif de base (prise en charge). */
  basePickup: number;
  /** Composante distance (FCFA/km × km). */
  distancePay: number;
  /** Composante temps d'attente estimé (FCFA/min × min). */
  waitPay: number;
  /** Sous-total avant surge (base + distance + temps). */
  subtotal: number;
  /** Multiplicateur surge actif (1.0 = pas de surge). */
  surgeMultiplier: number;
  /** Bonus surge (subtotal × (multiplier - 1)). */
  surgeBonus: number;
  /** Après garantie du minimum (plateforme complète si < minimum). */
  guaranteed: number;
  /** Rémunération finale garantie (avant pourboire et bonus volume). */
  final: number;
  /** Le surge est-il actif en ce moment ? */
  surgeActive: boolean;
  /** Heure actuelle (pour debug / transparence). */
  currentHour: number;
}

/**
 * Calcule la rémunération totale estimée pour le livreur (FCFA).
 * Décomposition complète : base pickup + distance + temps d'attente + surge.
 * Utilisé côté DriverDashboard AVANT acceptation d'une course.
 *
 * @param distanceKm - Distance restaurant → client (km)
 * @param waitMinutes - Temps d'attente estimé au resto (min), défaut 10
 */
export function calculateDriverEarnings(distanceKm: number, waitMinutes: number = 10): DriverEarningsBreakdown {
  const estimated = configEstimateEarnings(distanceKm, waitMinutes);
  return {
    ...estimated,
    currentHour: new Date().getHours(),
  };
}

/**
 * Version simplifiée : retourne juste le total estimé pour le livreur.
 */
export function estimateDriverTotalEarnings(distanceKm: number, waitMinutes: number = 10): number {
  return calculateDriverEarnings(distanceKm, waitMinutes).final;
}

/**
 * Détermine si une heure donnée est en période de surge.
 */
export function isSurgeActive(hour?: number): boolean {
  const h = hour ?? new Date().getHours();
  return DRIVER_PAY_CONFIG.SURGE_SCHEDULE.some(s => h >= s.startHour && h < s.endHour);
}

/**
 * Retourne le multiplicateur surge actif pour l'heure donnée.
 */
export function getActiveSurgeMultiplier(hour?: number): number {
  const h = hour ?? new Date().getHours();
  const active = DRIVER_PAY_CONFIG.SURGE_SCHEDULE.find(s => h >= s.startHour && h < s.endHour);
  return active?.multiplier ?? 1.0;
}

// ═══════════════════════════════════════════════════════════════
// Bonus de volume hebdomadaire
// ═══════════════════════════════════════════════════════════════

/**
 * Calcule le bonus de volume applicable selon le nombre de livraisons
 * cette semaine. Retourne le palier atteint et le bonus correspondant.
 */
export function calculateVolumeBonus(completedThisWeek: number): {
  tier: { minDeliveries: number; bonusFcfa: number; label: string } | null;
  bonusFcfa: number;
  nextTier: { minDeliveries: number; bonusFcfa: number; label: string; remaining: number } | null;
  progressPercent: number;
} {
  const tiers = [...DRIVER_PAY_CONFIG.VOLUME_BONUS_TIERS].sort((a, b) => b.minDeliveries - a.minDeliveries);
  const achieved = tiers.find(t => completedThisWeek >= t.minDeliveries) ?? null;

  const nextTiers = [...DRIVER_PAY_CONFIG.VOLUME_BONUS_TIERS].sort((a, b) => a.minDeliveries - b.minDeliveries);
  const next = nextTiers.find(t => completedThisWeek < t.minDeliveries) ?? null;

  const maxTier = DRIVER_PAY_CONFIG.VOLUME_BONUS_TIERS[DRIVER_PAY_CONFIG.VOLUME_BONUS_TIERS.length - 1];
  const progressPercent = Math.min(100, Math.round((completedThisWeek / maxTier.minDeliveries) * 100));

  return {
    tier: achieved,
    bonusFcfa: achieved?.bonusFcfa ?? 0,
    nextTier: next ? { ...next, remaining: next.minDeliveries - completedThisWeek } : null,
    progressPercent,
  };
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
