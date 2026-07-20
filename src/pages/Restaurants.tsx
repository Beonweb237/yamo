import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  MapPin,
  ChevronDown,
  Star,
  Clock,
  Heart,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Store,
  UtensilsCrossed,
  BadgeCheck,
} from 'lucide-react';
import { cuisineCategories } from '../data/mockData';
import type { Restaurant } from '../data/mockData';
import { activeCities, getNeighborhoods, getNeighborhoodCoords } from '../data/locations';
import { useRestaurants } from '../hooks/useCatalog';
import { useFavorites } from '../hooks/useFavorites';
import { isEffectivelyOpen } from '../lib/hours';
import AppImage from '../components/AppImage';
import LazyDeliveryMap, { type MapPoint } from '../components/LazyDeliveryMap';
import DishResults from '../components/DishResults';

type QuickFilterId = 'open' | 'freeDelivery' | 'fast' | 'premium';

const quickFilterDefs: { id: QuickFilterId; label: string; test: (r: Restaurant) => boolean }[] = [
  // LOT-14 (CONF-36) : « ouvert » = toggle du restaurateur ET horaires réels.
  { id: 'open', label: 'Ouvert maintenant', test: (r) => isEffectivelyOpen(r) },
  { id: 'freeDelivery', label: 'Livraison gratuite', test: (r) => r.deliveryFee === 0 },
  { id: 'fast', label: 'Moins de 30 min', test: (r) => parseInt(r.deliveryTime) < 30 },
  { id: 'premium', label: 'Premium', test: (r) => r.isPremium },
];

const ratingOptions = [
  { value: 0, label: 'Toutes les notes' },
  { value: 4, label: '4.0 et plus' },
  { value: 4.3, label: '4.3 et plus' },
  { value: 4.5, label: '4.5 et plus' },
  { value: 4.8, label: '4.8 et plus' },
];

const sortOptions = [
  { label: 'Pertinence', value: 'relevance' },
  { label: 'Note', value: 'rating' },
  { label: 'Temps de livraison', value: 'time' },
  { label: 'Prix croissant', value: 'price' },
];

const allCategories = ['Tous', ...cuisineCategories.map((c) => c.name)];

function stableDistance(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) % 100;
  return (1 + (hash % 30) / 10).toFixed(1);
}

function ratingForRanking(restaurant: Restaurant): number {
  return restaurant.ratingWeighted ?? restaurant.rating;
}

