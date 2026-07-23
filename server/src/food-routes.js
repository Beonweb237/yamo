// ============================================================
// Module Alimentaire (série FOOD) — profil, programmes, abonnements
// ============================================================
// Additif : ne touche pas le flux commande existant. Les livraisons d'abonnement
// réutilisent le pipeline commande normal. Tables dédiées (l'utilisateur DB ne
// possède pas users/orders). Spec : app/docs/plan-module-alimentaire.md.

const OBJECTIVES = new Set(['perte_poids', 'maintien', 'prise_masse', 'equilibre']);
const PROGRAM_STATUS = new Set(['draft', 'published', 'archived']);
const COMMISSION_RATE = 0.15;

// Dates de livraison d'un abonnement à partir du calendrier du programme.
function computeDeliveryDates(startDate, schedule, durationWeeks, mealsCount) {
  const dates = [];
  const start = new Date(String(startDate) + 'T00:00:00Z');
  if (Number.isNaN(start.getTime())) return dates;
  const totalDays = Math.max(1, (durationWeeks || 1) * 7);
  const cap = mealsCount || totalDays;
  const jourMap = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
  const jours = Array.isArray(schedule?.jours) && schedule.jours.length
    ? schedule.jours.map((j) => jourMap[String(j).toLowerCase()]).filter((x) => x != null)
    : null;
  for (let d = 0; d < totalDays && dates.length < cap; d++) {
    const day = new Date(start); day.setUTCDate(start.getUTCDate() + d);
    const dow = day.getUTCDay();
    if (schedule?.frequence === 'hebdomadaire') {
      if (jours ? jours.includes(dow) : d % 7 === 0) dates.push(day.toISOString().slice(0, 10));
    } else { // quotidien (défaut)
      if (!jours || jours.includes(dow)) dates.push(day.toISOString().slice(0, 10));
    }
  }
  return dates;
}

// Génère les commandes des livraisons d'abonnement DUES (jusqu'à current_date +
// horizonDays). Idempotent (UNIQUE(subscription_id, scheduled_for) + order_id IS
// NULL) → sûr à rejouer aussi souvent qu'on veut. Réutilisé par l'endpoint admin
// ET le planificateur interne. Commandes COD normales (livreur rémunéré).
export async function runSubscriptionGeneration(pool, horizonDays = 1) {
  const hz = Math.max(0, Math.min(7, parseInt(horizonDays) || 1));
  const { rows: due } = await pool.query(
    `SELECT d.id AS delivery_id, d.subscription_id, d.scheduled_for, s.id AS sub_pk, s.customer_id, s.restaurant_id,
            s.delivery_address_id, s.delivery_address, s.price_fcfa, r.city AS resto_city,
            (SELECT count(*) FROM subscription_deliveries x WHERE x.subscription_id = s.id::text) AS total
     FROM subscription_deliveries d
     JOIN subscriptions s ON s.id::text = d.subscription_id
     JOIN restaurants r ON r.id::text = s.restaurant_id::text
     WHERE d.order_id IS NULL AND d.status='scheduled' AND s.status='active'
       AND d.scheduled_for <= (current_date + ($1::int))`,
    [hz]
  );
  let created = 0;
  const { rows: [feeRow] } = await pool.query('SELECT compute_delivery_fee(0) AS fee');
  const deliveryFee = parseInt(feeRow?.fee) || 0;
  for (const d of due) {
    const perMeal = Math.max(0, Math.round(Number(d.price_fcfa || 0) / Math.max(1, Number(d.total || 1))));
    let addressId = d.delivery_address_id;
    if (!addressId) {
      try {
        const { rows: [addr] } = await pool.query(
          `INSERT INTO addresses (user_id, label, city, full_text) VALUES ($1,'Abonnement',$2,$3) RETURNING id`,
          [String(d.customer_id), d.resto_city || null, d.delivery_address || 'Adresse abonnement']
        );
        addressId = addr.id;
        await pool.query('UPDATE subscriptions SET delivery_address_id=$2 WHERE id=$1', [d.sub_pk, String(addressId)]);
      } catch (e) { console.warn('addr abo:', e.message); }
    }
    const { rows: [order] } = await pool.query(
      `INSERT INTO orders (customer_id, restaurant_id, address_id, status, subtotal, delivery_fee, total, payment_method, payment_status, notes, fee_breakdown, created_at, updated_at)
       VALUES ($1,$2,$3,'pending',$4,$7,$8,'cash','pending',$6,$5,now(),now()) RETURNING id`,
      [String(d.customer_id), String(d.restaurant_id), addressId || null, perMeal,
       JSON.stringify({ payment_mode: 'cod', subscription_id: String(d.subscription_id), subscription_meal: true }),
       d.delivery_address ? `Livraison abonnement — ${d.delivery_address}` : 'Livraison abonnement',
       deliveryFee, perMeal + deliveryFee]
    );
    await pool.query('UPDATE subscription_deliveries SET order_id=$2 WHERE id=$1', [d.delivery_id, String(order.id)]);
    created++;
  }
  await pool.query(`
    UPDATE subscriptions s SET next_delivery_at = (
      SELECT min(d.scheduled_for) FROM subscription_deliveries d
      LEFT JOIN orders o ON o.id::text = d.order_id
      WHERE d.subscription_id = s.id::text AND (d.order_id IS NULL OR o.status <> 'delivered')
    ), updated_at = now() WHERE s.status = 'active'`);
  await pool.query(`
    UPDATE subscriptions s SET status='completed', updated_at=now()
    WHERE s.status='active'
      AND (SELECT count(*) FROM subscription_deliveries d WHERE d.subscription_id = s.id::text) > 0
      AND NOT EXISTS (
        SELECT 1 FROM subscription_deliveries d LEFT JOIN orders o ON o.id::text = d.order_id
        WHERE d.subscription_id = s.id::text AND (d.order_id IS NULL OR o.status <> 'delivered')
      )`);
  return { due: due.length, ordersCreated: created };
}

