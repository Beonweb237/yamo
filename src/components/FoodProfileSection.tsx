import { useEffect, useState } from 'react';
import { HeartPulse, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { DIETARY_TAG_META } from '../lib/dishes';
import {
  fetchFoodProfile, saveFoodProfile, HEALTH_CONDITIONS, FOOD_OBJECTIVES,
  type FoodProfile, type FoodObjective, EMPTY_FOOD_PROFILE,
} from '../lib/foodProfile';

// Section « Profil alimentaire » du profil client (série FOOD). Optionnelle :
// réutilise les tags diététiques existants ; sert à personnaliser le catalogue
// et à pré-remplir les demandes/abonnements.
export default function FoodProfileSection() {
  const { t } = useTranslation();
  const [p, setP] = useState<FoodProfile>({ ...EMPTY_FOOD_PROFILE });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchFoodProfile().then(setP).catch(() => {}).finally(() => setLoading(false)); }, []);

  const toggle = (key: 'healthConditions' | 'preferences', id: string) => {
    setP((prev) => {
      const has = prev[key].includes(id);
      return { ...prev, [key]: has ? prev[key].filter((x) => x !== id) : [...prev[key], id] };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveFoodProfile(p);
      toast.success(t('Profil alimentaire enregistré'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Enregistrement impossible'));
    } finally { setSaving(false); }
  };

  const chip = (active: boolean) =>
    `text-xs font-inter font-medium px-3 h-8 rounded-full border transition-colors ${active ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-text-secondary border-border-custom hover:border-green-primary/40'}`;

  if (loading) return <div className="bg-white rounded-2xl border border-border-custom p-5 animate-pulse h-40" />;

  return (
    <div className="bg-white rounded-2xl border border-border-custom p-5">
      <div className="flex items-center gap-2 mb-1">
        <HeartPulse className="w-5 h-5 text-green-primary" />
        <h2 className="font-poppins font-semibold text-text-primary text-base">{t('Profil alimentaire')}</h2>
        <span className="text-[10px] font-medium text-text-muted bg-bg-secondary rounded-full px-2 py-0.5">{t('optionnel')}</span>
      </div>
      <p className="text-text-muted text-xs font-inter mb-4">{t('Aide à vous proposer des plats et programmes adaptés. Vous seul le voyez.')}</p>

      <div className="space-y-4">
        <div>
          <p className="text-text-secondary text-xs font-inter font-medium mb-2">{t('Conditions de santé')}</p>
          <div className="flex flex-wrap gap-2">
            {HEALTH_CONDITIONS.map((c) => (
              <button key={c.id} type="button" onClick={() => toggle('healthConditions', c.id)} className={chip(p.healthConditions.includes(c.id))}>{t(c.label)}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-text-secondary text-xs font-inter font-medium mb-2">{t('Préférences / régimes')}</p>
          <div className="flex flex-wrap gap-2">
            {DIETARY_TAG_META.map((tag) => (
              <button key={tag.id} type="button" onClick={() => toggle('preferences', tag.id)} className={chip(p.preferences.includes(tag.id))}>{t(tag.label)}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-text-secondary text-xs font-inter font-medium mb-2">{t('Objectif')}</p>
          <div className="flex flex-wrap gap-2">
            {FOOD_OBJECTIVES.map((o) => (
              <button key={o.id} type="button" onClick={() => setP((prev) => ({ ...prev, objective: prev.objective === o.id ? null : o.id as FoodObjective }))} className={chip(p.objective === o.id)}>{t(o.label)}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-text-secondary text-xs font-inter font-medium mb-1">{t('Allergies / intolérances')}</span>
            <input value={p.allergies} onChange={(e) => setP({ ...p, allergies: e.target.value })} placeholder={t('Ex. arachide, fruits de mer')} className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-sm outline-none border border-transparent focus:border-green-primary/40" />
          </label>
          <label className="block">
            <span className="block text-text-secondary text-xs font-inter font-medium mb-1">{t('Aliments à éviter')}</span>
            <input value={p.forbiddenFoods} onChange={(e) => setP({ ...p, forbiddenFoods: e.target.value })} placeholder={t('Ex. porc, piment')} className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-sm outline-none border border-transparent focus:border-green-primary/40" />
          </label>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="mt-4 inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-green-primary text-white font-inter font-medium text-sm hover:bg-green-dark transition-colors disabled:opacity-60">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{t('Enregistrer')}
      </button>
    </div>
  );
}
