import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Star,
  Clock,
  MapPin,
  Heart,
  ChevronDown,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Share2,
  Circle,
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useRestaurant, useMenuItems, useRestaurants } from '../hooks/useCatalog';
import { useFavorites } from '../hooks/useFavorites';
import { fetchRestaurantReviews, type RestaurantReview } from '../lib/catalog';
import { restaurantMenuCategories } from '../data/mockData';
import type { MenuItem } from '../data/mockData';

function timeAgoFr(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return "aujourd'hui";
  if (days === 1) return 'il y a 1 jour';
  if (days < 30) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'il y a 1 mois';
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(months / 12);
  return years === 1 ? 'il y a 1 an' : `il y a ${years} ans`;
}

const categoryOrder = [
  'Plats Principaux',
  'Grillades',
  ...restaurantMenuCategories.filter((cat) => !['Plats Principaux', 'Grillades'].includes(cat)),
];

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { restaurant: fetchedRestaurant } = useRestaurant(id);
  const { restaurants } = useRestaurants();
  const restaurant = fetchedRestaurant ?? restaurants[0];
  const { items: menuItems } = useMenuItems(restaurant?.id);
  const [activeTab, setActiveTab] = useState('Populaires');
  const { favorites, toggleFavorite } = useFavorites();
  const isFav = restaurant ? favorites.has(restaurant.id) : false;
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const { items, addToCart, replaceCartWith, updateQuantity, totalItems, totalPrice } = useCart();
  const { user } = useAuth();
  const [conflictItem, setConflictItem] = useState<MenuItem | null>(null);

  // Le panier reste accessible sans compte, mais passer commande exige une
  // session — direct vers la connexion plutôt que de laisser /checkout
  // afficher puis rediriger (évite le flash de la page commande).
  const handleCheckout = () => {
    if (!user) {
      navigate('/connexion', { state: { from: '/checkout' } });
      return;
    }
    navigate('/checkout');
  };

  // C4: customization modal
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [selectedSupplements, setSelectedSupplements] = useState<Set<number>>(new Set());

  // Gallery: use explicit gallery array, or auto-generate from menu item images
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Map image URLs to menu items for the "commander depuis la galerie" feature
  const imageToMenuItem = useMemo(() => {
    const map = new Map<string, MenuItem>();
    for (const item of menuItems) {
      if (item.image) map.set(item.image, item);
    }
    return map;
  }, [menuItems]);

  const galleryImages = useMemo(() => {
    if (restaurant?.gallery?.length) return restaurant.gallery;
    // Fallback: use menu item images (first 5 distinct ones)
    const menuImages = [...new Set(menuItems.map(m => m.image).filter(Boolean))].slice(0, 5);
    if (menuImages.length > 0) return menuImages;
    // Last resort: restaurant main image
    return restaurant?.image ? [restaurant.image] : [];
  }, [restaurant, menuItems]);
  const hasGallery = galleryImages.length > 0;

  const customPrice = customizing
    ? customizing.price + (customizing.variants?.[selectedVariant]?.price ?? 0) +
    [...selectedSupplements].reduce((s, i) => s + (customizing.supplements?.[i]?.price ?? 0), 0)
    : 0;

  const handleAdd = (item: MenuItem) => {
    if (item.variants?.length || item.supplements?.length) {
      setCustomizing(item);
      setSelectedVariant(0);
      setSelectedSupplements(new Set());
      return;
    }
    if (addToCart(item) === 'conflict') {
      setConflictItem(item);
      return;
    }
    toast.success(`${item.name} ajouté au panier`);
  };

  const confirmCustomized = () => {
    if (!customizing) return;
    const variant = customizing.variants?.[selectedVariant];
    const suppNames = [...selectedSupplements].map((i) => customizing.supplements?.[i]?.name).filter(Boolean).join(', ');
    const fullName = [customizing.name, variant?.name, suppNames].filter(Boolean).join(' + ');
    const customized = { ...customizing, name: fullName, price: customPrice };
    if (addToCart(customized) === 'conflict') {
      setConflictItem(customized);
      setCustomizing(null);
      return;
    }
    toast.success(`${fullName} ajouté au panier`);
    setCustomizing(null);
  };

  const confirmReplaceCart = () => {
    if (!conflictItem) return;
    replaceCartWith(conflictItem);
    toast.success(`Panier remplacé — ${conflictItem.name} ajouté`);
    setConflictItem(null);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const menuItemsByCategory = useMemo(() => {
    const restoItems = menuItems.filter((m) => m.restaurantId === restaurant.id);
    const groups: Record<string, MenuItem[]> = {};
    categoryOrder.forEach((cat) => {
      const items = restoItems.filter((m) => m.category === cat);
      if (items.length) groups[cat] = items;
    });
    return groups;
  }, [restaurant.id, menuItems]);

  const hasPopularItems = useMemo(
    () => menuItems.some((m) => m.restaurantId === restaurant.id && m.isPopular),
    [restaurant.id, menuItems]
  );

  const availableTabs = useMemo(
    () => [...(hasPopularItems ? ['Populaires'] : []), ...Object.keys(menuItemsByCategory)],
    [hasPopularItems, menuItemsByCategory]
  );

  // Derived instead of synced via effect: falls back to the first available
  // tab if the stored selection no longer exists for this restaurant's menu.
  const currentTab = availableTabs.includes(activeTab) ? activeTab : (availableTabs[0] ?? 'Populaires');

  const filteredItems = useMemo(() => {
    const restoItems = menuItems.filter((m) => m.restaurantId === restaurant.id);
    if (currentTab === 'Populaires') {
      return restoItems.filter((m) => m.isPopular);
    }
    return restoItems.filter((m) => m.category === currentTab);
  }, [currentTab, restaurant.id, menuItems]);

  const getItemQuantity = (itemId: string) => {
    const found = items.find((i) => i.item.id === itemId);
    return found ? found.quantity : 0;
  };

  // Real reviews from restaurant_reviews (fallback to empty while loading)
  const [reviews, setReviews] = useState<RestaurantReview[]>([]);
  useEffect(() => {
    if (!restaurant?.id) return;
    let cancelled = false;
    fetchRestaurantReviews(restaurant.id).then((data) => {
      if (!cancelled) setReviews(data);
    });
    return () => { cancelled = true; };
  }, [restaurant?.id]);

  const ratingBreakdown = useMemo(() => {
    const counts = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: reviews.filter((r) => r.rating === stars).length,
    }));
    const total = reviews.length;
    return counts.map((c) => ({ ...c, pct: total > 0 ? (c.count / total) * 100 : 0 }));
  }, [reviews]);

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      {/* Cover Image */}
      <div className="relative h-[200px] sm:h-[280px] w-full overflow-hidden">
        <img
          src={restaurant.image}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />
      </div>

      {/* Restaurant Info Card */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] -mt-10 relative z-10 p-5 sm:p-6 mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl mb-1">
                {restaurant.name}
              </h1>
              <p className="text-text-secondary text-sm font-inter mb-3">
                {restaurant.tags.join(' \u2022 ')}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 text-gold-accent text-sm font-inter">
                  <Star className="w-4 h-4 fill-gold-accent" />
                  {restaurant.rating}
                  <span className="text-text-muted">({restaurant.reviewCount} avis)</span>
                </span>
                <span className="inline-flex items-center gap-1 text-text-secondary text-sm font-inter">
                  <Clock className="w-4 h-4" />
                  {restaurant.deliveryTime}
                </span>
                <span className="inline-flex items-center gap-1 bg-green-light text-green-primary text-xs font-inter px-2 py-0.5 rounded-full">
                  {restaurant.deliveryFee === 0 ? 'Livraison gratuite' : `${restaurant.deliveryFee} FCFA`}
                </span>
                <span className="inline-flex items-center gap-1 text-text-muted text-xs font-inter">
                  <MapPin className="w-3.5 h-3.5" />
                  1.2 km
                </span>
                <span className="inline-flex items-center gap-1 text-text-muted text-xs font-inter">
                  <Circle className="w-2 h-2 fill-success text-success" />
                  Ouvert jusqu&apos;&agrave; {restaurant.hours.split(' - ')[1]}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => restaurant && toggleFavorite(restaurant.id)}
                className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
              >
                <Heart className={`w-5 h-5 ${isFav ? 'fill-error text-error' : 'text-text-secondary'}`} />
              </button>
              <button className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors">
                <Share2 className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
          </div>
          <p className="text-text-secondary text-[15px] font-inter leading-relaxed mt-4 max-w-[700px]">
            {restaurant.description}
          </p>
        </motion.div>

        {/* Gallery Section */}
        {hasGallery && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-light flex items-center justify-center">
                <Camera className="w-4 h-4 text-green-primary" />
              </div>
              <h2 className="font-poppins font-semibold text-text-primary text-lg">
                Galerie photo
              </h2>
              <span className="text-text-muted text-xs font-inter">
                ({galleryImages.length} photos)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {galleryImages.map((img, idx) => {
                const linkedItem = imageToMenuItem.get(img);
                return (
                  <div
                    key={idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => { setGalleryIndex(idx); setGalleryOpen(true); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setGalleryIndex(idx);
                        setGalleryOpen(true);
                      }
                    }}
                    className={`relative overflow-hidden rounded-xl border border-border-custom hover:shadow-md transition-all group cursor-pointer ${idx === 0 ? 'sm:col-span-2 sm:row-span-2' : ''
                      }`}
                  >
                    <img
                      src={img}
                      alt={linkedItem ? linkedItem.name : `${restaurant.name} - photo ${idx + 1}`}
                      className="w-full h-full object-cover aspect-[4/3] group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(
                          `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#f0fdf4" width="100%" height="100%"/><text x="50%" y="50%" fill="#166534" font-size="14" text-anchor="middle" dominant-baseline="middle" font-family="Arial">Photo ${idx + 1}</text></svg>`
                        )}`;
                      }}
                    />

                    {/* Hover overlay: lightbox icon */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                      <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>

                    {/* Linked menu item: name + price + quick-add button */}
                    {linkedItem && (
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs font-inter font-semibold truncate">{linkedItem.name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-white text-xs font-inter font-bold">{linkedItem.price.toLocaleString()} FCFA</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleAdd(linkedItem); }}
                            className="w-7 h-7 rounded-full bg-green-primary text-white flex items-center justify-center hover:bg-green-dark hover:scale-110 transition-all shadow-md"
                            title={`Ajouter ${linkedItem.name} au panier`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {idx >= 4 && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white font-inter font-semibold text-sm">
                          +{galleryImages.length - 4}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Menu Tabs */}
        <div className="sticky top-[72px] z-30 bg-bg-secondary border-b border-border-custom mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-12 xl:px-12">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {availableTabs.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`snap-start shrink-0 px-4 py-3 font-inter text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${cat === currentTab
                  ? 'text-green-primary border-green-primary'
                  : 'text-text-secondary border-transparent hover:text-text-primary'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-8 pb-16">
          {/* Menu Items */}
          <div className="flex-1">
            {currentTab === 'Populaires' ? (
              // Show popular items first, then other categories
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="font-poppins font-semibold text-text-primary text-xl">
                      Les Plus Populaires
                    </h2>
                    <div className="w-10 h-[3px] bg-green-primary rounded-full" />
                  </div>
                </motion.div>
                <div className="bg-white rounded-xl border border-border-custom overflow-hidden divide-y divide-border-light mb-8">
                  {filteredItems.map((item, i) => (
                    <MenuRow key={item.id} item={item} index={i} getQty={getItemQuantity} onAdd={handleAdd} onUpdate={updateQuantity} />
                  ))}
                </div>
                {/* Other categories */}
                {Object.entries(menuItemsByCategory).map(([cat, items]) => (
                  <div key={cat} className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <h2 className="font-poppins font-semibold text-text-primary text-xl">
                        {cat}
                      </h2>
                      <div className="w-10 h-[3px] bg-green-primary rounded-full" />
                    </div>
                    <div className="bg-white rounded-xl border border-border-custom overflow-hidden divide-y divide-border-light">
                      {items.map((item, i) => (
                        <MenuRow key={item.id} item={item} index={i} getQty={getItemQuantity} onAdd={handleAdd} onUpdate={updateQuantity} />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="font-poppins font-semibold text-text-primary text-xl">
                      {currentTab}
                    </h2>
                    <div className="w-10 h-[3px] bg-green-primary rounded-full" />
                  </div>
                </motion.div>
                <div className="bg-white rounded-xl border border-border-custom overflow-hidden divide-y divide-border-light">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item, i) => (
                      <MenuRow key={item.id} item={item} index={i} getQty={getItemQuantity} onAdd={handleAdd} onUpdate={updateQuantity} />
                    ))
                  ) : (
                    <div className="p-8 text-center text-text-secondary font-inter">
                      Aucun plat dans cette cat&eacute;gorie pour le moment.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Cart Sidebar - Desktop */}
          <div className="hidden lg:block w-[380px] shrink-0">
            <div className="sticky top-[140px] bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-5">
              <CartContent items={items} totalItems={totalItems} totalPrice={totalPrice} deliveryFee={restaurant.deliveryFee} onUpdate={updateQuantity} onCheckout={handleCheckout} />
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <section className="pb-16">
          <div className="bg-white rounded-xl border border-border-custom p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Rating Summary */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="md:w-[280px] shrink-0"
              >
                <div className="flex items-end gap-2 mb-2">
                  <span className="font-poppins font-bold text-text-primary text-5xl">
                    {restaurant.rating}
                  </span>
                  <span className="text-text-secondary font-inter text-base mb-1">sur 5</span>
                </div>
                <div className="flex gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${i < Math.floor(restaurant.rating)
                        ? 'fill-gold-accent text-gold-accent'
                        : i < restaurant.rating
                          ? 'fill-gold-accent/50 text-gold-accent'
                          : 'text-border-custom'
                        }`}
                    />
                  ))}
                </div>
                <p className="text-text-muted text-sm font-inter mb-6">
                  Bas&eacute; sur {restaurant.reviewCount} avis
                </p>
                <div className="space-y-2">
                  {ratingBreakdown.map((rb) => (
                    <div key={rb.stars} className="flex items-center gap-2">
                      <span className="text-text-secondary text-xs font-inter w-6">{rb.stars}★</span>
                      <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gold-accent rounded-full"
                          style={{ width: `${rb.pct}%` }}
                        />
                      </div>
                      <span className="text-text-muted text-xs font-inter w-8 text-right">{rb.count}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Review List */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-poppins font-semibold text-text-primary text-lg">
                    Avis r&eacute;cents
                  </h3>
                </div>
                {reviews.length === 0 ? (
                  <p className="text-text-secondary font-inter text-sm py-6 text-center">
                    Aucun avis pour le moment. Soyez le premier &agrave; noter ce restaurant apr&egrave;s votre commande !
                  </p>
                ) : (
                  <div className="space-y-0 divide-y divide-border-light">
                    {reviews.slice(0, 10).map((review, i) => (
                      <motion.div
                        key={review.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: i * 0.06 }}
                        className="py-4"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-green-primary text-white flex items-center justify-center font-inter font-semibold text-sm">
                            <Star className="w-4 h-4 fill-white" />
                          </div>
                          <div>
                            <span className="font-inter font-semibold text-text-primary text-sm">
                              Client MiamExpress
                            </span>
                            <span className="text-text-muted text-xs font-inter ml-2">
                              {timeAgoFr(review.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-0.5 mb-2">
                          {Array.from({ length: review.rating }).map((_, j) => (
                            <Star key={j} className="w-3 h-3 fill-gold-accent text-gold-accent" />
                          ))}
                        </div>
                        {review.comment && (
                          <p className="text-text-primary text-[15px] font-inter leading-relaxed">
                            {review.comment}
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Similar Restaurants */}
        <section className="pb-16">
          <h2 className="font-poppins font-bold text-text-primary text-2xl mb-6">
            Vous Aimerez Aussi
          </h2>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4">
            {restaurants.filter((r) => r.id !== restaurant.id).slice(0, 4).map((resto) => (
              <Link
                key={resto.id}
                to={`/restaurant/${resto.id}`}
                className="snap-start shrink-0 w-[260px] bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={resto.image} alt={resto.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <h3 className="font-inter font-semibold text-text-primary text-sm mb-1">
                    {resto.name}
                  </h3>
                  <p className="text-text-secondary text-xs font-inter mb-2">
                    {resto.tags.join(' \u2022 ')}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 bg-gold-light text-gold-accent text-xs font-inter font-medium px-2 py-0.5 rounded-full">
                      <Star className="w-3 h-3 fill-gold-accent" />
                      {resto.rating}
                    </span>
                    <span className="text-text-secondary text-xs font-inter">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {resto.deliveryTime}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Mobile Cart Bar */}
      {totalItems > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border-custom shadow-[0_-4px_16px_rgba(0,0,0,0.08)] z-40 px-4 flex items-center justify-between">
          <div>
            <span className="text-text-secondary font-inter text-sm">
              {totalItems} article{totalItems > 1 ? 's' : ''}
            </span>
            <span className="text-text-primary font-inter font-bold text-base ml-3">
              {totalPrice.toLocaleString()} FCFA
            </span>
          </div>
          <button
            onClick={() => setMobileCartOpen(true)}
            className="bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-full hover:bg-green-dark transition-colors"
          >
            Voir le panier &rarr;
          </button>
        </div>
      )}

      {/* Mobile Cart Sheet */}
      <AnimatePresence>
        {mobileCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 lg:hidden"
              onClick={() => setMobileCartOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: '20%' }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white rounded-t-2xl p-5 shadow-xl overflow-y-auto"
              style={{ maxHeight: '80vh' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-poppins font-semibold text-lg">Votre Commande</h3>
                <button onClick={() => setMobileCartOpen(false)}>
                  <ChevronDown className="w-6 h-6 text-text-secondary" />
                </button>
              </div>
              <CartContent items={items} totalItems={totalItems} totalPrice={totalPrice} deliveryFee={restaurant.deliveryFee} onUpdate={updateQuantity} onCheckout={handleCheckout} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* C4: Customization dialog */}
      <Dialog open={!!customizing} onOpenChange={(open) => { if (!open) setCustomizing(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-poppins text-lg">{customizing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {customizing?.variants?.length ? (
              <div>
                <p className="text-sm font-inter font-medium text-text-primary mb-2">Taille / Portion</p>
                <div className="space-y-2">
                  {customizing.variants.map((v, i) => (
                    <label key={i} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedVariant === i ? 'border-green-primary bg-green-light' : 'border-border-custom hover:bg-bg-secondary'}`}>
                      <div className="flex items-center gap-2">
                        <input type="radio" name="variant" checked={selectedVariant === i} onChange={() => setSelectedVariant(i)} className="accent-green-primary" />
                        <span className="text-sm font-inter text-text-primary">{v.name}</span>
                      </div>
                      <span className="text-sm font-inter font-medium text-text-primary">{v.price > 0 ? `+${v.price.toLocaleString()} FCFA` : 'Inclus'}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {customizing?.supplements?.length ? (
              <div>
                <p className="text-sm font-inter font-medium text-text-primary mb-2">Suppléments</p>
                <div className="space-y-2">
                  {customizing.supplements.map((s, i) => (
                    <label key={i} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedSupplements.has(i) ? 'border-green-primary bg-green-light' : 'border-border-custom hover:bg-bg-secondary'}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={selectedSupplements.has(i)} onChange={() => { const next = new Set(selectedSupplements); next.has(i) ? next.delete(i) : next.add(i); setSelectedSupplements(next); }} className="accent-green-primary" />
                        <span className="text-sm font-inter text-text-primary">{s.name}</span>
                      </div>
                      <span className="text-sm font-inter font-medium text-text-primary">+{s.price.toLocaleString()} FCFA</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button onClick={() => setCustomizing(null)} className="px-4 h-10 rounded-lg text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors">Annuler</button>
            <button onClick={confirmCustomized} className="px-5 h-10 rounded-lg bg-green-primary text-white font-inter font-medium text-sm hover:bg-green-dark transition-colors">
              Ajouter — {customPrice.toLocaleString()} FCFA
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflit de restaurant : le panier ne peut contenir qu'un seul restaurant */}
      <Dialog open={!!conflictItem} onOpenChange={(open) => { if (!open) setConflictItem(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Commencer un nouveau panier ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-inter text-text-secondary">
            Votre panier contient des articles d'un autre restaurant. Une commande ne peut
            concerner qu'un seul restaurant à la fois. Voulez-vous vider le panier et
            ajouter <span className="font-semibold text-text-primary">{conflictItem?.name}</span> ?
          </p>
          <DialogFooter>
            <button onClick={() => setConflictItem(null)} className="px-4 h-10 rounded-lg text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors">Garder mon panier</button>
            <button onClick={confirmReplaceCart} className="px-5 h-10 rounded-lg bg-green-primary text-white font-inter font-medium text-sm hover:bg-green-dark transition-colors">
              Vider et ajouter
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gallery Lightbox */}
      {galleryOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setGalleryOpen(false)}
        >
          <button
            onClick={() => setGalleryOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {galleryImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setGalleryIndex((galleryIndex - 1 + galleryImages.length) % galleryImages.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setGalleryIndex((galleryIndex + 1) % galleryImages.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <img
            src={galleryImages[galleryIndex]}
            alt={`${restaurant.name} - photo ${galleryIndex + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect fill="#1a1a1a" width="100%" height="100%"/><text x="50%" y="50%" fill="#fff" font-size="20" text-anchor="middle" dominant-baseline="middle" font-family="Arial">Photo ${galleryIndex + 1}</text></svg>`
              )}`;
            }}
          />

          {/* Counter + thumbnails */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <span className="text-white/80 text-sm font-inter">
              {galleryIndex + 1} / {galleryImages.length}
            </span>
            <div className="flex gap-1.5">
              {galleryImages.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setGalleryIndex(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${i === galleryIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* Menu Row Component */
function MenuRow({
  item, index, getQty, onAdd, onUpdate,
}: {
  item: MenuItem;
  index: number;
  getQty: (id: string) => number;
  onAdd: (item: MenuItem) => void;
  onUpdate: (id: string, qty: number) => void;
}) {
  const qty = getQty(item.id);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="flex items-center gap-4 p-4 hover:bg-bg-secondary transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-inter font-semibold text-text-primary text-base truncate">
            {item.name}
          </h4>
          {item.isPopular && (
            <span className="shrink-0 bg-gold-light text-gold-accent text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full">
              Populaire
            </span>
          )}
        </div>
        <p className="text-text-secondary text-sm font-inter line-clamp-2 mb-2 leading-relaxed">
          {item.description}
        </p>
        <span className="font-inter font-bold text-text-primary text-base">
          {item.price.toLocaleString()} FCFA
        </span>
      </div>
      <div className="shrink-0 relative">
        <img
          src={item.image}
          alt={item.name}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover"
        />
        {qty === 0 ? (
          <button
            onClick={() => onAdd(item)}
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-green-primary text-white flex items-center justify-center shadow-md hover:bg-green-dark hover:scale-110 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white rounded-full shadow-md border border-border-custom px-1 py-0.5">
            <button
              onClick={() => onUpdate(item.id, qty - 1)}
              className="w-6 h-6 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
            >
              {qty === 1 ? <Trash2 className="w-3 h-3 text-error" /> : <Minus className="w-3 h-3" />}
            </button>
            <span className="text-text-primary font-inter font-semibold text-xs w-4 text-center">{qty}</span>
            <button
              onClick={() => onAdd(item)}
              className="w-6 h-6 rounded-full bg-green-primary text-white flex items-center justify-center hover:bg-green-dark transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* Cart Content Component */
function CartContent({
  items, totalItems, totalPrice, deliveryFee, onUpdate, onCheckout,
}: {
  items: { item: MenuItem; quantity: number }[];
  totalItems: number;
  totalPrice: number;
  deliveryFee: number;
  onUpdate: (id: string, qty: number) => void;
  onCheckout: () => void;
}) {
  if (totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <ShoppingCart className="w-12 h-12 text-text-muted mb-3" />
        <p className="text-text-secondary font-inter font-medium text-base mb-1">
          Votre panier est vide
        </p>
        <p className="text-text-muted font-inter text-sm text-center">
          Ajoutez des plats d&eacute;licieux &agrave; votre commande
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-poppins font-semibold text-text-primary text-lg mb-4">
        Votre Commande
        <span className="ml-2 text-text-muted text-sm font-inter font-normal">
          ({totalItems} article{totalItems > 1 ? 's' : ''})
        </span>
      </h3>
      <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
        {items.map(({ item, quantity }) => (
          <div key={item.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-inter text-sm text-text-primary truncate">{item.name}</p>
              <p className="text-text-muted text-xs font-inter">
                {(item.price * quantity).toLocaleString()} FCFA
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onUpdate(item.id, quantity - 1)}
                className="w-7 h-7 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
              >
                {quantity === 1 ? <Trash2 className="w-3 h-3 text-error" /> : <Minus className="w-3 h-3" />}
              </button>
              <span className="text-text-primary font-inter font-semibold text-sm w-5 text-center">
                {quantity}
              </span>
              <button
                onClick={() => onUpdate(item.id, quantity + 1)}
                className="w-7 h-7 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border-light pt-4 space-y-2">
        <div className="flex justify-between text-sm font-inter text-text-secondary">
          <span>Sous-total</span>
          <span>{totalPrice.toLocaleString()} FCFA</span>
        </div>
        <div className="flex justify-between text-sm font-inter">
          <span className="text-text-secondary">Livraison</span>
          <span className={deliveryFee === 0 ? 'text-success font-medium' : 'text-text-primary font-medium'}>
            {deliveryFee === 0 ? 'Gratuit' : `${deliveryFee.toLocaleString()} FCFA`}
          </span>
        </div>
        <div className="border-t border-border-light pt-2 flex justify-between font-inter">
          <span className="text-text-primary font-bold text-lg">Total</span>
          <span className="text-text-primary font-bold text-lg">{(totalPrice + deliveryFee).toLocaleString()} FCFA</span>
        </div>
      </div>
      <button
        onClick={onCheckout}
        className="w-full mt-4 bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors"
      >
        Commander &mdash; {totalPrice.toLocaleString()} FCFA
      </button>
    </div>
  );
}
