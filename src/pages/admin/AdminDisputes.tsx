import { usePolling } from '../../hooks/usePolling';
import { useState, useCallback, useMemo } from 'react';
import { AlertTriangle, Bike, Check } from 'lucide-react';
import { useRestaurants } from '../../hooks/useCatalog';
import { fetchAllOrders, resolveOrderDispute, applyGuaranteeDecision, type Order, type GuaranteeDecision } from '../../lib/orders';
import { fetchAllIncidents, resolveIncident, INCIDENT_LABELS, type DeliveryIncident } from '../../lib/incidents';
import { POINTS_CONFIG } from '../../data/launchConfig';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { toast } from 'sonner';
import { useTranslation } from "react-i18next";

type ResolveTarget =
  | { kind: 'incident'; id: string; label: string }
  | { kind: 'cancellation'; id: string; label: string };

export default function AdminDisputes() {
    const { t } = useTranslation();
  const { restaurants } = useRestaurants();
  const [orders, setOrders] = useState<Order[]>([]);
  const [incidents, setIncidents] = useState<DeliveryIncident[]>([]);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    setOrders(await fetchAllOrders());
    setIncidents(await fetchAllIncidents());
  }, []);
  usePolling(load, 30000);

  const restaurantNameById = useMemo(() => Object.fromEntries(restaurants.map((r) => [r.id, r.name])), [restaurants]);
  const orderById = useMemo(() => Object.fromEntries(orders.map((o) => [o.id, o])), [orders]);

  // Série PTS — arbitrage garanti : récap AVANT application (Dialog), puis
  // applyGuaranteeDecision (garantie + points + annulation) et clôture du litige.
  const [decisionTarget, setDecisionTarget] = useState<{ incident: DeliveryIncident; order: Order; decision: GuaranteeDecision } | null>(null);
  const [applyingDecision, setApplyingDecision] = useState(false);

  const DECISION_LABELS: Record<GuaranteeDecision, string> = {
    abusive_rejection: 'Rejet client abusif',
    restaurant_fault: 'Faute du restaurant',
    driver_fault: 'Faute du livreur',
  };

  const decisionPreview = (t: { order: Order; decision: GuaranteeDecision }): string[] => {
    const amount = t.order.guarantee?.amountFcfa ?? 0;
    if (t.decision === 'abusive_rejection') {
      const driverShare = Math.min(amount, t.order.deliveryFee);
      return [
        `Garantie de ${amount.toLocaleString()} FCFA confisquée au client.`,
        `Répartition (reversements manuels hors app) : ${driverShare.toLocaleString()} FCFA au livreur, ${(amount - driverShare).toLocaleString()} FCFA au restaurant.`,
        'Strike client : au 2e rejet abusif, son compte est suspendu.',
        'La commande est annulée (par le client) — points du resto restitués.',
      ];
    }
    if (t.decision === 'restaurant_fault') {
      return [
        `Garantie de ${amount.toLocaleString()} FCFA remboursée intégralement au client.`,
        `Remboursement prélevé sur la caution points du restaurant (${Math.ceil(amount / POINTS_CONFIG.POINT_PRICE_FCFA)} points).`,
        'La commande est annulée (par le restaurant) — pénalité de points appliquée.',
      ];
    }
    return [
      `Garantie de ${amount.toLocaleString()} FCFA remboursée intégralement au client.`,
      "Reversement organisé par l'assistance (la garantie a été encaissée par le restaurant).",
      'La commande est annulée (par MiamExpress) — points du resto restitués, pas de pénalité.',
    ];
  };

  const handleApplyDecision = async () => {
    if (!decisionTarget) return;
    setApplyingDecision(true);
    try {
      const result = await applyGuaranteeDecision(decisionTarget.order.id, decisionTarget.decision);
      const parts: string[] = [`Décision : ${DECISION_LABELS[decisionTarget.decision]}.`];
      if (decisionTarget.decision === 'abusive_rejection') {
        parts.push(`Répartition : ${result.driverShareFcfa.toLocaleString()} F livreur / ${result.restaurantShareFcfa.toLocaleString()} F resto (reversements manuels).`);
        parts.push(`Strikes client : ${result.customerStrikes}${result.customerSuspended ? ' — compte suspendu' : ''}.`);
      } else if (result.refundPointsConverted > 0) {
        parts.push(`${result.refundPointsConverted} points convertis depuis la caution du resto.`);
      } else if (result.refundShortfallFcfa > 0) {
        parts.push(`Remboursement de ${result.refundShortfallFcfa.toLocaleString()} F à organiser hors application.`);
      }
      await resolveIncident(decisionTarget.incident.id, parts.join(' '));
      toast.success(`Litige arbitré — ${DECISION_LABELS[decisionTarget.decision]}.`);
      setDecisionTarget(null);
      load();
    } catch (err) {
      toast.error((err as Error).message || "Impossible d'appliquer la décision.");
    } finally {
      setApplyingDecision(false);
    }
  };

  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const openCancellations = cancelled.filter((o) => !o.disputeResolved);
  const openIncidents = incidents.filter((i) => i.status === 'open');
  const visibleCancellations = showResolved ? cancelled : openCancellations;
  const visibleIncidents = showResolved ? incidents : openIncidents;

  // Résolution (CONF-20) : statut + note, commun aux deux types de litiges.
  const [resolveTarget, setResolveTarget] = useState<ResolveTarget | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const handleResolve = async () => {
    if (!resolveTarget) return;
    if (resolveTarget.kind === 'incident') {
      await resolveIncident(resolveTarget.id, resolutionNote);
    } else {
      await resolveOrderDispute(resolveTarget.id, resolutionNote);
    }
    setResolveTarget(null);
    toast.success('Litige marqué comme traité.');
    load();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="font-poppins font-bold text-text-primary text-2xl flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-gold-accent" />
          {t("Litiges")}
          <span className="text-sm font-inter font-medium text-text-muted">
            ({openIncidents.length + openCancellations.length} {t("ouvert")}{openIncidents.length + openCancellations.length !== 1 ? 's' : ''})
          </span>
        </h1>
        <label className="flex items-center gap-2 text-sm font-inter text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="w-4 h-4 accent-green-primary"
          />
          {t("Afficher les litiges traités")}
        </label>
      </div>

      {/* Incidents livreur (CONF-18/20) */}
      <div className="bg-white rounded-xl border border-border-custom p-5 mb-6">
        <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2">
          <Bike className="w-5 h-5 text-error" />
          {t("Incidents de livraison (")}{openIncidents.length} {t("ouvert")}{openIncidents.length !== 1 ? 's' : ''})
        </h2>
        {visibleIncidents.length === 0 ? (
          <p className="text-text-secondary text-sm">
            {showResolved ? 'Aucun incident signalé.' : 'Aucun incident ouvert.'}
          </p>
        ) : (
          <div className="divide-y divide-border-light">
            {visibleIncidents.map((incident) => (
              <div key={incident.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-inter font-semibold text-sm text-text-primary">
                    {INCIDENT_LABELS[incident.type]}
                    <span className="ml-2 text-text-muted text-xs font-normal">{t("Commande #")}{incident.orderId.slice(0, 8)}</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    {new Date(incident.createdAt).toLocaleString('fr-FR')} {t("· Livreur")} {incident.driverId.slice(0, 12)}
                  </p>
                  {incident.note && <p className="text-xs text-text-secondary font-inter mt-1 italic">"{incident.note}"</p>}
                  {incident.reportedBy === 'customer' && (
                    <p className="text-[11px] text-amber-700 font-inter mt-0.5">{t("Signalé par le client")}</p>
                  )}
                  {incident.status === 'resolved' && incident.resolutionNote && (
                    <p className="text-xs text-green-primary font-inter mt-1">{t("Traitement :")} {incident.resolutionNote}</p>
                  )}
                  {/* Série PTS — arbitrage d'un litige portant sur une commande garantie :
                      la décision applique en une action garantie + points + annulation. */}
                  {incident.status === 'open' && (() => {
                    const order = orderById[incident.orderId];
                    const g = order?.guarantee;
                    if (!order || !g || !['declared', 'confirmed'].includes(g.status)) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[11px] font-inter text-text-muted">
                          {t("Garantie")} {g.amountFcfa.toLocaleString()} {t("FCFA en jeu — décision :")}
                        </span>
                        <button
                          onClick={() => setDecisionTarget({ incident, order, decision: 'abusive_rejection' })}
                          className="text-[11px] font-inter font-semibold px-2.5 py-1.5 rounded-lg border border-error text-error hover:bg-error/5 transition-colors"
                        >
                          {t("Rejet client abusif")}
                        </button>
                        <button
                          onClick={() => setDecisionTarget({ incident, order, decision: 'restaurant_fault' })}
                          className="text-[11px] font-inter font-semibold px-2.5 py-1.5 rounded-lg border border-border-custom text-text-secondary hover:bg-bg-secondary transition-colors"
                        >
                          {t("Faute restaurant")}
                        </button>
                        <button
                          onClick={() => setDecisionTarget({ incident, order, decision: 'driver_fault' })}
                          className="text-[11px] font-inter font-semibold px-2.5 py-1.5 rounded-lg border border-border-custom text-text-secondary hover:bg-bg-secondary transition-colors"
                        >
                          {t("Faute livreur")}
                        </button>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-inter font-medium px-2.5 py-1 rounded-full ${incident.status === 'open' ? 'bg-error/10 text-error' : 'bg-green-light text-green-primary'}`}>
                    {incident.status === 'open' ? 'Ouvert' : 'Résolu'}
                  </span>
                  {incident.status === 'open' && (
                    <button
                      onClick={() => { setResolutionNote(''); setResolveTarget({ kind: 'incident', id: incident.id, label: `${INCIDENT_LABELS[incident.type]} — commande #${incident.orderId.slice(0, 8)}` }); }}
                      className="flex items-center gap-1 bg-green-light text-green-primary font-inter font-medium text-xs px-3 h-8 rounded-lg hover:bg-green-primary hover:text-white transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />{t("Traiter")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Annulations (CONF-20) */}
      <div className="bg-white rounded-xl border border-border-custom p-5">
        <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">
          {t("Commandes annulées (")}{openCancellations.length} {t("à traiter)")}
        </h2>
        {visibleCancellations.length === 0 ? (
          <p className="text-text-secondary text-sm">
            {showResolved ? 'Aucune commande annulée.' : 'Aucune annulation à traiter.'}
          </p>
        ) : (
          <div className="divide-y divide-border-light">
            {visibleCancellations.map((order) => (
              <div key={order.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-inter font-semibold text-sm text-text-primary">
                    #{order.id.slice(0, 8)}
                    <span className="ml-2 text-text-muted text-xs font-normal">{restaurantNameById[order.restaurantId] ?? '—'}</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    {new Date(order.createdAt).toLocaleString('fr-FR')}
                    {order.paymentMethod && <span className="ml-2">· {order.paymentMethod === 'cash' ? 'Espèces' : order.paymentMethod === 'mtn_momo' ? 'MTN MoMo' : 'Orange Money'}</span>}
                  </p>
                  {order.cancellationReason ? (
                    <p className="text-xs text-text-secondary font-inter mt-1">
                      {t("Annulée par")}{' '}
                      <span className="font-medium text-text-primary">
                        {order.cancelledBy === 'customer' ? 'le client' : order.cancelledBy === 'restaurant' ? 'le restaurant' : order.cancelledBy === 'admin' ? "l'admin" : '—'}
                      </span>
                      {' '}{t("· Motif :")} <span className="font-medium text-text-primary">{order.cancellationReason}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted font-inter mt-1 italic">{t("Motif non renseigné (annulation antérieure)")}</p>
                  )}
                  {order.disputeResolved && order.disputeResolutionNote && (
                    <p className="text-xs text-green-primary font-inter mt-1">{t("Traitement :")} {order.disputeResolutionNote}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-inter font-semibold text-sm text-error">{order.total.toLocaleString()} {t("FCFA")}</span>
                  {order.disputeResolved ? (
                    <span className="text-xs font-inter font-medium px-2.5 py-1 rounded-full bg-green-light text-green-primary">{t("Traité")}</span>
                  ) : (
                    <button
                      onClick={() => { setResolutionNote(''); setResolveTarget({ kind: 'cancellation', id: order.id, label: `Annulation — commande #${order.id.slice(0, 8)}` }); }}
                      className="flex items-center gap-1 bg-green-light text-green-primary font-inter font-medium text-xs px-3 h-8 rounded-lg hover:bg-green-primary hover:text-white transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />{t("Traiter")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de traitement */}
      <AlertDialog open={!!resolveTarget} onOpenChange={(open) => { if (!open) setResolveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Marquer comme traité ?")}</AlertDialogTitle>
            <AlertDialogDescription>{resolveTarget?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="Note de traitement (remboursement effectué, client rappelé...) — optionnel"
            rows={3}
            autoFocus
            className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Annuler")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResolve} className="bg-green-primary text-white hover:bg-green-dark">
              {t("Marquer traité")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Série PTS — récapitulatif AVANT application d'une décision de garantie */}
      <AlertDialog open={!!decisionTarget} onOpenChange={(open) => { if (!open) setDecisionTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {decisionTarget ? DECISION_LABELS[decisionTarget.decision] : ''} {t("— commande #")}{decisionTarget?.order.id.slice(0, 8)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("Voici exactement ce qui va être appliqué :")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {decisionTarget && (
            <ul className="space-y-1.5">
              {decisionPreview(decisionTarget).map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm font-inter text-text-secondary">
                  <Check className="w-3.5 h-3.5 text-green-primary shrink-0 mt-0.5" />
                  {line}
                </li>
              ))}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Annuler")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApplyDecision}
              disabled={applyingDecision}
              className={`text-white disabled:opacity-60 ${decisionTarget?.decision === 'abusive_rejection' ? 'bg-error hover:bg-error/90' : 'bg-green-primary hover:bg-green-dark'}`}
            >
              {applyingDecision ? 'Application...' : 'Appliquer la décision'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
