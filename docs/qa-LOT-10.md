# QA — LOT-10 (Navigation restaurant unifiée + statut 1-clic + livreurs préférés utilisables)

> **Date** : 16/07/2026 · QA sur CONF-13 (sidebar unique, route livreurs, toggle header, fin du reload) + CONF-27 (livreurs récents au lieu de la saisie d'ID).
> **Méthode** : revue du diff (`App.tsx`, `BackOfficeLayout.tsx`, `RestaurantDashboard.tsx`) + parcours restaurateur réel complet, avec vérification croisée côté client.

## 1. Scénarios validés en exécution réelle

| Scénario | Résultat |
|---|---|
| Sidebar restaurant = **5 entrées** : Commandes · Menu · **Livreurs** · Finances · Profil (ordre du plan §D.3) | ✔ |
| **Barre d'onglets interne supprimée** (elle dupliquait la sidebar ; « Livreurs » n'avait pas d'URL) | ✔ 0 onglet interne détecté |
| URL directe `/partenaires/dashboard/livreurs` → onglet rendu, stable au refresh | ✔ |
| **Toggle Ouvert/Fermé dans le header** (Switch), visible sur tous les onglets | ✔ |
| Fermeture → **dialog de confirmation** (« ne recevra plus de nouvelles commandes ») → « Fermé » + toast, **sans reload** | ✔ |
| Persistance : `yamo_restaurant_overrides['1'].isOpen=false` → côté **client**, badge « Fermé actuellement » + 20 boutons d'ajout désactivés (chaîne LOT-02 intacte) | ✔ vérifié en croisé |
| Réouverture directe (pas de dialog) | ✔ |
| ProfileTab : bloc « Mode Rush » **déplacé** (indication vers le toggle header), sauvegarde **sans `window.location.reload()`** (flag `window` intact) + toast | ✔ |
| Livreurs préférés : **plus de champ « ID du livreur »** ; liste des livreurs des dernières commandes livrées, téléphone masqué (`+237 ••• ••• 05`), nb livraisons + note | ✔ |
| Ajout **en 1 clic** → persisté (`yamo_preferred_drivers`), retrait OK | ✔ |
| Cas admin : sidebar contextuelle inchangée (roleSidebars par route) | ✔ par code (mécanisme non touché) |
| `tsc` / `build` / lint | ✔ 0 erreur / 56,9 s / 9 signalements = baselines exactes |
| Données de test | ✔ commande livrée test + préféré + overrides nettoyés |

## 2. Anomalies

### QA-32 — PageHeader : bouton « Actualiser » et son dupliquent partiellement le header
- **Gravité : Mineure** — le header contient toggle statut (nouveau) + son + actualiser ; densité acceptable mais à surveiller sur 360 px (vérifié sans débordement). Aucune action.

### QA-33 — Le compteur de commandes n'est plus visible dans la navigation
- **Gravité : Mineure** — l'ancienne barre d'onglets affichait « Commandes (N) » ; la sidebar partagée n'affiche pas de compteurs. La stat-card « En attente » du dashboard couvre le besoin sur l'onglet principal. Un badge sidebar « commandes en attente » (comme celui des litiges admin) est possible en amélioration ultérieure.

### QA-34 — `deliveryMode` (chantier externe) non intégré au toggle
- **Gravité : Info** — le chantier externe introduit des « livreurs internes » (`deliveryMode`). Le lot n'y touche pas ; à réconcilier avec « livreurs préférés » côté produit.

## 3. Verdict
**LOT-10 : conforme.** Une seule navigation (sidebar avec URLs), statut pilotable en 1 clic avec confirmation et effet immédiat vérifié jusqu'au client, plus aucun rechargement de page, livreurs préférés enfin utilisables. 3 mineures/infos documentées.
