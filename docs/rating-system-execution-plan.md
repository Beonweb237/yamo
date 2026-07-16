# Systeme de notation dynamique - Todo list et prompts d'execution

Document de pilotage pour rendre le systeme de notation Yamo/MiamExpress complet, dynamique, enregistre en base de donnees VPS, lie aux utilisateurs de test et aux commandes de simulation livrees.

## Objectif final

Construire un module d'avis premium ou chaque note est :

- liee a une commande livree reelle ou de simulation enregistree dans la base VPS ;
- liee a un utilisateur client identifie ;
- liee au restaurant, au livreur et, si pertinent, aux plats commandes ;
- stockee en base de donnees, jamais seulement dans le front ou le localStorage ;
- prise en compte automatiquement dans les moyennes, le nombre d'avis, les details restaurant, les classements et les filtres ;
- moderee par l'admin si besoin ;
- affichee avec une UX claire, mobile-first, sans bouton factice.

## Regles non negociables

- Ne pas utiliser Supabase comme solution cible. Tout doit passer par le VPS, Postgres et les endpoints `/api/...`.
- Le front ne calcule jamais la note officielle d'un restaurant. Il affiche les agregats renvoyes par l'API.
- Un avis restaurant/livreur/plat ne peut etre publie que si la commande est `delivered`.
- Un utilisateur ne peut noter que ses propres commandes.
- Un restaurant ne peut pas s'auto-noter.
- Une commande ne peut recevoir qu'un seul avis restaurant et un seul avis livraison par client.
- Les avis de test doivent etre marques `is_test = true` et exclus du public en production, sauf mode demo explicite.
- Chaque avis public doit porter la mention UX "Commande verifiee".
- Aucune note fictive ne doit etre affichee comme verite produit.
- Les anciens scripts et docs Supabase sont historiques. Ne pas les utiliser comme modele.

## Etat actuel a respecter

- `app/src/pages/Orders.tsx` contient deja une UI de notation livraison et restaurant apres commande livree.
- `app/src/lib/catalog.ts` contient deja des fonctions historiques `rateRestaurant`, `hasRestaurantReview`, `fetchRestaurantReviews` avec fallback local/Supabase.
- `app/src/lib/drivers.ts` contient deja `rateDelivery` et des stats livreur historiques.
- `app/src/pages/RestaurantDetail.tsx` affiche deja des avis, une repartition par etoiles et un nombre d'avis.
- `app/src/pages/Restaurants.tsx` trie deja par note via `restaurant.rating`.
- `app/src/lib/supabase.ts` est neutralise et doit rester neutralise.
- Le VPS expose deja `/api/` vers le backend Node et `/api/media` pour la mediatheque.

## Definition of done

Le chantier est termine uniquement si :

- une migration SQL VPS cree les tables et index necessaires ;
- les endpoints backend de notation existent et valident les droits ;
- les commandes test livrees peuvent recevoir des avis en base ;
- `Orders.tsx` utilise l'API VPS pour publier et verifier les avis ;
- `RestaurantDetail.tsx` affiche les avis reels pagines depuis la base ;
- `Restaurants.tsx`, `Home.tsx` et les composants de recherche utilisent les agregats dynamiques ;
- les avis livraison alimentent les stats livreur ;
- l'admin peut filtrer/moderer les avis ;
- les cas loading, empty, error et success sont couverts ;
- mobile et desktop ont ete verifies ;
- `npm run lint` et `npm run build` passent ;
- aucun nouvel appel Supabase n'a ete ajoute.

## Architecture cible

### Donnees principales

Table `reviews` : source de verite de tous les avis.

Champs recommandes :

```sql
id uuid primary key,
order_id uuid not null references orders(id),
customer_id uuid not null references users(id),
restaurant_id uuid null references restaurants(id),
driver_id uuid null references users(id),
order_item_id uuid null,
target_type varchar(20) not null check (target_type in ('restaurant', 'driver', 'dish')),
target_id uuid not null,
rating smallint not null check (rating between 1 and 5),
comment text null,
tags text[] not null default '{}',
status varchar(20) not null default 'published' check (status in ('published', 'pending', 'hidden', 'flagged')),
is_verified_order boolean not null default true,
is_test boolean not null default false,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
unique(order_id, customer_id, target_type, target_id)
```

Table `review_summaries` : cache d'agregats pour eviter de recalculer partout.

