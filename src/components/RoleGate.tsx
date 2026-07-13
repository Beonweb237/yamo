import { type ReactNode, useState, useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ShieldAlert, Phone, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth, RoleMismatchError, type UserRole } from '../contexts/AuthContext';
import { fetchMyApplications } from '../lib/applications';

export default function RoleGate({ allow, children }: { allow: UserRole[]; children?: ReactNode }) {
  const { user, loading, sendOtp, verifyOtp } = useAuth();
  const isAdminRoute = allow.length === 1 && allow[0] === 'admin';
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [hasApplication, setHasApplication] = useState(true);

  // Fetch rejection reason / whether a candidacy exists at all for unapproved users
  useEffect(() => {
    if (user && !user.isApproved && !user.isSuspended) {
      fetchMyApplications(user.id).then((apps) => {
        const relevant = apps.filter((a) => a.type === user.role);
        const rejected = relevant.find((a) => a.status === 'rejected' && a.rejectionReason);
        setRejectionReason(rejected?.rejectionReason ?? null);
        setHasApplication(relevant.length > 0);
      }).catch(() => { });
    }
  }, [user]);

  // Admin login form state
  const [adminStep, setAdminStep] = useState<'phone' | 'code'>('phone');
  const [adminPhone, setAdminPhone] = useState('+237 ');
  const [adminCode, setAdminCode] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  if (loading) return null;

  const roleMatches = user && allow.includes(user.role);

  if (!user || !roleMatches || !user.isApproved || user.isSuspended) {
    // Admin gate: show dedicated admin login when not authenticated
    if (isAdminRoute && !user) {
      const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdminError('');
        setAdminSubmitting(true);
        try {
          await sendOtp(adminPhone.replace(/\s/g, ''));
          setAdminStep('code');
        } catch {
          setAdminError("Impossible d'envoyer le code. Vérifiez le numéro.");
        } finally {
          setAdminSubmitting(false);
        }
      };

      const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdminError('');
        setAdminSubmitting(true);
        try {
          await verifyOtp(adminPhone.replace(/\s/g, ''), adminCode, 'admin');
        } catch (err) {
          setAdminError(
            err instanceof RoleMismatchError
              ? "Ce numéro n'est pas enregistré comme administrateur."
              : 'Code invalide. Réessayez.'
          );
        } finally {
          setAdminSubmitting(false);
        }
      };

      return (
        <div className="min-h-screen bg-bg-secondary flex items-center justify-center px-4">
          <div className="w-full max-w-[420px] bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6 sm:p-8 my-12">
            <div className="text-center mb-6">
              <ShieldAlert className="w-10 h-10 text-green-primary mx-auto mb-3" />
              <h1 className="font-poppins font-bold text-text-primary text-xl mb-1">Administration Yamo</h1>
              <p className="text-text-secondary font-inter text-sm">Connectez-vous avec votre numéro de téléphone.</p>
            </div>

            {!user && (
              <div className="bg-gold-light text-gold-accent text-xs font-inter rounded-lg px-3 py-2 mb-5">
                Mode démo : aucun SMS n'est envoyé, saisissez n'importe quel code à l'étape suivante.
              </div>
            )}

            {adminStep === 'phone' ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-text-secondary font-inter text-sm mb-1.5">Numéro de téléphone</label>
                  <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                    <Phone className="w-4 h-4 text-text-muted shrink-0" />
                    <input
                      type="tel"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      placeholder="+237 6XX XX XX XX"
                      className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                      required
                    />
                  </div>
                </div>
                {adminError && <p className="text-error text-sm font-inter">{adminError}</p>}
                <button
                  type="submit"
                  disabled={adminSubmitting}
                  className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
                >
                  {adminSubmitting ? 'Envoi...' : 'Recevoir le code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-text-secondary font-inter text-sm mb-1.5">Code reçu par SMS</label>
                  <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                    <ShieldCheck className="w-4 h-4 text-text-muted shrink-0" />
                    <input
                      type="text"
                      value={adminCode}
                      onChange={(e) => setAdminCode(e.target.value)}
                      placeholder="123456"
                      className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                      required
                    />
                  </div>
                </div>
                {adminError && <p className="text-error text-sm font-inter">{adminError}</p>}
                <button
                  type="submit"
                  disabled={adminSubmitting}
                  className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {adminSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Vérification...</> : 'Accéder à l\'administration'}
                </button>
                <button
                  type="button"
                  onClick={() => setAdminStep('phone')}
                  className="w-full text-text-secondary font-inter text-sm hover:text-text-primary"
                >
                  Changer de numéro
                </button>
              </form>
            )}
          </div>
        </div>
      );
    }

    // Approved-role account, but no candidacy submitted yet — send them to
    // the form instead of showing a "pending validation" message that lies
    // about the actual state of their (non-existent) submission.
    const needsApplication = roleMatches && user && !user.isApproved && !user.isSuspended && !hasApplication;

    const fallbackMessage = !user
      ? 'Connectez-vous avec un compte autorisé pour accéder à cet espace.'
      : !roleMatches
        ? "Ce compte n'a pas les droits nécessaires pour accéder à cet espace."
        : user.isSuspended
          ? "Votre compte a été suspendu par l'équipe Yamo. Contactez le support pour plus d'informations."
          : needsApplication
            ? "Complétez votre candidature pour que notre équipe puisse l'examiner."
            : 'Votre candidature est en cours de validation par notre équipe. Vous recevrez un accès dès son approbation.';

    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <div className="w-full max-w-[420px] bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-8 text-center my-12">
          <ShieldAlert className="w-12 h-12 text-error mx-auto mb-4" />
          <h1 className="font-poppins font-bold text-text-primary text-xl mb-2">
            {roleMatches && user && user.isSuspended
              ? 'Compte suspendu'
              : roleMatches && user && !user.isApproved
                ? needsApplication
                  ? 'Candidature à compléter'
                  : rejectionReason
                    ? 'Candidature rejetée'
                    : 'Candidature en attente'
                : 'Accès réservé'}
          </h1>
          <p className="text-text-secondary font-inter text-sm mb-6">
            {!user
              ? 'Connectez-vous avec un compte autorisé pour accéder à cet espace.'
              : !roleMatches
                ? "Ce compte n'a pas les droits nécessaires pour accéder à cet espace."
                : user.isSuspended
                  ? fallbackMessage
                  : !user.isApproved
                    ? needsApplication
                      ? fallbackMessage
                      : rejectionReason
                        ? `Votre candidature a été rejetée. Motif : ${rejectionReason}`
                        : fallbackMessage
                    : fallbackMessage}
          </p>
          {user?.isSuspended && user.suspensionReason && (
            <p className="bg-error/10 text-error font-inter text-sm rounded-lg px-3 py-2 mb-6">
              Motif : {user.suspensionReason}
            </p>
          )}
          {user && !user.isApproved && !user.isSuspended && rejectionReason && (
            <p className="bg-error/10 text-error font-inter text-sm rounded-lg px-3 py-2 mb-6">
              Pour postuler à nouveau, veuillez contacter le support ou créer un nouveau compte.
            </p>
          )}
          <Link
            to={needsApplication ? '/candidature' : isAdminRoute ? '/' : '/connexion'}
            className="inline-block bg-green-primary text-white font-inter font-semibold px-6 h-11 leading-[44px] rounded-lg hover:bg-green-dark transition-colors"
          >
            {needsApplication ? 'Compléter ma candidature' : isAdminRoute ? 'Retour à l\'accueil' : 'Se connecter'}
          </Link>
        </div>
      </div>
    );
  }

  return <>{children ?? <Outlet />}</>;
}
