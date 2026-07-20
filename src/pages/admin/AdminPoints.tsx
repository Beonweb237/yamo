// Série PTS — back-office des points restaurant : validation des recharges
// (phase 1 manuelle), soldes/caution, ajustements tracés, ledger consultable.
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Coins, Check, X, RefreshCw, Search, TrendingUp, AlertCircle, ScrollText, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { usePolling } from '../../hooks/usePolling';
import { useRestaurants } from '../../hooks/useCatalog';
import { useAuth } from '../../contexts/AuthContext';
import PageHeader from '../../components/PageHeader';
import { Skeleton } from '../../components/ui/skeleton';
import {
  listRecharges,
  decideRecharge,
  fetchAllBalances,
  fetchLedger,
  fetchGlobalLedger,
  adminAdjust,
  grantPromoBulk,
  type RechargeRequest,
  type PointsBalance,
  type PointsLedgerEntry,
  type RechargeStatus,
} from '../../lib/points';
import { POINTS_CONFIG } from '../../data/launchConfig';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { useTranslation } from "react-i18next";

// Historique complet des recharges (composant dédié — filtre par statut).
const RECHARGE_STATUS_META: Record<RechargeStatus, { label: string; badge: string }> = {
  pending: { label: 'En attente', badge: 'bg-gold-light text-amber-700' },
  validated: { label: 'Validée', badge: 'bg-green-light text-green-primary' },
  rejected: { label: 'Rejetée', badge: 'bg-error/10 text-error' },
};

