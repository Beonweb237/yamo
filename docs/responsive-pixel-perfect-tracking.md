# Tracking — Responsive pixel-perfect (série PIX)

## État des lots
| Lot | Statut | Session/date | 🔴 | 🟠 | 🟡 | Reportés | Build |
|-----|--------|--------------|----|----|----|----------|-------|
| PIX-00 | ✅ terminé | 2026-07-16 | 0 | 0 | 0 | 0 | ✅ |
| PIX-01 | ✅ terminé | 2026-07-16 | 0 | 2 | 3 | 0 | ✅ |
| PIX-02 | ✅ terminé | 2026-07-16 | 0 | 1 | 4 | 0 | ✅ |
| PIX-03 | ✅ terminé | 2026-07-16 | 2 | 4 | 5 | 0 | ✅ |
| PIX-04 | ✅ terminé | 2026-07-16 | 1 | 3 | 4 | 0 | ✅ |
| PIX-05 | ✅ terminé | 2026-07-16 | 0 | 2 | 3 | 0 | ✅ |
| PIX-06 | ✅ terminé | 2026-07-16 | 0 | 0 | 3 | 0 | ✅ |
| PIX-07 | ✅ terminé | 2026-07-16 | 0 | 2 | 1 | 0 | ✅ |
| PIX-08 | ✅ terminé | 2026-07-16 | 1 | 2 | 4 | 0 | ✅ |
| PIX-09 | ✅ terminé | 2026-07-16 | 0 | 1 | 2 | 0 | ✅ |
| PIX-10 | ✅ terminé | 2026-07-16 | 0 | 3 | 2 | 0 | ✅ |
| PIX-11 | ✅ terminé | 2026-07-16 | 0 | 3 | 2 | 0 | ✅ |
| PIX-12 | ✅ terminé | 2026-07-16 | 1 | 1 | 1 | 0 | ✅ |
| PIX-13 | ✅ terminé | 2026-07-16 | 1 | 2 | 0 | 0 | ✅ |
| PIX-14 | ✅ terminé | 2026-07-16 | 0 | 1 | 8 | 0 | ✅ |
| PIX-15 | ✅ terminé | 2026-07-16 | — | — | — | — | ✅ |

Statuts : ⬜ à faire / 🔄 en cours / ✅ terminé / ⛔ bloqué

## Baseline (PIX-00) — 2026-07-16
- **Build** : ✅ `tsc -b && vite build` passe (44.8s, 3766 modules). Warnings connus :
  chunk index-*.js 1.78 MB (> 500 kB) et import mixte supabase.ts — pré-existants, hors périmètre.
- **Lint** : 78 problèmes (76 erreurs, 2 warnings) sur 38 fichiers — référence anti-régression.
  Détail par fichier (fichier → nb problèmes) :
  AddressAutocomplete 3, ApplicationForm 2, BackOfficeLayout 1, DeliveryMap 3, DistanceBadge 2,
  Navbar 2, ZoneAlertBanner 2, ui/badge 1, ui/button-group 1, ui/button 1, ui/carousel 1,
  ui/form 1, ui/navigation-menu 1, ui/sidebar 2, ui/toggle 1, AuthContext 1, mockData 1,
  use-mobile 1, catalog 2, orders 2, supabase 2, Candidature 1, Checkout 3, DishDetail 1,
  DriverDashboard 3, FoodRequestCreate 1, FoodRequestList 1, Inscription 1, Login 2, Profile 1,
  RestaurantDashboard 7, Restaurants 1, AdminCustomers 2, AdminDashboard 12, AdminDeliveryFees 1,
  AdminMedia 5, AdminTrash 2, AdminZones 1.
- **Données mock** : (préparées via localStorage pendant PIX-00, voir ci-dessous)

## Pile z-index constatée (PIX-01)
- z-[100] : OnboardingOverlay
- z-[60] : NetworkBanner (bandeau hors-ligne, top 72)
- z-50 : Navbar (header), drawer mobile + son overlay, dropdowns mega-menu, Dialogs Radix
- z-40 : MobileBottomNav
- z-30 : ActiveOperationsBar, ScrollToTop (désormais côte à côte, plus superposés)
- Toaster sonner : au-dessus de tout (z sonner par défaut), mobileOffset 72px depuis PIX-01-N04

