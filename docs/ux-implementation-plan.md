# Plan d'implémentation UX — MiamExpress

> **Date** : 16/07/2026 · **Source** : `app/docs/ux-audit-optimal.md` (38 recommandations R-01→R-38), vérifiées une par une contre le code actuel.
> **Contexte technique décisif** : conformément à `CLAUDE.md`, **Supabase est neutralisé** (`src/lib/supabase.ts` → `isSupabaseConfigured = false`, `supabase = null`). Le backend cible est le **VPS** (`/api/...` via Nginx). Toutes les recommandations de l'audit mentionnant « Supabase Realtime » ou « Edge Functions » sont **traduites ici en équivalents VPS ou en mode mock/localStorage**, comme l'exige CLAUDE.md.
> **Règle de ce document** : aucun fichier fonctionnel n'a été modifié. Ce plan est le contrat d'implémentation ; chaque lot (LOT-xx) est livrable, testable et validable indépendamment.

---

## A. État actuel du projet

### Stack
- **Front** : React 19 + TypeScript + Vite 6, `app/` = racine applicative.
- **UI** : Tailwind CSS (tokens custom) + shadcn/ui (Radix) complet dans `src/components/ui/` (~50 composants), icônes **lucide-react**, animations **framer-motion**, toasts **sonner**, graphiques **recharts**, cartes **Leaflet** (lazy via `LazyDeliveryMap`/`LazyAddressPickerMap`), dates **date-fns**.
- **Données** : double chemin dans chaque lib (`if (isSupabaseConfigured) → Supabase` sinon → mock localStorage). **Le chemin Supabase est inerte** (neutralisé) : l'app tourne aujourd'hui 100 % en mock localStorage, sauf la médiathèque admin et certains endpoints qui visent le VPS (`/api/media`, `authToken.ts`).
- **Backend cible** : VPS OVH (Nginx → API :3002, média :3003, `/uploads/`). PM2 `miamexpress-api` et `miamexpress-media` tournent déjà en production (`miamexpress.cm`).

### Architecture & profils
- **Routes** : `src/App.tsx` (source autoritaire) — 23 routes client publiques, 4 routes dashboard restaurant, 3 livreur, 10 admin (liste exhaustive dans CLAUDE.md §Routes).
- **Layouts** : `Layout.tsx` (client : Navbar + Footer + MobileBottomNav) ; `BackOfficeLayout.tsx` (dashboards : topbar sombre + sidebar contextuelle par rôle).
- **Navigation** : Navbar desktop avec mega-menu (`Navbar.tsx:26-45`) ; bottom nav mobile 5 onglets (`MobileBottomNav.tsx`) masquée sur les back-offices ; sidebars par rôle (`BackOfficeLayout.tsx:16-40`) ; **doublons** : onglets internes de `RestaurantDashboard` (5, dont « Livreurs » sans URL) et segmented control + bottom nav propre dans `DriverDashboard`.
- **Profils** : client / restaurant / livreur / admin, protégés par `RoleGate.tsx` (rôle + `isApproved` + `isSuspended`).
- **Styles / tokens** : `tailwind.config.js` + `src/index.css` — `green-primary #157F3D`, `gold-accent`, `text-muted`, `border-custom`, `bg-secondary` ; polices Poppins (titres) / Inter (texte).
- **Composants partagés clés** : `RoleGate`, `PageHeader`, `OrderStatusStepper`, `AppImage`, `ApplicationForm`, `AddressPickerMap`, `DeliveryMap`, `ZoneAlertBanner`, `DistanceBadge`.

### Réel vs simulé (vérifié dans le code)
- **Réellement fonctionnel (mode mock inclus)** : auth mock + rôles, catalogue, panier (en mémoire), checkout complet, cycle de commande inter-profils via localStorage partagé, candidatures→validation admin, gains/virements livreur, finances resto, favoris, food requests, médiathèque admin (VPS).
- **Simulé / incomplet** : OTP SMS (tout code accepté), validation serveur des montants (**jamais appelée** : la branche `isSupabaseConfigured` de `Checkout.tsx:245` est morte), paiement MoMo/Orange (`payments.ts` pointe des Edge Functions Supabase inexistantes), tracking livreur (`tracking.ts:simulateDriverPosition`), position/distances livreur (`DriverDashboard.tsx:234` coordonnées en dur), messages rapides client et livreur (toasts sans effet), carte de supervision admin (positions inventées), i18n (préférence stockée sans effet), PWA (aucun service worker).

### Commandes
| Action | Commande | État vérifié |
|---|---|---|
| Lancer | `npm run dev` (depuis `app/`) | — |
| Build | `npm run build` (= `tsc -b && vite build`) | `tsc -b` : **0 erreur** (vérifié ce jour) |
| Lint | `npm run lint` | **échoue : 79 erreurs + 2 warnings pré-existants** (`react-hooks/set-state-in-effect`, `no-explicit-any`) — règle : ne pas en ajouter |
| Type-check | inclus dans build (`tsc -b`) | OK |
| Tests | **aucun script `npm test`** | validation = build + parcours manuel navigateur (360×640 et desktop) |

### Git
Dépôt actif dans `app/` (branche `main`, à jour avec `origin/main`) avec **15 fichiers modifiés non commités** (sync VPS : `supabase.ts` neutralisé, `authToken.ts`, FoodRequest, AdminMedia, etc.). **Avant tout lot : committer ou faire valider ce travail en cours** pour partir d'un état propre.

### Risques techniques principaux
1. Toute correction « validation serveur » dépend d'endpoints VPS qui n'existent pas encore côté `app/server/` — les lots concernés définissent un comportement mock ET un contrat d'API.
2. Le cycle de commande inter-profils repose sur `yamo_local_orders` partagé : modifier `orders.ts` impacte les 4 profils à la fois → tests croisés obligatoires.
3. Lint en échec : impossible d'utiliser « lint vert » comme critère ; critère = *pas de nouvelle erreur dans les fichiers touchés*.
4. Interdits CLAUDE.md à respecter : pas de nouvelle intégration Supabase, pas de `alert()`/`prompt()`, pas de polling < 15 s, pas de base64 comme solution finale, conserver les branches `isSupabaseConfigured` inertes.

---

## B. Éléments à conserver (ne pas toucher sans demande)

- **Écrans déjà professionnels** : Checkout (structure adresse quartier+repère+carte, destinataire tiers, écran de confirmation), AdminApplications (onglets, documents, motifs de rejet), FinancesTab restaurant (KPIs + graphiques), réception de commandes resto (alerte sonore, urgence colorée, temps de préparation 1-tap), Gains/virements livreur, Restaurants.tsx (filtres, tri, sync URL).
- **Composants corrects** : tout `src/components/ui/`, `RoleGate`, `OrderStatusStepper`, `PageHeader`, `AppImage`, cartes Leaflet lazy, `ZoneAlertBanner`, dialog de conflit de panier.
- **Parcours efficaces** : découverte → fiche resto → panier → checkout (hors points confirmés ci-dessous) ; candidature → validation ; acceptation concurrente de course (erreur + toast).
- **Identité visuelle** : palette vert/or, cartes blanches arrondies, heros verts avec breadcrumb, typographie — **aucun changement d'identité prévu dans ce plan**.
- **Mécaniques à garder** : mode mock localStorage (mode de dev actif), livreurs préférés (concept), double notation livraison/restaurant, catalogue de plats types avec validation admin.

---

## C. Problèmes confirmés

Vérification exhaustive : sur les 38 recommandations de l'audit, **31 confirmées** (dont 6 reformulées pour le contexte VPS), **4 reclassées** (backend requis / périmètre), **3 écartées ou différées** avec justification (§C.2).

### C.1 Problèmes confirmés et vérifiés dans le code

Format : ID · profil · route/écran · problème → conséquence · recommandation · fichiers · priorité/impact/effort/risques · critères d'acceptation (CA).

---

