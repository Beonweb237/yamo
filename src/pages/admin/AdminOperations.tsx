import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Phone, MessageCircle, MapPin, Repeat, CheckCircle2, RotateCcw,
  Clock, Store, User, Bike, CreditCard, Search, RadioTower, ShieldAlert, Volume2, VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../../hooks/useSeo';
import { useOperations } from '../../hooks/useOperations';
import { handleOrder, unhandleOrder, type OpsAlert } from '../../lib/operations';
import { useOpsSound } from '../../hooks/useOpsSound';

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prête', picked_up: 'Récupérée', delivering: 'En livraison', cancelled: 'Annulée',
};

type TFn = (key: string, opts?: Record<string, unknown>) => string;

// Libellé d'alerte construit CÔTÉ CLIENT depuis le code + minutes (traduisible
// par interpolation) ; le `fallback` serveur n'est utilisé que pour un code inconnu.
function codeLabel(t: TFn, code: string, m: number, fallback: string): string {
  switch (code) {
    case 'PENDING_UNCONFIRMED': return t('Non confirmée +{{m}} min', { m });
    case 'CONFIRMED_NOT_PREPARING': return t('Préparation non lancée +{{m}} min', { m });
    case 'PREP_OVERDUE': return t('Préparation en retard +{{m}} min', { m });
    case 'READY_NO_DRIVER': return t('Prête sans livreur +{{m}} min', { m });
    case 'GUARANTEE_UNCONFIRMED': return t('Garantie non validée {{m}} min', { m });
    case 'ASSIGNED_NO_PICKUP': return t('Assigné sans retrait +{{m}} min', { m });
    case 'PICKED_NOT_MOVING': return t('Récupérée, immobile {{m}} min', { m });
    case 'DELIVERING_OVERDUE': return t('Livraison en retard +{{m}} min', { m });
    case 'GPS_SILENT': return m > 0 ? t('GPS silencieux {{m}} min', { m }) : t('GPS jamais reçu');
    case 'INCIDENT': return t('Incident signalé');
    case 'CANCELLED_AFTER_PREP': return t('Annulée après préparation');
    case 'GUARANTEE_DISPUTE': return t('Litige garantie');
    case 'STUCK': return t('Commande figée {{m}} min', { m });
    default: return fallback;
  }
}

// Numéro camerounais → format international pour wa.me (237XXXXXXXXX).
function waNumber(phone: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, '');
  if (!d) return null;
  return d.startsWith('237') ? d : '237' + d;
}

type Filter = 'all' | 'critical' | 'warning' | 'handled';

