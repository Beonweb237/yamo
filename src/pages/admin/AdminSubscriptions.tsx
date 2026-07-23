import { useEffect, useMemo, useState } from 'react';
import { HeartPulse, RefreshCw, Search, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../../hooks/useSeo';
import {
  fetchAdminSubscriptions, SUBSCRIPTION_STATUS_LABELS, type Subscription, type SubscriptionStatus,
} from '../../lib/subscriptions';

const STATUS_STYLE: Record<SubscriptionStatus, string> = {
  active: 'bg-green-light text-green-primary', paused: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-700', completed: 'bg-bg-secondary text-text-muted',
};

function authHeader(): Record<string, string> {
  try { const raw = localStorage.getItem('miamexpress_session'); const tk = raw ? JSON.parse(raw)?.access_token : null; return tk ? { Authorization: `Bearer ${tk}` } : {}; } catch { return {}; }
}

export default function AdminSubscriptions() {
  const { t } = useTranslation();
  useSeo({ title: t('Abonnements'), noindex: true });
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [counts, setCounts] = useState<Record<SubscriptionStatus, number>>({ active: 0, paused: 0, cancelled: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SubscriptionStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = () => {
    setLoading(true);
    fetchAdminSubscriptions().then((d) => { setSubs(d.subscriptions); setCounts(d.counts); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : 'Erreur')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/subscriptions/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify({ horizonDays: 1 }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Erreur');
      toast.success(t('{{n}} commande(s) d\'abonnement générée(s).', { n: j.ordersCreated }));
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t('Génération impossible')); }
    finally { setGenerating(false); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subs.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (!q) return true;
      return [s.programName, s.restaurantName, s.customerName, s.customerPhone].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [subs, filter, query]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px]">
      <div className="flex items-start gap-3 mb-6 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-green-primary/10 grid place-items-center shrink-0"><HeartPulse className="w-6 h-6 text-green-primary" /></div>
        <div className="flex-1 min-w-0">
          <h1 className="font-poppins font-bold text-text-primary text-xl sm:text-2xl">{t('Abonnements')}</h1>
          <p className="text-text-muted text-xs sm:text-sm mt-0.5">{t('Suivi des abonnements repas et génération des livraisons du jour.')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generate} disabled={generating} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-green-primary text-white text-sm font-semibold hover:bg-green-dark disabled:opacity-60"><PlayCircle className="w-4 h-4" />{t('Générer les livraisons')}</button>
          <button onClick={load} disabled={loading} className="h-10 px-3 rounded-xl border border-border-custom bg-white text-text-secondary hover:bg-bg-secondary text-sm flex items-center"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {(['active', 'paused', 'completed', 'cancelled'] as SubscriptionStatus[]).map((s) => (
          <button key={s} onClick={() => setFilter(filter === s ? 'all' : s)} className={`bg-white rounded-2xl border p-3 sm:p-4 text-left ${filter === s ? 'border-green-primary border-2' : 'border-border-custom'}`}>
            <span className="font-poppins font-bold text-xl block text-text-primary">{counts[s] ?? 0}</span>
            <span className="text-text-muted text-xs">{t(SUBSCRIPTION_STATUS_LABELS[s])}</span>
          </button>
        ))}
      </div>

      <div className="h-10 rounded-xl border border-border-custom bg-white flex items-center gap-2 px-3 mb-5">
        <Search className="w-4 h-4 text-text-muted" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Rechercher programme, client, resto…')} className="flex-1 bg-transparent outline-none text-sm min-w-0" />
      </div>

      {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 bg-white rounded-xl border border-border-custom animate-pulse" />)}</div>
        : error ? <div className="bg-white rounded-2xl border border-red-200 p-6 text-center text-text-muted">{error}</div>
        : filtered.length === 0 ? <div className="bg-white rounded-2xl border border-border-custom p-10 text-center text-text-muted">{t('Aucun abonnement.')}</div>
        : (
          <div className="overflow-x-auto bg-white rounded-2xl border border-border-custom">
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-text-muted text-xs text-left border-b border-border-custom">
                <th className="p-3 font-medium">{t('Programme')}</th><th className="p-3 font-medium">{t('Client')}</th>
                <th className="p-3 font-medium">{t('Restaurant')}</th><th className="p-3 font-medium">{t('Statut')}</th>
                <th className="p-3 font-medium text-right">{t('Livraisons')}</th><th className="p-3 font-medium text-right">{t('Prix')}</th>
              </tr></thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border-light last:border-0">
                    <td className="p-3 font-medium text-text-primary">{s.programName}</td>
                    <td className="p-3 text-text-secondary">{s.customerName || '—'}<span className="block text-xs text-text-muted">{s.customerPhone}</span></td>
                    <td className="p-3 text-text-secondary">{s.restaurantName}</td>
                    <td className="p-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status]}`}>{t(SUBSCRIPTION_STATUS_LABELS[s.status])}</span></td>
                    <td className="p-3 text-right text-text-muted">{s.deliveriesTotal ?? 0}</td>
                    <td className="p-3 text-right font-semibold text-text-primary">{s.priceFcfa.toLocaleString()} {t('FCFA')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
