import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Bell, Search, SlidersHorizontal, ChevronRight, Star, Clock, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cuisineCategories } from '../data/mockData';
import { activeCities } from '../data/locations';
import { useRestaurants } from '../hooks/useCatalog';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '../contexts/AuthContext';
import AppImage from '../components/AppImage';
import GlobalSearch from '../components/GlobalSearch';
import { useSeo } from '../hooks/useSeo';

// Template « Premium » de l'accueil (maquette validée, identité MiamExpress vert/or).
// En-tête personnalisé + recherche + catégories + restaurants populaires — données RÉELLES.
// Promos (CP5) et « Commander à nouveau » (CP4) sont ajoutés ensuite : masqués tant que
// le contenu réel n'existe pas (jamais de fausse promo).
export default function HomePremium() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { restaurants, loading } = useRestaurants();
  const { favorites, toggleFavorite } = useFavorites();
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  useSeo({
    title: t('Livraison de repas à Douala et Yaoundé'),
    description: t('Commandez vos plats préférés auprès des meilleurs restaurants de Douala et Yaoundé. Livraison rapide, paiement à la livraison ou Mobile Money.'),
    path: '/',
  });

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const firstName = (user?.name || (typeof localStorage !== 'undefined' ? localStorage.getItem('yamo_profile_name') : '') || '').trim().split(' ')[0];
  const city = activeCities[0]?.name ?? 'Douala';

  const topRestaurants = useMemo(
    () => [...restaurants]
      .sort((a, b) => (b.ratingWeighted ?? b.rating) - (a.ratingWeighted ?? a.rating) || b.reviewCount - a.reviewCount)
      .slice(0, 8),
    [restaurants],
  );

  return (
    <div className="pt-[72px] bg-bg-secondary min-h-[100dvh]">
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pb-24 lg:pb-12">

        {/* En-tête personnalisé */}
        <header className="flex items-start justify-between gap-3 pt-4 pb-4">
          <div className="min-w-0">
            <p className="text-text-muted font-inter text-sm">{t('Bonjour')} 👋</p>
            <p className="font-poppins font-semibold text-text-primary text-xl sm:text-2xl truncate">
              {firstName || t('Bienvenue')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/restaurants"
              className="inline-flex items-center gap-1.5 bg-green-light text-green-dark font-inter text-xs sm:text-sm font-medium px-3 h-9 rounded-full hover:bg-green-primary/15 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              <span className="max-w-[110px] truncate">{city}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/commandes"
              aria-label={t('Mes commandes')}
              className="w-9 h-9 rounded-full bg-white border border-border-custom flex items-center justify-center text-text-primary hover:bg-bg-secondary transition-colors"
            >
              <Bell className="w-[18px] h-[18px]" />
            </Link>
          </div>
        </header>

        {/* Recherche */}
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex-1 flex items-center gap-2 h-12 px-4 rounded-2xl bg-white border border-border-custom text-text-muted font-inter text-sm hover:border-border-light transition-colors"
          >
            <Search className="w-5 h-5 shrink-0" />
            <span className="truncate text-left">{t('Rechercher un restaurant ou un plat')}</span>
          </button>
          <Link
            to="/restaurants"
            aria-label={t('Filtres')}
            className="w-12 h-12 rounded-2xl bg-green-primary text-white flex items-center justify-center hover:bg-green-dark transition-colors shrink-0"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </Link>
        </div>

        {/* Catégories */}
        <section className="mb-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-poppins font-semibold text-text-primary text-lg">{t('Catégories')}</h2>
            <Link to="/restaurants" className="text-gold-accent font-inter text-xs font-medium hover:underline">{t('Voir tout')}</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
            {cuisineCategories.map((cat) => (
              <Link
                key={cat.id}
                to={`/restaurants?category=${encodeURIComponent(cat.name)}`}
                className="flex flex-col items-center gap-2 shrink-0 w-16 group"
              >
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-green-light shadow-sm group-hover:shadow-md transition-shadow">
                  <AppImage src={cat.image} alt={cat.name} fallbackLabel={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                </div>
                <span className="text-text-secondary font-inter text-[11px] text-center leading-tight truncate w-full group-hover:text-green-primary transition-colors">{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Populaires */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-poppins font-semibold text-text-primary text-lg">{t('Populaires')}</h2>
            <Link to="/restaurants" className="text-gold-accent font-inter text-xs font-medium hover:underline">{t('Voir tout')}</Link>
          </div>

          {topRestaurants.length === 0 && loading ? (
            <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-[160px] sm:w-auto shrink-0 rounded-2xl bg-white border border-border-custom overflow-hidden">
                  <div className="h-24 bg-bg-secondary animate-pulse" />
                  <div className="p-3 space-y-2">
                    <div className="h-3.5 w-2/3 bg-bg-secondary rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-bg-secondary rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : topRestaurants.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-border-custom">
              <p className="font-inter text-text-secondary text-sm">{t('Aucun restaurant disponible pour le moment.')}</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
              {topRestaurants.map((resto) => {
                const fav = favorites.has(resto.id);
                return (
                  <div key={resto.id} className="relative w-[160px] sm:w-auto shrink-0 rounded-2xl bg-white border border-border-custom overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow">
                    <Link to={`/restaurant/${resto.slug || resto.id}`} className="block relative">
                      <div className="h-24 sm:h-28 overflow-hidden">
                        <AppImage src={resto.image} alt={resto.name} fallbackLabel={resto.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                      </div>
                      <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-inter font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />{resto.deliveryTime}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(resto.id)}
                      aria-label={fav ? t('Retirer des favoris') : t('Ajouter aux favoris')}
                      aria-pressed={fav}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 flex items-center justify-center shadow-sm hover:scale-105 transition-transform"
                    >
                      <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-green-primary text-green-primary' : 'text-text-muted'}`} />
                    </button>
                    <Link to={`/restaurant/${resto.slug || resto.id}`} className="block p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-inter font-semibold text-text-primary text-sm truncate">{resto.name}</h3>
                        <span className="inline-flex items-center gap-0.5 text-text-primary text-xs font-medium shrink-0">
                          <Star className="w-3 h-3 fill-gold-accent text-gold-accent" />{resto.rating.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-text-muted font-inter text-[11px] mt-0.5 truncate">{resto.tags.slice(0, 2).join(' · ')}</p>
                      <p className="text-green-primary font-inter text-[11px] font-medium mt-1">
                        {resto.deliveryFee === 0 ? t('Livraison gratuite') : `${t('Livraison')} ${resto.deliveryFee} FCFA`}
                      </p>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
