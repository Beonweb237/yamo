# Plan de prompts — App Client MiamExpress (templates + Home Premium + mobile) de A à Z

> But : livrer l'expérience client « inspirée des meilleurs » **sans risque** : d'abord un
> **système de templates pilotable en admin** (l'actuel reste dispo, le nouveau devient une
> option), puis la **Home Premium au pixel près** de la maquette validée
> (`miamexpress_home_client_mockup_brand`, identité vert `#157F3D` / or `#D4A843`), les
> quick-wins client, et enfin l'**app mobile Play Store** (Capacitor, périmètre client).
>
> Chaque prompt est **autonome** (colle-le dans une session Claude Code fraîche). Ils sont
> **ordonnés**. Ce plan se compose avec les garde-fous i18n/SEO existants
> (`docs/plan-prompts-i18n-seo.md`) : toute nouvelle chaîne passe par `t()`, toute page
> nouvelle passe `verify:i18n`.

---

## Avancement

- [x] **CP1 — Socle Templates & Apparence** ✅ vérifié (verify:hooks 0, verify:i18n OK, build 0, pixel classic identique, bascule premium OK, mobile 360px OK). Fichiers : `lib/siteConfig.ts`, `hooks/useSiteConfig.ts`, `pages/Home.tsx` (routeur), `pages/HomeClassic.tsx`, `pages/HomePremium.tsx` (placeholder), `pages/admin/AdminAppearance.tsx`, route + `appearance.manage` + sidebar.
- [x] **CP2 — Apparence : logo + couleurs** ✅ vérifié (couleurs appliquées à chaud puis reset #157F3D, logo navbar dynamique, `BrandTheme` monté, application synchrone au boot = pas de flash). **Reste (CP2-bis, non fait)** : sections Home on/off/ordre, contenu hero éditable, coordonnées support. **Backend (CP10)** : endpoint `/api/settings/site_config` à ajouter côté VPS (front best-effort, mock/localStorage OK).
- [x] **CP3 — HomePremium au pixel près** ✅ commité `a7cc3a3` (capture conforme à la maquette : en-tête perso, recherche, catégories, « Populaires » cartes réelles ; promos CP5 / reorder CP4 masqués). Navbar forcé solide sur premium.
- [x] **CP4 — « Commander à nouveau »** ✅ vérifié (reorder testé : clic → panier rechargé → /checkout). `hooks/useReorder.ts` (logique extraite d'Orders.tsx) + section « Vos commandes récentes » sur HomePremium (fetchOrders réel, masquée si aucune commande). Committé dans `f8ada28`+`60e4820` (le commit global « food » de Codex a balayé mon travail — code sauf, commits brouillés).
- [ ] **CP6 — Personnalisation « Pour vous »** ← PROCHAINE ÉTAPE.
- [ ] CP5, CP7, CP10, CP8, CP9.

> ⚠️ Concurrence : Codex tourne en parallèle (module « alimentaire » : MealPrograms/Subscriptions/food-routes) et **ré-entrelace** Navbar/BackOfficeLayout/adminRbac/App.tsx/en.json. Tué 2× cette session. Ses fichiers restent **non commités** (préservés). Vérifier `tasklist|grep codex` avant tout build/commit. **Recommandation : ne pas faire tourner Codex pendant l'exécution de ce plan** (isolation impossible sinon).

## Règles transverses (rappelées dans chaque prompt)

- Travailler depuis `app/`. **Réel uniquement** : aucune promo/donnée factice (règle CLAUDE.md).
- Identité **MiamExpress** : vert `#157F3D`, or `#D4A843`, cartes blanches, tokens Tailwind existants.
- **Mobile-first + responsive** : tester **360px** ET desktop. Pas de débordement horizontal.
- i18n **FR/EN** (clé = texte FR), états **loading/empty/error**, a11y clavier.
- Ne rien casser hors périmètre : on borne les fichiers touchés.
- **Boucle de garde-fous** entre chaque étape (bloquante) :
  1) aucun `codex.exe` ; 2) `npm run verify:hooks` = 0 ; 3) `npm run verify:i18n` ;
  4) `npm run build` = EXIT 0 ; 5) **contrôle pixel** : rendu comparé à la maquette validée à
  360px et desktop (capture navigateur), 0 erreur console.

---

## CP1 — Socle « Templates & Apparence » (le véhicule sûr)

