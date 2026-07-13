import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Store, Clock, RefreshCw, Trash2, Plus, Upload, X, Volume2, VolumeX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { fetchRestaurantsByOwner, createMenuItem, deleteMenuItem, fetchMenuItems, updateMenuItem, updateRestaurantProfile } from '../lib/catalog';
import { useRestaurants } from '../hooks/useCatalog';
import { restaurantMenuCategories } from '../data/mockData';
import type { MenuItem, Restaurant } from '../data/mockData';
import { fetchOrdersByRestaurant, updateOrderStatus, type Order, type OrderStatus } from '../lib/orders';
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

function nextStatus(status: OrderStatus): OrderStatus | null {
  const idx = statusFlow.indexOf(status);
  if (idx === -1 || idx === statusFlow.length - 1) return null;
  return statusFlow[idx + 1];
}

type Tab = 'orders' | 'menu' | 'profile' | 'finances';

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
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('yamo_resto_sound') !== 'false');
  const prevOrderCount = useRef(0);

  useEffect(() => {
    localStorage.setItem('yamo_resto_sound', String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    if (orders.length > prevOrderCount.current && prevOrderCount.current > 0 && soundEnabled) {
      // Web Audio API beep
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; osc.type = 'sine';
        gain.gain.value = 0.15;
        osc.start(); osc.stop(ctx.currentTime + 0.15);
      } catch { /* audio not available */ }
    }
    prevOrderCount.current = orders.length;
  }, [orders.length, soundEnabled]);

  const activeRestaurant = restaurants.find(r => r.id === restaurantId);

  const loadMenu = useCallback(async () => {
    if (!restaurantId) return;
    setMenuLoading(true);
    const data = await fetchMenuItems(restaurantId);
    setMenuItems(data);
    setMenuLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

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

  const loadOrders = useCallback(async () => {
    if (!restaurantId) return;
    const data = await fetchOrdersByRestaurant(restaurantId);
    setOrders(data);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleAdvance = async (order: Order) => {
    const next = nextStatus(order.status);
    if (!next) return;
    await updateOrderStatus(order.id, next);
    loadOrders();
  };

  const handleCancel = async (order: Order) => {
    await updateOrderStatus(order.id, 'cancelled');
    loadOrders();
  };

  const handleDeleteMenuItem = async (id: string) => {
    await deleteMenuItem(id);
    loadMenu();
  };

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl">
            Espace Restaurant
          </h1>
          <button
            onClick={loadOrders}
            className="flex items-center gap-1.5 text-text-secondary text-sm font-inter hover:text-text-primary"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1 text-sm font-inter transition-colors ${soundEnabled ? 'text-green-primary' : 'text-text-muted'
              }`}
            title={soundEnabled ? 'Son activé' : 'Son désactivé'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {restaurants.length === 0 ? (
          <div className="bg-white rounded-xl border border-border-custom p-10 text-center mb-6">
            <p className="text-text-secondary font-inter font-medium">
              Aucun restaurant associé à votre compte. Contactez le support Yamo.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-border-custom p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Store className="w-5 h-5 text-green-primary shrink-0" />
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
                  <span className="text-sm font-inter font-medium text-text-secondary">Statut :</span>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activeRestaurant.isOpen ? 'bg-green-light text-green-primary' : 'bg-error/10 text-error'}`}>
                    {activeRestaurant.isOpen ? 'Ouvert' : 'Fermé (Mode Rush)'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1 bg-white rounded-lg border border-border-custom p-1 mb-6 w-fit">
              <button
                onClick={() => setTab('orders')}
                className={`px-4 py-2 rounded-md text-sm font-inter font-medium transition-colors ${tab === 'orders' ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                Commandes
              </button>
              <button
                onClick={() => setTab('menu')}
                className={`px-4 py-2 rounded-md text-sm font-inter font-medium transition-colors ${tab === 'menu' ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                Menu ({menuItems.length})
              </button>
              <button
                onClick={() => setTab('profile')}
                className={`px-4 py-2 rounded-md text-sm font-inter font-medium transition-colors ${tab === 'profile' ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                Profil
              </button>
              <button
                onClick={() => setTab('finances')}
                className={`px-4 py-2 rounded-md text-sm font-inter font-medium transition-colors ${tab === 'finances' ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                Finances
              </button>
            </div>

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
                  <div className="bg-white rounded-xl border border-border-custom p-10 text-center">
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
                      return (
                        <div key={order.id} className={`bg-white rounded-xl border border-border-custom border-l-4 ${urgencyColor} p-5`}>
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-inter font-semibold text-text-primary text-sm">
                              Commande #{order.id.slice(0, 8)}
                            </span>
                            <span className="text-xs font-inter font-medium px-2.5 py-1 rounded-full bg-green-light text-green-primary">
                              {statusLabels[order.status]}
                            </span>
                          </div>
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
                          {order.notes && (
                            <p className="text-text-muted text-xs font-inter mb-1">
                              📝 {order.notes}
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
                            <div className="flex gap-2">
                              {next && (
                                <button
                                  onClick={() => handleAdvance(order)}
                                  className="flex-1 bg-green-primary text-white font-inter font-medium text-sm h-10 rounded-lg hover:bg-green-dark transition-colors"
                                >
                                  Marquer : {statusLabels[next]}
                                </button>
                              )}
                              <button
                                onClick={() => setCancelTarget(order)}
                                className="px-4 h-10 rounded-lg border border-error text-error font-inter font-medium text-sm hover:bg-error/5 transition-colors"
                              >
                                Annuler
                              </button>
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
                        Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Retour</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (cancelTarget) { handleCancel(cancelTarget); setCancelTarget(null); }
                        }}
                        className="bg-error text-white hover:bg-error/90"
                      >
                        Oui, annuler la commande
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
                onUpdate={() => {
                  window.location.reload();
                }}
              />
            ) : tab === 'finances' ? (
              <FinancesTab orders={orders} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function MenuTab({
  restaurantId,
  items,
  loading,
  onDelete,
  onCreated,
}: {
  restaurantId: string;
  items: { id: string; name: string; description: string; price: number; category: string; isPopular: boolean }[];
  loading: boolean;
  onDelete: (id: string) => void;
  onCreated: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<string>(menuCategories[0]);
  const [image, setImage] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Convert to base64 data URL (works in mock mode, no backend needed)
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImage(dataUrl);
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
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
      if (editingId) {
        await updateMenuItem(editingId, {
          name,
          description,
          price: Number(price),
          category,
          image: image || undefined,
        });
      } else {
        await createMenuItem({
          restaurantId,
          name,
          description,
          price: Number(price),
          category,
          image: image || undefined,
        });
      }
      setName('');
      setDescription('');
      setPrice('');
      setImage('');
      setImagePreview(null);
      setShowForm(false);
      setEditingId(null);
      onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: any) => {
    setName(item.name);
    setDescription(item.description);
    setPrice(item.price.toString());
    setCategory(item.category);
    setImage(item.image || '');
    setImagePreview(item.image || null);
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
    setImage('');
    setImagePreview(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-border-custom p-5">
        {!showForm ? (
          <button
            onClick={() => {
              setName('');
              setDescription('');
              setPrice('');
              setImage('');
              setImagePreview(null);
              setCategory(menuCategories[0]);
              setShowForm(true);
            }}
            className="flex items-center gap-2 text-green-primary font-inter font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Ajouter un plat
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <h3 className="font-inter font-semibold text-text-primary mb-2">
              {editingId ? 'Modifier le plat' : 'Ajouter un plat'}
            </h3>
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
              {menuCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Image upload + preview */}
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">Photo du plat</label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Aperçu" className="w-28 h-28 object-cover rounded-lg border border-border-custom" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-error text-white flex items-center justify-center shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 bg-bg-secondary rounded-lg px-4 h-20 text-text-muted font-inter text-sm border-2 border-dashed border-border-custom hover:border-green-primary hover:text-green-primary transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  Cliquez pour choisir une image
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="block text-xs text-green-primary font-inter font-medium mt-1 hover:underline"
                >
                  Changer l'image
                </button>
              )}
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={2}
              className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted resize-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-green-primary text-white font-inter font-medium text-sm px-5 h-10 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
              >
                {submitting ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Ajouter'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="text-text-secondary font-inter text-sm px-4 h-10 rounded-lg hover:bg-bg-secondary transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-border-custom divide-y divide-border-light">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-border-custom p-10 text-center">
          <p className="text-text-secondary font-inter font-medium">Aucun plat pour le moment.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border-custom divide-y divide-border-light">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-inter font-medium text-text-primary text-sm">
                  {item.name}
                  {item.isPopular && (
                    <span className="ml-2 bg-gold-light text-gold-accent text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full">
                      Populaire
                    </span>
                  )}
                </p>
                <p className="text-text-muted text-xs font-inter">
                  {item.category} · {item.price.toLocaleString()} FCFA
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(item)}
                  className="text-xs font-inter font-medium text-text-secondary hover:text-green-primary transition-colors px-2"
                >
                  Modifier
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-error hover:bg-error/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileTab({
  restaurant,
  onUpdate,
}: {
  restaurant: Restaurant;
  onUpdate: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(restaurant.isOpen);
  const [hours, setHours] = useState(restaurant.hours);
  const [deliveryTime, setDeliveryTime] = useState(restaurant.deliveryTime);
  const [minOrder, setMinOrder] = useState(restaurant.minOrder.toString());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateRestaurantProfile(restaurant.id, {
        isOpen,
        hours,
        deliveryTime,
        minOrder: Number(minOrder)
      });
      onUpdate();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border-custom p-5 max-w-2xl">
      <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">Profil du Restaurant</h2>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg border border-border-light">
          <div>
            <h3 className="font-inter font-semibold text-text-primary">Mode Rush (Ouverture/Fermeture)</h3>
            <p className="text-sm text-text-secondary">Fermez temporairement si vous êtes débordé de commandes.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOpen ? 'bg-green-primary' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOpen ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div>
          <label className="block text-sm font-inter font-medium text-text-primary mb-1">Horaires d'ouverture</label>
          <input
            type="text"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-inter font-medium text-text-primary mb-1">Temps de livraison estimé</label>
          <input
            type="text"
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none"
          />
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

function FinancesTab({ orders }: { orders: Order[] }) {
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
  const yamoCommissionRate = 0.15;
  const commission = totalRevenue * yamoCommissionRate;
  const netRevenue = totalRevenue - commission;

  return (
    <div className="space-y-6 max-w-3xl">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-border-custom p-5 text-center">
          <p className="text-sm font-inter text-text-secondary mb-1">Revenus Bruts</p>
          <p className="font-poppins font-bold text-2xl text-text-primary">{totalRevenue.toLocaleString()} FCFA</p>
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-5 text-center">
          <p className="text-sm font-inter text-text-secondary mb-1">Commission Yamo (15%)</p>
          <p className="font-poppins font-bold text-2xl text-error">-{commission.toLocaleString()} FCFA</p>
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-5 text-center">
          <p className="text-sm font-inter text-text-secondary mb-1">Revenus Nets</p>
          <p className="font-poppins font-bold text-2xl text-green-primary">{netRevenue.toLocaleString()} FCFA</p>
        </div>
      </div>

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
