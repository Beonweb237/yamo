# QA — LOT-02 (Fantômes client + fiche restaurant fiable)

> **Date** : 16/07/2026 · **QA indépendant** sur l'implémentation du LOT-02 (CONF-06 boutons fantômes client, CONF-09 fiche resto fiabilisée, CONF-34 court terme carte estimée, message de conflit panier nominatif).
> **Méthode** : relecture du diff Git restreinte aux fichiers réellement modifiés pour ce lot, revue croisée avec `ux-audit-optimal.md` / `ux-implementation-plan.md` / `design-system.md`, exécution réelle (`npm run dev`) sur `/restaurant/:slug` (ex-`/restaurant/:id`) et `/commandes`, aux 6 résolutions demandées.

## ⚠️ Avertissement méthodologique — travail externe concurrent

Le working tree de `app/` contient, en plus du LOT-02, un chantier pré-existant non commité (« sync VPS » — `ExplorerMet.tsx`, `FoodRequestCreate.tsx`, `AdminMedia.tsx`, `Navbar.tsx`, suppression de `supabase/`…) **qui n'est pas de moi et qui a continué à être modifié pendant ce QA**, y compris sur `src/pages/RestaurantDetail.tsx` — un fichier central du LOT-02. Deux incidents concrets :

1. Une modification externe a introduit une **erreur de syntaxe réelle** (`}}` en trop ligne 680, bloquant le rendu de toute la page `/restaurant/:id` — overlay Vite actif, `<h1>` absent du DOM). Corrigée par un retrait du caractère en trop, sans toucher à la fonctionnalité sous-jacente.
2. La même modification a **migré le routage vers `/restaurant/:slug`** et, ce faisant, a **réintroduit littéralement la régression CONF-09** que ce lot corrige (`const restaurant = fetchedById ?? restaurants.find(...) ?? restaurants[0]`).

Le §2 « Anomalies » traite ce deuxième point comme une anomalie bloquante à part entière car **c'est exactement le type de régression que ce QA a pour mission de détecter**, quelle que soit son origine. La correction a été appliquée en préservant le routage par slug (hors périmètre LOT-02, non annulé) et en retirant uniquement le filet de repli interdit.

Tout le reste de ce rapport est scopé aux fichiers du LOT-02 : `src/hooks/useCatalog.ts`, `src/data/support.ts`, `src/components/DeliveryMap.tsx`, `src/components/LazyDeliveryMap.tsx`, `src/lib/orders.ts`, `src/pages/Orders.tsx`, `src/pages/RestaurantDetail.tsx`.

---

## 1. Couverture des vérifications

| Vérification | `/restaurant/:slug` | `/commandes` |
|---|---|---|
| Structure & action principale | ✔ CTA « Ajouter » unique, désactivé si fermé | ✔ |
| Navigation | ✔ 404 propre + CTA sortie vers `/restaurants` | ✔ |
| Composants interactifs | ✔ Partager (Web Share/clipboard), favori, badges Ouvert/Fermé | ✔ tel:/wa.me réels |
| Chargement / vide / erreurs | ✔ skeleton pendant résolution, jamais un autre resto | ✔ état vide inchangé |
| Données longues / manquantes | ✔ id/slug inexistant → « Restaurant introuvable » | ✔ `driverId` inconnu → repli support ; coords manquantes → carte masquée |
| Console | ✔ 0 erreur active (hors résidus historiques identifiés comme tels) | ✔ |

**Résolutions** 360×800, 390×844, 412×915, 768×1024, 1366×768, 1440×900 : `scrollWidth === clientWidth` sur les deux routes, aucune régression de layout.

**Scénarios validés en exécution réelle** :
- ID valide (`1`) → fiche normale ✔ (compat ascendante conservée par le repli id/slug côté page).
- Slug réel (`poulet-dg-royal`) → fiche résolue via la liste complète ✔.
- ID/slug inexistant → écran « Restaurant introuvable » + CTA `/restaurants`, **jamais** la fiche d'un autre établissement ✔ (testé après correction de la régression externe).
- Override `isOpen:false` → badge rouge « Fermé actuellement », tous les boutons d'ajout (grille + galerie) `disabled`, tooltip explicite ✔.
- `/commandes`, commande `delivering` avec `driverId` résolvable → `tel:` et `wa.me` vers le vrai numéro du livreur, message prérempli avec n° de commande + adresse ✔.
- `driverId` inconnu (`'driver-inconnu-xyz'`) → repli automatique vers `SUPPORT_PHONE` / `whatsappLink()`, libellés adaptés (« Appeler le support ») ✔.
- Coordonnées resto/client absentes → `buildTrackingPoints` retourne `null`, la carte ne s'affiche pas (aucune position inventée) ✔ ; les boutons de contact restent affichés indépendamment de la carte ✔.
- Aucun des 3 anciens boutons fantômes (`Support livraison`, `Je suis devant`, `Partager ma position`) n'est plus présent dans le DOM ✔.
- Partage : `navigator.share` absent dans l'environnement de test → repli `clipboard.writeText` correctement invoqué (a échoué avec `NotAllowedError` en sandbox — comportement attendu hors interaction utilisateur réelle, la fonction `handleShare` gère ce cas par un `toast.error` au lieu de planter) ✔.

