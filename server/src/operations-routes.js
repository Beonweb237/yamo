// ============================================================
// Centre Opérations (série OPS) — tour de contrôle des anomalies
// ============================================================
// Liste les commandes en état anormal (dépassements SLA) pour le profil
// Dispatcher/Superviseur, avec de quoi intervenir. Le calcul des alertes fait
// foi ICI (serveur) à partir des horodatages en base et des seuils configurables
// (app_settings.operations_thresholds, défauts ci-dessous).
//
// Spec figée + 14 scénarios : app/docs/plan-ops-dashboard.md.
//
// Tables créées :
//   incidents            — signalement livreur/client (scénario 10)
//   operations_handled   — trace « pris en charge » par un dispatcher
//
// MIROIR : DEFAULT_THRESHOLDS doit rester aligné avec src/data/launchConfig.ts
// (OPS_THRESHOLDS). Toute modification d'un côté se répercute de l'autre.

const DEFAULT_THRESHOLDS = {
  PENDING_UNCONFIRMED: 5,
  CONFIRMED_NOT_PREPARING: 6,
  PREP_OVERDUE: 5,
  READY_NO_DRIVER: 8,
  GUARANTEE_UNCONFIRMED: 8,
  ASSIGNED_NO_PICKUP: 10,
  PICKED_NOT_MOVING: 5,
  DELIVERING_OVERDUE: 40,
  GPS_SILENT: 6,
  CANCELLED_AFTER_PREP_WINDOW: 60,
  STUCK: 30,
  // Fenêtre opérationnelle : au-delà, une commande non terminée est une donnée
  // abandonnée (nettoyage admin), pas une anomalie à dispatcher. En HEURES.
  LOOKBACK_HOURS: 24,
};

const SEVERITY = {
  PENDING_UNCONFIRMED: 'critical',
  CONFIRMED_NOT_PREPARING: 'warning',
  PREP_OVERDUE: 'critical',
  READY_NO_DRIVER: 'critical',
  GUARANTEE_UNCONFIRMED: 'warning',
  ASSIGNED_NO_PICKUP: 'warning',
  PICKED_NOT_MOVING: 'warning',
  DELIVERING_OVERDUE: 'critical',
  GPS_SILENT: 'warning',
  INCIDENT: 'critical',
  CANCELLED_AFTER_PREP: 'warning',
  GUARANTEE_DISPUTE: 'critical',
  STUCK: 'critical',
};

const INCIDENT_TYPES = new Set([
  'client_injoignable', 'adresse_introuvable', 'commande_incomplete',
  'livraison_refusee', 'commande_non_conforme',
]);

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivering'];

// Référence courte lisible d'une commande (ex. Y-AB12) à partir de son id.
function shortRef(id) {
  const s = String(id || '').replace(/-/g, '');
  return 'Y-' + s.slice(0, 4).toUpperCase();
}

function minutesSince(ts, now) {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 60000);
}