## Fiches de correction

### [PIX-01-N01] ActiveOperationsBar recouverte par le bouton ScrollToTop 🟠
- **Breakpoints** : 360×640 ET 1280×800 (tous)
- **Constat mesuré** : mobile — pill bottom 64px/h53 vs FAB bottom 80px/h44 right-4, chevron
  de la pill masqué ; desktop — les deux en bottom-6/right-6, overlap mesuré true
  (FAB 1196–1240 × 732–776 sur pill 856–1240 × 722–776).
- **Fichier** : src/components/ActiveOperationsBar.tsx:28
- **AVANT** : `fixed z-30 inset-x-0 … bottom-[64px] md:bottom-6 … md:right-6 … px-3`
- **APRÈS** : `fixed z-30 left-0 right-16 … bottom-[76px] md:bottom-5 … md:left-auto md:right-[84px] … pl-3`
  (le coin bas-droit est réservé au FAB ; centres verticaux alignés à ≤1px)
- **Statut** : ✅ corrigé — vérifié : overlap=false, centres 753/754 desktop, alignés mobile.

### [PIX-01-N02] Boutons icônes navbar/drawer à 36×36px (< 44px) 🟠
- **Breakpoints** : tous (mobile critique)
- **Constat mesuré** : panier mobile, hamburger, panier desktop, bouton Fermer du drawer :
  36×36px (p-2 + icône 20px), mesuré getBoundingClientRect.
- **Fichier** : src/components/Navbar.tsx:231, 279, 288, 313
- **AVANT** : `p-2 rounded-lg …`
- **APRÈS** : `min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg …`
- **Statut** : ✅ corrigé (44×44px, rendu visuel inchangé).

### [PIX-01-N03] Liens footer : zone tactile 20px, pitch ~30px 🟡
- **Breakpoints** : 360×640
- **Fichier** : src/components/Footer.tsx (liens rapides, catégories, boutons légaux, sociaux)
- **APRÈS** : `py-1` sur les liens de liste, `py-2` sur les boutons légaux, sociaux w-10→w-11.
- **Statut** : ✅ corrigé.

### [PIX-01-N04] Toasts sonner bottom-center recouvrant la MobileBottomNav 🟡
- **Fichier** : src/App.tsx:51
- **APRÈS** : `mobileOffset={{ bottom: 72 }}` sur le Toaster (nav 56px + marge 16px).
- **Statut** : ✅ corrigé (sonner 2.0.7 supporte mobileOffset).

### [PIX-01-N05] OnboardingOverlay : « Passer » 28px, select ville sans bordure, pas d'Escape 🟡
- **Fichier** : src/components/OnboardingOverlay.tsx:83, 104 + effet clavier
- **APRÈS** : « Passer » min-h-11 ; select bg-white + border-border-custom ; fermeture Escape.
- **Statut** : ✅ corrigé.

