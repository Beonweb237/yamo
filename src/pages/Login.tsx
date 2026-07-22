import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Phone, ShieldCheck, User, Store, Bike, Mail, Smartphone, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthHeader from '../components/AuthHeader';
import OtpInput from '../components/OtpInput';
import { useTranslation } from 'react-i18next';
import { useAuth, RoleMismatchError, type AuthUser, type UserRole } from '../contexts/AuthContext';
import { fetchMyApplications } from '../lib/applications';
import { displayCameroonPhone, normalizeCameroonPhone } from '../lib/phone';
import { useSeo } from '../hooks/useSeo';

const roleRedirects: Record<UserRole, string> = {
  client: '/',
  restaurant: '/partenaires/dashboard',
  livreur: '/livreurs/dashboard',
  admin: '/admin/dashboard',
};

const roleLabels: Record<UserRole, string> = {
  client: 'Client',
  restaurant: 'Restaurateur',
  livreur: 'Livreur',
  admin: 'Administrateur',
};

// ── Profile display config ──
interface ProfileConfig {
  icon: typeof User;
  title: string;
  subtitle: string;
}

const profileConfigs: Record<UserRole, ProfileConfig> = {
  client: {
    icon: User,
    title: 'Connexion Client',
    subtitle: 'Connectez-vous pour commander vos plats préférés.',
  },
  restaurant: {
    icon: Store,
    title: 'Connexion Restaurateur',
    subtitle: 'Gérez votre restaurant et vos commandes sur MiamExpress.',
  },
  livreur: {
    icon: Bike,
    title: 'Connexion Livreur',
    subtitle: 'Connectez-vous pour gérer vos livraisons.',
  },
  admin: {
    icon: ShieldCheck,
    title: 'Connexion Administrateur',
    subtitle: 'Administration de la plateforme MiamExpress.',
  },
};

// ── Cross-profile quick links ──
interface CrossLink {
  role: UserRole;
  icon: typeof User;
  label: string;
}

function getCrossLinks(currentRole: UserRole): CrossLink[] {
  const all: CrossLink[] = [
    { role: 'client', icon: User, label: 'Vous êtes client ?' },
    { role: 'restaurant', icon: Store, label: 'Vous êtes restaurateur ?' },
    { role: 'livreur', icon: Bike, label: 'Vous êtes livreur ?' },
  ];
  return all.filter((l) => l.role !== currentRole);
}

function getLoginPath(role: UserRole): string {
  if (role === 'admin') return '/admin/connexion';
  if (role === 'restaurant') return '/partenaires/connexion';
  if (role === 'livreur') return '/livreurs/connexion';
  return '/connexion';
}

function getSignupPath(role: UserRole): string {
  if (role === 'restaurant') return '/inscription/restaurant';
  if (role === 'livreur') return '/inscription/livreur';
  return '/inscription';
}

// ── Resolve redirect after login ──
async function resolveRedirect(user: AuthUser, from?: string): Promise<string> {
  if (user.role === 'client') return from ?? '/';
  if (user.role === 'admin') return roleRedirects.admin;
  if (!user.isApproved) {
    const apps = await fetchMyApplications(user.id);
    const hasApplication = apps.some((a) => a.type === user.role);
    if (hasApplication) {
      // Déjà candidat — compte en attente de validation.
      toast.info('Votre compte est en attente de validation par notre équipe. Vous recevrez une notification dès qu\'il sera activé.', { duration: 8000 });
      return from ?? '/';
    }
    // Pas encore candidat — rediriger vers la candidature.
    toast.info('Votre compte doit être validé avant d\'accéder à votre espace. Veuillez compléter votre candidature.', { duration: 8000 });
    return '/candidature';
  }
  return roleRedirects[user.role];
}


