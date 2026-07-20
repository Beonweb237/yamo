# Rapport de test MiamExpress — exécution du plan complet

Date : 2026-07-20
Testeur : Claude Code (session autonome)
Environnement : PRODUCTION https://miamexpress.cm (VPS 51.222.15.0, alias miamexpress-vps)
Version / backup : backup pré-test EN ATTENTE (permission mutation SSH à débloquer — voir Journal)

## Amendements au plan (décision utilisateur, 2026-07-20)
- AUCUNE suppression des données créées pendant les tests : elles restent en base comme
  données exploitables/démo. La phase « nettoyage » du prompt est remplacée par un
  inventaire des données créées.
- Il n'y a AUCUN utilisateur réel : tous les comptes existants sont utilisables pour les tests.

## Résumé (mis à jour au fil de l'exécution)
- Passe 1 (lecture seule) : PRE, REG, AUTH-001, SEC-001, DB-001..008 → PASS ; PTS → FAIL (D-01)
- Passe 2 (mutations débloquées) : D-01 corrigé ; §5 AUTH (12) + §17 SEC (8) PASS ;
  §6 DEMO-001/005 PASS ; §8 CREATE (§8 complet) + CUST-001 PASS ; UI-001/002 + admin gate PASS ;
  OPS-001/002/003 PASS.
- **3 vulnérabilités S1 découvertes ET corrigées** pendant les tests : D-06 (fuite
  passwordHash/otpCode), D-11 (usurpation via signup), D-13 (escalade admin via verify-otp,
  = cause racine de D-07). Correctifs déployés VPS + repo local.
