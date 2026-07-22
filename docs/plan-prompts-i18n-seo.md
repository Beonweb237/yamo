# Plan de prompts coordonné — Finaliser le système i18n + SEO de A à Z

> But : amener le site à un **bilingue FR/EN complet, indexable, SEO aux règles de l'art**
> (`/fr/` `/en/` + prerender). Chaque prompt ci-dessous est **autonome** et se colle tel
> quel dans une session Claude Code (le contexte vient de `CLAUDE.md` + mémoire). Les
> prompts sont **ordonnés** : chacun suppose le précédent livré et vérifié.

---

## Règles transverses (rappelées dans chaque prompt)

- Travailler depuis `app/`. Clés i18n = **texte français naturel** (`t("…")`).
- **Avant tout build/déploiement** : `tasklist | grep codex` (aucun `codex.exe`), puis
  `npm run verify:hooks` (0), `npm run verify:i18n`, `npm run build` (EXIT 0).
- **Ne jamais** relancer `node wrap_t.cjs --write` sans `npm run verify:hooks` juste après.
- Déploiement frontend = tar+scp de `dist/` (index.html + assets + robots.txt + sitemap.xml)
  vers `ubuntu@51.222.15.0:/home/ubuntu/miamexpress/dist`, clé `~/.ssh/id_ed25519_jackpot`,
  **backup `dist.bak-<TS>` d'abord**, Nginx sert le statique. Ne pas toucher au backend sans demande.
- Après chaque prompt : parcours navigateur **FR et EN**, mobile 360px, 0 erreur console.

---

## État de départ (déjà livré — ne pas refaire)

- Navbar refondu (sélecteur `FR | EN`, décongestion desktop).
- Traductions : **pages prioritaires 100% EN**, global 89% (881/992).
- SEO quick-wins : `useSeo` (Home/Restaurants/Contact), `<html lang>` dynamique,
  `index.html` (OG/Twitter/JSON-LD), `public/robots.txt`, `public/sitemap.xml`.
- Pipeline sûr : `wrap_t.cjs` réparé, `translate.py` durci, garde-fous
  `npm run verify:i18n` + `npm run verify:hooks`.
- **Non déployé** : tout ceci est local, prêt à partir.

---

## P1 — Déployer les gains actuels (ship & stabilize)

```
Déploie sur le VPS les améliorations frontend actuelles (Navbar FR|EN, SEO quick-wins,
robots.txt, sitemap.xml, en.json bilingue). Étapes : vérifie qu'aucun codex.exe ne tourne ;
npm run verify:hooks (0), npm run verify:i18n, npm run build (EXIT 0) ; backup horodaté du
dist distant ; sync index.html + assets/ + robots.txt + sitemap.xml (tar+scp, images
conservées) ; vérifie sur https://miamexpress.cm que le nouveau bundle est servi, que
robots.txt et sitemap.xml répondent en 200, et que l'anglais s'affiche. Ne touche PAS au backend.
```
**Acceptance** : prod sert le nouveau bundle, `/robots.txt` et `/sitemap.xml` en 200, EN OK.
**Effort** : ~15 min.

---

## P2 — Traduction 100% + refactor des clés fragiles (qualité)

```
Finalise la traduction FR→EN à ~100%. 1) Refactore les 26 clés t() multi-lignes listées par
`node scripts/verify-i18n.mjs --all` : dans le JSX source, mets chaque texte sur UNE ligne
(clé single-line propre) sans changer le rendu visuel, puis ajoute la traduction EN. 2) Traduis
en EN toutes les clés encore non traduites (verify:i18n), admin inclus, et RELIS/corrige les
traductions Google approximatives sur toutes les pages vues par un humain (Profile, dashboards
resto/livreur, admin). Qualité pro, pas de calque. Garde-fous : verify:hooks (0), verify:i18n,
tsc, build. Objectif : verify:i18n global ≥ 98% (hors identités) et 0 clé multi-ligne fragile.
```
**Acceptance** : `verify:i18n` ~100%, 0 clé multi-ligne, build vert.
**Effort** : ~0,5 j.

