import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Store, Clock, RefreshCw, Trash2, Plus, Upload, X, Volume2, VolumeX,
  Search, ImageOff, Pencil, TrendingUp,
  PackageCheck, AlertCircle, DollarSign, ChefHat, Star, ShoppingBag, Flame, ArrowDown, Eye, EyeOff, LayoutGrid, List, SlidersHorizontal, ArrowUpDown,
  XCircle, Users, UserPlus, Phone, Bike, UserCheck,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CHART_PRIMARY, CHART_ACCENT, CHART_GRID, CHART_TICK, CHART_TOOLTIP_STYLE } from '../lib/chartTheme';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import { ZoneAlertBanner, useZoneAlert } from '../components/ZoneAlertBanner';
import { fetchRestaurantsByOwner, createMenuItem, deleteMenuItem, fetchMenuItems, updateMenuItem, updateRestaurantProfile, updateRestaurantOpenStatus } from '../lib/catalog';
import { Switch } from '../components/ui/switch';
import { usePolling } from '../hooks/usePolling';
import { useRestaurants } from '../hooks/useCatalog';
import { restaurantMenuCategories, dishCatalog } from '../data/mockData';
import type { MenuItem, Restaurant } from '../data/mockData';
import { confirmOrderWithPreparation, fetchOrdersByRestaurant, getOrderPreparationMessage, updateOrderStatus, cancelOrder, getDriverPhone, type Order, type OrderStatus } from '../lib/orders';
import { getPreferredDrivers, addPreferredDriver, removePreferredDriver, fetchDriversStats, getOwnDriverIds, addOwnDriver, removeOwnDriver, type DriverStats } from '../lib/drivers';
import { processFormImage } from '../lib/media';
import { parseHours, formatHours, isWithinHours } from '../lib/hours';
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
  const { user } = useAuth();
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

  useEffect(() => {
    if (!restaurantId && restaurants.length > 0) {
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
    } finally {
      setProcessingOrderId(null);
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
              <button onClick={() => setSoundEnabled(!soundEnabled)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-inter font-medium bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm transition-colors"
                title={soundEnabled ? 'Son activé' : 'Son désactivé'}>
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button onClick={loadOrders}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-inter font-medium px-3 py-2 rounded-lg backdrop-blur-sm transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Actualiser
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
              Aucun restaurant associé à votre compte. Contactez le support MiamExpress.
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
                    <span className="text-[11px] font-inter bg-gold-light text-gold-accent px-2 py-0.5 rounded-full">
                      Hors horaires ({activeRestaurant.hours}) — affiché « Fermé » aux clients
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
                      👋 En attente de commandes
                    </p>
                    <p className="text-text-muted text-xs font-inter">
                      Vos clients peuvent commander dès maintenant. Vérifiez votre statut « Ouvert ».
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => {
                      const next = nextStatus(order.status);
                      const isFinal = order.status === 'delivered' || order.status === 'cancelled';
                      const ageMs = Date.now() - new Date(order.createdAt).getTime();
                      const ageMin = Math.round(ageMs / 60000);
                      const urgencyColor =
                        ageMin > 15 ? 'border-l-red-500' : ageMin > 5 ? 'border-l-amber-500' : 'border-l-green-500';
                      const ageColor =
                        ageMin > 15 ? 'text-error' : ageMin > 5 ? 'text-gold-accent' : 'text-green-primary';
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
                              Annulée par {order.cancelledBy === 'customer' ? 'le client' : order.cancelledBy === 'restaurant' ? 'vous' : "l'équipe MiamExpress"}
                              {' '}· Motif : <span className="font-medium text-text-primary">{order.cancellationReason}</span>
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
                                Pour {order.recipient.name || 'bénéficiaire'}{order.recipient.phone ? ` · ${order.recipient.phone}` : ''}
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
                              href={`tel:${order.contactPhone}`}
                              className="inline-flex items-center gap-1.5 text-green-primary text-xs font-inter font-medium mb-1 hover:underline"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              Appeler le client · {order.contactPhone}
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
                              {order.total.toLocaleString()} FCFA
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
                                        {minutes} min
                                      </button>
                                    ))}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleConfirm(order)}
                                      disabled={isProcessing}
                                      className="flex-1 bg-green-primary text-white font-inter font-medium text-sm h-10 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
                                    >
                                      {isProcessing ? 'Confirmation...' : `Accepter — prêt dans ${selectedPrepTime} min`}
                                    </button>
                                    <button
                                      onClick={() => openCancelDialog(order)}
                                      disabled={isProcessing}
                                      className="px-4 h-10 rounded-lg border border-error text-error font-inter font-medium text-sm hover:bg-error/5 transition-colors disabled:opacity-60"
                                    >
                                      Refuser
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {/* Livraison directe (facultative) : seulement proposée à l'étape
                                      "Prête" et si des livreurs internes sont configurés — sinon le
                                      flux reste identique au pool plateforme historique. */}
                                  {next === 'ready' && ownDriverIds.length > 0 && (
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <span className="text-[11px] font-inter text-text-muted shrink-0">Livraison :</span>
                                      <button
                                        type="button"
                                        onClick={() => setDeliveryModes((prev) => ({ ...prev, [order.id]: 'platform' }))}
                                        className={`px-2.5 h-7 rounded-full text-[11px] font-inter font-semibold transition-colors ${(deliveryModes[order.id] ?? 'platform') === 'platform'
                                          ? 'bg-green-primary text-white'
                                          : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                                          }`}
                                      >
                                        Tous les livreurs
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeliveryModes((prev) => ({ ...prev, [order.id]: 'restaurant' }))}
                                        className={`px-2.5 h-7 rounded-full text-[11px] font-inter font-semibold transition-colors ${deliveryModes[order.id] === 'restaurant'
                                          ? 'bg-green-primary text-white'
                                          : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                                          }`}
                                      >
                                        Mes livreurs ({ownDriverIds.length})
                                      </button>
                                    </div>
                                  )}
                                  <div className="flex gap-2 items-center">
                                    {next ? (
                                      <button
                                        onClick={() => handleAdvance(order)}
                                        disabled={isProcessing}
                                        className="flex-1 bg-green-primary text-white font-inter font-medium text-sm h-10 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
                                      >
                                        {isProcessing ? 'Mise à jour...' : `Marquer : ${statusLabels[next]}`}
                                      </button>
                                    ) : (
                                      // Borne restaurant atteinte : la suite du cycle
                                      // (récupération, livraison) appartient au livreur.
                                      <span className="flex-1 inline-flex items-center gap-1.5 bg-gold-light text-gold-accent font-inter font-medium text-sm h-10 px-3 rounded-lg">
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
                                        Annuler
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
                      <AlertDialogTitle>Annuler la commande ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        La commande #{cancelTarget?.id.slice(0, 8)} sera définitivement annulée.
                        Le client sera informé du motif. Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="resto-cancel-reason" className="block text-text-secondary font-inter text-sm mb-1.5">
                          Motif de l&apos;annulation <span className="text-error">*</span>
                        </label>
                        <select
                          id="resto-cancel-reason"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
                        >
                          <option value="" disabled>Sélectionnez un motif</option>
                          <option value="Ingrédient en rupture">Ingrédient en rupture</option>
                          <option value="Trop de commandes en cours">Trop de commandes en cours</option>
                          <option value="Fermeture exceptionnelle">Fermeture exceptionnelle</option>
                          <option value="Prix erroné sur la carte">Prix erroné sur la carte</option>
                          <option value="Autre">Autre</option>
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
                      <AlertDialogCancel>Retour</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (cancelTarget) { handleCancel(cancelTarget); setCancelTarget(null); }
                        }}
                        disabled={!cancelReasonComplete}
                        className="bg-error text-white hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Oui, annuler la commande
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* ── Suppression plat menu ── */}
                <AlertDialog open={!!deleteTargetItem} onOpenChange={(open) => { if (!open) setDeleteTargetItem(null); }}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce plat ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        <strong>{deleteTargetItem?.name}</strong> sera déplacé dans la corbeille pour 7 jours.
                        Vous pourrez le restaurer depuis le tableau de bord pendant cette période.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={confirmDeleteMenuItem}
                        className="bg-error text-white hover:bg-error/90"
                      >
                        Supprimer
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
              <ProfileTab
                restaurant={activeRestaurant}
                onUpdate={(patch) => applyRestaurantPatch(activeRestaurant.id, patch)}
              />
            ) : tab === 'finances' ? (
              <FinancesTab orders={orders} commissionRate={activeRestaurant?.commissionRate ?? 0.15} />
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
                  <AlertDialogTitle>Fermer temporairement le restaurant ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {activeRestaurant?.name} n&apos;apparaîtra plus comme ouvert et ne recevra
                    plus de nouvelles commandes jusqu&apos;à sa réouverture. Les commandes en
                    cours ne sont pas affectées.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Rester ouvert</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => { setConfirmCloseOpen(false); void applyOpenStatus(false); }}
                    className="bg-error text-white hover:bg-error/90"
                  >
                    Fermer le restaurant
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

