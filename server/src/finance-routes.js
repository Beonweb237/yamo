// ============================================================
// Centre Financier (série FIN) — agrégation & réconciliation
// ============================================================
// Vue mode-aware : chaque commande porte son payment_mode (fee_breakdown).
// Revenu plateforme = commission (15 % du sous-total des commandes livrées).
// - cod : le cash circule chez les livreurs (à réconcilier).
// - prepaid_restaurant : la plateforme recouvre commission+frais sur le wallet
//   resto (points_ledger) et doit les frais au livreur (driver_ledger).
// Aucune valeur inventée : tout est dérivé des commandes livrées + ledgers.

const COMMISSION_RATE = 0.15;

export function registerFinanceRoutes(app, { pool, authRequired, adminPermissionRequired }) {
  const VIEW = 'finance.dashboard.view';

  // ─── Synthèse ───────────────────────────────────────────────
  app.get('/api/admin/finance', authRequired, adminPermissionRequired(VIEW), async (req, res) => {
    try {
      const days = Math.min(365, Math.max(1, parseInt(req.query.period) || 30));
      const { rows } = await pool.query(
        `SELECT o.subtotal, o.delivery_fee, o.total, o.payment_method,
                COALESCE(o.fee_breakdown->>'payment_mode','cod') AS mode
         FROM orders o
         WHERE o.status = 'delivered' AND o.created_at > now() - ($1::int * interval '1 day')`,
        [days]
      );
      const money = { orders: 0, gmv: 0, subtotal: 0, deliveryFees: 0, commission: 0 };
      const byMode = {};
      const byPayment = {};
      for (const o of rows) {
        const sub = Number(o.subtotal || 0), fee = Number(o.delivery_fee || 0), tot = Number(o.total || 0);
        const commission = Math.round(sub * COMMISSION_RATE);
        money.orders++; money.gmv += tot; money.subtotal += sub; money.deliveryFees += fee; money.commission += commission;
        const m = o.mode || 'cod';
        byMode[m] = byMode[m] || { orders: 0, gmv: 0, commission: 0 };
        byMode[m].orders++; byMode[m].gmv += tot; byMode[m].commission += commission;
        const pm = o.payment_method || 'cash';
        byPayment[pm] = byPayment[pm] || { orders: 0, amount: 0 };
        byPayment[pm].orders++; byPayment[pm].amount += tot;
      }

      // Grand livre livreur (mode prepaid_restaurant) : dû vs payé.
      let driver = { earnings: 0, payouts: 0, net: 0 };
      try {
        const dl = await pool.query(
          `SELECT COALESCE(SUM(amount_fcfa) FILTER (WHERE kind='earning'),0)::int AS earnings,
                  COALESCE(SUM(amount_fcfa) FILTER (WHERE kind='payout'),0)::int AS payouts
           FROM driver_ledger`
        );
        driver = { earnings: dl.rows[0].earnings, payouts: dl.rows[0].payouts, net: dl.rows[0].earnings - dl.rows[0].payouts };
      } catch { /* table absente au 1er boot */ }

      // Exposition wallets restaurants (solde total disponible).
      let restaurantWallets = { totalAvailable: 0 };
      try {
        const w = await pool.query("SELECT COALESCE(SUM(points),0)::int AS bal FROM points_ledger");
        restaurantWallets = { totalAvailable: w.rows[0].bal };
      } catch { /* ignore */ }

      // Cash en circulation (cod livré) — informational, à réconcilier.
      const cashInCirculation = rows
        .filter((o) => (o.mode || 'cod') === 'cod' && (o.payment_method || 'cash') === 'cash')
        .reduce((s, o) => s + Number(o.total || 0), 0);

      res.json({ periodDays: days, money, byMode, byPayment, driver, restaurantWallets, cashInCirculation });
    } catch (err) {
      console.error('GET /api/admin/finance:', err.message);
      res.status(500).json({ error: 'Erreur serveur (finance).' });
    }
  });

  // ─── Réconciliation par livreur ─────────────────────────────
  app.get('/api/admin/finance/drivers', authRequired, adminPermissionRequired(VIEW), async (req, res) => {
    try {
      const days = Math.min(365, Math.max(1, parseInt(req.query.period) || 30));
      // Cash encaissé par livreur sur les commandes cod livrées.
      const { rows: cod } = await pool.query(
        `SELECT o.driver_id, u.full_name, u.phone,
                count(*)::int AS orders,
                COALESCE(SUM(o.total),0)::int AS cash_collected,
                COALESCE(SUM(o.subtotal),0)::int AS owed_platform
         FROM orders o LEFT JOIN users u ON u.id::text = o.driver_id::text
         WHERE o.status='delivered' AND o.driver_id IS NOT NULL
           AND COALESCE(o.fee_breakdown->>'payment_mode','cod')='cod'
           AND (o.payment_method IS NULL OR o.payment_method='cash')
           AND o.created_at > now() - ($1::int * interval '1 day')
         GROUP BY o.driver_id, u.full_name, u.phone
         ORDER BY cash_collected DESC LIMIT 200`,
        [days]
      );
      // Dû au livreur (mode prepaid_restaurant) via driver_ledger.
      let earnings = [];
      try {
        const e = await pool.query(
          `SELECT driver_id,
                  COALESCE(SUM(amount_fcfa) FILTER (WHERE kind='earning'),0)::int AS earned,
                  COALESCE(SUM(amount_fcfa) FILTER (WHERE kind='payout'),0)::int AS paid
           FROM driver_ledger GROUP BY driver_id`
        );
        earnings = e.rows;
      } catch { /* ignore */ }
      const earnMap = new Map(earnings.map((r) => [String(r.driver_id), r]));
      const drivers = cod.map((r) => {
        const em = earnMap.get(String(r.driver_id));
        return {
          driverId: String(r.driver_id), name: r.full_name || null, phone: r.phone || null,
          orders: r.orders, cashCollected: r.cash_collected, owedToPlatform: r.owed_platform,
          earningsToPay: em ? em.earned - em.paid : 0,
        };
      });
      res.json({ periodDays: days, drivers });
    } catch (err) {
      console.error('GET /api/admin/finance/drivers:', err.message);
      res.status(500).json({ error: 'Erreur serveur (réconciliation livreurs).' });
    }
  });

  // ─── Détail transactionnel par commande (export CSV côté client) ──
  app.get('/api/admin/finance/orders', authRequired, adminPermissionRequired(VIEW), async (req, res) => {
    try {
      const days = Math.min(365, Math.max(1, parseInt(req.query.period) || 30));
      const { rows } = await pool.query(
        `SELECT o.id, o.created_at, o.status, o.subtotal, o.delivery_fee, o.total, o.payment_method,
                COALESCE(o.fee_breakdown->>'payment_mode','cod') AS mode,
                r.name AS restaurant_name, du.full_name AS driver_name
         FROM orders o
         LEFT JOIN restaurants r ON r.id::text = o.restaurant_id::text
         LEFT JOIN users du ON du.id::text = o.driver_id::text
         WHERE o.status IN ('delivered','cancelled')
           AND o.created_at > now() - ($1::int * interval '1 day')
         ORDER BY o.created_at DESC LIMIT 1000`,
        [days]
      );
      const orders = rows.map((o) => {
        const sub = Number(o.subtotal || 0);
        return {
          id: String(o.id),
          ref: 'Y-' + String(o.id).replace(/-/g, '').slice(0, 4).toUpperCase(),
          date: o.created_at,
          status: o.status,
          mode: o.mode || 'cod',
          paymentMethod: o.payment_method || 'cash',
          restaurantName: o.restaurant_name || null,
          driverName: o.driver_name || null,
          subtotal: sub,
          deliveryFee: Number(o.delivery_fee || 0),
          total: Number(o.total || 0),
          commission: o.status === 'delivered' ? Math.round(sub * COMMISSION_RATE) : 0,
        };
      });
      res.json({ periodDays: days, orders });
    } catch (err) {
      console.error('GET /api/admin/finance/orders:', err.message);
      res.status(500).json({ error: 'Erreur serveur (transactions).' });
    }
  });
}