export default function Login({ defaultRole = 'client' as UserRole }: { defaultRole?: UserRole }) {
  const { t } = useTranslation();
  const { sendOtp, verifyOtp, signInWithPassword, isSupabaseConfigured } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  const profile = profileConfigs[defaultRole];
  const crossLinks = getCrossLinks(defaultRole);
  useSeo({ title: t(profile.title), noindex: true });

  // "Simplifié" = phone OTP (default) | "Pro" = email + password
  const [authMode, setAuthMode] = useState<'simple' | 'pro'>('simple');

  // --- Phone OTP state ---
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Phone password sub-mode (toggle between OTP and password)
  const [phonePasswordMode, setPhonePasswordMode] = useState(false);

  // --- Email state ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordPhone, setPasswordPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // Compte à rebours avant de pouvoir renvoyer le code OTP.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const handlePhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await sendOtp(normalizeCameroonPhone(phone));
      // En mode VPS, vérifier si le numéro existe dans la base
      if (result && typeof result === 'object' && 'exists' in result) {
        if (!result.exists) {
          setError('Aucun compte trouvé avec ce numéro. Créez d\'abord un compte.');
          setSubmitting(false);
          return;
        }
      }
      setStep('code');
      setCode('');
      setResendIn(30);
    } catch {
      setError("Impossible d'envoyer le code. Vérifiez le numéro.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || submitting) return;
    setError('');
    try {
      const result = await sendOtp(normalizeCameroonPhone(phone));
      if (result && typeof result === 'object' && 'exists' in result && !result.exists) {
        setError('Aucun compte trouvé avec ce numéro.');
        return;
      }
      toast.success('Nouveau code envoyé.');
      setResendIn(30);
    } catch {
      setError("Impossible de renvoyer le code. Réessayez.");
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedInUser = await verifyOtp(normalizeCameroonPhone(phone), code, defaultRole);
      navigate(await resolveRedirect(loggedInUser, redirectTo), { replace: true });
    } catch (err) {
      if (err instanceof RoleMismatchError) {
        setStep('phone');
        setCode('');
        setError(
          `Un compte existe déjà avec ce numéro sous le profil "${roleLabels[err.existingRole]}". Connectez-vous avec ce profil pour continuer.`
        );
      } else if (err instanceof Error && err.message.startsWith('QUOTA_EXCEEDED:')) {
        setError(err.message.replace('QUOTA_EXCEEDED:', ''));
      } else {
        setError('Code invalide. Réessayez.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhonePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedInUser = await signInWithPassword(normalizeCameroonPhone(phone), passwordPhone);
      navigate(await resolveRedirect(loggedInUser, redirectTo), { replace: true });
    } catch {
      setError('Identifiants invalides. Vérifiez votre téléphone et mot de passe.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSubmitting(true);

    try {
      if (isSupabaseConfigured) {
        const loggedInUser = await signInWithPassword(email.trim(), password);
        navigate(await resolveRedirect(loggedInUser, redirectTo), { replace: true });
        return;
      }


    } catch {
      setEmailError('Identifiants invalides. Essayez la connexion par téléphone (code OTP) si vous avez oublié votre mot de passe.');
    } finally {
      setEmailSubmitting(false);
    }
  };



  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden my-12">

        {/* ── Branded header ── */}
        <AuthHeader icon={profile.icon} title={t(profile.title)} subtitle={t(profile.subtitle)} />

        <div className="px-6 sm:px-8 pb-6 sm:pb-8">

          {/* ── Auth mode toggle: Téléphone / Email ── */}
          <div className="grid grid-cols-2 bg-bg-secondary rounded-xl p-1 mb-5" role="tablist" aria-label="Mode de connexion">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'simple'}
              onClick={() => setAuthMode('simple')}
              className={`h-10 rounded-lg text-sm font-inter font-medium transition-colors flex items-center justify-center gap-1.5 ${authMode === 'simple'
                ? 'bg-white text-green-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
                }`}
            >
              <Smartphone className="w-4 h-4" />
              {t("Téléphone")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'pro'}
              onClick={() => setAuthMode('pro')}
              className={`h-10 rounded-lg text-sm font-inter font-medium transition-colors flex items-center justify-center gap-1.5 ${authMode === 'pro'
                ? 'bg-white text-green-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
                }`}
            >
              <Mail className="w-4 h-4" />
              {t("Email")}
            </button>
          </div>

          {/* ══════════════════════════════════════════
            Email + Password
            ══════════════════════════════════════════ */}
          {authMode === 'pro' ? (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">{t("Adresse email")}</label>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary transition-all">
                  <Mail className="w-4 h-4 text-text-muted shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom.prenom@gmail.com"
                    className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">{t("Mot de passe")}</label>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary transition-all">
                  <ShieldCheck className="w-4 h-4 text-text-muted shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="text-text-muted hover:text-text-secondary transition-colors shrink-0 p-1 -mr-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {emailError && <p className="text-error text-sm font-inter" role="alert">{emailError}</p>}
              <button
                type="submit"
                disabled={emailSubmitting}
                className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-xl hover:bg-green-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {emailSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("Connexion...")}</> : <>{t("Se connecter")} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          ) : step === 'phone' && !phonePasswordMode ? (
            /* ══════════════════════════════════════════
            Phone OTP (step 1: enter phone)
               ══════════════════════════════════════════ */
            <form onSubmit={handlePhoneOtp} className="space-y-4">
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">{t("Numéro de téléphone")}</label>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary transition-all">
                  <Phone className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-text-primary font-inter text-[15px] font-medium shrink-0 select-none">+237</span>
                  <input
                    type="tel"
                    value={displayCameroonPhone(phone)}
                    onChange={(e) => setPhone(normalizeCameroonPhone(e.target.value))}
                    placeholder="6XX XX XX XX"
                    className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                    required
                  />
                </div>
              </div>
              {error && <p className="text-error text-sm font-inter" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-xl hover:bg-green-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("Envoi...")}</> : <>{t("Recevoir le code")} <ArrowRight className="w-4 h-4" /></>}
              </button>
              {isSupabaseConfigured && (
                <button
                  type="button"
                  onClick={() => { setPhonePasswordMode(true); setError(''); }}
                  className="w-full text-green-primary font-inter text-sm font-medium hover:text-green-dark transition-colors"
                >
                  {t("Utiliser le mot de passe")}
                </button>
              )}
            </form>
          ) : step === 'phone' && phonePasswordMode ? (
            /* ══════════════════════════════════════════
            Phone + Password (alternative au OTP)
               ══════════════════════════════════════════ */
            <form onSubmit={handlePhonePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">{t("Numéro de téléphone")}</label>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary transition-all">
                  <Phone className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-text-primary font-inter text-[15px] font-medium shrink-0 select-none">+237</span>
                  <input
                    type="tel"
                    value={displayCameroonPhone(phone)}
                    onChange={(e) => setPhone(normalizeCameroonPhone(e.target.value))}
                    placeholder="6XX XX XX XX"
                    className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">{t("Mot de passe")}</label>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary transition-all">
                  <ShieldCheck className="w-4 h-4 text-text-muted shrink-0" />
                  <input
                    type="password"
                    value={passwordPhone}
                    onChange={(e) => setPasswordPhone(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                    required
                  />
                </div>
              </div>
              {error && <p className="text-error text-sm font-inter" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-xl hover:bg-green-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("Connexion...")}</> : <>{t("Se connecter")} <ArrowRight className="w-4 h-4" /></>}
              </button>
              <button
                type="button"
                onClick={() => { setPhonePasswordMode(false); setError(''); }}
                className="w-full text-text-secondary font-inter text-sm hover:text-text-primary transition-colors"
              >
                {t("Utiliser le code OTP")}
              </button>
            </form>
          ) : (
            /* ══════════════════════════════════════════
               Phone OTP (step 2: enter code)
               ══════════════════════════════════════════ */
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <p className="text-text-secondary font-inter text-sm text-center mb-4">
                  {t("Code envoyé au")} <strong className="text-text-primary">+237 {displayCameroonPhone(phone)}</strong>
                </p>
                <label className="block text-text-secondary font-inter text-sm mb-2">{t("Code reçu par SMS")}</label>
                <OtpInput value={code} onChange={setCode} disabled={submitting} />
              </div>
              {error && <p className="text-error text-sm font-inter" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={submitting || code.length < 5}
                className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-xl hover:bg-green-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("Vérification...")}</> : 'Confirmer'}
              </button>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setCode(''); setError(''); }}
                  className="text-text-secondary font-inter text-sm hover:text-text-primary min-h-11"
                >
                  {t("Changer de numéro")}
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendIn > 0}
                  className="text-green-primary font-inter text-sm font-medium hover:text-green-dark disabled:text-text-muted min-h-11"
                >
                  {resendIn > 0 ? `Renvoyer (${resendIn}s)` : 'Renvoyer le code'}
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════
            Cross-profile quick links
            ══════════════════════════════════════════ */}
          {crossLinks.length > 0 && (
            <div className="mt-6 pt-5 border-t border-border-light">
              <p className="text-text-muted text-[11px] font-inter font-medium uppercase tracking-wider mb-3">
                {t("Autres profils")}
              </p>
              <div className="space-y-1.5">
                {crossLinks.map((link) => (
                  <Link
                    key={link.role}
                    to={getLoginPath(link.role)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-bg-secondary transition-colors group"
                  >
                    <link.icon className="w-4 h-4 text-text-muted group-hover:text-green-primary transition-colors shrink-0" />
                    <span className="text-text-secondary font-inter text-sm group-hover:text-text-primary transition-colors">
                      {t(link.label)}
                    </span>
                    <span className="text-green-primary font-inter text-xs font-medium ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      {t("Connexion")} <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer: link to sign-up ── */}
          <p className="text-center text-text-secondary font-inter text-sm mt-5">
            {t("Pas encore de compte ?")}{' '}
            <Link
              to={getSignupPath(defaultRole)}
              className="text-green-primary font-semibold hover:text-green-dark underline inline-flex items-center min-h-11"
            >
              {t("S'inscrire")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
