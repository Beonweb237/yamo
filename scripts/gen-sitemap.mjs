#!/usr/bin/env node
// Génère public/sitemap.xml — bilingue /fr/ /en/ avec annotations hreflang
// (docs/seo-i18n-url-architecture.md §5). Chaque URL publique est listée dans
// les DEUX langues, chacune portant les 3 alternates (fr, en, x-default→fr).
//
// Périmètre : pages publiques STATIQUES (marketing + listes). Les fiches
// dynamiques (/restaurant/:slug, /plat/:slug) sont indexables via les liens
// internes + hreflang posés par useSeo ; les ajouter ici demanderait de
// résoudre les slugs du catalogue côté build (à faire côté VPS plus tard).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'sitemap.xml');
const ORIGIN = 'https://miamexpress.cm';
const LANGS = ['fr', 'en'];

// Chemins SANS préfixe de langue ('' = accueil).
const PUBLIC_PATHS = ['', '/restaurants', '/partenaires', '/livreurs', '/contact'];

const today = new Date().toISOString().slice(0, 10);

const urlFor = (lang, path) => `${ORIGIN}/${lang}${path || '/'}`;

const alternates = (path) => [
  `    <xhtml:link rel="alternate" hreflang="fr" href="${urlFor('fr', path)}"/>`,
  `    <xhtml:link rel="alternate" hreflang="en" href="${urlFor('en', path)}"/>`,
  `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor('fr', path)}"/>`,
].join('\n');

const entries = PUBLIC_PATHS.flatMap((path) =>
  LANGS.map((lang) => `  <url>
    <loc>${urlFor(lang, path)}</loc>
${alternates(path)}
    <lastmod>${today}</lastmod>
    <changefreq>${path === '' || path === '/restaurants' ? 'daily' : 'weekly'}</changefreq>
    <priority>${path === '' ? '1.0' : path === '/restaurants' ? '0.9' : '0.7'}</priority>
  </url>`)
);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;

writeFileSync(OUT, xml);
console.log(`sitemap.xml : ${PUBLIC_PATHS.length} pages × ${LANGS.length} langues = ${entries.length} URLs → ${OUT}`);
