import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, MapPin, Bike } from 'lucide-react';
import { activeCities } from '../data/locations';
import { useTranslation } from "react-i18next";

// Onboarding première visite (CONF-28 / DOC-UX P1-01) : 3 écrans, skippable
// à tout moment, jamais réaffiché (clé yamo_onboarding_completed — réservée
// dans CLAUDE.md depuis l'origine). La ville choisie préremplit la recherche.
const ONBOARDING_KEY = 'yamo_onboarding_completed';

// eslint-disable-next-line react-refresh/only-export-components
export function shouldShowOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) !== 'true';
  } catch {
    return false;
  }
}

function markCompleted() {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'true');
  } catch {
    // Stockage indisponible : l'overlay réapparaîtra, sans bloquer l'app.
  }
}

export default function OnboardingOverlay({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [city, setCity] = useState('Douala');

  const close = () => {
    markCompleted();
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (goExplore: boolean) => {
    markCompleted();
    onClose();
    if (goExplore) navigate(`/restaurants?ville=${encodeURIComponent(city)}`);
  };

  const steps = [
    {
      icon: UtensilsCrossed,
      title: 'Vos plats préférés, livrés chez vous',
      text: 'Commandez auprès des meilleurs restaurants de votre ville — cuisine camerounaise et saveurs du monde. Payez en espèces à la livraison ou par Mobile Money.',
    },
    {
      icon: MapPin,
      title: 'Où êtes-vous ?',
      text: 'Choisissez votre ville pour voir les restaurants qui vous livrent. Vous pourrez la changer à tout moment.',
    },
    {
      icon: Bike,
      title: 'Suivez votre commande',
      text: 'Le restaurant prépare, un livreur récupère, vous suivez chaque étape. Un code de livraison sécurise la remise en main propre.',
    },
  ];

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenue sur MiamExpress"
    >
      <div className="bg-white w-full sm:max-w-[420px] rounded-t-2xl sm:rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1.5" aria-label={`Étape ${step + 1} sur ${steps.length}`}>
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-green-primary' : 'w-1.5 bg-border-custom'}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            className="text-text-secondary font-inter text-sm hover:text-text-primary px-3 min-h-11 inline-flex items-center rounded-lg"
          >
            {t("Passer")}
          </button>
        </div>

        <div className="w-16 h-16 rounded-2xl bg-green-light flex items-center justify-center mb-5">
          <Icon className="w-8 h-8 text-green-primary" />
        </div>
        <h2 className="font-poppins font-bold text-text-primary text-xl mb-2">{current.title}</h2>
        <p className="text-text-secondary font-inter text-sm leading-relaxed mb-6">{current.text}</p>

        {step === 1 && (
          <div className="mb-6">
            <label htmlFor="onboarding-city" className="block text-text-secondary font-inter text-sm mb-1.5">
              {t("Votre ville")}
            </label>
            <select
              id="onboarding-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-white border border-border-custom rounded-lg px-3 h-12 text-text-primary font-inter text-[15px] outline-none"
            >
              {activeCities.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 h-12 rounded-lg text-text-secondary font-inter text-sm hover:bg-bg-secondary transition-colors"
            >
              {t("Retour")}
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? finish(true) : setStep(step + 1))}
            autoFocus
            className="flex-1 bg-green-primary text-white font-inter font-semibold h-12 rounded-lg hover:bg-green-dark transition-colors"
          >
            {isLast ? `Voir les restaurants à ${city}` : 'Continuer'}
          </button>
        </div>
      </div>
    </div>
  );
}
