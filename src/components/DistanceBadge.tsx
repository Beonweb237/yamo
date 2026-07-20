// ============================================================
// MiamExpress — RestaurantCard : badge distance + temps + frais
// ============================================================
import { Clock, MapPin, DollarSign } from 'lucide-react';
import { distanceKm, estimateDeliveryTime, calculateDeliveryFeeSync } from '../lib/distance';
import { useTranslation } from "react-i18next";

interface Props {
  userLat?: number | null;
  userLng?: number | null;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  className?: string;
}

export default function DistanceBadge({ userLat, userLng, restaurantLat, restaurantLng, className }: Props) {
    const { t } = useTranslation();
  if (userLat == null || userLng == null || restaurantLat == null || restaurantLng == null) return null;

  const km = distanceKm({ lat: userLat, lng: userLng }, { lat: restaurantLat, lng: restaurantLng });
  if (km > 15) return null; // Trop loin, ne pas afficher

  const time = estimateDeliveryTime(km);
  const fee = calculateDeliveryFeeSync(km);

  return (
    <div className={`flex items-center gap-3 text-xs font-inter text-text-muted ${className || ''}`}>
      <span className="flex items-center gap-1" title="Distance">
        <MapPin className="w-3 h-3" /> {km} {t("km")}
      </span>
      <span className="flex items-center gap-1" title="Temps estimé">
        <Clock className="w-3 h-3" /> {time.label}
      </span>
      <span className="flex items-center gap-1 font-medium text-green-primary" title="Frais de livraison">
        <DollarSign className="w-3 h-3" /> {fee.toLocaleString()} {t("FCFA")}
      </span>
    </div>
  );
}

/** Hook pour obtenir la position de l'utilisateur depuis ses adresses sauvegardées */
export function useUserLocation(): { lat: number | null; lng: number | null; city: string | null } {
  try {
    const raw = localStorage.getItem('yamo_saved_addresses');
    if (!raw) return { lat: null, lng: null, city: null };
    const addresses = JSON.parse(raw);
    if (addresses.length === 0) return { lat: null, lng: null, city: null };
    const addr = addresses[0]; // Adresse par défaut
    return { lat: addr.lat ?? null, lng: addr.lng ?? null, city: addr.city ?? null };
  } catch {
    return { lat: null, lng: null, city: null };
  }
}

/** Hook pour filtrer les restaurants par ville (geofencing) */
export function useFilterByCity<T extends { city?: string | null }>(items: T[]): { filtered: T[]; userCity: string | null } {
  const { city } = useUserLocation();
  if (!city) return { filtered: items, userCity: null };
  const filtered = items.filter(item => !item.city || item.city === city);
  return { filtered, userCity: city };
}
