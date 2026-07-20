# Système de points MiamExpress — Suite de prompts d'implémentation (série PTS)

> **Usage** : chaque section PTS-xx est un prompt autonome à donner à une session Claude
> Code vierge, dans l'ordre du graphe de dépendances (voir
> `points-system-coordination.md`). Un lot = un périmètre fermé = un build vert = une
> entrée dans `points-system-tracking.md`.
>
> **Objet du chantier** : monétisation par points prépayés côté restaurant (commission
> encaissée d'avance + caution de remboursement) et sécurisation des commandes par une
> garantie client en FCFA déduite du total. Phase 1 entièrement manuelle (pas d'API
> Mobile Money) mais entièrement réelle (aucun bouton factice).

---

## §0 — DÉCISIONS PRODUIT FIGÉES

Ces valeurs sont **la référence unique** du chantier. Elles vivent dans
`src/data/launchConfig.ts` (objet `POINTS_CONFIG`, créé en PTS-00) et ne sont **jamais
codées en dur ailleurs**. Modifier une règle = modifier ce fichier, rien d'autre.

| Clé | Valeur par défaut | Signification |
|---|---|---|
| `POINT_PRICE_FCFA` | 500 | Prix de vente d'un point |
| `ORDER_COST_POINTS` | 3 | Coût resto d'une commande livrée (barème FIXE en v1 ; un palier par montant est une évolution v2, ne pas l'implémenter) |
| `PENALTY_RESTAURANT_FAULT_POINTS` | 1 | Pénalité si annulation par faute du resto (sur les 3 réservés : 1 consommé, 2 restitués) |
| `MIN_BALANCE_TO_ACCEPT_POINTS` | 6 | Solde minimum pour pouvoir ACCEPTER une commande (rôle de caution : 2 commandes d'avance) |
| `MIN_RECHARGE_POINTS` | 10 | Recharge minimale (Mobile Money ou cash partenaire) |
| `LOW_BALANCE_THRESHOLD_POINTS` | 6 | Seuil d'alerte « solde faible » |
| `WELCOME_BONUS_POINTS` | 10 | Points offerts à l'activation d'un resto (0 = désactivé) |
| `GUARANTEE_AMOUNT_FCFA` | 1000 | Garantie client, montant FIXE (pas de %) |
| `GUARANTEE_MODE` | `'deducted'` | La garantie est DÉDUITE du total à la livraison (jamais remboursée si tout va bien — zéro procédure). L'alternative `'refunded'` n'est PAS implémentée en v1. |
| `GUARANTEE_FORFEIT_DRIVER_FIRST` | `true` | Garantie confisquée (rejet abusif) : le livreur reçoit d'abord les frais de livraison de la commande, le reliquat va au resto |

**Machine à états d'une réservation de points** (invariant central, identique mock et VPS) :

```
              hold (acceptation)
   disponible ────────────────► réservé
        ▲                          │
        │ release (annulation      ├─ consume (livrée) ──────────► consommé (3 pts)
        │ sans faute resto)        │
        └──────────────────────────┼─ penalty (faute resto) ─────► consommé (1 pt) + restitué (2 pts)
                                   │
                                   └─ convert_refund (remboursement
                                      garantie client depuis la caution) ► consommé (équivalent FCFA arrondi au point supérieur)
```

**Invariants non négociables** : (1) le solde ne peut JAMAIS être négatif — toute
opération qui le rendrait négative échoue ; (2) chaque mouvement est une écriture de
ledger **immuable** (on n'édite ni ne supprime jamais une écriture, on compense par une
écriture inverse) ; (3) chaque écriture porte une référence unique (id commande, id
recharge, id litige) et est **idempotente** : rejouer la même opération avec la même
référence ne crée pas de doublon ; (4) le solde est toujours DÉRIVÉ du ledger, jamais
stocké comme vérité indépendante.

---

## BLOC DE CONTEXTE COMMUN (à coller en tête de CHAQUE prompt PTS)

```
CONTEXTE — MiamExpress, livraison de repas au Cameroun. React 19 + TS + Vite + Tailwind
+ shadcn/ui. Travailler depuis app/. Lire CLAUDE.md et respecter ses interdictions
(pas de Supabase, pas de refonte, pas de bouton factice, pas d'alert(), toasts sonner,
états loading/empty/error obligatoires, mobile 360px d'abord, cibles tactiles ≥ 44px).

MODE DE TRAVAIL — OBLIGATOIRE :
- Développer et tester en MODE MOCK uniquement : serveur lancé SANS VITE_USE_VPS_API
  (config « yamo-web-mock » de .claude/launch.json, port 3010/3011). ATTENTION : le
  fichier app/.env.local du poste contient VITE_USE_VPS_API=true → un serveur lancé
  sans override parle au VPS DE PRODUCTION. Vérifier avant tout test de mutation :
  (await import('/src/lib/supabase.ts')).isSupabaseConfigured === false.
- `src/lib/supabase.ts` est l'adaptateur API VPS (nom historique). Le double chemin
  des libs est : if (isSupabaseConfigured && supabase) → VPS, else → mock/localStorage.
  Toute nouvelle lib du chantier suit CE pattern.

FICHIERS DE RÉFÉRENCE (lire avant d'éditer) :
- src/data/launchConfig.ts — POINTS_CONFIG (§0, créé en PTS-00)
- src/lib/points.ts — lib du chantier (créée en PTS-01)
- src/lib/orders.ts — point de passage unique des commandes (précédents à imiter :
  CustomerBlockedError, deliveryCode, cancellationReason/cancelledBy)
- src/lib/payments.ts, src/lib/drivers.ts, src/lib/incidents.ts
- src/contexts/AuthContext.tsx (rôles, isSuspended), src/components/RoleGate.tsx
- src/pages/RestaurantDashboard.tsx (accepter/refuser, onglet finances)
- src/pages/Orders.tsx (parcours client), src/pages/Checkout.tsx
- src/pages/admin/* + src/App.tsx (routes) + src/components/BackOfficeLayout.tsx
- Comptes mock : +237690000001..4 (client/resto/livreur/admin), clé yamo_local_users.

CLÉS LOCALSTORAGE DU CHANTIER (les déclarer dans la table de CLAUDE.md au 1er usage,
ne pas en créer d'autres) :
- yamo_points_ledger   → écritures immuables (tous restos confondus)
- yamo_points_recharges → demandes de recharge (pending/validated/rejected)
La garantie client vit DANS l'objet commande (yamo_local_orders), pas de clé dédiée.

VÉRIFICATIONS DE SORTIE (chaque lot) :
1. Scénario de test manuel du lot déroulé en mode mock (navigateur, mobile 360px
   puis desktop) — le décrire fait partie du lot, l'exécuter aussi.
2. npm run build → vert. npm run verify:points → vert (dès PTS-01).
3. npx eslint <fichiers touchés> : zéro NOUVELLE erreur vs baseline (~78 erreurs
   pré-existantes au global — comparer fichier par fichier).
4. Consigner le lot dans app/docs/points-system-tracking.md (gabarit dans
   points-system-coordination.md) : statut, fichiers, écarts, résultat des vérifs.
```

---

## PTS-00 — Configuration produit, suivi, baseline

```
[Bloc de contexte commun]

MISSION PTS-00 (aucune logique métier, aucun écran) :
1. Ajouter à src/data/launchConfig.ts l'objet exporté POINTS_CONFIG avec les 11 clés
   du §0 (valeurs par défaut ci-dessus), typé `as const`, chaque clé commentée en une
   ligne. Ne rien modifier d'autre dans ce fichier.
2. Ajouter au modèle restaurant les données paiement marchand nécessaires au parcours
   garantie : champs OPTIONNELS `merchantCode?: string` et `assistanceWhatsapp?: string`
   sur le type Restaurant (src/data/mockData.ts) + les renseigner sur 2 restos mock
   (valeurs fictives plausibles). Aucun usage UI encore.
3. Créer app/docs/points-system-tracking.md depuis le gabarit de
   points-system-coordination.md § Fichier de suivi ; y consigner la baseline :
   sortie de npm run build, comptage lint global et par fichier.
4. Déclarer les 2 clés localStorage du chantier dans la table de CLAUDE.md
   (lignes yamo_points_ledger / yamo_points_recharges, usage : points.ts).
CRITÈRES DE SORTIE : build vert ; lint inchangé ; POINTS_CONFIG importable ;
tracking initialisé. Aucun comportement de l'app modifié.
```

---

## PTS-01 — Socle : lib points.ts (ledger + machine à états) + vérificateur

```
[Bloc de contexte commun]
PRÉREQUIS : PTS-00.

MISSION PTS-01 — créer src/lib/points.ts, cœur du chantier. AUCUNE UI dans ce lot.

TYPES :
- PointsEntryKind = 'recharge' | 'welcome_bonus' | 'hold' | 'consume' | 'release'
  | 'penalty' | 'convert_refund' | 'admin_adjustment'
- PointsLedgerEntry { id, restaurantId, kind, points (signé : + crédit / − débit),
  reference (id commande/recharge/litige — UNIQUE par (kind, reference)),
  note?, createdAt, createdBy ('system' | userId) }
- RechargeRequest { id, restaurantId, points, amountFcfa, method: 'momo'|'cash_partner',
  paymentRef (référence à rappeler lors du dépôt MoMo), status: 'pending'|'validated'
  |'rejected', requestedAt, decidedAt?, decidedBy?, rejectionReason? }

API (chaque fonction : double chemin — if (isSupabaseConfigured && supabase) → adaptateur
VPS via les tables points_ledger / point_recharges (le backend arrive en PTS-08 ; ce
chemin doit compiler et suivre le pattern des libs existantes), else → localStorage) :
- getBalance(restaurantId) → { available, held } — TOUJOURS dérivé du ledger :
  available = Σ(points) hors holds actifs ; held = holds non soldés.
- canAcceptOrder(restaurantId) → available ≥ ORDER_COST_POINTS ET
  (available ≥ MIN_BALANCE_TO_ACCEPT_POINTS OU held > 0 pour ne pas bloquer les
  commandes déjà en cours).
- holdPoints(restaurantId, orderId) → écrit hold(−ORDER_COST_POINTS) ; jette
  InsufficientPointsError (classe exportée, message français actionnable) si le solde
  disponible est insuffisant. Idempotent sur (hold, orderId).
- settleHold(restaurantId, orderId, outcome: 'consume'|'release'|'penalty') → écrit
  la ou les écritures de solde du hold selon la machine §0. Idempotent ; jette si
  aucun hold actif pour orderId.
- convertPointsToRefund(restaurantId, disputeId, amountFcfa) → débite
  ceil(amountFcfa / POINT_PRICE_FCFA) points en 'convert_refund' ; peut entamer le
  solde disponible mais JAMAIS le rendre négatif (sinon erreur explicite → l'admin
  gèrera le reliquat hors système en phase 1, le message doit le dire).
- requestRecharge(restaurantId, points, method) → crée RechargeRequest pending avec
  paymentRef généré (format court lisible, ex. PTS-XXXXXX) ; points ≥ MIN_RECHARGE_POINTS.
- decideRecharge(requestId, 'validate'|'reject', adminId, reason?) → si validate :
  écriture 'recharge'(+points) idempotente sur (recharge, requestId).
- grantWelcomeBonus(restaurantId) → une seule fois par resto (idempotent).
- adminAdjust(restaurantId, points signé, adminId, note OBLIGATOIRE).
- fetchLedger(restaurantId, limit/offset) et fetchAllBalances() pour l'admin.

VÉRIFICATEUR : créer scripts/verify-points.mjs (node pur, sans DOM : injecter un
localStorage en mémoire) qui déroule et affiche PASS/FAIL sur AU MOINS : recharge puis
hold puis consume (solde final exact) ; hold refusé si solde insuffisant ; release ;
penalty (1 consommé / 2 restitués) ; convert_refund avec arrondi supérieur ; refus de
solde négatif ; idempotence (rejouer hold/consume/validate ne change rien) ; welcome
bonus unique. Ajouter le script npm `verify:points` à app/package.json.

CRITÈRES DE SORTIE : npm run verify:points → tous PASS (coller la sortie dans le
tracking) ; build vert ; lint-diff nul ; aucun changement de comportement de l'app.
```

---

## PTS-02 — Branchement au cycle de commande + verrou d'acceptation resto

```
[Bloc de contexte commun]
PRÉREQUIS : PTS-01.

MISSION PTS-02 — brancher les points au point de passage unique des commandes.

1. src/lib/orders.ts (imiter le précédent CustomerBlockedError) :
   - Transition vers 'confirmed' (acceptation resto) → holdPoints(restaurantId, orderId).
     InsufficientPointsError remonte à l'appelant, la transition N'A PAS lieu.
   - Transition vers 'delivered' → settleHold(..., 'consume').
   - Transition vers 'cancelled' → settleHold(..., cancelledBy === 'restaurant'
     ? 'penalty' : 'release') — uniquement si un hold actif existe (commande
     acceptée) ; une annulation avant acceptation ne touche pas aux points.
   - Attention : ne PAS casser les autres statuts ni les transitions bornées par rôle.
2. src/pages/RestaurantDashboard.tsx :
   - Badge solde permanent dans l'en-tête du dashboard (icône + « X pts »), couleur
     erreur si < LOW_BALANCE_THRESHOLD_POINTS, cliquable → onglet finances.
   - Bouton « Accepter » : si canAcceptOrder() est faux, bouton visuellement présent
     mais désactivé + message inline « Solde insuffisant — rechargez pour accepter »
     + CTA « Recharger » (→ onglet finances). Le resto VOIT toujours les commandes.
   - Catch d'InsufficientPointsError sur l'acceptation (cas limite de concurrence) →
     toast d'erreur actionnable, commande inchangée.
3. Activation : grantWelcomeBonus à la première ouverture du dashboard d'un resto
   approuvé sans aucune écriture ledger (si WELCOME_BONUS_POINTS > 0).

SCÉNARIO DE SORTIE (mode mock, mobile 360 puis desktop) : resto neuf → bonus 10 pts
visible ; client passe 2 commandes → resto accepte la 1re (10→7 held/consomme selon
étape), accepte la 2e (7→4) ; 4 < 6 → une 3e commande ne peut plus être acceptée
(bouton désactivé + CTA visible) mais les 2 en cours continuent (ready → delivered →
consume OK, ledger cohérent). Annulation par le resto d'une commande acceptée →
pénalité 1 pt vérifiée dans le ledger. Happy path client→resto→livreur existant
NON cassé. Build + verify:points + lint-diff + tracking.
```

---

## PTS-03 — Écran solde & recharge (dashboard restaurant)

```
[Bloc de contexte commun]
PRÉREQUIS : PTS-02.

MISSION PTS-03 — onglet finances du RestaurantDashboard : section « Mes points ».

1. Carte solde : points disponibles (gros), réservés (discret), équivalence FCFA,
   bouton « Recharger » ≥ 44px.
2. Parcours de recharge (Dialog shadcn, mobile-first) :
   a. Choix quantité (min MIN_RECHARGE_POINTS, presets 10/20/50 + champ libre),
      total FCFA affiché ;
   b. Choix méthode : Mobile Money (afficher les instructions et le numéro de dépôt
      MiamExpress — valeur À COMPLÉTER dans launchConfig, pattern « Bientôt » si null)
      ou Cash chez un partenaire ;
   c. Création de la demande → écran récap avec paymentRef à rappeler lors du dépôt
     + note « validée par MiamExpress sous 24 h » ; la demande apparaît « En attente »
     dans l'historique. AUCUNE promesse de crédit automatique (phase 1 manuelle).
3. Historique : liste ledger + demandes de recharge fusionnées par date (libellés
   français clairs : « Commande #ab12 — 3 pts », « Pénalité annulation », « Recharge
   +10 pts (en attente) »...), pagination simple, états loading/empty/error.
4. Alerte solde faible : bannière dans l'onglet commandes quand
   available < LOW_BALANCE_THRESHOLD_POINTS (+ toast à l'ouverture du dashboard,
   une fois par session).

SCÉNARIO DE SORTIE : dérouler une demande de recharge MoMo 10 pts → pending visible
avec référence ; historique reflète exactement le ledger du scénario PTS-02 ;
alerte visible à 4 pts ; 360px sans débordement horizontal (mesurer scrollWidth).
Build + verify:points + lint-diff + tracking.
```

---

## PTS-04 — Garantie client : paiement au code marchand + confirmation resto

```
[Bloc de contexte commun]
PRÉREQUIS : PTS-02 (PTS-03 non requis).

MISSION PTS-04 — sécurisation client par garantie FCFA, déduite du total (jamais
remboursée dans le cas nominal — c'est le cœur anti-tracasserie).

1. Modèle : ajouter à Order un champ guarantee { status: 'awaiting_payment' |
   'declared' | 'confirmed' | 'forfeited' | 'refunded', amountFcfa, declaredAt?,
   confirmedAt?, proofNote? } — PAS de nouveau statut global de commande (ne pas
   toucher à la machine pending→…→delivered ni au stepper) : la garantie est un
   sous-état de 'confirmed'. Renseigné à l'acceptation avec GUARANTEE_AMOUNT_FCFA.
2. Parcours client (src/pages/Orders.tsx, carte commande au statut confirmed) :
   - Encart « Sécurisez votre commande » : montant, code marchand du resto
     (restaurant.merchantCode) + numéro WhatsApp assistance (assistanceWhatsapp,
     lien wa.me préviens rempli avec la référence commande) — si le resto n'a pas
     ces données, message « paiement à la livraison uniquement » et la garantie est
     ignorée (status confirmed d'office) : ne JAMAIS bloquer une commande sur une
     donnée manquante.
   - Bouton « J'ai payé la garantie » → status 'declared' (+ note optionnelle type
     référence de transaction ; PAS d'upload de fichier obligatoire — la preuve
     formelle n'est demandée qu'en litige).
   - Affichage : « Garantie 1 000 F — déduite du total à la livraison » et le
     « Reste à payer à la livraison : total − garantie » partout où le total figure.
3. Parcours resto (RestaurantDashboard, commande confirmed) :
   - Badge « Garantie déclarée payée » + bouton « Confirmer réception » (le resto
     vérifie SON compte MoMo — c'est lui la source de vérité, pas une capture) →
     'confirmed' ; bouton « Non reçue » → retour 'awaiting_payment' + toast.
   - Le passage à 'preparing' est BLOQUÉ tant que guarantee.status n'est pas
     'confirmed' (ou ignorée faute de merchantCode).
4. Profil resto (onglet profile du dashboard) : champs éditables Code marchand et
   WhatsApp assistance (persistés via l'override resto existant en mock).

SCÉNARIO DE SORTIE : commande → acceptation → l'encart client affiche code marchand
+ WhatsApp → « J'ai payé » → le resto confirme → preparing possible ; à la livraison
le récap affiche total − 1000 F « reste à payer » ; resto sans merchantCode → aucun
blocage. 360px d'abord. Build + verify:points + lint-diff + tracking.
```

---

## PTS-05 — Issues anormales : arbitrage, confiscation, remboursement sur caution

```
[Bloc de contexte commun]
PRÉREQUIS : PTS-04 (+ lire src/lib/incidents.ts et src/pages/admin/AdminDisputes.tsx).

MISSION PTS-05 — les 3 issues anormales, arbitrées par le code de livraison :

1. RÈGLE D'ARBITRAGE (à afficher aux deux parties au moment de la livraison) :
   code de livraison remis = livraison conforme. Un client qui refuse la remise DOIT
   ouvrir un litige dans l'app (motif obligatoire + photo optionnelle, réutiliser le
   mécanisme incidents/disputes existant) — sinon, au bout du délai, garantie perdue.
2. Rejet client jugé ABUSIF (décision admin sur le litige) :
   guarantee.status → 'forfeited' ; répartition tracée dans le litige : frais de
   livraison au livreur d'abord (GUARANTEE_FORFEIT_DRIVER_FIRST), reliquat au resto
   (phase 1 : versements manuels hors app — l'écran doit l'indiquer, pas de fausse
   automatisation) ; 2e rejet abusif du même client → isSuspended (mécanisme existant,
   contrôlé par CustomerBlockedError à la commande suivante).
3. Non-livraison par FAUTE RESTO/LIVREUR (décision admin) :
   guarantee.status → 'refunded' ; le remboursement est GARANTI par la caution :
   convertPointsToRefund(restaurantId, disputeId, montant) si la faute est resto
   (écriture ledger visible du resto) ; commande → cancelled avec
   cancelledBy='restaurant' → la pénalité PTS-02 s'applique aussi.
4. AdminDisputes : sur chaque litige garanti, boutons « Rejet abusif » / « Faute
   resto » / « Faute livreur » qui appliquent tout ce qui précède en une action,
   avec récapitulatif de ce qui va se passer AVANT confirmation (Dialog).

SCÉNARIO DE SORTIE : (a) rejet abusif → garantie forfeited, répartition affichée,
récidive → client bloqué à la commande suivante ; (b) faute resto → garantie refunded
+ 2 pts convertis (1000/500) visibles au ledger + pénalité d'annulation ; (c) parcours
nominal du PTS-04 inchangé. Build + verify:points + lint-diff + tracking.
```

---

## PTS-06 — Back-office admin des points

```
[Bloc de contexte commun]
PRÉREQUIS : PTS-03 et PTS-05.

MISSION PTS-06 — page /admin/points (route dans src/App.tsx sous RoleGate['admin'],
entrée sidebar BackOfficeLayout, PageHeader — imiter AdminCustomers) :

1. File des recharges « En attente » (la plus visible) : demande, resto, montant,
   référence, ancienneté ; « Valider » (→ decideRecharge, crédit ledger, toast) /
   « Rejeter » (motif obligatoire en Dialog). Badge compteur pending dans la sidebar.
2. Table des soldes : tous les restos, disponible/réservé, tri par solde, alerte
   visuelle < seuil, lien vers le ledger du resto (panneau ou Dialog, paginé).
3. Ajustement manuel : ±points avec motif OBLIGATOIRE (adminAdjust), tracé au ledger,
   confirmation avant application.
4. Stats simples en tête : points en circulation, CA points du mois (recharges
   validées × prix), nb restos sous le seuil.
5. États loading/empty/error partout ; 360px utilisable (tableaux → overflow-x-auto
   interne, jamais de scroll X de page).

SCÉNARIO DE SORTIE : valider la recharge pending du PTS-03 → le solde resto passe de
4 à 14, visible côté resto sans re-login ; rejeter une autre avec motif ; ajustement
−2 avec motif tracé. Build + verify:points + lint-diff + tracking.
```

---

## PTS-07 — Recette transverse de bout en bout (mode mock)

```
[Bloc de contexte commun]
PRÉREQUIS : PTS-00 → PTS-06 tous verts. AUCUNE fonctionnalité nouvelle : corrections
de finition uniquement.

MISSION PTS-07 — dérouler et consigner les 3 scénarios de recette (comptes mock,
mobile 360 PUIS desktop 1280, zéro erreur console, zéro scroll X mesuré) :

S1 NOMINAL : recharge validée → commande → acceptation (hold) → garantie payée/
confirmée → preparing → … → livraison avec code → consume → ledger exact à l'écriture
près (les lister dans le tracking).
S2 FAUTE RESTO : acceptation → annulation resto → pénalité 1 pt + garantie refunded
+ conversion caution → soldes exacts.
S3 REJET ABUSIF : livraison conforme, client refuse le code → litige → décision
admin « abusif » → garantie forfeited + répartition → récidive → client bloqué.

Puis : vérifier chaque état vide/chargement/erreur des écrans du chantier ; cibles
tactiles ≥ 44px sur toutes les nouvelles actions ; cohérence tokens (vert/or, texte
or sur fond clair = text-amber-700 conformément aux conventions du dépôt) ; happy
path PRÉ-EXISTANT (sans points) re-testé pour non-régression : les 4 profils.
npm run build + npm run verify:points + lint global comparé à la baseline PTS-00.
Rapport final de recette dans le tracking (gabarit en coordination).
```

---

## PTS-08 — Backend VPS : migration SQL + endpoints + branche VPS de la lib

```
[Bloc de contexte commun]
PRÉREQUIS : PTS-07 (le comportement mock est la spécification de référence).
Le code serveur EST dans le workspace : app/server/src/index.js (Express + pg,
routes spécifiques + /api/:table générique). RÈGLES ABSOLUES : ne rien exécuter
contre la base/le VPS de production depuis ce poste ; livrer du code + la procédure —
le déploiement (SSH, migration, restart) est un acte MANUEL de l'utilisateur.

MISSION PTS-08 :
1. Migration SQL app/server/migrations/2026xxxx_points.sql : tables points_ledger
   (append-only : PAS d'UPDATE/DELETE applicatifs ; contrainte UNIQUE (kind,
   reference) pour l'idempotence) et point_recharges ; colonnes guarantee_* sur
   orders ; index (restaurant_id, created_at).
2. Routes dédiées dans app/server/src/index.js (le générique /api/:table ne suffit
   pas : les règles doivent être TRANSACTIONNELLES côté serveur) :
   GET  /api/points/balance/:restaurantId
   GET  /api/points/ledger/:restaurantId
   POST /api/points/hold            { orderId }            (auth resto, transaction)
   POST /api/points/settle          { orderId, outcome }   (auth resto/admin)
   POST /api/points/recharges       { points, method }     (auth resto)
   PATCH /api/points/recharges/:id  { decision, reason }   (auth admin)
   POST /api/points/convert-refund  { disputeId, amount }  (auth admin)
   POST /api/points/adjust          { points, note }       (auth admin)
   Chaque écriture : transaction pg, re-vérification du solde EN BASE (pas de
   confiance client), idempotence par la contrainte UNIQUE, erreurs JSON en français.
3. Brancher la branche VPS de src/lib/points.ts sur ces routes (fetch relatif /api/...,
   via apiFetch de l'adaptateur ou fetch direct — suivre le pattern existant).
4. Livrer la procédure de déploiement pas à pas (fichiers à copier, psql migration,
   pm2/systemd restart, tests curl de chaque route) dans le tracking — SANS l'exécuter.

CRITÈRES DE SORTIE : build front vert ; verify:points vert (mock inchangé) ;
node --check sur index.js ; revue manuelle de chaque route contre les invariants §0
consignée dans le tracking ; procédure de déploiement livrée.
```

---

## Récapitulatif

| Lot | Périmètre | Dépend de |
|---|---|---|
| PTS-00 | POINTS_CONFIG, champs resto, tracking, baseline | — |
| PTS-01 | lib points.ts + verify:points | PTS-00 |
| PTS-02 | Hold/settle dans orders.ts + verrou d'acceptation | PTS-01 |
| PTS-03 | Écran solde & recharge resto | PTS-02 |
| PTS-04 | Garantie client (code marchand + WhatsApp + confirmation) | PTS-02 |
| PTS-05 | Litiges, confiscation, remboursement sur caution | PTS-04 |
| PTS-06 | Admin points (recharges, soldes, ajustements) | PTS-03, PTS-05 |
| PTS-07 | Recette E2E mock + finitions | PTS-00→06 |
| PTS-08 | SQL + endpoints VPS + branche VPS de la lib | PTS-07 |
