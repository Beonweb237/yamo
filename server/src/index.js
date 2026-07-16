// ============================================================
// Miamexpress — Backend API (remplace Supabase)
// ============================================================
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { initiatePayment, getSaleStatus } from './chariow.js';

dotenv.config({ path: new URL('../.env.server', import.meta.url) });

const { Pool } = pg;
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const PORT = process.env.API_PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'REMOVED_SECRET';
const SALT_ROUNDS = 10;

// ─── Database ─────────────────────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'miamexpress',
  user: process.env.DB_USER || 'miamexpress',
  password: process.env.DB_PASSWORD || 'REMOVED_SECRET',
});

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth middleware
function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requis' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
}

function adminRequired(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin uniquement' });
  next();
}

// users/profiles carry auth secrets (password_hash, otp_code) and role/approval
// flags — never list them publicly, never let a non-admin write role/approval
// on themselves, and never echo the secret columns back even to their owner.
const SENSITIVE_TABLES = new Set(['users', 'profiles']);
const SECRET_USER_FIELDS = ['password_hash', 'otp_code', 'otp_expires_at'];
const ADMIN_ONLY_USER_FIELDS = ['role', 'is_approved', 'is_suspended', 'suspension_reason', 'password_hash'];

function stripSecretFields(row) {
  if (!row || typeof row !== 'object') return row;
  const clean = { ...row };
  for (const f of SECRET_USER_FIELDS) delete clean[f];
  return clean;
}

// ─── Helpers ──────────────────────────────────────────────────
function buildWhere(filters) {
  if (!filters || !filters.length) return ['', []];
  const clauses = [];
  const values = [];
  let idx = 1;
  for (const [col, op, val] of filters) {
    if (op === 'eq') { clauses.push(`${col} = $${idx}`); values.push(val); idx++; }
    else if (op === 'in') { clauses.push(`${col} = ANY($${idx})`); values.push(val); idx++; }
    else if (op === 'neq') { clauses.push(`${col} != $${idx}`); values.push(val); idx++; }
    else if (op === 'is') { clauses.push(`${col} IS ${val === null ? 'NULL' : 'NOT NULL'}`); }
    else if (op === 'gte') { clauses.push(`${col} >= $${idx}`); values.push(val); idx++; }
    else if (op === 'lte') { clauses.push(`${col} <= $${idx}`); values.push(val); idx++; }
  }
  return [clauses.length ? ' WHERE ' + clauses.join(' AND ') : '', values];
}

function buildOrder(sort) {
  if (!sort) return '';
  const [col, dir] = sort;
  return ` ORDER BY ${col} ${dir === 'desc' ? 'DESC' : 'ASC'}`;
}

function buildPagination(page, limit, startIdx) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const idx = startIdx || 1000;
  return [` LIMIT $${idx} OFFSET $${idx + 1}`, [l, (p - 1) * l], p, l];
}

// Custom PG-JSON serializer: convert camelCase JS keys to snake_case SQL columns
function toSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())] = v;
  }
  return out;
}

function fromSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}

// ─── Routes spécifiques (AVANT les génériques) ─────────────────

