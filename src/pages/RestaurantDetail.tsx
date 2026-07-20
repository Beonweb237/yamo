import { useState, useMemo, useEffect, useRef } from 'react';
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
  Store,
  Sparkles,
  MessageSquare,
  Navigation,
  BadgeCheck,
} from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
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
import { fetchRestaurantRatingSummary, fetchRestaurantReviews, type Review, type ReviewSummary } from '../lib/reviews';
import { isEffectivelyOpen, parseHours } from '../lib/hours';
import { restaurantMenuCategories } from '../data/mockData';
import type { MenuItem } from '../data/mockData';
import LazyDeliveryMap from '../components/LazyDeliveryMap';
import type { MapPoint } from '../components/DeliveryMap';
import { useTranslation } from "react-i18next";
import AuthChoiceModal from '../components/AuthChoiceModal';

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
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { restaurant: fetchedById, loading: restaurantLoading } = useRestaurant(slug);
  const { restaurants } = useRestaurants();
  // useRestaurant() ne résout que par id ; la route utilise un slug, d'où le
  // repli sur la liste complète (déjà chargée en mémoire). Pas de dernier
  // repli vers un restaurant arbitraire : un slug/id inconnu doit produire
  // `undefined` (écran "introuvable" ci-dessous), jamais la fiche d'un autre
  // établissement (CONF-09 — ux-audit-optimal.md).
  const restaurant = fetchedById ?? restaurants.find(r => r.slug === slug || r.id === slug);
  const { items: menuItems } = useMenuItems(restaurant?.id);
  const [activeTab, setActiveTab] = useState('Populaires');
  const { favorites, toggleFavorite } = useFavorites();
  const isFav = restaurant ? favorites.has(restaurant.id) : false;
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const { items, addToCart, replaceCartWith, updateQuantity, totalItems, totalPrice } = useCart();
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Conflit de restaurant : on garde l'article ET son id de base (un plat
  // personnalisé porte un id composite, différent de l'id du plat au menu).
  const [conflictItem, setConflictItem] = useState<{ item: MenuItem; baseItemId: string } | null>(null);

  // Le panier reste accessible sans compte, mais passer commande exige une
  // session — on affiche la modale connexion/inscription.
  const handleCheckout = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    navigate('/checkout');
  };

  // C4: customization modal
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [selectedSupplements, setSelectedSupplements] = useState<Set<number>>(new Set());

  // Gallery : deux vitrines distinctes.
  // 1) "Galerie de nos plats" — uniquement des photos de plats réels du menu
  //    (chaque photo reste cliquable pour ajouter le plat au panier).
  // 2) "Coulisses" — vitrine optionnelle et facultative pour le restaurant
  //    (ambiance, cuisine, équipe...), affichée uniquement si le restaurant a
  //    fourni des photos qui ne sont pas déjà des photos de plats.
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryMode, setGalleryMode] = useState<'plats' | 'coulisses'>('plats');

  // Map image URLs to menu items for the "commander depuis la galerie" feature
  const imageToMenuItem = useMemo(() => {
    const map = new Map<string, MenuItem>();
    for (const item of menuItems) {
      if (item.image) map.set(item.image, item);
    }
    return map;
  }, [menuItems]);

  const galleryImages = useMemo(() => {
    const restoItems = menuItems.filter((m) => m.restaurantId === restaurant?.id);
    const dishImages = [...new Set(restoItems.map((m) => m.image).filter(Boolean))];
    if (dishImages.length > 0) return dishImages;
    // Aucune photo de plat : à défaut, la photo principale du restaurant.
    return restaurant?.image ? [restaurant.image] : [];
  }, [restaurant, menuItems]);
  const hasGallery = galleryImages.length > 0;

  const ambianceImages = useMemo(() => {
    if (!restaurant?.gallery?.length) return [];
    const dishImageSet = new Set(galleryImages);
    return restaurant.gallery.filter((img) => !dishImageSet.has(img));
  }, [restaurant, galleryImages]);
  const hasAmbianceGallery = ambianceImages.length > 0;

  const activeGalleryImages = galleryMode === 'plats' ? galleryImages : ambianceImages;

  const openGallery = (mode: 'plats' | 'coulisses', idx: number) => {
    setGalleryMode(mode);
    setGalleryIndex(idx);
    setGalleryOpen(true);
  };

  useEffect(() => {
    if (!galleryOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setGalleryOpen(false);
        return;
      }
      if (activeGalleryImages.length <= 1) return;
      if (event.key === 'ArrowLeft') {
        setGalleryIndex((idx) => (idx - 1 + activeGalleryImages.length) % activeGalleryImages.length);
      }
      if (event.key === 'ArrowRight') {
        setGalleryIndex((idx) => (idx + 1) % activeGalleryImages.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeGalleryImages.length, galleryOpen]);

  const customPrice = customizing
    ? customizing.price + (customizing.variants?.[selectedVariant]?.price ?? 0) +
    [...selectedSupplements].reduce((s, i) => s + (customizing.supplements?.[i]?.price ?? 0), 0)
    : 0;

  // LOT-14 (CONF-36) : « ouvert » affiché/bloquant = toggle du restaurateur
  // ET horaires réels (ancien format illisible → toggle seul, comme avant).
  const restaurantOpen = restaurant ? isEffectivelyOpen(restaurant) : true;
  const parsedHours = restaurant ? parseHours(restaurant.hours) : null;

  const handleAdd = (item: MenuItem) => {
    if (restaurant && !restaurantOpen) {
      toast.error('Ce restaurant est actuellement fermé.');
      return;
    }
    if (item.variants?.length || item.supplements?.length) {
      setCustomizing(item);
      setSelectedVariant(0);
      setSelectedSupplements(new Set());
      return;
    }
    if (addToCart(item) === 'conflict') {
      setConflictItem({ item, baseItemId: item.id });
      return;
    }
    toast.success(`${item.name} ajouté au panier`);
  };

  const confirmCustomized = () => {
    if (!customizing) return;
    const variant = customizing.variants?.[selectedVariant];
    const suppIndexes = [...selectedSupplements].sort((a, b) => a - b);
    const suppNames = suppIndexes.map((i) => customizing.supplements?.[i]?.name).filter(Boolean).join(', ');
    const fullName = [customizing.name, variant?.name, suppNames].filter(Boolean).join(' + ');
    // Chaque combinaison variante/suppléments devient une ligne distincte du
    // panier : id composite stable (indices triés), l'id d'origine restant
    // porté par baseItemId pour le serveur et les compteurs du menu.
    const isCustomized = Boolean(variant) || suppIndexes.length > 0;
    const compositeId = isCustomized
      ? `${customizing.id}::v${variant ? selectedVariant : ''}::s${suppIndexes.join('-')}`
      : customizing.id;
    const customized = { ...customizing, id: compositeId, name: fullName, price: customPrice };
    if (addToCart(customized, customizing.id) === 'conflict') {
      setConflictItem({ item: customized, baseItemId: customizing.id });
      setCustomizing(null);
      return;
    }
    toast.success(`${fullName} ajouté au panier`);
    setCustomizing(null);
  };

  const confirmReplaceCart = () => {
    if (!conflictItem) return;
    replaceCartWith(conflictItem.item, conflictItem.baseItemId);
    toast.success(`Panier remplacé — ${conflictItem.item.name} ajouté`);
    setConflictItem(null);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const menuItemsByCategory = useMemo(() => {
    const restoItems = menuItems.filter((m) => m.restaurantId === restaurant?.id);
    const groups: Record<string, MenuItem[]> = {};
    categoryOrder.forEach((cat) => {
      const items = restoItems.filter((m) => m.category === cat);
      if (items.length) groups[cat] = items;
    });
    return groups;
  }, [restaurant?.id, menuItems]);

  const hasPopularItems = useMemo(
    () => menuItems.some((m) => m.restaurantId === restaurant?.id && m.isPopular),
    [restaurant?.id, menuItems]
  );

  // Deux natures distinctes : les catégories du menu (filtres, rendues en
  // pastilles sous l'onglet Menu) et les sections de page (vrais onglets).
  const menuCategoryTabs = useMemo(
    () => [
      ...(hasPopularItems ? ['Populaires'] : []),
      ...Object.keys(menuItemsByCategory),
    ],
    [hasPopularItems, menuItemsByCategory]
  );

  const infoTabs = useMemo(() => {
    const tabs: string[] = ['À propos'];
    if (restaurant?.lat != null && restaurant?.lng != null) tabs.push('Carte');
    tabs.push('Avis');
    return tabs;
  }, [restaurant?.lat, restaurant?.lng]);

  const availableTabs = useMemo(
    () => [...menuCategoryTabs, ...infoTabs],
    [menuCategoryTabs, infoTabs]
  );

  // Derived instead of synced via effect: falls back to the first available
  // tab if the stored selection no longer exists for this restaurant's menu.
  const currentTab = availableTabs.includes(activeTab) ? activeTab : (availableTabs[0] ?? 'Populaires');
  const firstMenuTab = availableTabs.find((tab) => tab !== 'À propos' && tab !== 'Carte' && tab !== 'Avis') ?? currentTab;

  // Section active de la barre d'onglets : « Menu » regroupe toutes les
  // catégories ; on retient la dernière catégorie visitée pour y revenir.
  const currentSection = infoTabs.includes(currentTab) ? currentTab : 'Menu';
  const lastCategoryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!infoTabs.includes(currentTab)) lastCategoryRef.current = currentTab;
  }, [currentTab, infoTabs]);

  const sectionTabs = useMemo(
    () => [...(menuCategoryTabs.length > 0 ? ['Menu'] : []), ...infoTabs],
    [menuCategoryTabs, infoTabs]
  );

  const selectSection = (section: string) => {
    if (section === 'Menu') {
      const target = lastCategoryRef.current && menuCategoryTabs.includes(lastCategoryRef.current)
        ? lastCategoryRef.current
        : firstMenuTab;
      setActiveTab(target);
    } else {
      setActiveTab(section);
    }
  };

  const jumpToTab = (tab: string) => {
    setActiveTab(tab);
    window.setTimeout(() => {
      document.getElementById('restaurant-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const filteredItems = useMemo(() => {
    const restoItems = menuItems.filter((m) => m.restaurantId === restaurant?.id);
    if (currentTab === 'Populaires') {
      return restoItems.filter((m) => m.isPopular);
    }
    return restoItems.filter((m) => m.category === currentTab);
  }, [currentTab, restaurant?.id, menuItems]);

  // Quantité totale d'un plat du menu, toutes personnalisations confondues
  // (les lignes personnalisées ont un id composite mais le même baseItemId).
  const getItemQuantity = (itemId: string) => {
    return items
      .filter((i) => i.baseItemId === itemId)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  // Avis verifies lies aux commandes livrees. La note catalogue reste le repli
  // quand aucun avis dynamique n'existe encore pour ce restaurant.
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState(false);
  useEffect(() => {
    if (!restaurant?.id) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setReviewsLoading(true);
      setReviewsError(false);
      try {
        const [reviewData, summary] = await Promise.all([
          fetchRestaurantReviews(restaurant.id, { limit: 10 }),
          fetchRestaurantRatingSummary(restaurant.id),
        ]);
        if (!cancelled) {
          setReviews(reviewData);
          setReviewSummary(summary);
          setReviewsError(false);
        }
      } catch {
        if (!cancelled) {
          setReviews([]);
          setReviewSummary(null);
          setReviewsError(true);
        }
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [restaurant?.id]);

  const displayRating = reviewSummary?.ratingAvg ?? 0;
  const displayReviewCount = reviewSummary?.reviewCount ?? reviews.length;

  const ratingBreakdown = useMemo(() => {
    const total = reviewSummary?.reviewCount ?? reviews.length;
    const counts = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: reviewSummary?.breakdown?.[stars as 1 | 2 | 3 | 4 | 5]
        ?? reviews.filter((r) => r.rating === stars).length,
    }));
    return counts.map((c) => ({ ...c, pct: total > 0 ? (c.count / total) * 100 : 0 }));
  }, [reviews, reviewSummary]);

  // Partage réel : Web Share API (mobile) avec repli copie du lien.
  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: restaurant?.name ?? 'MiamExpress', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Lien du restaurant copié');
    } catch (err) {
      // Partage annulé par l'utilisateur : silencieux. Autre échec : informer.
      if ((err as Error)?.name !== 'AbortError') {
        toast.error("Impossible de partager le lien");
      }
    }
  };

  // Restaurant dont provient le panier en cours : nom pour le message de
  // conflit, minimum de commande pour le panier (CONF-10). C'est bien le
  // restaurant DU PANIER (pas forcément celui de la page affichée).
  const cartRestaurantObj = items[0]
    ? restaurants.find((r) => r.id === items[0].item.restaurantId)
    : undefined;
  const cartRestaurantName = cartRestaurantObj?.name;
  const cartMinOrder = cartRestaurantObj?.minOrder ?? 0;
  const cartDeliveryFee = cartRestaurantObj?.deliveryFee ?? restaurant?.deliveryFee ?? 0;
  const cartOrderTotal = totalPrice + cartDeliveryFee;

  // Chargement (id encore non résolu) : squelette — jamais la fiche d'un
  // autre restaurant. Id inconnu : écran "introuvable" avec porte de sortie.
  if (!restaurant) {
    if (restaurantLoading) {
      return (
        <div className="pt-[72px] min-h-screen bg-bg-secondary">
          <Skeleton className="h-[200px] sm:h-[280px] w-full rounded-none" />
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="bg-white rounded-xl border border-border-custom -mt-10 relative z-10 p-5 sm:p-6 mb-6">
              <Skeleton className="h-8 w-64 mb-3" />
              <Skeleton className="h-4 w-44 mb-4" />
              <Skeleton className="h-4 w-full max-w-[520px]" />
            </div>
            <div className="bg-white rounded-xl border border-border-custom divide-y divide-border-light overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <div className="flex-1">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-3 w-72 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-10 text-center max-w-[480px] w-full">
          <div className="w-16 h-16 rounded-full bg-green-light flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-green-primary" />
          </div>
          <h1 className="font-poppins font-bold text-text-primary text-xl mb-2">
            {t("Restaurant introuvable")}
          </h1>
          <p className="text-text-secondary font-inter text-sm mb-6">
            {t("Ce restaurant n’existe pas ou n’est plus disponible sur MiamExpress.")}
          </p>
          <Link
            to="/restaurants"
            className="inline-flex items-center justify-center bg-green-primary text-white font-inter font-semibold h-11 px-6 rounded-lg hover:bg-green-dark transition-colors"
          >
            {t("Voir les restaurants")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      {/* Cover Image */}
      <div className="relative h-[220px] sm:h-[320px] w-full overflow-hidden bg-bg-dark">
        <img
          src={restaurant.image}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
        {hasGallery && (
          <button
            type="button"
            onClick={() => openGallery('plats', 0)}
            className="absolute bottom-4 right-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-inter font-semibold text-text-primary shadow-lg backdrop-blur hover:bg-white transition-colors"
          >
            <Camera className="w-4 h-4 text-green-primary" />
            {t("Voir les photos")}
            <span className="rounded-full bg-green-light px-2 py-0.5 text-xs text-green-primary">
              {galleryImages.length}
            </span>
          </button>
        )}
      </div>

      {/* Restaurant Info Card */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] -mt-12 relative z-10 p-5 sm:p-6 mb-5"
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-green-light px-2.5 py-1 text-xs font-inter font-semibold text-green-primary">
                  <Circle className={`w-2 h-2 ${restaurantOpen ? 'fill-success text-success' : 'fill-error text-error'}`} />
                  {restaurantOpen
                    ? parsedHours ? <>{t("Ouvert jusqu’à")} {parsedHours.close}</> : 'Ouvert maintenant'
                    : restaurant.isOpen && parsedHours ? `Fermé · ouvre à ${parsedHours.open}` : 'Fermé actuellement'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gold-light px-2.5 py-1 text-xs font-inter font-semibold text-amber-700">
                  <Star className="w-3.5 h-3.5 fill-gold-accent text-gold-accent" />
                  {restaurant.verifiedReviewCount != null && restaurant.verifiedReviewCount > 0
                    ? `${restaurant.verifiedReviewCount} avis vérifiés`
                    : restaurant.verified ? 'Commandes vérifiées' : 'Nouveau'}
                </span>
              </div>
              <h1 className="font-poppins font-bold text-text-primary text-2xl sm:text-4xl mb-1 flex items-center gap-3">
                {restaurant.name}
                {restaurant.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 px-2.5 py-0.5 text-xs font-inter font-semibold border border-blue-200" title="Restaurant vérifié par MiamExpress">
                    <BadgeCheck className="w-4 h-4" />
                    {t("Vérifié")}
                  </span>
                )}
              </h1>
              <p className="text-text-secondary text-sm font-inter mb-4">
                {restaurant.tags.join(' • ')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => jumpToTab('Avis')}
                  aria-label={`Voir les avis de ${restaurant.name}`}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full bg-gold-light px-3 text-sm font-inter font-semibold text-amber-700 hover:bg-[#F8EDC9] transition-colors"
                >
                  <Star className="w-4 h-4 fill-gold-accent text-gold-accent" />
                  {displayRating.toFixed(1)}
                  <span className="font-normal text-amber-800/80">({displayReviewCount} {t("avis)")}</span>
                </button>
                <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-bg-secondary px-3 text-sm font-inter text-text-secondary">
                  <Clock className="w-4 h-4" />
                  {restaurant.deliveryTime}
                </span>
                <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-green-light px-3 text-sm font-inter font-semibold text-green-primary">
                  {restaurant.deliveryFee === 0 ? 'Livraison gratuite' : `${restaurant.deliveryFee.toLocaleString()} FCFA livraison`}
                </span>
                {restaurant.minOrder > 0 && (
                  <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-bg-secondary px-3 text-sm font-inter text-text-secondary">
                    {t("Min.")} {restaurant.minOrder.toLocaleString()} {t("FCFA")}
                  </span>
                )}
                <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-bg-secondary px-3 text-sm font-inter text-text-secondary">
                  <MapPin className="w-4 h-4" />
                  {restaurant.neighborhood}, {restaurant.city}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => restaurant && toggleFavorite(restaurant.id)}
                aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                className="w-11 h-11 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
              >
                <Heart className={`w-5 h-5 ${isFav ? 'fill-error text-error' : 'text-text-secondary'}`} />
              </button>
              <button
                type="button"
                onClick={handleShare}
                aria-label="Partager ce restaurant"
                className="w-11 h-11 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
              >
                <Share2 className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 border-y border-border-light divide-y lg:divide-y-0 lg:divide-x divide-border-light">
            <div className="py-3 lg:px-4 lg:first:pl-0">
              <p className="text-[11px] uppercase font-inter font-semibold text-text-muted">{t("Délai estimé")}</p>
              <p className="font-inter font-semibold text-text-primary text-sm mt-1">{restaurant.deliveryTime}</p>
            </div>
            <div className="py-3 lg:px-4">
              <p className="text-[11px] uppercase font-inter font-semibold text-text-muted">{t("Livraison")}</p>
              <p className="font-inter font-semibold text-text-primary text-sm mt-1">
                {restaurant.deliveryFee === 0 ? 'Gratuite' : `${restaurant.deliveryFee.toLocaleString()} FCFA`}
              </p>
            </div>
            <div className="py-3 lg:px-4">
              <p className="text-[11px] uppercase font-inter font-semibold text-text-muted">{t("Minimum")}</p>
              <p className="font-inter font-semibold text-text-primary text-sm mt-1">
                {restaurant.minOrder > 0 ? `${restaurant.minOrder.toLocaleString()} FCFA` : 'Aucun minimum'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => jumpToTab('Avis')}
              className="py-3 text-left lg:px-4 hover:bg-bg-secondary transition-colors"
            >
              <p className="text-[11px] uppercase font-inter font-semibold text-text-muted">{t("Avis clients")}</p>
              <p className="font-inter font-semibold text-text-primary text-sm mt-1">{displayReviewCount} {t("avis vérifiés")}</p>
            </button>
          </div>

          <p className="text-text-secondary text-[15px] font-inter leading-relaxed mt-5 max-w-[780px]">
            {restaurant.description}
          </p>
        </motion.div>
        {/* ── Barre d'onglets : sections de page (Menu / À propos / Carte / Avis) ── */}
        <div id="restaurant-tabs" className="sticky top-[72px] z-30 bg-bg-secondary border-b border-border-custom mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-12 xl:px-12">
          {/* Pastilles arrondies — style maison (identique aux catégories du
              menu), en remplacement du style souligné avec icônes. */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2.5" role="tablist" aria-label="Sections du restaurant">
            {sectionTabs.map((section) => (
              <button
                key={section}
                role="tab"
                aria-selected={section === currentSection}
                onClick={() => selectSection(section)}
                className={`shrink-0 px-4 h-9 rounded-full font-inter text-sm font-medium whitespace-nowrap border transition-colors cursor-pointer ${section === currentSection
                  ? 'bg-green-primary text-white border-green-primary'
                  : 'bg-white text-text-secondary border-border-custom hover:border-green-primary hover:text-green-primary'
                  }`}
              >
                {section}
              </button>
            ))}
          </div>
          {/* Catégories du menu en pastilles — filtres, pas des sections */}
          {currentSection === 'Menu' && menuCategoryTabs.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-2.5" role="tablist" aria-label="Catégories du menu">
              {menuCategoryTabs.map((cat) => (
                <button
                  key={cat}
                  role="tab"
                  aria-selected={cat === currentTab}
                  onClick={() => setActiveTab(cat)}
                  className={`snap-start shrink-0 px-3.5 h-9 rounded-full font-inter text-[13px] font-medium whitespace-nowrap border transition-colors cursor-pointer ${cat === currentTab
                    ? 'bg-green-primary text-white border-green-primary'
                    : 'bg-white text-text-secondary border-border-custom hover:border-green-primary hover:text-green-primary'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Contenu de l'onglet ── */}
        {(() => {
          const { t } = useTranslation();
          const isMenuTab = currentTab !== 'À propos' && currentTab !== 'Carte' && currentTab !== 'Avis';

          if (isMenuTab) {
            return (
              /* ── Onglet Menu ── */
              <div className="flex flex-col lg:flex-row gap-8 pb-16">
                {/* Menu Items */}
                <div className="flex-1">
                  {currentTab === 'Populaires' ? (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <h2 className="font-poppins font-semibold text-text-primary text-xl">
                            {t("Les Plus Populaires")}
                          </h2>
                          <div className="w-10 h-[3px] bg-green-primary rounded-full" />
                        </div>
                      </motion.div>
                      <div className="bg-white rounded-xl border border-border-custom overflow-hidden divide-y divide-border-light mb-8">
                        {filteredItems.map((item, i) => (
                          <MenuRow key={item.id} item={item} index={i} getQty={getItemQuantity} onAdd={handleAdd} onUpdate={updateQuantity} disabled={!restaurantOpen} />
                        ))}
                      </div>
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
                              <MenuRow key={item.id} item={item} index={i} getQty={getItemQuantity} onAdd={handleAdd} onUpdate={updateQuantity} disabled={!restaurantOpen} />
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
                            <MenuRow key={item.id} item={item} index={i} getQty={getItemQuantity} onAdd={handleAdd} onUpdate={updateQuantity} disabled={!restaurantOpen} />
                          ))
                        ) : (
                          <div className="p-8 text-center text-text-secondary font-inter">
                            {t("Aucun plat dans cette catégorie pour le moment.")}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Cart Sidebar - Desktop */}
                <div className="hidden lg:block w-[380px] shrink-0">
                  <div className="sticky top-[140px] bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-5">
                    <CartContent items={items} totalItems={totalItems} totalPrice={totalPrice} deliveryFee={cartDeliveryFee} minOrder={cartMinOrder} onUpdate={updateQuantity} onCheckout={handleCheckout} />
                  </div>
                </div>
              </div>
            );
          }

          if (currentTab === 'À propos') {
            return (
              /* ── Onglet À propos ── */
              <div className="pb-16 space-y-6">
                {/* Carte d'information */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="bg-white rounded-xl border border-border-custom p-6 sm:p-8"
                >
                  <h2 className="font-poppins font-semibold text-text-primary text-xl mb-4">
                    {t("À propos de")} {restaurant.name}
                  </h2>
                  <p className="text-text-secondary text-[15px] font-inter leading-relaxed mb-6">
                    {restaurant.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 p-3 bg-bg-secondary rounded-lg">
                      <MapPin className="w-5 h-5 text-green-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="font-inter font-semibold text-text-primary text-sm">{t("Adresse")}</p>
                        <p className="text-text-secondary text-sm font-inter">{restaurant.address}</p>
                        <p className="text-text-muted text-xs font-inter">{restaurant.neighborhood}, {restaurant.city}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-bg-secondary rounded-lg">
                      <Clock className="w-5 h-5 text-green-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="font-inter font-semibold text-text-primary text-sm">{t("Horaires")}</p>
                        <p className="text-text-secondary text-sm font-inter">{restaurant.hours}</p>
                        {parsedHours && (
                          <p className="text-text-muted text-xs font-inter">
                            {restaurantOpen ? (
                              <>{t("Ouvert · ferme à")} {parsedHours.close}</>
                            ) : (
                              <>{t("Fermé · ouvre à")} {parsedHours.open}</>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-bg-secondary rounded-lg">
                      <ShoppingCart className="w-5 h-5 text-green-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="font-inter font-semibold text-text-primary text-sm">{t("Livraison")}</p>
                        <p className="text-text-secondary text-sm font-inter">{restaurant.deliveryTime}</p>
                        <p className="text-text-muted text-xs font-inter">
                          {restaurant.deliveryFee === 0 ? 'Livraison gratuite' : `${restaurant.deliveryFee.toLocaleString()} FCFA`}
                          {restaurant.minOrder > 0 && ` · Min. ${restaurant.minOrder.toLocaleString()} FCFA`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-bg-secondary rounded-lg">
                      <Store className="w-5 h-5 text-green-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="font-inter font-semibold text-text-primary text-sm">{t("Catégorie")}</p>
                        <p className="text-text-secondary text-sm font-inter">{restaurant.category}</p>
                        <p className="text-text-muted text-xs font-inter">{restaurant.tags.join(' · ')}</p>
                      </div>
                    </div>
                    {restaurant.phone && (
                      <div className="flex items-start gap-3 p-3 bg-bg-secondary rounded-lg sm:col-span-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-primary mt-0.5 shrink-0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                        <div>
                          <p className="font-inter font-semibold text-text-primary text-sm">{t("Téléphone")}</p>
                          <a href={`tel:${restaurant.phone}`} className="text-green-primary text-sm font-inter hover:underline">{restaurant.phone}</a>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Galerie */}
                {hasGallery && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="bg-white rounded-xl border border-border-custom p-6 sm:p-8"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-green-light flex items-center justify-center">
                        <Camera className="w-4 h-4 text-green-primary" />
                      </div>
                      <h2 className="font-poppins font-semibold text-text-primary text-lg">
                        {t("Galerie de nos plats")}
                      </h2>
                      <span className="text-text-muted text-xs font-inter">
                        ({galleryImages.length} {t("photos)")}
                      </span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {galleryImages.slice(0, 4).map((img, idx) => {
                        const { t } = useTranslation();
                        const linkedItem = imageToMenuItem.get(img);
                        const isOverflowTile = idx === 3 && galleryImages.length > 4;
                        const galleryLabel = isOverflowTile
                          ? `Voir les ${galleryImages.length} photos de plats de ${restaurant.name}`
                          : linkedItem
                            ? `Ajouter ${linkedItem.name} au panier`
                            : `Voir la photo ${idx + 1} de ${restaurant.name}`;
                        return (
                          <div
                            key={idx}
                            role="button"
                            tabIndex={0}
                            aria-label={galleryLabel}
                            onClick={() => {
                              if (isOverflowTile) { openGallery('plats', idx); return; }
                              if (linkedItem) { handleAdd(linkedItem); return; }
                              openGallery('plats', idx);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (isOverflowTile) { openGallery('plats', idx); return; }
                                if (linkedItem) { handleAdd(linkedItem); return; }
                                openGallery('plats', idx);
                              }
                            }}
                            className="relative shrink-0 w-40 sm:w-48 overflow-hidden rounded-xl border border-border-custom hover:shadow-md transition-all group cursor-pointer"
                          >
                            <img
                              src={img}
                              alt={`${restaurant.name} - plat ${idx + 1}`}
                              className="w-full h-full object-cover aspect-[4/3] group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                const { t } = useTranslation();
                                (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(
                                  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#fdf5e0" width="100%" height="100%"/><text x="50%" y="50%" fill="#8a6d1f" font-size="14" text-anchor="middle" dominant-baseline="middle" font-family="Arial">Photo ${idx + 1}</text></svg>`
                                )}`;
                              }}
                            />
                            {linkedItem && !isOverflowTile && (
                              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/75 via-black/35 to-transparent opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-white text-xs font-inter font-semibold truncate">{linkedItem.name}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-white text-xs font-inter font-bold">{linkedItem.price.toLocaleString()} {t("FCFA")}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleAdd(linkedItem); }}
                                    disabled={!restaurantOpen || linkedItem.isAvailable === false}
                                    aria-label={restaurantOpen ? `Ajouter ${linkedItem.name} au panier` : 'Restaurant actuellement fermé'}
                                    className="w-10 h-10 rounded-full bg-green-primary text-white flex items-center justify-center hover:bg-green-dark hover:scale-110 transition-all shadow-md disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                                    title={restaurantOpen ? `Ajouter ${linkedItem.name} au panier` : 'Restaurant actuellement fermé'}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                            {isOverflowTile && (
                              <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-white">
                                <Camera className="w-5 h-5 mb-1" />
                                <span className="font-inter font-semibold text-sm">
                                  +{galleryImages.length - 3} {t("photos")}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Coulisses */}
                {hasAmbianceGallery && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                    className="bg-white rounded-xl border border-border-custom p-6 sm:p-8"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gold-light flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-gold-accent" />
                      </div>
                      <h2 className="font-poppins font-semibold text-text-primary text-lg">
                        {t("Coulisses du restaurant")}
                      </h2>
                      <span className="text-text-muted text-xs font-inter">
                        ({ambianceImages.length} {t("photos)")}
                      </span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {ambianceImages.map((img, idx) => (
                        <div
                          key={idx}
                          role="button"
                          tabIndex={0}
                          onClick={() => openGallery('coulisses', idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openGallery('coulisses', idx);
                            }
                          }}
                          className="relative shrink-0 w-40 sm:w-48 overflow-hidden rounded-xl border border-border-custom hover:shadow-md transition-all group cursor-pointer"
                        >
                          <img
                            src={img}
                            alt={`${restaurant.name} - coulisses ${idx + 1}`}
                            className="w-full h-full object-cover aspect-[4/3] group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              const { t } = useTranslation();
                              (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(
                                `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#fdf5e0" width="100%" height="100%"/><text x="50%" y="50%" fill="#8a6d1f" font-size="14" text-anchor="middle" dominant-baseline="middle" font-family="Arial">Photo ${idx + 1}</text></svg>`
                              )}`;
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                            <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            );
          }

          if (currentTab === 'Carte') {
            return (
              /* ── Onglet Carte ── */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="pb-16"
              >
                <div className="bg-white rounded-xl border border-border-custom overflow-hidden">
                  <LazyDeliveryMap
                    points={[
                      {
                        lat: restaurant.lat!,
                        lng: restaurant.lng!,
                        label: restaurant.name,
                        type: 'restaurant' as const,
                      } satisfies MapPoint,
                    ]}
                    height="360px"
                    scrollWheelZoom={false}
                    hideNavigation
                  />
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      <p className="font-inter font-semibold text-text-primary text-sm">{restaurant.name}</p>
                      <p className="text-text-secondary text-xs font-inter">{restaurant.address}</p>
                      {/* Ne pas répéter « quartier, ville » quand l'adresse s'y résume déjà */}
                      {restaurant.address !== `${restaurant.neighborhood}, ${restaurant.city}` && (
                        <p className="text-text-muted text-[11px] font-inter">{restaurant.neighborhood}, {restaurant.city}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <a
                        href={`https://waze.com/ul?ll=${restaurant.lat},${restaurant.lng}&navigate=yes`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 font-inter font-medium text-xs px-4 h-9 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5" /> {t("Waze")}
                      </a>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat},${restaurant.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 font-inter font-medium text-xs px-4 h-9 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5" /> {t("Google Maps")}
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          }

          if (currentTab === 'Avis') {
            return (
              /* ── Onglet Avis ── */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="pb-16"
              >
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
                          {displayRating.toFixed(1)}
                        </span>
                        <span className="text-text-secondary font-inter text-base mb-1">{t("sur 5")}</span>
                      </div>
                      <div className="flex gap-1 mb-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${i < Math.floor(displayRating)
                              ? 'fill-gold-accent text-gold-accent'
                              : i < displayRating
                                ? 'fill-gold-accent/50 text-gold-accent'
                                : 'text-border-custom'
                              }`}
                          />
                        ))}
                      </div>
                      <p className="text-text-muted text-sm font-inter mb-6">
                        {t("Basé sur")} {displayReviewCount} {t("avis")}
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
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                        <div>
                          <h3 className="font-poppins font-semibold text-text-primary text-lg">
                            {t("Avis récents")}
                          </h3>
                          <p className="text-text-muted text-xs font-inter">
                            {t("Notes enregistrées après une commande livrée.")}
                          </p>
                        </div>
                        {reviewsError && (
                          <span className="inline-flex items-center rounded-full bg-error/10 px-2.5 py-1 text-xs font-inter font-semibold text-error">
                            {t("Avis indisponibles pour le moment")}
                          </span>
                        )}
                      </div>
                      {reviewsLoading ? (
                        <div className="space-y-4" aria-label="Chargement des avis">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="py-2">
                              <div className="flex items-center gap-3 mb-3">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div className="flex-1">
                                  <Skeleton className="h-4 w-40 mb-2" />
                                  <Skeleton className="h-3 w-24" />
                                </div>
                              </div>
                              <Skeleton className="h-3 w-28 mb-2" />
                              <Skeleton className="h-4 w-full max-w-[520px]" />
                            </div>
                          ))}
                        </div>
                      ) : reviews.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border-custom bg-bg-secondary px-5 py-7 text-center">
                          <MessageSquare className="w-9 h-9 text-green-primary mx-auto mb-3" />
                          <p className="font-inter font-semibold text-text-primary text-sm mb-1">
                            {t("Aucun avis vérifié pour le moment")}
                          </p>
                          <p className="text-text-secondary font-inter text-sm max-w-[420px] mx-auto">
                            {t("Les avis apparaissent ici après une commande livrée et notée par un client.")}
                          </p>
                        </div>
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
                              <div className="flex items-start gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-green-primary text-white flex items-center justify-center font-inter font-semibold text-sm shrink-0">
                                  <Star className="w-4 h-4 fill-white" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-inter font-semibold text-text-primary text-sm">
                                      {review.authorName || 'Client vérifié'}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 bg-green-light text-green-primary text-[10px] font-inter font-semibold px-1.5 py-0.5 rounded-full">
                                      {t("Commande vérifiée")}
                                    </span>
                                    <span className="text-text-muted text-xs font-inter">
                                      {timeAgoFr(review.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-0.5 mb-2" aria-label={`${review.rating} étoiles sur 5`}>
                                {Array.from({ length: 5 }).map((_, j) => (
                                  <Star
                                    key={j}
                                    className={`w-3.5 h-3.5 ${j < review.rating ? 'fill-gold-accent text-gold-accent' : 'text-border-custom'}`}
                                  />
                                ))}
                              </div>
                              {review.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {review.tags.map((tag) => (
                                    <span key={tag} className="bg-bg-secondary text-text-secondary text-[11px] font-inter px-2 py-0.5 rounded-full">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {review.comment && (
                                <p className="text-text-primary text-[15px] font-inter leading-relaxed">
                                  {review.comment}
                                </p>
                              )}
                              {/* Réponse officielle du restaurant — affichée
                                  uniquement si publiée (modération admin) */}
                              {review.ownerReply?.status === 'published' && (
                                <div className="mt-3 ml-4 sm:ml-6 bg-bg-secondary rounded-lg p-3 border-l-2 border-green-primary">
                                  <p className="text-[11px] font-inter font-semibold text-green-primary uppercase tracking-wide mb-1">
                                    {t("Réponse de")} {restaurant.name}
                                    <span className="normal-case font-normal text-text-muted">
                                      {' '}· {timeAgoFr(review.ownerReply.createdAt)}
                                      {review.ownerReply.updatedAt && ' · modifiée'}
                                    </span>
                                  </p>
                                  <p className="text-text-primary text-sm font-inter leading-relaxed">
                                    {review.ownerReply.text}
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          }

          return null;
        })()}

        {/* Similar Restaurants */}
        <section className="pb-16">
          <h2 className="font-poppins font-bold text-text-primary text-2xl mb-6">
            {t("Vous Aimerez Aussi")}
          </h2>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4">
            {restaurants.filter((r) => r.id !== restaurant.id).slice(0, 4).map((resto) => (
              <Link
                key={resto.id}
                to={`/restaurant/${resto.slug || resto.id}`}
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
                    <span className="inline-flex items-center gap-1 bg-gold-light text-amber-700 text-xs font-inter font-medium px-2 py-0.5 rounded-full">
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
      </div >

      {/* Mobile Cart Bar — barre fine flottante une ligne, au-dessus de la
          MobileBottomNav (56px + marge) ; ≥md la nav disparaît */}
      {
        totalItems > 0 && (
          <div className="lg:hidden fixed bottom-[68px] md:bottom-3 left-3 right-3 z-40">
            <button
              type="button"
              onClick={() => setMobileCartOpen(true)}
              aria-label="Ouvrir le panier"
              title="Total avec livraison"
              className="w-full h-12 flex items-center justify-between gap-3 bg-green-primary text-white rounded-full pl-4 pr-4 shadow-[0_6px_20px_rgba(21,127,61,0.35)] hover:bg-green-dark transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <ShoppingCart className="w-4 h-4 shrink-0" />
                <span className="font-inter font-semibold text-sm truncate">
                  {totalItems} {t("article")}{totalItems > 1 ? 's' : ''} · {cartOrderTotal.toLocaleString()} {t("FCFA")}
                </span>
              </span>
              <span className="flex items-center gap-0.5 font-inter text-sm font-medium shrink-0">
                {t("Voir le panier")}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          </div>
        )
      }

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
              className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl overflow-y-auto"
              style={{ maxHeight: '82vh' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-poppins font-semibold text-lg">{t("Votre Commande")}</h3>
                <button
                  onClick={() => setMobileCartOpen(false)}
                  aria-label="Fermer le panier"
                  className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg hover:bg-bg-secondary transition-colors"
                >
                  <ChevronDown className="w-6 h-6 text-text-secondary" />
                </button>
              </div>
              <CartContent items={items} totalItems={totalItems} totalPrice={totalPrice} deliveryFee={cartDeliveryFee} minOrder={cartMinOrder} onUpdate={updateQuantity} onCheckout={handleCheckout} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* C4: Customization dialog */}
      <Dialog open={!!customizing} onOpenChange={(open) => { if (!open) setCustomizing(null); }}>
        <DialogContent className="sm:max-w-[420px] max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-poppins text-lg">{customizing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {customizing?.variants?.length ? (
              <div>
                <p className="text-sm font-inter font-medium text-text-primary mb-2">{t("Taille / Portion")}</p>
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
                <p className="text-sm font-inter font-medium text-text-primary mb-2">{t("Suppléments")}</p>
                <div className="space-y-2">
                  {customizing.supplements.map((s, i) => (
                    <label key={i} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedSupplements.has(i) ? 'border-green-primary bg-green-light' : 'border-border-custom hover:bg-bg-secondary'}`}>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={selectedSupplements.has(i)} onChange={() => { const next = new Set(selectedSupplements); if (next.has(i)) next.delete(i); else next.add(i); setSelectedSupplements(next); }} className="accent-green-primary" />
                        <span className="text-sm font-inter text-text-primary">{s.name}</span>
                      </div>
                      <span className="text-sm font-inter font-medium text-text-primary">+{s.price.toLocaleString()} {t("FCFA")}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button onClick={() => setCustomizing(null)} className="px-4 h-10 rounded-lg text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors">{t("Annuler")}</button>
            <button onClick={confirmCustomized} className="px-5 h-10 rounded-lg bg-green-primary text-white font-inter font-medium text-sm hover:bg-green-dark transition-colors">
              {t("Ajouter —")} {customPrice.toLocaleString()} {t("FCFA")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflit de restaurant : le panier ne peut contenir qu'un seul restaurant */}
      <Dialog open={!!conflictItem} onOpenChange={(open) => { if (!open) setConflictItem(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("Commencer un nouveau panier ?")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-inter text-text-secondary">
            {t("Votre panier contient des plats de")}{' '}
            <span className="font-semibold text-text-primary">{cartRestaurantName ?? 'un autre restaurant'}</span>{t(".\n            Une commande ne peut concerner qu’un seul restaurant à la fois.\n            Voulez-vous le vider et ajouter")}{' '}
            <span className="font-semibold text-text-primary">{conflictItem?.item.name}</span>
            {' '}{t("de")} <span className="font-semibold text-text-primary">{restaurant.name}</span> ?
          </p>
          <DialogFooter>
            <button onClick={() => setConflictItem(null)} className="px-4 h-10 rounded-lg text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors">{t("Garder mon panier")}</button>
            <button onClick={confirmReplaceCart} className="px-5 h-10 rounded-lg bg-green-primary text-white font-inter font-medium text-sm hover:bg-green-dark transition-colors">
              {t("Vider et ajouter")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth Choice Modal */}
      {showAuthModal && <AuthChoiceModal redirectTo="/checkout" onClose={() => setShowAuthModal(false)} />}

      {/* Gallery Lightbox */}
      {
        galleryOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setGalleryOpen(false)}
          >
            <button
              type="button"
              onClick={() => setGalleryOpen(false)}
              aria-label="Fermer la galerie"
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {activeGalleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setGalleryIndex((galleryIndex - 1 + activeGalleryImages.length) % activeGalleryImages.length); }}
                  aria-label="Photo précédente"
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setGalleryIndex((galleryIndex + 1) % activeGalleryImages.length); }}
                  aria-label="Photo suivante"
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <img
              src={activeGalleryImages[galleryIndex]}
              alt={`${restaurant.name} - photo ${galleryIndex + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                const { t } = useTranslation();
                (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect fill="#1a1a1a" width="100%" height="100%"/><text x="50%" y="50%" fill="#fff" font-size="20" text-anchor="middle" dominant-baseline="middle" font-family="Arial">Photo ${galleryIndex + 1}</text></svg>`
                )}`;
              }}
            />

            {/* Counter + thumbnails */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
              <span className="text-white/80 text-sm font-inter">
                {galleryIndex + 1} / {activeGalleryImages.length}
              </span>
              <div className="flex gap-1.5">
                {activeGalleryImages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setGalleryIndex(i); }}
                    aria-label={`Voir la photo ${i + 1}`}
                    className={`w-3 h-3 rounded-full transition-all ${i === galleryIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )
      }

    </div >
  );
}

/* Menu Row Component */
function MenuRow({
  item, index, getQty, onAdd, onUpdate, disabled = false,
}: {
  item: MenuItem;
  index: number;
  getQty: (id: string) => number;
  onAdd: (item: MenuItem) => void;
  onUpdate: (id: string, qty: number) => void;
  /** Restaurant fermé : les ajouts sont désactivés (retraits toujours possibles) */
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const qty = getQty(item.id);
  // Un plat personnalisable peut exister en plusieurs lignes du panier (ids
  // composites) : le "−" du stepper ne saurait pas laquelle décrémenter. On
  // affiche alors le total + un "+" qui rouvre la personnalisation ; les
  // quantités se règlent ligne par ligne dans le panier.
  const customizable = Boolean(item.variants?.length || item.supplements?.length);
  const itemAvailable = item.isAvailable !== false;
  const canAdd = itemAvailable && !disabled;
  const unavailableLabel = itemAvailable ? undefined : 'Plat indisponible';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={`flex items-center gap-4 p-4 hover:bg-bg-secondary transition-colors group ${itemAvailable ? '' : 'opacity-70'}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-inter font-semibold text-text-primary text-base truncate">
            {item.name}
          </h4>
          {item.isPopular && (
            <span className="shrink-0 bg-gold-light text-amber-700 text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full">
              {t("Populaire")}
            </span>
          )}
          {customizable && (
            <span className="shrink-0 bg-green-light text-green-primary text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full">
              {t("Options")}
            </span>
          )}
          {!itemAvailable && (
            <span className="shrink-0 bg-error/10 text-error text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full">
              {t("Indisponible")}
            </span>
          )}
        </div>
        <p className="text-text-secondary text-sm font-inter line-clamp-2 mb-2 leading-relaxed">
          {item.description}
        </p>
        <span className="font-inter font-bold text-text-primary text-base">
          {item.price.toLocaleString()} {t("FCFA")}
        </span>
      </div>
      <div className="shrink-0 relative">
        <img
          src={item.image}
          alt={item.name}
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover ${itemAvailable ? '' : 'grayscale'}`}
        />
        {qty === 0 ? (
          <button
            type="button"
            onClick={() => onAdd(item)}
            disabled={!canAdd}
            aria-label={!itemAvailable ? 'Plat indisponible' : disabled ? 'Restaurant actuellement fermé' : `Ajouter ${item.name} au panier`}
            title={unavailableLabel ?? (disabled ? 'Restaurant actuellement fermé' : undefined)}
            className="absolute -bottom-2 -right-2 w-11 h-11 rounded-full bg-green-primary text-white flex items-center justify-center shadow-md hover:bg-green-dark hover:scale-110 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : customizable ? (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white rounded-full shadow-md border border-border-custom px-1 py-0.5">
            <span className="text-text-primary font-inter font-semibold text-xs w-5 text-center" aria-label={`${qty} au panier`}>
              {qty}
            </span>
            <button
              type="button"
              onClick={() => onAdd(item)}
              disabled={!canAdd}
              aria-label={!itemAvailable ? 'Plat indisponible' : disabled ? 'Restaurant actuellement fermé' : `Ajouter une autre personnalisation de ${item.name}`}
              title={unavailableLabel ?? (disabled ? 'Restaurant actuellement fermé' : undefined)}
              className="w-8 h-8 rounded-full bg-green-primary text-white flex items-center justify-center hover:bg-green-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white rounded-full shadow-md border border-border-custom px-1 py-0.5">
            <button
              type="button"
              onClick={() => onUpdate(item.id, qty - 1)}
              aria-label={qty === 1 ? `Retirer ${item.name} du panier` : `Retirer une unité de ${item.name}`}
              className="w-8 h-8 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
            >
              {qty === 1 ? <Trash2 className="w-3 h-3 text-error" /> : <Minus className="w-3 h-3" />}
            </button>
            <span className="text-text-primary font-inter font-semibold text-xs w-5 text-center">{qty}</span>
            <button
              type="button"
              onClick={() => onAdd(item)}
              disabled={!canAdd}
              aria-label={!itemAvailable ? 'Plat indisponible' : disabled ? 'Restaurant actuellement fermé' : `Ajouter ${item.name}`}
              title={unavailableLabel ?? (disabled ? 'Restaurant actuellement fermé' : undefined)}
              className="w-8 h-8 rounded-full bg-green-primary text-white flex items-center justify-center hover:bg-green-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
  items, totalItems, totalPrice, deliveryFee, minOrder = 0, onUpdate, onCheckout,
}: {
  items: { item: MenuItem; quantity: number }[];
  totalItems: number;
  totalPrice: number;
  deliveryFee: number;
  /** Minimum de commande du restaurant du panier (0 = aucune contrainte) */
  minOrder?: number;
  onUpdate: (id: string, qty: number) => void;
  onCheckout: () => void;
}) {
  const { t } = useTranslation();
  const belowMinimum = minOrder > 0 && totalPrice < minOrder;
  const missingForMinimum = belowMinimum ? minOrder - totalPrice : 0;
  const orderTotal = totalPrice + deliveryFee;

  if (totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <ShoppingCart className="w-12 h-12 text-text-muted mb-3" />
        <p className="text-text-secondary font-inter font-medium text-base mb-1">
          {t("Votre panier est vide")}
        </p>
        <p className="text-text-muted font-inter text-sm text-center">
          {t("Ajoutez des plats délicieux à votre commande")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-poppins font-semibold text-text-primary text-lg mb-4">
        {t("Votre Commande")}
        <span className="ml-2 text-text-muted text-sm font-inter font-normal">
          ({totalItems} {t("article")}{totalItems > 1 ? 's' : ''})
        </span>
      </h3>
      <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
        {items.map(({ item, quantity }) => (
          <div key={item.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-inter text-sm text-text-primary truncate">{item.name}</p>
              <p className="text-text-muted text-xs font-inter">
                {(item.price * quantity).toLocaleString()} {t("FCFA")}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onUpdate(item.id, quantity - 1)}
                aria-label={quantity === 1 ? `Retirer ${item.name} du panier` : `Retirer une unité de ${item.name}`}
                className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
              >
                {quantity === 1 ? <Trash2 className="w-3 h-3 text-error" /> : <Minus className="w-3 h-3" />}
              </button>
              <span className="text-text-primary font-inter font-semibold text-sm w-5 text-center">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdate(item.id, quantity + 1)}
                aria-label={`Ajouter une unité de ${item.name}`}
                className="w-10 h-10 rounded-full bg-bg-secondary flex items-center justify-center hover:bg-border-light transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border-light pt-4 space-y-2">
        <div className="flex justify-between text-sm font-inter text-text-secondary">
          <span>{t("Sous-total")}</span>
          <span>{totalPrice.toLocaleString()} {t("FCFA")}</span>
        </div>
        <div className="flex justify-between text-sm font-inter">
          <span className="text-text-secondary">{t("Livraison")}</span>
          <span className={deliveryFee === 0 ? 'text-success font-medium' : 'text-text-primary font-medium'}>
            {deliveryFee === 0 ? 'Gratuit' : `${deliveryFee.toLocaleString()} FCFA`}
          </span>
        </div>
        <div className="border-t border-border-light pt-2 flex justify-between font-inter">
          <span className="text-text-primary font-bold text-lg">{t("Total")}</span>
          <span className="text-text-primary font-bold text-lg">{orderTotal.toLocaleString()} {t("FCFA")}</span>
        </div>
      </div>
      {belowMinimum && (
        <p className="mt-3 bg-gold-light text-amber-700 rounded-lg px-3 py-2 text-xs font-inter" role="status">
          <span className="font-semibold">{t("Commande minimum :")} {minOrder.toLocaleString()} {t("FCFA.")}</span>{' '}
          {t("Ajoutez")} {missingForMinimum.toLocaleString()} {t("FCFA d’articles.")}
        </p>
      )}
      <button
        type="button"
        onClick={onCheckout}
        disabled={belowMinimum}
        title={belowMinimum ? `Commande minimum : ${minOrder.toLocaleString()} FCFA` : undefined}
        className="w-full mt-4 bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {t("Commander —")} {orderTotal.toLocaleString()} {t("FCFA")}
      </button>
    </div>
  );
}
