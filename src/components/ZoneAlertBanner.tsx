// ============================================================
// MiamExpress — ZoneAlertBanner : bannière si resto en zone désactivée
// ============================================================
import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface ZoneInfo {
  city: string;
  neighborhood: string | null;
  reason: string | null;
}

export function useZoneAlert(restaurantId: string | undefined) {
  const [disabledZones, setDisabledZones] = useState<ZoneInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    const token = JSON.parse(localStorage.getItem('miamexpress_session') || '{}')?.access_token || '';
    fetch(`/api/admin/zones/check/${restaurantId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { setDisabledZones(data.zones || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [restaurantId]);

  return { disabledZones, loading };
}

export function ZoneAlertBanner({ zones }: { zones: ZoneInfo[] }) {
  if (!zones || zones.length === 0) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-3 font-inter text-sm flex items-center justify-between gap-3 rounded-lg mb-4 animate-pulse">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-semibold">⚠️ Votre restaurant est situé dans une zone temporairement désactivée</p>
          <p className="text-red-100 text-xs mt-0.5">
            {zones.map(z => (
              <span key={z.city}>{z.city}{z.neighborhood ? ` (${z.neighborhood})` : ''} : {z.reason || 'Zone suspendue'}. </span>
            ))}
          </p>
        </div>
      </div>
      <a href="mailto:support@miamexpress.cm?subject=Restaurant%20en%20zone%20désactivée"
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0">
        <ExternalLink className="w-3.5 h-3.5" /> Contacter le support
      </a>
    </div>
  );
}
