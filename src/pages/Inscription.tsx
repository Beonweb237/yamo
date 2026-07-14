import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Phone,
  ShieldCheck,
  User,
  Store,
  Bike,
  Mail,
  Smartphone,
  UserPlus,
} from 'lucide-react';
import { useAuth, RoleMismatchError, type AuthUser, type UserRole } from '../contexts/AuthContext';
import { fetchMyApplications } from '../lib/applications';

// ── English translations (EN) ──────────────────────────────────────────
// Sign Up   |   Créer votre compte Yamo   |   Already have an account? Log in
// Full name |   Phone number   |   Email address   |   Password
// I am a... |   Client / Restaurant Owner / Driver
// I accept the   |   Terms of Service   |   and   |   Privacy Policy
// Create my account   |   Creating account...
// Demo mode: no SMS is sent, enter any code at the next step.
// This choice only matters on your first sign-up.
// An account already exists with this number. Please log in instead.
// Invalid code. Please try again.
// ────────────────────────────────────────────────────────────────────────

const roleRedirects: Record<UserRole, string> = {
  client: '/',
  restaurant: '/partenaires/dashboard',
  livreur: '/livreurs/dashboard',
  admin: '/admin',
};

const roleLabels: Record<UserRole, string> = {
  client: 'Client',
  restaurant: 'Restaurateur',
  livreur: 'Livreur',
  admin: 'Administrateur',
};

async function resolveRedirect(user: AuthUser): Promise<string> {
  if (user.role === 'client') return '/';
  if (user.role === 'admin') return roleRedirects.admin;
  if (!user.isApproved) {
    const apps = await fetchMyApplications(user.id);
    const hasApplication = apps.some((a) => a.type === user.role);
    if (!hasApplication) return '/candidature';
  }
  return roleRedirects[user.role];
}

const roleOptions: { value: UserRole; label: string; icon: typeof User }[] = [
  { value: 'client', label: 'Client', icon: User },
  { value: 'restaurant', label: 'Restaurateur', icon: Store },
  { value: 'livreur', label: 'Livreur', icon: Bike },
];

