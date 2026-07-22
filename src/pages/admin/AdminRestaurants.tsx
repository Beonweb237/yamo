import { useState } from 'react';
import { Store, MapPin, ChevronDown, ChevronUp, Navigation, Loader2, BadgeCheck, KeyRound, Eye, EyeOff, Phone, Clock, Star, X, ChevronRight } from 'lucide-react';
import { useRestaurants } from '../../hooks/useCatalog';
import { updateRestaurantOpenStatus, updateRestaurantProfile } from '../../lib/catalog';
import { Switch } from '../../components/ui/switch';
import LazyAddressPickerMap from '../../components/LazyAddressPickerMap';
import { toast } from 'sonner';
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
import { adminSetPassword, getUserEmail, ADMIN_DEFAULT_PASSWORD } from '../../contexts/AuthContext';
import { setAdminUserPassword } from '../../lib/admin';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useTranslation } from "react-i18next";

export default function AdminRestaurants() {
    const { t } = useTranslation();
  const { restaurants } = useRestaurants();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [verifiedOverrides, setVerifiedOverrides] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // GPS editing state
  const [editLat, setEditLat] = useState<number>(4.0511);
  const [editLng, setEditLng] = useState<number>(9.7679);
  const [editRadius, setEditRadius] = useState<number>(5);
  const [savingGps, setSavingGps] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; name: string; phone: string; ownerId?: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<typeof restaurants[number] | null>(null);

  const handleToggle = async (id: string, currentlyOpen: boolean) => {
    setTogglingId(id);
    try {
      await updateRestaurantOpenStatus(id, !currentlyOpen);
      setOverrides((p) => ({ ...p, [id]: !currentlyOpen }));
      toast.success(currentlyOpen ? 'Restaurant fermé' : 'Restaurant rouvert');
    } catch { toast.error('Erreur'); }
    finally { setTogglingId(null); }
  };

  const handleVerify = async (id: string, currentlyVerified: boolean) => {
    try {
      await updateRestaurantProfile(id, { verified: !currentlyVerified });
      setVerifiedOverrides((p) => ({ ...p, [id]: !currentlyVerified }));
      toast.success(currentlyVerified ? 'Badge vérifié retiré' : 'Restaurant vérifié ✓');
    } catch { toast.error('Erreur'); }
  };

  const handleExpand = (id: string, restaurant: { lat?: number; lng?: number; deliveryRadiusKm?: number }) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setEditLat(restaurant.lat ?? 4.0511);
    setEditLng(restaurant.lng ?? 9.7679);
    setEditRadius(restaurant.deliveryRadiusKm ?? 5);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non supportée par votre navigateur.');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditLat(pos.coords.latitude);
        setEditLng(pos.coords.longitude);
        setGeoLoading(false);
        toast.success('Position détectée');
      },
      () => {
        toast.error('Géolocalisation refusée. Entrez les coordonnées manuellement.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSaveGps = async (id: string) => {
    setSavingGps(true);
    try {
      await updateRestaurantProfile(id, {
        lat: editLat,
        lng: editLng,
        deliveryRadiusKm: editRadius,
      });
      toast.success('Coordonnées GPS mises à jour');
      setExpandedId(null);
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSavingGps(false);
    }
  };

  // ── Set / Reset password ───────────────────────────────

  const applyPassword = async () => {
    if (!passwordTarget) return;
    if (!newPassword || newPassword.length < 4) {
      toast.error('Le mot de passe doit contenir au moins 4 caractères.');
      return;
    }
    // Mode VPS : PATCH /api/admin/users/:id/password sur le compte owner.
    // Sans compte lié, on refuse (un succès localStorage serait un mensonge).
    try {
      if (passwordTarget.ownerId) {
        const updatedOnServer = await setAdminUserPassword(passwordTarget.ownerId, newPassword);
        if (!updatedOnServer) adminSetPassword(passwordTarget.phone, newPassword);
      } else if (isSupabaseConfigured) {
        toast.error("Ce restaurant n'a pas de compte propriétaire lié — lancez le backfill des comptes avant de définir un mot de passe.");
        return;
      } else {
        adminSetPassword(passwordTarget.phone, newPassword);
      }
    } catch {
      toast.error('La mise à jour du mot de passe a échoué côté serveur. Réessayez.');
      return;
    }
    toast.success(`Mot de passe défini pour ${passwordTarget.name}`);
    setPasswordTarget(null);
    setNewPassword('');
    setShowPassword(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="font-poppins font-bold text-text-primary text-2xl mb-6 flex items-center gap-2"><Store className="w-6 h-6 text-green-primary" />{t("Restaurants (")}{restaurants.length})</h1>
      <div className="bg-white rounded-xl border border-border-custom divide-y divide-border-light">
        {restaurants.map((r) => {
          const isOpen = overrides[r.id] ?? r.isOpen;
          const isExpanded = expandedId === r.id;
          const hasGps = r.lat != null && r.lng != null;

          return (
            <div key={r.id}>
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-bg-secondary/50 transition-colors"
                onClick={() => setSelectedRestaurant(r)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-inter font-medium text-text-primary text-sm truncate">{r.name}</p>
                    {r.verified && (
                      <span className="inline-flex items-center gap-1 text-blue-600 text-[10px] font-medium bg-blue-50 rounded-full px-2 py-0.5 shrink-0">
                        <BadgeCheck className="w-2.5 h-2.5" /> {t("Vérifié")}
                      </span>
                    )}
                    {hasGps ? (
                      <span className="inline-flex items-center gap-1 text-green-primary text-[10px] font-medium bg-green-light rounded-full px-2 py-0.5 shrink-0">
                        <MapPin className="w-2.5 h-2.5" /> {t("GPS")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 text-[10px] font-medium bg-amber-50 rounded-full px-2 py-0.5 shrink-0">
                        <MapPin className="w-2.5 h-2.5" /> {t("Sans GPS")}
                      </span>
                    )}
                  </div>
                  <p className="text-text-muted text-xs mt-0.5">{r.category} · {r.address}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); const isVerified = verifiedOverrides[r.id] ?? r.verified ?? false; handleVerify(r.id, isVerified); }}
                    className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-inter font-semibold px-2 py-1 rounded-full transition-colors ${(verifiedOverrides[r.id] ?? r.verified) ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-bg-secondary text-text-muted hover:bg-border-light'}`}
                    title={(verifiedOverrides[r.id] ?? r.verified) ? 'Retirer la vérification' : 'Vérifier ce restaurant'}
                  >
                    <BadgeCheck className="w-3 h-3" />
                    {(verifiedOverrides[r.id] ?? r.verified) ? 'Vérifié' : 'Vérifier'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPasswordTarget({ id: r.id, name: r.name, phone: r.phone, ownerId: r.ownerId }); setNewPassword(''); setShowPassword(false); }}
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-inter font-semibold px-2 py-1 rounded-full transition-colors bg-bg-secondary text-text-muted hover:bg-gold-light hover:text-amber-700"
                    title="Définir un mot de passe pour ce restaurant"
                  >
                    <KeyRound className="w-3 h-3" />
                    {t("Mot de passe")}
                  </button>
                  <span className={`text-xs font-medium ${isOpen ? 'text-green-primary' : 'text-text-muted'}`}>{isOpen ? 'Ouvert' : 'Fermé'}</span>
                  <Switch
                    checked={isOpen}
                    onCheckedChange={() => handleToggle(r.id, isOpen)}
                    disabled={togglingId === r.id}
                  />
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Profile slide-in panel ─────────────────────────── */}
      {selectedRestaurant && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSelectedRestaurant(null); setExpandedId(null); }} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl animate-slide-in-right">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-border-custom px-5 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-poppins font-bold text-text-primary text-lg">{selectedRestaurant.name}</h2>
                <p className="text-sm text-text-muted font-inter">{selectedRestaurant.category} · {selectedRestaurant.city}</p>
              </div>
              <button
                onClick={() => { setSelectedRestaurant(null); setExpandedId(null); }}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-bg-secondary transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Restaurant info */}
              <div className="bg-bg-secondary rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Nom")}</span>
                  <span className="text-sm font-medium text-text-primary text-right">{selectedRestaurant.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Catégorie")}</span>
                  <span className="text-sm font-medium text-text-primary">{selectedRestaurant.category}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Ville")}</span>
                  <span className="text-sm font-medium text-text-primary">{selectedRestaurant.city}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Quartier")}</span>
                  <span className="text-sm font-medium text-text-primary">{selectedRestaurant.neighborhood}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Adresse")}</span>
                  <span className="text-sm font-medium text-text-primary text-right max-w-[60%]">{selectedRestaurant.address}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Téléphone")}</span>
                  <span className="text-sm font-medium text-text-primary">{selectedRestaurant.phone || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Note")}</span>
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-gold-accent text-gold-accent" />
                    {selectedRestaurant.rating.toFixed(1)} ({selectedRestaurant.reviewCount} {t("avis)")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Horaires")}</span>
                  <span className="text-sm font-medium text-text-primary text-right max-w-[50%]">{selectedRestaurant.hours || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Frais livraison")}</span>
                  <span className="text-sm font-medium text-text-primary">{selectedRestaurant.deliveryFee === 0 ? 'Gratuit' : `${selectedRestaurant.deliveryFee.toLocaleString()} FCFA`}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Commande min.")}</span>
                  <span className="text-sm font-medium text-text-primary">{`${selectedRestaurant.minOrder.toLocaleString()} FCFA`}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Temps livraison")}</span>
                  <span className="text-sm font-medium text-text-primary">{selectedRestaurant.deliveryTime} {t("min")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Statut")}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${(overrides[selectedRestaurant.id] ?? selectedRestaurant.isOpen) ? 'bg-green-50 text-green-primary' : 'bg-red-50 text-red-600'}`}>
                    {(overrides[selectedRestaurant.id] ?? selectedRestaurant.isOpen) ? 'Ouvert' : 'Fermé'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted font-inter">{t("Vérifié")}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${(verifiedOverrides[selectedRestaurant.id] ?? selectedRestaurant.verified) ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-text-muted'}`}>
                    {(verifiedOverrides[selectedRestaurant.id] ?? selectedRestaurant.verified) ? '✓ Oui' : 'Non'}
                  </span>
                </div>
                {selectedRestaurant.description && (
                  <div className="pt-2 border-t border-border-light">
                    <span className="text-sm text-text-muted font-inter block mb-1">{t("Description")}</span>
                    <p className="text-sm text-text-primary font-inter">{selectedRestaurant.description}</p>
                  </div>
                )}
                {selectedRestaurant.tags?.length > 0 && (
                  <div className="pt-2 border-t border-border-light">
                    <span className="text-sm text-text-muted font-inter block mb-1.5">{t("Tags")}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRestaurant.tags.map((tag) => (
                        <span key={tag} className="text-[11px] font-inter font-medium bg-white rounded-full px-2.5 py-1 text-text-secondary border border-border-custom">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Credentials */}
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-2">
                <h3 className="font-inter font-semibold text-amber-800 text-sm flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> {t("Identifiants de connexion")}
                </h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-amber-700 font-inter">{t("Email")}</span>
                  <span className="text-sm font-mono font-medium text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">{selectedRestaurant.email || getUserEmail(selectedRestaurant.phone, selectedRestaurant.name)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-amber-700 font-inter">{t("Téléphone")}</span>
                  <span className="text-sm font-mono font-medium text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-200">{selectedRestaurant.phone || '—'}</span>
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

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setPasswordTarget({ id: selectedRestaurant.id, name: selectedRestaurant.name, phone: selectedRestaurant.phone, ownerId: selectedRestaurant.ownerId }); setNewPassword(''); setShowPassword(false); }}
                  className="flex items-center justify-center gap-1.5 font-inter font-medium text-sm px-4 h-10 rounded-xl border border-border-custom hover:bg-bg-secondary transition-colors text-text-primary"
                >
                  <KeyRound className="w-4 h-4" /> {t("Réinitialiser le mot de passe")}
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
                <>{t("Définir le mot de passe de")} <strong>{passwordTarget.name}</strong> ({passwordTarget.phone}{t("). Le restaurateur pourra se connecter avec son numéro de téléphone et ce mot de passe.")}</>
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
