# Plan — Modes de paiement configurables + Centre Financier (série PAY/FIN)

Spec figée. Source de vérité du chantier. À valider avant tout code (comme LOT-0 Ops).

## 0. Objet

Rendre le **modèle de paiement** configurable par l'admin (au lieu d'être implicite),
avec **3 modes** ; selon le mode choisi, tout le parcours s'adapte **de bout en bout**
(checkout → acceptation → livraison → réconciliation). Construire en parallèle le
**Centre Financier** qui réconcilie l'argent selon le mode.

## 1. Réalité du code actuel (audité — ne pas re-supposer)

- **Commission** = 15 % du sous-total, calculée **côté serveur** (`commissionForSubtotal`,
  `points-routes.js`). Réservée sur le **porte-monnaie resto** (série PTS, FCFA) à
  l'**acceptation** via `POST /api/points/hold` ; réglée à la **livraison** via
  `POST /api/points/settle` (`consume`) ; `release`/`penalty` à l'annulation.
  Ledger `points_ledger` **immuable, idempotent** par `(kind, reference=orderId)`
  (moteur `pointsCore.ts`). Le montant réservé = commission uniquement.
- **Livreur** : rémunéré séparément (`DRIVER_PAY_CONFIG` : base + km + temps + surge +
  pourboire + bonus volume) via le système de payouts — **pas** débité du wallet resto.
- **Client** : moyens de paiement au checkout = `cash` (à la livraison), `mtn_momo`,
  `orange_money`. MoMo via `POST /api/payments/momo`. `orders.payment_status` = pending.
- **Garantie** client : mécanisme séparé (`settleGuarantee`), inchangé ici.
- `orders` porte déjà `payment_method`, `payment_status`, **`fee_breakdown jsonb`**,
  `delivery_fee`, `subtotal`, `total`.
- **Contrainte DB** : l'utilisateur `miamexpress` ne possède pas les tables cœur
  (`ALTER TABLE orders` probablement refusé, comme `applications`). → le mode figé par
  commande se stocke dans **`fee_breakdown`** (jsonb, déjà écrit au checkout) ou une
  **table annexe** que l'on possède, jamais via ALTER d'`orders`.

## 2. Les 3 modes (flux monétaires précis)

Réservation à l'acceptation = `hold` sur le wallet resto ; règlement à la livraison = `consume`.

| Mode | Le client paie… | Réservation wallet à l'acceptation | À la livraison |
|---|---|---|---|
| **`cod`** *(défaut, actuel)* | le **livreur** en cash (ou MoMo plateforme) | **commission** (15 %) | `consume` commission ; livreur payé via payouts ; **réconciliation cash livreur** |
| **`prepaid_platform`** | la **plateforme** (MoMo/carte au checkout) | **rien** (fonds déjà chez la plateforme) | la plateforme reverse resto (`sous-total − commission`) + livreur (frais) ; garde la commission |
| **`prepaid_restaurant`** *(nouveau)* | le **restaurant** d'avance | **commission + frais de livraison** (bloque l'acceptation si solde insuffisant) | `consume` (commission gardée + frais) ; **le livreur est crédité des frais** (financés par le wallet resto) |

**Invariant de sécurité (mode 3)** : le wallet resto doit couvrir *commission + frais livreur*
à l'acceptation, sinon acceptation refusée — exactement le garde-fou déjà en place pour la
commission (`InsufficientPointsError`). C'est ce qui neutralise le risque de crédit.

## 3. Le levier unique : `payment_mode`

- **Réglage global** `app_settings.payment_mode ∈ {cod, prepaid_platform, prepaid_restaurant}`
  (défaut `cod`). Lecture publique (checkout en a besoin), écriture admin — même pattern que
  `demo_tracking`/`operations_thresholds`.
- **Override par restaurant** (phase 2, optionnel) : `restaurants` peut porter un mode
  spécifique ; sinon hérite du global. Permet un parc mixte.
- **Snapshot par commande** : au checkout, le mode effectif est **figé dans
  `orders.fee_breakdown.payment_mode`** → l'historique reste cohérent même si le global change.

Ce seul paramètre pilote 4 étapes :

1. **Checkout** (`Checkout.tsx`, `payments.ts`) : options de paiement affichées + destinataire
   + libellé d'instruction (« payez le livreur » / « payé en ligne » / « réglez le restaurant »).
