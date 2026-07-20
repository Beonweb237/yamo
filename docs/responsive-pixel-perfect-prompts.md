# Prompts successifs — Audit & correction responsive pixel-perfect (série PIX)

> **Usage** : chaque section ci-dessous est un prompt autonome à donner à Claude Code, dans l'ordre.
> Chaque prompt suppose que les précédents sont terminés et validés (voir le document de
> coordination `responsive-pixel-perfect-coordination.md`).
> Un prompt = une session (ou un segment de session) = un périmètre fermé = un build vert à la fin.

---

## Bloc de contexte commun (à coller en tête de CHAQUE prompt)

```
CONTEXTE PROJET — MiamExpress/Yamo, livraison de repas au Cameroun.
Stack : React 19 + TypeScript + Vite 6 + Tailwind + shadcn/ui. Travailler depuis app/.
Mode mock localStorage actif (pas de backend requis). Lancer avec `npm run dev` depuis app/.

VÉRITÉ DES TOKENS (source : tailwind.config.js + src/index.css — PAS le brief d'origine) :
- green-primary #157F3D | green-dark #0E5C2C | green-light #E8F5EE
- gold-accent #D4A843 | gold-light #FDF5E0
- text-primary #1F2937 | text-secondary #4B5563 | text-muted #6B7280 (CONF-31, AA 4.8:1 — NE PAS revenir à #9CA3AF)
- border-custom #E5E7EB | border-light #F3F4F6 | bg-main #FFFFFF | bg-secondary #F9FAFB
- error #EF4444 | success #10B981
- Polices : titres = 'Source Sans 3' (les classes font-poppins/font-heading SONT des alias de Source Sans 3 — ne pas introduire Poppins), corps = Inter.
- Navbar : 72px de haut (cf. NetworkBanner topOffset={72} dans Layout.tsx).
- MobileBottomNav : hauteur 56px (spacer h-14), masquée sur /admin, /partenaires/dashboard, /livreurs/dashboard, cachée dès md:.
- ScrollToTop : fixed bottom-20 right-4 (mobile) / md:bottom-6 md:right-6, z-30, seuil 400px.
- Toaster sonner : position bottom-center (attention aux collisions avec BottomNav/sticky bars).

ROUTES RÉELLES (source : src/App.tsx — fait foi) :
/ , /restaurants (?mode=plats), /restaurant/:slug, /article/:slug (fiche plat),
/checkout, /commandes, /profil, /favoris, /connexion, /inscription[...], /candidature,
/partenaires, /livreurs, /contact, /demandes/nouvelle, /demandes/mes-demandes,
/partenaires/dashboard[/menu|/livreurs|/profile|/finances], /livreurs/dashboard[/courses|/gains],
/admin/[dashboard|applications|orders|restaurants|drivers|disputes|dishes|zones|delivery-fees|media|customers|reviews|trash]

BREAKPOINTS À TESTER (dans cet ordre) :
360×640 (prioritaire), 375×812, 768×1024, 1280×800, 1440×900, 1920×1080.

RÈGLES STRICTES :
- Lire chaque fichier avant de l'éditer. Petites modifications ciblées, pas de refonte.
- Ne pas toucher aux tokens sauf contraste < 4.5:1 avéré. Ne pas changer l'identité vert/or.
- Aucune nouvelle librairie. Aucune fonctionnalité supprimée ou remplacée.
- Boutons/cibles tactiles ≥ 44px, focus ring vert visible, pas de scroll horizontal.
- Ne pas aggraver la dette connue (polling 5s, branches Supabase : ne pas y toucher).
- Après chaque correction : `npm run build` (tsc -b && vite build) doit passer.
- `npm run lint` a ~79 erreurs pré-existantes : ne pas en introduire de NOUVELLES dans
  les fichiers touchés (comparer avant/après fichier par fichier).
- Reporter chaque constat dans docs/responsive-pixel-perfect-tracking.md (voir doc de coordination).
```

---

## PIX-00 — Mise en place, baseline et harnais de vérification

**Objectif** : préparer l'environnement de test et figer l'état de référence AVANT toute correction.

