import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { useRestaurants } from '../../hooks/useCatalog';
import { fetchAllOrders, type OrderStatus } from '../../lib/orders';
import { Skeleton } from '../../components/ui/skeleton';
import type { Order } from '../../lib/orders';

const statusLabels: Record<OrderStatus, string> = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', picked_up: 'Récupérée', delivering: 'En livraison',
  delivered: 'Livrée', cancelled: 'Annulée',
};

export default function AdminOrders() {
  const { restaurants } = useRestaurants();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  const load = useCallback(async () => { setOrders(await fetchAllOrders()); setLoading(false); }, []);
  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [load]);

  const restaurantNameById = useMemo(() => Object.fromEntries(restaurants.map((r) => [r.id, r.name])), [restaurants]);

  const filtered = useMemo(() => {
    let r = orders;
    if (statusFilter !== 'all') r = r.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((o) => o.id.toLowerCase().includes(q) || (restaurantNameById[o.restaurantId] ?? '').toLowerCase().includes(q));
    }
    return r;
  }, [orders, statusFilter, search, restaurantNameById]);

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
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par ID ou restaurant..." className="flex-1 bg-transparent text-text-primary text-sm outline-none placeholder:text-text-muted" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="bg-bg-secondary rounded-lg px-3 h-10 text-text-primary text-sm outline-none">
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
              <thead><tr className="text-left text-text-muted text-xs"><th className="pb-2 pr-4">Commande</th><th className="pb-2 pr-4">Restaurant</th><th className="pb-2 pr-4">Statut</th><th className="pb-2 pr-4">Total</th><th className="pb-2">Date</th></tr></thead>
              <tbody className="divide-y divide-border-light">
                {filtered.map((order) => (
                  <tr key={order.id}>
                    <td className="py-2 pr-4 text-text-primary">#{order.id.slice(0, 8)}</td>
                    <td className="py-2 pr-4 text-text-secondary">{restaurantNameById[order.restaurantId] ?? order.restaurantId.slice(0, 8)}</td>
                    <td className="py-2 pr-4 text-text-secondary">{statusLabels[order.status]}</td>
                    <td className="py-2 pr-4 text-text-primary font-semibold">{order.total.toLocaleString()} FCFA</td>
                    <td className="py-2 text-text-muted text-xs">{new Date(order.createdAt).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