```sql
target_type varchar(20) not null,
target_id uuid not null,
rating_avg numeric(3,2) not null default 0,
rating_weighted numeric(5,3) not null default 0,
review_count integer not null default 0,
rating_1_count integer not null default 0,
rating_2_count integer not null default 0,
rating_3_count integer not null default 0,
rating_4_count integer not null default 0,
rating_5_count integer not null default 0,
last_review_at timestamptz null,
updated_at timestamptz not null default now(),
primary key(target_type, target_id)
```

Table `review_replies` : reponses restaurant.

```sql
id uuid primary key,
review_id uuid not null references reviews(id),
restaurant_id uuid not null references restaurants(id),
author_id uuid not null references users(id),
message text not null,
created_at timestamptz not null default now()
```

### Score de classement premium

Ne pas trier les restaurants seulement par moyenne brute. Utiliser une note ponderee :

```txt
score = (v / (v + m)) * R + (m / (v + m)) * C
```

- `R` = moyenne du restaurant.
- `v` = nombre d'avis publies.
- `C` = moyenne globale des restaurants.
- `m` = seuil de confiance, recommande : 10 avis.

Tri recommande pour "Mieux notes" :

1. `rating_weighted DESC`
2. `review_count DESC`
3. `last_review_at DESC`

## Contrats API VPS

### Eligibilite

`GET /api/orders/:orderId/review-eligibility`

Retour :

```json
{
  "orderId": "...",
  "canReviewRestaurant": true,
  "canReviewDriver": true,
  "dishReviewTargets": [],
  "existingReviews": []
}
```

### Publier un avis

`POST /api/orders/:orderId/reviews`

Body :

```json
{
  "targetType": "restaurant",
  "rating": 5,
  "comment": "Excellent ndole, livraison propre.",
  "tags": ["bon-gout", "bien-emballe"]
}
```

Regles serveur :

- lire l'utilisateur depuis le JWT/session VPS ;
- verifier que la commande appartient au client ;
- verifier que la commande est `delivered` ;
- deriver `restaurant_id`, `driver_id`, `target_id` depuis la commande ;
- marquer `is_test` depuis l'utilisateur ou la commande ;
- inserer ou mettre a jour selon la politique produit ;
- recalculer `review_summaries` dans la meme transaction.

### Lire les avis restaurant

`GET /api/restaurants/:restaurantId/reviews?page=1&limit=10&sort=recent&includeTest=false`

Retour :

```json
{
  "items": [
    {
      "id": "...",
      "rating": 5,
      "comment": "...",
      "tags": ["bien-emballe"],
      "authorName": "Marie N.",
      "verified": true,
      "createdAt": "...",
      "reply": null
    }
  ],
  "summary": {
    "ratingAvg": 4.7,
    "ratingWeighted": 4.58,
    "reviewCount": 132,
    "breakdown": { "1": 2, "2": 3, "3": 9, "4": 44, "5": 74 }
  },
  "pagination": { "page": 1, "limit": 10, "total": 132, "pages": 14 }
}
```

### Classements

`GET /api/restaurants?sort=top-rated&includeTest=false`

Chaque restaurant doit inclure :

```json
{
  "rating": 4.7,
  "reviewCount": 132,
  "ratingWeighted": 4.58
}
```

### Admin

- `GET /api/admin/reviews?status=published&rating=1&includeTest=true`
- `PATCH /api/admin/reviews/:reviewId/moderation`
- `POST /api/restaurants/:restaurantId/reviews/:reviewId/reply`

## Todo list complete

### Phase 0 - Cadrage et audit

- [ ] Confirmer le schema actuel VPS : tables users/profiles, restaurants, orders, order_items, deliveries.
- [ ] Identifier comment le JWT/session utilisateur est valide cote VPS.
- [ ] Identifier les utilisateurs test et commandes de simulation livrees deja en base.
- [ ] Verifier le format exact des IDs : uuid ou texte.
- [ ] Lister les endpoints VPS existants qui remplacent les anciennes fonctions Supabase.
- [ ] Noter les ecarts dans `app/docs/rating-system-execution-log.md`.

### Phase 1 - Schema BD

- [ ] Creer une migration SQL VPS pour `reviews`.
- [ ] Creer une migration SQL VPS pour `review_summaries`.
- [ ] Creer une migration SQL VPS pour `review_replies`.
- [ ] Ajouter les index : order, customer, restaurant, driver, target, status, created_at.
- [ ] Ajouter une contrainte unique contre les doublons.
- [ ] Ajouter une fonction SQL ou une transaction backend pour recalculer les agregats.
- [ ] Preparer un rollback SQL.
- [ ] Tester la migration sur une base de test ou staging.

