import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Search, RefreshCw, Store, Bike, ChevronRight, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../../hooks/useSeo';
import { fetchKycList, KYC_STATUS_LABELS, type KycListItem, type KycListResponse, type KycDossierStatus } from '../../lib/kyc';

const STATUS_STYLE: Record<KycDossierStatus, string> = {
  incomplet: 'bg-bg-secondary text-text-muted',
  a_verifier: 'bg-amber-50 text-amber-700',
  verifie: 'bg-green-light text-green-primary',
  rejete: 'bg-red-50 text-red-700',
};

export default function AdminKyc() {
  const { t } = useTranslation();
  useSeo({ title: t('Centre KYC'), noindex: true });
  const [data, setData] = useState<KycListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<KycDossierStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  const load = () => {
    setLoading(true);
    fetchKycList()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const dossiers = data?.dossiers ?? [];
  const counts = data?.counts ?? { incomplet: 0, a_verifier: 0, verifie: 0, rejete: 0 };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dossiers.filter((d) => {
      if (filter !== 'all' && d.kycStatus !== filter) return false;
      if (!q) return true;
      return [d.name, d.restaurantName, d.phone, d.city, d.neighborhood].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [dossiers, filter, query]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1100px]">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-green-primary/10 grid place-items-center shrink-0">
          <ShieldCheck className="w-6 h-6 text-green-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-poppins font-bold text-text-primary text-xl sm:text-2xl leading-tight">{t('Centre KYC')}</h1>
          <p className="text-text-muted text-xs sm:text-sm mt-0.5">{t('Vérification des dossiers restaurants et livreurs, pièce par pièce.')}</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 h-10 px-3 rounded-xl border border-border-custom bg-white text-text-secondary hover:bg-bg-secondary transition-colors text-sm font-medium disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">{t('Actualiser')}</span>
        </button>
      </div>

      {/* Compteurs / filtres */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {(['a_verifier', 'verifie', 'rejete', 'incomplet'] as KycDossierStatus[]).map((s) => (
          <button key={s} onClick={() => setFilter(filter === s ? 'all' : s)}
            className={`bg-white rounded-2xl border p-3 sm:p-4 text-left transition-colors ${filter === s ? 'border-green-primary border-2' : 'border-border-custom hover:border-text-muted/40'}`}
            aria-pressed={filter === s}>
            <span className="font-poppins font-bold text-xl sm:text-2xl text-text-primary block leading-none">{counts[s] ?? 0}</span>
            <span className="text-text-muted text-xs sm:text-[13px] mt-1 block">{t(KYC_STATUS_LABELS[s])}</span>
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="h-10 rounded-xl border border-border-custom bg-white flex items-center gap-2 px-3 mb-5">
        <Search className="w-4 h-4 text-text-muted shrink-0" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Rechercher un nom, téléphone, ville…')}
          className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted min-w-0" aria-label={t('Rechercher un dossier')} />
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} className="text-xs text-green-dark font-medium shrink-0">{t('Tout afficher')}</button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 bg-white rounded-xl border border-border-custom animate-pulse" />)}</div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
          <p className="font-poppins font-semibold text-text-primary mb-1">{t('Impossible de charger les dossiers')}</p>
          <p className="text-text-muted text-sm mb-4">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-green-primary text-white font-semibold text-sm">{t('Réessayer')}</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border-custom p-10 text-center">
          <FileText className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="font-poppins font-semibold text-text-primary">{t('Aucun dossier')}</p>
          <p className="text-text-muted text-sm">{t('Aucun profil ne correspond à ce filtre.')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((d) => <KycRow key={d.applicationId} d={d} t={t} />)}
        </div>
      )}
    </div>
  );
}

function KycRow({ d, t }: { d: KycListItem; t: (k: string) => string }) {
  const Icon = d.type === 'restaurant' ? Store : Bike;
  const title = d.type === 'restaurant' ? (d.restaurantName || d.name) : d.name;
  return (
    <Link to={`/admin/kyc/${d.applicationId}`}
      className="bg-white rounded-xl border border-border-custom p-3 sm:p-4 flex items-center gap-3 hover:border-green-primary/40 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-bg-secondary grid place-items-center shrink-0 overflow-hidden">
        {d.photoUrl ? <img src={d.photoUrl} alt="" className="w-full h-full object-cover" /> : <Icon className="w-5 h-5 text-text-muted" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-inter font-semibold text-text-primary text-sm truncate">{title || t('Sans nom')}</p>
        <p className="text-text-muted text-xs truncate">
          {t(d.type === 'restaurant' ? 'Restaurant' : 'Livreur')}{d.phone ? ` · ${d.phone}` : ''}{d.city ? ` · ${d.city}` : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[d.kycStatus]}`}>{t(KYC_STATUS_LABELS[d.kycStatus])}</span>
        <p className="text-text-muted text-[11px] mt-1">
          {d.docsTotal > 0 ? `${d.docsApproved}/${d.docsTotal} ${t('validées')}` : t('aucune pièce')}
          {d.docsRejected > 0 ? ` · ${d.docsRejected} ${t('refusée(s)')}` : ''}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
    </Link>
  );
}
