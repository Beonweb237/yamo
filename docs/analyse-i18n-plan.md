# Analyse & plan — Système de traduction (i18n) MiamExpress

Date : 2026-07-20
Objet : évaluer l'i18n en cours de mise en place, corriger les défauts, le perfectionner,
et traiter l'UX du bouton langue + la fluidité.
Portée vérifiée : `src/i18n/config.ts`, `src/i18n/locales/{fr,en}.json`, ~58 fichiers utilisant
`t()`, bouton langue dans `Navbar.tsx`.

---

## 0. La meilleure approche pour ANALYSER un i18n (méthode)

Analyser un système de traduction rigoureusement = 6 axes mesurables :

1. **Configuration** : moteur (i18next), langues, défaut, fallback, détection, interpolation,
   pluriel, chargement (eager/lazy), persistance.
2. **Ressources** : structure des fichiers de langue (namespacés vs plats), **couverture croisée**
   (chaque clé existe dans TOUTES les langues), doublons, clés mortes.
3. **Usage** : convention de clés (namespacée stable vs texte brut), `useTranslation` présent dans
   chaque composant qui appelle `t()`, interpolation vs concaténation, pluriels, formats.
4. **Anti-patterns** (détection automatisable) : clé = phrase brute, clé avec `\n`/`\r`, phrase
   **découpée** en plusieurs `t()`, `t()` **hors scope**, texte en dur non traduit.
5. **UX / fluidité** : bouton langue (découvrabilité, libellé, a11y, desktop+mobile), absence de
   flash/rechargement au switch, persistance, cohérence des formats (nombres/FCFA, dates).
6. **Qualité continue** : script/CI qui échoue si une clé manque ou est cassée.

Outils : `grep` des patterns (`t\(`, `useTranslation`, clés avec `\\n`), diff des jeux de clés
fr↔en, revue ciblée des composants « fonctions » (qui n'héritent pas du `t` du parent).

---

## 1. État des lieux (constaté)

| Élément | Constat |
|---|---|
| Moteur | i18next + react-i18next, init dans `src/i18n/config.ts` |
| Langues | `fr` (défaut + fallback), `en` |
| Persistance | `localStorage.miamexpress_lang` (OK) |
| Détection navigateur | **absente** |
| **fr.json** | **37 clés**, namespacées et propres (`header.*`, `nav.*`, `home.*`, `common.*`, `search.*`) |
| **en.json** | **982 clés (63 Ko)**, dont **494 = phrases françaises brutes** utilisées comme clés |
| Clés cassées | **855 lignes avec `\r`/`\n`** dans en.json (clés multi-lignes) |
| Bouton langue | toggle emoji drapeau 🇫🇷/🇬🇧 dans la Navbar |

**Deux systèmes de clés incompatibles coexistent** :
- ✅ bon : `t('search.title', 'Rechercher')` (clé namespacée + défaut).
- ❌ mauvais : `t("Sécurisez votre commande — garantie")` (phrase FR entière = clé), parfois
  **coupée** (`t("…") {montant} t("…")`) et avec des **`\r\n`** dans la clé.

---

## 2. Défauts identifiés (par sévérité)

### P0 — Bloquant / crash
- **`t()` hors scope → crash runtime.** Dans `Orders.tsx`, le composant `GuaranteeCard` (fonction
  séparée, sans `useTranslation`) appelle `t(...)` (l.87+). `t` n'existe pas dans son scope →
  `ReferenceError` au rendu → **la page Commandes plante pour toute commande à garantie**. À auditer
  sur tous les composants « fonction » qui utilisent `t` sans le recevoir.
- **Clés cassées avec `\r\n`** (855 lignes) : intraduisibles, illisibles côté outil de traduction,
  et fragiles (toute reformatage du JSX casse la clé).

### P1 — Majeur
- **Architecture de clés incohérente** : namespacée (fr.json) vs texte-brut (en.json). Comme la
  plupart des `t("texte FR")` n'ont **pas** de clé dans fr.json, le français ne « marche » que par
  **repli i18next sur la clé** (= le texte FR). Fragile : si on modifie le texte de la clé, le FR
  casse ; et toute faute dans la « clé » se propage.
- **fr.json (37) ≪ en.json (982)** : couverture croisée cassée. Beaucoup de chaînes n'ont pas de
  version française gérée (elles dépendent du repli-clé), et l'inverse existe aussi.
- **Phrases découpées** : `t("…") {valeur} t("…")` casse la grammaire — surtout en anglais où
  l'ordre des mots diffère du français. Intraduisible proprement.

### P2 — Moyen
- Pas de **détection de langue** navigateur (i18next-browser-languagedetector).
- Pas de gestion **pluriel** ni de **formats** (nombres/FCFA, dates) via i18n (fait « à la main »).
- Chargement **eager** de tout le JSON (63 Ko en.json) — non idéal en 3G ; pas de lazy-load par page.
- Beaucoup de **texte en dur** subsiste probablement (les 58 fichiers ne couvrent pas tout).

### P3 — UX bouton langue
- **Drapeaux pays pour des langues** : 🇬🇧 pour l'anglais est discutable (exclut les anglophones
  non-britanniques ; le Cameroun est bilingue FR/EN). Préférer des **codes langue** (`FR` / `EN`)
  ou « Français / English ».