```
Crée le système de personnalisation du site piloté en admin, SANS changer le rendu actuel.
1) Config site : hook useSiteConfig() lisant/écrivant une config { homeTemplate:'classic'|'premium',
logoUrl, brandColors, promoBannerEnabled, homeSections } via le double chemin habituel
(app_settings VPS si VITE_USE_VPS_API, sinon localStorage) — même mécanisme que le mode démo du
suivi livreur. Valeur par défaut = 'classic', lue TÔT (pas de flash).
2) Renomme la Home actuelle en HomeClassic SANS toucher son rendu (elle se charge telle quelle).
3) Home.tsx devient un routeur de template : 'classic' -> <HomeClassic/>, 'premium' -> <HomePremium/>
(HomePremium = placeholder pour l'instant).
4) Page admin /admin/apparence (RoleGate admin, permission dédiée) : choisir le template Home.
Garde-fous complets. Le site doit rendre EXACTEMENT comme avant en 'classic'.
```
**Acceptance** : en `classic`, rendu identique à aujourd'hui ; bascule admin fonctionnelle ; build vert.

---

## CP2 — Options d'apparence en admin

```
Étends /admin/apparence : upload LOGO via /api/media (appliqué navbar+footer+app, fallback actuel
si vide) ; couleurs de marque (vert primaire / or accent) appliquées via variables CSS runtime
sur :root, avec garde-fous de contraste (a11y) ; activer/désactiver et réordonner les sections de
la Home (homeSections) ; éditer le contenu hero (titre/sous-titre) et les coordonnées support
(téléphone/WhatsApp/horaires). Tout est réel et persistant. i18n FR/EN. Garde-fous + pixel.
```
**Acceptance** : logo/couleurs/sections/contenu modifiables en admin et reflétés sur le site ; contraste OK.

---

## CP3 — HomePremium au pixel près (structure)

```
Construis HomePremium À L'IDENTIQUE de la maquette validée (miamexpress_home_client_mockup_brand),
en identité MiamExpress (vert/or), responsive mobile+desktop :
- En-tête perso : « Bonjour » + nom du profil, sélecteur de quartier (données locations), cloche
  notifications (badge = nb réel de notifs, sinon masquée) ;
- Barre de recherche (réutilise GlobalSearch) + bouton filtres ;
- Emplacement carrousel promo (branché en CP5, sinon masqué — jamais de fausse promo) ;
- Catégories (cuisineCategories) re-stylées en puces rondes ;
- Section « Pour vous » : cartes resto (photo /api/media, badge temps, note or, cuisine, frais,
  cœur favori) — données réelles via useRestaurants ;
- Sections pilotées par homeSections (ordre/on-off de CP2).
Desktop : réagencement multi-colonnes du MÊME composant. i18n FR/EN, loading (Skeleton)/empty.
Contrôle pixel obligatoire : comparer à la maquette à 360px ET desktop. Garde-fous complets.
```
**Acceptance** : HomePremium (option `premium`) fidèle à la maquette à 360px et desktop ; classic intact.

---

## CP4 — « Commander à nouveau » (reorder)

```
Ajoute à HomePremium la section « Vos commandes récentes » avec reorder 1-clic : lis l'historique
réel (fetchOrders / yamo_local_orders), affiche les dernières commandes (resto, résumé, date, prix)
et un bouton « Commander à nouveau » qui re-remplit le panier (CartContext) avec les mêmes articles
(gère les articles indisponibles : toast + skip). États loading/empty (« Aucune commande »). i18n.
Garde-fous + pixel.
```
**Acceptance** : reorder recharge le panier depuis une vraie commande ; empty state propre.

---

## CP6 — Personnalisation « Pour vous »

```
Rends la section « Pour vous » réellement personnalisée : classe les restos selon les favoris
(useFavorites) + les cuisines des commandes passées de l'utilisateur ; fallback = meilleures notes
si pas d'historique. Libellé honnête (« Basé sur vos goûts » seulement si signal réel, sinon
« Populaires »). Aucune donnée inventée. Garde-fous + pixel.
```
**Acceptance** : ordre des restos reflète favoris/historique ; fallback correct pour un nouveau visiteur.

---

## CP5 — Système de promotions RÉEL

```
Crée un vrai système de promotions (pas décoratif). Admin /admin/promotions : créer/activer des
offres (type: %/montant/livraison gratuite, seuil, restos ciblés, période, code) stockées côté
serveur (double chemin VPS/mock) et VÉRIFIÉES à la validation de commande (réutilise la validation
promo existante du checkout). Puis branche l'affichage sur HomePremium : carrousel promo + « Offres
à ne pas manquer » lisent ces offres réelles (masqués si aucune active). Cohérence avec promoCode
du Checkout. i18n FR/EN. Garde-fous + pixel.
```
**Acceptance** : une offre créée en admin s'affiche sur la Home ET s'applique réellement au checkout ; rien si aucune offre.

---

