import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pickerIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 28 16 28s16-16 16-28C32 7.2 24.8 0 16 0z" fill="#E53E3E"/><circle cx="16" cy="15" r="5" fill="white"/></svg>'
  ),
  iconSize: [32, 44],
  iconAnchor: [16, 44],
});

function ClickToPlace({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterOnChange({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

interface AddressPickerMapProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  height?: string;
}

export default function AddressPickerMap({ lat, lng, onChange, height = '220px' }: AddressPickerMapProps) {
  return (
    <div style={{ height }} className="rounded-xl overflow-hidden border border-border-custom">
      <MapContainer center={[lat, lng]} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={[lat, lng]}
          icon={pickerIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const pos = (e.target as L.Marker).getLatLng();
              onChange(pos.lat, pos.lng);
            },
          }}
        />
        <ClickToPlace onMove={onChange} />
        <RecenterOnChange lat={lat} lng={lng} />
      </MapContainer>
    </div>
  );
}
