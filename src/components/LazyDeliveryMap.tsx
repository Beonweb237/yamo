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
}

export default function LazyDeliveryMap({ points, height = '400px', scrollWheelZoom, onMapClick }: LazyDeliveryMapProps) {
  return (
    <Suspense fallback={<Skeleton className="rounded-xl w-full" style={{ height }} />}>
      <DeliveryMap points={points} height={height} scrollWheelZoom={scrollWheelZoom} onMapClick={onMapClick} />
    </Suspense>
  );
}
