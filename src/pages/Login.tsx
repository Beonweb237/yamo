import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, ShieldCheck, User, Store, Bike, Mail, Smartphone } from 'lucide-react';
import { useAuth, LOCAL_SESSION_KEY, LOCAL_REGISTRY_KEY, type UserRole } from '../contexts/AuthContext';
import { getLocalSuspensionInfo } from '../lib/drivers';

const roleRedirects: Record<UserRole, string> = {
  client: '/',
  restaurant: '/partenaires/dashboard',
  livreur: '/livreurs/dashboard',
  admin: '/admin',
};

function getRedirect(role: UserRole, from?: string) {
  if (role === 'client' && from) return from;
  return roleRedirects[role];
}

// Mock email registry — simulates accounts for dev mode
const MOCK_EMAIL_PASSWORDS: Record<string, { phone: string; role: UserRole; approved: boolean }> = {
  'admin@yamo.cm': { phone: '+237690000001', role: 'admin', approved: true },
  'client@yamo.cm': { phone: '+237690000002', role: 'client', approved: true },
  'restaurant@yamo.cm': { phone: '+237690000003', role: 'restaurant', approved: true },
  'resto-pending@yamo.cm': { phone: '+237690000004', role: 'restaurant', approved: false },
  'livreur@yamo.cm': { phone: '+237690000005', role: 'livreur', approved: true },
  'livreur-pending@yamo.cm': { phone: '+237690000006', role: 'livreur', approved: false },
};
const MOCK_PASSWORD = 'yamo2026';

const roleOptions: { value: UserRole; label: string; icon: typeof User }[] = [
  { value: 'client', label: 'Client', icon: User },
  { value: 'restaurant', label: 'Restaurateur', icon: Store },
  { value: 'livreur', label: 'Livreur', icon: Bike },
];

export default function Login() {
  const { sendOtp, verifyOtp, signInWithPassword, isSupabaseConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  const [mode, setMode] = useState<'phone' | 'email'>('phone');

  // --- Phone OTP state ---
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+237 ');
  const [role, setRole] = useState<UserRole>('client');
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
      await verifyOtp(phone.replace(/\s/g, ''), code, role);
      navigate(getRedirect(role, redirectTo), { replace: true });
    } catch {
      setError('Code invalide. Réessayez.');
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
        await signInWithPassword(email.trim(), password);
        navigate(redirectTo, { replace: true });
        return;
      }

      // Mock mode: lookup predefined accounts
      const mockUser = MOCK_EMAIL_PASSWORDS[email.trim().toLowerCase()];
      if (!mockUser || password !== MOCK_PASSWORD) {
        setEmailError('Email ou mot de passe incorrect.');
        setEmailSubmitting(false);
        return;
      }

      // Simulate verified session (same as verifyOtp mock fallback)
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
      // Force page reload so AuthContext picks up the new session
      navigate(getRedirect(mockUser.role), { replace: true });
      window.location.reload();
    } catch {
      setEmailError('Identifiants invalides.');
    } finally {
      setEmailSubmitting(false);
    }
  };

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6 sm:p-8 my-12">
        <h1 className="font-poppins font-bold text-text-primary text-2xl mb-2">Connexion</h1>
        <p className="text-text-secondary font-inter text-sm mb-6">
          Connectez-vous pour accéder à votre espace Yamo.
        </p>

        {/* Mode tabs — always visible */}
        <div className="flex gap-1 bg-bg-secondary rounded-lg p-1 mb-5">
          <button
            type="button"
            onClick={() => setMode('phone')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md text-sm font-inter font-medium py-2 transition-colors ${mode === 'phone' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary'
              }`}
          >
            <Smartphone className="w-4 h-4" />
            Téléphone
          </button>
          <button
            type="button"
            onClick={() => setMode('email')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md text-sm font-inter font-medium py-2 transition-colors ${mode === 'email' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary'
              }`}
          >
            <Mail className="w-4 h-4" />
            Email
          </button>
        </div>

        {!isSupabaseConfigured && mode === 'phone' && (
          <div className="bg-gold-light text-gold-accent text-xs font-inter rounded-lg px-3 py-2 mb-5">
            Mode démo : aucun SMS n'est envoyé, saisissez n'importe quel code à l'étape suivante.
          </div>
        )}

        {mode === 'email' ? (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">Adresse email</label>
              <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                <Mail className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@yamo.cm"
                  className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">Mot de passe</label>
              <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
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
            {!isSupabaseConfigured && (
              <div className="bg-green-light text-green-primary text-xs font-inter rounded-lg px-3 py-2 space-y-1">
                <p className="font-semibold mb-1">📧 Comptes mock — mot de passe : <strong>yamo2026</strong></p>
                <p>✅ <strong>admin@yamo.cm</strong> — Admin</p>
                <p>✅ <strong>client@yamo.cm</strong> — Client</p>
                <p>✅ <strong>restaurant@yamo.cm</strong> — Restaurateur (approuvé)</p>
                <p>⏳ <strong>resto-pending@yamo.cm</strong> — Restaurateur (en attente)</p>
                <p>✅ <strong>livreur@yamo.cm</strong> — Livreur (approuvé)</p>
                <p>⏳ <strong>livreur-pending@yamo.cm</strong> — Livreur (en attente)</p>
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
          <form onSubmit={handlePhoneOtp} className="space-y-4">
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">Je suis...</label>
              <div className="grid grid-cols-3 gap-2">
                {roleOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border py-3 transition-colors ${role === opt.value
                      ? 'border-green-primary bg-green-light text-green-primary'
                      : 'border-border-custom text-text-secondary hover:bg-bg-secondary'
                      }`}
                  >
                    <opt.icon className="w-5 h-5" />
                    <span className="text-xs font-inter font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-text-muted text-xs font-inter mt-1.5">
                Ce choix ne compte que lors de votre toute première connexion.
              </p>
              {!isSupabaseConfigured && (
                <div className="bg-blue-50 text-blue-700 text-[11px] font-inter rounded-lg px-3 py-2 mt-2 space-y-0.5">
                  <p className="font-semibold">📱 Numéros de test pré-enregistrés :</p>
                  <p>+237690000001 — Admin ✅</p>
                  <p>+237690000002 — Client ✅</p>
                  <p>+237690000003 — Restaurateur ✅</p>
                  <p>+237690000004 — Restaurateur ⏳</p>
                  <p>+237690000005 — Livreur ✅</p>
                  <p>+237690000006 — Livreur ⏳</p>
                  <p className="text-[10px] mt-1">(ou n'importe quel numéro — le rôle est choisi ci-dessus)</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">Numéro de téléphone</label>
              <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                <Phone className="w-4 h-4 text-text-muted shrink-0" />
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6XX XX XX XX" className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted" required />
              </div>
            </div>
            {error && <p className="text-error text-sm font-inter">{error}</p>}
            <button type="submit" disabled={submitting} className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60">
              {submitting ? 'Envoi...' : 'Recevoir le code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">Code reçu par SMS</label>
              <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                <ShieldCheck className="w-4 h-4 text-text-muted shrink-0" />
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted" required />
              </div>
            </div>
            {error && <p className="text-error text-sm font-inter">{error}</p>}
            <button type="submit" disabled={submitting} className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60">
              {submitting ? 'Vérification...' : 'Confirmer'}
            </button>
            <button type="button" onClick={() => setStep('phone')} className="w-full text-text-secondary font-inter text-sm hover:text-text-primary">
              Changer de numéro
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
