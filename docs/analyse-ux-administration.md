# Analyse UX approfondie — Administration MiamExpress

Date : 2026-07-20
Périmètre : back-office (profils **admin/RBAC**, **restaurant**, **livreur**), recensement des
fonctionnalités par profil, scénarios d'usage, et points d'optimisation priorisés.
Méthode : lecture du code (`admin-rbac.js`, `BackOfficeLayout.tsx`, `RestaurantDashboard.tsx`,
`DriverDashboard.tsx`, pages `admin/*`), vérifications serveur sur le VPS, et défauts relevés en
session (D-01 → D-22).

---

## 1. Cartographie des profils et des accès

### 1.1 Rôles de base (4)
| Rôle | Accès | Validation requise |
|---|---|---|
| `client` | Site public, commandes, avis | Non (auto-approuvé) |
| `restaurant` | `/partenaires/dashboard/*` | **Oui** (candidature → admin) |
| `livreur` | `/livreurs/dashboard/*` | **Oui** (candidature → admin) |
| `admin` | `/admin/*` + impersonation resto/livreur | N/A |

### 1.2 Sous-profils admin — RBAC (10 rôles, ~55 permissions, 17 modules)
Source : `server/src/admin-rbac.js`. Chaque admin porte 1..N rôles ; `super_admin` = tout.

| Rôle | Niv. | Portée fonctionnelle |
|---|---:|---|
| `super_admin` | 100 | Tout, y compris rôles + suppression définitive |
| `admin_general` | 90 | Tout sauf `admin.roles.update` et `admin.delete` |
| `finance_manager` | 75 | Finances, commissions, remboursements, exports, points, frais |
| `city_manager` | 80 | Ops resto/livreur/clients/commandes **limitées à une/des villes** |
| `restaurant_manager` | 70 | Onboarding + qualité restaurants, menus, plats, médias |
| `courier_manager` | 70 | Onboarding + qualité livreurs, virements, flux commandes |
| `support_agent` | 60 | Clients, commandes, litiges simples, blocage/déblocage |
| `dispatcher` | 60 | Temps réel commandes, assignation livreurs, statuts |
| `quality_moderator` | 55 | Avis, réponses, signalements, modération |
| `readonly_analyst` | 30 | Lecture seule (reporting) |

Modules de permissions : dashboard, applications, restaurants, couriers, customers, orders,
reviews, finance, points, zones, delivery_fees, media, dishes, trash, quotas, administration, audit.
Infra : `admin_audit_logs` (traçabilité), `admin_notes`, `admin_user_roles` (scope global/ville).

### 1.3 Navigation back-office (sidebar contextuelle — `BackOfficeLayout`)
- **Admin** (16 entrées, filtrées par permission) : Tableau de bord · Candidatures · Commandes ·
  Restaurants · Livreurs · Litiges (badge temps réel 30 s) · Catalogue plats · Zones · Frais
  livraison · Médiathèque · Clients · Points · Avis · Rôles & accès · Corbeille · Quotas.
  + liens rapides « Restaurants / Livraisons » (impersonation des dashboards).
- **Restaurant** (5) : Commandes · Menu · Livreurs · Finances · Profil.
- **Livreur** (3) : Disponibles · Mes courses · Gains.

---

## 2. Recensement des fonctionnalités par profil

### 2.1 Livreur (`DriverDashboard.tsx`)
- **Disponibilité** : toggle « En ligne » (persisté `yamo_driver_online`), alerte sonore nouvelle
  course (`yamo_driver_sound`).
- **Disponibles** : liste des courses prêtes dans sa zone ; « Gains du jour », compteur livraisons,
  « En attente ». Accepter une course (avec garde anti-double-prise).
- **Mes courses** : transitions `picked_up → delivering → delivered` ; **preuve de livraison** par
  code, avec option « **sans code** » (clôture signalée) ; **Signaler un problème** (incidents typés,
  `yamo_incidents`).
- **Gains** : solde, filtre période, « Historique des courses », « Historique des virements »
  (demande de payout `yamo_driver_payouts`).

### 2.2 Restaurant (`RestaurantDashboard.tsx`)
- **Commandes** : accepter (avec ETA de préparation) / rejeter (motifs : rupture, surcharge,
  fermeture, prix erroné, autre) ; transitions bornées par rôle ; **garantie client** (série PTS) :
  confirmer/refuser avant préparation ; annulation resto avec motif.
- **Menu** : CRUD plats (ajout/édition/suppression → corbeille), disponibilité, « populaire »,
  filtres (catégorie, nom, prix, populaires), tri, upload image (`lib/media.ts`, compression +
  `/api/media`).
