// ============================================================
// MiamExpress — AddressAutocomplete
// Combine données locales (villes/quartiers) + API Nominatim (OSM)
// ============================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, Loader2, Navigation } from 'lucide-react';
import { searchLocal } from '../data/cities';

export interface AddressSuggestion {
  display: string;
  lat: number;
  lng: number;
  source: 'local' | 'nominatim';
}

interface Props {
  value: string;
  onChange: (value: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  className?: string;
  onNavigate?: (lat: number, lng: number) => void;
}

export default function AddressAutocomplete({ value, onChange, placeholder, className, onNavigate }: Props) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fermer le dropdown si on clique à l'extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync la valeur externe
  useEffect(() => {
    if (value !== query) setQuery(value || '');
  }, [value]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    // 1. Recherche locale instantanée
    const local: AddressSuggestion[] = searchLocal(q).map(s => ({ ...s, source: 'local' as const }));
    setSuggestions(local);
    setOpen(true);

    // 2. Recherche Nominatim (OSM) en parallèle
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)},Cameroun&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'fr' } }
      );
      const data = await res.json();
      const nominatim: AddressSuggestion[] = data.map((item: any) => ({
        display: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        source: 'nominatim' as const,
      }));
      // Merge: local d'abord, puis nominatim (sans doublons)
      const merged = [...local];
      for (const n of nominatim) {
        if (!merged.some(m => m.display === n.display)) merged.push(n);
      }
      setSuggestions(merged.slice(0, 10));
    } catch {
      // Nominatim HS → on garde les résultats locaux
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    // Debounce 300ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (s: AddressSuggestion) => {
    setQuery(s.display);
    setSelectedCoords({ lat: s.lat, lng: s.lng });
    onChange(s.display, s.lat, s.lng);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setSelectedCoords(null);
    onChange('', undefined, undefined);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      {/* Input */}
      <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12 border border-border-custom focus-within:border-green-primary transition-all">
        <Search className="w-4 h-4 text-text-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          placeholder={placeholder || "Quartier, rue, ville..."}
          className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
        />
        {loading && <Loader2 className="w-4 h-4 animate-spin text-text-muted shrink-0" />}
        {query && (
          <button type="button" onClick={handleClear} className="text-text-muted hover:text-text-primary shrink-0 text-sm">
            ✕
          </button>
        )}
        {selectedCoords && onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate(selectedCoords.lat, selectedCoords.lng)}
            className="text-green-primary hover:text-green-dark shrink-0"
            title="Voir sur la carte"
          >
            <Navigation className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Coordonnées GPS sélectionnées */}
      {selectedCoords && (
        <p className="text-text-muted text-xs font-inter mt-1 ml-1 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          GPS : {selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)}
        </p>
      )}

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border-custom rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-4 py-3 text-sm font-inter text-text-primary hover:bg-bg-secondary transition-colors border-b border-border-light last:border-b-0 flex items-center gap-2"
            >
              <MapPin className={`w-4 h-4 shrink-0 ${s.source === 'local' ? 'text-green-primary' : 'text-amber-500'}`} />
              <span className="truncate">{s.display}</span>
              {s.source === 'local' && (
                <span className="text-[10px] bg-green-light text-green-primary px-1.5 py-0.5 rounded font-medium shrink-0">Local</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
