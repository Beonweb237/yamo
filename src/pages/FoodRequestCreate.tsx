import { useState, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createFoodRequest, type DeliverySchedule } from '../lib/foodRequests';
import { fetchFoodProfile, hasFoodProfile } from '../lib/foodProfile';
import { DIETARY_TAG_META } from '../lib/dishes';
import { processFormImage } from '../lib/media';
import { CAMEROON_CITIES } from '../data/cities';
import {
  UtensilsCrossed, ArrowLeft, ArrowRight, Send, CheckCircle2, ChevronDown, Sparkles,
  Camera, X, Loader2, HeartPulse, Users, CalendarClock, MapPin, ShieldCheck, Store, Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../hooks/useSeo';

const FORM_STORAGE_KEY = 'miam_draft_food_request';
function loadDraft() { try { const r = localStorage.getItem(FORM_STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
function saveDraft(data: unknown) { localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data)); }
function clearDraft() { localStorage.removeItem(FORM_STORAGE_KEY); }

const SUGGESTIONS = [
  'Repas diabétique pour la semaine', 'Plateau anniversaire (10 pers.)',
  'Ndolè aux crevettes pour 6', 'Petit-déjeuner bureau', 'Poulet DG maison',
  'Menu sportif riche en protéines', 'Repas sans sel pour senior',
];
const OCCASIONS = ['Quotidien', 'Anniversaire', 'Réunion / bureau', 'Fête', 'Régime santé', 'Autre'];
const FREQ: { id: DeliverySchedule['frequence']; label: string }[] = [
  { id: 'unique', label: 'Une fois' }, { id: 'quotidien', label: 'Chaque jour' }, { id: 'hebdomadaire', label: 'Chaque semaine' },
];

export default function FoodRequestCreate() {
  const { t } = useTranslation();
  useSeo({
    title: t('Demande de plat sur mesure'),
    description: t("Un plat introuvable au menu ? Décrivez-le : un restaurant partenaire MiamExpress le prépare et vous le livre à Douala ou Yaoundé."),
    path: '/demandes/nouvelle',
  });
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const draft = loadDraft();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [applyingProfile, setApplyingProfile] = useState(false);

  const [f, setF] = useState({
    title: draft?.title || '', description: draft?.description || '',
    dietaryTags: (draft?.dietaryTags as string[]) || [], photoUrl: (draft?.photoUrl as string) || '',
    portions: draft?.portions || 1, occasion: draft?.occasion || '',
    frequence: (draft?.frequence as DeliverySchedule['frequence']) || 'unique', dureeSemaines: draft?.dureeSemaines || 2,
    city: draft?.city || user?.city || '', deliveryAddress: draft?.deliveryAddress || '', budget: draft?.budget || 5000,
    forOther: draft?.forOther || false, recipientName: draft?.recipientName || '', recipientPhone: draft?.recipientPhone || '',
  });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  useEffect(() => { const id = setTimeout(() => saveDraft(f), 500); return () => clearTimeout(id); }, [f]);
  useEffect(() => { if (user?.city && !f.city && !draft) set({ city: user.city }); /* eslint-disable-next-line */ }, [user]);

  const toggleTag = (id: string) => set({ dietaryTags: f.dietaryTags.includes(id) ? f.dietaryTags.filter((x: string) => x !== id) : [...f.dietaryTags, id] });

  const applyProfile = async () => {
    setApplyingProfile(true);
    try {
      const p = await fetchFoodProfile();
      if (!hasFoodProfile(p)) { setError(t('Complétez d\'abord votre profil alimentaire dans votre profil.')); return; }
      const tags = [...new Set([...f.dietaryTags, ...p.preferences])];
      const notes = [p.allergies && `Allergies : ${p.allergies}`, p.forbiddenFoods && `À éviter : ${p.forbiddenFoods}`, p.healthConditions.length && `Santé : ${p.healthConditions.join(', ')}`].filter(Boolean).join('. ');
      set({ dietaryTags: tags, description: f.description ? `${f.description}\n${notes}` : notes });
      setError('');
    } finally { setApplyingProfile(false); }
  };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try { set({ photoUrl: await processFormImage(file, 'requests') }); } catch { setError(t('Upload échoué')); } finally { setUploading(false); }
  };

  const validateStep = (s: number): string => {
    if (s === 0) { if (f.title.trim().length < 3) return t('Titre : 3 caractères minimum.'); if (f.description.trim().length < 10) return t('Description : 10 caractères minimum.'); }
    if (s === 2) { if (!f.city) return t('Sélectionnez votre ville.'); if (f.budget < 500) return t('Budget minimum : 500 FCFA.'); if (f.forOther && !f.recipientName.trim()) return t('Nom du destinataire requis.'); }
    return '';
  };
  const next = () => { const e = validateStep(step); if (e) { setError(e); return; } setError(''); setStep((s) => Math.min(3, s + 1)); };
  const prev = () => { setError(''); setStep((s) => Math.max(0, s - 1)); };

  const submit = async () => {
    if (!user) return;
    for (let s = 0; s <= 2; s++) { const e = validateStep(s); if (e) { setError(e); setStep(s); return; } }
    setError(''); setLoading(true);
    try {
      const deliverySchedule: DeliverySchedule = { frequence: f.frequence, ...(f.frequence !== 'unique' ? { dureeSemaines: f.dureeSemaines } : {}) };
      await createFoodRequest(user.id, {
        title: f.title.trim(), description: f.description.trim(), city: f.city,
        budgetMin: Math.round(f.budget * 0.7), budgetMax: f.budget, dietaryTags: f.dietaryTags,
        deliverySchedule, deliveryAddress: f.deliveryAddress.trim() || undefined,
        portions: f.portions, occasion: f.occasion || undefined, photoUrl: f.photoUrl || undefined,
        recipientName: f.forOther ? f.recipientName.trim() : undefined, recipientPhone: f.forOther ? f.recipientPhone.trim() : undefined,
      });
      clearDraft(); setSuccess(true);
      setTimeout(() => navigate('/demandes/mes-demandes', { state: { justCreated: true } }), 1500);
    } catch (e) { setError(e instanceof Error ? e.message : t('Erreur lors de la création. Réessayez.')); } finally { setLoading(false); }
  };

  if (authLoading) return <div className="pt-[72px] min-h-screen bg-bg-secondary grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-green-primary" /></div>;
  if (!user) return <Navigate to="/connexion" state={{ from: '/demandes/nouvelle' }} replace />;
  if (success) return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary grid place-items-center px-4">
      <div className="w-full max-w-[480px] bg-white rounded-2xl border border-border-custom shadow-sm p-8 text-center my-12">
        <div className="w-16 h-16 rounded-2xl bg-green-light grid place-items-center mx-auto mb-5"><CheckCircle2 className="w-8 h-8 text-green-primary" /></div>
        <h1 className="font-poppins font-bold text-text-primary text-2xl mb-2">{t('Demande publiée !')}</h1>
        <p className="text-text-secondary text-sm mb-2">{t('Les restaurants de')} {f.city} {t('peuvent maintenant vous contacter.')}</p>
        <p className="text-text-muted text-xs">{t('Redirection vers vos demandes...')}</p>
      </div>
    </div>
  );

  const steps = [t('Votre envie'), t('Détails'), t('Livraison'), t('Récap')];
  const chip = (active: boolean) => `text-xs font-medium px-3 h-9 rounded-full border transition-colors ${active ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-text-secondary border-border-custom hover:border-green-primary/40'}`;
  const inputCls = 'w-full px-4 h-12 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm transition-all';

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary pb-16">
      <div className="max-w-[640px] mx-auto px-4 sm:px-6 py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-4"><ArrowLeft className="w-4 h-4" />{t('Retour')}</button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-green-primary/10 grid place-items-center shrink-0"><UtensilsCrossed className="w-6 h-6 text-green-primary" /></div>
          <div>
            <h1 className="font-poppins font-bold text-text-primary text-xl sm:text-2xl">{t('Demande sur mesure')}</h1>
            <p className="text-text-muted text-xs sm:text-sm">{t('Dites ce que vous voulez, les restaurants de votre ville vous répondent.')}</p>
          </div>
        </div>

        {/* Comment ça marche */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[[Sparkles, t('Décrivez')], [Store, t('Ils proposent')], [CheckCircle2, t('Vous choisissez')]].map(([Ic, label], i) => (
            <div key={i} className="bg-white rounded-xl border border-border-custom p-3 text-center">
              {(() => { const I = Ic as typeof Sparkles; return <I className="w-5 h-5 text-green-primary mx-auto mb-1" />; })()}
              <span className="text-[11px] font-medium text-text-secondary">{label as string}</span>
            </div>
          ))}
        </div>

        {/* Progression */}
        <div className="flex items-center gap-1.5 mb-5">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-green-primary' : 'bg-border-custom'}`} />
              <span className={`text-[10px] mt-1 block ${i === step ? 'text-green-primary font-semibold' : 'text-text-muted'}`}>{s}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6">
          {error && <div className="mb-5 p-3 bg-error/5 border border-error/20 rounded-xl text-sm text-error">{error}</div>}

          {/* ── Étape 0 : envie ── */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">{t('Que voulez-vous ?')} <span className="text-error">*</span></label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => set({ title: s })} className="text-[11px] px-2.5 h-7 rounded-full bg-bg-secondary text-text-secondary hover:bg-green-light hover:text-green-primary transition-colors">{s}</button>)}
                </div>
                <input value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={100} placeholder={t('Ex: Repas diabétique pour la semaine')} className={inputCls} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1.5">{t('Décrivez votre besoin')} <span className="text-error">*</span></label>
                <textarea value={f.description} onChange={(e) => set({ description: e.target.value })} rows={4} placeholder={t('Quel type de cuisine ? Quels plats ? Régime particulier ? Détails utiles…')} className="w-full px-4 py-3 rounded-xl border border-border-custom focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 outline-none text-sm resize-none" />
                <p className="text-xs text-text-muted mt-1">{f.description.length} {t('car. (min 10)')}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1.5">{t('Photo de référence')} <span className="text-text-muted font-normal text-xs">{t('(optionnel)')}</span></label>
                {f.photoUrl ? (
                  <div className="relative w-40 h-28 rounded-xl overflow-hidden border border-border-custom">
                    <img src={f.photoUrl} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => set({ photoUrl: '' })} className="absolute top-1 right-1 w-7 h-7 rounded-lg bg-white/90 text-error grid place-items-center"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <label className="w-40 h-28 rounded-xl border border-dashed border-border-custom bg-bg-secondary grid place-items-center cursor-pointer text-text-muted hover:border-green-primary/40">
                    {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <div className="text-center"><Camera className="w-6 h-6 mx-auto" /><span className="text-[11px]">{t('Montrez le plat')}</span></div>}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* ── Étape 1 : détails ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-text-primary flex items-center gap-1.5"><HeartPulse className="w-4 h-4 text-green-primary" />{t('Régime / préférences')}</label>
                  <button type="button" onClick={applyProfile} disabled={applyingProfile} className="text-xs font-medium text-green-primary inline-flex items-center gap-1">{applyingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}{t('Appliquer mon profil')}</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DIETARY_TAG_META.map((tag) => <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)} className={chip(f.dietaryTags.includes(tag.id))}>{t(tag.label)}</button>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-sm font-semibold text-text-primary mb-1.5"><Users className="w-3.5 h-3.5 inline mr-1" />{t('Personnes')}</span>
                  <input type="number" min={1} value={f.portions} onChange={(e) => set({ portions: Math.max(1, parseInt(e.target.value) || 1) })} className={inputCls} />
                </label>
                <label className="block">
                  <span className="block text-sm font-semibold text-text-primary mb-1.5">{t('Occasion')}</span>
                  <div className="relative">
                    <select value={f.occasion} onChange={(e) => set({ occasion: e.target.value })} className={`${inputCls} appearance-none bg-white cursor-pointer`}>
                      <option value="">{t('—')}</option>{OCCASIONS.map((o) => <option key={o} value={o}>{t(o)}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  </div>
                </label>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2"><CalendarClock className="w-4 h-4 inline mr-1" />{t('Fréquence')}</label>
                <div className="flex flex-wrap gap-1.5">{FREQ.map((fr) => <button key={fr.id} type="button" onClick={() => set({ frequence: fr.id })} className={chip(f.frequence === fr.id)}>{t(fr.label)}</button>)}</div>
                {f.frequence !== 'unique' && (
                  <label className="block mt-3">
                    <span className="block text-xs text-text-muted mb-1">{t('Pendant combien de semaines ?')}</span>
                    <input type="number" min={1} max={52} value={f.dureeSemaines} onChange={(e) => set({ dureeSemaines: Math.max(1, parseInt(e.target.value) || 1) })} className="w-28 px-3 h-11 rounded-xl border border-border-custom outline-none text-sm" />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* ── Étape 2 : livraison & budget ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1.5"><MapPin className="w-3.5 h-3.5 inline mr-1" />{t('Ville')} <span className="text-error">*</span></label>
                <div className="relative">
                  <select value={f.city} onChange={(e) => set({ city: e.target.value })} className={`${inputCls} appearance-none bg-white cursor-pointer`}>
                    <option value="">{t('-- Sélectionnez --')}</option>{CAMEROON_CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                </div>
              </div>
              <label className="block">
                <span className="block text-sm font-semibold text-text-primary mb-1.5"><MapPin className="w-3.5 h-3.5 inline mr-1" />{t('Adresse de livraison')} <span className="text-text-muted font-normal text-xs">{t('(optionnel)')}</span></span>
                <input value={f.deliveryAddress} onChange={(e) => set({ deliveryAddress: e.target.value })} placeholder={t('Quartier, rue, point de repère...')} className={inputCls} />
              </label>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1.5"><Wallet className="w-3.5 h-3.5 inline mr-1" />{t('Budget maximum')} : <span className="text-green-primary">{f.budget.toLocaleString()} {t('FCFA')}</span></label>
                <input type="range" min={500} max={100000} step={500} value={f.budget} onChange={(e) => set({ budget: parseInt(e.target.value) })} className="w-full accent-green-primary" />
                <div className="flex justify-between text-[10px] text-text-muted mt-1"><span>{t('Économique')}</span><span>{t('Standard')}</span><span>{t('Premium')}</span></div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-text-primary cursor-pointer">
                  <input type="checkbox" checked={f.forOther} onChange={(e) => set({ forOther: e.target.checked })} className="accent-green-primary w-4 h-4" />
                  {t('Pour quelqu\'un d\'autre ?')}
                </label>
                {f.forOther && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <input value={f.recipientName} onChange={(e) => set({ recipientName: e.target.value })} placeholder={t('Nom du destinataire')} className={inputCls} />
                    <input value={f.recipientPhone} onChange={(e) => set({ recipientPhone: e.target.value })} placeholder={t('Téléphone')} className={inputCls} inputMode="tel" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Étape 3 : récap ── */}
          {step === 3 && (
            <div className="space-y-3">
              <h2 className="font-poppins font-semibold text-text-primary text-base">{t('Vérifiez votre demande')}</h2>
              {f.photoUrl && <img src={f.photoUrl} alt="" className="w-full h-40 object-cover rounded-xl" />}
              <Rc label={t('Envie')} value={f.title} />
              <Rc label={t('Détails')} value={f.description} />
              {f.dietaryTags.length > 0 && <Rc label={t('Régime')} value={f.dietaryTags.map((id) => DIETARY_TAG_META.find((x) => x.id === id)?.label || id).join(', ')} />}
              <div className="grid grid-cols-2 gap-2">
                <Rc label={t('Personnes')} value={String(f.portions)} />
                <Rc label={t('Fréquence')} value={FREQ.find((x) => x.id === f.frequence)?.label + (f.frequence !== 'unique' ? ` · ${f.dureeSemaines} sem.` : '')} />
                <Rc label={t('Ville')} value={f.city} />
                <Rc label={t('Budget maximum')} value={`${f.budget.toLocaleString()} FCFA`} />
              </div>
              {f.forOther && <Rc label={t('Destinataire')} value={`${f.recipientName} ${f.recipientPhone}`} />}
              <div className="flex items-center gap-2 text-xs text-text-muted bg-green-light/40 rounded-lg p-2.5">
                <ShieldCheck className="w-4 h-4 text-green-primary shrink-0" />
                <span>{t('Restaurants vérifiés · paiement à la réception · visible 48h dans votre ville.')}</span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-2 mt-6">
            {step > 0 && <button onClick={prev} className="h-12 px-5 rounded-xl border border-border-custom text-text-secondary text-sm font-medium">{t('Précédent')}</button>}
            {step < 3 ? (
              <button onClick={next} className="flex-1 h-12 bg-green-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-green-dark">{t('Continuer')}<ArrowRight className="w-4 h-4" /></button>
            ) : (
              <button onClick={submit} disabled={loading} className="flex-1 h-12 bg-green-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-green-dark disabled:opacity-60">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}{t('Publier ma demande')}</button>
            )}
          </div>
        </div>
        <p className="text-xs text-text-muted text-center mt-3">{t('Brouillon sauvegardé automatiquement.')} <Link to="/demandes/mes-demandes" className="text-green-primary">{t('Mes demandes')}</Link></p>
      </div>
    </div>
  );
}

function Rc({ label, value }: { label: string; value: string }) {
  return <div className="bg-bg-secondary rounded-lg p-2.5"><span className="block text-[11px] text-text-muted">{label}</span><span className="block text-sm text-text-primary font-medium whitespace-pre-line break-words">{value || '—'}</span></div>;
}
