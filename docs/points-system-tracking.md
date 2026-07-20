# Tracking — Système de points (série PTS)

## Décisions produit actées (§0 de points-system-prompts.md)
POINT_PRICE_FCFA 500 · ORDER_COST_POINTS 3 · PENALTY_RESTAURANT_FAULT_POINTS 1 ·
MIN_BALANCE_TO_ACCEPT_POINTS 6 · MIN_RECHARGE_POINTS 10 · LOW_BALANCE_THRESHOLD_POINTS 6 ·
WELCOME_BONUS_POINTS 10 · GUARANTEE_AMOUNT_FCFA 1000 · GUARANTEE_MODE 'deducted' ·
GUARANTEE_FORFEIT_DRIVER_FIRST true · RECHARGE_MOMO_NUMBER null (à compléter au lancement)
— vivent dans `src/data/launchConfig.ts` (POINTS_CONFIG). Aucune modification à ce jour.

## État des lots
| Lot | Statut | Date | Fichiers touchés | verify:points | Build | Notes |
|-----|--------|------|------------------|---------------|-------|-------|
| PTS-00 | ✅ terminé | 2026-07-19 | launchConfig.ts, mockData.ts, CLAUDE.md, tracking | n/a | ✅ (baseline) | POINTS_CONFIG (11 clés + RECHARGE_MOMO_NUMBER null), merchantCode/assistanceWhatsapp sur restos 1 & 2 |
| PTS-01 | ✅ terminé | 2026-07-19 | pointsCore.ts (nouveau), points.ts (nouveau), scripts/verify-points.mjs, package.json | ✅ 11/11 PASS | tsc ✅ | Écart consigné : moteur extrait dans pointsCore.ts (storage+config injectés) pour être exécutable sous Node — points.ts reste la façade double-chemin ; clause « OU held>0 » de canAcceptOrder abandonnée au profit du scénario PTS-02 (référence) ; verify:points requiert Node ≥ 23.6 (type-stripping) |
| PTS-02 | ✅ terminé | 2026-07-19 | orders.ts (hold à confirmed via updateOrderStatus ET confirmOrderWithPreparation ; consume à delivered ; penalty/release à cancelled), RestaurantDashboard.tsx (badge solde en-tête, verrou Accepter + CTA Recharger, bonus bienvenue, catch InsufficientPointsError) | ✅ 11/11 | ✅ | Scénario navigateur : 10→7→4, verrou à 4 pts (3 boutons désactivés + 3 CTA), delivered→consume:0, annulation resto→penalty:+2, solde final 6/0 exact. Chemin VPS d'orders.ts intact (hold/settle serveur en PTS-08). |
| PTS-03 | ✅ terminé | 2026-07-19 | RestaurantDashboard.tsx (PointsSection : solde/équivalence FCFA, dialog recharge presets+libre, méthodes momo/cash, écran réf. PTS-xxxxxx, historique fusionné ledger+demandes, bannière solde faible onglet commandes) | ✅ | ✅ | Scénario : demande 10 pts momo → pending réf. PTS-39SXRB, fallback « numéro communiqué par l'assistance » (RECHARGE_MOMO_NUMBER null) ; bannière visible à 3 pts ; dialog 328×526 dans le viewport 360 ; 0 scroll X (orders/finances/dialog). |
| PTS-04 | ✅ terminé | 2026-07-20 | orders.ts (GuaranteeStatus/OrderGuarantee, initialGuarantee à l'acceptation, garde preparing, declare/confirm/reject/settleGuarantee, remainingDueAtDelivery, getRestaurantMerchantInfo via overrides+mock), Orders.tsx (GuaranteeCard composant dédié, reste à payer), RestaurantDashboard.tsx (bloc confirmation garantie, blocage avance, champs profil merchantCode/assistanceWhatsapp) | ✅ | ✅ | Scénario UI complet : acceptation → garantie awaiting(1000) → preparing REFUSÉ (message FR) → client déclare (réf. MP240719.1234, encart 360px avec code 057575 + wa.me) → « reste à payer 5 000 » → resto « Paiement reçu » → preparing OK. Sans code marchand (resto 3) : guarantee null, preparing direct, remaining=total. Écart consigné : encart extrait en composant GuaranteeCard (le compilateur React rejette l'IIFE dans la liste — diagnostic « refs during render », isolé par probe différentielle). |
| PTS-05 | ✅ terminé | 2026-07-20 | incidents.ts (+livraison_refusee/commande_non_conforme, reportedBy), orders.ts (markAbusiveRejection 2-strikes→isSuspended, applyGuaranteeDecision, GuaranteeDecisionResult), Orders.tsx (règle « code remis = conforme », bouton litige + dialog motif obligatoire), DriverDashboard.tsx (filtre motif client), AdminDisputes.tsx (3 décisions + récap avant application + note de traitement auto) | ✅ | ✅ | Scénarios UI : (a) rejet abusif → forfeited, cancelled(customer), hold release, répartition 1000/0 (fee=1000), strike 1, incident résolu tracé ; (b) faute resto → refunded, ledger [hold:-3, convert_refund:-2, penalty:+2], solde 13/0 ; (c) 2e abusif → répartition 800/200, suspended, CustomerBlockedError à la commande suivante. Écart : photo de litige non implémentée (texte seul, phase 1 — pas d'upload base64). |
| PTS-06 | ✅ terminé | 2026-07-20 | AdminPoints.tsx (nouveau : stats, file pending, soldes triés + BAS, ledger Dialog, ajustement motivé, rejet motivé), App.tsx (route /admin/points), BackOfficeLayout.tsx (entrée sidebar Coins) | ✅ | ✅ | Scénario UI : valider (+10 resto 3 → 17/3), rejeter avec motif tracé, ajuster −2 avec note au ledger ; stats (23 en circulation) ; 360px sans scroll X. |
| PTS-07 | ✅ terminé | 2026-07-20 | orders.ts (complément : annulation d'une commande garantie → refunded + conversion caution si faute resto, idempotent) | ✅ 11/11 | ✅ 26 s | Recettes S1/S2/S3 : voir journal ci-dessous. Lint des 13 fichiers du chantier = baseline exact (13). Legacy order sans garantie/hold : affichage et clôture sans erreur. 0 scroll X à 360 sur /commandes, dashboard resto (2 onglets), /admin/points, /admin/disputes. |
| PTS-08 | ✅ terminé | 2026-07-20 | server/migrations/20260720_points.sql (nouveau), server/src/points-routes.js (nouveau, 10 routes transactionnelles), server/src/index.js (register + préfixe 'points' exclu du CRUD générique ×2) | ✅ (mock inchangé) | ✅ front ; node --check ✅ serveur | RIEN exécuté contre la prod. Revue invariants + procédure de déploiement ci-dessous. |

Statuts : ⬜ à faire / 🔄 en cours / ✅ terminé / ⛔ bloqué (motif obligatoire)

## Baseline (PTS-00) — 2026-07-19
- Build : ✅ `tsc -b && vite build` (36.3 s), warnings connus (chunk >500 kB, import mixte supabase.ts).
- Lint global : **75 problèmes (73 erreurs, 2 warnings)** — référence anti-régression.
  (Note : 78 lors du chantier PIX ; 3 corrigées entre-temps par une autre session.)
- Environnement de test : serveur mock launch.json `yamo-web-mock` (3010) ou
  `yamo-web-mock-3011` — vérifier `isSupabaseConfigured === false` avant toute mutation.
- Comptes mock : +237690000001..4 (client/resto/livreur/admin).

## Écarts découverts / problèmes reportés
(néant à ce jour)

## Journal des scénarios de recette (PTS-07) — 2026-07-20, état vierge, mode mock vérifié

**S1 NOMINAL — PASS.** bonus(+10) → recharge validée réf. PTS-AJFF63 (+10) → commande
10 000 F (livraison 1 000) → acceptation → garantie awaiting(1000) → déclarée réf.
MOMO-S1-REF → confirmée resto → preparing→ready→picked_up→delivering (reste à payer
mesuré : 9 000 F) → delivered code 4547. Ledger : [welcome_bonus:+10, recharge:+10,
hold:-3, consume:0] → solde 17/0. Exact à l'écriture près.

**S2 FAUTE RESTO — PASS.** Commande garantie confirmée → cancelOrder(restaurant).
Ledger commande : [hold:-3, penalty:+2, convert_refund:-2] (net −3 : 1 pénalité +
2 caution) ; garantie refunded ; solde 17→14. Découverte en recette : l'annulation
resto DIRECTE (hors arbitrage) laissait la garantie pendante → complété dans
cancelOrder (refund + conversion idempotente sur orderId, compatible avec
applyGuaranteeDecision qui repasse par là).

**S3 REJET ABUSIF ×2 — PASS.** 2 cycles complets jusqu'à delivering + incident
livraison_refusee + décision admin : strikes 1 puis 2, suspended=true au 2e,
répartition 700 F livreur / 300 F resto (fee 700 < garantie 1000), garanties
forfeited, holds released (resto non pénalisé), puis createOrder →
CustomerBlockedError. Variante UI (répartition 1000/0, récap avant application,
note de traitement tracée) validée en PTS-05.

## Complément post-chantier — Observabilité des mouvements (2026-07-20)
Demande : historique des mouvements sur chaque profil concerné ; chaque recharge visible
côté admin. Audit : resto déjà complet (« Mes points ») ; admin n'avait que la file
pending + le ledger par resto. Ajouté :
- **AdminPoints « Historique des recharges »** : toutes les demandes (pending/validated/
  rejected) avec montant, méthode, référence, dates, décideur, motif de rejet ; filtre
  par statut ; pagination « voir plus ».
- **AdminPoints « Derniers mouvements »** : flux global du ledger (30 derniers, tous
  restos) — nom du resto, libellé, kind, auteur, points signés colorés.
- Socle : `fetchGlobalLedger` (pointsCore + points.ts) + route VPS
  `GET /api/points/ledger` (admin, paginée) dans points-routes.js.
Vérifié : rendu avec les données des recettes (PTS-AJFF63 « décidée par s1-admin »),
filtre Rejetées→vide→Toutes, 360px sans scroll X ; tsc ✅, eslint 0 sur fichiers touchés,
node --check ✅, verify:points 11/11, build ✅ (33.6 s).

## Complément post-chantier 2 — Dotation promotionnelle en masse (2026-07-20)
Besoin lancement : offrir des points gratuitement en masse aux restaurants.
- Moteur : kind `promo_grant` + `grantPromo(restaurantId, points, campaignId, note, adminId)`
  — idempotent par (campagne, resto) : rejouer une campagne ne double-crédite JAMAIS ;
  nouvelle vague = nouvel identifiant de campagne. Test verify:points ajouté (12/12 PASS).
- Façade : `grantPromoBulk(ids, points, campaignId, note, adminId)` → mock boucle /
  VPS un seul POST `/api/points/promo-grant` (admin, transaction unique, 1..500 ids,
  ON CONFLICT DO NOTHING). Migration SQL : 'promo_grant' ajouté au CHECK (fichier non
  encore déployé → modification sûre).
- UI : bouton « Offrir des points » (icône cadeau) dans l'en-tête d'/admin/points →
  dialog : points/resto, identifiant de campagne (explication de l'idempotence),
  libellé visible au ledger des restos, total offert en points et FCFA, confirmation
  « Offrir à N restos ».
- Vérifié en mock : 25 restos crédités en un clic (réf. lancement-2026:<id>), resto 1
  14→24 pts, rejeu même campagne → {granted:0, alreadyGranted:3}. Le libellé apparaît
  dans « Mes points » côté resto (ledger-driven). Build ✅ 40 s, tsc ✅, lint 0 sur
  fichiers touchés, node --check ✅.
- Connexion VPS validée le même jour (ssh miamexpress-vps, permission accordée) :
  API up 3002/3003, 53 G libres — le paquet de déploiement PTS-08 (qui inclut
  désormais promo-grant) reste à déployer.

## PTS-08 — Revue serveur + procédure de déploiement (2026-07-20)

### Revue des routes contre les invariants §0
- **Jamais négatif** : hold/convert-refund/adjust re-vérifient le solde EN BASE dans la
  transaction, sous verrou advisory par resto (`pg_advisory_xact_lock(hashtext(rid))`) —
  deux acceptations simultanées sont sérialisées. ✓
- **Append-only** : aucune route ne fait UPDATE/DELETE sur points_ledger (seul
  point_recharges a un UPDATE de statut, avec garde `AND status='pending'`). ✓
- **Idempotence** : contrainte UNIQUE (kind, reference) + `ON CONFLICT DO NOTHING` puis
  relecture ; settle rejoué renvoie l'écriture existante ; validation de recharge rejouée
  sans double crédit (référence = id de la demande). ✓
- **Solde dérivé** : computeBalance = SUM(points) + holds non soldés, jamais stocké. ✓
- **Autorisations** : resto limité à son propre compte (`req.user.restaurantId`),
  convert-refund/adjust/balances/decision admin-only ; erreurs métier en 402 JSON
  français (mappées sur InsufficientPointsError par le front, points.ts). ✓
- Barème serveur = copie de POINTS_CONFIG (commentaire de synchronisation en tête du
  module) — écart assumé phase 1 : pas de source partagée front/serveur.

### Procédure de déploiement (MANUELLE — à exécuter par vous sur le VPS)
1. Copier sur le VPS (répertoire de l'API) :
   - `app/server/migrations/20260720_points.sql`
   - `app/server/src/points-routes.js`
   - `app/server/src/index.js` (remplace l'existant — contient l'import + register + les 2 listes `known` patchées)
2. Migration (une fois) :
   `psql -U miamexpress -d miamexpress -f 20260720_points.sql`
   (nécessite `gen_random_uuid()` — pgcrypto/PG13+ ; sinon `CREATE EXTENSION IF NOT EXISTS pgcrypto;`)
3. Redémarrer l'API : `npm run vps:restart` (ou pm2/systemd selon l'installation).
4. Tests curl (remplacer $TOK par un JWT admin obtenu via /api/auth/signin) :
   - `curl -H "Authorization: Bearer $TOK" https://miamexpress.cm/api/points/balances` → `{}`
   - `curl -X POST -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d '{"restaurantId":"<uuid resto>","points":10,"method":"momo"}' https://miamexpress.cm/api/points/recharges` → demande pending
   - `PATCH /api/points/recharges/<id>` `{"decision":"validate"}` → puis balance = 10.
   - Rejouer le PATCH → même réponse, solde inchangé (idempotence).
   - `POST /api/points/hold` `{"restaurantId":…,"orderId":"test-1"}` ×2 → une seule écriture.
5. Basculer le front : build avec `VITE_USE_VPS_API=true` (déploiement habituel) —
   src/lib/points.ts route alors tout vers /api/points/*.
6. Reste côté serveur (phase suivante, hors périmètre PTS-08) : déplacer le hold/settle
   DANS les transitions de statut serveur quand celles-ci seront centralisées côté API
   (aujourd'hui le front VPS appelle statut puis points séparément via l'adaptateur —
   fenêtre d'incohérence possible en cas de coupure entre les deux appels).