- **Livreurs** : livreurs internes (ajout/retrait, livraison directe), livreurs préférés.
- **Finances / Points** : solde de points, caution, historique, **recharge** (MoMo / cash partenaire,
  référence à rappeler) — validation admin (phase 1).
- **Profil** : profil resto, horaires structurés (`lib/hours.ts`), « fermer temporairement ».

### 2.3 Admin (pages `admin/*`, gated RBAC)
Candidatures (approuver/rejeter/recherche) · Création directe resto/livreur validé · Commandes
(vue, assignation livreur, statut, annulation, litiges) · Restaurants (liste, suspendre/réactiver,
statut ouvert) · Livreurs (liste, suspendre, virements payer/rejeter, reset mdp) · Clients (recherche,
blocage/déblocage, reset mdp, historique) · Litiges/incidents · Catalogue plats · Zones (villes,
quartiers, désactivation) · Frais de livraison · Médiathèque · Points (validation recharges, soldes,
ajustements, ledger) · Avis (modération, is_test) · **Rôles & accès (RBAC)** · Corbeille (7 j) ·
Quotas · Journaux d'audit.

---

## 3. Analyse UX par scénario (parcours de bout en bout)

### S1 — Authentification / accès back-office
- **Login téléphone (OTP) sans SMS réel (D-14)** : restaurateurs, livreurs et admins qui tentent le
  login par téléphone ne reçoivent **aucun code** → impasse. Seul l'email + mot de passe fonctionne.
  **Impact CRITIQUE** : sur le terrain camerounais, le téléphone est le canal naturel.
- **Scope ville RBAC non appliqué** (vérifié VPS) : un `city_manager` scopé Douala **voit toutes les
  villes** (aucune requête ne filtre par `scope_value`). La granularité affichée est trompeuse.
- **Enforcement permissions partiel** : le front masque bien la sidebar par permission, mais côté
  serveur seules ~14 routes utilisent `adminPermissionRequired` ; les autres reposent sur
  `adminRequired` (tout admin). Un rôle bas (ex. `readonly_analyst`) pourrait appeler des endpoints
  d'écriture en direct. **À auditer/durcir.**

### S2 — Onboarding restaurant/livreur (candidature → validation)
- Parcours candidature → admin approuve/rejette (motif). Bon : création directe validée par l'admin.
- **Upload documents en base64** (`ApplicationForm.tsx`) : non scalable, lourd en 3G, stocké en clair.
  À migrer vers `/api/media`.