// ── Demandes Culinaires (Food Requests & Bids) ──
app.post('/api/food-requests', authRequired, async (req, res) => {
  try {
    const { title, description, city, budgetMin, budgetMax, dietaryTags, preparationNotes, deliverySchedule, deliveryAddress, deliveryLat, deliveryLng } = req.body;
    if (!title || !description || !city || !budgetMin || !budgetMax) return res.status(400).json({ error: 'Titre, description, ville et budget requis' });
    const { rows: [request] } = await pool.query(
      `INSERT INTO food_requests (customer_id, title, description, city, budget_min, budget_max, dietary_tags, preparation_notes, delivery_schedule, delivery_address, delivery_lat, delivery_lng) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user.sub, title, description, city, budgetMin, budgetMax, dietaryTags || [], preparationNotes || null, deliverySchedule || null, deliveryAddress || null, deliveryLat || null, deliveryLng || null]
    );
    io.emit('realtime:food_requests', { eventType: 'INSERT', new: fromSnake(request) });
    res.status(201).json(fromSnake(request));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/food-requests — Liste avec filtre optionnel par ville
app.get('/api/food-requests', async (req, res) => {
  try {
    const city = req.query.city;
    let query = `SELECT fr.*, u.full_name AS customer_name, (SELECT count(*) FROM food_bids WHERE request_id = fr.id) AS bid_count FROM food_requests fr JOIN users u ON fr.customer_id = u.id WHERE fr.status = 'open' AND fr.expires_at > now()`;
    const params = [];
    if (city) { query += ` AND fr.city = $1`; params.push(city); }
    query += ` ORDER BY fr.created_at DESC LIMIT 50`;
    const { rows } = await pool.query(query, params);
    res.json({ data: rows.map(fromSnake), count: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/food-requests/available', authRequired, async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: 'Ville requise' });
    const { rows } = await pool.query(
      `SELECT fr.*, u.full_name AS customer_name, u.phone AS customer_phone, (SELECT count(*) FROM food_bids WHERE request_id = fr.id) AS bid_count FROM food_requests fr JOIN users u ON fr.customer_id = u.id WHERE fr.city = $1 AND fr.status = 'open' AND fr.expires_at > now() ORDER BY fr.created_at DESC`,
      [city]
    );
    res.json({ data: rows.map(fromSnake), count: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/food-requests/mine', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT fr.*, (SELECT count(*) FROM food_bids WHERE request_id = fr.id) AS bid_count, (SELECT json_agg(json_build_object('id', fb.id, 'restaurant_id', fb.restaurant_id, 'price', fb.price, 'comment', fb.comment, 'status', fb.status, 'restaurant_name', r.name, 'created_at', fb.created_at)) FROM food_bids fb JOIN restaurants r ON fb.restaurant_id = r.id WHERE fb.request_id = fr.id) AS bids FROM food_requests fr WHERE fr.customer_id = $1 ORDER BY fr.created_at DESC`,
      [req.user.sub]
    );
    res.json({ data: rows.map(r => { const x = fromSnake(r); x.bids = x.bids || []; return x; }), count: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/food-requests/:id', async (req, res) => {
  try {
    const { rows: [fr] } = await pool.query(`SELECT fr.*, u.full_name AS customer_name, u.phone AS customer_phone FROM food_requests fr JOIN users u ON fr.customer_id = u.id WHERE fr.id = $1`, [req.params.id]);
    if (!fr) return res.status(404).json({ error: 'Demande non trouvée' });
    const { rows: bids } = await pool.query(`SELECT fb.*, r.name AS restaurant_name, r.photo_url AS restaurant_photo FROM food_bids fb JOIN restaurants r ON fb.restaurant_id = r.id WHERE fb.request_id = $1 ORDER BY fb.created_at DESC`, [req.params.id]);
    res.json({ ...fromSnake(fr), bids: bids.map(fromSnake) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/food-requests/:id/bids', authRequired, async (req, res) => {
  try {
    const { price, comment } = req.body;
    if (!price) return res.status(400).json({ error: 'Prix requis' });
    const { rows: [fr] } = await pool.query('SELECT * FROM food_requests WHERE id = $1', [req.params.id]);
    if (!fr) return res.status(404).json({ error: 'Demande non trouvée' });
    if (fr.status !== 'open') return res.status(400).json({ error: 'Cette demande est fermée' });
    if (req.user.sub === fr.customer_id) return res.status(400).json({ error: 'Vous ne pouvez pas soumissionner sur votre propre demande' });
    const { rows: [resto] } = await pool.query('SELECT * FROM restaurants WHERE owner_id = $1', [req.user.sub]);
    if (!resto) return res.status(403).json({ error: 'Seuls les restaurants peuvent soumissionner' });
    const { rows: [existing] } = await pool.query('SELECT id FROM food_bids WHERE request_id = $1 AND restaurant_id = $2', [req.params.id, resto.id]);
    if (existing) return res.status(409).json({ error: 'Vous avez déjà soumissionné' });
    const { rows: [bid] } = await pool.query(`INSERT INTO food_bids (request_id, restaurant_id, price, comment) VALUES ($1,$2,$3,$4) RETURNING *`, [req.params.id, resto.id, price, comment || null]);
    const result = { ...fromSnake(bid), restaurantName: resto.name };
    io.emit('realtime:food_bids', { eventType: 'INSERT', new: result });
    io.emit(`user:${fr.customer_id}`, { type: 'new_bid', requestId: fr.id, requestTitle: fr.title, restaurantName: resto.name, price });
    res.status(201).json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/food-requests/:id/accept/:bidId', authRequired, async (req, res) => {
  try {
    const { rows: [fr] } = await pool.query('SELECT * FROM food_requests WHERE id = $1', [req.params.id]);
    if (!fr) return res.status(404).json({ error: 'Demande non trouvée' });
    if (fr.customer_id !== req.user.sub) return res.status(403).json({ error: 'Non autorisé' });
    if (fr.status !== 'open') return res.status(400).json({ error: 'Demande déjà fermée' });
    await pool.query("UPDATE food_bids SET status = 'accepted' WHERE id = $1 AND request_id = $2", [req.params.bidId, req.params.id]);
    await pool.query("UPDATE food_bids SET status = 'rejected' WHERE request_id = $1 AND id != $2 AND status = 'pending'", [req.params.id, req.params.bidId]);
    const { rows: [updatedRequest] } = await pool.query("UPDATE food_requests SET status = 'accepted', accepted_bid_id = $2, updated_at = now() WHERE id = $1 RETURNING *", [req.params.id, req.params.bidId]);
    const { rows: [bid] } = await pool.query('SELECT fb.*, r.name AS restaurant_name FROM food_bids fb JOIN restaurants r ON fb.restaurant_id = r.id WHERE fb.id = $1', [req.params.bidId]);
    io.emit('realtime:food_requests', { eventType: 'UPDATE', new: fromSnake(updatedRequest) });
    io.emit(`user:${fr.customer_id}`, { type: 'bid_accepted', requestId: fr.id, restaurantName: bid.restaurant_name });
    res.json({ ...fromSnake(updatedRequest), acceptedBid: fromSnake(bid) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/food-requests/:id/cancel', authRequired, async (req, res) => {
  try {
    const { rows: [fr] } = await pool.query('SELECT * FROM food_requests WHERE id = $1', [req.params.id]);
    if (!fr) return res.status(404).json({ error: 'Demande non trouvée' });
    if (fr.customer_id !== req.user.sub) return res.status(403).json({ error: 'Non autorisé' });
    const { rows: [updated] } = await pool.query("UPDATE food_requests SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING *", [req.params.id]);
    io.emit('realtime:food_requests', { eventType: 'UPDATE', new: fromSnake(updated) });
    res.json(fromSnake(updated));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/delivery-fee/calculate', async (req, res) => {
  try {
    const km = parseFloat(req.query.km) || 0;
    const result = await pool.query('SELECT compute_delivery_fee($1) AS fee', [km]);
    res.json({ km, fee: parseInt(result.rows[0].fee) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/delivery-fee', async (req, res) => {
  try {
    const { rows: [cfg] } = await pool.query('SELECT * FROM delivery_fee_config ORDER BY updated_at DESC LIMIT 1');
    if (!cfg) return res.json({ pricePerKm: 200, minFee: 500, maxFee: 3000 });
    res.json(fromSnake(cfg));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Validation de commande (CONF-03 / LOT-03) ─────────────────
// Les montants serveur font foi au checkout : le client envoie le contenu
// du panier, le serveur recalcule tout depuis la base (prix, disponibilité,
// frais, minimum) et renvoie les montants de référence. Erreurs métier en
// 4xx { error } affichables telles quelles.
//   body: { restaurantId, items: [{ menuItemId, quantity }], promoCode? }
app.post('/api/orders/validate', async (req, res) => {
  try {
    const { restaurantId, items, promoCode } = req.body || {};
    if (!restaurantId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Panier invalide.' });
    }

    const { rows: [restaurant] } = await pool.query(
      'SELECT id, name, is_open, delivery_fee, min_order FROM restaurants WHERE id = $1',
      [restaurantId]
    );
    if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable.' });
    if (restaurant.is_open === false) {
      return res.status(400).json({ error: `${restaurant.name} est actuellement fermé.` });
    }

    const menuItemIds = items.map((i) => i.menuItemId).filter(Boolean);
    if (menuItemIds.length !== items.length) {
      return res.status(400).json({ error: 'Panier invalide.' });
    }
    const { rows: menuRows } = await pool.query(
      'SELECT id, restaurant_id, name, price, is_available FROM menu_items WHERE id = ANY($1)',
      [menuItemIds]
    );
    const byId = new Map(menuRows.map((m) => [m.id, m]));

    let subtotal = 0;
    for (const line of items) {
      const item = byId.get(line.menuItemId);
      const qty = Math.max(1, Math.min(50, parseInt(line.quantity) || 1));
      if (!item || item.restaurant_id !== restaurantId) {
        return res.status(400).json({ error: 'Un plat du panier n’appartient pas à ce restaurant.' });
      }
      if (item.is_available === false) {
        return res.status(400).json({ error: `« ${item.name} » n’est plus disponible.` });
      }
      subtotal += parseInt(item.price) * qty;
    }

    // Code promo : table promo_codes si présente — un code inconnu/inactif
    // n'est pas bloquant, la remise est simplement nulle.
    let discount = 0;
    let appliedPromo = null;
    if (promoCode) {
      try {
        const { rows: [promo] } = await pool.query(
          'SELECT * FROM promo_codes WHERE code = $1 LIMIT 1',
          [String(promoCode).toUpperCase()]
        );
        if (promo && promo.is_active !== false) {
          const pct = parseFloat(promo.discount_percent ?? promo.percent ?? 0) || 0;
          const flat = parseInt(promo.discount_amount ?? promo.amount ?? 0) || 0;
          discount = Math.min(subtotal, flat + Math.round(subtotal * pct / 100));
          if (discount > 0) appliedPromo = promo.code;
        }
      } catch { /* table absente ou schéma différent — remise nulle */ }
    }

    const deliveryFee = parseInt(restaurant.delivery_fee) || 0;
    const minOrder = parseInt(restaurant.min_order) || 0;
    const minOrderMet = subtotal >= minOrder;
    if (!minOrderMet) {
      return res.status(400).json({
        error: `Minimum de commande non atteint : ${minOrder.toLocaleString('fr-FR')} FCFA chez ${restaurant.name}.`,
      });
    }

    res.json({
      valid: true,
      subtotal,
      discount,
      promoCode: appliedPromo,
      deliveryFee,
      total: subtotal - discount + deliveryFee,
      currency: 'XAF',
      minOrderMet,
    });
  } catch (err) {
    console.error('POST /api/orders/validate:', err.message);
    res.status(500).json({ error: 'Validation impossible pour le moment.' });
  }
});

// ─── Health check ──────────────────────────────────────────────
// GET /api/:table — list with filters (skips known non-table prefixes)
app.get('/api/:table', (req, res, next) => {
  const known = ['admin', 'auth', 'pay', 'rpc', 'delivery-fee', 'food-requests'];
  const prefix = req.params.table.split('/')[0];
  if (known.includes(prefix) || req.path.startsWith('/api/admin/') || req.path.startsWith('/api/delivery-fee/') || req.path.startsWith('/api/food-requests/')) return next();
  if (SENSITIVE_TABLES.has(prefix)) return authRequired(req, res, () => handleList(req, res));
  handleList(req, res);
});

function quoteTable(name) { return name.includes('-') ? `"${name}"` : name; }

async function handleList(req, res) {
  try {
    const { table } = req.params;
    const tbl = quoteTable(table);
    const filters = [];
    for (const [key, val] of Object.entries(req.query)) {
      if (['select', 'order', 'page', 'limit', 'sort', 'sortDir'].includes(key)) continue;
      if (val.startsWith('eq.')) filters.push([key, 'eq', val.slice(3)]);
      else if (val.startsWith('neq.')) filters.push([key, 'neq', val.slice(4)]);
      else if (val.startsWith('in.')) filters.push([key, 'in', val.slice(3).split(',')]);
      else if (val.startsWith('gte.')) filters.push([key, 'gte', val.slice(4)]);
      else if (val.startsWith('lte.')) filters.push([key, 'lte', val.slice(4)]);
      else if (val === 'is.null') filters.push([key, 'is', null]);
      else filters.push([key, 'eq', val]);
    }
    const [where, whereVals] = buildWhere(filters);
    const sort = req.query.sort ? [req.query.sort, req.query.sortDir || 'asc'] : null;
    const order = buildOrder(sort);
    const select = req.query.select === '*' ? '*' : (req.query.select || '*');
    const [limitClause, limitVals, page, limit] = buildPagination(req.query.page, req.query.limit, whereVals.length + 1);

    const countQuery = `SELECT count(*) FROM ${tbl}${where}`;
    const { rows: [{ count }] } = await pool.query(countQuery, whereVals);

    const dataQuery = `SELECT ${select} FROM ${tbl}${where}${order}${limitClause}`;
    const { rows } = await pool.query(dataQuery, [...whereVals, ...limitVals]);

    const data = rows.map(fromSnake).map(r => (SENSITIVE_TABLES.has(table) ? stripSecretFields(r) : r));
    res.json({ data, count: parseInt(count), page, limit });
  } catch (err) {
    console.error(`GET /api/${req.params.table}:`, err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/:table/:id — single row (skip known non-table prefixes)
app.get('/api/:table/:id', (req, res, next) => {
  const known = ['admin', 'auth', 'pay', 'rpc', 'delivery-fee', 'food-requests'];
  if (known.includes(req.params.table) || req.path.startsWith('/api/admin/') || req.path.startsWith('/api/delivery-fee/') || req.path.startsWith('/api/food-requests/')) return next();
  if (SENSITIVE_TABLES.has(req.params.table)) return authRequired(req, res, () => handleSingle(req, res));
  handleSingle(req, res);
});

async function handleSingle(req, res) {
  try {
    const { table, id } = req.params;
    const tbl = quoteTable(table);
    const { rows: [row] } = await pool.query(`SELECT * FROM ${tbl} WHERE id = $1`, [id]);
    if (!row) return res.status(404).json({ error: 'Non trouvé' });
    res.json(SENSITIVE_TABLES.has(table) ? stripSecretFields(fromSnake(row)) : fromSnake(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/:table — insert
app.post('/api/:table', authRequired, async (req, res) => {
  try {
    const { table } = req.params;
    // Account creation goes through /api/auth/signup (which hashes passwords
    // and defaults role safely) — raw inserts here would let any authenticated
    // client fabricate a users/profiles row with role: 'admin'.
    if (SENSITIVE_TABLES.has(table) && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Utilisez /api/auth/signup pour créer un compte' });
    }
    const tbl = quoteTable(table);
    const data = toSnake(req.body);
    if (!data.id) data.id = undefined;
    const keys = Object.keys(data).filter(k => data[k] !== undefined);
    const values = keys.map(k => data[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const { rows: [row] } = await pool.query(
      `INSERT INTO ${tbl} (${keys.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`,
      values
    );
    const clean = SENSITIVE_TABLES.has(table) ? stripSecretFields(fromSnake(row)) : fromSnake(row);
    io.emit(`realtime:${table}`, { eventType: 'INSERT', new: clean });
    res.status(201).json(clean);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/:table/:id — update
app.patch('/api/:table/:id', authRequired, async (req, res) => {
  try {
    const { table, id } = req.params;
    const isAdmin = req.user?.role === 'admin';
    // Non-admins may only touch their own users/profiles row, and never the
    // role/approval/suspension/password fields — otherwise any logged-in
    // client could PATCH themselves straight to role: 'admin'.
    if (SENSITIVE_TABLES.has(table)) {
      if (!isAdmin && id !== req.user?.sub) {
        return res.status(403).json({ error: 'Non autorisé' });
      }
    }
    const tbl = quoteTable(table);
    const data = toSnake(req.body);
    let keys = Object.keys(data).filter(k => k !== 'id');
    if (SENSITIVE_TABLES.has(table) && !isAdmin) {
      keys = keys.filter(k => !ADMIN_ONLY_USER_FIELDS.includes(k));
    }
    if (!keys.length) return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    const values = [id, ...keys.map(k => data[k])];
    const { rows: [row] } = await pool.query(
      `UPDATE ${tbl} SET ${sets.join(',')}, updated_at = now() WHERE id = $1 RETURNING *`,
      values
    );
    if (!row) return res.status(404).json({ error: 'Non trouvé' });
    const clean = SENSITIVE_TABLES.has(table) ? stripSecretFields(fromSnake(row)) : fromSnake(row);
    io.emit(`realtime:${table}`, { eventType: 'UPDATE', new: clean });
    res.json(clean);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/:table/:id
app.delete('/api/:table/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { table, id } = req.params;
    const tbl = quoteTable(table);
    await pool.query(`DELETE FROM ${tbl} WHERE id = $1`, [id]);
    io.emit(`realtime:${table}`, { eventType: 'DELETE', old: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Auth routes ──────────────────────────────────────────────
// POST /api/auth/send-otp
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Téléphone requis' });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      `INSERT INTO users (phone, otp_code, otp_expires_at, role) 
       VALUES ($1, $2, $3, 'client')
       ON CONFLICT (phone) DO UPDATE SET otp_code = $2, otp_expires_at = $3`,
      [phone, otp, expires]
    );
    console.log(`📱 OTP pour ${phone}: ${otp}`);
    res.json({ success: true, message: 'OTP envoyé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-otp
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, code, requestedRole } = req.body;
    const { rows: [user] } = await pool.query(
      `SELECT * FROM users WHERE phone = $1 AND otp_code = $2 AND otp_expires_at > now()`,
      [phone, code]
    );
    if (!user) return res.status(401).json({ error: 'Code invalide ou expiré' });

    const role = requestedRole || user.role || 'client';
    await pool.query(
      `UPDATE users SET otp_code = NULL, otp_expires_at = NULL, role = $2, updated_at = now() WHERE id = $1`,
      [user.id, role]
    );

    const isApproved = role === 'client' || role === 'admin';
    const token = jwt.sign({ sub: user.id, phone, role, isApproved }, JWT_SECRET, { expiresIn: '30d' });
    const authUser = { id: user.id, phone, role, isApproved, fullName: user.full_name };
    res.json({ user: authUser, token, session: { access_token: token } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/signin — password sign-in
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

    const isApproved = user.role === 'client' || user.role === 'admin' || user.is_approved;
    const token = jwt.sign({ sub: user.id, phone, role: user.role, isApproved }, JWT_SECRET, { expiresIn: '30d' });
    const authUser = { id: user.id, phone, role: user.role, isApproved, fullName: user.full_name };
    res.json({ user: authUser, token, session: { access_token: token } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    // Support both formats: {phone, password, name, role} and Supabase {email, password, options: {data: {phone, full_name}}}
    const phone = req.body.phone || req.body.options?.data?.phone || req.body.email || '';
    const name = req.body.name || req.body.options?.data?.full_name || '';
    const password = req.body.password || '';
    const role = req.body.role || 'client';
    if (!phone) return res.status(400).json({ error: 'Numéro de téléphone requis' });
    const hash = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (phone, password_hash, full_name, role) VALUES ($1, $2, $3, $4) 
       ON CONFLICT (phone) DO UPDATE SET full_name = $3, updated_at = now() RETURNING *`,
      [phone, hash, name, role]
    );
    const isApproved = user.role === 'client' || user.role === 'admin';
    const token = jwt.sign({ sub: user.id, phone, role: user.role, isApproved }, JWT_SECRET, { expiresIn: '30d' });
    const authUser = { id: user.id, phone, role: user.role, isApproved, fullName: user.full_name };
    res.status(201).json({ user: authUser, token, session: { access_token: token } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authRequired, async (req, res) => {
  try {
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const isApproved = user.role === 'client' || user.role === 'admin' || user.is_approved;
    res.json({
      id: user.id, phone: user.phone, role: user.role, isApproved,
      isSuspended: user.is_suspended, suspensionReason: user.suspension_reason,
      fullName: user.full_name, city: user.city, serviceNeighborhoods: user.service_neighborhoods,
      isOnline: user.is_online, photoUrl: user.photo_url, language: user.language
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── RPC (stored procedure calls — compat Supabase) ────────────
app.post('/api/rpc/:fn', authRequired, async (req, res) => {
  try {
    const { fn } = req.params;
    // Support simple RPC wrappers
    if (fn === 'is_admin') {
      res.json({ data: req.user.role === 'admin' });
    } else {
      res.status(404).json({ error: `RPC ${fn} non supportée` });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Admin : Configuration frais de livraison ────────────────────
// GET /api/admin/delivery-fee — obtenir la config actuelle
app.get('/api/admin/delivery-fee', async (req, res) => {
  try {
    const { rows: [cfg] } = await pool.query('SELECT * FROM delivery_fee_config ORDER BY updated_at DESC LIMIT 1');
    if (!cfg) return res.json({ pricePerKm: 200, minFee: 500, maxFee: 3000 });
    res.json(fromSnake(cfg));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/delivery-fee — mettre à jour la config (admin only)
app.put('/api/admin/delivery-fee', authRequired, adminRequired, async (req, res) => {
  try {
    const { pricePerKm, minFee, maxFee } = req.body;
    const pkm = Math.max(50, Math.min(1000, parseInt(pricePerKm) || 200));
    const minf = Math.max(100, parseInt(minFee) || 500);
    const maxf = Math.max(minf, parseInt(maxFee) || 3000);

    const { rows: [cfg] } = await pool.query(
      `INSERT INTO delivery_fee_config (price_per_km, min_fee, max_fee, updated_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [pkm, minf, maxf, req.user.sub]
    );
    io.emit('realtime:delivery_fee_config', { eventType: 'UPDATE', new: fromSnake(cfg) });
    res.json(fromSnake(cfg));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/delivery-fee/calculate?km=3.2 — calcul public des frais
app.get('/api/delivery-fee/calculate', async (req, res) => {
  try {
    const km = parseFloat(req.query.km) || 0;
    const result = await pool.query('SELECT compute_delivery_fee($1) AS fee', [km]);
    const fee = parseInt(result.rows[0].fee);
    res.json({ km, fee });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Admin : Gestion des zones (villes/quartiers) ─────────────────
// GET /api/admin/zones — liste les zones désactivées
app.get('/api/admin/zones', authRequired, adminRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT dz.*, u.full_name as disabled_by_name FROM disabled_zones dz LEFT JOIN users u ON dz.disabled_by = u.id ORDER BY dz.disabled_at DESC'
    );
    res.json({ data: rows.map(fromSnake), count: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/zones — désactiver une ville ou un quartier
app.post('/api/admin/zones', authRequired, adminRequired, async (req, res) => {
  try {
    const { city, neighborhood, reason } = req.body;
    if (!city) return res.status(400).json({ error: 'Ville requise' });
    const { rows: [zone] } = await pool.query(
      `INSERT INTO disabled_zones (city, neighborhood, reason, disabled_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (city, COALESCE(neighborhood, '')) DO NOTHING RETURNING *`,
      [city, neighborhood || null, reason || null, req.user.sub]
    );
    if (!zone) return res.status(409).json({ error: 'Cette zone est déjà désactivée' });
    const affected = await pool.query('SELECT disable_restaurants_in_zone($1, $2) AS count', [city, neighborhood || null]);
    res.status(201).json({ ...fromSnake(zone), affectedRestaurants: affected.rows[0].count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/zones/:id — réactiver une zone
app.delete('/api/admin/zones/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: [zone] } = await pool.query('DELETE FROM disabled_zones WHERE id = $1 RETURNING *', [id]);
    if (!zone) return res.status(404).json({ error: 'Zone non trouvée' });
    // Le trigger AFTER DELETE réactive automatiquement les restaurants
    const affected = await pool.query(
      'SELECT count(*) FROM restaurants WHERE city = $1 AND ($2::text IS NULL OR neighborhood = $2) AND is_open = true',
      [zone.city, zone.neighborhood]
    );
    res.json({ success: true, reactivatedRestaurants: parseInt(affected.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/zones/check/:restaurantId — vérifier si un resto est en zone désactivée
app.get('/api/admin/zones/check/:restaurantId', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM is_restaurant_in_disabled_zone($1)', [req.params.restaurantId]);
    res.json({ disabled: rows.length > 0, zones: rows.map(fromSnake) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/zones/affected — liste les restaurants affectés
app.get('/api/admin/zones/affected', authRequired, adminRequired, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM affected_restaurants ORDER BY city, neighborhood');
    res.json({ data: rows.map(fromSnake), count: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Paiements Mobile Money (Chariow) ─────────────────────────
// POST /api/pay/initiate — crée une session de paiement
app.post('/api/pay/initiate', authRequired, async (req, res) => {
  try {
    const { orderId, amount, phone, returnUrl } = req.body;
    if (!orderId || !amount || !phone) {
      return res.status(400).json({ error: 'orderId, amount et phone requis' });
    }

    // Vérifier que la commande existe et appartient au client
    const { rows: [order] } = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND customer_id = $2',
      [orderId, req.user.sub]
    );
    if (!order) return res.status(404).json({ error: 'Commande non trouvée' });

    // Ne pas payer deux fois une commande déjà payée
    if (order.payment_status === 'paid') {
      return res.status(400).json({ error: 'Cette commande est déjà payée' });
    }

    const { checkoutUrl, saleId } = await initiatePayment({ orderId, amount, phone, returnUrl });

    // Enregistrer la tentative de paiement
    await pool.query(
      `INSERT INTO payments (order_id, provider, sale_id, amount, phone, status, checkout_url)
       VALUES ($1, 'chariow', $2, $3, $4, 'pending', $5)`,
      [orderId, saleId, amount, phone, checkoutUrl]
    );

    res.json({ success: true, checkoutUrl, saleId });
  } catch (err) {
    console.error('Pay initiate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pay/notify — webhook Chariow (PUBLIC, no auth)
app.post('/api/pay/notify', async (req, res) => {
  res.sendStatus(200); // Toujours répondre 200 à Chariow

  try {
    const sale = req.body?.data?.sale || req.body?.sale || req.body;
    const saleId = sale?.id || sale?.sale_id;
    const meta = sale?.custom_metadata || {};
    const orderId = meta?.orderId || meta?.order_id;

    if (!saleId || !orderId) {
      console.warn('Chariow webhook: saleId ou orderId manquant');
      return;
    }

    // Vérifier le statut via l'API Chariow
    const verified = await getSaleStatus(saleId);
    if (verified.status !== 'completed' && verified.status !== 'success') {
      console.log('Chariow webhook: paiement non complété', { saleId, status: verified.status });
      return;
    }

    // Mettre à jour le paiement
    await pool.query(
      `UPDATE payments SET status = 'completed', raw_callback = $2, updated_at = now() WHERE sale_id = $1`,
      [saleId, JSON.stringify(req.body)]
    );

    // Mettre à jour la commande
    await pool.query(
      `UPDATE orders SET payment_status = 'paid', updated_at = now() WHERE id = $1`,
      [orderId]
    );

    // Notifier via WebSocket
    io.emit(`realtime:orders`, { eventType: 'UPDATE', new: { id: orderId, payment_status: 'paid' } });

    console.log('✅ Paiement confirmé', { saleId, orderId });
  } catch (err) {
    console.error('Chariow webhook error:', err.message);
  }
});

// GET /api/pay/status/:orderId — vérifier le statut d'un paiement
app.get('/api/pay/status/:orderId', authRequired, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { rows: [payment] } = await pool.query(
      'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
      [orderId]
    );
    if (!payment) return res.json({ status: 'none' });

    // Si pending, vérifier avec Chariow
    if (payment.status === 'pending' && payment.sale_id) {
      const updated = await getSaleStatus(payment.sale_id);
      if (updated.status === 'completed' || updated.status === 'success') {
        await pool.query('UPDATE payments SET status = \'completed\', updated_at = now() WHERE id = $1', [payment.id]);
        await pool.query('UPDATE orders SET payment_status = \'paid\', updated_at = now() WHERE id = $1', [orderId]);
        return res.json({ status: 'completed' });
      }
    }

    res.json({ status: payment.status, saleId: payment.sale_id, checkoutUrl: payment.checkout_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ──────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch { res.status(500).json({ status: 'error', db: 'disconnected' }); }
});

// ─── WebSocket (Realtime replacement) ──────────────────────────
io.on('connection', (socket) => {
  console.log('🔌 Client WebSocket connecté');
  socket.on('subscribe', (table) => {
    socket.join(`realtime:${table}`);
  });
  socket.on('disconnect', () => console.log('🔌 Client déconnecté'));
});

// ─── Start ─────────────────────────────────────────────────────
httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Miamexpress API sur http://127.0.0.1:${PORT}`);
  console.log(`   Health: http://127.0.0.1:${PORT}/health`);
});

export default app;
