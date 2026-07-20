# Contrat API VPS - Avis et notation

Supabase ne fait pas partie de ce flux. Le frontend appelle le VPS via `/api/...` quand `VITE_USE_VPS_API=true`; sinon il utilise le fallback localStorage de developpement.

## Tables

- Migration cible : `server/migrations/20260716_reviews.sql`
- Table principale : `reviews`
- Vue agregee : `review_summaries`

## Endpoints publics authentifies

### `GET /api/reviews/eligibility?orderId=:orderId`

Retourne si la commande livree peut encore recevoir un avis.

```json
{
  "data": {
    "orderId": "order-id",
    "canReviewRestaurant": true,
    "canReviewDriver": true,
    "canReviewDishes": true,
    "reasons": [],
    "existingReviews": []
  }
}
```

### `POST /api/reviews`

Body :

```json
{
  "orderId": "order-id",
  "targetType": "restaurant",
  "targetId": "restaurant-id",
  "rating": 5,
  "comment": "Excellent repas.",
  "tags": ["Tres bon", "Bien emballe"],
  "authorName": "Marie N."
}
```

Regles serveur obligatoires :

- utilisateur authentifie requis ;
- la commande doit exister ;
- la commande doit etre `delivered` ;
- `customerId` de la session doit correspondre a `orders.customer_id` ;
- un seul avis par commande et par cible ;
- note entiere entre 1 et 5 ;
- commentaire tronque/refuse au-dela de 500 caracteres ;
- `restaurant` force `targetId = orders.restaurant_id` cote serveur ;
- reponse 409 si l'avis existe deja.

### `GET /api/restaurants/:restaurantId/reviews?limit=10`

Retourne uniquement les avis publies du restaurant, tries par `created_at DESC`.

### `GET /api/restaurants/:restaurantId/reviews/summary`

Retourne la moyenne, le score pondere, le volume et la repartition 1 a 5 etoiles depuis `review_summaries`.

### `GET /api/reviews/summaries?targetType=restaurant&targetIds=1,2,3`

Endpoint bulk pour eviter N appels sur la page liste restaurants.

## Endpoints admin

### `GET /api/admin/reviews`

Filtres optionnels : `targetType`, `status`, `q`.

### `PATCH /api/admin/reviews/:reviewId`

Body :

```json
{
  "status": "hidden",
  "moderationReason": "Masque par moderation admin."
}
```

Statuts acceptes : `published`, `pending`, `hidden`.

## UX attendue

- Ne jamais afficher le bouton d'avis avant livraison.
- Ne jamais permettre deux avis restaurant sur la meme commande.
- Toujours afficher la preuve "Commande verifiee" pour les avis issus du flux commande.
- Les notes de classement utilisent `ratingWeighted`; l'affichage public utilise `ratingAvg`.
- En production VPS, ne jamais simuler une sauvegarde locale si l'API echoue.
