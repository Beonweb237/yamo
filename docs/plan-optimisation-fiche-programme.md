# Plan d'optimisation — Fiche programme repas (`/programmes/:id`)

> Objectif : transformer une fiche squelettique en une page qui **captive**, **motive** et
> **fait comprendre l'offre**, de bout en bout. Basé sur l'analyse de la page réelle
> (`MealProgramDetail.tsx`) et des données disponibles (`MealProgram`).

---

## 1. Ce que l'utilisateur voit AUJOURD'HUI

Back-link · photo (souvent absente → icône) · nom · resto·ville · « Pour : … » · description ·
2 tags · « 28 repas · 4 semaines » · « 39 000 FCFA / cycle » · formulaire (date début + adresse
texte) · 1 phrase de réassurance · bouton Souscrire.

**Verdict** : abstrait, pas appétissant, ne répond pas aux 3 questions clés de l'utilisateur.

## 2. Les 3 besoins utilisateurs — et les manques critiques

### A. « Qu'est-ce que je reçois exactement ? » (COMPRÉHENSION)
| Manque | Impact |
|---|---|
| **Aucun exemple de plat** — « 28 repas » mais lesquels ? | 🔴 bloquant |
| **Calendrier flou** — le champ `schedule` (fréquence + jours) existe MAIS n'est pas affiché | 🔴 |
| **Prix non décomposé** — pas de « ≈ 1 400 FCFA/repas », livraison incluse ? | 🟠 |
| **« Cycle » non expliqué** — 4 semaines puis ? renouvellement ? | 🟠 |

