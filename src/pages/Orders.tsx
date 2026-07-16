import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Clock, Star, Store, UserRound, XCircle, RotateCcw } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { fetchMenuItems } from '../lib/catalog';
import { useAuth } from '../contexts/AuthContext';
import { fetchOrders, getOrderPreparationMessage, getDriverPhone, cancelOrder, type Order, type OrderStatus } from '../lib/orders';
import { whatsappLink, SUPPORT_PHONE } from '../data/support';
import { usePolling } from '../hooks/usePolling';
import { toast } from 'sonner';
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

// Motifs d'annulation proposés au client (CONF-04 — motif obligatoire).
const CANCEL_REASONS = [
  'Erreur dans ma commande',
  'Le délai est trop long',
  "J'ai changé d'avis",
  'Autre',
] as const;
import { rateDelivery } from '../lib/drivers';
import { rateRestaurant, hasRestaurantReview } from '../lib/catalog';
import OrderStatusStepper from '../components/OrderStatusStepper';
import { Skeleton } from '../components/ui/skeleton';
import LazyDeliveryMap, { type MapPoint } from '../components/LazyDeliveryMap';
import { getRestaurantCoords, getCustomerCoords, simulateDriverPosition } from '../lib/tracking';

// Points de suivi — uniquement si les coordonnées du restaurant ET du client
// sont réellement résolues (pas de positions inventées : sans coordonnées, la
// carte n'est pas affichée). La position livreur reste une estimation
// (interpolation), signalée par le badge `estimated` de la carte.
function buildTrackingPoints(order: Order): MapPoint[] | null {
  const resto = getRestaurantCoords(order.restaurantId);
  const customer = getCustomerCoords(order);
  if (!resto || !customer) return null;
  const driver = simulateDriverPosition(resto, customer, order);
  return [
    { ...resto, label: order.restaurantName || 'Restaurant', type: 'restaurant' },
    { ...driver, label: 'Votre livreur', type: 'driver' },
    { ...customer, label: 'Vous', type: 'customer' },
  ];
}

// Lien WhatsApp vers un numéro arbitraire (livreur) avec message prérempli.
function whatsappTo(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

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

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-bg-secondary text-text-secondary',
  confirmed: 'bg-green-light text-green-primary',
  preparing: 'bg-gold-light text-gold-accent',
  ready: 'bg-gold-light text-gold-accent',
  picked_up: 'bg-green-light text-green-primary',
  delivering: 'bg-green-light text-green-primary',
  delivered: 'bg-green-light text-green-primary',
  cancelled: 'bg-error/10 text-error',
};

