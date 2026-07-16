import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Phone, ShieldCheck, User, Store, Bike, Mail, Smartphone, ArrowRight } from 'lucide-react';
import { useAuth, LOCAL_SESSION_KEY, LOCAL_REGISTRY_KEY, LOCAL_EMAIL_USERS_KEY, RoleMismatchError, type AuthUser, type UserRole } from '../contexts/AuthContext';
import { getLocalSuspensionInfo } from '../lib/drivers';
import { fetchMyApplications } from '../lib/applications';

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
  color: string; // accent color for the icon badge
}

const profileConfigs: Record<UserRole, ProfileConfig> = {
  client: {
    icon: User,
    title: 'Connexion Client',
    subtitle: 'Connectez-vous pour commander vos plats préférés.',
    color: 'bg-green-primary',
  },
  restaurant: {
    icon: Store,
    title: 'Connexion Restaurateur',
    subtitle: 'Gérez votre restaurant et vos commandes sur MiamExpress.',
    color: 'bg-green-primary',
  },
  livreur: {
    icon: Bike,
    title: 'Connexion Livreur',
    subtitle: 'Connectez-vous pour gérer vos livraisons.',
    color: 'bg-green-primary',
  },
  admin: {
    icon: ShieldCheck,
    title: 'Connexion Administrateur',
    subtitle: 'Administration de la plateforme MiamExpress.',
    color: 'bg-green-primary',
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

// Supabase test accounts — real auth users (seed-test-data.mjs)
const SUPABASE_TEST_ACCOUNTS = [
  { email: 'admin@yamotest.cm', role: 'Admin' },
  { email: 'marie.ngo@yamotest.cm', role: 'Client' },
  { email: 'paul.essomba@yamotest.cm', role: 'Restaurateur' },
  { email: 'samuel.njoya@yamotest.cm', role: 'Livreur' },
];
const MOCK_PASSWORD = 'yamo2026';

export default function Login({ defaultRole = 'client' as UserRole }: { defaultRole?: UserRole }) {
  const { sendOtp, verifyOtp, signInWithPassword, isSupabaseConfigured } = useAuth();
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

  // --- Email state ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const handlePhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await sendOtp(phone.replace(/\s/g, ''));
      setStep('code');
    } catch {
      setError("Impossible d'envoyer le code. Vérifiez le numéro.");
    } finally {
      setSubmitting(false);
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

      const emailUsers = JSON.parse(localStorage.getItem(LOCAL_EMAIL_USERS_KEY) ?? '{}');
      const registered = emailUsers[email.trim().toLowerCase()];
      let mockUser = MOCK_EMAIL_PASSWORDS[email.trim().toLowerCase()];

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

  // ── Only show test accounts matching the current role ──
  const filteredMockAccounts = Object.entries(MOCK_EMAIL_PASSWORDS).filter(
    ([, v]) => v.role === defaultRole
  );
  const filteredSupabaseAccounts = SUPABASE_TEST_ACCOUNTS.filter(
    (a) => {
      const r = a.role.toLowerCase();
      if (defaultRole === 'restaurant') return r === 'restaurateur';
      if (defaultRole === 'livreur') return r === 'livreur';
      if (defaultRole === 'admin') return r === 'admin';
      return r === 'client';
    }
  );

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6 sm:p-8 my-12">

        {/* ── Profile header with icon ── */}
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-xl ${profile.color} flex items-center justify-center`}>
            <profile.icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-poppins font-bold text-text-primary text-xl">{profile.title}</h1>
          </div>
        </div>
        <p className="text-text-secondary font-inter text-sm mb-6 ml-[52px]">
          {profile.subtitle}
        </p>

        {/* ── Auth mode toggle: Téléphone / Email ── */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-text-secondary font-inter text-xs shrink-0">Mode :</span>
          <div className="flex bg-bg-secondary rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setAuthMode('simple')}
              className={`px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-colors ${authMode === 'simple'
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
                }`}
            >
              <Smartphone className="w-3.5 h-3.5 inline mr-1" />
              Téléphone
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('pro')}
              className={`px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-colors ${authMode === 'pro'
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
                }`}
            >
              <Mail className="w-3.5 h-3.5 inline mr-1" />
              Email
            </button>
          </div>
        </div>

        {/* ── Demo notice ── */}
        {!isSupabaseConfigured && (
          <div className="bg-gold-light text-gold-accent text-xs font-inter rounded-lg px-3 py-2 mb-5">
            Mode démo : aucun SMS n'est envoyé, saisissez n'importe quel code à l'étape suivante.
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                  required
                />
              </div>
            </div>
            {!isSupabaseConfigured ? (
              <div className="bg-green-light text-green-primary text-xs font-inter rounded-lg px-3 py-2 space-y-1">
                <p className="font-semibold mb-1">
                  📧 Compte{filteredMockAccounts.length > 1 ? 's' : ''} {roleLabels[defaultRole].toLowerCase()} — mot de passe : <strong>{MOCK_PASSWORD}</strong>
                </p>
                {filteredMockAccounts.map(([e, v]) => (
                  <p key={e}>✅ <strong>{e}</strong>{' '}{v.approved ? '' : '⏳ (en attente)'}</p>
                ))}
              </div>
            ) : (
              <div className="bg-green-light text-green-primary text-xs font-inter rounded-lg px-3 py-2 space-y-1">
                <p className="font-semibold mb-1">📧 Comptes Supabase — mot de passe : <strong>YamoTest2026!</strong></p>
                {filteredSupabaseAccounts.map((a) => (
                  <p key={a.email}>✅ <strong>{a.email}</strong> — {a.role}</p>
                ))}
              </div>
            )}
            {emailError && <p className="text-error text-sm font-inter">{emailError}</p>}
            <button
              type="submit"
              disabled={emailSubmitting}
              className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
            >
              {emailSubmitting ? 'Connexion...' : 'Se connecter'}
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
            {!isSupabaseConfigured && (
              <div className="bg-blue-50 text-blue-700 text-[11px] font-inter rounded-lg px-3 py-2 space-y-0.5">
                <p className="font-semibold">📱 Numéros de test {roleLabels[defaultRole].toLowerCase()} :</p>
                {Object.entries(MOCK_EMAIL_PASSWORDS)
                  .filter(([, v]) => v.role === defaultRole)
                  .map(([, v]) => (
                    <p key={v.phone}>{v.phone} {v.approved ? '✅' : '⏳'}</p>
                  ))}
                <p className="text-[10px] mt-1">(ou n'importe quel numéro)</p>
              </div>
            )}
            {error && <p className="text-error text-sm font-inter">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
            >
              {submitting ? 'Envoi...' : 'Recevoir le code'}
            </button>
          </form>
        ) : (
          /* ══════════════════════════════════════════
             SIMPLIFIÉ — Phone OTP (step 2: enter code)
             ══════════════════════════════════════════ */
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">Code reçu par SMS</label>
              <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10 transition-all">
                <ShieldCheck className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                  required
                />
              </div>
            </div>
            {error && <p className="text-error text-sm font-inter">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
            >
              {submitting ? 'Vérification...' : 'Confirmer'}
            </button>
            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full text-text-secondary font-inter text-sm hover:text-text-primary"
            >
              Changer de numéro
            </button>
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
            className="text-green-primary font-semibold hover:text-green-dark underline"
          >
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}
