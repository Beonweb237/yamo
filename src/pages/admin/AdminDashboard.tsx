import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, ShoppingBag, Wallet, Store, TrendingUp, MapPin, Trophy, ChefHat, Percent } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useRestaurants } from '../../hooks/useCatalog';
import { fetchAllOrders } from '../../lib/orders';
import type { OrderStatus } from '../../lib/orders';
import DeliveryMap from '../../components/DeliveryMap';

const YAMO_COMMISSION_RATE = 0.15;

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

  // S6 — top plateforme + CA/commission par période
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const periodStart = period === 'week' ? Date.now() - 7 * 86400000 : period === 'month' ? Date.now() - 30 * 86400000 : 0;
  const periodOrders = useMemo(
    () => orders.filter((o: any) => new Date(o.createdAt).getTime() >= periodStart),
    [orders, periodStart]
  );

  const stats = useMemo(() => {
    const revenue = orders.filter((o: any) => o.status !== 'cancelled').reduce((s: number, o: any) => s + o.total, 0);
    const byStatus = orders.reduce((acc: any, o: any) => { acc[o.status] = (acc[o.status] ?? 0) + 1; return acc; }, {});
    return { total: orders.length, revenue, byStatus };
  }, [orders]);

  const periodStats = useMemo(() => {
    const valid = periodOrders.filter((o: any) => o.status !== 'cancelled');
    const revenue = valid.reduce((s: number, o: any) => s + o.total, 0);
    return { revenue, commission: revenue * YAMO_COMMISSION_RATE };
  }, [periodOrders]);

  const revenueByDay = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter((o: any) => o.status !== 'cancelled').forEach((o: any) => {
      const day = new Date(o.createdAt).toLocaleDateString('fr-FR');
      map[day] = (map[day] ?? 0) + o.total;
    });
    return Object.entries(map).map(([day, total]) => ({ day, total })).slice(-7);
  }, [orders]);

  const topRestaurants = useMemo(() => {
    const byRestaurant: Record<string, { name: string; revenue: number; orders: number }> = {};
    for (const o of periodOrders) {
      if (o.status === 'cancelled') continue;
      const key = o.restaurantId || o.restaurantName || 'Inconnu';
      const entry = (byRestaurant[key] ??= { name: o.restaurantName || 'Restaurant', revenue: 0, orders: 0 });
      entry.revenue += o.total;
      entry.orders += 1;
    }
    return Object.values(byRestaurant).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [periodOrders]);

  const topDishes = useMemo(() => {
    const byDish: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const o of periodOrders) {
      if (o.status === 'cancelled') continue;
      for (const item of o.items ?? []) {
        const entry = (byDish[item.name] ??= { name: item.name, quantity: 0, revenue: 0 });
        entry.quantity += item.quantity;
        entry.revenue += item.quantity * item.price;
      }
    }
    return Object.values(byDish).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }, [periodOrders]);

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

      {/* S6 — top plateforme + CA/commission par période */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-inter font-medium text-text-secondary">Période :</span>
        {(['week', 'month', 'all'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-colors ${period === p ? 'bg-green-primary text-white' : 'bg-white border border-border-custom text-text-secondary hover:text-text-primary'
              }`}
          >
            {p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Tout'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-border-custom p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold-light flex items-center justify-center shrink-0"><Percent className="w-5 h-5 text-gold-accent" /></div>
          <div>
            <p className="text-text-muted text-xs font-inter">Commission Yamo générée (15%)</p>
            <p className="font-poppins font-bold text-text-primary text-xl">{Math.round(periodStats.commission).toLocaleString()} FCFA</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-light flex items-center justify-center shrink-0"><Wallet className="w-5 h-5 text-green-primary" /></div>
          <div>
            <p className="text-text-muted text-xs font-inter">CA sur la période</p>
            <p className="font-poppins font-bold text-text-primary text-xl">{periodStats.revenue.toLocaleString()} FCFA</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-border-custom p-5">
          <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold-accent" />Top restaurants
          </h2>
          {topRestaurants.length === 0 ? (
            <p className="text-text-secondary font-inter text-sm">Aucune donnée sur cette période.</p>
          ) : (
            <div className="divide-y divide-border-light">
              {topRestaurants.map((r, i) => (
                <div key={r.name} className="py-2.5 flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full text-xs font-inter font-bold flex items-center justify-center shrink-0 ${i < 3 ? 'bg-gold-light text-gold-accent' : 'text-text-muted'}`}>{i + 1}</span>
                  <p className="flex-1 font-inter font-medium text-text-primary text-sm truncate">{r.name}</p>
                  <p className="text-text-muted text-xs font-inter shrink-0">{r.orders} cmd.</p>
                  <p className="font-inter font-semibold text-green-primary text-sm shrink-0 w-24 text-right">{r.revenue.toLocaleString()} FCFA</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-5">
          <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-green-primary" />Top plats plateforme
          </h2>
          {topDishes.length === 0 ? (
            <p className="text-text-secondary font-inter text-sm">Aucune donnée sur cette période.</p>
          ) : (
            <div className="divide-y divide-border-light">
              {topDishes.map((d, i) => (
                <div key={d.name} className="py-2.5 flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full text-xs font-inter font-bold flex items-center justify-center shrink-0 ${i < 3 ? 'bg-gold-light text-gold-accent' : 'text-text-muted'}`}>{i + 1}</span>
                  <p className="flex-1 font-inter font-medium text-text-primary text-sm truncate">{d.name}</p>
                  <p className="text-text-muted text-xs font-inter shrink-0">{d.quantity} vendus</p>
                  <p className="font-inter font-semibold text-green-primary text-sm shrink-0 w-24 text-right">{d.revenue.toLocaleString()} FCFA</p>
                </div>
              ))}
            </div>
          )}
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
