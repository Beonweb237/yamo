# Prompts successifs — Implémentation complète des recommandations restantes

> **Date** : 23/07/2026 · **Sources recensées** : `plan-optimisation-fiche-programme.md` (LOT 1-5),
> `plan-prompts-app-client.md` (CP1-9), `plan-prompts-i18n-seo.md` + `seo-i18n-url-architecture.md`,
> `ux-audit-optimal.md` + `ux-implementation-plan.md` (CONF/LOT), CLAUDE.md + mémoire projet.
> **Procédure d'exécution** : `docs/coordination-prompts.md` (journal, statuts, garde-fous).

## Bilan des sources (ce qui est déjà fait ne se refait PAS)

| Source | Fait (vérifié) | Restant |
|---|---|---|
| ux-implementation-plan (LOT-01→16, CONF-01→37) | Tous les 16 lots livrés 16/07 (qa-LOT-xx.md) | Dark mode back-office (reliquat CONF-32) ; P3 backlog (R-34 PWA, R-38 exports admin) hors périmètre confirmé |
| plan-prompts-i18n-seo (P1-P8) | Tout livré + déployé 21/07 (Lighthouse SEO 100, GSC configurée) | Rien |
| plan-prompts-app-client (CP1-9) | CP1, CP2 (cœur), CP3, CP4 livrés + déployés | CP2-bis, CP6, CP5, CP7 (upsell+ETA ; filtres déjà faits), CP10, CP8, CP9 |
| plan-optimisation-fiche-programme (LOT 1-5) | Rien (fiche actuelle = 108 lignes, squelette) | Tout (LOT 1-5) |
| OPTIMISATION_UX_YAMO.md | **Fichier absent du workspace** (référencé par CLAUDE.md). Ses recos DOC-UX P1/P2-xx sont tracées dans ux-implementation-plan §C/§F (faites ou écartées avec justif) | Rien d'actionnable de plus |
| CLAUDE.md « Priorités produit » | 1-9 couvertes par les lots + VPS (validation montants = `/api/orders/validate` actif) | 10 (WebSocket) = backlog backend, hors recos exécutables front |

**Priorités** : critique = conversion client réelle (fiche programme, promos) · élevée = personnalisation, upsell, ETA, apparence · moyenne = LOT 5 data, dark mode · faible = mobile store (dépend décisions externes).

**Dépendances clés** : PS-07 (promos) touche serveur + checkout → checkpoint git avant. PS-11 déploie → tous les précédents doivent être Terminés ou suspendus-documentés. PS-12/13 (mobile) en dernier, n'impactent pas le web.

**Règles transverses valables pour CHAQUE prompt** (non répétées) :
- Travailler depuis `app/`. Lire les fichiers avant d'éditer. Réutiliser `src/components/ui/`, tokens (`green-primary #157F3D`, `gold-accent #D4A843`, `text-muted`, `border-custom`), layouts existants. Aucune nouvelle lib UI.
- i18n : toute chaîne via `t()` (clé = texte FR une ligne), EN dans `src/i18n/locales/en.json`.
- Réel uniquement : masquer toute section sans donnée ; module alimentaire = VPS-only (FoodUnavailableError → état propre).
- États loading (Skeleton/spinner), empty, error sur toute liste/formulaire ajouté.
- Responsive 360×640 ET desktop 1280, zéro débordement horizontal ; a11y clavier + aria-label + contraste ≥ 4.5:1.
- Garde-fous bloquants après chaque prompt : pas de codex.exe → `verify:hooks`=0 → `verify:i18n` prioritaires 100% → `build` EXIT 0 → contrôle pixel 360+desktop, 0 erreur console. Correction immédiate avant d'avancer. Zéro régression hors périmètre (fichiers bornés).

---