### Phase 2 - Backend VPS

- [ ] Ajouter un module backend `reviews`.
- [ ] Ajouter validation payload avec schema strict.
- [ ] Implementer `GET /api/orders/:orderId/review-eligibility`.
- [ ] Implementer `POST /api/orders/:orderId/reviews`.
- [ ] Implementer `GET /api/restaurants/:restaurantId/reviews`.
- [ ] Implementer `GET /api/restaurants/:restaurantId/rating-summary` si necessaire.
- [ ] Integrer les agregats dans `GET /api/restaurants`.
- [ ] Integrer les avis livraison dans les stats livreur.
- [ ] Ajouter endpoints admin de moderation.
- [ ] Ajouter endpoint reponse restaurant.
- [ ] Gerer erreurs 401, 403, 404, 409, 422 proprement.
- [ ] Journaliser les erreurs serveur sans exposer les secrets.

### Phase 3 - Donnees test et simulation

- [ ] Creer ou adapter un script VPS de seed d'avis test, sans Supabase.
- [ ] Lier les avis test a des commandes test `delivered` existantes.
- [ ] Marquer `is_test = true`.
- [ ] Generer au moins 20 avis restaurants sur plusieurs restaurants.
- [ ] Generer au moins 8 avis livreurs.
- [ ] Ajouter des commentaires realistes, courts et utiles.
- [ ] Ajouter des notes variees pour tester le classement.
- [ ] Verifier que les avis test apparaissent uniquement si `includeTest=true` ou en environnement demo.

### Phase 4 - Client API frontend

- [ ] Creer `app/src/lib/reviews.ts`.
- [ ] Centraliser les types `Review`, `ReviewSummary`, `ReviewEligibility`.
- [ ] Ajouter `fetchReviewEligibility(orderId)`.
- [ ] Ajouter `submitOrderReview(orderId, payload)`.
- [ ] Ajouter `fetchRestaurantReviews(restaurantId, params)`.
- [ ] Ajouter `fetchRestaurantRatingSummary(restaurantId)` si endpoint separe.
- [ ] Gerer le fallback mock seulement en dev et clairement separe.
- [ ] Retirer ou deprecier les anciennes fonctions de notation dans `catalog.ts` et `drivers.ts`.

### Phase 5 - UX commandes

- [ ] Remplacer la double notation actuelle de `Orders.tsx` par un composant propre `OrderReviewPrompt`.
- [ ] Afficher le bloc uniquement pour les commandes `delivered` eligibles.
- [ ] Ajouter etoiles accessibles au clavier.
- [ ] Ajouter tags rapides restaurant : bon-gout, bien-emballe, portion-genereuse, prix-correct, retard, plat-froid, erreur-commande.
- [ ] Ajouter tags livraison : livreur-poli, rapide, colis-propre, retard, difficile-a-joindre.
- [ ] Limiter/commenter proprement : commentaire optionnel, compteur de caracteres, longueur max 500.
- [ ] Afficher loading pendant publication.
- [ ] Afficher success toast et etat "Avis publie".
- [ ] Afficher erreurs explicites : non connecte, commande non livree, deja notee, reseau.
- [ ] Permettre modification pendant une fenetre definie si le produit le veut, sinon bloquer clairement.

### Phase 6 - UX restaurant public

- [ ] Brancher `RestaurantDetail.tsx` sur les avis VPS.
- [ ] Afficher moyenne dynamique, nombre d'avis et repartition 5/4/3/2/1.
- [ ] Afficher badge "Commande verifiee".
- [ ] Ajouter tri : recents, meilleures notes, notes basses.
- [ ] Ajouter pagination ou bouton "Voir plus".
- [ ] Afficher reponse restaurant quand disponible.
- [ ] Prevoir empty state : aucun avis verifie.
- [ ] Prevoir loading skeleton.
- [ ] Prevoir error state avec retry.

### Phase 7 - Classements et recherche

- [ ] Modifier `fetchRestaurants`/API restaurants pour retourner `rating`, `reviewCount`, `ratingWeighted` depuis `review_summaries`.
- [ ] Adapter `Restaurants.tsx` : tri "Mieux notes" sur `ratingWeighted`.
- [ ] Adapter les filtres par note pour utiliser les vrais agregats.
- [ ] Adapter `Home.tsx` pour les restaurants populaires/mieux notes.
- [ ] Adapter `DishResults.tsx` si les groupes de plats utilisent `restaurantRating`.
- [ ] Verifier que les restaurants sans avis ont un affichage honnete : "Nouveau" ou "Aucun avis".

