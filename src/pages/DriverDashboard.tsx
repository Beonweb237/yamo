import { useEffect, useState, useCallback, useRef } from 'react';
import { Bike, Clock, MapPin, RefreshCw, CheckCircle2, Phone, Navigation, Wallet, PackageCheck, ExternalLink, Banknote, Smartphone, Star, Volume2, VolumeX, TrendingUp, HeartHandshake } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAvailableDeliveries, fetchDriverOrders, acceptDelivery, getDeliveryContactPhone, getOrderPreparationMessage, markDelivered, markPickedUp, type Order } from '../lib/orders';
import { haversineDistance, estimateTime } from '../lib/utils';
import { fetchDriverOnlineStatus, setDriverOnline, requestPayout, fetchDriverPayouts, requestInstantCashout, getAutoSettlementInfo, getRestaurantsThatPreferMe, type PayoutRequest } from '../lib/drivers';
import { Skeleton } from '../components/ui/skeleton';
import { calculateDriverEarnings, isSurgeActive, getActiveSurgeMultiplier, calculateVolumeBonus } from '../lib/distance';
import { DRIVER_PAY_CONFIG } from '../data/launchConfig';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import LazyDeliveryMap, { type MapPoint } from '../components/LazyDeliveryMap';
import { getRestaurantCoords, getCustomerCoords, simulateDriverPosition, sendDriverPosition } from '../lib/tracking';
import { reportIncident, INCIDENT_LABELS, type IncidentType } from '../lib/incidents';
import { usePolling } from '../hooks/usePolling';
import { useSeo } from '../hooks/useSeo';
import { toast } from 'sonner';
import { phoneForWhatsapp } from '../lib/phone';
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

type Tab = 'available' | 'mine' | 'wallet';

// Lien WhatsApp avec message prérempli. Les numéros restent stockés au format national.
function whatsappTo(phone: string, message: string): string {
  return `https://wa.me/${phoneForWhatsapp(phone)}?text=${encodeURIComponent(message)}`;
}

