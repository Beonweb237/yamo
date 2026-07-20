const REVIEW_TARGETS = new Set(['restaurant', 'driver', 'dish']);
const REVIEW_STATUSES = new Set(['published', 'pending', 'hidden']);
const PRIOR_AVERAGE = 4.2;
const PRIOR_WEIGHT = 8;
const MAX_COMMENT_LENGTH = 500;
const MAX_TAGS = 6;
const MAX_TAG_LENGTH = 40;

function userId(req) {
  return String(req.user?.sub ?? req.user?.id ?? '');
}

function asText(value) {
  return value === null || value === undefined ? '' : String(value);
}

function limitFromQuery(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(50, Math.round(parsed)));
}

function cleanRating(value) {
  const rating = Math.round(Number(value));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('rating doit etre compris entre 1 et 5');
  }
  return rating;
}

function cleanComment(value) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, MAX_COMMENT_LENGTH) : null;
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  const clean = tags
    .map((tag) => String(tag ?? '').trim())
    .filter(Boolean)
    .map((tag) => tag.slice(0, MAX_TAG_LENGTH));
  return [...new Set(clean)].slice(0, MAX_TAGS);
}

function includeTestReviews(req) {
  return process.env.REVIEWS_INCLUDE_TEST_PUBLIC === 'true' && req.query.includeTest === 'true';
}

