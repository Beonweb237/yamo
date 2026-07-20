import { useEffect, useState, useCallback, useRef } from 'react';
import { Bike, Clock, MapPin, RefreshCw, CheckCircle2, Phone, Navigation, Wallet, PackageCheck, ExternalLink, Banknote, Smartphone, Star, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAvailableDeliveries, fetchDriverOrders, acceptDelivery, getDeliveryContactPhone, getOrderPreparationMessage, markDelivered, markPickedUp, type Order } from '../lib/orders';
import { haversineDistance, estimateTime } from '../lib/utils';
import { fetchDriverOnlineStatus, setDriverOnline, requestPayout, fetchDriverPayouts, getRestaurantsThatPreferMe, type PayoutRequest } from '../lib/drivers';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import LazyDeliveryMap, { type MapPoint } from '../components/LazyDeliveryMap';
import { getRestaurantCoords, getCustomerCoords, simulateDriverPosition } from '../lib/tracking';
import { reportIncident, INCIDENT_LABELS, type IncidentType } from '../lib/incidents';
import { usePolling } from '../hooks/usePolling';
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

type Tab = 'available' | 'mine' | 'wallet';

// Lien WhatsApp avec message prérempli. Les numéros restent stockés au format national.
function whatsappTo(phone: string, message: string): string {
  return `https://wa.me/${phoneForWhatsapp(phone)}?text=${encodeURIComponent(message)}`;
}

