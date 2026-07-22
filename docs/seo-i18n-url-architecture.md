# Architecture SEO multilingue — URLs `/fr/` `/en/` + prerender

> Proposition (20/07/2026). Objectif : **tout est indexable** en français ET en anglais,
> avec des URLs distinctes et du HTML crawlable. Décidé par le propriétaire : schéma
> d'URL à préfixe de langue (`/fr/...`, `/en/...`).

---

## 1. État actuel (constaté dans le code)

| Élément | État |
|---|---|
| Rendu | **SPA client-rendu** (Vite + React Router), pas de SSR/SSG |
| Langue | `localStorage.miamexpress_lang`, **pas dans l'URL** → une seule URL pour FR et EN |
| Router | `BrowserRouter` sans `basename` (`src/main.tsx`) |
| Liens internes | **40** `to="/x"` + **35** `to={…}` + **46** `navigate()` — tous **root-relatifs** |
| Pièges | **Aucun** `window.location.href=` ni `href="/x"` brut → rien à réécrire à la main |
| SEO déjà fait | `useSeo` (title/desc/canonical/og par page), `<html lang>` dynamique, `index.html` OG/JSON-LD, `robots.txt`, `sitemap.xml` |

**Conséquence SEO actuelle** : Google ne voit qu'**une** version (FR), et l'EN (switch localStorage, même URL) n'est **pas indexable séparément**. C'est ce que cette architecture corrige.

---

## 2. Schéma d'URL cible

```
/fr/                     /en/                    (accueils)
/fr/restaurants          /en/restaurants
/fr/restaurant/:slug     /en/restaurant/:slug
/fr/contact              /en/contact
…                        …
```

Règles de redirection :
- **`/` nu → `/fr/`** (langue par défaut) — ou selon `Accept-Language`/cookie (voir Nginx).
- **Legacy sans préfixe** (`/restaurants` déjà partagés sur WhatsApp) **→ 301 `/fr/restaurants`** : préserve le SEO existant et les liens partagés (cf. `ArticleRedirect`/`ExplorerRedirect` déjà présents).
- `x-default` hreflang → `/fr/`.

---

## 3. React Router — approche `basename` (effort MINIMAL)

Parce que **tous** les liens sont root-relatifs, on n'en réécrit **aucun**. On lit la langue dans le 1er segment de l'URL et on la passe en `basename` : React Router préfixe alors automatiquement tous les `to` et `navigate()`.

`src/main.tsx` :
```tsx
const SUPPORTED = ['fr', 'en'] as const;
const seg = window.location.pathname.split('/')[1];
const lang = (SUPPORTED as readonly string[]).includes(seg) ? seg : null;

if (!lang) {
  // pas de préfixe → redirige vers la préférence (localStorage) ou 'fr', en
  // conservant le chemin (legacy) : /restaurants -> /fr/restaurants
  const pref = localStorage.getItem('miamexpress_lang');
  const target = SUPPORTED.includes(pref) ? pref : 'fr';
  const rest = window.location.pathname === '/' ? '' : window.location.pathname;
  window.location.replace(`/${target}${rest}${window.location.search}`);
} else {
  i18n.changeLanguage(lang);
  createRoot(...).render(
    <BrowserRouter basename={`/${lang}`}> … </BrowserRouter>
  );
}
```

- `App.tsx` (les 40+ `<Route path="/x">`) **ne change pas** : elles matchent sous le `basename`.
- **Sélecteur de langue** (`Navbar`) : au lieu de `i18n.changeLanguage`, naviguer vers le même chemin sous l'autre préfixe :
  ```ts
  const switchLang = (to: 'fr'|'en') => {
    const path = window.location.pathname.replace(/^\/(fr|en)/, `/${to}`);
    window.location.assign(path + window.location.search); // full reload = état propre + prerender
  };
  ```
- Langue = **URL** (source de vérité). `localStorage` ne sert plus qu'à choisir la cible du redirect de `/`.

**Effort : ~0,5 j.** Risque faible (les redirects legacy garantissent la rétrocompat).

---

## 4. Balises SEO (extension de `useSeo`)

Ajouter, par page :
```html
<link rel="alternate" hreflang="fr"        href="https://miamexpress.cm/fr/PATH" />
<link rel="alternate" hreflang="en"        href="https://miamexpress.cm/en/PATH" />
<link rel="alternate" hreflang="x-default" href="https://miamexpress.cm/fr/PATH" />
<link rel="canonical"                      href="https://miamexpress.cm/{lang}/PATH" />
<meta property="og:locale" content="fr_CM" />  <!-- + og:locale:alternate en_CM -->
```
→ `useSeo` calcule `PATH` sans préfixe et génère les 3 hreflang + canonical de la langue courante. **Effort : ~0,25 j.**

---

## 5. Sitemap bilingue