- Toggle **binaire peu découvrable** (juste un emoji), sans libellé texte ni icône Globe.
- Vérifier la **présence sur mobile** (menu) — pas seulement desktop.
- **A11y** : `aria-label` explicite + focus visible (le focus a été durci récemment côté formulaires).

---

## 3. Plan de CORRECTION (P0/P1 d'abord)

- **C1 (P0)** — Réparer tous les `t()` hors scope. Pour chaque composant « fonction » qui utilise
  `t` : soit `const { t } = useTranslation()` dedans, soit passer `t` en prop. Audit :
  repérer les fichiers où `t(` apparaît mais `useTranslation` absent, et les composants imbriqués.
- **C2 (P0)** — Purger les clés cassées : supprimer/normaliser les 855 entrées à `\r\n`, ne jamais
  mettre de saut de ligne dans une clé.
- **C3 (P1)** — **Un seul système : clés namespacées stables** (`page.section.element`), avec
  **fr.json ET en.json complets et synchronisés**. Bannir le texte-brut-comme-clé. Migration
  progressive page par page (extraire les chaînes → clés → remplir fr+en).
- **C4 (P1)** — Recomposer les phrases découpées en **une** clé avec **interpolation** :
  `t('orders.guarantee.secure', { amount: g.amountFcfa.toLocaleString() })`.
- **C5** — Script **`npm run verify:i18n`** (CI) qui échoue si : une clé manque dans une langue,
  une clé contient `\n`/`\r`, un `t(` est hors scope (heuristique), ou du texte-brut est utilisé
  comme clé. Modèle : le `verify:integrity` déjà en place.

## 4. Plan de PERFECTIONNEMENT

- **Détection langue** : `i18next-browser-languagedetector` (localStorage → navigateur → fr), sans
  casser la persistance actuelle.
- **Pluriel + formats** : clés au pluriel i18next ; centraliser le format FCFA/dates via i18n
  (`Intl.NumberFormat` selon la langue) pour la cohérence.
- **Lazy-load par namespace** (perf 3G) : découper les JSON par page/fonctionnalité, charger à la
  demande — surtout que en.json fait déjà 63 Ko.
- **Couverture 100 %** garantie par la CI (C5) : aucune clé sans traduction dans une langue.
- **Extraction** : outil (`i18next-parser`) pour extraire les clés du code et détecter le texte en
  dur restant.

## 5. UX du bouton langue + fluidité

- **Libellé, pas drapeau** : afficher `FR` / `EN` (ou « Français » / « English ») avec une icône
  `Globe`. Un drapeau ne désigne pas une langue.
- **Découvrabilité** : bouton visible **desktop ET mobile** (dans le menu mobile aussi), avec
  `aria-label` (« Changer de langue / Switch language ») et focus visible.
- **Fluidité** : react-i18next re-render **en place** au `changeLanguage` (pas de rechargement) —
  déjà le cas ; vérifier l'**absence de flash** au premier rendu (langue lue avant le premier paint,
  déjà via localStorage) et la **conservation de l'état/navigation** au switch.
- **Cohérence** : au changement de langue, mettre à jour aussi `<html lang>` et les formats
  (nombres, dates). Le placeholder de recherche, les toasts, les libellés de statut doivent suivre.
- **Contexte camerounais** : FR par défaut (bon) ; EN pertinent (pays bilingue, expats). FR/EN
  suffit — ne pas multiplier les langues sans besoin réel.

## 6. Séquence recommandée

C1 (crash) → C2 (clés cassées) → C3/C4 (unifier les clés + interpolation) → C5 (`verify:i18n`) →
perfectionnement (détection, pluriel, lazy-load) → UX bouton langue. Faire **par page** pour livrer
en continu et garder le site fonctionnel.

## 7. Prompt d'exécution (prêt à l'emploi)

> Contexte : i18n react-i18next (`src/i18n/config.ts`, `locales/{fr,en}.json`). Objectif : clés
> namespacées stables, fr+en synchronisés, zéro clé cassée, zéro `t()` hors scope.
> 1. **Audit** : écris `scripts/verify-i18n.mjs` (clés manquantes fr↔en ; clés avec `\n`/`\r` ;
>    `t(` dans un composant sans `useTranslation`). Ajoute `verify:i18n` au package.json. Lance-le.
> 2. **P0** : corrige les `t()` hors scope (ex. `GuaranteeCard` d'`Orders.tsx`) et purge les clés
>    à `\r\n`.
> 3. **Migration par page** : remplace les `t("phrase FR brute")` par des clés namespacées
>    (`page.section.element`), remplis fr.json ET en.json, recompose les phrases découpées avec
>    interpolation.
> 4. **UX bouton** : `FR`/`EN` + icône Globe, desktop+mobile, `aria-label`, `<html lang>` synchronisé.
> 5. **Perf/robustesse** : détection navigateur, pluriels, lazy-load par namespace.
> Critères d'acceptation : `verify:i18n` = 0 anomalie ; aucun crash `t is not defined` ;
> bascule FR↔EN instantanée sans flash ; `npm run build` OK.

> ⚠️ **Le frontend est le domaine de l'agent Codex** (qui déploie l'i18n). Ce plan est destiné à
> qui l'implémente ; coordonner pour éviter les conflits de fichiers.
