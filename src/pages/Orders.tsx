import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Clock, Star, Store, UserRound, XCircle, RotateCcw, Loader2, ShieldCheck, MessageCircle, AlertTriangle } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { fetchMenuItems } from '../lib/catalog';
import { useAuth } from '../contexts/AuthContext';
import { hasOrderReview, submitOrderReview } from '../lib/reviews';
import { fetchOrders, getOrderPreparationMessage, getDriverPhone, getDriverDisplayName, cancelOrder, customerCancelPolicy, declareGuaranteePaid, remainingDueAtDelivery, getRestaurantMerchantInfo, type Order, type OrderStatus } from '../lib/orders';
import { reportIncident } from '../lib/incidents';
import { fetchDriversStats, type DriverStats } from '../lib/drivers';
import { whatsappLink, SUPPORT_PHONE } from '../data/support';
import { phoneForWhatsapp } from '../lib/phone';
import { usePolling } from '../hooks/usePolling';
import { toast } from 'sonner';
import OrderStatusStepper from '../components/OrderStatusStepper';
import { Skeleton } from '../components/ui/skeleton';
import LazyDeliveryMap, { type MapPoint } from '../components/LazyDeliveryMap';
import { getRestaurantCoords, getCustomerCoords, simulateDriverPosition } from '../lib/tracking';
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

// Motifs d'annulation proposés au client (CONF-04 — motif obligatoire).
const CANCEL_REASONS = [
  'Erreur dans ma commande',
  'Le délai est trop long',
  "J'ai changé d'avis",
  'Autre',
] as const;

const DELIVERY_REVIEW_TAGS = ['Ponctuel', 'Courtois', 'Suivi clair', 'Commande intacte'];
const RESTAURANT_REVIEW_TAGS = ['Tres bon', 'Bien emballe', 'Portions genereuses', 'Conforme', 'Rapide'];


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
  return `https://wa.me/${phoneForWhatsapp(phone)}?text=${encodeURIComponent(message)}`;
}

