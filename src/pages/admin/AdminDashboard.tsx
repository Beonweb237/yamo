import { usePolling } from '../../hooks/usePolling';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ShoppingBag, Wallet, Store, TrendingUp, Trophy, ChefHat, Percent, Radio, AlertTriangle } from 'lucide-react';
import { getDemoTracking, setDemoTracking, getRechargeMomoNumber, setRechargeMomoNumber } from '../../lib/tracking';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useRestaurants } from '../../hooks/useCatalog';
import { fetchAllOrders } from '../../lib/orders';
import type { OrderStatus } from '../../lib/orders';
import { CHART_PRIMARY, CHART_GRID, CHART_TICK, CHART_TOOLTIP_STYLE } from '../../lib/chartTheme';
import { useTranslation } from "react-i18next";
import { useSeo } from '../../hooks/useSeo';

const MIAMEXPRESS_COMMISSION_RATE = 0.15;

const statusLabels: Record<OrderStatus, string> = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', picked_up: 'Récupérée', delivering: 'En livraison',
  delivered: 'Livrée', cancelled: 'Annulée',
};

export default function AdminDashboard() {
    const { t } = useTranslation();
  useSeo({ title: t('Administration'), noindex: true });
  const { restaurants } = useRestaurants();
  const [orders, setOrders] = useState<any[]>([]);
  const loadOrders = useCallback(async () => {
    const data = await fetchAllOrders();
    setOrders(data);
  }, []);

  usePolling(loadOrders, 30000);

  // Série TRK — mode démonstration du suivi (réel par défaut). Basculable ici ;
  // un bandeau rappelle quand il est actif pour ne jamais l'oublier allumé.
  const [demoTracking, setDemoTrackingState] = useState(false);
  const [togglingDemo, setTogglingDemo] = useState(false);
  useEffect(() => { getDemoTracking().then(setDemoTrackingState).catch(() => {}); }, []);
  const toggleDemoTracking = async (next: boolean) => {
    setTogglingDemo(true);
    try {
      await setDemoTracking(next);
      setDemoTrackingState(next);
      toast.success(next ? 'Mode démonstration du suivi ACTIVÉ' : 'Suivi réel rétabli');
    } catch {
      toast.error('Impossible de changer le mode de suivi.');
    } finally {
      setTogglingDemo(false);
    }
  };

  // Série TRK — numéro de dépôt Mobile Money pour les recharges resto (app_settings).
  const [momoInput, setMomoInput] = useState('');
  const [savingMomo, setSavingMomo] = useState(false);
  useEffect(() => { getRechargeMomoNumber().then((n) => setMomoInput(n ?? '')).catch(() => {}); }, []);
  const saveMomo = async () => {
    setSavingMomo(true);
    try {
      await setRechargeMomoNumber(momoInput);
      toast.success(momoInput.trim() ? 'Numéro de recharge Mobile Money enregistré' : 'Numéro effacé');
    } catch {
      toast.error("Impossible d'enregistrer le numéro.");
    } finally {
      setSavingMomo(false);
    }
  };

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
    return { revenue, commission: revenue * MIAMEXPRESS_COMMISSION_RATE };
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
        <h1 className="font-poppins font-bold text-text-primary text-2xl">{t("Tableau de bord")}</h1>
        <button onClick={loadOrders} className="flex items-center gap-1.5 text-text-secondary text-sm font-inter hover:text-text-primary">
          <RefreshCw className="w-4 h-4" /> {t("Actualiser")}
        </button>
      </div>

      {/* Série TRK — bandeau d'alerte quand le suivi est en mode démonstration */}
      {demoTracking && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span className="text-amber-800 text-sm font-inter">
            <span className="font-semibold">{t("Mode démonstration du suivi actif.")}</span>{' '}
            {t("Les clients voient une position simulée du livreur (signalée comme estimation), pas le GPS réel.")}
          </span>
        </div>
      )}

      {/* Interrupteur mode de suivi */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-border-custom p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-light flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-green-primary" />
          </div>
          <div>
            <p className="font-inter font-semibold text-sm text-text-primary">{t("Suivi livreur")}</p>
            <p className="text-text-muted text-xs font-inter">
              {demoTracking
                ? t("Démonstration : position simulée (pour présentations/tests).")
                : t("Réel : position GPS envoyée par le livreur, repli honnête si indisponible.")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-inter text-text-muted">{t("Mode démo")}</span>
          <Switch checked={demoTracking} disabled={togglingDemo} onCheckedChange={toggleDemoTracking} />
        </div>
      </div>

      {/* Numéro de dépôt Mobile Money pour les recharges restaurant */}
      <div className="bg-white rounded-xl border border-border-custom p-4 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-green-light flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-green-primary" />
          </div>
          <div>
            <p className="font-inter font-semibold text-sm text-text-primary">{t("Numéro de recharge Mobile Money")}</p>
            <p className="text-text-muted text-xs font-inter">{t("Affiché aux restaurateurs pour déposer leur recharge. Vide = « communiqué par l'assistance ».")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="tel"
            value={momoInput}
            onChange={(e) => setMomoInput(e.target.value)}
            placeholder="Ex. 6XX XX XX XX (MTN MoMo / Orange Money)"
            className="flex-1 min-w-[200px] h-11 rounded-lg border border-border-custom bg-white px-3 text-sm font-inter outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10"
          />
          <button
            onClick={saveMomo}
            disabled={savingMomo}
            className="h-11 px-5 rounded-lg bg-green-primary text-white font-inter font-medium text-sm hover:bg-green-dark transition-colors disabled:opacity-60"
          >
            {savingMomo ? 'Enregistrement...' : t("Enregistrer")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-border-custom p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-light flex items-center justify-center shrink-0"><ShoppingBag className="w-5 h-5 text-green-primary" /></div>
          <div><p className="text-text-muted text-xs font-inter">{t("Commandes totales")}</p><p className="font-poppins font-bold text-text-primary text-xl">{stats.total}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold-light flex items-center justify-center shrink-0"><Wallet className="w-5 h-5 text-gold-accent" /></div>
          <div><p className="text-text-muted text-xs font-inter">{t("Chiffre d'affaires")}</p><p className="font-poppins font-bold text-text-primary text-xl">{stats.revenue.toLocaleString()} {t("FCFA")}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-light flex items-center justify-center shrink-0"><Store className="w-5 h-5 text-green-primary" /></div>
          <div><p className="text-text-muted text-xs font-inter">{t("Restaurants actifs")}</p><p className="font-poppins font-bold text-text-primary text-xl">{restaurants.length}</p></div>
        </div>
      </div>

      {/* S6 — top plateforme + CA/commission par période */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-inter font-medium text-text-secondary">{t("Période :")}</span>
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
            <p className="text-text-muted text-xs font-inter">{t("Commission MiamExpress générée (15%)")}</p>
            <p className="font-poppins font-bold text-text-primary text-xl">{Math.round(periodStats.commission).toLocaleString()} {t("FCFA")}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-light flex items-center justify-center shrink-0"><Wallet className="w-5 h-5 text-green-primary" /></div>
          <div>
            <p className="text-text-muted text-xs font-inter">{t("CA sur la période")}</p>
            <p className="font-poppins font-bold text-text-primary text-xl">{periodStats.revenue.toLocaleString()} {t("FCFA")}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-border-custom p-5">
          <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold-accent" />{t("Top restaurants")}
          </h2>
          {topRestaurants.length === 0 ? (
            <p className="text-text-secondary font-inter text-sm">{t("Aucune donnée sur cette période.")}</p>
          ) : (
            <div className="divide-y divide-border-light">
              {topRestaurants.map((r, i) => (
                <div key={r.name} className="py-2.5 flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full text-xs font-inter font-bold flex items-center justify-center shrink-0 ${i < 3 ? 'bg-gold-light text-amber-700' : 'text-text-muted'}`}>{i + 1}</span>
                  <p className="flex-1 font-inter font-medium text-text-primary text-sm truncate">{r.name}</p>
                  <p className="text-text-muted text-xs font-inter shrink-0">{r.orders} {t("cmd.")}</p>
                  <p className="font-inter font-semibold text-green-primary text-sm shrink-0 w-24 text-right">{r.revenue.toLocaleString()} {t("FCFA")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-5">
          <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-green-primary" />{t("Top plats plateforme")}
          </h2>
          {topDishes.length === 0 ? (
            <p className="text-text-secondary font-inter text-sm">{t("Aucune donnée sur cette période.")}</p>
          ) : (
            <div className="divide-y divide-border-light">
              {topDishes.map((d, i) => (
                <div key={d.name} className="py-2.5 flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full text-xs font-inter font-bold flex items-center justify-center shrink-0 ${i < 3 ? 'bg-gold-light text-amber-700' : 'text-text-muted'}`}>{i + 1}</span>
                  <p className="flex-1 font-inter font-medium text-text-primary text-sm truncate">{d.name}</p>
                  <p className="text-text-muted text-xs font-inter shrink-0">{d.quantity} {t("vendus")}</p>
                  <p className="font-inter font-semibold text-green-primary text-sm shrink-0 w-24 text-right">{d.revenue.toLocaleString()} {t("FCFA")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Carte de supervision retirée (CONF-35) : elle affichait des positions
          inventées. À réintroduire uniquement avec de vraies positions livreur
          (backend VPS). Remplacée par l'accès direct aux commandes par statut. */}
      <div className="bg-white rounded-xl border border-border-custom p-5 mb-6">
        <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">{t("Commandes par statut")}</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(statusLabels) as OrderStatus[]).map((s) => (
            <Link
              key={s}
              to={`/admin/orders?status=${s}`}
              className={`text-xs font-inter font-medium px-3 py-1.5 rounded-full transition-colors ${(stats.byStatus[s] ?? 0) > 0
                ? 'bg-green-light text-green-primary hover:bg-green-primary hover:text-white'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary'}`}
            >
              {statusLabels[s]} : {stats.byStatus[s] ?? 0}
            </Link>
          ))}
        </div>
      </div>

      {revenueByDay.length > 0 && (
        <div className="bg-white rounded-xl border border-border-custom p-5">
          <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-primary" />{t("CA — 7 derniers jours")}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: CHART_TICK }} />
              <YAxis tick={{ fontSize: 11, fill: CHART_TICK }} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} FCFA`, 'CA']} contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="total" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