---

## 2. Anomalies

### QA-08 — [CORRIGÉE EN COURS DE QA] Régression CONF-09 réintroduite par un routage slug concurrent
- **Gravité : Bloquante**
- Route : `/restaurant/:slug` (ex `/restaurant/:id`) · Résolutions : toutes · Composant : `RestaurantDetail.tsx` (résolution du restaurant)
- **Problème** : une modification externe concurrente au LOT-02 a migré la route vers `:slug` et réintroduit `?? restaurants[0]` en bout de chaîne de résolution — un id/slug inconnu affichait de nouveau la fiche du premier restaurant de la liste au lieu d'un état « introuvable ».
- **Attendu** : id/slug inconnu → `restaurant === undefined` → écran dédié (c'est le contrat même de CONF-09).
- **Correction appliquée** : retrait du seul `?? restaurants[0]`, conservation du lookup par slug (`restaurants.find(r => r.slug === slug || r.id === slug)`) nécessaire au fonctionnement du nouveau routage.
- Fichiers : `src/pages/RestaurantDetail.tsx`.
- **Statut : corrigée et revérifiée** (test id/slug inexistant → « Restaurant introuvable » confirmé après correction).

### QA-09 — [CORRIGÉE EN COURS DE QA] Erreur de syntaxe bloquant le rendu (`}}`)
- **Gravité : Bloquante**
- Route : `/restaurant/:slug` · Composant : section « Vous Aimerez Aussi »
- **Problème** : `to={\`/restaurant/${resto.slug || resto.id}\`}}` — accolade fermante surnuméraire introduite par la même modification externe, provoquant un overlay d'erreur Vite et l'absence totale de rendu de la page.
- **Correction appliquée** : suppression du caractère `}` en trop. Aucune fonctionnalité modifiée.
- Fichiers : `src/pages/RestaurantDetail.tsx`.
- **Statut : corrigée et revérifiée** (`tsc -b` propre, page rendue, `h1` présent).

### QA-10 — Cibles tactiles des boutons de contact `/commandes` < 40 px
- **Gravité : Mineure (pattern repris de l'existant, pas une régression du lot)**
- Route : `/commandes` · Résolution : 360×800 principalement · Composant : liens `tel:`/WhatsApp (`Orders.tsx`)
- **Problème** : hauteur mesurée ≈ 29 px (`text-[11px] px-3 py-1.5 rounded-full`) — sous la recommandation ~40 px du design system §10. C'est exactement le gabarit des anciens boutons fantômes qu'ils remplacent ; le lot ne dégrade donc rien mais ne corrige pas non plus ce point, hors de son périmètre (CONF-06 porte sur le fonctionnement des boutons, pas leur taille).
- **Attendu (idéal)** : zone cliquable ≥ 40 px.
- **Correction recommandée** : à traiter dans **LOT-12** (accessibilité, cf. QA-05 du rapport LOT-01, même famille de problème).
- Fichiers : `src/pages/Orders.tsx`.

### QA-11 — Le badge « Position estimée » manque de texte alternatif explicite pour lecteur d'écran
- **Gravité : Mineure**
- Route : `/commandes` · Composant : `DeliveryMap.tsx` (badge ajouté par ce lot)
- **Problème** : le badge est un `<span>` visuel positionné en absolu ; correct visuellement mais non annoncé distinctement s'il est parcouru hors contexte (pas de `role="status"` ni `aria-label` dédié — il hérite simplement du texte visible, ce qui reste lisible par un lecteur d'écran standard mais sans emphase).
- **Attendu (idéal)** : `aria-label="Position du livreur estimée, pas de suivi temps réel"` pour lever toute ambiguïté hors contexte visuel.
- **Correction recommandée** : ajout mineur, non bloquant — à regrouper avec LOT-12.
- Fichiers : `src/components/DeliveryMap.tsx`.

### QA-12 — `handleShare` : message d'erreur générique en cas d'échec clipboard
- **Gravité : Mineure**
- Route : `/restaurant/:slug` · Composant : bouton Partager
- **Constat** : en environnement sans permission clipboard (sandbox de test), l'échec est intercepté et affiche `toast.error("Impossible de partager le lien")` — comportement correct et sans crash, mais le message ne distingue pas « permission refusée » d'une autre erreur. Comportement acceptable en l'état, amélioration cosmétique possible uniquement.
- **Correction recommandée** : aucune action requise pour ce lot.
- Fichiers : `src/pages/RestaurantDetail.tsx`.

### QA-13 — Portée du QA limitée par des modifications externes concurrentes
- **Gravité : Mineure (méthodologie, hors application)**
- **Constat** : `Navbar.tsx` et `RestaurantDashboard.tsx` mélangent mes tokens de normalisation (session précédente) avec ~200+ lignes de travail externe non lié au LOT-02. Je n'ai ni évalué ni corrigé ce travail externe (hors mandat « ne pas modifier un autre lot »), seulement vérifié que mes propres hunks (bordure token, couleurs Recharts) restent intacts et fonctionnels.
- **Recommandation** : committer ou isoler ce travail externe avant le prochain lot, pour repartir d'un état stable et éviter de nouvelles collisions comme QA-08/QA-09.

**Aucune autre anomalie bloquante ou majeure détectée dans le périmètre du LOT-02.**

---

## 3. Corrections appliquées dans cette passe QA

| Anomalie | Correction | Fichier |
|---|---|---|
| QA-09 (bloquante) | Suppression de l'accolade surnuméraire `}}` → `}` | `src/pages/RestaurantDetail.tsx` |
| QA-08 (bloquante) | Retrait du filet `?? restaurants[0]`, conservation du lookup par slug | `src/pages/RestaurantDetail.tsx` |

QA-10/11/12 → mineures, non corrigées (hors consigne « bloquantes et majeures uniquement », et hors périmètre fonctionnel strict du lot pour QA-10/11). QA-13 → recommandation de processus, aucune action code.

## 4. Validation post-correction

| Commande | Résultat |
|---|---|
| `npx tsc -b` | ✅ 0 erreur |
| `npx eslint` (fichiers LOT-01/LOT-02 : `useCatalog.ts`, `support.ts`, `DeliveryMap.tsx`, `LazyDeliveryMap.tsx`, `orders.ts`, `Orders.tsx`, `RestaurantDetail.tsx`, `Checkout.tsx`, `CartContext.tsx`, `chartTheme.ts`) | ✅ 9 problèmes = **identiques à la baseline HEAD par fichier** (0 nouvelle erreur introduite par le lot) |
| `npx eslint .` (projet entier) | 86 problèmes — **fluctuant entre 81 et 86 au fil du QA à cause du chantier externe concurrent** (`ExplorerMet.tsx`, `FoodRequestCreate.tsx`…), hors périmètre LOT-02, non corrigé ni imputable à ce lot |
| `npm run build` | ✅ succès (46,8 s) |
| Tests unitaires/e2e | Inexistants dans le projet (pas de script `npm test`) |
| Console navigateur | ✅ 0 erreur active après corrections (résidus historiques identifiés et écartés) |

## 5. Verdict

**LOT-02 : conforme après correction de deux anomalies bloquantes d'origine externe.** Les objectifs propres au lot (CONF-06, CONF-09, CONF-34 court terme, message de conflit nominatif) sont correctement implémentés et vérifiés en exécution réelle sur les 6 résolutions demandées. Les deux anomalies bloquantes détectées (QA-08, QA-09) ne provenaient pas du code du LOT-02 mais d'un chantier externe concurrent touchant le même fichier central (`RestaurantDetail.tsx`) — elles ont été corrigées chirurgicalement sans annuler ce travail externe ni élargir le périmètre du lot. Restent 3 anomalies mineures (QA-10/11/12, cosmétiques/accessibilité, non bloquantes) et une recommandation de processus (QA-13) : stabiliser l'état du dépôt (commit ou isolation du chantier VPS) avant d'attaquer le prochain lot, pour éviter que de futures collisions ne masquent de vraies régressions.
