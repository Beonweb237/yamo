import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Phone, ShieldCheck, User, Store, Bike, Mail, Smartphone, ArrowRight, Eye, EyeOff, Loader2, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import AuthHeader from '../components/AuthHeader';
import OtpInput from '../components/OtpInput';
import { useAuth, LOCAL_SESSION_KEY, LOCAL_REGISTRY_KEY, LOCAL_EMAIL_USERS_KEY, RoleMismatchError, type AuthUser, type UserRole } from '../contexts/AuthContext';
import { getLocalSuspensionInfo } from '../lib/drivers';
import { fetchMyApplications } from '../lib/applications';
import { demoAccountsForRole } from '../data/demoAccounts';

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
    if (!hasApplication) return '/candidature';
  }
  return roleRedirects[user.role];
}

// Mock email registry — for dev mode (VITE_FORCE_MOCK_AUTH=true)
const MOCK_EMAIL_PASSWORDS: Record<string, { phone: string; role: UserRole; approved: boolean }> = {
  'admin@yamo.cm': { phone: '+237690000001', role: 'admin', approved: true },
  'client@yamo.cm': { phone: '+237690000002', role: 'client', approved: true },
  'restaurant@yamo.cm': { phone: '+237690000003', role: 'restaurant', approved: true },
  'resto-pending@yamo.cm': { phone: '+237690000004', role: 'restaurant', approved: false },
  'livreur@yamo.cm': { phone: '+237690000005', role: 'livreur', approved: true },
  'livreur-pending@yamo.cm': { phone: '+237690000006', role: 'livreur', approved: false },
};

const MOCK_PASSWORD = 'yamo2026';