### [PIX-02-N01] Badge note « 4.7 » text-gold-accent sur bg-gold-light : contraste ~1.9:1 🟠
- **Breakpoints** : tous — **Page** : / (cartes Restaurants Populaires)
- **Fichier** : src/pages/Home.tsx:273
- **AVANT** : `bg-gold-light text-gold-accent` — **APRÈS** : `bg-gold-light text-amber-700`
  (#B45309 sur #FDF5E0 ≈ 4.8:1 ; précédent : badge Premium navbar amber-100/amber-700)
- **Statut** : ✅ corrigé. Le même motif existe ailleurs → à traiter dans les lots concernés.

### [PIX-02-N02] Indicateurs de confiance hero en white/60 sur photo sombre (~3.5:1 à 13px) 🟡
- **Fichier** : src/pages/Home.tsx:139 — **APRÈS** : `text-white/80`. ✅ corrigé.

### [PIX-02-N03] Nom + tags de restaurant sans truncate dans les cartes 🟡
- **Fichier** : src/pages/Home.tsx:266-270 — **APRÈS** : `truncate` sur h3 et p tags. ✅ corrigé.

### [PIX-02-N04] Avatars témoignages en <img> nu sans fallback 🟡
- **Fichier** : src/pages/Home.tsx:478 — **APRÈS** : AppImage (fallback + lazy) dans un
  conteneur rond overflow-hidden. ✅ corrigé.

### [PIX-02-N05] Classes duration-250/duration-400 inexistantes en Tailwind v3 (sans effet) 🟡
- **Fichier** : src/pages/Home.tsx:250, 257 — **APRÈS** : duration-200 / duration-300. ✅ corrigé.

### [PIX-03-N01] Carte de recherche z-50 peinte PAR-DESSUS la navbar au scroll 🔴
- **Breakpoints** : tous — **Page** : /restaurants
- **Constat** : conteneur `-mt-10 relative z-50` = z navbar (50), plus tard dans le DOM →
  recouvre la navbar en scrollant (hamburger masqué, vérifié par capture à scroll 420).
- **Fichier** : src/pages/Restaurants.tsx:274 — **APRÈS** : `z-30`. ✅ corrigé (vérifié).

### [PIX-03-N02] Carte Leaflet desktop à hauteur 0 (height="100%" effondrée) 🔴
- **Breakpoints** : ≥1024 (panneau latéral), et plein écran
- **Constat mesuré** : leaflet-container 377×0 ; le wrapper interne de DeliveryMap est en
  hauteur auto → un height:'100%' passé en prop s'effondre (mesuré 1.33px).
- **Fichier** : src/components/DeliveryMap.tsx:100-101
- **APRÈS** : wrapper `height:100%` + flex column quand la hauteur est en %, carte flex-1
  min-h-0 ; ajout `InvalidateOnResize` (ResizeObserver → map.invalidateSize()).
- **Statut** : ✅ corrigé — mesuré 377×637, 6 tuiles chargées.

### [PIX-03-N03] Cœur favori 32px sur cartes restaurants 🟠
- **Fichier** : src/pages/Restaurants.tsx:640 — **APRÈS** : w-11 h-11 + aria-label. ✅

### [PIX-03-N04] Badges/menus or-sur-or (3 occurrences, ratio ~1.9:1) 🟠
- **Fichier** : src/pages/Restaurants.tsx:663, 471, 488 + DishResults.tsx:476
- **APRÈS** : text-amber-700 (étoiles restent gold-accent). ✅

### [PIX-03-N05] Badge « Tendance » chevauché par note+cœur sur cartes plats étroites 🟠
- **Breakpoint** : 360×640 (grille 2 col) — **Fichier** : src/components/DishResults.tsx:475
- **APRÈS** : groupe note+cœur en pile verticale (flex-col items-end). ✅ (vérifié capture)

### [PIX-03-N06] Cibles tactiles : cœur plat 28px, boutons + ajout 28px, pills filtres 28px, tri 20px 🟠
- **Fichiers** : DishResults.tsx:483 (w-10), :546/:561 (w-10), Restaurants.tsx pills py-2,
  bouton tri min-h-11. ✅ (cœur/+ à 40px : compromis visuel carte compacte, > AA 24px)

### [PIX-03-N07] truncate manquant + duration-250/400 sur cartes restaurants/plats 🟡
- **Fichiers** : Restaurants.tsx:656-660, 626, 633 ; DishResults.tsx:454. ✅

### [PIX-04-N01] Barre panier mobile recouverte par la MobileBottomNav 🔴
- **Breakpoint** : <768 — **Page** : /restaurant/:slug (panier non vide)
- **Constat mesuré** : barre `fixed bottom-0 h-16 z-40` (576–640) sous la nav `bottom-0 z-40`
  (586–640, plus tard dans le DOM) → 10px visibles, « Voir le panier » intapable.
- **Fichier** : src/pages/RestaurantDetail.tsx:830
- **APRÈS** : `bottom-14 md:bottom-0` — mesuré : barre 520–584, nav 586 → 0 chevauchement.
- **Statut** : ✅ corrigé. (Incident : 1er correctif avec commentaire JSX mal placé → erreur
  de syntaxe détectée au reload Vite, corrigée dans la foulée.)

### [PIX-04-N02] ActiveOperationsBar en collision avec la barre panier de la fiche resto 🟠
- **Fichier** : src/components/ActiveOperationsBar.tsx
- **APRÈS** : traitement /restaurant/ aligné sur /article/ (bottom-32 md:bottom-[88px]) ;
  le raccourci « panier » y est masqué (redondant avec la barre dédiée, les pastilles
  commande/demande restent). ✅

### [PIX-04-N03] Toast sonner recouvrant la barre panier des fiches resto/plat 🟡
- **Fichier** : src/App.tsx — mobileOffset dynamique : 132px sur /article/ et /restaurant/,
  72px ailleurs. ✅

### [PIX-04-N04] Cibles tactiles fiche resto 🟠
- Ajout menu w-8→w-10, quick-add galerie w-7→w-10, steppers menu w-6→w-8,
  steppers panier w-7→w-9, fermeture sheet panier sans padding → min 44px + aria-label. ✅

### [PIX-04-N05] Or-sur-or / or-sur-blanc fiche resto (4 occurrences) 🟠
- Note en-tête (:392), badge note avis (:810), badge « Populaire » (:1048),
  alerte minimum de commande (:1200) → text-amber-700. ✅

### [PIX-04-N06] Dialog personnalisation sans max-height 🟡
- DialogContent → `max-h-[85dvh] overflow-y-auto` (long contenu variantes+suppléments
  scrolle au lieu de déborder à 360×640). ✅ (vérifié par code — pas de plat à variantes
  dans les données mock du resto testé)

### [PIX-05] DishDetail (/article/:slug) — synthèse
- **N01 🟠** Sticky bar CTA à bottom-16 (64px) : 8px de vide au-dessus de la nav (56px) →
  `bottom-14`, alignée. DishDetail.tsx:435. ✅
- **N02 🟠** Boutons retirer/ajouter des offres restaurants 32px → w-10 h-10 (:378, :387). ✅
- **N03 🟡** Or-sur-blanc (:247, :346) → amber-700. ✅
- **N04 🟡** Dialogs quick-order sans max-height (DishDetail:507, DishResults:626) →
  max-h-[85dvh] overflow-y-auto. ✅
- Vérifié : 360px sans scroll X, breadcrumb sous navbar, slug inexistant → message + CTA. ✅
- Incident : overlay Vite transitoire (plugin inspect-dom, JSON) sur DishResults après HMR —
  disparu au reload, fichier vérifié sain (pas de BOM/NUL).

### [PIX-06] Checkout — synthèse
La page était déjà au standard le plus élevé du projet : inputs h-12 fond blanc + bordure +
focus ring vert, type=tel sur les téléphones, skeletons sur frais/total, bouton 52px
active:scale-95 avec logique disabled correcte, états error avec role=alert, succès en carte
centrée, panier vide → redirection (:200), radio-cards paiement pleine largeur.
- **N01 🟡** 2 encarts or-sur-or (:771, :784) → amber-700. ✅
- **N02 🟡** « Me géolocaliser » 16px de haut (:596) → min-h-11. ✅
- **N03 🟡** Vérifié à 360px : scrollW 360 à chaque étape, submit 52px, cibles ≥40px
  (restent : liens légaux footer 32px — acceptés, AA).
- **Constat environnement** : `.env.local` porte `VITE_USE_VPS_API=true` → la validation
  de commande passe par le VPS de PROD (proxy dev). La création de commande échoue avec les
  données mock (message d'erreur propre affiché ✓). Ne PAS créer de commandes par ce chemin
  en dev ; les données de test de /commandes sont seedées en localStorage.

### [PIX-07] Orders (/commandes) — synthèse
- **N01 🟠 (fonctionnel)** Premier affichage bloqué ~15 s en skeleton : le tick initial de
  usePolling part avant la résolution de l'auth (user null → early return), le rechargement
  n'arrivait qu'au tick suivant. → useEffect([loadOrders]) de rechargement immédiat
  (Orders.tsx:202). Vérifié : les 4 commandes seedées apparaissent instantanément.
- **N02 🟠** Cibles : « Annuler la commande » 20px, « Noter la livraison/le restaurant »
  20px → min-h-11 (44px mesuré) ; chips 📞/💬 livreur 29px → 36px. ✅
- **N03 🟡** Vérifié : stepper contenu à 360px (0 overflow sur les 4 cartes mesuré via
  scrollWidth par élément), skeletons/empty state présents, dialog d'annulation 328×307
  dans le viewport avec motif obligatoire + bouton destructif désactivé.

### DÉCOUVERTE MAJEURE (PIX-07) — environnement de dev
`src/lib/supabase.ts` n'est PLUS la neutralisation décrite par CLAUDE.md : c'est un
**adaptateur API VPS complet** (interface compatible Supabase). Avec `VITE_USE_VPS_API=true`
(présent dans app/.env.local), `isSupabaseConfigured=true` et TOUTES les libs parlent au
VPS de production via le proxy dev. Conséquences :
- Le serveur dev « yamo-web » (port 3000) travaille sur des données de PROD — ne pas y
  exécuter de mutations (commandes, candidatures, actions dashboards).
- Pour les audits dynamiques, un second serveur « yamo-web-mock » (port 3010) a été ajouté
  à .claude/launch.json avec VITE_USE_VPS_API=false + VITE_FORCE_MOCK_AUTH=true →
  mode 100% mock/localStorage, mutations sans risque.
- CLAUDE.md est obsolète sur ce point (« supabase = null ») — à mettre à jour.

### [PIX-08] Profile + Favorites — synthèse
- **N01 🔴** /profil déborde horizontalement à 360px (scrollWidth mesuré 401px) :
  la colonne `flex-1` de la carte identité sans `min-w-0` (téléphone non tronqué) puis
  l'input WhatsApp `flex-1` sans `min-w-0` (largeur intrinsèque des inputs). →
  Profile.tsx:267 `min-w-0`, :287 truncate téléphone, :295 `min-w-0` sur l'input.
  Vérifié après correctif : scrollWidth 360.
- **N02 🟠** Cibles : bouton photo 28→36px + aria-label, « Enregistrer le profil » 20px →
  min-h-11, « Ajouter » (adresse) → min-h-11, poubelle adresse w-8 → w-10. ✅
- **N03 🟡** Badge « En attente » or-sur-or → amber-700. ✅
- **N04 🟡** Favorites : duration-250/400 → 200/300, cœurs retirer 32/28px → 44/40px,
  note or-sur-blanc → amber-700. Vérifié : empty states par section + CTA, scrollW 360. ✅

### [PIX-09] Auth (Login, Inscription, Candidature) — synthèse
- **N01 🟠** Login : tabs Téléphone/Email 28px → py-2.5 (~40px) ; lien « S'inscrire »
  17px → min-h-11. ✅
- **N02 🟡** Inscription : encart or-sur-or (:181) → amber-700. ✅
- **N03 🟡** Vérifié à 360px : /connexion et /inscription sans scroll X, inputs 48px
  (boxes), /candidature affiche son état message sans débordement.
- Limite : le formulaire ApplicationForm complet (upload documents) n'a pas été exercé
  dynamiquement (nécessite un compte resto/livreur en parcours d'inscription) — scan de
  motifs propre ; à couvrir lors d'un passage fonctionnel dédié.

### [PIX-10/11] Dashboards restaurant + livreur — synthèse
- Vérifié à 360px (session mock) : 0 scroll X sur les 5 onglets resto et les 3 onglets
  livreur (y compris carte de course active avec navigation Waze/GMaps, encaissement,
  messages WhatsApp).
- **PIX-10 🟠** RestaurantDashboard : 7 boutons d'action menu (éditer/populaire/dispo/
  supprimer/fermer/retirer) 32px → 40px ; hamburger topbar BackOfficeLayout 32px → 44px ;
  9 textes or-sur-or/or-sur-blanc → amber-700 (badge hors-horaires, âges commandes,
  stat « à vérifier », badge Populaire…).
- **PIX-11 🟠** DriverDashboard : « Actualiser » 20px → min-h-11 ; chips WhatsApp client
  29px → 36px ; « Signaler un problème » 32px → min-h-11 ; encart « À encaisser » et
  6 autres textes or → amber-700 (dont bouton bordé h-10 → amber-700).
- Incident : graphe HMR du serveur mock corrompu après batch d'edits (faux « export
  manquant ALL_DIETARY_TAGS ») → résolu par redémarrage du serveur ; export réel vérifié
  présent (RestaurantDashboard.tsx:961), build vert.

### [PIX-12] Admin (13 pages) — synthèse
- **N01 🔴** /admin/applications : rangée d'onglets `w-fit` débordait à 360px (scrollWidth
  mesuré 447px) → `max-w-full overflow-x-auto scrollbar-hide` + `shrink-0` sur les onglets
  (AdminApplications.tsx:118). Vérifié : 360. Même motif corrigé préventivement dans
  Favorites.tsx:46.
