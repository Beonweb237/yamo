// ============================================================
// Série PTS — Routes /api/points/* (transactionnelles)
// ============================================================
// Le /api/:table générique ne suffit pas : chaque écriture re-vérifie le
// solde EN BASE, dans une transaction sérialisée par resto (advisory lock),
// avec idempotence portée par UNIQUE (kind, reference) — voir la migration
// 20260720_points.sql et les invariants de app/docs/points-system-prompts.md §0.
//
// À garder synchrone avec POINTS_CONFIG (app/src/data/launchConfig.ts).

// MODÈLE (21/07/2026) : solde en FCFA (1 unité = 1 FCFA). Commission = 15 % du
// sous-total nourriture, calculée ICI (jamais confiée au client). À garder
// synchrone avec POINTS_CONFIG (app/src/data/launchConfig.ts).
const POINTS_CONFIG = {
  POINT_PRICE_FCFA: 1,
  COMMISSION_RATE: 0.15,
  PENALTY_RESTAURANT_FAULT_FCFA: 500,
  MIN_BALANCE_FLOOR_FCFA: 0,
  MIN_RECHARGE_FCFA: 5000,
  WELCOME_BONUS_FCFA: 5000,
};

/** Commission (FCFA) due sur une commande, à partir de son sous-total nourriture. */
function commissionForSubtotal(subtotal) {
  return Math.round(Math.max(0, Number(subtotal) || 0) * POINTS_CONFIG.COMMISSION_RATE);
}

const SETTLEMENT_KINDS = ['consume', 'release', 'penalty'];

// ─── Application de la commission sur les transitions de statut ───
// Réutilisables hors des routes /api/points (appelées par le handler générique
// de mise à jour des commandes) pour que TOUTES les commandes — normales,
// sur mesure, abonnement — prélèvent la commission de façon uniforme.
// « Suivi souple » : la réservation à l'acceptation est NON bloquante (le solde
// peut passer négatif = dette tracée), on ne gèle jamais un restaurant. Le
// passage au blocage dur (refus si solde insuffisant) se fera plus tard.
async function withLock(pool, restaurantId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [String(restaurantId)]);
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
async function appendLedger(client, e) {
  await client.query(
    `INSERT INTO points_ledger (restaurant_id, kind, points, reference, note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (kind, reference) DO NOTHING`,
    [String(e.restaurantId), e.kind, e.points, String(e.reference), e.note ?? null, e.createdBy ?? 'system']
  );
}

/** Réservation NON bloquante de la commission à l'acceptation (pending→confirmed).
 *  Idempotent par (kind='hold', reference=orderId). N'échoue jamais sur solde. */
export async function holdOrderCommissionSoft(pool, order) {
  const restaurantId = order?.restaurant_id, orderId = order?.id;
  if (!restaurantId || !orderId) return;
  const commission = commissionForSubtotal(order.subtotal);
  const mode = order.fee_breakdown?.payment_mode || 'cod';
  const driverFee = mode === 'prepaid_restaurant' ? Math.max(0, Math.round(order.delivery_fee || 0)) : 0;
  const reservation = commission + driverFee;
  if (reservation <= 0) return;
  await withLock(pool, restaurantId, async (client) => {
    const ex = await client.query("SELECT 1 FROM points_ledger WHERE kind='hold' AND reference=$1", [String(orderId)]);
    if (ex.rows[0]) return;
    const note = driverFee > 0
      ? `Réservation commission ${commission} + frais livreur ${driverFee} (${reservation} FCFA) — commande #${String(orderId).slice(0, 8)}`
      : `Réservation commission (${commission} FCFA) — commande #${String(orderId).slice(0, 8)}`;
    await appendLedger(client, { restaurantId, kind: 'hold', points: -reservation, reference: orderId, note });
  });
}

/** Règlement du hold à la livraison (consume) ou annulation (release/penalty).
 *  Idempotent ; no-op si aucun hold. En prepaid_restaurant, crédite le livreur. */