export default function DriverDashboard({ tab: initialTab }: { tab?: Tab }) {
  const { user } = useAuth();
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
            ? `Nouvelle course disponible — vous gagnez ${fresh[0].deliveryFee.toLocaleString()} FCFA`
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
  const completedMine = mine.filter((o) => o.status === 'delivered');

  // S4 — revenus par période (Semaine/Mois/Tout), sélectionnable dans l'onglet "Gains".
  const [earningsPeriod, setEarningsPeriod] = useState<'week' | 'month' | 'all'>('week');
  const earningsPeriodStart =
    earningsPeriod === 'week' ? Date.now() - 7 * 86400000 :
      earningsPeriod === 'month' ? Date.now() - 30 * 86400000 : 0;
  const periodDeliveries = completedMine.filter((o) => new Date(o.createdAt).getTime() >= earningsPeriodStart);
  const periodEarnings = periodDeliveries.reduce((sum, order) => sum + order.deliveryFee, 0);

  // Balance still owed to the driver: all-time earnings minus whatever has
  // already been requested (pending or paid) — rejected requests free up the balance again.
  const allTimeEarnings = completedMine.reduce((sum, order) => sum + order.deliveryFee, 0);
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

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-full mx-auto px-3 sm:px-6 py-4 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl">
            Espace Livreur
          </h1>
          <button
            onClick={loadAll}
            className="flex items-center gap-1.5 text-text-secondary text-sm font-inter hover:text-text-primary min-h-11"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex gap-1 bg-white rounded-lg border border-border-custom p-1 w-full sm:w-fit">
            <button
              onClick={() => setTab('available')}
              className={`px-4 py-2 rounded-md text-sm font-inter font-medium transition-colors flex-1 sm:flex-none ${tab === 'available' ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              Disponibles ({available.length})
            </button>
            <button
              onClick={() => setTab('mine')}
              className={`px-4 py-2 rounded-md text-sm font-inter font-medium transition-colors flex-1 sm:flex-none ${tab === 'mine' ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              Courses ({activeMine.length})
            </button>
            <button
              onClick={() => setTab('wallet')}
              className={`px-4 py-2 rounded-md text-sm font-inter font-medium transition-colors flex-1 sm:flex-none flex items-center justify-center gap-1.5 ${tab === 'wallet' ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              <Wallet className="w-4 h-4" />
              Gains
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
              <span className="text-sm font-inter font-medium text-text-primary">En ligne</span>
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
                Vous êtes hors ligne. Mettez-vous en ligne pour recevoir des courses.
              </p>
            </div>
          ) : available.length === 0 ? (
            <div className="bg-white rounded-xl border border-border-custom p-10 text-center">
              <Bike className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary font-inter font-medium">
                Aucune livraison disponible pour le moment.
              </p>
            </div>
          ) : (
            <>
              {/* L1: Stats du jour */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white rounded-xl border border-border-custom p-3 text-center">
                  <p className="text-[11px] font-inter text-text-muted mb-0.5">Gains du jour</p>
                  <p className="font-poppins font-bold text-sm text-green-primary">
                    {completedMine
                      .filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString())
                      .reduce((s, o) => s + o.deliveryFee, 0)
                      .toLocaleString()} FCFA
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-border-custom p-3 text-center">
                  <p className="text-[11px] font-inter text-text-muted mb-0.5">Livraisons</p>
                  <p className="font-poppins font-bold text-sm text-text-primary">
                    {completedMine.filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString()).length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-border-custom p-3 text-center">
                  <p className="text-[11px] font-inter text-text-muted mb-0.5">En attente</p>
                  <p className="font-poppins font-bold text-sm text-amber-700">{available.length}</p>
                </div>
              </div>
              <div className="space-y-4">
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
                          Commande #{order.id.slice(0, 8)}
                        </span>
                        <span className="text-xs font-inter font-medium px-2.5 py-1 rounded-full bg-gold-light text-amber-700">
                          Prête à récupérer
                        </span>
                        {preferredByRestaurants.has(order.restaurantId) && (
                          <span className="text-xs font-inter font-medium px-2 py-1 rounded-full bg-green-light text-green-primary flex items-center gap-1">
                            <Star className="w-3 h-3 fill-green-primary" />Prioritaire
                          </span>
                        )}
                      </div>

                      {/* Rémunération = l'information de décision n°1 */}
                      <p className="font-poppins font-bold text-green-primary text-xl mb-1">
                        Vous gagnez : {order.deliveryFee.toLocaleString()} FCFA
                      </p>

                      {/* Privacy (CONF-23) : quartier + ville uniquement — le
                          téléphone et l'adresse exacte sont révélés après
                          acceptation, dans l'onglet Courses. */}
                      <p className="flex items-center gap-1.5 text-text-secondary text-sm font-inter mb-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        Livraison : {[order.address.neighborhood, order.address.city].filter(Boolean).join(', ') || 'Zone non précisée'}
                      </p>
                      <p className="text-xs text-text-muted font-inter mb-2">
                        {km != null
                          ? <>📍 Restaurant à ~{km.toFixed(1)} km · 🕐 ~{min} min</>
                          : 'Distance indisponible — activez la localisation pour l’estimer'}
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
                            <><Banknote className="w-3 h-3" /> Espèces</>
                          ) : order.paymentMethod === 'mtn_momo' ? (
                            <><Smartphone className="w-3 h-3" /> MTN MoMo</>
                          ) : (
                            <><Smartphone className="w-3 h-3" /> Orange Money</>
                          )}
                        </Badge>
                        {order.paymentMethod === 'cash' && (
                          <span className="text-xs font-inter text-text-muted">
                            Valeur commande : {order.total.toLocaleString()} FCFA
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-end border-t border-border-light pt-3">
                        <button
                          onClick={() => handleAccept(order)}
                          className="bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors"
                        >
                          Accepter la livraison
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
                  Vous n&apos;avez pas encore de livraison.
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
                        Commande #{order.id.slice(0, 8)}
                      </span>
                      <span className={`text-xs font-inter font-medium px-2.5 py-1 rounded-full ${order.status === 'ready' ? 'bg-gold-light text-amber-700' : 'bg-green-light text-green-primary'}`}>
                        {order.status === 'ready' ? 'Aller au restaurant' : 'En route vers le client'}
                      </span>
                    </div>
                    <p className="font-inter font-medium text-text-primary text-sm mb-1">Restaurant : {order.restaurantName || 'Restaurant'}</p>
                    {getOrderPreparationMessage(order) && (
                      <p className="flex items-center gap-1 text-xs text-text-secondary font-inter bg-bg-secondary rounded-lg px-3 py-2 mb-3">
                        <Clock className="w-3.5 h-3.5 text-gold-accent" />
                        {getOrderPreparationMessage(order)}
                      </p>
                    )}
                    {order.recipient && (
                      <div className="rounded-lg bg-green-light/60 px-3 py-2 mb-3 text-xs font-inter text-text-secondary">
                        <p className="font-semibold text-text-primary">
                          Pour {order.recipient.name || 'bénéficiaire'}{order.recipient.phone ? ` · ${order.recipient.phone}` : ''}
                        </p>
                        {order.recipient.contactInstructions && (
                          <p className="mt-1 text-text-muted">{order.recipient.contactInstructions}</p>
                        )}
                      </div>
                    )}
                    <p className="flex items-center gap-1.5 text-text-secondary text-sm font-inter mb-4">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      Adresse: {order.address.fullText || 'Adresse non renseignée'}
                    </p>
                    <div className="flex items-center gap-2 mb-4">
                      <a
                        href={`tel:${getDeliveryContactPhone(order)}`}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-bg-secondary text-text-primary font-inter text-sm h-10 rounded-lg hover:bg-border-light transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        Appeler le {order.recipient ? 'bénéficiaire' : 'client'}
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
                            GPS {goingToResto ? 'restaurant' : 'client'}
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
                        À encaisser à la livraison : {order.total.toLocaleString()} FCFA
                      </p>
                    )}
                    {/* Incident (CONF-18) */}
                    <button
                      type="button"
                      onClick={() => openIncidentDialog(order)}
                      className="flex items-center gap-1.5 text-error font-inter text-xs font-medium mb-4 hover:opacity-80 transition-opacity min-h-11"
                    >
                      ⚠️ Signaler un problème (client injoignable, adresse introuvable...)
                    </button>
                    <div className="flex items-center justify-between border-t border-border-light pt-3">
                      <span className="font-inter font-bold text-text-primary text-sm">
                        {order.total.toLocaleString()} FCFA
                      </span>
                      {order.status === 'ready' ? (
                        <button
                          onClick={() => handleMarkPickedUp(order)}
                          className="flex items-center gap-1.5 bg-gold-accent text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-gold-dark transition-colors"
                        >
                          <PackageCheck className="w-4 h-4" />
                          Commande récupérée
                        </button>
                      ) : (
                        <button
                          onClick={() => requestMarkDelivered(order)}
                          className="flex items-center gap-1.5 bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Marquer comme livrée
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {completedMine.length > 0 && (
                  <div>
                    <h2 className="font-poppins font-semibold text-text-primary text-lg mb-3">
                      Terminées
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
                            {order.total.toLocaleString()} FCFA
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
              <span className="text-sm font-inter font-medium text-text-secondary">Période :</span>
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
                Gains — {earningsPeriod === 'week' ? 'cette semaine' : earningsPeriod === 'month' ? 'ce mois' : 'total'}
              </p>
              <p className="font-poppins font-bold text-3xl text-text-primary mb-1">
                {periodEarnings.toLocaleString()} FCFA
              </p>
              <p className="text-xs font-inter text-text-muted mb-1">
                {periodDeliveries.length} livraison{periodDeliveries.length > 1 ? 's' : ''} sur cette période
              </p>
              <p className="text-xs font-inter text-text-muted mb-6">
                Solde disponible : {availableBalance.toLocaleString()} FCFA
              </p>
              {pendingPayout ? (
                <p className="text-sm font-inter text-amber-700 font-medium">
                  Virement de {pendingPayout.amount.toLocaleString()} FCFA en attente de traitement
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
                      Solde minimum pour un virement : {MIN_PAYOUT_AMOUNT.toLocaleString()} FCFA
                    </p>
                  )}
                </>
              )}
            </div>
            {payouts.length > 0 && (
              <div className="bg-white rounded-xl border border-border-custom p-5">
                <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">Historique des virements</h2>
                <div className="divide-y divide-border-light">
                  {payouts.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-inter font-semibold text-sm text-text-primary">
                          {p.amount.toLocaleString()} FCFA
                        </p>
                        <p className="text-xs text-text-muted">{new Date(p.requestedAt).toLocaleString('fr-FR')}</p>
                        {p.status === 'rejected' && p.processedReason && (
                          <p className="text-xs text-error font-inter mt-0.5">Motif : {p.processedReason}</p>
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
                <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">Historique des courses</h2>
                <div className="divide-y divide-border-light">
                  {completedMine.map(order => (
                    <div key={order.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-inter font-semibold text-sm text-text-primary">#{order.id.slice(0, 8)}</p>
                        <p className="text-xs text-text-muted">{new Date(order.createdAt).toLocaleString('fr-FR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-inter font-semibold text-sm text-green-primary">+{order.deliveryFee.toLocaleString()} FCFA</p>
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
            <AlertDialogTitle>Confirmer la livraison ?</AlertDialogTitle>
            <AlertDialogDescription>
              Commande #{confirmDeliverTarget?.id.slice(0, 8)}
              {confirmDeliverTarget?.paymentMethod === 'cash' && (
                <>
                  {' '}payée en espèces — vous devez avoir encaissé{' '}
                  <span className="font-semibold text-text-primary">
                    {confirmDeliverTarget?.total.toLocaleString()} FCFA
                  </span>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmDeliverTarget?.deliveryCode && (
            <div>
              <label htmlFor="delivery-code" className="block text-text-secondary font-inter text-sm mb-1.5">
                Code de livraison du client <span className="text-error">*</span>
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
                Le client voit ce code dans son suivi de commande.
              </p>
              {codeAttempts >= 3 && (
                <button
                  type="button"
                  onClick={confirmDeliveryWithoutCode}
                  className="mt-2 w-full border border-amber-700 text-amber-700 font-inter font-medium text-sm h-10 rounded-lg hover:bg-gold-light transition-colors"
                >
                  Le client n&apos;a pas son code — clôturer quand même (signalé)
                </button>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Pas encore</AlertDialogCancel>
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
            <AlertDialogTitle>Signaler un problème</AlertDialogTitle>
            <AlertDialogDescription>
              Commande #{incidentTarget?.id.slice(0, 8)} — l&apos;équipe MiamExpress sera prévenue immédiatement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="incident-type" className="block text-text-secondary font-inter text-sm mb-1.5">
                Type de problème <span className="text-error">*</span>
              </label>
              <select
                id="incident-type"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
              >
                <option value="" disabled>Sélectionnez le problème</option>
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
            <AlertDialogCancel>Annuler</AlertDialogCancel>
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
          <span className="text-[10px] font-inter font-medium">Dispo{available.length > 0 ? ` (${available.length})` : ''}</span>
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${tab === 'mine' ? 'text-green-primary' : 'text-text-muted'
            }`}
        >
          <PackageCheck className="w-5 h-5" />
          <span className="text-[10px] font-inter font-medium">Courses{activeMine.length > 0 ? ` (${activeMine.length})` : ''}</span>
        </button>
        <button
          onClick={() => setTab('wallet')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${tab === 'wallet' ? 'text-green-primary' : 'text-text-muted'
            }`}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] font-inter font-medium">Gains</span>
        </button>
      </nav>
      <div className="sm:hidden h-16" /> {/* spacer for bottom nav */}
    </div>
  );
}

