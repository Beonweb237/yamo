import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, MapPin, Bike, Globe } from 'lucide-react';
import { activeCities } from '../data/locations';
import { useTranslation } from "react-i18next";

// Onboarding première visite : 4 écrans (langue + intro + ville + tracking),
// skippable à tout moment, jamais réaffiché.
const ONBOARDING_KEY = 'yamo_onboarding_completed';
const LANG_STORAGE_KEY = 'miamexpress_lang';

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

/** Détecte la langue du navigateur et retourne 'fr' ou 'en' */
function detectBrowserLang(): string {
  try {
    const navLang = (navigator.language || '').slice(0, 2).toLowerCase();
    return navLang === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

const LANGUAGES = [
  { code: 'fr', label: 'Français', native: 'Français' },
  { code: 'en', label: 'English', native: 'English' },
];

export default function OnboardingOverlay({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [city, setCity] = useState('Douala');
  const [lang, setLang] = useState(detectBrowserLang);

  // Sauvegarde la langue choisie dès le 1er écran
  useEffect(() => {
    i18n.changeLanguage(lang);
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  }, [lang, i18n]);

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

  // 4 écrans : langue en premier
  const steps = [
    {
      icon: Globe,
      title: t('Choisissez votre langue'),
      text: t('Préférez-vous utiliser MiamExpress en français ou en anglais ?'),
    },
    {
      icon: UtensilsCrossed,
      title: t('Vos plats préférés, livrés chez vous'),
      text: t('Commandez auprès des meilleurs restaurants de votre ville — cuisine camerounaise et saveurs du monde. Payez en espèces à la livraison ou par Mobile Money.'),
    },
    {
      icon: MapPin,
      title: t('Où êtes-vous ?'),
      text: t('Choisissez votre ville pour voir les restaurants qui vous livrent. Vous pourrez la changer à tout moment.'),
    },
    {
      icon: Bike,
      title: t('Suivez votre commande'),
      text: t('Le restaurant prépare, un livreur récupère, vous suivez chaque étape. Un code de livraison sécurise la remise en main propre.'),
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
      aria-label={t("Bienvenue sur MiamExpress")}
    >
      <div className="bg-white w-full sm:max-w-[420px] rounded-t-2xl sm:rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1.5" aria-label={`${t('Étape')} ${step + 1} ${t('sur')} ${steps.length}`}>
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

        {/* Écran 0 : Choix de la langue */}
        {step === 0 && (
          <div className="mb-6 space-y-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${lang === l.code
                    ? 'border-green-primary bg-green-light/30'
                    : 'border-border-custom hover:border-text-muted'
                  }`}
              >
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${lang === l.code ? 'border-green-primary' : 'border-text-muted'}`}>
                  {lang === l.code && <span className="w-3 h-3 rounded-full bg-green-primary" />}
                </span>
                <div>
                  <p className={`font-inter font-semibold text-sm ${lang === l.code ? 'text-green-primary' : 'text-text-primary'}`}>{l.native}</p>
                  <p className="font-inter text-xs text-text-muted">{l.label}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Écran 2 : Choix de la ville */}
        {step === 2 && (
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
            {isLast ? `${t('Voir les restaurants à')} ${city}` : t('Continuer')}
          </button>
        </div>
      </div>
    </div>
  );
}
