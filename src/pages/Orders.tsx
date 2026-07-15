import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Clock, Star, Store, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchOrders, getOrderPreparationMessage, type Order, type OrderStatus } from '../lib/orders';
import { toast } from 'sonner';
import { rateDelivery } from '../lib/drivers';
import { rateRestaurant, hasRestaurantReview } from '../lib/catalog';
import OrderStatusStepper from '../components/OrderStatusStepper';
import { Skeleton } from '../components/ui/skeleton';
import LazyDeliveryMap, { type MapPoint } from '../components/LazyDeliveryMap';
import { getRestaurantCoords, getCustomerCoords, simulateDriverPosition } from '../lib/tracking';

function buildTrackingPoints(order: Order): MapPoint[] {
  const resto = getRestaurantCoords(order.restaurantId) ?? { lat: 4.0511, lng: 9.7679 };
  const customer = getCustomerCoords(order) ?? resto;
  const driver = simulateDriverPosition(resto, customer, order);
  return [
    { ...resto, label: order.restaurantName || 'Restaurant', type: 'restaurant' },
    { ...driver, label: 'Votre livreur', type: 'driver' },
    { ...customer, label: 'Vous', type: 'customer' },
  ];
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

  const handleSubmitRestoReview = async (orderId: string, restaurantId: string) => {
    if (!user) return;
    await rateRestaurant(orderId, restaurantId, user.id, restoRating, restoComment || undefined);
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

  useEffect(() => {
    if (!user) return;
    const load = () => fetchOrders(user.id).then(async (data) => {
      setOrders(data);
      setLoading(false);
      // Check which orders already have restaurant reviews
      const restoReviewed: Record<string, boolean> = {};
      for (const order of data.filter(o => o.status === 'delivered')) {
        if (await hasRestaurantReview(order.id)) {
          restoReviewed[order.id] = true;
        }
      }
      setRestoReviewSubmitted(restoReviewed);
    });
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [user]);

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

                {(order.status === 'picked_up' || order.status === 'delivering') && (
                  <div className="mb-3">
                    <LazyDeliveryMap height="220px" scrollWheelZoom={false} points={buildTrackingPoints(order)} />
                  </div>
                )}

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

                {order.status === 'delivering' && (
                  <div className="mt-3 pt-3 border-t border-border-light">
                    <div className="flex gap-1.5 flex-wrap">
                      <button type="button" onClick={() => toast.success('Le support livraison a été notifié')} className="text-[11px] bg-bg-secondary rounded-full px-3 py-1.5 text-text-secondary font-inter hover:bg-green-light hover:text-green-primary transition-colors">📞 Support livraison</button>
                      <button type="button" onClick={() => toast.success('Message envoyé au livreur')} className="text-[11px] bg-bg-secondary rounded-full px-3 py-1.5 text-text-secondary font-inter hover:bg-green-light hover:text-green-primary transition-colors">📍 Je suis devant</button>
                      <button type="button" onClick={() => toast.success('Position partagée')} className="text-[11px] bg-bg-secondary rounded-full px-3 py-1.5 text-text-secondary font-inter hover:bg-green-light hover:text-green-primary transition-colors">📤 Partager ma position</button>
                    </div>
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
                        className="flex items-center gap-1.5 text-blue-600 font-inter text-sm font-medium hover:text-blue-700 transition-colors"
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
    </div>
  );
}
