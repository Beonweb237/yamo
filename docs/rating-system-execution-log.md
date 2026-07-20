# Journal d'execution - Systeme de notation dynamique

Ce journal coordonne l'execution A-Z du module d'avis VPS. Il doit etre mis a jour apres chaque prompt/phase.

## Decision d'architecture

- Backend cible : VPS + Postgres + endpoints `/api/...`.
- Supabase : hors scope, ne pas reactiver.
- Source de verite avis : base de donnees VPS.
- Frontend : affiche les donnees et envoie les demandes, mais ne calcule pas les notes officielles.

## Statut global

- Etat : frontend integre + routes backend Express branchees localement + seed avis VPS/Postgres cree.
- Derniere mise a jour : 2026-07-16.
- Plan de reference : @app/docs/rating-system-execution-plan.md

## Suivi des phases

| Phase | Statut | Responsable | Resultat attendu | Notes |
|---|---|---|---|---|
| 00 Audit VPS et base actuelle | En cours | Codex/Claude | Etat backend, tables, auth, endpoints | Audit local initialise, audit DB VPS restant |
| 01 Schema SQL et migration | A faire | Codex/Claude | Migration + rollback | Dependance : Phase 00 |
| 02 Backend API reviews | A faire | Codex/Claude | Endpoints de notation | Dependance : Phase 01 |
| 03 Agregats et classements backend | A faire | Codex/Claude | Rating dynamique + tri pondere | Dependance : Phase 02 |
| 04 Donnees test VPS | A faire | Codex/Claude | Avis test lies aux commandes livrees | Dependance : Phase 02 |
| 05 Client API frontend | A faire | Codex/Claude | `app/src/lib/reviews.ts` | Dependance : contrats API |
| 06 UX notation commande | A faire | Codex/Claude | Notation dans `Orders.tsx` | Dependance : Phase 05 |
| 07 UX avis restaurant public | A faire | Codex/Claude | Avis reels dans `RestaurantDetail.tsx` | Dependance : Phase 05 |
| 08 Classements frontend | A faire | Codex/Claude | Tri mieux notes dynamique | Dependance : Phase 03 |
| 09 Admin moderation | A faire | Codex/Claude | Interface de moderation | Dependance : endpoints admin |
| 10 Reponse restaurant | A faire | Codex/Claude | Reponses officielles | Dependance : Phase 09 ou backend replies |
| 11 Nettoyage dette historique | A faire | Codex/Claude | Anciennes branches depreciees | Apres branchement VPS |
| 12 QA finale premium | A faire | Codex/Claude | Lint/build/scenarios OK | Derniere phase |

## Resultats d'audit local initial

Constats confirmes depuis le code local :

- `CLAUDE.md` indique maintenant que Supabase est hors scope et que le VPS est la cible.
- `app/src/lib/supabase.ts` est neutralise (`isSupabaseConfigured = false`, `supabase = null`).
- `app/src/pages/Orders.tsx` contient deja deux blocs de notation apres commande livree : livraison et restaurant.
- `app/src/lib/catalog.ts` contient des fonctions historiques `rateRestaurant`, `fetchRestaurantReviews`, `hasRestaurantReview` a remplacer par un client VPS.
- `app/src/lib/drivers.ts` contient `rateDelivery` et des stats historiques a brancher sur `reviews`/VPS.
- `app/src/pages/RestaurantDetail.tsx` affiche deja une zone avis et une repartition par etoiles.
- `app/src/pages/Restaurants.tsx` trie deja par `rating`, mais devra passer sur un score pondere dynamique.
- `app/server/miamexpress-nginx.conf` proxyfie `/api/` vers `127.0.0.1:3002` et `/api/media` vers `127.0.0.1:3003/api/media`.
- Le dossier backend local visible contient surtout la mediatheque. L'audit de l'API metier VPS et de la base Postgres reste a faire avant migration.

A confirmer pendant le Prompt 00 :

- schema reel des tables VPS ;
- nom exact de la table utilisateurs (`users`, `profiles`, autre) ;
- structure des commandes et lignes de commande ;
- presence/format des commandes de simulation livrees ;
- mecanisme auth/JWT cote VPS ;
- endpoints metier deja deployes sur le service `127.0.0.1:3002`.

## Decisions prises

- Un document de pilotage complet a ete cree : @app/docs/rating-system-execution-plan.md
- Le module d'avis doit utiliser une table source `reviews` et un cache `review_summaries`.
- Les classements doivent utiliser `rating_weighted`, pas seulement la moyenne brute.
- Les avis test doivent etre marques `is_test=true` et exclus du public par defaut.

## Bugs et risques ouverts

- Le code frontend contient encore plusieurs branches historiques Supabase/localStorage dans `catalog.ts` et `drivers.ts`.
- Le backend metier VPS n'est pas totalement present dans ce workspace local ; il faudra auditer le VPS ou recuperer son code avant implementation complete.
- Les schemas SQL proposes doivent etre ajustes aux noms reels de tables et types d'IDs apres audit.

## Verifications finales

