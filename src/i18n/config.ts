import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from './locales/fr.json';
import en from './locales/en.json';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
};

// Langue initiale : préfixe d'URL (/fr/, /en/ — source de vérité) d'abord,
// sinon préférence localStorage, sinon 'fr'. Évite tout flash de langue au
// chargement des pages prérendues (html lang + canonical corrects dès l'init).
const urlSeg = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '';
const savedLanguage = urlSeg === 'fr' || urlSeg === 'en'
  ? urlSeg
  : localStorage.getItem('miamexpress_lang') || 'fr';

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

// SEO : synchronise l'attribut <html lang> avec la langue courante
// (initial + à chaque changement) pour l'indexation et l'accessibilité.
const syncHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = (lng || 'fr').slice(0, 2);
  }
};
syncHtmlLang(savedLanguage);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