`scripts/gen-sitemap.mjs` : génère chaque URL publique **× 2 langues** avec annotations `xhtml:link` hreflang :
```xml
<url>
  <loc>https://miamexpress.cm/fr/restaurants</loc>
  <xhtml:link rel="alternate" hreflang="fr" href="https://miamexpress.cm/fr/restaurants"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://miamexpress.cm/en/restaurants"/>
</url>
```
Script npm `gen:sitemap`, lancé au build. **Effort : ~0,25 j.**

---

## 6. Prerender (le cœur SEO)

| Option | Principe | Refactor | Verdict |
|---|---|---|---|
| **A. react-snap** | post-`build`, Puppeteer crawle `dist` et écrit un HTML par route | quasi nul | ✅ pragmatique |
| **B. vite-react-ssg** | SSG natif Vite, routes en objets, meta par route | moyen (réécrire l'entrée + routes) | 🟡 plus propre à terme |
| **C. SSR complet** (Express + renderToString) | rendu serveur à chaque requête | lourd | ❌ surdimensionné pour un catalogue mock/VPS |

**Nuance données dynamiques** : les listes resto / fiches viennent de l'API VPS → au moment du prerender (build, sans VPS), elles rendraient vide/mock. On **prerende donc les pages à contenu STATIQUE** (Home, Partenaires, Livreurs, Contact) × 2 langues, et on laisse les pages dynamiques en client-render **mais** avec URLs distinctes + meta/hreflang correctes (Googlebot exécute le JS ; le contenu vient de l'API). Résultat : **tout a une URL indexable**, et les pages qui comptent le plus pour l'acquisition (marketing) sont du HTML statique pur.

**Reco : Option A (react-snap)** pour démarrer.
```jsonc
// package.json
"scripts": { "postbuild": "react-snap" },
"reactSnap": {
  "source": "dist",
  "include": ["/fr/", "/en/", "/fr/partenaires", "/en/partenaires",
              "/fr/livreurs", "/en/livreurs", "/fr/contact", "/en/contact"],
  "puppeteerArgs": ["--no-sandbox"]
}
```
→ génère `dist/fr/index.html`, `dist/en/contact/index.html`, etc. **Effort : ~1 j** (intégration + hydratation + tests). *Alternative B (vite-react-ssg)* si on veut à terme prerender aussi les fiches resto à partir d'un dump de données.

---

## 7. Nginx (`app/server/miamexpress-nginx.conf`)

```nginx
# Redirections
location = / { return 302 /fr/; }
# Legacy sans préfixe -> /fr/ (301) — à mettre avant les blocs langue
location ~ ^/(?!fr/|en/|api/|uploads/|assets/|.*\.\w+$)(.*)$ { return 301 /fr/$1; }

# SPA fallback par langue (sert le HTML prerendu si présent, sinon l'index de la langue)
location /fr/ { try_files $uri $uri/ /fr/index.html; }
location /en/ { try_files $uri $uri/ /en/index.html; }
```
(Le proxy `/api/`, `/api/media`, `/uploads/` reste inchangé.) **Effort : ~0,25 j + test.**

---

## 8. Plan de migration (par phases, avec garde-fous)

1. **Phase 1 — Routing** : `basename` + lang-from-URL + redirects (app). `npm run verify:hooks && tsc -b && vite build`, tester les 4 profils.
2. **Phase 2 — Balises** : hreflang/canonical dans `useSeo` + `gen:sitemap`.
3. **Phase 3 — Prerender + Nginx** : react-snap + config Nginx + déploiement.
4. **Phase 4 — Search Console** : soumettre `sitemap.xml`, vérifier l'indexation FR/EN.

**Garde-fous à chaque phase** : `verify:hooks` (0), `verify:i18n`, `tsc -b`, `vite build`, parcours navigateur FR **et** EN, mobile 360px.

---

## 9. Risques

| Risque | Mitigation |
|---|---|
| Hydratation react-snap (React 18) | tester ; sinon `hydrateRoot`/`react-snap` en mode `crawl` ciblé marketing uniquement |
| Redirects legacy oubliés | tester les liens WhatsApp déjà partagés (`/restaurant/:slug`, `/plat/:slug`) |
| Double `<html lang>` / analytics | vérifier après switch (déjà géré côté `config.ts`) |
| Cache Nginx sur anciens `index.html` | purge + noms de bundles hashés (déjà le cas) |

## 10. Recette SEO — résultats (21/07/2026, tout déployé en prod)

### Lighthouse (catégorie SEO, prod https://miamexpress.cm)
| URL | Score |
|---|---|
| `/fr/` | **100** |
| `/en/` | **100** (après correctif canonical, cf. note ci-dessous) |
| `/en/contact` | **100** |

