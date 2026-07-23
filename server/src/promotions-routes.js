// ============================================================
// Promotions & codes promo (série PROMO — CP5)
// ============================================================
// - Table promo_codes : compatible avec la lecture historique de
//   /api/orders/validate (colonnes discount_percent / discount_amount /
//   is_active), enrichie : type, seuil, ciblage resto, période.
// - /api/promotions/active : lecture PUBLIQUE (affichage Home) — n'expose
//   que les offres actives dans leur période.
// - /api/admin/promotions : CRUD admin (permission promotions.manage).
// - evaluatePromoCode : logique unique de calcul de remise, réutilisée par
//   /api/orders/validate (index.js) — montants serveur font foi.

export async function evaluatePromoCode(pool, code, { restaurantId, subtotal, deliveryFee }) {
  const cleaned = String(code || '').trim().toUpperCase();
  if (!cleaned) return { discount: 0, freeDelivery: false, promo: null, promoError: null };
  const { rows: [promo] } = await pool.query(
    'SELECT * FROM promo_codes WHERE UPPER(code) = $1 LIMIT 1',
    [cleaned]
  );
  if (!promo) return { discount: 0, freeDelivery: false, promo: null, promoError: 'Code promo inconnu.' };
  if (promo.is_active === false) {
    return { discount: 0, freeDelivery: false, promo: null, promoError: 'Ce code promo n’est plus actif.' };
  }
  const now = Date.now();
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) {
    return { discount: 0, freeDelivery: false, promo: null, promoError: 'Ce code promo n’est pas encore valable.' };
  }
  if (promo.ends_at && new Date(promo.ends_at).getTime() < now) {
    return { discount: 0, freeDelivery: false, promo: null, promoError: 'Ce code promo a expiré.' };
  }
  const targets = Array.isArray(promo.restaurant_ids) ? promo.restaurant_ids.filter(Boolean) : [];
  if (targets.length && !targets.includes(String(restaurantId))) {
    return { discount: 0, freeDelivery: false, promo: null, promoError: 'Ce code promo ne s’applique pas à ce restaurant.' };
  }
  const minSubtotal = parseInt(promo.min_subtotal) || 0;
  if (subtotal < minSubtotal) {
    return {
      discount: 0, freeDelivery: false, promo: null,
      promoError: `Ce code demande un minimum de ${minSubtotal.toLocaleString('fr-FR')} FCFA d’articles.`,
    };
  }
  const type = promo.type || (parseFloat(promo.discount_percent) > 0 ? 'percent' : 'amount');
  if (type === 'free_delivery') {
    return { discount: 0, freeDelivery: true, promo, promoError: null };
  }
  const pct = parseFloat(promo.discount_percent) || 0;
  const flat = parseInt(promo.discount_amount) || 0;
  const discount = Math.min(subtotal, type === 'percent' ? Math.round(subtotal * pct / 100) : flat);
  if (discount <= 0) {
    return { discount: 0, freeDelivery: false, promo: null, promoError: 'Ce code promo n’offre aucune remise ici.' };
  }
  return { discount, freeDelivery: false, promo, promoError: null };
}