## CP7 — Quick-wins client (panier, liste, suivi)

```
Trois améliorations client, chacune réelle et testée : 1) UPSELL au panier/checkout (« Ajoutez une
boisson/un dessert ») proposant de vrais articles du même restaurant, ajout au panier en 1 clic ;
2) FILTRES & TRI sur la liste restos (/restaurants) si absents : cuisine, note, temps, frais,
« ouvert maintenant » (isEffectivelyOpen) ; 3) ETA EN DIRECT sur le suivi (Orders) : compte à rebours
« arrive dans ~X min » basé sur distance/estimateTime. i18n, états, garde-fous + pixel.
```
**Acceptance** : upsell ajoute un vrai article ; filtres/tri fonctionnels ; ETA affiché sur une commande en cours.

---

## CP10 — Recette pixel-perfect + déploiement WEB (Jalon A)

```
Recette finale web : compare HomePremium à la maquette validée à 360px, 414px et desktop (captures),
corrige les écarts au pixel ; vérifie a11y clavier + contraste, perf (pas de gros surcoût), i18n
FR/EN sur les deux templates, bascule classic<->premium sans flash. Garde-fous complets. Puis
DÉPLOIE le frontend sur le VPS (backup dist.bak-<TS>, sync index.html+assets+robots+sitemap,
vérif prod FR/EN + bascule template). Ne touche pas au backend sauf endpoints ajoutés (apparence,
promotions) — dans ce cas déploie aussi server/ proprement, avec sauvegarde, sans secret.
```
**Acceptance** : Premium pixel-perfect en prod, bascule admin OK, classic dispo, tout vert.

---

## CP8 — App mobile (Capacitor + périmètre client)

```
Prépare l'app mobile CLIENT pour le Play Store SANS dupliquer le code. Ajoute Capacitor
(@capacitor/core+cli+android) : capacitor.config.ts (appId com.miamexpress.client), dossier android/
généré et commité. Périmètre client : flag VITE_APP_TARGET=client -> App.tsx monte SEULEMENT les
routes client (pas admin/dashboards). Couche src/native/ (gardée par Capacitor.isNativePlatform()) :
statusBar, bouton retour Android, deep links /fr /en, et STUBS de push (FCM) et géolocalisation
(implémentation web = no-op). Génère icône + splash MiamExpress (resources/ -> android/). Documente
le lancement local (npx cap run android). Garde-fous web inchangés (le web ne doit pas régresser).
```
**Acceptance** : `npx cap sync` OK, l'app mobile ouvre le périmètre client, le web reste intact.

---

## CP9 — Build AAB + Play Store (Jalon B)

```
Prépare la mise en ligne Play Store : fiche de procédure complète (compte développeur, AAB signé,
fiche store FR/EN, captures, politique de confidentialité, âge, catégories). Génère l'AAB de test
NON signé si l'environnement le permet et documente la commande. STOP & DEMANDE avant toute étape
nécessitant un SECRET (clé de signature/keystore) ou un compte externe (upload Play Console) — tu
prépares tout, JE signe et JE soumets. Ne manipule jamais la clé de signature.
```
**Acceptance** : checklist store complète + AAB de test documenté ; signature/upload laissés à l'utilisateur.

---

## Ordre recommandé & jalons

```
CP1 → CP2 → CP3 → CP4 → CP6 → CP5 → CP7 → CP10 (recette + deploy web = JALON A)
    → CP8 → CP9 (JALON B : app mobile prête à soumettre)
```

- **Jalon A (fin CP10)** : app client web Premium **au pixel près**, pilotable en admin, déployée.
- **Jalon B (fin CP9)** : app mobile client prête pour le Play Store (signature/upload = toi).

**Total ≈ 4 à 5 jours** de dev, livrable par jalon.

---

## MASTER PROMPT DE COORDINATION

> À garder en tête / coller en amont d'une session pour piloter le plan à la main, prompt par prompt.

```
Tu pilotes le programme docs/plan-prompts-app-client.md (app client MiamExpress : templates +
Home Premium au pixel près + quick-wins + app mobile). Exécute les prompts DANS L'ORDRE
CP1→CP2→CP3→CP4→CP6→CP5→CP7→CP10→CP8→CP9. Contexte : CLAUDE.md, mémoire, la maquette validée
(vert #157F3D / or #D4A843), et docs/plan-prompts-i18n-seo.md pour les garde-fous i18n/SEO.
Entre CHAQUE prompt : boucle de garde-fous (pas de codex.exe ; verify:hooks=0 ; verify:i18n ;
build EXIT 0 ; contrôle PIXEL à 360px+desktop vs maquette ; 0 erreur console). N'avance jamais sur
du rouge : corrige d'abord. RÈGLES : réel uniquement (aucune promo/donnée factice), identité
MiamExpress, responsive mobile-first, i18n FR/EN, ne rien casser hors périmètre. Reporte après
chaque prompt (fait/vérifié/suivant) et à chaque jalon (A=fin CP10, B=fin CP9) avec preuves
(build vert, capture navigateur, URL prod). Demande-moi confirmation avant CP5 (nouveau système),
CP10 (déploiement) et CP9 (store/signature).
```

