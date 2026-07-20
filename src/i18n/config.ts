import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from './locales/fr.json';
import en from './locales/en.json';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
};

// Retrieve language from localStorage or default to 'fr'
const savedLanguage = localStorage.getItem('miamexpress_lang') || 'fr';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'fr',
    // Clés = texte naturel (français) : on désactive le découpage par '.' et ':'
    // sinon les phrases françaises (qui contiennent des points) sont prises pour
    // des clés imbriquées et ne résolvent jamais leur traduction anglaise.
    keySeparator: false,
    nsSeparator: false,
    interpolation: {
      escapeValue: false, // React already safeguards from XSS
    },
  });

export default i18n;
