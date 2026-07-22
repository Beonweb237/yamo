import { usePolling } from '../../hooks/usePolling';
import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bike, Search, Star, Wallet, Check, X, KeyRound, Eye, EyeOff, ChevronRight, Phone, MapPin, ShieldCheck } from 'lucide-react';
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
import { adminSetPassword, getUserEmail, ADMIN_DEFAULT_PASSWORD } from '../../contexts/AuthContext';
import { setAdminUserPassword } from '../../lib/admin';
import { useTranslation } from "react-i18next";

export default function AdminDrivers() {
    const { t } = useTranslation();
  const [drivers, setDrivers] = useState<Application[]>([]);
  const [stats, setStats] = useState<Record<string, DriverStats>>({});
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [query, setQuery] = useState('');
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<{ driver: Application; stats: DriverStats | undefined } | null>(null);

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
      (d.applicantName ?? '').toLowerCase().includes(q) ||
      (d.contactPhone ?? '').toLowerCase().includes(q) ||
      (d.applicantEmail ?? '').toLowerCase().includes(q) ||
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

  // ── Set / Reset password ───────────────────────────────

  const applyPassword = async () => {
    if (!passwordTarget) return;
    if (!newPassword || newPassword.length < 4) {
      toast.error('Le mot de passe doit contenir au moins 4 caractères.');
      return;
    }
    try {
      const updatedOnServer = await setAdminUserPassword(passwordTarget.id, newPassword);
      if (!updatedOnServer) adminSetPassword(passwordTarget.phone, newPassword);
    } catch (err) {
      console.warn('[admin-drivers] Mot de passe API impossible, repli localStorage', err);
      adminSetPassword(passwordTarget.phone, newPassword);
    }
    toast.success(`Mot de passe défini pour ${passwordTarget.name}`);
    setPasswordTarget(null);
    setNewPassword('');
    setShowPassword(false);
  };

  const pendingPayouts = payouts.filter((p) => p.status === 'pending');

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <h1 className="font-poppins font-bold text-text-primary text-2xl flex items-center gap-2">
          <Bike className="w-6 h-6 text-green-primary" />{t("Livreurs (")}{drivers.length})
        </h1>
        <Link to="/admin/kyc" className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-border-custom bg-white text-text-secondary hover:bg-bg-secondary text-sm font-medium">
          <ShieldCheck className="w-4 h-4 text-green-primary" />{t("Centre KYC")}
        </Link>
      </div>

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
                <div key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer hover:bg-bg-secondary/50 transition-colors" onClick={() => setSelectedDriver({ driver: d, stats: s })}>
                  <div>
                    <p className="font-inter font-medium text-text-primary text-sm">
                      {d.applicantName || d.contactPhone || 'Sans téléphone'}
                      {d.applicantName && d.contactPhone && (
                        <span className="text-text-muted font-normal"> · {d.contactPhone}</span>
                      )}
                    </p>
                    <p className="text-text-muted text-xs mb-1">{d.city} · {d.address}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary font-inter">
                      <span className={`inline-flex items-center gap-1 ${s?.isOnline ? 'text-green-primary' : 'text-text-muted'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s?.isOnline ? 'bg-green-primary' : 'bg-text-muted'}`} />
                        {s?.isOnline ? 'En ligne' : 'Hors ligne'}
                      </span>
                      <span>{s?.completedDeliveries ?? 0} {t("livraisons (")}{s?.completedThisWeek ?? 0} {t("cette semaine)")}</span>
                      {s?.averageRating != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-gold-accent text-gold-accent" />
                          {s.averageRating.toFixed(1)} ({s.ratingCount})
                        </span>
                      ) : (
                        <span className="text-text-muted">{t("Pas encore noté")}</span>
                      )}
                    </div>
                    {!isActive && s?.suspensionReason && (
                      <p className="text-xs text-error font-inter mt-1">{t("Motif :")} {s.suspensionReason}</p>
                    )}
                    {s?.recentFeedback && s.recentFeedback.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {s.recentFeedback.map((f, i) => (
                          <li key={i} className="text-xs text-text-secondary font-inter italic flex items-start gap-1">
                            <span className="inline-flex items-center gap-0.5 shrink-0 not-italic text-amber-700">
                              <Star className="w-3 h-3 fill-gold-accent" />{f.rating}
                            </span>
                            "{f.comment}"
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const phone = d.contactPhone || '';
                        if (!phone) { toast.error('Ce livreur n\'a pas de numéro de téléphone.'); return; }
                        setPasswordTarget({ id: d.applicantId, name: d.applicantName || phone || 'Livreur', phone }); setNewPassword(''); setShowPassword(false);
                      }}
                      className="shrink-0 inline-flex items-center gap-1 text-[10px] font-inter font-semibold px-2 py-1 rounded-full transition-colors bg-bg-secondary text-text-muted hover:bg-gold-light hover:text-amber-700"
                      title="Définir un mot de passe"
                    >
                      <KeyRound className="w-3 h-3" />
                      {t("Mot de passe")}
                    </button>
                    <span className={`text-xs font-medium ${isActive ? 'text-green-primary' : 'text-text-muted'}`}>
                      {isActive ? 'Actif' : 'Suspendu'}
                    </span>
                    <Switch checked={isActive} onCheckedChange={(v) => handleToggleSuspended(d.applicantId, v)} />
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <h2 className="font-poppins font-bold text-text-primary text-xl mb-4 flex items-center gap-2">
        <Wallet className="w-5 h-5 text-green-primary" />{t("Demandes de virement (")}{pendingPayouts.length})
      </h2>
      <div className="bg-white rounded-xl border border-border-custom">
        {pendingPayouts.length === 0 ? (
          <p className="p-6 text-text-secondary text-sm text-center">{t("Aucune demande en attente.")}</p>
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
                      {p.amount.toLocaleString()} {t("FCFA")}
                    </span>
                    <button
                      onClick={() => handlePayoutDecision(p.id, 'paid')}
                      className="flex items-center gap-1 bg-green-light text-green-primary font-inter font-medium text-xs px-3 h-8 rounded-lg hover:bg-green-primary hover:text-white transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />{t("Payer")}
                    </button>
                    <button
                      onClick={() => handlePayoutDecision(p.id, 'rejected')}
                      className="flex items-center gap-1 bg-error/10 text-error font-inter font-medium text-xs px-3 h-8 rounded-lg hover:bg-error hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />{t("Refuser")}
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
            <AlertDialogTitle>{t("Suspendre ce livreur ?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Le livreur ne pourra plus accéder à son espace ni recevoir de courses. Le motif est visible par l’équipe uniquement.")}
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
            <AlertDialogCancel>{t("Annuler")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (suspendTarget) {
                  void applySuspension(suspendTarget, true, suspendReason.trim() || undefined);
                  setSuspendTarget(null);
                }
              }}
              className="bg-error text-white hover:bg-error/90"
            >
              {t("Suspendre le livreur")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de refus de virement (motif visible par le livreur) */}
      <AlertDialog open={!!rejectPayoutTarget} onOpenChange={(open) => { if (!open) setRejectPayoutTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Refuser ce virement ?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Le montant redeviendra disponible dans le solde du livreur. Le motif lui sera affiché.")}
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
            <AlertDialogCancel>{t("Annuler")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rejectPayoutTarget) {
                  void applyPayoutDecision(rejectPayoutTarget, 'rejected', rejectPayoutReason.trim() || undefined);
                  setRejectPayoutTarget(null);
                }
              }}
              className="bg-error text-white hover:bg-error/90"
            >
              {t("Refuser le virement")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Profile slide-in panel ─────────────────────────── */}
      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedDriver(null)} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl animate-slide-in-right">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-border-custom px-5 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-poppins font-bold text-text-primary text-lg">{selectedDriver.driver.applicantName || 'Livreur'}</h2>
                <p className="text-sm text-text-muted font-inter">{selectedDriver.driver.contactPhone || '—'}</p>
              </div>
              <button
                onClick={() => setSelectedDriver(null)}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-bg-secondary transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Driver info */}
              <div className="bg-bg-secondary rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Nom")}</span>
                  <span className="text-sm font-medium text-text-primary">{selectedDriver.driver.applicantName || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Téléphone")}</span>
                  <span className="text-sm font-medium text-text-primary">{selectedDriver.driver.contactPhone || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Ville")}</span>
                  <span className="text-sm font-medium text-text-primary">{selectedDriver.driver.city || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Adresse")}</span>
                  <span className="text-sm font-medium text-text-primary text-right max-w-[60%]">{selectedDriver.driver.address || '—'}</span>
                </div>
                {selectedDriver.driver.serviceNeighborhoods && selectedDriver.driver.serviceNeighborhoods.length > 0 && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-text-muted font-inter">{t("Zones desservies")}</span>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                      {selectedDriver.driver.serviceNeighborhoods.map((z) => (
                        <span key={z} className="text-[11px] font-inter bg-white rounded-full px-2 py-0.5 text-text-secondary border border-border-custom">{z}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="border-t border-border-light pt-3" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Statut")}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${selectedDriver.stats?.isOnline ? 'text-green-primary' : 'text-text-muted'}`}>
                    <span className={`w-2 h-2 rounded-full ${selectedDriver.stats?.isOnline ? 'bg-green-primary' : 'bg-text-muted'}`} />
                    {selectedDriver.stats?.isOnline ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Livraisons")}</span>
                  <span className="text-sm font-medium text-text-primary">{selectedDriver.stats?.completedDeliveries ?? 0} ({selectedDriver.stats?.completedThisWeek ?? 0} {t("cette semaine)")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Note")}</span>
                  <span className="text-sm font-medium flex items-center gap-1">
                    {selectedDriver.stats?.averageRating != null ? (
                      <><Star className="w-3.5 h-3.5 fill-gold-accent text-gold-accent" />{selectedDriver.stats.averageRating.toFixed(1)} ({selectedDriver.stats.ratingCount})</>
                    ) : 'Pas encore noté'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Statut compte")}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${selectedDriver.stats?.isSuspended ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-primary'}`}>
                    {selectedDriver.stats?.isSuspended ? 'Suspendu' : 'Actif'}
                  </span>
                </div>
                {selectedDriver.stats?.isSuspended && selectedDriver.stats?.suspensionReason && (
                  <div className="pt-2 border-t border-border-light">
                    <span className="text-sm text-text-muted font-inter block mb-1">{t("Motif suspension")}</span>
                    <p className="text-sm text-error font-inter">{selectedDriver.stats.suspensionReason}</p>
                  </div>
                )}
                {selectedDriver.stats?.recentFeedback && selectedDriver.stats.recentFeedback.length > 0 && (
                  <div className="pt-2 border-t border-border-light">
                    <span className="text-sm text-text-muted font-inter block mb-1.5">{t("Derniers avis")}</span>
                    {selectedDriver.stats.recentFeedback.map((f, i) => (
                      <p key={i} className="text-xs text-text-secondary font-inter italic mb-1">
                        <span className="inline-flex items-center gap-0.5 not-italic text-amber-700">
                          <Star className="w-3 h-3 fill-gold-accent" />{f.rating}
                        </span>
                        "{f.comment}"
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Credentials */}
              {selectedDriver.driver.contactPhone && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-2">
                  <h3 className="font-inter font-semibold text-amber-800 text-sm flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4" /> {t("Identifiants de connexion")}
                  </h3>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-amber-700 font-inter">{t("Email")}</span>
                    <span className="text-sm font-mono font-medium text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">{selectedDriver.driver.applicantEmail || getUserEmail(selectedDriver.driver.contactPhone, selectedDriver.driver.applicantName)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-amber-700 font-inter">{t("Téléphone")}</span>
                    <span className="text-sm font-mono font-medium text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">{selectedDriver.driver.contactPhone}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-amber-700 font-inter">{t("Mot de passe")}</span>
                    <span className="text-sm font-mono font-bold text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">{ADMIN_DEFAULT_PASSWORD}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-amber-700 font-inter">{t("Code OTP")}</span>
                    <span className="text-sm font-mono font-bold text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">12345</span>
                  </div>
                  <p className="text-[11px] text-amber-600 font-inter mt-1">{t("Connexion : email ou téléphone + mot de passe")} {ADMIN_DEFAULT_PASSWORD} — {t("mot de passe par défaut ; si vous l'avez réinitialisé, c'est le nouveau qui compte.")}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    const phone = selectedDriver.driver.contactPhone || '';
                    if (!phone) { toast.error('Ce livreur n\'a pas de numéro de téléphone.'); return; }
                    setPasswordTarget({ id: selectedDriver.driver.applicantId, name: selectedDriver.driver.applicantName || phone, phone }); setNewPassword(''); setShowPassword(false);
                  }}
                  className="flex items-center justify-center gap-1.5 font-inter font-medium text-sm px-4 h-10 rounded-xl border border-border-custom hover:bg-bg-secondary transition-colors text-text-primary"
                >
                  <KeyRound className="w-4 h-4" /> {t("Réinitialiser le mot de passe")}
                </button>
                <button
                  onClick={() => {
                    setSelectedDriver(null);
                    handleToggleSuspended(selectedDriver.driver.applicantId, !(selectedDriver.stats?.isSuspended ?? false));
                  }}
                  className={`flex items-center justify-center gap-1.5 font-inter font-medium text-sm px-4 h-10 rounded-xl transition-colors ${selectedDriver.stats?.isSuspended ? 'bg-green-50 text-green-primary hover:bg-green-primary hover:text-white' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'}`}
                >
                  {selectedDriver.stats?.isSuspended ? <><Check className="w-4 h-4" /> {t("Réactiver")}</> : <><X className="w-4 h-4" /> {t("Suspendre")}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Set password dialog ──────────────────────────── */}
      <AlertDialog open={!!passwordTarget} onOpenChange={(open) => { if (!open) { setPasswordTarget(null); setNewPassword(''); setShowPassword(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Définir un mot de passe")}</AlertDialogTitle>
            <AlertDialogDescription>
              {passwordTarget && (
                <>{t("Définir le mot de passe de")} <strong>{passwordTarget.name}</strong> ({passwordTarget.phone}{t("). Le livreur pourra se connecter avec son numéro de téléphone et ce mot de passe.")}</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe (min. 4 caractères)"
              autoFocus
              className="w-full bg-bg-secondary rounded-lg px-3 py-2.5 pr-10 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
              onKeyDown={(e) => { if (e.key === 'Enter') applyPassword(); }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary p-1"
              aria-label={showPassword ? 'Masquer' : 'Afficher'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Annuler")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={applyPassword}
              disabled={!newPassword || newPassword.length < 4}
            >
              {t("Enregistrer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