```
[Bloc de contexte commun]

MISSION PIX-00 :
1. Démarre le serveur dev (`npm run dev` depuis app/) et ouvre l'app dans le navigateur intégré.
2. Exécute `npm run build` et note le résultat exact (baseline : doit passer sans erreur).
3. Exécute `npm run lint` et sauvegarde la liste des erreurs par fichier dans
   docs/responsive-pixel-perfect-tracking.md (section "Baseline lint") — c'est la référence
   pour vérifier qu'aucune nouvelle erreur n'est introduite ensuite.
4. Crée le fichier docs/responsive-pixel-perfect-tracking.md à partir du gabarit fourni
   dans responsive-pixel-perfect-coordination.md (§ Fichier de suivi).
5. Prépare des données mock exploitables : ajoute 2-3 plats au panier (dont un personnalisé),
   crée une commande de test, connecte un compte client mock — pour que Checkout, /commandes
   et /profil soient auditables avec du contenu réel.
6. Vérifie la méthode de resize : utiliser resize_window aux 6 breakpoints et confirmer
   que le viewport rend correctement à 360×640.

LIVRABLE : tracking.md initialisé (baseline build + lint + état des données mock),
confirmation que les 6 breakpoints sont testables. AUCUNE correction de code dans ce lot.
```

**Critère de sortie** : tracking.md existe, build vert confirmé, données mock en place.

---

## PIX-01 — Audit & correction du squelette transverse (Layout, Navbar, BottomNav, Footer, overlays)

**Objectif** : fiabiliser d'abord ce qui est présent sur TOUTES les pages. Tout défaut ici se propage partout ; le corriger avant les pages évite de re-corriger.

```
[Bloc de contexte commun]

MISSION PIX-01 — Composants transverses. Fichiers :
src/components/Layout.tsx, Navbar.tsx, MobileBottomNav.tsx, Footer.tsx, ScrollToTop.tsx,
NetworkBanner.tsx, ActiveOperationsBar.tsx, OnboardingOverlay.tsx.

Aux 6 breakpoints, vérifier et corriger :

NAVBAR (72px) :
- Hauteur constante 72px à tous les breakpoints ; aucun saut de layout à l'ouverture du mega-menu.
- Mega-menu desktop : pas de flash au hover, pas de débordement à 1280px, fermeture propre.
- Menu hamburger mobile : ouverture/fermeture fluide, tous les liens atteignables,
  scroll interne si le menu dépasse la hauteur du viewport à 360×640.
- Logo + actions : pas de chevauchement à 360px ; badge panier lisible.
- Le contenu de page commence bien SOUS la navbar (offset 72px) sur toutes les pages —
  vérifier qu'aucune page ne « remonte » sous la navbar.

MOBILEBOTTOMNAV (56px, 5 onglets + panier conditionnel) :
- À 360px avec panier plein : 6 items — vérifier qu'aucun label n'est coupé sans truncate,
  pas de débordement horizontal, cibles ≥ 44px de large effective.
- Badge panier : lisible, pas rogné par overflow.
- Spacer h-14 : vérifier que chaque page cliente a son contenu entièrement accessible
  au-dessus de la nav (rien de masqué derrière).
- Masquage confirmé sur /admin, /partenaires/dashboard, /livreurs/dashboard.

EMPILEMENT VERTICAL BAS D'ÉCRAN (mobile) — c'est LE point de collision du projet :
MobileBottomNav (z-40) + ScrollToTop (bottom-20, z-30) + Toaster sonner (bottom-center)
+ ActiveOperationsBar + sticky bars de pages (panier RestaurantDetail, CTA DishDetail).
- Scroller > 400px sur chaque page clé et déclencher un toast : vérifier qu'aucun élément
  n'en recouvre un autre ni ne bloque un tap. Documenter la pile z-index constatée.

FOOTER :
- Grille de colonnes : 1 col à 360px, passage propre à 2/4 colonnes ; pas de lien orphelin ;
  contrastes des liens sur fond du footer ≥ 4.5:1 ; pas de débordement des adresses/emails longs.

SCROLLTOTOP :
- Apparition après 400px, disparition en haut ; ne chevauche ni la BottomNav ni les sticky bars.

NETWORKBANNER / ONBOARDING :
- NetworkBanner à topOffset 72 : ne recouvre pas le contenu, disparaît proprement.
- OnboardingOverlay (première visite, / uniquement) : centré, pas de débordement à 360×640,
  fermable au clavier.

Pour CHAQUE problème : fiche complète (description, fichier:ligne, code avant, code après,
breakpoint) dans tracking.md, sévérité 🔴/🟠/🟡. Corriger dans la foulée les 🔴 et 🟠.
Terminer par npm run build + re-test visuel des breakpoints touchés + captures avant/après.
```

