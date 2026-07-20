// ─── Reviews / Avis ────────────────────────────────────────────

// GET /api/reviews/eligibility?orderId=:orderId
app.get('/api/reviews/eligibility', authRequired, async (req, res) => {
  try {
    const { orderId } = req.query;
    if (!orderId) return res.status(400).json({ error: 'orderId requis' });

    const order = (await pool.query('SELECT id, status, customer_id, restaurant_id FROM orders WHERE id = $1', [orderId])).rows[0];
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });
    if (order.customer_id !== req.user.id) return res.status(403).json({ error: 'Cette commande ne vous appartient pas' });
    if (order.status !== 'delivered') return res.status(400).json({ error: 'Commande non livree', canReviewRestaurant: false, canReviewDriver: false, canReviewDishes: false, reasons: ['Commande non livree'] });

    const existing = (await pool.query('SELECT target_type, target_id FROM reviews WHERE order_id = $1', [orderId])).rows;

    res.json({
      data: {
        orderId,
        canReviewRestaurant: !existing.some(r => r.target_type === 'restaurant'),
        canReviewDriver: !existing.some(r => r.target_type === 'driver'),
        canReviewDishes: !existing.some(r => r.target_type === 'dish'),
        reasons: [],
        existingReviews: existing,
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/reviews
app.post('/api/reviews', authRequired, async (req, res) => {
  try {
    const { orderId, targetType, targetId, dishId, rating, comment, tags, authorName } = req.body;
    if (!orderId || !targetType || !rating) return res.status(400).json({ error: 'orderId, targetType et rating requis' });
    if (!['restaurant', 'driver', 'dish'].includes(targetType)) return res.status(400).json({ error: 'targetType invalide' });
    const r = Math.round(Number(rating));
    if (!Number.isFinite(r) || r < 1 || r > 5) return res.status(400).json({ error: 'rating entre 1 et 5' });

    const order = (await pool.query('SELECT id, status, customer_id, restaurant_id FROM orders WHERE id = $1', [orderId])).rows[0];
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });
    if (order.customer_id !== req.user.id) return res.status(403).json({ error: 'Cette commande ne vous appartient pas' });
    if (order.status !== 'delivered') return res.status(400).json({ error: 'Seules les commandes livrees peuvent etre notees' });

    const finalTargetId = targetType === 'restaurant' ? order.restaurant_id : (targetId || '');
    if (!finalTargetId) return res.status(400).json({ error: 'targetId requis' });

    // Anti-doublon
    const dup = (await pool.query('SELECT id FROM reviews WHERE order_id = $1 AND target_type = $2 AND target_id = $3 AND COALESCE(dish_id,\'\') = COALESCE($4,\'\')', [orderId, targetType, finalTargetId, dishId || ''])).rows[0];
    if (dup) return res.status(409).json({ error: 'Vous avez deja note cette cible pour cette commande' });

    const cleanComment = (comment || '').trim().slice(0, 500) || null;
    const cleanTags = Array.isArray(tags) ? [...new Set(tags.map(t => String(t).trim()).filter(Boolean))].slice(0, 6) : [];
    const cleanAuthor = (authorName || '').trim().slice(0, 100) || null;

    const result = (await pool.query(
      `INSERT INTO reviews (order_id, customer_id, restaurant_id, target_type, target_id, dish_id, driver_id, rating, comment, tags, author_name, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'published') RETURNING *`,
      [orderId, req.user.id, order.restaurant_id, targetType, finalTargetId, dishId || null,
        targetType === 'driver' ? finalTargetId : null, r, cleanComment, cleanTags, cleanAuthor]
    )).rows[0];

    res.status(201).json({ data: result });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Avis deja soumis' });
    if (err.code === '23503') return res.status(400).json({ error: 'Reference invalide (commande/restaurant)' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/restaurants/:restaurantId/reviews
app.get('/api/restaurants/:restaurantId/reviews', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const reviews = (await pool.query(
      'SELECT * FROM reviews WHERE restaurant_id = $1 AND status = \'published\' AND is_test = false ORDER BY created_at DESC LIMIT $2',
      [restaurantId, limit]
    )).rows;
    res.json({ data: reviews });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/restaurants/:restaurantId/reviews/summary
app.get('/api/restaurants/:restaurantId/reviews/summary', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const summary = (await pool.query(
      'SELECT * FROM review_summaries WHERE target_type = \'restaurant\' AND target_id = $1',
      [restaurantId]
    )).rows[0] || {
      target_type: 'restaurant', target_id: restaurantId, rating_avg: 0, rating_weighted: 4.2,
      review_count: 0, published_count: 0, verified_count: 0,
      breakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
    };
    res.json({ data: summary });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reviews/summaries?targetType=restaurant&targetIds=...
app.get('/api/reviews/summaries', async (req, res) => {
  try {
    const { targetType, targetIds } = req.query;
    if (!targetType || !targetIds) return res.json({ data: [] });
    const ids = String(targetIds).split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) return res.json({ data: [] });
    const summaries = (await pool.query(
      'SELECT * FROM review_summaries WHERE target_type = $1 AND target_id = ANY($2)',
      [targetType, ids]
    )).rows;
    res.json({ data: summaries });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/reviews
app.get('/api/admin/reviews', authRequired, adminRequired, async (req, res) => {
  try {
    const { targetType, status, q } = req.query;
    let query = 'SELECT * FROM reviews WHERE 1=1';
    const params = [];
    let i = 1;
    if (targetType) { query += ` AND target_type = $${i++}`; params.push(targetType); }
    if (status) { query += ` AND status = $${i++}`; params.push(status); }
    if (q) { query += ` AND (comment ILIKE $${i} OR author_name ILIKE $${i})`; params.push(`%${q}%`); i++; }
    query += ' ORDER BY created_at DESC LIMIT 100';
    const reviews = (await pool.query(query, params)).rows;
    res.json({ data: reviews });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/admin/reviews/:reviewId
app.patch('/api/admin/reviews/:reviewId', authRequired, adminRequired, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status, moderationReason } = req.body;
    if (!status || !['published', 'pending', 'hidden'].includes(status)) return res.status(400).json({ error: 'status invalide' });
    const result = (await pool.query(
      'UPDATE reviews SET status = $1, moderation_reason = $2, updated_at = now() WHERE id = $3 RETURNING *',
      [status, moderationReason || null, reviewId]
    )).rows[0];
    if (!result) return res.status(404).json({ error: 'Avis introuvable' });
    res.json({ data: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