### B. « Pourquoi m'abonner ? » (MOTIVATION / CAPTIVATION)
| Manque | Impact |
|---|---|
| **Pas de photo appétissante** (la plupart des programmes n'ont pas de `photoUrl`) | 🔴 |
| **Aucun bénéfice mis en avant** (santé, gain de temps, économies) | 🔴 |
| **Aucune preuve sociale** — le resto a des avis (4★) non affichés ici ; pas de « X abonnés » | 🟠 |
| **Signaux de confiance faibles** — « pause à tout moment » noyé, pas de « livraison suivie » | 🟠 |

### C. « Comment je m'y prends, en confiance ? » (PASSAGE À L'ACTION)
| Manque | Impact |
|---|---|
| **Pas de « Comment ça marche »** (les étapes) | 🟠 |
| **Pas de récapitulatif** avant de payer (X repas · Y sem · jours · total) | 🔴 |
| **Adresse = input texte** alors que l'app a `AddressPickerMap` + adresses sauvegardées | 🟠 |
| **CTA non sticky mobile** — il faut scroller pour trouver le bouton | 🟠 |
| **Pas de contact resto** (WhatsApp/appel — `restaurantPhone` existe pourtant) | 🟢 |
| **Pas de FAQ** (changer de plat ? weekend ? remboursement ?) | 🟢 |

### D. Découverte & SEO
- Pas de **programmes similaires / du même resto**, resto **non cliquable** vers sa fiche.
- Pas de **données structurées** (JSON-LD Product/Offer) ni de meta description riche.

---

## 3. Insight clé : presque tout est faisable SANS backend

**Le menu d'exemple se DÉRIVE** des `menu_items` du restaurant filtrés par les `dietary_tags`
du programme (vrais plats, déjà tagués — cf. seed tags). Le calendrier, le prix/repas, les
étapes, la réassurance, les avis, les programmes liés, le CTA sticky, la carte d'adresse, la
FAQ, le JSON-LD : **tout est dérivable de l'existant**. Seuls « bénéfices » et « photo dédiée »
demandent un léger enrichissement data (Phase 2).

---

## 4. Plan d'optimisation — par LOT

### LOT 1 — Compréhension de l'offre (front, données existantes) 🔴 priorité
1. **Menu d'exemple** : `fetchMenuItems(restaurantId)` filtré par `program.dietaryTags` → section « Exemples de plats de ce programme » (photos + noms). Réel, zéro nouvelle donnée.
2. **Calendrier de livraison** : afficher `schedule.frequence` + `schedule.jours` (« Livré tous les jours » / « Lun, Mer, Ven »).
3. **Prix décomposé** : « **39 000 FCFA** / cycle · ≈ **1 400 FCFA / repas** · livraison incluse ».
4. **Bandeau « Comment ça marche »** : 4 étapes (Choisissez la date → On prépare → Livraison selon le calendrier → Pause/annulation quand vous voulez).
- *Parties* : `MealProgramDetail.tsx` (+ `fetchMenuItems`).

### LOT 2 — Motivation & confiance (front) 🔴
5. **Photo** : `photoUrl` sinon **image du restaurant** (`restaurantImage`) sinon dégradé de marque + icône — jamais l'icône nue.
6. **Bénéfices dérivés** : 3-4 puces générées selon `targetAudience`/tags (ex. diabète → « Index glycémique maîtrisé », « Zéro prise de tête », « Livré chaud chez vous »).
7. **Preuve sociale** : note + nb d'avis du resto (`fetchRestaurantRatingSummary`) + « Programme proposé par un partenaire vérifié ».
8. **Réassurance visible** : chips « Annulez à tout moment · Mettez en pause · Livraison suivie · Paiement sécurisé ».
- *Parties* : `MealProgramDetail.tsx` (+ `lib/reviews`).

### LOT 3 — Conversion (front) 🔴
9. **Récapitulatif de souscription** : carte « Votre abonnement : X repas · Y semaines · [jours] · démarre le [date] · **total 39 000 FCFA** ».
10. **CTA sticky mobile** (barre basse « Souscrire · 39 000 FCFA »).
11. **Adresse** : `AddressAutocomplete`/`AddressPickerMap` + sélection des adresses sauvegardées (comme au checkout).
12. **Contacter le resto** : bouton WhatsApp/appel (`restaurantPhone`).
- *Parties* : `MealProgramDetail.tsx`, réutilise composants adresse existants.

### LOT 4 — Découverte + SEO (front) 🟠
13. **Programmes du même resto** + **autres programmes** (réutilise `fetchPrograms`), resto **cliquable** vers `/restaurant/:id`.
14. **FAQ** repliable (3-4 questions).
15. **JSON-LD** (`Product` + `Offer` : nom, prix FCFA, resto, image) + **meta description** riche via `useSeo`.
- *Parties* : `MealProgramDetail.tsx`, `useSeo`.

### LOT 5 — Enrichissement data (backend léger) 🟢 optionnel
16. **Champs `benefits text[]` + `sample_menu`** sur `meal_programs` (migration `food-routes.js`) + **formulaire resto** (`RestaurantPrograms.tsx`) pour les saisir + **fiche** qui les affiche si présents (sinon fallback dérivé du LOT 2).
17. **Photo dédiée** : upload `/api/media` dans le formulaire resto ; **seed enrichi** (photos + bénéfices) pour la démo.
- *Parties* : `server/src/food-routes.js`, `lib/mealPrograms.ts`, `RestaurantPrograms.tsx`, seed.

---

## 5. Ordre recommandé & jalons

```
LOT 1 (comprendre) → LOT 2 (motiver) → LOT 3 (convertir) → LOT 4 (découverte/SEO) → LOT 5 (data)
```
- **Jalon A (LOT 1-3)** : fiche captivante, claire, convertissante — **100% dérivé de l'existant, zéro backend**. Le gros du gain.
- **Jalon B (LOT 4)** : découverte + SEO.
- **Jalon C (LOT 5)** : contenu éditorial enrichi (bénéfices/photos saisis par le resto).

**Garde-fous à chaque lot** : i18n FR/EN (clé = texte FR), `verify:hooks` 0, `verify:i18n`, `build`,
contrôle pixel 360px + desktop, réel uniquement (menu d'exemple = vrais plats tagués ; masquer une
section si pas de donnée). Déploiement = build + **react-snap** (prerender /fr /en) + sync dist.

**Effort estimé** : LOT 1-3 ≈ 1 j · LOT 4 ≈ 0,5 j · LOT 5 ≈ 0,5 j. **Total ≈ 2 j**, livrable par jalon.
