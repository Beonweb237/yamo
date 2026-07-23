# Plan — Module Alimentaire (Health) : profil, demandes perso, abonnements (série FOOD)

Spec figée. Source de vérité. À valider avant tout code (comme LOT-0 Ops).
Adaptée à l'existant : **on construit par-dessus, on ne remplace rien.**

## 0. Objet

Faire évoluer MiamExpress de la livraison de repas vers des **services alimentaires
personnalisés** : profil alimentaire, commandes sur mesure (appel d'offres) et
**abonnements repas récurrents** (programmes santé/nutrition). Deux docs de vision :
MiamExpress_Health_Vision_Complete.md, MiamExpress_Module_Commandes_Personnalisees_Abonnements.md.

## 1. Réalité du système (audité — ne pas re-supposer)

- **Tags diététiques** : `DIETARY_TAG_META` (dishes.ts) — 18 tags dont `diabetique,
  pauvre-en-sel, vegan, halal, sans-gluten, riche-en-proteines, detox, allege`. Portés
  par les plats. **À réutiliser tel quel** (profil + programmes + filtrage).
- **Demandes personnalisées / appel d'offres** : **backend VPS déjà présent** —
  `food_requests` + `food_bids`, endpoints `POST/GET /api/food-requests[/available|/mine|/:id]`,
  colonnes `dietary_tags`, `delivery_schedule` (jsonb), `delivery_lat/lng`. **MAIS** le
  client `lib/foodRequests.ts` est **100 % localStorage** (jamais branché au VPS).
- **`DeliverySchedule`** (foodRequests.ts) porte déjà `frequence: unique|quotidien|hebdomadaire`,
  `jours[]`, `dureeSemaines` → **ossature récurrente déjà modélisée**.
- **Profil client** : localStorage (`yamo_profile_*`). Pas de profil alimentaire.
- **Contrainte DB** : l'utilisateur `miamexpress` ne possède pas les tables cœur (`ALTER
  users/orders` refusé) → toute donnée nouvelle = **table dédiée** que l'on possède.
- **Paiement récurrent** : pas d'auto-débit (passerelle one-shot). → abonnements v1 =
  **prépayé par cycle** (le client règle chaque période via le checkout existant).
- Socles réutilisables : RBAC, rôles, commission (points_ledger), `payment_mode`, media, i18n.

## 2. Architecture — 3 couches (par-dessus l'existant)

### Couche A — Profil alimentaire (client)
- Section optionnelle du profil : conditions santé (diabète, hypertension, cholestérol),
  préférences (réutilise les tags), allergies/intolérances (texte + tags), objectif
  (perte/maintien/prise de masse/équilibre), aliments interdits (texte libre).
- **Table `food_profiles`** (user_id PK, health_conditions text[], preferences text[],
  allergies text, objective text, forbidden_foods text, updated_at).
- **Usages** : pré-remplit une demande perso ; **filtre/priorise le catalogue** par tags
  (bandeau « adapté à votre profil ») ; visible du resto sur une demande.

### Couche B — Demandes personnalisées (brancher l'existant au VPS)
- **Câbler `lib/foodRequests.ts` sur les endpoints VPS existants** (double chemin
  VPS/mock comme les autres libs) — persistance réelle, plus de localStorage en prod.
- Enrichir : pré-remplissage depuis le profil alimentaire ; côté resto, page de
  soumission d'offres (`/partenaires/dashboard` → demandes de sa ville).
- **Faible effort** (le backend est déjà là).

### Couche C — Abonnements & programmes (le cœur nouveau)
- **Programmes** (publiés par un resto) : `meal_programs(id, restaurant_id, name,
  description, target_audience, dietary_tags text[], duration_weeks, meals_count,
  schedule jsonb, price_fcfa, photo_url, status[draft|published|archived], created_at)`.
  Ex. « Diabète Premium — 28 repas / 4 sem. / déjeuner quotidien / 145 000 FCFA ».
- **Souscriptions** : `subscriptions(id, customer_id, program_id, restaurant_id, status
  [active|paused|cancelled|completed], start_date, next_delivery_at, schedule jsonb,
  cycle_index, price_fcfa, created_at)` + `subscription_deliveries(id, subscription_id,
  scheduled_for, order_id, status[scheduled|delivered|skipped])`.
- **Cycle de vie** : souscrire → payer le cycle (checkout existant, prépayé) → génération
  des livraisons planifiées → chaque livraison crée une **commande** normale (réutilise
  tout le pipeline commande/livreur/commission/suivi) → pause/reprise/annulation →
  renouvellement (nouveau cycle payé).
- **Génération récurrente** : un job serveur (ou à la demande) matérialise les livraisons
  du calendrier en commandes, à J-1. Idempotent par (subscription_id, scheduled_for).
- **Commission** : la commission 15 % s'applique par commande générée (inchangé).

## 3. Rôles & accès (RBAC)
- Nouvelles permissions : `food.programs.manage` (resto/admin publient des programmes),
  `food.subscriptions.view` (admin suit les abonnements), `food.subscriptions.manage`.
- **Rôle Nutritionniste** = **hors v1** (nouvel acteur + certification = lourd). Prévu V2 ;
  la validation nutritionnelle d'un programme peut d'abord être un simple champ admin.

## 4. Parcours
- **Client** : profil alimentaire → (a) parcourt les **programmes** et souscrit, ou (b)
  publie une **demande** et compare les offres → paie le cycle → reçoit ses livraisons →
  évalue → renouvelle. Espace « Mes abonnements » (pause/reprise).
- **Restaurant** : publie des programmes, répond aux demandes, gère ses abonnés
  (calendrier, capacité), suspend/modifie.
- **Admin** : valide/modère programmes, suit les abonnements (nouvelle vue), commissions
  (via Centre Financier existant), litiges.

## 5. Modèle de données (tables dédiées, sans ALTER cœur)
`food_profiles` · `meal_programs` · `subscriptions` · `subscription_deliveries`
(+ réutilise `food_requests`/`food_bids` existants, `orders`, `points_ledger`).

## 6. Paiement (v1 réaliste)
- **Prépayé par cycle** : à la souscription et à chaque renouvellement, le client paie le
  montant du cycle via le checkout existant (cash/MoMo selon `payment_mode`). Pas
  d'auto-débit tant que la passerelle récurrente n'est pas prête (honnête).
- Coupons/réductions : réutilisent MiamPoints (fidélité) ; promo dédiée = hors périmètre.

## 7. Garde-fous
- Additif : le flux commande unique n'est pas modifié. Les livraisons d'abonnement passent
  par le **même** pipeline commande (zéro duplication de logique livreur/commission/suivi).
- Génération de livraisons **idempotente**. Statuts bornés. i18n FR/EN. Mobile-first.
- Aucune donnée de santé sensible au-delà du déclaratif (pas de dossier médical en v1).

## 8. Découpage en lots
| Lot | Livrable |
|---|---|
| FOOD-0 | **Cette spec** + validation |
| FOOD-1 | Profil alimentaire : table + lib + section profil client + filtrage catalogue |
| FOOD-2 | Demandes perso : brancher lib/foodRequests sur le VPS (double chemin) + pré-remplissage profil |
| FOOD-3 | Serveur programmes+abonnements : tables + endpoints (CRUD programmes, souscrire, pause/reprise/annuler, génération livraisons) [JALON serveur] |
| FOOD-4 | Client resto : publier/gérer des programmes + abonnés |
| FOOD-5 | Client : catalogue de programmes + souscription + « Mes abonnements » (checkout par cycle) |
| FOOD-6 | Admin : suivi des abonnements + modération programmes + RBAC |
| FOOD-7 | i18n + garde-fous + déploiement + recette E2E (souscription→livraison→commande→commission) |

## 9. Décisions à valider (avant code)
1. **Périmètre v1** : (a) Couche A+B seules (profil + demandes VPS + filtrage) — rapide,
   faible risque ; (b) A+B+C (abonnements complets) — le vrai différenciateur, gros build.
2. **Abonnements** : facturation **prépayé par cycle** (recommandé v1), confirmé ?
3. **Nutritionniste** : reporté V2 (recommandé), ou rôle simplifié dès v1 ?
4. **Programmes** : publiables par les **restaurants** (recommandé) et/ou créés par l'admin ?
