import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, HeartPulse, CalendarDays, Loader2, Check, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../hooks/useSeo';
import { useAuth } from '../contexts/AuthContext';
import { fetchProgram, type MealProgram } from '../lib/mealPrograms';
import { subscribeToProgram } from '../lib/subscriptions';
import { DIETARY_TAG_META } from '../lib/dishes';
import AppImage from '../components/AppImage';

const tagLabel = (id: string) => DIETARY_TAG_META.find((t) => t.id === id)?.label || id;

function savedAddress(): string {
  try {
    const raw = localStorage.getItem('yamo_saved_addresses');
    const arr = raw ? JSON.parse(raw) : [];
    const a = Array.isArray(arr) ? arr[0] : null;
    return a ? (a.fullText || a.full_text || a.label || '') : '';
  } catch { return ''; }
}

export default function MealProgramDetail() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [p, setP] = useState<MealProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [address, setAddress] = useState(savedAddress);
  const [subscribing, setSubscribing] = useState(false);
  useSeo({ title: p ? p.name : t('Programme repas'), noindex: false });

  useEffect(() => { fetchProgram(id).then(setP).catch(() => setP(null)).finally(() => setLoading(false)); }, [id]);

  const subscribe = async () => {
    if (!user) { navigate('/connexion'); return; }
    if (!address.trim()) { toast.error(t('Indiquez une adresse de livraison.')); return; }
    setSubscribing(true);
    try {
      const sub = await subscribeToProgram(id, startDate, undefined, address.trim());
      toast.success(t('Abonnement créé — {{n}} livraisons planifiées.', { n: sub.plannedDeliveries }));
      navigate('/abonnements');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Souscription impossible'));
    } finally { setSubscribing(false); }
  };

  if (loading) return <div className="pt-[72px] min-h-screen bg-bg-secondary grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-green-primary" /></div>;
  if (!p) return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary text-center p-10">
      <p className="font-poppins font-semibold text-text-primary mb-3">{t('Programme introuvable')}</p>
      <Link to="/programmes" className="text-green-primary font-medium">{t('Voir les programmes')}</Link>
    </div>
  );

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-6">
        <Link to="/programmes" className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm mb-4"><ArrowLeft className="w-4 h-4" />{t('Tous les programmes')}</Link>

        <div className="bg-white rounded-2xl border border-border-custom overflow-hidden mb-4">
          <div className="h-48 bg-bg-secondary">
            {p.photoUrl ? <AppImage src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><HeartPulse className="w-12 h-12 text-text-muted/40" /></div>}
          </div>
          <div className="p-5">
            <h1 className="font-poppins font-bold text-text-primary text-xl">{p.name}</h1>
            <p className="text-text-muted text-sm inline-flex items-center gap-1.5 mt-1"><Store className="w-4 h-4" />{p.restaurantName}{p.restaurantCity ? ` · ${p.restaurantCity}` : ''}</p>
            {p.targetAudience && <p className="text-text-secondary text-sm mt-2">{t('Pour')} : {p.targetAudience}</p>}
            {p.description && <p className="text-text-secondary text-sm mt-2 whitespace-pre-line">{p.description}</p>}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {p.dietaryTags.map((x) => <span key={x} className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-green-light text-green-primary">{t(tagLabel(x))}</span>)}
            </div>
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-text-muted">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" />{p.mealsCount} {t('repas')} · {p.durationWeeks} {t('semaines')}</span>
              <span className="font-poppins font-bold text-green-primary text-base">{p.priceFcfa.toLocaleString()} {t('FCFA')} <span className="text-text-muted font-normal text-xs">/ {t('cycle')}</span></span>
            </div>
          </div>
        </div>

        {/* Souscrire */}
        <div className="bg-white rounded-2xl border border-border-custom p-5">
          <h2 className="font-poppins font-semibold text-text-primary text-base mb-3">{t('Souscrire à ce programme')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <label className="block">
              <span className="block text-text-muted text-xs mb-1">{t('Date de début')}</span>
              <input type="date" value={startDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-sm outline-none border border-transparent focus:border-green-primary/40" />
            </label>
            <label className="block">
              <span className="block text-text-muted text-xs mb-1">{t('Adresse de livraison')}</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('Quartier, point de repère…')} className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-sm outline-none border border-transparent focus:border-green-primary/40" />
            </label>
          </div>
          <p className="text-text-muted text-xs mb-4">{t('Paiement du cycle à la souscription. Les repas sont livrés selon le calendrier. Vous pourrez mettre en pause à tout moment.')}</p>
          <button onClick={subscribe} disabled={subscribing} className="inline-flex items-center justify-center gap-1.5 h-11 px-6 rounded-xl bg-green-primary text-white font-inter font-medium text-sm hover:bg-green-dark transition-colors disabled:opacity-60">
            {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('Souscrire')} · {p.priceFcfa.toLocaleString()} {t('FCFA')}
          </button>
        </div>
      </div>
    </div>
  );
}
