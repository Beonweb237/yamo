import { useCallback, useEffect, useState } from 'react';
import { BadgePercent, Plus, Pencil, Trash2, Loader2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  fetchAllPromotions, createPromotion, updatePromotion, deletePromotion,
  promoBenefitLabel, type Promotion, type PromotionInput, type PromotionType,
} from '../../lib/promotions';
import { useRestaurants } from '../../hooks/useCatalog';
import { Switch } from '../../components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/alert-dialog';

const EMPTY: PromotionInput = {
  code: '', title: '', type: 'percent', discountPercent: 10, discountAmount: 0,
  minSubtotal: 0, restaurantIds: null, startsAt: null, endsAt: null, isActive: true,
};

const inputCls = 'w-full h-10 px-3 rounded-lg border border-border-custom bg-white font-inter text-sm text-text-primary outline-none focus:border-green-primary';

export default function AdminPromotions() {
  const { t } = useTranslation();
  const { restaurants } = useRestaurants();
  const [list, setList] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<PromotionInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Promotion | null>(null);

  const load = useCallback(() => {
    fetchAllPromotions()
      .then((rows) => { setList(rows); setError(''); })
      .catch((e) => setError(e instanceof Error ? e.message : t('Chargement impossible.')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const startCreate = () => { setForm(EMPTY); setEditingId(null); setFormOpen(true); };
  const startEdit = (p: Promotion) => {
    setForm({
      code: p.code, title: p.title ?? '', type: p.type,
      discountPercent: p.discountPercent ?? 0, discountAmount: p.discountAmount ?? 0,
      minSubtotal: p.minSubtotal ?? 0, restaurantIds: p.restaurantIds ?? null,
      startsAt: p.startsAt ? p.startsAt.slice(0, 10) : null,
      endsAt: p.endsAt ? p.endsAt.slice(0, 10) : null,
      isActive: p.isActive,
    });
    setEditingId(p.id);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.code.trim()) { toast.error(t('Le code est requis.')); return; }
    if (form.type === 'percent' && !(form.discountPercent && form.discountPercent > 0)) {
      toast.error(t('Indiquez un pourcentage de remise.')); return;
    }
    if (form.type === 'amount' && !(form.discountAmount && form.discountAmount > 0)) {
      toast.error(t('Indiquez un montant de remise.')); return;
    }
    setSaving(true);
    try {
      const payload: PromotionInput = {
        ...form,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt ? `${form.endsAt.slice(0, 10)}T23:59:59` : null,
      };
      if (editingId) {
        await updatePromotion(editingId, payload);
        toast.success(t('Promotion mise à jour.'));
      } else {
        await createPromotion(payload);
        toast.success(t('Promotion créée.'));
      }
      setFormOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Enregistrement impossible.'));
    } finally { setSaving(false); }
  };

  const toggleActive = async (p: Promotion) => {
    try {
      await updatePromotion(p.id, {
        code: p.code, title: p.title ?? '', type: p.type,
        discountPercent: p.discountPercent, discountAmount: p.discountAmount,
        minSubtotal: p.minSubtotal, restaurantIds: p.restaurantIds ?? null,
        startsAt: p.startsAt, endsAt: p.endsAt, isActive: !p.isActive,
      });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Mise à jour impossible.'));
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deletePromotion(toDelete.id);
      toast.success(t('Promotion supprimée.'));
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Suppression impossible.'));
    }
  };

  const restoName = (ids?: string[] | null) => {
    if (!ids?.length) return t('Tous les restaurants');
    return ids.map((id) => restaurants.find((r) => r.id === id)?.name ?? id).join(', ');
  };

  const periodLabel = (p: Promotion) => {
    if (!p.startsAt && !p.endsAt) return t('Sans limite de durée');
    const fmt = (d: string) => new Date(d).toLocaleDateString();
    if (p.startsAt && p.endsAt) return `${fmt(p.startsAt)} → ${fmt(p.endsAt)}`;
    if (p.endsAt) return `${t('Jusqu\'au')} ${fmt(p.endsAt)}`;
    return `${t('À partir du')} ${fmt(p.startsAt as string)}`;
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-green-light flex items-center justify-center text-green-primary shrink-0">
            <BadgePercent className="w-5 h-5" />
          </span>
          <div>
            <h1 className="font-poppins font-semibold text-text-primary text-xl">{t('Promotions')}</h1>
            <p className="text-text-secondary font-inter text-sm">{t('Offres réelles, vérifiées à la validation de commande et affichées sur l\'accueil Premium.')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-green-primary text-white font-inter text-sm font-medium hover:bg-green-dark transition-colors"
        >
          <Plus className="w-4 h-4" />{t('Nouvelle promotion')}
        </button>
      </div>

      {/* Formulaire création/édition */}
      {formOpen && (
        <div className="bg-white rounded-2xl border border-border-custom p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-inter font-semibold text-text-primary text-sm">
              {editingId ? t('Modifier la promotion') : t('Nouvelle promotion')}
            </h2>
            <button type="button" onClick={() => setFormOpen(false)} aria-label={t('Fermer')} className="w-8 h-8 rounded-lg hover:bg-bg-secondary flex items-center justify-center text-text-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-text-muted font-inter text-xs mb-1">{t('Code (ex. AKWA1000)')}</span>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={24} spellCheck={false} className={`${inputCls} font-mono uppercase`} />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-text-muted font-inter text-xs mb-1">{t('Titre affiché (ex. -10% sur votre commande)')}</span>
              <input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-text-muted font-inter text-xs mb-1">{t('Type d\'offre')}</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PromotionType })} className={inputCls}>
                <option value="percent">{t('Pourcentage (-X%)')}</option>
                <option value="amount">{t('Montant fixe (-X FCFA)')}</option>
                <option value="free_delivery">{t('Livraison offerte')}</option>
              </select>
            </label>
            {form.type === 'percent' && (
              <label className="block">
                <span className="block text-text-muted font-inter text-xs mb-1">{t('Remise (%)')}</span>
                <input type="number" min={1} max={100} value={form.discountPercent ?? 0} onChange={(e) => setForm({ ...form, discountPercent: parseInt(e.target.value) || 0 })} className={inputCls} />
              </label>
            )}
            {form.type === 'amount' && (
              <label className="block">
                <span className="block text-text-muted font-inter text-xs mb-1">{t('Remise (FCFA)')}</span>
                <input type="number" min={100} step={100} value={form.discountAmount ?? 0} onChange={(e) => setForm({ ...form, discountAmount: parseInt(e.target.value) || 0 })} className={inputCls} />
              </label>
            )}
            <label className="block">
              <span className="block text-text-muted font-inter text-xs mb-1">{t('Minimum d\'articles (FCFA)')}</span>
              <input type="number" min={0} step={500} value={form.minSubtotal ?? 0} onChange={(e) => setForm({ ...form, minSubtotal: parseInt(e.target.value) || 0 })} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-text-muted font-inter text-xs mb-1">{t('Restaurant ciblé')}</span>
              <select
                value={form.restaurantIds?.[0] ?? ''}
                onChange={(e) => setForm({ ...form, restaurantIds: e.target.value ? [e.target.value] : null })}
                className={inputCls}
              >
                <option value="">{t('Tous les restaurants')}</option>
                {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-text-muted font-inter text-xs mb-1">{t('Début (optionnel)')}</span>
              <input type="date" value={form.startsAt?.slice(0, 10) ?? ''} onChange={(e) => setForm({ ...form, startsAt: e.target.value || null })} className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-text-muted font-inter text-xs mb-1">{t('Fin (optionnel)')}</span>
              <input type="date" value={form.endsAt?.slice(0, 10) ?? ''} onChange={(e) => setForm({ ...form, endsAt: e.target.value || null })} className={inputCls} />
            </label>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={form.isActive !== false} onCheckedChange={(v) => setForm({ ...form, isActive: v })} aria-label={t('Promotion active')} />
              <span className="text-text-secondary font-inter text-sm">{t('Active')}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-green-primary text-white font-inter text-sm font-medium hover:bg-green-dark transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {editingId ? t('Enregistrer les modifications') : t('Créer la promotion')}
          </button>
        </div>
      )}

      {/* Liste */}
      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-white border border-border-custom animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-border-custom p-6 text-center">
            <p className="text-error font-inter text-sm mb-3">{error}</p>
            <button type="button" onClick={() => { setLoading(true); load(); }} className="text-green-primary font-inter text-sm font-medium hover:underline">{t('Réessayer')}</button>
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border-custom p-8 text-center">
            <BadgePercent className="w-10 h-10 text-text-muted/40 mx-auto mb-3" />
            <p className="font-inter text-text-secondary text-sm">{t('Aucune promotion. Créez votre première offre — elle apparaîtra sur l\'accueil et s\'appliquera au checkout.')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((p) => (
              <li key={p.id} className="flex items-center gap-3 bg-white rounded-2xl border border-border-custom px-4 py-3 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-text-primary text-sm">{p.code}</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-light text-green-primary">{t(promoBenefitLabel(p))}</span>
                    {!p.isActive && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-bg-secondary text-text-muted">{t('Inactive')}</span>}
                  </div>
                  <p className="text-text-muted font-inter text-xs mt-0.5 truncate">
                    {p.title ? `${p.title} · ` : ''}{restoName(p.restaurantIds)} · {periodLabel(p)}
                    {p.minSubtotal ? ` · ${t('min.')} ${p.minSubtotal.toLocaleString()} FCFA` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch checked={p.isActive} onCheckedChange={() => toggleActive(p)} aria-label={t('Activer {{code}}', { code: p.code })} />
                  <button type="button" onClick={() => startEdit(p)} aria-label={t('Modifier {{code}}', { code: p.code })} className="w-9 h-9 rounded-lg hover:bg-bg-secondary flex items-center justify-center text-text-secondary">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setToDelete(p)} aria-label={t('Supprimer {{code}}', { code: p.code })} className="w-9 h-9 rounded-lg hover:bg-red-50 flex items-center justify-center text-error">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Supprimer cette promotion ?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Le code {{code}} ne sera plus accepté au checkout. Cette action est définitive.', { code: toDelete?.code ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-error hover:bg-error/90">{t('Supprimer')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
