# Plan — Tableau de bord « Centre Opérations » (série OPS)

Spec figée (LOT-0). Source de vérité du chantier. Le code doit s'y conformer ; la
maquette de référence (présentée en fin de LOT-0) est le juge « au pixel près ».

## 0. Objet

Une tour de contrôle admin/dispatcher qui liste **en temps quasi réel** les commandes en
état anormal (dépassements de délai / SLA), triées par gravité, avec des **actions réelles**
pour intervenir : appeler le restaurant, appeler le livreur, rassurer le client, réassigner,
et tracer « pris en charge ». Page `/admin/operations`, visible du rôle Dispatcher/Superviseur.

## 1. Réalité du schéma (audit LOT-0, ne pas re-supposer)

- `orders` : `status, created_at, updated_at, confirmed_at, preparation_eta_minutes,
  estimated_ready_at, ready_at, driver_id, guarantee_status, guarantee_declared_at,
  guarantee_confirmed_at, customer_id, restaurant_id, contact_phone, recipient_phone`.
- `deliveries` : `order_id, driver_id, status, assigned_at, picked_up_at, delivered_at, lat, lng`.
- `driver_positions` : `order_id (PK), lat, lng, updated_at` (série TRK, déjà en prod).
- `users` : téléphones/noms resto, livreur, client (jointures pour les boutons d'appel).
- **Pas de table `incidents`** (le report livreur est en localStorage `yamo_incidents`) → à créer
  en LOT-2 (table `incidents` + le driver poste en base en mode VPS).
- **Pas de strikes client en base** (localStorage `abusiveRejections`) → scénario 13 = **phase 2**.

## 2. Les scénarios d'alerte (défauts — tous dans `app_settings.operations_thresholds`)

Statuts : `pending → confirmed → preparing → ready → picked_up → delivering → delivered / cancelled`.

### Restaurant
| Code | Alerte | Condition | Seuil défaut | Gravité |
|---|---|---|---|---|
| `PENDING_UNCONFIRMED` | Non confirmée | `pending`, `now - created_at` | > 5 min | 🔴 critical |
| `CONFIRMED_NOT_PREPARING` | Confirmée, prépa non lancée | `confirmed`, `now - confirmed_at` | > 6 min | 🟠 warning |
| `PREP_OVERDUE` | Préparation en retard | `preparing`, `now - estimated_ready_at` | > +5 min | 🔴 critical |
| `READY_NO_DRIVER` | Prête sans livreur | `ready` ET aucune `deliveries` avec `driver_id`, `now - ready_at` | > 8 min | 🔴 critical |
| `GUARANTEE_UNCONFIRMED` | Garantie déclarée non validée | `guarantee_status='declared'`, `now - guarantee_declared_at` | > 8 min | 🟠 warning |

### Livreur
| Code | Alerte | Condition | Seuil défaut | Gravité |
|---|---|---|---|---|
| `ASSIGNED_NO_PICKUP` | Assigné, pas récupéré | delivery `assigned_at` non null, `picked_up_at` null, statut `ready/picked_up`, `now - assigned_at` | > 10 min | 🟠 warning |
| `PICKED_NOT_MOVING` | Récupérée, immobile | `status='picked_up'`, `now - picked_up_at` | > 5 min | 🟠 warning |
| `DELIVERING_OVERDUE` | Livraison en retard | `status IN (picked_up, delivering)`, `now - picked_up_at` (seuil fixe, pas de vrai routage) | > 40 min | 🔴 critical |
| `GPS_SILENT` | GPS silencieux | commande active ET (pas de `driver_positions` OU `now - driver_positions.updated_at`) | > 6 min | 🟠 warning |
| `INCIDENT` | Incident signalé | ligne `incidents` non résolue (table créée en LOT-2) | immédiat | 🔴 critical |

### Client / litige / catch-all
| Code | Alerte | Condition | Seuil défaut | Gravité |
|---|---|---|---|---|
| `CANCELLED_AFTER_PREP` | Annulée après préparation | `status='cancelled'` alors que passée par `preparing/ready` (déduit via `ready_at`/`confirmed_at`) — fenêtre 60 min | récent | 🟠 warning |
| `GUARANTEE_DISPUTE` | Litige garantie | `guarantee_status='forfeited'` non tranché OU dispute ouverte | immédiat | 🔴 critical |
| `STUCK` | Commande figée | statut non terminal, `now - updated_at` | > 30 min | 🔴 critical |
| *(phase 2)* `CUSTOMER_RISK` | Client à strikes | strikes en base | — | 🟠 |

Note : une commande peut cumuler plusieurs alertes ; `topSeverity` = la plus grave.
Les commandes `delivered`/`cancelled` (hors fenêtre récente) sont exclues.

## 3. Contrat API (LOT-2)

`GET /api/admin/operations` — auth admin (ou permission dispatcher). Réponse :
```jsonc
{
  "generatedAt": "ISO",
  "counts": { "critical": 3, "warning": 7, "handled": 2 },
  "thresholds": { "PENDING_UNCONFIRMED": 5, "...": 0 },   // pour info UI
  "alerts": [
    {
      "orderId": "uuid", "ref": "Y-AB12", "status": "preparing",
      "restaurantId": "uuid", "restaurantName": "Chez Jeanne", "restaurantPhone": "6...",
      "customerName": "Marie N.", "customerPhone": "6...", "neighborhood": "Bonapriso", "city": "Douala",
      "driverId": "uuid|null", "driverName": "Boris K.", "driverPhone": "6...",
      "total": 8000,
      "waitingMinutes": 12,                      // temps dans l'état courant
      "hasLiveGps": true,
      "codes": [ { "code": "PREP_OVERDUE", "label": "Préparation +12 min", "severity": "critical", "minutes": 12 } ],
      "topSeverity": "critical",
      "handledBy": null, "handledAt": null        // « pris en charge »
    }
  ]
}
```
Tri : `critical` d'abord, puis `waitingMinutes` décroissant. Les alertes `handled` restent
visibles (grisées) jusqu'à résolution de l'anomalie.

Endpoints associés :
- `POST /api/admin/operations/:orderId/handle` `{ note? }` → trace `handled_by/handled_at`
  (table `operations_handled`).
- `PATCH /api/settings/operations_thresholds` (admin) → ajuste les seuils.
- `POST /api/incidents` (livreur/admin) + lecture par l'endpoint operations (LOT-2).

## 4. Tableau de bord (UX — LOT-4/5/6)

- **Bandeau compteurs** : `🔴 N critiques · 🟠 N à surveiller · ✅ N pris en charge`.
- **Liste triée par gravité puis ancienneté**. Chaque carte :
  - Réf · Restaurant · Client · Quartier/Ville · badge statut.
  - **Badges d'alerte** (rouge/ambre) avec le chrono (« Prépa +12 min »).
  - **Actions rapides** : 📞 Resto · 📞 Livreur · 💬 Client (wa.me/tel:) · 🗺️ Suivi ·
    🔁 Réassigner · ✅ « Pris en charge » (tracé qui/quand).
- **Filtres** : type d'alerte, ville, restaurant. **Rafraîchissement** 30 s. **Son** optionnel
  sur nouvelle alerte critique (même mécanique que resto/livreur).
- **5 états** : chargement (skeleton) · vide (« Tout va bien, aucune anomalie » illustré) ·
  erreur (message + réessayer) · données · pris-en-charge (carte grisée + nom du dispatcher).
- Design system strict : tokens `green-primary`/`gold-accent`/`error`, cartes blanches,
  `BackOfficeLayout`, `shadcn/ui`. Mobile 360 px sans débordement. Accessible clavier.

## 5. Accès / RBAC (LOT-6)

Permission `operations.view` (rôle Dispatcher/Superviseur + super-admin). Entrée sidebar admin
« Centre opérations » visible selon la permission. `MobileBottomNav` masquée (route `/admin`).

## 6. Matrice de traçabilité

| Lot | Livrable | Statut |
|---|---|---|
| LOT-0 | Spec + maquette de référence | ✅ validé |
| LOT-1 | Seuils `operations_thresholds` (app_settings) + lib | ✅ `launchConfig.OPS_THRESHOLDS` + `lib/operations.ts` |
| LOT-2 | Endpoint `/api/admin/operations` + table `incidents` + `operations_handled` [JALON A] | ✅ `server/src/operations-routes.js` déployé |
| LOT-3 | Lib client + hook `useOperations` | ✅ `lib/operations.ts` + `hooks/useOperations.ts` + incident réel VPS |
| LOT-4 | Page `AdminOperations.tsx` + 5 états + responsive | ✅ + route `/admin/operations` |
| LOT-5 | Actions réelles + « pris en charge » [JALON B] | ✅ tel:/wa.me/suivi/réassign/handle |
| LOT-6 | Sidebar + RBAC + bandeau + son | ✅ perm `operations.view/handle`, badge critiques, `useOpsSound` |
| LOT-7 | i18n FR/EN + garde-fous + build | ✅ 43 clés EN, i18n 100%, hooks 0, build exit 0 |
| LOT-8 | Déploiement + recette E2E 14 scénarios [JALON C] | ✅ déployé, recette API 14/14 |

**Livré le 21/07/2026.** Recette E2E API : 14/14 (incident→handle→unhandle→resolve→override seuil→nettoyage).
Vérification visuelle connectée : à faire par l'admin (login mot de passe non réalisé par l'agent).

## 7. Adaptations actées en LOT-0 (à valider)

1. **Scénario 8 (livraison en retard)** : seuil FIXE depuis `picked_up_at` (défaut 40 min), pas de
   vrai routage — plus simple et robuste ; affinable plus tard avec la distance réelle.
2. **Scénario 10 (incident)** : création d'une table `incidents` en LOT-2 ; le `reportIncident`
   du livreur postera en base en mode VPS (aujourd'hui localStorage).
3. **Scénario 13 (strikes client)** : reporté **phase 2** (strikes en localStorage, pas en base).
