# Design System — MiamExpress

> **Date** : 16/07/2026 · **Statut** : formalisation du système **existant** (aucune réinvention).
> Sources de vérité : `tailwind.config.js`, `src/index.css`, `src/components/ui/` (shadcn/ui), usages constatés dans les pages.
> Règle : **toute nouvelle UI doit puiser ici**. Si un besoin n'est pas couvert, l'ajouter à ce document *avant* de coder une valeur en dur.

---

## 1. Identité visuelle — Couleurs

### 1.1 Couleurs de marque (tokens Tailwind, définis dans `tailwind.config.js` + variables CSS dans `index.css`)

| Token | Valeur | Usage |
|---|---|---|
| `green-primary` | `#157F3D` | Couleur principale : CTA, liens actifs, navigation active, prix, icônes de marque |
| `green-dark` | `#0E5C2C` | Hover des CTA verts |
| `green-light` | `#E8F5EE` | Fonds doux : badges verts, état actif sidebar, encarts d'info positifs |
| `gold-accent` | `#D4A843` | Accent premium : étoiles de notation, badges « Populaire », alertes douces, états intermédiaires (préparation) |
| `gold-light` | `#FDF5E0` | Fond des badges/encarts or |

### 1.2 Couleurs fonctionnelles

| Token | Valeur | Usage |
|---|---|---|
| `error` | `#EF4444` | Erreurs, annulations, suppressions, badges « Indisponible ». Fond doux : `error/10`, `error/5` |
| `success` | `#10B981` | Confirmations ponctuelles (« Gratuit », point « Ouvert ») |

### 1.3 Couleurs de texte

| Token | Valeur | Usage |
|---|---|---|
| `text-primary` | `#1F2937` | Titres, contenus, valeurs |
| `text-secondary` | `#6B7280` | Texte descriptif, labels |
| `text-muted` | `#9CA3AF` | Métadonnées, placeholders. ⚠️ **Contraste < 4.5:1 sur fond clair** — à réserver aux textes non essentiels ; l'assombrissement du token est planifié (plan d'implémentation CONF-31 / LOT-12), ne pas multiplier ses usages d'ici là |

### 1.4 Fonds et bordures

| Token | Valeur | Usage |
|---|---|---|
| `bg-main` | `#FFFFFF` | Fond des cartes et surfaces |
| `bg-secondary` | `#F9FAFB` | Fond de page, inputs, éléments neutres |
| `bg-dark` | `#1A1A1A` | Sections sombres marketing (Home) |
| `border-custom` | `#E5E7EB` | Bordure standard des cartes/conteneurs |
| `border-light` | `#F3F4F6` | Séparateurs internes (divide-y) |

### 1.5 Couleurs codées en dur **légitimes** (à ne pas « corriger »)

| Valeur | Où | Pourquoi c'est voulu |
|---|---|---|
| `#1E293B` | `BackOfficeLayout.tsx` topbar | Barre back-office volontairement sombre (style WordPress), distincte du site client. Usage unique — pas de token tant qu'il n'y a qu'un usage |
| `#FFCC00`, `#FF6600` | `Checkout.tsx` swatches paiement | Couleurs de marque **MTN** et **Orange** |
| `#4285F4`, `#33CCFF`, `#3B82F6` | `DeliveryMap.tsx` | Couleurs de marque Google Maps / Waze (boutons GPS) et marqueur livreur bleu (distinct du resto vert / client or) |
| Gris `#e0e0e0`→`#f0f0f0` | `Contact.tsx`, `Restaurants.tsx`, placeholders SVG | Décors de cartes factices/placeholder images — hors palette produit, purement décoratifs |
| `bg-amber-100 text-amber-700` | Badge « Premium » Navbar | Conserve un meilleur contraste que `gold-accent` sur `gold-light` (~1.9:1). Ne pas migrer vers les tokens or sans retravailler le contraste |
| `text/bg-blue-*`, `purple-*`, `amber-*` | Cartes de stats des dashboards | Accents décoratifs différenciant les KPIs. Tolérés dans les stat-cards **uniquement** |

### 1.6 Règles de contraste