2. **Acceptation** (serveur `/api/points/hold`) : montant réservé = `reservationForOrder(order, mode)`
   = `commission + (mode==='prepaid_restaurant' ? delivery_fee : 0)` ; `cod`=commission ;
   `prepaid_platform`=0 (pas de hold).
3. **Livraison** (serveur `/api/points/settle` + payout livreur) : `consume` ; en `prepaid_restaurant`,
   **crédit livreur** des frais (nouvelle écriture au ledger livreur) ; en `prepaid_platform`,
   **payout resto** (`sous-total − commission`) + payout livreur.
4. **Finance** (nouveau) : vue de réconciliation adaptée au mode de chaque commande.

Changement moteur minimal : `pointsCore`/`points-routes` — généraliser le **montant réservé**
(mode-aware) ; la machine `consume/release/penalty` reste identique.

## 4. Centre Financier (mode-aware)

Page `/admin/finance` (permissions `finance.*` déjà définies en RBAC — squelette prêt).
Chaque commande porte son mode ; l'écran agrège en conséquence :

- **`cod`** → **Réconciliation cash par livreur** : encaissé (sous-total + frais) vs dû à la
  plateforme (sous-total, la plateforme reversant le resto) − frais gardés ; solde livreur.
- **`prepaid_platform`** → **Règlements sortants** : à payer resto (`sous-total − commission`),
  à payer livreur (frais) ; revenu commission encaissé.
- **`prepaid_restaurant`** → **Dette resto** (commission + frais recouvrés sur wallet) +
  **à payer livreur** (frais, déjà financés).

Écrans : synthèse (revenu plateforme = commission + marge livraison ; split cash/MoMo),
détail par commande, agrégats **par livreur** / **par restaurant** / **par période**,
remboursements, **export CSV** (`finance.export`). Données : dérivées du `points_ledger`
(resto), d'un **ledger livreur** (payouts/credits) et des commandes livrées.

## 5. Modèle de données (sans ALTER des tables cœur)

- `app_settings.payment_mode` (jsonb) — réglage global.
- `orders.fee_breakdown.payment_mode` — snapshot par commande (écrit au checkout).
- **`driver_ledger`** (nouvelle table possédée) : `id, driver_id, order_id, kind
  ['earning'|'payout'|'adjustment'], amount_fcfa, reference, created_at` — trace ce que
  la plateforme doit / a payé au livreur (aujourd'hui éparpillé). Idempotent par `(kind, reference)`.
- **`settlements`** (optionnel, phase 2) : clôtures de période par livreur/resto.

## 6. Garde-fous

- Acceptation refusée si wallet < réservation (mode 3) — réutilise `InsufficientPointsError`.
- Montant réservé **calculé serveur** (jamais confié au client), comme la commission.
- Snapshot du mode à la commande (immuable) — pas de recalcul rétroactif.
- Idempotence de toutes les écritures (ledger append-only, `(kind, reference)`).
- `verify:points` étendu au nouveau montant mode-aware.

## 7. Découpage en lots

| Lot | Livrable |
|---|---|
| PAY-0 | **Cette spec** + validation |
| PAY-1 | `payment_mode` (app_settings) + lib config + snapshot `fee_breakdown` au checkout |
| PAY-2 | Réservation mode-aware (serveur hold = commission + frais si mode 3) + garde-fou acceptation [JALON serveur] |
| PAY-3 | Règlement mode-aware (livraison : crédit livreur mode 3, payouts mode 2) + `driver_ledger` |
| PAY-4 | Checkout adapté par mode (options, destinataire, libellés) |
| FIN-5 | Centre Financier `/admin/finance` — synthèse + réconciliation par mode + agrégats |
| FIN-6 | Détail par commande + export CSV + remboursements |
| PAY-7 | Réglage admin (choix du mode) + override resto (optionnel) + i18n |
| PAY-8 | Garde-fous + déploiement + recette E2E par mode |

## 8. Décisions à valider (avant code)

1. **Périmètre v1** : les 3 modes d'emblée, ou d'abord `cod` (réconciliation, sans changer le
   parcours) + `prepaid_restaurant`, et `prepaid_platform` quand l'encaissement MoMo plateforme
   sera prêt ?
2. **Mode 3 — frais livreur** : réservés à l'acceptation en plus de la commission (recommandé),
   confirmé ?
3. **Override par restaurant** en v1, ou global d'abord (recommandé : global d'abord) ?
4. **Centre Financier** : construit en même temps (recommandé, indissociable) ou juste après.