- **N02 🟠** 8 badges/textes or-sur-or → amber-700 (Applications, Customers, Dashboard
  top-3, Drivers note, Orders ×3, Reviews pending). Icônes décoratives laissées en or.
- **N03 🟡** Les 12 autres routes admin mesurées à 360px : scrollWidth 360 partout ;
  le tableau AdminOrders est bien dans un wrapper overflow-x-auto (:118).

### Observations hors périmètre (PIX-02)
- Boutons App Store / Google Play sans action réelle (fonctionnalité vitrine simulée —
  relève de la priorité produit n°6, décision produit, pas du responsive).
- Mesures 360×640 : scrollWidth 360 ✓, h1 38px Source Sans 3 ✓, bouton recherche 44px ✓.

### Observation hors périmètre (PIX-01)
- Navbar affiche « Mon compte → /profil » alors que `yamo_local_user` est null (état AuthContext
  incohérent avec localStorage). Comportement auth, PAS un sujet responsive — non traité ici.

## Problèmes reportés

## Écarts brief ↔ code constatés
- Fonts : Source Sans 3 partout (font-poppins/font-heading = alias), pas Poppins.
- text-muted #6B7280 (CONF-31), success #10B981, gold-light #FDF5E0, text-primary #1F2937.
- Route fiche plat : /article/:slug ; fiche resto : /restaurant/:slug (param slug).
- Routes admin supplémentaires vs CLAUDE.md : /admin/reviews, /admin/trash.