## PS-01 — Apparence : sections Home + hero + support (CP2-bis) + endpoint site_config
- **Objectif** : compléter le socle Apparence : activer/désactiver/réordonner les sections de HomePremium, éditer le hero (titre/sous-titre) et les coordonnées support ; vérifier/brancher la persistance VPS `app_settings.site_config`.
- **Priorité** : élevée (fondation pour PS-06/PS-07). **Recos** : plan-app-client CP2 « Reste » + CP10 backend.
- **Fichiers à analyser** : `src/lib/siteConfig.ts`, `src/hooks/useSiteConfig.ts`, `src/pages/admin/AdminAppearance.tsx`, `src/pages/HomePremium.tsx`, `src/data/support.ts`, `server/src/index.js` (mécanisme app_settings du mode démo — réutiliser tel quel s'il couvre déjà `site_config`).
- **Modifications** : étendre `SiteConfig` (`homeSections: {id, enabled}[]`, `heroTitle?`, `heroSubtitle?`, `support?{phone,whatsapp,hours}`) avec défauts = rendu actuel ; AdminAppearance : liste réordonnable (boutons ↑↓, pas de lib DnD) + switches + champs texte ; HomePremium rend ses sections dans l'ordre configuré ; support.ts lit l'override config si présent.
- **Dépendances** : aucune. **Cas limites** : config corrompue/partielle → défauts ; VPS down → localStorage (comportement actuel).
- **CA mesurables** : désactiver « Populaires » en admin → section absente de HomePremium après reload ; réordonner → ordre appliqué ; hero édité → affiché ; défauts = rendu identique à avant (diff visuel nul en config vierge) ; classic intact.

## PS-02 — Fiche programme LOT 1 : compréhension de l'offre
- **Objectif** : la fiche `/programmes/:id` répond à « qu'est-ce que je reçois ? » avec les données existantes.
- **Priorité** : critique. **Recos** : fiche-programme LOT 1 (items 1-4).
- **Fichiers à analyser** : `src/pages/MealProgramDetail.tsx`, `src/lib/mealPrograms.ts` (schedule déjà exposé), `src/lib/catalog.ts` (`fetchMenuItems`), `src/lib/dishes.ts` (DIETARY_TAG_META).
- **Modifications exactes** : ① section « Exemples de plats de ce programme » = `fetchMenuItems(p.restaurantId)` filtré par `p.dietaryTags` (intersection tags), cartes photo+nom+prix, **masquée si 0 plat** ; ② calendrier : afficher `schedule.frequence`/`jours` (« Livré tous les jours » / « Lun, Mer, Ven ») ; ③ prix décomposé : cycle + « ≈ X FCFA / repas » (déjà partiel — compléter « livraison payée à la réception », cohérent avec le paiement honnête commit 6afdfbb) ; ④ bandeau « Comment ça marche » 4 étapes (icônes lucide, grille 2×2 mobile / 4 col desktop).
- **Cas limites** : programme sans tags → menu d'exemple = plats du resto (fallback), sinon masqué ; VPS down → page garde son état « introuvable » actuel.
- **CA** : sur un programme seedé en prod-like, ≥ 1 vrai plat tagué affiché ; jours du schedule visibles ; ratio prix/repas exact ; 4 étapes visibles à 360px sans débordement.

## PS-03 — Fiche programme LOT 2 : motivation & confiance
- **Objectif** : rendre la fiche appétissante et crédible sans donnée inventée.
- **Priorité** : critique. **Recos** : fiche-programme LOT 2 (items 5-8).
- **Fichiers** : `MealProgramDetail.tsx`, `src/lib/reviews.ts` (`fetchRestaurantRatingSummary` ou équivalent réel — vérifier le nom), `mealPrograms.ts` (restaurantImage déjà exposé).
- **Modifications** : ① photo : `photoUrl` → sinon `restaurantImage` → sinon dégradé `from-green-primary` + icône (jamais l'icône nue sur fond gris) ; ② 3-4 bénéfices dérivés de `targetAudience`/`dietaryTags` (mapping statique honnête, ex. tag diabète → « Index glycémique maîtrisé ») ; ③ preuve sociale : note+nb d'avis réels du resto (masqué si 0 avis) + mention partenaire vérifié ; ④ chips réassurance (annulation/pause/paiement à la livraison).
- **Cas limites** : resto sans avis → pas de note affichée ; tags inconnus → bénéfices génériques (gain de temps, livré chaud).
- **CA** : plus jamais d'icône nue en tête de fiche ; avis affichés = ceux de la fiche resto ; aucun chiffre inventé (grep « abonnés » interdit).

## PS-04 — Fiche programme LOT 3 : conversion
- **Objectif** : passage à l'action sans friction.
- **Priorité** : critique. **Recos** : fiche-programme LOT 3 (items 9-12).
- **Fichiers** : `MealProgramDetail.tsx`, `src/components/AddressAutocomplete.tsx`, `src/pages/Checkout.tsx` (pattern adresses sauvegardées `yamo_saved_addresses`), `mealPrograms.ts` (restaurantPhone).
- **Modifications** : ① carte récap avant souscription (X repas · Y sem · jours · démarre le [date] · total) mise à jour live ; ② barre CTA sticky bas d'écran mobile (« Souscrire · N FCFA », masquée desktop et quand le formulaire est visible à l'écran — IntersectionObserver simple) ; ③ adresse : chips des adresses sauvegardées + `AddressAutocomplete` (remplace l'input nu) ; ④ boutons « WhatsApp » (`wa.me` normalisé, message prérempli nom du programme) + « Appeler » si `restaurantPhone`.
- **Cas limites** : pas d'adresse sauvegardée → saisie directe ; pas de téléphone → boutons masqués ; non connecté → CTA mène à `/connexion` (comportement actuel conservé).
- **CA** : souscription complète inchangée fonctionnellement ; sticky visible à 360px uniquement quand le formulaire est hors écran ; wa.me s'ouvre avec le bon numéro sans espaces.

## PS-05 — Fiche programme LOT 4 : découverte + SEO
- **Objectif** : sortir de l'impasse de navigation + indexation riche.
- **Priorité** : élevée. **Recos** : fiche-programme LOT 4 (items 13-15).
- **Fichiers** : `MealProgramDetail.tsx`, `src/hooks/useSeo.ts` (vérifier support jsonLd/description), `src/lib/mealPrograms.ts` (`fetchPrograms`).
- **Modifications** : ① resto cliquable → `/restaurant/:id` ; section « Autres programmes » (même resto d'abord, puis autres, max 4, cartes réutilisant le style de `/programmes`, masquée si vide) ; ② FAQ repliable (composant `Accordion` shadcn existant, 4 Q/R honnêtes alignées sur le fonctionnement réel : paiement à la livraison, pause, jours, annulation) ; ③ JSON-LD Product+Offer (nom, prix FCFA, resto, image) + meta description riche via useSeo.
- **CA** : navigation fiche→resto→fiche fonctionne ; `document.querySelector('script[type="application/ld+json"]')` contient le prix ; description unique par programme FR/EN.

## PS-06 — CP6 : « Pour vous » réellement personnalisé (HomePremium)
- **Objectif** : classer les restos selon favoris + cuisines des commandes passées ; libellé honnête.
- **Priorité** : élevée. **Recos** : plan-app-client CP6.
- **Fichiers** : `src/pages/HomePremium.tsx`, `src/hooks/useFavorites.ts`, `src/lib/orders.ts` (`fetchOrders`), `src/hooks/useCatalog.ts`.
- **Modifications** : score = favori (fort) + cuisine présente dans l'historique livré (moyen) + note (base) ; titre « Basé sur vos goûts » seulement si ≥ 1 signal réel (favori ou commande), sinon « Populaires » (rendu actuel). Pas de nouvelle requête réseau par resto (agréger une fois).
- **CA** : avec 1 favori → il remonte en tête et le titre change ; visiteur vierge → strictement le rendu actuel ; aucune donnée inventée.

## PS-07 — CP5 : système de promotions RÉEL (serveur + admin + checkout + Home)
- **Objectif** : offres créées en admin, affichées sur la Home, réellement appliquées à la validation de commande.
- **Priorité** : critique (dernier « placeholder » du checkout : « code promo vérifié à la confirmation »). **Recos** : plan-app-client CP5 ; ux-plan R-19 (différé backend → maintenant faisable, le backend est là).
- **Fichiers à analyser** : `server/src/index.js` (`/api/orders/validate` l.500 — y brancher la remise), pattern de routes (`finance-routes.js` pour le style), `src/pages/Checkout.tsx` (promoCode existant), `src/pages/HomePremium.tsx` (emplacement carrousel), `src/App.tsx`, `src/lib/adminRbac` (permission), `BackOfficeLayout.tsx` (sidebar).
- **Modifications** : ① serveur : table `promotions` (code, type %/montant/livraison_gratuite, valeur, seuil, resto_ids nullable, période, active) possédée par l'utilisateur DB + routes `GET /api/promotions/active` (public), CRUD `/api/admin/promotions` (permission `promotions.manage`) ; `/api/orders/validate` applique la remise si code valide (période+seuil+resto) et la renvoie dans le breakdown ; ② front : `src/lib/promotions.ts` (double chemin VPS/mock-localStorage), page `AdminPromotions.tsx` + route + sidebar ; ③ Checkout : le champ promo existant affiche le résultat serveur (remise réelle ou erreur claire) ; ④ HomePremium : carrousel promos actives (masqué si aucune).
- **Dépendances** : PS-01 (sections). **Checkpoint git obligatoire avant** (serveur + checkout touchés).
- **Cas limites** : code expiré/seuil non atteint/mauvais resto → message d'erreur précis ; mode mock → validation locale sur le registre localStorage ; **déploiement serveur inclus dans PS-11** (pas de demi-déploiement).
- **CA** : offre créée en admin → visible sur HomePremium → code appliqué au checkout avec total serveur réduit du bon montant (E2E API) ; code invalide → refus motivé ; aucune promo → zéro trace visuelle.

## PS-08 — CP7 : upsell panier + ETA en direct (filtres : vérifier/passer)
- **Objectif** : trois quick-wins client ; le n°2 (filtres/tri) est déjà livré (LOT-13/14 — `Restaurants.tsx` : quickFilters dont « Ouvert maintenant », tri, sync URL) → vérifier et documenter, ne pas réimplémenter.
- **Priorité** : élevée. **Recos** : plan-app-client CP7.
- **Fichiers** : `src/pages/RestaurantDetail.tsx` (CartContent) et/ou `Checkout.tsx`, `src/lib/catalog.ts`, `src/pages/Orders.tsx`, `src/lib/distance.ts` (`estimateTime`), `src/lib/tracking.ts`.
- **Modifications** : ① upsell : dans le panier (CartContent fiche resto), rangée « Complétez votre repas » = 2-3 vrais articles du même resto (catégories boisson/dessert/accompagnement si présentes, sinon les moins chers non déjà au panier), ajout 1 clic via `addToCart` ; masquée si rien à proposer ; ② ETA : sur la commande active (`picked_up`/`delivering`), « Arrive dans ~X min » via `estimateTime` sur la distance resto→client restante (données réelles du suivi si dispo, sinon estimation étiquetée « estimé ») — recalcul au polling existant, jamais < 0 (« Imminent »).
- **CA** : upsell ajoute réellement l'article au panier ; aucun upsell si le resto n'a qu'un plat ; ETA visible sur commande en cours et étiqueté honnêtement ; `/restaurants` inchangé (capture avant/après identique).

## PS-09 — Fiche programme LOT 5 : enrichissement data (backend léger)
- **Objectif** : le resto peut saisir bénéfices + menu d'exemple + photo dédiée ; la fiche les affiche si présents (sinon fallback PS-02/03).
- **Priorité** : moyenne. **Recos** : fiche-programme LOT 5 (items 16-17).
- **Fichiers** : `server/src/food-routes.js` (colonnes `benefits text[]`, `sample_menu jsonb` — ALTER possible, tables possédées par l'app), `src/lib/mealPrograms.ts`, `src/pages/RestaurantPrograms.tsx` (formulaire + upload `processFormImage` déjà utilisé), `MealProgramDetail.tsx`.
- **Modifications** : migration additive idempotente ; champs facultatifs dans le formulaire resto (liste de puces bénéfices, sélection de plats du menu comme exemples) ; la fiche préfère les données saisies au dérivé.
- **Cas limites** : anciens programmes sans champs → fallback intact ; **déploiement serveur groupé en PS-11**.
- **CA** : programme édité avec 3 bénéfices → la fiche les affiche à la place du mapping dérivé ; API rétrocompatible (GET sans champs = comportement actuel).

## PS-10 — Dark mode back-office (reliquat CONF-32)
- **Objectif** : thème sombre complet limité au BackOfficeLayout (toggle topbar, `next-themes` déjà installé), critère strict « pas de dark partiel ».
- **Priorité** : moyenne. **Recos** : ux-plan CONF-32/LOT-12 (reporté), mémoire plan-ux-16-lots-termine.
- **Fichiers** : `src/components/BackOfficeLayout.tsx`, `src/main.tsx` (ThemeProvider scoping), `src/index.css` (variables dark des tokens back-office), échantillon d'écrans admin/resto/livreur.
- **Modifications** : ThemeProvider attribut class limité aux routes back-office (classe `dark` posée sur le conteneur BackOfficeLayout, pas sur `<html>`, pour ne jamais toucher le site client) ; variables CSS dark pour les tokens utilisés ; passe écran par écran (les ~25 pages back-office) — si un écran reste illisible et non corrigeable dans le lot, **suspendre le prompt entier** (statut Bloqué) plutôt que livrer un dark partiel.
- **CA** : toggle dans la topbar, persistant ; chaque page back-office lisible en dark (contraste ≥ 4.5:1, spot-check) ; site client strictement inchangé (aucune classe dark qui fuit).

## PS-11 — Recette transverse + déploiement VPS (CP10 + serveurs PS-07/09)
- **Objectif** : recette finale (pixel 360/414/1280, a11y, i18n FR/EN, perf, 0 erreur console) sur tous les écrans touchés, puis déploiement complet.
- **Priorité** : critique (livraison). **Recos** : CP10 + règles déploiement mission.
- **Étapes** : garde-fous complets → recette navigateur (fiche programme, HomePremium classic+premium, checkout promo, admin promos/apparence, dark) → **serveur** : scp des routes modifiées + `pm2 restart` + E2E API prod (promos, programmes enrichis) → **frontend** : `npm run build` + `npx react-snap` (Chrome local — INDISPENSABLE sinon routing /fr /en cassé) + backup `dist.bak-<TS>` + tar/scp dist complet (assets+fr+en+index.html+200.html+robots+sitemap, images conservées) vers `ubuntu@51.222.15.0:/home/ubuntu/miamexpress/dist` (clé `~/.ssh/id_ed25519_jackpot`) → vérif prod curl + navigateur FR ET EN + `node scripts/gsc.mjs submit-sitemap`.
- **CA** : prod sert le nouveau bundle ; `/fr/programmes/:id` riche en prod ; promo E2E en prod ; Lighthouse SEO ≥ 95 sur 1 page prérendue ; backups présents.

## PS-12 — CP8 : app mobile client (Capacitor)
- **Objectif** : périmètre client packagé Capacitor sans dupliquer le code ni régresser le web.
- **Priorité** : faible (jalon B). **Recos** : plan-app-client CP8.
- **Modifications** : deps `@capacitor/core+cli+android` ; `capacitor.config.ts` (appId `com.miamexpress.client`) ; flag `VITE_APP_TARGET=client` → App.tsx ne monte que les routes client ; `src/native/` gardé par `Capacitor.isNativePlatform()` (statusBar, back Android, deep links, stubs push/géoloc no-op web) ; `android/` généré ; icône+splash ; doc de lancement.
- **Cas limites** : pas d'Android SDK sur ce poste → `npx cap add android`/`sync` OK sans SDK ; le build APK/AAB est documenté, pas exécuté. **Le build web (predeploy) doit rester strictement identique.**
- **CA** : `npx cap sync` EXIT 0 ; build web inchangé (hash de bundle comparable hors config) ; routes admin absentes du bundle target=client.

## PS-13 — CP9 : préparation Play Store (STOP & DEMANDE)
- **Objectif** : checklist store complète FR/EN (compte, AAB signé, fiche, captures, politique de confidentialité, catégories) + commande AAB de test documentée.
- **Priorité** : faible. **Recos** : plan-app-client CP9.
- **Limites strictes** : aucune clé de signature, aucun compte externe, aucune soumission — préparation documentaire uniquement ; tout le reste = STOP & DEMANDE.
- **CA** : `docs/play-store-checklist.md` complet et actionnable par le propriétaire.

---

## Recommandations recensées NON planifiées (justification)
- **R-34 PWA/service worker, R-38 paramètres/exports admin** : P3 backlog écarté explicitement par ux-implementation-plan §C.2 (« pas de lot ») — inchangé.
- **R-36 fidélité** : couverte depuis par MiamPoints (livré 21/07). **R-35 i18n EN** : couverte par le programme i18n/SEO. **R-37 livraison programmée** : couverte pour les repas par les abonnements (FOOD) ; la version générique reste backlog.
- **WebSocket à la place du polling** (CLAUDE.md priorité 10) : backend structurel, hors recos exécutables de ces plans ; le polling est déjà conforme (≥ 15 s, pause onglet caché — LOT-11).
- **MoMo/Orange Money réel** : nécessite un contrat agrégateur (service externe) → STOP & DEMANDE par nature.
- **QA-23** (rémunération livreur si deliveryFee = 0) : décision produit ouverte → à trancher par le propriétaire.
