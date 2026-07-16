import { usePolling } from '../../hooks/usePolling';
import { useState, useCallback, useMemo } from 'react';
import { AlertTriangle, Bike, Check } from 'lucide-react';
import { useRestaurants } from '../../hooks/useCatalog';
import { fetchAllOrders, resolveOrderDispute, type Order } from '../../lib/orders';
import { fetchAllIncidents, resolveIncident, INCIDENT_LABELS, type DeliveryIncident } from '../../lib/incidents';
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

type ResolveTarget =
  | { kind: 'incident'; id: string; label: string }
  | { kind: 'cancellation'; id: string; label: string };

export default function AdminDisputes() {
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
          Litiges
          <span className="text-sm font-inter font-medium text-text-muted">
            ({openIncidents.length + openCancellations.length} ouvert{openIncidents.length + openCancellations.length !== 1 ? 's' : ''})
          </span>
        </h1>
        <label className="flex items-center gap-2 text-sm font-inter text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="w-4 h-4 accent-green-primary"
          />
          Afficher les litiges traités
        </label>
      </div>

      {/* Incidents livreur (CONF-18/20) */}
      <div className="bg-white rounded-xl border border-border-custom p-5 mb-6">
        <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4 flex items-center gap-2">
          <Bike className="w-5 h-5 text-error" />
          Incidents de livraison ({openIncidents.length} ouvert{openIncidents.length !== 1 ? 's' : ''})
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
                    <span className="ml-2 text-text-muted text-xs font-normal">Commande #{incident.orderId.slice(0, 8)}</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    {new Date(incident.createdAt).toLocaleString('fr-FR')} · Livreur {incident.driverId.slice(0, 12)}
                  </p>
                  {incident.note && <p className="text-xs text-text-secondary font-inter mt-1 italic">"{incident.note}"</p>}
                  {incident.status === 'resolved' && incident.resolutionNote && (
                    <p className="text-xs text-green-primary font-inter mt-1">Traitement : {incident.resolutionNote}</p>
                  )}
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
                      <Check className="w-3.5 h-3.5" />Traiter
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
          Commandes annulées ({openCancellations.length} à traiter)
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
                      Annulée par{' '}
                      <span className="font-medium text-text-primary">
                        {order.cancelledBy === 'customer' ? 'le client' : order.cancelledBy === 'restaurant' ? 'le restaurant' : order.cancelledBy === 'admin' ? "l'admin" : '—'}
                      </span>
                      {' '}· Motif : <span className="font-medium text-text-primary">{order.cancellationReason}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted font-inter mt-1 italic">Motif non renseigné (annulation antérieure)</p>
                  )}
                  {order.disputeResolved && order.disputeResolutionNote && (
                    <p className="text-xs text-green-primary font-inter mt-1">Traitement : {order.disputeResolutionNote}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-inter font-semibold text-sm text-error">{order.total.toLocaleString()} FCFA</span>
                  {order.disputeResolved ? (
                    <span className="text-xs font-inter font-medium px-2.5 py-1 rounded-full bg-green-light text-green-primary">Traité</span>
                  ) : (
                    <button
                      onClick={() => { setResolutionNote(''); setResolveTarget({ kind: 'cancellation', id: order.id, label: `Annulation — commande #${order.id.slice(0, 8)}` }); }}
                      className="flex items-center gap-1 bg-green-light text-green-primary font-inter font-medium text-xs px-3 h-8 rounded-lg hover:bg-green-primary hover:text-white transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />Traiter
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
            <AlertDialogTitle>Marquer comme traité ?</AlertDialogTitle>
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
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleResolve} className="bg-green-primary text-white hover:bg-green-dark">
              Marquer traité
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