export default function Login({ defaultRole = 'client' as UserRole }: { defaultRole?: UserRole }) {
  const { sendOtp, verifyOtp, signInWithPassword, isSupabaseConfigured } = useAuth();
  const isDemoMode = !isSupabaseConfigured || import.meta.env.VITE_ENABLE_DEMO_DATA === 'true' || import.meta.env.VITE_FORCE_MOCK_AUTH === 'true';
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  const profile = profileConfigs[defaultRole];
  const crossLinks = getCrossLinks(defaultRole);

  // "Simplifié" = phone OTP (default) | "Pro" = email + password
  const [authMode, setAuthMode] = useState<'simple' | 'pro'>('simple');

  // --- Phone OTP state ---
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+237 ');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // --- Email state ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      await sendOtp(phone.replace(/\s/g, ''));
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
      await sendOtp(phone.replace(/\s/g, ''));
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
      const loggedInUser = await verifyOtp(phone.replace(/\s/g, ''), code, defaultRole);
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

      const emailKey = email.trim().toLowerCase();
      // Si le champ contient un numéro de téléphone, on le nettoie aussi
      // pour chercher dans le registre des mots de passe (adminSetPassword).
      const phoneKeyFromEmail = emailKey.startsWith('+') ? emailKey.replace(/\s/g, '') : null;
      const emailUsers = JSON.parse(localStorage.getItem(LOCAL_EMAIL_USERS_KEY) ?? '{}');
      // Cherche d'abord par email, puis par téléphone si pertinent
      const registered = emailUsers[emailKey] ?? (phoneKeyFromEmail ? emailUsers[phoneKeyFromEmail] : undefined);
      let mockUser = MOCK_EMAIL_PASSWORDS[emailKey];

      if (registered) {
        if (password !== registered.password) {
          setEmailError('Email ou mot de passe incorrect.');
          setEmailSubmitting(false);
          return;
        }
        const phoneKey = registered.phone;
        const registryData: Record<string, any> = JSON.parse(localStorage.getItem(LOCAL_REGISTRY_KEY) ?? '{}');
        const storedUser = registryData[phoneKey];
        mockUser = storedUser
          ? { phone: storedUser.phone, role: storedUser.role, approved: storedUser.isApproved }
          : { phone: `+237${phoneKey}`, role: 'client', approved: true };
      } else if (!mockUser || password !== MOCK_PASSWORD) {
        setEmailError('Email ou mot de passe incorrect.');
        setEmailSubmitting(false);
        return;
      }

      const localUserId = `local-${mockUser.phone.replace(/\s/g, '')}`;
      const suspensionInfo = getLocalSuspensionInfo(localUserId);
      const localUser = {
        id: localUserId,
        phone: mockUser.phone,
        role: mockUser.role,
        isApproved: mockUser.approved || mockUser.role === 'client' || mockUser.role === 'admin',
        isSuspended: suspensionInfo.isSuspended,
        suspensionReason: suspensionInfo.reason ?? null,
      };
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localUser));
      const registry: Record<string, any> = JSON.parse(localStorage.getItem(LOCAL_REGISTRY_KEY) ?? '{}');
      registry[mockUser.phone.replace(/\s/g, '')] = localUser;
      localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(registry));
      const redirectPath = await resolveRedirect(localUser);
      navigate(redirectPath, { replace: true });
      window.location.reload();
    } catch {
      setEmailError('Identifiants invalides.');
    } finally {
      setEmailSubmitting(false);
    }
  };

  // ── Comptes démo : uniquement ceux du rôle de la page, pas de mélange ──
  const demoAccounts = demoAccountsForRole(defaultRole);

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden my-12">

        {/* ── Branded header ── */}
        <AuthHeader icon={profile.icon} title={profile.title} subtitle={profile.subtitle} />

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
              Téléphone
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
              Email
            </button>
          </div>

          {/* ── Demo notice ── */}
          {isDemoMode && (
            <div className="bg-gold-light text-amber-700 text-xs font-inter rounded-lg px-3 py-2 mb-5">
              Mode démo : aucun SMS n'est envoyé, saisissez n'importe quel code à l'étape suivante.
            </div>
          )}

          {/* ── Comptes de démonstration (uniquement le rôle de la page) ── */}
          {isDemoMode && demoAccounts.length > 0 && (
            <div className="mb-5 rounded-xl border border-dashed border-green-primary/30 bg-green-light/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FlaskConical className="w-4 h-4 text-green-primary" />
                <p className="font-inter font-semibold text-green-primary text-sm">
                  Compte{demoAccounts.length > 1 ? 's' : ''} de démonstration {roleLabels[defaultRole].toLowerCase()}
                </p>
                <span className="text-text-muted text-[10px] font-inter">— cliquez pour remplir</span>
              </div>
              <div className="space-y-1.5">
                {demoAccounts.map((demo) => {
                  const isSelected = authMode === 'simple' ? phone === demo.phone : email === demo.email;
                  return (
                    <button
                      key={demo.phone}
                      type="button"
                      onClick={() => {
                        if (authMode === 'simple') {
                          setPhone(demo.phone);
                        } else {
                          setEmail(demo.email);
                          setPassword(MOCK_PASSWORD);
                        }
                        toast.success(`${demo.emoji} ${demo.label} sélectionné`, { duration: 1500 });
                      }}
                      className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all hover:shadow-sm ${isSelected ? 'border-green-primary bg-green-light/50' : 'border-border-custom bg-white hover:border-green-primary/50'}`}
                    >
                      <span className="shrink-0 text-sm" aria-hidden>{demo.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-inter text-xs font-semibold text-text-primary">{demo.label}</p>
                        <p className="font-inter text-[11px] text-text-muted truncate">{demo.phone} · {demo.desc}</p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-inter font-semibold px-1.5 py-0.5 rounded-full ${demo.approved ? 'bg-success/10 text-success' : 'bg-amber-100 text-amber-700'}`}>
                        {demo.approved ? 'Approuvé' : 'En attente'}
                      </span>
                      {isSelected && (
                        <span className="text-green-primary text-[10px] font-inter font-medium shrink-0">✓ Actif</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-text-muted text-[10px] font-inter mt-2.5 text-center">
                Mot de passe Email : <strong className="text-text-primary">yamo2026</strong>
                {authMode === 'simple' && ' · En mode Téléphone, tout code à 6 chiffres est accepté'}
              </p>
            </div>
          )}

          {/* ══════════════════════════════════════════
            PRO MODE — Email + Password
            ══════════════════════════════════════════ */}
          {authMode === 'pro' ? (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">Adresse email</label>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10 transition-all">
                  <Mail className="w-4 h-4 text-text-muted shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@yamotest.cm"
                    className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">Mot de passe</label>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10 transition-all">
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
                {emailSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Connexion...</> : <>Se connecter <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          ) : step === 'phone' ? (
            /* ══════════════════════════════════════════
               SIMPLIFIÉ — Phone OTP (step 1: enter phone)
               ══════════════════════════════════════════ */
            <form onSubmit={handlePhoneOtp} className="space-y-4">
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">Numéro de téléphone</label>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10 transition-all">
                  <Phone className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-text-primary font-inter text-[15px] font-medium shrink-0 select-none">+237</span>
                  <input
                    type="tel"
                    value={phone.replace('+237 ', '')}
                    onChange={(e) => setPhone('+237 ' + e.target.value.replace(/\s/g, ''))}
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
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi...</> : <>Recevoir le code <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          ) : (
            /* ══════════════════════════════════════════
               SIMPLIFIÉ — Phone OTP (step 2: enter code)
               ══════════════════════════════════════════ */
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <p className="text-text-secondary font-inter text-sm text-center mb-4">
                  Code envoyé au <strong className="text-text-primary">{phone}</strong>
                </p>
                <label className="block text-text-secondary font-inter text-sm mb-2">Code reçu par SMS</label>
                <OtpInput value={code} onChange={setCode} disabled={submitting} />
              </div>
              {error && <p className="text-error text-sm font-inter" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={submitting || code.length < 6}
                className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-xl hover:bg-green-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Vérification...</> : 'Confirmer'}
              </button>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setCode(''); setError(''); }}
                  className="text-text-secondary font-inter text-sm hover:text-text-primary min-h-11"
                >
                  Changer de numéro
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
                Autres profils
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
                      {link.label}
                    </span>
                    <span className="text-green-primary font-inter text-xs font-medium ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Connexion <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer: link to sign-up ── */}
          <p className="text-center text-text-secondary font-inter text-sm mt-5">
            Pas encore de compte ?{' '}
            <Link
              to={getSignupPath(defaultRole)}
              className="text-green-primary font-semibold hover:text-green-dark underline inline-flex items-center min-h-11"
            >
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
