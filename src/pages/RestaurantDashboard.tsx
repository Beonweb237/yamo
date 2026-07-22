import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store, Clock, RefreshCw, Trash2, Plus, Upload, X, Volume2, VolumeX,
  Search, ImageOff, Pencil, TrendingUp,
  PackageCheck, AlertCircle, DollarSign, ChefHat, Star, ShoppingBag, Flame, ArrowDown, Eye, EyeOff, LayoutGrid, List, SlidersHorizontal, ArrowUpDown,
  XCircle, Users, UserPlus, Phone, Bike, UserCheck, Coins,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CHART_PRIMARY, CHART_ACCENT, CHART_GRID, CHART_TICK, CHART_TOOLTIP_STYLE } from '../lib/chartTheme';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useSeo } from '../hooks/useSeo';
import PageHeader from '../components/PageHeader';
import { ZoneAlertBanner, useZoneAlert } from '../components/ZoneAlertBanner';
import { fetchRestaurantsByOwner, createMenuItem, deleteMenuItem, fetchMenuItems, updateMenuItem, updateRestaurantProfile, updateRestaurantOpenStatus } from '../lib/catalog';
import { Switch } from '../components/ui/switch';
import { usePolling } from '../hooks/usePolling';
import { useRestaurants } from '../hooks/useCatalog';
import { restaurantMenuCategories, dishCatalog } from '../data/mockData';
import type { MenuItem, Restaurant } from '../data/mockData';
import { confirmOrderWithPreparation, fetchOrdersByRestaurant, getOrderPreparationMessage, updateOrderStatus, cancelOrder, getDriverPhone, getDriverName, confirmGuaranteeReceived, rejectGuaranteeDeclaration, type Order, type OrderStatus } from '../lib/orders';
import { getPreferredDrivers, addPreferredDriver, removePreferredDriver, fetchDriversStats, getOwnDriverIds, addOwnDriver, removeOwnDriver, type DriverStats } from '../lib/drivers';
import { processFormImage } from '../lib/media';
import { parseHours, formatHours, isWithinHours } from '../lib/hours';
import { getBalance, grantWelcomeBonus, requestRecharge, fetchLedger, listRecharges, InsufficientPointsError, type PointsBalance, type PointsLedgerEntry, type RechargeRequest, type RechargeMethod } from '../lib/points';
import { POINTS_CONFIG, commissionForSubtotal } from '../data/launchConfig';
import { getRechargeMomoNumber } from '../lib/tracking';
import { displayCameroonPhone, normalizeCameroonPhone, phoneForTel } from '../lib/phone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  fetchRestaurantRatingSummary,
  fetchRestaurantReviews,
  submitOwnerReply,
  deleteOwnerReply,
  reportReview,
  countUnseenReviews,
  markRestaurantReviewsSeen,
  type Review,
  type ReviewSummary,
} from '../lib/reviews';
import { Skeleton } from '../components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { useTranslation } from "react-i18next";

const statusFlow: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivering', 'delivered'];

const statusLabels: Record<OrderStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête',
  picked_up: 'Récupérée',
  delivering: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

const menuCategories = restaurantMenuCategories;
const prepTimeOptions = [10, 15, 20, 30, 45, 60];
const defaultPrepTime = 25;

// Le restaurant ne pilote le cycle que jusqu'à « Prête » : la récupération et
// la livraison appartiennent au livreur (CONF-05 — un resto ne peut pas
// marquer une commande « livrée »).
const RESTAURANT_LAST_STATUS: OrderStatus = 'ready';

function nextStatus(status: OrderStatus): OrderStatus | null {
  if (status === RESTAURANT_LAST_STATUS) return null;
  const idx = statusFlow.indexOf(status);
  if (idx === -1 || idx === statusFlow.length - 1) return null;
  const next = statusFlow[idx + 1];
  // Garde-fou : ne jamais proposer un statut au-delà de la borne restaurant.
  return statusFlow.indexOf(next) > statusFlow.indexOf(RESTAURANT_LAST_STATUS) ? null : next;
}

// Une fois la commande récupérée par le livreur, le restaurant ne peut plus
// l'annuler (le plat est en route — tout litige passe par l'admin).
function restaurantCanCancel(status: OrderStatus): boolean {
  return ['pending', 'confirmed', 'preparing', 'ready'].includes(status);
}

type Tab = 'orders' | 'menu' | 'profile' | 'finances' | 'drivers';