### Phase 8 - Admin et restaurant dashboard

- [ ] Creer `AdminReviews.tsx` ou ajouter une section avis dans l'admin.
- [ ] Ajouter filtres : statut, note, restaurant, client, test/prod, date.
- [ ] Ajouter action masquer/publier/signaler.
- [ ] Ajouter detail avis avec commande liee.
- [ ] Ajouter reponse restaurant depuis dashboard restaurant ou admin.
- [ ] Ajouter indicateurs : note moyenne, avis recents, notes basses a traiter.

### Phase 9 - Qualite et verification

- [ ] Tester creation avis restaurant avec commande livree.
- [ ] Tester refus avis si commande non livree.
- [ ] Tester refus avis sur commande d'un autre client.
- [ ] Tester doublon avis.
- [ ] Tester classement apres plusieurs avis.
- [ ] Tester moderation admin.
- [ ] Tester affichage mobile 360px.
- [ ] Tester desktop.
- [ ] Verifier console navigateur.
- [ ] Executer `npm run lint`.
- [ ] Executer `npm run build`.
- [ ] Documenter les tests dans `app/docs/rating-system-execution-log.md`.

### Phase 10 - Deploiement VPS

- [ ] Sauvegarder la base avant migration.
- [ ] Appliquer migration en staging ou base test.
- [ ] Lancer backend VPS avec les nouveaux endpoints.
- [ ] Verifier Nginx `/api/`.
- [ ] Deployer front build.
- [ ] Tester en production avec utilisateur test.
- [ ] Verifier logs backend.
- [ ] Verifier qu'aucune erreur console n'apparait.
- [ ] Prevoir rollback migration + rollback build.

## Prompts parfaits pour execution A-Z

Utiliser ces prompts dans l'ordre. Ne pas passer au prompt suivant tant que les criteres d'acceptation du prompt courant ne sont pas valides.

### Prompt 00 - Audit VPS et base actuelle

```txt
Tu es Codex sur le projet Yamo/MiamExpress. Objectif : auditer le backend VPS et la base actuelle pour preparer le module d'avis dynamique.

Regles : ne pas utiliser Supabase, ne pas creer de code encore, ne pas modifier les fichiers sans besoin. Lire CLAUDE.md d'abord.

Actions :
1. Inspecte `app/server/`, `app/src/lib/`, `app/src/pages/Orders.tsx`, `app/src/pages/RestaurantDetail.tsx`, `app/src/pages/Restaurants.tsx`.
2. Identifie les endpoints VPS existants, le systeme d'auth, les tables probables et les donnees test.
3. Liste les fonctions historiques de notation a remplacer.
4. Cree ou mets a jour `app/docs/rating-system-execution-log.md` avec l'audit.

Critere de validation : le log explique clairement ce qui existe, ce qui manque, et confirme que Supabase reste hors scope.
```

### Prompt 01 - Schema SQL et migration

```txt
En te basant sur `app/docs/rating-system-execution-plan.md` et le log d'audit, cree la migration SQL VPS du module d'avis.

Regles : Postgres VPS uniquement. Ne pas toucher au front. Prevoir rollback. Les avis doivent etre lies aux commandes livrees, clients, restaurants, livreurs et plats si possible.

Livrables :
1. Migration SQL `reviews`, `review_summaries`, `review_replies`.
2. Index et contraintes anti-doublons.
3. Fonction ou strategie de recalcul des agregats.
4. Rollback SQL.
5. Documentation courte dans le log.

Critere de validation : le schema permet avis restaurant, livreur, plat, moderation, avis test, classement pondere.
```

### Prompt 02 - Backend API reviews

```txt
Implemente le module backend VPS des avis.

Regles : endpoints `/api/...`, validation serveur stricte, aucune confiance dans le payload client, aucune integration Supabase.

Endpoints minimum :
- GET /api/orders/:orderId/review-eligibility
- POST /api/orders/:orderId/reviews
- GET /api/restaurants/:restaurantId/reviews
- GET /api/restaurants/:restaurantId/rating-summary

Contraintes :
- verifier l'utilisateur connecte ;
- commande livree obligatoire ;
- commande appartenant au client ;
- deduire restaurant/livreur/plats depuis la commande ;
- transaction pour insert review + recalcul summary ;
- erreurs propres 401/403/404/409/422.

Critere de validation : les endpoints fonctionnent avec commandes test livrees et refusent les cas interdits.
```