export default function DriverDashboard({ tab: initialTab }: { tab?: Tab }) {
    const { t } = useTranslation();
  const { user } = useAuth();
  useSeo({ title: t('Espace Livreur'), noindex: true });
  const [tab, setTab] = useState<Tab>(initialTab ?? 'available');

  useEffect(() => {
    if (initialTab) setTab(initialTab);
    else setTab('available');
  }, [initialTab]);
  const [available, setAvailable] = useState<Order[]>([]);
  const [mine, setMine] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [requestingInstantCashout, setRequestingInstantCashout] = useState(false);
  const [preferredByRestaurants, setPreferredByRestaurants] = useState<Set<string>>(new Set());

  // Position réelle du livreur (CONF-15) — suivie uniquement quand il est en
  // ligne. Permission refusée / GPS indisponible → AUCUNE distance affichée
  // (jamais de valeur inventée). `driverPos` est ignorée hors ligne.
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!isOnline || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (p) => setDriverPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setDriverPos(null),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline]);
  const effectiveDriverPos = isOnline ? driverPos : null;

  // Alerte sonore nouvelle course (CONF-32 partie son) — même mécanique que
  // l'alerte nouvelle commande du dashboard restaurant.
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('yamo_driver_sound') !== 'false');
  useEffect(() => {
    localStorage.setItem('yamo_driver_sound', String(soundEnabled));
  }, [soundEnabled]);
  const knownAvailableIdsRef = useRef<Set<string> | null>(null);

  const playNewDeliverySound = useCallback(() => {
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
      playTone(988, 0, 0.2);
      playTone(1318, 0.25, 0.3);
    } catch {
      // Audio bloqué par le navigateur : le toast reste visible
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (!user) return;
    fetchDriverOnlineStatus(user.id).then(setIsOnline);
    getRestaurantsThatPreferMe(user.id).then(ids => setPreferredByRestaurants(new Set(ids)));
  }, [user]);

  const handleToggleOnline = async (next: boolean) => {
    setIsOnline(next);
    if (!user) return;
    await setDriverOnline(user.id, next);
  };

  const loadAll = useCallback(async () => {
    if (!user) return;
    const [availableData, mineData, payoutsData] = await Promise.all([
      fetchAvailableDeliveries(user.id),
      fetchDriverOrders(user.id),
      fetchDriverPayouts(user.id),
    ]);

    // Bip + toast à l'apparition d'une nouvelle course disponible.
    const known = knownAvailableIdsRef.current;
    if (known) {
      const fresh = availableData.filter((o) => !known.has(o.id));
      if (fresh.length > 0) {
        playNewDeliverySound();
        toast.info(
          fresh.length === 1
            ? `Nouvelle course disponible — vous gagnez ${fresh[0].feeBreakdown?.final?.toLocaleString() ?? fresh[0].deliveryFee.toLocaleString()} FCFA`
            : `${fresh.length} nouvelles courses disponibles`,
          { duration: 8000 },
        );
      }
    }
    knownAvailableIdsRef.current = new Set(availableData.map((o) => o.id));

    setAvailable(availableData);
    setMine(mineData);
    setPayouts(payoutsData);
    setLoading(false);
  }, [user, playNewDeliverySound]);

  usePolling(loadAll, 15000);

  const handleAccept = async (order: Order) => {
    if (!user) return;
    try {
      await acceptDelivery(order.id, user.id);
      setTab('mine');
    } catch {
      toast.error('Cette livraison vient d\'être acceptée par un autre livreur.');
    } finally {
      loadAll();
    }
  };

  const handleMarkPickedUp = async (order: Order) => {
    await markPickedUp(order.id);
    loadAll();
  };

  const handleMarkDelivered = async (order: Order) => {
    await markDelivered(order.id);
    loadAll();
  };

  // Clôture de course : preuve de livraison par code 4 chiffres (CONF-17)
  // + confirmation d'encaissement pour les espèces (CONF-16). Les anciennes
  // commandes sans code passent par la confirmation simple.
  const [confirmDeliverTarget, setConfirmDeliverTarget] = useState<Order | null>(null);
  const [deliveryCodeInput, setDeliveryCodeInput] = useState('');
  const [codeAttempts, setCodeAttempts] = useState(0);

  const requestMarkDelivered = (order: Order) => {
    if (order.deliveryCode || order.paymentMethod === 'cash') {
      setDeliveryCodeInput('');
      setCodeAttempts(0);
      setConfirmDeliverTarget(order);
    } else {
      void handleMarkDelivered(order);
    }
  };

  const confirmDelivery = async () => {
    const order = confirmDeliverTarget;
    if (!order) return;
    if (order.deliveryCode) {
      if (deliveryCodeInput.trim() !== order.deliveryCode) {
        const attempts = codeAttempts + 1;
        setCodeAttempts(attempts);
        setDeliveryCodeInput('');
        toast.error(
          attempts >= 3
            ? 'Code incorrect (3 essais). Si le client ne retrouve pas son code, utilisez le repli ci-dessous.'
            : `Code incorrect — essai ${attempts}/3. Demandez le code au client (visible dans son suivi de commande).`
        );
        return;
      }
    }
    await handleMarkDelivered(order);
    setConfirmDeliverTarget(null);
  };

  // Repli « le client n'a pas son code » : clôture tracée (deliveredWithoutCode)
  // visible par l'admin — disponible après 3 échecs de code.
  const confirmDeliveryWithoutCode = async () => {
    if (!confirmDeliverTarget) return;
    await markDelivered(confirmDeliverTarget.id, { withoutCode: true });
    setConfirmDeliverTarget(null);
    toast.info('Livraison clôturée sans code — signalée à l\'équipe MiamExpress.');
    loadAll();
  };

  // Signalement d'incident (CONF-18) : client injoignable, adresse
  // introuvable, commande incomplète — transmis à l'admin.
  const [incidentTarget, setIncidentTarget] = useState<Order | null>(null);
  const [incidentType, setIncidentType] = useState<IncidentType | ''>('');
  const [incidentNote, setIncidentNote] = useState('');
  const [reportingIncident, setReportingIncident] = useState(false);

  const openIncidentDialog = (order: Order) => {
    setIncidentType('');
    setIncidentNote('');
    setIncidentTarget(order);
  };

  const handleReportIncident = async () => {
    if (!user || !incidentTarget || !incidentType) return;
    setReportingIncident(true);
    try {
      await reportIncident({ orderId: incidentTarget.id, driverId: user.id, type: incidentType, note: incidentNote });
      setIncidentTarget(null);
      toast.success('Incident transmis à l\'équipe MiamExpress.');
    } finally {
      setReportingIncident(false);
    }
  };

  const activeMine = mine.filter((o) => ['ready', 'picked_up', 'delivering'].includes(o.status));

  // Série TRK — le livreur publie sa VRAIE position pour ses courses en route
  // (picked_up/delivering) → le client voit le suivi réel. Throttlé (≥ 15 s)
  // pour ménager le réseau 3G ; best-effort (un échec n'a aucun effet visible).
  const lastPosSentRef = useRef(0);
  useEffect(() => {
    if (!effectiveDriverPos) return;
    const now = Date.now();
    if (now - lastPosSentRef.current < 15000) return;
    const enRoute = mine.filter((o) => ['picked_up', 'delivering'].includes(o.status));
    if (enRoute.length === 0) return;
    lastPosSentRef.current = now;
    for (const o of enRoute) void sendDriverPosition(o.id, effectiveDriverPos.lat, effectiveDriverPos.lng);
  }, [effectiveDriverPos, mine]);
  const completedMine = mine.filter((o) => o.status === 'delivered');

  // S4 — revenus par période (Semaine/Mois/Tout), sélectionnable dans l'onglet "Gains".
  const [earningsPeriod, setEarningsPeriod] = useState<'week' | 'month' | 'all'>('week');
  const getEffectiveEarnings = (order: Order) => {
    return order.feeBreakdown?.final ?? order.deliveryFee;
  };
  const earningsPeriodStart =
    earningsPeriod === 'week' ? Date.now() - 7 * 86400000 :
      earningsPeriod === 'month' ? Date.now() - 30 * 86400000 : 0;
  const periodDeliveries = completedMine.filter((o) => new Date(o.createdAt).getTime() >= earningsPeriodStart);
  const periodEarnings = periodDeliveries.reduce((sum, order) => sum + getEffectiveEarnings(order), 0);

  // Série DRV — bonus de volume hebdomadaire
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Lundi
  const completedThisWeek = completedMine.filter((o) => new Date(o.createdAt).getTime() >= weekStart.getTime()).length;
  const volumeBonus = calculateVolumeBonus(completedThisWeek);

  // Balance still owed to the driver: all-time earnings minus whatever has
  // already been requested (pending or paid) — rejected requests free up the balance again.
  const allTimeEarnings = completedMine.reduce((sum, order) => sum + getEffectiveEarnings(order), 0);
  const alreadyClaimed = payouts
    .filter((p) => p.status !== 'rejected')
    .reduce((sum, p) => sum + p.amount, 0);
  const availableBalance = Math.max(0, allTimeEarnings - alreadyClaimed);
  const MIN_PAYOUT_AMOUNT = 1000;
  const pendingPayout = payouts.find((p) => p.status === 'pending');

  const handleRequestPayout = async () => {
    if (!user || availableBalance < MIN_PAYOUT_AMOUNT || requestingPayout || pendingPayout) return;
    setRequestingPayout(true);
    try {
      const payout = await requestPayout(user.id, availableBalance);
      setPayouts((prev) => [payout, ...prev]);
    } finally {
      setRequestingPayout(false);
    }
  };

  // Série DRV — Règlement automatique
  const autoSettlement = getAutoSettlementInfo(availableBalance);

  // Série DRV — Retrait instantané
  const handleInstantCashout = async () => {
    if (!user || availableBalance < DRIVER_PAY_CONFIG.INSTANT_CASHOUT_MINIMUM_FCFA || requestingInstantCashout) return;
    setRequestingInstantCashout(true);
    try {
      const { payout, grossAmount, fee, netAmount } = await requestInstantCashout(user.id, availableBalance);
      setPayouts((prev) => [payout, ...prev]);
      toast.success(
        `${grossAmount.toLocaleString()} FCFA - ${fee.toLocaleString()} FCFA frais = ${netAmount.toLocaleString()} FCFA net`,
      );
    } catch {
      toast.error("Échec du retrait instantané");
    } finally {
      setRequestingInstantCashout(false);
    }
  };

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-full mx-auto px-3 sm:px-6 py-4 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl">
            {t("Espace Livreur")}
          </h1>
          <button
            onClick={loadAll}
            className="flex items-center gap-1.5 text-text-secondary text-sm font-inter hover:text-text-primary min-h-11"
          >
            <RefreshCw className="w-4 h-4" />
            {t("Actualiser")}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex gap-1 bg-white rounded-lg border border-border-custom p-1 w-full sm:w-fit">
            <button
              onClick={() => setTab('available')}
              className={`px-4 py-2 rounded-md text-sm font-inter font-medium transition-colors flex-1 sm:flex-none ${tab === 'available' ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              {t("Disponibles (")}{available.length})
            </button>
            <button
              onClick={() => setTab('mine')}
              className={`px-4 py-2 rounded-md text-sm font-inter font-medium transition-colors flex-1 sm:flex-none ${tab === 'mine' ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              {t("Courses (")}{activeMine.length})
            </button>
            <button
              onClick={() => setTab('wallet')}
              className={`px-4 py-2 rounded-md text-sm font-inter font-medium transition-colors flex-1 sm:flex-none flex items-center justify-center gap-1.5 ${tab === 'wallet' ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              <Wallet className="w-4 h-4" />
              {t("Gains")}
            </button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? 'Désactiver l’alerte sonore' : 'Activer l’alerte sonore'}
              title={soundEnabled ? 'Alerte sonore activée' : 'Alerte sonore désactivée'}
              className="w-10 h-10 rounded-lg bg-white border border-border-custom flex items-center justify-center text-text-secondary hover:text-green-primary transition-colors shrink-0"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-border-custom flex-1 sm:flex-none justify-between">
              <span className="text-sm font-inter font-medium text-text-primary">{t("En ligne")}</span>
              <Switch
                checked={isOnline}
                onCheckedChange={handleToggleOnline}
                aria-label="Disponibilité"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-border-custom p-5">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <Skeleton className="h-3 w-2/3 mb-3" />
                <div className="flex items-center justify-between border-t border-border-light pt-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-9 w-32 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'available' ? (
          !isOnline ? (
            <div className="bg-white rounded-xl border border-border-custom p-10 text-center">
              <Bike className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-text-secondary font-inter font-medium">
                {t("Vous êtes hors ligne. Mettez-vous en ligne pour recevoir des courses.")}
              </p>
            </div>
          ) : available.length === 0 ? (
            <div className="bg-white rounded-xl border border-border-custom p-10 text-center">
              <Bike className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary font-inter font-medium">
                {t("Aucune livraison disponible pour le moment.")}
              </p>
            </div>
          ) : (
            <>
              {/* L1: Stats du jour */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-xl border border-border-custom p-3 text-center">
                  <p className="text-[11px] font-inter text-text-muted mb-0.5">{t("Gains du jour")}</p>
                  <p className="font-poppins font-bold text-sm text-green-primary">
                    {completedMine
                      .filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString())
                      .reduce((s, o) => s + getEffectiveEarnings(o), 0)
                      .toLocaleString()} {t("FCFA")}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-border-custom p-3 text-center">
                  <p className="text-[11px] font-inter text-text-muted mb-0.5">{t("Livraisons")}</p>
                  <p className="font-poppins font-bold text-sm text-text-primary">
                    {completedMine.filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString()).length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-border-custom p-3 text-center">
                  <p className="text-[11px] font-inter text-text-muted mb-0.5">{t("En attente")}</p>
                  <p className="font-poppins font-bold text-sm text-amber-700">{available.length}</p>
                </div>
              </div>
              <div className="space-y-4">
                {isSurgeActive() && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="font-inter font-semibold text-sm text-amber-800">
                        {t("🔥 Heure de pointe active")} — {t("Multiplicateur")} ×{getActiveSurgeMultiplier()}
                      </p>
                      <p className="text-xs font-inter text-amber-600 mt-0.5">
                        {t("Les courses de cette période rapportent un bonus de pointe. Profitez-en !")}
                      </p>
                    </div>
                  </div>
                )}
                {available.map((order) => {
                  // Distance réelle : position GPS du livreur → restaurant.
                  // Sans position (permission refusée) ou sans coordonnées
                  // resto : aucune distance affichée — jamais de valeur
                  // inventée (CONF-15).
                  const restoCoords = getRestaurantCoords(order.restaurantId);
                  const km = effectiveDriverPos && restoCoords
                    ? haversineDistance(effectiveDriverPos.lat, effectiveDriverPos.lng, restoCoords.lat, restoCoords.lng)
                    : null;
                  const min = km != null ? estimateTime(km) : null;
                  const prepMessage = getOrderPreparationMessage(order);
                  return (
                    <div key={order.id} className="bg-white rounded-xl border border-border-custom p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-inter font-semibold text-text-primary text-sm">
                          {t("Commande #")}{order.id.slice(0, 8)}
                        </span>
                        <span className="text-xs font-inter font-medium px-2.5 py-1 rounded-full bg-gold-light text-amber-700">
                          {t("Prête à récupérer")}
                        </span>
                        {preferredByRestaurants.has(order.restaurantId) && (
                          <span className="text-xs font-inter font-medium px-2 py-1 rounded-full bg-green-light text-green-primary flex items-center gap-1">
                            <Star className="w-3 h-3 fill-green-primary" />{t("Prioritaire")}
                          </span>
                        )}
                      </div>

                      {/* Série DRV — Décomposition de la rémunération */}
                      <div className="bg-green-light/40 rounded-lg p-3 mb-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-poppins font-bold text-green-primary text-lg">
                            {order.feeBreakdown?.final 
                              ? `${order.feeBreakdown.final.toLocaleString()} FCFA`
                              : `${order.deliveryFee.toLocaleString()} FCFA`}
                          </span>
                          {order.surgeApplied && (
                            <span className="inline-flex items-center gap-1 text-xs font-inter font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              <TrendingUp className="w-3 h-3" /> {t("🔥 Pic de demande")}
                            </span>
                          )}
                        </div>
                        {order.feeBreakdown ? (
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs font-inter text-text-secondary">
                            <span>{t("Base")} · {order.feeBreakdown.basePickup} FCFA</span>
                            <span>{t("Distance")} · {order.feeBreakdown.distancePay} FCFA</span>
                            <span>{t("Temps d'attente")} · {order.feeBreakdown.waitPay} FCFA</span>
                            {order.feeBreakdown.surgeBonus > 0 && (
                              <span className="text-amber-700">{t("Bonus surge")} · +{order.feeBreakdown.surgeBonus} FCFA</span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs font-inter text-text-secondary">
                            {t("Vous gagnez :")} {order.deliveryFee.toLocaleString()} FCFA
                          </p>
                        )}
                        {order.tipAmount && order.tipAmount > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-green-primary/10">
                            <HeartHandshake className="w-3.5 h-3.5 text-gold-accent" />
                            <span className="text-xs font-inter font-medium text-[#D4A843]">
                              +{order.tipAmount.toLocaleString()} FCFA {t("Pourboire livreur")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Privacy (CONF-23) : quartier + ville uniquement — le
                          téléphone et l'adresse exacte sont révélés après
                          acceptation, dans l'onglet Courses. */}
                      <p className="flex items-center gap-1.5 text-text-secondary text-sm font-inter mb-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {t("Livraison :")} {[order.address.neighborhood, order.address.city].filter(Boolean).join(', ') || 'Zone non précisée'}
                      </p>
                      <p className="text-xs text-text-muted font-inter mb-2">
                        {km != null
                          ? <>{t("📍 Restaurant à ~")}{km.toFixed(1)} {t("km · 🕐 ~")}{min} {t("min")}</>
                          : t("Distance indisponible — activez la localisation pour l'estimer")}
                      </p>
                      {prepMessage && (
                        <p className="flex items-center gap-1 text-xs text-text-secondary font-inter bg-bg-secondary rounded-lg px-3 py-2 mb-3">
                          <Clock className="w-3.5 h-3.5 text-gold-accent" />
                          {prepMessage}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className="text-xs gap-1">
                          {order.paymentMethod === 'cash' ? (
                            <><Banknote className="w-3 h-3" /> {t("Espèces")}</>
                          ) : order.paymentMethod === 'mtn_momo' ? (
                            <><Smartphone className="w-3 h-3" /> {t("MTN MoMo")}</>
                          ) : (
                            <><Smartphone className="w-3 h-3" /> {t("Orange Money")}</>
                          )}
                        </Badge>
                        {order.paymentMethod === 'cash' && (
                          <span className="text-xs font-inter text-text-muted">
                            {t("Valeur commande :")} {order.total.toLocaleString()} {t("FCFA")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-end border-t border-border-light pt-3">
                        <button
                          onClick={() => handleAccept(order)}
                          className="bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors"
                        >
                          {t("Accepter la livraison")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        ) : tab === 'mine' ? (
          <div className="space-y-6">
            {activeMine.length === 0 && completedMine.length === 0 ? (
              <div className="bg-white rounded-xl border border-border-custom p-10 text-center">
                <p className="text-text-secondary font-inter font-medium">
                  {t("Vous n’avez pas encore de livraison.")}
                </p>
              </div>
            ) : (
              <>
                {/* Map for active deliveries */}
                {activeMine.length > 0 && (
                  <LazyDeliveryMap
                    height="280px"
                    points={activeMine.flatMap((order): MapPoint[] => {
                      const resto = getRestaurantCoords(order.restaurantId) ?? { lat: 4.0511, lng: 9.7679 };
                      const customer = getCustomerCoords(order) ?? resto;
                      const driver = simulateDriverPosition(resto, customer, order);
                      return [
                        { ...resto, label: order.restaurantName || 'Restaurant', type: 'restaurant' },
                        { ...driver, label: 'Votre position', type: 'driver' },
                        { ...customer, label: order.address?.fullText?.slice(0, 30) || 'Client', type: 'customer' },
                      ];
                    })}
                  />
                )}
                {activeMine.map((order) => (
                  <div key={order.id} className="bg-white rounded-xl border border-border-custom p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-inter font-semibold text-text-primary text-sm">
                        {t("Commande #")}{order.id.slice(0, 8)}
                      </span>
                      <span className={`text-xs font-inter font-medium px-2.5 py-1 rounded-full ${order.status === 'ready' ? 'bg-gold-light text-amber-700' : 'bg-green-light text-green-primary'}`}>
                        {order.status === 'ready' ? 'Aller au restaurant' : 'En route vers le client'}
                      </span>
                    </div>
                    <p className="font-inter font-medium text-text-primary text-sm mb-1">{t("Restaurant :")} {order.restaurantName || 'Restaurant'}</p>
                    {getOrderPreparationMessage(order) && (
                      <p className="flex items-center gap-1 text-xs text-text-secondary font-inter bg-bg-secondary rounded-lg px-3 py-2 mb-3">
                        <Clock className="w-3.5 h-3.5 text-gold-accent" />
                        {getOrderPreparationMessage(order)}
                      </p>
                    )}
                    {order.recipient && (
                      <div className="rounded-lg bg-green-light/60 px-3 py-2 mb-3 text-xs font-inter text-text-secondary">
                        <p className="font-semibold text-text-primary">
                          {t("Pour")} {order.recipient.name || 'bénéficiaire'}{order.recipient.phone ? ` · ${order.recipient.phone}` : ''}
                        </p>
                        {order.recipient.contactInstructions && (
                          <p className="mt-1 text-text-muted">{order.recipient.contactInstructions}</p>
                        )}
                      </div>
                    )}
                    <p className="flex items-center gap-1.5 text-text-secondary text-sm font-inter mb-4">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {t("Adresse:")} {order.address.fullText || 'Adresse non renseignée'}
                    </p>
                    <div className="flex items-center gap-2 mb-4">
                      <a
                        href={`tel:${getDeliveryContactPhone(order)}`}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-bg-secondary text-text-primary font-inter text-sm h-10 rounded-lg hover:bg-border-light transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        {t("Appeler le")} {order.recipient ? 'bénéficiaire' : 'client'}
                      </a>
                      {(() => {
                        // GPS contextuel (CONF-15) : vers le RESTAURANT tant que
                        // la commande n'est pas récupérée, vers le client ensuite.
                        const goingToResto = order.status === 'ready';
                        const restoCoords = getRestaurantCoords(order.restaurantId);
                        const gpsDest = goingToResto
                          ? (restoCoords
                            ? `${restoCoords.lat},${restoCoords.lng}`
                            : encodeURIComponent(order.restaurantName || 'restaurant'))
                          : (order.address.lat != null && order.address.lng != null
                            ? `${order.address.lat},${order.address.lng}`
                            : encodeURIComponent(order.address.fullText || ''));
                        return (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${gpsDest}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 bg-bg-secondary text-text-primary font-inter text-sm h-10 rounded-lg hover:bg-border-light transition-colors"
                          >
                            <Navigation className="w-4 h-4" />
                            {t("GPS")} {goingToResto ? 'restaurant' : 'client'}
                            <ExternalLink className="w-3 h-3 text-text-muted" />
                          </a>
                        );
                      })()}
                    </div>
                    {/* Messages réels via WhatsApp (remplace les toasts simulés — CONF-07) */}
                    {(order.status === 'delivering' || order.status === 'picked_up') && (() => {
                      const clientPhone = getDeliveryContactPhone(order);
                      if (!clientPhone) return null;
                      const ref = `commande MiamExpress #${order.id.slice(0, 8)}`;
                      const messages = [
                        { label: 'Je suis arrivé', icon: '📍', text: `Bonjour, votre livreur est arrivé (${ref}).` },
                        { label: 'Adresse introuvable', icon: '❓', text: `Bonjour, je ne trouve pas l'adresse indiquée (${ref}). Pouvez-vous me guider ?` },
                        { label: 'Merci de descendre', icon: '🙏', text: `Bonjour, votre commande est là (${ref}) — merci de descendre la récupérer.` },
                      ];
                      return (
                        <div className="flex gap-1.5 mb-4 flex-wrap">
                          {messages.map((msg) => (
                            <a
                              key={msg.label}
                              href={whatsappTo(clientPhone, msg.text)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Envoyer sur WhatsApp : ${msg.label}`}
                              className="text-xs bg-bg-secondary rounded-full px-3.5 py-2.5 text-text-secondary font-inter hover:bg-green-light hover:text-green-primary transition-colors inline-flex items-center"
                            >
                              {msg.icon} {msg.label}
                            </a>
                          ))}
                        </div>
                      );
                    })()}
                    {/* Espèces à encaisser (CONF-16) */}
                    {order.paymentMethod === 'cash' && (
                      <p className="flex items-center gap-1.5 bg-gold-light text-amber-700 font-inter font-semibold text-sm rounded-lg px-3 py-2 mb-4">
                        <Banknote className="w-4 h-4 shrink-0" />
                        {t("À encaisser à la livraison :")} {order.total.toLocaleString()} {t("FCFA")}
                      </p>
                    )}
                    {/* Incident (CONF-18) */}
                    <button
                      type="button"
                      onClick={() => openIncidentDialog(order)}
                      className="flex items-center gap-1.5 text-error font-inter text-xs font-medium mb-4 hover:opacity-80 transition-opacity min-h-11"
                    >
                      {t("⚠️ Signaler un problème (client injoignable, adresse introuvable...)")}
                    </button>
                    <div className="flex items-center justify-between border-t border-border-light pt-3">
                      <span className="font-inter font-bold text-text-primary text-sm">
                        {order.total.toLocaleString()} {t("FCFA")}
                      </span>
                      {order.status === 'ready' ? (
                        <button
                          onClick={() => handleMarkPickedUp(order)}
                          className="flex items-center gap-1.5 bg-gold-accent text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-gold-dark transition-colors"
                        >
                          <PackageCheck className="w-4 h-4" />
                          {t("Commande récupérée")}
                        </button>
                      ) : (
                        <button
                          onClick={() => requestMarkDelivered(order)}
                          className="flex items-center gap-1.5 bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {t("Marquer comme livrée")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {completedMine.length > 0 && (
                  <div>
                    <h2 className="font-poppins font-semibold text-text-primary text-lg mb-3">
                      {t("Terminées")}
                    </h2>
                    <div className="space-y-2">
                      {completedMine.map((order) => (
                        <div key={order.id} className="bg-white rounded-xl border border-border-custom p-4 flex items-center justify-between">
                          <span className="font-inter text-text-secondary text-sm">
                            #{order.id.slice(0, 8)}
                          </span>
                          <span className="flex items-center gap-1 text-text-muted text-xs font-inter">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(order.createdAt).toLocaleString('fr-FR')}
                          </span>
                          <span className="font-inter font-semibold text-text-primary text-sm">
                            {order.total.toLocaleString()} {t("FCFA")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm font-inter font-medium text-text-secondary">{t("Période :")}</span>
              {(['week', 'month', 'all'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setEarningsPeriod(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-colors ${earningsPeriod === p ? 'bg-green-primary text-white' : 'bg-white border border-border-custom text-text-secondary hover:text-text-primary'
                    }`}
                >
                  {p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Tout'}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-border-custom p-6 text-center max-w-sm mx-auto">
              <div className="w-12 h-12 bg-green-light rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-6 h-6 text-green-primary" />
              </div>
              <p className="text-sm font-inter text-text-secondary mb-1">
                {t("Gains —")} {earningsPeriod === 'week' ? 'cette semaine' : earningsPeriod === 'month' ? 'ce mois' : 'total'}
              </p>
              <p className="font-poppins font-bold text-3xl text-text-primary mb-1">
                {periodEarnings.toLocaleString()} {t("FCFA")}
              </p>
              <p className="text-xs font-inter text-text-muted mb-1">
                {periodDeliveries.length} {t("livraison")}{periodDeliveries.length > 1 ? 's' : ''} {t("sur cette période")}
              </p>
              <p className="text-xs font-inter text-text-muted mb-6">
                {t("Solde disponible :")} {availableBalance.toLocaleString()} {t("FCFA")}
              </p>

              {/* Série DRV — Barre de progression bonus de volume */}
              <div className="bg-white border border-border-custom rounded-xl p-5 mb-5 max-w-sm mx-auto text-left">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-poppins font-semibold text-sm text-text-primary">
                    {t("Bonus hebdomadaire")}
                  </h3>
                  {volumeBonus.bonusFcfa > 0 && (
                    <span className="text-xs font-inter font-bold text-gold-accent bg-gold-light/50 px-2 py-0.5 rounded-full">
                      +{volumeBonus.bonusFcfa.toLocaleString()} {t("FCFA")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-inter text-text-muted">{t("Progression bonus")}</span>
                  <span className="text-xs font-inter font-semibold text-text-primary ml-auto">
                    {completedThisWeek} {t("courses cette semaine")}
                  </span>
                </div>
                {/* Barre de progression */}
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-green-primary to-gold-accent rounded-full transition-all duration-500"
                    style={{ width: `${volumeBonus.progressPercent}%` }}
                  />
                </div>
                {/* Paliers */}
                <div className="flex items-center justify-between mb-2">
                  {DRIVER_PAY_CONFIG.VOLUME_BONUS_TIERS.map((tier) => {
                    const isReached = completedThisWeek >= tier.minDeliveries;
                    return (
                      <div key={tier.minDeliveries} className="flex flex-col items-center">
                        <div className={`w-2 h-2 rounded-full mb-0.5 ${isReached ? 'bg-gold-accent' : 'bg-gray-300'}`} />
                        <span className={`text-[10px] font-inter ${isReached ? 'font-bold text-gold-accent' : 'text-text-muted'}`}>
                          {tier.minDeliveries}
                        </span>
                        <span className={`text-[9px] font-inter ${isReached ? 'text-[#D4A843]' : 'text-text-muted'}`}>
                          +{tier.bonusFcfa.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {volumeBonus.nextTier ? (
                  <p className="text-xs font-inter text-text-secondary">
                    {t("Prochain palier")} : {volumeBonus.nextTier.minDeliveries} {t("courses cette semaine")} (+{volumeBonus.nextTier.bonusFcfa.toLocaleString()} {t("FCFA")})
                    {' — '}{volumeBonus.nextTier.remaining} {t("courses cette semaine")} {t("restantes")}
                  </p>
                ) : (
                  volumeBonus.bonusFcfa > 0 && (
                    <p className="text-xs font-inter font-medium text-gold-accent">{t("Palier atteint")} 🎉</p>
                  )
                )}
              </div>

              {pendingPayout ? (
                <p className="text-sm font-inter text-amber-700 font-medium">
                  {t("Virement de")} {pendingPayout.amount.toLocaleString()} {t("FCFA en attente de traitement")}
                </p>
              ) : (
                <>
                  <button
                    onClick={handleRequestPayout}
                    disabled={availableBalance < MIN_PAYOUT_AMOUNT || requestingPayout}
                    className="w-full bg-green-primary text-white font-inter font-medium text-sm h-11 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {requestingPayout ? 'Envoi...' : 'Demander un virement'}
                  </button>
                  {availableBalance < MIN_PAYOUT_AMOUNT && (
                    <p className="text-xs font-inter text-text-muted mt-2">
                      {t("Solde minimum pour un virement :")} {MIN_PAYOUT_AMOUNT.toLocaleString()} {t("FCFA")}
                    </p>
                  )}
                </>
              )}

              {/* Série DRV — Retrait instantané */}
              <div className="mt-3 pt-3 border-t border-border-light">
                <button
                  onClick={handleInstantCashout}
                  disabled={availableBalance < DRIVER_PAY_CONFIG.INSTANT_CASHOUT_MINIMUM_FCFA || requestingInstantCashout}
                  className="w-full bg-white border border-gold-accent text-gold-accent font-inter font-medium text-sm h-11 rounded-lg hover:bg-gold-light/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {requestingInstantCashout
                    ? 'Envoi...'
                    : `${t("Retrait instantané")} (−${DRIVER_PAY_CONFIG.INSTANT_CASHOUT_FEE_PERCENT}% ${t("Frais de retrait instantané")})`}
                </button>
                {availableBalance < DRIVER_PAY_CONFIG.INSTANT_CASHOUT_MINIMUM_FCFA && (
                  <p className="text-xs font-inter text-text-muted mt-2">
                    {t("Solde minimum pour un virement :")} {DRIVER_PAY_CONFIG.INSTANT_CASHOUT_MINIMUM_FCFA.toLocaleString()} {t("FCFA")}
                  </p>
                )}
              </div>

              {/* Série DRV — Prochain règlement automatique */}
              <div className="mt-4 bg-green-light/30 rounded-xl px-4 py-3 max-w-sm mx-auto">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-green-primary" />
                  <span className="font-inter font-semibold text-xs text-green-primary">
                    {t("Règlement automatique")}
                  </span>
                </div>
                <p className="text-xs font-inter text-text-secondary">
                  {autoSettlement.isToday
                    ? t("Virement automatique chaque lundi")
                    : `${t("Prochain règlement")} : ${autoSettlement.nextSettlementDay}`}
                </p>
                {!autoSettlement.eligible && (
                  <p className="text-xs font-inter text-text-muted mt-1">
                    {t("Solde minimum pour un virement :")} {autoSettlement.minimumFcfa.toLocaleString()} {t("FCFA")}
                  </p>
                )}
              </div>
            </div>
            {payouts.length > 0 && (
              <div className="bg-white rounded-xl border border-border-custom p-5">
                <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">{t("Historique des virements")}</h2>
                <div className="divide-y divide-border-light">
                  {payouts.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-inter font-semibold text-sm text-text-primary">
                          {p.amount.toLocaleString()} {t("FCFA")}
                        </p>
                        <p className="text-xs text-text-muted">{new Date(p.requestedAt).toLocaleString('fr-FR')}</p>
                        {p.status === 'rejected' && p.processedReason && (
                          <p className="text-xs text-error font-inter mt-0.5">{t("Motif :")} {p.processedReason}</p>
                        )}
                      </div>
                      <span className={`shrink-0 text-xs font-inter font-medium px-2.5 py-1 rounded-full ${p.status === 'paid'
                        ? 'bg-green-light text-green-primary'
                        : p.status === 'rejected'
                          ? 'bg-error/10 text-error'
                          : 'bg-gold-light text-amber-700'
                        }`}>
                        {p.status === 'paid' ? 'Payé' : p.status === 'rejected' ? 'Refusé' : 'En attente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {completedMine.length > 0 && (
              <div className="bg-white rounded-xl border border-border-custom p-5">
                <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">{t("Historique des courses")}</h2>
                <div className="divide-y divide-border-light">
                  {completedMine.map(order => (
                    <div key={order.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-inter font-semibold text-sm text-text-primary">#{order.id.slice(0, 8)}</p>
                        <p className="text-xs text-text-muted">{new Date(order.createdAt).toLocaleString('fr-FR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-inter font-semibold text-sm text-green-primary">+{getEffectiveEarnings(order).toLocaleString()} {t("FCFA")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clôture de livraison : code de preuve (CONF-17) + encaissement espèces (CONF-16) */}
      <AlertDialog open={!!confirmDeliverTarget} onOpenChange={(open) => { if (!open) setConfirmDeliverTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Confirmer la livraison ?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Commande #")}{confirmDeliverTarget?.id.slice(0, 8)}
              {confirmDeliverTarget?.paymentMethod === 'cash' && (
                <>
                  {' '}{t("payée en espèces — vous devez avoir encaissé")}{' '}
                  <span className="font-semibold text-text-primary">
                    {confirmDeliverTarget?.total.toLocaleString()} {t("FCFA")}
                  </span>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmDeliverTarget?.deliveryCode && (
            <div>
              <label htmlFor="delivery-code" className="block text-text-secondary font-inter text-sm mb-1.5">
                {t("Code de livraison du client")} <span className="text-error">*</span>
              </label>
              <input
                id="delivery-code"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={deliveryCodeInput}
                onChange={(e) => setDeliveryCodeInput(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                autoFocus
                className="w-full bg-bg-secondary rounded-lg px-3 h-12 text-text-primary font-poppins font-bold text-2xl tracking-[0.3em] text-center outline-none placeholder:text-text-muted placeholder:font-normal"
              />
              <p className="text-text-muted text-xs font-inter mt-1.5">
                {t("Le client voit ce code dans son suivi de commande.")}
              </p>
              {codeAttempts >= 3 && (
                <button
                  type="button"
                  onClick={confirmDeliveryWithoutCode}
                  className="mt-2 w-full border border-amber-700 text-amber-700 font-inter font-medium text-sm h-10 rounded-lg hover:bg-gold-light transition-colors"
                >
                  {t("Le client n’a pas son code — clôturer quand même (signalé)")}
                </button>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Pas encore")}</AlertDialogCancel>
            <button
              type="button"
              onClick={confirmDelivery}
              disabled={Boolean(confirmDeliverTarget?.deliveryCode) && deliveryCodeInput.length !== 4}
              className="inline-flex items-center justify-center bg-green-primary text-white font-inter font-medium text-sm h-10 px-4 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirmDeliverTarget?.paymentMethod === 'cash' ? 'J\'ai encaissé — livraison terminée' : 'Confirmer la livraison'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Signalement d'incident (CONF-18) */}
      <AlertDialog open={!!incidentTarget} onOpenChange={(open) => { if (!open) setIncidentTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Signaler un problème")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Commande #")}{incidentTarget?.id.slice(0, 8)} {t("— l’équipe MiamExpress sera prévenue immédiatement.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="incident-type" className="block text-text-secondary font-inter text-sm mb-1.5">
                {t("Type de problème")} <span className="text-error">*</span>
              </label>
              <select
                id="incident-type"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
              >
                <option value="" disabled>{t("Sélectionnez le problème")}</option>
                {(Object.keys(INCIDENT_LABELS) as IncidentType[])
                  .filter((t) => t !== 'commande_non_conforme' /* motif réservé au client (série PTS) */)
                  .map((t) => (
                    <option key={t} value={t}>{INCIDENT_LABELS[t]}</option>
                  ))}
              </select>
            </div>
            <textarea
              value={incidentNote}
              onChange={(e) => setIncidentNote(e.target.value)}
              placeholder="Détails utiles (optionnel)..."
              rows={2}
              className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Annuler")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReportIncident}
              disabled={!incidentType || reportingIncident}
              className="bg-error text-white hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reportingIncident ? 'Envoi...' : 'Transmettre l\'incident'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile bottom nav — fixed, visible only on small screens */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border-custom shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => setTab('available')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${tab === 'available' ? 'text-green-primary' : 'text-text-muted'
            }`}
        >
          <Bike className="w-5 h-5" />
          <span className="text-[10px] font-inter font-medium">{t("Dispo")}{available.length > 0 ? ` (${available.length})` : ''}</span>
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${tab === 'mine' ? 'text-green-primary' : 'text-text-muted'
            }`}
        >
          <PackageCheck className="w-5 h-5" />
          <span className="text-[10px] font-inter font-medium">{t("Courses")}{activeMine.length > 0 ? ` (${activeMine.length})` : ''}</span>
        </button>
        <button
          onClick={() => setTab('wallet')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${tab === 'wallet' ? 'text-green-primary' : 'text-text-muted'
            }`}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] font-inter font-medium">{t("Gains")}</span>
        </button>
      </nav>
      <div className="sm:hidden h-16" /> {/* spacer for bottom nav */}
    </div>
  );
}

