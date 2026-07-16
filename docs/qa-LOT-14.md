# QA — LOT-14 : Horaires structurés + pipeline images

> Date : 16/07/2026 · Périmètre : CONF-36 (horaires), CONF-37 (upload /api/media + compression)
> Fichiers touchés : `src/lib/hours.ts` (nouveau), `src/lib/media.ts` (nouveau),
> `src/pages/RestaurantDashboard.tsx`, `src/pages/RestaurantDetail.tsx`,
> `src/pages/Restaurants.tsx`, `src/lib/catalog.ts` (fix).

## 1. Ce qui a été livré

### CONF-36 — Horaires structurés
- **Format de stockage inchangé** (`"HH:MM - HH:MM"`) → zéro migration ; `src/lib/hours.ts`
  centralise le parsing (tolère `8h00`, tirets variés) et le calcul d'ouverture.
- **Ouvert effectif = toggle du restaurateur ET plage horaire du moment.**
  Plages de nuit gérées (`10:00 - 02:00`). `hours` illisible (ancien texte libre)
  → repli sur le toggle seul, comme avant (CA « ancien format toléré en lecture »).
- **ProfileTab** : 2 × `<input type="time">` (plus de texte libre), aide « fermeture
  après minuit possible » ; `deliveryTime` → `<select>` de fourchettes, la valeur
  héritée hors liste (« 25-35 min ») reste sélectionnable.
- **Header dashboard resto** : badge « Hors horaires (…) — affiché "Fermé" aux clients »
  quand le toggle dit Ouvert hors plage (évite l'incohérence resto/client).
- **Fiche client** : badge 3 états — « Ouvert jusqu'à HH:MM » / « Fermé actuellement
  · ouvre à HH:MM » (fermé par les horaires) / « Fermé actuellement » (toggle) ;
  boutons d'ajout au panier désactivés selon l'état effectif.
- **`/restaurants`** : filtre « Ouvert maintenant » basé sur l'état effectif.

### CONF-37 — Pipeline images
- `src/lib/media.ts` : `compressImage` (canvas, max 1280 px, JPEG q0.7, ne garde la
  version compressée que si plus légère), `uploadMedia` (POST `/api/media/upload?folder=`,
  contrat identique à AdminMedia/media-api.js → `media.url`), `processFormImage`
  (compression puis URL `/uploads/…` en mode VPS ou data-URL en mock).
- **Formulaire menu resto** : upload asynchrone avec spinner « Traitement de l'image… »,
  bouton Enregistrer bloqué pendant le traitement, toast en cas d'échec.
- Repli mock : data-URL de l'image **compressée** (localStorage allégé d'autant).

## 2. Vérifications exécutées (navigateur réel, mode mock)

| # | Contrôle | Résultat |
|---|---|---|
| 1 | ProfileTab : « 08:00 - 22:00 » parsé dans les 2 champs time ; « 25-35 min » hérité en tête du select | ✅ |
| 2 | Enregistrement 15:00–18:00 (heure du test : 14h17) → override persisté, badge « Hors horaires » dans le header resto | ✅ |
| 3 | `/restaurants` + filtre « Ouvert maintenant » : 12 → 10 ; exclus = Chez Mama (test) et **Le Matin Doux (06:00–14:00, fermé par l'heure réelle malgré `isOpen=true`)** | ✅ |
| 4 | Fiche client Chez Mama : « Fermé actuellement · ouvre à 15:00 », 35 boutons d'ajout désactivés | ✅ |
| 5 | Plage de nuit `10:00 - 02:00` à 14h17 : « Ouvert jusqu'à 02:00 », 0 bouton désactivé | ✅ |
| 6 | Upload menu (mock) : PNG 3,6 Mo 2400×1600 injecté → aperçu JPEG **69 Ko** 1280×853 (CA ≤ 300 Ko) ; plat créé, image compressée persistée, visible dans la liste | ✅ |
| 7 | Mobile 360×800 : badge header sur 2 lignes sans débordement ; champs time côte à côte sans débordement | ✅ |
| 8 | Console : 0 erreur ; `tsc -b` : 0 erreur ; build : ✅ ; lint : 0 nouvelle erreur dans les 6 fichiers (9 pré-existantes documentées) | ✅ |

Données de test nettoyées (plat retiré, override resto 1 supprimé, session déconnectée).

## 3. Anomalie trouvée et corrigée pendant le QA

**QA-40 (majeure)** — `fetchRestaurantByOwner` / `fetchRestaurantsByOwner` (mode mock)
ne passaient pas par `applyOverrides` : les modifications du ProfileTab (horaires,
temps de livraison, minimum) **disparaissaient du dashboard au rechargement** (elles
restaient pourtant visibles côté client). Pré-existant, mais bloquant pour le CA du
lot. Corrigé dans `catalog.ts` (2 lignes), re-vérifié après reload : valeurs et badge
conservés.

## 4. Écarts restants (documentés, hors CA du lot)

1. **Chemin VPS non testé en réel** : `VITE_USE_VPS_API` absent en dev et pas
   d'autorisation d'uploader des fichiers de test sur le VPS de production. Le
   contrat (`POST /api/media/upload` → `{ media: { url } }`) a été vérifié contre
   `app/server/media-api.js`. À tester lors du prochain déploiement.
2. **`ApplicationForm.tsx` reste en base64** — explicitement « 2ᵉ temps » dans le
   plan (CONF-37) ; même pattern `processFormImage` réutilisable.
3. **Multi-créneaux** (pause déjeuner, horaires par jour) — différé par le plan
   (« multi-créneaux différé »).
4. **Vue plats / fiche plat** : l'ajout au panier depuis `DishResults`/`DishDetail`
   n'était déjà pas bloqué par `isOpen` avant ce lot (le blocage panier→checkout
   couvre en aval). Pré-existant, à traiter avec CONF-33 si souhaité.
5. Captures d'écran indisponibles (limite connue QA-07) — contrôles par mesures DOM.

## 5. Verdict
CA CONF-36 et CONF-37 atteints en mode mock ; 1 majeure corrigée (QA-40) ; aucune
régression détectée sur recherche, fiche resto, dashboard resto.
