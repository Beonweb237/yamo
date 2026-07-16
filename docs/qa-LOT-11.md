# QA — LOT-11 (Polling raisonné)

> **Date** : 16/07/2026 · QA sur CONF-24 — remplacement des 8 `setInterval` 5 s par `usePolling` (≥ 15 s imposé, pause onglet masqué, tick au retour) + fix N+1 des avis.
> **Méthode** : revue du diff (`usePolling.ts` créé, 8 pages migrées) + **preuve comportementale en exécution réelle** (simulation `document.hidden` + injection de commandes).

## 1. Changements et vérifications

| Élément | Résultat |
|---|---|
| Nouveau hook `src/hooks/usePolling.ts` : plancher **15 s imposé** (`Math.max(15000, …)`), pause sur `visibilitychange`, tick immédiat au retour, tick initial | ✔ 0 signalement lint sur le hook |
| Migrations : `Orders` (client) 5s→**15s**, `RestaurantDashboard` 5s→**15s**, `DriverDashboard` 5s→**15s**, `AdminApplications/Dashboard/Disputes/Drivers/Orders` 5s→**30s** | ✔ `grep setInterval` : plus aucun < 15 s dans src (restants : BackOfficeLayout 30s, AdminCustomers 30s et useActiveOperations 20s — externes/conformes ; useRealtime inerte) |
| Fix N+1 avis (`Orders.tsx`) : la boucle `hasRestaurantReview` ne tourne plus à chaque tick, uniquement quand la liste des commandes livrées change (`checkedDeliveredKeyRef`) | ✔ |
| **Preuve pause** : onglet simulé masqué (`document.hidden=true` + dispatch), commande injectée → **non affichée après 17 s** (> 1 intervalle) | ✔ |
| **Preuve reprise** : visibilité rétablie → **tick immédiat, commande affichée** | ✔ |
| Réactivité conservée : commande visible au chargement (tick initial) ; nouvelle commande resto détectée ≤ 15 s (bip/toast inchangés — même `loadOrders`) | ✔ |
| `tsc` / `build` | ✔ 0 erreur / 39,6 s |
| Lint | ✔ **le lot supprime ~7 erreurs pré-existantes** (les effets `load()+setInterval` flaggés `set-state-in-effect` ont disparu) ; total projet 83 (plage de fluctuation connue 81-86, cf. rapports précédents) |
| Données de test | ✔ commandes injectées supprimées |

## 2. Anomalies

### QA-38 — [Corrigée en cours de QA] Mon premier discriminant de test était invalide
- Le premier test de pause comparait `includes('qa-lot11-poll-2')` alors que l'UI tronque les ids à 8 caractères → faux négatif de MON test (pas du code). Re-testé avec un nom d'article unique : comportement conforme. Documenté pour l'honnêteté du protocole.

### QA-39 — Réactivité resto 5s → 15s : compromis assumé
- **Gravité : Info (décision du plan)** — l'alerte nouvelle commande resto passe de ≤5 s à ≤15 s, conformément à CLAUDE.md (interdit < 15 s) et au KPI « confirmation < 3 min ». Le vrai temps réel viendra du WebSocket VPS (cible documentée dans le hook).

### QA-40 — `watchPosition` livreur non pausé sur onglet masqué
- **Gravité : Mineure (reportée du QA-25)** — hors périmètre strict du hook de polling ; amélioration possible en réutilisant le même pattern visibilitychange.

## 3. Verdict
**LOT-11 : conforme.** Plus aucun polling < 15 s dans l'application, pause/reprise sur visibilité prouvée en exécution réelle, N+1 des avis corrigé, et le lot **réduit** la dette lint au lieu de l'augmenter.
