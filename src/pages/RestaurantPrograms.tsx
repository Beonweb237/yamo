import { useEffect, useState } from 'react';
import { HeartPulse, Plus, Loader2, Check, Archive, Send, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../hooks/useSeo';
import {
  fetchMyPrograms, createProgram, updateProgram, setProgramStatus,
  type MealProgram, type MealProgramInput,
} from '../lib/mealPrograms';
import { DIETARY_TAG_META } from '../lib/dishes';
import { processFormImage } from '../lib/media';

const EMPTY: MealProgramInput = { name: '', description: '', targetAudience: '', dietaryTags: [], durationWeeks: 4, mealsCount: 28, schedule: { frequence: 'quotidien' }, priceFcfa: 0, photoUrl: null };

export default function RestaurantPrograms() {
  const { t } = useTranslation();
  useSeo({ title: t('Mes programmes'), noindex: true });
  const [programs, setPrograms] = useState<MealProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // id | 'new' | null
  const [form, setForm] = useState<MealProgramInput>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => { setLoading(true); fetchMyPrograms().then(setPrograms).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ ...EMPTY }); setEditing('new'); };
  const openEdit = (p: MealProgram) => {
    setForm({ name: p.name, description: p.description || '', targetAudience: p.targetAudience || '', dietaryTags: p.dietaryTags, durationWeeks: p.durationWeeks, mealsCount: p.mealsCount, schedule: p.schedule, priceFcfa: p.priceFcfa, photoUrl: p.photoUrl });
    setEditing(p.id);
  };
  const toggleTag = (id: string) => setForm((f) => ({ ...f, dietaryTags: (f.dietaryTags || []).includes(id) ? (f.dietaryTags || []).filter((x) => x !== id) : [...(f.dietaryTags || []), id] }));

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try { const url = await processFormImage(file, 'programs'); setForm((f) => ({ ...f, photoUrl: url })); }
    catch { toast.error(t('Upload échoué')); } finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.name?.trim()) { toast.error(t('Nom du programme requis.')); return; }
    setSaving(true);
    try {
      if (editing === 'new') await createProgram(form);
      else if (editing) await updateProgram(editing, form);
      toast.success(t('Programme enregistré'));
      setEditing(null); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t('Enregistrement impossible')); }
    finally { setSaving(false); }
  };

  const changeStatus = async (id: string, status: 'published' | 'archived') => {
    try { await setProgramStatus(id, status); toast.success(status === 'published' ? t('Programme publié') : t('Programme archivé')); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('Action impossible')); }
  };

  const inputCls = 'w-full bg-bg-secondary rounded-lg px-3 h-11 text-sm outline-none border border-transparent focus:border-green-primary/40';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <h1 className="font-poppins font-bold text-text-primary text-2xl flex items-center gap-2"><HeartPulse className="w-6 h-6 text-green-primary" />{t('Programmes repas')}</h1>
        {editing === null && <button onClick={openNew} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-green-primary text-white text-sm font-semibold"><Plus className="w-4 h-4" />{t('Nouveau programme')}</button>}
      </div>

      {editing !== null ? (
        <div className="bg-white rounded-2xl border border-border-custom p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-poppins font-semibold text-text-primary text-sm">{editing === 'new' ? t('Nouveau programme') : t('Modifier le programme')}</h2>
            <button onClick={() => setEditing(null)} className="text-text-muted"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('Nom (ex. Diabète Premium)')} className={inputCls} />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('Description')} rows={3} className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-sm outline-none resize-none border border-transparent focus:border-green-primary/40" />
            <input value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })} placeholder={t('Public cible (ex. diabétiques)')} className={inputCls} />
            <div>
              <span className="block text-text-muted text-xs mb-1">{t('Tags / régimes')}</span>
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAG_META.map((tag) => <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)} className={`text-xs px-3 h-8 rounded-full border ${(form.dietaryTags || []).includes(tag.id) ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-text-secondary border-border-custom'}`}>{t(tag.label)}</button>)}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="block"><span className="block text-text-muted text-xs mb-1">{t('Semaines')}</span><input type="number" min={1} value={form.durationWeeks} onChange={(e) => setForm({ ...form, durationWeeks: parseInt(e.target.value) || 1 })} className={inputCls} /></label>
              <label className="block"><span className="block text-text-muted text-xs mb-1">{t('Repas')}</span><input type="number" min={1} value={form.mealsCount} onChange={(e) => setForm({ ...form, mealsCount: parseInt(e.target.value) || 1 })} className={inputCls} /></label>
              <label className="block"><span className="block text-text-muted text-xs mb-1">{t('Fréquence')}</span>
                <select value={form.schedule?.frequence} onChange={(e) => setForm({ ...form, schedule: { ...form.schedule, frequence: e.target.value as 'quotidien' | 'hebdomadaire' } })} className={inputCls}>
                  <option value="quotidien">{t('Quotidien')}</option><option value="hebdomadaire">{t('Hebdomadaire')}</option>
                </select></label>
              <label className="block"><span className="block text-text-muted text-xs mb-1">{t('Prix cycle')}</span><input type="number" min={0} value={form.priceFcfa} onChange={(e) => setForm({ ...form, priceFcfa: parseInt(e.target.value) || 0 })} className={inputCls} /></label>
            </div>
            <div>
              <span className="block text-text-muted text-xs mb-1">{t('Photo')}</span>
              {form.photoUrl ? (
                <div className="relative w-40 h-28 rounded-xl overflow-hidden border border-border-custom">
                  <img src={form.photoUrl} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setForm({ ...form, photoUrl: null })} className="absolute top-1 right-1 w-7 h-7 rounded-lg bg-white/90 text-error grid place-items-center"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <label className="w-40 h-28 rounded-xl border border-dashed border-border-custom bg-bg-secondary grid place-items-center cursor-pointer text-text-muted">
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
                </label>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-green-primary text-white text-sm font-medium disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('Enregistrer')}</button>
            <button onClick={() => setEditing(null)} className="h-10 px-4 rounded-lg border border-border-custom text-text-secondary text-sm">{t('Annuler')}</button>
          </div>
        </div>
      ) : loading ? (
        <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-20 bg-white rounded-xl border border-border-custom animate-pulse" />)}</div>
      ) : programs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border-custom p-10 text-center">
          <HeartPulse className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="font-poppins font-semibold text-text-primary mb-1">{t('Aucun programme')}</p>
          <p className="text-text-muted text-sm">{t('Créez un programme santé/nutrition pour proposer des abonnements.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-border-custom p-4 flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-bg-secondary overflow-hidden grid place-items-center shrink-0">{p.photoUrl ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover" /> : <HeartPulse className="w-6 h-6 text-text-muted/40" />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-poppins font-semibold text-text-primary text-sm truncate">{p.name}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${p.status === 'published' ? 'bg-green-light text-green-primary' : p.status === 'archived' ? 'bg-bg-secondary text-text-muted' : 'bg-amber-50 text-amber-700'}`}>{t(p.status === 'published' ? 'Publié' : p.status === 'archived' ? 'Archivé' : 'Brouillon')}</span>
                </div>
                <p className="text-text-muted text-xs">{p.mealsCount} {t('repas')} · {p.durationWeeks} {t('sem.')} · {p.priceFcfa.toLocaleString()} {t('FCFA')}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => openEdit(p)} className="w-9 h-9 rounded-lg border border-border-custom text-text-secondary grid place-items-center" title={t('Modifier')}><Pencil className="w-4 h-4" /></button>
                {p.status !== 'published' ? <button onClick={() => changeStatus(p.id, 'published')} className="w-9 h-9 rounded-lg bg-green-primary text-white grid place-items-center" title={t('Publier')}><Send className="w-4 h-4" /></button>
                  : <button onClick={() => changeStatus(p.id, 'archived')} className="w-9 h-9 rounded-lg border border-border-custom text-text-secondary grid place-items-center" title={t('Archiver')}><Archive className="w-4 h-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