export function registerPromotionRoutes(app, { pool, authRequired, adminPermissionRequired, fromSnake }) {
  // Table + colonnes additives (idempotent — une table promo_codes historique
  // avec un autre schéma est enrichie sans perte).
  pool.query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text UNIQUE NOT NULL,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS title text;
    ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS type text DEFAULT 'percent';
    ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0;
    ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS discount_amount integer DEFAULT 0;
    ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS min_subtotal integer DEFAULT 0;
    ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS restaurant_ids text[];
    ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS starts_at timestamptz;
    ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS ends_at timestamptz;
    ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
  `).catch((e) => console.error('promo_codes init:', e.message));

  const VALID_TYPES = ['percent', 'amount', 'free_delivery'];

  function cleanInput(body) {
    const code = String(body.code || '').trim().toUpperCase();
    const type = VALID_TYPES.includes(body.type) ? body.type : 'percent';
    const out = {
      code,
      title: String(body.title || '').trim() || null,
      type,
      discount_percent: type === 'percent' ? Math.max(0, Math.min(100, parseFloat(body.discountPercent) || 0)) : 0,
      discount_amount: type === 'amount' ? Math.max(0, parseInt(body.discountAmount) || 0) : 0,
      min_subtotal: Math.max(0, parseInt(body.minSubtotal) || 0),
      restaurant_ids: Array.isArray(body.restaurantIds) && body.restaurantIds.length
        ? body.restaurantIds.map(String) : null,
      starts_at: body.startsAt ? new Date(body.startsAt) : null,
      ends_at: body.endsAt ? new Date(body.endsAt) : null,
      is_active: body.isActive !== false,
    };
    if (!out.code || out.code.length < 3 || out.code.length > 24 || !/^[A-Z0-9_-]+$/.test(out.code)) {
      return { error: 'Code invalide (3-24 caractères alphanumériques).' };
    }
    if (out.type === 'percent' && out.discount_percent <= 0) return { error: 'Pourcentage de remise requis.' };
    if (out.type === 'amount' && out.discount_amount <= 0) return { error: 'Montant de remise requis.' };
    if (out.starts_at && out.ends_at && out.starts_at > out.ends_at) return { error: 'Période invalide (début après fin).' };
    return { value: out };
  }

  // ─── Lecture publique : offres actives (affichage Home / vitrine) ───
  app.get('/api/promotions/active', async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT id, code, title, type, discount_percent, discount_amount, min_subtotal,
               restaurant_ids, starts_at, ends_at
        FROM promo_codes
        WHERE is_active = true
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at IS NULL OR ends_at >= now())
        ORDER BY created_at DESC
        LIMIT 10
      `);
      res.json(rows.map(fromSnake));
    } catch (err) {
      console.error('GET /api/promotions/active:', err.message);
      res.status(500).json({ error: 'Erreur serveur (promotions).' });
    }
  });

  // ─── CRUD admin ─────────────────────────────────────────────
  app.get('/api/admin/promotions', authRequired, adminPermissionRequired('promotions.manage'), async (_req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM promo_codes ORDER BY created_at DESC');
      res.json(rows.map(fromSnake));
    } catch (err) {
      console.error('GET /api/admin/promotions:', err.message);
      res.status(500).json({ error: 'Erreur serveur (promotions).' });
    }
  });

  app.post('/api/admin/promotions', authRequired, adminPermissionRequired('promotions.manage'), async (req, res) => {
    const parsed = cleanInput(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const v = parsed.value;
    try {
      const { rows: [row] } = await pool.query(
        `INSERT INTO promo_codes (code, title, type, discount_percent, discount_amount, min_subtotal,
                                  restaurant_ids, starts_at, ends_at, is_active, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now()) RETURNING *`,
        [v.code, v.title, v.type, v.discount_percent, v.discount_amount, v.min_subtotal,
          v.restaurant_ids, v.starts_at, v.ends_at, v.is_active]
      );
      res.status(201).json(fromSnake(row));
    } catch (err) {
      if (String(err.message).includes('duplicate')) {
        return res.status(409).json({ error: 'Ce code existe déjà.' });
      }
      console.error('POST /api/admin/promotions:', err.message);
      res.status(500).json({ error: 'Erreur serveur (création promotion).' });
    }
  });

  app.put('/api/admin/promotions/:id', authRequired, adminPermissionRequired('promotions.manage'), async (req, res) => {
    const parsed = cleanInput(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const v = parsed.value;
    try {
      const { rows: [row] } = await pool.query(
        `UPDATE promo_codes SET code=$2, title=$3, type=$4, discount_percent=$5, discount_amount=$6,
                min_subtotal=$7, restaurant_ids=$8, starts_at=$9, ends_at=$10, is_active=$11, updated_at=now()
         WHERE id::text = $1 RETURNING *`,
        [String(req.params.id), v.code, v.title, v.type, v.discount_percent, v.discount_amount,
          v.min_subtotal, v.restaurant_ids, v.starts_at, v.ends_at, v.is_active]
      );
      if (!row) return res.status(404).json({ error: 'Promotion introuvable.' });
      res.json(fromSnake(row));
    } catch (err) {
      if (String(err.message).includes('duplicate')) {
        return res.status(409).json({ error: 'Ce code existe déjà.' });
      }
      console.error('PUT /api/admin/promotions:', err.message);
      res.status(500).json({ error: 'Erreur serveur (mise à jour promotion).' });
    }
  });

  app.delete('/api/admin/promotions/:id', authRequired, adminPermissionRequired('promotions.manage'), async (req, res) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM promo_codes WHERE id::text = $1', [String(req.params.id)]);
      if (!rowCount) return res.status(404).json({ error: 'Promotion introuvable.' });
      res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/admin/promotions:', err.message);
      res.status(500).json({ error: 'Erreur serveur (suppression promotion).' });
    }
  });
}
