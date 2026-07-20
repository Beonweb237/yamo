import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Store, ChefHat, Star, ImageOff } from 'lucide-react';
import { useRestaurants } from '../hooks/useCatalog';
import { useFavorites } from '../hooks/useFavorites';
import { useFavoriteDishes } from '../hooks/useFavoriteDishes';
import { menuItems as mockMenuItems } from '../data/mockData';
import { buildEnrichedItems, groupDishes, dishSlug } from '../lib/dishes';
import AppImage from '../components/AppImage';
import PageHeader from '../components/PageHeader';
import { useTranslation } from "react-i18next";

type Tab = 'restaurants' | 'plats';

export default function Favorites() {
    const { t } = useTranslation();
  const { restaurants } = useRestaurants();
  const { favorites, toggleFavorite } = useFavorites();
  const { favoriteDishes, toggleFavoriteDish } = useFavoriteDishes();
  const [tab, setTab] = useState<Tab>('restaurants');

  const favoriteRestaurants = useMemo(
    () => restaurants.filter((r) => favorites.has(r.id)),
    [restaurants, favorites]
  );

  const favoriteDishGroups = useMemo(() => {
    const allItems = buildEnrichedItems(mockMenuItems, restaurants);
    const groups = groupDishes(allItems.filter((i) => i.isAvailable !== false));
    return groups.filter((g) => favoriteDishes.has(g.key));
  }, [restaurants, favoriteDishes]);

  const tabs: { id: Tab; label: string; icon: typeof Store; count: number }[] = [
    { id: 'restaurants', label: 'Restaurants', icon: Store, count: favoriteRestaurants.length },
    { id: 'plats', label: 'Plats', icon: ChefHat, count: favoriteDishGroups.length },
  ];

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 sm:py-8">
        <PageHeader
          icon={Heart}
          title="Mes favoris"
          subtitle={`${favoriteRestaurants.length + favoriteDishGroups.length} favori${favoriteRestaurants.length + favoriteDishGroups.length !== 1 ? 's' : ''} enregistré${favoriteRestaurants.length + favoriteDishGroups.length !== 1 ? 's' : ''}`}
        />

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-border-custom p-1 w-fit max-w-full overflow-x-auto scrollbar-hide shadow-sm mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-inter font-medium transition-colors ${tab === t.id ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              <t.icon className="w-4 h-4" />{t.label}
              <span className={`text-xs rounded-full px-1.5 ${tab === t.id ? 'bg-white/20' : 'bg-bg-secondary'}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Restaurants tab */}
        {tab === 'restaurants' && (
          favoriteRestaurants.length === 0 ? (
            <EmptyState
              icon={Store}
              text="Aucun restaurant favori pour le moment."
              cta={{ label: 'Découvrir les restaurants', to: '/restaurants' }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {favoriteRestaurants.map((resto) => (
                <Link
                  key={resto.id}
                  to={`/restaurant/${resto.slug || resto.id}`}
                  className="block bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)] hover:-translate-y-1 transition-all duration-200 group"
                >
                  <div className="aspect-[16/10] overflow-hidden relative">
                    <AppImage
                      src={resto.image}
                      alt={resto.name}
                      fallbackLabel={resto.category}
                      className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-300"
                    />
                    <button
                      onClick={(e) => { e.preventDefault(); toggleFavorite(resto.id); }}
                      aria-label="Retirer des favoris"
                      className="absolute top-3 right-3 w-11 h-11 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
                    >
                      <Heart className="w-4 h-4 fill-error text-error" />
                    </button>
                    {resto.isPremium && (
                      <span className="absolute top-3 left-3 bg-green-primary text-white text-[11px] font-inter font-semibold px-2.5 py-1 rounded-full">
                        {t("Premium")}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-inter font-semibold text-text-primary text-sm truncate">{resto.name}</h3>
                      <span className="flex items-center gap-0.5 text-xs text-amber-700 shrink-0">
                        <Star className="w-3.5 h-3.5 fill-gold-accent" />{resto.rating}
                      </span>
                    </div>
                    <p className="text-text-muted text-xs font-inter">{resto.category} · {resto.neighborhood}, {resto.city}</p>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Plats tab */}
        {tab === 'plats' && (
          favoriteDishGroups.length === 0 ? (
            <EmptyState
              icon={ChefHat}
              text="Aucun plat favori pour le moment."
              cta={{ label: 'Explorer les plats', to: '/restaurants?mode=plats' }}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {favoriteDishGroups.map((group) => (
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
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-6 h-6 text-text-muted" /></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); toggleFavoriteDish(group.key); }}
                      aria-label="Retirer des favoris"
                      className="absolute top-2 right-2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                    >
                      <Heart className="w-3.5 h-3.5 fill-error text-error" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="font-inter font-semibold text-white text-sm leading-tight drop-shadow-sm line-clamp-2">{group.displayName}</h3>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-inter font-bold text-green-primary text-sm">
                        {group.minPrice.toLocaleString()}{group.maxPrice > group.minPrice ? '+' : ''} {t("FCFA")}
                      </span>
                      <span className="flex items-center gap-1 text-text-muted text-xs font-inter shrink-0">
                        <Store className="w-3 h-3" />{group.totalRestaurants}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, text, cta }: { icon: typeof Store; text: string; cta: { label: string; to: string } }) {
  return (
    <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-10 sm:p-14 text-center">
      <div className="w-14 h-14 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-3">
        <Icon className="w-7 h-7 text-text-muted" />
      </div>
      <p className="text-text-secondary font-inter font-medium mb-3">{text}</p>
      <Link to={cta.to} className="text-green-primary font-inter text-sm font-medium hover:underline">
        {cta.label}
      </Link>
    </div>
  );
}