### [PIX-13] Pages secondaires — synthèse
- **N01 🔴** /demandes/nouvelle : scrollWidth 661px à 360 — steppers budget (−500/input/+500)
  en `flex-1` sans `min-w-0` + inputs number à largeur intrinsèque →
  FoodRequestCreate.tsx:315/324 `min-w-0` (wrappers + inputs). Vérifié : 360.
- **N02 🟠** /livreurs (374px) et /contact (364px) : blocs framer-motion `initial x:±15`
  sous la ligne de flottaison → translation permanente hors viewport tant que whileInView
  n'a pas tiré. → `overflow-x-hidden` sur la racine des deux pages. Vérifié : 360.
- Vérifié aussi : /partenaires 360, /demandes/mes-demandes 360, 404 360.

### [PIX-14] Passe transverse de finesse — synthèse
- Contraste : dernières occurrences texte or sur fond clair → amber-700 (RoleGate:80,
  Candidature:49, FoodRequestList:9, Login:299, Orders statusColors preparing/ready,
  Livreurs:419 « Notre Équipement » sur section blanche). L'or sur FONDS SOMBRES
  (héros Home/Livreurs/Partenaires) est conservé — contraste suffisant.
- duration-250/400 : dernières occurrences (Contact, Livreurs, Partenaires) → 200.
- alert()/window.prompt() : aucun dans src (grep) ✓.
- Reporté (voir « Problèmes reportés »).

