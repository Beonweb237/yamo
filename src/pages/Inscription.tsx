import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Phone,
  ShieldCheck,
  User,
  Store,
  Bike,
  Mail,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import AuthHeader from '../components/AuthHeader';
import { useAuth, type AuthUser, type UserRole } from '../contexts/AuthContext';
import { fetchMyApplications } from '../lib/applications';
import { displayCameroonPhone, normalizeCameroonPhone } from '../lib/phone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const TERMS_CONTENT = `Ces conditions d'utilisation régissent l'accès et l'usage de la plateforme MiamExpress (application et site web) par les clients, restaurants et livreurs.

1. Objet — MiamExpress met en relation des clients, des restaurants partenaires et des livreurs indépendants pour la commande et la livraison de repas au Cameroun.

2. Comptes — Chaque utilisateur est responsable de l'exactitude des informations fournies lors de son inscription et de la confidentialité de ses identifiants.

3. Commandes — Les prix, délais de préparation et frais de livraison affichés sont fournis par les restaurants partenaires et peuvent varier. MiamExpress agit comme intermédiaire technique entre les parties.

4. Paiement — Les paiements peuvent être effectués en espèces à la livraison ou via Mobile Money (MTN MoMo, Orange Money). Toute commission MiamExpress est prélevée sur les restaurants partenaires, non sur les clients.

5. Candidatures restaurants/livreurs — L'accès à l'espace restaurant ou livreur est soumis à validation d'un dossier de candidature par l'équipe MiamExpress.

6. Résiliation — MiamExpress se réserve le droit de suspendre un compte en cas d'usage abusif, de fraude ou de non-respect des présentes conditions.

Ce document est un cadre général et pourra être complété par un conseil juridique avant le lancement commercial complet, conformément à la feuille de route MiamExpress.`;

const PRIVACY_CONTENT = `MiamExpress collecte et traite les données personnelles nécessaires au bon fonctionnement du service : nom, numéro de téléphone, adresses de livraison, historique de commandes et, le cas échéant, position géographique.

Utilisation des données — Ces informations servent à traiter vos commandes, faciliter la livraison, améliorer nos services et vous contacter en cas de besoin (support client, notifications de commande).

Partage — Vos coordonnées de livraison sont partagées avec le restaurant et le livreur concernés par votre commande, dans la stricte mesure nécessaire à son exécution. MiamExpress ne vend pas vos données à des tiers.

