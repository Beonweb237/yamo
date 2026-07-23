import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ShieldCheck, X, User } from 'lucide-react';
import type { UserRole } from '../contexts/AuthContext';

interface AuthChoiceModalProps {
  /** Route de redirection visée après authentification (ex. /checkout). */
  redirectTo?: string;
  /** Rôle par défaut (détermine les routes connexion/inscription). */
  defaultRole?: UserRole;
  /** Fermeture sans action. */
  onClose: () => void;
}

// Chaque bouton REDIRIGE vers la page dédiée (connexion / inscription) — pas de
// formulaire inline. Le panier étant persistant, l'utilisateur revient finaliser.
const LOGIN_ROUTES: Record<string, string> = {
  client: '/connexion',
  restaurant: '/partenaires/connexion',
  livreur: '/livreurs/connexion',
  admin: '/admin/connexion',
};
const SIGNUP_ROUTES: Record<string, string> = {
  client: '/inscription',
  restaurant: '/inscription/restaurant',
  livreur: '/inscription/livreur',
};

export default function AuthChoiceModal({ redirectTo = '/checkout', defaultRole = 'client', onClose }: AuthChoiceModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const go = (route: string) => {
    onClose();
    // `from` transmis pour un futur retour post-connexion (le panier reste intact).
    navigate(route, { state: { from: redirectTo } });
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('Connexion ou inscription')}
    >
      <div className="bg-white w-full sm:max-w-[420px] rounded-t-2xl sm:rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-poppins font-bold text-text-primary text-lg">{t('Pour continuer')}</h2>
          <button type="button" onClick={onClose} className="p-1 text-text-muted hover:text-text-primary rounded-lg" aria-label={t('Fermer')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-text-secondary font-inter text-sm">{t('Ajoutez vos plats au panier et choisissez :')}</p>

          <button
            type="button"
            onClick={() => go(LOGIN_ROUTES[defaultRole] || '/connexion')}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-border-custom hover:border-green-primary hover:bg-green-light/20 transition-all group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-green-primary/40"
          >
            <div className="w-10 h-10 rounded-xl bg-green-light flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-green-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-inter font-semibold text-text-primary text-sm">{t("J'ai déjà un compte")}</p>
              <p className="font-inter text-xs text-text-muted">{t('Connectez-vous pour finaliser')}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-green-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            type="button"
            onClick={() => go(SIGNUP_ROUTES[defaultRole] || '/inscription')}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-border-custom hover:border-green-primary hover:bg-green-light/20 transition-all group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-green-primary/40"
          >
            <div className="w-10 h-10 rounded-xl bg-gold-light flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-gold-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-inter font-semibold text-text-primary text-sm">{t('Créer un compte')}</p>
              <p className="font-inter text-xs text-text-muted">{t('Inscrivez-vous rapidement')}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-green-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </div>
    </div>
  );
}