export default function AdminOperations() {
  const { t } = useTranslation();
  useSeo({ title: t('Centre Opérations'), noindex: true });
  const { data, loading, refreshing, error, lastUpdated, refresh } = useOperations();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { enabled: soundOn, toggle: toggleSound } = useOpsSound(data?.counts.critical ?? 0);

  const alerts = data?.alerts ?? [];
  const counts = data?.counts ?? { critical: 0, warning: 0, handled: 0 };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((a) => {
      if (filter === 'handled' && !a.handledAt) return false;
      if (filter === 'critical' && (a.handledAt || a.topSeverity !== 'critical')) return false;
      if (filter === 'warning' && (a.handledAt || a.topSeverity !== 'warning')) return false;
      if (!q) return true;
      return [a.ref, a.restaurantName, a.customerName, a.neighborhood, a.city, a.driverName]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [alerts, filter, query]);

  const onHandle = async (a: OpsAlert) => {
    setBusy(a.orderId);
    try {
      if (a.handledAt) { await unhandleOrder(a.orderId); toast.success(t('Prise en charge annulée')); }
      else { await handleOrder(a.orderId); toast.success(t('Marquée « prise en charge »')); }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Action impossible'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px]">
      {/* En-tête */}
      <div className="flex flex-wrap items-start gap-3 mb-6">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-green-primary/10 grid place-items-center shrink-0">
            <RadioTower className="w-6 h-6 text-green-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-poppins font-bold text-text-primary text-xl sm:text-2xl leading-tight">
              {t('Centre Opérations')}
            </h1>
            <p className="text-text-muted text-xs sm:text-sm mt-0.5">
              {t('Commandes en état anormal — intervenez avant que le client ne s\'inquiète.')}
              {lastUpdated && (
                <span className="hidden sm:inline"> · {t('MàJ')} {lastUpdated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="flex items-center gap-1.5 h-10 px-3 rounded-xl border border-border-custom bg-white text-text-secondary hover:bg-bg-secondary transition-colors text-sm font-medium"
            aria-label={soundOn ? t('Couper le son des alertes') : t('Activer le son des alertes')}
            aria-pressed={soundOn}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-green-primary" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{t('Son')}</span>
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-green-primary text-white font-semibold text-sm hover:bg-green-dark transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('Actualiser')}</span>
          </button>
        </div>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
        <KpiCard tone="crit" value={counts.critical} label={t('Critiques')} active={filter === 'critical'}
          onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')} />
        <KpiCard tone="warn" value={counts.warning} label={t('À surveiller')} active={filter === 'warning'}
          onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')} />
        <KpiCard tone="ok" value={counts.handled} label={t('Pris en charge')} active={filter === 'handled'}
          onClick={() => setFilter(filter === 'handled' ? 'all' : 'handled')} />
      </div>

      {/* Recherche + filtre */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex-1 min-w-[200px] h-10 rounded-xl border border-border-custom bg-white flex items-center gap-2 px-3">
          <Search className="w-4 h-4 text-text-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Rechercher réf, resto, client, quartier…')}
            className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted min-w-0"
            aria-label={t('Rechercher une alerte')}
          />
        </div>
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')}
            className="h-10 px-3 rounded-xl border border-green-primary bg-green-primary/5 text-green-dark text-sm font-medium">
            {t('Filtre actif')} · {t('Tout afficher')}
          </button>
        )}
      </div>

      {/* États */}
      {loading ? (
        <SkeletonList />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : filtered.length === 0 ? (
        <EmptyState allClear={alerts.length === 0} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((a) => (
            <AlertCard key={a.orderId} a={a} busy={busy === a.orderId} onHandle={() => onHandle(a)} />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ tone, value, label, active, onClick }: {
  tone: 'crit' | 'warn' | 'ok'; value: number; label: string; active: boolean; onClick: () => void;
}) {
  const tones = {
    crit: { dot: 'bg-red-100 text-red-600', ring: 'border-red-300', num: 'text-red-600' },
    warn: { dot: 'bg-amber-100 text-amber-600', ring: 'border-amber-300', num: 'text-amber-600' },
    ok: { dot: 'bg-green-primary/10 text-green-primary', ring: 'border-green-primary/40', num: 'text-green-primary' },
  }[tone];
  const emoji = tone === 'crit' ? '🔴' : tone === 'warn' ? '🟠' : '✅';
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-2xl border p-3 sm:p-4 flex items-center gap-3 text-left transition-colors ${active ? tones.ring + ' border-2' : 'border-border-custom hover:border-text-muted/40'}`}
      aria-pressed={active}
    >
      <span className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl grid place-items-center text-lg shrink-0 ${tones.dot}`}>{emoji}</span>
      <span className="min-w-0">
        <span className={`block font-poppins font-bold text-xl sm:text-2xl leading-none ${tones.num}`}>{value}</span>
        <span className="block text-text-muted text-xs sm:text-[13px] mt-1 truncate">{label}</span>
      </span>
    </button>
  );
}

function AlertCard({ a, busy, onHandle }: { a: OpsAlert; busy: boolean; onHandle: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const crit = a.topSeverity === 'critical';
  const handled = !!a.handledAt;
  const wa = waNumber(a.customerPhone);

  return (
    <div className={`bg-white rounded-2xl border border-border-custom overflow-hidden grid grid-cols-[5px_1fr] ${handled ? 'opacity-75' : ''}`}>
      <div className={handled ? 'bg-gray-300' : crit ? 'bg-red-500' : 'bg-amber-500'} />
      <div className="p-3.5 sm:p-4 min-w-0">
        {/* Ligne 1 : réf, statut, chrono */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-poppins font-semibold text-text-primary text-[15px]">{a.ref}</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-bg-secondary text-text-secondary">
            {t(STATUS_LABELS[a.status] || a.status)}
          </span>
          <span className={`ml-auto inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${handled ? 'text-text-muted' : crit ? 'text-red-600' : 'text-amber-600'}`}>
            <Clock className="w-3.5 h-3.5" /> {a.waitingMinutes} {t('min')}
          </span>
        </div>

        {/* Métadonnées */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 mb-3 text-[12.5px] text-text-muted">
          <span className="inline-flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /><b className="text-text-primary font-semibold">{a.restaurantName || '—'}</b></span>
          <span className="inline-flex items-center gap-1.5"><User className="w-3.5 h-3.5" /><b className="text-text-primary font-semibold">{a.customerName || t('Client')}</b>{(a.neighborhood || a.city) && <span>· {[a.neighborhood, a.city].filter(Boolean).join(', ')}</span>}</span>
          <span className="inline-flex items-center gap-1.5"><Bike className="w-3.5 h-3.5" />{a.driverName || t('Aucun livreur')}</span>
          <span className="inline-flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /><b className="text-text-primary font-semibold">{a.total.toLocaleString()} {t('FCFA')}</b></span>
        </div>

        {/* Badges d'alerte */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {a.codes.map((c) => (
            <span key={c.code}
              className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-lg ${c.severity === 'critical' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
              {c.severity === 'critical' ? '🔴' : '🟠'} {codeLabel(t, c.code, c.minutes, c.label)}
            </span>
          ))}
          {!a.hasLiveGps && (a.status === 'picked_up' || a.status === 'delivering') && (
            <span className="text-[11.5px] font-medium px-2.5 py-1 rounded-lg bg-bg-secondary text-text-muted">{t('GPS hors ligne')}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {a.restaurantPhone && (
            <a href={`tel:${a.restaurantPhone}`} className={btn()}><Phone className="w-3.5 h-3.5" /> {t('Resto')}</a>
          )}
          {a.driverPhone && (
            <a href={`tel:${a.driverPhone}`} className={btn()}><Phone className="w-3.5 h-3.5" /> {t('Livreur')}</a>
          )}
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={btn()}><MessageCircle className="w-3.5 h-3.5" /> {t('Client')}</a>
          )}
          <button onClick={() => navigate(`/admin/orders?focus=${a.orderId}`)} className={btn()}>
            <MapPin className="w-3.5 h-3.5" /> {t('Suivi')}
          </button>
          {(a.status === 'ready' || a.status === 'confirmed' || a.status === 'preparing' || !a.driverId) && (
            <button onClick={() => navigate(`/admin/orders?focus=${a.orderId}`)} className={btn()}>
              <Repeat className="w-3.5 h-3.5" /> {t('Réassigner')}
            </button>
          )}
          <button
            onClick={onHandle}
            disabled={busy}
            className={handled
              ? `${btn()} disabled:opacity-60`
              : 'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gold-accent text-[#3D2E00] text-[12.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60'}
          >
            {handled ? <><RotateCcw className="w-3.5 h-3.5" /> {t('Rouvrir')}</> : <><CheckCircle2 className="w-3.5 h-3.5" /> {t('Pris en charge')}</>}
          </button>
        </div>

        {/* Trace prise en charge */}
        {handled && (
          <div className="mt-3 pt-3 border-t border-dashed border-border-custom text-[12px] font-medium text-green-dark flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {t('Pris en charge par')} {a.handledByName || t('un dispatcher')}
              {a.handledAt && ` · ${new Date(a.handledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
              {a.handledNote && <> — « {a.handledNote} »</>}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function btn() {
  return 'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border-custom bg-white text-text-primary text-[12.5px] font-medium hover:bg-bg-secondary transition-colors';
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Chargement">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-border-custom p-4 animate-pulse">
          <div className="h-4 w-40 bg-bg-secondary rounded mb-3" />
          <div className="h-3 w-3/4 bg-bg-secondary rounded mb-2" />
          <div className="h-6 w-2/3 bg-bg-secondary rounded mb-3" />
          <div className="flex gap-2"><div className="h-8 w-20 bg-bg-secondary rounded-lg" /><div className="h-8 w-20 bg-bg-secondary rounded-lg" /></div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
      <ShieldAlert className="w-10 h-10 text-red-500 mx-auto mb-3" />
      <p className="font-poppins font-semibold text-text-primary mb-1">{t('Impossible de charger les alertes')}</p>
      <p className="text-text-muted text-sm mb-4">{message}</p>
      <button onClick={onRetry} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-green-primary text-white font-semibold text-sm hover:bg-green-dark transition-colors">
        <RefreshCw className="w-4 h-4" /> {t('Réessayer')}
      </button>
    </div>
  );
}

function EmptyState({ allClear }: { allClear: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-2xl border border-border-custom p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-green-primary/10 grid place-items-center mx-auto mb-3">
        <CheckCircle2 className="w-8 h-8 text-green-primary" />
      </div>
      <p className="font-poppins font-semibold text-text-primary mb-1">
        {allClear ? t('Tout va bien') : t('Aucune alerte pour ce filtre')}
      </p>
      <p className="text-text-muted text-sm">
        {allClear ? t('Aucune commande en anomalie. La tour de contrôle veille.') : t('Ajustez le filtre ou la recherche pour voir d\'autres alertes.')}
      </p>
    </div>
  );
}