export async function settleOrderCommission(pool, order, outcome) {
  const restaurantId = order?.restaurant_id, orderId = order?.id;
  if (!restaurantId || !orderId || !SETTLEMENT_KINDS.includes(outcome)) return;
  await withLock(pool, restaurantId, async (client) => {
    const hold = await client.query("SELECT points FROM points_ledger WHERE kind='hold' AND reference=$1 AND restaurant_id=$2", [String(orderId), String(restaurantId)]);
    if (!hold.rows[0]) return;
    const settled = await client.query('SELECT 1 FROM points_ledger WHERE kind = ANY($1) AND reference=$2', [SETTLEMENT_KINDS, String(orderId)]);
    if (settled.rows[0]) return;
    const holdAmount = -hold.rows[0].points;
    const spec = outcome === 'consume'
      ? { kind: 'consume', points: 0, note: `Commande #${String(orderId).slice(0, 8)} livrée — ${holdAmount} FCFA consommés` }
      : outcome === 'release'
        ? { kind: 'release', points: holdAmount, note: `Commande #${String(orderId).slice(0, 8)} annulée — réservation restituée` }
        : { kind: 'penalty', points: holdAmount - Math.min(holdAmount, POINTS_CONFIG.PENALTY_RESTAURANT_FAULT_FCFA), note: `Annulation restaurant — pénalité ${Math.min(holdAmount, POINTS_CONFIG.PENALTY_RESTAURANT_FAULT_FCFA)} FCFA conservée` };
    await appendLedger(client, { restaurantId, reference: orderId, ...spec });
    if (outcome === 'consume') {
      const mode = order.fee_breakdown?.payment_mode || 'cod';
      const driverFee = Math.max(0, Math.round(order.delivery_fee || 0));
      if (mode === 'prepaid_restaurant' && order.driver_id && driverFee > 0) {
        await client.query(
          `INSERT INTO driver_ledger (driver_id, order_id, kind, amount_fcfa, reference, note)
           VALUES ($1,$2,'earning',$3,$2,$4) ON CONFLICT (kind, reference) DO NOTHING`,
          [String(order.driver_id), String(orderId), driverFee, `Frais de livraison (prépayé restaurant) — commande #${String(orderId).slice(0, 8)}`]
        );
      }
    }
  });
}

