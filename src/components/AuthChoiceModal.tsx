import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import OtpInput from './OtpInput';
import { normalizeCameroonPhone, displayCameroonPhone } from '../lib/phone';
import { Mail, Phone, ArrowRight, Loader2, ShieldCheck, Eye, EyeOff, Smartphone, X, User, Store, Bike } from 'lucide-react';
import type { UserRole } from '../contexts/AuthContext';

interface AuthChoiceModalProps {
  /** Route de redirection après connexion (par défaut /checkout ou /) */
  redirectTo?: string;
  /** Rôle par défaut pour l'inscription */
  defaultRole?: UserRole;
  /** Fermeture sans action */
  onClose: () => void;
}

export default function AuthChoiceModal({ redirectTo = '/checkout', defaultRole = 'client', onClose }: AuthChoiceModalProps) {
  const navigate = useNavigate();
  const { sendOtp, verifyOtp, signInWithPassword, isSupabaseConfigured } = useAuth();
  const { t } = useTranslation();

  // Choix initial : 'connect' | 'signup' | null
  const [choice, setChoice] = useState<'connect' | 'signup' | null>(null);

  // --- Connexion par téléphone (OTP) ---
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // --- Connexion par email ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');

  // --- Inscription (si choix signup, rediriger vers la page d'inscription) ---
  const handleSignupRedirect = () => {
    const signupRoutes: Record<string, string> = {
      client: '/inscription',
      restaurant: '/inscription/restaurant',
      livreur: '/inscription/livreur',
    };
    onClose();
    navigate(signupRoutes[defaultRole] || '/inscription', { state: { from: redirectTo } });
  };

  // --- Connexion OTP ---
  const handlePhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await sendOtp(normalizeCameroonPhone(phone));
      if (result && typeof result === 'object' && 'exists' in result) {
        if (!result.exists) {
          setError(t("Aucun compte trouvé avec ce numéro."));
          setSubmitting(false);
          return;
        }
      }
      setStep('code');
      setCode('');
    } catch {
      setError(t("Impossible d'envoyer le code."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await verifyOtp(normalizeCameroonPhone(phone), code, defaultRole);
      onClose();
      navigate(redirectTo, { replace: true });
    } catch {
      setError(t("Code invalide."));
    } finally {
      setSubmitting(false);
    }
  };

  // --- Connexion email ---
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!email.trim()) { setEmailError(t("Email requis.")); return; }
    if (!password) { setEmailError(t("Mot de passe requis.")); return; }
    setSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      onClose();
      navigate(redirectTo, { replace: true });
    } catch {
      setEmailError(t("Identifiants invalides."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("Connexion ou inscription")}
    >
      <div className="bg-white w-full sm:max-w-[420px] rounded-t-2xl sm:rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-poppins font-bold text-text-primary text-lg">
            {choice === 'connect'
              ? t("Connectez-vous")
              : choice === 'signup'
                ? t("Créez un compte")
                : t("Pour continuer")}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-text-muted hover:text-text-primary rounded-lg" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── ÉTAPE 1 : Choix Connect / Signup ── */}
        {!choice && (
          <div className="space-y-4">
            <p className="text-text-secondary font-inter text-sm">
              {t("Ajoutez vos plats au panier et choisissez :")}
            </p>
            <button
              type="button"
              onClick={() => setChoice('connect')}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border-custom hover:border-green-primary hover:bg-green-light/20 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-green-light flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-green-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-inter font-semibold text-text-primary text-sm">{t("J'ai déjà un compte")}</p>
                <p className="font-inter text-xs text-text-muted">{t("Connectez-vous pour finaliser")}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-green-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              type="button"
              onClick={handleSignupRedirect}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border-custom hover:border-green-primary hover:bg-green-light/20 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-gold-light flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-gold-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-inter font-semibold text-text-primary text-sm">{t("Créer un compte")}</p>
                <p className="font-inter text-xs text-text-muted">{t("Inscrivez-vous rapidement")}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-green-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        )}

        {/* ── ÉTAPE 2 : Formulaire de CONNEXION ── */}
        {choice === 'connect' && (
          <div className="space-y-4">
            {/* Email */}
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-inter font-medium text-text-secondary mb-1">{t("Email")}</label>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-3 h-11 focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10 transition-all">
                  <Mail className="w-4 h-4 text-text-muted shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom.prenom@gmail.com"
                    className="flex-1 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-inter font-medium text-text-secondary mb-1">{t("Mot de passe")}</label>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-3 h-11 focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10 transition-all">
                  <ShieldCheck className="w-4 h-4 text-text-muted shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-text-muted p-1">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {emailError && <p className="text-error text-xs font-inter">{emailError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-primary text-white font-inter font-semibold h-[44px] rounded-xl hover:bg-green-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {submitting ? t("Connexion...") : t("Se connecter")}
              </button>
            </form>

            {/* Séparateur */}

            <div className="flex items-center gap-3">
              <span className="flex-1 h-px bg-border-light" />
              <span className="text-xs font-inter text-text-muted">{t("OU")}</span>
              <span className="flex-1 h-px bg-border-light" />
            </div>

            {/* Phone OTP */}
            {step === 'phone' ? (
              <form onSubmit={handlePhoneOtp} className="space-y-3">
                <div>
                  <label className="block text-xs font-inter font-medium text-text-secondary mb-1">{t("Par téléphone")}</label>
                  <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-3 h-11 focus-within:border-green-primary focus-within:ring-2 focus-within:ring-green-primary/10 transition-all">
                    <Phone className="w-4 h-4 text-text-muted shrink-0" />
                    <span className="text-sm font-inter text-text-primary font-medium shrink-0">+237</span>
                    <input
                      type="tel"
                      value={displayCameroonPhone(phone)}
                      onChange={(e) => setPhone(normalizeCameroonPhone(e.target.value))}
                      placeholder="6XX XX XX XX"
                      className="flex-1 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                    />
                  </div>
                </div>
                {error && <p className="text-error text-xs font-inter">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-white border border-border-custom text-text-primary font-inter font-semibold h-[44px] rounded-xl hover:bg-bg-secondary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                  {submitting ? t("Envoi...") : t("Recevoir un code")}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-3">
                <p className="text-xs font-inter text-text-secondary text-center">
                  {t("Code envoyé au")} <strong className="text-text-primary">+237 {displayCameroonPhone(phone)}</strong>
                </p>
                <OtpInput value={code} onChange={setCode} disabled={submitting} />
                {error && <p className="text-error text-xs font-inter text-center">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting || code.length < 5}
                  className="w-full bg-green-primary text-white font-inter font-semibold h-[44px] rounded-xl hover:bg-green-dark transition-colors disabled:opacity-60"
                >
                  {submitting ? t("Vérification...") : t("Confirmer")}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="w-full text-center text-xs font-inter text-text-secondary hover:text-text-primary"
                >
                  {t("Changer de numéro")}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => setChoice(null)}
              className="w-full text-center text-xs font-inter text-text-secondary hover:text-text-primary"
            >
              ← {t("Retour")}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
