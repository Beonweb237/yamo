import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Navigation } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon in Vite/bundler
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useTranslation } from "react-i18next";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom colored markers
const restaurantIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 28 16 28s16-16 16-28C32 7.2 24.8 0 16 0z" fill="#2D6A4F"/><circle cx="16" cy="15" r="5" fill="white"/></svg>'
  ),
  iconSize: [32, 44],
  iconAnchor: [16, 44],
  popupAnchor: [0, -44],
});

const customerIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 28 16 28s16-16 16-28C32 7.2 24.8 0 16 0z" fill="#E53E3E"/><circle cx="16" cy="15" r="5" fill="white"/></svg>'
  ),
  iconSize: [32, 44],
  iconAnchor: [16, 44],
  popupAnchor: [0, -44],
});

const driverIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="17" fill="#3B82F6" stroke="white" stroke-width="2"/><text x="18" y="23" fill="white" font-size="16" font-weight="bold" text-anchor="middle" font-family="system-ui">🛵</text></svg>'
  ),
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  type: 'restaurant' | 'customer' | 'driver';
}

// Component that auto-pans to a point when it changes
function AutoPan({ point }: { point: MapPoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) {
      map.panTo([point.lat, point.lng], { animate: true, duration: 1 });
    }
  }, [point, map]);
  return null;
}

// Component that handles map clicks
function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Recalcule les tuiles quand le conteneur change de taille (panneau sticky,
// passage plein écran, rotation) — Leaflet ne le détecte pas seul.
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export default function DeliveryMap({ points, height = '400px', scrollWheelZoom = true, onMapClick, estimated = false, hideNavigation = false }: {
  points: MapPoint[];
  height?: string;
  scrollWheelZoom?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  /** Affiche un badge "Position estimée" — positions non suivies en temps réel */
  estimated?: boolean;
  /** Masquer les boutons Waze/Google Maps (ex: usage catalogue restaurants) */
  hideNavigation?: boolean;
}) {
    const { t } = useTranslation();
  const driverPoint = points.find((p) => p.type === 'driver');
  const customerPoint = points.find((p) => p.type === 'customer');

  // Default center: Douala
  const center: [number, number] = driverPoint
    ? [driverPoint.lat, driverPoint.lng]
    : points.length > 0
      ? [points[0].lat, points[0].lng]
      : [4.0511, 9.7679];

  // Liens de navigation
  const dest = customerPoint || points[0];
  const wazeUrl = dest ? `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes` : '#';
  const googleUrl = dest ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}` : '#';

  // Une hauteur en % doit être propagée par le wrapper (sinon elle s'effondre à 0,
  // le wrapper étant en hauteur auto) : le wrapper prend 100% et la carte flex-1.
  const isRelativeHeight = height.endsWith('%');

  return (
    <div style={isRelativeHeight ? { height: '100%', display: 'flex', flexDirection: 'column' } : undefined}>
      <div
        style={isRelativeHeight ? { flex: '1 1 0%', minHeight: 0 } : { height }}
        className="relative rounded-xl overflow-hidden border border-border-custom"
      >
        {estimated && (
          <span className="absolute top-2 right-2 z-[500] bg-white/95 text-text-secondary text-[11px] font-inter font-medium px-2.5 py-1 rounded-full border border-border-custom shadow-sm pointer-events-none">
            {t("Position estimée")}
          </span>
        )}
        <MapContainer
          center={center}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={scrollWheelZoom}
        >
          <TileLayer
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((point, i) => {
            const icon = point.type === 'restaurant' ? restaurantIcon : point.type === 'driver' ? driverIcon : customerIcon;
            return (
              <Marker key={`${point.type}-${i}`} position={[point.lat, point.lng]} icon={icon}>
                <Popup>
                  <div className="text-sm font-inter">
                    <p className="font-semibold">{point.label}</p>
                    <p className="text-text-muted text-xs">{point.type === 'restaurant' ? '🏪 Restaurant' : point.type === 'driver' ? '🛵 Livreur' : '📍 Client'}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          <AutoPan point={driverPoint ?? null} />
          <InvalidateOnResize />
          {onMapClick && <ClickHandler onClick={onMapClick} />}
        </MapContainer>
      </div>

      {/* Navigation buttons */}
      {!hideNavigation && dest && (
        <div className="flex gap-2 mt-2">
          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#33CCFF] text-white text-xs font-inter font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <Navigation className="w-3.5 h-3.5" /> {t("Waze")}
          </a>
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#4285F4] text-white text-xs font-inter font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <Navigation className="w-3.5 h-3.5" /> {t("Google Maps")}
          </a>
        </div>
      )}
    </div>
  );
}
