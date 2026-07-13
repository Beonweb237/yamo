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
} from 'lucide-react';
import { cuisineCategories } from '../data/mockData';
import { activeCities, getNeighborhoods } from '../data/locations';
import { useRestaurants } from '../hooks/useCatalog';
import AppImage from '../components/AppImage';

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

export default function Restaurants() {
  const { restaurants } = useRestaurants();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') ?? 'Tous');
  const [selectedCity, setSelectedCity] = useState(searchParams.get('ville') ?? 'Douala');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(searchParams.get('quartier') ?? '');
  const [sortBy, setSortBy] = useState('relevance');
  const [showSort, setShowSort] = useState(false);
  const [showCityMenu, setShowCityMenu] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const neighborhoods = getNeighborhoods(selectedCity);

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

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
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

    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
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
  }, [restaurants, searchQuery, activeCategory, selectedCity, selectedNeighborhood, sortBy]);

  const handleSearch = () => {
    syncParams({ q: searchQuery, category: activeCategory, ville: selectedCity, quartier: selectedNeighborhood });
  };

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
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
            <span className="text-white">Restaurants</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="font-poppins font-semibold text-white text-3xl sm:text-4xl lg:text-[38px]/[1.18] tracking-normal mb-3"
          >
            Trouvez Votre Restaurant Idéal
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-white/75 font-inter text-base max-w-[600px]"
          >
            Plus de 500 restaurants partenaires dans les grandes villes du Cameroun
          </motion.p>
        </div>
      </section>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 -mt-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 flex-1 bg-bg-secondary rounded-lg px-3 h-12">
              <Search className="w-4 h-4 text-text-muted shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Rechercher un restaurant, une cuisine..."
                className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCityMenu(!showCityMenu)}
                  className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12"
                >
                  <MapPin className="w-4 h-4 text-text-muted" />
                  <div className="text-left">
                    <span className="text-[10px] text-text-muted font-inter block leading-none">Ville</span>
                    <span className="text-sm text-text-primary font-inter font-medium">{selectedCity}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-text-muted" />
                </button>
                {showCityMenu && (
                  <div className="absolute top-full left-0 mt-2 bg-white border border-border-custom rounded-lg shadow-lg py-1 z-30 min-w-[160px]">
                    {activeCities.map((city) => (
                      <button
                        key={city.id}
                        type="button"
                        onClick={() => {
                          setSelectedCity(city.name);
                          setSelectedNeighborhood('');
                          setShowCityMenu(false);
                        }}
                        className={`block w-full text-left px-4 py-2 text-sm font-inter transition-colors ${selectedCity === city.name
                            ? 'text-green-primary bg-green-light'
                            : 'text-text-secondary hover:bg-bg-secondary'
                          }`}
                      >
                        {city.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                <SlidersHorizontal className="w-4 h-4 text-text-muted" />
                <div>
                  <span className="text-[10px] text-text-muted font-inter block leading-none">Quartier</span>
                  <select
                    value={selectedNeighborhood}
                    onChange={(e) => setSelectedNeighborhood(e.target.value)}
                    className="text-sm text-text-primary font-inter font-medium bg-transparent outline-none"
                  >
                    <option value="">Tous</option>
                    {neighborhoods.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSearch}
                className="flex-1 sm:flex-none bg-green-primary text-white font-inter font-medium text-sm h-12 px-6 rounded-lg hover:bg-green-dark transition-colors"
              >
                Rechercher
              </button>
            </div>
          </div>
        </motion.div>
      </div>

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
              <div className="flex items-center justify-between mb-6">
                <span className="text-text-secondary font-inter text-sm">
                  {filtered.length} restaurants trouvés
                  {selectedNeighborhood ? ` à ${selectedNeighborhood}` : ` à ${selectedCity}`}
                </span>
                <div className="relative">
                  <button
                    onClick={() => setShowSort(!showSort)}
                    className="flex items-center gap-2 text-text-secondary font-inter text-sm hover:text-text-primary"
                  >
                    Trier par : {sortOptions.find((o) => o.value === sortBy)?.label}
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

              {/* Quick filter pills */}
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                {[
                  { label: 'Ouvert maintenant', filter: (r: any) => r.isOpen },
                  { label: 'Livraison gratuite', filter: (r: any) => r.deliveryFee === 0 },
                  { label: '⭐ 4.5+', filter: (r: any) => r.rating >= 4.5 },
                  { label: 'Moins de 30 min', filter: (r: any) => parseInt(r.deliveryTime) < 30 },
                  { label: 'Premium', filter: (r: any) => r.isPremium },
                ].map((pill) => {
                  const isActive = filtered.length < restaurants.length && filtered.every(pill.filter);
                  return (
                    <button
                      key={pill.label}
                      onClick={() => {
                        // Simple toggle: re-filter the existing filtered list
                      }}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-inter font-medium transition-colors ${isActive
                          ? 'bg-green-light text-green-primary'
                          : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                        }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filtered.map((resto, i) => (
                  <motion.div
                    key={resto.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: i * 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <Link
                      to={`/restaurant/${resto.id}`}
                      className="block bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)] hover:-translate-y-1 transition-all duration-250 group"
                    >
                      <div className="aspect-[16/10] overflow-hidden relative">
                        <AppImage
                          src={resto.image}
                          alt={resto.name}
                          fallbackLabel={resto.category}
                          className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-400"
                        />
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            toggleFavorite(resto.id);
                          }}
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
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
                        <h3 className="font-inter font-semibold text-text-primary text-base mb-1">
                          {resto.name}
                        </h3>
                        <p className="text-text-secondary text-xs font-inter mb-3">
                          {resto.tags.join(' • ')}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 bg-gold-light text-gold-accent text-xs font-inter font-medium px-2 py-0.5 rounded-full">
                            <Star className="w-3 h-3 fill-gold-accent" />
                            {resto.rating}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-bg-secondary text-text-secondary text-xs font-inter px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            {resto.deliveryTime}
                          </span>
                          <span className="text-text-secondary text-xs font-inter">
                            {resto.deliveryFee === 0 ? 'Gratuit' : `${resto.deliveryFee} FCFA`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-text-muted font-inter">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {resto.neighborhood}, {resto.city} · {stableDistance(resto.id)} km
                          </span>
                          <span>{resto.priceRange}</span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-text-secondary font-inter text-lg">
                    Aucun restaurant ne correspond à votre recherche.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setActiveCategory('Tous');
                      setSelectedCity('Douala');
                      setSelectedNeighborhood('');
                      setSearchParams({}, { replace: true });
                    }}
                    className="mt-4 text-green-primary font-inter text-sm font-medium hover:underline"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              )}
            </div>

            <div className="hidden lg:block w-[380px] shrink-0">
              <div className="sticky top-[140px] h-[calc(100vh-160px)] bg-bg-secondary rounded-xl border border-border-custom overflow-hidden">
                <div className="h-full flex flex-col items-center justify-center relative bg-[#f0f0f0]">
                  <div className="absolute inset-0 opacity-30">
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d0d0d0" strokeWidth="0.5" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                      <line x1="0" y1="30%" x2="100%" y2="30%" stroke="#e0e0e0" strokeWidth="8" />
                      <line x1="0" y1="60%" x2="100%" y2="60%" stroke="#e0e0e0" strokeWidth="6" />
                      <line x1="25%" y1="0" x2="25%" y2="100%" stroke="#e0e0e0" strokeWidth="6" />
                      <line x1="70%" y1="0" x2="70%" y2="100%" stroke="#e0e0e0" strokeWidth="8" />
                    </svg>
                  </div>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="relative z-10"
                  >
                    <MapPin className="w-12 h-12 text-green-primary" />
                  </motion.div>
                  <p className="relative z-10 text-text-secondary text-sm font-inter mt-4 text-center px-6">
                    {filtered.length} restaurant{filtered.length !== 1 ? 's' : ''} à {selectedCity}
                    {selectedNeighborhood ? ` — ${selectedNeighborhood}` : ''}
                  </p>
                  {filtered.slice(0, 5).map((resto, i) => (
                    <div
                      key={resto.id}
                      className="absolute z-10 w-5 h-5 rounded-full bg-green-primary text-white text-[10px] font-bold flex items-center justify-center shadow-md"
                      style={{
                        top: `${20 + ((i * 17) % 60)}%`,
                        left: `${15 + ((i * 23) % 70)}%`,
                      }}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