// Identité affichée d'un avis : TOUJOURS dérivée du profil client lié, jamais
// une chaîne saisie/fabriquée (règle produit : aucune identité affichée sans
// profil réel). "Jean Test" -> "Jean T." ; vide/NULL -> null (front affiche
// "Client vérifié").
function anonymizeName(fullName) {
  const s = String(fullName ?? '').trim();
  if (!s) return null;
  const parts = s.split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1][0].toUpperCase()}.` : parts[0];
}

async function derivedAuthorName(pool, userIdValue) {
  const { rows } = await pool.query('SELECT full_name FROM users WHERE id = $1 LIMIT 1', [userIdValue]);
  return anonymizeName(rows[0]?.full_name);
}

async function loadOrder(pool, orderId) {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id::text = $1 LIMIT 1', [String(orderId)]);
  return rows[0] ?? null;
}

function assertOwnDeliveredOrder(order, req) {
  if (!order) {
    const err = new Error('Commande introuvable');
    err.status = 404;
    throw err;
  }
  if (asText(order.customer_id) !== userId(req)) {
    const err = new Error('Cette commande ne vous appartient pas');
    err.status = 403;
    throw err;
  }
  if (order.status !== 'delivered') {
    const err = new Error('Seules les commandes livrees peuvent etre notees');
    err.status = 400;
    throw err;
  }
}

function buildTarget(order, input) {
  const targetType = String(input.targetType ?? '');
  if (!REVIEW_TARGETS.has(targetType)) {
    const err = new Error('targetType invalide');
    err.status = 400;
    throw err;
  }

  if (targetType === 'restaurant') {
    return { targetType, targetId: asText(order.restaurant_id), dishId: null, driverId: null };
  }

  if (targetType === 'driver') {
    const driverId = asText(input.targetId || order.driver_id);
    if (!driverId) {
      const err = new Error('targetId livreur requis');
      err.status = 400;
      throw err;
    }
    return { targetType, targetId: driverId, dishId: null, driverId };
  }

  const dishId = asText(input.dishId || input.targetId);
  if (!dishId) {
    const err = new Error('dishId requis');
    err.status = 400;
    throw err;
  }
  return { targetType, targetId: dishId, dishId, driverId: null };
}

async function syncRestaurantRatingColumns(pool, restaurantId) {
  if (!restaurantId) return;
  await pool.query(
    `UPDATE restaurants r
     SET rating = COALESCE(s.rating_avg, 0),
         review_count = COALESCE(s.review_count, 0)
     FROM (SELECT $1::text AS restaurant_id) target
     LEFT JOIN review_summaries s
       ON s.target_type = 'restaurant'
      AND s.target_id = target.restaurant_id
     WHERE r.id::text = target.restaurant_id`,
    [String(restaurantId)]
  );
}
function defaultSummary(restaurantId) {
  return {
    target_type: 'restaurant',
    target_id: restaurantId,
    rating_avg: 0,
    rating_weighted: 0,
    review_count: 0,
    published_count: 0,
    verified_count: 0,
    breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    updated_at: null,
  };
}

function mapRows(rows, fromSnake) {
  return typeof fromSnake === 'function' ? rows.map(fromSnake) : rows;
}

function handleReviewError(res, err) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.code === '23505') return res.status(409).json({ error: 'Avis deja soumis' });
  if (err.code === '23503') return res.status(400).json({ error: 'Reference invalide' });
  if (String(err.message).includes('ORDER_NOT_DELIVERED')) {
    return res.status(400).json({ error: 'Seules les commandes livrees peuvent etre notees' });
  }
  if (String(err.message).includes('REVIEW_CUSTOMER_MISMATCH')) {
    return res.status(403).json({ error: 'Cette commande ne vous appartient pas' });
  }
  if (String(err.message).includes('ORDER_NOT_FOUND')) {
    return res.status(404).json({ error: 'Commande introuvable' });
  }
  return res.status(500).json({ error: err.message });
}

export function registerReviewRoutes(app, { pool, authRequired, adminRequired, adminPermissionRequired, fromSnake }) {
  app.get('/api/reviews/eligibility', authRequired, async (req, res) => {
    try {
      const { orderId } = req.query;
      if (!orderId) return res.status(400).json({ error: 'orderId requis' });

      const order = await loadOrder(pool, orderId);
      assertOwnDeliveredOrder(order, req);

      const { rows: existingReviews } = await pool.query(
        `SELECT * FROM reviews
         WHERE order_id::text = $1 AND customer_id::text = $2
         ORDER BY created_at DESC`,
        [String(orderId), userId(req)]
      );

      res.json({
        data: {
          orderId: String(orderId),
          canReviewRestaurant: !existingReviews.some((r) => r.target_type === 'restaurant'),
          canReviewDriver: Boolean(order.driver_id) && !existingReviews.some((r) => r.target_type === 'driver'),
          canReviewDishes: true,
          reasons: [],
          existingReviews: mapRows(existingReviews, fromSnake),
        },
      });
    } catch (err) {
      if (err.status === 400 && err.message.includes('livrees')) {
        return res.status(400).json({
          error: err.message,
          data: {
            orderId: String(req.query.orderId ?? ''),
            canReviewRestaurant: false,
            canReviewDriver: false,
            canReviewDishes: false,
            reasons: [err.message],
            existingReviews: [],
          },
        });
      }
      return handleReviewError(res, err);
    }
  });

  app.post('/api/reviews', authRequired, async (req, res) => {
    try {
      const { orderId } = req.body ?? {};
      if (!orderId) return res.status(400).json({ error: 'orderId requis' });

      const order = await loadOrder(pool, orderId);
      assertOwnDeliveredOrder(order, req);
      const target = buildTarget(order, req.body ?? {});

      const rating = cleanRating(req.body.rating);
      const comment = cleanComment(req.body.comment);
      const tags = cleanTags(req.body.tags);
      // On IGNORE req.body.authorName : l'identité vient du profil lié (customer_id),
      // pas d'une saisie client — impossible d'injecter un nom fabriqué.
      const authorName = await derivedAuthorName(pool, userId(req));

      const { rows } = await pool.query(
        `INSERT INTO reviews (
          order_id, customer_id, restaurant_id, target_type, target_id,
          driver_id, dish_id, rating, comment, tags, author_name,
          is_verified_order, is_test, status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,false,'published')
        RETURNING *`,
        [
          asText(order.id),
          userId(req),
          asText(order.restaurant_id),
          target.targetType,
          target.targetId,
          target.driverId,
          target.dishId,
          rating,
          comment,
          tags,
          authorName,
        ]
      );

      if (target.targetType === 'restaurant') await syncRestaurantRatingColumns(pool, order.restaurant_id);
      res.status(201).json({ data: typeof fromSnake === 'function' ? fromSnake(rows[0]) : rows[0] });
    } catch (err) {
      return handleReviewError(res, err);
    }
  });

  app.get('/api/restaurants/:restaurantId/reviews', async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const limit = limitFromQuery(req.query.limit);
      const includeTests = includeTestReviews(req);
      const { rows } = await pool.query(
        `SELECT * FROM reviews
         WHERE restaurant_id::text = $1
           AND target_type = 'restaurant'
           AND status = 'published'
           AND ($3::boolean = true OR is_test = false)
         ORDER BY created_at DESC
         LIMIT $2`,
        [restaurantId, limit, includeTests]
      );
      res.json({ data: mapRows(rows, fromSnake) });
    } catch (err) {
      return handleReviewError(res, err);
    }
  });

  app.get('/api/restaurants/:restaurantId/reviews/summary', async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const { rows } = await pool.query(
        `SELECT * FROM review_summaries
         WHERE target_type = 'restaurant' AND target_id::text = $1
         LIMIT 1`,
        [restaurantId]
      );
      res.json({ data: rows[0] ?? defaultSummary(restaurantId) });
    } catch (err) {
      return handleReviewError(res, err);
    }
  });

  app.get('/api/reviews/summaries', async (req, res) => {
    try {
      const { targetType, targetIds } = req.query;
      if (!targetType || !targetIds || !REVIEW_TARGETS.has(String(targetType))) {
        return res.json({ data: [] });
      }
      const ids = String(targetIds).split(',').map((id) => id.trim()).filter(Boolean);
      if (!ids.length) return res.json({ data: [] });

      const { rows } = await pool.query(
        `SELECT * FROM review_summaries
         WHERE target_type = $1 AND target_id = ANY($2::text[])`,
        [String(targetType), ids]
      );
      res.json({ data: rows });
    } catch (err) {
      return handleReviewError(res, err);
    }
  });

  app.get('/api/admin/reviews', authRequired, adminPermissionRequired('reviews.view'), async (req, res) => {
    try {
      const { targetType, status, q } = req.query;
      const clauses = ['1=1'];
      const params = [];

      if (targetType && REVIEW_TARGETS.has(String(targetType))) {
        params.push(String(targetType));
        clauses.push(`target_type = $${params.length}`);
      }
      if (status && REVIEW_STATUSES.has(String(status))) {
        params.push(String(status));
        clauses.push(`status = $${params.length}`);
      }
      if (q) {
        params.push(`%${String(q).trim()}%`);
        clauses.push(`(COALESCE(comment, '') ILIKE $${params.length} OR COALESCE(author_name, '') ILIKE $${params.length})`);
      }

      const { rows } = await pool.query(
        `SELECT * FROM reviews
         WHERE ${clauses.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT 100`,
        params
      );
      res.json({ data: mapRows(rows, fromSnake) });
    } catch (err) {
      return handleReviewError(res, err);
    }
  });

  app.patch('/api/admin/reviews/:reviewId', authRequired, adminPermissionRequired('reviews.moderate'), async (req, res) => {
    try {
      const { reviewId } = req.params;
      const status = String(req.body?.status ?? '');
      if (!REVIEW_STATUSES.has(status)) return res.status(400).json({ error: 'status invalide' });
      const moderationReason = cleanComment(req.body?.moderationReason);

      const { rows } = await pool.query(
        `UPDATE reviews
         SET status = $1, moderation_reason = $2, updated_at = now()
         WHERE id::text = $3
         RETURNING *`,
        [status, moderationReason, reviewId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Avis introuvable' });
      if (rows[0].target_type === 'restaurant') await syncRestaurantRatingColumns(pool, rows[0].restaurant_id);
      res.json({ data: typeof fromSnake === 'function' ? fromSnake(rows[0]) : rows[0] });
    } catch (err) {
      return handleReviewError(res, err);
    }
  });
}