### Prompt 03 - Backend classements et stats

```txt
Integre les agregats d'avis dans les endpoints existants du VPS.

Objectif : les restaurants doivent retourner `rating`, `reviewCount`, `ratingWeighted`, `ratingBreakdown` si utile.

Actions :
1. Adapter GET /api/restaurants pour inclure les agregats.
2. Adapter le tri `sort=top-rated` avec score pondere.
3. Adapter les stats livreur pour utiliser les avis `target_type=driver`.
4. Documenter les changements API.

Critere de validation : un restaurant mieux note avec beaucoup d'avis passe devant un restaurant avec 1 seul avis a 5 etoiles.
```

### Prompt 04 - Seed donnees test VPS

```txt
Cree un script de seed VPS pour generer des avis test lies aux commandes de simulation deja livrees.

Regles : ne pas utiliser les scripts Supabase. Ne pas creer d'avis orphelin. Marquer `is_test=true`.

Actions :
1. Trouver les commandes test livrees.
2. Generer avis restaurant, livreur et quelques avis plats.
3. Varier notes, tags et commentaires.
4. Recalculer les summaries.
5. Documenter comment lancer et comment rollback.

Critere de validation : les avis test apparaissent dans l'API avec `includeTest=true` et restent exclus du public si `includeTest=false`.
```

### Prompt 05 - Client API reviews

```txt
Cree le client frontend `app/src/lib/reviews.ts` pour consommer le module avis VPS.

Regles : routes relatives `/api/...`, types TypeScript propres, pas d'appel Supabase, pas de calcul officiel de note cote front.

Fonctions :
- fetchReviewEligibility(orderId)
- submitOrderReview(orderId, payload)
- fetchRestaurantReviews(restaurantId, params)
- fetchRestaurantRatingSummary(restaurantId)
- fetchAdminReviews(params) si l'admin est dans ce lot

Critere de validation : les fonctions gerent success, erreurs HTTP et types de retour sans casser le build.
```

### Prompt 06 - UX notation commande

```txt
Refonds la notation dans `Orders.tsx` avec un composant `OrderReviewPrompt`.

Regles UX : mobile-first, compact, accessible clavier, feedback clair, pas de bouton factice.

Actions :
1. Afficher la notation uniquement si `review-eligibility` autorise.
2. Permettre note restaurant et note livraison separees.
3. Ajouter tags rapides.
4. Ajouter commentaire optionnel limite a 500 caracteres.
5. Gerer loading, success, error, deja note.
6. Mettre a jour l'etat sans refresh brutal.

Critere de validation : un client test peut noter une commande livree et voit immediatement l'etat "Avis publie".
```

### Prompt 07 - UX avis restaurant public

```txt
Branche `RestaurantDetail.tsx` sur les avis VPS.

Actions :
1. Charger summary + liste paginee.
2. Afficher moyenne, nombre d'avis, repartition etoiles.
3. Afficher badge "Commande verifiee".
4. Ajouter tri recents/meilleures notes/notes basses.
5. Gerer loading, empty, error, retry.
6. Afficher les reponses restaurant si presentes.

Critere de validation : les avis publies depuis `Orders.tsx` apparaissent sur la fiche restaurant sans donnees fictives.
```

### Prompt 08 - Classements frontend

```txt
Branche les ecrans de listing sur les notes dynamiques.

Fichiers cibles :
- app/src/pages/Restaurants.tsx
- app/src/pages/Home.tsx
- app/src/components/DishResults.tsx si necessaire

Actions :
1. Utiliser `ratingWeighted` pour le tri mieux notes.
2. Utiliser `reviewCount` reel.
3. Afficher "Aucun avis" ou "Nouveau" si pas d'avis.
4. Eviter les notes mock comme verite produit.
5. Tester filtres par note.

Critere de validation : le classement change apres insertion d'avis en base.
```

### Prompt 09 - Admin moderation

```txt
Ajoute une interface admin pour moderer les avis.

Actions :
1. Creer `AdminReviews.tsx` ou section equivalente.
2. Ajouter route admin si necessaire.
3. Filtres : statut, note, restaurant, client, date, test/prod.
4. Actions : masquer, republier, signaler, voir commande liee.
5. Etat loading/empty/error.

Critere de validation : un admin peut masquer un avis et il disparait des listes publiques tout en restant en base.
```

