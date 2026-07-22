import { useState } from 'react';
import { useNavigate, useParams, Navigate, Link } from 'react-router-dom';
import { ArrowLeft, Store, Bike, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../../hooks/useSeo';
import { createAdminAccount } from '../../lib/admin';
import { ADMIN_DEFAULT_PASSWORD } from '../../contexts/AuthContext';
import { displayCameroonPhone, normalizeCameroonPhone } from '../../lib/phone';
import type { ApplicationType } from '../../lib/applications';
import DocumentUploader from '../../components/DocumentUploader';
import { KYC_DOC_KEYS, KYC_DOC_REQUIRED, KYC_DOC_LABELS, attachKycDocument } from '../../lib/kyc';

// Création directe d'un livreur/restaurant validé — PAGE ENTIÈRE (remplace
// l'ancienne modale de AdminApplications). Le rôle vient de l'URL.
export default function AdminApplicationCreate() {
  const { t } = useTranslation();
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();

  const isRestaurant = role === 'restaurant';
  const type: ApplicationType | null = role === 'restaurant' ? 'restaurant' : role === 'livreur' ? 'livreur' : null;

  useSeo({ title: isRestaurant ? t('Créer un restaurant validé') : t('Créer un livreur validé'), noindex: true });

  const [form, setForm] = useState({
    applicantName: '',
    restaurantName: '',
    contactPhone: '',
    city: 'Douala',
    neighborhood: '',
    address: '',
    notes: '',
    password: ADMIN_DEFAULT_PASSWORD,
  });
  const [creating, setCreating] = useState(false);
  const [docs, setDocs] = useState<Record<string, string | null>>({});

  // Rôle inconnu dans l'URL → retour à la liste.
  if (!type) return <Navigate to="/admin/applications" replace />;

  const docKeys = KYC_DOC_KEYS[type];
  const requiredDocs = KYC_DOC_REQUIRED[type];

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const contactPhone = normalizeCameroonPhone(form.contactPhone);
    if (!contactPhone) { toast.error(t('Le téléphone est requis.')); return; }
    if (type === 'livreur' && !form.applicantName.trim()) { toast.error(t('Le nom du livreur est requis.')); return; }
    if (type === 'restaurant' && !form.restaurantName.trim()) { toast.error(t('Le nom du restaurant est requis.')); return; }

    setCreating(true);
    try {
      const result = await createAdminAccount({
        type,
        applicantName: form.applicantName.trim() || form.restaurantName.trim(),
        restaurantName: type === 'restaurant' ? form.restaurantName.trim() : undefined,
        contactPhone,
        city: form.city.trim() || undefined,
        neighborhood: form.neighborhood.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
        password: form.password || ADMIN_DEFAULT_PASSWORD,
      });
      if (!result) throw new Error(t('Création directe disponible uniquement en mode VPS.'));
      // Rattacher les pièces jointes au dossier KYC (l'application vient d'être créée).
      const appId = result.application?.id;
      const staged = Object.entries(docs).filter(([, url]) => !!url) as [string, string][];
      if (appId && staged.length) {
        const results = await Promise.allSettled(staged.map(([docKey, url]) => attachKycDocument(appId, docKey, url)));
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed) toast.warning(t('Compte créé, mais {{n}} pièce(s) non enregistrée(s).', { n: failed }));
      }
      toast.success(type === 'restaurant' ? t('Restaurant créé et validé') : t('Livreur créé et validé'));
      navigate('/admin/applications');
    } catch (err) {
      toast.error((err as Error).message || t('Création impossible'));
    } finally {
      setCreating(false);
    }
  };

  const Icon = isRestaurant ? Store : Bike;
  const inputCls = 'w-full bg-bg-secondary rounded-lg px-3 h-11 text-text-primary font-inter text-sm outline-none focus:ring-2 focus:ring-green-primary/15 border border-transparent focus:border-green-primary/40 transition';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Retour + en-tête */}
      <Link to="/admin/applications" className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm font-inter mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('Retour aux candidatures')}
      </Link>

      <div className="flex items-center gap-3 mb-1">
        <div className="w-11 h-11 rounded-xl bg-green-light flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-green-primary" />
        </div>
        <h1 className="font-poppins font-bold text-text-primary text-xl sm:text-2xl">
          {isRestaurant ? t('Créer un restaurant validé') : t('Créer un livreur validé')}
        </h1>
      </div>
      <p className="text-text-secondary text-sm font-inter mb-6">
        {t('Le compte est créé avec mot de passe, candidature approuvée, et accès immédiat au tableau de bord.')}
      </p>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2">
            <span className="block text-text-muted text-xs font-inter mb-1">{isRestaurant ? t('Nom du responsable') : t('Nom complet')}</span>
            <input value={form.applicantName} onChange={(e) => update('applicantName', e.target.value)} className={inputCls} placeholder="Ex: Alain M. Talla" />
          </label>

          {isRestaurant && (
            <label className="block sm:col-span-2">
              <span className="block text-text-muted text-xs font-inter mb-1">{t('Nom du restaurant')}</span>
              <input value={form.restaurantName} onChange={(e) => update('restaurantName', e.target.value)} className={inputCls} placeholder="Ex: Saveurs du Mboa" />
            </label>
          )}

          <label className="block">
            <span className="block text-text-muted text-xs font-inter mb-1">{t('Téléphone')}</span>
            <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-11 border border-transparent focus-within:border-green-primary/40 focus-within:ring-2 focus-within:ring-green-primary/15 transition">
              <span className="text-text-primary font-inter text-sm font-semibold shrink-0">+237</span>
              <input value={displayCameroonPhone(form.contactPhone)} onChange={(e) => update('contactPhone', normalizeCameroonPhone(e.target.value))} className="flex-1 min-w-0 bg-transparent text-text-primary font-inter text-sm outline-none" placeholder="690000000" inputMode="tel" />
            </div>
          </label>

          <label className="block">
            <span className="block text-text-muted text-xs font-inter mb-1">{t('Mot de passe')}</span>
            <input value={form.password} onChange={(e) => update('password', e.target.value)} className={inputCls} placeholder={ADMIN_DEFAULT_PASSWORD} />
          </label>

          <label className="block">
            <span className="block text-text-muted text-xs font-inter mb-1">{t('Ville')}</span>
            <input value={form.city} onChange={(e) => update('city', e.target.value)} className={inputCls} placeholder="Douala" />
          </label>

          <label className="block">
            <span className="block text-text-muted text-xs font-inter mb-1">{t('Quartier')}</span>
            <input value={form.neighborhood} onChange={(e) => update('neighborhood', e.target.value)} className={inputCls} placeholder="Bonamoussadi" />
          </label>

          <label className="block sm:col-span-2">
            <span className="block text-text-muted text-xs font-inter mb-1">{t('Adresse')}</span>
            <input value={form.address} onChange={(e) => update('address', e.target.value)} className={inputCls} placeholder={t('Adresse opérationnelle')} />
          </label>

          <label className="block sm:col-span-2">
            <span className="block text-text-muted text-xs font-inter mb-1">{t('Notes internes')}</span>
            <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none border border-transparent focus:border-green-primary/40 focus:ring-2 focus:ring-green-primary/15 transition" placeholder={t("Infos utiles pour l'équipe admin")} />
          </label>
        </div>

        {/* Pièces jointes / documents KYC */}
        <div className="mt-6 pt-5 border-t border-border-custom">
          <h2 className="font-poppins font-semibold text-text-primary text-sm mb-1">{t('Documents (KYC)')}</h2>
          <p className="text-text-muted text-xs font-inter mb-4">{t('Photos des pièces justificatives. Vérifiables ensuite dans le Centre KYC.')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {docKeys.map((key) => (
              <DocumentUploader
                key={key}
                label={t(KYC_DOC_LABELS[key])}
                required={requiredDocs.includes(key)}
                value={docs[key] ?? null}
                onChange={(url) => setDocs((prev) => ({ ...prev, [key]: url }))}
                disabled={creating}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-6">
          <button type="button" onClick={() => navigate('/admin/applications')} disabled={creating} className="px-4 h-11 rounded-lg border border-border-custom text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors disabled:opacity-60">
            {t('Annuler')}
          </button>
          <button type="submit" disabled={creating} className="inline-flex items-center justify-center gap-1.5 px-5 h-11 rounded-lg bg-green-primary text-white font-inter text-sm font-medium hover:bg-green-dark transition-colors disabled:opacity-60">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {t('Créer et valider')}
          </button>
        </div>
      </form>
    </div>
  );
}
