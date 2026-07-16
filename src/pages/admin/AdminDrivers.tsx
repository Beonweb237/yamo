import { usePolling } from '../../hooks/usePolling';
import { useState, useCallback, useMemo } from 'react';
import { Bike, Search, Star, Wallet, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { fetchAllApplications } from '../../lib/applications';
import {
  fetchDriversStats,
  setDriverSuspended,
  fetchAllPayouts,
  updatePayoutStatus,
  type DriverStats,
  type PayoutRequest,
} from '../../lib/drivers';
import { Switch } from '../../components/ui/switch';
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
import type { Application } from '../../lib/applications';

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState<Application[]>([]);
  const [stats, setStats] = useState<Record<string, DriverStats>>({});
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const apps = await fetchAllApplications();
    const approvedDrivers = apps.filter((a) => a.status === 'approved' && a.type === 'livreur');
    setDrivers(approvedDrivers);

    const [statsMap, allPayouts] = await Promise.all([
      fetchDriversStats(approvedDrivers.map((d) => d.applicantId)),
      fetchAllPayouts(),
    ]);
    setStats(statsMap);
    setPayouts(allPayouts);
  }, []);
  usePolling(load, 30000);

  const filteredDrivers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) =>
      (d.contactPhone ?? '').toLowerCase().includes(q) ||
      (d.city ?? '').toLowerCase().includes(q) ||
      (d.address ?? '').toLowerCase().includes(q)
    );
  }, [drivers, query]);

  // Dialogs de motif (CONF-22 — remplace les window.prompt() interdits).
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [rejectPayoutTarget, setRejectPayoutTarget] = useState<string | null>(null);
  const [rejectPayoutReason, setRejectPayoutReason] = useState('');

  const applySuspension = async (driverId: string, suspend: boolean, reason?: string) => {
    setStats((prev) => ({
      ...prev,
      [driverId]: { ...prev[driverId], isSuspended: suspend, suspensionReason: reason ?? null } as DriverStats,
    }));
    await setDriverSuspended(driverId, suspend, reason);
    toast.success(suspend ? 'Livreur suspendu' : 'Livreur réactivé');
  };

  const handleToggleSuspended = (driverId: string, nextActive: boolean) => {
    if (nextActive) {
      // Réactivation : pas de motif nécessaire.
      void applySuspension(driverId, false);
      return;
    }
    setSuspendReason('');
    setSuspendTarget(driverId);
  };

  const applyPayoutDecision = async (id: string, status: 'paid' | 'rejected', reason?: string) => {
    setPayouts((prev) => prev.map((p) => (p.id === id ? { ...p, status, processedReason: reason ?? null } : p)));
    await updatePayoutStatus(id, status, reason);
    toast.success(status === 'paid' ? 'Virement marqué comme payé' : 'Virement refusé');
  };

  const handlePayoutDecision = (id: string, status: 'paid' | 'rejected') => {
    if (status === 'paid') {
      void applyPayoutDecision(id, 'paid');
      return;
    }
    setRejectPayoutReason('');
    setRejectPayoutTarget(id);
  };

  const pendingPayouts = payouts.filter((p) => p.status === 'pending');

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="font-poppins font-bold text-text-primary text-2xl mb-6 flex items-center gap-2">
        <Bike className="w-6 h-6 text-green-primary" />Livreurs ({drivers.length})
      </h1>

      <div className="flex items-center gap-2 bg-white rounded-lg border border-border-custom px-3 h-11 mb-6 max-w-md">
        <Search className="w-4 h-4 text-text-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher par téléphone, ville, adresse..."
          className="flex-1 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
        />
      </div>

      <div className="bg-white rounded-xl border border-border-custom mb-8">
        {filteredDrivers.length === 0 ? (
          <p className="p-6 text-text-secondary text-sm text-center">
            {drivers.length === 0 ? 'Aucun livreur validé.' : 'Aucun livreur ne correspond à cette recherche.'}
          </p>
        ) : (
          <div className="divide-y divide-border-light">
            {filteredDrivers.map((d) => {
              const s = stats[d.applicantId];
              const isActive = !(s?.isSuspended ?? false);
              return (
                <div key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-inter font-medium text-text-primary text-sm">{d.contactPhone || 'Sans téléphone'}</p>
                    <p className="text-text-muted text-xs mb-1">{d.city} · {d.address}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary font-inter">
                      <span className={`inline-flex items-center gap-1 ${s?.isOnline ? 'text-green-primary' : 'text-text-muted'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s?.isOnline ? 'bg-green-primary' : 'bg-text-muted'}`} />
                        {s?.isOnline ? 'En ligne' : 'Hors ligne'}
                      </span>
                      <span>{s?.completedDeliveries ?? 0} livraisons ({s?.completedThisWeek ?? 0} cette semaine)</span>
                      {s?.averageRating != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-gold-accent text-gold-accent" />
                          {s.averageRating.toFixed(1)} ({s.ratingCount})
                        </span>
                      ) : (
                        <span className="text-text-muted">Pas encore noté</span>
                      )}
                    </div>
                    {!isActive && s?.suspensionReason && (
                      <p className="text-xs text-error font-inter mt-1">Motif : {s.suspensionReason}</p>
                    )}
                    {s?.recentFeedback && s.recentFeedback.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {s.recentFeedback.map((f, i) => (
                          <li key={i} className="text-xs text-text-secondary font-inter italic flex items-start gap-1">
                            <span className="inline-flex items-center gap-0.5 shrink-0 not-italic text-gold-accent">
                              <Star className="w-3 h-3 fill-gold-accent" />{f.rating}
                            </span>
                            "{f.comment}"
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${isActive ? 'text-green-primary' : 'text-text-muted'}`}>
                      {isActive ? 'Actif' : 'Suspendu'}
                    </span>
                    <Switch checked={isActive} onCheckedChange={(v) => handleToggleSuspended(d.applicantId, v)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <h2 className="font-poppins font-bold text-text-primary text-xl mb-4 flex items-center gap-2">
        <Wallet className="w-5 h-5 text-green-primary" />Demandes de virement ({pendingPayouts.length})
      </h2>
      <div className="bg-white rounded-xl border border-border-custom">
        {pendingPayouts.length === 0 ? (
          <p className="p-6 text-text-secondary text-sm text-center">Aucune demande en attente.</p>
        ) : (
          <div className="divide-y divide-border-light">
            {pendingPayouts.map((p) => {
              const driver = drivers.find((d) => d.applicantId === p.driverId);
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-inter font-medium text-text-primary text-sm">
                      {driver?.contactPhone || p.driverId.slice(0, 8)}
                    </p>
                    <p className="text-text-muted text-xs">
                      {new Date(p.requestedAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-inter font-bold text-text-primary text-sm">
                      {p.amount.toLocaleString()} FCFA
                    </span>
                    <button
                      onClick={() => handlePayoutDecision(p.id, 'paid')}
                      className="flex items-center gap-1 bg-green-light text-green-primary font-inter font-medium text-xs px-3 h-8 rounded-lg hover:bg-green-primary hover:text-white transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />Payer
                    </button>
                    <button
                      onClick={() => handlePayoutDecision(p.id, 'rejected')}
                      className="flex items-center gap-1 bg-error/10 text-error font-inter font-medium text-xs px-3 h-8 rounded-lg hover:bg-error hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />Refuser
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog de suspension (motif interne, optionnel) */}
      <AlertDialog open={!!suspendTarget} onOpenChange={(open) => { if (!open) setSuspendTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspendre ce livreur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le livreur ne pourra plus accéder à son espace ni recevoir de courses.
              Le motif est visible par l&apos;équipe uniquement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="Motif de la suspension (optionnel)..."
            rows={3}
            autoFocus
            className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (suspendTarget) {
                  void applySuspension(suspendTarget, true, suspendReason.trim() || undefined);
                  setSuspendTarget(null);
                }
              }}
              className="bg-error text-white hover:bg-error/90"
            >
              Suspendre le livreur
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de refus de virement (motif visible par le livreur) */}
      <AlertDialog open={!!rejectPayoutTarget} onOpenChange={(open) => { if (!open) setRejectPayoutTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refuser ce virement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le montant redeviendra disponible dans le solde du livreur.
              Le motif lui sera affiché.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={rejectPayoutReason}
            onChange={(e) => setRejectPayoutReason(e.target.value)}
            placeholder="Motif du refus (optionnel)..."
            rows={3}
            autoFocus
            className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none resize-none placeholder:text-text-muted"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rejectPayoutTarget) {
                  void applyPayoutDecision(rejectPayoutTarget, 'rejected', rejectPayoutReason.trim() || undefined);
                  setRejectPayoutTarget(null);
                }
              }}
              className="bg-error text-white hover:bg-error/90"
            >
              Refuser le virement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
