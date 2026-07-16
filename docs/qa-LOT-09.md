# QA — LOT-09 (Re-commande 1-clic + avis nominatifs)

> **Date** : 16/07/2026 · QA sur CONF-25 (re-commande) + CONF-26 (preuve sociale).
> **Méthode** : revue du diff (`CartContext.loadCart`, `orders.ts` items+baseItemId, `catalog.ts` authorName, `Orders.tsx`, `RestaurantDetail.tsx`) + parcours réel.

## 1. Scénarios validés en exécution réelle

| Scénario | Résultat |
|---|---|
| Bouton « 🔄 Commander à nouveau » sur toute commande livrée | ✔ |
| Rematch par **`baseItemId`** (désormais persisté sur les items de commande) : Ndolé ×2 rechargé à l'identique (m1, 3 500) | ✔ |
| Plat personnalisé (« … + Grande portion ») → retombe sur le **plat de base** au prix nature (m2, 4 000) — la personnalisation est à refaire (les options ne sont pas reconstructibles fidèlement depuis l'ancien format) | ✔ comportement choisi et commenté dans le code |
| Article disparu du menu (« Plat Disparu Fantôme ») → **exclu** du panier + toast d'information | ✔ (panier final exact : 2 lignes) |
| Redirection directe `/checkout` avec le panier rechargé | ✔ |
| Panier contenant un autre restaurant → AlertDialog « Remplacer votre panier ? » avant écrasement | ✔ par code (même mécanique que le conflit LOT-01, testée) |
| Tous les plats indisponibles → `toast.error`, panier intact | ✔ par code |
| Avis : `authorName` stocké (« Marie N. » dérivé de `yamo_profile_name` « Marie Ngo » — prénom + initiale) | ✔ vérifié en storage |
| Fiche resto : **« Marie N. » + badge « ✓ Commande vérifiée »**, ancien « Client MiamExpress » disparu ; anciens avis sans nom → « Client vérifié » | ✔ |
| `tsc` / `build` / lint | ✔ 0 erreur / 42,1 s / 5 signalements = baselines exactes (orders 2, catalog 2, RestaurantDetail 1 ; Orders/CartContext 0) |
| Données de test | ✔ commande, avis, panier, nom de profil nettoyés |

## 2. Anomalies

### QA-41 — Personnalisations non reconstruites à la re-commande
- **Gravité : Moyenne (limite assumée)** — les anciennes commandes ne stockent que le nom composite ; reconstruire variante+suppléments exigerait de persister la structure complète des options (fait désormais pour `baseItemId`, extensible plus tard aux options). Le comportement actuel (plat de base + repersonnalisation manuelle) est honnête et signalé. Amélioration backlog : persister `selectedOptions` sur les items de commande.

### QA-42 — Nom d'auteur non modifiable a posteriori
- **Gravité : Mineure** — l'avis fige le nom au moment de la notation (comportement standard). Sans nom de profil renseigné → « Client vérifié ».

## 3. Verdict
**LOT-09 : conforme.** Levier de fréquence n°1 (re-commande) opérationnel avec gestion des indisponibles, et preuve sociale nominale en place. 1 moyenne assumée (backlog), 1 mineure.