---

## P3 — SEO par page sur toutes les pages indexables

```
Étends le hook useSeo à toutes les pages publiques : Partenaires, Livreurs, DishDetail
(titre = nom du plat), RestaurantDetail (titre = nom du resto + quartier), FoodRequest.
Titres et descriptions uniques, keyword-rich, en FR ET EN (clés t()). Ajoute une meta
robots "noindex, follow" sur les pages privées/transactionnelles (checkout, profil, commandes,
connexion, inscription, dashboards) via useSeo (nouvelle option `noindex`). Vérifie que chaque
page a un <title> et une description distincts. Garde-fous habituels.
```
**Acceptance** : chaque page publique = title/description uniques ; pages privées `noindex`.
**Effort** : ~0,5 j.

---

## P4 — Phase 1 : migration URL `/fr/` `/en/` (routing)

```
Implémente les URLs à préfixe de langue selon docs/seo-i18n-url-architecture.md, section 3.
Dans src/main.tsx : lis le 1er segment de l'URL (fr|en) ; si absent, redirige (window.location
.replace) vers /fr + chemin (préf localStorage sinon 'fr') en conservant search — cela couvre les
liens legacy /restaurants -> /fr/restaurants ; si présent, i18n.changeLanguage(lang) et
<BrowserRouter basename={`/${lang}`}>. App.tsx (routes root-relatives) NE CHANGE PAS. Dans la
Navbar, le sélecteur de langue navigue vers le même chemin sous l'autre préfixe
(window.location.assign(path.replace(/^\/(fr|en)/, `/${to}`))). Teste : /fr/, /en/, un lien
profond, un lien legacy sans préfixe, le switch de langue, les 4 profils (client/resto/livreur/
admin), mobile 360px. Garde-fous : verify:hooks (0), tsc, build.
```
**Acceptance** : `/fr/*` et `/en/*` fonctionnent, legacy en 301→/fr, switch OK, 4 profils OK.
**Effort** : ~0,5 j. **Dépend de** : P1 déployé (pour comparer avant/après).

---

## P5 — Phase 2 : hreflang + canonical + sitemap bilingue

```
Étends useSeo pour émettre, par page : <link rel="canonical"> vers l'URL de la langue courante
préfixée, et 3 <link rel="alternate" hreflang> (fr, en, x-default→fr) pointant vers /fr/PATH et
/en/PATH (PATH = chemin sans préfixe). Ajoute og:locale (fr_CM / en_CM). Crée
scripts/gen-sitemap.mjs qui génère public/sitemap.xml avec chaque URL publique × 2 langues et
les annotations xhtml:link hreflang ; ajoute le script npm "gen:sitemap" et lance-le. Vérifie
le HTML généré (hreflang présents, canonical préfixé). Garde-fous habituels.
```
**Acceptance** : hreflang fr/en/x-default sur chaque page, sitemap 2 langues valide.
**Effort** : ~0,25 j. **Dépend de** : P4.

---

## P6 — Phase 3 : prerender + Nginx

```
Ajoute le prerender des pages marketing statiques (Home, Partenaires, Livreurs, Contact) × 2
langues via react-snap (option A de docs/seo-i18n-url-architecture.md, section 6) : dépendance
dev react-snap, script "postbuild": "react-snap", config reactSnap (source dist, include des 8
URLs /fr/… /en/…, puppeteerArgs --no-sandbox). Build et vérifie que dist/fr/index.html,
dist/en/contact/index.html… existent et contiennent le HTML rendu (pas une coquille vide).
Mets à jour app/server/miamexpress-nginx.conf : redirect / -> /fr/ (302), legacy sans préfixe
-> /fr/… (301), blocs location /fr/ et /en/ avec try_files …/index.html (proxy /api, /api/media,
/uploads inchangés). Si l'hydratation react-snap pose problème, limite le prerender au marketing
et documente. Déploie dist + la conf Nginx (avec backup), recharge Nginx, et curl chaque URL
prérendue pour confirmer du HTML statique. Garde-fous : verify:hooks, build, test navigateur FR/EN.
```
**Acceptance** : `curl https://miamexpress.cm/en/contact` renvoie du HTML prérendu ; Nginx sert /fr/ et /en/ ; redirects legacy OK.
**Effort** : ~1 j. **Dépend de** : P4, P5.