**CONF-01 — Panier non persistant** *(audit R-01)*
- Profil : Client · Routes : toutes (panier global) · Écran : Navbar popover, fiche resto, checkout.
- Vérifié : `CartContext.tsx` = `useState` pur ; aucune clé localStorage (CLAUDE.md le liste en dette connue).
- Conséquence : panier perdu au refresh/navigation externe → abandon.
- Recommandation : persister `items` dans `localStorage` (clé **`yamo_cart`**, à ajouter au registre CLAUDE.md), hydratation au mount, TTL 24 h, invalidation si le restaurant du panier change de disponibilité.
- Fichiers : `src/contexts/CartContext.tsx` (+ CLAUDE.md registre clés).
- P0 · Impact critique · Effort faible · Risques : collision de clé (aucune existante) ; QuotaExceeded si items volumineux (les MenuItem embarquent des URLs d'image, pas de base64 → OK).
- CA : ajouter 2 articles → F5 → panier intact ; panier > 24 h → vidé ; `clearCart()` nettoie la clé ; aucun crash si JSON corrompu (try/catch comme `readAddresses`).

**CONF-02 — Fusion erronée des plats personnalisés** *(R-03)*
- Profil : Client · Route : `/restaurant/:id` · Écran : dialog de personnalisation.
- Vérifié : `RestaurantDetail.tsx:confirmCustomized` crée `{...customizing, name, price}` **sans changer `id`** ; `CartContext.addToCart` matche par `item.id` → un « Poulet DG + Large + Frites » et un « Poulet DG » nature fusionnent sur la même ligne au mauvais prix.
- Recommandation : id composite `${item.id}::v${variantIdx}::s${[...suppl].sort().join('-')}` (ou hash) ; conserver `baseItemId` pour le serveur.
- Fichiers : `src/pages/RestaurantDetail.tsx`, `src/contexts/CartContext.tsx` (type `CartItem` si besoin de `baseItemId`), impact lecture : `Checkout.tsx` (envoi `menuItemId` → utiliser `baseItemId`).
- P0 · Impact critique · Effort faible · Risques : `getItemQuantity` sur la fiche resto compte par id — les compteurs par plat devront agréger par `baseItemId` (sinon le badge quantité disparaît pour les plats personnalisés).
- CA : ajouter le même plat en 2 personnalisations différentes → 2 lignes distinctes aux bons prix ; ajout du plat nature → 3ᵉ ligne ; total exact ; commande créée avec les bons libellés.

**CONF-03 — Aucune validation serveur des montants (reformulé pour VPS)** *(R-02)*
- Profil : Client (+ intégrité plateforme) · Route : `/checkout`.
- Vérifié : la branche `validateOrder` de `Checkout.tsx:245-266` est **morte** (`isSupabaseConfigured = false`) ; `payments.ts` pointe des Edge Functions Supabase inexistantes. Aujourd'hui : montants 100 % client.
- Recommandation (2 temps) : ① front : refactorer `payments.ts` vers `/api/orders/validate` (contrat : `{restaurantId, items:[{menuItemId,quantity}], promoCode?}` → `{subtotal, discount, deliveryFee, total, minOrderMet}`) avec `authHeaders()` de `authToken.ts` ; **si l'appel échoue en mode VPS → bloquer la commande** (message réessai), fallback client uniquement si mode mock. ② backend VPS : implémenter l'endpoint (hors périmètre UX de ce plan, à tracer côté serveur).
- Fichiers : `src/lib/payments.ts`, `src/pages/Checkout.tsx` ; serveur : `app/server/` (contrat documenté, implémentation séparée).
- P0 · Impact critique · Effort moyen (front faible, back moyen) · Risques : sans endpoint prêt, le blocage strict casserait les commandes → le front doit détecter le mode (mock vs VPS) via la même convention que le reste des libs.
- CA (front) : en mock, commande OK avec montants client ; en mode VPS avec endpoint down, la commande est bloquée avec message clair et bouton réessayer ; aucune référence à `VITE_SUPABASE_FUNCTIONS_URL` restante dans `payments.ts`.

**CONF-04 — Le client ne peut pas annuler une commande** *(R-04)*
- Profil : Client (impacts resto/admin) · Route : `/commandes`.
- Vérifié : `Orders.tsx` n'offre aucune action d'annulation quel que soit le statut.
- Recommandation : bouton « Annuler la commande » visible si `status ∈ {pending, confirmed}`, AlertDialog de confirmation avec **motif obligatoire** (select : « Erreur de commande », « Trop long », « Changement d'avis », « Autre » + texte), enregistrement `cancellationReason` + `cancelledBy: 'customer'` dans `orders.ts`.
- Fichiers : `src/pages/Orders.tsx`, `src/lib/orders.ts` (nouvelle fonction `cancelOrder(orderId, reason, by)` — chemin mock ; contrat VPS documenté), affichage motif : `RestaurantDashboard.tsx`, `AdminDisputes.tsx`.
- P0 · Impact critique · Effort moyen · Risques : course condition si le resto confirme pendant l'annulation (en mock : dernier écrit gagne — acceptable ; à verrouiller côté VPS plus tard).
- CA : commande `pending` → bouton visible → motif requis → statut `cancelled` + motif visible côté resto et admin ; commande `preparing`+ → bouton absent ; stepper client affiche l'état annulé.

**CONF-05 — Statuts non bornés par rôle** *(R-05)*
- Profil : Restaurant (impacts livreur/client) · Route : `/partenaires/dashboard`.
- Vérifié : `RestaurantDashboard.tsx:33` `statusFlow` complet + `nextStatus()` → le resto peut marquer `picked_up`, `delivering`, `delivered`.
- Recommandation : borner l'avancement resto à `ready` (le bouton « Marquer : Récupérée » disparaît ; à partir de `ready`, panneau informatif « En attente du livreur »).
- Fichiers : `src/pages/RestaurantDashboard.tsx` (fonction `nextStatus` + rendu bouton).
- P0 · Impact élevé · Effort faible · Risques : en mock, si aucun livreur ne prend la course, la commande reste `ready` — comportement voulu ; prévoir un libellé explicite.
- CA : commande `ready` côté resto → aucun bouton d'avancement, badge « En attente de livreur » ; le livreur voit toujours la course et peut la clôturer ; l'admin voit des statuts cohérents.

**CONF-06 — Boutons fantômes côté client** *(R-06 partie client)*
- Profil : Client · Route : `/commandes`.
- Vérifié : `Orders.tsx:220-222` — « Support livraison », « Je suis devant », « Partager ma position » = `toast.success` sans effet.
- Recommandation : supprimer les 3 boutons factices ; les remplacer par 2 actions réelles : « 📞 Appeler le livreur » (`tel:` — nécessite d'exposer le téléphone du livreur sur la commande côté mock ; sinon numéro support plateforme depuis `src/data/support.ts`) et « 💬 WhatsApp » (`wa.me/<numéro>` préfixé d'un message : n° de commande + repère).
- Fichiers : `src/pages/Orders.tsx`, `src/data/support.ts` (numéro support), `src/lib/orders.ts` (exposer `driverPhone` si disponible).
- P0 · Impact élevé · Effort faible · Risques : aucun (suppression + liens natifs).
- CA : plus aucun toast sans effet réel dans `/commandes` ; les liens `tel:`/`wa.me` s'ouvrent avec le bon numéro et un message prérempli.

**CONF-07 — Boutons fantômes côté livreur** *(R-06 partie livreur)*
- Profil : Livreur · Route : `/livreurs/dashboard/courses`.
- Vérifié : `DriverDashboard.tsx:380-395` — « Je suis arrivé », « Adresse introuvable », « Merci de descendre » = toasts locaux.
- Recommandation : remplacer par « 💬 WhatsApp client » (`wa.me` du bon interlocuteur — bénéficiaire sinon client — avec message prérempli par bouton) ; garder `tel:` existant.
- Fichiers : `src/pages/DriverDashboard.tsx`.
- P0 · Impact élevé · Effort faible · Risques : numéros stockés avec espaces (`+237 6XX...`) → normaliser pour `wa.me`.
- CA : chaque bouton ouvre WhatsApp avec le message correspondant ; aucun toast « client notifié » sans notification réelle.

**CONF-08 — OTP mock silencieux (production)** *(R-07, reformulé)*
- Profil : Tous · Routes : `/connexion`, `/inscription`.
- Vérifié : `AuthContext.sendOtp/verifyOtp` tombent en mock (tout code accepté) — c'est **le mode de dev voulu** (CLAUDE.md), mais un blocant de mise en production.
- Recommandation : hors périmètre front immédiat ; à tracer comme **pré-requis lancement** : endpoint VPS `/api/auth/otp` (envoi + vérif SMS) branché dans les deux fonctions, mock conservé derrière `VITE_FORCE_MOCK_AUTH`.
- Fichiers (à terme) : `src/contexts/AuthContext.tsx`, serveur VPS.
- P0 (lancement) · Impact critique · Effort moyen (surtout back) · Risques : coût SMS, anti-abus (rate limit côté serveur).
- CA (à terme) : en prod, un code faux est rejeté ; en dev mock, comportement actuel conservé.

**CONF-09 — Fiche restaurant : fallback trompeur + données factices + bouton mort** *(R-21)*
- Profil : Client · Route : `/restaurant/:id`.
- Vérifié : `RestaurantDetail.tsx:61` `fetchedRestaurant ?? restaurants[0]` ; distance « 1,2 km » en dur (l.255) ; « Ouvert jusqu'à » dérivé d'un `split(' - ')` sans logique réelle ; bouton Partager sans handler (l.270).
- Recommandation : ① état chargement → skeleton, ID introuvable → écran « Restaurant introuvable » + lien `/restaurants` ; ② supprimer « 1,2 km » (ou brancher `DistanceBadge` si position client connue) ; ③ n'afficher « Ouvert jusqu'à X » que si `restaurant.isOpen`, sinon badge « Fermé » + désactiver l'ajout au panier ; ④ Partager → Web Share API avec repli copie de lien.
- Fichiers : `src/pages/RestaurantDetail.tsx` (+ `DistanceBadge.tsx` réutilisé).
- P1 · Impact moyen-élevé · Effort faible · Risques : `menuItemsByCategory` lit `restaurant.id` — sécuriser les hooks pendant le chargement (early return après hooks).
- CA : URL avec ID bidon → écran 404 propre ; pendant le chargement → skeleton, jamais un autre restaurant ; resto `isOpen=false` → badge « Fermé », boutons d'ajout désactivés avec tooltip ; Partager copie/partage l'URL réelle.

**CONF-10 — Minimum de commande invisible et non bloquant** *(R-08)*
- Profil : Client · Routes : `/restaurant/:id`, `/checkout`.
- Vérifié : `minOrder` existe sur le modèle (`ProfileTab` resto l'édite, tri « price » l'utilise) mais `Checkout.tsx` ne le lit jamais ; absent aussi du panier fiche resto.
- Recommandation : afficher « Commande minimum : X FCFA » sur la fiche resto (CartContent) ; au checkout, si `totalPrice < minOrder` → bandeau « Ajoutez X FCFA pour atteindre le minimum » + bouton confirmer désactivé.
- Fichiers : `src/pages/RestaurantDetail.tsx` (CartContent), `src/pages/Checkout.tsx`.
- P1 · Impact élevé · Effort faible · Risques : restos mock avec `minOrder=0` → ne rien afficher.
- CA : sous le minimum → CTA désactivé + delta affiché ; au-dessus → comportement normal ; `minOrder=0` → aucun bandeau.

**CONF-11 — Frais de livraison « Gratuit » pendant le chargement** *(R-08 connexe)*
- Profil : Client · Route : `/checkout`.
- Vérifié : `Checkout.tsx:202-204` → `deliveryFee = 0` tant que `cartRestaurant` non chargé, affiché « Gratuit » (l.709).
- Recommandation : tant que le resto n'est pas chargé, afficher un skeleton/« … » sur la ligne Livraison et le total ; désactiver le CTA.
- Fichiers : `src/pages/Checkout.tsx`.
- P1 · Impact moyen · Effort faible · Risques : aucun.
- CA : à l'arrivée sur `/checkout`, jamais « Gratuit » affiché pour un resto payant, même fugitivement.

**CONF-12 — Annulation restaurant sans motif** *(R-09)*
- Profil : Restaurant (impacts client/admin) · Route : `/partenaires/dashboard`.
- Vérifié : `handleCancel` → `updateOrderStatus(order.id, 'cancelled')` sans motif ; l'AlertDialog existant ne demande rien.
- Recommandation : enrichir l'AlertDialog d'un select de motifs (« Ingrédient en rupture », « Trop de commandes », « Fermeture exceptionnelle », « Prix erroné », « Autre » + texte libre) → `cancelOrder(orderId, reason, 'restaurant')` (même API que CONF-04) ; motif affiché au client (stepper/carte) et dans AdminDisputes.
- Fichiers : `src/pages/RestaurantDashboard.tsx`, `src/lib/orders.ts`, `src/pages/Orders.tsx`, `src/pages/admin/AdminDisputes.tsx`.
- P1 · Impact élevé · Effort moyen · Dépend de : CONF-04 (schéma commun `cancellationReason`).
- CA : impossible d'annuler sans motif ; le client voit « Annulée — {motif} » ; l'admin voit motif + auteur.

**CONF-13 — Navigation back-office restaurant dupliquée + toggle Ouvert/Fermé enfoui** *(R-11)*
- Profil : Restaurant · Routes : `/partenaires/dashboard/*`.
- Vérifié : sidebar 4 entrées (`BackOfficeLayout.tsx:29-34`) + tabs internes 5 entrées (`RestaurantDashboard.tsx:308-322`) ; onglet « Livreurs » sans URL ; toggle Ouvert/Fermé uniquement dans l'onglet Profil ; `window.location.reload()` après sauvegarde (l.527).
- Recommandation : ① ajouter `livreurs` à la sidebar + route `/partenaires/dashboard/livreurs` dans `App.tsx` ; ② supprimer la barre de tabs interne (la prop `tab` reste pilotée par la route) ; ③ déplacer le switch Ouvert/Fermé dans la barre du haut du dashboard (visible sur tous les onglets, avec confirmation à la fermeture) ; ④ remplacer `window.location.reload()` par une mise à jour d'état (`onUpdate` remontant le restaurant modifié).
- Fichiers : `src/App.tsx`, `src/components/BackOfficeLayout.tsx`, `src/pages/RestaurantDashboard.tsx`.
- P1 · Impact élevé · Effort moyen · Risques : deep-links existants (`?tab=`) inexistants — rien à migrer ; attention au mode admin (sidebar contextuelle) qui doit hériter de la nouvelle entrée.
- CA : chaque onglet a une URL, F5 conserve l'onglet ; plus de double navigation ; statut modifiable en 1 clic depuis n'importe quel onglet ; sauvegarde profil sans rechargement de page.

**CONF-14 — Variantes/suppléments non créables par le restaurateur** *(R-10)*
- Profil : Restaurant (impact client) · Route : `/partenaires/dashboard/menu`.
- Vérifié : formulaire (`RestaurantDashboard.tsx:1132-1287`) sans champs variantes/suppléments alors que `RestaurantDetail` sait les vendre et que le type `MenuItem` les porte.
- Recommandation : ajouter au formulaire une section « Options » repliable : liste de variantes (nom + surcoût, min 0) et de suppléments (nom + prix) avec ajout/suppression de lignes ; persistance via `createMenuItem`/`updateMenuItem` (le chemin mock stocke déjà l'objet complet).
- Fichiers : `src/pages/RestaurantDashboard.tsx` (MenuTab), `src/lib/catalog.ts` (vérifier passage des champs), types dans `src/data/mockData.ts`.
- P1 · Impact élevé · Effort moyen · Risques : formulaire déjà dense → section repliée par défaut ; valider que `variants[].price` = surcoût (convention actuelle de `customPrice`).
- CA : créer un plat avec 2 variantes + 2 suppléments → visible et commandable côté client avec les bons prix ; édition conserve les options ; plat sans option = formulaire inchangé visuellement.

**CONF-15 — Livreur : rémunération non affichée + position/distances factices + GPS incomplet** *(R-12)*
- Profil : Livreur · Route : `/livreurs/dashboard`.
- Vérifié : cartes « Disponibles » affichent `order.total` (ambigu) et jamais `order.deliveryFee` ; `driverLat/driverLng` en dur (l.234) + `stableOffset()` ; bouton GPS uniquement vers l'adresse client (l.368), jamais vers le restaurant.
- Recommandation : ① afficher en avant « Vous gagnez : {deliveryFee} FCFA » et reléguer le total à « Valeur commande (à encaisser si espèces) » ; ② `navigator.geolocation.watchPosition` (avec permission + repli « position inconnue » sans distance plutôt que fausse) et haversine vers les vraies coordonnées du resto (`getRestaurantCoords`) ; ③ statut `ready` → bouton GPS vers le restaurant, statuts suivants → vers le client.
- Fichiers : `src/pages/DriverDashboard.tsx`, `src/lib/tracking.ts` (coords resto), `src/lib/orders.ts` (exposer lat/lng resto sur la course si absent).
- P1 · Impact élevé · Effort moyen · Risques : permission géoloc refusée → ne **pas** afficher de distance inventée (règle CLAUDE.md « pas de données fictives ») ; batterie (watchPosition seulement quand « En ligne »).
- CA : chaque course affiche la rémunération exacte ; distances réelles ou absentes (jamais inventées) ; GPS pointe le restaurant avant récupération, le client après.

**CONF-16 — Gestion espèces livreur absente** *(R-14)*
- Profil : Livreur · Route : `/livreurs/dashboard/courses`.
- Vérifié : le paiement est badgé (Espèces/MoMo) mais aucun « montant à encaisser » explicite ni récapitulatif de clôture.
- Recommandation : sur les courses actives payées en espèces, encart « 💵 À encaisser : {total} FCFA » ; à la clôture (« Marquer comme livrée »), dialog de confirmation rappelant le montant encaissé (« J'ai encaissé X FCFA » à cocher).
- Fichiers : `src/pages/DriverDashboard.tsx`.
- P1 · Impact élevé · Effort faible · Dépend de : CONF-15 (refonte des cartes de course — même écran, à faire ensemble).
- CA : toute course espèces affiche le montant à encaisser ; clôture espèces → confirmation explicite ; course MoMo → pas d'encart espèces.

**CONF-17 — Preuve de livraison absente** *(R-13)*
- Profil : Livreur (impact client/admin) · Routes : `/livreurs/dashboard/courses`, `/commandes`.
- Vérifié : `markDelivered` clôt sans vérification ; aucun code de confirmation dans le modèle.
- Recommandation : générer un code 4 chiffres à la création de commande (champ `deliveryCode`, visible côté client dans `/commandes` quand `status ∈ {picked_up, delivering}`) ; « Marquer comme livrée » demande la saisie du code (3 essais, repli « client n'a pas son code » → clôture avec drapeau `deliveredWithoutCode` visible admin).
- Fichiers : `src/lib/orders.ts` (génération + vérif mock), `src/pages/Orders.tsx` (affichage code), `src/pages/DriverDashboard.tsx` (saisie), `src/pages/admin/AdminOrders.tsx` (drapeau).
- P1 · Impact élevé · Effort moyen · Risques : friction terrain si client sans data → le code doit être communicable par téléphone (il figure dans le SMS/commande) ; repli obligatoire.
- CA : livraison clôturée avec code exact → normal ; code faux 3× → repli tracé ; le client voit son code dès `picked_up`.

**CONF-18 — Incidents livreur inexistants** *(R-15)*
- Profil : Livreur (impact admin) · Route : `/livreurs/dashboard/courses`.
- Vérifié : aucun mécanisme « client injoignable / adresse introuvable / commande incomplète ».
- Recommandation : bouton « Signaler un problème » sur course active → sheet avec 3 incidents types + note ; enregistrement dans une clé mock `yamo_incidents` (contrat VPS documenté) ; affichage dans AdminDisputes (badge « Incident » + statut).
- Fichiers : `src/pages/DriverDashboard.tsx`, nouveau `src/lib/incidents.ts` (léger, pattern des autres libs), `src/pages/admin/AdminDisputes.tsx`.
- P1 · Impact élevé · Effort moyen · Dépend de : CONF-20 (refonte AdminDisputes — synchroniser les schémas).
- CA : un incident signalé apparaît côté admin en < 30 s (polling) avec type, commande, livreur ; le livreur voit « Incident transmis ».

**CONF-19 — Admin : fiche commande inexistante (lecture seule)** *(R-16)*
- Profil : Admin · Route : `/admin/orders`.
- Vérifié : `AdminOrders.tsx` = tableau sans détail ni action.
- Recommandation : ligne cliquable → sheet/dialog détail (articles, montants, adresse, téléphones, historique de statuts, motif d'annulation, incidents) + actions : **Annuler** (motif, réutilise `cancelOrder`), **Contacter** (tel/wa.me client, resto, livreur). *Réassignation de livreur : différée (nécessite une liste de livreurs en ligne fiable — après CONF-15).* 
- Fichiers : `src/pages/admin/AdminOrders.tsx`, `src/lib/orders.ts`.
- P1 · Impact élevé · Effort moyen-élevé · Dépend de : CONF-04/12 (motifs).
- CA : clic sur une commande → détail complet ; annulation admin motivée visible par client et resto ; aucune action silencieuse.

**CONF-20 — Litiges admin non actionnables** *(R-17)*
- Profil : Admin · Route : `/admin/disputes`.
- Vérifié : `AdminDisputes.tsx` = liste passive des commandes `cancelled`.
- Recommandation : transformer en file de traitement : sections « Annulations » (avec motif/auteur une fois CONF-04/12 livrés) et « Incidents » (CONF-18) ; statut par élément (`open/resolved`) + note de résolution ; compteur « ouverts » dans la sidebar.
- Fichiers : `src/pages/admin/AdminDisputes.tsx`, `src/lib/incidents.ts`, `src/components/BackOfficeLayout.tsx` (badge compteur).
- P1 · Impact élevé · Effort moyen · Dépend de : CONF-04, CONF-12, CONF-18.
- CA : chaque litige a un statut modifiable et une note ; un litige résolu sort de la vue par défaut ; badge sidebar = nombre d'ouverts.

**CONF-21 — Aucune gestion des clients côté admin** *(R-18)*
- Profil : Admin · Route : nouvelle `/admin/customers`.
- Vérifié : aucune route/page ; les clients n'existent qu'implicitement via les commandes.
- Recommandation : page liste (source mock : registre `yamo_local_users` filtré rôle client + agrégats de `yamo_local_orders`) : téléphone, nb commandes, total dépensé, dernière commande, taux d'annulation ; détail → historique ; action **Bloquer/Débloquer** (réutilise le pattern `isSuspended` des livreurs).
- Fichiers : nouveau `src/pages/admin/AdminCustomers.tsx`, `src/App.tsx`, `src/components/BackOfficeLayout.tsx` (entrée sidebar), `src/lib/orders.ts` (agrégats).
- P1 · Impact élevé · Effort moyen · Risques : en mock, clients = ceux du navigateur courant — assumé (documenter) ; côté VPS, endpoint `/api/admin/customers` à contrat documenté.
- CA : recherche par téléphone ; blocage → le client bloqué ne peut plus commander (vérif dans Checkout via profil) ; historique consultable.

**CONF-22 — `window.prompt`/`alert` natifs** *(quick win audit n°11)*
- Profil : Admin, Restaurant · Routes : `/admin/drivers`, `/partenaires/dashboard` (onglet Livreurs).
- Vérifié : `AdminDrivers.tsx:49,64` (`window.prompt`), `RestaurantDashboard.tsx:559` (`alert`). Interdit explicite CLAUDE.md.
- Recommandation : remplacer par `Dialog`/`AlertDialog` shadcn avec textarea motif (pattern déjà présent dans `AdminApplications.tsx:292+` — le copier).
- Fichiers : `src/pages/admin/AdminDrivers.tsx`, `src/pages/RestaurantDashboard.tsx`.
- P1 · Impact moyen · Effort faible · Risques : aucun.
- CA : plus aucun `window.prompt`/`alert` dans `src/` (grep vide) ; parcours suspension/refus inchangés fonctionnellement.

**CONF-23 — Numéro du bénéficiaire exposé avant acceptation** *(E.3 audit)*
- Profil : Livreur (privacy client) · Route : `/livreurs/dashboard`.
- Vérifié : `DriverDashboard.tsx:259-264` affiche `order.recipient.phone` dans la liste « Disponibles ».
- Recommandation : dans « Disponibles », n'afficher que quartier + ville + rémunération ; téléphone et adresse exacte révélés après acceptation (onglet « Courses »).
- Fichiers : `src/pages/DriverDashboard.tsx`.
- P1 · Impact moyen (confiance/RGPD-like) · Effort faible.
- CA : aucune donnée nominative (nom complet, téléphone, adresse précise) visible avant acceptation.

**CONF-24 — Polling 5 s généralisé** *(R-20, reformulé VPS)*
- Profils : tous · Routes : `/commandes`, dashboards resto/livreur, 5 pages admin.
- Vérifié : `setInterval(..., 5000)` dans `Orders.tsx:101`, `DriverDashboard.tsx:67`, `RestaurantDashboard.tsx:170`, `AdminDashboard/Orders/Drivers/Disputes/Applications`. Interdit « < 15 s » dans CLAUDE.md ; Supabase Realtime **interdit**.
- Recommandation : ① créer un hook `usePolling(fetcher, {intervalMs, pauseWhenHidden: true})` (adapter `useRealtime.ts` inutilisé ou le remplacer) ; ② intervalles : 15 s pour les vues opérationnelles temps-réel (commandes resto en attente, courses livreur, suivi client actif), 30-60 s pour l'admin et les historiques ; ③ pause via `document.visibilitychange` ; ④ plus tard : WebSocket VPS (hors périmètre).
- Fichiers : `src/hooks/useRealtime.ts` (refonte → `usePolling`), les 8 pages listées.
- P1 · Impact élevé (3G/batterie) · Effort moyen (mécanique mais 8 fichiers) · Risques : l'alerte sonore resto dépend du polling — garder 15 s là où la réactivité est métier ; `Orders.tsx` : sortir la boucle `hasRestaurantReview` du tick (1 seule requête groupée au chargement).
- CA : aucun `setInterval` < 15000 ms dans `src/` ; onglet masqué → réseau silencieux (vérifiable via DevTools Network) ; nouvelle commande resto toujours signalée en ≤ 15 s.

**CONF-25 — Re-commande 1-clic absente** *(R-23)*
- Profil : Client · Route : `/commandes`.
- Vérifié : aucun bouton sur les commandes livrées.
- Recommandation : bouton « Commander à nouveau » sur `status='delivered'` → recharge les items dans le panier (via `addToCart`/`replaceCartWith` ; gérer le conflit inter-resto avec le dialog existant), toast + redirection fiche resto ou checkout ; ignorer les items devenus indisponibles avec message.
- Fichiers : `src/pages/Orders.tsx`, `src/contexts/CartContext.tsx` (helper `loadItems`), `src/lib/catalog.ts` (revérifier dispo).
- P2 · Impact élevé · Effort faible · Dépend de : CONF-01, CONF-02 (structure panier stabilisée d'abord).
- CA : re-commande d'une commande livrée → panier identique (moins les indisponibles, signalés) ; conflit panier géré par le dialog existant.

**CONF-26 — Avis anonymes « Client MiamExpress »** *(R-31)*
- Profil : Client · Route : `/restaurant/:id`.
- Vérifié : `RestaurantDetail.tsx:535` libellé fixe.
- Recommandation : stocker un `authorName` au moment de la notation (prénom + initiale depuis `yamo_profile_name`, repli « Client vérifié ») + badge « Commande vérifiée » (tous les avis passent par une commande livrée — déjà garanti par le flux).
- Fichiers : `src/lib/catalog.ts` (rateRestaurant → authorName), `src/pages/Orders.tsx` (passage du nom), `src/pages/RestaurantDetail.tsx` (affichage).
- P2 · Impact moyen · Effort faible.
- CA : nouvel avis → « Marie N. · Commande vérifiée » ; anciens avis sans nom → « Client vérifié ».

**CONF-27 — Livreurs préférés inutilisables (ajout par ID)** *(R-32)*
- Profil : Restaurant · Route : `/partenaires/dashboard/livreurs`.
- Vérifié : `PreferredDriversTab` (`RestaurantDashboard.tsx:596-603`) : input texte « ID du livreur... ».
- Recommandation : remplacer l'input par la liste des livreurs des dernières commandes livrées du resto (driverId + note moyenne via `fetchDriversStats`) avec bouton « Ajouter aux préférés » ; supprimer la saisie d'ID.
- Fichiers : `src/pages/RestaurantDashboard.tsx`, `src/lib/drivers.ts` (helper `getRecentDriversForRestaurant`).
- P2 · Impact moyen · Effort faible · Dépend de : CONF-13 (l'onglet devient une route).
- CA : plus de champ ID ; les livreurs récents sont listés avec téléphone masqué et note ; ajout/retrait en 1 clic.

**CONF-28 — Onboarding première visite absent** *(R-25, DOC-UX P1-01)*
- Profil : Client · Route : `/` (overlay).
- Vérifié : aucun flag première visite ; la clé `yamo_onboarding_completed` est **déjà réservée** dans CLAUDE.md.
- Recommandation : overlay 3 slides (valeur, choix de ville — préremplit le filtre `/restaurants?ville=`, compte optionnel « Plus tard ») au premier lancement uniquement ; skippable ; aucune nouvelle lib (dialog + état).
- Fichiers : nouveau `src/components/OnboardingOverlay.tsx`, `src/App.tsx` ou `Layout.tsx`, clé `yamo_onboarding_completed`.
- P2 · Impact moyen · Effort faible-moyen · Risques : ne jamais bloquer un utilisateur récurrent (flag localStorage robuste).
- CA : 1ʳᵉ visite → 3 slides swipeables, skippables ; visites suivantes → rien ; ville choisie appliquée à la recherche.

**CONF-29 — Indicateur réseau absent** *(R-26, DOC-UX P2-06)*
- Profils : tous · global.
- Recommandation : composant `NetworkBanner` (écoute `online`/`offline`) affichant une bannière fixe discrète « Hors connexion — vos actions seront indisponibles » ; monté dans `Layout` et `BackOfficeLayout`.
- Fichiers : nouveau `src/components/NetworkBanner.tsx`, `Layout.tsx`, `BackOfficeLayout.tsx`.
- P2 · Impact moyen · Effort faible.
- CA : coupure réseau (DevTools offline) → bannière ≤ 2 s ; retour → disparition + toast « Connexion rétablie ».

**CONF-30 — Mode économie de données + reduced-motion** *(R-27, DOC-UX P2-07)*
- Profil : Client (bénéficie à tous) · Route : `/profil` (toggle) + global.
- Recommandation : toggle « Économie de données » (clé `yamo_data_saver`) : images `loading="lazy"` systématique + placeholder au lieu du chargement auto dans les listes longues, désactivation des animations framer-motion (prop globale via context léger ou classe CSS) ; respecter aussi `prefers-reduced-motion`.
- Fichiers : `src/pages/Profile.tsx`, `src/components/AppImage.tsx`, `src/index.css` (media query), pages à motion (Home, Restaurants, RestaurantDetail — changements minimes via un helper).
- P2 · Impact moyen · Effort moyen · Risques : ne pas casser les transitions structurelles (drawer panier) — ne désactiver que les animations décoratives.
- CA : toggle ON → aucune animation décorative, images différées ; `prefers-reduced-motion` respecté même sans toggle.

**CONF-31 — Accessibilité : contraste + clavier** *(R-29, DOC-UX P2-03)*
- Profils : tous.
- Vérifié : `text-muted #9CA3AF` sur fonds clairs < 4.5:1 ; pills/filtres (`Restaurants.tsx`, quickFilters) et cartes cliquables sans focus visible ni rôle.
- Recommandation : ① foncer `text-muted` vers `#6B7280` dans `tailwind.config.js` (audit visuel rapide des écrans denses après changement) ; ② pills/filtres → `<button>` réels (c'est déjà le cas pour la plupart — compléter les `div role=button` de la galerie), focus-visible stylé global dans `index.css` ; ③ `aria-label` sur les boutons icône (panier, fav, partager).
- Fichiers : `tailwind.config.js`, `src/index.css`, retouches ciblées (`RestaurantDetail.tsx` galerie, `Restaurants.tsx`).
- P2 · Impact moyen · Effort moyen · Risques : le changement de token est global — vérifier les 4 profils visuellement.
- CA : ratio ≥ 4.5:1 sur textes normaux ; parcours clavier complet sur la recherche et la fiche resto ; focus visible.

**CONF-32 — Confort livreur : dark mode + alerte sonore course** *(R-30, DOC-UX P2-05)*
- Profil : Livreur · Route : `/livreurs/dashboard`.
- Vérifié : `darkMode: ["class"]` configuré, `next-themes` installé mais non branché ; le resto a un bip (`playNewOrderSound`), pas le livreur.
- Recommandation : ① bip nouvelle course : réutiliser le pattern `knownOrderIdsRef` + WebAudio du resto dans `DriverDashboard` (toggle son, clé `yamo_driver_sound`) ; ② dark mode : ThemeProvider `next-themes` limité au **BackOfficeLayout** (toggle dans la topbar) — pas le site client dans ce lot (portée maîtrisée).
- Fichiers : `src/pages/DriverDashboard.tsx`, `src/components/BackOfficeLayout.tsx`, `src/main.tsx` (provider), `src/index.css` (variables dark des tokens back-office).
- P2 · Impact moyen · Effort moyen · Risques : shadcn/Tailwind dark → vérifier chaque écran back-office ; ne pas laisser un dark partiel (critère strict).
- CA : nouvelle course dispo → bip (si activé) ; toggle dark → tous les écrans back-office lisibles, aucun texte invisible.

**CONF-33 — Recherche dupliquée `/restaurants` vs `/explorer`** *(R-24, DOC-UX P2-02)*
- Profil : Client · Routes : `/restaurants`, `/explorer`.
- Vérifié : deux pages, deux systèmes de filtres étanches (quickFilters vs tags diététiques) ; dette connue CLAUDE.md.
- Recommandation : conserver **`/restaurants` comme page unique** avec un toggle « Restaurants / Plats » (le mode Plats réutilise la logique d'`ExplorerMet` : `buildEnrichedItems`, tags) ; `/explorer` devient une redirection (deep-links préservés) ; MobileBottomNav « Recherche » → libellé « Explorer ».
- Fichiers : `src/pages/Restaurants.tsx`, `src/pages/ExplorerMet.tsx` (extraction de la vue plats), `src/App.tsx` (redirect), `src/components/MobileBottomNav.tsx`, `src/components/Navbar.tsx` (mega-menu).
- P2 · Impact moyen-élevé · Effort élevé · Risques : régression filtres/URL-sync — tester les deep-links `?q=&category=&ville=&quartier=` ; gros composant → extraire la vue plats en sous-composant.
- CA : une seule page de recherche ; `/explorer` redirige en conservant les params ; les deux modes partagent ville/quartier/recherche texte.

**CONF-34 — Tracking client simulé** *(R-33 / audit #5 partie carte)*
- Profil : Client · Route : `/commandes`.
- Vérifié : `simulateDriverPosition` (position interpolée fixe).
- Recommandation court terme (dans le périmètre) : étiqueter la carte « Position estimée » (badge sur `LazyDeliveryMap` via prop) et ne l'afficher que si des coordonnées réelles existent pour resto+client ; recommandation cible : positions livreur réelles via VPS (WebSocket/endpoint position) — **backend requis, hors lots front** (contrat documenté : `POST /api/driver/position`, `GET /api/orders/:id/driver-position`).
- Fichiers (court terme) : `src/pages/Orders.tsx`, `src/components/DeliveryMap.tsx` (prop `estimated`).
- P2 (court) / P1 cible · Effort faible (court) · Risques : aucun.
- CA (court terme) : plus aucune carte présentée comme temps réel sans mention « estimée ».

**CONF-35 — Carte de supervision admin factice** *(audit E.4)*
- Profil : Admin · Route : `/admin/dashboard`.
- Vérifié : `AdminDashboard.tsx:184-187` positions inventées (`4.04 + i*0.006`, « Livreur dispo 1/2 »).
- Recommandation : supprimer la carte tant qu'aucune donnée de position réelle n'existe (règle CLAUDE.md « pas de données fictives ») ; la remplacer par un bloc « Commandes actives par statut » cliquable vers `/admin/orders?status=`.
- Fichiers : `src/pages/admin/AdminDashboard.tsx`.
- P1 · Impact moyen (confiance interne) · Effort faible.
- CA : plus aucune donnée inventée sur le dashboard admin.

**CONF-36 — Horaires resto en texte libre + « Ouvert jusqu'à » non fiable** *(R-22)*
- Profil : Restaurant (impact client) · Routes : `/partenaires/dashboard/profile`, `/restaurant/:id`.
- Vérifié : `ProfileTab` : `hours` et `deliveryTime` en `<input type="text">` ; côté client `hours.split(' - ')[1]`.
- Recommandation : champs structurés (heure ouverture / heure fermeture, `<input type="time">` ×2 ; multi-créneaux différé) ; `deliveryTime` → select de fourchettes (« 20-30 min », « 30-45 min »…) ; côté client, calculer réellement ouvert/fermé à partir de ces heures + `isOpen` (le toggle reste un override manuel « fermeture exceptionnelle »).
- Fichiers : `src/pages/RestaurantDashboard.tsx` (ProfileTab), `src/data/mockData.ts` (format), `src/lib/catalog.ts`, `src/pages/RestaurantDetail.tsx`, `src/pages/Restaurants.tsx` (filtre « Ouvert maintenant »).
- P2 · Impact moyen · Effort moyen · Risques : migration du format `hours` existant (parser l'ancien format `"08:00 - 22:00"` en douceur).
- CA : plus de texte libre ; badge Ouvert/Fermé client = heures réelles ET override ; ancien format toléré en lecture.

**CONF-37 — Images plats en base64** *(R-28)*
- Profils : Restaurant, Admin · Routes : `/partenaires/dashboard/menu`, `/admin/media`, candidatures.
- Vérifié : `handleFileChange` → `readAsDataURL` (dette CLAUDE.md « pas de base64 comme solution finale ») ; l'API média VPS existe (`/api/media`, `AdminMedia.tsx` l'utilise déjà).
- Recommandation : formulaire menu resto → upload vers `/api/media` (réutiliser le client d'upload d'AdminMedia) + compression canvas (max 1280 px, JPEG q0.7) avant envoi ; repli base64 conservé en mode mock sans VPS.
- Fichiers : `src/pages/RestaurantDashboard.tsx`, extraction d'un helper `src/lib/media.ts` depuis `AdminMedia.tsx`, `src/components/ApplicationForm.tsx` (même pattern, 2ᵉ temps).
- P2 · Impact élevé (poids data) · Effort moyen · Dépend de : disponibilité VPS en dev (sinon repli mock).
- CA : en mode VPS, un plat créé stocke une URL `/uploads/...` ; image compressée ≤ 300 Ko ; en mock, comportement actuel.

### C.2 Recommandations écartées, différées ou déjà couvertes (avec justification)

| Réf audit | Verdict | Justification |
|---|---|---|
| R-19 (CRUD codes promo admin) | **Différé — backend requis** | Les promos ne sont validées que par l'ancienne Edge Function morte ; sans endpoint VPS promo, un CRUD front serait une coquille vide (interdit CLAUDE.md « fonctionnalité factice »). À faire avec CONF-03 côté serveur. Le champ code promo du checkout reste, avec mention « vérifié à la confirmation ». |
| R-34 (PWA/service worker), R-35 (i18n EN), R-36 (fidélité), R-37 (livraison programmée), R-38 (paramètres/exports admin) | **P3 backlog — pas de lot** | Conformes à l'audit (phase 4) ; aucun n'est requis pour une expérience professionnelle ; les planifier maintenant violerait « pas de refonte globale ». |
| DOC-UX P1-02 (inverser le flux d'adresse : carte d'abord + reverse geocoding) | **Écarté en l'état** | Le flux actuel quartier→carte est déjà performant et le reverse geocoding exigerait un service externe (Nominatim : limites d'usage, précision faible sur les quartiers de Douala/Yaoundé). Gain incertain vs risque de dégrader le meilleur écran de l'app. Réévaluer avec de vraies données d'usage. |
| DOC-UX P2-09 (filtres candidatures admin) | **Déjà implémenté** | `AdminApplications.tsx` : onglets par statut + recherche (vérifié). |
| Audit « écran de confirmation manquant » (hérité DOC-UX) | **Déjà implémenté** | `Checkout.tsx:325-352`. Amélioration mineure possible (ETA) intégrée à LOT-03. |
| R-20 via « Supabase Realtime » | **Reformulé** | Supabase interdit → CONF-24 (polling ≥ 15/30 s + pause onglet caché), WebSocket VPS ultérieur. |

---

## D. Lots d'implémentation

> Chaque lot : implémentable, testable (build + parcours manuel), vérifiable visuellement (360×640 + desktop), livrable seul. Aucun lot ne touche les 4 profils à la fois (LOT-11 touche des fichiers transverses mais un seul comportement).

---

### LOT-01 — Fiabilité du panier
- **Objectif** : le panier survit au refresh et calcule juste avec les personnalisations.
- **Profil** : Client · **Routes** : toutes (contexte global), `/restaurant/:id`, `/checkout`.
- **Fichiers** : `src/contexts/CartContext.tsx`, `src/pages/RestaurantDetail.tsx`, `src/pages/Checkout.tsx` (envoi `baseItemId`), CLAUDE.md (clé `yamo_cart`).
- **Composants** : CartContent, MenuRow, popover panier Navbar (lecture seule — vérifier compat).
- **Tâches** : CONF-01 (persistance + TTL), CONF-02 (id composite + `baseItemId`).
- **Exclu** : minimum de commande (LOT-03), re-commande (LOT-09).
- **Dépendances** : aucune. **Risques** : compteurs de quantité par plat sur la fiche resto (agrégation par `baseItemId`).
- **Données de test** : compte client seed, resto avec plat à variantes (mock `mockData.ts` en contient).
- **CA fonctionnels** : cf. CONF-01/02. **CA visuels** : badges quantité corrects sur MenuRow après personnalisation ; popover panier liste les libellés complets tronqués proprement.
- **Tests** : `npm run build` ; parcours ajout→personnalisation→refresh→checkout en mobile 360×640 et desktop ; lint sans nouvelle erreur sur les 3 fichiers.
- **Résolutions** : 360×640, 768, 1280.

### LOT-02 — Suppression des fonctionnalités fantômes client + fiche resto fiable
- **Objectif** : plus rien de simulé côté client ; fiche restaurant honnête.
- **Profil** : Client · **Routes** : `/commandes`, `/restaurant/:id`.
- **Fichiers** : `src/pages/Orders.tsx`, `src/pages/RestaurantDetail.tsx`, `src/data/support.ts`, `src/components/DeliveryMap.tsx` (prop `estimated`).
- **Tâches** : CONF-06 (boutons fantômes → tel/wa.me), CONF-09 (fallback `restaurants[0]`, distance en dur, badge Fermé, Partager réel), CONF-34 court terme (badge « position estimée »), message de conflit panier nominatif (nommer les 2 restos dans le dialog — DOC-UX P1-08).
- **Exclu** : boutons fantômes livreur (LOT-06), tracking réel (backend).
- **Dépendances** : aucune. **Risques** : early-return hooks dans RestaurantDetail (ordre des hooks à préserver).
- **Données de test** : commande en statut `delivering` (créer via resto+livreur seed) ; URL `/restaurant/inexistant`.
- **CA fonctionnels** : cf. CONF-06/09/34. **CA visuels** : skeleton fiche resto sans flash d'un autre resto ; badge « Fermé » visible ; carte marquée « estimée ».
- **Tests** : build ; grep `toast.success('Le support` vide ; parcours suivi de commande mobile.
- **Résolutions** : 360×640, 1280.

### LOT-03 — Checkout durci
- **Objectif** : transparence tarifaire et intégrité des montants.
- **Profil** : Client · **Route** : `/checkout` (+ fiche resto pour l'affichage minimum).
- **Fichiers** : `src/pages/Checkout.tsx`, `src/pages/RestaurantDetail.tsx` (CartContent), `src/lib/payments.ts` (refactor `/api/orders/validate` + suppression refs Supabase env).
- **Tâches** : CONF-10 (minimum de commande affiché/bloquant), CONF-11 (fee en chargement), CONF-03 partie front (validation VPS bloquante en mode VPS, fallback mock), + afficher l'ETA sur l'écran de confirmation (existant).
- **Exclu** : implémentation de l'endpoint VPS (backend, contrat en annexe du lot), codes promo admin (différé).
- **Dépendances** : LOT-01 (baseItemId envoyé au serveur). **Risques** : ne pas casser le mode mock (chemin par défaut actuel).
- **Données de test** : resto avec `minOrder > 0` (en créer un via ProfileTab si absent du mock).
- **CA fonctionnels** : cf. CONF-03/10/11. **CA visuels** : bandeau minimum sous le récap, CTA désactivé stylé, ligne Livraison avec skeleton.
- **Tests** : build ; commande sous/au-dessus du minimum ; simulation endpoint down (mode VPS) → blocage propre.
- **Résolutions** : 360×640, 1280.

### LOT-04 — Annulation de commande (client + restaurant + affichages)
- **Objectif** : boucle d'annulation complète et motivée.
- **Profils** : Client + Restaurant (même schéma de données — indissociables).
- **Routes** : `/commandes`, `/partenaires/dashboard`, `/admin/disputes` (affichage seul).
- **Fichiers** : `src/lib/orders.ts` (`cancelOrder(orderId, reason, by)`), `src/pages/Orders.tsx`, `src/pages/RestaurantDashboard.tsx`, `src/pages/admin/AdminDisputes.tsx` (affichage motif/auteur).
- **Tâches** : CONF-04, CONF-12.
- **Exclu** : workflow litiges complet (LOT-08), remboursements (backend).
- **Dépendances** : aucune. **Risques** : cycle inter-profils via `yamo_local_orders` → tester les 3 vues après chaque annulation.
- **Données de test** : commandes aux statuts `pending`, `confirmed`, `preparing`.
- **CA fonctionnels** : cf. CONF-04/12. **CA visuels** : dialog motif cohérent avec AlertDialog existants ; motif visible dans la carte commande client (zone rouge douce).
- **Tests** : build ; matrice statut×acteur (client pending ✔, client preparing ✖, resto tous statuts actifs ✔ avec motif).
- **Résolutions** : 360×640, 1280.

### LOT-05 — Statuts bornés + prompts natifs éliminés
- **Objectif** : intégrité du cycle de vie + conformité dialogs.
- **Profils** : Restaurant + Admin (2 retouches indépendantes, petites).
- **Routes** : `/partenaires/dashboard`, `/admin/drivers`.
- **Fichiers** : `src/pages/RestaurantDashboard.tsx` (`nextStatus` borné, `alert()` → toast/dialog), `src/pages/admin/AdminDrivers.tsx` (prompt → Dialog motif).
- **Tâches** : CONF-05, CONF-22.
- **Dépendances** : LOT-04 (pattern de dialog motif réutilisé). **Risques** : faibles.
- **CA** : cf. CONF-05/22 ; grep `window.prompt|alert(` vide dans `src/`.
- **Tests** : build ; cycle complet commande resto→livreur→livrée en 2 onglets.
- **Résolutions** : 1280 (back-office desktop) + 360×640.

### LOT-06 — Livreur : données de décision réelles + espèces + privacy
- **Objectif** : le livreur décide et encaisse sur des informations vraies.
- **Profil** : Livreur.
- **Routes** : `/livreurs/dashboard`, `/livreurs/dashboard/courses`.
- **Fichiers** : `src/pages/DriverDashboard.tsx`, `src/lib/tracking.ts`, `src/lib/orders.ts` (coords resto sur la course).
- **Tâches** : CONF-15 (rémunération, géoloc réelle, GPS resto/client), CONF-16 (espèces), CONF-23 (privacy avant acceptation), CONF-07 (boutons fantômes → WhatsApp), bip nouvelle course (partie de CONF-32).
- **Exclu** : preuve de livraison (LOT-07), dark mode (LOT-12).
- **Dépendances** : aucune. **Risques** : permission géoloc refusée (afficher « distance inconnue », jamais de valeur inventée) ; watchPosition seulement si « En ligne ».
- **Données de test** : compte livreur seed, 2 commandes `ready` dans des quartiers différents.
- **CA fonctionnels** : cf. CONF-15/16/23/07. **CA visuels** : hiérarchie carte course : rémunération > destination > valeur commande ; encart espèces distinct (fond doré).
- **Tests** : build ; géoloc accordée/refusée ; course espèces vs MoMo.
- **Résolutions** : 360×640 prioritaire (usage terrain), 768.

### LOT-07 — Preuve de livraison + incidents livreur
- **Objectif** : clôture de course vérifiable et incidents tracés.
- **Profils** : Livreur + Client (affichage code) + Admin (lecture incidents).
- **Routes** : `/livreurs/dashboard/courses`, `/commandes`, `/admin/disputes`.
- **Fichiers** : `src/lib/orders.ts` (deliveryCode), nouveau `src/lib/incidents.ts` (+ clé `yamo_incidents` à documenter dans CLAUDE.md), `src/pages/DriverDashboard.tsx`, `src/pages/Orders.tsx`, `src/pages/admin/AdminDisputes.tsx`.
- **Tâches** : CONF-17, CONF-18.
- **Dépendances** : LOT-06 (mêmes écrans livreur — enchaîner). **Risques** : friction terrain → repli « sans code » obligatoire et tracé.
- **Données de test** : commande complète jusqu'à `delivering` sur 2 profils.
- **CA fonctionnels** : cf. CONF-17/18. **CA visuels** : code client bien visible (gros chiffres) ; saisie code livreur clavier numérique (`inputmode="numeric"`).
- **Tests** : build ; code bon/faux×3/repli ; incident visible admin.
- **Résolutions** : 360×640.

### LOT-08 — Admin opérationnel : fiche commande, litiges, supervision honnête
- **Objectif** : l'admin peut agir, plus seulement regarder.
- **Profil** : Admin.
- **Routes** : `/admin/orders`, `/admin/disputes`, `/admin/dashboard`.
- **Fichiers** : `src/pages/admin/AdminOrders.tsx`, `src/pages/admin/AdminDisputes.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/lib/orders.ts`, `src/lib/incidents.ts`, `src/components/BackOfficeLayout.tsx` (badge litiges ouverts).
- **Tâches** : CONF-19 (fiche commande + annuler/contacter), CONF-20 (litiges actionnables), CONF-35 (retrait carte factice → bloc statuts cliquable).
- **Exclu** : réassignation livreur (différée), page Clients (LOT-10), remboursements (backend).
- **Dépendances** : LOT-04 (motifs), LOT-07 (incidents). **Risques** : sheet détail = nouveau pattern admin — réutiliser `Sheet` shadcn existant.
- **CA fonctionnels** : cf. CONF-19/20/35. **CA visuels** : filtre statut prérempli via `?status=` depuis le dashboard.
- **Tests** : build ; annulation admin visible client+resto ; litige ouvert→résolu ; badge sidebar exact.
- **Résolutions** : 1280 prioritaire, 360×640 fonctionnel.

### LOT-09 — Conversion client : re-commande + avis nominatifs
- **Objectif** : fréquence d'achat et preuve sociale.
- **Profil** : Client.
- **Routes** : `/commandes`, `/restaurant/:id`.
- **Fichiers** : `src/pages/Orders.tsx`, `src/contexts/CartContext.tsx` (helper), `src/lib/catalog.ts` (authorName + revérif dispo), `src/pages/RestaurantDetail.tsx`.
- **Tâches** : CONF-25, CONF-26.
- **Dépendances** : LOT-01 (structure panier). **Risques** : items renommés/supprimés depuis la commande → matcher par `baseItemId` puis nom, signaler les manquants.
- **CA** : cf. CONF-25/26.
- **Tests** : build ; re-commande avec item devenu indisponible ; nouvel avis nominatif.
- **Résolutions** : 360×640, 1280.

### LOT-10 — Restaurant : navigation unifiée + statut en 1 clic + livreurs préférés utilisables
- **Objectif** : back-office restaurant simple et sans doublon.
- **Profil** : Restaurant.
- **Routes** : `/partenaires/dashboard/*` (+ nouvelle `/partenaires/dashboard/livreurs`).
- **Fichiers** : `src/App.tsx`, `src/components/BackOfficeLayout.tsx`, `src/pages/RestaurantDashboard.tsx`, `src/lib/drivers.ts`.
- **Tâches** : CONF-13 (sidebar unique, route livreurs, toggle header, suppression reload), CONF-27 (livreurs récents au lieu d'ID).
- **Dépendances** : LOT-05 (fichier commun — rebaser). **Risques** : sidebar contextuelle admin (vérifier le rôle admin sur `/partenaires/dashboard`).
- **CA fonctionnels** : cf. CONF-13/27. **CA visuels** : plus de double barre d'onglets ; switch statut dans le header avec confirmation à la fermeture.
- **Tests** : build ; navigation par URL directe sur les 5 routes ; F5 sur chaque onglet ; test en rôle admin.
- **Résolutions** : 360×640, 1280.

### LOT-11 — Polling raisonné (transversal mécanique)
- **Objectif** : conformité CLAUDE.md (≥ 15 s) et sobriété 3G/batterie.
- **Profils** : fichiers de plusieurs profils mais **un seul comportement** (remplacement mécanique).
- **Routes** : `/commandes`, dashboards resto/livreur, pages admin.
- **Fichiers** : `src/hooks/useRealtime.ts` → `usePolling` (renommage/refonte), `Orders.tsx`, `DriverDashboard.tsx`, `RestaurantDashboard.tsx`, `AdminDashboard.tsx`, `AdminOrders.tsx`, `AdminDrivers.tsx`, `AdminDisputes.tsx`, `AdminApplications.tsx`.
- **Tâches** : CONF-24 (15 s opérationnel / 30-60 s admin, pause `visibilitychange`, fix N+1 `hasRestaurantReview`).
- **Dépendances** : à faire **après** les lots qui réécrivent ces écrans (06, 07, 08) pour éviter les conflits. **Risques** : réactivité perçue resto — garder 15 s sur les commandes en attente.
- **CA** : cf. CONF-24. **Tests** : build ; DevTools Network onglet caché → silence ; nouvelle commande détectée ≤ 15 s.
- **Résolutions** : n/a (comportement).

### LOT-12 — Confort & accessibilité transverses
- **Objectif** : lisibilité, clavier, réseau, données, nuit.
- **Profils** : Client (28-30) + Livreur (dark mode) — scindable en 12a/12b si besoin.
- **Fichiers** : `tailwind.config.js`, `src/index.css`, nouveaux `NetworkBanner.tsx` + `OnboardingOverlay.tsx`, `Layout.tsx`, `BackOfficeLayout.tsx`, `AppImage.tsx`, `Profile.tsx`, `main.tsx`, retouches galerie/pills.
- **Tâches** : CONF-28 (onboarding), CONF-29 (réseau), CONF-30 (data-saver + reduced-motion), CONF-31 (contraste + clavier), CONF-32 partie dark mode back-office.
- **Dépendances** : aucune dure. **Risques** : token `text-muted` global → revue visuelle 4 profils ; dark mode strictement limité au back-office.
- **CA** : cf. CONF-28→32. **Tests** : build ; Lighthouse a11y avant/après sur `/restaurants` ; visite 1ʳᵉ/2ᵉ ; DevTools offline.
- **Résolutions** : 360×640, 768, 1280 + dark.

### LOT-13 — Recherche unifiée
- **Objectif** : une seule porte d'entrée découverte.
- **Profil** : Client.
- **Routes** : `/restaurants` (unifiée), `/explorer` (redirect).
- **Fichiers** : `Restaurants.tsx`, `ExplorerMet.tsx` (extraction), `App.tsx`, `MobileBottomNav.tsx`, `Navbar.tsx`.
- **Tâches** : CONF-33.
- **Dépendances** : après LOT-12 (tokens stabilisés). **Risques** : le plus gros lot UI — deep-links à tester exhaustivement.
- **CA** : cf. CONF-33. **Tests** : build ; matrice de deep-links ; les 2 modes en mobile.
- **Résolutions** : 360×640, 768, 1280.

### LOT-14 — Horaires structurés + pipeline images
- **Objectif** : données resto exploitables et légères.
- **Profil** : Restaurant (impact lecture client).
- **Fichiers** : `RestaurantDashboard.tsx` (ProfileTab + MenuTab upload), `src/lib/media.ts` (nouveau, extrait d'AdminMedia), `mockData.ts`, `catalog.ts`, `RestaurantDetail.tsx`, `Restaurants.tsx`.
- **Tâches** : CONF-36 (horaires), CONF-37 (upload /api/media + compression), CONF-14 si non déjà livré (sinon exclu).
- **Dépendances** : LOT-10 (mêmes fichiers) ; VPS dispo pour tester l'upload (sinon repli mock documenté). **Risques** : migration format `hours`.
- **CA** : cf. CONF-36/37. **Tests** : build ; ancien format lu sans crash ; upload réel sur VPS de dev/prod.
- **Résolutions** : 360×640, 1280.

### LOT-15 — Menu : variantes & suppléments (peut précéder LOT-14)
- **Objectif** : upsell réel pour les partenaires.
- **Profil** : Restaurant (impact client).
- **Fichiers** : `RestaurantDashboard.tsx` (MenuTab form), `catalog.ts`, `mockData.ts` (types).
- **Tâches** : CONF-14.
- **Dépendances** : LOT-01 (id composite côté client déjà en place). **Risques** : densité formulaire → section repliable.
- **CA** : cf. CONF-14. **Tests** : build ; création/édition/commande bout en bout.
- **Résolutions** : 360×640, 1280.

### LOT-16 — Admin : page Clients
- **Objectif** : gestion et protection de la base clients.
- **Profil** : Admin.
- **Fichiers** : nouveau `src/pages/admin/AdminCustomers.tsx`, `App.tsx`, `BackOfficeLayout.tsx`, `orders.ts`.
- **Tâches** : CONF-21.
- **Dépendances** : LOT-08 (patterns fiche/actions). **Risques** : périmètre mock limité au navigateur (documenter à l'écran).
- **CA** : cf. CONF-21. **Tests** : build ; blocage → tentative de commande refusée avec message.
- **Résolutions** : 1280, 360×640.

**Hors lots (pré-requis lancement, backend)** : CONF-08 (OTP SMS VPS), CONF-03 partie serveur (`/api/orders/validate`), paiement MoMo réel VPS, positions livreur réelles (CONF-34 cible), R-19 (promos). À planifier côté `app/server/`.

---

## E. Ordre recommandé

| Rang | Lot | Famille | Pourquoi ici |
|---|---|---|---|
| 1 | **LOT-01** Fiabilité panier | Fondations | Bug de montants + abandon ; tout le parcours client s'appuie dessus |
| 2 | **LOT-02** Fantômes client + fiche resto | Parcours client (Restaurant→Suivi) | Supprime les mensonges produit au plus tôt ; indépendant |
| 3 | **LOT-03** Checkout durci | Parcours client (Panier→Paiement→Confirmation) | Ferme la verticale Accueil→…→Confirmation avec 01/02 |
| 4 | **LOT-04** Annulation | Parcours client/resto | Débloque motifs pour litiges et admin |
| 5 | **LOT-05** Statuts bornés + dialogs | Restaurant/Admin | Petit, sécurise le cycle avant les lots livreur |
| 6 | **LOT-06** Livreur données réelles | Livreur | Cœur opérationnel terrain |
| 7 | **LOT-07** Preuve + incidents | Livreur | Enchaîne sur les mêmes écrans |
| 8 | **LOT-08** Admin opérationnel | Admin | Consomme motifs (04/05) et incidents (07) |
| 9 | **LOT-10** Navigation resto unifiée | Restaurant | Après stabilisation du dashboard (04/05) |
| 10 | **LOT-15** Variantes/suppléments | Restaurant | Après LOT-01 (ids) ; forte valeur partenaire |
| 11 | **LOT-11** Polling raisonné | Transversal | Après réécriture des écrans concernés |
| 12 | **LOT-09** Re-commande + avis | Conversion | Rapide, s'appuie sur 01 |
| 13 | **LOT-12** Confort & a11y | Transversal | Tokens + onboarding + réseau + dark |
| 14 | **LOT-13** Recherche unifiée | Client (Recherche) | Gros lot UI, après stabilisation |
| 15 | **LOT-14** Horaires + images | Restaurant | Dépend VPS pour l'upload |
| 16 | **LOT-16** Page Clients admin | Admin | Patterns admin consolidés |

La verticale client demandée (Accueil→Recherche→Restaurant→Plat→Personnalisation→Panier→Adresse→Paiement→Confirmation→Suivi) est couverte dans l'ordre par LOT-01 (Personnalisation/Panier), LOT-02 (Restaurant/Suivi), LOT-03 (Adresse/Paiement/Confirmation), puis LOT-13 (Recherche) — la Recherche vient en dernier car c'est le seul maillon déjà fonctionnel dont la refonte est risquée.

---

## F. Matrice de traçabilité

| Recommandation audit | Problème confirmé | Lot | Critère d'acceptation clé | Statut |
|---|---|---|---|---|
| R-01 Panier persistant | CONF-01 | LOT-01 | F5 → panier intact, TTL 24 h | **Fait** (16/07/2026) |
| R-02 Blocage validation serveur | CONF-03 | LOT-03 (+ backend) | Mode VPS + endpoint down → commande bloquée | **Fait côté front** (16/07/2026 — flag `VITE_USE_VPS_API`, contrat `/api/orders/validate` documenté dans `payments.ts` ; endpoint serveur à implémenter) |
| R-03 Id composite personnalisation | CONF-02 | LOT-01 | 2 personnalisations = 2 lignes aux bons prix | **Fait** (16/07/2026) |
| R-04 Annulation client | CONF-04 | LOT-04 | Annulable si pending/confirmed, motif obligatoire | À faire |
| R-05 Statuts bornés | CONF-05 | LOT-05 | Resto bloqué à `ready` | À faire |
| R-06 Fantômes + liens réels | CONF-06, CONF-07, CONF-34 | LOT-02, LOT-06 | Zéro toast sans effet ; tel/wa.me réels ; carte « estimée » | À faire |
| R-07 OTP réel | CONF-08 | Hors lot (backend) | Code faux rejeté en prod | Pré-requis lancement |
| R-08 Minimum de commande | CONF-10, CONF-11 | LOT-03 | CTA désactivé sous minimum + delta | **Fait** (16/07/2026) |
| R-09 Motifs annulation resto | CONF-12 | LOT-04 | Motif obligatoire, visible client/admin | À faire |
| R-10 Variantes/suppléments resto | CONF-14 | LOT-15 | Plat à options commandable bout en bout | À faire |
| R-11 Navigation resto + toggle statut | CONF-13 | LOT-10 | 1 seule nav, toggle header, URL par onglet | À faire |
| R-12 Rémunération + distances livreur | CONF-15 | LOT-06 | Gain affiché ; jamais de distance inventée | À faire |
| R-13 Preuve de livraison | CONF-17 | LOT-07 | Code 4 chiffres + repli tracé | À faire |
| R-14 Espèces livreur | CONF-16 | LOT-06 | « À encaisser » + confirmation clôture | À faire |
| R-15 Incidents livreur | CONF-18 | LOT-07 | Incident visible admin ≤ 30 s | À faire |
| R-16 Fiche commande admin | CONF-19 | LOT-08 | Détail + annuler + contacter | À faire (réassignation différée) |
| R-17 Litiges actionnables | CONF-20 | LOT-08 | Statut ouvert/résolu + note | À faire |
| R-18 Page clients admin | CONF-21 | LOT-16 | Recherche + blocage effectif | À faire |
| R-19 CRUD codes promo | — | — | — | Différé (backend requis, cf. §C.2) |
| R-20 Realtime/polling | CONF-24 | LOT-11 | Aucun interval < 15 s ; pause onglet caché | À faire (reformulé VPS) |
| R-21 Fiche resto fiabilisée | CONF-09 | LOT-02 | 404 propre, badge Fermé, Partager réel | À faire |
| R-22 Horaires structurés | CONF-36 | LOT-14 | Plus de texte libre ; badge réel | À faire |
| R-23 Re-commande 1-clic | CONF-25 | LOT-09 | Panier rechargé, indisponibles signalés | À faire |
| R-24 Recherche unifiée | CONF-33 | LOT-13 | `/explorer` redirige, 1 page 2 modes | À faire |
| R-25 Onboarding | CONF-28 | LOT-12 | 3 slides 1ʳᵉ visite, skippable | À faire |
| R-26 Indicateur réseau | CONF-29 | LOT-12 | Bannière offline ≤ 2 s | À faire |
| R-27 Économie de données | CONF-30 | LOT-12 | Animations off + images différées | À faire |
| R-28 Pipeline images | CONF-37 | LOT-14 | URL /uploads, ≤ 300 Ko | À faire |
| R-29 Accessibilité | CONF-31 | LOT-12 | Contraste ≥ 4.5:1, clavier complet | À faire |
| R-30 Dark mode + son | CONF-32 | LOT-06 (son) + LOT-12 (dark) | Bip course ; back-office dark complet | À faire |
| R-31 Avis nominatifs | CONF-26 | LOT-09 | « Prénom N. · Commande vérifiée » | À faire |
| R-32 Livreurs préférés | CONF-27 | LOT-10 | Plus de saisie d'ID | À faire |
| R-33 Tracking temps réel | CONF-34 | LOT-02 (badge) + backend | Carte marquée « estimée » ; cible VPS | Court terme à faire / cible backend |
| R-34 PWA/offline | — | — | — | P3 backlog |
| R-35 i18n EN | — | — | — | P3 backlog |
| R-36 Fidélité/parrainage | — | — | — | P3 backlog |
| R-37 Livraison programmée | — | — | — | P3 backlog |
| R-38 Paramètres/exports admin | — | — | — | P3 backlog |
| (audit E.3) Privacy bénéficiaire | CONF-23 | LOT-06 | Rien de nominatif avant acceptation | À faire |
| (audit quick-win 11) prompt/alert | CONF-22 | LOT-05 | Grep prompt/alert vide | À faire |
| (audit E.4) Carte admin factice | CONF-35 | LOT-08 | Zéro donnée inventée | À faire |
| (DOC-UX P1-02) Carte d'abord au checkout | — | — | — | Écarté (justifié §C.2) |
| (DOC-UX P2-09) Filtres candidatures | — | — | — | Déjà implémenté |

---

*Fin du plan. Aucune implémentation n'a été commencée ; aucun fichier fonctionnel n'a été modifié (seuls `docs/ux-implementation-plan.md` et deux précisions dans `CLAUDE.md` — référence à ce plan et état réel du lint — ont été ajoutés).*
