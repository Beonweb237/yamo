import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, SlidersHorizontal, Star, ArrowUpDown, X, Leaf, Beef, Wheat,
  Coffee, Apple, Clock, Store, Flame, ImageOff, MapPin, ChevronDown,
} from 'lucide-react';
import { useRestaurants } from '../hooks/useCatalog';
import { activeCities, getNeighborhoods } from '../data/locations';
import { menuItems as mockMenuItems } from '../data/mockData';
import {
  inferDietaryTags,
  buildEnrichedItems,
  groupDishes,
  dishSlug,
  DIETARY_TAG_META,
  type EnrichedItem,
} from '../lib/dishes';

type SortBy = 'popular' | 'rating' | 'priceAsc' | 'priceDesc' | 'newest';
type QuickFilter = 'all' | 'boissons' | 'grillades' | 'plats' | 'desserts' | 'new';

const DIETARY_ICONS: Record<string, typeof Leaf> = {
  'sans-sucre': Coffee, diabetique: Apple, 'pauvre-en-sel': Wheat, vegetarien: Leaf,
  vegan: Leaf, halal: Flame, bio: Leaf, 'riche-en-proteines': Beef, allege: Wheat,
  epice: Flame, braise: Flame, traditionnel: Store, 'sans-cube': Coffee,
  'fait-maison': Star, 'sans-gluten': Wheat, cocktail: Coffee, detox: Apple,
  'presse-du-jour': Coffee,
};

const DIETARY_FILTERS = DIETARY_TAG_META.map((tag) => ({ ...tag, icon: DIETARY_ICONS[tag.id] ?? Leaf }));
const dietaryLabel = (id: string) => DIETARY_TAG_META.find((tag) => tag.id === id)?.label ?? id;

function getDishLocationSummary(items: EnrichedItem[]): string {
  const locations = [...new Set(items
    .map((item) => [item.restaurantNeighborhood, item.restaurantCity].filter(Boolean).join(', '))
    .filter(Boolean))];
  const cities = [...new Set(items.map((item) => item.restaurantCity).filter(Boolean))];

  if (locations.length === 0) return 'Localisation à confirmer';
  if (locations.length === 1) return locations[0];
  if (cities.length === 1) return `${locations.length} quartiers à ${cities[0]}`;
  return `${cities.length} villes · ${locations.length} quartiers`;
}