function RechargeHistory({
  recharges, loading, nameOf,
}: {
  recharges: RechargeRequest[];
  loading: boolean;
  nameOf: (id: string) => string;
}) {
    const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<RechargeStatus | 'all'>('all');
  const [limit, setLimit] = useState(10);
  const visible = recharges.filter((r) => statusFilter === 'all' || r.status === statusFilter);

  return (
    <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-poppins font-semibold text-text-primary text-lg">
          {t("Historique des recharges (")}{visible.length})
        </h2>
        <div className="flex gap-1 bg-bg-secondary rounded-lg p-1 max-w-full overflow-x-auto scrollbar-hide">
          {([['all', 'Toutes'], ['pending', 'En attente'], ['validated', 'Validées'], ['rejected', 'Rejetées']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setStatusFilter(id); setLimit(10); }}
              className={`shrink-0 px-3 py-2 rounded-md text-xs font-inter font-semibold transition-colors ${statusFilter === id ? 'bg-white text-green-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : visible.length === 0 ? (
        <p className="text-text-secondary font-inter text-sm">
          {statusFilter === 'all' ? 'Aucune demande de recharge pour le moment.' : 'Aucune demande dans ce statut.'}
        </p>
      ) : (
        <>
          <div className="divide-y divide-border-light">
            {visible.slice(0, limit).map((request) => (
              <div key={request.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-inter text-sm text-text-primary">
                    <span className="font-semibold">{nameOf(request.restaurantId)}</span>
                    {' '}· +{request.points} {t("pts (")}{request.amountFcfa.toLocaleString()} {t("FCFA)")}
                    {' '}· {request.method === 'momo' ? 'Mobile Money' : 'Cash partenaire'}
                    {' '}{t("· réf.")} <span className="font-semibold">{request.paymentRef}</span>
                  </p>
                  <p className="text-text-muted text-[11px] font-inter">
                    {t("Demandée le")} {new Date(request.requestedAt).toLocaleString('fr-FR')}
                    {request.decidedAt && ` · décidée le ${new Date(request.decidedAt).toLocaleString('fr-FR')}${request.decidedBy ? ` par ${String(request.decidedBy).slice(0, 12)}` : ''}`}
                  </p>
                  {request.rejectionReason && (
                    <p className="text-error text-[11px] font-inter mt-0.5">{t("Motif du rejet :")} {request.rejectionReason}</p>
                  )}
                </div>
                <span className={`shrink-0 text-xs font-inter font-medium px-2.5 py-1 rounded-full ${RECHARGE_STATUS_META[request.status].badge}`}>
                  {RECHARGE_STATUS_META[request.status].label}
                </span>
              </div>
            ))}
          </div>
          {visible.length > limit && (
            <button onClick={() => setLimit((n) => n + 15)} className="w-full text-green-primary font-inter text-sm font-medium hover:underline min-h-11">
              {t("Voir plus (")}{visible.length - limit} {t("restantes)")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

export default function AdminPoints() {
    const { t } = useTranslation();
  const { user } = useAuth();
  const { restaurants } = useRestaurants();
  const [recharges, setRecharges] = useState<RechargeRequest[]>([]);
  const [balances, setBalances] = useState<Record<string, PointsBalance>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const restaurantNameById = useMemo(
    () => Object.fromEntries(restaurants.map((r) => [r.id, r.name])),
    [restaurants]
  );
  const nameOf = (id: string) => restaurantNameById[id] ?? `Resto ${id.slice(0, 8)}`;

  const [globalLedger, setGlobalLedger] = useState<PointsLedgerEntry[]>([]);

  const load = useCallback(async () => {
    setRecharges(await listRecharges());
    setBalances(await fetchAllBalances());
    setGlobalLedger(await fetchGlobalLedger({ limit: 30 }));
    setLoading(false);
  }, []);
  usePolling(load, 30000);
  useEffect(() => {
    // Chargement immédiat, différé d'un tick (pas de setState synchrone dans
    // le corps de l'effet — même motif que Orders.tsx / DishResults).
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const pending = recharges.filter((r) => r.status === 'pending');

  // ── Rejet de recharge (motif obligatoire) ──
  const [rejectTarget, setRejectTarget] = useState<RechargeRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deciding, setDeciding] = useState<string | null>(null);

  const handleValidate = async (request: RechargeRequest) => {
    if (!user) return;
    setDeciding(request.id);
    try {
      await decideRecharge(request.id, 'validate', user.id);
      toast.success(`Recharge validée — +${request.points} pts pour ${nameOf(request.restaurantId)}.`);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeciding(null);
    }
  };

  const handleReject = async () => {
    if (!user || !rejectTarget || !rejectReason.trim()) return;
    setDeciding(rejectTarget.id);
    try {
      await decideRecharge(rejectTarget.id, 'reject', user.id, rejectReason);
      toast.success('Recharge rejetée.');
      setRejectTarget(null);
      setRejectReason('');
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeciding(null);
    }
  };

  // ── Ajustement manuel (motif obligatoire, confirmation) ──
  const [adjustTarget, setAdjustTarget] = useState<string | null>(null);
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const handleAdjust = async () => {
    if (!user || !adjustTarget) return;
    const pts = parseInt(adjustPoints, 10);
    if (!pts || !adjustNote.trim()) return;
    setAdjusting(true);
    try {
      await adminAdjust(adjustTarget, pts, user.id, adjustNote);
      toast.success(`Ajustement appliqué : ${pts > 0 ? '+' : ''}${pts} pts pour ${nameOf(adjustTarget)}.`);
      setAdjustTarget(null);
      setAdjustPoints('');
      setAdjustNote('');
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdjusting(false);
    }
  };

  // ── Dotation promotionnelle en masse (lancement) ──
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoPoints, setPromoPoints] = useState('10');
  const [promoCampaign, setPromoCampaign] = useState('lancement-2026');
  const [promoNote, setPromoNote] = useState('Points offerts — lancement MiamExpress');
  const [promoGranting, setPromoGranting] = useState(false);

  const handlePromoGrant = async () => {
    if (!user) return;
    const pts = parseInt(promoPoints, 10);
    if (!pts || pts <= 0 || !promoCampaign.trim() || restaurants.length === 0) return;
    setPromoGranting(true);
    try {
      const result = await grantPromoBulk(
        restaurants.map((r) => r.id),
        pts,
        promoCampaign,
        promoNote,
        user.id
      );
      toast.success(
        `Dotation « ${promoCampaign.trim()} » : ${result.granted} resto${result.granted > 1 ? 's' : ''} crédité${result.granted > 1 ? 's' : ''} de ${pts} pts` +
        (result.alreadyGranted > 0 ? ` (${result.alreadyGranted} déjà servi${result.alreadyGranted > 1 ? 's' : ''} — ignorés)` : '')
      );
      setPromoOpen(false);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPromoGranting(false);
    }
  };

  // ── Ledger d'un resto (Dialog paginé) ──
  const [ledgerTarget, setLedgerTarget] = useState<string | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<PointsLedgerEntry[]>([]);
  const [ledgerLimit, setLedgerLimit] = useState(15);

  useEffect(() => {
    if (!ledgerTarget) return;
    const t = setTimeout(() => {
      void fetchLedger(ledgerTarget, { limit: 200 }).then(setLedgerEntries);
    }, 0);
    return () => clearTimeout(t);
  }, [ledgerTarget]);

  // ── Stats ──
  const balanceRows = Object.entries(balances)
    .map(([restaurantId, balance]) => ({ restaurantId, name: nameOf(restaurantId), ...balance }))
    .filter((row) => row.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.available - b.available);
  const totalCirculating = Object.values(balances).reduce((s, b) => s + b.available + b.held, 0);
  const monthRevenue = recharges
    .filter((r) => r.status === 'validated' && r.decidedAt && new Date(r.decidedAt).getMonth() === new Date().getMonth())
    .reduce((s, r) => s + r.amountFcfa, 0);
  const lowCount = Object.values(balances).filter((b) => b.available < POINTS_CONFIG.LOW_BALANCE_THRESHOLD_POINTS).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        icon={Coins}
        title="Points restaurants"
        subtitle={`${pending.length} recharge${pending.length !== 1 ? 's' : ''} en attente de validation`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setPromoOpen(true)} className="flex items-center gap-1.5 text-white text-sm font-inter bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 backdrop-blur-sm transition-colors">
              <Gift className="w-4 h-4" />{t("Offrir des points")}
            </button>
            <button onClick={load} className="flex items-center gap-1.5 text-white text-sm font-inter bg-white/15 hover:bg-white/25 rounded-lg px-3 py-2 backdrop-blur-sm transition-colors">
              <RefreshCw className="w-4 h-4" />{t("Actualiser")}
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-light flex items-center justify-center shrink-0"><Coins className="w-5 h-5 text-green-primary" /></div>
          <div><p className="text-text-muted text-xs font-inter">{t("Points en circulation")}</p><p className="font-poppins font-bold text-text-primary text-xl">{totalCirculating}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-light flex items-center justify-center shrink-0"><TrendingUp className="w-5 h-5 text-green-primary" /></div>
          <div><p className="text-text-muted text-xs font-inter">{t("CA recharges (mois)")}</p><p className="font-poppins font-bold text-text-primary text-xl">{monthRevenue.toLocaleString()} F</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold-light flex items-center justify-center shrink-0"><AlertCircle className="w-5 h-5 text-gold-accent" /></div>
          <div><p className="text-text-muted text-xs font-inter">{t("Restos sous le seuil")}</p><p className="font-poppins font-bold text-text-primary text-xl">{lowCount}</p></div>
        </div>
      </div>

      {/* File des recharges en attente */}
      <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 mb-6">
        <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">
          {t("Recharges à valider (")}{pending.length})
        </h2>
        {loading ? (
          <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : pending.length === 0 ? (
          <p className="text-text-secondary font-inter text-sm">{t("Aucune recharge en attente.")}</p>
        ) : (
          <div className="divide-y divide-border-light">
            {pending.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-inter font-semibold text-sm text-text-primary">
                    {nameOf(request.restaurantId)}
                    <span className="ml-2 font-normal text-text-secondary">
                      +{request.points} {t("pts ·")} {request.amountFcfa.toLocaleString()} {t("FCFA")}
                    </span>
                  </p>
                  <p className="text-xs text-text-muted font-inter">
                    {t("Réf.")} <span className="font-semibold text-text-primary">{request.paymentRef}</span>
                    {' '}· {request.method === 'momo' ? 'Mobile Money' : 'Cash partenaire'} · {timeAgo(request.requestedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleValidate(request)}
                    disabled={deciding === request.id}
                    className="flex items-center gap-1 bg-green-primary hover:bg-green-dark text-white font-inter font-medium text-xs px-3 min-h-11 rounded-lg transition-colors disabled:opacity-60"
                  >
                    <Check className="w-3.5 h-3.5" />{t("Valider")}
                  </button>
                  <button
                    onClick={() => { setRejectReason(''); setRejectTarget(request); }}
                    disabled={deciding === request.id}
                    className="flex items-center gap-1 border border-error text-error font-inter font-medium text-xs px-3 min-h-11 rounded-lg hover:bg-error/5 transition-colors disabled:opacity-60"
                  >
                    <X className="w-3.5 h-3.5" />{t("Rejeter")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historique des recharges — TOUTES les demandes, avec décideur et motif */}
      <RechargeHistory recharges={recharges} loading={loading} nameOf={nameOf} />

      {/* Derniers mouvements — flux global du ledger, tous restos confondus */}
      <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 mb-6">
        <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">
          {t("Derniers mouvements de points")}
        </h2>
        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : globalLedger.length === 0 ? (
          <p className="text-text-secondary font-inter text-sm">{t("Aucun mouvement pour le moment.")}</p>
        ) : (
          <ul className="divide-y divide-border-light">
            {globalLedger.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-inter text-text-primary truncate">
                    <span className="font-semibold">{nameOf(entry.restaurantId)}</span>
                    {' '}— {entry.note ?? entry.kind}
                  </p>
                  <p className="text-text-muted text-[11px] font-inter">
                    {new Date(entry.createdAt).toLocaleString('fr-FR')} · {entry.kind}
                    {entry.createdBy !== 'system' && ` · par ${String(entry.createdBy).slice(0, 12)}`}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-inter font-semibold ${entry.points < 0 ? 'text-error' : entry.points > 0 ? 'text-green-primary' : 'text-text-muted'}`}>
                  {entry.points > 0 ? '+' : ''}{entry.points} {t("pt")}{Math.abs(entry.points) > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Soldes */}
      <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-poppins font-semibold text-text-primary text-lg">{t("Soldes par restaurant")}</h2>
          <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-3 h-11 w-full sm:w-64">
            <Search className="w-4 h-4 text-text-muted shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un resto..."
              className="flex-1 min-w-0 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
            />
          </div>
        </div>
        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : balanceRows.length === 0 ? (
          <p className="text-text-secondary font-inter text-sm">
            {query ? 'Aucun restaurant ne correspond.' : 'Aucun compte de points pour le moment.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-inter">
              <thead>
                <tr className="text-left text-text-muted text-xs">
                  <th className="pb-2 pr-4">{t("Restaurant")}</th>
                  <th className="pb-2 pr-4">{t("Disponible")}</th>
                  <th className="pb-2 pr-4">{t("Réservés")}</th>
                  <th className="pb-2">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {balanceRows.map((row) => (
                  <tr key={row.restaurantId}>
                    <td className="py-2.5 pr-4 font-medium text-text-primary">{row.name}</td>
                    <td className={`py-2.5 pr-4 font-semibold ${row.available < POINTS_CONFIG.LOW_BALANCE_THRESHOLD_POINTS ? 'text-error' : 'text-text-primary'}`}>
                      {row.available} {t("pts")}
                      {row.available < POINTS_CONFIG.LOW_BALANCE_THRESHOLD_POINTS && (
                        <span className="ml-1.5 text-[10px] font-bold text-error bg-error/10 px-1.5 py-0.5 rounded-full">{t("BAS")}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-text-secondary">{row.held} {t("pts")}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setLedgerLimit(15); setLedgerTarget(row.restaurantId); }}
                          className="flex items-center gap-1 text-green-primary font-medium text-xs px-2 min-h-11 rounded-lg hover:bg-green-light transition-colors"
                        >
                          <ScrollText className="w-3.5 h-3.5" />{t("Ledger")}
                        </button>
                        <button
                          onClick={() => { setAdjustPoints(''); setAdjustNote(''); setAdjustTarget(row.restaurantId); }}
                          className="text-text-secondary font-medium text-xs px-2 min-h-11 rounded-lg hover:bg-bg-secondary transition-colors"
                        >
                          {t("Ajuster")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog dotation promotionnelle en masse */}
      <Dialog open={promoOpen} onOpenChange={(open) => { if (!open) setPromoOpen(false); }}>
        <DialogContent className="sm:max-w-[440px] max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-poppins">{t("Offrir des points en masse")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-text-secondary text-sm font-inter">
              {t("Crédite")} <span className="font-semibold text-text-primary">{t("tous les restaurants du catalogue\n              (")}{restaurants.length})</span> {t("en une fois. Une campagne ne peut servir chaque resto\n              qu&apos;une seule fois : relancer la même campagne ignore les restos déjà crédités\n              (aucun double-crédit possible).")}
            </p>
            <div>
              <label htmlFor="promo-points" className="block text-sm font-inter font-medium text-text-primary mb-1">{t("Points offerts par restaurant")}</label>
              <input
                id="promo-points"
                type="number"
                min={1}
                value={promoPoints}
                onChange={(e) => setPromoPoints(e.target.value)}
                className="w-full bg-white rounded-lg border border-border-custom px-3 h-11 text-sm font-inter outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
              />
            </div>
            <div>
              <label htmlFor="promo-campaign" className="block text-sm font-inter font-medium text-text-primary mb-1">{t("Identifiant de campagne")}</label>
              <input
                id="promo-campaign"
                type="text"
                value={promoCampaign}
                onChange={(e) => setPromoCampaign(e.target.value)}
                placeholder="Ex. lancement-2026"
                className="w-full bg-white rounded-lg border border-border-custom px-3 h-11 text-sm font-inter outline-none placeholder:text-text-muted focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
              />
              <p className="text-[11px] text-text-muted font-inter mt-1">
                {t("C&apos;est lui qui garantit « une seule fois par resto ». Changez-le pour une nouvelle vague.")}
              </p>
            </div>
            <div>
              <label htmlFor="promo-note" className="block text-sm font-inter font-medium text-text-primary mb-1">{t("Libellé (visible au ledger des restos)")}</label>
              <input
                id="promo-note"
                type="text"
                value={promoNote}
                onChange={(e) => setPromoNote(e.target.value)}
                className="w-full bg-white rounded-lg border border-border-custom px-3 h-11 text-sm font-inter outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
              />
            </div>
            <p className="bg-gold-light text-amber-700 rounded-lg px-3 py-2 text-xs font-inter">
              {t("Total offert :")} <span className="font-semibold">{((parseInt(promoPoints, 10) || 0) * restaurants.length).toLocaleString()} {t("points")}</span>
              {' '}{t("(valeur")} {(((parseInt(promoPoints, 10) || 0) * restaurants.length) * POINTS_CONFIG.POINT_PRICE_FCFA).toLocaleString()} {t("FCFA).")}
            </p>
          </div>
          <DialogFooter>
            <button onClick={() => setPromoOpen(false)} className="px-4 h-11 rounded-lg text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors">{t("Annuler")}</button>
            <button
              onClick={handlePromoGrant}
              disabled={promoGranting || !(parseInt(promoPoints, 10) > 0) || !promoCampaign.trim() || restaurants.length === 0}
              className="px-5 h-11 rounded-lg bg-green-primary text-white font-inter font-medium text-sm hover:bg-green-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {promoGranting ? 'Dotation en cours...' : `Offrir à ${restaurants.length} resto${restaurants.length > 1 ? 's' : ''}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog rejet (motif obligatoire) */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-poppins">{t("Rejeter la recharge")} {rejectTarget?.paymentRef} ?</DialogTitle>
          </DialogHeader>
          <p className="text-text-secondary text-sm font-inter">
            {rejectTarget && `${nameOf(rejectTarget.restaurantId)} — ${rejectTarget.points} pts (${rejectTarget.amountFcfa.toLocaleString()} FCFA).`}
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motif du rejet (obligatoire — ex. dépôt introuvable)"
            rows={2}
            className="w-full bg-white rounded-lg border border-border-custom px-3 py-2 text-sm font-inter outline-none placeholder:text-text-muted focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all resize-none"
          />
          <DialogFooter>
            <button onClick={() => setRejectTarget(null)} className="px-4 h-11 rounded-lg text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors">{t("Annuler")}</button>
            <button
              onClick={handleReject}
              disabled={!rejectReason.trim() || deciding === rejectTarget?.id}
              className="px-5 h-11 rounded-lg bg-error text-white font-inter font-medium text-sm hover:bg-error/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("Rejeter")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ajustement (motif obligatoire) */}
      <Dialog open={!!adjustTarget} onOpenChange={(open) => { if (!open) setAdjustTarget(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-poppins">{t("Ajuster les points —")} {adjustTarget && nameOf(adjustTarget)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              type="number"
              value={adjustPoints}
              onChange={(e) => setAdjustPoints(e.target.value)}
              placeholder="Points (négatif pour retirer, ex. -2)"
              className="w-full bg-white rounded-lg border border-border-custom px-3 h-11 text-sm font-inter outline-none placeholder:text-text-muted focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
            />
            <textarea
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="Motif (obligatoire — tracé au ledger)"
              rows={2}
              className="w-full bg-white rounded-lg border border-border-custom px-3 py-2 text-sm font-inter outline-none placeholder:text-text-muted focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all resize-none"
            />
          </div>
          <DialogFooter>
            <button onClick={() => setAdjustTarget(null)} className="px-4 h-11 rounded-lg text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors">{t("Annuler")}</button>
            <button
              onClick={handleAdjust}
              disabled={adjusting || !parseInt(adjustPoints, 10) || !adjustNote.trim()}
              className="px-5 h-11 rounded-lg bg-green-primary text-white font-inter font-medium text-sm hover:bg-green-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adjusting ? 'Application...' : 'Appliquer'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ledger */}
      <Dialog open={!!ledgerTarget} onOpenChange={(open) => { if (!open) { setLedgerTarget(null); setLedgerEntries([]); } }}>
        <DialogContent className="sm:max-w-[520px] max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-poppins">{t("Ledger —")} {ledgerTarget && nameOf(ledgerTarget)}</DialogTitle>
          </DialogHeader>
          {ledgerEntries.length === 0 ? (
            <p className="text-text-secondary font-inter text-sm py-4 text-center">{t("Aucune écriture.")}</p>
          ) : (
            <>
              <ul className="divide-y divide-border-light">
                {ledgerEntries.slice(0, ledgerLimit).map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-inter text-text-primary">{entry.note ?? entry.kind}</p>
                      <p className="text-text-muted text-[11px] font-inter">
                        {new Date(entry.createdAt).toLocaleString('fr-FR')} · {entry.kind} {t("· réf.")} {entry.reference.slice(0, 12)}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-inter font-semibold ${entry.points < 0 ? 'text-error' : entry.points > 0 ? 'text-green-primary' : 'text-text-muted'}`}>
                      {entry.points > 0 ? '+' : ''}{entry.points} {t("pt")}{Math.abs(entry.points) > 1 ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {ledgerEntries.length > ledgerLimit && (
                <button onClick={() => setLedgerLimit((n) => n + 20)} className="w-full text-green-primary font-inter text-sm font-medium hover:underline min-h-11">
                  {t("Voir plus (")}{ledgerEntries.length - ledgerLimit} {t("restantes)")}
                </button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
