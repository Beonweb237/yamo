import { lazy, Suspense } from 'react';
import { Skeleton } from './ui/skeleton';

const AddressPickerMap = lazy(() => import('./AddressPickerMap'));

interface LazyAddressPickerMapProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  height?: string;
}

export default function LazyAddressPickerMap({ lat, lng, onChange, height = '220px' }: LazyAddressPickerMapProps) {
  return (
    <Suspense fallback={<Skeleton className="rounded-xl w-full" style={{ height }} />}>
      <AddressPickerMap lat={lat} lng={lng} onChange={onChange} height={height} />
    </Suspense>
  );
}
