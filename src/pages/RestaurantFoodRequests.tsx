import { useEffect, useState } from 'react';
import { UtensilsCrossed, Loader2, MapPin, Clock, MessageCircle, Check, Send, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../hooks/useSeo';
import { fetchOpenFoodRequests, submitBid, type FoodRequest } from '../lib/foodRequests';

function expiresIn(date: string, t: (k: string) => string) {
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return t('Expiré');
  const h = Math.floor(diff / 3600000);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}j`;
}

export default function RestaurantFoodRequests() {
  const { t } = useTranslation();
  useSeo({ title: t('Demandes sur mesure'), noindex: true });
  const [requests, setRequests] = useState<FoodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bidding, setBidding] = useState<FoodRequest | null>(null);
  const [price, setPrice] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true); setError(false);
    fetchOpenFoodRequests()
      .then(setRequests)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openBid = (r: FoodRequest) => {
    setBidding(r);
    // Point de départ = milieu de la fourchette annoncée par le client.
    setPrice(String(Math.round(((r.budgetMin || 0) + (r.budgetMax || 0)) / 2) || ''));
    setComment('');
  };

  const send = async () => {
    if (!bidding) return;
    const p = parseInt(price);
    if (!p || p <= 0) { toast.error(t('Indiquez un prix valide.')); return; }
    setSaving(true);
    try {
      await submitBid(bidding.id, { restaurantId: '', restaurantName: '', price: p, comment: comment.trim() || undefined });
      toast.success(t('Offre envoyée ! Le client sera notifié.'));
      setBidding(null); load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Envoi impossible'));
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h1 className="font-poppins font-bold text-text-primary text-2xl flex items-center gap-2">
          <UtensilsCrossed className="w-6 h-6 text-green-primary" />{t('Demandes sur mesure')}
        </h1>
        <button onClick={load} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border-custom text-text-secondary text-sm">
          <RefreshCw className="w-4 h-4" />{t('Actualiser')}
        </button>
      </div>
      <p className="text-text-muted text-sm mb-6">{t('Les clients de votre ville décrivent un plat ; proposez votre prix pour décrocher la commande.')}</p>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-28 bg-white rounded-xl border border-border-custom animate-pulse" />)}</div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
          <p className="text-text-muted text-sm mb-3">{t('Impossible de charger les demandes.')}</p>
          <button onClick={load} className="h-10 px-4 rounded-lg bg-green-primary text-white text-sm font-medium">{t('Réessayer')}</button>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border-custom p-10 text-center">
          <UtensilsCrossed className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="font-poppins font-semibold text-text-primary mb-1">{t('Aucune demande ouverte')}</p>
          <p className="text-text-muted text-sm">{t('Revenez plus tard : les nouvelles demandes de votre ville apparaîtront ici.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-border-custom p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-poppins font-semibold text-text-primary truncate">{r.title}</h3>
                <span className="shrink-0 inline-flex items-center gap-1 text-xs text-text-muted"><Clock className="w-3.5 h-3.5" />{expiresIn(r.expiresAt, t)}</span>
              </div>
              <p className="text-sm text-text-secondary line-clamp-2 mb-3">{r.description}</p>
              <div className="flex flex-wrap gap-3 text-xs text-text-muted mb-3">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{r.city}</span>
                <span className="flex items-center gap-1 font-medium text-text-primary">💰 {(r.budgetMin || 0).toLocaleString()} – {(r.budgetMax || 0).toLocaleString()} {t('FCFA')}</span>
                {(r.bidCount ?? 0) > 0 && <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{r.bidCount} {t('offre')}{(r.bidCount ?? 0) > 1 ? 's' : ''}</span>}
              </div>
              {r.dietaryTags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {r.dietaryTags.map((tag) => <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-bg-secondary text-text-secondary border border-border-custom">{tag}</span>)}
                </div>
              )}
              {r.hasBid ? (
                <span className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-green-light text-green-primary text-sm font-medium"><Check className="w-4 h-4" />{t('Offre envoyée')}</span>
              ) : (
                <button onClick={() => openBid(r)} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-green-primary text-white text-sm font-semibold">
                  <Send className="w-4 h-4" />{t('Soumissionner')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {bidding && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBidding(null)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-poppins font-bold text-text-primary">{t('Faire une offre')}</h3>
              <button onClick={() => setBidding(null)} className="text-text-muted"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-text-secondary truncate mb-4">{bidding.title}</p>
            <label className="block mb-3">
              <span className="block text-text-muted text-xs mb-1">{t('Votre prix (FCFA)')}</span>
              <input type="number" min={1} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-bg-secondary rounded-lg px-3 h-11 text-sm outline-none border border-transparent focus:border-green-primary/40" />
              <span className="block text-text-muted text-[11px] mt-1">{t('Budget annoncé :')} {(bidding.budgetMin || 0).toLocaleString()} – {(bidding.budgetMax || 0).toLocaleString()} {t('FCFA')}</span>
            </label>
            <label className="block mb-4">
              <span className="block text-text-muted text-xs mb-1">{t('Message au client (optionnel)')}</span>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder={t('Ex: Prêt en 45 min, ingrédients frais du jour.')}
                className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-sm outline-none resize-none border border-transparent focus:border-green-primary/40" />
            </label>
            <button onClick={send} disabled={saving} className="w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-green-primary text-white text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{t('Envoyer mon offre')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
