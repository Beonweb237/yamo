import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, UserCheck, Check, X, Store, Bike, Search, Clock, ThumbsUp, ThumbsDown, Phone, MapPin } from 'lucide-react';
import { useRestaurants } from '../../hooks/useCatalog';
import { fetchAllApplications, approveApplication, rejectApplication, type Application, type ApplicationStatus } from '../../lib/applications';
import { toast } from 'sonner';

type Tab = 'pending' | 'approved' | 'rejected';

const typeConfig = {
  restaurant: { label: 'Restaurateur', icon: Store, badge: 'bg-gold-light text-gold-accent' },
  livreur: { label: 'Livreur', icon: Bike, badge: 'bg-green-light text-green-primary' },
} as const;

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export default function AdminApplications() {
  const { restaurants } = useRestaurants();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedRestaurantByApp, setSelectedRestaurantByApp] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('pending');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setApplications(await fetchAllApplications());
    setLoading(false);
  }, []);
  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [load]);

  const byStatus = useMemo(() => {
    const acc: Record<ApplicationStatus, Application[]> = { pending: [], approved: [], rejected: [] };
    for (const a of applications) acc[a.status].push(a);
    return acc;
  }, [applications]);

  const visible = useMemo(() => {
    const list = byStatus[tab];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) =>
      (a.restaurantName ?? '').toLowerCase().includes(q) ||
      (a.city ?? '').toLowerCase().includes(q) ||
      (a.address ?? '').toLowerCase().includes(q) ||
      (a.contactPhone ?? '').toLowerCase().includes(q)
    );
  }, [byStatus, tab, query]);

  const handleApprove = async (app: Application) => {
    setReviewingId(app.id);
    try {
      await approveApplication(app.id, app.type === 'restaurant' ? selectedRestaurantByApp[app.id] : undefined);
      load();
      toast.success(`Candidature ${app.type === 'restaurant' ? 'restaurant' : 'livreur'} approuvée`);
    } catch { toast.error('Erreur'); }
    finally { setReviewingId(null); }
  };
  const handleReject = async (app: Application) => {
    setReviewingId(app.id);
    try { await rejectApplication(app.id); load(); toast.success('Candidature rejetée'); }
    catch { toast.error('Erreur'); }
    finally { setReviewingId(null); }
  };

  const tabs: { id: Tab; label: string; icon: typeof Clock; count: number }[] = [
    { id: 'pending', label: 'En attente', icon: Clock, count: byStatus.pending.length },
    { id: 'approved', label: 'Approuvées', icon: ThumbsUp, count: byStatus.approved.length },
    { id: 'rejected', label: 'Rejetées', icon: ThumbsDown, count: byStatus.rejected.length },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-poppins font-bold text-text-primary text-2xl flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-green-primary" />Candidatures
        </h1>
        <button onClick={load} className="flex items-center gap-1.5 text-text-secondary text-sm font-inter hover:text-text-primary">
          <RefreshCw className="w-4 h-4" />Actualiser
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-border-custom p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold-light flex items-center justify-center shrink-0"><Clock className="w-5 h-5 text-gold-accent" /></div>
          <div><p className="text-text-muted text-xs font-inter">En attente</p><p className="font-poppins font-bold text-text-primary text-xl">{byStatus.pending.length}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-light flex items-center justify-center shrink-0"><ThumbsUp className="w-5 h-5 text-green-primary" /></div>
          <div><p className="text-text-muted text-xs font-inter">Approuvées</p><p className="font-poppins font-bold text-text-primary text-xl">{byStatus.approved.length}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center shrink-0"><ThumbsDown className="w-5 h-5 text-error" /></div>
          <div><p className="text-text-muted text-xs font-inter">Rejetées</p><p className="font-poppins font-bold text-text-primary text-xl">{byStatus.rejected.length}</p></div>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex gap-1 bg-white rounded-lg border border-border-custom p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-inter font-medium transition-colors ${
                tab === t.id ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <t.icon className="w-4 h-4" />{t.label}
              <span className={`text-xs rounded-full px-1.5 ${tab === t.id ? 'bg-white/20' : 'bg-bg-secondary'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-border-custom px-3 h-11 flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-text-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher..."
            className="flex-1 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-border-custom overflow-hidden">
        {loading ? (
          <p className="p-8 text-text-secondary text-sm text-center">Chargement...</p>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center">
            <UserCheck className="w-10 h-10 text-text-muted mx-auto mb-2" />
            <p className="text-text-secondary font-inter text-sm">
              {query ? 'Aucune candidature ne correspond à cette recherche.' : `Aucune candidature ${tab === 'pending' ? 'en attente' : tab === 'approved' ? 'approuvée' : 'rejetée'}.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {visible.map((app) => {
              const cfg = typeConfig[app.type];
              const Icon = cfg.icon;
              return (
                <div key={app.id} className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
                  <div className="w-11 h-11 rounded-full bg-bg-secondary flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-inter font-semibold text-text-primary text-sm">
                        {app.type === 'restaurant' ? app.restaurantName || 'Restaurant sans nom' : 'Candidature livreur'}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                      {tab !== 'pending' && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          app.status === 'approved' ? 'bg-green-light text-green-primary' : 'bg-error/10 text-error'
                        }`}>
                          {app.status === 'approved' ? 'Approuvée' : 'Rejetée'}
                        </span>
                      )}
                      <span className="text-text-muted text-xs font-inter ml-auto">{timeAgo(app.createdAt)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-text-muted text-xs font-inter mb-1.5">
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{[app.address, app.city].filter(Boolean).join(', ') || 'Non renseigné'}</span>
                      <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{app.contactPhone || 'Non renseigné'}</span>
                    </div>
                    {app.notes && <p className="text-text-secondary text-xs font-inter italic mb-2">"{app.notes}"</p>}

                    {tab === 'pending' && (
                      <>
                        {app.type === 'restaurant' && (
                          <div className="mb-3 mt-2">
                            <label className="block text-text-muted text-xs mb-1">Lier à un restaurant existant (optionnel)</label>
                            <select
                              value={selectedRestaurantByApp[app.id] ?? ''}
                              onChange={(e) => setSelectedRestaurantByApp((p) => ({ ...p, [app.id]: e.target.value }))}
                              className="w-full sm:w-80 bg-bg-secondary rounded-lg px-3 h-10 text-text-primary text-sm outline-none"
                            >
                              <option value="">Créer un nouveau restaurant</option>
                              {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(app)}
                            disabled={reviewingId === app.id}
                            className="flex items-center gap-1.5 bg-green-primary text-white font-medium text-sm px-4 h-9 rounded-lg hover:bg-green-dark disabled:opacity-60"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {app.type === 'restaurant' && !selectedRestaurantByApp[app.id] ? 'Approuver + créer' : 'Approuver'}
                          </button>
                          <button
                            onClick={() => handleReject(app)}
                            disabled={reviewingId === app.id}
                            className="flex items-center gap-1.5 border border-error text-error font-medium text-sm px-4 h-9 rounded-lg hover:bg-error/5 disabled:opacity-60"
                          >
                            <X className="w-3.5 h-3.5" />Rejeter
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
