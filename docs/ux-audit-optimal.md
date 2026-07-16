# Audit UX/UI & Fonctionnel — MiamExpress (rapport unique fusionné)

> **Date** : 16/07/2026 · **Périmètre** : application web `app/` (React 19 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase), 4 profils (Client, Restaurant, Livreur, Admin).
> **Méthode** : audit exhaustif du code source (routes, pages, composants, contexts, lib), puis **fusion** avec le document `OPTIMISATION_UX_YAMO.md` (points complémentaires intégrés et marqués `[DOC-UX]` ; points corrigés lorsque le code contredit le document — voir §M).
> Chaque constat est référencé par fichier pour être directement actionnable.

---

## A. Résumé exécutif

**MiamExpress est un MVP remarquablement avancé, mais pas encore une plateforme de livraison opérable en production.** Le front est professionnel : design system cohérent (vert/or, Poppins/Inter, shadcn/ui), parcours de commande complet (catalogue → panier → checkout → suivi → notation), adaptation locale intelligente (quartier + point de repère + carte, paiement espèces par défaut, mode dégradé sans backend). Les quatre profils existent et sont connectés de bout en bout.

**Les forces** : le checkout est le meilleur écran de l'app (adresses enregistrées, géolocalisation, repère sur carte, commande pour un tiers, validation serveur des prix) ; le dashboard restaurant a une vraie profondeur métier (alerte sonore, urgence colorée des commandes, statistiques finances/plats/heures de pointe) ; le workflow de candidature → validation admin → approbation est complet avec documents et motifs de rejet.

**Les défauts majeurs** se concentrent en trois familles :

