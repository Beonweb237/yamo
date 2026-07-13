import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, ShoppingBag, Wallet, Store, TrendingUp, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useRestaurants } from '../../hooks/useCatalog';
import { fetchAllOrders } from '../../lib/orders';
import type { OrderStatus } from '../../lib/orders';
import DeliveryMap from '../../components/DeliveryMap';

const statusLabels: Record<OrderStatus, string> = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', picked_up: 'Récupérée', delivering: 'En livraison',
  delivered: 'Livrée', cancelled: 'Annulée',
};

export default function AdminDashboard() {
  const { restaurants } = useRestaurants();
  const [orders, setOrders] = useState<any[]>([]);
  const loadOrders = useCallback(async () => {
    const data = await fetchAllOrders();
    setOrders(data);
  }, []);

  useEffect(() => { loadOrders(); const i = setInterval(loadOrders, 5000); return () => clearInterval(i); }, [loadOrders]);

  const stats = useMemo(() => {
    const revenue = orders.filter((o: any) => o.status !== 'cancelled').reduce((s: number, o: any) => s + o.total, 0);
    const byStatus = orders.reduce((acc: any, o: any) => { acc[o.status] = (acc[o.status] ?? 0) + 1; return acc; }, {});
    return { total: orders.length, revenue, byStatus };
  }, [orders]);

  const revenueByDay = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter((o: any) => o.status !== 'cancelled').forEach((o: any) => {
      const day = new Date(o.createdAt).toLocaleDateString('fr-FR');
      map[day] = (map[day] ?? 0) + o.total;
    });
    return Object.entries(map).map(([day, total]) => ({ day, total })).slice(-7);
  }, [orders]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-poppins font-bold text-text-primary text-2xl">Tableau de bord</h1>
        <button onClick={loadOrders} className="flex items-center gap-1.5 text-text-secondary text-sm font-inter hover:text-text-primary">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-border-custom p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-light flex items-center justify-center shrink-0"><ShoppingBag className="w-5 h-5 text-green-primary" /></div>
          <div><p className="text-text-muted text-xs font-inter">Commandes totales</p><p className="font-poppins font-bold text-text-primary text-xl">{stats.total}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold-light flex items-center justify-center shrink-0"><Wallet className="w-5 h-5 text-gold-accent" /></div>
          <div><p className="text-text-muted text-xs font-inter">Chiffre d'affaires</p><p className="font-poppins font-bold text-text-primary text-xl">{stats.revenue.toLocaleString()} FCFA</p></div>
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-light flex items-center justify-center shrink-0"><Store className="w-5 h-5 text-green-primary" /></div>
          <div><p className="text-text-muted text-xs font-inter">Restaurants actifs</p><p className="font-poppins font-bold text-text-primary text-xl">{restaurants.length}</p></div>
        </div>
      </div>

      {/* A1: Mini-map supervision */}
      <div className="bg-white rounded-xl border border-border-custom p-5 mb-6">
        <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-green-primary" />Supervision — Restaurants et livreurs actifs</h2>
        <DeliveryMap
          height="280px"
          points={[
            ...restaurants.slice(0, 5).map((r, i) => ({ lat: 4.04 + i * 0.006, lng: 9.76 + i * 0.005, label: r.name, type: 'restaurant' as const })),
            { lat: 4.045, lng: 9.775, label: 'Livreur dispo 1', type: 'driver' as const },
            { lat: 4.055, lng: 9.78, label: 'Livreur dispo 2', type: 'driver' as const },
          ]}
        />
      </div>

      <div className="bg-white rounded-xl border border-border-custom p-5 mb-6">
        <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">Commandes par statut</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(statusLabels) as OrderStatus[]).map((s) => (
            <span key={s} className="text-xs font-inter font-medium px-3 py-1.5 rounded-full bg-bg-secondary text-text-secondary">{statusLabels[s]} : {stats.byStatus[s] ?? 0}</span>
          ))}
        </div>
      </div>

      {revenueByDay.length > 0 && (
        <div className="bg-white rounded-xl border border-border-custom p-5">
          <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-primary" />CA — 7 derniers jours</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} FCFA`, 'CA']} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB' }} />
              <Bar dataKey="total" fill="#2D6A4F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
