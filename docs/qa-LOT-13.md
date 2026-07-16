# QA — LOT-13 : Recherche unifiée (CONF-33)

> Date : 16/07/2026 · Périmètre : fusion `/restaurants` + `/explorer` en une seule page à deux modes.
> Référence : `ux-implementation-plan.md` §LOT-13 / CONF-33.

## 1. Ce qui a été livré

| Élément | Détail | Fichiers |
|---|---|---|
| Page unique 2 modes | `/restaurants` porte un toggle **Restaurants / Plats** (`role="tablist"`, `aria-selected`) dans la carte de recherche ; `?mode=plats` sélectionne la vue plats. `q` / `ville` / `quartier` sont **partagés** entre les deux modes. | `Restaurants.tsx` |
| Vue plats extraite | Toute la logique ex-ExplorerMet (filtres rapides, tags diététiques, tri, quick-order, sélecteur multi-restos, mode « Pour moi / Pour quelqu'un », géolocalisation, dialogs conflit panier / autre ville) vit dans un sous-composant piloté par props. | `DishResults.tsx` (nouveau, ~640 l.) |
| Redirection deep-links | `/explorer?...` → `/restaurants?...&mode=plats` (`ExplorerRedirect`, params préservés). `ExplorerMet.tsx` supprimé. | `App.tsx` |
| Navigation mise à jour | MobileBottomNav : « Recherche » → « Explorer » ; Navbar mega-menu « Tous les articles » → `/restaurants?mode=plats` (isActive tolère les query strings) ; liens `/explorer` réécrits dans DishDetail, Favorites, Profile. | 5 fichiers |
| Hero contextuel | Titre/fil d'Ariane/placeholder changent selon le mode ; filtre « Note » masqué en mode plats (propre aux restos). | `Restaurants.tsx` |

Améliorations au passage : images des cartes plats en `loading="lazy" decoding="async"` ; la géolocalisation auto au montage **n'écrase plus un deep-link `?ville=` explicite** (prop `hasExplicitLocation` — l'ancien ExplorerMet écrasait le paramètre).

## 2. Vérifications navigateur (réelles, matrice de deep-links)

| Test | Résultat |
|---|---|
| `/restaurants` → mode restaurants par défaut, toggle rendu (`aria-selected`), 12 restos, chips catégories, carte intactes | ✅ |
| Clic « Plats » → URL `?mode=plats`, h1 « Trouvez le Plat Parfait », 45 cartes plats, filtres rapides + diététiques + tri + « Je commande » + « Me localiser » présents | ✅ |
| Saisie « poulet » en mode plats → filtrage live (5 groupes, tous pertinents) | ✅ |
| Bascule Plats → Restaurants avec « poulet » saisi → requête conservée (URL `?q=poulet&ville=Douala`), 1 resto filtré | ✅ (après correction QA-39, voir §3) |
| `/explorer` → redirige `/restaurants?mode=plats` | ✅ |
| `/explorer?q=eru&ville=Douala&quartier=Akwa` → params préservés + mode=plats ; 0 résultat **légitime** (Eru absent d'Akwa) avec état vide propre ; sans quartier → 1 résultat « Eru » | ✅ |
| Quick-add (client connecté) → panier `yamo_cart` alimenté, badge « Ajouté » | ✅ |
| Plat d'un autre resto → dialog « Changer de restaurant ? » avec lien « continuer vos achats chez … », Annuler referme sans toucher au panier | ✅ |
| Plat multi-restos → popover « Choisir un restaurant » (3 restos, prix croissants) | ✅ |
| Mobile 360×800 : les 2 modes sans débordement horizontal ; bottom nav « Explorer » | ✅ |
| Tablette 768 : grille plats 3 colonnes, pas de débordement | ✅ |
| Desktop : carte latérale + plein écran du mode restaurants inchangés | ✅ |

## 3. Anomalie détectée et corrigée pendant le QA

**QA-39 (majeure, corrigée)** — la bascule de mode perdait une saisie non soumise : `setMode` ne réécrivait que `mode` dans l'URL, et l'effet de relecture des `searchParams` réinitialisait `q`/ville/quartier aux valeurs URL. Corrigé : `setMode` embarque l'état courant (q, category, ville, quartier) via `syncParams`. Re-testé : la requête survit à la bascule dans les deux sens.

## 4. Validation technique

- `npx tsc -b` : ✅ 0 erreur. `npm run build` : ✅ (39 s).
- Lint fichiers touchés : `DishResults.tsx` **0 problème** (2 erreurs `set-state-in-effect` détectées à la 1ʳᵉ passe dans le code hérité d'ExplorerMet, corrigées proprement : `allItems` en `useMemo`, géoloc au montage différée d'un tick). `Restaurants.tsx:127`, `Navbar.tsx:74` : erreurs pré-existantes de baseline (effets antérieurs au lot). `Navbar.tsx` `Heart` et `DishDetail.tsx` `UserRound` inutilisés : pré-existants (imports non touchés par ce lot).
- Console : erreurs HMR fantômes d'états intermédiaires d'édition dans le buffer du pane ; après rechargement complet, aucune erreur ni overlay Vite (limitation QA-07 connue).

## 5. Écarts / décisions

1. **Option « Toutes les villes » du mode plats supprimée** : l'état partagé impose une ville (défaut Douala, comme `/restaurants` depuis toujours). Assumé : la commande inter-villes est de toute façon bloquée par le dialog dédié, et la géolocalisation/le sélecteur couvrent le besoin. Le mode « Pour quelqu'un » invite à sélectionner la ville du destinataire.
2. Le mode « Pour quelqu'un » ne vide plus la ville à l'activation (l'ancien comportement remettait « toutes les villes », non représentable dans l'état partagé) — le hint textuel guide le choix.
3. Filtres propres à chaque mode (catégories/note/tri restos vs quick filters/diététique/tri plats) volontairement **non partagés** : sémantiques différentes, conforme au plan.
4. Captures d'écran indisponibles (QA-07) — validation visuelle humaine recommandée, en particulier le toggle dans la carte de recherche à 360 px.

## 6. Données de test

Nettoyées : panier vidé, session déconnectée, `yamo_explorer_mode` retiré, viewport restauré.

## Verdict

**LOT-13 conforme** : une seule porte d'entrée découverte, deep-links `/explorer` préservés, les deux modes partagent q/ville/quartier, aucun parcours cassé (quick-order, conflit panier, multi-restos re-testés). 1 anomalie majeure (QA-39) trouvée et corrigée pendant le QA.
