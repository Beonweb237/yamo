import { usePolling } from '../../hooks/usePolling';
import { useState, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { RefreshCw, UserCheck, Check, X, Store, Bike, Search, Clock, ThumbsUp, ThumbsDown, Phone, MapPin, Plus, ShieldCheck } from 'lucide-react';
import { useRestaurants } from '../../hooks/useCatalog';
import { fetchAllApplications, approveApplication, rejectApplication, type Application, type ApplicationStatus } from '../../lib/applications';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader';
import { approveAdminApplication, rejectAdminApplication } from '../../lib/admin';
import { useTranslation } from "react-i18next";

type Tab = 'pending' | 'approved' | 'rejected';

const typeConfig = {
  restaurant: { label: 'Restaurateur', icon: Store, badge: 'bg-gold-light text-amber-700' },
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
    const { t } = useTranslation();
  const { restaurants } = useRestaurants();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [selectedRestaurantByApp, setSelectedRestaurantByApp] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('pending');
  const [query, setQuery] = useState('');
  const [rejectTarget, setRejectTarget] = useState<Application | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setApplications(await fetchAllApplications());
    setLoading(false);
  }, []);
  usePolling(load, 30000);

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
      (a.applicantName ?? '').toLowerCase().includes(q) ||
      (a.city ?? '').toLowerCase().includes(q) ||
      (a.address ?? '').toLowerCase().includes(q) ||
      (a.contactPhone ?? '').toLowerCase().includes(q)
    );
  }, [byStatus, tab, query]);

  const handleApprove = async (app: Application) => {
    setReviewingId(app.id);
    try {
      const restaurantId = app.type === 'restaurant' ? selectedRestaurantByApp[app.id] : undefined;
      const handledByApi = await approveAdminApplication(app.id, restaurantId);
      if (!handledByApi) await approveApplication(app.id, restaurantId);
      load();
      toast.success(`Candidature ${app.type === 'restaurant' ? 'restaurant' : 'livreur'} approuvée`);
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setReviewingId(null); }
  };
  const handleReject = async (app: Application) => {
    setReviewingId(app.id);
    try {
      const handledByApi = await rejectAdminApplication(app.id, rejectReason || undefined);
      if (!handledByApi) await rejectApplication(app.id, rejectReason || undefined);
      setRejectTarget(null);
      setRejectReason('');
      load();
      toast.success('Candidature rejetée');
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally { setReviewingId(null); }
  };

  const tabs: { id: Tab; label: string; icon: typeof Clock; count: number }[] = [
    { id: 'pending', label: 'En attente', icon: Clock, count: byStatus.pending.length },
    { id: 'approved', label: 'Approuvées', icon: ThumbsUp, count: byStatus.approved.length },
    { id: 'rejected', label: 'Rejetées', icon: ThumbsDown, count: byStatus.rejected.length },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        icon={UserCheck}
        title="Candidatures"
        subtitle={`${applications.length} candidature${applications.length !== 1 ? 's' : ''} au total`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate('/admin/applications/nouveau/livreur')} className="flex items-center gap-1.5 text-white text-sm font-inter bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 backdrop-blur-sm transition-colors">
              <Plus className="w-4 h-4" />{t("Livreur validé")}
            </button>
            <button onClick={() => navigate('/admin/applications/nouveau/restaurant')} className="flex items-center gap-1.5 text-white text-sm font-inter bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 backdrop-blur-sm transition-colors">
              <Plus className="w-4 h-4" />{t("Restaurant validé")}
            </button>
            <button onClick={load} className="flex items-center gap-1.5 text-white text-sm font-inter bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 backdrop-blur-sm transition-colors">
              <RefreshCw className="w-4 h-4" />{t("Actualiser")}
            </button>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-gold-light flex items-center justify-center shrink-0"><Clock className="w-5 h-5 text-gold-accent" /></div>
          <div><p className="text-text-muted text-xs font-inter">{t("En attente")}</p><p className="font-poppins font-bold text-text-primary text-xl">{byStatus.pending.length}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-green-light flex items-center justify-center shrink-0"><ThumbsUp className="w-5 h-5 text-green-primary" /></div>
          <div><p className="text-text-muted text-xs font-inter">{t("Approuvées")}</p><p className="font-poppins font-bold text-text-primary text-xl">{byStatus.approved.length}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center shrink-0"><ThumbsDown className="w-5 h-5 text-error" /></div>
          <div><p className="text-text-muted text-xs font-inter">{t("Rejetées")}</p><p className="font-poppins font-bold text-text-primary text-xl">{byStatus.rejected.length}</p></div>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        {/* max-w-full + overflow-x-auto : à 360px les 3 onglets dépassaient le viewport
            (scrollWidth mesuré 447px) — la rangée défile en interne, pas la page */}
        <div className="flex gap-1 bg-white rounded-xl border border-border-custom p-1 w-fit max-w-full overflow-x-auto scrollbar-hide shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-inter font-medium transition-colors ${tab === t.id ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              <t.icon className="w-4 h-4" />{t.label}
              <span className={`text-xs rounded-full px-1.5 ${tab === t.id ? 'bg-white/20' : 'bg-bg-secondary'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-3 h-11 flex-1 sm:max-w-xs shadow-sm">
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
      {loading ? (
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-8 text-center">
          <p className="text-text-secondary text-sm">{t("Chargement...")}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-bg-secondary flex items-center justify-center mx-auto mb-3">
            <UserCheck className="w-7 h-7 text-text-muted" />
          </div>
          <p className="text-text-secondary font-inter text-sm">
            {query ? 'Aucune candidature ne correspond à cette recherche.' : `Aucune candidature ${tab === 'pending' ? 'en attente' : tab === 'approved' ? 'approuvée' : 'rejetée'}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((app) => {
            const cfg = typeConfig[app.type];
            const Icon = cfg.icon;

            return (
              <div
                key={app.id}
                className="bg-white rounded-2xl border border-border-custom shadow-sm hover:shadow-md transition-shadow p-4 sm:p-5 flex flex-col sm:flex-row gap-4"
              >
                {app.profilePhoto ? (
                  <img
                    src={app.profilePhoto}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-bg-secondary flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-text-secondary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-inter font-semibold text-text-primary text-sm">
                      {app.type === 'restaurant' ? app.restaurantName || 'Restaurant sans nom' : 'Candidature livreur'}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                    {tab !== 'pending' && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${app.status === 'approved' ? 'bg-green-light text-green-primary' : 'bg-error/10 text-error'
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

                  {app.status === 'rejected' && app.rejectionReason && (
                    <p className="bg-error/5 text-error font-inter text-xs rounded-lg px-3 py-2 mb-2">
                      {t("Motif de rejet :")} {app.rejectionReason}
                    </p>
                  )}

                  {/* Vérification documentaire centralisée dans le Centre KYC (source unique). */}
                  <Link
                    to={`/admin/kyc/${app.id}`}
                    className="inline-flex items-center gap-1.5 text-green-primary text-xs font-inter font-medium hover:text-green-dark mb-3"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {t("Vérifier les pièces (KYC)")}
                  </Link>

                  {tab === 'pending' && (
                    <>
                      {app.type === 'restaurant' && (
                        <div className="mb-3 mt-2">
                          <label className="block text-text-muted text-xs mb-1">{t("Lier à un restaurant existant (optionnel)")}</label>
                          <select
                            value={selectedRestaurantByApp[app.id] ?? ''}
                            onChange={(e) => setSelectedRestaurantByApp((p) => ({ ...p, [app.id]: e.target.value }))}
                            className="w-full sm:w-80 bg-bg-secondary rounded-lg px-3 h-10 text-text-primary text-sm outline-none"
                          >
                            <option value="">{t("Créer un nouveau restaurant")}</option>
                            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(app)}
                          disabled={reviewingId === app.id}
                          className="flex items-center gap-1.5 bg-green-primary text-white font-medium text-sm px-4 h-9 rounded-lg hover:bg-green-dark hover:shadow-md transition-all disabled:opacity-60"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {app.type === 'restaurant' && !selectedRestaurantByApp[app.id] ? 'Approuver + créer' : 'Approuver'}
                        </button>
                        <button
                          onClick={() => { setRejectTarget(app); setRejectReason(''); }}
                          disabled={reviewingId === app.id}
                          className="flex items-center gap-1.5 border border-error text-error font-medium text-sm px-4 h-9 rounded-lg hover:bg-error/5 transition-colors disabled:opacity-60"
                        >
                          <X className="w-3.5 h-3.5" />{t("Rejeter")}
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

      {/* Rejection reason dialog */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRejectTarget(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center shrink-0">
                <X className="w-5 h-5 text-error" />
              </div>
              <h3 className="font-poppins font-bold text-text-primary text-lg">{t("Motif de rejet")}</h3>
            </div>
            <p className="text-text-secondary text-sm font-inter mb-4">
              {t("Expliquez pourquoi cette candidature est rejetée (optionnel).")}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none mb-4"
              placeholder="Ex: CNI illisible, documents incomplets..."
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRejectTarget(null)}
                className="px-4 h-10 rounded-lg border border-border-custom text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors"
              >
                {t("Annuler")}
              </button>
              <button
                onClick={() => handleReject(rejectTarget)}
                disabled={reviewingId === rejectTarget.id}
                className="px-4 h-10 rounded-lg bg-error text-white font-inter text-sm font-medium hover:bg-error/90 transition-colors disabled:opacity-60"
              >
                {reviewingId === rejectTarget.id ? 'Rejet...' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