## Post-audit — Refonte fine /restaurants (2026-07-17, retour utilisateur « aucune finesse »)
Fichier : src/pages/Restaurants.tsx. Build ✅, lint = baseline (1 pré-existante), tsc ✅.
1. **Héro compact sur mobile** : pt-5 pb-14, h1 24px, breadcrumb + sous-titre masqués <sm
   → premier restaurant à y≈597 (avant ≈940) : résultats visibles dès le 1er écran (360×740).
2. **Filtres = vrais inputs** : Ville/Quartier/Note passent de blobs gris sans bordure à
   blanc + border-border-custom + hover, chevron aligné à droite ; recherche texte au
   standard focus-ring vert (comme Checkout).
3. **Grille mobile 2×2 stricte** (Ville|Quartier / Note|Rechercher ; Rechercher col-span-2
   en mode plats) — fini le wrap en quinconce du flex-wrap.
4. **Ligne résultats compacte** : compte en gras + truncate à gauche ; à droite bouton
   **« Carte » (mobile, ouvre la carte plein écran** — elle était enterrée en fin de liste,
   vérifié : ouverture 312×570) + « Trier : » sans retour à la ligne.
5. **Cartes affinées** : état **Ouvert/Fermé visible en liste** (pastille + overlay
   « Fermé actuellement » + image grayscale — info n°1 absente auparavant) ; méta unifiée
   (pill note ambre + texte simple horloge/frais, « Livraison gratuite » en vert) ;
   image 16/9, gap-4 mobile, active:scale, delay d'animation plafonné (6×0.06s au lieu de
   i×0.08s qui faisait attendre 1s+ les dernières cartes).
