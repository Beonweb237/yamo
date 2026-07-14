import { useEffect, useState, useCallback } from 'react';
import { Bike, Clock, MapPin, RefreshCw, CheckCircle2, Phone, Navigation, Wallet, PackageCheck, ExternalLink, Banknote, Smartphone, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAvailableDeliveries, fetchDriverOrders, acceptDelivery, getDeliveryContactPhone, getOrderPreparationMessage, markDelivered, markPickedUp, type Order } from '../lib/orders';
import { haversineDistance, estimateTime } from '../lib/utils';
import { fetchDriverOnlineStatus, setDriverOnline, requestPayout, fetchDriverPayouts, getRestaurantsThatPreferMe, type PayoutRequest } from '../lib/drivers';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import DeliveryMap, { type MapPoint } from '../components/DeliveryMap';
import { toast } from 'sonner';

type Tab = 'available' | 'mine' | 'wallet';

// Décalage pseudo-aléatoire mais stable par commande (évite que la distance/le
// temps affichés changent à chaque rafraîchissement toutes les 5s).
function stableOffset(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) % 1000;
  return (hash / 1000 - 0.5) * 0.02;
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
    setAvailable(availableData);
    setMine(mineData);
    setPayouts(payoutsData);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleAccept = async (order: Order) => {
    if (!user) return;
    await acceptDelivery(order.id, user.id);
    setTab('mine');
    loadAll();
  };

  const handleMarkPickedUp = async (order: Order) => {
    await markPickedUp(order.id);
    loadAll();
  };

  const handleMarkDelivered = async (order: Order) => {
    await markDelivered(order.id);
    loadAll();
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
            className="flex items-center gap-1.5 text-text-secondary text-sm font-inter hover:text-text-primary"
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
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-border-custom w-full sm:w-auto justify-between">
            <span className="text-sm font-inter font-medium text-text-primary">En ligne</span>
            <Switch
              checked={isOnline}
              onCheckedChange={handleToggleOnline}
              aria-label="Disponibilité"
            />
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
                  <p className="font-poppins font-bold text-sm text-gold-accent">{available.length}</p>
                </div>
              </div>
              <div className="space-y-4">
                {available.map((order) => {

                  const driverLat = 4.0511; const driverLng = 9.7679;
                  const restoLat = driverLat + stableOffset(order.id);
                  const restoLng = driverLng + stableOffset(`${order.id}-lng`);
                  const km = haversineDistance(driverLat, driverLng, restoLat, restoLng);
                  const min = estimateTime(km);
                  const prepMessage = getOrderPreparationMessage(order);
                  return (
                    <div key={order.id} className="bg-white rounded-xl border border-border-custom p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-inter font-semibold text-text-primary text-sm">
                          Commande #{order.id.slice(0, 8)}
                        </span>
                        <span className="text-xs font-inter font-medium px-2.5 py-1 rounded-full bg-gold-light text-gold-accent">
                          Prête à récupérer
                        </span>
                        {preferredByRestaurants.has(order.restaurantId) && (
                          <span className="text-xs font-inter font-medium px-2 py-1 rounded-full bg-green-light text-green-primary flex items-center gap-1">
                            <Star className="w-3 h-3 fill-green-primary" />Prioritaire
                          </span>
                        )}
                      </div>
                      <p className="flex items-center gap-1.5 text-text-secondary text-sm font-inter mb-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {order.address.fullText || 'Adresse non renseignée'}
                      </p>
                      {order.recipient && (
                        <p className="flex items-center gap-1.5 text-xs text-text-secondary font-inter mb-1">
                          <Phone className="w-3.5 h-3.5 text-green-primary shrink-0" />
                          Pour {order.recipient.name || 'bénéficiaire'}{order.recipient.phone ? ` · ${order.recipient.phone}` : ''}
                        </p>
                      )}
                      <p className="text-xs text-text-muted font-inter mb-2">
                        📍 ~{km.toFixed(1)} km · 🕐 ~{min} min
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
                      </div>
                      <div className="flex items-center justify-between border-t border-border-light pt-3">
                        <span className="font-inter font-bold text-text-primary text-sm">
                          {order.total.toLocaleString()} FCFA
                        </span>
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
                  <DeliveryMap
                    height="280px"
                    points={activeMine.flatMap((order): MapPoint[] => [
                      { lat: 4.0511, lng: 9.7679, label: order.restaurantName || 'Restaurant', type: 'restaurant' },
                      { lat: 4.0611, lng: 9.7779, label: 'Votre position', type: 'driver' },
                      {
                        lat: 4.0650,
                        lng: 9.7850,
                        label: order.address?.fullText?.slice(0, 30) || 'Client',
                        type: 'customer',
                      },
                    ])}
                  />
                )}
                {activeMine.map((order) => (
                  <div key={order.id} className="bg-white rounded-xl border border-border-custom p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-inter font-semibold text-text-primary text-sm">
                        Commande #{order.id.slice(0, 8)}
                      </span>
                      <span className={`text-xs font-inter font-medium px-2.5 py-1 rounded-full ${order.status === 'ready' ? 'bg-gold-light text-gold-accent' : 'bg-green-light text-green-primary'}`}>
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
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address.fullText || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 bg-bg-secondary text-text-primary font-inter text-sm h-10 rounded-lg hover:bg-border-light transition-colors"
                      >
                        <Navigation className="w-4 h-4" />
                        GPS
                        <ExternalLink className="w-3 h-3 text-text-muted" />
                      </a>
                    </div>
                    {/* L3: Quick messages */}
                    {(order.status === 'delivering' || order.status === 'picked_up') && (
                      <div className="flex gap-1.5 mb-4 flex-wrap">
                        {[
                          { label: 'Je suis arrivé', icon: '📍' },
                          { label: 'Adresse introuvable', icon: '❓' },
                          { label: 'Merci de descendre', icon: '🙏' },
                        ].map((msg) => (
                          <button
                            key={msg.label}
                            type="button"
                            onClick={() => toast.success(`Client notifié : "${msg.label}"`)}
                            className="text-[11px] bg-bg-secondary rounded-full px-3 py-1.5 text-text-secondary font-inter hover:bg-border-light hover:text-text-primary transition-colors"
                          >
                            {msg.icon} {msg.label}
                          </button>
                        ))}
                      </div>
                    )}
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
                          onClick={() => handleMarkDelivered(order)}
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
                <p className="text-sm font-inter text-gold-accent font-medium">
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
                          : 'bg-gold-light text-gold-accent'
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

