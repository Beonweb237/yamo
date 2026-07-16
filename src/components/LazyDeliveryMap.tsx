import { lazy, Suspense } from 'react';
import { Skeleton } from './ui/skeleton';
import type { MapPoint } from './DeliveryMap';

const DeliveryMap = lazy(() => import('./DeliveryMap'));

export type { MapPoint };

interface LazyDeliveryMapProps {
  points: MapPoint[];
  height?: string;
  scrollWheelZoom?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  /** Affiche un badge "Position estimée" sur la carte */
  estimated?: boolean;
  /** Masquer les boutons Waze/Google Maps (ex: usage catalogue) */
  hideNavigation?: boolean;
}

export default function LazyDeliveryMap({ points, height = '400px', scrollWheelZoom, onMapClick, estimated, hideNavigation }: LazyDeliveryMapProps) {
  return (
    <Suspense fallback={<Skeleton className="rounded-xl w-full" style={{ height }} />}>
      <DeliveryMap points={points} height={height} scrollWheelZoom={scrollWheelZoom} onMapClick={onMapClick} estimated={estimated} hideNavigation={hideNavigation} />
    </Suspense>
  );
}