- **Feedback candidat** : après soumission, le suivi du statut (en attente/approuvé/rejeté + motif)
  doit être limpide et notifié (aujourd'hui : le candidat doit revenir vérifier).

### S3 — Cycle de commande (client → resto → dispatch → livreur → livraison)
- **Statuts non bornés par rôle côté serveur (D-16)** : la route générique `PATCH /api/orders/:id`
  laisse **tout compte connecté** changer un statut (un client pourrait passer « livré »). Le
  bornage n'existe qu'au front. **Risque d'intégrité majeur.**
- **Pas d'endpoint d'annulation dédié (D-18)** : motif non imposé côté serveur.
- **Assignation livreur** : dispatcher assigne/réassigne ; mais **distance approximative**
  (`stableOffset`, pas de vrai routage) → décisions d'assignation sur données inexactes.
- **Suivi temps réel simulé** : `tracking.ts::simulateDriverPosition` interpole une position fixe →
  fausse impression de suivi live pour le client ET l'admin.
- **Preuve de livraison contournable** : l'option « sans code » permet de clôturer sans validation →
  risque de fraude/litige. À encadrer (justification obligatoire + trace).

### S4 — Temps réel & réseau (dispatcher, dashboards)
- **Polling 5 s** (`DriverDashboard`, `AdminDashboard`) : surcharge réseau 3G + batterie. Le badge
  litiges est déjà à 30 s (bon modèle). À généraliser (≥ 30 s) ou WebSocket/Socket.IO.
- **Layout back-office mobile** : sidebar 240px en overlay, top bar sombre. À tester en 360×640 sur
  les tableaux denses (commandes, clients, ledger points) — débordement horizontal probable.

### S5 — Finances
- **Points restaurant (série PTS)** : recharge validée **manuellement** par l'admin (phase 1) →
  goulot d'étranglement + délai pour le resto (blocage garantie). Prévoir file de validation claire
  + notification, puis automatisation (phase 2).
- **Virements livreur** : payer/rejeter avec motif. Vérifier la traçabilité (audit log) et l'absence
  de double paiement (idempotence).
- **Commissions / exports** : réservés `finance_manager` ; vérifier que les exports ne fuient pas de
  données sensibles (PII).

### S6 — Modération (avis, litiges, incidents)
- **Avis** : identité désormais dérivée du profil (session 20/07) — bon. Modération + `is_test`
  filtrés du public. Réponse restaurateur.
- **Litiges** : badge temps réel, résolution admin. Incidents livreur typés.
- **Corbeille 7 j** : bon filet de sécurité pour les suppressions.

### S7 — Cohérence des données (transverse)
- Règle « aucune donnée affichée sans profil réel » posée + audit `verify:integrity` (session 20/07).
- **Ids mock envoyés à la prod (D-03)** : le front envoie parfois des ids « 1 » (uuid attendu) →
  erreurs serveur. Deep-links/favoris hérités à nettoyer.

---

## 4. Points d'optimisation priorisés

| # | Point | Profils | Sévérité | Effort | Reco |
|---|---|---|---|---|---|
| O-1 | **OTP sans SMS** — brancher un vrai SMS + rate-limit, ou n'exposer que l'email en prod (D-14) | tous back-office | S1 | M | Débloque l'accès terrain |
| O-2 | **Statuts commande bornés par rôle côté serveur** (D-16) + endpoint annulation dédié (D-18) | resto/livreur/admin | S1 | M | Machine à états serveur |
| O-3 | **Scope ville RBAC réellement appliqué** dans les requêtes admin | admin (city_manager) | S1 | M | Filtrer par `scope_value` |
| O-4 | **Enforcement granulaire des permissions sur TOUTES les routes admin** (pas seulement 14) | admin | S1 | M | `adminPermissionRequired` partout |
| O-5 | **Blocage client appliqué côté serveur** (D-19) | support/admin | S2 | S | Vérifier `is_suspended` en écriture |
| O-6 | ~~Polling ≥ 30 s~~ **DÉJÀ FAIT** (vérifié : DriverDashboard 15 s, AdminDashboard 30 s) | livreur/admin | — | — | Dette CLAUDE.md obsolète |
| O-7 | ~~Encadrer « sans code »~~ **DÉJÀ FAIT** (vérifié : proposé seulement après 3 échecs de code + clôture tracée `deliveredWithoutCode` visible admin) | livreur/admin | — | — | Reste : enforcement serveur |
| O-8 | **Distance/routage réels** (remplacer `stableOffset`) | dispatcher/livreur | S2 | L | API routage ou heuristique honnête |
| O-9 | **Tracking GPS réel** (remplacer la simulation) | client/admin | S2 | L | Ne pas présenter un faux live |
| O-10 | **Upload documents/candidatures via `/api/media`** (fin du base64) | resto/livreur | S3 | S | Scalabilité 3G |
| O-11 | **File de validation des recharges de points** + notifications | resto/finance | S3 | S | Réduire le goulot |
| O-12 | **Responsive back-office** sur tableaux denses (360×640) | tous | S3 | S | Scroll horizontal maîtrisé |
| O-13 | **Suivi de statut candidature notifié** au candidat | resto/livreur | S3 | S | Réduire les allers-retours |
| O-14 | **Nettoyage ids mock envoyés en prod** (D-03) | transverse | S4 | S | Deep-links/favoris |

Sévérité : S1 bloquant · S2 majeur · S3 moyen · S4 mineur. Effort : S petit · M moyen · L lourd.

---

## 5. Bilan

**Forces** : architecture RBAC riche et bien pensée (10 rôles, audit log, notes, corbeille 7 j),
dashboards fonctionnels couvrant tout le cycle (onboarding → commande → livraison → finances →
modération), et une base UX cohérente (feedback toasts, motifs obligatoires, garantie client).

**Risques structurants (à traiter avant montée en charge)** :
1. **Accès** — le login téléphone est inutilisable sans SMS (O-1) : bloque l'usage réel côté terrain.
2. **Intégrité** — les règles métier (statuts, blocage, annulation) sont **appliquées au front, pas
   au serveur** (O-2, O-5) : contournables par appel API direct.
3. **RBAC en trompe-l'œil** — scope ville non appliqué et permissions granulaires partielles
   (O-3, O-4) : les rôles paraissent cloisonnés mais ne le sont pas côté serveur.
4. **Fonctions « live » simulées** — tracking et distance (O-8, O-9) : à rendre honnêtes ou réelles
   avant de les présenter comme telles.

**Séquence recommandée** : O-1 → O-2/O-3/O-4/O-5 (sécurité/intégrité serveur) → O-6/O-7 (temps réel
et anti-fraude) → O-10..O-14 (scalabilité et confort). Les O-8/O-9 (routage/GPS réels) sont des
chantiers lourds à planifier séparément.

> Ce bilan complète les audits UX existants (`ux-audit-optimal.md`, `ux-implementation-plan.md`,
> `OPTIMISATION_UX_YAMO.md`) en se concentrant sur le périmètre **administration**.
