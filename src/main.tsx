import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CartProvider } from './contexts/CartContext'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import './index.css'
import i18n from './i18n/config'
import App from './App.tsx'
import BrandTheme from './components/BrandTheme'
import { readSiteConfigSync, applyBrandColors } from './lib/siteConfig'

// Utilitaire de seed démo (avis, commandes, clients fictifs) — dev uniquement,
// éliminé du build de production. Voir src/dev/seedDemoData.ts.
if (import.meta.env.DEV) {
  import('./dev/seedDemoData')
}

// ── URLs à préfixe de langue (/fr/..., /en/...) — docs/seo-i18n-url-architecture.md §3 ──
// La langue vit dans le 1er segment de l'URL (source de vérité). Sans préfixe
// (liens legacy déjà partagés), on redirige vers la préférence localStorage
// (sinon 'fr') en conservant chemin + query : /restaurants → /fr/restaurants.
const SUPPORTED_LANGS = ['fr', 'en'] as const;
const seg = window.location.pathname.split('/')[1];
const urlLang = (SUPPORTED_LANGS as readonly string[]).includes(seg) ? seg : null;

if (!urlLang) {
  const pref = localStorage.getItem('miamexpress_lang') ?? '';
  const target = (SUPPORTED_LANGS as readonly string[]).includes(pref) ? pref : 'fr';
  const rest = window.location.pathname === '/' ? '' : window.location.pathname;
  window.location.replace(`/${target}${rest}${window.location.search}${window.location.hash}`);
} else {
  if (i18n.language?.slice(0, 2) !== urlLang) i18n.changeLanguage(urlLang);
  // Mémorise la langue vue pour le prochain accès sans préfixe.
  localStorage.setItem('miamexpress_lang', urlLang);

  // Couleurs de marque appliquées AVANT le rendu (pas de flash).
  applyBrandColors(readSiteConfigSync().brandColors);

  const rootEl = document.getElementById('root')!;
  const app = (
    <StrictMode>
      <BrowserRouter basename={`/${urlLang}`}>
        <SettingsProvider>
          <AuthProvider>
            <CartProvider>
              <BrandTheme />
              <App />
            </CartProvider>
          </AuthProvider>
        </SettingsProvider>
      </BrowserRouter>
    </StrictMode>
  );
  // Pages prérendues (react-snap) : le HTML statique est hydraté ; sinon rendu client classique.
  if (rootEl.hasChildNodes()) hydrateRoot(rootEl, app);
  else createRoot(rootEl).render(app);

  // CP8 — couche native Capacitor (no-op strict sur le web, import différé).
  import('./native').then((m) => m.initNative()).catch(() => { /* web : rien */ });
}