export function registerPointsRoutes(app, { pool, authRequired, adminRequired, adminPermissionRequired, fromSnake }) {
  // Série PAY : grand livre livreur — ce que la plateforme doit / a payé au livreur.
  // Alimenté notamment en mode prepaid_restaurant (frais financés par le wallet resto,
  // crédités au livreur à la livraison). Idempotent par (kind, reference).
  pool.query(`
    CREATE TABLE IF NOT EXISTS driver_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id text NOT NULL,
      order_id text,
      kind text NOT NULL,
      amount_fcfa integer NOT NULL,
      reference text NOT NULL,
      note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (kind, reference)
    );
    CREATE INDEX IF NOT EXISTS driver_ledger_driver_idx ON driver_ledger(driver_id);
  `).catch((e) => console.error('driver_ledger init:', e.message));

  // Toutes les écritures d'un même resto sont sérialisées par un verrou
  // advisory de transaction : pas de double hold en course, pas de solde négatif.
  async function withRestaurantLock(restaurantId, fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [String(restaurantId)]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async function computeBalance(client, restaurantId) {
    const { rows } = await client.query(
      `SELECT
         COALESCE(SUM(points), 0)::int AS available,
         COALESCE(SUM(CASE WHEN kind = 'hold' AND reference NOT IN (
           SELECT reference FROM points_ledger
           WHERE restaurant_id = $1 AND kind = ANY($2)
         ) THEN -points ELSE 0 END), 0)::int AS held
       FROM points_ledger WHERE restaurant_id = $1`,
      [restaurantId, SETTLEMENT_KINDS]
    );
    return rows[0];
  }

  // Écriture idempotente : ON CONFLICT (kind, reference) → renvoie l'existante.
  async function appendEntry(client, entry) {
    const { rows } = await client.query(
      `INSERT INTO points_ledger (restaurant_id, kind, points, reference, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (kind, reference) DO NOTHING
       RETURNING *`,
      [entry.restaurantId, entry.kind, entry.points, entry.reference, entry.note ?? null, entry.createdBy ?? 'system']
    );
    if (rows[0]) return { entry: rows[0], created: true };
    const existing = await client.query(
      'SELECT * FROM points_ledger WHERE kind = $1 AND reference = $2',
      [entry.kind, entry.reference]
    );
    return { entry: existing.rows[0], created: false };
  }

  // Le resto n'agit que sur son propre compte ; l'admin sur tous.
  // IMPORTANT : le JWT signé au login ne porte PAS de claim restaurantId
  // (seulement sub/phone/role) → la propriété se résout EN BASE via
  // restaurants.owner_id (même règle que canManageRestaurant de food-routes).
  // L'ancien test sur req.user.restaurantId refusait TOUS les restaurateurs
  // (403 « Accès refusé » vu en prod le 23/07).
  async function userOwnsRestaurant(req, restaurantId) {
    if (req.user.role === 'admin') return true;
    if (req.user.role !== 'restaurant') return false;
    if (String(req.user.restaurantId ?? '') === String(restaurantId)) return true; // compat token enrichi
    const { rows } = await pool.query(
      'SELECT 1 FROM restaurants WHERE id::text = $1 AND owner_id::text = $2',
      [String(restaurantId), String(req.user.sub)]
    );
    return rows.length > 0;
  }

  async function assertOwnRestaurant(req, res, restaurantId) {
    if (await userOwnsRestaurant(req, restaurantId)) return true;
    res.status(403).json({ error: 'Accès refusé à ce compte de points.' });
    return false;
  }

  // ─── Lectures ───────────────────────────────────────────────
  app.get('/api/points/balance/:restaurantId', authRequired, async (req, res) => {
    try {
      const client = await pool.connect();
      try {
        res.json(await computeBalance(client, req.params.restaurantId));
      } finally { client.release(); }
    } catch (err) {
      console.error('GET /api/points/balance:', err.message);
      res.status(500).json({ error: 'Erreur serveur lors du calcul du solde.' });
    }
  });

  app.get('/api/points/ledger/:restaurantId', authRequired, async (req, res) => {
    try {
      if (!(await assertOwnRestaurant(req, res, req.params.restaurantId))) return;
      const limit = Math.min(200, parseInt(req.query.limit) || 50);
      const offset = Math.max(0, parseInt(req.query.offset) || 0);
      const { rows } = await pool.query(
        `SELECT * FROM points_ledger WHERE restaurant_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [req.params.restaurantId, limit, offset]
      );
      res.json(rows.map(fromSnake));
    } catch (err) {
      console.error('GET /api/points/ledger:', err.message);
      res.status(500).json({ error: 'Erreur serveur lors de la lecture du ledger.' });
    }
  });

  // Flux global du ledger (admin) — tous restaurants confondus, paginé.
  app.get('/api/points/ledger', authRequired, adminPermissionRequired('points.manage'), async (req, res) => {
    try {
      const limit = Math.min(200, parseInt(req.query.limit) || 50);
      const offset = Math.max(0, parseInt(req.query.offset) || 0);
      const { rows } = await pool.query(
        'SELECT * FROM points_ledger ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      res.json(rows.map(fromSnake));
    } catch (err) {
      console.error('GET /api/points/ledger:', err.message);
      res.status(500).json({ error: 'Erreur serveur lors de la lecture du ledger global.' });
    }
  });

  app.get('/api/points/balances', authRequired, adminPermissionRequired('points.manage'), async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT restaurant_id,
                COALESCE(SUM(points), 0)::int AS available,
                COALESCE(SUM(CASE WHEN kind = 'hold' AND reference NOT IN (
                  SELECT reference FROM points_ledger pl2
                  WHERE pl2.restaurant_id = points_ledger.restaurant_id AND pl2.kind = ANY($1)
                ) THEN -points ELSE 0 END), 0)::int AS held
         FROM points_ledger GROUP BY restaurant_id`,
        [SETTLEMENT_KINDS]
      );
      res.json(Object.fromEntries(rows.map((r) => [r.restaurant_id, { available: r.available, held: r.held }])));
    } catch (err) {
      console.error('GET /api/points/balances:', err.message);
      res.status(500).json({ error: 'Erreur serveur lors de la lecture des soldes.' });
    }
  });

  // ─── Hold / Settle (appelés par les transitions de commande) ─
  app.post('/api/points/hold', authRequired, async (req, res) => {
    const { restaurantId, orderId } = req.body || {};
    if (!restaurantId || !orderId) return res.status(400).json({ error: 'restaurantId et orderId requis.' });
    if (!(await assertOwnRestaurant(req, res, restaurantId))) return;
    try {
      const result = await withRestaurantLock(restaurantId, async (client) => {
        const existing = await client.query(
          "SELECT * FROM points_ledger WHERE kind = 'hold' AND reference = $1", [orderId]
        );
        if (existing.rows[0]) return { entry: existing.rows[0], created: false };
        // Montant réservé = source de vérité SERVEUR (le client n'envoie jamais le
        // montant). Commission = 15 % du sous-total ; en mode prepaid_restaurant, on
        // réserve AUSSI les frais de livraison (le resto encaisse tout, la plateforme
        // recouvre commission + frais sur son porte-monnaie). Mode figé par commande
        // dans fee_breakdown.payment_mode (défaut cod).
        const ord = await client.query('SELECT subtotal, delivery_fee, fee_breakdown FROM orders WHERE id::text = $1', [String(orderId)]);
        if (!ord.rows[0]) {
          const err = new Error('Commande introuvable pour la réservation de commission.');
          err.statusCode = 404;
          throw err;
        }
        const commission = commissionForSubtotal(ord.rows[0].subtotal);
        const mode = ord.rows[0].fee_breakdown?.payment_mode || 'cod';
        const driverFee = mode === 'prepaid_restaurant' ? Math.max(0, Math.round(ord.rows[0].delivery_fee || 0)) : 0;
        const reservation = commission + driverFee;
        const { available } = await computeBalance(client, restaurantId);
        if (available < reservation + POINTS_CONFIG.MIN_BALANCE_FLOOR_FCFA) {
          const detail = driverFee > 0
            ? `${reservation} FCFA (commission ${commission} + frais livreur ${driverFee})`
            : `${commission} FCFA de commission`;
          const err = new Error(
            `Solde insuffisant (${available} FCFA) : accepter cette commande réserve ${detail}. Rechargez votre compte.`
          );
          err.statusCode = 402;
          throw err;
        }
        const note = driverFee > 0
          ? `Réservation commission ${commission} + frais livreur ${driverFee} (${reservation} FCFA) — commande #${String(orderId).slice(0, 8)}`
          : `Réservation commission (${commission} FCFA) — commande #${String(orderId).slice(0, 8)}`;
        return appendEntry(client, {
          restaurantId, kind: 'hold', points: -reservation,
          reference: orderId, note,
        });
      });
      res.json(fromSnake(result.entry));
    } catch (err) {
      if (err.statusCode === 402) return res.status(402).json({ error: err.message });
      console.error('POST /api/points/hold:', err.message);
      res.status(500).json({ error: 'Erreur serveur lors de la réservation des points.' });
    }
  });

  app.post('/api/points/settle', authRequired, async (req, res) => {
    const { restaurantId, orderId, outcome } = req.body || {};
    if (!restaurantId || !orderId || !['consume', 'release', 'penalty'].includes(outcome)) {
      return res.status(400).json({ error: 'restaurantId, orderId et outcome (consume|release|penalty) requis.' });
    }
    if (!(await assertOwnRestaurant(req, res, restaurantId))) return;
    try {
      const result = await withRestaurantLock(restaurantId, async (client) => {
        const hold = await client.query(
          "SELECT * FROM points_ledger WHERE kind = 'hold' AND reference = $1 AND restaurant_id = $2",
          [orderId, restaurantId]
        );
        if (!hold.rows[0]) {
          const err = new Error(`Aucune réservation de points pour la commande ${String(orderId).slice(0, 8)}.`);
          err.statusCode = 404;
          throw err;
        }
        const settled = await client.query(
          'SELECT * FROM points_ledger WHERE kind = ANY($1) AND reference = $2',
          [SETTLEMENT_KINDS, orderId]
        );
        if (settled.rows[0]) return { entry: settled.rows[0], created: false };
        const holdAmount = -hold.rows[0].points;
        const spec = outcome === 'consume'
          ? { kind: 'consume', points: 0, note: `Commande #${String(orderId).slice(0, 8)} livrée — ${holdAmount} points consommés` }
          : outcome === 'release'
            ? { kind: 'release', points: holdAmount, note: `Commande #${String(orderId).slice(0, 8)} annulée sans faute — points restitués` }
            : {
              kind: 'penalty',
              points: holdAmount - Math.min(holdAmount, POINTS_CONFIG.PENALTY_RESTAURANT_FAULT_FCFA),
              note: `Annulation par le restaurant — pénalité de ${Math.min(holdAmount, POINTS_CONFIG.PENALTY_RESTAURANT_FAULT_FCFA)} FCFA conservée`,
            };
        const entry = await appendEntry(client, { restaurantId, reference: orderId, ...spec });

        // Mode prepaid_restaurant : à la livraison, les frais (financés par le wallet
        // resto via le hold) sont crédités au livreur dans son grand livre. Idempotent.
        if (outcome === 'consume') {
          const ord = await client.query('SELECT delivery_fee, driver_id, fee_breakdown FROM orders WHERE id::text = $1', [String(orderId)]);
          const o = ord.rows[0];
          const mode = o?.fee_breakdown?.payment_mode || 'cod';
          const driverFee = Math.max(0, Math.round(o?.delivery_fee || 0));
          if (o && mode === 'prepaid_restaurant' && o.driver_id && driverFee > 0) {
            await client.query(
              `INSERT INTO driver_ledger (driver_id, order_id, kind, amount_fcfa, reference, note)
               VALUES ($1, $2, 'earning', $3, $2, $4) ON CONFLICT (kind, reference) DO NOTHING`,
              [String(o.driver_id), String(orderId), driverFee, `Frais de livraison (prépayé restaurant) — commande #${String(orderId).slice(0, 8)}`]
            );
          }
        }
        return entry;
      });
      res.json(fromSnake(result.entry));
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      console.error('POST /api/points/settle:', err.message);
      res.status(500).json({ error: 'Erreur serveur lors du règlement des points.' });
    }
  });

  // ─── Remboursement sur caution (admin, litiges) ─────────────
  app.post('/api/points/convert-refund', authRequired, adminPermissionRequired('finance.refunds.approve'), async (req, res) => {
    const { restaurantId, disputeId, amountFcfa } = req.body || {};
    if (!restaurantId || !disputeId || !(amountFcfa > 0)) {
      return res.status(400).json({ error: 'restaurantId, disputeId et amountFcfa requis.' });
    }
    try {
      const pts = Math.round(amountFcfa); // solde en FCFA : 1 unité = 1 FCFA
      const result = await withRestaurantLock(restaurantId, async (client) => {
        const existing = await client.query(
          "SELECT * FROM points_ledger WHERE kind = 'convert_refund' AND reference = $1", [disputeId]
        );
        if (existing.rows[0]) return { entry: existing.rows[0], created: false };
        const { available } = await computeBalance(client, restaurantId);
        if (available < pts) {
          const err = new Error(
            `Caution insuffisante : ${pts} points requis, ${available} disponibles. Reliquat hors application (phase 1).`
          );
          err.statusCode = 402;
          throw err;
        }
        return appendEntry(client, {
          restaurantId, kind: 'convert_refund', points: -pts, reference: disputeId,
          note: `Remboursement garantie client (${amountFcfa} FCFA) prélevé sur la caution`,
          createdBy: req.user.sub ?? 'admin',
        });
      });
      res.json(fromSnake(result.entry));
    } catch (err) {
      if (err.statusCode === 402) return res.status(402).json({ error: err.message });
      console.error('POST /api/points/convert-refund:', err.message);
      res.status(500).json({ error: 'Erreur serveur lors de la conversion.' });
    }
  });

  // ─── Recharges ──────────────────────────────────────────────
  app.post('/api/points/recharges', authRequired, async (req, res) => {
    const { restaurantId, points, method } = req.body || {};
    if (!restaurantId || !['momo', 'cash_partner'].includes(method)) {
      return res.status(400).json({ error: 'restaurantId et method (momo|cash_partner) requis.' });
    }
    if (!Number.isInteger(points) || points < POINTS_CONFIG.MIN_RECHARGE_FCFA) {
      return res.status(400).json({ error: `La recharge minimale est de ${POINTS_CONFIG.MIN_RECHARGE_FCFA} FCFA.` });
    }
    if (!(await assertOwnRestaurant(req, res, restaurantId))) return;
    try {
      const paymentRef = 'PTS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      // `points` = montant en FCFA (unité de compte = 1 FCFA) → amount_fcfa identique.
      const { rows } = await pool.query(
        `INSERT INTO point_recharges (restaurant_id, points, amount_fcfa, method, payment_ref)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [restaurantId, points, points, method, paymentRef]
      );
      res.json(fromSnake(rows[0]));
    } catch (err) {
      console.error('POST /api/points/recharges:', err.message);
      res.status(500).json({ error: 'Erreur serveur lors de la demande de recharge.' });
    }
  });

  app.get('/api/points/recharges', authRequired, async (req, res) => {
    try {
      const filters = [];
      const values = [];
      if (req.query.status) { values.push(req.query.status); filters.push(`status = $${values.length}`); }
      // Un resto ne voit que ses demandes ; l'admin peut filtrer librement.
      // Le JWT ne portant pas de restaurantId, on résout les restos du
      // propriétaire EN BASE ('' casté en uuid = le 500 vu en prod le 23/07).
      if (req.user.role !== 'admin') {
        const { rows: owned } = await pool.query(
          'SELECT id::text AS id FROM restaurants WHERE owner_id::text = $1',
          [String(req.user.sub)]
        );
        if (!owned.length) return res.json([]);
        values.push(owned.map((r) => r.id));
        filters.push(`restaurant_id::text = ANY($${values.length})`);
      } else if (req.query.restaurantId) {
        values.push(req.query.restaurantId);
        filters.push(`restaurant_id = $${values.length}`);
      }
      const where = filters.length ? ' WHERE ' + filters.join(' AND ') : '';
      const { rows } = await pool.query(
        `SELECT * FROM point_recharges${where} ORDER BY requested_at DESC LIMIT 200`, values
      );
      res.json(rows.map(fromSnake));
    } catch (err) {
      console.error('GET /api/points/recharges:', err.message);
      res.status(500).json({ error: 'Erreur serveur lors de la lecture des recharges.' });
    }
  });

  app.patch('/api/points/recharges/:id', authRequired, adminPermissionRequired('points.manage'), async (req, res) => {
    const { decision, reason } = req.body || {};
    if (!['validate', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'decision (validate|reject) requise.' });
    }
    if (decision === 'reject' && !reason?.trim()) {
      return res.status(400).json({ error: 'Le motif de rejet est obligatoire.' });
    }
    try {
      const { rows } = await pool.query('SELECT * FROM point_recharges WHERE id = $1', [req.params.id]);
      const request = rows[0];
      if (!request) return res.status(404).json({ error: 'Demande de recharge introuvable.' });
      if (request.status !== 'pending') return res.json(fromSnake(request)); // idempotent

      const result = await withRestaurantLock(request.restaurant_id, async (client) => {
        const updated = await client.query(
          `UPDATE point_recharges
           SET status = $1, decided_at = now(), decided_by = $2, rejection_reason = $3
           WHERE id = $4 AND status = 'pending' RETURNING *`,
          [decision === 'validate' ? 'validated' : 'rejected', req.user.sub ?? 'admin',
           decision === 'reject' ? reason.trim() : null, req.params.id]
        );
        if (!updated.rows[0]) return request; // course perdue : déjà décidée
        if (decision === 'validate') {
          await appendEntry(client, {
            restaurantId: request.restaurant_id, kind: 'recharge', points: request.points,
            reference: req.params.id,
            note: `Recharge ${request.method === 'momo' ? 'Mobile Money' : 'cash partenaire'} — réf. ${request.payment_ref}`,
            createdBy: req.user.sub ?? 'admin',
          });
        }
        return updated.rows[0];
      });
      res.json(fromSnake(result));
    } catch (err) {
      console.error('PATCH /api/points/recharges:', err.message);
      res.status(500).json({ error: 'Erreur serveur lors de la décision.' });
    }
  });

  // ─── Bonus de bienvenue & ajustements ───────────────────────
  app.post('/api/points/welcome-bonus', authRequired, async (req, res) => {
    const { restaurantId } = req.body || {};
    if (!restaurantId) return res.status(400).json({ error: 'restaurantId requis.' });
    if (!(await assertOwnRestaurant(req, res, restaurantId))) return;
    if (POINTS_CONFIG.WELCOME_BONUS_FCFA <= 0) return res.json(null);
    try {
      const result = await withRestaurantLock(restaurantId, (client) =>
        appendEntry(client, {
          restaurantId, kind: 'welcome_bonus', points: POINTS_CONFIG.WELCOME_BONUS_FCFA,
          reference: restaurantId,
          note: `Crédit de bienvenue MiamExpress (${POINTS_CONFIG.WELCOME_BONUS_FCFA} FCFA offerts)`,
        })
      );
      res.json(fromSnake(result.entry));
    } catch (err) {
      console.error('POST /api/points/welcome-bonus:', err.message);
      res.status(500).json({ error: 'Erreur serveur lors du bonus de bienvenue.' });
    }
  });

  // Dotation promotionnelle EN MASSE (lancement) — idempotente par
  // (campagne, resto) via la contrainte UNIQUE (kind, reference).
  app.post('/api/points/promo-grant', authRequired, adminPermissionRequired('points.manage'), async (req, res) => {
    const { restaurantIds, points, campaignId, note } = req.body || {};
    if (!Array.isArray(restaurantIds) || restaurantIds.length === 0 || restaurantIds.length > 500) {
      return res.status(400).json({ error: 'restaurantIds (1 à 500 éléments) requis.' });
    }
    if (!Number.isInteger(points) || points <= 0) {
      return res.status(400).json({ error: 'points (entier positif) requis.' });
    }
    if (!campaignId?.trim()) {
      return res.status(400).json({ error: 'campaignId requis.' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let granted = 0;
      for (const restaurantId of restaurantIds) {
        const { rowCount } = await client.query(
          `INSERT INTO points_ledger (restaurant_id, kind, points, reference, note, created_by)
           VALUES ($1, 'promo_grant', $2, $3, $4, $5)
           ON CONFLICT (kind, reference) DO NOTHING`,
          [restaurantId, points, `${campaignId.trim()}:${restaurantId}`,
           note?.trim() || `Dotation promotionnelle « ${campaignId.trim()} »`,
           req.user.sub ?? 'admin']
        );
        granted += rowCount;
      }
      await client.query('COMMIT');
      res.json({ granted, alreadyGranted: restaurantIds.length - granted });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('POST /api/points/promo-grant:', err.message);
      res.status(500).json({ error: 'Erreur serveur lors de la dotation.' });
    } finally {
      client.release();
    }
  });

  app.post('/api/points/adjust', authRequired, adminPermissionRequired('points.manage'), async (req, res) => {
    const { restaurantId, points, note } = req.body || {};
    if (!restaurantId || !Number.isInteger(points) || points === 0 || !note?.trim()) {
      return res.status(400).json({ error: 'restaurantId, points (entier non nul) et note (motif) requis.' });
    }
    try {
      const result = await withRestaurantLock(restaurantId, async (client) => {
        if (points < 0) {
          const { available } = await computeBalance(client, restaurantId);
          if (available + points < 0) {
            const err = new Error(`Ajustement refusé : le solde deviendrait négatif (${available} + (${points}) < 0).`);
            err.statusCode = 402;
            throw err;
          }
        }
        return appendEntry(client, {
          restaurantId, kind: 'admin_adjustment', points,
          reference: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          note: note.trim(), createdBy: req.user.sub ?? 'admin',
        });
      });
      res.json(fromSnake(result.entry));
    } catch (err) {
      if (err.statusCode === 402) return res.status(402).json({ error: err.message });
      console.error('POST /api/points/adjust:', err.message);
      res.status(500).json({ error: "Erreur serveur lors de l'ajustement." });
    }
  });
}