export function registerOperationsRoutes(app, { pool, authRequired, adminPermissionRequired, fromSnake }) {
  pool.query(`
    CREATE TABLE IF NOT EXISTS incidents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id text NOT NULL,
      driver_id text,
      type text NOT NULL,
      note text,
      reported_by text NOT NULL DEFAULT 'driver',
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz,
      resolved_by text,
      resolution_note text
    );
    CREATE INDEX IF NOT EXISTS incidents_order_idx ON incidents(order_id);
    CREATE INDEX IF NOT EXISTS incidents_status_idx ON incidents(status);

    CREATE TABLE IF NOT EXISTS operations_handled (
      order_id text PRIMARY KEY,
      handled_by text,
      handled_by_name text,
      handled_at timestamptz NOT NULL DEFAULT now(),
      note text
    );
  `).catch((e) => console.error('operations tables init:', e.message));

  // ─── Seuils effectifs (défauts + app_settings.operations_thresholds) ──
  async function loadThresholds() {
    try {
      const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = 'operations_thresholds'");
      const override = rows[0]?.value || {};
      return { ...DEFAULT_THRESHOLDS, ...override };
    } catch {
      return { ...DEFAULT_THRESHOLDS };
    }
  }

  // ─── GET /api/admin/operations — liste des alertes ──────────
  app.get('/api/admin/operations', authRequired, adminPermissionRequired('operations.view'), async (_req, res) => {
    try {
      const T = await loadThresholds();
      const now = Date.now();
      const cancelWindow = T.CANCELLED_AFTER_PREP_WINDOW ?? 60;
      const lookbackHours = T.LOOKBACK_HOURS ?? 24;

      const { rows } = await pool.query(
        `SELECT o.id, o.status, o.total, o.subtotal, o.created_at, o.updated_at, o.confirmed_at,
                o.estimated_ready_at, o.ready_at, o.preparation_eta_minutes,
                o.guarantee_status, o.guarantee_declared_at, o.driver_id, o.contact_phone,
                r.id AS restaurant_id, r.name AS restaurant_name, r.phone AS restaurant_phone,
                r.city AS r_city, r.neighborhood AS r_neigh,
                cu.full_name AS customer_name, cu.phone AS customer_phone,
                du.full_name AS driver_name, du.phone AS driver_phone,
                ad.neighborhood AS a_neigh, ad.city AS a_city,
                d.status AS deliv_status, d.assigned_at, d.picked_up_at, d.driver_id AS deliv_driver_id,
                dp.updated_at AS gps_updated_at
         FROM orders o
         LEFT JOIN restaurants r ON r.id::text = o.restaurant_id::text
         LEFT JOIN users cu ON cu.id::text = o.customer_id::text
         LEFT JOIN users du ON du.id::text = o.driver_id::text
         LEFT JOIN addresses ad ON ad.id::text = o.address_id::text
         LEFT JOIN LATERAL (
           SELECT dd.status, dd.assigned_at, dd.picked_up_at, dd.driver_id
           FROM deliveries dd WHERE dd.order_id::text = o.id::text
           ORDER BY dd.assigned_at DESC NULLS LAST LIMIT 1
         ) d ON true
         LEFT JOIN driver_positions dp ON dp.order_id::text = o.id::text
         WHERE o.status <> 'delivered'
           AND o.created_at > now() - ($2::int * interval '1 hour')
           AND (o.status <> 'cancelled' OR o.updated_at > now() - ($1::int * interval '1 minute'))`,
        [cancelWindow, lookbackHours]
      );

      // Incidents ouverts sur ce lot de commandes.
      const openInc = new Map();
      try {
        const { rows: inc } = await pool.query(
          "SELECT order_id::text AS oid, count(*)::int AS n FROM incidents WHERE status = 'open' GROUP BY order_id"
        );
        for (const i of inc) openInc.set(i.oid, i.n);
      } catch { /* table absente au 1er boot : ignorée */ }

      // « Pris en charge »
      const handledMap = new Map();
      try {
        const { rows: h } = await pool.query('SELECT * FROM operations_handled');
        for (const r of h) handledMap.set(String(r.order_id), r);
      } catch { /* ignore */ }

      const alerts = [];
      for (const o of rows) {
        const oid = String(o.id);
        const codes = [];
        const add = (code, minutes, label) => codes.push({ code, severity: SEVERITY[code], minutes: Math.max(0, minutes || 0), label });
        const st = o.status;
        const hasDriver = !!(o.driver_id || o.deliv_driver_id);

        if (st === 'pending') {
          const m = minutesSince(o.created_at, now);
          if (m !== null && m > T.PENDING_UNCONFIRMED) add('PENDING_UNCONFIRMED', m, `Non confirmée +${m} min`);
        }
        if (st === 'confirmed') {
          const m = minutesSince(o.confirmed_at || o.created_at, now);
          if (m !== null && m > T.CONFIRMED_NOT_PREPARING) add('CONFIRMED_NOT_PREPARING', m, `Préparation non lancée +${m} min`);
        }
        if (st === 'preparing') {
          const m = minutesSince(o.estimated_ready_at, now);
          if (m !== null && m > T.PREP_OVERDUE) add('PREP_OVERDUE', m, `Préparation en retard +${m} min`);
        }
        if (st === 'ready' && !hasDriver) {
          const m = minutesSince(o.ready_at || o.updated_at, now);
          if (m !== null && m > T.READY_NO_DRIVER) add('READY_NO_DRIVER', m, `Prête sans livreur +${m} min`);
        }
        if (o.guarantee_status === 'declared') {
          const m = minutesSince(o.guarantee_declared_at, now);
          if (m !== null && m > T.GUARANTEE_UNCONFIRMED) add('GUARANTEE_UNCONFIRMED', m, `Garantie non validée ${m} min`);
        }
        if (o.assigned_at && !o.picked_up_at && (st === 'ready' || st === 'picked_up')) {
          const m = minutesSince(o.assigned_at, now);
          if (m !== null && m > T.ASSIGNED_NO_PICKUP) add('ASSIGNED_NO_PICKUP', m, `Assigné sans retrait +${m} min`);
        }
        if (st === 'picked_up' && o.picked_up_at) {
          const m = minutesSince(o.picked_up_at, now);
          if (m !== null && m > T.PICKED_NOT_MOVING) add('PICKED_NOT_MOVING', m, `Récupérée, immobile ${m} min`);
        }
        if ((st === 'picked_up' || st === 'delivering') && o.picked_up_at) {
          const m = minutesSince(o.picked_up_at, now);
          if (m !== null && m > T.DELIVERING_OVERDUE) add('DELIVERING_OVERDUE', m, `Livraison en retard +${m} min`);
        }
        // GPS silencieux : uniquement en route, avec un livreur.
        const gpsAge = minutesSince(o.gps_updated_at, now);
        const hasLiveGps = gpsAge !== null && gpsAge <= 2;
        if ((st === 'picked_up' || st === 'delivering') && hasDriver) {
          if (o.gps_updated_at === null) add('GPS_SILENT', 0, 'GPS jamais reçu');
          else if (gpsAge !== null && gpsAge > T.GPS_SILENT) add('GPS_SILENT', gpsAge, `GPS silencieux ${gpsAge} min`);
        }
        if (openInc.get(oid)) add('INCIDENT', 0, 'Incident signalé');
        if (o.guarantee_status === 'forfeited') add('GUARANTEE_DISPUTE', 0, 'Litige garantie');
        if (st === 'cancelled') {
          const m = minutesSince(o.updated_at, now);
          if (o.ready_at || o.confirmed_at) add('CANCELLED_AFTER_PREP', m, 'Annulée après préparation');
        }
        // Catch-all : figée, uniquement si rien d'autre n'a été détecté.
        if (codes.length === 0 && ACTIVE_STATUSES.includes(st)) {
          const m = minutesSince(o.updated_at, now);
          if (m !== null && m > T.STUCK) add('STUCK', m, `Commande figée ${m} min`);
        }

        if (codes.length === 0) continue;

        const topSeverity = codes.some((c) => c.severity === 'critical') ? 'critical' : 'warning';
        // Ancienneté dans l'état courant.
        const stateTs = st === 'pending' ? o.created_at
          : st === 'confirmed' ? (o.confirmed_at || o.created_at)
          : st === 'preparing' ? (o.confirmed_at || o.created_at)
          : st === 'ready' ? (o.ready_at || o.updated_at)
          : (st === 'picked_up' || st === 'delivering') ? (o.picked_up_at || o.updated_at)
          : o.updated_at;
        const waitingMinutes = Math.max(0, minutesSince(stateTs, now) ?? 0);
        const handled = handledMap.get(oid) || null;

        alerts.push({
          orderId: oid,
          ref: shortRef(oid),
          status: st,
          restaurantId: o.restaurant_id ? String(o.restaurant_id) : null,
          restaurantName: o.restaurant_name || null,
          restaurantPhone: o.restaurant_phone || null,
          customerName: o.customer_name || null,
          customerPhone: o.contact_phone || o.customer_phone || null,
          neighborhood: o.a_neigh || o.r_neigh || null,
          city: o.a_city || o.r_city || null,
          driverId: o.driver_id ? String(o.driver_id) : (o.deliv_driver_id ? String(o.deliv_driver_id) : null),
          driverName: o.driver_name || null,
          driverPhone: o.driver_phone || null,
          total: Number(o.total || 0),
          waitingMinutes,
          hasLiveGps,
          codes: codes.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1)),
          topSeverity,
          handledBy: handled?.handled_by || null,
          handledByName: handled?.handled_by_name || null,
          handledAt: handled?.handled_at || null,
          handledNote: handled?.note || null,
        });
      }

      const rank = (s) => (s === 'critical' ? 0 : 1);
      alerts.sort((a, b) => {
        const ah = a.handledAt ? 1 : 0, bh = b.handledAt ? 1 : 0;
        if (ah !== bh) return ah - bh;                 // non traités d'abord
        if (rank(a.topSeverity) !== rank(b.topSeverity)) return rank(a.topSeverity) - rank(b.topSeverity);
        return b.waitingMinutes - a.waitingMinutes;     // plus ancien d'abord
      });

      const counts = { critical: 0, warning: 0, handled: 0 };
      for (const a of alerts) {
        if (a.handledAt) counts.handled++;
        else if (a.topSeverity === 'critical') counts.critical++;
        else counts.warning++;
      }

      res.json({ generatedAt: new Date().toISOString(), counts, thresholds: T, alerts });
    } catch (err) {
      console.error('GET /api/admin/operations:', err.message);
      res.status(500).json({ error: 'Erreur serveur (centre opérations).' });
    }
  });

  // ─── POST /api/admin/operations/:orderId/handle — pris en charge ──
  app.post('/api/admin/operations/:orderId/handle', authRequired, adminPermissionRequired('operations.handle'), async (req, res) => {
    try {
      const orderId = String(req.params.orderId);
      const note = (req.body?.note || '').toString().slice(0, 500) || null;
      let name = null;
      try {
        const { rows } = await pool.query('SELECT full_name FROM users WHERE id::text = $1', [String(req.user.sub)]);
        name = rows[0]?.full_name || null;
      } catch { /* ignore */ }
      const { rows } = await pool.query(
        `INSERT INTO operations_handled (order_id, handled_by, handled_by_name, handled_at, note)
         VALUES ($1, $2, $3, now(), $4)
         ON CONFLICT (order_id) DO UPDATE SET handled_by = EXCLUDED.handled_by,
           handled_by_name = EXCLUDED.handled_by_name, handled_at = now(), note = EXCLUDED.note
         RETURNING *`,
        [orderId, String(req.user.sub), name, note]
      );
      res.json(fromSnake(rows[0]));
    } catch (err) {
      console.error('POST /api/admin/operations/handle:', err.message);
      res.status(500).json({ error: 'Erreur serveur (pris en charge).' });
    }
  });

  // ─── DELETE /api/admin/operations/:orderId/handle — annuler ──
  app.delete('/api/admin/operations/:orderId/handle', authRequired, adminPermissionRequired('operations.handle'), async (req, res) => {
    try {
      await pool.query('DELETE FROM operations_handled WHERE order_id = $1', [String(req.params.orderId)]);
      res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/admin/operations/handle:', err.message);
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  });

  // ─── POST /api/incidents — signalement (livreur assigné ou admin) ──
  app.post('/api/incidents', authRequired, async (req, res) => {
    const { orderId, type, note, reportedBy } = req.body || {};
    if (!orderId || !type || !INCIDENT_TYPES.has(type)) {
      return res.status(400).json({ error: 'orderId et type (valide) requis.' });
    }
    try {
      if (req.user.role !== 'admin') {
        const { rows } = await pool.query(
          'SELECT 1 FROM deliveries WHERE order_id::text = $1 AND driver_id::text = $2',
          [String(orderId), String(req.user.sub)]
        );
        if (!rows[0]) return res.status(403).json({ error: 'Non assigné à cette livraison.' });
      }
      const { rows } = await pool.query(
        `INSERT INTO incidents (order_id, driver_id, type, note, reported_by, status)
         VALUES ($1, $2, $3, $4, $5, 'open') RETURNING *`,
        [String(orderId), String(req.user.sub), type, (note || '').toString().slice(0, 500) || null, reportedBy === 'customer' ? 'customer' : 'driver']
      );
      res.json(fromSnake(rows[0]));
    } catch (err) {
      console.error('POST /api/incidents:', err.message);
      res.status(500).json({ error: 'Erreur serveur (incident).' });
    }
  });

  // ─── GET /api/admin/incidents — liste (admin) ──
  app.get('/api/admin/incidents', authRequired, adminPermissionRequired('operations.view'), async (_req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM incidents ORDER BY created_at DESC LIMIT 200');
      res.json(rows.map(fromSnake));
    } catch (err) {
      console.error('GET /api/admin/incidents:', err.message);
      res.status(500).json({ error: 'Erreur serveur (incidents).' });
    }
  });

  // ─── POST /api/admin/incidents/:id/resolve ──
  app.post('/api/admin/incidents/:id/resolve', authRequired, adminPermissionRequired('operations.handle'), async (req, res) => {
    try {
      const note = (req.body?.resolutionNote || '').toString().slice(0, 500) || null;
      const { rows } = await pool.query(
        `UPDATE incidents SET status = 'resolved', resolved_at = now(), resolved_by = $2, resolution_note = $3
         WHERE id::text = $1 RETURNING *`,
        [String(req.params.id), String(req.user.sub), note]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Incident introuvable.' });
      res.json(fromSnake(rows[0]));
    } catch (err) {
      console.error('POST /api/admin/incidents/resolve:', err.message);
      res.status(500).json({ error: 'Erreur serveur (résolution incident).' });
    }
  });
}