export default function Orders() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState<Record<string, boolean>>({});

  // Restaurant review state
  const [restoReviewingId, setRestoReviewingId] = useState<string | null>(null);
  const [restoRating, setRestoRating] = useState(5);
  const [restoComment, setRestoComment] = useState('');
  const [restoReviewSubmitted, setRestoReviewSubmitted] = useState<Record<string, boolean>>({});

  const handleSubmitReview = async (orderId: string) => {
    await rateDelivery(orderId, reviewRating, reviewComment || undefined);
    setReviewSubmitted((prev) => ({ ...prev, [orderId]: true }));
    setReviewingId(null);
    setReviewComment('');
    setReviewRating(5);
  };

  // « Marie N. » à partir du nom de profil — preuve sociale sans exposer
  // l'identité complète (CONF-26).
  const reviewAuthorName = (() => {
    const raw = (localStorage.getItem('yamo_profile_name') ?? '').trim();
    if (!raw) return undefined;
    const parts = raw.split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[1][0].toUpperCase()}.` : parts[0];
  })();

  const handleSubmitRestoReview = async (orderId: string, restaurantId: string) => {
    if (!user) return;
    await rateRestaurant(orderId, restaurantId, user.id, restoRating, restoComment || undefined, reviewAuthorName);
    setRestoReviewSubmitted((prev) => ({ ...prev, [orderId]: true }));
    setRestoReviewingId(null);
    setRestoComment('');
    setRestoRating(5);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/connexion', { state: { from: '/commandes' } });
    }
  }, [authLoading, user, navigate]);

  // Évite de refaire la vérification des avis à chaque tick de polling
  // (N requêtes par commande livrée) : uniquement quand la liste des
  // commandes livrées change réellement.
  const checkedDeliveredKeyRef = useRef('');

  const loadOrders = useCallback(() => {
    if (!user) return;
    fetchOrders(user.id).then(async (data) => {
      setOrders(data);
      setLoading(false);
      const delivered = data.filter(o => o.status === 'delivered');
      const deliveredKey = delivered.map(o => o.id).join(',');
      if (deliveredKey === checkedDeliveredKeyRef.current) return;
      checkedDeliveredKeyRef.current = deliveredKey;
      const restoReviewed: Record<string, boolean> = {};
      for (const order of delivered) {
        if (await hasRestaurantReview(order.id)) {
          restoReviewed[order.id] = true;
        }
      }
      setRestoReviewSubmitted(restoReviewed);
    });
  }, [user]);

  usePolling(loadOrders, 15000);

  // Annulation client (CONF-04) — possible tant que le restaurant n'a pas
  // commencé la préparation (pending/confirmed), motif obligatoire.
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelDetails, setCancelDetails] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const openCancelDialog = (order: Order) => {
    setCancelReason('');
    setCancelDetails('');
    setCancelTarget(order);
  };

  const cancelReasonComplete = cancelReason !== '' && (cancelReason !== 'Autre' || cancelDetails.trim() !== '');

  const handleCancelOrder = async () => {
    if (!cancelTarget || !cancelReasonComplete) return;
    setCancelling(true);
    try {
      const fullReason = cancelReason === 'Autre' ? cancelDetails.trim() : cancelReason;
      await cancelOrder(cancelTarget.id, fullReason, 'customer');
      setCancelTarget(null);
      loadOrders();
    } finally {
      setCancelling(false);
    }
  };

  // Re-commande 1-clic (CONF-25) : re-matche les articles contre le catalogue
  // actuel (baseItemId pour les commandes récentes, nom sinon), signale les
  // articles disparus/indisponibles, remplace le panier après confirmation si
  // celui-ci contient un autre restaurant.
  const { items: cartItems, loadCart } = useCart();
  const [reorderTarget, setReorderTarget] = useState<Order | null>(null);
  const [reordering, setReordering] = useState(false);

  const performReorder = async (order: Order) => {
    setReordering(true);
    try {
      const menu = await fetchMenuItems(order.restaurantId);
      const matched: { item: (typeof menu)[number]; quantity: number; baseItemId: string }[] = [];
      const missing: string[] = [];
      for (const line of order.items) {
        const byId = line.baseItemId ? menu.find((m) => m.id === line.baseItemId) : undefined;
        // Les plats personnalisés portent un nom composite « Plat + Option » :
        // on retombe sur le plat de base (la personnalisation est à refaire).
        const baseName = line.name.split(' + ')[0].trim();
        const found = byId ?? menu.find((m) => m.name === line.name) ?? menu.find((m) => m.name === baseName);
        if (found && found.isAvailable !== false) {
          const existing = matched.find((mLine) => mLine.item.id === found.id);
          if (existing) existing.quantity += line.quantity;
          else matched.push({ item: found, quantity: line.quantity, baseItemId: found.id });
        } else {
          missing.push(line.name);
        }
      }
      if (matched.length === 0) {
        toast.error('Aucun de ces plats n\'est encore disponible chez ce restaurant.');
        return;
      }
      loadCart(matched);
      if (missing.length > 0) {
        toast.info(`${missing.length} article${missing.length > 1 ? 's' : ''} indisponible${missing.length > 1 ? 's' : ''} non repris : ${missing.join(', ')}`, { duration: 8000 });
      }
      toast.success(`Panier rechargé — ${matched.reduce((s, mLine) => s + mLine.quantity, 0)} article(s) de ${order.restaurantName || 'votre commande'}.`);
      navigate('/checkout');
    } finally {
      setReordering(false);
      setReorderTarget(null);
    }
  };

  const handleReorder = (order: Order) => {
    const cartRestaurant = cartItems[0]?.item.restaurantId;
    if (cartRestaurant && cartRestaurant !== order.restaurantId) {
      setReorderTarget(order);
      return;
    }
    void performReorder(order);
  };

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <section className="bg-green-primary pt-12 pb-16 sm:pt-16 sm:pb-20 relative">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6">
          <div className="text-white/60 text-xs font-inter mb-4">
            <Link to="/" className="hover:text-white transition-colors">Accueil</Link>
            <span className="mx-2">/</span>
            <span className="text-white">Commandes</span>
          </div>
          <h1 className="font-poppins font-semibold text-white text-3xl sm:text-4xl tracking-normal mb-3">
            Mes commandes
          </h1>
          <p className="text-white/75 font-inter text-base">
            {orders.length} commande{orders.length !== 1 ? 's' : ''} · Suivez vos livraisons en temps réel
          </p>
        </div>
      </section>

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 -mt-8 relative z-10 pb-12">

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-border-custom p-5">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-8 w-full mb-4" />
                <Skeleton className="h-3 w-2/3 mb-1.5" />
                <Skeleton className="h-3 w-1/2 mb-3" />
                <div className="flex items-center justify-between border-t border-border-light pt-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-green-light flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-green-primary" />
            </div>
            <p className="text-text-secondary font-inter font-medium mb-1">
              Aucune commande pour le moment
            </p>
            <Link to="/restaurants" className="text-green-primary font-inter text-sm font-medium hover:underline">
              Découvrir les restaurants
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-border-custom shadow-sm hover:shadow-md transition-shadow p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-inter font-semibold text-text-primary text-sm">
                    Commande #{order.id.slice(0, 8)}
                  </span>
                  <span className={`text-xs font-inter font-medium px-2.5 py-1 rounded-full ${statusColors[order.status]}`}>
                    {statusLabels[order.status]}
                  </span>
                </div>

                <div className="mb-4">
                  <OrderStatusStepper status={order.status} />
                </div>

                {order.status === 'cancelled' && order.cancellationReason && (
                  <div className="bg-error/5 text-text-secondary rounded-lg px-3 py-2 mb-3 text-xs font-inter">
                    Annulée par{' '}
                    {order.cancelledBy === 'customer' ? 'vous' : order.cancelledBy === 'restaurant' ? 'le restaurant' : "l'équipe MiamExpress"}
                    {' '}· Motif : <span className="font-medium text-text-primary">{order.cancellationReason}</span>
                  </div>
                )}

                {(order.status === 'picked_up' || order.status === 'delivering') && (() => {
                  const trackingPoints = buildTrackingPoints(order);
                  return trackingPoints ? (
                    <div className="mb-3">
                      <LazyDeliveryMap height="220px" scrollWheelZoom={false} points={trackingPoints} estimated />
                    </div>
                  ) : null;
                })()}

                {getOrderPreparationMessage(order) && (
                  <div className="flex items-center gap-1.5 bg-bg-secondary rounded-lg px-3 py-2 mb-3 text-xs font-inter text-text-secondary">
                    <Clock className="w-3.5 h-3.5 text-gold-accent shrink-0" />
                    <span>{getOrderPreparationMessage(order)}</span>
                  </div>
                )}

                {order.recipient && (
                  <div className="flex items-start gap-2 bg-green-light/60 rounded-lg px-3 py-2 mb-3 text-xs font-inter text-text-secondary">
                    <UserRound className="w-3.5 h-3.5 text-green-primary shrink-0 mt-0.5" />
                    <div>
                      <p>
                        Commande pour <span className="font-semibold text-text-primary">{order.recipient.name || 'bénéficiaire'}</span>
                        {order.recipient.phone && <span> · {order.recipient.phone}</span>}
                      </p>
                      {order.recipient.contactInstructions && (
                        <p className="mt-1 text-text-muted">{order.recipient.contactInstructions}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1 mb-3">
                  {order.items.map((it, i) => (
                    <p key={i} className="text-text-secondary text-sm font-inter">
                      {it.quantity} × {it.name}
                    </p>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-border-light pt-3">
                  <span className="flex items-center gap-1 text-text-muted text-xs font-inter">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(order.createdAt).toLocaleString('fr-FR')}
                  </span>
                  <span className="font-inter font-bold text-text-primary text-sm">
                    {order.total.toLocaleString()} FCFA
                  </span>
                </div>

                {/* Preuve de livraison (CONF-17) : code à donner au livreur */}
                {(order.status === 'picked_up' || order.status === 'delivering') && order.deliveryCode && (
                  <div className="bg-green-light rounded-lg px-4 py-3 mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-green-primary font-inter font-semibold text-xs uppercase tracking-wide mb-0.5">
                        Code de livraison
                      </p>
                      <p className="text-text-secondary text-xs font-inter">
                        Donnez ce code au livreur à la remise de votre commande.
                      </p>
                    </div>
                    <span className="font-poppins font-bold text-green-primary text-3xl tracking-[0.2em] shrink-0" aria-label={`Code de livraison : ${order.deliveryCode.split('').join(' ')}`}>
                      {order.deliveryCode}
                    </span>
                  </div>
                )}

                {(order.status === 'pending' || order.status === 'confirmed') && (
                  <div className="mt-3 pt-3 border-t border-border-light">
                    <button
                      type="button"
                      onClick={() => openCancelDialog(order)}
                      className="flex items-center gap-1.5 text-error font-inter text-sm font-medium hover:opacity-80 transition-opacity"
                    >
                      <XCircle className="w-4 h-4" />
                      Annuler la commande
                    </button>
                  </div>
                )}

                {(order.status === 'picked_up' || order.status === 'delivering') && (() => {
                  // Actions de contact réelles : appel + WhatsApp vers le
                  // livreur quand son numéro est résolvable, sinon vers le
                  // support MiamExpress (jamais de message simulé).
                  const driverPhone = getDriverPhone(order.driverId);
                  const contactMessage = `Bonjour, commande MiamExpress #${order.id.slice(0, 8)} — ${order.address.fullText || 'adresse indiquée sur la commande'}`;
                  const waHref = driverPhone ? whatsappTo(driverPhone, contactMessage) : whatsappLink(contactMessage);
                  return (
                    <div className="mt-3 pt-3 border-t border-border-light">
                      <div className="flex gap-1.5 flex-wrap">
                        <a
                          href={`tel:${driverPhone ?? SUPPORT_PHONE}`}
                          aria-label={driverPhone ? 'Appeler le livreur' : 'Appeler le support MiamExpress'}
                          className="text-[11px] bg-bg-secondary rounded-full px-3 py-1.5 text-text-secondary font-inter hover:bg-green-light hover:text-green-primary transition-colors"
                        >
                          📞 {driverPhone ? 'Appeler le livreur' : 'Appeler le support'}
                        </a>
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={driverPhone ? 'Écrire au livreur sur WhatsApp' : 'Écrire au support sur WhatsApp'}
                          className="text-[11px] bg-bg-secondary rounded-full px-3 py-1.5 text-text-secondary font-inter hover:bg-green-light hover:text-green-primary transition-colors"
                        >
                          💬 WhatsApp {driverPhone ? 'livreur' : 'support'}
                        </a>
                      </div>
                    </div>
                  );
                })()}

                {order.status === 'delivered' && (
                  <div className="mt-3 pt-3 border-t border-border-light">
                    <button
                      type="button"
                      onClick={() => handleReorder(order)}
                      disabled={reordering}
                      className="flex items-center gap-1.5 bg-green-primary text-white font-inter font-medium text-sm px-4 h-10 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {reordering ? 'Rechargement...' : 'Commander à nouveau'}
                    </button>
                  </div>
                )}

                {order.status === 'delivered' && !reviewSubmitted[order.id] && (
                  <div className="mt-3 pt-3 border-t border-border-light">
                    {reviewingId === order.id ? (
                      <div className="space-y-2">
                        <p className="font-inter font-medium text-text-primary text-sm">
                          Noter la livraison
                        </p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewRating(star)}
                              className="transition-colors"
                            >
                              <Star
                                className={`w-5 h-5 ${star <= reviewRating
                                  ? 'fill-gold-accent text-gold-accent'
                                  : 'text-text-muted'
                                  }`}
                              />
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Votre avis sur la livraison (optionnel)..."
                          rows={2}
                          className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSubmitReview(order.id)}
                            className="bg-green-primary text-white font-inter font-medium text-xs px-4 h-9 rounded-lg hover:bg-green-dark transition-colors"
                          >
                            Envoyer
                          </button>
                          <button
                            onClick={() => setReviewingId(null)}
                            className="text-text-secondary font-inter text-xs px-3 h-9 rounded-lg hover:bg-bg-secondary transition-colors"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReviewingId(order.id)}
                        className="flex items-center gap-1.5 text-green-primary font-inter text-sm font-medium hover:text-green-dark transition-colors"
                      >
                        <Star className="w-4 h-4" />
                        Noter la livraison
                      </button>
                    )}
                  </div>
                )}

                {/* Restaurant rating — shown after delivery, independent of driver rating */}
                {order.status === 'delivered' && !restoReviewSubmitted[order.id] && (
                  <div className="mt-3 pt-3 border-t border-border-light">
                    {restoReviewingId === order.id ? (
                      <div className="space-y-2">
                        <p className="font-inter font-medium text-text-primary text-sm flex items-center gap-1.5">
                          <Store className="w-4 h-4 text-green-primary" />
                          Noter le restaurant
                        </p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRestoRating(star)}
                              className="transition-colors"
                            >
                              <Star
                                className={`w-5 h-5 ${star <= restoRating
                                  ? 'fill-gold-accent text-gold-accent'
                                  : 'text-text-muted'
                                  }`}
                              />
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={restoComment}
                          onChange={(e) => setRestoComment(e.target.value)}
                          placeholder="Votre avis sur le restaurant (optionnel)..."
                          rows={2}
                          className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSubmitRestoReview(order.id, order.restaurantId)}
                            className="bg-green-primary text-white font-inter font-medium text-xs px-4 h-9 rounded-lg hover:bg-green-dark transition-colors"
                          >
                            Envoyer
                          </button>
                          <button
                            onClick={() => setRestoReviewingId(null)}
                            className="text-text-secondary font-inter text-xs px-3 h-9 rounded-lg hover:bg-bg-secondary transition-colors"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRestoReviewingId(order.id)}
                        className="flex items-center gap-1.5 text-green-primary font-inter text-sm font-medium hover:text-green-dark transition-colors"
                      >
                        <Store className="w-4 h-4" />
                        Noter le restaurant
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conflit re-commande : le panier contient un autre restaurant */}
      <AlertDialog open={!!reorderTarget} onOpenChange={(open) => { if (!open) setReorderTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remplacer votre panier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Votre panier contient des articles d&apos;un autre restaurant.
              Recommander chez {reorderTarget?.restaurantName || 'ce restaurant'} le videra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder mon panier</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (reorderTarget) void performReorder(reorderTarget); }}
              className="bg-green-primary text-white hover:bg-green-dark"
            >
              Vider et recommander
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog d'annulation — motif obligatoire (CONF-04) */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la commande #{cancelTarget?.id.slice(0, 8)} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le restaurant sera informé de l&apos;annulation et du motif. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="cancel-reason" className="block text-text-secondary font-inter text-sm mb-1.5">
                Motif de l&apos;annulation <span className="text-error">*</span>
              </label>
              <select
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
              >
                <option value="" disabled>Sélectionnez un motif</option>
                {CANCEL_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            {cancelReason === 'Autre' && (
              <textarea
                value={cancelDetails}
                onChange={(e) => setCancelDetails(e.target.value)}
                placeholder="Précisez le motif..."
                rows={2}
                autoFocus
                className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted"
              />
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder ma commande</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              disabled={!cancelReasonComplete || cancelling}
              className="bg-error text-white hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? 'Annulation...' : 'Annuler la commande'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
