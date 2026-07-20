import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  SlidersHorizontal, Star, ArrowUpDown, X, Leaf, Beef, Wheat,
  Coffee, Apple, Clock, Store, Flame, ImageOff, MapPin, Heart,
  Send, UserRound, Plus, Minus, Check, Navigation, Loader2,
} from 'lucide-react';
import type { Restaurant } from '../data/mockData';
import { menuItems as mockMenuItems } from '../data/mockData';
import { useFavoriteDishes } from '../hooks/useFavoriteDishes';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { activeCities, getNeighborhoodCoords } from '../data/locations';
import { haversineDistance } from '../lib/utils';
import {
  inferDietaryTags,
  buildEnrichedItems,
  groupDishes,
  dishSlug,
  DIETARY_TAG_META,
  type EnrichedItem,
} from '../lib/dishes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { useTranslation } from "react-i18next";

// Vue « Plats » de la recherche unifiée (LOT-13 / CONF-33).
// Extraite de l'ancienne page ExplorerMet : la recherche texte, la ville et le
// quartier sont désormais partagés avec le mode « Restaurants » et arrivent en
// props ; tout le reste (filtres diététiques, quick order, mode « pour
// quelqu'un d'autre », géolocalisation) vit ici.

type SortBy = 'popular' | 'rating' | 'priceAsc' | 'priceDesc' | 'newest';
type QuickFilter = 'all' | 'boissons' | 'grillades' | 'plats' | 'desserts' | 'new';
type OrderMode = 'self' | 'other';

const EXPLORER_MODE_KEY = 'yamo_explorer_mode';
const SEARCH_PATH = '/restaurants?mode=plats';

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

interface DishResultsProps {
  restaurants: Restaurant[];
  query: string;
  city: string;
  neighborhood: string;
  /** true si le deep-link portait déjà une ville explicite (?ville=) — dans ce cas on ne géolocalise pas au montage */
  hasExplicitLocation: boolean;
  onLocationChange: (city: string, neighborhood: string) => void;
}