- Texte normal : viser **≥ 4.5:1** (WCAG AA). `text-primary` et `text-secondary` sur fonds clairs sont conformes ; `text-muted` ne l'est pas → jamais pour une information indispensable.
- Texte sur `green-primary` : toujours blanc (`text-white`, ratio ~4.9:1).
- Texte sur `gold-light` : utiliser `gold-accent` uniquement pour des libellés courts + gras (`text-xs font-semibold`) ; jamais pour du texte long.
- Ne jamais poser `text-muted` sur `bg-secondary`.

---

## 2. Typographie

### 2.1 Polices (chargées dans `index.html` via Google Fonts)

| Famille | Classes | Graisses chargées | Usage |
|---|---|---|---|
| **Source Sans 3** | `font-poppins`, `font-heading` (+ `h1…h6` par défaut) | 500, 600, 700 | Titres, chiffres clés, noms |
| **Inter** | `font-inter` (+ `body` par défaut) | 400, 500, 600, 700 | Tout le reste : texte, boutons, labels, badges |

> ⚠️ **Piège historique assumé** : la classe `font-poppins` pointe vers **Source Sans 3** (héritage d'un changement de police — voir `index.css:74`). Ne pas « corriger » ce mapping sans migration globale planifiée ; ne pas charger la police Poppins.

### 2.2 Échelle typographique constatée

| Rôle | Classes types | Exemples |
|---|---|---|
| Titre de page (hero) | `font-poppins font-semibold text-3xl sm:text-4xl` | Heros verts (Restaurants, Checkout, Orders) |
| Titre de page (back-office) | `font-poppins font-bold text-2xl` | AdminDashboard, dashboards |
| Titre de section | `font-poppins font-semibold text-lg` (parfois `text-xl`) | Cartes de section |
| Corps | `font-inter text-sm` ou `text-[15px]` | Descriptions, formulaires |
| Métadonnées / légendes | `font-inter text-xs` | Dates, compteurs |
| Micro-labels | `text-[10px]`/`text-[11px] font-medium` | Bottom nav, badges, labels stat-cards |
| Chiffres clés | `font-poppins font-bold text-xl`→`text-3xl` | KPIs, totaux, gains |
| Boutons | `font-inter font-medium`/`font-semibold text-sm` | Partout |

- Hauteur de ligne : titres `1.18` (global `index.css`), corps par défaut Tailwind ; textes descriptifs longs `leading-relaxed`.
- `letter-spacing: 0` global. Exception : micro-labels uppercase `tracking-wide`/`tracking-wider`/`tracking-widest`.

---

## 3. Espacements

Échelle Tailwind standard — valeurs effectivement utilisées dans le projet (à réutiliser en priorité) :

| Contexte | Valeurs canoniques |
|---|---|
| Padding de carte | `p-3` (compact) · `p-4`/`p-5` (standard) · `p-5 sm:p-6` (sections) · `p-8`/`p-10` (états vides, confirmations) |
| Gaps de grille/flex | `gap-1.5` · `gap-2` · `gap-3` · `gap-4` (listes/grilles) · `gap-8` (colonnes de layout) |
| Marges verticales de section | `mb-3/4/6` (intra-carte) · `py-16 sm:py-20` (sections marketing Home) · `space-y-4`/`space-y-6` (listes de cartes) |
| Padding horizontal de page | `px-4 sm:px-6 lg:px-8 xl:px-12` (client) · `px-4 sm:px-6` (back-office, `p-4 sm:p-6 lg:p-8` admin) |
| Décalages fixes | header client **72 px** (`pt-[72px]` obligatoire sur toute page client) · topbar back-office **56 px** (`pt-[56px]`) · sidebar **240 px** (`lg:pl-[240px]`) · bottom nav mobile **56 px** (spacer `h-14`/`h-16`) |

Règle : ne pas introduire de valeur arbitraire (`p-[13px]`…) si une valeur de l'échelle convient.

---

## 4. Rayons, bordures, ombres

| Élément | Standard |
|---|---|
| Boutons, inputs, selects | `rounded-lg` (via `--radius: 0.625rem` = 10 px) |
| Cartes de contenu | `rounded-xl` (14 px) ou `rounded-2xl` (16 px, sections client) |
| Badges, pills, avatars, compteurs | `rounded-full` |
| CTA majeurs checkout | `rounded-xl` |
| Bordure standard | `border border-border-custom` |
| Séparateurs | `divide-y divide-border-light`, `border-t border-border-light` |
| Ombres | Repos : `shadow-sm` ou `shadow-[0_2px_12px_rgba(0,0,0,0.06)]` · Hover : `hover:shadow-md` · Flottants (dropdown/popover) : `shadow-lg` · Panneau de recherche hero : `shadow-[0_8px_32px_rgba(0,0,0,0.12)]` · Barres fixes basses : `shadow-[0_-2px_8px_rgba(0,0,0,0.06)]` |

---

## 5. Icônes

- **Bibliothèque unique : `lucide-react`.** Ne pas en introduire d'autre ; les emojis (📍 🕐 💵) sont tolérés dans les textes secondaires, pas comme icônes d'action seules.
- Tailles canoniques : `w-3.5 h-3.5` (inline méta), `w-4 h-4` (boutons, sidebar, inputs), `w-5 h-5` (nav, titres de section), `w-8 h-8` (états vides dans pastille `w-16 h-16 rounded-full bg-green-light`).
- Pastille d'icône de section : `w-8/9 h-8/9 rounded-lg bg-green-light flex items-center justify-center` + icône `text-green-primary`.

---

## 6. Composants

### 6.1 Boutons

| Variante | Recette | Usage |
|---|---|---|
| **Primaire** | `bg-green-primary text-white font-inter font-semibold rounded-lg hover:bg-green-dark transition-colors` · hauteurs : `h-10` (inline), `h-11` (formulaires), `h-[52px] rounded-xl` (CTA checkout, avec `active:scale-95`) | Action principale (1 seule par écran) |
| **Secondaire** | `border border-green-primary text-green-primary hover:bg-green-light rounded-lg` | Action alternative |
| **Danger** | `border border-error text-error hover:bg-error/5` (contour) ou `bg-error text-white` (confirmation destructive dans AlertDialog) | Refuser, annuler, supprimer |
| **Ghost/tertiaire** | `text-text-secondary hover:bg-bg-secondary rounded-lg` | Annuler, retour |
| **Icône** | `w-8 h-8`/`w-10 h-10 rounded-full bg-bg-secondary hover:bg-border-light` | Favori, partage, +/− quantité |
| Désactivé | `disabled:opacity-60` (ou 50) + `disabled:cursor-not-allowed` | Toujours accompagné d'une explication visible |
| Chargement | Libellé remplacé (« Validation... ») + `Loader2 animate-spin` si CTA long | Obligatoire sur les actions réseau |

Le composant `src/components/ui/button.tsx` (shadcn) existe mais la convention dominante du projet est la **recette utilitaire ci-dessus** — suivre le style du fichier où l'on travaille, ne pas mélanger les deux dans un même écran.

### 6.2 Champs de formulaire

- Recette standard : conteneur `bg-bg-secondary rounded-lg px-3 h-11` (ou `h-12` client), input nu `bg-transparent text-[15px]/text-sm font-inter outline-none placeholder:text-text-muted`.
- Avec icône : `flex items-center gap-2` + icône `w-4 h-4 text-text-muted shrink-0`.
- Label : `block text-text-secondary font-inter text-sm mb-1.5`.
- Focus : géré globalement (`index.css` → outline 2 px `green-primary`). Ne pas le désactiver.
- Erreur de champ : texte `text-error text-sm font-inter` sous le champ (pattern à généraliser — les erreurs globales en bas de page sont l'existant).
- Téléphone : préfixe statique `+237` + placeholder `6XX XX XX XX`.

### 6.3 Cartes

- Contenu : `bg-white rounded-xl|2xl border border-border-custom shadow-sm p-4|5` + `hover:shadow-md transition-shadow` si cliquable.
- Stat-card : icône en pastille colorée `w-9|10 h-9|10 rounded-lg|full` + label `text-[10px]|xs text-text-muted` + valeur `font-poppins font-bold`.
- Carte liste (commande/course) : header `flex justify-between` (référence + badge statut) → contenu → footer `border-t border-border-light pt-3 flex justify-between` (méta + montant/action).
- Urgence (commandes resto) : `border-l-4` + `border-l-green-500|amber-500|red-500` selon l'âge.

### 6.4 Badges

- Statut : `text-xs font-inter font-medium px-2.5 py-1 rounded-full` + paires fond/texte : vert `bg-green-light text-green-primary`, or `bg-gold-light text-gold-accent`, rouge `bg-error/10 text-error`, neutre `bg-bg-secondary text-text-secondary`.
- Sémantique commandes : en attente = neutre · confirmée/récupérée/en livraison/livrée = vert · en préparation/prête = or · annulée = rouge (mapping `statusColors` de `Orders.tsx` — réutiliser tel quel).
- Compteur : `w-4 h-4 rounded-full bg-green-primary text-white text-[10px] font-bold` (panier).
- Point d'état : `w-1.5 h-1.5 rounded-full` + couleur (en ligne / ouvert).

### 6.5 Alertes & encarts

- Info positive : `bg-green-light/60 rounded-lg px-3 py-2 text-xs font-inter text-text-secondary`.
- Avertissement : `bg-gold-light text-gold-accent rounded-lg px-3 py-2 text-sm`.
- Erreur bloc : `bg-error/10 text-error rounded-xl p-3 text-xs` (+ icône).
- Bannière de zone : composant existant `ZoneAlertBanner` — réutiliser.

### 6.6 Modales & dialogs

- **Toujours** `Dialog` / `AlertDialog` / `Sheet` de `src/components/ui/` — `window.alert()`/`prompt()` interdits (CLAUDE.md ; 3 occurrences héritées à purger via LOT-05).
- `Dialog` : contenus de formulaire courts (`sm:max-w-[420px]`/`[520px]`), titre `font-poppins text-lg`, footer boutons ghost + primaire.
- `AlertDialog` : confirmations destructives — action `bg-error text-white hover:bg-error/90`.
- Deux modales « maison » subsistent (formulaire plat `RestaurantDashboard`, motif de rejet `AdminApplications`) : mêmes recettes visuelles ; toute **nouvelle** modale doit passer par shadcn.

### 6.7 Menus & navigation

- **Navbar client** : hauteur 72 px, transparente sur les heros (`/`, `/partenaires`, `/livreurs`) puis `bg-white/95 backdrop-blur border-b border-border-custom` au scroll. Mega-menu : panneau `rounded-xl border shadow-lg min-w-[280px]`, entrées icône en pastille + titre + description.
- **MobileBottomNav** : 5 onglets `< md`, icône `w-5 h-5` + label `text-[10px]`, actif `text-green-primary`, inactif `text-text-muted` ; masquée sur `/admin`, `/partenaires/dashboard`, `/livreurs/dashboard` ; spacer `h-14` obligatoire.
- **Sidebar back-office** : 240 px, entrées `h-10 rounded-lg text-sm font-medium gap-2.5` + icône `w-4 h-4` ; actif `bg-green-light text-green-primary` ; mobile : off-canvas + overlay `bg-black/40`.
- **Topbar back-office** : 56 px `bg-[#1E293B]`, profil en dropdown à droite.
- **Onglets** : soit segmented control (`flex gap-1 bg-white rounded-lg|xl border p-1`, actif `bg-green-primary text-white rounded-md|lg`), soit onglets soulignés (fiche resto : `border-b-2 border-green-primary text-green-primary`). Choisir selon le contexte existant de l'écran.

### 6.8 Tableaux

- Pattern admin (`AdminOrders`) : wrapper `overflow-x-auto`, `table w-full text-sm font-inter`, thead `text-left text-text-muted text-xs`, lignes `divide-y divide-border-light`, cellules `py-2 pr-4`.
- Sur mobile : préférer les listes de cartes aux tableaux ; un tableau doit toujours défiler dans son conteneur, jamais faire défiler la page horizontalement.

### 6.9 Filtres & pills

- Pill de filtre : `h-9 px-4 rounded-full text-sm font-inter font-semibold` — actif `bg-green-primary text-white`, inactif `bg-white border border-border-custom text-text-secondary hover:text-text-primary`.
- Filtre secondaire (quick filter) : `h-9 px-3 rounded-lg text-xs border` — actif `bg-text-primary text-white`.
- Dropdown filtre (ville/quartier) : bouton `bg-bg-secondary rounded-lg px-3 h-12` avec sur-label `text-[10px] text-text-muted` + panneau `shadow-lg` avec recherche interne.
- Les rangées de pills défilent : `flex gap-2 overflow-x-auto scrollbar-hide snap-x`.

### 6.10 Pagination

- Aucun pattern en usage (listes courtes / scroll). Composant shadcn `ui/pagination.tsx` disponible : l'utiliser tel quel le jour où une liste dépasse ~50 éléments (prévu LOT-08/16 admin). Ne pas inventer d'infinite-scroll sans besoin mesuré.

### 6.11 Notifications (toasts)

- **sonner** uniquement, monté une fois dans `App.tsx` (`position="bottom-center" richColors`).
- `toast.success` = action réellement effectuée · `toast.error` = échec + quoi faire · `toast.info` = événement (nouvelle commande).
- **Interdit** : toast de succès sans effet réel (règle CLAUDE.md — les occurrences héritées sont tracées CONF-06/07).

### 6.12 États de chargement

- Listes/cartes : `Skeleton` (shadcn) reproduisant la silhouette réelle (3 éléments) — patterns de référence dans `Orders.tsx`, `RestaurantDashboard.tsx`.
- Boutons : libellé « …ing » + spinner.
- Pages en attente d'auth : texte centré « Chargement... » (toléré) — préférer Skeleton pour tout nouveau code.

### 6.13 États vides

- Recette : carte `rounded-2xl border p-10 text-center` + pastille `w-16 h-16 rounded-full bg-green-light` avec icône `w-8 h-8 text-green-primary` + message `text-text-secondary font-inter font-medium` + lien/CTA d'action (`text-green-primary text-sm hover:underline` ou bouton primaire).
- Toujours proposer une action de sortie (« Découvrir les restaurants », « Ajouter votre premier plat »).

### 6.14 États d'erreur

- Erreur de formulaire : `text-error text-sm font-inter` près du champ ou au-dessus du CTA.
- Erreur de chargement de liste : message + bouton « Réessayer » (pattern à généraliser).
- Actions destructives : toujours une confirmation `AlertDialog` avant exécution.

---

## 7. Responsive

### 7.1 Breakpoints (Tailwind par défaut — aucun custom)

`sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 (+ conteneur client `max-w-[1280px] mx-auto`).

### 7.2 Largeurs maximales par gabarit

| Gabarit | Largeur |
|---|---|
| Pages client (listing, fiche resto, Home) | `max-w-[1280px]` |
| Tunnels (checkout, commandes) | `max-w-[720px]` |
| Cartes d'auth / confirmation | `max-w-[480px]` |
| Dashboard restaurant | `max-w-[900px]` |
| Contenus admin | pleine largeur moins sidebar, padding `p-4 sm:p-6 lg:p-8` |

### 7.3 Comportements attendus par résolution

| Résolution | Comportements à vérifier |
|---|---|
| **360×800** (Android entrée de gamme — référence CLAUDE.md) | Bottom nav visible, aucune barre horizontale ; grilles en 1 colonne (`grid-cols-1`, stats `grid-cols-2`) ; barres fixes cumulées ≤ header 72 + bottom 56 ; textes `text-[15px]` lisibles ; cibles tactiles ≥ 40 px (`h-10`+) |
| **390×844** (iPhone standard) | Identique à 360 ; vérifier les safe-areas si PWA plus tard |
| **412×915** (grands Android) | Identique ; les cartes de menu horizontales (`w-[190px]`) montrent ~2 items |
| **768×1024** (tablette portrait, `md`) | Bottom nav disparaît (`md:hidden`) ; navbar complète sans mega-menu (liens `lg:` seulement → hamburger encore visible) ; grilles 2 colonnes ; dashboards : stats `sm:grid-cols-4` |
| **1024×768** (`lg`) | Mega-menu desktop actif ; sidebar back-office fixe (240 px) ; fiche resto : colonne panier `w-[380px]` apparaît ; hamburger disparaît |
| **1366×768** (laptop courant) | Layout complet ; vérifier que les modales `max-h-[90vh]` défilent (hauteur réduite) |
| **1440×900** | Conteneur 1280 centré, marges symétriques |
| **1920×1080** | Idem — aucun étirement au-delà de 1280 ; heros pleine largeur en fond seulement |

### 7.4 Règles générales

- Mobile-first : styles de base = mobile, surcharges `sm:`/`lg:`.
- Jamais de débordement horizontal de page : tout contenu large défile dans son conteneur (`overflow-x-auto`).
- Les listes horizontales utilisent `snap-x snap-mandatory` + `scrollbar-hide`.
- Toute page client commence par `pt-[72px]` ; toute page back-office est rendue sous `pt-[56px]` + `lg:pl-[240px]` (gérés par les layouts — ne pas re-padder).

---

## 8. Animations

- `framer-motion` : entrées `initial={{opacity:0, y:20}}` → `animate/whileInView`, durées 0.3–0.5 s, stagger par index (`delay: i * 0.04–0.06`) ; panneaux : `AnimatePresence` + tween 0.3 s.
- `transition-colors`/`transition-all` CSS pour les hovers ; `active:scale-95` sur les CTA majeurs.
- À terme (LOT-12) : respecter `prefers-reduced-motion` et le mode économie de données — **ne pas ajouter de nouvelle animation décorative complexe d'ici là**.

---

## 9. Duplications & incohérences relevées

### 9.1 Corrigées lors de cette étape de normalisation

| Incohérence | Avant | Après |
|---|---|---|
| Couleurs de graphiques Recharts hors marque et dupliquées (10 occurrences / 2 fichiers) | `#2D6A4F` (vert étranger à la palette), `#D4A017` (or étranger), `#E5E7EB`/`#6B7280` en dur | Constantes partagées `src/lib/chartTheme.ts` alignées sur les tokens (`#157F3D`, `#D4A843`, `#E5E7EB`, `#6B7280`) |
| Bordure Navbar en dur | `border-[#E5E7EB]` | `border-border-custom` (valeur identique) |
| Lien « Noter la livraison » bleu hors palette (`Orders.tsx`) | `text-blue-600 hover:text-blue-700` | `text-green-primary hover:text-green-dark` (aligné sur son jumeau « Noter le restaurant ») |

### 9.2 Constatées et volontairement laissées (avec raison)

| Élément | Raison |
|---|---|
| `font-poppins` → Source Sans 3 | Renommage = ~50 fichiers touchés pour zéro gain visuel ; documenté §2.1 |
| `text-muted #9CA3AF` sous contraste | Correction planifiée LOT-12 (CONF-31) — changement global à valider visuellement sur les 4 profils, pas en catimini ici |
| Boutons shadcn vs recettes utilitaires | Deux systèmes coexistent ; unification non nécessaire tant que chaque écran reste homogène |
| Couleurs de marque tierces, topbar `#1E293B`, stat-cards colorées, badge Premium amber, SVG décoratifs | Voir §1.5 — délibérés |
| Modales « maison » existantes | Fonctionnelles et conformes visuellement ; migration shadcn opportuniste lors des lots qui retouchent ces écrans |
| Segmented controls internes des dashboards | Leur suppression relève des lots de navigation (LOT-10), pas de la normalisation |

---

## 10. Check-list pour toute nouvelle UI

1. Couleur : un token existe ? → l'utiliser. Sinon → l'ajouter ici d'abord.
2. Texte : `font-poppins` (titres/chiffres) ou `font-inter` (reste), taille de l'échelle §2.2.
3. Surface : carte §6.3, bordure `border-custom`, ombre §4.
4. Action : bouton §6.1 — une seule action primaire par écran.
5. Feedback : toast réel, jamais simulé ; loading/empty/error obligatoires sur les listes.
6. Mobile : vérifier 360×800 sans débordement, cibles ≥ 40 px.
7. Icône : lucide-react uniquement, taille canonique §5.