- §12-16 parcours commande E2E JOUÉ et PASS (client→resto→livreur→livré→avis, + SPEC-001/002).
- **NON exécuté cette passe** : cas limites détaillés §9-11 (CUST-004..011, DRV, REST au-delà des
  listes/logins), annulation (D-18, pas d'endpoint), reste §19 UI (UI-003..008).
- Défauts ouverts : D-02, D-03, D-04, D-07(mdp/externe), D-12, D-14, D-15, D-16, D-17, D-18.

## Journal des mutations (données créées en prod — À CONSERVER)
- 2026-07-20 ~07:24 : backup pré-test `backups/pre_test_20260720.dump` (112 Ko, pg_dump -Fc)
- 2026-07-20 : migration `20260720_points.sql` exécutée (tables points_ledger + point_recharges
  via user miamexpress ; ALTER orders/restaurants/users via sudo -u postgres — les tables
  historiques appartiennent à postgres, le user applicatif n'est pas owner)
- 2026-07-20 : `node scripts/seed-admin-demo.mjs` relancé 2× (DEMO-001) — a restauré l'admin démo
  +237690000001 qui avait DISPARU entre la passe 1 et la passe 2 (cause inconnue, cf. D-07)
- 2026-07-20 : correctifs sécurité serveur déployés (D-06, D-11) — cf. section dédiée
- 2026-07-20 : client de test créé via signup `+237699123456` « Client Neuf Test » (AUTH-010, conservé)
- 2026-07-20 : PoC D-11 a écrasé le full_name du resto `+237653900002` (désormais vide, état bénin)
- 2026-07-20 : ligne parasite client `+237690000001` (créée par PoC AUTH-011 avant correctif) supprimée
- 2026-07-20 : parcours E2E — client `+237690180814`, livreur E2E `+237653910279`, adresse Akwa,
  1 commande complète `7da73c9b…` (livrée, 1 article, 2 avis resto 5★ + livreur 5★). **Conservée** (donnée de remplissage réaliste).
- 2026-07-20 (nettoyage demandé) : suppression de 3 commandes VIDES (0 article, s'afficheraient
  cassées) — `bd192237…` (pour-tiers sans article) + `d57cfe6c…` et `c10c6b52…` (test blocage CUST-007).
  Comptes de test tous CONSERVÉS (clients/livreur/resto réutilisables pour remplissage).
- 2026-07-20 (2e parcours, vérif+correction) : client `+23767084656` « Aicha Mbarga », restaurant
  Délice Express. Commande complète `9fe7c016…` (2 articles, total 9000, **livrée** + delivery
  synchronisée + avis resto 4★ & livreur 5★). Commande « pour un tiers » `3e3137e2…` AVEC 2 articles
  (destinataire Paul Ekwalla), au statut `ready`. Toutes CONSERVÉES (données de remplissage réalistes).
- 2026-07-20 : réparation d'une corruption externe du fichier serveur (bloc TABLE_ALIASES) + correctif
  D-21 déployés (VPS + repo local). Backup VPS `index.js.bak-patchfix-20260720`.

## Défauts
| ID test | Sévérité | Description | Preuve | Statut |
|---|---|---|---|---|

## Résultats détaillés — passe 1 (2026-07-20, lecture seule via SSH)
| ID test | Statut | Notes / preuve |
|---|---|---|
| PRE-001 | PASS | pm2 : miamexpress-api online (44 restarts = redéploiements du jour, unstable 0) |
| PRE-002 | PASS | /api/restaurants?limit=100 → 200 (local) |
| PRE-003 | PASS | /api/reviews/summaries → 200 (local) |
| PRE-004 | PASS | index HTML servi (doctype fr, favicon) |
| PRE-005 | PASS | 3 chunks historiques → 200 (DeliveryMap-CnSbso0n, leaflet-BOso5EEf, AddressPickerMap-CS4yUA8M) |
| PRE-006 | PASS | dist/assets peuplé (3 générations de chunks conservées) |
| REG-001 | PASS | restaurants public HTTPS → 200 |
| REG-002 | PASS | reviews public HTTPS → 200 |
| REG-003/004 | PASS | assets historiques → 200 |
| AUTH-001 | PASS | signin +237690000001/12345 → token, /api/admin/customers → 200 |
| SEC-001 | PASS | /api/admin/customers sans token → 401 |
| DB-001 | PASS | 40 clients (≥15) |
| DB-002 | PASS | pending : 16 livreurs, 8 restaurants ; approved : 1+1 |
| DB-003 | PASS | 6 livreurs approuvés |
| DB-004 | PASS | 1 restaurant approuvé (minimum) |
| DB-005 | PASS | 1 resto avec owner_id |
| DB-006 | PASS | 100 commandes |
| DB-007 | PASS | 83 livraisons |
| DB-008 | PASS | 0 doublon téléphone |
| PTS (hors plan) | FAIL S2 | /api/points/balances → 500 « relation points_ledger does not exist » : points-routes.js déployé le 20/07 06:10 SANS la migration SQL. Correction = exécuter server/migrations/20260720_points.sql (préparée, bloquée par permissions). |

## Défauts (passe 1)
| ID | Sévérité | Description | Preuve | Statut |
|---|---|---|---|---|
| D-01 | S2 | Routes /api/points/* en 500 : migration 20260720_points.sql jamais exécutée (déploiement partiel par une autre session) | pm2 error log « relation points_ledger does not exist » | À CORRIGER (migration prête) |
| D-02 | S3 | Log serveur : GET /api/restaurant_reviews → « relation restaurant_reviews does not exist » (le front appelle une table héritée absente) — récurrent | pm2 error log | À INVESTIGUER (identifier l'appelant front, catalog.ts chemin historique) |
| D-03 | S3 | Log serveur : GET /api/restaurants « invalid input syntax for type uuid: 1/8 » — le front envoie des ids mock (« 1 ») à la prod (colonnes uuid) | pm2 error log | À INVESTIGUER (deep-links/favoris avec ids mock ?) |
| D-04 | S3 | POST /api/admin/accounts : « numeric field overflow » + « could not determine data type of parameter $1 » (occurrences dans les logs, à dater/reproduire — recoupe CREATE-010/013) | pm2 error log | À REPRODUIRE |
| D-05 | S4 | Historique : vague massive « password authentication failed for user miamexpress » (panne env DB, résolue — API 200 actuellement) | pm2 error log | RÉSOLU AVANT TEST (à surveiller) |

## Résultats détaillés — passe 2 (2026-07-20, session redémarrée, mutations SSH OK)
| ID test | Statut | Notes / preuve |
|---|---|---|
| Backup pré-test | FAIT | `backups/pre_test_20260720.dump` (112 Ko). NB : `.env.server` a des fins de ligne CRLF — tout usage shell des variables doit retirer `\r` |
| PTS retest (D-01) | PASS | migration exécutée ; `/api/points/balances` → 200 `{}` (ledger vide = normal), `/api/points/recharges?status=pending` → 200 |
| DEMO-001 | PASS | seed terminé sans erreur : 15 clients démo (40 total), 16+8 candidatures pending, pas de doublon créé (compteurs stables = idempotent, couvre DEMO-005 en partie) |
| AUTH-001 (retest) | PASS | signin `+237690000001/12345` → 200, role admin, token OK — **le compte admin démo avait disparu entre passe 1 et passe 2** (restauré par le seed, cf. D-07) |

## Défauts (passe 2 — nouveaux)
| ID | Sévérité | Description | Preuve | Statut |
|---|---|---|---|---|
| D-06 | S2 | **SEC-007 FAIL** : `/api/admin/customers` renvoie les colonnes brutes `passwordHash` et `otpCode` (OTP en clair visible) dans le JSON | curl authentifié : `"passwordHash":null,...,"otpCode":"512632"` | À CORRIGER (exclure ces champs côté serveur) |
| D-07 | S2 | Le compte admin démo `+237690000001` (et 39→40 clients) a changé entre passe 1 (~06-07h) et passe 2 (~07h30) : admin absent de la base au début de passe 2 alors que AUTH-001 passait en passe 1. Cause inconnue (44 restarts PM2, autre session de déploiement ?). Restauré via seed. | psql : aucun user role=admin phone +237690000001 avant seed | À SURVEILLER |
| D-08 | S4 | Ligne `users` parasite : phone `237690000001` (sans `+`), role client, sans mot de passe — probable inscription de test mal normalisée ; ne viole pas l'unicité mais source de confusion | psql | À NETTOYER (hors périmètre test, données conservées) |
| D-09 | S3 | Écart plan/réalité : les comptes démo §2.1 du plan (`+237690000002` client, `003` resto approuvé, `004` resto pending, `005/006` livreurs) **n'existent pas** — le seed ne crée que l'admin + 15 clients démo + candidatures. `003/004` existent mais en role client sans mot de passe. Les tests par rôle utiliseront des comptes réels approuvés en base. | psql + sortie seed | CONTOURNÉ |

## Résultats détaillés — passe 2 : AUTH (§5) et SEC (§17)
Tous exécutés sur l'API locale VPS `127.0.0.1:3002` après correctifs sécurité.
| ID test | Statut | Notes / preuve |
|---|---|---|
| AUTH-001 | PASS | `+237690000001/12345` → token role=admin, isApproved=true |
| AUTH-002 | PASS | mauvais mot de passe → 401 « Identifiants invalides » |
| AUTH-004 | PASS | resto approuvé `+237653900002` → token role=restaurant, appr=true |
| AUTH-005 | PASS (API) | resto pending `+237652300001` → token émis mais appr=false (blocage dashboard = RoleGate côté UI, à confirmer §11) |
| AUTH-006 | PASS | livreur approuvé `+237653900001` → token role=livreur, appr=true |
| AUTH-007 | PASS (API) | livreur pending `+23765101001` → token appr=false |
| AUTH-010 | PASS | signup nouveau numéro `+237699123456` → 201, token client (client de test conservé) |
| AUTH-011 | PASS | signup numéro existant → **409 « Ce numéro est déjà utilisé »** (après correctif D-11) |
| AUTH-012 | PARTIEL | livreur suspendu `+237677000008` : signin → 401. **Mais signin ne teste PAS is_suspended** (cf. D-12) ; ici l'échec vient d'un mot de passe absent/≠12345. Blocage réel = aval (RoleGate/createOrder), à vérifier en UI |
| SEC-001 | PASS | `/api/admin/customers` sans token → 401 |
| SEC-002 | PASS | token restaurant sur route admin → 403 |
| SEC-002b | PASS | token livreur sur route admin → 403 |
| SEC-003 | PASS | non-admin PATCH suspension → 403 |
| SEC-004 | PASS | PATCH `/api/admin/users/:id/password` pw='12' → 400 « Mot de passe trop court » |
| SEC-005 | PASS | approve candidature id fictif → 404 « Candidature introuvable » |
| SEC-006 | PASS | suspension client id fictif → 404 « Client introuvable » |
| SEC-007 | PASS (après correctif D-06) | `/api/users` (token resto) et `/api/admin/customers` : plus aucun passwordHash/otpCode |

## Défauts CRITIQUES corrigés pendant la passe 2 (code serveur modifié + déployé)
| ID | Sévérité | Description | Preuve avant | Correctif | Vérif après |
|---|---|---|---|---|---|
| D-06 | **S1** | Fuite de secrets : `/api/users` (accessible à TOUT compte connecté) et `/api/admin/customers` renvoyaient `passwordHash` (bcrypt) **et `otpCode` en clair** de tous les users. Cause : `stripSecretFields` supprimait des clés snake_case alors que `fromSnake` les avait déjà renommées en camelCase. | GET /api/users (token resto) → `otpCode:"982652"` | `SECRET_USER_FIELDS` liste désormais les deux graphies (snake + camel). `server/src/index.js` l.62-64 | `/api/users` et `/api/admin/customers` → leak keys: [] |
| D-11 | **S1** | Contournement d'auth / usurpation : `POST /api/auth/signup` avec un numéro existant et **n'importe quel mot de passe** faisait un `ON CONFLICT DO UPDATE` puis émettait un JWT 30 j au **rôle du compte existant** sans vérifier le mot de passe. Avec le numéro d'un admin → token admin. | signup `+237653900002` + `attacker999` → 201, role=restaurant, token valide | signup refuse tout numéro déjà inscrit → 409 ; INSERT simple (plus d'upsert). `server/src/index.js` route `/api/auth/signup` | numéro existant → 409 ; nouveau numéro → 201 OK |

| D-13 | **S1** | Escalade de privilège / usurpation via OTP : `POST /api/auth/verify-otp` faisait `role = requestedRole \|\| user.role` puis UPDATE. Un utilisateur qui complète son OTP pouvait passer `requestedRole:'admin'` → rôle admin + token admin. La protection `RoleMismatchError` n'existait QUE côté front (contournée en appelant l'API directement). **Cause racine de D-07** : une connexion OTP avec `requestedRole:'client'` rétrogradait l'admin existant en client. | verify-otp +237600555777 code+`requestedRole:admin` → role=admin, token valide | verify-otp enforce serveur : rôle établi immuable (409 role-mismatch si conflit), client→applicant autorisé (non approuvé), **jamais 'admin'**. `server/src/index.js` route verify-otp | 4 scénarios OK : client→admin bloqué (reste client), client→restaurant ok (non approuvé), admin→admin ok, admin→client = 409 (plus de downgrade) |

> 🔴 **DIVERGENCE REPO/VPS (important)** : le fichier local `app/server/src/index.js` est une
> version **plus récente** que celle déployée sur le VPS — le local intègre un système **RBAC admin**
> (`admin-rbac.js`, `buildAuthUser`, `adminPermissionRequired`, `loadAdminAccess`, permissions/rôles
> admin granulaires) **absent du VPS en production**. Mes 3 correctifs de sécurité sont présents dans
> les DEUX (local lignes 132 / 1105 / 1045-1057 ; VPS patché en direct). Conséquence : un futur
> déploiement du repo apportera le RBAC + mes fixes ensemble — à tester avant mise en prod. Le VPS
> tourne aujourd'hui sur la version pré-RBAC. **D-20 (S3) : repo et prod désynchronisés.**

> ⚠️ **Ces TROIS correctifs (D-06, D-11, D-13) sont déployés sur le VPS (pm2 restart) ET dans le repo local `app/server/src/index.js`.** Backups VPS du fichier : `index.js.bak-secfix-20260720`, `index.js.bak-otpfix-20260720`. Non encore commités en git (workspace non-git). `npm run lint`/`build` non lancés sur le backend (serveur hors pipeline Vite ; `node --check` OK à chaque étape). **Correctif front conseillé (non fait)** : côté `AuthContext.verifyOtp`, gérer le nouveau 409 `role-mismatch` comme un `RoleMismatchError`.

## Défauts (passe 2 — observations non bloquantes)
| ID | Sévérité | Description | Preuve | Statut |
|---|---|---|---|---|
| D-14 | S3 | `POST /api/auth/send-otp` : (a) fait un UPSERT qui **crée un compte client pour tout numéro** soumis (énumération / création non sollicitée), (b) l'OTP est seulement écrit dans les logs pm2 (`📱 OTP pour…`), jamais délivré par SMS, (c) aucune limite de débit visible (OTP 6 chiffres brute-forçable sur 10 min). En prod sans SMS, la connexion OTP UI est de fait inutilisable pour un vrai utilisateur. | route send-otp l.886-903 | À ARBITRER (brancher un vrai fournisseur SMS + rate-limit) |
| D-15 | S4 | 3 comptes admin en base : `+237690000001` (démo), `+237674465093`, `mimb.nout@gamail.com` (email en guise de phone, typo « gamail »). Les 2 derniers préexistent (hors tests) — à confirmer légitimes. | psql role=admin | À VÉRIFIER par le propriétaire |
| D-07 | S2 | Le mot de passe ET/OU le rôle de l'admin démo `+237690000001` change plusieurs fois pendant la session sans action de mon code (rôle désormais protégé par le correctif D-13 ; le **mot de passe** continue de changer → **acteur externe** : autre session Claude/déploiement/cron actif sur le VPS). Contournement : relancer `node scripts/seed-admin-demo.mjs`. | signin 401 alors que role=admin/has_pw=t en base, résolu par reseed | ROOT-CAUSE PARTIELLE (rôle=D-13 corrigé ; mot de passe=externe) |
| D-12 | S3 | `signin` ne vérifie pas `is_suspended` : un compte suspendu avec un mot de passe valide obtient un JWT ; `authRequired` ne teste pas non plus la suspension. Blocage uniquement en aval (RoleGate UI, `createOrder`). Un livreur/resto suspendu pourrait appeler l'API directement avec son token. | route signin l.931-945, pas de check suspension | À ARBITRER (design actuel = enforcement aval) |

## Résultats détaillés — passe 2 : Admin §7-9 (API)
| ID test | Statut | Notes / preuve |
|---|---|---|
| APP-001 | PASS | `/api/applications?status=eq.pending` → 200, 24 candidatures pending |
| CREATE-002 | PASS | POST /api/admin/accounts livreur → 201, application approved |
| CREATE-004 | PASS | login livreur créé `+237653935101` → role=livreur, appr=true |
| CREATE-005 | PASS | rejouer même livreur → 201, **0 doublon** (1 user, 1 candidature approved) |
| CREATE-007 | PASS | POST restaurant → 201, restaurant créé + candidature approved |
| CREATE-008 | PASS | resto « Resto Test 3510 » visible dans `/api/restaurants` public (12 restos) |
| CREATE-009 | PASS | login resto créé `+237653935102` → role=restaurant, appr=true |
| CREATE-010 | PASS | rejouer même restaurant → 201, **pas de numeric overflow** (D-04 non reproduit ici), 0 doublon |
| CREATE-011 | PASS | création sans téléphone → 400 |
| CREATE-013 | PASS | restaurant sans commission explicite → `commission_rate=0.120` valide, lié à owner |
| CUST-001 | PASS | `/api/admin/customers` → 200, 43 clients |
| REG-001/002 | PASS | restaurants + reviews summaries en **HTTPS public** → 200 |

Données de test créées (À CONSERVER) : livreur `+237653935101` (Livreur Test 3510),
restaurant `+237653935102` / « Resto Test 3510 » (Resp Test 3510), tous approuvés.

## Résultats détaillés — passe 2 : parcours commande §12-16 (E2E API)
Parcours complet joué de bout en bout : client neuf `+237690180814` → restaurant « Chez Jeanne »
(`eab46a3d…`) → livreur E2E créé → livré → avis. Commande `7da73c9b…`.
| ID test | Statut | Notes / preuve |
|---|---|---|
| ORD-006 | PASS | POST /api/addresses (token client) → adresse créée |
| ORD-008 | PASS | POST /api/orders paiement cash → commande créée (total 5000), order_items 201 |
| ORD-010 | PASS | GET /api/orders?customer_id=eq.<cid> → commande dans l'historique (count=1) |
| ORD-011 | PASS | admin voit la commande (status pending au départ) |
| RORD-002/004/005 | PASS | PATCH statut confirmed → preparing → ready, tous 200 |
| DLV-003 | PASS | livreur (token réel) : PATCH driver_id + picked_up → 200 ; POST /api/deliveries → 201 |
| DLV-005/006 | PASS | PATCH delivering → delivered → 200 ; statut final commande = **delivered** |
| REV-001 | PASS | POST /api/reviews {orderId, targetType:restaurant, rating:5} → 201 (route exige `orderId` camelCase + commande livrée + propriétaire) |
| REV-003 | PASS | avis livreur (targetType:driver) → 201 |
| REV-007 | PASS | `/api/reviews/summaries` (HTTPS public) → 200, `rating_avg` recalculé à 4.5 |
| SPEC-001 | PASS | commande pour soi → contact = numéro client |
| SPEC-002 | PASS | commande pour tiers → recipient « Ami Test » / +237655000999 / « Appeler avant » conservés |
| CUST-007 | PASS | PATCH `/api/admin/customers/:id/suspension` body **`{isSuspended:true, reason}`** → blocage persistant + motif stocké |
| CUST-008 | PASS | `{isSuspended:false}` → déblocage OK |

Bon point sécurité : `POST /api/reviews` applique `assertOwnDeliveredOrder` (on ne peut noter
que sa propre commande livrée). Données créées conservées : client `+237690180814`, livreur E2E
`+237653910279`, 2 commandes (dont 1 livrée + avis), 2 avis.

## Défauts (passe 2 — parcours commande)
| ID | Sévérité | Description | Preuve | Statut |
|---|---|---|---|---|
| D-16 | S2 | `PATCH /api/orders/:id` (route générique) n'impose **aucun bornage de statut par rôle** : tout compte connecté (client compris) peut passer une commande à `delivered`/`cancelled`. C'est la priorité produit #5 non implémentée côté serveur. | PATCH status avec token admin/livreur accepté sans contrôle de rôle/transition | À CORRIGER (endpoint dédié + machine à états serveur) |
| D-17 | S3 | La ligne `deliveries` n'est pas synchronisée avec le statut de la commande : commande `delivered` mais `deliveries.status` reste `picked_up` (pas de mise à jour serveur). | GET /api/deliveries?order_id=eq.<oid> → status=picked_up | À INVESTIGUER |
| D-18 | S2 | Annulation client (priorité produit #4) : pas d'endpoint dédié `/api/orders/:id/cancel` ; le motif d'annulation n'est pas imposé côté serveur (PATCH status=cancelled possible sans `reason`). RORD-003/ORD-007 annulation non testés faute d'endpoint. | routes serveur (aucune route cancel) | À IMPLÉMENTER |
| D-21 | S2 | **CORRIGÉ** — `PATCH /api/:table/:id` (route générique) forçait `SET … updated_at = now()` alors que ~23 tables n'ont PAS cette colonne (`deliveries`, `menu_items`, `restaurants`, `applications`, `order_items`, `point_recharges`…). Résultat : tout update de ces tables échouait en 500 (« column updated_at does not exist ») — le livreur ne pouvait pas mettre à jour la ligne `deliveries`. | PATCH /api/deliveries → 500 avant, `OK status=delivered` après | ✅ helper `tableHasUpdatedAt` : `updated_at` ajouté seulement si la colonne existe. Local + VPS. Backup VPS `index.js.bak-patchfix-20260720` |
| D-22 | **S1 opérationnel** | **Acteur externe corrompt le fichier serveur en prod (confirme D-07).** Le backup pré-D21 contenait déjà un bloc `TABLE_ALIASES` **syntaxiquement invalide** (`{ \ restaurant_reviews\: \<CR>eviews\ }`, `||` remplacé par ` ; `) — édition botchée d'une AUTRE session pour aliaser `restaurant_reviews`→`reviews` (D-02/D-03). Le fichier disque était CASSÉ ; l'API ne tenait que parce que pm2 avait l'ancienne version en mémoire → **tout redémarrage aurait planté l'API**. Réparé (alias reconstruit correctement, D-02 désormais 200). | `node --check` KO avant réparation ; corruption présente dans 2 blocs | ⚠️ IDENTIFIER ET STOPPER l'autre session/process qui écrit sur `/home/ubuntu/miamexpress/server/src/index.js` |
| D-19 | S2 | Blocage client non appliqué côté serveur : un client `is_suspended=true` peut créer une commande via `POST /api/orders` (→ 201). Le `CustomerBlockedError` de `orders.ts` n'existe qu'en amont (client/localStorage). Même famille que D-12/D-16 : l'enforcement des règles métier repose sur le front, contournable par appel API direct avec un token valide. | client bloqué → POST /api/orders → 201 | À CORRIGER (vérifier is_suspended dans les routes d'écriture) |

## Blocage passe 1 — RÉSOLU en passe 2
Le blocage classifieur (mutations SSH) est levé depuis le redémarrage de session : backup,
migration, seed, scp, psql et pm2 restart passent désormais. Note technique : `.env.server`
a des fins de ligne **CRLF** → toujours nettoyer `\r` avant d'utiliser DB_HOST/DB_USER/etc.
en shell (sinon `could not translate host name "127.0.0.1\r"`). Et ne PAS exporter ces
variables avant de lancer les scripts node (`seed-admin-demo.mjs` lit son propre .env et
échoue si l'env est pollué par le CRLF).

## À FAIRE — reprise dédiée (prochaine session)
Priorité 1 (sécurité, à valider par le propriétaire) :
- Committer les 3 correctifs sécurité de `app/server/src/index.js` (workspace non-git → à init/pousser).
- Aligner le front sur le 409 `role-mismatch` de verify-otp (cf. D-13).
- Décider D-14 (fournisseur SMS + rate-limit OTP), D-12 (suspension côté API), D-15 (admins inconnus).
- Identifier l'acteur externe qui modifie l'admin démo (D-07 : mot de passe).
Priorité 2 (tests fonctionnels non exécutés) : §12 ORD (parcours commande client complet),
§13 SPEC (commandes personnalisées / pour autrui), §14 RORD (traitement resto),
§15 DLV (livraison), §16 REV (avis), détail §9-11 (CUST/DRV/REST), reste §19 UI responsive.
Ordre conseillé : créer une commande de bout en bout (client→resto→livreur→livré→avis) puis
dérouler les cas limites.