1. **Fonctionnalités simulées présentées comme réelles** : position du livreur simulée (`tracking.ts:simulateDriverPosition`), distances livreur factices (`DriverDashboard.tsx:stableOffset`), boutons de messagerie qui n'envoient rien (`Orders.tsx:220-222`, `DriverDashboard.tsx:389`), carte de supervision admin avec livreurs codés en dur (`AdminDashboard.tsx:184-187`). Elles érodent la confiance dès qu'un utilisateur réel s'en aperçoit.
2. **Chaînons opérationnels manquants** : le client ne peut pas annuler une commande ; le restaurant refuse sans motif transmis ; le livreur n'a ni preuve de livraison ni rapprochement d'espèces ni signalement d'incident ; l'admin ne peut ni intervenir sur une commande ni gérer les clients ni traiter un litige (la page « Litiges » est une liste passive d'annulations).
3. **Robustesse réseau/données** : panier non persisté (perdu au refresh — `CartContext.tsx`), polling 5 s sur ~toutes les vues connectées, images uploadées en base64 dans la base, aucun service worker (l'app n'est pas réellement PWA), aucun mode hors-ligne ni indicateur de connexion — le contraire de ce qu'exige un réseau 3G camerounais.

**Risques critiques avant lancement** : panier volatil (abandon garanti), impossibilité d'annuler côté client (appels au support), montants de secours calculés côté client si la fonction de validation est injoignable (`Checkout.tsx:264-266` — risque de fraude prix), frontière des statuts non respectée (le restaurant peut marquer « livrée » — `RestaurantDashboard.tsx:nextStatus`), et bug de fusion des articles personnalisés dans le panier (voir Top 10 #4).

**Plus grandes opportunités** : convertir les simulations en vraies fonctions (tracking Realtime, messages WhatsApp), persister le panier (1 h de travail, impact conversion immédiat), unifier `/restaurants` et `/explorer`, et compléter la boucle opérationnelle (annulation, motifs, preuve de livraison, litiges actionnables). Aucun méga-menu supplémentaire n'est nécessaire : le problème n'est pas le nombre d'entrées mais la duplication et les trous fonctionnels.

---

## B. Note globale

| Dimension | Note /100 | Justification |
|---|---|---|
| Architecture de l'information | **68** | Séparation des 4 profils propre (`App.tsx`, `RoleGate`, `BackOfficeLayout`). Mais duplication recherche (`/restaurants` vs `/explorer`), double navigation restaurant (sidebar + onglets internes désynchronisés — l'onglet « Livreurs » n'existe pas dans la sidebar `BackOfficeLayout.tsx:29-34`), et « Explorer/Commande perso » enterrés dans le menu hamburger mobile. |
| Navigation | **70** | Bottom nav client 5 onglets = bon standard. Mega-menu desktop sobre et justifié. Retour arrière et position courante corrects (breadcrumbs présents dans les heros). Perte : navbar + bottom nav + spacers consomment ~26 % d'un écran 640 px `[DOC-UX]` ; dashboards restaurant/livreur ont chacun deux systèmes d'onglets concurrents. |
| Expérience client | **66** | Parcours commande fluide (3-4 étapes, checkout excellent). Mais panier perdu au refresh, pas d'annulation, pas de re-commande 1-clic, suivi simulé, minimum de commande jamais affiché ni vérifié côté client, boutons fantômes. |
| Expérience restaurant | **62** | Réception de commandes très aboutie (son, urgence, temps de préparation). Mais impossible de créer variantes/suppléments (le client peut pourtant les commander !), refus sans motif, statut Ouvert/Fermé enfoui dans l'onglet Profil, horaires en texte libre, `window.location.reload()` après sauvegarde (`RestaurantDashboard.tsx:527`). |
| Expérience livreur | **55** | Boucle accepter → récupérer → livrer fonctionnelle, gains + virements présents. Mais position GPS codée en dur (`DriverDashboard.tsx:234`), distances factices, pas de preuve de livraison, pas de gestion d'espèces, pas d'incident « client injoignable », pas d'alerte sonore nouvelle course, GPS uniquement vers le client (jamais vers le restaurant). |
| Expérience administrateur | **58** | Candidatures = meilleur écran admin (onglets, documents, motifs). Mais commandes en lecture seule (aucune intervention possible), litiges non actionnables, aucune gestion des clients, `window.prompt()` pour les motifs (`AdminDrivers.tsx:49,64`), carte de supervision factice. |
| Clarté visuelle | **80** | Hiérarchie, couleurs, boutons et cartes cohérents entre profils. Points noirs : densité du dashboard restaurant, cellules d'action multiples sur les cartes menu. |
| Accessibilité | **48** | `text-muted #9CA3AF` sous les ratios WCAG AA `[DOC-UX]`, filtres/pills non navigables clavier, pas de dark mode (utile aux livreurs de nuit), animations Framer Motion sans `prefers-reduced-motion`. |
| Performance | **45** | Polling 5 s sur ≥ 8 vues, images base64 en base (`RestaurantDashboard.tsx:handleFileChange`), pas de service worker, pas de cache, Framer Motion partout, `Orders.tsx` refait N requêtes `hasRestaurantReview` en boucle à chaque poll. |
| Confiance | **52** | Validation serveur des prix = très bon réflexe. Mais fonctionnalités simulées, avis anonymisés « Client MiamExpress », « 500 restaurants partenaires » affiché en dur (`Restaurants.tsx:199`), distance « 1,2 km » codée en dur (`RestaurantDetail.tsx:255`), fallback montants client si Edge Function injoignable. |
| Conversion | **60** | Personnalisation plats, favoris, code promo présents. Manquent : panier persistant, re-commande, recommandations, affichage du minimum de commande, frais de livraison visibles avant le checkout (ils le sont sur la fiche resto ✔), compte invité. |
| Préparation au lancement | **50** | Le socle est là ; les chaînons opérationnels (annulation, litiges, espèces, preuve de livraison, notifications) et la robustesse réseau ne le sont pas encore. |

**Moyenne indicative : ~60/100** — solide MVP, à ~6-8 semaines de travail ciblé d'un niveau lançable.

---

## C. Top 10 des problèmes les plus importants

| # | Problème | Profils | Preuve | Impact | Gravité | Solution recommandée | Effort |
|---|---|---|---|---|---|---|---|
| 1 | **Panier non persisté** — un refresh, une navigation externe (paiement MoMo !) ou un crash d'onglet vide le panier | Client | `CartContext.tsx` : `useState` pur, aucun `localStorage` (contrairement aux adresses `yamo_saved_addresses` et commandes `yamo_local_orders`) | Abandon de panier massif sur réseau instable ; incohérent avec le reste de l'app qui persiste tout | **Critique** | Sérialiser `items` dans `localStorage` (clé `yamo_cart`) avec TTL 24 h + re-validation des prix à la restauration | Faible |
| 2 | **Le client ne peut pas annuler une commande** | Client, Restaurant, Admin | `Orders.tsx` : aucun bouton d'annulation, quel que soit le statut ; seul le restaurant peut annuler | Appels/WhatsApp au support pour toute erreur de commande ; commandes fantômes préparées pour rien | **Critique** | Bouton « Annuler » visible tant que `status ∈ {pending, confirmed}`, avec confirmation et motif optionnel ; notification au restaurant | Moyen |
| 3 | **Fallback des montants côté client** si la validation serveur échoue | Client, Admin | `Checkout.tsx:264-266` : « Edge function injoignable : on continue avec les montants client » | Manipulation de prix possible (DevTools), pertes financières, litiges | **Critique** | Bloquer la commande si `validate-order` échoue en mode Supabase (message « réessayez ») ; ne tolérer le fallback qu'en mode mock | Faible |
| 4 | **Bug de fusion des articles personnalisés** — un plat personnalisé garde l'`id` d'origine ; ajouter ensuite le même plat nature incrémente la ligne personnalisée (mauvais prix, mauvais libellé) | Client, Restaurant | `RestaurantDetail.tsx:confirmCustomized` crée `{...customizing, name, price}` sans changer `id` ; `CartContext.addToCart` matche par `item.id` | Commandes erronées, litiges à la livraison, perte de confiance | **Critique** | Générer un `id` composite (`itemId + hash(variant+suppléments)`) pour chaque combinaison | Faible |
| 5 | **Suivi livreur simulé présenté comme du temps réel** + boutons de contact factices | Client, Livreur | `tracking.ts:simulateDriverPosition` ; `Orders.tsx:220-222` (« Message envoyé au livreur » sans envoi) ; `DriverDashboard.tsx:389` | « Le livreur ne bouge pas », messages jamais reçus → confiance détruite au premier usage réel | **Critique** | Court terme : retirer les boutons fantômes, remplacer par `tel:` + `wa.me/` réels ; étiqueter la carte « position estimée ». Moyen terme : positions livreur via Supabase Realtime | Faible (court) / Élevé (réel) |
| 6 | **Le restaurant peut faire avancer la commande jusqu'à « livrée »** (statuts non cloisonnés par rôle) | Restaurant, Livreur, Client | `RestaurantDashboard.tsx:33` : `statusFlow` complet + bouton « Marquer : {next} » sans borne à `ready` | Statuts incohérents (livré sans livreur), gains livreur faussés, tracking client faux | **Élevée** | Restaurant limité à `pending→confirmed→preparing→ready` ; `picked_up/delivering/delivered` réservés au livreur (à verrouiller aussi côté RLS/API) | Faible |
| 7 | **Refus/annulation restaurant sans motif** — le client n'est jamais informé du pourquoi | Client, Restaurant, Admin | `RestaurantDashboard.tsx:handleCancel` : passe à `cancelled` sans champ motif (le rejet de candidature admin, lui, a un motif — `AdminApplications.tsx:292+`) | Client sans explication ni relance ; litiges impossibles à arbitrer | **Élevée** | Dialog d'annulation avec motifs prédéfinis (rupture d'ingrédient, fermeture, surcharge…) stockés sur la commande et affichés au client + à l'admin | Moyen |
| 8 | **Le restaurateur ne peut pas créer de variantes/suppléments** alors que le client peut en commander | Restaurant, Client | Formulaire menu (`RestaurantDashboard.tsx:1132-1287`) : nom, prix, catégorie, image, tags — aucun champ variantes/suppléments ; `RestaurantDetail.tsx` les affiche pourtant (`customizing.variants/supplements`) | Seuls les plats seedés ont des options ; l'upsell (suppléments) est inaccessible aux vrais partenaires | **Élevée** | Ajouter au formulaire une section « Options » (variantes radio + suppléments avec prix), en étape 2 d'un wizard `[DOC-UX P1-03]` | Moyen |
| 9 | **Position/distances livreur factices** | Livreur | `DriverDashboard.tsx:234` : `driverLat = 4.0511` en dur (centre Douala) ; `stableOffset()` génère des km pseudo-aléatoires | Le livreur accepte des courses sur des distances fausses ; à Yaoundé, tout est faux | **Élevée** | Utiliser `navigator.geolocation` du livreur + haversine vers les vraies coordonnées du restaurant ; plus tard OSRM `[DOC-UX P2-01]` | Moyen |
| 10 | **Admin sans leviers opérationnels** : commandes en lecture seule, litiges passifs, aucun écran clients | Admin, tous | `AdminOrders.tsx` (tableau sans action ni détail), `AdminDisputes.tsx` (liste des annulées, 0 action), aucune route `/admin/customers` | Toute intervention (réassigner, rembourser, bloquer un fraudeur) passe hors outil → non traçable, non scalable | **Élevée** | Fiche commande admin (détail + annuler + réassigner livreur + contacter) ; litiges avec statut ouvert/résolu + motif ; page Clients (recherche, historique, blocage) | Élevé |

---

## D. Analyse de la navigation

### D.1 Navigation actuelle

**Client (mobile)** : bottom nav 5 onglets — Accueil, Recherche (`/restaurants`), Commandes, Favoris, Compte + onglet Panier conditionnel (`MobileBottomNav.tsx`). En parallèle : navbar avec hamburger contenant le mega-menu (Explorer : Tous les plats, Restaurants, Commande perso, Mes favoris / Premium : Partenaires, Livreurs / Contact).
**Client (desktop)** : navbar + mega-menu déroulant (2 sections) + panier popover + CTA connexion/inscription. Sobre et efficace.
**Restaurant** : `BackOfficeLayout` sidebar 4 entrées (Commandes, Menu, Profil, Finances) **+** barre d'onglets interne de 5 entrées dans `RestaurantDashboard` (les 4 mêmes + « Livreurs »).
**Livreur** : sidebar 3 entrées (Disponibles, Mes courses, Gains) **+** segmented control interne **+** une 2ᵉ bottom nav propre au dashboard (`DriverDashboard.tsx:551-576`).
**Admin** : sidebar plate de 10 entrées + liens « quick-jump » vers les dashboards restaurant/livreur (bonne idée, desktop seulement).

### D.2 Faiblesses

1. **Triple navigation restaurant/livreur** : sidebar + onglets internes + (livreur) bottom nav rendent l'état actif ambigu — la sidebar peut indiquer « Commandes » pendant que l'onglet interne affiche « Livreurs », qui n'a d'ailleurs **pas d'URL** (non accessible en lien direct, non mémorisé au refresh).
2. **Recherche dupliquée** : `/restaurants` (par restaurant, quickFilters) et `/explorer` (par plat, tags diététiques) ont deux systèmes de filtres étanches `[DOC-UX]`. La bottom nav pousse vers l'un, le mega-menu vers l'autre.
3. **« Commande perso » (`/demandes/nouvelle`) invisible** : fonctionnalité différenciante enterrée au 2ᵉ niveau du hamburger ; `/demandes/mes-demandes` n'est accessible nulle part depuis le profil ou les commandes.
4. **Mobile : cumul navbar (72 px) + bottom nav (56 px) + spacers** ≈ 26 % d'un écran 360×640 `[DOC-UX P1-05]`.
5. Bottom nav « Recherche » ouvre `/restaurants` : libellé et destination ne coïncident pas tout à fait (c'est un listing filtrable, pas une recherche globale).

### D.3 Navigation recommandée

**Faut-il un méga-menu ? Non — il en existe déjà un, correctement dimensionné.** Aucun profil ne dépasse 10 entrées de premier niveau ; le problème est la **duplication**, pas le volume. Ajouter un méga-menu admin serait de la sur-ingénierie.

| Profil | Mobile | Desktop |
|---|---|---|
| **Client** | Bottom nav conservée : Accueil · **Explorer** (page recherche unifiée restaurants+plats) · Commandes · Favoris · Compte. Panier en bouton flottant/barre contextuelle (déjà le cas sur la fiche resto). Navbar réduite à logo + panier + hamburger (liens secondaires : Commande perso, Partenaires, Livreurs, Contact) | Navbar + mega-menu actuels, en remontant « Commande perso » comme entrée mise en avant |
| **Restaurant** | **Supprimer la barre d'onglets interne** ; la sidebar devient l'unique navigation : Commandes · Menu · **Livreurs** (à y ajouter, avec URL `/partenaires/dashboard/livreurs`) · Finances · Profil. Toggle **Ouvert/Fermé dans le header** du back-office `[DOC-UX]` | Idem, sidebar permanente |
| **Livreur** | **Une seule bottom nav** (celle du dashboard) : Disponibles · Courses · Gains ; supprimer le segmented control redondant | Sidebar actuelle |
| **Admin** | Sidebar repliable actuelle, en la structurant par **3 intitulés de section non cliquables** : *Opérations* (Tableau de bord, Commandes, Litiges) · *Partenaires* (Candidatures, Restaurants, Livreurs, + futur Clients) · *Configuration* (Catalogue plats, Zones, Frais livraison, Médiathèque). 10-12 entrées à plat restent scannables ; les sections suffisent, pas de sous-menus | Idem + recherche globale (commande/téléphone) dans la top bar quand le volume le justifiera |

---

## E. Audit détaillé par profil

### E.1 Client

**Points forts**
- Checkout complet : adresses enregistrées, ville verrouillée sur celle du restaurant, quartier + « mon quartier n'est pas listé », carte avec repère déplaçable + géolocalisation, point de repère obligatoire (adressage informel ✔), commande pour un tiers avec instructions d'appel, contrôle de zone de livraison avec distance/ETA (`Checkout.tsx:98-116`), validation serveur des prix/promo.
- Écran de confirmation post-commande présent (`Checkout.tsx:325-352`) avec référence et CTA « Suivre ma commande ».
- Suivi par stepper de statut + double notation livraison/restaurant après livraison, avec dédoublonnage (`hasRestaurantReview`).
- Gestion du conflit de panier inter-restaurants par dialog explicite (`RestaurantDetail.tsx:700-718`).
- Fiche restaurant riche : galerie avec lightbox et quick-add depuis les photos, avis avec distribution des notes, suggestions similaires.

**Points faibles / cas limites non gérés**
- Panier volatil (Top 10 #1) ; pas de récupération après coupure réseau pendant `createOrder` (double commande possible si l'utilisateur re-clique après timeout — pas d'idempotence).
- `RestaurantDetail.tsx:61` : `restaurant = fetchedRestaurant ?? restaurants[0]` — pendant le chargement ou sur un ID invalide, la page affiche **un autre restaurant** au lieu d'un squelette/404.
- Distance « 1,2 km » codée en dur (`RestaurantDetail.tsx:255`) et « Ouvert jusqu'à … » dérivé d'un split de chaîne, sans vérification réelle des horaires — un resto fermé paraît ouvert.
- Bouton **Partager sans action** (`RestaurantDetail.tsx:270-272`).
- **Minimum de commande jamais affiché ni vérifié côté client** (`minOrder` absent de `Checkout.tsx`) — l'utilisateur découvre le rejet à la validation serveur.
- Frais de livraison affichés « Gratuit » tant que le restaurant n'est pas chargé (`Checkout.tsx:202-204`) — anti-transparence tarifaire.
- Indisponibilité d'un plat déjà au panier, changement de prix, restaurant fermé après ajout : gérés uniquement par le message d'erreur serveur générique à la confirmation — aucun traitement UX (surlignage de l'article fautif, proposition de retrait).
- Paiement MoMo : si l'initiation échoue, message « vous pourrez régler à la livraison » (`Checkout.tsx:300`) — bon repli ; mais **débité-non-confirmé** n'a aucun parcours (pas de statut de paiement visible dans `/commandes`).
- Pas d'annulation (Top 10 #2), pas de re-commande 1-clic, pas de page détail commande/reçu, pas de notifications (aucun canal push/SMS), pas de page d'aide/FAQ (Contact générique seulement).
- `Orders.tsx:88-103` : polling 5 s qui refait aussi la boucle `hasRestaurantReview` sur chaque commande livrée à chaque tick.
- Bilinguisme annoncé mais **aucun système i18n** : `PROFILE_LANG_KEY` stocké dans `Profile.tsx` sans effet sur les textes.
- Profil : nom, photo, WhatsApp stockés en `localStorage` uniquement (perdus sur un autre appareil), à l'exception du nom si Supabase (`AuthContext.updateProfileName`).
- `[DOC-UX]` Onboarding première visite inexistant ; pas de proposition de valeur ni de choix de ville initial.

**Recommandations prioritaires** : persister le panier ; bouton Annuler ; afficher minimum de commande + frais réels dès la fiche resto/panier ; corriger le fallback `restaurants[0]` ; retirer les boutons fantômes ; bouton « Recommander » sur les commandes livrées.

### E.2 Restaurant

**Points forts**
- Réception de commandes : alerte sonore WebAudio + toast sur nouvelle commande (`RestaurantDashboard.tsx:120-166`), bordure d'urgence colorée par âge (>5 min ambre, >15 min rouge), choix du temps de préparation en 1 tap (« Accepter — prêt dans 20 min »), confirmation d'annulation par AlertDialog.
- Gestion de menu au-dessus de la moyenne : recherche, filtres rapides (Indisponibles, Sans image), tri, vues cartes/liste, toggles disponibilité/populaire à 1 clic, rattachement à un catalogue de plats types avec workflow de validation admin, tags diététiques.
- Finances : CA brut/commission/net, panier moyen, CA par jour, heures de pointe, top/flop plats, taux d'annulation, clients nouveaux vs fidèles — niveau pro.
- Livreurs préférés avec fenêtre de priorité 30 s — mécanique différenciante pertinente localement.

**Points faibles / manquants**
- Double navigation (D.2) ; onglet Livreurs sans URL.
- Variantes/suppléments non créables (Top 10 #8) ; pas de gestion de stock/quantité ni de « rupture d'ingrédient » ciblée.
- Statuts non bornés au rôle (Top 10 #6) ; annulation sans motif (Top 10 #7) ; pas de délai d'acceptation visible (compte à rebours) ni d'escalade si non répondu.
- Statut Ouvert/Fermé enfoui dans l'onglet Profil ; horaires et temps de livraison en **texte libre** (`ProfileTab`) — non validables, non exploitables pour l'affichage « ouvert maintenant » ; `window.location.reload()` après sauvegarde.
- Ajout de livreur préféré **par saisie d'ID brut** (`RestaurantDashboard.tsx:596-603`) — inutilisable ; proposer les livreurs des dernières livraisons.
- Pas de gestion des promotions, pas de reversements/factures de commission (les livreurs ont un workflow de virement, pas les restaurants), pas de réponse aux avis clients, pas de gestion multi-employés/permissions, pas d'édition de la galerie photo côté resto.
- Images de plats encodées en base64 (`FileReader.readAsDataURL`) et stockées telles quelles — poids en base et à l'affichage (l'infra `AdminMedia`/API média existe pourtant côté serveur).
- Pas de vue « aperçu client » du restaurant `[DOC-UX P2-10]` ; pas de bouton « tester le son » `[DOC-UX]`.

**Cas limites non gérés** : commande pendant fermeture (le serveur la refuse mais rien n'empêche l'affichage côté client), afflux simultané (pas de file priorisée), livreur en attente non signalé au resto, pas de communication resto↔livreur.

### E.3 Livreur

**Points forts**
- Boucle métier claire : Disponibles → Accepter (course perdue gérée par toast si déjà prise) → « Commande récupérée » → « Marquer comme livrée », avec appel `tel:` du bon interlocuteur (bénéficiaire vs client) et lien Google Maps.
- Gains par période + solde disponible calculé net des virements demandés, minimum de virement, historique des virements avec motifs de refus — cohérent avec le workflow admin (`AdminDrivers`).
- Toggle En ligne/Hors ligne persistant, badge « Prioritaire » sur les restaurants qui ont mis le livreur en favori, restriction de zone par ville/quartiers (`orders.ts:matchesDriverZone`).
- Statuts du jour (gains, livraisons, en attente) en tête de liste.

**Points faibles / manquants**
- Position et distances factices (Top 10 #9) ; GPS proposé **uniquement vers le client** — jamais vers le restaurant alors que la première étape est de s'y rendre (`DriverDashboard.tsx:368` n'utilise que `order.address`).
- Détails avant acceptation incomplets : le livreur voit le **total de la commande** mais pas **sa rémunération** (frais de livraison) — l'information de décision n°1 ; le montant affiché en bas de carte est `order.total`, ambigu avec un paiement espèces à encaisser.
- **Gestion des espèces absente** : rien n'indique le montant à encaisser vs à reverser ; aucun rapprochement en fin de journée ; « paiement espèces sans monnaie » non géré.
- **Preuve de livraison absente** (pas de code de confirmation ni photo) ; « livré à la mauvaise personne » indétectable.
- Aucun signalement d'incident : client injoignable, adresse introuvable, commande incomplète au retrait — le livreur n'a que des boutons fantômes (toast local, `DriverDashboard.tsx:380-395`).
- Pas d'alerte sonore/notification à l'apparition d'une course (le resto en a une) — le livreur doit regarder l'écran ; polling 5 s = batterie + data `[DOC-UX P1-04]`.
- Numéro du bénéficiaire visible **avant** acceptation (`DriverDashboard.tsx:259-264`) — exposition inutile de données personnelles ; ne le révéler qu'après acceptation.
- Virement : montant unique = tout le solde, pas de choix du numéro MoMo de réception.
- Filtre de période des gains sans option « Aujourd'hui » `[DOC-UX]` ; pas de dark mode pour le travail de nuit `[DOC-UX P2-05]`.

### E.4 Administrateur

**Points forts**
- Candidatures : onglets par statut, compteurs, recherche, miniatures de documents dépliables, approbation avec liaison à un restaurant existant, rejet motivé — complet.
- Livreurs : statut en ligne, stats de livraisons, note moyenne, derniers avis, suspension motivée réversible, traitement des virements payer/refuser avec motif.
- Dashboard : KPIs, commission par période, top restaurants/plats, CA 7 jours, répartition par statut.

**Points faibles / manquants**
- Aucune **fiche commande** : `AdminOrders` est un tableau plat sans détail, sans action (annuler, rembourser, réassigner un livreur, contacter les parties) — l'admin supervise mais ne peut pas agir (Top 10 #10).
- **Litiges** : simple liste des commandes annulées, sans motif (il n'est pas capturé — cf. Top 10 #7), sans statut de traitement, sans workflow de remboursement.
- **Aucune gestion des clients** (pas de route, pas de page) : impossible de retrouver un client, voir son historique, le bloquer (fraude/faux comptes non adressés).
- `AdminRestaurants` : uniquement le toggle ouvert/fermé — pas d'édition (commission, frais, zone, coordonnées, propriétaire) ni de lien vers la fiche publique.
- Carte de supervision avec positions **inventées** (`AdminDashboard.tsx:184-187` : `4.04 + i * 0.006`, « Livreur dispo 1/2 » en dur) — à retirer ou brancher sur les vraies données.
- `window.prompt()` pour les motifs de suspension/refus (`AdminDrivers.tsx`) — hors design system, non mobile-friendly.
- Manquent : paramètres plateforme (taux de commission codé en dur `AdminDashboard.tsx:9`), gestion des codes promo (utilisés au checkout mais administrables nulle part !), journal d'activité, exports CSV, notifications, rôles/permissions admin granulтам.
- Polling 5 s sur chaque page admin ouverte.

---

## F. Analyse fonctionnelle — statuts

Barème : ✅ complète et professionnelle · 🔧 correcte mais améliorable · ⏳ partiellement implémentée · ⚠️ incohérente · 🚫 simulée/fantôme · ❌ manquante · 🔴 critique pour le lancement.

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Inscription OTP téléphone | ⏳🔴 | `sendOtp` bascule silencieusement en mode mock (tout code accepté) si Twilio absent (`AuthContext.tsx:200-211`) — en prod, vérification SMS réelle obligatoire |
| Connexion email « Pro » | ✅ | Avec gestion RoleMismatch propre |
| Recherche restaurants + filtres | ✅ | Ville/quartier avec recherche interne, quick filters, tri, sync URL (`Restaurants.tsx`) |
| Explorer par plat | 🔧 | Redondant avec /restaurants — à fusionner `[DOC-UX P2-02]` |
| Fiche restaurant / menu / galerie | 🔧 | Fallback `restaurants[0]` ⚠️, distance et « ouvert jusqu'à » factices, Partager 🚫 |
| Personnalisation plat (variantes/suppl.) | ⚠️🔴 | Bug id panier (Top 10 #4) ; côté resto non créable (Top 10 #8) |
| Panier | ⚠️🔴 | Non persisté ; conflit inter-restos ✅ |
| Checkout / adresse / repère GPS | ✅ | Meilleur écran de l'app ; ajouter minimum de commande + frais réels pendant chargement |
| Code promo | ⏳ | Vérifié serveur à la confirmation ✔, mais aucune administration des codes ❌ |
| Paiement espèces | ✅ | Par défaut, adapté au marché |
| Paiement MTN MoMo | ⏳🔴 | Initiation Edge Function ✔ ; pas de suivi de statut de paiement côté client/admin, cas « débité non confirmé » ❌ |
| Paiement Orange Money | 🚫 | Message « le support confirmera » = manuel |
| Suivi de commande (stepper) | ✅ | Statuts + message de préparation dynamique |
| Suivi carte temps réel | 🚫 | Position simulée (`tracking.ts`) |
| Contact livreur / messages rapides | 🚫🔴 | Toasts sans envoi — à retirer ou brancher (WhatsApp) |
| Annulation client | ❌🔴 | Aucune |
| Remboursement | ❌ | Aucun workflow |
| Notation livreur + restaurant | ✅ | Double notation, anti-doublon |
| Réclamation client | ❌ | Aucun point d'entrée |
| Favoris restaurants/plats | ✅ | |
| Commande perso (FoodRequest) | 🔧 | Fonctionnelle mais invisible dans la navigation |
| Réception commandes resto (son, urgence) | ✅ | Ajouter « tester le son » |
| Statuts resto | ⚠️ | Peut aller jusqu'à « livrée » (Top 10 #6) |
| Gestion menu resto | 🔧 | Riche ; manquent variantes/suppléments, stock |
| Profil resto (horaires, min., rush) | ⏳ | Texte libre + `window.location.reload()` |
| Finances resto | ✅ | Reversements/factures ❌ |
| Livreurs préférés | ⏳ | Ajout par ID brut inutilisable |
| Courses disponibles livreur | ⚠️ | Distances factices ; rémunération non affichée |
| Acceptation course (concurrence) | ✅ | Conflit géré par erreur + toast |
| Preuve de livraison / espèces | ❌🔴 | Rien |
| Gains + virements livreur | ✅ | Ajouter période « Aujourd'hui », numéro MoMo |
| Candidatures admin | ✅ | |
| Commandes admin | ⏳ | Lecture seule |
| Litiges admin | ⏳ | Liste passive |
| Clients admin | ❌ | Page inexistante |
| Zones / frais livraison admin | 🔧 | Présents ; interface technique `[DOC-UX]` |
| Notifications (push/SMS) | ❌🔴 | Aucun canal ; tout repose sur le polling à écran ouvert |
| Mode hors-ligne / PWA | 🚫 | Aucun service worker trouvé (`index.html`, `vite.config.ts`) — « PWA ready » non vérifié |
| i18n FR/EN | ❌ | Préférence stockée sans effet |

**Cas limites** (scénarios réels) : sur les 18 scénarios testés mentalement contre le code (resto fermé après ajout, prix modifié, MoMo débité non confirmé, livreur sans réseau, abandon de course, client injoignable, double commande, annulation après préparation, fraude, panne carto…), seuls **4 sont réellement gérés** (conflit de panier, course déjà prise, validation prix serveur, suspension livreur). La colonne vertébrale « happy path » est solide ; la robustesse aux incidents est le chantier principal.

---

## G. UI & cohérence visuelle

- **Hiérarchie/couleurs/typo** : cohérentes sur les 4 profils (vert primaire, or accent, erreurs rouges, cartes blanches arrondies). Chaque écran client a une action principale identifiable (CTA vert pleine largeur). ✔ À conserver tel quel.
- **Écrans trop denses** : cartes de menu resto avec 4 icônes d'action alignées (`renderItemActions`) — regrouper Modifier/Supprimer dans un menu ⋯, garder Disponible/Populaire en accès direct ; dashboard resto = stats + sélecteur + statut + onglets + liste avant la première commande visible.
- **Incohérences ponctuelles** : lien « Noter la livraison » en bleu (`Orders.tsx:276`) hors palette ; `alert()`/`window.prompt()` natifs (`RestaurantDashboard.tsx:559`, `AdminDrivers.tsx`) vs dialogs shadcn ailleurs ; loaders mixtes (Skeleton vs « Chargement... » texte) `[DOC-UX]`.
- **Formulaires** : les inputs sans bordure sur fond gris sont élégants mais les états d'erreur par champ n'existent pas (message global en bas de page au checkout) ; pas de validation temps réel du téléphone.
- **Accessibilité** `[DOC-UX confirmé]` : contraste `#9CA3AF` insuffisant pour les textes secondaires ; pills/filtres non focusables ; images sans alt significatif par endroits ; pas de `prefers-reduced-motion` ; pas de dark mode malgré `darkMode: ["class"]` configuré et `next-themes` installé.
- **Petits écrans** : bottom sheet panier mobile s'anime vers `y: '20%'` (`RestaurantDetail.tsx:633`) laissant une bande morte ; le cumul de barres fixes réduit la zone utile (D.2).

---

## H. Performance & contexte technique

| Constat | Preuve | Solution adaptée au Cameroun |
|---|---|---|
| Polling 5 s généralisé (client, resto, livreur, 4+ pages admin) | `setInterval(..., 5000)` dans `Orders`, `DriverDashboard`, `RestaurantDashboard`, `AdminDashboard/Orders/Drivers/Disputes/Applications` | Supabase Realtime (le hook `useRealtime.ts` existe déjà) avec repli polling 30-60 s ; stopper le polling quand l'onglet est masqué (`visibilitychange`) `[DOC-UX P1-04]` |
| Images base64 dans la base | `handleFileChange` → `readAsDataURL` → payload `image` | Uploader vers le serveur média (déjà déployé : `miamexpress-media`) et stocker l'URL ; compresser côté client avant envoi (canvas, ≤ 200 Ko) |
| Requêtes N+1 avis | `Orders.tsx:92-97` boucle `hasRestaurantReview` à chaque poll | Une requête `in(orderIds)` unique, mise en cache locale |
| Pas de service worker / cache | Aucune inscription SW dans `index.html`/`vite.config.ts` | `vite-plugin-pwa` : cache statique + catalogue en stale-while-revalidate ; file d'attente d'actions hors-ligne pour le livreur |
| Animations Framer Motion systématiques | `motion.div` sur Home, Restaurants, RestaurantDetail (délais par index) | Respecter `prefers-reduced-motion` + mode « économie de données » qui les désactive `[DOC-UX P2-07]` |
| Pas d'indicateur réseau | — | Bandeau `navigator.onLine` global `[DOC-UX P2-06]` |
| Listes non paginées | `AdminOrders`, historique commandes | Pagination/virtualisation au-delà de 50 lignes |

---

## I. Conversion, rétention, confiance

Pertinent pour MiamExpress (justifié par un manque constaté) :
1. **Re-commander en 1 clic** (`Orders.tsx`) — l'historique existe, le bouton non ; c'est le levier de fréquence n°1 en food delivery. Effort faible.
2. **Panier persistant + reprise** (Top 10 #1) — récupération directe de conversion.
3. **Transparence** : afficher minimum de commande et frais réels partout ; remplacer « 500 restaurants partenaires » et « 1,2 km » en dur par les vraies valeurs — la confiance locale se joue sur ces détails.
4. **Prénom sur les avis** (« Marie N. » au lieu de « Client MiamExpress ») + badge « commande vérifiée » — les avis sont déjà liés à des commandes livrées : preuve sociale gratuite.
5. **WhatsApp** `[DOC-UX P3-03]` : liens `wa.me` pour livreur↔client et support — canal dominant, remplace avantageusement les boutons fantômes. Effort faible.
6. **Compensation retard** (geste commercial code promo si > X min) — à envisager après la mise en place des codes promo administrables ; pas avant.
7. Programme de fidélité `[DOC-UX P3-02]` et parrainage : **pas maintenant** — la boucle opérationnelle doit être fiable d'abord ; à planifier en phase 3/4.

---

## J. Benchmark (pratiques des leaders, adaptées)

| Pratique (source) | Ce qu'elle résout | Adaptation MiamExpress | Version minimale |
|---|---|---|---|
| **Code de confirmation à la livraison** (Jumia Food, Glovo) | Livraison à la mauvaise personne, litiges « jamais reçu » | Code 4 chiffres dans l'app client, saisi par le livreur pour clôturer ; fonctionne par téléphone si le client n'a plus de data | Code affiché dans `/commandes`, champ de saisie dans `DriverDashboard` |
| **Barème de rémunération visible avant acceptation** (Uber Eats, Bolt Food) | Refus/abandons de courses, méfiance livreurs | Afficher « Vous gagnez : X FCFA » en gros + distance réelle | Afficher `order.deliveryFee` (donnée déjà là) |
| **Motifs d'annulation structurés** (Deliveroo) | Litiges inarbitrables | Enum de motifs FR côté resto et client, visibles par l'admin | Champ `cancellation_reason` + select |
| **ETA dynamique et honnête** (DoorDash) | Anxiété d'attente, appels | ETA = temps de prépa choisi par le resto + trajet estimé ; affiché en fourchette (« 35-50 min ») | Déjà calculable avec `estimatedReadyAt` + haversine |
| **File « nouvelles commandes » séparée** (tablettes partenaires Glovo/UE) | Commandes noyées dans l'historique resto | Onglet Commandes scindé : À traiter / En cours / Terminées | 3 filtres sur la liste existante |
| **Mode économie de données** (UE « lite » régions émergentes) | Forfaits data limités | Toggle profil : images dégradées, animations off `[DOC-UX P2-07]` | Toggle + classe CSS globale |
| À **ne pas** copier | Tips livreur in-app, abonnements (type DashPass), planification multi-créneaux complexe | Prématuré pour le marché et le stade produit | — |

---

## K. Tableau des recommandations

Impact : faible/moyen/élevé/critique · Effort : faible/moyen/élevé · P0 bloque lancement/paiement/livraison/sécurité · P1 expérience professionnelle · P2 conversion/productivité · P3 optimisation.

| ID | Profil | Écran / fonctionnalité | Problème | Recommandation | Impact | Effort | Priorité |
|---|---|---|---|---|---|---|---|
| R-01 | Client | Panier (`CartContext`) | Perdu au refresh | Persistance localStorage + TTL + revalidation prix | Critique | Faible | **P0** |
| R-02 | Client | Checkout | Fallback montants client si validation KO | Bloquer la commande en mode Supabase | Critique | Faible | **P0** |
| R-03 | Client | Panier | Fusion erronée des plats personnalisés | Id composite par combinaison variante/suppléments | Critique | Faible | **P0** |
| R-04 | Client | Commandes | Pas d'annulation | Annuler si pending/confirmed + motif | Critique | Moyen | **P0** |
| R-05 | Resto/Livreur | Statuts | Resto peut marquer « livrée » | Borner resto à `ready` ; RLS côté base | Critique | Faible | **P0** |
| R-06 | Client/Livreur | Suivi & messages | Boutons fantômes, tracking simulé | Retirer les toasts factices ; `tel:`/`wa.me` réels ; badge « position estimée » | Élevé | Faible | **P0** |
| R-07 | Tous | Auth OTP | Mode mock silencieux en prod | Vraie vérification SMS obligatoire avant lancement | Critique | Moyen | **P0** |
| R-08 | Client | Checkout/fiche resto | Minimum de commande invisible | Afficher + bloquer sous le seuil avec delta (« Ajoutez 700 FCFA ») | Élevé | Faible | **P1** |
| R-09 | Resto | Annulation | Sans motif | Dialog motifs prédéfinis, visibles client+admin | Élevé | Moyen | **P1** |
| R-10 | Resto | Menu | Variantes/suppléments non créables | Section Options dans le formulaire (wizard 2-3 étapes `[DOC-UX P1-03]`) | Élevé | Moyen | **P1** |
| R-11 | Resto | Dashboard | Toggle Ouvert/Fermé enfoui + double nav | Toggle dans le header ; supprimer les onglets internes, sidebar seule (+ Livreurs avec URL) | Élevé | Moyen | **P1** |
| R-12 | Livreur | Courses dispo | Rémunération non affichée, distances factices | Afficher `deliveryFee` en avant ; géoloc réelle du livreur + haversine | Élevé | Moyen | **P1** |
| R-13 | Livreur | Livraison | Pas de preuve de livraison | Code de confirmation 4 chiffres (cf. benchmark) | Élevé | Moyen | **P1** |
| R-14 | Livreur | Espèces | Montant à encaisser ambigu | Carte « À encaisser : X FCFA (espèces) » + récap fin de course | Élevé | Faible | **P1** |
| R-15 | Livreur | Incidents | Client injoignable, adresse introuvable | 3 actions d'incident réelles avec notification admin | Élevé | Moyen | **P1** |
| R-16 | Admin | Commandes | Lecture seule | Fiche détail + annuler/réassigner/contacter | Élevé | Élevé | **P1** |
| R-17 | Admin | Litiges | Liste passive | Statut ouvert/en cours/résolu + motif + décision | Élevé | Moyen | **P1** |
| R-18 | Admin | Clients | Page inexistante | Liste + recherche + historique + blocage | Élevé | Moyen | **P1** |
| R-19 | Admin | Promotions | Codes promo non administrables | CRUD codes (montant, quota, période, resto) | Élevé | Moyen | **P1** |
| R-20 | Tous | Temps réel | Polling 5 s généralisé | Supabase Realtime + repli 30-60 s + pause onglet caché | Élevé | Moyen | **P1** |
| R-21 | Client | Fiche resto | Fallback `restaurants[0]`, distance en dur, Partager mort | Skeleton + 404 ; distance réelle ou rien ; Web Share API ou retrait | Moyen | Faible | **P1** |
| R-22 | Resto | Profil | Horaires texte libre + reload | Champs structurés jour/heure ; state update sans reload | Moyen | Moyen | **P1** |
| R-23 | Client | Commandes | Pas de re-commande | Bouton « Recommander » (recharge le panier) | Élevé | Faible | **P2** |
| R-24 | Client | Recherche | /restaurants vs /explorer dupliqués | Page unifiée avec toggle Restaurants/Plats `[DOC-UX P2-02]` | Moyen | Élevé | **P2** |
| R-25 | Client | Onboarding | Première visite sans guidance `[DOC-UX P1-01]` | 3 écrans (valeur, ville, compte) + flag localStorage | Moyen | Faible | **P2** |
| R-26 | Tous | Réseau | Pas d'indicateur hors-ligne `[DOC-UX P2-06]` | Bandeau `navigator.onLine` global | Moyen | Faible | **P2** |
| R-27 | Tous | Data | Pas de mode économie de données `[DOC-UX P2-07]` | Toggle : images dégradées + animations off | Moyen | Moyen | **P2** |
| R-28 | Tous | Images | Base64 en base | Upload serveur média + compression client | Élevé | Moyen | **P2** |
| R-29 | Tous | A11y | Contraste, clavier, reduced-motion `[DOC-UX P2-03]` | Foncer text-muted (≥ #6B7280), focus visibles, media queries | Moyen | Moyen | **P2** |
| R-30 | Livreur | Confort | Pas de dark mode, pas de son `[DOC-UX P2-05]` | next-themes (déjà installé) + bip nouvelle course | Moyen | Faible | **P2** |
| R-31 | Client | Avis | « Client MiamExpress » anonyme | Prénom + initiale + badge commande vérifiée | Moyen | Faible | **P2** |
| R-32 | Resto | Livreurs préférés | Ajout par ID brut | Proposer les livreurs des dernières courses livrées | Moyen | Faible | **P2** |
| R-33 | Client | Suivi | Tracking simulé | Positions livreur temps réel (Realtime) `[DOC-UX P3-01]` | Élevé | Élevé | **P2** |
| R-34 | Client | PWA/offline | Pas de service worker | vite-plugin-pwa + cache catalogue | Moyen | Moyen | **P3** |
| R-35 | Client | i18n | EN annoncé, absent | react-i18next, FR d'abord, EN ensuite | Moyen | Élevé | **P3** |
| R-36 | Client | Fidélité/parrainage `[DOC-UX P3-02]` | Prématuré | Après stabilisation de la boucle opérationnelle | Moyen | Élevé | **P3** |
| R-37 | Client | Livraison programmée `[DOC-UX P3-04]` | Demande bureaux DLA/YDE | Créneau « Plus tard » au checkout | Moyen | Élevé | **P3** |
| R-38 | Admin | Paramètres | Commission en dur, pas d'exports/journal | Page Paramètres + exports CSV + audit log | Moyen | Élevé | **P3** |

---

## L. Quick wins (fort impact, réalisables vite, sans refonte)

1. **R-01 Panier persistant** — quelques lignes dans `CartContext`.
2. **R-03 Id composite plats personnalisés** — corrige des commandes fausses.
3. **R-02 Blocage si validation serveur KO** — supprimer le fallback silencieux.
4. **R-06 Retrait des boutons fantômes** + liens `tel:`/`wa.me` réels.
5. **R-05 Borner les statuts restaurant à `ready`** — une condition dans `nextStatus`.
6. **R-12 (partiel) Afficher la rémunération livreur** — la donnée `deliveryFee` est déjà dans l'objet.
7. **R-08 Minimum de commande affiché/bloquant** — `minOrder` existe déjà sur le restaurant.
8. **R-23 Bouton « Recommander »** — recharge `items` dans le panier.
9. **R-21 Corriger `restaurant ?? restaurants[0]`**, retirer « 1,2 km » et le Partager mort.
10. **R-11 (partiel) Toggle Ouvert/Fermé dans le header** du dashboard resto.
11. **Remplacer `window.prompt`/`alert`** par les dialogs shadcn déjà présents dans le projet.
12. **R-30 (partiel) Bip nouvelle course livreur** — réutiliser `playNewOrderSound` du resto.
13. `[DOC-UX P1-08]` **Message de conflit panier plus empathique** — nommer les deux restaurants dans le dialog.

---

## M. Fusion avec OPTIMISATION_UX_YAMO.md — points complémentaires retenus et corrections

**Points du document que mon audit n'avait pas mis en avant, intégrés ci-dessus** : onboarding première visite (P1-01/R-25) ; inversion du flux d'adresse « carte d'abord + reverse geocoding » (P1-02 — retenu en variante de R du checkout, effort 3/5) ; wizard d'ajout de plat (P1-03/R-10) ; indicateur réseau (P2-06/R-26) ; mode économie de données (P2-07/R-27) ; dark mode livreurs (P2-05/R-30) ; contraste/clavier (P2-03/R-29) ; intégration WhatsApp (P3-03/R-06) ; livraison programmée (P3-04/R-37) ; recherche vocale (P3-05 — classée P3, pertinence réelle mais après les fondamentaux) ; aperçu client du menu resto (P2-10) ; bouton « tester le son » ; période « Aujourd'hui » des gains ; tableau de KPIs et méthodes de test terrain (tests guérilla, bêta WhatsApp, sessions in-situ) — **repris tels quels comme annexe méthodologique valide**.

**Corrections apportées au document** (le code contredit ces affirmations) :
- *« Absence de confirmation après commande »* → **faux** : `Checkout.tsx:325-352` affiche un écran de confirmation dédié (référence + CTA suivi). L'amélioration possible est d'y ajouter l'ETA et le récapitulatif, pas de le créer.
- *« Absence de fil d'Ariane »* → **partiellement faux** : des breadcrumbs existent dans les heros de `Checkout`, `Orders`, `Restaurants` ; il en manque sur `RestaurantDetail` et `DishDetail` uniquement.
- *« Formulaire de plat demande variantes/suppléments »* → **inverse du réel** : le formulaire ne les propose pas du tout — c'est précisément le problème (R-10).
- *« Pas de recherche/filtres sur les candidatures admin »* (P2-09) → **déjà implémenté** : `AdminApplications.tsx` a onglets par statut + recherche.
- *« PWA ready »* (forces) → **à nuancer** : icônes/manifest peut-être, mais aucun service worker n'est enregistré ; l'app ne fonctionne pas hors-ligne.
- Le refresh 5 s est encore plus étendu que décrit : il concerne aussi les commandes client et **toutes** les pages admin.

---

## N. Plan d'action

### Phase 1 — Corrections critiques (avant lancement, ~2-3 semaines)
R-01 à R-07 (P0 intégral) : panier persistant, blocage validation serveur, id composite personnalisation, annulation client, statuts bornés par rôle, suppression des fonctionnalités fantômes + liens réels tel/WhatsApp, OTP SMS réel. Plus quick wins n°6-11 (rémunération livreur, minimum de commande, corrections fiche resto, toggle Ouvert/Fermé, dialogs).

### Phase 2 — Optimisation des parcours (~3-4 semaines)
R-09 motifs d'annulation · R-10 variantes/suppléments · R-11 navigation back-office unifiée · R-13/14/15 preuve de livraison, espèces, incidents · R-16/17/18/19 fiche commande admin, litiges actionnables, page clients, codes promo · R-20 Realtime à la place du polling · R-22 horaires structurés · R-25 onboarding · R-26 indicateur réseau.

### Phase 3 — Conversion & fidélisation (~4-6 semaines)
R-23 re-commande · R-24 recherche unifiée · R-27 mode data-saver · R-28 pipeline images · R-29 accessibilité · R-30 dark mode + son livreur · R-31 avis nominatifs · R-32 livreurs préférés utilisables · R-33 tracking temps réel réel · mise en place des KPIs (annexe DOC-UX) et premiers tests terrain à Douala/Yaoundé.

### Phase 4 — Évolution avancée (après validation marché)
R-34 PWA/offline complet · R-35 i18n EN · R-36 fidélité/parrainage · R-37 livraison programmée · R-38 paramètres/exports/journal admin · recherche vocale · recommandations personnalisées · carte plein écran des restos · gamification livreurs · cuisine fantôme · app native (reprise des P4 du DOC-UX, dans cet ordre de dépendance).

---

## O. Verdict final

1. **À conserver (ne pas toucher)** : design system et identité visuelle ; structure du checkout (adresse quartier+repère+carte) ; workflow candidatures admin ; réception de commandes resto (son, urgence, temps de préparation) ; finances resto ; gains/virements livreur ; RoleGate et séparation des profils ; mode mock de développement ; dialog de conflit de panier ; mécanique « livreurs préférés » (le concept, pas l'UI d'ajout).
2. **À corriger** : persistance du panier, fallback montants, id de personnalisation, statuts par rôle, fallback `restaurants[0]`, valeurs codées en dur (distance, « 500 restaurants », commission), `window.prompt`/`reload`, contraste, N+1 avis, polling.
3. **À restructurer** : navigation back-office resto (sidebar unique + toggle header) et livreur (une seule bottom nav) ; onglet Commandes resto en 3 files (à traiter/en cours/terminées) ; recherche client unifiée ; sidebar admin sectionnée (sans méga-menu).
4. **À ajouter** : annulation client avec motif, motifs d'annulation resto, variantes/suppléments dans le formulaire menu, rémunération + géoloc réelle + preuve de livraison + gestion espèces + incidents livreur, fiche commande admin + litiges actionnables + page clients + CRUD codes promo, notifications (Realtime puis push), indicateur réseau, onboarding, re-commande 1-clic.
5. **À supprimer ou fusionner** : boutons de messages simulés (client et livreur), carte de supervision admin factice (jusqu'à branchement réel), bouton Partager inactif, segmented control livreur redondant, barre d'onglets interne resto ; fusionner `/explorer` dans `/restaurants`.
6. **Avant le lancement** : Phase 1 intégrale + R-09 (motifs) + R-13/R-14 (preuve de livraison, espèces) + OTP SMS réel + Realtime minimal sur les statuts de commande. Sans cela, les premiers incidents réels (annulation, litige, espèces) n'auront aucun chemin de résolution dans le produit.
7. **Peut attendre** : i18n EN, PWA/offline complet, fidélité, parrainage, livraison programmée, recherche vocale, recommandations IA, app native, gamification — toute la Phase 4.

L'objectif n'est pas d'ajouter des fonctionnalités : c'est de **rendre vraies celles qui sont simulées, de fermer la boucle opérationnelle des incidents, et de blinder l'app pour un réseau 3G** — le reste du produit est déjà à un niveau professionnel.
