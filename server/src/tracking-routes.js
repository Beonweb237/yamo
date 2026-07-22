// ============================================================
// Suivi livreur temps réel + réglages plateforme (série TRK)
// ============================================================
// - app_settings : réglages globaux lus par tous (ex. mode démonstration du
//   suivi). Écriture réservée admin.
// - driver_positions : dernière position GPS réelle du livreur par commande,
//   envoyée par son appareil pendant une livraison active, lue par le client.
//
// Aucune position n'est jamais inventée côté serveur : si le livreur n'a pas
// envoyé de position, l'endpoint renvoie null et le client affiche un état
// honnête (ou l'estimation, selon le mode démo).

export function registerTrackingRoutes(app, { pool, authRequired, adminRequired, fromSnake }) {
  pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS driver_positions (
      order_id text PRIMARY KEY,
      driver_id text,
      lat double precision NOT NULL,
      lng double precision NOT NULL,
      updated_at timestamptz DEFAULT now()
    );
  `).catch((e) => console.error('tracking tables init:', e.message));

  // ─── Réglages plateforme ────────────────────────────────────
  // Lecture publique : le client doit connaître le mode démo sans être admin.
  app.get('/api/settings', async (_req, res) => {
    try {
      const { rows } = await pool.query('SELECT key, value FROM app_settings');
      const out = {};
      for (const r of rows) out[r.key] = r.value;
      // Valeur par défaut : suivi RÉEL (démo désactivé).
      if (out.demo_tracking === undefined) out.demo_tracking = false;
      res.json(out);
    } catch (err) {
      console.error('GET /api/settings:', err.message);
      res.status(500).json({ error: 'Erreur serveur (réglages).' });
    }
  });

  app.patch('/api/settings/:key', authRequired, adminRequired, async (req, res) => {
    try {
      const { key } = req.params;
      const value = req.body?.value;
      if (value === undefined) return res.status(400).json({ error: 'value requis.' });
      const { rows } = await pool.query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now() RETURNING *`,
        [key, JSON.stringify(value)]
      );
      res.json(fromSnake(rows[0]));
    } catch (err) {
      console.error('PATCH /api/settings:', err.message);
      res.status(500).json({ error: 'Erreur serveur (mise à jour réglage).' });
    }
  });

  // ─── Position du livreur ────────────────────────────────────
  // Envoyée par l'appareil du livreur pendant une livraison active. On vérifie
  // que l'appelant est bien le livreur assigné à cette commande (anti-usurpation).
  app.post('/api/tracking/position', authRequired, async (req, res) => {
    const { orderId, lat, lng } = req.body || {};
    if (!orderId || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'orderId, lat et lng (nombres) requis.' });
    }
    try {
      // Le livreur assigné (via deliveries) ou un admin peut publier la position.
      if (req.user.role !== 'admin') {
        const { rows } = await pool.query(
          "SELECT 1 FROM deliveries WHERE order_id::text = $1 AND driver_id::text = $2",
          [String(orderId), String(req.user.sub)]
        );
        if (!rows[0]) return res.status(403).json({ error: 'Non assigné à cette livraison.' });
      }
      await pool.query(
        `INSERT INTO driver_positions (order_id, driver_id, lat, lng, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (order_id) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng,
           driver_id = EXCLUDED.driver_id, updated_at = now()`,
        [String(orderId), String(req.user.sub), lat, lng]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('POST /api/tracking/position:', err.message);
      res.status(500).json({ error: 'Erreur serveur (position livreur).' });
    }
  });

  // ─── Quotas : nombre RÉEL d'utilisateurs par rôle (admin) ───
  app.get('/api/admin/user-counts', authRequired, adminRequired, async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT role, count(*)::int AS n FROM users GROUP BY role");
      const out = { client: 0, restaurant: 0, livreur: 0, admin: 0 };
      for (const r of rows) if (Object.prototype.hasOwnProperty.call(out, r.role)) out[r.role] = r.n;
      res.json(out);
    } catch (err) {
      console.error('GET /api/admin/user-counts:', err.message);
      res.status(500).json({ error: 'Erreur serveur (comptes profils).' });
    }
  });

  // Lue par le client qui suit sa commande. null si aucune position réelle
  // (le client affiche alors l'estimation honnête). `stale` si trop ancienne.
  app.get('/api/tracking/position/:orderId', authRequired, async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT lat, lng, updated_at FROM driver_positions WHERE order_id::text = $1',
        [String(req.params.orderId)]
      );
      if (!rows[0]) return res.json(null);
      const ageSec = (Date.now() - new Date(rows[0].updated_at).getTime()) / 1000;
      res.json({ lat: rows[0].lat, lng: rows[0].lng, updatedAt: rows[0].updated_at, stale: ageSec > 120 });
    } catch (err) {
      console.error('GET /api/tracking/position:', err.message);
      res.status(500).json({ error: 'Erreur serveur (lecture position).' });
    }
  });
}
