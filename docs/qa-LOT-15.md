# QA — LOT-15 (Variantes & suppléments créables par le restaurateur)

> **Date** : 16/07/2026 · QA sur CONF-14 — le client pouvait commander des options que le restaurateur ne pouvait pas créer.
> **Méthode** : revue du diff (`catalog.ts` : `MenuItemInput` + persistance mock ; `RestaurantDashboard.tsx` : section « Options du plat ») + **boucle réelle resto → client**.

## 1. Scénarios validés en exécution réelle

| Scénario | Résultat |
|---|---|
| Formulaire menu : section **« Options du plat » repliée par défaut** (formulaire dense préservé), compteur « N variantes · M suppléments » sur l'en-tête | ✔ |
| Ajout dynamique de lignes variante (nom + surcoût, aide « 0 = inclus ») et supplément (nom + prix), suppression par ligne, `aria-label` sur chaque champ/bouton | ✔ |
| Création du plat → persistance mock (`yamo_menu_added`) avec `variants: [{Portion familiale, 1000}]` + `supplements: [{Sauce pimentée, 300}]` | ✔ vérifié en storage |
| **Côté client** : le plat créé ouvre le dialog de personnalisation avec les deux options affichées (« +1 000 FCFA », « +300 FCFA ») | ✔ |
| Total calculé : 2 000 + 1 000 + 300 = **« Ajouter — 3 300 FCFA »** → ligne panier composite (`::v0::s0`, `baseItemId` correct — chaîne LOT-01 intacte) | ✔ |
| Édition d'un plat existant : options rechargées dans le formulaire, section auto-dépliée si options présentes | ✔ par code (`handleEdit`) |
| Lignes vides ignorées, prix invalide → 0, prix négatif → 0 (`cleanOptionRows`) | ✔ par code |
| Suppression de toutes les options à l'édition → options effacées (`variants: undefined` écrase l'overlay) | ✔ par code |
| `tsc` / `build` / lint | ✔ 0 erreur / 36,7 s / 10 signalements = baselines exactes (RestaurantDashboard 8 + catalog 2) |
| Données de test | ✔ plat test + panier supprimés |

## 2. Anomalies

### QA-35 — [Artefact de test, pas un bug] Restaurant resté « fermé » entre deux lots
- Le premier essai client a échoué car l'override `isOpen:false` du test LOT-10 n'avait pas été correctement restauré — **le blocage d'ajout sur resto fermé (LOT-02) a fonctionné exactement comme prévu**. Corrigé dans les données de test ; à noter : mes nettoyages doivent restaurer l'état d'ouverture explicitement.

### QA-36 — Pas de limite au nombre d'options
- **Gravité : Mineure** — un resto peut saisir un nombre illimité de variantes/suppléments. Sans enjeu en mock ; une limite raisonnable (ex. 10) pourra être appliquée par le backend VPS.

### QA-37 — Options non éditables sur les plats du catalogue seed via overlay partiel
- **Gravité : Info** — l'édition d'un plat seed écrit l'overlay complet (comportement vérifié sain) ; aucun problème constaté, simple note d'architecture.

## 3. Verdict
**LOT-15 : conforme.** Le trou fonctionnel majeur (options commandables mais non créables) est fermé : boucle resto → client → panier vérifiée en réel avec calcul exact. 1 artefact de test documenté, 1 mineure backend, 1 info.
