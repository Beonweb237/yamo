# Journal d'execution - Systeme de notation dynamique

Ce journal coordonne l'execution A-Z du module d'avis VPS. Il doit etre mis a jour apres chaque prompt/phase.

## Decision d'architecture

- Backend cible : VPS + Postgres + endpoints `/api/...`.
- Supabase : hors scope, ne pas reactiver.
- Source de verite avis : base de donnees VPS.
- Frontend : affiche les donnees et envoie les demandes, mais ne calcule pas les notes officielles.

## Statut global

- Etat : execution initialisee, prochaine action = Prompt 00 audit VPS/base.
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
