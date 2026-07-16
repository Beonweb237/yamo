# QA — LOT-07 (Preuve de livraison + incidents livreur)

> **Date** : 16/07/2026 · QA sur CONF-17 (code de livraison 4 chiffres) + CONF-18 (incidents livreur), affichages client/livreur/admin.
> **Méthode** : revue du diff (`orders.ts`, nouveau `incidents.ts`, `Orders.tsx`, `DriverDashboard.tsx`, `AdminDisputes.tsx`, `AdminOrders.tsx`) + **cycle réel complet** exercé sur les 3 profils.

## 1. Scénarios validés en exécution réelle

| Scénario | Résultat |
|---|---|
| Code 4 chiffres généré à la création (`deliveryCode: '6458'`) | ✔ |
| Client : encart vert « Code de livraison » en gros chiffres (30 px, `aria-label` épelé) dès `picked_up` | ✔ |
| Livreur : « Marquer comme livrée » → dialog exigeant le code (input `inputmode=numeric`, 4 chiffres, CTA désactivé sinon) | ✔ |
| Code faux → toast « essai 1/3 », **commande inchangée** (`picked_up`) | ✔ |
| 3 échecs → apparition du repli « Le client n'a pas son code » (invisible avant) | ✔ |
| Repli → `delivered` + **`deliveredWithoutCode: true`** + toast « signalée à l'équipe » | ✔ |
| AdminOrders : drapeau **« sans code ⚠ »** avec tooltip sur la commande concernée | ✔ |
| Incident : bouton « ⚠️ Signaler un problème » sur course active → dialog (type obligatoire — CTA désactivé sans sélection, note libre) | ✔ |
| Incident stocké (`yamo_incidents`, type + note + `status: open`) et visible dans AdminDisputes (« Adresse introuvable · Commande #… · note · badge Ouvert ») | ✔ |
| Espèces + code combinés dans le même dialog (libellé « J'ai encaissé — livraison terminée ») | ✔ |
| Anciennes commandes sans `deliveryCode` → confirmation simple (compat) | ✔ par code (`requestMarkDelivered`) |
| `tsc` / `build` / lint (6 fichiers) | ✔ 0 erreur / 1 min 03 / 9 signalements = somme exacte des baselines (incidents.ts neuf : 0) |
| Données de test | ✔ commande + incident supprimés, session restaurée |

## 2. Anomalies

### QA-26 — Vérification du code côté client (mock) contournable
- **Gravité : Moyenne (dépendance backend, documentée)** — en mock, le code est comparé dans le navigateur du livreur (qui pourrait le lire dans localStorage). Le contrat VPS (`POST /api/orders/:id/deliver { code }`, vérification serveur) est documenté dans `orders.ts` ; en mock mono-navigateur c'est sans enjeu réel.

### QA-27 — Le code n'est pas communiqué hors app
- **Gravité : Mineure** — le client sans data ne voit pas son code (pas de SMS). Le repli « sans code » couvre le cas ; l'envoi SMS du code appartient au backend (avec l'OTP, CONF-08).

### QA-28 — Incident sans notification temps réel admin
- **Gravité : Mineure** — visible au prochain poll (≤ 5 s page ouverte). Badge sidebar « litiges ouverts » prévu au LOT-08.

## 3. Verdict
**LOT-07 : conforme.** Preuve de livraison et incidents opérationnels de bout en bout, tous les états exercés en réel (code bon/faux ×3/repli tracé, incident transmis et visible admin). 1 moyenne backend documentée, 2 mineures.
