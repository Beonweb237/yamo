import { useEffect, useState, useCallback } from 'react';
import { HeartPulse, Loader2, Check, X, Pencil, Store, ShieldCheck, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { DIETARY_TAG_META } from '../../lib/dishes';
import { processFormImage } from '../../lib/media';
import {
  fetchProgramsForReview, updateProgram, reviewProgram,
  type MealProgram, type MealProgramInput, type ProgramStatus,
} from '../../lib/mealPrograms';

const STATUS_LABEL: Record<ProgramStatus, string> = {
  draft: 'Brouillon', pending_review: 'En validation', validated: 'Validé', rejected: 'Refusé', published: 'Publié', archived: 'Archivé',
};

export default function AdminProgramReview() {
  const { t } = useTranslation();
  const [programs, setPrograms] = useState<MealProgram[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending_review' | 'all'>('pending_review');
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<MealProgramInput>({ name: '' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchProgramsForReview(tab === 'pending_review' ? 'pending_review' : undefined)
      .then((r) => { setPrograms(r.programs); setCounts(r.counts); })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const openEdit = (p: MealProgram) => {
    setForm({ name: p.name, description: p.description || '', targetAudience: p.targetAudience || '', dietaryTags: p.dietaryTags, durationWeeks: p.durationWeeks, mealsCount: p.mealsCount, schedule: p.schedule, priceFcfa: p.priceFcfa, photoUrl: p.photoUrl, benefits: p.benefits ?? [] });
    setEditing(p.id);
  };
  const toggleTag = (id: string) => setForm((f) => ({ ...f, dietaryTags: (f.dietaryTags || []).includes(id) ? (f.dietaryTags || []).filter((x) => x !== id) : [...(f.dietaryTags || []), id] }));
  const onPhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try { const url = await processFormImage(file, 'programs'); setForm((f) => ({ ...f, photoUrl: url })); }
    catch { toast.error(t('Upload échoué')); } finally { setUploading(false); }
  };

  const saveAdjust = async (id: string) => {
    setBusy(id);
    try { await updateProgram(id, form); toast.success(t('Ajustements enregistrés (le programme reste en validation).')); setEditing(null); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('Enregistrement impossible')); }
    finally { setBusy(null); }
  };
  const decide = async (id: string, decision: 'validate' | 'reject') => {
    if (decision === 'reject' && !note.trim()) { toast.error(t('Motif de refus obligatoire.')); return; }
    setBusy(id);
    try {
      await reviewProgram(id, decision, note.trim() || undefined);
      toast.success(decision === 'validate' ? t('Validé — le restaurant peut publier.') : t('Refusé — renvoyé au restaurant.'));
      setNote(''); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t('Action impossible')); }
    finally { setBusy(null); }
  };

  const inputCls = 'w-full bg-bg-secondary rounded-lg px-3 h-11 text-sm outline-none border border-transparent focus:border-green-primary/40';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <PageHeader icon={ShieldCheck} title="Validation des programmes"
        subtitle={`${counts.pending_review || 0} programme(s) en attente de validation`} />

      <div className="flex gap-2 mb-4">
        {(['pending_review', 'all'] as const).map((v) => (
          <button key={v} onClick={() => setTab(v)} className={`h-9 px-4 rounded-full text-sm font-inter font-semibold transition-colors ${tab === v ? 'bg-green-primary text-white' : 'bg-white border border-border-custom text-text-secondary'}`}>
            {v === 'pending_review' ? `${t('À valider')} (${counts.pending_review || 0})` : t('Tous')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-24 bg-white rounded-xl border border-border-custom animate-pulse" />)}</div>
      ) : programs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border-custom p-10 text-center">
          <ShieldCheck className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="font-poppins font-semibold text-text-primary mb-1">{t('Rien à valider')}</p>
          <p className="text-text-muted text-sm">{t('Les programmes soumis par les restaurants apparaîtront ici.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {programs.map((p) => {
            const isPending = p.status === 'pending_review';
            const isEditing = editing === p.id;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-border-custom p-4">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-xl bg-bg-secondary overflow-hidden grid place-items-center shrink-0">{p.photoUrl ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover" /> : <HeartPulse className="w-6 h-6 text-text-muted/40" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-poppins font-semibold text-text-primary text-sm truncate">{p.name}</p>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isPending ? 'bg-amber-50 text-amber-700' : p.status === 'published' ? 'bg-green-light text-green-primary' : 'bg-bg-secondary text-text-muted'}`}>{t(STATUS_LABEL[p.status] ?? p.status)}</span>
                      {p.adjustedByAdmin && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{t('Ajusté')}</span>}
                    </div>
                    <p className="text-text-muted text-xs inline-flex items-center gap-1.5 mt-0.5"><Store className="w-3.5 h-3.5" />{p.restaurantName}{p.restaurantCity ? ` · ${p.restaurantCity}` : ''}</p>
                    <p className="text-text-muted text-xs mt-0.5">{p.mealsCount} {t('repas')} · {p.durationWeeks} {t('sem.')} · {p.priceFcfa.toLocaleString()} {t('FCFA')}</p>
                    {p.description && <p className="text-text-secondary text-xs mt-1 line-clamp-2">{p.description}</p>}
                  </div>
                  {isPending && !isEditing && (
                    <button onClick={() => openEdit(p)} className="w-9 h-9 rounded-lg border border-border-custom text-text-secondary grid place-items-center shrink-0" title={t('Ajuster')}><Pencil className="w-4 h-4" /></button>
                  )}
                </div>

                {/* Éditeur d'ajustements (photo + éléments) */}
                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-border-light space-y-3">
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('Nom')} className={inputCls} />
                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('Description')} rows={2} className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-sm outline-none resize-none border border-transparent focus:border-green-primary/40" />
                    <div className="grid grid-cols-3 gap-2">
                      <label className="block"><span className="block text-text-muted text-[11px] mb-1">{t('Prix cycle')}</span><input type="number" min={0} value={form.priceFcfa} onChange={(e) => setForm({ ...form, priceFcfa: parseInt(e.target.value) || 0 })} className={inputCls} /></label>
                      <label className="block"><span className="block text-text-muted text-[11px] mb-1">{t('Repas')}</span><input type="number" min={1} value={form.mealsCount} onChange={(e) => setForm({ ...form, mealsCount: parseInt(e.target.value) || 1 })} className={inputCls} /></label>
                      <label className="block"><span className="block text-text-muted text-[11px] mb-1">{t('Semaines')}</span><input type="number" min={1} value={form.durationWeeks} onChange={(e) => setForm({ ...form, durationWeeks: parseInt(e.target.value) || 1 })} className={inputCls} /></label>
                    </div>
                    <div>
                      <span className="block text-text-muted text-[11px] mb-1">{t('Photo')}</span>
                      {form.photoUrl ? (
                        <div className="relative w-32 h-24 rounded-xl overflow-hidden border border-border-custom">
                          <img src={form.photoUrl} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => setForm({ ...form, photoUrl: null })} className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-white/90 text-error grid place-items-center"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <label className="w-32 h-24 rounded-xl border border-dashed border-border-custom bg-bg-secondary grid place-items-center cursor-pointer text-text-muted">
                          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Pencil className="w-5 h-5" />}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
                        </label>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DIETARY_TAG_META.map((tag) => <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)} className={`text-xs px-2.5 h-7 rounded-full border ${(form.dietaryTags || []).includes(tag.id) ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-text-secondary border-border-custom'}`}>{t(tag.label)}</button>)}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveAdjust(p.id)} disabled={busy === p.id} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-green-primary text-white text-sm font-medium disabled:opacity-60">{busy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('Enregistrer l\'ajustement')}</button>
                      <button onClick={() => setEditing(null)} className="h-9 px-4 rounded-lg border border-border-custom text-text-secondary text-sm">{t('Annuler')}</button>
                    </div>
                  </div>
                )}

                {/* Décision — valider / refuser */}
                {isPending && !isEditing && (
                  <div className="mt-3 pt-3 border-t border-border-light">
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Note au restaurant (obligatoire pour un refus)')} className={`${inputCls} mb-2`} />
                    <div className="flex gap-2">
                      <button onClick={() => decide(p.id, 'validate')} disabled={busy === p.id} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-green-primary text-white text-sm font-semibold disabled:opacity-60"><ShieldCheck className="w-4 h-4" />{t('Valider')}</button>
                      <button onClick={() => decide(p.id, 'reject')} disabled={busy === p.id} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-error text-error text-sm font-semibold hover:bg-error/5 disabled:opacity-60"><Ban className="w-4 h-4" />{t('Refuser')}</button>
                    </div>
                    <p className="text-text-muted text-[11px] mt-2">{t('La publication reste au restaurant — vous validez, il met en ligne.')}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