export function registerFoodRoutes(app, { pool, authRequired, adminPermissionRequired, fromSnake }) {
  pool.query(`
    CREATE TABLE IF NOT EXISTS food_profiles (
      user_id text PRIMARY KEY,
      health_conditions text[] NOT NULL DEFAULT '{}',
      preferences text[] NOT NULL DEFAULT '{}',
      allergies text,
      objective text,
      forbidden_foods text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS meal_programs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id text NOT NULL,
      name text NOT NULL,
      description text,
      target_audience text,
      dietary_tags text[] NOT NULL DEFAULT '{}',
      duration_weeks integer NOT NULL DEFAULT 4,
      meals_count integer NOT NULL DEFAULT 28,
      schedule jsonb NOT NULL DEFAULT '{}',
      price_fcfa integer NOT NULL DEFAULT 0,
      photo_url text,
      status text NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS meal_programs_resto_idx ON meal_programs(restaurant_id);
    -- LOT 5 fiche programme : contenu éditorial saisi par le resto (facultatif).
    ALTER TABLE meal_programs ADD COLUMN IF NOT EXISTS benefits text[];
    ALTER TABLE meal_programs ADD COLUMN IF NOT EXISTS sample_menu jsonb;
    CREATE TABLE IF NOT EXISTS subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id text NOT NULL,
      program_id text NOT NULL,
      restaurant_id text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      start_date date NOT NULL,
      next_delivery_at date,
      schedule jsonb NOT NULL DEFAULT '{}',
      cycle_index integer NOT NULL DEFAULT 1,
      price_fcfa integer NOT NULL DEFAULT 0,
      delivery_address_id text,
      delivery_address text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS subscriptions_customer_idx ON subscriptions(customer_id);
    CREATE TABLE IF NOT EXISTS subscription_deliveries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_id text NOT NULL,
      scheduled_for date NOT NULL,
      order_id text,
      status text NOT NULL DEFAULT 'scheduled',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (subscription_id, scheduled_for)
    );
    CREATE INDEX IF NOT EXISTS sub_deliveries_sub_idx ON subscription_deliveries(subscription_id);
  `).catch((e) => console.error('food tables init:', e.message));

  // Le user peut-il gérer ce restaurant (admin, ou propriétaire) ?
  async function canManageRestaurant(req, restaurantId) {
    if (req.user.role === 'admin') return true;
    const { rows } = await pool.query('SELECT owner_id FROM restaurants WHERE id::text = $1', [String(restaurantId)]);
    return !!rows[0] && String(rows[0].owner_id) === String(req.user.sub);
  }

  const arr = (v) => Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 40).map((x) => String(x).slice(0, 40)) : [];
  const txt = (v, n = 500) => (v == null ? null : String(v).slice(0, n));

  // ─── Profil alimentaire du client courant ───────────────────
  app.get('/api/food-profile', authRequired, async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM food_profiles WHERE user_id = $1', [String(req.user.sub)]);
      res.json(rows[0] ? fromSnake(rows[0]) : null);
    } catch (err) {
      console.error('GET /api/food-profile:', err.message);
      res.status(500).json({ error: 'Erreur serveur (profil alimentaire).' });
    }
  });

  app.put('/api/food-profile', authRequired, async (req, res) => {
    try {
      const b = req.body || {};
      const objective = OBJECTIVES.has(b.objective) ? b.objective : null;
      const { rows } = await pool.query(
        `INSERT INTO food_profiles (user_id, health_conditions, preferences, allergies, objective, forbidden_foods, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (user_id) DO UPDATE SET health_conditions = EXCLUDED.health_conditions,
           preferences = EXCLUDED.preferences, allergies = EXCLUDED.allergies,
           objective = EXCLUDED.objective, forbidden_foods = EXCLUDED.forbidden_foods, updated_at = now()
         RETURNING *`,
        [String(req.user.sub), arr(b.healthConditions), arr(b.preferences), txt(b.allergies), objective, txt(b.forbiddenFoods)]
      );
      res.json(fromSnake(rows[0]));
    } catch (err) {
      console.error('PUT /api/food-profile:', err.message);
      res.status(500).json({ error: 'Erreur serveur (enregistrement profil).' });
    }
  });

  // ═══════════════ Programmes (meal_programs) ═══════════════
  const cleanProgram = (b) => ({
    name: txt(b.name, 120), description: txt(b.description, 2000),
    target_audience: txt(b.targetAudience, 120),
    dietary_tags: arr(b.dietaryTags),
    duration_weeks: Math.max(1, Math.min(52, parseInt(b.durationWeeks) || 4)),
    meals_count: Math.max(1, Math.min(365, parseInt(b.mealsCount) || 28)),
    schedule: b.schedule && typeof b.schedule === 'object' ? b.schedule : {},
    price_fcfa: Math.max(0, Math.round(Number(b.priceFcfa) || 0)),
    photo_url: txt(b.photoUrl, 500),
    // LOT 5 : bénéfices (max 4 puces) + plats d'exemple choisis par le resto
    // ({id?, name, price?} — max 6, texte borné, rien d'autre n'est accepté).
    benefits: Array.isArray(b.benefits)
      ? b.benefits.filter((x) => typeof x === 'string' && x.trim()).slice(0, 4).map((x) => String(x).trim().slice(0, 80))
      : [],
    sample_menu: Array.isArray(b.sampleMenu)
      ? b.sampleMenu.slice(0, 6)
        .filter((x) => x && typeof x === 'object' && typeof x.name === 'string' && x.name.trim())
        .map((x) => ({
          id: x.id != null ? String(x.id).slice(0, 60) : undefined,
          name: String(x.name).slice(0, 120),
          price: Number.isFinite(Number(x.price)) ? Math.max(0, Math.round(Number(x.price))) : undefined,
        }))
      : null,
  });

  // Liste publique des programmes publiés (+ resto)
  app.get('/api/meal-programs', async (req, res) => {
    try {
      const filters = ["mp.status = 'published'"]; const vals = [];
      if (req.query.city) { vals.push(String(req.query.city)); filters.push(`r.city = $${vals.length}`); }
      const { rows } = await pool.query(
        `SELECT mp.*, r.name AS restaurant_name, r.city AS restaurant_city, r.image AS restaurant_image
         FROM meal_programs mp JOIN restaurants r ON r.id::text = mp.restaurant_id::text
         WHERE ${filters.join(' AND ')} ORDER BY mp.created_at DESC LIMIT 200`, vals
      );
      res.json(rows.map(fromSnake));
    } catch (err) { console.error('GET meal-programs:', err.message); res.status(500).json({ error: 'Erreur serveur (programmes).' }); }
  });

  // Programmes de mon restaurant (restaurateur)
  app.get('/api/meal-programs/mine', authRequired, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT mp.* FROM meal_programs mp JOIN restaurants r ON r.id::text = mp.restaurant_id::text
         WHERE r.owner_id::text = $1 ORDER BY mp.created_at DESC`, [String(req.user.sub)]
      );
      res.json(rows.map(fromSnake));
    } catch (err) { console.error('GET meal-programs/mine:', err.message); res.status(500).json({ error: 'Erreur serveur.' }); }
  });

  app.get('/api/meal-programs/:id', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT mp.*, r.name AS restaurant_name, r.city AS restaurant_city, r.phone AS restaurant_phone
         FROM meal_programs mp JOIN restaurants r ON r.id::text = mp.restaurant_id::text WHERE mp.id::text = $1`,
        [String(req.params.id)]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Programme introuvable.' });
      res.json(fromSnake(rows[0]));
    } catch (err) { console.error('GET meal-programs/:id:', err.message); res.status(500).json({ error: 'Erreur serveur.' }); }
  });

  app.post('/api/meal-programs', authRequired, async (req, res) => {
    try {
      let restaurantId = req.body?.restaurantId;
      // Dérive le restaurant du propriétaire si non fourni (le restaurateur n'a pas
      // à connaître l'id de son restaurant).
      if (!restaurantId && req.user.role === 'restaurant') {
        const { rows } = await pool.query('SELECT id FROM restaurants WHERE owner_id::text = $1 ORDER BY created_at LIMIT 1', [String(req.user.sub)]);
        restaurantId = rows[0]?.id;
      }
      if (!restaurantId) return res.status(400).json({ error: 'restaurantId requis.' });
      if (!(await canManageRestaurant(req, restaurantId))) return res.status(403).json({ error: 'Non autorisé sur ce restaurant.' });
      const c = cleanProgram(req.body || {});
      if (!c.name) return res.status(400).json({ error: 'Nom du programme requis.' });
      const { rows } = await pool.query(
        `INSERT INTO meal_programs (restaurant_id, name, description, target_audience, dietary_tags, duration_weeks, meals_count, schedule, price_fcfa, photo_url, benefits, sample_menu, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft') RETURNING *`,
        [String(restaurantId), c.name, c.description, c.target_audience, c.dietary_tags, c.duration_weeks, c.meals_count, JSON.stringify(c.schedule), c.price_fcfa, c.photo_url, c.benefits, c.sample_menu ? JSON.stringify(c.sample_menu) : null]
      );
      res.status(201).json(fromSnake(rows[0]));
    } catch (err) { console.error('POST meal-programs:', err.message); res.status(500).json({ error: 'Erreur serveur (création programme).' }); }
  });

  app.put('/api/meal-programs/:id', authRequired, async (req, res) => {
    try {
      const { rows: [prog] } = await pool.query('SELECT restaurant_id FROM meal_programs WHERE id::text = $1', [String(req.params.id)]);
      if (!prog) return res.status(404).json({ error: 'Programme introuvable.' });
      if (!(await canManageRestaurant(req, prog.restaurant_id))) return res.status(403).json({ error: 'Non autorisé.' });
      const c = cleanProgram(req.body || {});
      const { rows } = await pool.query(
        `UPDATE meal_programs SET name=$2, description=$3, target_audience=$4, dietary_tags=$5, duration_weeks=$6, meals_count=$7, schedule=$8, price_fcfa=$9, photo_url=$10, benefits=$11, sample_menu=$12, updated_at=now()
         WHERE id::text = $1 RETURNING *`,
        [String(req.params.id), c.name, c.description, c.target_audience, c.dietary_tags, c.duration_weeks, c.meals_count, JSON.stringify(c.schedule), c.price_fcfa, c.photo_url, c.benefits, c.sample_menu ? JSON.stringify(c.sample_menu) : null]
      );
      res.json(fromSnake(rows[0]));
    } catch (err) { console.error('PUT meal-programs/:id:', err.message); res.status(500).json({ error: 'Erreur serveur.' }); }
  });

  app.post('/api/meal-programs/:id/status', authRequired, async (req, res) => {
    try {
      const status = req.body?.status;
      if (!PROGRAM_STATUS.has(status)) return res.status(400).json({ error: 'status invalide.' });
      const { rows: [prog] } = await pool.query('SELECT restaurant_id FROM meal_programs WHERE id::text = $1', [String(req.params.id)]);
      if (!prog) return res.status(404).json({ error: 'Programme introuvable.' });
      if (!(await canManageRestaurant(req, prog.restaurant_id))) return res.status(403).json({ error: 'Non autorisé.' });
      const { rows } = await pool.query('UPDATE meal_programs SET status=$2, updated_at=now() WHERE id::text=$1 RETURNING *', [String(req.params.id), status]);
      res.json(fromSnake(rows[0]));
    } catch (err) { console.error('POST meal-programs/status:', err.message); res.status(500).json({ error: 'Erreur serveur.' }); }
  });

  // ═══════════════ Abonnements (subscriptions) ═══════════════
  // Souscrire à un programme → crée l'abonnement + planifie les livraisons.
  app.post('/api/subscriptions', authRequired, async (req, res) => {
    try {
      const { programId, startDate, addressId, deliveryAddress } = req.body || {};
      if (!programId || !startDate) return res.status(400).json({ error: 'programId et startDate requis.' });
      const { rows: [prog] } = await pool.query("SELECT * FROM meal_programs WHERE id::text = $1 AND status = 'published'", [String(programId)]);
      if (!prog) return res.status(404).json({ error: 'Programme introuvable ou non publié.' });
      const { rows: [sub] } = await pool.query(
        `INSERT INTO subscriptions (customer_id, program_id, restaurant_id, status, start_date, schedule, cycle_index, price_fcfa, delivery_address_id, delivery_address, next_delivery_at)
         VALUES ($1,$2,$3,'active',$4,$5,1,$6,$7,$8,$4) RETURNING *`,
        [String(req.user.sub), String(programId), String(prog.restaurant_id), String(startDate), JSON.stringify(prog.schedule), prog.price_fcfa, addressId ? String(addressId) : null, txt(deliveryAddress, 300)]
      );
      // Planifie toutes les dates de livraison du cycle.
      const dates = computeDeliveryDates(startDate, prog.schedule, prog.duration_weeks, prog.meals_count);
      for (const d of dates) {
        await pool.query(
          `INSERT INTO subscription_deliveries (subscription_id, scheduled_for, status) VALUES ($1,$2,'scheduled')
           ON CONFLICT (subscription_id, scheduled_for) DO NOTHING`,
          [String(sub.id), d]
        );
      }
      if (dates[0]) await pool.query('UPDATE subscriptions SET next_delivery_at=$2 WHERE id=$1', [sub.id, dates[0]]);
      res.status(201).json({ ...fromSnake(sub), plannedDeliveries: dates.length });
    } catch (err) { console.error('POST subscriptions:', err.message); res.status(500).json({ error: 'Erreur serveur (souscription).' }); }
  });

  app.get('/api/subscriptions/mine', authRequired, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT s.*, mp.name AS program_name, mp.photo_url AS program_photo, r.name AS restaurant_name,
                (SELECT count(*) FROM subscription_deliveries d WHERE d.subscription_id = s.id::text) AS deliveries_total,
                -- livraisons faites = commandes liées effectivement livrées (source de vérité : la commande)
                (SELECT count(*) FROM subscription_deliveries d JOIN orders o ON o.id::text = d.order_id
                   WHERE d.subscription_id = s.id::text AND o.status = 'delivered') AS deliveries_done
         FROM subscriptions s
         JOIN meal_programs mp ON mp.id::text = s.program_id::text
         JOIN restaurants r ON r.id::text = s.restaurant_id::text
         WHERE s.customer_id = $1 ORDER BY s.created_at DESC`, [String(req.user.sub)]
      );
      res.json(rows.map(fromSnake));
    } catch (err) { console.error('GET subscriptions/mine:', err.message); res.status(500).json({ error: 'Erreur serveur.' }); }
  });

  async function subOwnedOrAdmin(req, id) {
    if (req.user.role === 'admin') return true;
    const { rows } = await pool.query('SELECT customer_id FROM subscriptions WHERE id::text = $1', [String(id)]);
    return !!rows[0] && String(rows[0].customer_id) === String(req.user.sub);
  }
  const setSubStatus = (target) => async (req, res) => {
    try {
      if (!(await subOwnedOrAdmin(req, req.params.id))) return res.status(403).json({ error: 'Non autorisé.' });
      const { rows } = await pool.query('UPDATE subscriptions SET status=$2, updated_at=now() WHERE id::text=$1 RETURNING *', [String(req.params.id), target]);
      if (!rows[0]) return res.status(404).json({ error: 'Abonnement introuvable.' });
      res.json(fromSnake(rows[0]));
    } catch (err) { console.error('subscription status:', err.message); res.status(500).json({ error: 'Erreur serveur.' }); }
  };
  app.post('/api/subscriptions/:id/pause', authRequired, setSubStatus('paused'));
  app.post('/api/subscriptions/:id/resume', authRequired, setSubStatus('active'));
  app.post('/api/subscriptions/:id/cancel', authRequired, setSubStatus('cancelled'));

  // Génération des commandes pour les livraisons dues (admin/cron). Idempotent.
  app.post('/api/subscriptions/generate', authRequired, adminPermissionRequired('food.subscriptions.manage'), async (req, res) => {
    try {
      const result = await runSubscriptionGeneration(pool, req.body?.horizonDays);
      res.json(result);
    } catch (err) { console.error('POST subscriptions/generate:', err.message); res.status(500).json({ error: 'Erreur serveur (génération).' }); }
  });

  // ── Planificateur interne : matérialise les livraisons d'abonnement dues,
  //    au démarrage (après 30 s) puis toutes les heures. Idempotent → rejouable
  //    sans risque de doublon. Remplace la dépendance à un clic admin quotidien.
  //    (API en fork mono-instance ; l'idempotence couvre un éventuel doublon.)
  const runScheduledGeneration = () =>
    runSubscriptionGeneration(pool, 1)
      .then((r) => { if (r.ordersCreated) console.log(`[abo-scheduler] ${r.ordersCreated} commande(s) d'abonnement générée(s) (${r.due} due(s))`); })
      .catch((e) => console.error('[abo-scheduler]', e.message));
  setTimeout(runScheduledGeneration, 30000);
  setInterval(runScheduledGeneration, 60 * 60 * 1000);

  // Admin : tous les abonnements
  app.get('/api/admin/subscriptions', authRequired, adminPermissionRequired('food.subscriptions.view'), async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT s.*, mp.name AS program_name, r.name AS restaurant_name, u.full_name AS customer_name, u.phone AS customer_phone,
                (SELECT count(*) FROM subscription_deliveries d WHERE d.subscription_id = s.id::text) AS deliveries_total
         FROM subscriptions s
         JOIN meal_programs mp ON mp.id::text = s.program_id::text
         JOIN restaurants r ON r.id::text = s.restaurant_id::text
         LEFT JOIN users u ON u.id::text = s.customer_id::text
         ORDER BY s.created_at DESC LIMIT 500`
      );
      const counts = { active: 0, paused: 0, cancelled: 0, completed: 0 };
      for (const s of rows) counts[s.status] = (counts[s.status] || 0) + 1;
      res.json({ counts, subscriptions: rows.map(fromSnake) });
    } catch (err) { console.error('GET admin/subscriptions:', err.message); res.status(500).json({ error: 'Erreur serveur.' }); }
  });
}
