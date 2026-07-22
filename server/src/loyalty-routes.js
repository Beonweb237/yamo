// ============================================================
// MiamPoints — Routes /api/loyalty/* (fidélité client, série LOY)
// ============================================================
// Ledger client append-only et idempotent (UNIQUE (kind, reference)). Le GAIN
// (5 % du sous-total) et le PLAFOND d'utilisation sont calculés EN BASE — jamais
// confiés au client. À garder synchrone avec LOYALTY_CONFIG (launchConfig.ts).

const LOYALTY_CONFIG = {
  EARN_RATE: 0.05,
  MIN_REDEEM_POINTS: 500,
  MAX_REDEEM_RATE: 0.5,
  EXPIRY_MONTHS: 12,
};

function earnFor(subtotal) {
  return Math.round(Math.max(0, Number(subtotal) || 0) * LOYALTY_CONFIG.EARN_RATE);
}
function maxRedeemFor(subtotal) {
  return Math.floor(Math.max(0, Number(subtotal) || 0) * LOYALTY_CONFIG.MAX_REDEEM_RATE);
}
function monthsSince(iso) {
  const from = new Date(iso), to = new Date();
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export function registerLoyaltyRoutes(app, { pool, authRequired, adminPermissionRequired, fromSnake }) {
  // Crée la table au démarrage (idempotent).
  pool.query(`
    CREATE TABLE IF NOT EXISTS loyalty_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id text NOT NULL,
      kind text NOT NULL,
      points integer NOT NULL,
      reference text NOT NULL,
      note text,
      created_by text DEFAULT 'system',
      created_at timestamptz DEFAULT now(),
      UNIQUE (kind, reference)
    );
    CREATE INDEX IF NOT EXISTS loyalty_ledger_customer_idx ON loyalty_ledger(customer_id);
  `).catch((e) => console.error('loyalty_ledger init:', e.message));

  function assertSelfOrAdmin(req, res, customerId) {
    if (req.user.role === 'admin') return true;
    if (String(req.user.sub) === String(customerId)) return true;
    res.status(403).json({ error: 'Accès refusé à ce compte de fidélité.' });
    return false;
  }

  async function balanceOf(customerId) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(points),0)::int AS available,
              COALESCE(SUM(CASE WHEN kind='earn' THEN points ELSE 0 END),0)::int AS lifetime,
              MAX(created_at) AS last
       FROM loyalty_ledger WHERE customer_id = $1`,
      [String(customerId)]
    );
    const r = rows[0];
    const expired = LOYALTY_CONFIG.EXPIRY_MONTHS > 0 && r.last && monthsSince(r.last) >= LOYALTY_CONFIG.EXPIRY_MONTHS;
    return {
      available: expired ? 0 : Math.max(0, r.available),
      lifetimeEarned: r.lifetime,
      lastActivityAt: r.last,
      expired: Boolean(expired),
    };
  }

  // ─── Lectures ───────────────────────────────────────────────
  app.get('/api/loyalty/balance/:customerId', authRequired, async (req, res) => {
    try {
      if (!assertSelfOrAdmin(req, res, req.params.customerId)) return;
      res.json(await balanceOf(req.params.customerId));
    } catch (err) {
      console.error('GET /api/loyalty/balance:', err.message);
      res.status(500).json({ error: 'Erreur serveur (solde fidélité).' });
    }
  });

  app.get('/api/loyalty/ledger/:customerId', authRequired, async (req, res) => {
    try {
      if (!assertSelfOrAdmin(req, res, req.params.customerId)) return;
      const limit = Math.min(200, parseInt(req.query.limit) || 50);
      const offset = Math.max(0, parseInt(req.query.offset) || 0);
      const { rows } = await pool.query(
        `SELECT * FROM loyalty_ledger WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [String(req.params.customerId), limit, offset]
      );
      res.json(rows.map(fromSnake));
    } catch (err) {
      console.error('GET /api/loyalty/ledger:', err.message);
      res.status(500).json({ error: 'Erreur serveur (historique fidélité).' });
    }
  });

  // ─── Gain (déclenché à la livraison) ────────────────────────
  // Callable par tout compte authentifié (le livreur clôture → crédite le client
  // de la commande). Sûr : idempotent, montant dérivé EN BASE, commande livrée.
  app.post('/api/loyalty/earn', authRequired, async (req, res) => {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId requis.' });
    try {
      const ord = await pool.query(
        'SELECT customer_id::text AS cid, subtotal, status FROM orders WHERE id::text = $1',
        [String(orderId)]
      );
      if (!ord.rows[0]) return res.status(404).json({ error: 'Commande introuvable.' });
      const { cid, subtotal, status } = ord.rows[0];
      if (status !== 'delivered') return res.status(409).json({ error: "La commande n'est pas encore livrée." });
      const pts = earnFor(subtotal);
      if (pts <= 0) return res.json(null);
      const { rows } = await pool.query(
        `INSERT INTO loyalty_ledger (customer_id, kind, points, reference, note)
         VALUES ($1, 'earn', $2, $3, $4) ON CONFLICT (kind, reference) DO NOTHING RETURNING *`,
        [cid, pts, String(orderId), `+${pts} MiamPoints — commande #${String(orderId).slice(0, 8)} livrée`]
      );
      res.json(rows[0] ? fromSnake(rows[0]) : { alreadyEarned: true });
    } catch (err) {
      console.error('POST /api/loyalty/earn:', err.message);
      res.status(500).json({ error: 'Erreur serveur (gain fidélité).' });
    }
  });

  // ─── Utilisation au checkout ────────────────────────────────
  app.post('/api/loyalty/redeem', authRequired, async (req, res) => {
    const { customerId, orderId, points } = req.body || {};
    if (!customerId || !orderId || !Number.isInteger(points)) {
      return res.status(400).json({ error: 'customerId, orderId et points (entier) requis.' });
    }
    if (!assertSelfOrAdmin(req, res, customerId)) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [String(customerId)]);
      const existing = await client.query(
        "SELECT * FROM loyalty_ledger WHERE kind = 'redeem' AND reference = $1", [String(orderId)]
      );
      if (existing.rows[0]) { await client.query('COMMIT'); return res.json(fromSnake(existing.rows[0])); }
      const ord = await client.query('SELECT subtotal, restaurant_id::text AS rid FROM orders WHERE id::text = $1', [String(orderId)]);
      if (!ord.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Commande introuvable.' }); }
      const cap = maxRedeemFor(ord.rows[0].subtotal);
      const bal = await client.query(
        `SELECT COALESCE(SUM(points),0)::int AS available, MAX(created_at) AS last FROM loyalty_ledger WHERE customer_id = $1`,
        [String(customerId)]
      );
      const expired = LOYALTY_CONFIG.EXPIRY_MONTHS > 0 && bal.rows[0].last && monthsSince(bal.rows[0].last) >= LOYALTY_CONFIG.EXPIRY_MONTHS;
      const available = expired ? 0 : Math.max(0, bal.rows[0].available);
      if (points < LOYALTY_CONFIG.MIN_REDEEM_POINTS) { await client.query('ROLLBACK'); return res.status(402).json({ error: `Utilisation minimale de ${LOYALTY_CONFIG.MIN_REDEEM_POINTS} MiamPoints.` }); }
      if (points > available) { await client.query('ROLLBACK'); return res.status(402).json({ error: `Solde insuffisant (${available} MiamPoints).` }); }
      if (points > cap) { await client.query('ROLLBACK'); return res.status(402).json({ error: `Au plus ${cap} MiamPoints sur cette commande.` }); }
      const { rows } = await client.query(
        `INSERT INTO loyalty_ledger (customer_id, kind, points, reference, note)
         VALUES ($1, 'redeem', $2, $3, $4) RETURNING *`,
        [String(customerId), -points, String(orderId), `-${points} MiamPoints utilisés — commande #${String(orderId).slice(0, 8)}`]
      );
      // Compensation : la réduction est financée par MiamExpress. On crédite le
      // porte-monnaie (commission) du restaurant du montant utilisé pour qu'il
      // reste payé plein. Idempotent via UNIQUE(kind, reference) de points_ledger.
      if (ord.rows[0].rid) {
        await client.query(
          `INSERT INTO points_ledger (restaurant_id, kind, points, reference, note, created_by)
           VALUES ($1, 'loyalty_comp', $2, $3, $4, 'system')
           ON CONFLICT (kind, reference) DO NOTHING`,
          [ord.rows[0].rid, points, String(orderId),
           `Compensation MiamPoints (${points} FCFA) — réduction client commande #${String(orderId).slice(0, 8)}`]
        );
      }
      await client.query('COMMIT');
      res.json(fromSnake(rows[0]));
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('POST /api/loyalty/redeem:', err.message);
      res.status(500).json({ error: 'Erreur serveur (utilisation fidélité).' });
    } finally {
      client.release();
    }
  });

  // ─── Restitution si annulation ──────────────────────────────
  // Callable par tout compte authentifié (le resto/admin/client peut annuler →
  // restituer). Sûr : idempotent, ne rembourse qu'un redeem réel, client dérivé
  // de l'écriture d'origine.
  app.post('/api/loyalty/refund', authRequired, async (req, res) => {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId requis.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const redeem = await client.query("SELECT customer_id, points FROM loyalty_ledger WHERE kind = 'redeem' AND reference = $1", [String(orderId)]);
      if (!redeem.rows[0]) { await client.query('COMMIT'); return res.json(null); }
      const customerId = redeem.rows[0].customer_id;
      const amount = -redeem.rows[0].points; // redeem est négatif → montant utilisé
      const { rows } = await client.query(
        `INSERT INTO loyalty_ledger (customer_id, kind, points, reference, note)
         VALUES ($1, 'redeem_refund', $2, $3, $4) ON CONFLICT (kind, reference) DO NOTHING RETURNING *`,
        [String(customerId), amount, String(orderId),
         `Commande #${String(orderId).slice(0, 8)} annulée — ${amount} MiamPoints restitués`]
      );
      // Reverse la compensation versée au restaurant (si elle a eu lieu).
      const ord = await client.query('SELECT restaurant_id::text AS rid FROM orders WHERE id::text = $1', [String(orderId)]);
      if (ord.rows[0]?.rid) {
        await client.query(
          `INSERT INTO points_ledger (restaurant_id, kind, points, reference, note, created_by)
           VALUES ($1, 'loyalty_comp_reverse', $2, $3, $4, 'system')
           ON CONFLICT (kind, reference) DO NOTHING`,
          [ord.rows[0].rid, -amount, String(orderId),
           `Annulation — reprise compensation MiamPoints (${amount} FCFA) commande #${String(orderId).slice(0, 8)}`]
        );
      }
      await client.query('COMMIT');
      res.json(rows[0] ? fromSnake(rows[0]) : { alreadyRefunded: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('POST /api/loyalty/refund:', err.message);
      res.status(500).json({ error: 'Erreur serveur (restitution fidélité).' });
    } finally {
      client.release();
    }
  });

  // ─── Ajustement admin ───────────────────────────────────────
  app.post('/api/loyalty/adjust', authRequired, adminPermissionRequired('points.manage'), async (req, res) => {
    const { customerId, points, note } = req.body || {};
    if (!customerId || !Number.isInteger(points) || points === 0 || !note?.trim()) {
      return res.status(400).json({ error: 'customerId, points (entier non nul) et note requis.' });
    }
    try {
      if (points < 0) {
        const b = await balanceOf(customerId);
        if (b.available + points < 0) return res.status(402).json({ error: 'Ajustement refusé : solde négatif.' });
      }
      const ref = `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { rows } = await pool.query(
        `INSERT INTO loyalty_ledger (customer_id, kind, points, reference, note, created_by)
         VALUES ($1, 'admin_adjustment', $2, $3, $4, $5) RETURNING *`,
        [String(customerId), points, ref, note.trim(), req.user.sub ?? 'admin']
      );
      res.json(fromSnake(rows[0]));
    } catch (err) {
      console.error('POST /api/loyalty/adjust:', err.message);
      res.status(500).json({ error: "Erreur serveur (ajustement fidélité)." });
    }
  });
}