export default function Restaurants() {
  const { restaurants, loading } = useRestaurants();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Recherche unifiée (LOT-13 / CONF-33) : deux modes sur une seule page ──
  // `?mode=plats` affiche la vue plats (ex-/explorer) ; défaut = restaurants.
  // q / ville / quartier sont partagés entre les deux modes.
  const mode: 'restaurants' | 'plats' = searchParams.get('mode') === 'plats' ? 'plats' : 'restaurants';
  // Ville explicite au chargement (deep-link) → la géoloc auto du mode plats ne l'écrase pas
  const [hadLocationParam] = useState(() => searchParams.has('ville'));

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') ?? 'Tous');
  const [selectedCity, setSelectedCity] = useState(searchParams.get('ville') ?? 'Douala');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(searchParams.get('quartier') ?? '');
  const [sortBy, setSortBy] = useState('relevance');
  const [showSort, setShowSort] = useState(false);
  const [showCityMenu, setShowCityMenu] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [showNeighborhoodMenu, setShowNeighborhoodMenu] = useState(false);
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('');
  const { favorites, toggleFavorite } = useFavorites();
  const [activeQuickFilters, setActiveQuickFilters] = useState<Set<QuickFilterId>>(new Set());
  const [minRating, setMinRating] = useState(0);
  const [showRatingMenu, setShowRatingMenu] = useState(false);

  // Full-screen map
  const [mapFullscreen, setMapFullscreen] = useState(false);

  // Fermer la carte full-screen avec Échap + bloquer le scroll
  useEffect(() => {
    if (!mapFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMapFullscreen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mapFullscreen]);

  const toggleQuickFilter = (id: QuickFilterId) => {
    setActiveQuickFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const neighborhoods = getNeighborhoods(selectedCity);
  const filteredCities = activeCities.filter((c) =>
    c.name.toLowerCase().includes(citySearch.trim().toLowerCase())
  );
  const filteredNeighborhoods = neighborhoods.filter((n) =>
    n.toLowerCase().includes(neighborhoodSearch.trim().toLowerCase())
  );

  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    const cat = searchParams.get('category') ?? 'Tous';
    const ville = searchParams.get('ville') ?? 'Douala';
    const quartier = searchParams.get('quartier') ?? '';
    setSearchQuery(q);
    setActiveCategory(allCategories.includes(cat) ? cat : 'Tous');
    setSelectedCity(activeCities.some((c) => c.name === ville) ? ville : 'Douala');
    setSelectedNeighborhood(quartier);
  }, [searchParams]);

  const syncParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === 'Tous') next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  // Bascule Restaurants/Plats : on embarque l'état de recherche courant dans
  // l'URL, sinon une saisie non soumise serait perdue à la relecture des params.
  const setMode = (m: 'restaurants' | 'plats') => {
    syncParams({
      mode: m === 'plats' ? 'plats' : '',
      q: searchQuery,
      category: activeCategory,
      ville: selectedCity,
      quartier: selectedNeighborhood,
    });
  };

  const filtered = useMemo(() => {
    let result = [...restaurants];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.neighborhood.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (activeCategory !== 'Tous') {
      result = result.filter((r) => r.category === activeCategory);
    }

    if (selectedCity) {
      result = result.filter((r) => r.city === selectedCity);
    }

    if (selectedNeighborhood) {
      result = result.filter((r) => r.neighborhood === selectedNeighborhood);
    }

    for (const filterId of activeQuickFilters) {
      const def = quickFilterDefs.find((f) => f.id === filterId);
      if (def) result = result.filter(def.test);
    }

    if (minRating > 0) {
      result = result.filter((r) => r.rating >= minRating);
    }

    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => ratingForRanking(b) - ratingForRanking(a) || b.reviewCount - a.reviewCount);
        break;
      case 'time':
        result.sort((a, b) => {
          const ta = parseInt(a.deliveryTime);
          const tb = parseInt(b.deliveryTime);
          return ta - tb;
        });
        break;
      case 'price':
        result.sort((a, b) => a.minOrder - b.minOrder);
        break;
      default:
        break;
    }

    return result;
  }, [restaurants, searchQuery, activeCategory, selectedCity, selectedNeighborhood, activeQuickFilters, minRating, sortBy]);

  // ── Map points pour la carte interactive ──
  const mapPoints = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = [];
    for (const resto of filtered) {
      // Utiliser les coordonnées explicites du resto, ou celles du quartier/ville
      let lat = resto.lat;
      let lng = resto.lng;
      if (lat == null || lng == null) {
        const nbCoords = getNeighborhoodCoords(resto.neighborhood);
        if (nbCoords) { lat = nbCoords.lat; lng = nbCoords.lng; }
        else {
          const cityCoords = getNeighborhoodCoords(resto.city);
          if (cityCoords) { lat = cityCoords.lat; lng = cityCoords.lng; }
        }
      }
      if (lat == null || lng == null) continue;
      pts.push({ lat, lng, label: resto.name, type: 'restaurant' });
      if (pts.length >= 30) break; // Limiter à 30 marqueurs
    }
    return pts;
  }, [filtered]);

  const handleSearch = () => {
    syncParams({ q: searchQuery, category: activeCategory, ville: selectedCity, quartier: selectedNeighborhood });
  };

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      {/* Héro volontairement compact sur mobile : page utilitaire, les résultats
          doivent apparaître dès le premier écran (le marketing reste sur ≥sm). */}
      <section className="bg-green-primary pt-5 pb-14 sm:pt-16 sm:pb-24 relative">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="hidden sm:block text-white/60 text-xs font-inter mb-4"
          >
            <Link to="/" className="hover:text-white transition-colors">Accueil</Link>
            <span className="mx-2">/</span>
            <span className="text-white">{mode === 'plats' ? 'Explorer les plats' : 'Restaurants'}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="font-poppins font-semibold text-white text-2xl sm:text-4xl lg:text-[38px]/[1.18] tracking-normal mb-1 sm:mb-3"
          >
            {mode === 'plats' ? 'Trouvez le Plat Parfait' : 'Trouvez Votre Restaurant Idéal'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="hidden sm:block text-white/75 font-inter text-base max-w-[600px]"
          >
            {mode === 'plats'
              ? 'Recherchez par plat, ingrédient ou boisson — et commandez au meilleur prix'
              : 'Les meilleurs restaurants de vos quartiers, à Douala, Yaoundé et au-delà'}
          </motion.p>
        </div>
      </section>

      {/* z-30 : doit rester SOUS la navbar (z-50) et la barre catégories sticky (z-40) au scroll */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 -mt-10 relative z-30">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4"
        >
          {/* ── Toggle Restaurants / Plats (CONF-33) ── */}
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border-light" role="tablist" aria-label="Type de recherche">
            <div className="flex bg-bg-secondary rounded-lg p-0.5">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'restaurants'}
                onClick={() => setMode('restaurants')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-inter font-semibold transition-all ${mode === 'restaurants'
                  ? 'bg-white text-green-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
                  }`}
              >
                <Store className="w-4 h-4" />
                Restaurants
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'plats'}
                onClick={() => setMode('plats')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-inter font-semibold transition-all ${mode === 'plats'
                  ? 'bg-white text-green-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
                  }`}
              >
                <UtensilsCrossed className="w-4 h-4" />
                Plats
              </button>
            </div>
            <span className="text-xs font-inter text-text-muted hidden sm:inline">
              {mode === 'plats' ? 'Un plat précis, comparé entre restaurants' : 'Parcourir les restaurants de votre zone'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1 bg-white border border-border-custom rounded-lg px-3 h-12 focus-within:border-green-primary transition-all">
              <Search className="w-4 h-4 text-text-muted shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={mode === 'plats' ? 'Rechercher un plat, un ingrédient, une boisson...' : 'Rechercher un restaurant, une cuisine...'}
                className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
              />
            </div>
            {/* Mobile : grille 2×2 stricte (Ville|Quartier / Note|Rechercher) — le
                flex-wrap produisait un empilement en quinconce à 360px */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowCityMenu(!showCityMenu);
                    setShowNeighborhoodMenu(false);
                    setCitySearch('');
                  }}
                  className="w-full sm:w-auto flex items-center gap-2 bg-white border border-border-custom hover:border-text-muted rounded-lg px-3 h-12 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-text-muted" />
                  <div className="text-left">
                    <span className="text-[10px] text-text-muted font-inter block leading-none">Ville</span>
                    <span className="text-sm text-text-primary font-inter font-medium">{selectedCity}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-text-muted ml-auto sm:ml-0" />
                </button>
                {showCityMenu && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-border-custom rounded-lg shadow-xl z-[100] min-w-[200px] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-light">
                      <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <input
                        type="text"
                        autoFocus
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        placeholder="Rechercher une ville..."
                        className="flex-1 bg-transparent text-sm font-inter text-text-primary outline-none placeholder:text-text-muted"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto py-1">
                      {filteredCities.length === 0 ? (
                        <p className="px-4 py-2 text-sm text-text-muted font-inter">Aucune ville trouvée</p>
                      ) : (
                        filteredCities.map((city) => (
                          <button
                            key={city.id}
                            type="button"
                            onClick={() => {
                              setSelectedCity(city.name);
                              setSelectedNeighborhood('');
                              setShowCityMenu(false);
                              setCitySearch('');
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm font-inter transition-colors ${selectedCity === city.name
                              ? 'text-green-primary bg-green-light'
                              : 'text-text-secondary hover:bg-bg-secondary'
                              }`}
                          >
                            {city.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowNeighborhoodMenu(!showNeighborhoodMenu);
                    setShowCityMenu(false);
                    setNeighborhoodSearch('');
                  }}
                  className="w-full sm:w-auto flex items-center gap-2 bg-white border border-border-custom hover:border-text-muted rounded-lg px-3 h-12 transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4 text-text-muted" />
                  <div className="text-left">
                    <span className="text-[10px] text-text-muted font-inter block leading-none">Quartier</span>
                    <span className="text-sm text-text-primary font-inter font-medium">{selectedNeighborhood || 'Tous'}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-text-muted ml-auto sm:ml-0" />
                </button>
                {showNeighborhoodMenu && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-border-custom rounded-lg shadow-xl z-[100] min-w-[200px] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-light">
                      <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <input
                        type="text"
                        autoFocus
                        value={neighborhoodSearch}
                        onChange={(e) => setNeighborhoodSearch(e.target.value)}
                        placeholder="Rechercher un quartier..."
                        className="flex-1 bg-transparent text-sm font-inter text-text-primary outline-none placeholder:text-text-muted"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNeighborhood('');
                          setShowNeighborhoodMenu(false);
                          setNeighborhoodSearch('');
                        }}
                        className={`block w-full text-left px-4 py-2 text-sm font-inter transition-colors ${selectedNeighborhood === ''
                          ? 'text-green-primary bg-green-light'
                          : 'text-text-secondary hover:bg-bg-secondary'
                          }`}
                      >
                        Tous
                      </button>
                      {filteredNeighborhoods.length === 0 ? (
                        <p className="px-4 py-2 text-sm text-text-muted font-inter">Aucun quartier trouvé</p>
                      ) : (
                        filteredNeighborhoods.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              setSelectedNeighborhood(n);
                              setShowNeighborhoodMenu(false);
                              setNeighborhoodSearch('');
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm font-inter transition-colors ${selectedNeighborhood === n
                              ? 'text-green-primary bg-green-light'
                              : 'text-text-secondary hover:bg-bg-secondary'
                              }`}
                          >
                            {n}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              {mode === 'restaurants' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRatingMenu(!showRatingMenu);
                      setShowCityMenu(false);
                      setShowNeighborhoodMenu(false);
                    }}
                    className={`w-full sm:w-auto flex items-center gap-2 rounded-lg px-3 h-12 transition-colors border ${minRating > 0 ? 'bg-gold-light border-gold-accent/40' : 'bg-white border-border-custom hover:border-text-muted'
                      }`}
                  >
                    <Star className={`w-4 h-4 ${minRating > 0 ? 'text-gold-accent fill-gold-accent' : 'text-text-muted'}`} />
                    <div className="text-left">
                      <span className="text-[10px] text-text-muted font-inter block leading-none">Note</span>
                      <span className={`text-sm font-inter font-medium ${minRating > 0 ? 'text-amber-700' : 'text-text-primary'}`}>
                        {minRating > 0 ? `${minRating.toFixed(1)}+` : 'Toutes'}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  </button>
                  {showRatingMenu && (
                    <div className="absolute top-full left-0 mt-2 bg-white border border-border-custom rounded-lg shadow-xl z-[100] min-w-[180px] overflow-hidden py-1">
                      {ratingOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setMinRating(opt.value);
                            setShowRatingMenu(false);
                          }}
                          className={`flex items-center justify-between w-full text-left px-4 py-2 text-sm font-inter transition-colors ${minRating === opt.value
                            ? 'text-amber-700 bg-gold-light'
                            : 'text-text-secondary hover:bg-bg-secondary'
                            }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {opt.value > 0 && <Star className="w-3.5 h-3.5 fill-gold-accent text-gold-accent" />}
                            {opt.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={handleSearch}
                className={`${mode === 'restaurants' ? '' : 'col-span-2'} sm:flex-none bg-green-primary text-white font-inter font-medium text-sm h-12 px-6 rounded-lg hover:bg-green-dark active:scale-[0.98] transition-all`}
              >
                Rechercher
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Mode Plats : vue unifiée ex-/explorer ── */}
      {mode === 'plats' && (
        <DishResults
          restaurants={restaurants}
          query={searchQuery}
          city={selectedCity}
          neighborhood={selectedNeighborhood}
          hasExplicitLocation={hadLocationParam}
          onLocationChange={(city, nb) => {
            setSelectedCity(city);
            setSelectedNeighborhood(nb);
            syncParams({ ville: city, quartier: nb });
          }}
        />
      )}

      {mode === 'restaurants' && (
        <>
          <div className="sticky top-[72px] z-40 bg-white border-b border-border-custom mt-6">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-3">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      syncParams({ q: searchQuery, category: cat, ville: selectedCity, quartier: selectedNeighborhood });
                    }}
                    className={`snap-start shrink-0 px-4 py-2 rounded-full font-inter text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer ${cat === activeCategory
                      ? 'bg-green-primary text-white'
                      : 'bg-bg-secondary text-text-secondary hover:bg-green-light hover:text-green-primary'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section className="py-8 sm:py-12">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-text-secondary font-inter text-sm min-w-0 truncate">
                      <span className="font-semibold text-text-primary">{filtered.length}</span> restaurant{filtered.length !== 1 ? 's' : ''}
                      {selectedNeighborhood ? ` à ${selectedNeighborhood}` : ` à ${selectedCity}`}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Accès carte immédiat sur mobile — la carte compacte n'arrive qu'en fin de liste */}
                      {mapPoints.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setMapFullscreen(true)}
                          className="lg:hidden flex items-center gap-1.5 text-text-secondary font-inter text-sm hover:text-green-primary min-h-11 px-2 transition-colors"
                        >
                          <MapPin className="w-4 h-4" />
                          Carte
                        </button>
                      )}
                      <div className="relative">
                        <button
                          onClick={() => setShowSort(!showSort)}
                          className="flex items-center gap-1.5 text-text-secondary font-inter text-sm hover:text-text-primary min-h-11 px-2 whitespace-nowrap transition-colors"
                        >
                          Trier : {sortOptions.find((o) => o.value === sortBy)?.label}
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        {showSort && (
                          <div className="absolute right-0 top-full mt-2 bg-white border border-border-custom rounded-lg shadow-lg py-1 z-20 min-w-[180px]">
                            {sortOptions.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  setSortBy(opt.value);
                                  setShowSort(false);
                                }}
                                className={`block w-full text-left px-4 py-2 text-sm font-inter transition-colors ${sortBy === opt.value
                                  ? 'text-green-primary bg-green-light'
                                  : 'text-text-secondary hover:bg-bg-secondary'
                                  }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick filter pills */}
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-1">
                    {quickFilterDefs.map((pill) => {
                      const isActive = activeQuickFilters.has(pill.id);
                      return (
                        <button
                          key={pill.id}
                          onClick={() => toggleQuickFilter(pill.id)}
                          className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-inter font-medium transition-colors ${isActive
                            ? 'bg-green-primary text-white'
                            : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                            }`}
                        >
                          {pill.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <div key={`skeleton-${i}`} className="block bg-white rounded-xl border border-border-custom overflow-hidden animate-pulse">
                          <div className="aspect-[16/9] bg-bg-secondary" />
                          <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="h-5 bg-bg-secondary rounded-md w-1/2" />
                              <div className="h-4 bg-bg-secondary rounded-md w-16" />
                            </div>
                            <div className="h-3 bg-bg-secondary rounded-md w-2/3 mb-3" />
                            <div className="flex gap-2 mt-4">
                              <div className="h-5 bg-bg-secondary rounded-full w-12" />
                              <div className="h-5 bg-bg-secondary rounded-full w-20" />
                              <div className="h-5 bg-bg-secondary rounded-full w-24" />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : filtered.map((resto, i) => {
                      const isOpen = isEffectivelyOpen(resto);
                      return (
                        <motion.div
                          key={resto.id}
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.4,
                            delay: Math.min(i, 6) * 0.06,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                        >
                          <Link
                            to={`/restaurant/${resto.slug || resto.id}`}
                            className="block bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)] hover:-translate-y-1 active:scale-[0.99] transition-all duration-200 group"
                          >
                            <div className="aspect-[16/9] overflow-hidden relative">
                              <AppImage
                                src={resto.image}
                                alt={resto.name}
                                fallbackLabel={resto.category}
                                className={`w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-300 ${isOpen ? '' : 'grayscale-[0.6]'}`}
                              />
                              {/* L'état ouvert/fermé est l'information n°1 avant de commander :
                                il doit se lire dès la liste, pas seulement sur la fiche. */}
                              {!isOpen && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                                  <span className="bg-white/95 text-text-primary text-xs font-inter font-semibold px-3 py-1.5 rounded-full shadow-sm">
                                    Fermé actuellement
                                  </span>
                                </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  toggleFavorite(resto.id);
                                }}
                                className="absolute top-3 right-3 w-11 h-11 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
                                aria-label="Ajouter aux favoris"
                              >
                                <Heart
                                  className={`w-4 h-4 ${favorites.has(resto.id)
                                    ? 'fill-error text-error'
                                    : 'text-text-secondary'
                                    }`}
                                />
                              </button>
                              {resto.isPremium && (
                                <span className="absolute top-3 left-3 bg-green-primary text-white text-[11px] font-inter font-semibold px-2.5 py-1 rounded-full">
                                  Premium
                                </span>
                              )}
                            </div>
                            <div className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-0.5">
                                <h3 className="font-inter font-semibold text-text-primary text-base truncate min-w-0 flex items-center gap-1.5">
                                  {resto.name}
                                  {resto.verified && (
                                  <span title="Restaurant vérifié"><BadgeCheck className="w-4 h-4 text-blue-500 shrink-0" /></span>
                                  )}
                                </h3>
                                <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-inter font-medium mt-0.5 ${isOpen ? 'text-green-primary' : 'text-text-muted'}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-success' : 'bg-text-muted'}`} />
                                  {isOpen ? 'Ouvert' : 'Fermé'}
                                </span>
                              </div>
                              <p className="text-text-muted text-xs font-inter mb-2.5 truncate">
                                {resto.tags.join(' · ')}
                              </p>
                              <div className="flex items-center gap-x-2 gap-y-1 flex-wrap text-xs font-inter">
                                <span className="inline-flex items-center gap-1 bg-gold-light text-amber-700 font-medium px-2 py-0.5 rounded-full">
                                  <Star className="w-3 h-3 fill-gold-accent text-gold-accent" />
                                  {resto.rating.toFixed(1)}
                                  {resto.dynamicReviewCount != null && resto.dynamicReviewCount > 0 && (
                                    <span className="text-amber-600/70">({resto.dynamicReviewCount})</span>
                                  )}
                                </span>
                                <span className="inline-flex items-center gap-1 text-text-secondary">
                                  <Clock className="w-3 h-3" />
                                  {resto.deliveryTime}
                                </span>
                                <span className="text-border-custom">·</span>
                                <span className={resto.deliveryFee === 0 ? 'text-green-primary font-medium' : 'text-text-secondary'}>
                                  {resto.deliveryFee === 0 ? 'Livraison gratuite' : `${resto.deliveryFee.toLocaleString()} FCFA`}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-2 text-xs text-text-muted font-inter">
                                <span className="flex items-center gap-1 min-w-0">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{resto.neighborhood}, {resto.city} · {stableDistance(resto.id)} km</span>
                                </span>
                                {/* Gamme de prix en ₣ (contexte FCFA) — la donnée reste
                                    stockée en « € » côté catalogue, conversion à l'affichage. */}
                                <span className="shrink-0" title="Gamme de prix" aria-label={`Gamme de prix ${resto.priceRange.length} sur 3`}>
                                  {resto.priceRange.replace(/€/g, '₣')}
                                </span>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>

                  {filtered.length === 0 && (
                    <div className="bg-white rounded-2xl border border-border-custom p-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-green-light flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-green-primary" />
                      </div>
                      <p className="text-text-primary font-inter font-semibold mb-1">
                        Aucun restaurant ne correspond
                      </p>
                      <p className="text-text-secondary font-inter text-sm mb-5">
                        Essayez d&apos;élargir vos filtres ou de changer de quartier.
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setActiveCategory('Tous');
                          setSelectedCity('Douala');
                          setSelectedNeighborhood('');
                          setActiveQuickFilters(new Set());
                          setMinRating(0);
                          setSearchParams({}, { replace: true });
                        }}
                        className="h-11 px-5 rounded-lg border border-green-primary text-green-primary hover:bg-green-light font-inter text-sm font-medium transition-colors"
                      >
                        Réinitialiser les filtres
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Carte interactive (responsive) ── */}
                {/* Desktop : panneau latéral */}
                <div className="hidden lg:block w-[380px] shrink-0">
                  <div className="sticky top-[140px] h-[calc(100vh-160px)] bg-white rounded-xl border border-border-custom overflow-hidden">
                    {mapPoints.length > 0 ? (
                      <div className="relative h-full flex flex-col">
                        <div className="flex-1 min-h-0">
                          <LazyDeliveryMap points={mapPoints} height="100%" scrollWheelZoom={false} hideNavigation />
                        </div>
                        {/* Expand button */}
                        <button
                          type="button"
                          onClick={() => setMapFullscreen(true)}
                          className="absolute top-3 right-3 z-[1000] w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm border border-border-custom shadow-sm flex items-center justify-center text-text-secondary hover:text-green-primary hover:border-green-primary transition-all"
                          title="Agrandir la carte"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-3 left-3 right-12 bg-white/90 backdrop-blur-sm rounded-lg border border-border-custom px-3 py-2 text-xs font-inter text-text-secondary shadow-sm pointer-events-none">
                          <MapPin className="w-3.5 h-3.5 text-green-primary inline mr-1" />
                          {mapPoints.length} restaurant{mapPoints.length !== 1 ? 's' : ''} {selectedCity ? `à ${selectedCity}` : ''}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-text-muted p-4">
                        <MapPin className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm font-inter text-center">Aucun restaurant à afficher</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile/Tablette : carte compacte */}
                {mapPoints.length > 0 && (
                  <div className="lg:hidden mt-4">
                    <div className="bg-white rounded-xl border border-border-custom overflow-hidden">
                      <div className="relative h-[200px]">
                        <LazyDeliveryMap points={mapPoints} height="200px" scrollWheelZoom={false} hideNavigation />
                        <button
                          type="button"
                          onClick={() => setMapFullscreen(true)}
                          className="absolute top-2 right-2 z-[1000] w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm border border-border-custom shadow-sm flex items-center justify-center text-text-secondary hover:text-green-primary hover:border-green-primary transition-all"
                          title="Agrandir la carte"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg border border-border-custom px-2.5 py-1.5 text-[11px] font-inter text-text-secondary shadow-sm pointer-events-none">
                          <MapPin className="w-3 h-3 text-green-primary inline mr-1" />
                          {mapPoints.length} restaurant{mapPoints.length !== 1 ? 's' : ''} {selectedCity ? `à ${selectedCity}` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Full-screen map overlay ── */}
                {mapFullscreen && (
                  <div
                    className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm animate-in fade-in"
                    onClick={() => setMapFullscreen(false)}
                  >
                    <div
                      className="absolute inset-4 sm:inset-6 lg:inset-10 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Header bar */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light shrink-0">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-green-primary" />
                          <span className="font-inter font-semibold text-text-primary text-sm">
                            {mapPoints.length} restaurant{mapPoints.length !== 1 ? 's' : ''} {selectedCity ? `à ${selectedCity}` : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMapFullscreen(false)}
                          className="w-9 h-9 rounded-lg bg-bg-secondary hover:bg-border-light flex items-center justify-center text-text-secondary hover:text-text-primary transition-all"
                          title="Réduire la carte"
                        >
                          <Minimize2 className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Map */}
                      <div className="flex-1 min-h-0">
                        <LazyDeliveryMap points={mapPoints} height="100%" scrollWheelZoom={true} hideNavigation />
                      </div>
                      {/* Footer hint */}
                      <div className="px-4 py-2 border-t border-border-light bg-bg-secondary shrink-0">
                        <p className="text-[11px] font-inter text-text-muted text-center">
                          🖱️ Molette pour zoomer · Glissez pour naviguer · Échap ou clic extérieur pour fermer
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

