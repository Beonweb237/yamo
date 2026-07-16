# QA — LOT-01 (Fiabilité du panier)

> **Date** : 16/07/2026 · **QA indépendant** sur l'implémentation du LOT-01 (CONF-01 persistance panier, CONF-02 id composite personnalisations).
> **Méthode** : relecture du diff Git (lot non commité — diff du working tree), revue croisée avec `ux-audit-optimal.md` / `ux-implementation-plan.md` / `design-system.md`, exécution réelle (`npm run dev`) sur `/restaurant/1`, `/restaurant/2`, `/checkout`, popover panier Navbar et sheet mobile, aux 6 résolutions demandées.
> **Références visuelles** : aucune maquette dans le dépôt — la référence est le design system documenté ; aucune prétention pixel-perfect n'est donc évaluée. Les captures d'écran du pane expirent (limitation d'outil constatée sur toute la session) : les contrôles visuels ont été réalisés par **mesures DOM/styles calculés** (largeurs, visibilité, débordement, couleurs) — méthode indiquée pour chaque point.

---

## 1. Couverture des vérifications

| Vérification | /restaurant/1 | /checkout | Popover Navbar | Sheet mobile |
|---|---|---|---|---|
| Structure & action principale | ✔ CTA « Ajouter — prix » unique dans le dialog ; « Confirmer la commande » unique au checkout | ✔ | ✔ | ✔ |
| Navigation | ✔ breadcrumb, retour, redirection checkout-vide → `/restaurants` | ✔ | ✔ | ✔ |
| Composants interactifs | ✔ steppers par ligne (composite incl.), « + » rouvre la personnalisation, conflit inter-restos | ✔ | ✔ | ✔ |
| Chargement / vide / erreurs | ✔ skeletons existants ; vide : clé supprimée + « Votre panier est vide » + barre masquée ; JSON corrompu : rendu sans crash, clé nettoyée | ✔ | ✔ | ✔ |
| Données longues | ✔ nom composite max (« … + Grande portion + Suppl. plantain, Boisson gingembre ») : wrap au checkout, truncate dans les listes, aucun débordement à 360 | ✔ | ⚠ QA-03 | ⚠ QA-03 |
| Console | ✔ 0 erreur sur toutes les pages/étapes testées | ✔ | ✔ | ✔ |

**Résolutions** : 360×800, 390×844, 412×915, 768×1024, 1366×768, 1440×900 — `scrollWidth === clientWidth` partout (aucun débordement horizontal) ; barre panier mobile visible < 1024 et bien masquée (offsetParent null) ≥ 1024 ; sidebar panier desktop présente ≥ 1024 ; dialog de personnalisation à 360 : 328 px, entièrement visible, CTA h = 40 px.

**Scénarios validés en exécution réelle** :
persistance après F5 ✔ (et même après redémarrage complet du serveur) · TTL −25 h → purge ✔ · JSON corrompu → aucun crash, clé nettoyée ✔ · 3 personnalisations distinctes = 3 lignes aux bons prix (`m2::v1::s0` 6 000, `m2::v0::s1` 4 800, `m2::v0::s` 4 000) ✔ · combo identique re-ajouté → fusion qty 2 ✔ · badge menu agrégé (« 3 ») ✔ · steppers sur lignes composites (+/−/suppression) ✔ · conflit inter-restaurants avec panier **restauré d'une session précédente** → dialog + « Vider et ajouter » conserve `baseItemId` ✔ · récapitulatif checkout avec libellés complets et sous-total exact ✔.

---

## 2. Anomalies

### QA-01 — Compteur « articles » du checkout compte les lignes, pas les unités
- **Gravité : Majeure** (aggravée par le lot : les personnalisations multiplient les lignes, l'écart lignes/unités devient courant)
- Route : `/checkout` · Résolutions : toutes · Composant : hero du checkout (`Checkout.tsx`, `{items.length} article…`)
- **Problème** : avec 4 lignes totalisant 5 unités, l'en-tête affiche « 4 articles » — information fausse à l'étape de paiement.
- **Attendu** : « 5 articles » (somme des quantités = `totalItems`, déjà exposé par `useCart`).
- **Correction recommandée** : remplacer `items.length` par `totalItems` dans l'en-tête.
- Fichiers : `src/pages/Checkout.tsx`.
- **Statut : corrigée dans cette passe QA** (voir §3).

### QA-02 — Pas de revalidation prix/disponibilité à la restauration du panier
- **Gravité : Moyenne**
- Route : toutes (hydratation) · Composant : `CartContext.readStoredCart`
- **Problème** : un panier restauré (≤ 24 h) conserve les prix/disponibilités du moment de l'ajout ; si un plat a changé de prix ou est devenu indisponible entre-temps, l'écart n'est détecté qu'à la validation. La recommandation CONF-01 mentionnait une « re-validation des prix à la restauration ».
- **Attendu** : au minimum, contrôle au moment du checkout (montants serveur faisant foi).
- **Correction recommandée** : couverte par **LOT-03/CONF-03** (validation serveur bloquante `/api/orders/validate`) — c'est le bon endroit (le mock actuel a des prix statiques, une revalidation locale serait un faux confort). **Ne pas corriger dans ce lot** ; tracer la dépendance.
- Fichiers concernés à terme : `src/lib/payments.ts`, `src/pages/Checkout.tsx`.

### QA-03 — Noms composites tronqués sans info-bulle dans les listes de panier
- **Gravité : Mineure**
- Routes : `/restaurant/:id` (sidebar + sheet), Navbar popover · Résolutions : toutes (plus visible ≤ 412)
- **Problème** : « Poulet DG Traditionnel + Grande portion + Suppl. plantain, Boisson gingembre » est tronqué (`truncate`) sans `title` ni détail au tap ; la composition n'est lisible qu'au checkout.
- **Attendu** : composition consultable depuis les listes (attribut `title` a minima, ou libellé sur 2 lignes).
- **Correction recommandée** : ajouter `title={item.name}` sur les `<p>` tronqués de `CartContent` (RestaurantDetail) et du popover (Navbar) ; envisager `line-clamp-2` lors d'un futur lot UI.
- Fichiers : `src/pages/RestaurantDetail.tsx`, `src/components/Navbar.tsx`.

### QA-04 — Pas de synchronisation multi-onglets
- **Gravité : Mineure**
- Routes : toutes · Composant : `CartContext`
- **Problème** : deux onglets ouverts divergent (pas d'écoute de l'événement `storage`) ; le dernier qui écrit gagne et peut ressusciter un panier vidé dans l'autre onglet.
- **Attendu (idéal)** : resynchronisation à l'événement `storage`.
- **Correction recommandée** : faible priorité (usage mobile mono-onglet dominant au Cameroun) — à traiter si un bug réel est rapporté.
- Fichiers : `src/contexts/CartContext.tsx`.

### QA-05 — Cibles tactiles des steppers < 40 px
- **Gravité : Mineure (pré-existant, non introduit par le lot)**
- Routes : `/restaurant/:id`, popover Navbar · Composants : boutons +/− (`w-6/w-7` = 24-28 px)
- **Problème** : sous la recommandation ~40 px du design system §10 ; le nouveau bouton « + » des plats personnalisables reprend ce pattern existant (cohérence visuelle choisie à juste titre).
- **Correction recommandée** : agrandir la zone cliquable (padding/hit-area) globalement lors du lot accessibilité **LOT-12** — pas au cas par cas.
- Fichiers : `src/pages/RestaurantDetail.tsx`, `src/components/Navbar.tsx`.

### QA-06 — TTL glissant (savedAt rafraîchi à chaque modification)
- **Gravité : Mineure (comportement assumé)**
- **Constat** : un panier modifié régulièrement ne périme jamais ; « 24 h » s'entend depuis la dernière activité, pas depuis la création. Interprétation standard et conforme à l'esprit du critère (paniers abandonnés purgés) — documenté ici pour lever toute ambiguïté.

### QA-07 — Captures d'écran indisponibles
- **Gravité : Mineure (outillage, hors application)**
- Les captures du pane expirent systématiquement (timeout 30 s, constaté avant le lot également). Les vérifications « visuelles » reposent sur les mesures DOM/styles calculés. **Validation humaine recommandée** : un passage visuel manuel sur `/restaurant/1` (badge personnalisable) et `/checkout` (récapitulatif composite) à 360×800 et 1366×768.

---

## 3. Corrections appliquées dans cette passe QA

| Anomalie | Correction | Fichier |
|---|---|---|
| QA-01 (majeure) | En-tête checkout : `items.length` → `totalItems` (« 5 articles » pour 5 unités) | `src/pages/Checkout.tsx` |

QA-02 → LOT-03 (dépendance backend documentée) · QA-03/04/05 → mineures, non corrigées (hors consigne « bloquantes et majeures uniquement ») · QA-06/07 → documentation.

**Aucune anomalie bloquante détectée.**

## 4. Validation post-correction

| Commande | Résultat |
|---|---|
| `npx tsc -b` | ✅ 0 erreur |
| `npx eslint .` | ✅ 81 problèmes = baseline exacte pré-lot (aucune nouvelle erreur) |
| `npm run build` | ✅ succès |
| Tests unitaires/e2e | Inexistants dans le projet (pas de script `npm test`) |
| Console navigateur | ✅ 0 erreur après correction |

## 5. Verdict

**LOT-01 : conforme.** Les deux problèmes cibles (CONF-01, CONF-02) sont correctement résolus et vérifiés en exécution réelle, sans régression détectée sur les parcours panier/checkout/conflit inter-restaurants. Une anomalie majeure connexe (QA-01) a été corrigée dans cette passe. Restent 3 mineures documentées (QA-03/04/05) et une dépendance LOT-03 (QA-02).