---

## P7 — Recette SEO + Search Console

```
Recette SEO finale : lance Lighthouse (ou équivalent) sur /fr/ et /en/ (score SEO ≥ 95),
valide les hreflang avec l'outil Google Rich Results / hreflang checker, vérifie les balises
title/description/canonical/OG sur 5 pages clés dans les 2 langues, et le JSON-LD. Prépare la
checklist de soumission à Google Search Console (propriété, sitemap.xml, inspection d'URL /fr/
et /en/). Ne soumets rien à un service externe sans mon accord explicite — donne-moi la marche
à suivre. Documente les résultats dans docs/seo-i18n-url-architecture.md.
```
**Acceptance** : rapport Lighthouse SEO ≥ 95 FR+EN, hreflang valides, checklist Search Console prête.
**Effort** : ~0,25 j. **Dépend de** : P6.

---

## P8 — Garde-fous permanents (durcissement)

```
Rends les garde-fous automatiques : ajoute un script npm "predeploy" (ou une étape en tête de
deploy.ps1) qui enchaîne verify:hooks + verify:i18n + build et BLOQUE si l'un échoue. Documente
dans CLAUDE.md la règle "toute nouvelle chaîne UI passe par t() (clé = texte FR)" et le pipeline
sûr (wrap_t.cjs dry-run par défaut, verify:hooks obligatoire après --write). Vérifie que
predeploy bloque bien sur une violation simulée.
```
**Acceptance** : `predeploy` échoue si verify:hooks/verify:i18n/build échoue ; CLAUDE.md à jour.
**Effort** : ~0,25 j. **Peut être fait** : à tout moment (idéalement avant P6).

---

## État d'avancement — TOUT LIVRÉ ✅ (21/07/2026)

- [x] **P1** — Déployé (bundle + robots + sitemap, backup `dist.bak-20260720-222841`)
- [x] **P8** — `npm run predeploy` bloquant (testé sur violation simulée), CLAUDE.md documenté
- [x] **P2** — verify:i18n **100%**, 0 clé multi-ligne fragile, orphelines purgées, calques corrigés
- [x] **P3** — useSeo sur toutes les pages publiques, `noindex` sur privées + BackOfficeLayout
- [x] **P4** — `/fr/*` `/en/*` via basename, redirect legacy, switch Navbar, 4 profils testés
- [x] **P5** — canonical préfixé + hreflang fr/en/x-default + og:locale, `gen:sitemap` (10 URLs)
- [x] **P6** — react-snap (8 pages, Chrome système), Nginx (302 /fr/, 301 legacy, blocs langue), déployé + vérifié
- [x] **P7** — Lighthouse SEO **100** sur /fr/, /en/, /en/contact ; hreflang validés ; checklist GSC prête (rien soumis) ; résultats documentés dans `seo-i18n-url-architecture.md` §10

---

## Ordre recommandé & jalons

```
P1 (ship)  →  P8 (garde-fous)  →  P2 (traduction 100%)  →  P3 (SEO par page)
        →  P4 (URL /fr/ /en/)  →  P5 (hreflang/sitemap)  →  P6 (prerender+Nginx)  →  P7 (recette)
```

- **Jalon A (fin P3)** : site bilingue complet, SEO par page, déployé — déjà une grosse valeur.
- **Jalon B (fin P6)** : tout indexable en FR/EN, HTML prérendu, Nginx en place.
- **Jalon C (fin P7)** : recette SEO validée, prêt Search Console.

