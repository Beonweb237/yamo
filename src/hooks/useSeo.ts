import { useEffect } from 'react';

// SEO par page — met à jour <title>, meta description, canonical et og:* sans
// dépendance externe (pas de react-helmet). Chaque page appelle useSeo(...).
// Le titre est suffixé par la marque ; la description alimente aussi Open Graph.

const BRAND = 'MiamExpress';
const DEFAULT_TITLE = `${BRAND} — Livraison de repas au Cameroun`;
const ORIGIN = 'https://miamexpress.cm';

interface SeoOptions {
  /** Titre de la page (sans la marque). Vide → titre par défaut. */
  title?: string;
  /** Meta description (aussi utilisée pour og:description). */
  description?: string;
  /** Chemin canonique (défaut : chemin courant). */
  path?: string;
  /** Pages privées/transactionnelles : émet <meta name="robots" content="noindex, follow">. */
  noindex?: boolean;
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (hreflang) el.setAttribute('hreflang', hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useSeo({ title, description, path, noindex }: SeoOptions) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${BRAND}` : DEFAULT_TITLE;
    // Robots : posé sur les pages privées, retiré sinon (navigation SPA).
    const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noindex) {
      setMeta('meta[name="robots"]', 'name', 'robots', 'noindex, follow');
    } else if (robots) {
      robots.remove();
    }
    document.title = fullTitle;
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);

    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }

    // ── URLs bilingues (docs/seo-i18n-url-architecture.md §4) ──
    // PATH = chemin SANS préfixe de langue ; canonical = URL de la langue
    // courante préfixée ; hreflang fr/en/x-default vers /fr/PATH et /en/PATH.
    // Langue depuis l'URL (source de vérité) — pas <html lang>, qui peut être
    // brièvement désynchronisé au chargement (config.ts lit localStorage avant
    // que main.tsx applique la langue du préfixe).
    const lang = window.location.pathname.split('/')[1] === 'en' ? 'en' : 'fr';
    const rawPath = path ?? (window.location.pathname.replace(/^\/(fr|en)(?=\/|$)/, '') || '/');
    const frUrl = `${ORIGIN}/fr${rawPath === '/' ? '/' : rawPath}`;
    const enUrl = `${ORIGIN}/en${rawPath === '/' ? '/' : rawPath}`;
    const url = lang === 'en' ? enUrl : frUrl;

    setMeta('meta[property="og:url"]', 'property', 'og:url', url);
    setMeta('meta[property="og:locale"]', 'property', 'og:locale', lang === 'en' ? 'en_CM' : 'fr_CM');
    setMeta('meta[property="og:locale:alternate"]', 'property', 'og:locale:alternate', lang === 'en' ? 'fr_CM' : 'en_CM');
    setLink('canonical', url);
    setLink('alternate', frUrl, 'fr');
    setLink('alternate', enUrl, 'en');
    setLink('alternate', frUrl, 'x-default');
  }, [title, description, path, noindex]);
}
