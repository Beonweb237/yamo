import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Pause, Play, X, CalendarDays, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useSeo } from '../hooks/useSeo';
import {
  fetchMySubscriptions, pauseSubscription, resumeSubscription, cancelSubscription,
  SUBSCRIPTION_STATUS_LABELS, type Subscription, type SubscriptionStatus,
} from '../lib/subscriptions';

const STATUS_STYLE: Record<SubscriptionStatus, string> = {
  active: 'bg-green-light text-green-primary', paused: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-700', completed: 'bg-bg-secondary text-text-muted',
};

export default function Subscriptions() {
  const { t } = useTranslation();
  useSeo({ title: t('Mes abonnements'), noindex: true });
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchMySubscriptions().then((s) => { setSubs(s); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : 'Erreur')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, fn: (id: string) => Promise<unknown>, msg: string) => {
    setBusy(id);
    try { await fn(id); toast.success(msg); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('Action impossible')); }
    finally { setBusy(null); }
  };

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between gap-2 mb-5 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-primary/10 grid place-items-center"><HeartPulse className="w-6 h-6 text-green-primary" /></div>
            <h1 className="font-poppins font-bold text-text-primary text-xl sm:text-2xl">{t('Mes abonnements')}</h1>
          </div>
          <Link to="/programmes" className="text-sm font-medium text-green-primary">{t('Découvrir les programmes')}</Link>
        </div>

        {loading ? (
          <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 bg-white rounded-2xl border border-border-custom animate-pulse" />)}</div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-red-200 p-6 text-center text-text-muted">{error}</div>
        ) : subs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border-custom p-10 text-center">
            <HeartPulse className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="font-poppins font-semibold text-text-primary mb-1">{t('Aucun abonnement')}</p>
            <p className="text-text-muted text-sm mb-4">{t('Souscrivez à un programme repas adapté à vos besoins.')}</p>
            <Link to="/programmes" className="inline-flex h-10 px-4 rounded-xl bg-green-primary text-white text-sm font-semibold items-center">{t('Voir les programmes')}</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {subs.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-border-custom p-4 flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-bg-secondary overflow-hidden grid place-items-center shrink-0">
                  {s.programPhoto ? <img src={s.programPhoto} alt="" className="w-full h-full object-cover" /> : <HeartPulse className="w-6 h-6 text-text-muted/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-poppins font-semibold text-text-primary text-sm truncate">{s.programName}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status]}`}>{t(SUBSCRIPTION_STATUS_LABELS[s.status])}</span>
                  </div>
                  <p className="text-text-muted text-xs truncate">{s.restaurantName}</p>
                  <p className="text-text-muted text-xs inline-flex items-center gap-1.5 mt-1">
                    <CalendarDays className="w-3.5 h-3.5" />{s.deliveriesDone ?? 0}/{s.deliveriesTotal ?? 0} {t('livraisons')}
                    {s.nextDeliveryAt && s.status === 'active' && ` · ${t('prochaine')} ${new Date(s.nextDeliveryAt).toLocaleDateString('fr-FR')}`}
                  </p>
                  {(s.status === 'active' || s.status === 'paused') && (
                    <div className="flex gap-2 mt-3">
                      {s.status === 'active' ? (
                        <button onClick={() => act(s.id, pauseSubscription, t('Abonnement mis en pause'))} disabled={busy === s.id} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border-custom text-text-secondary text-xs font-medium disabled:opacity-60"><Pause className="w-3.5 h-3.5" />{t('Pause')}</button>
                      ) : (
                        <button onClick={() => act(s.id, resumeSubscription, t('Abonnement repris'))} disabled={busy === s.id} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-green-primary text-white text-xs font-medium disabled:opacity-60"><Play className="w-3.5 h-3.5" />{t('Reprendre')}</button>
                      )}
                      <button onClick={() => act(s.id, cancelSubscription, t('Abonnement annulé'))} disabled={busy === s.id} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-red-200 text-red-700 text-xs font-medium disabled:opacity-60"><X className="w-3.5 h-3.5" />{t('Annuler')}</button>
                    </div>
                  )}
                </div>
                <span className="font-poppins font-bold text-green-primary text-sm shrink-0">{s.priceFcfa.toLocaleString()} {t('FCFA')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
