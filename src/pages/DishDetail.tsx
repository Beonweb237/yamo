import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Star, MapPin, Clock, Store, Flame, ChevronRight, ImageOff,
  Leaf, Beef, Wheat, Coffee, Apple, Heart,
  ShoppingCart, Plus, Minus, Check, Send,
} from 'lucide-react';
import { useRestaurants } from '../hooks/useCatalog';
import { useFavoriteDishes } from '../hooks/useFavoriteDishes';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { menuItems as mockMenuItems } from '../data/mockData';
import {
  buildEnrichedItems,
  groupDishes,
  dishSlug,
  legacyDishSlug,
  DIETARY_TAG_META,
  normalizeDishName,
  type EnrichedItem,
} from '../lib/dishes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { useTranslation } from "react-i18next";

const DIETARY_ICONS: Record<string, typeof Leaf> = {
  'sans-sucre': Coffee, diabetique: Apple, 'pauvre-en-sel': Wheat, vegetarien: Leaf,
  vegan: Leaf, halal: Flame, bio: Leaf, 'riche-en-proteines': Beef, allege: Wheat,
  epice: Flame, braise: Flame, traditionnel: Store, 'sans-cube': Coffee,
  'fait-maison': Star, 'sans-gluten': Wheat, cocktail: Coffee, detox: Apple,
  'presse-du-jour': Coffee,
};

const dietaryLabel = (id: string) => DIETARY_TAG_META.find((t) => t.id === id)?.label ?? id;

// Remonte intégralement (key={slug} ci-dessous) à chaque changement de plat :
// évite de réinitialiser galleryIndex via un effet et garantit un scroll en
// haut de page cohérent, sans état résiduel de la fiche précédente.
export default function DishDetail() {
    const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  return <DishDetailContent key={slug} slug={slug} />;
}