export default function RestaurantDashboard({ tab: initialTab }: { tab?: Tab }) {
    const { t } = useTranslation();
  const { user } = useAuth();
  useSeo({ title: t('Espace Restaurateur'), noindex: true });
  const { restaurants: allRestaurants } = useRestaurants();
  const [ownedRestaurants, setOwnedRestaurants] = useState<Restaurant[]>([]);
  const restaurants = user?.role === 'admin' ? allRestaurants : ownedRestaurants;
  const [restaurantId, setRestaurantId] = useState('');
  const [tab, setTab] = useState<Tab>(initialTab ?? 'orders');

  useEffect(() => {
    if (initialTab) setTab(initialTab);
    else setTab('orders');
  }, [initialTab]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [deleteTargetItem, setDeleteTargetItem] = useState<MenuItem | null>(null);
  const [prepTimes, setPrepTimes] = useState<Record<string, number>>({});
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  // Livraison directe (restaurant → ses propres livreurs) : liste des
  // livreurs internes désignés (onglet Livreurs) + choix par commande au
  // moment de la marquer "Prête". Le client ne voit aucune différence.
  const [ownDriverIds, setOwnDriverIds] = useState<string[]>([]);
  const [deliveryModes, setDeliveryModes] = useState<Record<string, 'platform' | 'restaurant'>>({});
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('yamo_resto_sound') !== 'false');

  useEffect(() => {
    localStorage.setItem('yamo_resto_sound', String(soundEnabled));
  }, [soundEnabled]);

  // Notification in-app « nouveaux avis » : au chargement du dashboard, on
  // compare les avis publiés à la date du dernier passage sur la section Avis
  // (yamo_resto_reviews_seen). Un toast par restaurant et par session ; la
  // section (onglet Profil) marque les avis comme vus.
  const notifiedReviewsFor = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!restaurantId || tab === 'profile' || notifiedReviewsFor.current.has(restaurantId)) return;
    notifiedReviewsFor.current.add(restaurantId);
    fetchRestaurantReviews(restaurantId, { limit: 20 })
      .then((reviews) => {
        const unseen = countUnseenReviews(restaurantId, reviews);
        if (unseen > 0) {
          toast.info(
            unseen === 1
              ? 'Nouvel avis client reçu — consultez-le dans l\'onglet Profil.'
              : `${unseen} nouveaux avis clients — consultez-les dans l'onglet Profil.`
          );
        }
      })
      .catch(() => { /* silencieux : simple notification de confort */ });
  }, [restaurantId, tab]);

  // Patch local des champs restaurant modifiés (statut ouvert/fermé, profil) :
  // remplace le window.location.reload() historique et couvre le cas admin
  // (la liste useRestaurants n'est pas re-fetchable à la demande).
  const [restaurantPatch, setRestaurantPatch] = useState<Record<string, Partial<Restaurant>>>({});
  const applyRestaurantPatch = useCallback((id: string, patch: Partial<Restaurant>) => {
    setRestaurantPatch((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);
  const baseActiveRestaurant = restaurants.find(r => r.id === restaurantId);
  const activeRestaurant = baseActiveRestaurant
    ? { ...baseActiveRestaurant, ...restaurantPatch[baseActiveRestaurant.id] }
    : undefined;

  // ── Série PTS : solde de points du resto ──────────────────────────────
  // Bonus de bienvenue idempotent à la 1re ouverture, puis solde re-dérivé du
  // ledger à chaque rafraîchissement des commandes (hold/settle le modifient).
  const navigate = useNavigate();
  const [pointsBalance, setPointsBalance] = useState<PointsBalance | null>(null);
  const lowBalanceToastShown = useRef(false);

  const refreshPoints = useCallback(async (restaurantId: string) => {
    const balance = await getBalance(restaurantId);
    setPointsBalance(balance);
    // Le blocage réel est par commande (le solde doit couvrir sa commission),
    // calculé sur chaque carte de commande via commissionForSubtotal.
    if (
      balance.available < POINTS_CONFIG.LOW_BALANCE_THRESHOLD_FCFA &&
      !lowBalanceToastShown.current
    ) {
      lowBalanceToastShown.current = true;
      toast.warning(`Solde faible : ${balance.available.toLocaleString()} FCFA`, {
        description: 'Rechargez pour continuer à accepter des commandes.',
      });
    }
  }, []);

  useEffect(() => {
    if (!activeRestaurant) return;
    void (async () => {
      await grantWelcomeBonus(activeRestaurant.id);
      await refreshPoints(activeRestaurant.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRestaurant?.id]);

  // Chaque rafraîchissement des commandes peut refléter un hold/settle :
  // re-dériver le solde (lecture localStorage, coût négligeable en mock).
  // Différé d'un tick — même motif que la géoloc de DishResults : pas de
  // setState synchrone dans le corps de l'effet.
  useEffect(() => {
    if (!activeRestaurant) return;
    const t = setTimeout(() => void refreshPoints(activeRestaurant.id), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  // Toggle Ouvert/Fermé accessible depuis le header (CONF-13) — la fermeture
  // demande confirmation (elle coupe la prise de commandes immédiatement).
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const applyOpenStatus = async (nextOpen: boolean) => {
    if (!activeRestaurant) return;
    setTogglingStatus(true);
    try {
      await updateRestaurantOpenStatus(activeRestaurant.id, nextOpen);
      applyRestaurantPatch(activeRestaurant.id, { isOpen: nextOpen });
      toast.success(nextOpen
        ? 'Restaurant ouvert — vous recevez à nouveau les commandes.'
        : 'Restaurant fermé temporairement — plus aucune commande entrante.');
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleToggleOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      setConfirmCloseOpen(true);
      return;
    }
    void applyOpenStatus(true);
  };
  const { disabledZones } = useZoneAlert(activeRestaurant?.id);

  const loadMenu = useCallback(async () => {
    if (!restaurantId) return;
    setMenuLoading(true);
    const data = await fetchMenuItems(restaurantId, { includeUnavailable: true });
    setMenuItems(data);
    setMenuLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const loadOwnDrivers = useCallback(() => {
    if (!restaurantId) return;
    getOwnDriverIds(restaurantId).then(setOwnDriverIds);
  }, [restaurantId]);

  useEffect(() => {
    loadOwnDrivers();
  }, [loadOwnDrivers]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') return;
    fetchRestaurantsByOwner(user.id).then((list) => {
      setOwnedRestaurants(list);
      if (list.length > 0 && !restaurantId) {
        setRestaurantId(list[0].id);
      }
    });
  }, [user, restaurantId]);

  // Resync quand la liste change (useRestaurants rend le mock puis swap vers
  // l'API) : un id figé sur l'ancienne liste laisserait activeRestaurant
  // undefined et aucun contenu d'onglet ne se rendrait.
  useEffect(() => {
    if (restaurants.length === 0) return;
    if (!restaurantId || !restaurants.some((r) => r.id === restaurantId)) {
      setRestaurantId(restaurants[0].id);
    }
  }, [restaurants, restaurantId]);

  // Alerte nouvelle commande : bip + toast dès qu'une commande 'pending'
  // inconnue apparaît (KPI business plan : confirmation < 3 min).
  const knownOrderIdsRef = useRef<Set<string> | null>(null);

  const playNewOrderSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playTone(880, 0, 0.2);
      playTone(1174, 0.25, 0.3);
    } catch {
      // Audio bloqué par le navigateur : le toast reste visible
    }
  }, [soundEnabled]);

  const loadOrders = useCallback(async () => {
    if (!restaurantId) return;
    const data = await fetchOrdersByRestaurant(restaurantId);

    const known = knownOrderIdsRef.current;
    if (known) {
      const newPending = data.filter((o) => o.status === 'pending' && !known.has(o.id));
      if (newPending.length > 0) {
        playNewOrderSound();
        toast.info(
          newPending.length === 1
            ? `Nouvelle commande #${newPending[0].id.slice(0, 8)} — ${newPending[0].total.toLocaleString()} FCFA`
            : `${newPending.length} nouvelles commandes en attente`,
          { duration: 10000 },
        );
      }
    }
    knownOrderIdsRef.current = new Set(data.map((o) => o.id));

    setOrders(data);
    setLoading(false);
  }, [restaurantId, playNewOrderSound]);

  usePolling(loadOrders, 15000);

  const handleConfirm = async (order: Order) => {
    const minutes = prepTimes[order.id] ?? defaultPrepTime;
    setProcessingOrderId(order.id);
    try {
      await confirmOrderWithPreparation(order.id, minutes);
      await loadOrders();
    } catch (err) {
      // Série PTS : solde épuisé entre l'affichage et le clic (cas limite).
      if (err instanceof InsufficientPointsError) {
        toast.error(err.message, {
          action: { label: 'Recharger', onClick: () => navigate('/partenaires/dashboard/finances') },
        });
      } else {
        toast.error("Impossible d'accepter la commande. Réessayez.");
      }
    } finally {
      setProcessingOrderId(null);
      if (activeRestaurant) void refreshPoints(activeRestaurant.id);
    }
  };

  const handleAdvance = async (order: Order) => {
    const next = nextStatus(order.status);
    if (!next) return;
    setProcessingOrderId(order.id);
    try {
      // Le mode ne compte que pour la transition vers "Prête" — orders.ts
      // l'ignore pour les autres statuts.
      await updateOrderStatus(order.id, next, deliveryModes[order.id]);
      await loadOrders();
    } catch (err) {
      // Série PTS : garde « garantie non confirmée » (et toute autre erreur de transition)
      toast.error((err as Error).message || 'Impossible de mettre à jour la commande.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Annulation restaurant avec motif obligatoire (CONF-12) — le motif est
  // visible par le client et par l'admin.
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDetails, setCancelDetails] = useState('');
  const cancelReasonComplete = cancelReason !== '' && (cancelReason !== 'Autre' || cancelDetails.trim() !== '');

  const openCancelDialog = (order: Order) => {
    setCancelReason('');
    setCancelDetails('');
    setCancelTarget(order);
  };

  const handleCancel = async (order: Order) => {
    if (!cancelReasonComplete) return;
    setProcessingOrderId(order.id);
    try {
      const fullReason = cancelReason === 'Autre' ? cancelDetails.trim() : cancelReason;
      await cancelOrder(order.id, fullReason, 'restaurant');
      await loadOrders();
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    await deleteMenuItem(id);
    loadMenu();
    toast.success('Plat mis en corbeille', { description: 'Récupérable pendant 7 jours.' });
  };

  const confirmDeleteMenuItem = () => {
    if (deleteTargetItem) {
      handleDeleteMenuItem(deleteTargetItem.id);
      setDeleteTargetItem(null);
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
  const todayRevenue = orders
    .filter(o => o.status === 'delivered' && new Date(o.createdAt).toDateString() === new Date().toDateString())
    .reduce((s, o) => s + o.subtotal, 0);

  return (
    <div className="pt-[72px] min-h-screen bg-gradient-to-b from-green-50/50 to-bg-secondary">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          icon={ChefHat}
          title="Espace Restaurant"
          subtitle={activeRestaurant && (
            <span className={`inline-flex items-center gap-1 text-xs font-inter px-2 py-0.5 rounded-full ${activeRestaurant.isOpen ? 'bg-white/20 text-white' : 'bg-black/20 text-white'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${activeRestaurant.isOpen ? 'bg-white' : 'bg-white/60'}`} />
              {activeRestaurant.isOpen ? 'Ouvert' : 'Fermé'}
            </span>
          )}
          action={
            <div className="flex items-center gap-2">
              {pointsBalance !== null && (
                <button
                  onClick={() => navigate('/partenaires/dashboard/finances')}
                  title={`${pointsBalance.available.toLocaleString()} FCFA disponibles${pointsBalance.held > 0 ? ` · ${pointsBalance.held.toLocaleString()} réservés` : ''} — voir / recharger`}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-inter font-semibold backdrop-blur-sm transition-colors ${pointsBalance.available < POINTS_CONFIG.LOW_BALANCE_THRESHOLD_FCFA
                    ? 'bg-error/80 hover:bg-error text-white'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                    }`}
                >
                  <Coins className="w-4 h-4" />
                  {pointsBalance.available.toLocaleString()} {t("FCFA")}
                </button>
              )}
              <button onClick={() => setSoundEnabled(!soundEnabled)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-inter font-medium bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm transition-colors"
                title={soundEnabled ? 'Son activé' : 'Son désactivé'}>
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button onClick={loadOrders}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-inter font-medium px-3 py-2 rounded-lg backdrop-blur-sm transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> {t("Actualiser")}
              </button>
            </div>
          }
        />

        <ZoneAlertBanner zones={disabledZones} />

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: AlertCircle, value: pendingOrders, label: 'En attente', color: pendingOrders > 0 ? 'text-amber-600 bg-amber-50' : 'text-text-muted bg-bg-secondary' },
            { icon: PackageCheck, value: activeOrders, label: 'Actives', color: 'text-blue-600 bg-blue-50' },
            { icon: DollarSign, value: `${todayRevenue.toLocaleString()} FCFA`, label: 'Aujourd\'hui', color: 'text-green-600 bg-green-50' },
            { icon: Star, value: menuItems.length, label: 'Plats au menu', color: 'text-purple-600 bg-purple-50' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-border-custom shadow-sm flex items-center gap-3 p-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="font-poppins font-bold text-text-primary text-sm">{s.value}</p>
                <p className="text-text-muted text-[10px] font-inter">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {restaurants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-10 text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-green-light flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-green-primary" />
            </div>
            <p className="text-text-secondary font-inter font-medium">
              {t("Aucun restaurant associé à votre compte. Contactez le support MiamExpress.")}
            </p>
          </div>
        ) : (
          <>
            {/* Restaurant Selector + Status */}
            <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-9 h-9 rounded-lg bg-green-light flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4 text-green-primary" />
                </div>
                <select
                  value={restaurantId}
                  onChange={(e) => {
                    setRestaurantId(e.target.value);
                    setLoading(true);
                  }}
                  className="flex-1 sm:w-[250px] bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-[15px] outline-none"
                >
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              {activeRestaurant && (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className={`text-sm font-inter font-semibold ${activeRestaurant.isOpen ? 'text-green-primary' : 'text-error'}`}>
                    {activeRestaurant.isOpen ? 'Ouvert' : 'Fermé'}
                  </span>
                  {/* LOT-14 : le badge client combine toggle ET horaires — prévenir
                      le restaurateur quand le toggle dit « Ouvert » hors plage. */}
                  {activeRestaurant.isOpen && isWithinHours(activeRestaurant.hours) === false && (
                    <span className="text-[11px] font-inter bg-gold-light text-amber-700 px-2 py-0.5 rounded-full">
                      {t("Hors horaires (")}{activeRestaurant.hours}{t(") — affiché « Fermé » aux clients")}
                    </span>
                  )}
                  <Switch
                    checked={activeRestaurant.isOpen}
                    onCheckedChange={handleToggleOpen}
                    disabled={togglingStatus}
                    aria-label={activeRestaurant.isOpen ? 'Fermer temporairement le restaurant' : 'Ouvrir le restaurant'}
                  />
                </div>
              )}
            </div>

            {/* Navigation par la sidebar uniquement (CONF-13) — la barre
                d'onglets interne dupliquait la sidebar et l'onglet Livreurs
                n'avait pas d'URL. Chaque onglet est désormais une route. */}

            {tab === 'orders' ? (
              <>
                {/* Série PTS : alerte solde faible — le resto doit anticiper la recharge */}
                {pointsBalance !== null && pointsBalance.available < POINTS_CONFIG.LOW_BALANCE_THRESHOLD_FCFA && (
                  <div className="flex items-center justify-between gap-3 bg-gold-light border border-gold-accent/40 rounded-xl px-4 py-3 mb-4">
                    <span className="text-amber-700 text-sm font-inter">
                      <span className="font-semibold">{t("Solde faible :")} {pointsBalance.available.toLocaleString()} {t("FCFA")}.</span>{' '}
                      {t("Chaque commande livrée prélève 15 % de commission.")}
                    </span>
                    <button
                      onClick={() => navigate('/partenaires/dashboard/finances')}
                      className="shrink-0 bg-green-primary hover:bg-green-dark text-white text-sm font-inter font-semibold px-4 min-h-11 rounded-lg transition-colors"
                    >
                      {t("Recharger")}
                    </button>
                  </div>
                )}
                {loading ? (
                  <div className="space-y-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="bg-white rounded-xl border border-border-custom p-5">
                        <Skeleton className="h-4 w-32 mb-3" />
                        <Skeleton className="h-8 w-full mb-3" />
                        <Skeleton className="h-9 w-40" />
                      </div>
                    ))}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-10 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-light flex items-center justify-center mx-auto mb-4">
                      <PackageCheck className="w-8 h-8 text-green-primary" />
                    </div>
                    <p className="text-text-secondary font-inter font-medium mb-1">
                      {t("👋 En attente de commandes")}
                    </p>
                    <p className="text-text-muted text-xs font-inter">
                      {t("Vos clients peuvent commander dès maintenant. Vérifiez votre statut « Ouvert ».")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => {
                      const next = nextStatus(order.status);
                      // Commission MiamExpress (15 %) de CETTE commande + solde suffisant ?
                      const orderCommission = commissionForSubtotal(order.subtotal);
                      const canAffordOrder = (pointsBalance?.available ?? 0) >= orderCommission;
                      const isFinal = order.status === 'delivered' || order.status === 'cancelled';
                      const ageMs = Date.now() - new Date(order.createdAt).getTime();
                      const ageMin = Math.round(ageMs / 60000);
                      const urgencyColor =
                        ageMin > 15 ? 'border-l-red-500' : ageMin > 5 ? 'border-l-amber-500' : 'border-l-green-500';
                      const ageColor =
                        ageMin > 15 ? 'text-error' : ageMin > 5 ? 'text-amber-700' : 'text-green-primary';
                      const prepMessage = getOrderPreparationMessage(order);
                      const selectedPrepTime = prepTimes[order.id] ?? defaultPrepTime;
                      const isProcessing = processingOrderId === order.id;
                      return (
                        <div key={order.id} className={`bg-white rounded-2xl border border-border-custom shadow-sm hover:shadow-md transition-shadow border-l-4 ${urgencyColor} p-5`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${ageMin > 15 ? 'bg-error/10' : ageMin > 5 ? 'bg-amber-50' : 'bg-green-light'}`}>
                                <Clock className={`w-4 h-4 ${ageColor}`} />
                              </div>
                              <span className="font-inter font-semibold text-text-primary text-sm">#{order.id.slice(0, 8)}</span>
                            </div>
                            <span className={`text-xs font-inter font-medium px-2.5 py-1 rounded-full ${order.status === 'cancelled' ? 'bg-error/10 text-error' : 'bg-green-light text-green-primary'}`}>
                              {statusLabels[order.status]}
                            </span>
                          </div>
                          {order.status === 'cancelled' && order.cancellationReason && (
                            <p className="bg-error/5 text-text-secondary rounded-lg px-3 py-2 mb-2 text-xs font-inter">
                              {t("Annulée par")} {order.cancelledBy === 'customer' ? 'le client' : order.cancelledBy === 'restaurant' ? 'vous' : "l'équipe MiamExpress"}
                              {' '}{t("· Motif :")} <span className="font-medium text-text-primary">{order.cancellationReason}</span>
                            </p>
                          )}
                          <div className="space-y-1 mb-2">
                            {order.items.map((it, i) => (
                              <p key={i} className="text-text-secondary text-sm font-inter">
                                {it.quantity} × {it.name}
                              </p>
                            ))}
                          </div>
                          {order.address?.fullText && (
                            <p className="text-text-muted text-xs font-inter mb-1">
                              📍 {order.address.fullText}
                            </p>
                          )}
                          {order.recipient && (
                            <div className="rounded-lg bg-green-light/60 px-3 py-2 mb-2 text-xs font-inter text-text-secondary">
                              <p className="flex items-center gap-1 font-semibold text-text-primary">
                                <Users className="w-3.5 h-3.5 text-green-primary" />
                                {t("Pour")} {order.recipient.name || 'bénéficiaire'}{order.recipient.phone ? ` · ${order.recipient.phone}` : ''}
                              </p>
                              {order.recipient.contactInstructions && (
                                <p className="mt-1 text-text-muted">{order.recipient.contactInstructions}</p>
                              )}
                            </div>
                          )}
                          {order.notes && (
                            <p className="text-text-muted text-xs font-inter mb-1">
                              📝 {order.notes}
                            </p>
                          )}
                          {/* Contact client limité aux commandes actives — masqué une fois
                              livrée/annulée pour éviter un accès permanent au numéro. */}
                          {!isFinal && order.contactPhone && (
                            <a
                              href={`tel:${phoneForTel(order.contactPhone)}`}
                              className="inline-flex items-center gap-1.5 text-green-primary text-xs font-inter font-medium mb-1 hover:underline"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              {t("Appeler le client ·")} {displayCameroonPhone(order.contactPhone)}
                            </a>
                          )}
                          {prepMessage && (
                            <p className="flex items-center gap-1 text-text-secondary text-xs font-inter mb-2">
                              <Clock className="w-3.5 h-3.5 text-gold-accent" />
                              {prepMessage}
                            </p>
                          )}
                          <div className="flex items-center justify-between border-t border-border-light pt-3 mb-3">
                            <span className={`flex items-center gap-1 text-xs font-inter font-medium ${ageColor}`}>
                              <Clock className="w-3.5 h-3.5" />
                              {ageMin < 1 ? 'À l\'instant' : `il y a ${formatDistanceToNow(new Date(order.createdAt), { locale: fr })}`}
                            </span>
                            <span className="font-inter font-bold text-text-primary text-sm">
                              {order.total.toLocaleString()} {t("FCFA")}
                            </span>
                          </div>
                          {!isFinal && (
                            <div className="space-y-2">
                              {order.status === 'pending' ? (
                                <>
                                  <div className="flex flex-wrap gap-1.5">
                                    {prepTimeOptions.map((minutes) => (
                                      <button
                                        key={minutes}
                                        type="button"
                                        onClick={() => setPrepTimes((prev) => ({ ...prev, [order.id]: minutes }))}
                                        className={`px-3 h-8 rounded-full text-xs font-inter font-semibold transition-colors ${selectedPrepTime === minutes
                                          ? 'bg-green-primary text-white'
                                          : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                                          }`}
                                      >
                                        {minutes} {t("min")}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleConfirm(order)}
                                      disabled={isProcessing || !canAffordOrder}
                                      title={!canAffordOrder ? `Solde insuffisant : cette commande prélève ${orderCommission.toLocaleString()} FCFA de commission` : undefined}
                                      className="flex-1 bg-green-primary text-white font-inter font-medium text-sm h-10 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      {isProcessing ? 'Confirmation...' : `Accepter — prêt dans ${selectedPrepTime} min`}
                                    </button>
                                    <button
                                      onClick={() => openCancelDialog(order)}
                                      disabled={isProcessing}
                                      className="px-4 h-10 rounded-lg border border-error text-error font-inter font-medium text-sm hover:bg-error/5 transition-colors disabled:opacity-60"
                                    >
                                      {t("Refuser")}
                                    </button>
                                  </div>
                                  {/* Série PTS : solde épuisé — le resto VOIT la commande mais ne peut
                                      pas l'accepter tant qu'il n'a pas rechargé. */}
                                  {!canAffordOrder && (
                                    <div className="flex items-center justify-between gap-2 bg-error/5 border border-error/20 rounded-lg px-3 py-2">
                                      <span className="text-error text-xs font-inter">
                                        {t("Solde insuffisant (")}{(pointsBalance?.available ?? 0).toLocaleString()} {t("FCFA) — cette commande prélève")} {orderCommission.toLocaleString()} {t("FCFA de commission.")}
                                      </span>
                                      <button
                                        onClick={() => navigate('/partenaires/dashboard/finances')}
                                        className="shrink-0 text-xs font-inter font-semibold text-white bg-green-primary hover:bg-green-dark px-3 py-1.5 rounded-lg transition-colors"
                                      >
                                        {t("Recharger")}
                                      </button>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  {/* Livraison directe (facultative) : seulement proposée à l'étape
                                      "Prête" et si des livreurs internes sont configurés — sinon le
                                      flux reste identique au pool plateforme historique. */}
                                  {next === 'ready' && ownDriverIds.length > 0 && (
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <span className="text-[11px] font-inter text-text-muted shrink-0">{t("Livraison :")}</span>
                                      <button
                                        type="button"
                                        onClick={() => setDeliveryModes((prev) => ({ ...prev, [order.id]: 'platform' }))}
                                        className={`px-2.5 h-7 rounded-full text-[11px] font-inter font-semibold transition-colors ${(deliveryModes[order.id] ?? 'platform') === 'platform'
                                          ? 'bg-green-primary text-white'
                                          : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                                          }`}
                                      >
                                        {t("Tous les livreurs")}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeliveryModes((prev) => ({ ...prev, [order.id]: 'restaurant' }))}
                                        className={`px-2.5 h-7 rounded-full text-[11px] font-inter font-semibold transition-colors ${deliveryModes[order.id] === 'restaurant'
                                          ? 'bg-green-primary text-white'
                                          : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                                          }`}
                                      >
                                        {t("Mes livreurs (")}{ownDriverIds.length})
                                      </button>
                                    </div>
                                  )}
                                  <div className="flex gap-2 items-center">
                                    {/* Série PTS — garantie client : le resto confirme la réception
                                        du paiement sur SON compte marchand avant de préparer. */}
                                    {order.status === 'confirmed' && order.guarantee && order.guarantee.status === 'awaiting_payment' && (
                                      <p className="flex-1 flex items-center gap-1.5 bg-bg-secondary text-text-secondary font-inter text-xs px-3 py-2.5 rounded-lg">
                                        <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                                        {t("En attente du paiement de la garantie (")}{order.guarantee.amountFcfa.toLocaleString()} {t("FCFA) par le client.")}
                                      </p>
                                    )}
                                    {order.status === 'confirmed' && order.guarantee && order.guarantee.status === 'declared' && (
                                      <div className="flex-1 bg-gold-light border border-gold-accent/40 rounded-lg px-3 py-2.5">
                                        <p className="text-amber-700 text-xs font-inter font-semibold mb-2">
                                          {t("Garantie déclarée payée")}{order.guarantee.proofNote ? ` — réf. ${order.guarantee.proofNote}` : ''}{t(". Vérifiez votre compte marchand.")}
                                        </p>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={async () => { await confirmGuaranteeReceived(order.id); toast.success('Garantie confirmée — vous pouvez lancer la préparation.'); await loadOrders(); }}
                                            className="flex-1 bg-green-primary hover:bg-green-dark text-white font-inter font-semibold text-xs h-10 rounded-lg transition-colors"
                                          >
                                            {t("Paiement reçu")}
                                          </button>
                                          <button
                                            onClick={async () => { await rejectGuaranteeDeclaration(order.id); toast.info('Déclaration annulée — le client est invité à payer.'); await loadOrders(); }}
                                            className="px-3 h-10 rounded-lg border border-border-custom text-text-secondary font-inter text-xs hover:bg-bg-secondary transition-colors"
                                          >
                                            {t("Non reçu")}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    {next && !(order.status === 'confirmed' && order.guarantee && order.guarantee.status !== 'confirmed') ? (
                                      <button
                                        onClick={() => handleAdvance(order)}
                                        disabled={isProcessing}
                                        className="flex-1 bg-green-primary text-white font-inter font-medium text-sm h-10 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
                                      >
                                        {isProcessing ? 'Mise à jour...' : `Marquer : ${statusLabels[next]}`}
                                      </button>
                                    ) : next ? null : (
                                      // Borne restaurant atteinte : la suite du cycle
                                      // (récupération, livraison) appartient au livreur.
                                      <span className="flex-1 inline-flex items-center gap-1.5 bg-gold-light text-amber-700 font-inter font-medium text-sm h-10 px-3 rounded-lg">
                                        <Clock className="w-4 h-4 shrink-0" />
                                        {order.status === 'ready' ? 'En attente du livreur' : 'Prise en charge par le livreur'}
                                      </span>
                                    )}
                                    {restaurantCanCancel(order.status) && (
                                      <button
                                        onClick={() => openCancelDialog(order)}
                                        disabled={isProcessing}
                                        className="px-4 h-10 rounded-lg border border-error text-error font-inter font-medium text-sm hover:bg-error/5 transition-colors disabled:opacity-60"
                                      >
                                        {t("Annuler")}
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("Annuler la commande ?")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("La commande #")}{cancelTarget?.id.slice(0, 8)} {t("sera définitivement annulée. Le client sera informé du motif. Cette action est irréversible.")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="resto-cancel-reason" className="block text-text-secondary font-inter text-sm mb-1.5">
                          {t("Motif de l’annulation")} <span className="text-error">*</span>
                        </label>
                        <select
                          id="resto-cancel-reason"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
                        >
                          <option value="" disabled>{t("Sélectionnez un motif")}</option>
                          <option value="Ingrédient en rupture">{t("Ingrédient en rupture")}</option>
                          <option value="Trop de commandes en cours">{t("Trop de commandes en cours")}</option>
                          <option value="Fermeture exceptionnelle">{t("Fermeture exceptionnelle")}</option>
                          <option value="Prix erroné sur la carte">{t("Prix erroné sur la carte")}</option>
                          <option value="Autre">{t("Autre")}</option>
                        </select>
                      </div>
                      {cancelReason === 'Autre' && (
                        <textarea
                          value={cancelDetails}
                          onChange={(e) => setCancelDetails(e.target.value)}
                          placeholder="Précisez le motif (visible par le client)..."
                          rows={2}
                          autoFocus
                          className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted"
                        />
                      )}
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("Retour")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (cancelTarget) { handleCancel(cancelTarget); setCancelTarget(null); }
                        }}
                        disabled={!cancelReasonComplete}
                        className="bg-error text-white hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("Oui, annuler la commande")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* ── Suppression plat menu ── */}
                <AlertDialog open={!!deleteTargetItem} onOpenChange={(open) => { if (!open) setDeleteTargetItem(null); }}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("Supprimer ce plat ?")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        <strong>{deleteTargetItem?.name}</strong> {t("sera déplacé dans la corbeille pour 7 jours. Vous pourrez le restaurer depuis le tableau de bord pendant cette période.")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("Annuler")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={confirmDeleteMenuItem}
                        className="bg-error text-white hover:bg-error/90"
                      >
                        {t("Supprimer")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

              </>
            ) : tab === 'menu' ? (
              <MenuTab
                restaurantId={restaurantId}
                items={menuItems}
                loading={menuLoading}
                onDelete={handleDeleteMenuItem}
                onCreated={loadMenu}
              />
            ) : tab === 'profile' && activeRestaurant ? (
              <div className="space-y-6">
                <ProfileTab
                  restaurant={activeRestaurant}
                  onUpdate={(patch) => applyRestaurantPatch(activeRestaurant.id, patch)}
                />
                <RestaurantReviewsSection restaurantId={activeRestaurant.id} />
              </div>
            ) : tab === 'finances' ? (
              <div className="space-y-6">
                <PointsSection
                  restaurantId={restaurantId}
                  onBalanceChange={() => { if (activeRestaurant) void refreshPoints(activeRestaurant.id); }}
                />
                <FinancesTab orders={orders} commissionRate={activeRestaurant?.commissionRate ?? 0.15} />
              </div>
            ) : tab === 'drivers' ? (
              <div className="space-y-6">
                <PreferredDriversTab restaurantId={restaurantId} orders={orders} />
                <OwnCourierSection restaurantId={restaurantId} ownDriverIds={ownDriverIds} onChange={loadOwnDrivers} />
              </div>
            ) : null}

            {/* Confirmation de fermeture temporaire (toggle header) */}
            <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("Fermer temporairement le restaurant ?")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {activeRestaurant?.name} {t("n’apparaîtra plus comme ouvert et ne recevra plus de nouvelles commandes jusqu’à sa réouverture. Les commandes en cours ne sont pas affectées.")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("Rester ouvert")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => { setConfirmCloseOpen(false); void applyOpenStatus(false); }}
                    className="bg-error text-white hover:bg-error/90"
                  >
                    {t("Fermer le restaurant")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Série PTS — Section « Mes points » (onglet finances)
// ─────────────────────────────────────────────────────────────
// Montants de recharge proposés (FCFA).
const RECHARGE_PRESETS = [5000, 10000, 25000];

function PointsSection({ restaurantId, onBalanceChange }: { restaurantId: string; onBalanceChange: () => void }) {
    const { t } = useTranslation();
  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [ledger, setLedger] = useState<PointsLedgerEntry[]>([]);
  const [recharges, setRecharges] = useState<RechargeRequest[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(8);
  // Numéro de dépôt Mobile Money (réglage admin, app_settings). Null = non encore renseigné.
  const [momoNumber, setMomoNumber] = useState<string | null>(null);
  useEffect(() => { getRechargeMomoNumber().then(setMomoNumber).catch(() => setMomoNumber(null)); }, []);

  // Dialog de recharge
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargePoints, setRechargePoints] = useState<number>(POINTS_CONFIG.MIN_RECHARGE_FCFA);
  const [rechargeMethod, setRechargeMethod] = useState<RechargeMethod>('momo');
  const [submitting, setSubmitting] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<RechargeRequest | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(false);
      const [bal, entries, reqs] = await Promise.all([
        getBalance(restaurantId),
        fetchLedger(restaurantId, { limit: 100 }),
        listRecharges({ restaurantId }),
      ]);
      setBalance(bal);
      setLedger(entries);
      setRecharges(reqs);
    } catch {
      setLoadError(true);
    }
  }, [restaurantId]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const handleRecharge = async () => {
    setSubmitting(true);
    try {
      const request = await requestRecharge(restaurantId, rechargePoints, rechargeMethod);
      setCreatedRequest(request);
      await load();
      onBalanceChange();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const closeRechargeDialog = () => {
    setRechargeOpen(false);
    setCreatedRequest(null);
    setRechargePoints(POINTS_CONFIG.MIN_RECHARGE_FCFA);
  };

  // Historique fusionné : écritures du ledger + demandes non validées (une
  // recharge validée apparaît déjà comme écriture — éviter le doublon).
  const history: { id: string; date: string; label: string; points: number | null; pending?: boolean; rejected?: boolean }[] = [
    ...ledger.map((e) => ({
      id: e.id,
      date: e.createdAt,
      label: e.note ?? e.kind,
      points: e.points,
    })),
    ...recharges
      .filter((r) => r.status !== 'validated')
      .map((r) => ({
        id: r.id,
        date: r.requestedAt,
        label: `Recharge ${r.method === 'momo' ? 'Mobile Money' : 'cash partenaire'} — réf. ${r.paymentRef}${r.status === 'rejected' ? ` (rejetée : ${r.rejectionReason ?? 'sans motif'})` : ''}`,
        points: r.points,
        pending: r.status === 'pending',
        rejected: r.status === 'rejected',
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const fmtPts = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString()} FCFA`;

  return (
    <section className="bg-white rounded-xl border border-border-custom p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-green-light flex items-center justify-center">
          <Coins className="w-4 h-4 text-green-primary" />
        </div>
        <h2 className="font-poppins font-semibold text-text-primary text-lg">{t("Mon solde MiamExpress")}</h2>
      </div>

      {loadError ? (
        <div className="text-center py-6">
          <p className="text-text-secondary font-inter text-sm mb-2">{t("Impossible de charger votre solde.")}</p>
          <button onClick={() => void load()} className="text-green-primary font-inter text-sm font-medium hover:underline min-h-11">
            {t("Réessayer")}
          </button>
        </div>
      ) : balance === null ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-secondary rounded-xl p-4 mb-4">
            <div>
              <p className="font-poppins font-bold text-text-primary text-3xl leading-none">
                {balance.available.toLocaleString()} <span className="text-base font-semibold">{t("FCFA")}</span>
              </p>
              <p className="text-text-muted text-xs font-inter mt-1">
                {t("Crédit disponible")}
                {balance.held > 0 && ` · ${balance.held.toLocaleString()} FCFA réservés (commandes en cours)`}
              </p>
            </div>
            <button
              onClick={() => setRechargeOpen(true)}
              className="bg-green-primary hover:bg-green-dark text-white font-inter font-semibold text-sm px-5 min-h-11 rounded-lg transition-colors active:scale-95"
            >
              {t("Recharger")}
            </button>
          </div>
          <p className="text-text-muted text-xs font-inter mb-4">
            {t("Chaque commande livrée prélève")} {Math.round(POINTS_CONFIG.COMMISSION_RATE * 100)}{t("% de commission sur le sous-total. Le solde doit couvrir la commission de la commande pour pouvoir l'accepter.")}
          </p>

          <h3 className="font-inter font-semibold text-text-primary text-sm mb-2">{t("Historique")}</h3>
          {history.length === 0 ? (
            <p className="text-text-muted font-inter text-sm py-4 text-center">
              {t("Aucun mouvement pour le moment.")}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border-light">
                {history.slice(0, historyLimit).map((h) => (
                  <li key={h.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className={`text-sm font-inter ${h.rejected ? 'text-text-muted line-through' : 'text-text-primary'}`}>{h.label}</p>
                      <p className="text-text-muted text-[11px] font-inter">
                        {new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {h.pending && ' · en attente de validation'}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-inter font-semibold ${h.pending ? 'text-amber-700' : h.rejected ? 'text-text-muted' : (h.points ?? 0) < 0 ? 'text-error' : 'text-green-primary'}`}>
                      {h.points !== null ? fmtPts(h.points) : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {history.length > historyLimit && (
                <button
                  onClick={() => setHistoryLimit((n) => n + 10)}
                  className="w-full text-green-primary font-inter text-sm font-medium hover:underline min-h-11"
                >
                  {t("Voir plus (")}{history.length - historyLimit} {t("restants)")}
                </button>
              )}
            </>
          )}
        </>
      )}

      {/* Dialog de recharge — phase 1 : dépôt manuel, validation admin sous 24 h */}
      <Dialog open={rechargeOpen} onOpenChange={(open) => { if (!open) closeRechargeDialog(); }}>
        <DialogContent className="sm:max-w-[420px] max-h-[85dvh] overflow-y-auto">
          {createdRequest ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-poppins">{t("Demande enregistrée")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="bg-green-light rounded-xl p-4 text-center">
                  <p className="text-text-secondary text-xs font-inter mb-1">{t("Référence à rappeler lors du dépôt")}</p>
                  <p className="font-poppins font-bold text-green-primary text-2xl tracking-wider">{createdRequest.paymentRef}</p>
                </div>
                <p className="text-text-secondary text-sm font-inter">
                  {createdRequest.amountFcfa.toLocaleString()} {t("FCFA ·")}{' '}
                  {createdRequest.method === 'momo' ? 'Mobile Money' : 'cash chez un partenaire MiamExpress'}.
                </p>
                {createdRequest.method === 'momo' && (
                  <p className="text-text-secondary text-sm font-inter bg-bg-secondary rounded-lg p-3">
                    {momoNumber
                      ? <>{t("Déposez")} {createdRequest.amountFcfa.toLocaleString()} {t("FCFA au")} {momoNumber} {t("en indiquant la référence")} {createdRequest.paymentRef}.</>
                      : <>{t("Le numéro de dépôt vous sera communiqué par l'assistance MiamExpress (bientôt affiché ici).")}</>}
                  </p>
                )}
                <p className="text-text-muted text-xs font-inter">
                  {t("Votre solde sera crédité après validation par MiamExpress (sous 24 h ouvrées).")}
                </p>
              </div>
              <DialogFooter>
                <button onClick={closeRechargeDialog} className="w-full bg-green-primary text-white font-inter font-semibold h-11 rounded-lg hover:bg-green-dark transition-colors">
                  {t("Compris")}
                </button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="font-poppins">{t("Recharger mon solde")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-inter font-medium text-text-primary mb-2">
                    {t("Montant (FCFA, minimum")} {POINTS_CONFIG.MIN_RECHARGE_FCFA.toLocaleString()})
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {RECHARGE_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRechargePoints(n)}
                        className={`px-4 min-h-11 rounded-lg text-sm font-inter font-semibold transition-colors ${rechargePoints === n ? 'bg-green-primary text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'}`}
                      >
                        {n.toLocaleString()} {t("FCFA")}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={POINTS_CONFIG.MIN_RECHARGE_FCFA}
                      step={1000}
                      value={rechargePoints}
                      onChange={(e) => setRechargePoints(parseInt(e.target.value) || 0)}
                      aria-label="Montant de recharge personnalisé en FCFA"
                      className="w-28 min-w-0 h-11 rounded-lg border border-border-custom bg-white px-3 text-sm font-inter text-center font-semibold outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10"
                    />
                  </div>
                  <p className="text-text-muted text-xs font-inter mt-2">
                    {t("Total :")} <span className="font-semibold text-text-primary">{Math.max(0, rechargePoints).toLocaleString()} {t("FCFA")}</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-inter font-medium text-text-primary mb-2">{t("Méthode de paiement")}</p>
                  <div className="space-y-2">
                    {([
                      { id: 'momo' as RechargeMethod, label: 'Mobile Money (MTN MoMo / Orange Money)' },
                      { id: 'cash_partner' as RechargeMethod, label: 'Cash chez un partenaire MiamExpress' },
                    ]).map((m) => (
                      <label key={m.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${rechargeMethod === m.id ? 'border-green-primary bg-green-light' : 'border-border-custom hover:bg-bg-secondary'}`}>
                        <input type="radio" name="recharge-method" checked={rechargeMethod === m.id} onChange={() => setRechargeMethod(m.id)} className="accent-green-primary" />
                        <span className="text-sm font-inter text-text-primary">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <button onClick={closeRechargeDialog} className="px-4 h-11 rounded-lg text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors">
                  {t("Annuler")}
                </button>
                <button
                  onClick={handleRecharge}
                  disabled={submitting || rechargePoints < POINTS_CONFIG.MIN_RECHARGE_FCFA}
                  className="px-5 h-11 rounded-lg bg-green-primary text-white font-inter font-medium text-sm hover:bg-green-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Enregistrement...' : `Demander ${Math.max(0, rechargePoints).toLocaleString()} FCFA`}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

// Téléphone masqué pour l'affichage (privacy) : indicatif + 2 derniers chiffres.
function maskDriverPhone(phone: string | null): string {
  if (!phone) return 'Livreur';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 5) return 'Livreur';
  return `+${digits.slice(0, 3)} ••• ••• ${digits.slice(-2)}`;
}

// Libellé livreur côté restaurateur : nom complet quand il est connu
// (candidature approuvée ou inscription), sinon téléphone masqué.
function driverLabel(driverId: string): string {
  return getDriverName(driverId) ?? maskDriverPhone(getDriverPhone(driverId));
}

function PreferredDriversTab({ restaurantId, orders }: { restaurantId: string; orders: Order[] }) {
    const { t } = useTranslation();
  const [preferredIds, setPreferredIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverStats, setDriverStats] = useState<Record<string, DriverStats>>({});

  useEffect(() => {
    getPreferredDrivers(restaurantId).then(ids => { setPreferredIds(ids); setLoading(false); });
  }, [restaurantId]);

  // Livreurs proposables (CONF-27) : ceux des dernières commandes livrées de
  // CE restaurant — plus de saisie d'identifiant technique.
  const recentDriverIds = useMemo(() => {
    const seen: string[] = [];
    for (const o of orders) {
      if (o.status === 'delivered' && o.driverId && !seen.includes(o.driverId)) seen.push(o.driverId);
    }
    return seen.filter((id) => !preferredIds.includes(id)).slice(0, 8);
  }, [orders, preferredIds]);

  useEffect(() => {
    const ids = [...new Set([...recentDriverIds, ...preferredIds])];
    if (ids.length === 0) return;
    let cancelled = false;
    fetchDriversStats(ids).then((stats) => { if (!cancelled) setDriverStats(stats); });
    return () => { cancelled = true; };
  }, [recentDriverIds, preferredIds]);

  const handleToggle = async (driverId: string) => {
    try {
      if (preferredIds.includes(driverId)) {
        await removePreferredDriver(restaurantId, driverId);
        setPreferredIds(prev => prev.filter(id => id !== driverId));
      } else {
        await addPreferredDriver(restaurantId, driverId);
        setPreferredIds(prev => [driverId, ...prev]);
      }
    } catch (e) { toast.error((e as Error).message || 'Action impossible'); }
  };

  if (loading) return <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-6 text-center text-text-secondary text-sm">{t("Chargement...")}</div>;

  return (
    <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6 max-w-xl">
      <h2 className="font-poppins font-semibold text-text-primary text-lg flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-green-light flex items-center justify-center"><Bike className="w-4 h-4 text-green-primary" /></div>
        {t("Mes livreurs préférés")}
      </h2>
      <p className="text-text-muted text-xs font-inter mb-5">
        {t("Les commandes marquées « Prête » sont proposées en priorité à vos livreurs préférés pendant 30 secondes avant d'être diffusées à tous. Max")} {5} {t("livreurs.")}
      </p>

      <div className="space-y-2">
        {preferredIds.map(id => (
          <div key={id} className="flex items-center justify-between p-3 bg-bg-secondary rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-green-light flex items-center justify-center"><Bike className="w-4 h-4 text-green-primary" /></div>
              <div>
                <span className="font-inter font-medium text-text-primary text-sm">{driverLabel(id)}</span>
                {driverStats[id]?.averageRating != null && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-inter text-amber-700">
                    <Star className="w-3 h-3 fill-gold-accent" />{driverStats[id].averageRating?.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => handleToggle(id)} className="text-xs font-inter font-medium text-error hover:underline">{t("Retirer")}</button>
          </div>
        ))}
        {preferredIds.length === 0 && (
          <div className="text-center py-8 text-text-muted text-sm font-inter">
            {t("Aucun livreur préféré pour le moment.")}
          </div>
        )}
      </div>

      {/* Livreurs de vos dernières livraisons (CONF-27) — ajout en un clic */}
      {preferredIds.length < 5 && (
        <div className="mt-4">
          <p className="text-sm font-inter font-medium text-text-primary mb-2">
            {t("Livreurs de vos dernières livraisons")}
          </p>
          {recentDriverIds.length === 0 ? (
            <p className="text-text-muted text-xs font-inter bg-bg-secondary rounded-xl px-3 py-3">
              {t("Aucun livreur récent — les livreurs de vos commandes livrées apparaîtront ici, prêts à être ajoutés en un clic.")}
            </p>
          ) : (
            <div className="space-y-2">
              {recentDriverIds.map((id) => (
                <div key={id} className="flex items-center justify-between p-3 bg-bg-secondary rounded-xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-white border border-border-custom flex items-center justify-center shrink-0"><Bike className="w-4 h-4 text-text-secondary" /></div>
                    <div className="min-w-0">
                      <span className="font-inter font-medium text-text-primary text-sm">{driverLabel(id)}</span>
                      <span className="block text-[11px] font-inter text-text-muted">
                        {driverStats[id]?.completedDeliveries ?? 0} {t("livraison")}{(driverStats[id]?.completedDeliveries ?? 0) > 1 ? 's' : ''}
                        {driverStats[id]?.averageRating != null && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-700">
                            <Star className="w-3 h-3 fill-gold-accent" />{driverStats[id].averageRating?.toFixed(1)}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(id)}
                    className="flex items-center gap-1 bg-green-light text-green-primary font-inter font-medium text-xs px-3 h-8 rounded-lg hover:bg-green-primary hover:text-white transition-colors shrink-0"
                  >
                    <UserCheck className="w-3.5 h-3.5" />{t("Ajouter")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Livraison directe (CONF-05 compatible) : un "livreur interne" reste un
// compte livreur classique (mêmes écrans, code de livraison, statuts) — seule
// sa visibilité change. Une fois désigné ici, il apparaît comme option
// "Mes livreurs" quand ce restaurant marque une commande "Prête" (onglet
// Commandes), et lui seul verra alors cette commande dans son pool de
// livraisons disponibles. Le client ne voit aucune différence.
function OwnCourierSection({
  restaurantId,
  ownDriverIds,
  onChange,
}: {
  restaurantId: string;
  ownDriverIds: string[];
  onChange: () => void;
}) {
    const { t } = useTranslation();
  const handleAdd = async (driverId: string) => {
    const id = driverId.trim();
    if (!id) return;
    try {
      await addOwnDriver(restaurantId, id);
      onChange();
    } catch (e) { toast.error((e as Error).message || 'Action impossible'); }
  };

  const handleRemove = async (driverId: string) => {
    await removeOwnDriver(restaurantId, driverId);
    onChange();
  };

  return (
    <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6 max-w-xl">
      <h2 className="font-poppins font-semibold text-text-primary text-lg flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-green-light flex items-center justify-center"><Bike className="w-4 h-4 text-green-primary" /></div>
        {t("Mes livreurs internes (livraison directe)")}
      </h2>
      <p className="text-text-muted text-xs font-inter mb-5">
        {t("Ces livreurs assurent la livraison pour votre compte. Quand vous marquez une commande « Prête », vous pouvez choisir « Mes livreurs » : elle n’est alors proposée qu’à eux, exactement comme une livraison classique côté client. Max")} {5} {t("livreurs.")}
      </p>

      <div className="space-y-2">
        {ownDriverIds.map(id => (
          <div key={id} className="flex items-center justify-between p-3 bg-bg-secondary rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-green-light flex items-center justify-center"><Bike className="w-4 h-4 text-green-primary" /></div>
              <span className="font-inter font-medium text-text-primary text-sm">{driverLabel(id)}</span>
            </div>
            <button onClick={() => handleRemove(id)} className="text-xs font-inter font-medium text-error hover:underline">{t("Retirer")}</button>
          </div>
        ))}
        {ownDriverIds.length === 0 && (
          <div className="text-center py-8 text-text-muted text-sm font-inter">
            {t("Aucun livreur interne. Ajoutez ici les livreurs qui travaillent directement pour vous.")}
          </div>
        )}
      </div>

      {ownDriverIds.length < 5 && (
        <div className="mt-4 p-4 bg-bg-secondary rounded-xl">
          <p className="text-sm font-inter font-medium text-text-primary mb-2">{t("Ajouter un livreur interne")}</p>
          <div className="flex gap-2">
            <input id="ownDriverIdInput" type="text" placeholder="ID du livreur..."
              className="flex-1 bg-white rounded-lg px-3 h-10 text-text-primary font-inter text-sm outline-none" />
            <button onClick={() => {
              const input = document.getElementById('ownDriverIdInput') as HTMLInputElement;
              if (input?.value) { handleAdd(input.value); input.value = ''; }
            }} className="bg-green-primary text-white font-inter font-medium text-sm px-4 h-10 rounded-lg hover:bg-green-dark transition-colors">
              <UserCheck className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const ALL_DIETARY_TAGS = [
  'sans-sucre', 'diabetique', 'pauvre-en-sel', 'riche-en-fibres',
  'keto', 'low-carb', 'sans-gluten', 'sans-lactose',
  'vegetarien', 'vegan', 'halal', 'bio',
  'riche-en-proteines', 'allege', 'energetique', 'fait-maison',
  'epice', 'braise', 'traditionnel', 'sans-cube',
  'cocktail', 'detox', 'sans-alcool', 'presse-du-jour',
];

function MenuTab({
  restaurantId,
  items,
  loading,
  onDelete,
  onCreated,
}: {
  restaurantId: string;
  items: MenuItem[];
  loading: boolean;
  onDelete: (id: string) => void;
  onCreated: () => void;
}) {
    const { t } = useTranslation();
  type QuickFilter = 'all' | 'popular' | 'unavailable' | 'missingImage';
  type SortBy = 'category' | 'name' | 'priceAsc' | 'priceDesc' | 'popular';
  type ViewMode = 'lanes' | 'list';

  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [deleteTargetItem, setDeleteTargetItem] = useState<MenuItem | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('category');
  const [viewMode, setViewMode] = useState<ViewMode>('lanes');
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<string>(menuCategories[0]);
  const [image, setImage] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [formIsPopular, setFormIsPopular] = useState(false);
  const [formIsAvailable, setFormIsAvailable] = useState(true);
  const [formDietaryTags, setFormDietaryTags] = useState<string[]>([]);
  const [formCatalogDishId, setFormCatalogDishId] = useState('');
  // Options du plat (CONF-14) : variantes (surcoût) et suppléments — prix en
  // chaîne le temps de la saisie, convertis/filtrés à la soumission.
  type OptionRow = { name: string; price: string };
  const [formVariants, setFormVariants] = useState<OptionRow[]>([]);
  const [formSupplements, setFormSupplements] = useState<OptionRow[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const collator = useMemo(() => new Intl.Collator('fr', { sensitivity: 'base' }), []);

  const isItemAvailable = (item: MenuItem) => item.isAvailable !== false;
  const hasOwnImage = (item: MenuItem) => item.hasImage !== false && Boolean(item.image);

  const categoryOptions = useMemo(() => {
    const itemCategories = new Set(items.map((item) => item.category));
    const knownCategories: readonly string[] = menuCategories;
    return [
      ...knownCategories.filter((cat) => itemCategories.has(cat)),
      ...Array.from(itemCategories).filter((cat) => !knownCategories.includes(cat)),
    ];
  }, [items]);

  useEffect(() => {
    if (activeCategory !== 'Tous' && !categoryOptions.includes(activeCategory)) {
      setActiveCategory('Tous');
    }
  }, [activeCategory, categoryOptions]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) counts[item.category] = (counts[item.category] ?? 0) + 1;
    return counts;
  }, [items]);

  const totalCount = items.length;
  const availableCount = items.filter(isItemAvailable).length;
  const unavailableCount = totalCount - availableCount;
  const popularCount = items.filter((item) => item.isPopular).length;
  const missingImageCount = items.filter((item) => !hasOwnImage(item)).length;
  const categoryCount = categoryOptions.length;

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const knownCategories: readonly string[] = menuCategories;
    const categoryRank = new Map(knownCategories.map((cat, index) => [cat, index]));

    return items
      .filter((item) => activeCategory === 'Tous' || item.category === activeCategory)
      .filter((item) => {
        if (!q) return true;
        return (
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        );
      })
      .filter((item) => {
        if (quickFilter === 'popular') return item.isPopular;
        if (quickFilter === 'unavailable') return !isItemAvailable(item);
        if (quickFilter === 'missingImage') return !hasOwnImage(item);
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return collator.compare(a.name, b.name);
        if (sortBy === 'priceAsc') return a.price - b.price;
        if (sortBy === 'priceDesc') return b.price - a.price;
        if (sortBy === 'popular') return Number(b.isPopular) - Number(a.isPopular) || collator.compare(a.name, b.name);
        const categoryDelta = (categoryRank.get(a.category) ?? 999) - (categoryRank.get(b.category) ?? 999);
        return categoryDelta || collator.compare(a.name, b.name);
      });
  }, [activeCategory, collator, items, query, quickFilter, sortBy]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    for (const item of filteredItems) (groups[item.category] ??= []).push(item);
    const knownCategories: readonly string[] = menuCategories;
    const orderedKeys = [
      ...menuCategories.filter((cat) => groups[cat]),
      ...Object.keys(groups).filter((cat) => !knownCategories.includes(cat)),
    ];
    return orderedKeys.map((cat) => ({ category: cat, items: groups[cat] }));
  }, [filteredItems]);

  const resetForm = (presetCategory?: string) => {
    setName('');
    setDescription('');
    setPrice('');
    setImage('');
    setImagePreview(null);
    setCategory(presetCategory ?? activeCategory !== 'Tous' ? activeCategory : menuCategories[0]);
    setFormIsPopular(false);
    setFormIsAvailable(true);
    setFormDietaryTags([]);
    setFormCatalogDishId('');
    setFormVariants([]);
    setFormSupplements([]);
    setShowOptions(false);
    setEditingId(null);
  };

  // Convertit les lignes d'options saisies : ignore les lignes sans nom,
  // prix vide/invalide → 0 (variante incluse / supplément gratuit).
  const cleanOptionRows = (rows: OptionRow[]) => rows
    .map((r) => ({ name: r.name.trim(), price: Math.max(0, Number(r.price) || 0) }))
    .filter((r) => r.name !== '');

  const openCreateForm = (presetCategory?: string) => {
    resetForm(presetCategory);
    setShowForm(true);
  };

  // LOT-14 (CONF-37) : compression navigateur puis upload /api/media en mode
  // VPS (URL /uploads/…) ; en mock, data-URL de l'image compressée.
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageProcessing(true);
    try {
      const url = await processFormImage(file, 'menu');
      setImage(url);
      setImagePreview(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de traiter l'image.");
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setImageProcessing(false);
    }
  };

  const clearImage = () => {
    setImage('');
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    setSubmitting(true);
    try {
      const payload = {
        name,
        description,
        price: Number(price),
        category,
        image: image || undefined,
        isPopular: formIsPopular,
        isAvailable: formIsAvailable,
        dietaryTags: formDietaryTags.length > 0 ? formDietaryTags : undefined,
        catalogDishId: formCatalogDishId || undefined,
        variants: (() => { const v = cleanOptionRows(formVariants); return v.length > 0 ? v : undefined; })(),
        supplements: (() => { const s = cleanOptionRows(formSupplements); return s.length > 0 ? s : undefined; })(),
      };
      if (editingId) await updateMenuItem(editingId, payload);
      else await createMenuItem({ restaurantId, ...payload });
      resetForm();
      setShowForm(false);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: MenuItem) => {
    setName(item.name);
    setDescription(item.description);
    setPrice(item.price.toString());
    setCategory(item.category);
    setImage(item.image || '');
    setImagePreview(item.image || null);
    setFormIsPopular(item.isPopular);
    setFormIsAvailable(isItemAvailable(item));
    setFormDietaryTags(item.dietaryTags ?? []);
    setFormCatalogDishId(item.catalogDishId ?? '');
    setFormVariants((item.variants ?? []).map((v) => ({ name: v.name, price: String(v.price) })));
    setFormSupplements((item.supplements ?? []).map((s) => ({ name: s.name, price: String(s.price) })));
    setShowOptions(Boolean(item.variants?.length || item.supplements?.length));
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    resetForm();
  };

  const handleTogglePopular = async (item: MenuItem) => {
    setBusyItemId(item.id);
    try {
      await updateMenuItem(item.id, { isPopular: !item.isPopular });
      await onCreated();
    } finally {
      setBusyItemId(null);
    }
  };

  const handleToggleAvailable = async (item: MenuItem) => {
    setBusyItemId(item.id);
    try {
      await updateMenuItem(item.id, { isAvailable: !isItemAvailable(item) });
      await onCreated();
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDelete = async (item: MenuItem) => {
    setDeleteTargetItem(item);
  };

  const confirmDeleteItem = async () => {
    if (!deleteTargetItem) return;
    setBusyItemId(deleteTargetItem.id);
    try {
      await onDelete(deleteTargetItem.id);
      toast.success('Plat mis en corbeille', { description: 'Récupérable pendant 7 jours.' });
    } finally {
      setBusyItemId(null);
      setDeleteTargetItem(null);
    }
  };

  const quickFilters: { id: QuickFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: totalCount },
    { id: 'popular', label: 'Populaires', count: popularCount },
    { id: 'unavailable', label: 'Indisponibles', count: unavailableCount },
    { id: 'missingImage', label: 'Sans image', count: missingImageCount },
  ];

  const renderItemActions = (item: MenuItem) => {
    const available = isItemAvailable(item);
    const busy = busyItemId === item.id;
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => handleEdit(item)}
          className="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center text-text-secondary hover:text-green-primary hover:bg-green-light transition-colors"
          title="Modifier"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => handleTogglePopular(item)}
          disabled={busy}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${item.isPopular ? 'bg-gold-light text-gold-accent' : 'bg-bg-secondary text-text-secondary hover:text-gold-accent'}`}
          title={item.isPopular ? 'Retirer des populaires' : 'Marquer populaire'}
        >
          <Star className={`w-4 h-4 ${item.isPopular ? 'fill-current' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => handleToggleAvailable(item)}
          disabled={busy}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${available ? 'bg-green-light text-green-primary' : 'bg-error/10 text-error'}`}
          title={available ? 'Rendre indisponible' : 'Remettre disponible'}
        >
          {available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => handleDelete(item)}
          disabled={busy}
          className="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center text-error hover:bg-error/10 transition-colors disabled:opacity-50"
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  const renderMenuCard = (item: MenuItem) => {
    const available = isItemAvailable(item);
    return (
      <div
        key={item.id}
        className={`shrink-0 w-[190px] sm:w-[210px] rounded-xl border border-border-custom bg-white overflow-hidden snap-start transition-all ${available ? 'hover:shadow-md' : 'opacity-70'}`}
      >
        <div className="relative aspect-[4/3] bg-bg-secondary">
          {item.image ? (
            <img src={item.image} alt={item.name} className={`w-full h-full object-cover ${available ? '' : 'grayscale'}`} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageOff className="w-6 h-6 text-text-muted" />
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {!available && <span className="bg-error text-white text-[10px] font-inter font-bold px-2 py-0.5 rounded-full">{t("Indisponible")}</span>}
            {item.isPopular && <span className="bg-gold-accent text-white text-[10px] font-inter font-bold px-2 py-0.5 rounded-full">{t("Populaire")}</span>}
          </div>
        </div>
        <div className="p-3">
          <p className="font-inter font-semibold text-text-primary text-sm truncate" title={item.name}>{item.name}</p>
          <p className="text-text-muted text-xs font-inter truncate mt-0.5" title={item.description}>{item.description || item.category}</p>
          <div className="flex items-center justify-between gap-2 mt-2">
            <p className="text-green-primary font-inter font-bold text-sm whitespace-nowrap">{item.price.toLocaleString()} {t("FCFA")}</p>
          </div>
          <div className="mt-3">{renderItemActions(item)}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 sm:gap-5">
          <div>
            <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide">{t("Plats")}</p>
            <p className="font-poppins font-bold text-text-primary text-xl">{totalCount}</p>
          </div>
          <div>
            <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide">{t("Disponibles")}</p>
            <p className="font-poppins font-bold text-green-primary text-xl">{availableCount}</p>
          </div>
          <div>
            <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide">{t("Catégories")}</p>
            <p className="font-poppins font-bold text-text-primary text-xl">{categoryCount}</p>
          </div>
          <div>
            <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide">{t("À vérifier")}</p>
            <p className="font-poppins font-bold text-amber-700 text-xl">{unavailableCount + missingImageCount}</p>
          </div>
        </div>
        <button
          onClick={() => openCreateForm()}
          className="flex items-center justify-center gap-2 bg-green-primary text-white font-inter font-semibold text-sm px-5 h-11 rounded-lg hover:bg-green-dark transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t("Ajouter un plat")}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-border-custom overflow-hidden">
              <Skeleton className="w-full aspect-[4/3]" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-border-custom p-10 text-center">
          <p className="text-text-secondary font-inter font-medium mb-3">{t("Aucun plat pour le moment.")}</p>
          <button
            onClick={() => openCreateForm()}
            className="inline-flex items-center gap-2 bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("Ajouter votre premier plat")}
          </button>
        </div>
      ) : (
        <>
          <div className="py-3 -mx-1 px-1 space-y-3">
            <div className="flex items-center gap-2 bg-white rounded-lg border border-border-custom px-3 h-11 shadow-sm">
              <Search className="w-4 h-4 text-text-muted shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un plat, une catégorie, une description..."
                className="flex-1 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted min-w-0"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveCategory('Tous')}
                className={`shrink-0 h-9 px-4 rounded-full text-sm font-inter font-semibold transition-colors ${activeCategory === 'Tous' ? 'bg-green-primary text-white' : 'bg-white border border-border-custom text-text-secondary hover:text-text-primary'}`}
              >
                {t("Tous (")}{items.length})
              </button>
              {categoryOptions.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 h-9 px-4 rounded-full text-sm font-inter font-semibold transition-colors ${activeCategory === cat ? 'bg-green-primary text-white' : 'bg-white border border-border-custom text-text-secondary hover:text-text-primary'}`}
                >
                  {cat} ({categoryCounts[cat] ?? 0})
                </button>
              ))}
            </div>

            <div className="flex flex-col xl:flex-row xl:items-center gap-2 justify-between">
              <div className="flex gap-2 flex-wrap">
                {quickFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setQuickFilter(filter.id)}
                    className={`shrink-0 h-9 px-3 rounded-lg text-xs font-inter font-semibold border transition-colors ${quickFilter === filter.id ? 'bg-text-primary text-white border-text-primary' : 'bg-white border-border-custom text-text-secondary hover:text-text-primary'}`}
                  >
                    {filter.label} ({filter.count})
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="shrink-0 flex items-center gap-2 h-9 bg-white border border-border-custom rounded-lg px-3">
                  <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="bg-transparent text-xs font-inter font-semibold text-text-secondary outline-none"
                  >
                    <option value="category">{t("Catégorie")}</option>
                    <option value="name">{t("Nom A-Z")}</option>
                    <option value="priceAsc">{t("Prix croissant")}</option>
                    <option value="priceDesc">{t("Prix décroissant")}</option>
                    <option value="popular">{t("Populaires")}</option>
                  </select>
                </div>
                <div className="shrink-0 flex items-center bg-white border border-border-custom rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('lanes')}
                    className={`w-8 h-7 rounded-md flex items-center justify-center transition-colors ${viewMode === 'lanes' ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'}`}
                    title="Vue cartes"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`w-8 h-7 rounded-md flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'}`}
                    title="Vue liste"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-border-custom p-10 text-center">
              <SlidersHorizontal className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary font-inter font-medium">{t("Aucun plat ne correspond aux filtres.")}</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="bg-white rounded-xl border border-border-custom overflow-hidden divide-y divide-border-light">
              {filteredItems.map((item) => {
                const available = isItemAvailable(item);
                return (
                  <div key={item.id} className={`flex items-center gap-3 p-3 sm:p-4 ${available ? '' : 'bg-error/5'}`}>
                    <div className="w-14 h-14 rounded-lg bg-bg-secondary border border-border-custom overflow-hidden shrink-0">
                      {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <ImageOff className="w-5 h-5 text-text-muted m-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-inter font-semibold text-text-primary text-sm truncate max-w-full">{item.name}</p>
                        {!available && <span className="text-[10px] font-inter font-bold text-error bg-error/10 px-2 py-0.5 rounded-full">{t("Indisponible")}</span>}
                        {item.isPopular && <span className="text-[10px] font-inter font-bold text-amber-700 bg-gold-light px-2 py-0.5 rounded-full">{t("Populaire")}</span>}
                      </div>
                      <p className="text-text-muted text-xs font-inter truncate">{item.category} · {item.description}</p>
                    </div>
                    <p className="hidden sm:block text-green-primary font-inter font-bold text-sm w-28 text-right">{item.price.toLocaleString()} {t("FCFA")}</p>
                    <div className="shrink-0">{renderItemActions(item)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByCategory.map(({ category: cat, items: categoryItems }) => (
                <section key={cat} className="bg-white rounded-xl border border-border-custom overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-light">
                    <div className="min-w-0">
                      <h3 className="font-inter font-bold text-text-primary text-sm truncate">{cat} <span className="text-text-muted font-medium">({categoryItems.length})</span></h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateForm(cat)}
                      className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-green-light text-green-primary font-inter font-semibold text-xs hover:bg-green-primary hover:text-white transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t("Ajouter")}
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto p-4 snap-x">
                    {categoryItems.map(renderMenuCard)}
                    <button
                      type="button"
                      onClick={() => openCreateForm(cat)}
                      className="shrink-0 w-[160px] sm:w-[180px] min-h-[190px] rounded-xl border-2 border-dashed border-border-custom text-text-muted hover:border-green-primary hover:text-green-primary transition-colors flex flex-col items-center justify-center gap-1.5 snap-start"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-xs font-inter font-semibold">{t("Ajouter ici")}</span>
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleCancel}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-poppins font-bold text-text-primary text-lg">{editingId ? 'Modifier le plat' : 'Ajouter un plat'}</h3>
                <button type="button" onClick={handleCancel} className="w-10 h-10 rounded-full flex items-center justify-center text-text-muted hover:bg-bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">{t("Photo du plat")}</label>
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="Aperçu" className="w-32 h-32 object-cover rounded-lg border border-border-custom" />
                    <button type="button" onClick={clearImage} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-error text-white flex items-center justify-center shadow">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={imageProcessing}
                    className="flex flex-col items-center justify-center gap-1.5 w-full bg-bg-secondary rounded-lg h-28 text-text-muted font-inter text-sm border-2 border-dashed border-border-custom hover:border-green-primary hover:text-green-primary transition-colors disabled:opacity-60"
                  >
                    {imageProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {imageProcessing ? 'Traitement de l’image…' : 'Cliquez pour choisir une image'}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                {imagePreview && (
                  <button type="button" onClick={() => fileRef.current?.click()} className="block text-xs text-green-primary font-inter font-medium mt-1 hover:underline">
                    {t("Changer l'image")}
                  </button>
                )}
              </div>

              {/* Catalogue des plats — sélectionner un plat type */}
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">
                  {t("Plat type (catalogue)")}
                </label>
                <select
                  value={formCatalogDishId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setFormCatalogDishId(id);
                    if (id) {
                      const entry = dishCatalog.find(d => d.id === id);
                      if (entry) {
                        if (!name) setName(entry.name);
                        setCategory(entry.category);
                        setFormDietaryTags(entry.tags);
                        if (!image) setImage(entry.defaultImage);
                      }
                    }
                  }}
                  className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
                >
                  <option value="">{t("Nouveau plat (soumettre pour validation)")}</option>
                  {dishCatalog.map(entry => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ({entry.category})
                    </option>
                  ))}
                </select>
                {!formCatalogDishId && (
                  <p className="text-amber-700 text-[11px] font-inter mt-1">
                    {t("Ce plat sera soumis à validation par l'admin avant d'apparaître dans la recherche globale.")}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nom du plat"
                  className="bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                  required
                />
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Prix (FCFA)"
                  min={0}
                  className="bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                  required
                />
              </div>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
              >
                {menuCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between gap-3 bg-bg-secondary rounded-lg px-3 h-11 cursor-pointer">
                  <span className="font-inter text-sm text-text-primary">{t("Disponible")}</span>
                  <input type="checkbox" checked={formIsAvailable} onChange={(e) => setFormIsAvailable(e.target.checked)} className="w-4 h-4 accent-green-primary" />
                </label>
                <label className="flex items-center justify-between gap-3 bg-bg-secondary rounded-lg px-3 h-11 cursor-pointer">
                  <span className="font-inter text-sm text-text-primary">{t("Populaire")}</span>
                  <input type="checkbox" checked={formIsPopular} onChange={(e) => setFormIsPopular(e.target.checked)} className="w-4 h-4 accent-green-primary" />
                </label>
              </div>

              {/* Dietary tags */}
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">
                  {t("Tags dietetiques")}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                  {ALL_DIETARY_TAGS.map(tag => {
                    const active = formDietaryTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setFormDietaryTags(prev =>
                          prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                        )}
                        className={`shrink-0 h-8 px-2.5 rounded-full text-[11px] font-inter font-semibold border transition-colors ${active ? 'bg-green-primary text-white border-green-primary' : 'bg-white border-border-custom text-text-secondary hover:text-text-primary'}`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
                {formDietaryTags.length > 0 && (
                  <button type="button" onClick={() => setFormDietaryTags([])} className="text-text-muted text-[11px] font-inter mt-1 hover:text-text-primary">
                    {t("Effacer la selection")}
                  </button>
                )}
              </div>

              {/* Options du plat (CONF-14) : variantes + suppléments, repliés par défaut */}
              <div className="border border-border-custom rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowOptions(!showOptions)}
                  aria-expanded={showOptions}
                  className="w-full flex items-center justify-between px-3 h-11 bg-bg-secondary text-left"
                >
                  <span className="font-inter font-medium text-text-primary text-sm">
                    {t("Options du plat")}
                    {(cleanOptionRows(formVariants).length > 0 || cleanOptionRows(formSupplements).length > 0) && (
                      <span className="ml-2 text-xs text-green-primary font-semibold">
                        {cleanOptionRows(formVariants).length} {t("variante")}{cleanOptionRows(formVariants).length > 1 ? 's' : ''} · {cleanOptionRows(formSupplements).length} {t("supplément")}{cleanOptionRows(formSupplements).length > 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                  <span className="text-text-muted text-xs font-inter">{showOptions ? 'Replier ▲' : 'Déplier ▼'}</span>
                </button>
                {showOptions && (
                  <div className="p-3 space-y-4">
                    <div>
                      <p className="text-text-secondary font-inter text-sm mb-0.5">{t("Tailles / portions")}</p>
                      <p className="text-text-muted text-[11px] font-inter mb-2">
                        {t("Le prix indiqué est le")} <span className="font-semibold">{t("surcoût")}</span> {t("par rapport au prix de base (0 = inclus).")}
                      </p>
                      <div className="space-y-2">
                        {formVariants.map((row, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => setFormVariants((prev) => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                              placeholder="Ex. Grande portion"
                              aria-label={`Nom de la variante ${i + 1}`}
                              className="flex-1 min-w-0 bg-bg-secondary rounded-lg px-3 h-10 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                            />
                            <input
                              type="number"
                              min={0}
                              value={row.price}
                              onChange={(e) => setFormVariants((prev) => prev.map((r, j) => j === i ? { ...r, price: e.target.value } : r))}
                              placeholder="+FCFA"
                              aria-label={`Surcoût de la variante ${i + 1}`}
                              className="w-24 bg-bg-secondary rounded-lg px-3 h-10 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                            />
                            <button
                              type="button"
                              onClick={() => setFormVariants((prev) => prev.filter((_, j) => j !== i))}
                              aria-label={`Supprimer la variante ${i + 1}`}
                              className="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center text-error hover:bg-error/10 transition-colors shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setFormVariants((prev) => [...prev, { name: '', price: '' }])}
                          className="flex items-center gap-1.5 text-green-primary font-inter text-xs font-medium hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> {t("Ajouter une variante")}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-text-secondary font-inter text-sm mb-2">{t("Suppléments payants")}</p>
                      <div className="space-y-2">
                        {formSupplements.map((row, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => setFormSupplements((prev) => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                              placeholder="Ex. Suppl. plantain"
                              aria-label={`Nom du supplément ${i + 1}`}
                              className="flex-1 min-w-0 bg-bg-secondary rounded-lg px-3 h-10 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                            />
                            <input
                              type="number"
                              min={0}
                              value={row.price}
                              onChange={(e) => setFormSupplements((prev) => prev.map((r, j) => j === i ? { ...r, price: e.target.value } : r))}
                              placeholder="FCFA"
                              aria-label={`Prix du supplément ${i + 1}`}
                              className="w-24 bg-bg-secondary rounded-lg px-3 h-10 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                            />
                            <button
                              type="button"
                              onClick={() => setFormSupplements((prev) => prev.filter((_, j) => j !== i))}
                              aria-label={`Supprimer le supplément ${i + 1}`}
                              className="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center text-error hover:bg-error/10 transition-colors shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setFormSupplements((prev) => [...prev, { name: '', price: '' }])}
                          className="flex items-center gap-1.5 text-green-primary font-inter text-xs font-medium hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> {t("Ajouter un supplément")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                rows={2}
                className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted resize-none"
              />
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={submitting || imageProcessing} className="flex-1 bg-green-primary text-white font-inter font-semibold text-sm h-11 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60">
                  {submitting ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Ajouter'}
                </button>
                <button type="button" onClick={handleCancel} className="text-text-secondary font-inter text-sm px-4 h-11 rounded-lg hover:bg-bg-secondary transition-colors">
                  {t("Annuler")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirmation suppression plat ── */}
      <AlertDialog open={!!deleteTargetItem} onOpenChange={(open) => { if (!open) setDeleteTargetItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Supprimer ce plat ?")}</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTargetItem?.name}</strong> {t("sera déplacé dans la corbeille pour 7 jours. Vous pourrez le restaurer depuis le tableau de bord pendant cette période.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Annuler")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteItem}
              className="bg-error text-white hover:bg-error/90"
            >
              {t("Supprimer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
function ProfileTab({
  restaurant,
  onUpdate,
}: {
  restaurant: Restaurant;
  // Patch appliqué localement par le parent (plus de rechargement de page).
  onUpdate: (patch: Partial<Restaurant>) => void;
}) {
    const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  // LOT-14 (CONF-36) : horaires structurés. L'ancien format texte libre est
  // parsé si possible ; sinon on repart d'une plage par défaut (le champ
  // n'accepte plus de texte libre à l'enregistrement).
  const initialHours = parseHours(restaurant.hours);
  const [openTime, setOpenTime] = useState(initialHours?.open ?? '08:00');
  const [closeTime, setCloseTime] = useState(initialHours?.close ?? '22:00');
  const [deliveryTime, setDeliveryTime] = useState(restaurant.deliveryTime);
  const [minOrder, setMinOrder] = useState(restaurant.minOrder.toString());
  // Série PTS : données du parcours garantie (facultatives — sans code marchand,
  // les commandes se déroulent sans étape garantie, comme avant).
  const [merchantCode, setMerchantCode] = useState(restaurant.merchantCode ?? '');
  const [assistanceWhatsapp, setAssistanceWhatsapp] = useState(normalizeCameroonPhone(restaurant.assistanceWhatsapp ?? ''));

  const deliveryTimeOptions = ['10-20 min', '20-30 min', '30-45 min', '45-60 min', '60-90 min'];
  // Tolérance : une valeur historique hors liste reste sélectionnable.
  const deliveryTimeChoices = deliveryTimeOptions.includes(restaurant.deliveryTime)
    ? deliveryTimeOptions
    : [restaurant.deliveryTime, ...deliveryTimeOptions];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openTime || !closeTime) {
      toast.error("Renseignez l'heure d'ouverture et de fermeture.");
      return;
    }
    setSubmitting(true);
    try {
      const patch = {
        hours: formatHours(openTime, closeTime),
        deliveryTime,
        minOrder: Number(minOrder),
        merchantCode: merchantCode.trim() || undefined,
        assistanceWhatsapp: normalizeCameroonPhone(assistanceWhatsapp) || undefined,
      };
      await updateRestaurantProfile(restaurant.id, patch);
      onUpdate(patch);
      toast.success('Profil du restaurant mis à jour.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6 max-w-2xl">
      <h2 className="font-poppins font-semibold text-text-primary text-lg flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-green-light flex items-center justify-center">
          <Store className="w-4 h-4 text-green-primary" />
        </div>
        {t("Profil du Restaurant")}
      </h2>
      {/* Le statut Ouvert/Fermé se pilote depuis le haut du tableau de bord
          (visible sur tous les onglets) — plus besoin de venir ici. */}
      <p className="bg-bg-secondary rounded-lg px-3 py-2 text-xs font-inter text-text-secondary mb-4">
        {t("💡 L’ouverture/fermeture du restaurant se gère avec l’interrupteur en haut du tableau de bord.")}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="block text-sm font-inter font-medium text-text-primary mb-1">{t("Horaires d'ouverture")}</label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label htmlFor="profile-open-time" className="block text-[11px] text-text-muted font-inter mb-0.5">{t("Ouverture")}</label>
              <input
                id="profile-open-time"
                type="time"
                required
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
              />
            </div>
            <span className="text-text-muted font-inter text-sm mt-4" aria-hidden>—</span>
            <div className="flex-1">
              <label htmlFor="profile-close-time" className="block text-[11px] text-text-muted font-inter mb-0.5">{t("Fermeture")}</label>
              <input
                id="profile-close-time"
                type="time"
                required
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
              />
            </div>
          </div>
          <p className="text-[11px] text-text-muted font-inter mt-1">
            {t("Une fermeture après minuit est possible (ex. 10:00 → 02:00). Hors de ces horaires, votre restaurant apparaît « Fermé » aux clients.")}
          </p>
        </div>

        {/* Série PTS — paiement de la garantie client */}
        <div>
          <label htmlFor="profile-merchant-code" className="block text-sm font-inter font-medium text-text-primary mb-1">
            {t("Code marchand Mobile Money")}
          </label>
          <input
            id="profile-merchant-code"
            type="text"
            inputMode="numeric"
            value={merchantCode}
            onChange={(e) => setMerchantCode(e.target.value)}
            placeholder="Ex. 057575"
            className="w-full bg-white border border-border-custom rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
          />
          <p className="text-[11px] text-text-muted font-inter mt-1">
            {t("Affiché au client pour payer la garantie de commande (")}{POINTS_CONFIG.GUARANTEE_AMOUNT_FCFA.toLocaleString()} {t("FCFA, déduite du total). Laissez vide pour désactiver l’étape garantie.")}
          </p>
        </div>
        <div>
          <label htmlFor="profile-assistance-whatsapp" className="block text-sm font-inter font-medium text-text-primary mb-1">
            {t("WhatsApp assistance")}
          </label>
          <input
            id="profile-assistance-whatsapp"
            type="tel"
            value={displayCameroonPhone(assistanceWhatsapp)}
            onChange={(e) => setAssistanceWhatsapp(normalizeCameroonPhone(e.target.value))}
            placeholder="Ex. 6XX XX XX XX"
            className="w-full bg-white border border-border-custom rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
          />
          <p className="text-[11px] text-text-muted font-inter mt-1">
            {t("Affiché au client à l’étape garantie pour joindre votre assistance.")}
          </p>
        </div>

        <div>
          <label htmlFor="profile-delivery-time" className="block text-sm font-inter font-medium text-text-primary mb-1">{t("Temps de livraison estimé")}</label>
          <select
            id="profile-delivery-time"
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
          >
            {deliveryTimeChoices.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-inter font-medium text-text-primary mb-1">{t("Minimum de commande (FCFA)")}</label>
          <input
            type="number"
            value={minOrder}
            onChange={(e) => setMinOrder(e.target.value)}
            className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-green-primary text-white font-inter font-medium text-sm h-11 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60 mt-2"
        >
          {submitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>
      </form>
    </div>
  );
}

function FinancesTab({ orders, commissionRate }: { orders: Order[]; commissionRate: number }) {
    const { t } = useTranslation();
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const now = Date.now();
  const periodStart =
    period === 'week' ? now - 7 * 86400000 :
      period === 'month' ? now - 30 * 86400000 : 0;

  const periodOrders = useMemo(
    () => orders.filter((o) => o.status === 'delivered' && new Date(o.createdAt).getTime() >= periodStart),
    [orders, periodStart]
  );
  const totalRevenue = periodOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const yamoCommissionRate = commissionRate;
  const commission = totalRevenue * yamoCommissionRate;
  const netRevenue = totalRevenue - commission;
  const avgBasket = periodOrders.length ? totalRevenue / periodOrders.length : 0;

  // S2 — évolution du CA jour par jour sur la période.
  const revenueByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of periodOrders) {
      const day = new Date(o.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      map[day] = (map[day] ?? 0) + o.subtotal;
    }
    return Object.entries(map).map(([day, total]) => ({ day, total }));
  }, [periodOrders]);

  // S3 — répartition des commandes par heure de la journée (heures de pointe).
  const ordersByHour = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, commandes: 0 }));
    for (const o of periodOrders) {
      const h = new Date(o.createdAt).getHours();
      counts[h].commandes += 1;
    }
    return counts;
  }, [periodOrders]);

  // S1 — performance par plat : quantité vendue et CA généré, sur la période sélectionnée.
  const [dishSort, setDishSort] = useState<'quantity' | 'revenue'>('quantity');
  const dishStats = useMemo(() => {
    const map: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const o of periodOrders) {
      for (const item of o.items) {
        const entry = (map[item.name] ??= { name: item.name, quantity: 0, revenue: 0 });
        entry.quantity += item.quantity;
        entry.revenue += item.quantity * item.price;
      }
    }
    return Object.values(map).sort((a, b) => b[dishSort] - a[dishSort]);
  }, [periodOrders, dishSort]);
  const leastSold = [...dishStats].sort((a, b) => a.quantity - b.quantity).slice(0, 3);

  // S7 — taux d'annulation + clients récurrents vs nouveaux, sur la période.
  const allPeriodOrders = useMemo(
    () => orders.filter((o) => new Date(o.createdAt).getTime() >= periodStart),
    [orders, periodStart]
  );
  const cancellationRate = allPeriodOrders.length
    ? (allPeriodOrders.filter((o) => o.status === 'cancelled').length / allPeriodOrders.length) * 100
    : 0;

  const customerStats = useMemo(() => {
    const firstDeliveredAt: Record<string, number> = {};
    for (const o of orders) {
      if (o.status !== 'delivered') continue;
      const t = new Date(o.createdAt).getTime();
      if (!firstDeliveredAt[o.customerId] || t < firstDeliveredAt[o.customerId]) firstDeliveredAt[o.customerId] = t;
    }
    const seen = new Set<string>();
    let newCustomers = 0;
    let returningCustomers = 0;
    for (const o of periodOrders) {
      if (seen.has(o.customerId)) continue;
      seen.add(o.customerId);
      if ((firstDeliveredAt[o.customerId] ?? 0) >= periodStart) newCustomers += 1;
      else returningCustomers += 1;
    }
    return { newCustomers, returningCustomers };
  }, [orders, periodOrders, periodStart]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2">
        <span className="text-sm font-inter font-medium text-text-secondary">{t("Période :")}</span>
        {(['week', 'month', 'all'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-colors ${period === p ? 'bg-green-primary text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
              }`}
          >
            {p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Tout'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 text-center hover:shadow-md transition-shadow">
          <div className="w-9 h-9 rounded-lg bg-green-light flex items-center justify-center mx-auto mb-3">
            <DollarSign className="w-4 h-4 text-green-primary" />
          </div>
          <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">{t("Revenus Bruts")}</p>
          <p className="font-poppins font-bold text-2xl text-text-primary">{totalRevenue.toLocaleString()} {t("FCFA")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 text-center hover:shadow-md transition-shadow">
          <div className="w-9 h-9 rounded-lg bg-error/10 flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-4 h-4 text-error" />
          </div>
          <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">{t("Commission MiamExpress (")}{Math.round(yamoCommissionRate * 100)}%)</p>
          <p className="font-poppins font-bold text-2xl text-error">-{commission.toLocaleString()} {t("FCFA")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-green-primary/20 shadow-sm p-5 text-center hover:shadow-md transition-shadow bg-green-50/30">
          <div className="w-9 h-9 rounded-lg bg-green-primary flex items-center justify-center mx-auto mb-3">
            <Star className="w-4 h-4 text-white" />
          </div>
          <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">{t("Revenus Nets")}</p>
          <p className="font-poppins font-bold text-2xl text-green-primary">{netRevenue.toLocaleString()} {t("FCFA")}</p>
        </div>
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 text-center hover:shadow-md transition-shadow">
          <div className="w-9 h-9 rounded-lg bg-gold-light flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-4 h-4 text-gold-accent" />
          </div>
          <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">{t("Panier Moyen")}</p>
          <p className="font-poppins font-bold text-2xl text-text-primary">{Math.round(avgBasket).toLocaleString()} {t("FCFA")}</p>
        </div>
      </div>

      {periodOrders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* S2 — évolution du CA */}
          <div className="bg-white rounded-xl border border-border-custom p-5">
            <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-primary" />{t("Évolution du chiffre d'affaires")}
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: CHART_TICK }} />
                <YAxis tick={{ fontSize: 11, fill: CHART_TICK }} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} FCFA`, 'CA']} contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="total" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* S3 — heures de pointe */}
          <div className="bg-white rounded-xl border border-border-custom p-5">
            <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-gold-accent" />{t("Heures de pointe")}
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ordersByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: CHART_TICK }} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: CHART_TICK }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [v, 'Commandes']} contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="commandes" fill={CHART_ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* S1 — performance par plat */}
      {dishStats.length > 0 && (
        <div className="bg-white rounded-xl border border-border-custom p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-poppins font-semibold text-text-primary text-lg flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-green-primary" />{t("Performance des plats")}
            </h2>
            <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
              <button
                onClick={() => setDishSort('quantity')}
                className={`px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-colors ${dishSort === 'quantity' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary'}`}
              >
                {t("Quantité vendue")}
              </button>
              <button
                onClick={() => setDishSort('revenue')}
                className={`px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-colors ${dishSort === 'revenue' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary'}`}
              >
                {t("CA généré")}
              </button>
            </div>
          </div>
          <div className="divide-y divide-border-light">
            {dishStats.slice(0, 8).map((dish, i) => (
              <div key={dish.name} className="py-2.5 flex items-center gap-3">
                {i < 3 ? (
                  <span className="w-6 h-6 rounded-full bg-gold-light text-amber-700 text-xs font-inter font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                ) : (
                  <span className="w-6 h-6 text-text-muted text-xs font-inter flex items-center justify-center shrink-0">{i + 1}</span>
                )}
                <p className="flex-1 font-inter font-medium text-text-primary text-sm truncate">{dish.name}</p>
                <p className="text-text-muted text-xs font-inter shrink-0">{dish.quantity} {t("vendu")}{dish.quantity > 1 ? 's' : ''}</p>
                <p className="font-inter font-semibold text-green-primary text-sm shrink-0 w-24 text-right">
                  {dish.revenue.toLocaleString()} {t("FCFA")}
                </p>
              </div>
            ))}
          </div>

          {leastSold.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border-light">
              <p className="flex items-center gap-1.5 text-text-muted text-xs font-inter font-medium mb-2">
                <ArrowDown className="w-3.5 h-3.5" />{t("Les moins demandés sur la période")}
              </p>
              <div className="flex flex-wrap gap-2">
                {leastSold.map((dish) => (
                  <span key={dish.name} className="text-xs font-inter px-2.5 py-1 rounded-full bg-bg-secondary text-text-secondary">
                    {dish.name} ({dish.quantity})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* S7 — taux d'annulation + clients récurrents vs nouveaux */}
      {allPeriodOrders.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 text-center">
            <div className="w-9 h-9 rounded-lg bg-error/10 flex items-center justify-center mx-auto mb-3">
              <XCircle className="w-4 h-4 text-error" />
            </div>
            <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">{t("Taux d'annulation")}</p>
            <p className="font-poppins font-bold text-2xl text-text-primary">{cancellationRate.toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 text-center">
            <div className="w-9 h-9 rounded-lg bg-green-light flex items-center justify-center mx-auto mb-3">
              <Users className="w-4 h-4 text-green-primary" />
            </div>
            <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">{t("Clients fidèles")}</p>
            <p className="font-poppins font-bold text-2xl text-text-primary">{customerStats.returningCustomers}</p>
          </div>
          <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 text-center">
            <div className="w-9 h-9 rounded-lg bg-gold-light flex items-center justify-center mx-auto mb-3">
              <UserPlus className="w-4 h-4 text-gold-accent" />
            </div>
            <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">{t("Nouveaux clients")}</p>
            <p className="font-poppins font-bold text-2xl text-text-primary">{customerStats.newCustomers}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-border-custom p-5">
        <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">{t("Historique des commandes livrées")}</h2>
        {periodOrders.length === 0 ? (
          <p className="text-text-secondary font-inter text-sm">{t("Aucune commande livrée sur cette période.")}</p>
        ) : (
          <div className="divide-y divide-border-light">
            {periodOrders.map(order => (
              <div key={order.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-inter font-semibold text-sm text-text-primary">#{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-text-muted">{new Date(order.createdAt).toLocaleString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <p className="font-inter font-semibold text-sm text-text-primary">{order.subtotal.toLocaleString()} {t("FCFA")}</p>
                  <p className="text-xs text-error">-{(order.subtotal * yamoCommissionRate).toLocaleString()} {t("FCFA")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Avis clients du restaurant (lecture seule) — le restaurateur voit ce que ses
// clients publient (la modération reste côté admin, /admin/reviews).
function RestaurantReviewsSection({ restaurantId }: { restaurantId: string }) {
    const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  // Loading dérivé (pas de setState synchrone dans l'effet) : la section
  // charge tant que le dernier restaurant résolu n'est pas celui affiché.
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const reviewsLoading = loadedForId !== restaurantId;

  // Réponse officielle du restaurant (une par avis, éditable).
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmittingId, setReplySubmittingId] = useState<string | null>(null);

  // Signalement d'avis (motif obligatoire) + compteur « nouveaux depuis mon
  // dernier passage » calculé avant de marquer la section comme vue.
  const [reportTarget, setReportTarget] = useState<Review | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);

  const handleReport = async () => {
    if (!reportTarget) return;
    setReportSubmitting(true);
    try {
      const updated = await reportReview(reportTarget.id, reportReason);
      applyUpdatedReview(updated);
      setReportTarget(null);
      setReportReason('');
      toast.success('Avis signalé — la modération va le traiter.');
    } catch (err) {
      toast.error((err as Error).message || "Impossible de signaler l'avis.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const applyUpdatedReview = (updated: Review) => {
    setReviews((prev) => prev.map((review) => (review.id === updated.id ? updated : review)));
  };

  const handleSubmitReply = async (reviewId: string) => {
    setReplySubmittingId(reviewId);
    try {
      const updated = await submitOwnerReply(reviewId, replyText);
      applyUpdatedReview(updated);
      setReplyingId(null);
      setReplyText('');
      toast.success('Réponse publiée.');
    } catch (err) {
      toast.error((err as Error).message || "Impossible de publier la réponse.");
    } finally {
      setReplySubmittingId(null);
    }
  };

  const handleDeleteReply = async (reviewId: string) => {
    setReplySubmittingId(reviewId);
    try {
      const updated = await deleteOwnerReply(reviewId);
      applyUpdatedReview(updated);
      toast.success('Réponse supprimée.');
    } catch (err) {
      toast.error((err as Error).message || 'Impossible de supprimer la réponse.');
    } finally {
      setReplySubmittingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchRestaurantReviews(restaurantId, { limit: 20 }),
      fetchRestaurantRatingSummary(restaurantId),
    ])
      .then(([reviewData, summaryData]) => {
        if (cancelled) return;
        setReviews(reviewData);
        setSummary(summaryData);
        // Badge « n nouveaux » calculé avant de marquer le passage : la
        // prochaine visite ne re-signalera que les avis postérieurs.
        setUnseenCount(countUnseenReviews(restaurantId, reviewData));
        markRestaurantReviewsSeen(restaurantId);
      })
      .catch(() => {
        if (cancelled) return;
        setReviews([]);
        setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoadedForId(restaurantId);
      });
    return () => { cancelled = true; };
  }, [restaurantId]);

  return (
    <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6 max-w-2xl">
      <h2 className="font-poppins font-semibold text-text-primary text-lg flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-gold-light flex items-center justify-center">
          <Star className="w-4 h-4 text-gold-accent" />
        </div>
        {t("Avis clients")}
        {unseenCount > 0 && (
          <span className="bg-green-primary text-white text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full">
            {unseenCount} {t("nouveau")}{unseenCount > 1 ? 'x' : ''}
          </span>
        )}
      </h2>
      <p className="text-text-secondary text-xs font-inter mb-4">
        {t("Avis vérifiés issus des commandes livrées. La modération est gérée par l’équipe Yamo.")}
      </p>

      {reviewsLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : reviews.length === 0 ? (
        <p className="bg-bg-secondary rounded-lg px-3 py-4 text-sm font-inter text-text-secondary text-center">
          {t("Aucun avis pour le moment. Les clients peuvent noter le restaurant après une commande livrée.")}
        </p>
      ) : (
        <>
          {summary && summary.reviewCount > 0 && (
            <div className="flex items-center gap-3 bg-bg-secondary rounded-lg px-4 py-3 mb-4">
              <p className="font-poppins font-bold text-2xl text-text-primary">{summary.ratingAvg.toFixed(1)}</p>
              <div>
                <div className="flex gap-0.5" aria-label={`${summary.ratingAvg.toFixed(1)} sur 5`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < Math.round(summary.ratingAvg) ? 'fill-gold-accent text-gold-accent' : 'text-border-custom'}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-text-muted font-inter">
                  {summary.reviewCount} {t("avis ·")} {summary.verifiedCount} {t("vérifiés")}
                </p>
              </div>
            </div>
          )}
          <div className="divide-y divide-border-light">
            {reviews.map((review) => (
              <div key={review.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-inter font-semibold text-sm text-text-primary">
                    {review.authorName || 'Client vérifié'}
                  </span>
                  <div className="flex gap-0.5" aria-label={`${review.rating} sur 5`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-gold-accent text-gold-accent' : 'text-border-custom'}`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-text-muted font-inter">
                    {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true, locale: fr })}
                  </span>
                </div>
                {review.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {review.tags.map((tag) => (
                      <span key={tag} className="bg-bg-secondary text-text-secondary text-[11px] font-inter px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {review.comment && (
                  <p className="text-text-primary text-sm font-inter leading-relaxed">{review.comment}</p>
                )}

                {/* Réponse officielle : formulaire inline, une seule réponse par avis */}
                {replyingId === review.id ? (
                  <div className="mt-2 bg-bg-secondary rounded-lg p-3">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      maxLength={500}
                      rows={3}
                      autoFocus
                      placeholder="Merci pour votre retour… (visible publiquement sous l'avis)"
                      disabled={replySubmittingId === review.id}
                      className="w-full bg-white rounded-lg border border-border-custom px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted focus:border-green-primary"
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-text-muted font-inter">{replyText.length}/500</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSubmitReply(review.id)}
                          disabled={replySubmittingId === review.id || !replyText.trim()}
                          className="bg-green-primary text-white font-inter font-medium text-xs px-3 h-8 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
                        >
                          {replySubmittingId === review.id ? 'Publication…' : 'Publier la réponse'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setReplyingId(null); setReplyText(''); }}
                          disabled={replySubmittingId === review.id}
                          className="text-text-secondary font-inter text-xs hover:underline"
                        >
                          {t("Annuler")}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : review.ownerReply ? (
                  <div className={`mt-2 rounded-lg p-3 ${review.ownerReply.status === 'hidden' ? 'bg-error/5 border border-error/20' : 'bg-bg-secondary'}`}>
                    <p className="text-[11px] font-inter font-semibold text-text-muted uppercase tracking-wide mb-1">
                      {t("Votre réponse")}
                      {review.ownerReply.updatedAt && <span className="normal-case font-normal"> {t("· modifiée")}</span>}
                      {review.ownerReply.status === 'hidden' && (
                        <span className="normal-case font-semibold text-error"> {t("· masquée par la modération")}</span>
                      )}
                    </p>
                    <p className="text-text-primary text-sm font-inter leading-relaxed">{review.ownerReply.text}</p>
                    {review.ownerReply.status === 'hidden' && review.ownerReply.moderationReason && (
                      <p className="text-error text-xs font-inter mt-1">{t("Motif :")} {review.ownerReply.moderationReason}</p>
                    )}
                    <div className="flex gap-3 mt-1.5">
                      <button
                        type="button"
                        onClick={() => { setReplyingId(review.id); setReplyText(review.ownerReply?.text ?? ''); }}
                        disabled={replySubmittingId === review.id}
                        className="text-green-primary font-inter text-xs font-medium hover:underline"
                      >
                        {t("Modifier")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReply(review.id)}
                        disabled={replySubmittingId === review.id}
                        className="text-error font-inter text-xs font-medium hover:underline"
                      >
                        {replySubmittingId === review.id ? 'Suppression…' : 'Supprimer'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setReplyingId(review.id); setReplyText(''); }}
                    className="mt-2 text-green-primary font-inter text-xs font-medium hover:underline"
                  >
                    {t("Répondre à cet avis")}
                  </button>
                )}

                {/* Signalement : demande de modération avec motif obligatoire */}
                <div className="mt-1.5">
                  {review.ownerReport?.status === 'open' ? (
                    <span className="inline-flex items-center gap-1 bg-gold-light text-amber-700 text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full">
                      {t("Signalé — en attente de modération")}
                    </span>
                  ) : review.ownerReport?.status === 'resolved' ? (
                    <span className="inline-flex items-center gap-1 bg-bg-secondary text-text-muted text-[11px] font-inter px-2 py-0.5 rounded-full">
                      {t("Signalement traité par la modération")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setReportTarget(review); setReportReason(''); }}
                      className="text-text-muted font-inter text-[11px] hover:text-error hover:underline"
                    >
                      {t("Signaler cet avis à la modération")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Dialog de signalement — motif obligatoire (pas de window.prompt) */}
      <AlertDialog open={!!reportTarget} onOpenChange={(open) => { if (!open) setReportTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Signaler cet avis à la modération ?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("L’avis reste visible pendant l’examen. L’équipe Yamo décidera de le maintenir ou de le masquer. Expliquez précisément le problème (propos injurieux, avis mensonger, hors sujet…).")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            maxLength={500}
            rows={3}
            autoFocus
            placeholder="Motif du signalement (obligatoire)…"
            disabled={reportSubmitting}
            className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reportSubmitting}>{t("Annuler")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleReport(); }}
              disabled={reportSubmitting || !reportReason.trim()}
              className="bg-error text-white hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reportSubmitting ? 'Envoi…' : 'Envoyer le signalement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