### Prompt 10 - Reponse restaurant

```txt
Ajoute la possibilite pour un restaurant de repondre a un avis.

Regles : une seule reponse officielle par avis au depart, texte court, ton professionnel.

Actions :
1. Endpoint backend de reponse.
2. UI dans dashboard restaurant ou admin.
3. Affichage public sous l'avis.
4. Validation droits : seul le restaurant concerne ou admin peut repondre.

Critere de validation : la reponse apparait sous l'avis avec une presentation sobre et lisible.
```

### Prompt 11 - Nettoyage dette historique

```txt
Nettoie les anciennes branches de notation historiques qui parlent encore Supabase ou localStorage comme source principale.

Regles : ne pas casser le mode developpement, mais le VPS doit etre la source de verite.

Actions :
1. Remplacer `rateRestaurant`, `hasRestaurantReview`, `fetchRestaurantReviews` historiques par wrappers vers `lib/reviews.ts` ou les deprecier proprement.
2. Remplacer `rateDelivery` si necessaire.
3. Retirer les imports inutiles.
4. Verifier qu'aucune nouvelle integration Supabase n'existe.

Critere de validation : `rg "supabase|Supabase" app/src/lib app/src/pages` ne montre aucune nouvelle dependance active liee aux avis.
```

### Prompt 12 - QA finale premium

```txt
Fais la validation finale complete du module d'avis.

Scenarios obligatoires :
1. Client test avec commande livree publie un avis restaurant.
2. Client test publie un avis livreur.
3. Commande non livree refusee.
4. Commande d'un autre client refusee.
5. Doublon gere proprement.
6. Avis visible sur RestaurantDetail.
7. Classement mieux notes mis a jour.
8. Admin masque un avis.
9. Mobile 360px sans debordement.
10. Desktop propre.

Commandes :
- npm run lint
- npm run build

Livrable : mettre a jour `app/docs/rating-system-execution-log.md` avec resultats, bugs restants, captures si disponibles, et conclusion go/no-go.
```

## Coordination A-Z

Ordre de pilotage recommande :

1. Prompt 00 : audit obligatoire.
2. Prompt 01 : schema et migration.
3. Prompt 02 : API creation/lecture avis.
4. Prompt 03 : agregats et classements backend.
5. Prompt 04 : donnees test.
6. Prompt 05 : client API front.
7. Prompt 06 : notation dans commandes.
8. Prompt 07 : affichage fiche restaurant.
9. Prompt 08 : classements front.
10. Prompt 09 : moderation admin.
11. Prompt 10 : reponse restaurant.
12. Prompt 11 : nettoyage dette historique.
13. Prompt 12 : QA finale.

A chaque etape :

- lire `CLAUDE.md` ;
- verifier qu'aucune solution Supabase n'est ajoutee ;
- mettre a jour `app/docs/rating-system-execution-log.md` ;
- ne pas passer a l'etape suivante si les criteres d'acceptation ne sont pas remplis ;
- executer `npm run lint` et `npm run build` apres les changements applicatifs importants ;
- signaler les verifications impossibles au lieu de les inventer.

## Risques et parades

- Risque : doublons d'avis. Parade : contrainte unique + endpoint idempotent ou erreur 409 claire.
- Risque : faux avis. Parade : commande livree obligatoire et verification utilisateur serveur.
- Risque : classement injuste. Parade : score pondere, pas moyenne brute seule.
- Risque : avis test visibles en production. Parade : `is_test` + `includeTest=false` par defaut.
- Risque : front incoherent apres publication. Parade : retourner summary a jour apres POST.
- Risque : performance. Parade : `review_summaries` + pagination.
- Risque : moderation abusive ou suppression definitive. Parade : statut `hidden`, pas delete physique.

## Checklist de livraison impeccable

- [ ] Source de verite VPS confirmee.
- [ ] Migration appliquee et rollback pret.
- [ ] APIs securisees.
- [ ] Avis test lies a de vraies commandes test livrees.
- [ ] UX mobile et desktop validee.
- [ ] Classements dynamiques.
- [ ] Admin moderation operationnelle.
- [ ] Aucun bouton sans action.
- [ ] Aucun avis fictif presente comme reel.
- [ ] Aucun nouvel appel Supabase.
- [ ] Lint OK.
- [ ] Build OK.
- [ ] Log d'execution rempli.