function DishDetailContent({ slug }: { slug?: string }) {
    const { t } = useTranslation();
  const { restaurants } = useRestaurants();
  const { favoriteDishes, toggleFavoriteDish } = useFavoriteDishes();
  const { user } = useAuth();
  const { items: cartItems, addToCart, removeFromCart, replaceCartWith } = useCart();
  const navigate = useNavigate();
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Quick Order
  const [quickOrderItem, setQuickOrderItem] = useState<EnrichedItem | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const allItems = useMemo(
    () => buildEnrichedItems(mockMenuItems, restaurants),
    [restaurants]
  );

  const dishGroups = useMemo(
    () => groupDishes(allItems.filter((i) => i.isAvailable !== false)),
    [allItems]
  );

  const dish = useMemo(
    // legacyDishSlug : les anciens liens partagés (avant translittération
    // œ→oe, ex. /article/boukarou-de-buf) doivent encore résoudre le plat.
    () => dishGroups.find((g) => dishSlug(g.displayName) === slug || legacyDishSlug(g.displayName) === slug),
    [dishGroups, slug]
  );

  const restaurantById = useMemo(
    () => new Map(restaurants.map((r) => [r.id, r])),
    [restaurants]
  );

  const galleryImages = useMemo(() => {
    if (!dish) return [];
    return [...new Set(dish.items.map((i) => i.image).filter(Boolean))].slice(0, 6);
  }, [dish]);

  const bestDescription = useMemo(() => {
    if (!dish) return '';
    return dish.items.reduce((longest, item) => (
      item.description.length > longest.length ? item.description : longest
    ), '');
  }, [dish]);

  const similarDishes = useMemo(() => {
    if (!dish) return [];
    const category = dish.items[0]?.category;
    return dishGroups
      .filter((g) => g.key !== dish.key && g.items[0]?.category === category)
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 4);
  }, [dish, dishGroups]);

  // ── Quick Order : sélectionner le meilleur restaurant ──
  const cartItemIds = useMemo(() => new Set(cartItems.map(ci => ci.item.id)), [cartItems]);

  // Meilleur item : même ville d'abord, puis moins cher
  const bestItem = useMemo(() => {
    if (!dish) return null;
    const userCity = user?.city?.trim();
    // Priorité 1 : même ville que le user, trié par prix
    const sameCity = dish.items.filter(i => userCity && i.restaurantCity === userCity);
    if (sameCity.length > 0) return sameCity.sort((a, b) => a.price - b.price)[0];
    // Priorité 2 : le moins cher tout court
    return [...dish.items].sort((a, b) => a.price - b.price)[0];
  }, [dish, user]);

  const isInCart = bestItem ? cartItemIds.has(bestItem.id) : false;

  const handleQuickAdd = () => {
    if (!bestItem) return;
    if (!user) {
      navigate('/connexion', { state: { from: `/plat/${slug}` } });
      return;
    }
    const uCity = user.city?.trim();
    const restoCity = bestItem.restaurantCity?.trim();
    if (uCity && restoCity && uCity !== restoCity) {
      setQuickOrderItem(bestItem);
      return;
    }
    const result = addToCart(bestItem);
    if (result === 'conflict') {
      setQuickOrderItem(bestItem);
    } else {
      toast.success(`${bestItem.name} ajouté au panier`, {
        description: bestItem.restaurantName,
        action: { label: 'Panier', onClick: () => navigate('/checkout') },
      });
    }
  };

  const handleQuickRemove = () => {
    if (!bestItem) return;
    removeFromCart(bestItem.id);
    toast.success('Retiré du panier');
  };

  const handleReplaceCart = () => {
    if (!quickOrderItem) return;
    replaceCartWith(quickOrderItem);
    setQuickOrderItem(null);
    toast.success(`${quickOrderItem.name} ajouté au panier`, {
      description: quickOrderItem.restaurantName,
      action: { label: 'Panier', onClick: () => navigate('/checkout') },
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
  const userCity = user?.city?.trim() ?? '';
  const isDifferentCity = Boolean(userCity && orderItemCity && userCity !== orderItemCity);

  if (!dish) {
    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-text-secondary font-inter font-medium mb-3">
            {t("Ce plat n'existe pas ou n'est plus disponible.")}
          </p>
          <Link to="/restaurants?mode=plats" className="text-green-primary font-inter text-sm font-medium hover:underline">
            {t("Retour à l'exploration des plats")}
          </Link>
        </div>
      </div>
    );
  }

  const isTrending = dish.items.some((i) => i.isPopular);
  const category = dish.items[0]?.category ?? '';
  const heroImage = galleryImages[galleryIndex] ?? dish.bestImage;

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary pb-20">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-text-muted text-xs font-inter mb-4">
          <Link to="/" className="hover:text-text-primary transition-colors">{t("Accueil")}</Link>
          <span className="mx-2">/</span>
          <Link to="/restaurants?mode=plats" className="hover:text-text-primary transition-colors">{t("Explorer")}</Link>
          <span className="mx-2">/</span>
          <span className="text-text-primary">{dish.displayName}</span>
        </div>

        <div className="bg-white rounded-2xl border border-border-custom shadow-sm overflow-hidden mb-6">
          <div className="relative aspect-[16/9] sm:aspect-[21/9] bg-bg-secondary">
            {heroImage ? (
              <img src={heroImage} alt={dish.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-10 h-10 text-text-muted" /></div>
            )}
            {isTrending && (
              <span className="absolute top-4 left-4 flex items-center gap-1 bg-gold-accent text-white text-xs font-inter font-bold px-3 py-1 rounded-full shadow-sm">
                <Flame className="w-3.5 h-3.5" />{t("Tendance")}
              </span>
            )}
            <button
              type="button"
              onClick={() => toggleFavoriteDish(dish.key)}
              aria-label="Ajouter aux favoris"
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
            >
              <Heart className={`w-5 h-5 ${favoriteDishes.has(dish.key) ? 'fill-error text-error' : 'text-text-secondary'}`} />
            </button>
          </div>

          {galleryImages.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto scrollbar-hide border-b border-border-light">
              {galleryImages.map((img, i) => (
                <button
                  key={img + i}
                  onClick={() => setGalleryIndex(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === galleryIndex ? 'border-green-primary' : 'border-transparent'}`}
                >
                  <img src={img} alt={`${dish.displayName} ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="p-5 sm:p-6">
            <p className="text-text-secondary text-sm font-inter mb-1">{category}</p>
            <h1 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl mb-3">
              {dish.displayName}
            </h1>

            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm font-inter">
              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                <Star className="w-4 h-4 fill-gold-accent" />
                {dish.avgRating.toFixed(1)}
              </span>
              <span className="inline-flex items-center gap-1 text-text-secondary">
                <Store className="w-4 h-4" />
                {dish.totalRestaurants} {t("restaurant")}{dish.totalRestaurants > 1 ? 's' : ''}
              </span>
            </div>

            {dish.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {dish.tags.map((tag) => {
                  const Icon = DIETARY_ICONS[tag] ?? Leaf;
                  return (
                    <span key={tag} className="inline-flex items-center gap-1.5 bg-green-light text-green-primary text-xs font-inter font-medium px-2.5 py-1 rounded-full">
                      <Icon className="w-3.5 h-3.5" />
                      {dietaryLabel(tag)}
                    </span>
                  );
                })}
              </div>
            )}

            {bestDescription && (
              <p className="text-text-secondary text-[15px] font-inter leading-relaxed max-w-[680px]">
                {bestDescription}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {dish.minPrice === dish.maxPrice ? (
            <div className="bg-white rounded-xl border border-border-custom p-4 text-center col-span-2 sm:col-span-2">
              <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide mb-1">{t("Prix")}</p>
              <p className="font-poppins font-bold text-text-primary text-lg">{dish.minPrice.toLocaleString()} {t("FCFA")}</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-border-custom p-4 text-center">
                <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide mb-1">{t("À partir de")}</p>
                <p className="font-poppins font-bold text-text-primary text-lg">{dish.minPrice.toLocaleString()} {t("FCFA")}</p>
              </div>
              <div className="bg-white rounded-xl border border-border-custom p-4 text-center">
                <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide mb-1">{t("Jusqu'à")}</p>
                <p className="font-poppins font-bold text-text-primary text-lg">{dish.maxPrice.toLocaleString()} {t("FCFA")}</p>
              </div>
            </>
          )}
          <div className="bg-white rounded-xl border border-border-custom p-4 text-center col-span-2 sm:col-span-1">
            <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide mb-1">{t("Note moyenne")}</p>
            <p className="font-poppins font-bold text-text-primary text-lg">{dish.avgRating.toFixed(1)} / 5</p>
          </div>
        </div>

        <section className="bg-white rounded-2xl border border-border-custom shadow-sm overflow-hidden mb-8">
          <div className="px-5 sm:px-6 py-4 border-b border-border-light">
            <h2 className="font-poppins font-semibold text-text-primary text-lg">
              {t("Disponible chez")} {dish.totalRestaurants} {t("restaurant")}{dish.totalRestaurants > 1 ? 's' : ''}
            </h2>
            <p className="text-text-muted text-xs font-inter mt-0.5">{t("Trié du moins cher au plus cher")}</p>
          </div>
          <div className="divide-y divide-border-light">
            {dish.items.map((item) => {
                const { t } = useTranslation();
              const resto = restaurantById.get(item.restaurantId);
              const location = [resto?.neighborhood ?? item.restaurantNeighborhood, resto?.city ?? item.restaurantCity].filter(Boolean).join(', ');
              const deliveryTime = resto?.deliveryTime ?? item.restaurantDeliveryTime;
              const itemNameDiffers = normalizeDishName(item.name) !== normalizeDishName(dish.displayName);
              const restaurantSlug = resto?.slug || item.restaurantId;
              const itemInCart = cartItemIds.has(item.id);

              const handleRowQuickAdd = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                if (!user) { navigate('/connexion', { state: { from: `/plat/${slug}` } }); return; }
                const uCity = user.city?.trim();
                const rCity = item.restaurantCity?.trim();
                if (uCity && rCity && uCity !== rCity) { setQuickOrderItem(item); return; }
                const result = addToCart(item);
                if (result === 'conflict') { setQuickOrderItem(item); }
                else { toast.success(`${item.name} ajouté`, { description: item.restaurantName }); }
              };

              const handleRowQuickRemove = (e: React.MouseEvent) => {
                e.preventDefault(); e.stopPropagation();
                removeFromCart(item.id);
                toast.success('Retiré du panier');
              };

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-4 sm:p-5 hover:bg-bg-secondary transition-colors group"
                >
                  <Link to={`/restaurant/${restaurantSlug}`} className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-inter font-semibold text-text-primary text-sm">{item.restaurantName}</p>
                        <span className="flex items-center gap-0.5 text-xs text-amber-700 shrink-0">
                          <Star className="w-3 h-3 fill-gold-accent" />{item.restaurantRating}
                        </span>
                      </div>
                      {itemNameDiffers && (
                        <p className="text-text-muted text-xs font-inter mt-0.5 truncate">{item.name}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-text-muted text-xs font-inter">
                        {location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{location}
                          </span>
                        )}
                        {deliveryTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />{deliveryTime}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-inter font-bold text-green-primary text-sm shrink-0">
                      {item.price.toLocaleString()} {t("FCFA")}
                    </span>
                    <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-green-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>

                  {/* Mini quick-add button par resto */}
                  <div className="shrink-0">
                    {itemInCart ? (
                      <button
                        type="button"
                        onClick={handleRowQuickRemove}
                        className="w-10 h-10 rounded-full border border-green-primary/30 bg-green-light/60 text-green-primary hover:bg-error/10 hover:text-error hover:border-error/30 transition-all flex items-center justify-center"
                        title="Retirer du panier"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRowQuickAdd}
                        className="w-10 h-10 rounded-full border border-border-custom text-text-muted hover:text-green-primary hover:border-green-primary hover:bg-green-light/30 transition-all flex items-center justify-center"
                        title={`Ajouter — ${item.restaurantName}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {similarDishes.length > 0 && (
          <section className="pb-12">
            <h2 className="font-poppins font-bold text-text-primary text-xl mb-4">
              {t("Plats similaires")}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {similarDishes.map((group) => (
                <Link
                  key={group.key}
                  to={`/plat/${dishSlug(group.displayName)}`}
                  className="group text-left bg-white rounded-xl border border-border-custom shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-bg-secondary">
                    {group.bestImage ? (
                      <img src={group.bestImage} alt={group.displayName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-5 h-5 text-text-muted" /></div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="font-inter font-semibold text-text-primary text-xs truncate">{group.displayName}</p>
                    <p className="text-green-primary font-inter font-bold text-xs mt-0.5">{group.minPrice.toLocaleString()} {t("FCFA")}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Spacer pour la sticky bar */}
        <div className="h-24 md:h-20" />
      </div>

      {/* ── Sticky Bottom Bar — Commande rapide ── */}
      {bestItem && (
        <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-border-custom shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
            {/* Infos resto */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                  {bestItem.image ? (
                    <img src={bestItem.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-4 h-4 text-text-muted" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-inter font-semibold text-text-primary truncate">
                    {bestItem.restaurantName}
                  </p>
                  <p className="text-[10px] font-inter text-text-muted flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5" />
                    {bestItem.restaurantNeighborhood || bestItem.restaurantCity}
                    {dish.totalRestaurants > 1 && (
                      <span className="text-text-muted">· +{dish.totalRestaurants - 1} {t("autre")}{dish.totalRestaurants > 2 ? 's' : ''}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Prix + bouton */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-inter font-bold text-green-primary">
                {bestItem.price.toLocaleString()} {t("FCFA")}
              </span>

              {isInCart ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleQuickRemove}
                    className="group/remove h-10 px-3 rounded-xl border border-green-primary/30 bg-green-light/60 text-green-primary text-xs font-inter font-semibold hover:bg-error/10 hover:text-error hover:border-error/30 transition-all flex items-center gap-1.5"
                    title="Retirer du panier"
                  >
                    <Check className="w-4 h-4 group-hover/remove:hidden" />
                    <Minus className="w-4 h-4 hidden group-hover/remove:block" />
                    <span className="group-hover/remove:hidden">{t("Ajouté")}</span>
                    <span className="hidden group-hover/remove:block">{t("Retirer")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/checkout')}
                    className="h-10 w-10 rounded-xl bg-green-primary text-white hover:bg-green-dark transition-all flex items-center justify-center active:scale-95"
                    title="Voir le panier"
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  className="h-10 px-5 rounded-xl bg-green-primary text-white text-xs font-inter font-semibold hover:bg-green-dark transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {t("Commander")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Cross-city / conflit panier modal ── */}
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
                  {t("🚫 Vous êtes à")} <strong>{userCity}</strong>{t(", ce restaurant est à")} <strong>{orderItemCity}</strong>.
                </p>
              </div>
              <div className="p-3 bg-green-light border border-green-primary/20 rounded-lg">
                <p className="text-sm font-inter text-green-primary font-medium mb-2">
                  {t("💡 Commandez ce plat pour quelqu'un à")} {orderItemCity} !
                </p>
                <p className="text-xs font-inter text-text-secondary">
                  {t("Créez une demande sur mesure, un restaurant local préparera et livrera le plat.")}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setQuickOrderItem(null)} className="flex-1 h-10 rounded-lg border border-border-custom text-text-secondary font-inter text-sm font-medium hover:bg-bg-secondary transition-colors">{t("Annuler")}</button>
                <button onClick={handleOrderForOther} className="flex-1 h-10 rounded-lg bg-green-primary text-white font-inter text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-green-dark transition-colors">
                  <Send className="w-4 h-4" />{t("Commander pour autrui")}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-inter text-amber-800">
                  {t("Votre panier contient déjà des plats d'un autre restaurant.")}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setQuickOrderItem(null)} className="flex-1 h-10 rounded-lg border border-border-custom text-text-secondary font-inter text-sm font-medium hover:bg-bg-secondary transition-colors">{t("Annuler")}</button>
                <button onClick={handleReplaceCart} className="flex-1 h-10 rounded-lg bg-green-primary text-white font-inter text-sm font-semibold hover:bg-green-dark transition-colors">{t("Remplacer le panier")}</button>
              </div>
            </div>
          )}
          <DialogFooter className="text-xs text-text-muted font-inter">
            {isDifferentCity ? 'Vous pourrez préciser le nom et le téléphone du destinataire.' : 'Le panier ne peut contenir qu\'un seul restaurant à la fois.'}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
