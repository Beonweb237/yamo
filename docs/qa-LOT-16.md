# QA — LOT-16 : Page Clients admin (audit/complément d'AdminCustomers)

> Date : 16/07/2026 · Périmètre : CONF-21.
> Contexte : la page `src/pages/admin/AdminCustomers.tsx`, sa route `/admin/customers`
> et l'entrée sidebar existaient déjà (créées par le chantier externe « sync VPS »).
> Le lot devient donc : **audit contre les CA du plan + compléments**.

## 1. Audit de l'existant (chantier externe)

| Critère CONF-21 | État trouvé | Verdict |
|---|---|---|
| Liste : téléphone, nb commandes, total dépensé, dernière commande, annulations | Présents + stats globales, agrégats sur `yamo_local_orders` (match téléphone **et** customerId) | ✅ conservé |
| Recherche par téléphone | Présente (nom/téléphone/ville) | ✅ conservé |
| Détail → historique | Sheet latéral avec historique, motifs d'annulation (LOT-04) et flag « livrée sans code » (LOT-07) réutilisés | ✅ conservé |
| Bloquer/Débloquer (pattern `isSuspended`) | AlertDialog + écriture `isSuspended` dans `yamo_local_users` (clés normalisées vérifiées vs AuthContext) | ✅ conservé |
| **Blocage → le client ne peut plus commander** | **ABSENT** : aucun contrôle `isSuspended` au checkout ni dans `createOrder` — le « blocage » était purement cosmétique | ❌ complété |
| Polling raisonné (LOT-11) | `setInterval` 30 s brut, sans pause onglet masqué | ⚠ aligné |

**Anomalie majeure supplémentaire (QA-41)** : dans `AuthContext.verifyOtp` (mock),
`getLocalSuspensionInfo` (map de suspension des **livreurs**) écrasait `isSuspended`
à chaque connexion — un client bloqué était **automatiquement débloqué en se
reconnectant**.

## 2. Compléments livrés

1. **`src/lib/orders.ts`** : `CustomerBlockedError` + contrôle `isCustomerBlocked`
   dans `createOrder` (point de passage unique de toutes les commandes). Contrat
   VPS documenté en commentaire : `POST /api/orders` → 403 si bloqué.
2. **`src/pages/Checkout.tsx`** : interception de `CustomerBlockedError` → message
   explicite (« Votre compte a été bloqué… Contactez le support via la page
   Contact »), panier conservé.
3. **`src/contexts/AuthContext.tsx`** (fix QA-41) : la synchronisation de
   suspension depuis drivers.ts ne s'applique plus qu'au rôle `livreur` ; pour les
   autres rôles, le blocage posé dans le registre survit à la reconnexion.
4. **`AdminCustomers.tsx`** : `setInterval` remplacé par `usePolling(load, 30000)`
   (pause onglet masqué, tick au retour — pattern LOT-11) ; import `useEffect`
   devenu inutile retiré.

## 3. Vérifications exécutées (navigateur réel, mode mock)

| # | Contrôle | Résultat |
|---|---|---|
| 1 | `/admin/customers` (admin) : liste rendue, client +237690000002 visible, stats | ✅ |
| 2 | Bloquer → AlertDialog → confirmation : `isSuspended=true` + motif dans le registre, badge « Bloqué » | ✅ |
| 3 | **Client bloqué → checkout complet (panier 7 000 FCFA, adresse remplie) → commande refusée** : message explicite affiché, 0 commande créée, panier conservé | ✅ CA |
| 4 | **Reconnexion réelle du client bloqué** (`/connexion` → téléphone → OTP) : `isSuspended` toujours `true` en registre ET en session (fix QA-41 prouvé) | ✅ |
| 5 | Débloquer via l'UI admin → même panier → commande créée (`pending`) + écran de confirmation (pas de faux positif) | ✅ |
| 6 | Mobile 360×640 : liste et sheet détail sans débordement horizontal ; desktop 1280 OK | ✅ |
| 7 | Console : 0 erreur · `tsc -b` : 0 erreur · build : ✅ · lint : 0 nouvelle erreur dans les 4 fichiers touchés (8 pré-existantes) | ✅ |

Données de test nettoyées (commande de test supprimée, panier vidé, sessions déconnectées, client débloqué).

## 4. Écarts restants (documentés)

1. **Périmètre mock = navigateur courant** (assumé par le plan) : la liste ne
   montre que les clients du registre localStorage local. L'empty state de la page
   l'explique déjà (« Les clients apparaîtront ici après leur première commande ou
   inscription »). Cible VPS : endpoint `GET /api/admin/customers` (+ `PATCH
   /api/admin/customers/:id/block`) à implémenter côté serveur.
2. Le blocage n'expulse pas une session client **déjà ouverte** ailleurs : il
   s'applique au moment de la commande (contrôle live du registre) — suffisant
   pour le CA ; côté VPS ce sera le serveur qui refuse.
3. Motif de blocage fixe (« Bloqué par admin ») — un champ motif libre à la
   AdminDrivers serait un plus, non exigé par le CA.
4. Couleurs codées en dur héritées du chantier externe (`bg-red-50`, `text-red-600`…)
   — conservées pour ne pas réécrire du code externe fonctionnel (interdiction
   CLAUDE.md des refontes non demandées).

## 5. Verdict
CA CONF-21 atteints : recherche ✅, historique ✅, **blocage réellement effectif à la
commande** ✅ (2 trous majeurs comblés : contrôle inexistant, déblocage silencieux à
la reconnexion). Aucune régression détectée sur connexion, checkout et admin.