// Téléphone masqué pour l'affichage (privacy) : indicatif + 2 derniers chiffres.
function maskDriverPhone(phone: string | null): string {
  if (!phone) return 'Livreur';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 5) return 'Livreur';
  return `+${digits.slice(0, 3)} ••• ••• ${digits.slice(-2)}`;
}

function PreferredDriversTab({ restaurantId, orders }: { restaurantId: string; orders: Order[] }) {
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

  if (loading) return <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-6 text-center text-text-secondary text-sm">Chargement...</div>;

  return (
    <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6 max-w-xl">
      <h2 className="font-poppins font-semibold text-text-primary text-lg flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-green-light flex items-center justify-center"><Bike className="w-4 h-4 text-green-primary" /></div>
        Mes livreurs préférés
      </h2>
      <p className="text-text-muted text-xs font-inter mb-5">
        Les commandes marquées « Prête » sont proposées en priorité à vos livreurs préférés pendant 30 secondes avant d'être diffusées à tous.
        Max {5} livreurs.
      </p>

      <div className="space-y-2">
        {preferredIds.map(id => (
          <div key={id} className="flex items-center justify-between p-3 bg-bg-secondary rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-green-light flex items-center justify-center"><Bike className="w-4 h-4 text-green-primary" /></div>
              <div>
                <span className="font-inter font-medium text-text-primary text-sm">{maskDriverPhone(getDriverPhone(id))}</span>
                {driverStats[id]?.averageRating != null && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-inter text-gold-accent">
                    <Star className="w-3 h-3 fill-gold-accent" />{driverStats[id].averageRating?.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => handleToggle(id)} className="text-xs font-inter font-medium text-error hover:underline">Retirer</button>
          </div>
        ))}
        {preferredIds.length === 0 && (
          <div className="text-center py-8 text-text-muted text-sm font-inter">
            Aucun livreur préféré pour le moment.
          </div>
        )}
      </div>

      {/* Livreurs de vos dernières livraisons (CONF-27) — ajout en un clic */}
      {preferredIds.length < 5 && (
        <div className="mt-4">
          <p className="text-sm font-inter font-medium text-text-primary mb-2">
            Livreurs de vos dernières livraisons
          </p>
          {recentDriverIds.length === 0 ? (
            <p className="text-text-muted text-xs font-inter bg-bg-secondary rounded-xl px-3 py-3">
              Aucun livreur récent — les livreurs de vos commandes livrées apparaîtront ici,
              prêts à être ajoutés en un clic.
            </p>
          ) : (
            <div className="space-y-2">
              {recentDriverIds.map((id) => (
                <div key={id} className="flex items-center justify-between p-3 bg-bg-secondary rounded-xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-white border border-border-custom flex items-center justify-center shrink-0"><Bike className="w-4 h-4 text-text-secondary" /></div>
                    <div className="min-w-0">
                      <span className="font-inter font-medium text-text-primary text-sm">{maskDriverPhone(getDriverPhone(id))}</span>
                      <span className="block text-[11px] font-inter text-text-muted">
                        {driverStats[id]?.completedDeliveries ?? 0} livraison{(driverStats[id]?.completedDeliveries ?? 0) > 1 ? 's' : ''}
                        {driverStats[id]?.averageRating != null && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-gold-accent">
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
                    <UserCheck className="w-3.5 h-3.5" />Ajouter
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
        Mes livreurs internes (livraison directe)
      </h2>
      <p className="text-text-muted text-xs font-inter mb-5">
        Ces livreurs assurent la livraison pour votre compte. Quand vous marquez une commande
        « Prête », vous pouvez choisir « Mes livreurs » : elle n&apos;est alors proposée qu&apos;à
        eux, exactement comme une livraison classique côté client. Max {5} livreurs.
      </p>

      <div className="space-y-2">
        {ownDriverIds.map(id => (
          <div key={id} className="flex items-center justify-between p-3 bg-bg-secondary rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-green-light flex items-center justify-center"><Bike className="w-4 h-4 text-green-primary" /></div>
              <span className="font-inter font-medium text-text-primary text-sm">{maskDriverPhone(getDriverPhone(id))}</span>
            </div>
            <button onClick={() => handleRemove(id)} className="text-xs font-inter font-medium text-error hover:underline">Retirer</button>
          </div>
        ))}
        {ownDriverIds.length === 0 && (
          <div className="text-center py-8 text-text-muted text-sm font-inter">
            Aucun livreur interne. Ajoutez ici les livreurs qui travaillent directement pour vous.
          </div>
        )}
      </div>

      {ownDriverIds.length < 5 && (
        <div className="mt-4 p-4 bg-bg-secondary rounded-xl">
          <p className="text-sm font-inter font-medium text-text-primary mb-2">Ajouter un livreur interne</p>
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
          className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center text-text-secondary hover:text-green-primary hover:bg-green-light transition-colors"
          title="Modifier"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => handleTogglePopular(item)}
          disabled={busy}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${item.isPopular ? 'bg-gold-light text-gold-accent' : 'bg-bg-secondary text-text-secondary hover:text-gold-accent'}`}
          title={item.isPopular ? 'Retirer des populaires' : 'Marquer populaire'}
        >
          <Star className={`w-4 h-4 ${item.isPopular ? 'fill-current' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => handleToggleAvailable(item)}
          disabled={busy}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${available ? 'bg-green-light text-green-primary' : 'bg-error/10 text-error'}`}
          title={available ? 'Rendre indisponible' : 'Remettre disponible'}
        >
          {available ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => handleDelete(item)}
          disabled={busy}
          className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center text-error hover:bg-error/10 transition-colors disabled:opacity-50"
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
            {!available && <span className="bg-error text-white text-[10px] font-inter font-bold px-2 py-0.5 rounded-full">Indisponible</span>}
            {item.isPopular && <span className="bg-gold-accent text-white text-[10px] font-inter font-bold px-2 py-0.5 rounded-full">Populaire</span>}
          </div>
        </div>
        <div className="p-3">
          <p className="font-inter font-semibold text-text-primary text-sm truncate" title={item.name}>{item.name}</p>
          <p className="text-text-muted text-xs font-inter truncate mt-0.5" title={item.description}>{item.description || item.category}</p>
          <div className="flex items-center justify-between gap-2 mt-2">
            <p className="text-green-primary font-inter font-bold text-sm whitespace-nowrap">{item.price.toLocaleString()} FCFA</p>
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
            <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide">Plats</p>
            <p className="font-poppins font-bold text-text-primary text-xl">{totalCount}</p>
          </div>
          <div>
            <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide">Disponibles</p>
            <p className="font-poppins font-bold text-green-primary text-xl">{availableCount}</p>
          </div>
          <div>
            <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide">Catégories</p>
            <p className="font-poppins font-bold text-text-primary text-xl">{categoryCount}</p>
          </div>
          <div>
            <p className="text-text-muted text-[11px] font-inter uppercase tracking-wide">À vérifier</p>
            <p className="font-poppins font-bold text-gold-accent text-xl">{unavailableCount + missingImageCount}</p>
          </div>
        </div>
        <button
          onClick={() => openCreateForm()}
          className="flex items-center justify-center gap-2 bg-green-primary text-white font-inter font-semibold text-sm px-5 h-11 rounded-lg hover:bg-green-dark transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Ajouter un plat
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
          <p className="text-text-secondary font-inter font-medium mb-3">Aucun plat pour le moment.</p>
          <button
            onClick={() => openCreateForm()}
            className="inline-flex items-center gap-2 bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter votre premier plat
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
                Tous ({items.length})
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
                    <option value="category">Catégorie</option>
                    <option value="name">Nom A-Z</option>
                    <option value="priceAsc">Prix croissant</option>
                    <option value="priceDesc">Prix décroissant</option>
                    <option value="popular">Populaires</option>
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
              <p className="text-text-secondary font-inter font-medium">Aucun plat ne correspond aux filtres.</p>
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
                        {!available && <span className="text-[10px] font-inter font-bold text-error bg-error/10 px-2 py-0.5 rounded-full">Indisponible</span>}
                        {item.isPopular && <span className="text-[10px] font-inter font-bold text-gold-accent bg-gold-light px-2 py-0.5 rounded-full">Populaire</span>}
                      </div>
                      <p className="text-text-muted text-xs font-inter truncate">{item.category} · {item.description}</p>
                    </div>
                    <p className="hidden sm:block text-green-primary font-inter font-bold text-sm w-28 text-right">{item.price.toLocaleString()} FCFA</p>
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
                      Ajouter
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
                      <span className="text-xs font-inter font-semibold">Ajouter ici</span>
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
                <button type="button" onClick={handleCancel} className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-bg-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">Photo du plat</label>
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
                    Changer l'image
                  </button>
                )}
              </div>

              {/* Catalogue des plats — sélectionner un plat type */}
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">
                  Plat type (catalogue)
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
                  <option value="">Nouveau plat (soumettre pour validation)</option>
                  {dishCatalog.map(entry => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ({entry.category})
                    </option>
                  ))}
                </select>
                {!formCatalogDishId && (
                  <p className="text-gold-accent text-[11px] font-inter mt-1">
                    Ce plat sera soumis à validation par l'admin avant d'apparaître dans la recherche globale.
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
                  <span className="font-inter text-sm text-text-primary">Disponible</span>
                  <input type="checkbox" checked={formIsAvailable} onChange={(e) => setFormIsAvailable(e.target.checked)} className="w-4 h-4 accent-green-primary" />
                </label>
                <label className="flex items-center justify-between gap-3 bg-bg-secondary rounded-lg px-3 h-11 cursor-pointer">
                  <span className="font-inter text-sm text-text-primary">Populaire</span>
                  <input type="checkbox" checked={formIsPopular} onChange={(e) => setFormIsPopular(e.target.checked)} className="w-4 h-4 accent-green-primary" />
                </label>
              </div>

              {/* Dietary tags */}
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">
                  Tags dietetiques
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
                    Effacer la selection
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
                    Options du plat
                    {(cleanOptionRows(formVariants).length > 0 || cleanOptionRows(formSupplements).length > 0) && (
                      <span className="ml-2 text-xs text-green-primary font-semibold">
                        {cleanOptionRows(formVariants).length} variante{cleanOptionRows(formVariants).length > 1 ? 's' : ''} · {cleanOptionRows(formSupplements).length} supplément{cleanOptionRows(formSupplements).length > 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                  <span className="text-text-muted text-xs font-inter">{showOptions ? 'Replier ▲' : 'Déplier ▼'}</span>
                </button>
                {showOptions && (
                  <div className="p-3 space-y-4">
                    <div>
                      <p className="text-text-secondary font-inter text-sm mb-0.5">Tailles / portions</p>
                      <p className="text-text-muted text-[11px] font-inter mb-2">
                        Le prix indiqué est le <span className="font-semibold">surcoût</span> par rapport au prix de base (0 = inclus).
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
                              className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center text-error hover:bg-error/10 transition-colors shrink-0"
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
                          <Plus className="w-3.5 h-3.5" /> Ajouter une variante
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-text-secondary font-inter text-sm mb-2">Suppléments payants</p>
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
                              className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center text-error hover:bg-error/10 transition-colors shrink-0"
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
                          <Plus className="w-3.5 h-3.5" /> Ajouter un supplément
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
                  Annuler
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
            <AlertDialogTitle>Supprimer ce plat ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTargetItem?.name}</strong> sera déplacé dans la corbeille pour 7 jours.
              Vous pourrez le restaurer depuis le tableau de bord pendant cette période.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteItem}
              className="bg-error text-white hover:bg-error/90"
            >
              Supprimer
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
  const [submitting, setSubmitting] = useState(false);
  // LOT-14 (CONF-36) : horaires structurés. L'ancien format texte libre est
  // parsé si possible ; sinon on repart d'une plage par défaut (le champ
  // n'accepte plus de texte libre à l'enregistrement).
  const initialHours = parseHours(restaurant.hours);
  const [openTime, setOpenTime] = useState(initialHours?.open ?? '08:00');
  const [closeTime, setCloseTime] = useState(initialHours?.close ?? '22:00');
  const [deliveryTime, setDeliveryTime] = useState(restaurant.deliveryTime);
  const [minOrder, setMinOrder] = useState(restaurant.minOrder.toString());

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
        Profil du Restaurant
      </h2>
      {/* Le statut Ouvert/Fermé se pilote depuis le haut du tableau de bord
          (visible sur tous les onglets) — plus besoin de venir ici. */}
      <p className="bg-bg-secondary rounded-lg px-3 py-2 text-xs font-inter text-text-secondary mb-4">
        💡 L&apos;ouverture/fermeture du restaurant se gère avec l&apos;interrupteur en haut du tableau de bord.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="block text-sm font-inter font-medium text-text-primary mb-1">Horaires d'ouverture</label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label htmlFor="profile-open-time" className="block text-[11px] text-text-muted font-inter mb-0.5">Ouverture</label>
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
              <label htmlFor="profile-close-time" className="block text-[11px] text-text-muted font-inter mb-0.5">Fermeture</label>
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
            Une fermeture après minuit est possible (ex. 10:00 → 02:00). Hors de ces horaires, votre restaurant apparaît « Fermé » aux clients.
          </p>
        </div>

        <div>
          <label htmlFor="profile-delivery-time" className="block text-sm font-inter font-medium text-text-primary mb-1">Temps de livraison estimé</label>
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
          <label className="block text-sm font-inter font-medium text-text-primary mb-1">Minimum de commande (FCFA)</label>
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
        <span className="text-sm font-inter font-medium text-text-secondary">Période :</span>
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
          <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">Revenus Bruts</p>
          <p className="font-poppins font-bold text-2xl text-text-primary">{totalRevenue.toLocaleString()} FCFA</p>
        </div>
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 text-center hover:shadow-md transition-shadow">
          <div className="w-9 h-9 rounded-lg bg-error/10 flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-4 h-4 text-error" />
          </div>
          <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">Commission MiamExpress ({Math.round(yamoCommissionRate * 100)}%)</p>
          <p className="font-poppins font-bold text-2xl text-error">-{commission.toLocaleString()} FCFA</p>
        </div>
        <div className="bg-white rounded-2xl border border-green-primary/20 shadow-sm p-5 text-center hover:shadow-md transition-shadow bg-green-50/30">
          <div className="w-9 h-9 rounded-lg bg-green-primary flex items-center justify-center mx-auto mb-3">
            <Star className="w-4 h-4 text-white" />
          </div>
          <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">Revenus Nets</p>
          <p className="font-poppins font-bold text-2xl text-green-primary">{netRevenue.toLocaleString()} FCFA</p>
        </div>
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 text-center hover:shadow-md transition-shadow">
          <div className="w-9 h-9 rounded-lg bg-gold-light flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-4 h-4 text-gold-accent" />
          </div>
          <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">Panier Moyen</p>
          <p className="font-poppins font-bold text-2xl text-text-primary">{Math.round(avgBasket).toLocaleString()} FCFA</p>
        </div>
      </div>

      {periodOrders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* S2 — évolution du CA */}
          <div className="bg-white rounded-xl border border-border-custom p-5">
            <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-primary" />Évolution du chiffre d'affaires
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
              <Flame className="w-5 h-5 text-gold-accent" />Heures de pointe
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
              <ChefHat className="w-5 h-5 text-green-primary" />Performance des plats
            </h2>
            <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
              <button
                onClick={() => setDishSort('quantity')}
                className={`px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-colors ${dishSort === 'quantity' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary'}`}
              >
                Quantité vendue
              </button>
              <button
                onClick={() => setDishSort('revenue')}
                className={`px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-colors ${dishSort === 'revenue' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary'}`}
              >
                CA généré
              </button>
            </div>
          </div>
          <div className="divide-y divide-border-light">
            {dishStats.slice(0, 8).map((dish, i) => (
              <div key={dish.name} className="py-2.5 flex items-center gap-3">
                {i < 3 ? (
                  <span className="w-6 h-6 rounded-full bg-gold-light text-gold-accent text-xs font-inter font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                ) : (
                  <span className="w-6 h-6 text-text-muted text-xs font-inter flex items-center justify-center shrink-0">{i + 1}</span>
                )}
                <p className="flex-1 font-inter font-medium text-text-primary text-sm truncate">{dish.name}</p>
                <p className="text-text-muted text-xs font-inter shrink-0">{dish.quantity} vendu{dish.quantity > 1 ? 's' : ''}</p>
                <p className="font-inter font-semibold text-green-primary text-sm shrink-0 w-24 text-right">
                  {dish.revenue.toLocaleString()} FCFA
                </p>
              </div>
            ))}
          </div>

          {leastSold.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border-light">
              <p className="flex items-center gap-1.5 text-text-muted text-xs font-inter font-medium mb-2">
                <ArrowDown className="w-3.5 h-3.5" />Les moins demandés sur la période
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
            <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">Taux d'annulation</p>
            <p className="font-poppins font-bold text-2xl text-text-primary">{cancellationRate.toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 text-center">
            <div className="w-9 h-9 rounded-lg bg-green-light flex items-center justify-center mx-auto mb-3">
              <Users className="w-4 h-4 text-green-primary" />
            </div>
            <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">Clients fidèles</p>
            <p className="font-poppins font-bold text-2xl text-text-primary">{customerStats.returningCustomers}</p>
          </div>
          <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 text-center">
            <div className="w-9 h-9 rounded-lg bg-gold-light flex items-center justify-center mx-auto mb-3">
              <UserPlus className="w-4 h-4 text-gold-accent" />
            </div>
            <p className="text-xs font-inter text-text-secondary mb-1 uppercase tracking-wide">Nouveaux clients</p>
            <p className="font-poppins font-bold text-2xl text-text-primary">{customerStats.newCustomers}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-border-custom p-5">
        <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">Historique des commandes livrées</h2>
        {periodOrders.length === 0 ? (
          <p className="text-text-secondary font-inter text-sm">Aucune commande livrée sur cette période.</p>
        ) : (
          <div className="divide-y divide-border-light">
            {periodOrders.map(order => (
              <div key={order.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-inter font-semibold text-sm text-text-primary">#{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-text-muted">{new Date(order.createdAt).toLocaleString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <p className="font-inter font-semibold text-sm text-text-primary">{order.subtotal.toLocaleString()} FCFA</p>
                  <p className="text-xs text-error">-{(order.subtotal * yamoCommissionRate).toLocaleString()} FCFA</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