6. **Empty state digne** : carte blanche + icône + message + bouton bordé 44px.
Vérifications : scrollW 360 (liste + mode plats), desktop 1280 sans débordement (grille
2 col 366px, carte latérale 377×637, bouton Carte masqué lg). Preuves par mesures DOM —
l'outil de capture d'écran était instable pendant la passe.

## Rapport final (PIX-15) — 2026-07-16

### Vérifications finales
- **Build** : `tsc -b && vite build` ✅ (dernier passage 42 s).
- **Lint global** : 78 problèmes (76 err, 2 warn) = **baseline exact** — zéro nouvelle
  erreur introduite sur l'ensemble du chantier.
- **Scroll X à 360×640** : 0 débordement sur les 18 routes client testées en balayage
  final + 13 routes admin + 8 onglets dashboards resto/livreur + fiches resto/plat.
- **Scroll X à 1280×800** : 0 débordement sur les 8 routes clés.
- **Console** : 0 erreur lors du balayage final.
- **Parcours exercés en mock (port 3010)** : ajout panier + steppers fiche resto,
  checkout complet jusqu'à la validation (erreur serveur affichée proprement — voir
  limites), liste commandes 4 statuts + dialog annulation, profil/adresses, favoris,
  dashboards resto (5 onglets) / livreur (3 onglets, course active), admin 13 pages.

### Bilan des anomalies (7 🔴, ~20 🟠, ~30 🟡 — toutes corrigées, 0 reportée bloquante)
🔴 corrigées : carte recherche au-dessus de la navbar (z-50), Leaflet desktop hauteur 0,
barre panier resto sous la BottomNav, débordements /profil (401px), /admin/applications
(447px), /demandes/nouvelle (661px), skeleton infini /commandes (15 s au 1er affichage).

### Problèmes reportés (non bloquants, justifiés)
- Liens légaux footer à 32px (au lieu de 44) — pattern texte discret, AA respecté.
- Chips « pills » (filtres, WhatsApp) à 32–40px — standard chips, AA (24px) respecté.
- Grep large des div[onClick] sans clavier non exhaustif (les cas critiques — galerie
  resto, dialogs — sont déjà équipés role/tabIndex/onKeyDown).
- Boutons App Store/Google Play factices (Home) — décision produit (priorité n°6).
- 1440×900 / 1920×1080 non testés directement (outil plafonné) : layouts bornés par
  max-w-[1280px] mx-auto — risque faible, à contrôler sur écran réel.
- ApplicationForm (upload documents) non exercé dynamiquement.

### Écarts brief ↔ code actés
Voir section dédiée + DÉCOUVERTE MAJEURE (adaptateur VPS dans supabase.ts, CLAUDE.md
obsolète sur ce point ; mode prod actif sur le serveur port 3000 via .env.local).

### Environnement de vérification
- Serveur « yamo-web-mock » (port 3010, ajouté à .claude/launch.json) : VITE_USE_VPS_API=false,
  VITE_FORCE_MOCK_AUTH=true — données seedées : 4 comptes (client/resto/livreur/admin,
  +23769000000{1..4}) et 4 commandes (pending/delivering/delivered/cancelled).
- Les captures d'écran de l'outil présentaient un recadrage intermittent (dpr) : les
  vérifications « pixel » s'appuient sur les mesures DOM (getBoundingClientRect,
  scrollWidth), fiables et consignées dans les fiches.
