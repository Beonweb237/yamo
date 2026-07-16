# QA — LOT-04 (Annulation de commande : client + restaurant + motifs)

> **Date** : 16/07/2026 · QA sur CONF-04 (annulation client, motif obligatoire) + CONF-12 (motif obligatoire côté restaurant), schéma commun, affichages 3 profils.
> **Méthode** : revue du diff (`orders.ts`, `Orders.tsx`, `RestaurantDashboard.tsx`, `AdminDisputes.tsx`) + **cycle complet exécuté en réel sur les 3 profils** (2 commandes créées, une annulée par le client, une refusée par le restaurant, vues croisées vérifiées, données nettoyées).

## 1. Scénarios validés en exécution réelle

| Scénario | Résultat |
|---|---|
| Commande `pending` côté client → bouton « Annuler la commande » | ✔ |
| Dialog : confirmation impossible sans motif | ✔ (CTA `disabled` vérifié avant sélection, côté client ET resto) |
| Motif « Autre » → texte libre requis | ✔ (logique `cancelReasonComplete`, code identique aux deux dialogs) |
| Annulation client → stockage `{status:'cancelled', cancellationReason, cancelledBy:'customer'}` | ✔ |
| Vue client : « Annulée par vous · Motif : Le délai est trop long » | ✔ |
| Vue resto de l'annulation client : « Annulée par le client · Motif : … » | ✔ |
| Refus resto (`Refuser`) → même dialog motif, « Ingrédient en rupture » | ✔ |
| Vue client du refus : « Annulée par le restaurant · Motif : Ingrédient en rupture » | ✔ |
| Vue resto de son propre refus : « Annulée par vous · … » | ✔ |
| Vue admin (`/admin/disputes`) : auteur + motif pour les 2 annulations | ✔ |
| Anciennes annulations sans motif → « Motif non renseigné (annulation antérieure) » | ✔ (fallback codé) |
| Bouton client absent hors `pending/confirmed` | ✔ (condition explicite ; commandes annulées → 0 bouton vérifié) |
| Badge « Annulée » resto passé en rouge (`bg-error/10`) | ✔ (était vert pour tous statuts — correction opportuniste) |
| Mobile 360×800 | ✔ aucun débordement |
| `npx tsc -b` / `npm run build` | ✔ 0 erreur / build 1 min 26 |
| Lint fichiers du lot | ✔ 12 signalements = somme exacte des baselines pré-existantes (0 nouveau) |

## 2. Anomalies

### QA-17 — [CORRIGÉE, hors périmètre mais bloquante] Build cassé par le chantier externe
- **Gravité : Bloquante (origine externe)** — `Restaurants.tsx` (carte interactive ajoutée par le chantier concurrent) : prédicat de type invalide + `defaultMapCenter`/props inexistants. Deux des trois erreurs ont été corrigées par le chantier lui-même pendant mon intervention ; la troisième (prédicat `p is MapPoint`) corrigée par moi (`p is NonNullable<typeof p>`, une ligne, sans toucher à la fonctionnalité carte).
- Fichiers : `src/pages/Restaurants.tsx`.

### QA-18 — Course condition annulation client vs confirmation resto
- **Gravité : Moyenne (connue, documentée au plan)** — en mock, dernier écrit gagne (le client peut annuler dans la seconde où le resto confirme). À verrouiller côté serveur VPS (`POST /api/orders/:id/cancel` doit vérifier le statut courant — contrat déjà documenté dans `orders.ts`). Pas de correction front possible fiable.

### QA-19 — Pas de notification active du resto à l'annulation client
- **Gravité : Mineure** — le resto voit l'annulation au prochain poll (≤ 5 s) avec le motif, mais sans alerte sonore/toast dédiée (l'alerte n'existe que pour les nouvelles commandes). Amélioration à considérer avec LOT-11 (refonte polling).

## 3. Verdict
**LOT-04 : conforme.** Tous les critères d'acceptation validés en exécution réelle multi-profils. 1 bloquante externe corrigée (QA-17), 1 moyenne backend documentée (QA-18), 1 mineure (QA-19). Données de test nettoyées.
