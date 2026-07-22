import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Store, Bike, ShieldCheck, ShieldX, Check, X, Loader2, Pencil, Save, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../../hooks/useSeo';
import DocumentUploader from '../../components/DocumentUploader';
import { updateRestaurantProfile } from '../../lib/catalog';
import {
  fetchKycDossier, attachKycDocument, reviewKycDocument, setKycDossierStatus, updateUserProfile,
  KYC_DOC_LABELS, KYC_STATUS_LABELS, type KycDossier, type KycDossierStatus,
} from '../../lib/kyc';

const STATUS_STYLE: Record<KycDossierStatus, string> = {
  incomplet: 'bg-bg-secondary text-text-muted',
  a_verifier: 'bg-amber-50 text-amber-700',
  verifie: 'bg-green-light text-green-primary',
  rejete: 'bg-red-50 text-red-700',
};

export default function AdminKycDossier() {
  const { t } = useTranslation();
  const { applicationId = '' } = useParams();
  const navigate = useNavigate();
  useSeo({ title: t('Dossier KYC'), noindex: true });

  const [d, setD] = useState<KycDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({ name: '', phone: '', city: '', neighborhood: '', address: '', category: '', serviceNeighborhoods: '' });

  const load = () => {
    setLoading(true);
    fetchKycDossier(applicationId)
      .then((data) => { setD(data); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [applicationId]);

  const startEdit = () => {
    if (!d) return;
    setEdit({
      name: (d.type === 'restaurant' ? d.restaurantName : d.name) || '',
      phone: d.phone || '',
      city: d.city || '',
      neighborhood: d.neighborhood || '',
      address: d.address || '',
      category: d.category || '',
      serviceNeighborhoods: (d.serviceNeighborhoods || []).join(', '),
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!d) return;
    setBusy(true);
    try {
      if (d.type === 'restaurant' && d.restaurantId) {
        await updateRestaurantProfile(d.restaurantId, {
          name: edit.name.trim(), phone: edit.phone.trim(), city: edit.city.trim(),
          neighborhood: edit.neighborhood.trim(), address: edit.address.trim(), category: edit.category.trim(),
        });
      }
      if (d.userId) {
        await updateUserProfile(d.userId, {
          fullName: edit.name.trim() || undefined,
          phone: edit.phone.trim() || undefined,
          city: edit.city.trim() || undefined,
          serviceNeighborhoods: d.type === 'livreur'
            ? edit.serviceNeighborhoods.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
        });
      }
      toast.success(t('Profil mis à jour'));
      setEditing(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Enregistrement impossible'));
    } finally { setBusy(false); }
  };

  const onUpload = async (docKey: string, url: string | null) => {
    if (!url) return; // suppression de pièce non gérée ici (remplacement uniquement)
    setBusy(true);
    try {
      await attachKycDocument(applicationId, docKey, url);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Upload échoué'));
    } finally { setBusy(false); }
  };

  const review = async (docKey: string, status: 'approved' | 'rejected', note?: string) => {
    setBusy(true);
    try {
      await reviewKycDocument(applicationId, docKey, status, note);
      setRejecting(null); setRejectNote('');
      toast.success(status === 'approved' ? t('Pièce validée') : t('Pièce refusée'));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Action impossible'));
    } finally { setBusy(false); }
  };

  const mark = async (status: KycDossierStatus) => {
    setBusy(true);
    try {
      await setKycDossierStatus(applicationId, status);
      toast.success(t('Statut du dossier mis à jour'));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Action impossible'));
    } finally { setBusy(false); }
  };

  if (loading) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin text-green-primary" /></div>;
  if (error || !d) return (
    <div className="p-8 max-w-2xl mx-auto text-center">
      <p className="font-poppins font-semibold text-text-primary mb-2">{t('Dossier introuvable')}</p>
      <p className="text-text-muted text-sm mb-4">{error}</p>
      <Link to="/admin/kyc" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-green-primary text-white text-sm font-semibold"><ArrowLeft className="w-4 h-4" />{t('Retour au Centre KYC')}</Link>
    </div>
  );

  const Icon = d.type === 'restaurant' ? Store : Bike;
  const inputCls = 'w-full bg-bg-secondary rounded-lg px-3 h-10 text-text-primary font-inter text-sm outline-none border border-transparent focus:border-green-primary/40';
  const byKey = (k: string) => d.documents.find((x) => x.docKey === k);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <Link to="/admin/kyc" className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary text-sm mb-4"><ArrowLeft className="w-4 h-4" />{t('Retour au Centre KYC')}</Link>

      {/* En-tête */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="w-12 h-12 rounded-xl bg-bg-secondary grid place-items-center shrink-0 overflow-hidden">
          {d.photoUrl ? <img src={d.photoUrl} alt="" className="w-full h-full object-cover" /> : <Icon className="w-6 h-6 text-text-muted" />}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-poppins font-bold text-text-primary text-lg sm:text-xl truncate">
            {(d.type === 'restaurant' ? d.restaurantName : d.name) || t('Sans nom')}
          </h1>
          <p className="text-text-muted text-xs">{t(d.type === 'restaurant' ? 'Restaurant' : 'Livreur')}{d.phone ? ` · ${d.phone}` : ''}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[d.kycStatus]}`}>{t(KYC_STATUS_LABELS[d.kycStatus])}</span>
      </div>

      {/* Infos profil + édition */}
      <div className="bg-white rounded-2xl border border-border-custom p-4 sm:p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-poppins font-semibold text-text-primary text-sm">{t('Informations du profil')}</h2>
          {!editing ? (
            <button onClick={startEdit} className="inline-flex items-center gap-1.5 text-sm text-green-primary font-medium"><Pencil className="w-4 h-4" />{t('Modifier')}</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} disabled={busy} className="text-sm text-text-secondary">{t('Annuler')}</button>
              <button onClick={saveEdit} disabled={busy} className="inline-flex items-center gap-1.5 text-sm text-white bg-green-primary rounded-lg px-3 h-8 font-medium disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{t('Enregistrer')}
              </button>
            </div>
          )}
        </div>
        {!editing ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Info label={t('Nom')} value={(d.type === 'restaurant' ? d.restaurantName : d.name) || '—'} />
            <Info label={t('Téléphone')} value={d.phone || '—'} />
            <Info label={t('Ville')} value={d.city || '—'} />
            <Info label={t('Quartier')} value={d.neighborhood || (d.serviceNeighborhoods || []).join(', ') || '—'} />
            {d.type === 'restaurant' && <Info label={t('Catégorie')} value={d.category || '—'} />}
            {d.address && <Info label={t('Adresse')} value={d.address} />}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('Nom')}><input className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label={t('Téléphone')}><input className={inputCls} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label={t('Ville')}><input className={inputCls} value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></Field>
            {d.type === 'restaurant' ? (
              <>
                <Field label={t('Quartier')}><input className={inputCls} value={edit.neighborhood} onChange={(e) => setEdit({ ...edit, neighborhood: e.target.value })} /></Field>
                <Field label={t('Catégorie')}><input className={inputCls} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></Field>
                <Field label={t('Adresse')} full><input className={inputCls} value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
              </>
            ) : (
              <Field label={t('Quartiers desservis (séparés par des virgules)')} full><input className={inputCls} value={edit.serviceNeighborhoods} onChange={(e) => setEdit({ ...edit, serviceNeighborhoods: e.target.value })} /></Field>
            )}
          </div>
        )}
      </div>

      {/* Documents / validation pièce par pièce */}
      <div className="bg-white rounded-2xl border border-border-custom p-4 sm:p-5 mb-4">
        <h2 className="font-poppins font-semibold text-text-primary text-sm mb-3">{t('Pièces justificatives')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {d.expectedDocKeys.map((key) => {
            const doc = byKey(key);
            return (
              <div key={key}>
                <DocumentUploader
                  label={t(KYC_DOC_LABELS[key])}
                  value={doc?.url ?? null}
                  onChange={(url) => onUpload(key, url)}
                  status={doc?.status}
                  statusNote={doc?.note}
                  disabled={busy}
                />
                {doc && (
                  rejecting === key ? (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder={t('Motif du refus')} className="w-full bg-bg-secondary rounded-lg px-3 h-9 text-sm outline-none border border-red-200" />
                      <div className="flex gap-2">
                        <button onClick={() => review(key, 'rejected', rejectNote)} disabled={busy} className="flex-1 h-8 rounded-lg bg-red-600 text-white text-xs font-medium disabled:opacity-60">{t('Confirmer le refus')}</button>
                        <button onClick={() => { setRejecting(null); setRejectNote(''); }} className="h-8 px-3 rounded-lg border border-border-custom text-xs">{t('Annuler')}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => review(key, 'approved')} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-lg bg-green-primary text-white text-xs font-medium disabled:opacity-60"><Check className="w-3.5 h-3.5" />{t('Valider')}</button>
                      <button onClick={() => { setRejecting(key); setRejectNote(''); }} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-lg border border-red-200 text-red-700 text-xs font-medium"><X className="w-3.5 h-3.5" />{t('Refuser')}</button>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Statuer le dossier */}
      <div className="bg-white rounded-2xl border border-border-custom p-4 sm:p-5">
        <h2 className="font-poppins font-semibold text-text-primary text-sm mb-3">{t('Décision sur le dossier')}</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => mark('verifie')} disabled={busy} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-green-primary text-white text-sm font-semibold disabled:opacity-60"><ShieldCheck className="w-4 h-4" />{t('Marquer vérifié')}</button>
          <button onClick={() => mark('rejete')} disabled={busy} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-red-200 text-red-700 text-sm font-semibold disabled:opacity-60"><ShieldX className="w-4 h-4" />{t('Rejeter le dossier')}</button>
          <button onClick={() => mark('a_verifier')} disabled={busy} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-border-custom text-text-secondary text-sm font-medium disabled:opacity-60"><RefreshCw className="w-4 h-4" />{t('Remettre à vérifier')}</button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-text-muted text-xs">{label}</span><span className="block text-text-primary font-medium truncate">{value}</span></div>;
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? 'sm:col-span-2' : ''}`}><span className="block text-text-muted text-xs mb-1">{label}</span>{children}</label>;
}