### Balises vérifiées (curl + navigateur, 8 pages prérendues × 2 langues)
- `<title>` et meta description **uniques par page et par langue** ✅
- `<link rel="canonical">` = URL préfixée de la langue courante ✅
- 3 × `<link rel="alternate" hreflang>` (fr, en, x-default→fr), **réciproques** ✅
- `og:title/description/url/locale` (fr_CM/en_CM + alternate) ✅
- JSON-LD présent sur toutes les pages prérendues ✅
- Pages dynamiques (ex. `/en/restaurant/:id`) : title dynamique (nom + quartier), canonical + hreflang corrects, pas de robots ✅
- Pages privées (connexion, checkout, profil, commandes, dashboards, admin) : `noindex, follow` ✅
- `robots.txt` (chemins préfixés bloqués) et `sitemap.xml` (10 URLs, annotations `xhtml:link`) en 200 ✅
- Redirects : `/` → 302 `/fr/` ; legacy sans préfixe → **301** `/fr/…` (query préservée) ✅

### Notes d'implémentation (écarts au plan initial)
1. **react-snap + Chromium embarqué** : le Chromium 2019 de react-snap ne parse pas le bundle Vite moderne (`Unexpected token '?'`). Réglé via `reactSnap.puppeteerExecutablePath` → Chrome système. Sur une CI/autre poste, adapter ce chemin.
2. **Onboarding vs prerender** : l'overlay 1re visite forçait la langue du navigateur de crawl dans les snapshots. Désactivé quand `navigator.userAgent === 'ReactSnap'` (Layout.tsx).
3. **Canonical Lighthouse** : `useSeo` lisait `<html lang>`, brièvement désynchronisé au chargement (config.ts lisait localStorage avant l'application du préfixe). La langue est maintenant dérivée de l'**URL** dans `useSeo` ET à l'init i18n (config.ts).
4. **Nginx** : `try_files $uri $uri/index.html /200.html` (et non `$uri/`) pour servir les pages prérendues **sans 301 d'ajout de slash** ; fallback SPA = `200.html` (shell neutre react-snap) pour éviter les mismatches d'hydratation.
5. Le doublon de conf `sites-enabled/miamexpress.cm` (shadowé par `miamexpress`) préexiste — warnings « conflicting server name » sans effet ; à nettoyer un jour côté VPS.

### ✅ Search Console — FAIT le 21/07/2026 (via API, avec accord explicite du propriétaire)

Réalisé en CLI via `scripts/gsc.mjs` (compte de service `gsc-bot@miamexpress-seo.iam.gserviceaccount.com`, clé locale `~/.gsc/miamexpress-seo-key.json` — jamais committée) :
- Projet Cloud `miamexpress-seo` + API *Search Console* et *Site Verification* activées (via le Chrome du propriétaire).
- Propriété `https://miamexpress.cm/` **vérifiée** (méthode FILE : `public/googledcb160ee37c3e581.html`, servi en prod — ne pas supprimer ce fichier).
- **tchomguijohn@gmail.com ajouté co-propriétaire** → la propriété apparaît dans https://search.google.com/search-console avec ce compte.
- `sitemap.xml` **soumis et déjà téléchargé par Google** : 10 URLs, 0 erreur, 0 warning.
- Réutilisable : `node scripts/gsc.mjs submit-sitemap` après chaque déploiement ; `node scripts/gsc.mjs status` pour l'état.

Reste manuel (pas d'API publique) : « Demander une indexation » des URLs clés dans l'UI GSC (`/fr/`, `/en/`, `/fr/partenaires`, `/en/partenaires`) — accélère la première indexation, sinon Google crawle seul sous quelques jours.

### Checklist Google Search Console (originale, conservée pour référence)
1. Ouvrir https://search.google.com/search-console → « Ajouter une propriété » → type **Domaine** : `miamexpress.cm` (validation DNS TXT chez le registrar) — ou type « Préfixe d'URL » `https://miamexpress.cm/` (validation par fichier HTML ou balise meta à ajouter dans `index.html`).
2. Une fois la propriété validée : menu **Sitemaps** → soumettre `https://miamexpress.cm/sitemap.xml`.
3. **Inspection d'URL** : tester `https://miamexpress.cm/fr/` puis `https://miamexpress.cm/en/` → « Demander une indexation » pour chacune.
4. Répéter l'inspection sur `/fr/partenaires` et `/en/partenaires` (pages d'acquisition).
5. Sous 1 à 2 semaines : vérifier **Pages** (indexées vs exclues), **Performances** (répartition FR/EN), et le rapport **Ciblage international / hreflang** s'il apparaît.
6. Optionnel : valider les données structurées via https://search.google.com/test/rich-results sur `/fr/` (JSON-LD Restaurant/Organization).

## 11. Estimation totale

**~2 à 2,5 jours** de dev, en 4 phases livrables indépendamment. Phase 1 seule (URLs distinctes + redirects) rend **déjà tout indexable** ; le prerender (Phase 3) maximise le ranking des pages marketing.