- [ ] Commande livree notee par son client.
- [ ] Commande non livree refusee.
- [ ] Doublon gere.
- [ ] Avis visible sur fiche restaurant.
- [ ] Classement mieux notes mis a jour.
- [ ] Avis test exclus du public par defaut.
- [ ] Moderation admin fonctionnelle.
- [ ] Mobile 360px valide.
- [ ] Desktop valide.
- [ ] Console navigateur sans erreur.
- [ ] `npm run lint` OK.
- [ ] `npm run build` OK.

## Mise a jour d'execution - 2026-07-16

Livres dans ce workspace :

- Creation du client unifie `app/src/lib/reviews.ts` : validation commande livree, anti-doublon, avis restaurant/livraison/plat, agregats, score pondere, moderation, fallback local uniquement hors mode VPS.
- Raccordement `app/src/lib/catalog.ts` : enrichissement des restaurants avec notes dynamiques et wrappers compatibles `rateRestaurant`, `fetchRestaurantReviews`, `hasRestaurantReview`.
- Raccordement `app/src/pages/Orders.tsx` : notation livraison + restaurant apres livraison, tags, commentaire limite a 500 caracteres, etats d'envoi, toasts, verification des avis deja soumis.
- Raccordement `app/src/pages/RestaurantDetail.tsx` : note moyenne dynamique, nombre d'avis dynamique, repartition 5 a 1 etoiles, tags et avis verifies.
- Raccordement `app/src/pages/Restaurants.tsx` et `app/src/pages/Home.tsx` : classement par `ratingWeighted` quand disponible, affichage public par moyenne.
- Creation du back-office `app/src/pages/admin/AdminReviews.tsx`, route `/admin/reviews` et entree sidebar `Avis`.
- Creation de la migration Postgres VPS `app/server/migrations/20260716_reviews.sql`.
- Creation du contrat API `app/docs/reviews-api-contract.md`.

Points restants dependants du backend VPS reel :

- Implementer les endpoints `/api/reviews`, `/api/restaurants/:id/reviews`, `/api/reviews/summaries`, `/api/admin/reviews` dans le service metier expose par Nginx sur `127.0.0.1:3002`.
- Appliquer la migration sur la base VPS apres verification des tables `orders`, `restaurants`, `users` et du mecanisme auth.
- Brancher les stats livreur officielles sur `reviews` ou adapter `drivers.ts` apres disponibilite de l'API.
- Ajouter les reponses officielles restaurant aux avis si le backend ajoute `review_replies`.

Statut des phases apres cette execution :

| Phase | Statut actuel |
|---|---|
| 00 Audit | Audit local fait ; audit VPS reel restant |
| 01 Schema SQL | Fait localement via migration portable |
| 02 Backend API | Fait localement dans Express ; deploiement VPS restant |
| 03 Agregats/classements | Fait cote frontend/local ; vue SQL fournie |
| 05 Client API frontend | Fait |
| 06 UX notation commande | Fait |
| 07 UX avis restaurant | Fait |
| 08 Classements frontend | Fait |
| 09 Admin moderation | Fait cote frontend + endpoints admin Express ; deploiement VPS restant |
| 10 Reponse restaurant | Non fait, necessite backend replies |
| 12 QA finale | En cours apres build/lint |
## Verification technique - 2026-07-16

- `npm run build` : OK apres execution hors sandbox Windows. TypeScript et Vite passent. Avertissements restants : chunk size et import dynamique/statique du fichier historique `supabase.ts`.
- `npm run lint` global : KO sur dette preexistante du projet (84 erreurs, documentees dans CLAUDE.md : `ui/*`, `AdminMedia`, `AddressAutocomplete`, etc.).
- Lint cible nouveau systeme : OK pour `src/lib/reviews.ts`, `src/pages/admin/AdminReviews.tsx`, `src/pages/Orders.tsx`, `src/pages/RestaurantDetail.tsx`.
- Verification Supabase sur le lot avis : aucune integration Supabase ajoutee ; seules mentions restantes = documentation indiquant que Supabase est hors scope.
- Serveur local Vite : lance sur `http://127.0.0.1:3000/`.
## Mise a jour seed BD avis - 2026-07-16

Livres dans ce workspace :

- Branchement backend Express des routes avis via `app/server/src/reviews-routes.js` et `registerReviewRoutes(...)` avant les routes generiques `/api/:table`.
- Creation du seed officiel `app/scripts/seed-review-examples.mjs` et de la commande `npm run seed:reviews`.
- Le seed lit uniquement des commandes `orders.status = 'delivered'` deja presentes en base, cree des avis restaurant/livreur/plat quand les donnees existent, et evite les doublons.
- Par defaut, les exemples sont `is_test=false` pour etre visibles dans les fiches restaurant et les classements. Option `--test` disponible pour des avis internes non publics.
- La vue `review_summaries` de la migration portable exclut maintenant `is_test=true` du classement public.
- Le backend charge maintenant `app/server/.env.server` puis `app/.env.server` sans afficher les secrets.

Commande de verification/seed depuis `app/` :

```bash
npm run seed:reviews
```

Preconditions : la migration `app/server/migrations/20260716_reviews.sql` doit etre appliquee sur la base VPS et au moins une commande de simulation doit etre en statut `delivered`.