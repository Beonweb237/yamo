import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, HeartPulse, CalendarDays, Loader2, Check, Store, Wallet,
  UtensilsCrossed, CalendarCheck, Bike, PauseCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../hooks/useSeo';
import { useAuth } from '../contexts/AuthContext';
import { fetchProgram, type MealProgram, type ProgramSchedule } from '../lib/mealPrograms';
import { subscribeToProgram } from '../lib/subscriptions';
import { fetchMenuItems } from '../lib/catalog';
import type { MenuItem } from '../data/mockData';
import { DIETARY_TAG_META } from '../lib/dishes';
import AppImage from '../components/AppImage';

const tagLabel = (id: string) => DIETARY_TAG_META.find((t) => t.id === id)?.label || id;

/** Libellé lisible du calendrier de livraison dérivé du schedule du programme. */
function scheduleLabel(s: ProgramSchedule | undefined, t: (k: string, o?: Record<string, unknown>) => string): string | null {
  if (!s) return null;
  const jours = (s.jours ?? []).filter(Boolean);
  if (jours.length) {
    const caps = jours.map((j) => j.charAt(0).toUpperCase() + j.slice(1, 3));
    return t('Livré : {{jours}}', { jours: caps.join(', ') });
  }
  if (s.frequence === 'quotidien') return t('Livré tous les jours');
  if (s.frequence === 'hebdomadaire') return t('Livraison hebdomadaire');
  return null;
}

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
  // Exemples de plats RÉELS : menu du resto filtré par les tags du programme.
  const [sampleItems, setSampleItems] = useState<MenuItem[]>([]);
  useSeo({ title: p ? p.name : t('Programme repas'), noindex: false });

  useEffect(() => { fetchProgram(id).then(setP).catch(() => setP(null)).finally(() => setLoading(false)); }, [id]);

  useEffect(() => {
    if (!p?.restaurantId) return; // pas de programme → section jamais rendue
    let alive = true;
    fetchMenuItems(p.restaurantId)
      .then((items) => {
        if (!alive) return;
        const tags = p.dietaryTags ?? [];
        const matching = tags.length
          ? items.filter((it) => (it.dietaryTags ?? []).some((tg) => tags.includes(tg)))
          : items;
        setSampleItems(matching.slice(0, 6));
      })
      .catch(() => { /* section simplement masquée */ });
    return () => { alive = false; };
  }, [p]);

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
              {scheduleLabel(p.schedule, t) && (
                <span className="inline-flex items-center gap-1.5"><CalendarCheck className="w-4 h-4" />{scheduleLabel(p.schedule, t)}</span>
              )}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-3">
              <span className="font-poppins font-bold text-green-primary text-lg">{p.priceFcfa.toLocaleString()} {t('FCFA')} <span className="text-text-muted font-normal text-xs">/ {t('cycle')}</span></span>
              <span className="text-text-muted text-xs">{t('soit ~')}{Math.round(p.priceFcfa / Math.max(1, p.mealsCount)).toLocaleString()} {t('FCFA / repas')}</span>
              <span className="text-text-muted text-xs">· {t('repas + livraison réglés à la réception')}</span>
            </div>
          </div>
        </div>

        {/* Comment ça marche */}
        <div className="bg-white rounded-2xl border border-border-custom p-5 mb-4">
          <h2 className="font-poppins font-semibold text-text-primary text-base mb-4">{t('Comment ça marche')}</h2>
          <ol className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: CalendarDays, label: t('Choisissez votre date de début') },
              { icon: UtensilsCrossed, label: t('Le restaurant prépare vos repas') },
              { icon: Bike, label: t('Livraison selon le calendrier du programme') },
              { icon: PauseCircle, label: t('Pause ou annulation à tout moment') },
            ].map((step, i) => (
              <li key={i} className="flex flex-col items-start gap-2">
                <span className="w-9 h-9 rounded-xl bg-green-light text-green-primary grid place-items-center shrink-0">
                  <step.icon className="w-[18px] h-[18px]" />
                </span>
                <span className="text-text-secondary text-xs leading-relaxed"><span className="font-semibold text-text-primary">{i + 1}.</span> {step.label}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Exemples de plats — vrais plats du menu, tagués comme le programme */}
        {sampleItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-border-custom p-5 mb-4">
            <h2 className="font-poppins font-semibold text-text-primary text-base mb-1">{t('Exemples de plats de ce programme')}</h2>
            <p className="text-text-muted text-xs mb-4">{t('Plats réels du menu de {{name}} correspondant à ce programme.', { name: p.restaurantName ?? t('ce restaurant') })}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sampleItems.map((it) => (
                <div key={it.id} className="rounded-xl border border-border-custom overflow-hidden bg-white">
                  <div className="h-20 sm:h-24 bg-bg-secondary">
                    <AppImage src={it.image} alt={it.name} fallbackLabel={it.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2.5">
                    <p className="font-inter font-medium text-text-primary text-xs truncate">{it.name}</p>
                    <p className="text-text-muted text-[11px] mt-0.5">{it.price.toLocaleString()} {t('FCFA')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
          <div className="flex items-start gap-2.5 bg-green-light/60 border border-green-primary/15 rounded-xl p-3 mb-4">
            <Wallet className="w-4 h-4 text-green-primary shrink-0 mt-0.5" />
            <p className="text-text-secondary text-xs leading-relaxed">{t('Paiement à la livraison : vous réglez chaque repas à sa réception, rien n\'est prélevé à l\'avance. Repas livrés selon le calendrier ; pause ou annulation possible à tout moment.')}</p>
          </div>
          <button onClick={subscribe} disabled={subscribing} className="inline-flex items-center justify-center gap-1.5 h-11 px-6 rounded-xl bg-green-primary text-white font-inter font-medium text-sm hover:bg-green-dark transition-colors disabled:opacity-60">
            {subscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('Souscrire')}
          </button>
        </div>
      </div>
    </div>
  );
}
