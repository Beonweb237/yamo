// ============================================================
// MiamExpress — Admin : Gestion des Zones (villes/quartiers)
// ============================================================
import { useState, useEffect } from 'react';
import { MapPin, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import { CAMEROON_CITIES } from '../../data/cities';

const STORAGE_KEY = 'miam_disabled_zones';

interface DisabledZone {
  id: string;
  city: string;
  neighborhood: string | null;
  reason: string | null;
  disabledAt: string;
}

function readZones(): DisabledZone[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function writeZones(z: DisabledZone[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(z)); }

export default function AdminZones() {
  const [zones, setZones] = useState<DisabledZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { setZones(readZones()); setLoading(false); }, []);

  const disabledCityNames = new Set(zones.filter(z => !z.neighborhood).map(z => z.city));
  const disabledNeighborhoods = new Set(zones.filter(z => z.neighborhood).map(z => `${z.city}::${z.neighborhood}`));
  function isCityDisabled(city: string) { return disabledCityNames.has(city); }
  function isNeighborhoodDisabled(city: string, nbh: string) { return disabledNeighborhoods.has(`${city}::${nbh}`); }

  function toggleCity(city: string) {
    if (isCityDisabled(city)) {
      const updated = zones.filter(z => !(z.city === city && !z.neighborhood));
      setZones(updated); writeZones(updated);
      toast.success(`${city} réactivée`);
    } else {
      const zone: DisabledZone = { id: crypto.randomUUID(), city, neighborhood: null, reason: reasonInput || null, disabledAt: new Date().toISOString() };
      const updated = [zone, ...zones];
      setZones(updated); writeZones(updated);
      toast.success(`${city} désactivée`);
      setReasonInput('');
    }
  }

  function toggleNeighborhood(city: string, neighborhood: string) {
    if (isNeighborhoodDisabled(city, neighborhood)) {
      const updated = zones.filter(z => !(z.city === city && z.neighborhood === neighborhood));
      setZones(updated); writeZones(updated);
      toast.success(`${neighborhood} réactivé`);
    } else {
      const zone: DisabledZone = { id: crypto.randomUUID(), city, neighborhood, reason: reasonInput || null, disabledAt: new Date().toISOString() };
      const updated = [zone, ...zones];
      setZones(updated); writeZones(updated);
      toast.success(`${neighborhood} (${city}) désactivé`);
      setReasonInput('');
    }
  }

  const filteredCities = search
    ? CAMEROON_CITIES.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.neighborhoods.some(n => n.name.toLowerCase().includes(search.toLowerCase()))
    )
    : CAMEROON_CITIES;

  if (loading) return <div className="p-8 text-center text-text-muted">Chargement...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
          <MapPin className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="font-poppins font-bold text-text-primary text-2xl">Gestion des Zones</h1>
          <p className="text-text-secondary text-sm font-inter">Activez ou désactivez des villes et quartiers — impact automatique sur les restaurants</p>
        </div>
      </div>

      {/* Stats + Motif */}
      <div className="flex flex-wrap items-center gap-3 mb-6 mt-4">
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-xs font-inter font-medium px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          {zones.length} zone{zones.length > 1 ? 's' : ''} désactivée{zones.length > 1 ? 's' : ''}
        </div>

        <input
          type="text"
          value={reasonInput}
          onChange={(e) => setReasonInput(e.target.value)}
          placeholder="Motif (optionnel)..."
          className="ml-auto bg-bg-secondary rounded-lg px-3 h-9 text-text-primary font-inter text-xs outline-none border border-border-custom w-48 placeholder:text-text-muted"
        />
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une ville ou un quartier..."
          className="w-full bg-white rounded-xl px-10 h-11 text-text-primary font-inter text-sm outline-none border border-border-custom focus:border-green-primary transition-colors"
        />
      </div>

      {/* Cities toggle list */}
      <div className="space-y-2">
        {filteredCities.map(city => (
          <div key={city.name} className="bg-white rounded-xl border border-border-custom overflow-hidden">
            {/* City row */}
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => setExpandedCity(expandedCity === city.name ? null : city.name)}
                className="flex items-center gap-2 text-left flex-1 min-w-0"
              >
                {expandedCity === city.name
                  ? <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                }
                <MapPin className="w-4 h-4 text-text-muted shrink-0" />
                <span className="font-inter font-medium text-text-primary text-sm">{city.name}</span>
                <span className="text-text-muted text-xs font-inter">({city.neighborhoods.length} quartiers)</span>
              </button>
              {/* Toggle switch */}
              <button
                onClick={() => toggleCity(city.name)}
                disabled={false}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${isCityDisabled(city.name) ? 'bg-red-500' : 'bg-gray-300'
                  }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isCityDisabled(city.name) ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
              </button>
            </div>

            {/* Neighborhoods (expanded) */}
            {expandedCity === city.name && (
              <div className="border-t border-border-light bg-bg-secondary/50 divide-y divide-border-light">
                {city.neighborhoods.map(nbh => (
                  <div key={nbh.name} className="flex items-center justify-between px-6 py-2.5">
                    <span className="font-inter text-sm text-text-secondary">{nbh.name}</span>
                    <button
                      onClick={() => toggleNeighborhood(city.name, nbh.name)}
                      disabled={isCityDisabled(city.name)}
                      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 disabled:opacity-40 ${isCityDisabled(city.name)
                        ? 'bg-gray-300 cursor-not-allowed'
                        : isNeighborhoodDisabled(city.name, nbh.name)
                          ? 'bg-red-500'
                          : 'bg-gray-300'
                        }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isNeighborhoodDisabled(city.name, nbh.name) && !isCityDisabled(city.name) ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredCities.length === 0 && (
        <div className="text-center py-12 text-text-muted font-inter text-sm">
          Aucune ville trouvée pour "{search}".
        </div>
      )}
    </div>
  );
}