**Total ≈ 3 à 3,5 jours** de dev, livrables par jalon. Chaque prompt se lance seul, dans l'ordre,
avec la boucle de garde-fous entre chaque.

---

## Prompt global — enchaînement automatique A → Z

> À coller **une seule fois** dans une session Claude Code fraîche pour exécuter tout le plan
> de façon autonome. (Le bloc ci-dessous est le prompt ; tout est écrit à la 1re personne = toi
> qui le lances.)

```
MISSION : Finalise de A à Z le système de traduction bilingue FR/EN optimisé SEO de MiamExpress
(dossier app/), en exécutant le plan docs/plan-prompts-i18n-seo.md dans l'ordre, de façon
AUTONOME, avec la boucle de garde-fous entre chaque étape. Tu as mon autorisation DURABLE pour
les déploiements VPS décrits dans ce plan (P1 et P6).

CONTEXTE (à lire avant de commencer, ne rien redemander de ce qui y figure) :
CLAUDE.md, la mémoire projet, docs/plan-prompts-i18n-seo.md, docs/seo-i18n-url-architecture.md.

ORDRE STRICT : P1 → P8 → P2 → P3 → P4 → P5 → P6 → P7 (définitions dans le plan).
Coche l'avancement au fur et à mesure et enchaîne sans me redemander entre les étapes,
SAUF les cas STOP ci-dessous.

BOUCLE DE GARDE-FOUS entre CHAQUE étape (bloquante) :
  1) aucun codex.exe (tasklist) ;
  2) npm run verify:hooks  → 0 violation ;
  3) npm run verify:i18n   → pages prioritaires 100% ;
  4) npm run build         → EXIT 0.
Si un garde-fou est rouge : CORRIGE-le avant d'avancer. N'avance JAMAIS avec un gate rouge.

DÉPLOIEMENTS (P1, P6) : backup dist.bak-<horodatage> distant AVANT ; frontend uniquement
(index.html + assets/ + robots.txt + sitemap.xml, + conf Nginx en P6) ; vérifie APRÈS en prod
(curl des URLs + navigateur FR ET EN). Jamais le backend sans demande. Jamais committer/afficher
un secret. Clé SSH ~/.ssh/id_ed25519_jackpot, cible ubuntu@51.222.15.0:/home/ubuntu/miamexpress.

RÈGLES DE L'ART : clés i18n = texte français naturel ; wrap_t.cjs reste dry-run par défaut et
verify:hooks OBLIGATOIRE après tout --write ; traductions de QUALITÉ (relire/corriger le brouillon
Google sur toute page vue par un humain, pas de calque) ; tester mobile 360px ; 0 erreur console.

STOP & DEMANDE (ne pas faire en autonome) :
  - toute soumission à un service externe (en P7, Search Console = PRÉPARER la checklist seulement) ;
  - toute action destructive/irréversible non prévue au plan (suppression de données, etc.) ;
  - tout garde-fou que tu n'arrives pas à rendre vert ;
  - toute formulation EN incertaine sur une page très visible → propose, ne devine pas ;
  - détection d'un codex.exe / d'une édition concurrente des mêmes fichiers.

REPORTING : après chaque étape, un point court (fait / vérifié / suivant). À chaque jalon
(A = fin P3, B = fin P6, C = fin P7) : récap + preuves (build vert, URL prod, capture navigateur).

DÉFINITION DE « DONE » (rapport final quand tout est atteint) :
  verify:i18n ~100% et 0 clé multi-ligne fragile ; URLs /fr/ et /en/ indexables avec redirects
  legacy 301 ; hreflang fr/en/x-default + canonical préfixé + sitemap bilingue ; HTML prérendu
  des pages marketing servi par Nginx ; Lighthouse SEO ≥ 95 en FR ET EN ; garde-fous predeploy
  en place. Mets à jour la mémoire et coche le plan.

Commence maintenant par P1.
```