export default function DishResults({ restaurants, query, city, neighborhood, hasExplicitLocation, onLocationChange }: DishResultsProps) {
    const { t } = useTranslation();
  const { favoriteDishes, toggleFavoriteDish } = useFavoriteDishes();
  const { user } = useAuth();
  const { items: cartItems, addToCart, removeFromCart, replaceCartWith } = useCart();
  const navigate = useNavigate();

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [activeDietary, setActiveDietary] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('popular');
  const allItems = useMemo(() => buildEnrichedItems(mockMenuItems, restaurants), [restaurants]);

  // Mode commande : pour soi ou pour quelqu'un d'autre
  const [orderMode, setOrderMode] = useState<OrderMode>(() => {
    const saved = localStorage.getItem(EXPLORER_MODE_KEY);
    return saved === 'other' ? 'other' : 'self';
  });

  const userCity = user?.city?.trim() ?? '';

  // ── Géolocalisation automatique (mode "Pour moi") ──
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(false);

  /** Trouve la ville/quartier le plus proche des coordonnées GPS */
  const matchLocation = (lat: number, lng: number): { city: string; neighborhood: string } | null => {
    let bestDist = Infinity;
    let bestCity = '';
    let bestNeighborhood = '';

    const knownCoords: { name: string; city: string; lat: number; lng: number }[] = [];
    for (const c of activeCities) {
      for (const nb of c.neighborhoods) {
        const coords = getNeighborhoodCoords(nb);
        if (coords) knownCoords.push({ name: nb, city: c.name, ...coords });
      }
      const cityCoords = getNeighborhoodCoords(c.name);
      if (cityCoords) knownCoords.push({ name: '', city: c.name, ...cityCoords });
    }

    for (const loc of knownCoords) {
      const dist = haversineDistance(lat, lng, loc.lat, loc.lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestCity = loc.city;
        bestNeighborhood = loc.name;
      }
    }

    // Seuil : si le point le plus proche est à plus de 30 km, on ne fait pas confiance
    if (bestDist > 30 || !bestCity) return null;
    return { city: bestCity, neighborhood: bestNeighborhood || '' };
  };

  const triggerGeolocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const match = matchLocation(pos.coords.latitude, pos.coords.longitude);
        if (match) onLocationChange(match.city, ''); // Seule la ville, pas le quartier → tous les restaurants de la ville
        setGeoLoading(false);
      },
      () => {
        setGeoError(true);
        setGeoLoading(false);
      },
      { timeout: 8000, maximumAge: 300000 } // cache 5 min
    );
  };

  const handleModeChange = (mode: OrderMode) => {
    setOrderMode(mode);
    localStorage.setItem(EXPLORER_MODE_KEY, mode);
    if (mode === 'self') {
      // Revenir à la ville de l'utilisateur, puis tenter la géolocalisation
      if (userCity) onLocationChange(userCity, '');
      triggerGeolocation();
    }
  };

  // Au montage : en mode « Pour moi » sans ville explicite dans l'URL,
  // pré-remplir avec la ville du profil puis tenter la géolocalisation.
  // Différé d'un tick : la géolocalisation est un système externe et ne doit
  // pas déclencher de setState synchrone dans le corps de l'effet.
  useEffect(() => {
    if (orderMode !== 'self' || hasExplicitLocation) return;
    const t = setTimeout(() => {
      if (userCity) onLocationChange(userCity, '');
      triggerGeolocation();
    }, 0);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Quick Order — commande rapide
  const [quickOrderItem, setQuickOrderItem] = useState<EnrichedItem | null>(null);
  const [restaurantPickerGroup, setRestaurantPickerGroup] = useState<ReturnType<typeof groupDishes>[number] | null>(null);

  // IDs des plats déjà dans le panier (pour l'état toggle)
  const cartItemIds = useMemo(() => new Set(cartItems.map(ci => ci.item.id)), [cartItems]);

  const locationItems = useMemo(() => allItems.filter((item) => {
    if (city && item.restaurantCity !== city) return false;
    if (neighborhood && item.restaurantNeighborhood !== neighborhood) return false;
    return true;
  }), [allItems, city, neighborhood]);

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

  // Badge « Tendance » mérité : top ~20 % des plats réellement commandés
  // (commandes locales) ; repli sur isPopular (plafonné) sans historique.
  // Un badge présent sur presque tous les plats ne signale plus rien.
  const trendingKeys = useMemo(() => {
    const cap = Math.max(1, Math.ceil(dishGroups.length * 0.2));
    try {
      const orders = JSON.parse(localStorage.getItem('yamo_local_orders') ?? '[]') as { items?: { baseItemId?: string; quantity?: number }[] }[];
      const countByItemId: Record<string, number> = {};
      for (const order of orders) {
        for (const line of order.items ?? []) {
          if (line.baseItemId) countByItemId[line.baseItemId] = (countByItemId[line.baseItemId] ?? 0) + (line.quantity ?? 1);
        }
      }
      const scored = dishGroups
        .map((g) => ({ key: g.key, score: g.items.reduce((sum, i) => sum + (countByItemId[i.id] ?? 0), 0) }))
        .filter((s) => s.score > 0);
      if (scored.length > 0) {
        return new Set(scored.sort((a, b) => b.score - a.score).slice(0, cap).map((s) => s.key));
      }
    } catch { /* localStorage illisible — repli isPopular ci-dessous */ }
    return new Set(
      dishGroups
        .filter((g) => g.items.some((i) => i.isPopular))
        .sort((a, b) => b.avgRating - a.avgRating)
        .slice(0, cap)
        .map((g) => g.key)
    );
  }, [dishGroups]);

  // ── Quick Order : ajout direct (même ville, resto unique) ──
  const handleQuickAdd = (e: React.MouseEvent, item: EnrichedItem) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/connexion', { state: { from: SEARCH_PATH } });
      return;
    }

    // Mode "Pour quelqu'un d'autre" → toujours rediriger vers demande
    if (orderMode === 'other') {
      redirectToFoodRequest(item);
      return;
    }

    const uCity = user.city?.trim();
    const restoCity = item.restaurantCity?.trim();

    // Ville différente → modale "commande pour autrui"
    if (uCity && restoCity && uCity !== restoCity) {
      setQuickOrderItem(item);
      return;
    }

    // Même ville (ou user sans ville) → ajout direct
    const result = addToCart(item);
    if (result === 'conflict') {
      setQuickOrderItem(item);
    } else {
      toast.success(`${item.name} ajouté`, {
        description: item.restaurantName,
        action: { label: 'Panier', onClick: () => navigate('/checkout') },
      });
    }
  };

  // ── Retirer du panier (toggle) ──
  const handleQuickRemove = (e: React.MouseEvent, itemId: string, itemName: string) => {
    e.preventDefault();
    e.stopPropagation();
    removeFromCart(itemId);
    toast.success(`${itemName} retiré du panier`);
  };

  // ── Ouvrir le sélecteur de restaurant ──
  const handleOpenRestaurantPicker = (e: React.MouseEvent, group: typeof dishGroups[number]) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/connexion', { state: { from: SEARCH_PATH } });
      return;
    }
    // Mode "Pour quelqu'un d'autre" : si un seul resto, rediriger directement
    if (orderMode === 'other' && group.items.length === 1) {
      redirectToFoodRequest(group.items[0]);
      return;
    }
    setRestaurantPickerGroup(group);
  };

  // ── Ajouter depuis le sélecteur de restaurant ──
  const handlePickRestaurant = (item: EnrichedItem) => {
    setRestaurantPickerGroup(null);

    if (orderMode === 'other') {
      redirectToFoodRequest(item);
      return;
    }

    const uCity = user?.city?.trim();
    const restoCity = item.restaurantCity?.trim();
    if (uCity && restoCity && uCity !== restoCity) {
      setQuickOrderItem(item);
      return;
    }
    const result = addToCart(item);
    if (result === 'conflict') {
      setQuickOrderItem(item);
    } else {
      toast.success(`${item.name} ajouté`, {
        description: item.restaurantName,
        action: { label: 'Panier', onClick: () => navigate('/checkout') },
      });
    }
  };

  // ── Rediriger vers demande sur mesure (mode "pour autrui") ──
  const redirectToFoodRequest = (item: EnrichedItem) => {
    const params = new URLSearchParams();
    params.set('plat', item.name);
    params.set('ville', item.restaurantCity);
    if (item.restaurantName) params.set('restaurant', item.restaurantName);
    navigate(`/demandes/nouvelle?${params.toString()}`);
  };

  const handleReplaceCart = () => {
    if (!quickOrderItem) return;
    replaceCartWith(quickOrderItem);
    setQuickOrderItem(null);
    toast.success(`${quickOrderItem.name} ajouté au panier`, {
      description: `Depuis ${quickOrderItem.restaurantName} (panier remplacé)`,
      action: { label: 'Voir', onClick: () => navigate('/checkout') },
    });
  };

  const handleOrderForOther = () => {
    if (!quickOrderItem) return;
    const params = new URLSearchParams();
    params.set('plat', quickOrderItem.name);
    params.set('ville', quickOrderItem.restaurantCity);
    if (quickOrderItem.restaurantName) params.set('restaurant', quickOrderItem.restaurantName);
    setQuickOrderItem(null);
    navigate(`/demandes/nouvelle?${params.toString()}`);
  };

  const orderItemCity = quickOrderItem?.restaurantCity ?? '';
  const isDifferentCity = Boolean(userCity && orderItemCity && userCity !== orderItemCity);

  // Restaurant déjà présent dans le panier (conflit) — pour permettre d'y
  // retourner poursuivre ses achats plutôt que de le remplacer.
  const cartRestaurantId = cartItems[0]?.item.restaurantId ?? null;
  const cartRestaurant = cartRestaurantId ? restaurants.find((r) => r.id === cartRestaurantId) : null;

  // « Nouveautés » retiré : sans date d'ajout sur les plats, le filtre était
  // identique à « Tous » (même compte) — un onglet sans signal trompe l'œil.
  const quickFilters: { id: QuickFilter; label: string; icon?: typeof Clock; count: number }[] = [
    { id: 'all', label: 'Tous', count: locationItems.length },
    { id: 'plats', label: 'Plats', count: locationItems.filter(i => i.category === 'Plats Principaux').length },
    { id: 'grillades', label: 'Grillades', count: locationItems.filter(i => i.category === 'Grillades').length },
    { id: 'boissons', label: 'Boissons', count: locationItems.filter(i => i.category === 'Boissons').length },
    { id: 'desserts', label: 'Desserts', count: locationItems.filter(i => i.category === 'Desserts' || i.category === 'Patisseries' || i.category === 'Pâtisseries').length },
  ];

  const restaurantsCount = new Set(locationItems.map(i => i.restaurantId)).size;

  return (
    <>
      {/* ── Mode commande + filtres ── */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 mt-6 space-y-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-inter font-semibold text-text-muted uppercase tracking-wider mr-1 shrink-0">
            {t("Je commande")}
          </span>
          <div className="flex bg-white border border-border-custom rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => handleModeChange('self')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-all ${orderMode === 'self'
                ? 'bg-green-light text-green-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
                }`}
            >
              <UserRound className="w-3.5 h-3.5" />
              {t("Pour moi")}
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('other')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-all ${orderMode === 'other'
                ? 'bg-green-light text-green-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
                }`}
            >
              <Send className="w-3.5 h-3.5" />
              {t("Pour quelqu'un")}
            </button>
          </div>
          {orderMode === 'other' && (
            <span className="text-[10px] font-inter text-text-muted">
              {t("Sélectionnez la ville du destinataire ci-dessus")}
            </span>
          )}
          {orderMode === 'self' && (
            <button
              type="button"
              onClick={triggerGeolocation}
              disabled={geoLoading}
              title="Me localiser automatiquement"
              className={`h-8 px-3 rounded-lg border flex items-center gap-1.5 text-xs font-inter font-medium shrink-0 transition-all ${geoError
                ? 'border-amber-200 bg-amber-50 text-amber-600 hover:border-amber-400'
                : 'border-border-custom bg-white text-text-muted hover:text-green-primary hover:border-green-primary'
                }`}
            >
              {geoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
              {t("Me localiser")}
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {quickFilters.map(f => (<button key={f.id} onClick={() => setQuickFilter(f.id)} className={`shrink-0 h-9 px-4 rounded-full text-sm font-inter font-semibold transition-colors flex items-center gap-1.5 ${quickFilter === f.id ? 'bg-green-primary text-white shadow-sm' : 'bg-white border border-border-custom text-text-secondary hover:text-text-primary'}`}>{f.icon && <f.icon className="w-3.5 h-3.5" />}{f.label} ({f.count})</button>))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {DIETARY_FILTERS.map(f => { const Icon = f.icon; const active = activeDietary.includes(f.id); return (<button key={f.id} onClick={() => toggleDietary(f.id)} className={`shrink-0 h-9 px-3 rounded-full text-xs font-inter font-semibold border transition-colors flex items-center gap-1.5 ${active ? 'bg-green-primary text-white border-green-primary' : 'bg-white border-border-custom text-text-secondary hover:text-text-primary'}`}><Icon className="w-3.5 h-3.5" />{f.label}</button>); })}
          {activeDietary.length > 0 && (<button onClick={() => setActiveDietary([])} className="shrink-0 h-9 px-3 rounded-full text-xs font-inter font-medium text-error border border-error/30 hover:bg-error/5 flex items-center gap-1"><X className="w-3 h-3" />{t("Effacer")}</button>)}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-xs font-inter">
            {dishGroups.length} {t("plat")}{dishGroups.length !== 1 ? 's' : ''} · {restaurantsCount} {t("restaurant")}{restaurantsCount !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5 bg-white rounded-lg border border-border-custom px-3 h-9">
            <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)} className="bg-transparent text-xs font-inter font-semibold text-text-secondary outline-none">
              <option value="popular">{t("Populaires")}</option><option value="rating">{t("Mieux notés")}</option><option value="priceAsc">{t("Prix croissant")}</option><option value="priceDesc">{t("Prix décroissant")}</option><option value="newest">{t("Nouveautés")}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pb-12">
        {dishGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-12 text-center">
            <SlidersHorizontal className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-secondary font-inter font-medium text-lg mb-1">{t("Aucun plat trouvé")}</p>
            <p className="text-text-muted text-sm font-inter mb-4">{t("Essayez d'autres filtres ou élargissez votre recherche.")}</p>
            <button onClick={() => { setQuickFilter('all'); setActiveDietary([]); onLocationChange('Douala', ''); }} className="text-green-primary font-inter text-sm font-medium hover:underline">{t("Réinitialiser les filtres")}</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {dishGroups.map(group => {
                const { t } = useTranslation();
              const isTrending = trendingKeys.has(group.key);
              const dishLocation = getDishLocationSummary(group.items);
              const visibleTags = [
                ...activeDietary.filter((tag) => group.tags.includes(tag)),
                ...group.tags.filter((tag) => !activeDietary.includes(tag)),
              ].slice(0, 2);
              return (
                <Link
                  key={group.key}
                  to={`/plat/${dishSlug(group.displayName)}`}
                  className="group text-left bg-white rounded-2xl border border-border-custom shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-bg-secondary">
                    {group.bestImage ? (
                      <img
                        src={group.bestImage}
                        alt={group.displayName}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-6 h-6 text-text-muted" /></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
                    {isTrending && (
                      <span className="absolute top-2 left-2 flex items-center gap-1 bg-gold-accent text-white text-[10px] font-inter font-bold px-2 py-0.5 rounded-full shadow-sm">
                        <Flame className="w-3 h-3" />{t("Tendance")}
                      </span>
                    )}
                    {/* Pile verticale : sur carte étroite (2 col à 360px), une rangée
                        horizontale chevauchait le badge « Tendance » posé à gauche. */}
                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); toggleFavoriteDish(group.key); }}
                        aria-label="Ajouter aux favoris"
                        className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm shrink-0"
                      >
                        <Heart className={`w-4 h-4 ${favoriteDishes.has(group.key) ? 'fill-error text-error' : 'text-text-secondary'}`} />
                      </button>
                      <span className="flex items-center gap-0.5 bg-white/90 backdrop-blur-sm text-amber-700 text-[11px] font-inter font-bold px-2 py-0.5 rounded-full shadow-sm">
                        <Star className="w-3 h-3 fill-gold-accent" />{group.avgRating.toFixed(1)}
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="font-inter font-semibold text-white text-sm leading-tight drop-shadow-sm line-clamp-2">{group.displayName}</h3>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-inter font-bold text-green-primary text-sm">
                        {group.minPrice.toLocaleString()}{group.maxPrice > group.minPrice ? '+' : ''} {t("FCFA")}
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
                      <div className="flex flex-wrap gap-1 mb-2">
                        {visibleTags.map(tag => (
                          <span key={tag} className="text-[10px] font-inter font-medium px-1.5 py-0.5 rounded bg-bg-secondary text-text-secondary truncate max-w-full">{dietaryLabel(tag)}</span>
                        ))}
                      </div>
                    )}

                    {/* ── Quick Order : discret, premium ── */}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-[10px] font-inter text-text-muted">
                        {group.totalRestaurants > 1 ? `${group.totalRestaurants} restaurants` : ''}
                      </span>

                      {(() => {
                                  const { t } = useTranslation();
                        // Vérifier si un item de ce groupe est déjà dans le panier
                        const inCartItem = group.items.find(i => cartItemIds.has(i.id));
                        if (inCartItem) {
                          return (
                            <button
                              type="button"
                              onClick={(e) => handleQuickRemove(e, inCartItem.id, inCartItem.name)}
                              className="group/remove flex items-center gap-1 h-7 px-2.5 rounded-full border border-green-primary/30 bg-green-light/60 text-green-primary text-[11px] font-inter font-medium hover:bg-error/10 hover:text-error hover:border-error/30 transition-all"
                            >
                              <Check className="w-3 h-3 group-hover/remove:hidden" />
                              <Minus className="w-3 h-3 hidden group-hover/remove:block" />
                              <span className="group-hover/remove:hidden">{t("Ajouté")}</span>
                              <span className="hidden group-hover/remove:block">{t("Retirer")}</span>
                            </button>
                          );
                        }

                        // Plat dispo dans un seul resto → ajout direct
                        if (group.items.length === 1) {
                          const singleItem = group.items[0];
                          return (
                            <button
                              type="button"
                              onClick={(e) => handleQuickAdd(e, singleItem)}
                              className="group/add flex items-center justify-center w-10 h-10 rounded-full border border-border-custom text-text-muted hover:text-green-primary hover:border-green-primary hover:bg-green-light/30 transition-all"
                              title={`Ajouter ${singleItem.name} — ${singleItem.restaurantName}`}
                            >
                              <Plus className="w-3.5 h-3.5 group-hover/add:scale-110 transition-transform" />
                            </button>
                          );
                        }

                        // Plusieurs restos → sélecteur
                        return (
                          <Popover open={restaurantPickerGroup?.key === group.key} onOpenChange={(open) => { if (!open) setRestaurantPickerGroup(null); }}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => handleOpenRestaurantPicker(e, group)}
                                className="group/add flex items-center justify-center w-10 h-10 rounded-full border border-border-custom text-text-muted hover:text-green-primary hover:border-green-primary hover:bg-green-light/30 transition-all"
                                title={`${group.totalRestaurants} restaurants — choisir`}
                              >
                                <Plus className="w-3.5 h-3.5 group-hover/add:scale-110 transition-transform" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              side="top"
                              align="end"
                              className="w-60 p-2 shadow-lg border-border-custom rounded-xl"
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              <p className="text-[10px] font-inter font-semibold text-text-muted uppercase tracking-wider px-2 pb-1.5 pt-0.5">
                                {t("Choisir un restaurant")}
                              </p>
                              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                                {group.items
                                  .sort((a, b) => a.price - b.price)
                                  .map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handlePickRestaurant(item);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-bg-secondary transition-colors text-left"
                                    >
                                      <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                                        {item.image ? (
                                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <Store className="w-3.5 h-3.5 text-text-muted" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-inter font-medium text-text-primary truncate">
                                          {item.restaurantName}
                                        </p>
                                        <p className="text-[10px] font-inter text-text-muted flex items-center gap-1">
                                          <MapPin className="w-2.5 h-2.5" />
                                          {item.restaurantNeighborhood || item.restaurantCity}
                                        </p>
                                      </div>
                                      <span className="text-xs font-inter font-bold text-green-primary shrink-0">
                                        {item.price.toLocaleString()} {t("FCFA")}
                                      </span>
                                    </button>
                                  ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      })()}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Quick Order Modal (conflit panier ou ville différente) ── */}
        <Dialog open={!!quickOrderItem} onOpenChange={(open) => { if (!open) setQuickOrderItem(null); }}>
          <DialogContent className="sm:max-w-[440px] max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-poppins text-lg">
                {isDifferentCity ? 'Restaurant dans une autre ville' : 'Changer de restaurant ?'}
              </DialogTitle>
              <DialogDescription className="text-sm font-inter">
                {quickOrderItem && (
                  <span>
                    <strong>{quickOrderItem.name}</strong> — {quickOrderItem.restaurantName}
                    {quickOrderItem.restaurantCity && <> · 📍 {quickOrderItem.restaurantCity}</>}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            {isDifferentCity ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-inter text-amber-800">
                    {t("🚫 Vous êtes à")} <strong>{userCity}</strong>{t(", mais ce restaurant est à")} <strong>{orderItemCity}</strong>{t(".\n                    La livraison n'est pas possible dans votre ville.")}
                  </p>
                </div>
                <div className="p-3 bg-green-light border border-green-primary/20 rounded-lg">
                  <p className="text-sm font-inter text-green-primary font-medium mb-2">
                    {t("💡 Vous pouvez commander ce plat pour quelqu'un d'autre à")} {orderItemCity} !
                  </p>
                  <p className="text-xs font-inter text-text-secondary">
                    {t("Créez une demande sur mesure — un restaurant à")} {orderItemCity} {t("préparera et livrera le plat au destinataire de votre choix.")}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setQuickOrderItem(null)}
                    className="flex-1 h-10 rounded-lg border border-border-custom text-text-secondary font-inter text-sm font-medium hover:bg-bg-secondary transition-colors"
                  >
                    {t("Annuler")}
                  </button>
                  <button
                    onClick={handleOrderForOther}
                    className="flex-1 h-10 rounded-lg bg-green-primary text-white font-inter text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-green-dark transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    {t("Commander pour autrui")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-inter text-amber-800">
                    {t("Votre panier contient déjà des plats d'un autre restaurant.")}
                  </p>
                  {cartRestaurant && (
                    <p className="text-sm font-inter text-amber-800 mt-1">
                      {t("Vous pouvez")}{' '}
                      <Link
                        to={`/restaurant/${cartRestaurant.slug || cartRestaurant.id}`}
                        onClick={() => setQuickOrderItem(null)}
                        className="font-semibold underline hover:text-amber-900"
                      >
                        {t("continuer vos achats chez")} {cartRestaurant.name}
                      </Link>
                      .
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setQuickOrderItem(null)}
                    className="flex-1 h-10 rounded-lg border border-border-custom text-text-secondary font-inter text-sm font-medium hover:bg-bg-secondary transition-colors"
                  >
                    {t("Annuler")}
                  </button>
                  <button
                    onClick={handleReplaceCart}
                    className="flex-1 h-10 rounded-lg bg-green-primary text-white font-inter text-sm font-semibold hover:bg-green-dark transition-colors"
                  >
                    {t("Remplacer le panier")}
                  </button>
                </div>
              </div>
            )}

            <DialogFooter className="text-xs text-text-muted font-inter">
              {isDifferentCity
                ? 'Vous pourrez préciser le nom et le téléphone du destinataire.'
                : 'Le panier ne peut contenir qu\'un seul restaurant à la fois — pour commander dans plusieurs restaurants, passez plusieurs commandes séparées.'}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