export default function ExplorerMet() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const initialCity = searchParams.get('ville') ?? '';
  const initialNeighborhood = searchParams.get('quartier') ?? '';
  const { restaurants } = useRestaurants();

  const [query, setQuery] = useState(initialQuery);
  const [selectedCity, setSelectedCity] = useState(() => activeCities.some((city) => city.name === initialCity) ? initialCity : '');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(initialNeighborhood);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [activeDietary, setActiveDietary] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('popular');
  const [allItems, setAllItems] = useState<EnrichedItem[]>([]);

  const cityNeighborhoods = useMemo(() => selectedCity ? getNeighborhoods(selectedCity) : [], [selectedCity]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    setAllItems(buildEnrichedItems(mockMenuItems, restaurants));
  }, [restaurants]);

  useEffect(() => {
    if (!selectedCity && selectedNeighborhood) {
      setSelectedNeighborhood('');
      return;
    }
    if (selectedNeighborhood && selectedCity && !cityNeighborhoods.includes(selectedNeighborhood)) {
      setSelectedNeighborhood('');
    }
  }, [cityNeighborhoods, selectedCity, selectedNeighborhood]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (selectedCity) params.set('ville', selectedCity);
    if (selectedNeighborhood) params.set('quartier', selectedNeighborhood);
    setSearchParams(params, { replace: true });
  }, [query, selectedCity, selectedNeighborhood, setSearchParams]);

  const locationItems = useMemo(() => allItems.filter((item) => {
    if (selectedCity && item.restaurantCity !== selectedCity) return false;
    if (selectedNeighborhood && item.restaurantNeighborhood !== selectedNeighborhood) return false;
    return true;
  }), [allItems, selectedCity, selectedNeighborhood]);

  const dishGroups = useMemo(() => {
    let result = locationItems.filter(item => item.isAvailable !== false);
    if (quickFilter === 'boissons') result = result.filter(i => i.category === 'Boissons');
    if (quickFilter === 'grillades') result = result.filter(i => i.category === 'Grillades');
    if (quickFilter === 'plats') result = result.filter(i => i.category === 'Plats Principaux');
    if (quickFilter === 'desserts') result = result.filter(i => i.category === 'Desserts' || i.category === 'Patisseries' || i.category === 'Pâtisseries');
    if (activeDietary.length > 0) {
      result = result.filter(i => {
        const tags = inferDietaryTags(i);
        return activeDietary.some(d => tags.includes(d));
      });
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.restaurantName.toLowerCase().includes(q) ||
        i.restaurantCity.toLowerCase().includes(q) ||
        i.restaurantNeighborhood.toLowerCase().includes(q)
      );
    }
    const groups = groupDishes(result);
    if (sortBy === 'popular') groups.sort((a, b) => (b.items.filter(i => i.isPopular).length) - (a.items.filter(i => i.isPopular).length));
    if (sortBy === 'rating') groups.sort((a, b) => b.avgRating - a.avgRating);
    if (sortBy === 'priceAsc') groups.sort((a, b) => a.minPrice - b.minPrice);
    if (sortBy === 'priceDesc') groups.sort((a, b) => b.maxPrice - a.maxPrice);
    if (sortBy === 'newest') groups.reverse();
    return groups;
  }, [locationItems, query, quickFilter, activeDietary, sortBy]);

  const toggleDietary = (id: string) => setActiveDietary(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  const resetLocation = () => { setSelectedCity(''); setSelectedNeighborhood(''); syncLocationParams('', ''); };

  // Sync location to URL params
  const syncLocationParams = (city: string, neighborhood: string) => {
    const next = new URLSearchParams(searchParams);
    if (city) next.set('ville', city); else next.delete('ville');
    if (neighborhood) next.set('quartier', neighborhood); else next.delete('quartier');
    setSearchParams(next, { replace: true });
  };

  const quickFilters: { id: QuickFilter; label: string; icon?: typeof Clock; count: number }[] = [
    { id: 'all', label: 'Tous', count: locationItems.length },
    { id: 'new', label: 'Nouveautés', icon: Clock, count: locationItems.length },
    { id: 'plats', label: 'Plats', count: locationItems.filter(i => i.category === 'Plats Principaux').length },
    { id: 'grillades', label: 'Grillades', count: locationItems.filter(i => i.category === 'Grillades').length },
    { id: 'boissons', label: 'Boissons', count: locationItems.filter(i => i.category === 'Boissons').length },
    { id: 'desserts', label: 'Desserts', count: locationItems.filter(i => i.category === 'Desserts' || i.category === 'Patisseries' || i.category === 'Pâtisseries').length },
  ];

  const restaurantsCount = new Set(locationItems.map(i => i.restaurantId)).size;
  const locationLabel = selectedNeighborhood ? `${selectedNeighborhood}, ${selectedCity}` : selectedCity || 'toutes les villes';

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      {/* ════════════════════════════════════════════════════
          Immersive Hero (Restaurants-style)
          ════════════════════════════════════════════════════ */}
      <section className="bg-green-primary pt-12 pb-20 sm:pt-16 sm:pb-24 relative">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-white/60 text-xs font-inter mb-4"
          >
            <Link to="/" className="hover:text-white transition-colors">Accueil</Link>
            <span className="mx-2">/</span>
            <span className="text-white">Explorer</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="font-poppins font-semibold text-white text-3xl sm:text-4xl lg:text-[38px]/[1.18] tracking-normal mb-3"
          >
            Trouvez le Plat Parfait
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-white/75 font-inter text-base max-w-[600px]"
          >
            {locationItems.length} plats disponibles dans {restaurantsCount} restaurants · {locationLabel}
          </motion.p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════
          Floating Search Bar + City/Neighborhood
          ════════════════════════════════════════════════════ */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 -mt-10 relative z-50">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1 bg-bg-secondary rounded-lg px-3 h-12">
              <Search className="w-4 h-4 text-text-muted shrink-0" />
              <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher un plat, un ingrédient, une boisson..."
                className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted" />
              {query && <button onClick={() => setQuery('')} className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-text-muted hover:text-text-primary"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12 cursor-pointer">
                <MapPin className="w-4 h-4 text-green-primary shrink-0" />
                <div className="text-left min-w-[100px]">
                  <span className="text-[10px] text-text-muted font-inter block leading-none">Ville</span>
                  <select value={selectedCity} onChange={(e) => { setSelectedCity(e.target.value); setSelectedNeighborhood(''); syncLocationParams(e.target.value, ''); }}
                    className="bg-transparent text-sm text-text-primary font-inter font-medium outline-none w-full">
                    <option value="">Toutes</option>
                    {activeCities.map(city => <option key={city.id} value={city.name}>{city.name}</option>)}
                  </select>
                </div>
                <ChevronDown className="w-4 h-4 text-text-muted" />
              </label>
              <label className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12 cursor-pointer">
                <MapPin className="w-4 h-4 text-text-muted shrink-0" />
                <div className="text-left min-w-[120px]">
                  <span className="text-[10px] text-text-muted font-inter block leading-none">Quartier</span>
                  <select value={selectedNeighborhood} onChange={(e) => { setSelectedNeighborhood(e.target.value); syncLocationParams(selectedCity, e.target.value); }}
                    disabled={!selectedCity}
                    className="bg-transparent text-sm text-text-primary font-inter font-medium outline-none w-full disabled:text-text-muted disabled:cursor-not-allowed">
                    <option value="">{selectedCity ? 'Tous' : 'Ville d\'abord'}</option>
                    {cityNeighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <ChevronDown className="w-4 h-4 text-text-muted" />
              </label>
              {(selectedCity || selectedNeighborhood) && (
                <button type="button" onClick={resetLocation}
                  className="h-12 px-4 rounded-lg border border-border-custom bg-white text-text-secondary hover:text-text-primary font-inter text-sm font-semibold transition-colors">
                  Effacer zone
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ════════════════════════════════════════════════════
          Filters (below the floating bar)
          ════════════════════════════════════════════════════ */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 mt-6 space-y-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          {quickFilters.map(f => (<button key={f.id} onClick={() => setQuickFilter(f.id)} className={`shrink-0 h-9 px-4 rounded-full text-sm font-inter font-semibold transition-colors flex items-center gap-1.5 ${quickFilter === f.id ? 'bg-green-primary text-white shadow-sm' : 'bg-white border border-border-custom text-text-secondary hover:text-text-primary'}`}>{f.icon && <f.icon className="w-3.5 h-3.5" />}{f.label} ({f.count})</button>))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {DIETARY_FILTERS.map(f => { const Icon = f.icon; const active = activeDietary.includes(f.id); return (<button key={f.id} onClick={() => toggleDietary(f.id)} className={`shrink-0 h-9 px-3 rounded-full text-xs font-inter font-semibold border transition-colors flex items-center gap-1.5 ${active ? 'bg-green-primary text-white border-green-primary' : 'bg-white border-border-custom text-text-secondary hover:text-text-primary'}`}><Icon className="w-3.5 h-3.5" />{f.label}</button>); })}
          {activeDietary.length > 0 && (<button onClick={() => setActiveDietary([])} className="shrink-0 h-9 px-3 rounded-full text-xs font-inter font-medium text-error border border-error/30 hover:bg-error/5 flex items-center gap-1"><X className="w-3 h-3" />Effacer</button>)}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-xs font-inter">{dishGroups.length} résultat{dishGroups.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1.5 bg-white rounded-lg border border-border-custom px-3 h-9">
            <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)} className="bg-transparent text-xs font-inter font-semibold text-text-secondary outline-none">
              <option value="popular">Populaires</option><option value="rating">Mieux notés</option><option value="priceAsc">Prix croissant</option><option value="priceDesc">Prix décroissant</option><option value="newest">Nouveautés</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pb-12">
        {dishGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-12 text-center">
            <SlidersHorizontal className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary font-inter font-medium text-lg mb-1">Aucun plat trouvé</p>
            <p className="text-text-muted text-sm font-inter mb-4">Essayez d'autres filtres ou élargissez votre recherche.</p>
            <button onClick={() => { setQuery(''); setQuickFilter('all'); setActiveDietary([]); resetLocation(); }} className="text-green-primary font-inter text-sm font-medium hover:underline">Réinitialiser les filtres</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {dishGroups.map(group => {
              const isTrending = group.items.some(i => i.isPopular);
              const dishLocation = getDishLocationSummary(group.items);
              const visibleTags = [
                ...activeDietary.filter((tag) => group.tags.includes(tag)),
                ...group.tags.filter((tag) => !activeDietary.includes(tag)),
              ].slice(0, 2);
              return (
                <Link
                  key={group.key}
                  to={`/plat/${dishSlug(group.displayName)}`}
                  className="group text-left bg-white rounded-2xl border border-border-custom shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-250"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-bg-secondary">
                    {group.bestImage ? (
                      <img
                        src={group.bestImage}
                        alt={group.displayName}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-6 h-6 text-text-muted" /></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
                    {isTrending && (
                      <span className="absolute top-2 left-2 flex items-center gap-1 bg-gold-accent text-white text-[10px] font-inter font-bold px-2 py-0.5 rounded-full shadow-sm">
                        <Flame className="w-3 h-3" />Tendance
                      </span>
                    )}
                    <span className="absolute top-2 right-2 flex items-center gap-0.5 bg-white/90 backdrop-blur-sm text-gold-accent text-[11px] font-inter font-bold px-2 py-0.5 rounded-full shadow-sm">
                      <Star className="w-3 h-3 fill-gold-accent" />{group.avgRating.toFixed(1)}
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="font-inter font-semibold text-white text-sm leading-tight drop-shadow-sm line-clamp-2">{group.displayName}</h3>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-inter font-bold text-green-primary text-sm">
                        {group.minPrice.toLocaleString()}{group.maxPrice > group.minPrice ? '+' : ''} FCFA
                      </span>
                      <span className="flex items-center gap-1 text-text-muted text-xs font-inter shrink-0">
                        <Store className="w-3 h-3" />{group.totalRestaurants}
                      </span>
                    </div>
                    <p className="flex items-center gap-1 text-text-muted text-[11px] font-inter mb-2 min-h-[16px]">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{dishLocation}</span>
                    </p>
                    {group.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {visibleTags.map(tag => (
                          <span key={tag} className="text-[10px] font-inter font-medium px-1.5 py-0.5 rounded bg-bg-secondary text-text-secondary truncate max-w-full">{dietaryLabel(tag)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