**Critère de sortie** : aucune collision bas d'écran, navbar/bottomnav/footer irréprochables aux 6 breakpoints, build vert.

---

## PIX-02 — Home (`/`)

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01 terminé (squelette fiable).

MISSION PIX-02 — src/pages/Home.tsx (+ composants qu'elle importe : AppImage, DistanceBadge…).

Aux 6 breakpoints, dérouler la checklist complète :

HERO :
- Hauteur et respiration correctes à 360×640 (le hero ne doit pas manger tout le viewport
  ni laisser le CTA sous la ligne de flottaison sans indice de scroll).
- h1 : ≥ 24px mobile / ≥ 32px desktop, Source Sans 3 effective (inspecter computed style,
  pas de fallback système visible).
- CTA : ≥ 44px de haut, contraste texte/fond ≥ 4.5:1, active:scale-95 présent.
- Image/illustration : object-cover, pas de déformation, pas de CLS au chargement.

CATÉGORIES :
- Scroll horizontal éventuel : fluide, sans scrollbar visible (scrollbar-hide), et SANS
  provoquer de scroll X de la page elle-même (vérifier document.documentElement.scrollWidth
  === clientWidth à 360px).
- Cibles tactiles ≥ 44px ; labels non tronqués sans ellipsis.

RESTAURANTS VEDETTES :
- Grille : 1 col à 360, 2 à 768, 3-4 à 1280+ ; gaps cohérents (16px mobile / 24px+ desktop).
- Cartes : border-border-custom visible, ombre cohérente, arrondi rounded-xl/2xl uniforme,
  image object-cover ratio stable, fallback ImageOff si image manquante (tester en coupant
  une URL), nom de resto long → truncate, badges (note, temps, distance) sans chevauchement.
- États : skeleton au chargement, empty state si aucune donnée.

SECTIONS SECONDAIRES (bandeaux partenaires/livreurs, etc.) :
- Empilement propre en mobile ; marges latérales 16px mobile / 24px tablette / 32px+ desktop
  cohérentes avec le reste de la page.

MESURES OBLIGATOIRES à 360×640 : scrollWidth de la page, hauteur réelle du h1,
hauteur des CTA principaux (getBoundingClientRect). Corriger au pixel, pas à l'œil.

Fiches + corrections + build + captures avant/après comme en PIX-01.
```

---

## PIX-03 — Restaurants (`/restaurants`, y compris `?mode=plats` / DishResults)

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01, PIX-02.

MISSION PIX-03 — src/pages/Restaurants.tsx + src/components/DishResults.tsx
+ LazyDeliveryMap/DeliveryMap.tsx + ZoneAlertBanner.tsx + AddressAutocomplete.tsx.

À tester dans les DEUX modes (restaurants ET ?mode=plats), aux 6 breakpoints :

BARRE DE RECHERCHE + FILTRES :
- Input : fond blanc, bordure visible, focus ring vert, hauteur ≥ 44px.
- Rangée de filtres (ville/quartier/tri) : à 360px, soit wrap propre, soit scroll horizontal
  contenu (sans scroll X de page). Selects lisibles, chevrons non écrasés.
- Le switch de mode restaurants/plats : état actif évident, ≥ 44px, pas de layout shift.
- Deep-links : /restaurants?mode=plats&q=poulet doit restituer l'UI cohérente (champ pré-rempli).

CARTE LEAFLET :
- Hauteur ~220px mobile / ~380px desktop ; lazy-load effectif (vérifier qu'elle ne charge
  pas avant d'être visible) ; pas de débordement du conteneur ; contrôles zoom ≥ 44px
  et non recouverts ; les tuiles remplissent le conteneur après resize (invalidateSize).
- Marqueurs cliquables au doigt ; popup non coupée par les bords du conteneur.

LISTE RÉSULTATS :
- Grille responsive 1→2→3 cols ; cartes identiques à Home (cohérence stricte).
- Mode plats (DishResults) : cartes plat — prix aligné, nom multi-resto lisible,
  toggle « pour soi / pour quelqu'un d'autre » accessible.
- États loading (skeleton), empty (« aucun résultat » + action reset filtres), error.
- Scroll infini/pagination éventuel : pas de saut de scroll.

ZONEALERTBANNER : visible sans pousser le layout brutalement, refermable, pas de collision navbar.

MESURES : scrollWidth à 360px dans les 2 modes, avec la carte ouverte et filtres dépliés.
Fiches + corrections + build + captures.
```

---

## PIX-04 — RestaurantDetail (`/restaurant/:slug`)

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01→03.

MISSION PIX-04 — src/pages/RestaurantDetail.tsx (+ dialog de personnalisation de plat,
sticky bar panier, OrderStatusStepper si présent, AppImage).

Aux 6 breakpoints, avec panier vide PUIS panier rempli :

EN-TÊTE RESTO :
- Image de couverture : ratio stable, object-cover, pas de CLS ; badge ouvert/fermé
  (lib/hours.ts isEffectivelyOpen) lisible ; nom long → wrap propre sans casser le layout ;
  ligne infos (note, temps, frais, distance) : wrap à 360px sans chevauchement.

MENU :
- Navigation par catégories (tabs/ancres) : sticky éventuel sans recouvrir les titres ;
  scroll horizontal des tabs contenu ; catégorie active visible.
- Lignes de plat : image miniature ratio fixe, nom truncate/clamp, description line-clamp,
  prix jamais wrappé seul, bouton + ≥ 44px.

DIALOG PERSONNALISATION (variantes + suppléments) :
- Centré, max-height avec scroll INTERNE (le fond ne scrolle pas), overlay 40% noir,
  pas de débordement à 360×640 ; radios/checkboxes ≥ 44px de zone tactile ;
  total mis à jour lisible ; bouton confirmer toujours visible (sticky en bas du dialog
  si contenu long) ; fermeture Escape + clic overlay.

STICKY BAR PANIER (mobile) :
- Positionnée AU-DESSUS de la MobileBottomNav (pas de chevauchement, pas d'écart) ;
  total + nb articles lisibles ; ne recouvre pas le dernier plat de la liste
  (padding-bottom du contenu suffisant) ; z-index cohérent avec la pile documentée en PIX-01.
- Desktop : panneau panier latéral ou équivalent — vérifier alignement et scroll interne.

MESURES : à 360px, ouvrir le dialog du plat le plus riche en options ET remplir le panier,
vérifier scrollWidth, tester le parcours tap complet au doigt (zones ≥ 44px).
Fiches + corrections + build + captures.
```

---

## PIX-05 — DishDetail (`/article/:slug`)

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01→04.

MISSION PIX-05 — src/pages/DishDetail.tsx.

Aux 6 breakpoints :
- Image plat : grande à mobile sans pousser le titre hors écran, object-cover.
- Bloc multi-restaurants (le même plat chez plusieurs restos) : cartes comparatives —
  prix alignés, resto sélectionné évident, tap ≥ 44px, pas de débordement du tableau/liste
  comparative à 360px (scroll interne si nécessaire).
- Sticky bar CTA (ajouter au panier) : mêmes règles qu'en PIX-04 — au-dessus de la
  BottomNav, sans masquer le contenu final, quantité +/− ≥ 44px chacun.
- Tags diététiques / badges : wrap propre, contraste suffisant.
- Lien retour / breadcrumb : cliquable, pas sous la navbar.
- Slug inexistant : état d'erreur propre (pas d'écran blanc).

Fiches + corrections + build + captures.
```

---

## PIX-06 — Checkout (`/checkout`)

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01→05. Panier rempli (dont 1 plat personnalisé) obligatoire.

MISSION PIX-06 — src/pages/Checkout.tsx + AddressPickerMap/LazyAddressPickerMap.tsx
+ AddressAutocomplete.tsx. Page la plus critique du produit : tolérance zéro.

Aux 6 breakpoints, dérouler le PARCOURS COMPLET (pas seulement l'affichage statique) :

ADRESSE :
- Inputs : fond blanc, bordure visible, focus ring vert, labels associés, hauteur ≥ 44px,
  erreurs de validation affichées SOUS le champ concerné sans décaler brutalement le layout.
- Autocomplétion : liste déroulante non coupée par un overflow parent, sélection tactile.
- AddressPickerMap : hauteur mobile correcte, le marqueur se déplace au tap, la carte ne
  capture pas le scroll de page de façon piégeuse à 360px (vérifier qu'on peut scroller
  la page en touchant à côté de la carte).
- Adresses sauvegardées : cartes sélectionnables, état sélectionné évident, ≥ 44px.

LIVRAISON & PAIEMENT :
- Options (radio cards) : zone tactile = toute la carte, état actif contrasté,
  empilement 1 col mobile / 2 cols desktop.
- Champs téléphone MoMo/OM : clavier numérique (inputmode), format visible.

RÉCAPITULATIF :
- Lignes article : nom du plat personnalisé (variante + suppléments) lisible sans déborder,
  prix alignés à droite, sous-total/frais/total hiérarchisés, total en évidence.
- Mobile : récap accessible sans perdre le bouton payer ; bouton payer ≥ 48px,
  jamais masqué par la BottomNav ni par le clavier virtuel (tester champ focus + layout).
- Desktop : colonne récap sticky sans chevaucher le footer.

ÉTATS : panier vide → redirection/message propre ; erreur de validation serveur →
message actionnable ; loading pendant la validation → bouton désactivé avec spinner.

MESURES : scrollWidth à 360px à chaque étape ; hauteur du bouton payer ;
simulation clavier ouvert (focus dans un input en bas de formulaire).
Fiches + corrections + build + captures. NE PAS toucher à la logique de paiement/validation.
```

---

## PIX-07 — Orders (`/commandes`)

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01→06. Au moins une commande mock à chaque statut clé.

MISSION PIX-07 — src/pages/Orders.tsx + OrderStatusStepper.tsx + DeliveryMap.tsx.

Aux 6 breakpoints :
- Liste des commandes : cartes avec statut coloré contrasté, date/heure lisibles,
  total aligné, tap pour déplier ≥ 44px, skeleton + empty state (« aucune commande » + CTA).
- OrderStatusStepper : à 360px les étapes tiennent SANS scroll X — labels raccourcis ou
  stepper vertical, mais jamais de débordement ; étape courante évidente ;
  états passé/courant/futur distincts au contraste.
- Carte de suivi livreur (DeliveryMap) : h-[220px] mobile / h-[380px] desktop, lazy,
  marqueurs resto/livreur/client distincts, pas de débordement.
  (Le tracking est simulé — dette connue — ne pas y toucher, auditer seulement le rendu.)
- Boutons d'action (annuler, contacter, renouveler) : ≥ 44px, wrap propre à 360px.
- Détail d'une commande avec plat personnalisé long : pas de débordement du nom composite.

Fiches + corrections + build + captures.
```

---

## PIX-08 — Profile (`/profil`) + Favorites (`/favoris`)

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01→07.

MISSION PIX-08 — src/pages/Profile.tsx + src/pages/Favorites.tsx.

PROFILE, aux 6 breakpoints :
- En-tête (photo + nom + téléphone) : photo ronde ratio fixe, upload photo accessible,
  nom long → truncate.
- Accès rapides / stats : grille 2 cols à 360px sans écrasement, chiffres lisibles.
- Adresses sauvegardées : cartes avec actions (éditer/supprimer) ≥ 44px, adresse longue
  (quartier + repère) → wrap propre ; formulaire d'ajout : mêmes règles inputs que PIX-06.
- Sélecteur de langue, WhatsApp : alignements, pas de débordement.
- Bouton déconnexion : visible, pas masqué par la BottomNav.

FAVORITES :
- Deux sections (restos + plats) : mêmes cartes que Restaurants/DishResults (cohérence
  stricte, ne pas dupliquer des styles divergents) ; empty state par section avec CTA
  vers /restaurants ; retrait d'un favori → feedback toast + disparition sans saut brutal.

Fiches + corrections + build + captures.
```

---

## PIX-09 — Auth : Login, Inscription, Candidature

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01→08.

MISSION PIX-09 — src/pages/Login.tsx, Inscription.tsx, Candidature.tsx
+ components/ApplicationForm.tsx + RoleGate.tsx (formulaire login admin intégré).

Pour CHAQUE variante de rôle (client, restaurant, livreur, admin), aux 6 breakpoints :
- Carte du formulaire : centrée, max-width raisonnable desktop, marges 16px mobile,
  jamais sous la navbar, pas coupée en bas à 360×640 (page scrollable).
- Inputs : fond blanc, bordure visible, focus vert, ≥ 44px, labels + placeholders distincts,
  autocomplete/inputmode adaptés (tel pour téléphone).
- Messages d'erreur : sous le champ, couleur error, sans jump de layout ;
  RoleMismatchError : message clair, lien vers la bonne page de connexion.
- Liens secondaires (mot de passe, inscription↔connexion, autre rôle) : ≥ 44px de zone
  tactile, pas collés les uns aux autres à 360px.
- ApplicationForm (candidature) : formulaire long — progression/sections claires,
  upload de documents : zone de drop utilisable au doigt, nom de fichier long → truncate,
  preview sans débordement ; bouton submit jamais masqué.
- RoleGate login admin (/admin sans auth) : même qualité que Login.tsx.

Fiches + corrections + build + captures.
```

---

## PIX-10 — RestaurantDashboard (`/partenaires/dashboard*`)

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01→09. Compte resto mock connecté, commandes mock en attente.

MISSION PIX-10 — src/pages/RestaurantDashboard.tsx + components/BackOfficeLayout.tsx.
Rappel : 4 routes rendent le MÊME composant avec prop tab ; l'onglet drivers est interne.
La MobileBottomNav est masquée ici : le back-office doit être autonome en mobile.

Aux 6 breakpoints, pour CHAQUE onglet (commandes, menu, livreurs, profile, finances) :

BACKOFFICELAYOUT :
- Sidebar : desktop fixe sans chevaucher le contenu ; mobile → drawer/hamburger utilisable,
  liens ≥ 44px, item actif évident ; topbar ne déborde pas à 360px.
- Le contenu principal a ses propres marges (16/24/32px) et aucun scroll X.

ONGLET COMMANDES :
- Cartes/lignes de commande : statut, heure, total, actions (accepter/refuser/prêt) ≥ 44px ;
  à 360px les actions passent en colonne ou wrap propre, jamais hors écran.
- Toggle son + toggle ouvert/fermé : accessibles, état évident.

ONGLET MENU :
- Liste des plats : image miniature, dispo on/off, éditer — utilisable au doigt ;
  dialog/formulaire d'édition de plat : scroll interne, upload image (lib/media.ts) avec
  preview contenue, champs prix numériques ; à 360px tout le formulaire est atteignable.

ONGLET FINANCES : chiffres/graphes — pas de tableau qui déborde (wrapper overflow-x-auto
  avec ombre de scroll si besoin), montants formatés alignés.

ONGLETS LIVREURS + PROFILE : listes et formulaires aux mêmes standards.

Fiches + corrections + build + captures. Ne pas toucher au polling 5s existant.
```

---

## PIX-11 — DriverDashboard (`/livreurs/dashboard*`)

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01→10. Compte livreur mock, courses mock disponibles.

MISSION PIX-11 — src/pages/DriverDashboard.tsx (+ BackOfficeLayout déjà audité en PIX-10 :
ne re-corriger que ce qui est spécifique livreur).
Contexte d'usage : téléphone en main, en mouvement, plein soleil → exigence tactile maximale.

Aux 6 breakpoints (mobile d'abord, c'est l'écran réel du livreur) :
- Toggle en ligne/hors ligne : GROS, contrasté, état sans ambiguïté, feedback immédiat.
- Cartes de course disponibles : resto → destination lisibles en un coup d'œil,
  distance/gain en évidence, boutons accepter/refuser ≥ 48px et espacés (pas de mis-tap),
  adresse longue → wrap sans pousser les boutons hors écran.
- Onglet mes courses : étapes de progression (récupérée, en route, livrée) — boutons
  d'avancement de statut pleine largeur mobile ; carte éventuelle sans débordement.
- Onglet gains : totaux lisibles, historique — tableau scrollable en interne si large ;
  demande de paiement : formulaire aux standards inputs.
- Toggle son nouvelle course : accessible.
- États empty (aucune course) avec message utile.

Fiches + corrections + build + captures. Ne pas toucher au polling ni à stableOffset().
```

---

## PIX-12 — Admin (`/admin/*`, 13 pages)

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01→11. Compte admin mock connecté.

MISSION PIX-12 — src/pages/admin/*.tsx (dashboard, applications, orders, restaurants,
drivers, disputes, dishes, zones, delivery-fees, media, customers, reviews, trash).

L'admin est utilisé surtout desktop, mais DOIT rester utilisable à 360px (gestion en mobilité).
Stratégie : auditer AdminDashboard + AdminOrders + AdminApplications en profondeur aux
6 breakpoints, puis passer les 10 autres pages sur la checklist réduite suivante :

CHECKLIST RÉDUITE (toutes pages admin) :
- Aucun scroll X de page à 360px : tout tableau large est enveloppé dans un conteneur
  overflow-x-auto (le tableau scrolle, pas la page).
- Toolbars (recherche + filtres + boutons) : wrap propre à 360px.
- Dialogs de détail/édition : scroll interne, boutons d'action visibles.
- Badges de statut : contraste ≥ 4.5:1.
- Pagination/compteurs : pas de débordement.

CHECKLIST PROFONDE (dashboard, orders, applications) :
- Dashboard : grille de stat-cards 1→2→4 cols ; graphiques contenus.
- Orders : tableau riche → à 360px, soit cartes empilées, soit scroll interne, jamais illisible ;
  actions par ligne accessibles au doigt.
- Applications : preview documents (base64) contenue, boutons approuver/rejeter ≥ 44px,
  dialog de motif conforme.

Fiches + corrections + build + captures (au moins 360px et 1280px pour chaque page corrigée).
```

---

## PIX-13 — Pages secondaires (Partenaires, Livreurs, Contact, FoodRequest, NotFound)

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01→12.

MISSION PIX-13 — src/pages/Partenaires.tsx, Livreurs.tsx, Contact.tsx,
FoodRequestCreate.tsx, FoodRequestList.tsx, NotFound.tsx.

Aux 6 breakpoints :
- Partenaires/Livreurs (vitrines) : hero + arguments + CTA candidature — mêmes standards
  que Home (PIX-02) ; sections avantages en grille responsive ; CTA ≥ 44px.
- Contact : formulaire aux standards inputs (PIX-06/09) ; liens WhatsApp/téléphone en
  href tel:/wa.me cliquables et ≥ 44px ; carte/adresse sans débordement.
- FoodRequestCreate : formulaire long avec brouillon (miam_draft_food_request) —
  restauration du brouillon sans casse visuelle ; upload/photo contenue ; submit visible.
- FoodRequestList : cartes de demande avec statut ; empty state avec CTA vers /demandes/nouvelle.
- NotFound : centré, message utile, CTA retour accueil, pas sous la navbar.

Fiches + corrections + build + captures.
```

---

## PIX-14 — Passe transverse de finesse (typo, tactile, focus, contraste, micro-détails)

**Objectif** : la passe « pixel-perfect » proprement dite, APRÈS que la structure est saine partout. On chasse ici ce qui reste invisible aux passes page par page.

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01→13 tous verts.

MISSION PIX-14 — Passe transverse sur TOUT src/ (recherche par pattern, pas page par page) :

1. TYPOGRAPHIE :
   - Grep des tailles < text-[13px]/text-xs utilisées pour du texte porteur d'info
     (hors labels de nav/badges) → remonter à ≥ 15px pour le corps.
   - Vérifier h1 unique par page, hiérarchie h1>h2>h3 sans saut.
   - Chasser les textes longs sans truncate/line-clamp dans les cartes (grep des zones à
     contenu dynamique : noms restos, plats, adresses, emails).

2. TACTILE :
   - Grep des boutons/links avec padding faible (p-1, py-0.5, h-8 et moins) qui sont des
     cibles d'action → porter la zone tactile à ≥ 44px (padding ou min-h), sans grossir
     visuellement si le design l'exige (padding invisible acceptable).
   - Vérifier active:scale-95 (ou équivalent feedback) sur les boutons d'action primaires.

3. FOCUS & CLAVIER :
   - Tab-parcours complet sur : Home → Restaurants → RestaurantDetail → Checkout.
     Chaque interactif atteignable, focus visible (ring vert), ordre logique,
     dialogs : focus trap + Escape.
   - Grep des div/span avec onClick sans role/tabIndex/onKeyDown → corriger.

4. CONTRASTE :
   - Vérifier les combinaisons à risque : gold-accent (#D4A843) sur blanc pour du TEXTE
     (ratio ~2.1:1 — insuffisant : réserver l'or aux éléments décoratifs/icônes larges,
     ou utiliser un fond gold-light + texte foncé) ; texte blanc sur green-light ; badges.
   - Tout texte < 18px doit être ≥ 4.5:1. Lister les mesures dans tracking.md.

5. COHÉRENCE :
   - Arrondis : uniformiser sur rounded-xl/rounded-2xl (grep des rounded-md/lg orphelins
     sur des cartes principales).
   - Marges latérales de page : vérifier le pattern unique (ex : px-4 md:px-6 lg:px-8
     + max-w container) — toute page divergente est alignée.
   - Ombres : un seul vocabulaire (shadow-sm cartes / shadow-lg overlays).

6. IMAGES :
   - Grep des <img> hors AppImage → migrer vers AppImage (fallback + lazy) quand pertinent.
   - Vérifier loading="lazy" et dimensions/aspect pour éviter le CLS.

Chaque changement reste une petite modification ciblée. Fiches + build + lint-diff.
```

---

## PIX-15 — Vérification finale et rapport de clôture

```
[Bloc de contexte commun]
PRÉREQUIS : PIX-01→14 terminés.

MISSION PIX-15 — Recette finale, AUCUNE nouvelle correction sauf régression trouvée :

1. `npm run build` : doit passer. Coller la sortie dans tracking.md.
2. `npm run lint` : comparer au baseline PIX-00 fichier par fichier — zéro nouvelle erreur.
   Coller le diff dans tracking.md.
3. PARCOURS DE NON-RÉGRESSION à 360×640 puis 1280×800 (bout en bout, en mock) :
   a. Client : Home → recherche → RestaurantDetail → personnalisation plat → panier →
      Checkout → commande créée → /commandes suivi.
   b. Restaurant : login → dashboard → accepter commande → menu (éditer un plat).
   c. Livreur : login → dashboard → accepter course → avancer les statuts.
   d. Admin : login → dashboard → orders → applications.
   Chaque parcours : zéro erreur console, zéro scroll X, zéro élément masqué/inaccessible.
4. Vérification scroll X automatisée : sur chaque route de la liste, à 360px, évaluer
   document.documentElement.scrollWidth <= window.innerWidth. Lister les résultats.
5. RAPPORT FINAL dans tracking.md :
   - Tableau récapitulatif : page × sévérité × corrigé/reporté.
   - Liste des problèmes REPORTÉS avec justification (rien ne disparaît en silence).
   - Écarts constatés brief vs code (fonts Source Sans 3, tokens CONF-31, routes) actés.
   - Captures finales des 4 pages critiques aux 2 breakpoints extrêmes.

Si une vérification n'a pas pu être exécutée, le dire explicitement dans le rapport.
```

---

## Récapitulatif de la séquence

| # | Lot | Périmètre | Dépend de |
|---|-----|-----------|-----------|
| PIX-00 | Baseline | Env, tracking, données mock | — |
| PIX-01 | Squelette | Layout, Navbar, BottomNav, Footer, overlays, pile z-index | PIX-00 |
| PIX-02 | Home | `/` | PIX-01 |
| PIX-03 | Recherche | `/restaurants` + mode plats + Leaflet | PIX-01 |
| PIX-04 | Fiche resto | `/restaurant/:slug` + dialog + sticky panier | PIX-01, 03 |
| PIX-05 | Fiche plat | `/article/:slug` | PIX-04 |
| PIX-06 | Checkout | `/checkout` + cartes adresse | PIX-04 |
| PIX-07 | Commandes | `/commandes` + stepper + carte | PIX-06 |
| PIX-08 | Profil/Favoris | `/profil`, `/favoris` | PIX-01 |
| PIX-09 | Auth | Login, Inscription, Candidature, RoleGate | PIX-01 |
| PIX-10 | Dash resto | `/partenaires/dashboard*` + BackOfficeLayout | PIX-01 |
| PIX-11 | Dash livreur | `/livreurs/dashboard*` | PIX-10 |
| PIX-12 | Admin | `/admin/*` (13 pages) | PIX-10 |
| PIX-13 | Secondaires | Vitrines, Contact, FoodRequest, 404 | PIX-02 |
| PIX-14 | Finesse | Typo, tactile, focus, contraste, cohérence (transverse) | PIX-01→13 |
| PIX-15 | Recette | Build, lint-diff, parcours, rapport final | Tous |
