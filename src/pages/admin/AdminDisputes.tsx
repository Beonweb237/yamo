import { useEffect, useState, useCallback, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useRestaurants } from '../../hooks/useCatalog';
import { fetchAllOrders } from '../../lib/orders';
import type { Order } from '../../lib/orders';

export default function AdminDisputes() {
  const { restaurants } = useRestaurants();
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => { setOrders(await fetchAllOrders()); }, []);
  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [load]);

  const restaurantNameById = useMemo(() => Object.fromEntries(restaurants.map((r) => [r.id, r.name])), [restaurants]);
  const cancelled = orders.filter((o) => o.status === 'cancelled');

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="font-poppins font-bold text-text-primary text-2xl mb-6 flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-gold-accent" />Litiges</h1>
      <div className="bg-white rounded-xl border border-border-custom p-5">
        <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">Commandes annulées ({cancelled.length})</h2>
        {cancelled.length === 0 ? (
          <p className="text-text-secondary text-sm">Aucune commande annulée.</p>
        ) : (
          <div className="divide-y divide-border-light">
            {cancelled.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-inter font-semibold text-sm text-text-primary">
                    #{order.id.slice(0, 8)}
                    <span className="ml-2 text-text-muted text-xs font-normal">{restaurantNameById[order.restaurantId] ?? '—'}</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    {new Date(order.createdAt).toLocaleString('fr-FR')}
                    {order.paymentMethod && <span className="ml-2">· {order.paymentMethod === 'cash' ? 'Espèces' : order.paymentMethod === 'mtn_momo' ? 'MTN MoMo' : 'Orange Money'}</span>}
                  </p>
                </div>
                <span className="font-inter font-semibold text-sm text-error">{order.total.toLocaleString()} FCFA</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
