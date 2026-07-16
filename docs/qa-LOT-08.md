# QA — LOT-08 (Admin opérationnel : fiche commande, litiges actionnables, supervision honnête)

> **Date** : 16/07/2026 · QA sur CONF-19 (fiche commande + actions), CONF-20 (litiges avec statut/note + badge sidebar), CONF-35 (carte factice retirée).
> **Méthode** : revue du diff (`AdminOrders.tsx` réécrit, `AdminDisputes.tsx` réécrit, `AdminDashboard.tsx`, `BackOfficeLayout.tsx`, `orders.ts`) + parcours admin réel avec données de test injectées/nettoyées.

## 1. Scénarios validés en exécution réelle

| Scénario | Résultat |
|---|---|
| Dashboard : carte de supervision aux positions inventées **supprimée** (commentaire de réintroduction conditionnée aux vraies positions) | ✔ plus de `.leaflet-container` sur /admin/dashboard |
| Statuts par commande → **liens** `/admin/orders?status=X` ; filtre prérempli à l'arrivée (`pending` vérifié) | ✔ |
| Ligne du tableau cliquable (`tabIndex` + Enter) → **Sheet fiche commande** : articles + montants détaillés, adresse, badges (statut/sans-code/paiement), motif d'annulation | ✔ |
| Contacts réels : `tel:` client + livreur (résolu via registre), WhatsApp client prérempli | ✔ |
| Annuler (statuts actifs uniquement) → dialog **motif obligatoire** (CTA désactivé sinon) → `cancelledBy: 'admin'` + motif visible partout | ✔ exercé en réel |
| Litiges : compteur « N ouverts » dans le titre, toggle « Afficher les traités » | ✔ (2 ouverts → 0) |
| Incident → « Traiter » → dialog note → `resolved` + note affichée | ✔ (« Client rappelé, livraison reprogrammée ») |
| Annulation → « Traiter » → `disputeResolved: true` (+ note optionnelle) | ✔ |
| **Badge rouge « Litiges »** dans la sidebar admin (incidents ouverts + annulations non traitées, poll 30 s, admin uniquement) — apparaît/disparaît selon l'état | ✔ 1 → absent après traitement |
| 360×800 sur /admin/disputes | ✔ aucun débordement |
| `tsc` / `build` / lint | ✔ 0 erreur / 32,8 s / 18 signalements = baselines pré-existantes exactes (AdminOrders même amélioré de −1 `any`) |
| Données de test | ✔ commande + incident supprimés |

## 2. Anomalies

### QA-29 — Réassignation de livreur absente de la fiche commande
- **Gravité : Moyenne (différée par le plan)** — le plan LOT-08 excluait explicitement la réassignation (« nécessite une liste de livreurs en ligne fiable — après CONF-15 »). CONF-15 étant livré (LOT-06), la réassignation devient faisable — à planifier en complément (backlog P2).

### QA-30 — Historique des transitions de statut non affiché
- **Gravité : Mineure** — la fiche montre l'état courant + horodatages clés disponibles ; un vrai journal de transitions exigerait un modèle d'événements côté backend (non existant en mock). Documenté.

### QA-31 — « Clients » de la sidebar pointe vers une page du chantier externe
- **Gravité : À auditer (hors périmètre LOT-08)** — l'entrée `/admin/customers` + `AdminCustomers.tsx` ont été ajoutées par le chantier externe pendant la session. La route existe ; la page sera auditée au **LOT-16** (qui la prévoyait) au lieu d'être créée de zéro.

## 3. Verdict
**LOT-08 : conforme.** L'admin peut désormais agir : consulter le détail complet d'une commande, contacter les parties, annuler avec motif tracé, traiter incidents et annulations avec note, et voir la charge de litiges en permanence (badge sidebar). Plus aucune donnée inventée sur le dashboard. 1 moyenne différée (réassignation), 1 mineure, 1 point d'audit transféré au LOT-16.