Sécurité — Les accès aux données sont protégés par des règles de sécurité au niveau de la base de données (contrôle d'accès par rôle).

Vos droits — Vous pouvez à tout moment demander l'accès, la correction ou la suppression de vos données personnelles en contactant le support MiamExpress.

Ce document est un cadre général et pourra être complété par un conseil juridique avant le lancement commercial complet, conformément à la feuille de route MiamExpress.`;

// ── English translations (EN) ──────────────────────────────────────────
// Sign Up   |   Créer votre compte MiamExpress   |   Already have an account? Log in
// Full name |   Phone number   |   Email address   |   Password
// I accept the   |   Terms of Service   |   and   |   Privacy Policy
// Create my account   |   Creating account...
// ────────────────────────────────────────────────────────────────────────

const roleRedirects: Record<UserRole, string> = {
  client: '/',
  restaurant: '/partenaires/dashboard',
  livreur: '/livreurs/dashboard',
  admin: '/admin/dashboard',
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
    title: 'Inscription Client',
    subtitle: 'Créez votre compte pour commander vos plats préférés.',
  },
  restaurant: {
    icon: Store,
    title: 'Inscription Restaurateur',
    subtitle: 'Créez votre compte pour gérer votre restaurant sur MiamExpress.',
  },
  livreur: {
    icon: Bike,
    title: 'Inscription Livreur',
    subtitle: 'Créez votre compte pour commencer à livrer avec MiamExpress.',
  },
  admin: {
    icon: ShieldCheck,
    title: 'Inscription Administrateur',
    subtitle: 'Créez un compte administrateur MiamExpress.',
  },
};

function getLoginPath(role: UserRole): string {
  if (role === 'admin') return '/admin/connexion';
  if (role === 'restaurant') return '/partenaires/connexion';
  if (role === 'livreur') return '/livreurs/connexion';
  return '/connexion';
}

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

export default function Inscription({ defaultRole = 'client' as UserRole }: { defaultRole?: UserRole }) {
  const { signUp, isSupabaseConfigured } = useAuth();
  const navigate = useNavigate();
  const profile = profileConfigs[defaultRole];

  // ── Form fields ──
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Veuillez entrer votre nom complet.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      const newUser = await signUp({
        email: email.trim(),
        password,
        phone: normalizeCameroonPhone(phone),
        name: name.trim(),
        role: defaultRole,
      });
      navigate(await resolveRedirect(newUser), { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Erreur lors de l'inscription. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden my-12">

        {/* ── Branded header ── */}
        <AuthHeader icon={profile.icon} title={profile.title} subtitle={profile.subtitle} />

        <div className="px-6 sm:px-8 pb-6 sm:pb-8">

        {/* ── Demo banner ── */}
        {!isSupabaseConfigured && (
          <div className="bg-gold-light text-amber-700 text-xs font-inter rounded-lg px-3 py-2 mb-5">
            Mode démo : les comptes sont sauvegardés localement dans votre navigateur.
          </div>
        )}

        {/* ── Minimal form ── */}
        <form onSubmit={handleSignUp} className="space-y-4">
          {/* Full name */}
          <div>
            <label className="block text-text-secondary font-inter text-sm mb-1.5">Nom complet</label>
            <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary transition-all">
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
            <label className="block text-text-secondary font-inter text-sm mb-1.5">Adresse email</label>
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

          {/* Phone */}
          <div>
            <label className="block text-text-secondary font-inter text-sm mb-1.5">Numéro de téléphone</label>
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

          {/* Password */}
          <div>
            <label className="block text-text-secondary font-inter text-sm mb-1.5">Mot de passe</label>
            <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary transition-all">
              <ShieldCheck className="w-4 h-4 text-text-muted shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
                className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                required
                minLength={6}
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

          {/* Confirm Password */}
          <div>
            <label className="block text-text-secondary font-inter text-sm mb-1.5">Confirmer le mot de passe</label>
            <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary transition-all">
              <ShieldCheck className="w-4 h-4 text-text-muted shrink-0" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez votre mot de passe"
                className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="text-text-muted hover:text-text-secondary transition-colors shrink-0 p-1 -mr-1"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-error text-sm font-inter" role="alert">{error}</p>}

          <p className="text-text-muted text-xs font-inter text-center">
            En vous inscrivant, vous acceptez nos{' '}
            <button type="button" onClick={(e) => { e.preventDefault(); setLegalModal('terms'); }} className="text-green-primary underline hover:text-green-dark">conditions</button>
            {' '}et notre{' '}
            <button type="button" onClick={(e) => { e.preventDefault(); setLegalModal('privacy'); }} className="text-green-primary underline hover:text-green-dark">politique de confidentialité</button>
            .
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-xl hover:bg-green-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Création du compte...
              </>
            ) : (
              <>Créer mon compte <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        {/* ── Cross-profile registration links ── */}
        {defaultRole === 'client' && (
          <div className="mt-6 pt-5 border-t border-border-light space-y-2">
            <p className="text-text-muted text-[11px] font-inter font-medium uppercase tracking-wider mb-3">
              Vous êtes un professionnel ?
            </p>
            <Link
              to="/inscription/restaurant"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-secondary transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                <Store className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-inter font-semibold text-text-primary text-sm group-hover:text-green-primary transition-colors">
                  Inscription Restaurateur
                </p>
                <p className="text-text-muted text-xs font-inter">
                  Gérez votre restaurant et vos commandes sur MiamExpress.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-green-primary transition-colors shrink-0" />
            </Link>
            <Link
              to="/inscription/livreur"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-secondary transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Bike className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-inter font-semibold text-text-primary text-sm group-hover:text-green-primary transition-colors">
                  Inscription Livreur
                </p>
                <p className="text-text-muted text-xs font-inter">
                  Livrez quand vous voulez, gagnez ce dont vous avez besoin.
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-green-primary transition-colors shrink-0" />
            </Link>
          </div>
        )}

        {/* ── Footer: login ── */}
        <p className="text-center text-text-secondary font-inter text-sm mt-5">
          Déjà un compte ?{' '}
          <Link
            to={getLoginPath(defaultRole)}
            className="text-green-primary font-semibold hover:text-green-dark underline"
          >
            Se connecter
          </Link>
        </p>
        </div>
      </div>

      {/* ── Legal modals ── */}
      <Dialog open={!!legalModal} onOpenChange={(open) => { if (!open) setLegalModal(null); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {legalModal === 'terms' ? "Conditions d'utilisation" : 'Politique de confidentialité'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-text-secondary font-inter text-sm whitespace-pre-line leading-relaxed">
            {legalModal === 'terms' ? TERMS_CONTENT : PRIVACY_CONTENT}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
