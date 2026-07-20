import { usePolling } from '../../hooks/usePolling';
import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Search, Phone, MessageCircle, XCircle } from 'lucide-react';
import { useRestaurants } from '../../hooks/useCatalog';
import { fetchAllOrders, cancelOrder, getDriverPhone, type OrderStatus, type Order } from '../../lib/orders';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { toast } from 'sonner';

const statusLabels: Record<OrderStatus, string> = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', picked_up: 'Récupérée', delivering: 'En livraison',
  delivered: 'Livrée', cancelled: 'Annulée',
};

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivering'];

function whatsappTo(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

export default function AdminOrders() {
  const { restaurants } = useRestaurants();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  // Filtre de statut préremplissable via ?status= (liens depuis le dashboard).
  const statusParam = searchParams.get('status') as OrderStatus | null;
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>(
    statusParam && statusParam in statusLabels ? statusParam : 'all'
  );

  const load = useCallback(async () => { setOrders(await fetchAllOrders()); setLoading(false); }, []);
  usePolling(load, 30000);

  const restaurantNameById = useMemo(() => Object.fromEntries(restaurants.map((r) => [r.id, r.name])), [restaurants]);

  const filtered = useMemo(() => {
    let r = orders;
    if (statusFilter !== 'all') r = r.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((o) =>
        o.id.toLowerCase().includes(q) ||
        (restaurantNameById[o.restaurantId] ?? '').toLowerCase().includes(q) ||
        (o.recipient?.name ?? '').toLowerCase().includes(q) ||
        (o.recipient?.phone ?? '').toLowerCase().includes(q) ||
        (o.contactPhone ?? '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [orders, statusFilter, search, restaurantNameById]);

  // Fiche commande (CONF-19) : détail + actions annuler/contacter.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => orders.find((o) => o.id === selectedId) ?? null, [orders, selectedId]);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  const handleAdminCancel = async () => {
    if (!selected || !cancelReason.trim()) return;
    await cancelOrder(selected.id, cancelReason.trim(), 'admin');
    setCancelOpen(false);
    toast.success('Commande annulée — motif visible par le client et le restaurant.');
    load();
  };

  const handleStatusFilterChange = (value: OrderStatus | 'all') => {
    setStatusFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('status');
    else next.set('status', value);
    setSearchParams(next, { replace: true });
  };

  const driverPhone = selected ? getDriverPhone(selected.driverId) : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-poppins font-bold text-text-primary text-2xl">Commandes</h1>
        <button onClick={load} className="flex items-center gap-1.5 text-text-secondary text-sm hover:text-text-primary"><RefreshCw className="w-4 h-4" />Actualiser</button>
      </div>
      <div className="bg-white rounded-xl border border-border-custom p-5">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 bg-bg-secondary rounded-lg px-3 h-10">
            <Search className="w-4 h-4 text-text-muted shrink-0" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par ID, restaurant ou bénéficiaire..." className="flex-1 bg-transparent text-text-primary text-sm outline-none placeholder:text-text-muted" />
          </div>
          <select value={statusFilter} onChange={(e) => handleStatusFilterChange(e.target.value as OrderStatus | 'all')} className="bg-bg-secondary rounded-lg px-3 h-10 text-text-primary text-sm outline-none">
            <option value="all">Tous les statuts</option>
            {(Object.keys(statusLabels) as OrderStatus[]).map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-text-secondary text-sm">Aucune commande trouvée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-inter">
              <thead><tr className="text-left text-text-muted text-xs"><th className="pb-2 pr-4">Commande</th><th className="pb-2 pr-4">Bénéficiaire</th><th className="pb-2 pr-4">Restaurant</th><th className="pb-2 pr-4">Statut</th><th className="pb-2 pr-4">Total</th><th className="pb-2">Date</th></tr></thead>
              <tbody className="divide-y divide-border-light">
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedId(order.id)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelectedId(order.id); }}
                    className="cursor-pointer hover:bg-bg-secondary transition-colors"
                    aria-label={`Voir la commande ${order.id.slice(0, 8)}`}
                  >
                    <td className="py-2 pr-4 text-text-primary">#{order.id.slice(0, 8)}</td>
                    <td className="py-2 pr-4 text-text-secondary">
                      {order.recipient ? (
                        <span>
                          {order.recipient.name || 'Bénéficiaire'}
                          {order.recipient.phone && <span className="block text-[11px] text-text-muted">{order.recipient.phone}</span>}
                        </span>
                      ) : (
                        <span className="text-text-muted">Client</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">{restaurantNameById[order.restaurantId] ?? order.restaurantId.slice(0, 8)}</td>
                    <td className="py-2 pr-4 text-text-secondary">
                      {statusLabels[order.status]}
                      {order.deliveredWithoutCode && (
                        <span className="ml-1.5 text-[10px] font-inter font-bold text-amber-700 bg-gold-light px-1.5 py-0.5 rounded-full" title="Clôturée sans code de livraison">
                          sans code ⚠
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-text-primary font-semibold">{order.total.toLocaleString()} FCFA</td>
                    <td className="py-2 text-text-muted text-xs">{new Date(order.createdAt).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fiche commande (CONF-19) */}
      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent className="w-full sm:max-w-[440px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-poppins">Commande #{selected.id.slice(0, 8)}</SheetTitle>
                <SheetDescription>
                  {restaurantNameById[selected.restaurantId] ?? 'Restaurant'} · {new Date(selected.createdAt).toLocaleString('fr-FR')}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4 pb-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-inter font-medium px-2.5 py-1 rounded-full ${selected.status === 'cancelled' ? 'bg-error/10 text-error' : selected.status === 'delivered' ? 'bg-green-light text-green-primary' : 'bg-gold-light text-amber-700'}`}>
                    {statusLabels[selected.status]}
                  </span>
                  {selected.deliveredWithoutCode && (
                    <span className="text-[10px] font-inter font-bold text-amber-700 bg-gold-light px-2 py-0.5 rounded-full">
                      Clôturée sans code ⚠
                    </span>
                  )}
                  <span className="text-xs font-inter text-text-muted">
                    {selected.paymentMethod === 'cash' ? 'Espèces' : selected.paymentMethod === 'mtn_momo' ? 'MTN MoMo' : 'Orange Money'}
                  </span>
                </div>

                {selected.status === 'cancelled' && selected.cancellationReason && (
                  <p className="bg-error/5 text-text-secondary rounded-lg px-3 py-2 text-xs font-inter">
                    Annulée par {selected.cancelledBy === 'customer' ? 'le client' : selected.cancelledBy === 'restaurant' ? 'le restaurant' : "l'admin"}
                    {' '}· Motif : <span className="font-medium text-text-primary">{selected.cancellationReason}</span>
                  </p>
                )}

                <div>
                  <h3 className="font-inter font-semibold text-text-primary text-sm mb-2">Articles</h3>
                  <div className="space-y-1">
                    {selected.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-sm font-inter">
                        <span className="text-text-secondary">{it.quantity} × {it.name}</span>
                        <span className="text-text-primary">{(it.price * it.quantity).toLocaleString()} FCFA</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border-light mt-2 pt-2 space-y-1 text-sm font-inter">
                    <div className="flex justify-between text-text-secondary"><span>Sous-total</span><span>{selected.subtotal.toLocaleString()} FCFA</span></div>
                    <div className="flex justify-between text-text-secondary"><span>Livraison</span><span>{selected.deliveryFee.toLocaleString()} FCFA</span></div>
                    <div className="flex justify-between font-bold text-text-primary"><span>Total</span><span>{selected.total.toLocaleString()} FCFA</span></div>
                  </div>
                </div>

                <div>
                  <h3 className="font-inter font-semibold text-text-primary text-sm mb-1">Livraison</h3>
                  <p className="text-text-secondary text-sm font-inter">{selected.address.fullText || '—'}</p>
                  {selected.notes && <p className="text-text-muted text-xs font-inter mt-1">📝 {selected.notes}</p>}
                  {selected.recipient && (
                    <p className="text-text-muted text-xs font-inter mt-1">
                      Pour {selected.recipient.name || 'bénéficiaire'}{selected.recipient.phone ? ` · ${selected.recipient.phone}` : ''}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="font-inter font-semibold text-text-primary text-sm mb-2">Contacter</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.contactPhone && (
                      <>
                        <a href={`tel:${selected.contactPhone}`} className="inline-flex items-center gap-1.5 bg-bg-secondary text-text-primary font-inter text-xs h-9 px-3 rounded-lg hover:bg-border-light transition-colors">
                          <Phone className="w-3.5 h-3.5" /> Client
                        </a>
                        <a href={whatsappTo(selected.contactPhone, `Bonjour, équipe MiamExpress — au sujet de votre commande #${selected.id.slice(0, 8)}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-bg-secondary text-text-primary font-inter text-xs h-9 px-3 rounded-lg hover:bg-border-light transition-colors">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp client
                        </a>
                      </>
                    )}
                    {driverPhone && (
                      <a href={`tel:${driverPhone}`} className="inline-flex items-center gap-1.5 bg-bg-secondary text-text-primary font-inter text-xs h-9 px-3 rounded-lg hover:bg-border-light transition-colors">
                        <Phone className="w-3.5 h-3.5" /> Livreur
                      </a>
                    )}
                    {!selected.contactPhone && !driverPhone && (
                      <p className="text-text-muted text-xs font-inter">Aucun contact disponible.</p>
                    )}
                  </div>
                </div>

                {ACTIVE_STATUSES.includes(selected.status) && (
                  <button
                    type="button"
                    onClick={() => { setCancelReason(''); setCancelOpen(true); }}
                    className="w-full flex items-center justify-center gap-1.5 border border-error text-error font-inter font-medium text-sm h-10 rounded-lg hover:bg-error/5 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Annuler cette commande
                  </button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Annulation admin (motif obligatoire) */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la commande #{selected?.id.slice(0, 8)} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le client et le restaurant verront le motif. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Motif de l'annulation (obligatoire)..."
            rows={3}
            autoFocus
            className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAdminCancel}
              disabled={!cancelReason.trim()}
              className="bg-error text-white hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annuler la commande
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