---

## PROMPT D'EXÉCUTION AUTOMATIQUE (A → Z, au pixel près)

> À coller **une seule fois** dans une session Claude Code fraîche pour tout enchaîner en autonomie.

```
MISSION : Réalise de A à Z, EN AUTONOMIE et AU PIXEL PRÈS, le programme
docs/plan-prompts-app-client.md — app client MiamExpress : (1) système de templates pilotable en
admin (l'actuel « Classic » reste intact, le nouveau devient une option), (2) Home « Premium »
fidèle à la maquette validée en identité vert #157F3D / or #D4A843, (3) quick-wins client
(reorder, personnalisation, promos RÉELLES, upsell, filtres, ETA), (4) app mobile client
Play Store (Capacitor, périmètre client). Tu as mon autorisation DURABLE pour les déploiements
VPS décrits (CP10).

CONTEXTE (à lire, ne rien redemander) : CLAUDE.md, mémoire projet, docs/plan-prompts-app-client.md,
docs/plan-prompts-i18n-seo.md, docs/seo-i18n-url-architecture.md.

ORDRE STRICT : CP1 → CP2 → CP3 → CP4 → CP6 → CP5 → CP7 → CP10 → CP8 → CP9. Coche l'avancement,
enchaîne sans me redemander, SAUF les cas STOP ci-dessous.

BOUCLE DE GARDE-FOUS entre CHAQUE étape (bloquante) :
  1) aucun codex.exe (tasklist) ;
  2) npm run verify:hooks → 0 ;
  3) npm run verify:i18n → pages prioritaires 100% ;
  4) npm run build → EXIT 0 ;
  5) CONTRÔLE PIXEL : ouvre le rendu (dev server) à 360px ET desktop, compare à la maquette
     validée, capture, et corrige tout écart visible AVANT d'avancer ;
  6) 0 erreur console.
N'avance JAMAIS sur du rouge : corrige d'abord.

RÈGLES DE L'ART : réel UNIQUEMENT (aucune promo/donnée factice — masquer si pas de donnée réelle) ;
identité MiamExpress (tokens verts/or, pas de couleur en dur hors config) ; responsive mobile-first
(360px sans débordement) ; i18n FR/EN (clé = texte FR) ; états loading/empty/error ; a11y clavier
+ contraste ; ne rien casser hors périmètre (borne les fichiers) ; wrap_t.cjs reste dry-run et
verify:hooks après tout --write.

DÉPLOIEMENTS (CP10) : backup dist.bak-<horodatage> AVANT ; frontend (index.html+assets+robots+
sitemap) [+ server/ proprement si endpoints apparence/promotions ajoutés, sans secret] ; vérif prod
APRÈS (curl + navigateur FR ET EN + bascule template). Clé ~/.ssh/id_ed25519_jackpot, cible
ubuntu@51.222.15.0:/home/ubuntu/miamexpress.

STOP & DEMANDE (ne pas faire en autonome) :
  - CP9 : toute étape avec un SECRET (clé de signature/keystore) ou un compte externe (upload
    Play Console) → prépare tout, je signe/soumets ;
  - toute action destructive/irréversible non prévue ;
  - tout garde-fou (dont le contrôle pixel) que tu ne peux pas rendre vert ;
  - toute décision produit ambiguë (ex. règle métier d'une promo, formulation EN d'une page très
    visible) → propose, ne devine pas ;
  - détection d'un codex.exe / édition concurrente des mêmes fichiers.

REPORTING : après chaque CP, un point court (fait/vérifié/suivant + capture). À chaque jalon
(A = fin CP10 = web Premium déployé ; B = fin CP9 = mobile prête) : récap + preuves.

DÉFINITION DE « DONE » (rapport final) : templates classic/premium pilotables en admin ; HomePremium
au pixel près à 360px+desktop, i18n FR/EN, réel ; reorder + « pour vous » + promos réelles + upsell
+ filtres + ETA opérationnels ; déployé en prod avec bascule sans flash ; app mobile client
(Capacitor) prête à soumettre (checklist store + AAB de test) ; garde-fous verts. Mets à jour la
mémoire et coche le plan.

Commence maintenant par CP1.
```