// Numéro court lisible et stable dérivé de l'id (uuid ou id mock) — un id
// tronqué brut (« #seed-dem », « #a3f0c2… ») est illisible pour le client.
// Série PTS — encart garantie côté client (composant dédié : le compilateur
// React n'accepte pas ce bloc en IIFE dans le rendu de la liste).
function GuaranteeCard({
  order, merchantInfo, note, onNoteChange, onDeclare, submitting,
}: {
  order: Order;
  merchantInfo: { merchantCode?: string; assistanceWhatsapp?: string };
  note: string;
  onNoteChange: (v: string) => void;
  onDeclare: () => void;
  submitting: boolean;
}) {
    const { t } = useTranslation();
  const g = order.guarantee;
  if (!g) return null;
  const { merchantCode, assistanceWhatsapp } = merchantInfo;

  if (g.status === 'awaiting_payment') {
    return (
      <div className="bg-gold-light border border-gold-accent/40 rounded-xl p-4 mb-3">
        <p className="flex items-center gap-1.5 font-inter font-semibold text-text-primary text-sm mb-1">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          {t("Sécurisez votre commande — garantie")} {g.amountFcfa.toLocaleString()} {t("FCFA")}
        </p>
        <p className="text-text-secondary text-xs font-inter mb-3">
          {t("Payez la garantie au code marchand du restaurant. Elle sera")}{' '}
          <span className="font-semibold">{t("déduite du total")}</span> {t("à la livraison\r\n          (remboursée intégralement en cas de non-livraison).")}
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="bg-white rounded-lg border border-border-custom px-3 py-2 font-poppins font-bold text-text-primary text-lg tracking-wider">
            {merchantCode}
          </span>
          {assistanceWhatsapp && (
            <a
              href={`https://wa.me/${phoneForWhatsapp(assistanceWhatsapp)}?text=${encodeURIComponent(`Bonjour, je paie la garantie de ma commande MiamExpress ${shortOrderId(order.id)}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-green-primary font-inter text-xs font-medium bg-white border border-border-custom rounded-lg px-3 min-h-11 hover:bg-green-light transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {t("WhatsApp assistance resto")}
            </a>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Réf. de transaction (optionnel)"
            className="flex-1 min-w-0 bg-white rounded-lg border border-border-custom px-3 h-11 text-sm font-inter outline-none placeholder:text-text-muted focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
          />
          <button
            onClick={onDeclare}
            disabled={submitting}
            className="shrink-0 bg-green-primary hover:bg-green-dark text-white font-inter font-semibold text-sm px-4 h-11 rounded-lg transition-colors disabled:opacity-60"
          >
            {submitting ? 'Envoi...' : "J'ai payé la garantie"}
          </button>
        </div>
      </div>
    );
  }
  if (g.status === 'declared') {
    return (
      <div className="flex items-start gap-2 bg-bg-secondary rounded-lg px-3 py-2.5 mb-3 text-xs font-inter text-text-secondary">
        <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
        <span>
          {t("Garantie déclarée payée")}{g.proofNote ? ` (réf. ${g.proofNote})` : ''} {t("— en attente\r\n          de confirmation du restaurant. La préparation démarrera juste après.")}
        </span>
      </div>
    );
  }
  if (g.status === 'confirmed') {
    return (
      <p className="flex items-center gap-1.5 bg-green-light/60 rounded-lg px-3 py-2 mb-3 text-xs font-inter text-text-secondary">
        <ShieldCheck className="w-3.5 h-3.5 text-green-primary shrink-0" />
        {t("Garantie")} {g.amountFcfa.toLocaleString()} {t("FCFA confirmée — déduite du total à la livraison.")}
      </p>
    );
  }
  return null;
}

function shortOrderId(id: string): string {
  return `#Y-${id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}`;
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
  preparing: 'bg-gold-light text-amber-700',
  ready: 'bg-gold-light text-amber-700',
  picked_up: 'bg-green-light text-green-primary',
  delivering: 'bg-green-light text-green-primary',
  delivered: 'bg-green-light text-green-primary',
  cancelled: 'bg-error/10 text-error',
};

export default function Orders() {
    const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewTags, setReviewTags] = useState<string[]>([]);
  const [reviewSubmittingId, setReviewSubmittingId] = useState<string | null>(null);
  const [reviewSubmitted, setReviewSubmitted] = useState<Record<string, boolean>>({});

  // Stats du livreur assigné (note moyenne, nb de courses) — chargées une
  // fois par livreur pour les commandes en cours de livraison.
  const [driverStatsMap, setDriverStatsMap] = useState<Record<string, DriverStats>>({});
  const requestedDriverIds = useRef<Set<string>>(new Set());

  // Restaurant review state
  const [restoReviewingId, setRestoReviewingId] = useState<string | null>(null);
  const [restoRating, setRestoRating] = useState(5);
  const [restoComment, setRestoComment] = useState('');
  const [restoTags, setRestoTags] = useState<string[]>([]);
  const [restoReviewSubmittingId, setRestoReviewSubmittingId] = useState<string | null>(null);
  const [restoReviewSubmitted, setRestoReviewSubmitted] = useState<Record<string, boolean>>({});

  const toggleReviewTag = (tag: string) => {
    setReviewTags((prev) => prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]);
  };

  const toggleRestoTag = (tag: string) => {
    setRestoTags((prev) => prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]);
  };

  const handleSubmitReview = async (orderId: string) => {
    if (!user) return;
    setReviewSubmittingId(orderId);
    try {
      await submitOrderReview(orderId, {
        targetType: 'driver',
        rating: reviewRating,
        comment: reviewComment || undefined,
        tags: reviewTags,
      }, user.id);
      setReviewSubmitted((prev) => ({ ...prev, [orderId]: true }));
      setReviewingId(null);
      setReviewComment('');
      setReviewTags([]);
      setReviewRating(5);
      toast.success('Avis livraison enregistré.');
    } catch (err) {
      toast.error((err as Error).message || "Impossible d'enregistrer l'avis.");
    } finally {
      setReviewSubmittingId(null);
    }
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
    setRestoReviewSubmittingId(orderId);
    try {
      await submitOrderReview(orderId, {
        targetType: 'restaurant',
        targetId: restaurantId,
        rating: restoRating,
        comment: restoComment || undefined,
        tags: restoTags,
        authorName: reviewAuthorName,
      }, user.id);
      setRestoReviewSubmitted((prev) => ({ ...prev, [orderId]: true }));
      setRestoReviewingId(null);
      setRestoComment('');
      setRestoTags([]);
      setRestoRating(5);
      toast.success('Avis restaurant enregistré.');
    } catch (err) {
      toast.error((err as Error).message || "Impossible d'enregistrer l'avis.");
    } finally {
      setRestoReviewSubmittingId(null);
    }
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
      const deliveryReviewed: Record<string, boolean> = {};
      for (const order of delivered) {
        if (await hasOrderReview(order.id, 'restaurant')) {
          restoReviewed[order.id] = true;
        }
        if (await hasOrderReview(order.id, 'driver')) {
          deliveryReviewed[order.id] = true;
        }
      }
      setRestoReviewSubmitted(restoReviewed);
      setReviewSubmitted(deliveryReviewed);
    });
  }, [user]);

  // Le tick initial de usePolling part avant que l'auth soit résolue (user
  // null → early return) : recharger dès que loadOrders change évite d'attendre
  // le tick suivant (15 s de skeleton au premier affichage).
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Note moyenne du livreur assigné — une seule requête par livreur, hors
  // ticks de polling (requestedDriverIds fait office de garde).
  useEffect(() => {
    const ids = [...new Set(
      orders
        .filter((o) => (o.status === 'picked_up' || o.status === 'delivering') && o.driverId)
        .map((o) => o.driverId as string)
    )].filter((id) => !requestedDriverIds.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => requestedDriverIds.current.add(id));
    fetchDriversStats(ids)
      .then((stats) => setDriverStatsMap((prev) => ({ ...prev, ...stats })))
      .catch(() => { /* silencieux : la fiche livreur s'affiche sans note */ });
  }, [orders]);

  usePolling(loadOrders, 15000);

  // ── Série PTS — garantie client ────────────────────────────────────────
  const [guaranteeNotes, setGuaranteeNotes] = useState<Record<string, string>>({});
  const [guaranteeSubmittingId, setGuaranteeSubmittingId] = useState<string | null>(null);
  // Code marchand/WhatsApp par resto — résolu hors rendu (lecture localStorage),
  // différé d'un tick (même motif que la géoloc de DishResults).
  const [merchantInfos, setMerchantInfos] = useState<Record<string, { merchantCode?: string; assistanceWhatsapp?: string }>>({});
  useEffect(() => {
    const t = setTimeout(() => {
      const ids = [...new Set(orders.map((o) => o.restaurantId))];
      setMerchantInfos(Object.fromEntries(ids.map((id) => [id, getRestaurantMerchantInfo(id)])));
    }, 0);
    return () => clearTimeout(t);
  }, [orders]);

  const handleDeclareGuarantee = async (order: Order) => {
    setGuaranteeSubmittingId(order.id);
    try {
      await declareGuaranteePaid(order.id, guaranteeNotes[order.id]);
      toast.success('Paiement déclaré — le restaurant va confirmer la réception.');
      loadOrders();
    } catch (err) {
      toast.error((err as Error).message || 'Impossible de déclarer le paiement.');
    } finally {
      setGuaranteeSubmittingId(null);
    }
  };

  // Litige client sur une livraison en cours (motif obligatoire — arbitré par
  // l'admin avec effet sur la garantie, PTS-05).
  const [disputeTarget, setDisputeTarget] = useState<Order | null>(null);
  const [disputeNote, setDisputeNote] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const handleSubmitDispute = async () => {
    if (!disputeTarget || !disputeNote.trim()) return;
    setDisputeSubmitting(true);
    try {
      await reportIncident({
        orderId: disputeTarget.id,
        driverId: disputeTarget.driverId ?? 'inconnu',
        type: 'commande_non_conforme',
        note: disputeNote,
        reportedBy: 'customer',
      });
      toast.success("Litige ouvert — l'équipe MiamExpress tranche sous 24 h.");
      setDisputeTarget(null);
    } catch (err) {
      toast.error((err as Error).message || "Impossible d'ouvrir le litige.");
    } finally {
      setDisputeSubmitting(false);
    }
  };

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
            <Link to="/" className="hover:text-white transition-colors">{t("Accueil")}</Link>
            <span className="mx-2">/</span>
            <span className="text-white">{t("Commandes")}</span>
          </div>
          <h1 className="font-poppins font-semibold text-white text-3xl sm:text-4xl tracking-normal mb-3">
            {t("Mes commandes")}
          </h1>
          <p className="text-white/75 font-inter text-base">
            {orders.length} {t("commande")}{orders.length !== 1 ? 's' : ''} {t("· Suivez vos livraisons en temps réel")}
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
              {t("Aucune commande pour le moment")}
            </p>
            <Link to="/restaurants" className="text-green-primary font-inter text-sm font-medium hover:underline">
              {t("Découvrir les restaurants")}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-border-custom shadow-sm hover:shadow-md transition-shadow p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-inter font-semibold text-text-primary text-sm truncate">
                      {order.restaurantName || 'Restaurant'}
                    </p>
                    <p className="text-text-muted text-xs font-inter">{t("Commande")} {shortOrderId(order.id)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-inter font-medium px-2.5 py-1 rounded-full ${statusColors[order.status]}`}>
                    {statusLabels[order.status]}
                  </span>
                </div>

                {/* Le stepper n'a de sens que pour une commande en cours — sur
                    l'historique (livrée/annulée), le badge de statut suffit. */}
                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                  <div className="mb-4">
                    <OrderStatusStepper status={order.status} />
                  </div>
                )}

                {order.status === 'cancelled' && order.cancellationReason && (
                  <div className="bg-error/5 text-text-secondary rounded-lg px-3 py-2 mb-3 text-xs font-inter">
                    {t("Annulée par")}{' '}
                    {order.cancelledBy === 'customer' ? 'vous' : order.cancelledBy === 'restaurant' ? 'le restaurant' : "l'équipe MiamExpress"}
                    {' '}{t("· Motif :")} <span className="font-medium text-text-primary">{order.cancellationReason}</span>
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
                        {t("Commande pour")} <span className="font-semibold text-text-primary">{order.recipient.name || 'bénéficiaire'}</span>
                        {order.recipient.phone && <span> · {order.recipient.phone}</span>}
                      </p>
                      {order.recipient.contactInstructions && (
                        <p className="mt-1 text-text-muted">{order.recipient.contactInstructions}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Série PTS — garantie client (sous-état de « Confirmée ») */}
                {order.status === 'confirmed' && order.guarantee && (
                  <GuaranteeCard
                    order={order}
                    merchantInfo={merchantInfos[order.restaurantId] ?? {}}
                    note={guaranteeNotes[order.id] ?? ''}
                    onNoteChange={(v) => setGuaranteeNotes((prev) => ({ ...prev, [order.id]: v }))}
                    onDeclare={() => handleDeclareGuarantee(order)}
                    submitting={guaranteeSubmittingId === order.id}
                  />
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
                  <span className="text-right">
                    <span className="block font-inter font-bold text-text-primary text-sm">
                      {order.total.toLocaleString()} {t("FCFA")}
                    </span>
                    {/* Série PTS : garantie sécurisée → le solde dû à la livraison change */}
                    {remainingDueAtDelivery(order) !== order.total && !['delivered', 'cancelled'].includes(order.status) && (
                      <span className="block text-green-primary text-[11px] font-inter font-medium">
                        {t("Reste à payer à la livraison :")} {remainingDueAtDelivery(order).toLocaleString()} {t("FCFA")}
                      </span>
                    )}
                  </span>
                </div>

                {/* Preuve de livraison (CONF-17) : code à donner au livreur */}
                {(order.status === 'picked_up' || order.status === 'delivering') && order.deliveryCode && (
                  <div className="bg-green-light rounded-lg px-4 py-3 mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-green-primary font-inter font-semibold text-xs uppercase tracking-wide mb-0.5">
                        {t("Code de livraison")}
                      </p>
                      <p className="text-text-secondary text-xs font-inter">
                        {t("Donnez ce code au livreur à la remise de votre commande.")}
                        {order.guarantee && (
                          <>
                            {' '}<span className="font-medium">{t("Code remis = livraison conforme.")}</span>{' '}
                            {t("Un problème ? Ouvrez un litige AVANT de refuser, sinon votre garantie est perdue.")}
                          </>
                        )}
                      </p>
                    </div>
                    <span className="font-poppins font-bold text-green-primary text-3xl tracking-[0.2em] shrink-0" aria-label={`Code de livraison : ${order.deliveryCode.split('').join(' ')}`}>
                      {order.deliveryCode}
                    </span>
                  </div>
                )}

                {/* Série PTS : litige client sur la livraison en cours */}
                {(order.status === 'picked_up' || order.status === 'delivering') && (
                  <button
                    onClick={() => { setDisputeTarget(order); setDisputeNote(''); }}
                    className="flex items-center gap-1.5 text-error font-inter text-xs font-medium mb-3 hover:opacity-80 transition-opacity min-h-11"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {t("Signaler un problème avec cette livraison")}
                  </button>
                )}

                {(() => {
                        const { t } = useTranslation();
                  // Annulation client bornée par le risque : possible tant que le
                  // parcours n'est pas « en route » (livreur) — libre avant
                  // préparation, avec avertissement pendant (customerCancelPolicy).
                  const tier = customerCancelPolicy(order.status).tier;
                  if (tier !== 'free' && tier !== 'warn') return null;
                  return (
                    <div className="mt-3 pt-3 border-t border-border-light">
                      <button
                        type="button"
                        onClick={() => openCancelDialog(order)}
                        className="flex items-center gap-1.5 text-error font-inter text-sm font-medium hover:opacity-80 transition-opacity min-h-11"
                      >
                        <XCircle className="w-4 h-4" />
                        {t("Annuler la commande")}
                      </button>
                    </div>
                  );
                })()}

                {(order.status === 'picked_up' || order.status === 'delivering') && (() => {
                        const { t } = useTranslation();
                  // Actions de contact réelles : appel + WhatsApp vers le
                  // livreur quand son numéro est résolvable, sinon vers le
                  // support MiamExpress (jamais de message simulé).
                  const driverPhone = getDriverPhone(order.driverId);
                  const contactMessage = `Bonjour, commande MiamExpress ${shortOrderId(order.id)} — ${order.address.fullText || 'adresse indiquée sur la commande'}`;
                  const waHref = driverPhone ? whatsappTo(driverPhone, contactMessage) : whatsappLink(contactMessage);
                  // Identité minimale du livreur, visible uniquement pendant la
                  // livraison active : prénom + initiale et note moyenne.
                  const driverName = getDriverDisplayName(order.driverId);
                  const stats = order.driverId ? driverStatsMap[order.driverId] : undefined;
                  return (
                    <div className="mt-3 pt-3 border-t border-border-light">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-green-light flex items-center justify-center shrink-0">
                          <UserRound className="w-4 h-4 text-green-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-inter font-semibold text-text-primary text-sm truncate">
                            {driverName ? `Votre livreur : ${driverName}` : 'Votre livreur'}
                          </p>
                          {stats && stats.averageRating != null && (
                            <p className="flex items-center gap-1 text-xs text-text-secondary font-inter">
                              <Star className="w-3 h-3 fill-gold-accent text-gold-accent" />
                              {stats.averageRating.toFixed(1)}
                              <span className="text-text-muted">
                                · {stats.completedDeliveries} {t("course")}{stats.completedDeliveries > 1 ? 's' : ''}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <a
                          href={`tel:${driverPhone ?? SUPPORT_PHONE}`}
                          aria-label={driverPhone ? 'Appeler le livreur' : 'Appeler le support MiamExpress'}
                          className="text-xs bg-bg-secondary rounded-full px-3.5 py-2.5 text-text-secondary font-inter hover:bg-green-light hover:text-green-primary transition-colors inline-flex items-center"
                        >
                          📞 {driverPhone ? 'Appeler le livreur' : 'Appeler le support'}
                        </a>
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={driverPhone ? 'Écrire au livreur sur WhatsApp' : 'Écrire au support sur WhatsApp'}
                          className="text-xs bg-bg-secondary rounded-full px-3.5 py-2.5 text-text-secondary font-inter hover:bg-green-light hover:text-green-primary transition-colors inline-flex items-center"
                        >
                          {t("💬 WhatsApp")} {driverPhone ? 'livreur' : 'support'}
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
                          {t("Noter la livraison")}
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
                        <div className="flex flex-wrap gap-1.5">
                          {DELIVERY_REVIEW_TAGS.map((tag) => {
                            const active = reviewTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleReviewTag(tag)}
                                className={`h-7 px-2.5 rounded-full border text-[11px] font-inter font-medium transition-colors ${active
                                  ? 'bg-green-light border-green-primary text-green-primary'
                                  : 'bg-white border-border-custom text-text-secondary hover:text-green-primary hover:border-green-primary'
                                  }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                        <textarea
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Votre avis sur la livraison (optionnel)..."
                          rows={2}
                          maxLength={500}
                          disabled={reviewSubmittingId === order.id}
                          className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted disabled:opacity-60"
                        />
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] text-text-muted font-inter">{reviewComment.length}/500</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSubmitReview(order.id)}
                              disabled={reviewSubmittingId === order.id}
                              className="inline-flex items-center gap-1.5 bg-green-primary text-white font-inter font-medium text-xs px-4 h-9 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
                            >
                              {reviewSubmittingId === order.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("Envoi...")}</> : 'Envoyer'}
                            </button>
                            <button
                              onClick={() => { setReviewingId(null); setReviewTags([]); }}
                              disabled={reviewSubmittingId === order.id}
                              className="text-text-secondary font-inter text-xs px-3 h-9 rounded-lg hover:bg-bg-secondary transition-colors disabled:opacity-60"
                            >
                              {t("Annuler")}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReviewingId(order.id)}
                        className="flex items-center gap-1.5 text-green-primary font-inter text-sm font-medium hover:text-green-dark transition-colors min-h-11"
                      >
                        <Star className="w-4 h-4" />
                        {t("Noter la livraison")}
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
                          {t("Noter le restaurant")}
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
                        <div className="flex flex-wrap gap-1.5">
                          {RESTAURANT_REVIEW_TAGS.map((tag) => {
                            const active = restoTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleRestoTag(tag)}
                                className={`h-7 px-2.5 rounded-full border text-[11px] font-inter font-medium transition-colors ${active
                                  ? 'bg-green-light border-green-primary text-green-primary'
                                  : 'bg-white border-border-custom text-text-secondary hover:text-green-primary hover:border-green-primary'
                                  }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                        <textarea
                          value={restoComment}
                          onChange={(e) => setRestoComment(e.target.value)}
                          placeholder="Votre avis sur le restaurant (optionnel)..."
                          rows={2}
                          maxLength={500}
                          disabled={restoReviewSubmittingId === order.id}
                          className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted disabled:opacity-60"
                        />
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] text-text-muted font-inter">{restoComment.length}/500</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSubmitRestoReview(order.id, order.restaurantId)}
                              disabled={restoReviewSubmittingId === order.id}
                              className="inline-flex items-center gap-1.5 bg-green-primary text-white font-inter font-medium text-xs px-4 h-9 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
                            >
                              {restoReviewSubmittingId === order.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("Envoi...")}</> : 'Envoyer'}
                            </button>
                            <button
                              onClick={() => { setRestoReviewingId(null); setRestoTags([]); }}
                              disabled={restoReviewSubmittingId === order.id}
                              className="text-text-secondary font-inter text-xs px-3 h-9 rounded-lg hover:bg-bg-secondary transition-colors disabled:opacity-60"
                            >
                              {t("Annuler")}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRestoReviewingId(order.id)}
                        className="flex items-center gap-1.5 text-green-primary font-inter text-sm font-medium hover:text-green-dark transition-colors min-h-11"
                      >
                        <Store className="w-4 h-4" />
                        {t("Noter le restaurant")}
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
            <AlertDialogTitle>{t("Remplacer votre panier ?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Votre panier contient des articles d’un autre restaurant.\r\n              Recommander chez")} {reorderTarget?.restaurantName || 'ce restaurant'} {t("le videra.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Garder mon panier")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (reorderTarget) void performReorder(reorderTarget); }}
              className="bg-green-primary text-white hover:bg-green-dark"
            >
              {t("Vider et recommander")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Série PTS — litige client sur la livraison (motif obligatoire) */}
      <AlertDialog open={!!disputeTarget} onOpenChange={(open) => { if (!open) setDisputeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Signaler un problème — commande")} {disputeTarget ? shortOrderId(disputeTarget.id) : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Décrivez précisément le problème (plat manquant, commande non conforme…).\r\n              L’équipe MiamExpress tranche sous 24 h : si la livraison est jugée\r\n              conforme, la garantie est perdue ; sinon elle vous est remboursée intégralement.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={disputeNote}
            onChange={(e) => setDisputeNote(e.target.value)}
            placeholder="Motif du litige (obligatoire)"
            rows={3}
            className="w-full bg-white rounded-lg border border-border-custom px-3 py-2 text-sm font-inter outline-none placeholder:text-text-muted focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all resize-none"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Annuler")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitDispute}
              disabled={!disputeNote.trim() || disputeSubmitting}
              className="bg-error text-white hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {disputeSubmitting ? 'Envoi...' : 'Ouvrir le litige'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog d'annulation — motif obligatoire (CONF-04) */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Annuler la commande #")}{cancelTarget?.id.slice(0, 8)} ?</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Le restaurant sera informé de l’annulation et du motif. Cette action est irréversible.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {cancelTarget && customerCancelPolicy(cancelTarget.status).warning && (
              <div className="flex gap-2 rounded-lg bg-gold-light border border-gold-accent/40 px-3 py-2.5 text-[13px] text-text-primary font-inter">
                <AlertTriangle className="w-4 h-4 text-gold-accent shrink-0 mt-0.5" />
                <span>{customerCancelPolicy(cancelTarget.status).warning}</span>
              </div>
            )}
            <div>
              <label htmlFor="cancel-reason" className="block text-text-secondary font-inter text-sm mb-1.5">
                {t("Motif de l’annulation")} <span className="text-error">*</span>
              </label>
              <select
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
              >
                <option value="" disabled>{t("Sélectionnez un motif")}</option>
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
            <AlertDialogCancel>{t("Garder ma commande")}</AlertDialogCancel>
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
