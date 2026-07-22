import { usePolling } from '../../hooks/usePolling';
import { useState, useCallback, useMemo } from 'react';
import { RefreshCw, UserCheck, Check, X, Store, Bike, Search, Clock, ThumbsUp, ThumbsDown, Phone, MapPin, ChevronDown, ChevronUp, Image, Plus, Loader2 } from 'lucide-react';
import { useRestaurants } from '../../hooks/useCatalog';
import { fetchAllApplications, approveApplication, rejectApplication, type Application, type ApplicationStatus, type ApplicationType } from '../../lib/applications';
import { toast } from 'sonner';
import PageHeader from '../../components/PageHeader';
import { approveAdminApplication, createAdminAccount, rejectAdminApplication } from '../../lib/admin';
import { ADMIN_DEFAULT_PASSWORD } from '../../contexts/AuthContext';
import { displayCameroonPhone, normalizeCameroonPhone } from '../../lib/phone';
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
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [rejectTarget, setRejectTarget] = useState<Application | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [createType, setCreateType] = useState<ApplicationType | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    applicantName: '',
    restaurantName: '',
    contactPhone: '',
    city: 'Douala',
    neighborhood: '',
    address: '',
    notes: '',
    password: ADMIN_DEFAULT_PASSWORD,
  });

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

  const openCreate = (type: ApplicationType) => {
    setCreateType(type);
    setCreateForm({
      applicantName: '',
      restaurantName: '',
      contactPhone: '',
      city: 'Douala',
      neighborhood: '',
      address: '',
      notes: '',
      password: ADMIN_DEFAULT_PASSWORD,
    });
  };

  const updateCreateForm = (key: keyof typeof createForm, value: string) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateAccount = async () => {
    if (!createType) return;
    const contactPhone = normalizeCameroonPhone(createForm.contactPhone);
    if (!contactPhone) {
      toast.error('Le téléphone est requis.');
      return;
    }
    if (createType === 'livreur' && !createForm.applicantName.trim()) {
      toast.error('Le nom du livreur est requis.');
      return;
    }
    if (createType === 'restaurant' && !createForm.restaurantName.trim()) {
      toast.error('Le nom du restaurant est requis.');
      return;
    }

    setCreating(true);
    try {
      const result = await createAdminAccount({
        type: createType,
        applicantName: createForm.applicantName.trim() || createForm.restaurantName.trim(),
        restaurantName: createType === 'restaurant' ? createForm.restaurantName.trim() : undefined,
        contactPhone,
        city: createForm.city.trim() || undefined,
        neighborhood: createForm.neighborhood.trim() || undefined,
        address: createForm.address.trim() || undefined,
        notes: createForm.notes.trim() || undefined,
        password: createForm.password || ADMIN_DEFAULT_PASSWORD,
      });
      if (!result) throw new Error('Création directe disponible uniquement en mode VPS.');
      setCreateType(null);
      await load();
      toast.success(createType === 'restaurant' ? 'Restaurant créé et validé' : 'Livreur créé et validé');
    } catch (err) {
      toast.error((err as Error).message || 'Création impossible');
    } finally {
      setCreating(false);
    }
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
            <button onClick={() => openCreate('livreur')} className="flex items-center gap-1.5 text-white text-sm font-inter bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 backdrop-blur-sm transition-colors">
              <Plus className="w-4 h-4" />{t("Livreur validé")}
            </button>
            <button onClick={() => openCreate('restaurant')} className="flex items-center gap-1.5 text-white text-sm font-inter bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 backdrop-blur-sm transition-colors">
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
            const docsExpanded = expandedDocs[app.id] ?? false;

            const docFields: { label: string; value: string | undefined }[] = [
              { label: "Pièce d'identité", value: app.idDocument },
              { label: 'Photo de profil', value: app.profilePhoto },
              ...(app.type === 'restaurant'
                ? [{ label: 'Registre de commerce', value: app.businessReg }, { label: 'Photo du restaurant', value: app.restaurantPhoto }]
                : [
                  { label: 'Permis de conduire', value: app.licenseDocument },
                  { label: 'Attestation assurance', value: app.insuranceDocument },
                  { label: 'Photo du véhicule', value: app.vehiclePhoto },
                ]),
            ].filter((f) => f.value);

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

                  {docFields.length > 0 ? (
                    <div className="mb-3">
                      <button
                        onClick={() => setExpandedDocs((p) => ({ ...p, [app.id]: !docsExpanded }))}
                        className="flex items-center gap-1.5 text-text-secondary text-xs font-inter font-medium hover:text-text-primary"
                      >
                        {docsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <Image className="w-3.5 h-3.5" />
                        {docFields.length} {t("document")}{docFields.length > 1 ? 's' : ''}
                      </button>
                      {docsExpanded && (
                        <div className="mt-3 flex flex-wrap gap-3">
                          {docFields.map((doc) => (
                            <a
                              key={doc.label}
                              href={doc.value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group block"
                              title={doc.label}
                            >
                              <img
                                src={doc.value}
                                alt={doc.label}
                                className="w-24 h-24 rounded-xl border border-border-custom object-cover shadow-sm group-hover:shadow-md group-hover:ring-2 group-hover:ring-green-primary/30 transition-all"
                              />
                              <span className="text-text-muted text-[10px] font-inter block mt-1 truncate max-w-[96px]">{doc.label}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-text-muted text-xs font-inter italic mb-2">{t("Aucun document fourni")}</p>
                  )}

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

      {/* Création directe admin */}
      {createType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !creating && setCreateType(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-green-light flex items-center justify-center shrink-0">
                {createType === 'restaurant' ? <Store className="w-5 h-5 text-green-primary" /> : <Bike className="w-5 h-5 text-green-primary" />}
              </div>
              <h3 className="font-poppins font-bold text-text-primary text-lg">
                {createType === 'restaurant' ? 'Créer un restaurant validé' : 'Créer un livreur validé'}
              </h3>
            </div>
            <p className="text-text-secondary text-sm font-inter mb-4">
              {t("Le compte est créé avec mot de passe, candidature approuvée, et accès immédiat au tableau de bord.")}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <label className="block sm:col-span-2">
                <span className="block text-text-muted text-xs font-inter mb-1">{createType === 'restaurant' ? 'Nom du responsable' : 'Nom complet'}</span>
                <input value={createForm.applicantName} onChange={(e) => updateCreateForm('applicantName', e.target.value)} className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none" placeholder="Ex: Alain M. Talla" />
              </label>
              {createType === 'restaurant' && (
                <label className="block sm:col-span-2">
                  <span className="block text-text-muted text-xs font-inter mb-1">{t("Nom du restaurant")}</span>
                  <input value={createForm.restaurantName} onChange={(e) => updateCreateForm('restaurantName', e.target.value)} className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none" placeholder="Ex: Saveurs du Mboa" />
                </label>
              )}
              <label className="block">
                <span className="block text-text-muted text-xs font-inter mb-1">{t("Téléphone")}</span>
                <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-11">
                  <span className="text-text-primary font-inter text-sm font-semibold shrink-0">+237</span>
                  <input value={displayCameroonPhone(createForm.contactPhone)} onChange={(e) => updateCreateForm('contactPhone', normalizeCameroonPhone(e.target.value))} className="flex-1 min-w-0 bg-transparent text-text-primary font-inter text-sm outline-none" placeholder="690000000" />
                </div>
              </label>
              <label className="block">
                <span className="block text-text-muted text-xs font-inter mb-1">{t("Mot de passe")}</span>
                <input value={createForm.password} onChange={(e) => updateCreateForm('password', e.target.value)} className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none" placeholder={ADMIN_DEFAULT_PASSWORD} />
              </label>
              <label className="block">
                <span className="block text-text-muted text-xs font-inter mb-1">{t("Ville")}</span>
                <input value={createForm.city} onChange={(e) => updateCreateForm('city', e.target.value)} className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none" placeholder="Douala" />
              </label>
              <label className="block">
                <span className="block text-text-muted text-xs font-inter mb-1">{t("Quartier")}</span>
                <input value={createForm.neighborhood} onChange={(e) => updateCreateForm('neighborhood', e.target.value)} className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none" placeholder="Bonamoussadi" />
              </label>
              <label className="block sm:col-span-2">
                <span className="block text-text-muted text-xs font-inter mb-1">{t("Adresse")}</span>
                <input value={createForm.address} onChange={(e) => updateCreateForm('address', e.target.value)} className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none" placeholder="Adresse opérationnelle" />
              </label>
              <label className="block sm:col-span-2">
                <span className="block text-text-muted text-xs font-inter mb-1">{t("Notes internes")}</span>
                <textarea value={createForm.notes} onChange={(e) => updateCreateForm('notes', e.target.value)} rows={3} className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none" placeholder="Infos utiles pour l'équipe admin" />
              </label>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreateType(null)} disabled={creating} className="px-4 h-10 rounded-lg border border-border-custom text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors disabled:opacity-60">
                {t("Annuler")}
              </button>
              <button onClick={handleCreateAccount} disabled={creating} className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-green-primary text-white font-inter text-sm font-medium hover:bg-green-dark transition-colors disabled:opacity-60">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {t("Créer et valider")}
              </button>
            </div>
          </div>
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