export default function Inscription() {
  const { sendOtp, verifyOtp, signUp, isSupabaseConfigured } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'phone' | 'email'>('email');

  // ── Phone OTP state ──
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [phone, setPhone] = useState('+237 ');
  const [role, setRole] = useState<UserRole>('client');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Email signup state ──
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailPhone, setEmailPhone] = useState('+237 ');
  const [emailRole, setEmailRole] = useState<UserRole>('client');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // ── Phone OTP: send code ──
  const handleSendOtp = async (e: React.FormEvent) => {
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

  // ── Phone OTP: verify code (this also creates the account if new) ──
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedInUser = await verifyOtp(phone.replace(/\s/g, ''), code, role);
      navigate(await resolveRedirect(loggedInUser), { replace: true });
    } catch (err) {
      if (err instanceof RoleMismatchError) {
        setError(
          `Un compte existe déjà avec ce numéro sous le profil "${roleLabels[err.existingRole]}". Veuillez vous connecter.`
          // EN: An account already exists with this number under the
          //     "${roleLabels[err.existingRole]}" profile. Please log in.
        );
        setStep('form');
        setCode('');
      } else {
        setError('Code invalide. Réessayez.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Email signup ──
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    // Validation
    if (!name.trim()) {
      setEmailError('Veuillez entrer votre nom complet.');
      return;
    }
    if (password.length < 6) {
      setEmailError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setEmailError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (!acceptedTerms) {
      setEmailError("Vous devez accepter les conditions d'utilisation.");
      return;
    }

    setEmailSubmitting(true);
    try {
      const newUser = await signUp({
        email: email.trim(),
        password,
        phone: emailPhone.replace(/\s/g, ''),
        name: name.trim(),
        role: emailRole,
      });
      navigate(await resolveRedirect(newUser), { replace: true });
    } catch (err: any) {
      setEmailError(err?.message ?? "Erreur lors de l'inscription. Veuillez réessayer.");
      // EN: Sign-up failed. Please try again.
    } finally {
      setEmailSubmitting(false);
    }
  };

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
      <div className="w-full max-w-[460px] bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-6 sm:p-8 my-12">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-lg bg-green-light flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-green-primary" />
          </div>
          <h1 className="font-poppins font-bold text-text-primary text-2xl">
            Inscription
            {/* EN: Sign Up */}
          </h1>
        </div>
        <p className="text-text-secondary font-inter text-sm mb-6">
          Créez votre compte Yamo et commencez à commander ou à livrer.
          {/* EN: Create your Yamo account and start ordering or delivering. */}
        </p>

        {/* Mode tabs */}
        <div className="flex gap-1 bg-bg-secondary rounded-lg p-1 mb-5">
          <button
            type="button"
            onClick={() => setMode('email')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md text-sm font-inter font-medium py-2 transition-colors ${mode === 'email'
              ? 'bg-white text-text-primary shadow-sm'
              : 'text-text-secondary'
              }`}
          >
            <Mail className="w-4 h-4" />
            Email
          </button>
          <button
            type="button"
            onClick={() => setMode('phone')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md text-sm font-inter font-medium py-2 transition-colors ${mode === 'phone'
              ? 'bg-white text-text-primary shadow-sm'
              : 'text-text-secondary'
              }`}
          >
            <Smartphone className="w-4 h-4" />
            Téléphone
          </button>
        </div>

        {/* ── DEMO BANNER ── */}
        {!isSupabaseConfigured && (
          <div className="bg-gold-light text-gold-accent text-xs font-inter rounded-lg px-3 py-2 mb-5">
            {mode === 'phone'
              ? "Mode démo : aucun SMS n'est envoyé, saisissez n'importe quel code à l'étape suivante."
              : "Mode démo : les comptes sont sauvegardés localement dans votre navigateur."
            }
            {/* EN phone: Demo mode — no SMS is sent, enter any code at the next step. */}
            {/* EN email: Demo mode — accounts are saved locally in your browser. */}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            EMAIL SIGN-UP
            ════════════════════════════════════════════════════════════ */}
        {mode === 'email' && (
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Nom complet
                {/* EN: Full name */}
              </label>
              <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                <User className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Adresse email
                {/* EN: Email address */}
              </label>
              <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                <Mail className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean@exemple.cm"
                  className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Numéro de téléphone
                {/* EN: Phone number */}
              </label>
              <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                <Phone className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="tel"
                  value={emailPhone}
                  onChange={(e) => setEmailPhone(e.target.value)}
                  placeholder="+237 6XX XX XX XX"
                  className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                  required
                />
              </div>
            </div>

            {/* Role selector */}
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Je suis...
                {/* EN: I am a... */}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {roleOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEmailRole(opt.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border py-3 transition-colors ${emailRole === opt.value
                      ? 'border-green-primary bg-green-light text-green-primary'
                      : 'border-border-custom text-text-secondary hover:bg-bg-secondary'
                      }`}
                  >
                    <opt.icon className="w-5 h-5" />
                    <span className="text-xs font-inter font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
              {emailRole !== 'client' && (
                <p className="text-gold-accent text-xs font-inter mt-1.5">
                  {emailRole === 'restaurant'
                    ? 'Après inscription, vous devrez soumettre un dossier de candidature pour validation.'
                    : 'Après inscription, vous devrez soumettre un dossier de candidature pour validation.'}
                  {/* EN: After signing up, you'll need to submit an application for approval. */}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Mot de passe
                {/* EN: Password */}
              </label>
              <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                <ShieldCheck className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Confirmer le mot de passe
                {/* EN: Confirm password */}
              </label>
              <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                <ShieldCheck className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Terms checkbox */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border-custom text-green-primary focus:ring-green-primary"
              />
              <span className="text-text-secondary font-inter text-xs leading-relaxed">
                J'accepte les{' '}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); /* TODO: open terms modal */ }}
                  className="text-green-primary underline hover:text-green-dark"
                >
                  conditions d'utilisation
                </button>{' '}
                et la{' '}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); /* TODO: open privacy modal */ }}
                  className="text-green-primary underline hover:text-green-dark"
                >
                  politique de confidentialité
                </button>
                .
                {/* EN: I accept the Terms of Service and the Privacy Policy. */}
              </span>
            </label>

            {emailError && (
              <p className="text-error text-sm font-inter">{emailError}</p>
            )}

            <button
              type="submit"
              disabled={emailSubmitting}
              className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
            >
              {emailSubmitting ? 'Création du compte...' : 'Créer mon compte'}
              {/* EN: Create my account */}
            </button>
          </form>
        )}

        {/* ════════════════════════════════════════════════════════════
            PHONE OTP SIGN-UP
            ════════════════════════════════════════════════════════════ */}
        {mode === 'phone' && step === 'form' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            {/* Role selector */}
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Je suis...
                {/* EN: I am a... */}
              </label>
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
                Ce choix ne compte que lors de votre toute première inscription.
                {/* EN: This choice only matters on your first sign-up. */}
              </p>
              {!isSupabaseConfigured && (
                <div className="bg-blue-50 text-blue-700 text-[11px] font-inter rounded-lg px-3 py-2 mt-2">
                  <p>📱 Saisissez n'importe quel numéro — le rôle est choisi ci-dessus.</p>
                </div>
              )}
              {role !== 'client' && (
                <p className="text-gold-accent text-xs font-inter mt-1.5">
                  Après vérification, vous devrez soumettre un dossier de candidature.
                  {/* EN: After verification, you'll need to submit an application. */}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Numéro de téléphone
                {/* EN: Phone number */}
              </label>
              <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                <Phone className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+237 6XX XX XX XX"
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
              {submitting ? 'Envoi...' : 'Recevoir le code'}
              {/* EN: Send code */}
            </button>
          </form>
        )}

        {mode === 'phone' && step === 'code' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-text-secondary font-inter text-sm">
              Un code a été envoyé au {phone}
              {/* EN: A code was sent to {phone} */}
            </p>
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Code reçu par SMS
                {/* EN: SMS code */}
              </label>
              <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
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
              {/* EN: Verify */}
            </button>
            <button
              type="button"
              onClick={() => setStep('form')}
              className="w-full text-text-secondary font-inter text-sm hover:text-text-primary"
            >
              Changer de numéro
              {/* EN: Change number */}
            </button>
          </form>
        )}

        {/* ── Footer: link to login ── */}
        <p className="text-center text-text-secondary font-inter text-sm mt-6">
          Déjà un compte ?{' '}
          {/* EN: Already have an account?{' '} */}
          <Link
            to="/connexion"
            className="text-green-primary font-semibold hover:text-green-dark underline"
          >
            Se connecter
            {/* EN: Log in */}
          </Link>
        </p>
      </div>
    </div>
  );
}
