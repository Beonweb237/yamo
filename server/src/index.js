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
import { registerReviewRoutes } from './reviews-routes.js';
import { registerPointsRoutes } from './points-routes.js';
import { registerLoyaltyRoutes } from './loyalty-routes.js';
import { registerTrackingRoutes } from './tracking-routes.js';
import { registerOperationsRoutes } from './operations-routes.js';
import { registerKycRoutes } from './kyc-routes.js';
import { startSmartDispatch, handleDriverPingResponse } from './smart_dispatch.js';
import {
  adminPermissionDefinitions,
  adminRoleDefinitions,
  ensureAdminRbacSchema,
  hasAdminAccessPermission,
  listAdminAuditLogs,
  listAdminUsers,
  loadAdminAccess,
  replaceAdminUserRoles,
  rolePermissionMap,
  writeAdminAuditLog,
} from './admin-rbac.js';

// La racine du projet est la source canonique sur le VPS. Le fichier
// server/.env.server reste supporte pour les anciennes installations, sans
// pouvoir ecraser une valeur deja chargee depuis la racine.
dotenv.config({ path: new URL('../../.env.server', import.meta.url), override: true });
dotenv.config({ path: new URL('../.env.server', import.meta.url) });

const { Pool } = pg;
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Secrets OBLIGATOIRES via l'environnement — plus de valeur en dur (elles se
// retrouvaient dans le code source / l'historique git). L'API refuse de démarrer
// si l'un manque, plutôt que d'utiliser un secret par défaut connu de tous.
const REQUIRED_SECRETS = ['JWT_SECRET', 'DB_PASSWORD'];
const missingSecrets = REQUIRED_SECRETS.filter((k) => !process.env[k]);
if (missingSecrets.length) {
  console.error(
    `FATAL: variable(s) d'environnement manquante(s): ${missingSecrets.join(', ')}. ` +
    `Définissez-les dans .env.server (VPS) avant de démarrer l'API.`
  );
  process.exit(1);
}

const PORT = process.env.API_PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

// ─── Database ─────────────────────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'miamexpress',
  user: process.env.DB_USER || 'miamexpress',
  password: process.env.DB_PASSWORD,
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

async function adminRequired(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin uniquement' });
  try {
    req.adminAccess = await loadAdminAccess(pool, req.user.sub);
    next();
  } catch (err) {
    console.error('adminRequired:', err.message);
    res.status(500).json({ error: 'Verification admin impossible' });
  }
}

function adminPermissionRequired(permission) {
  return async (req, res, next) => {
    await adminRequired(req, res, () => {
      if (!hasAdminAccessPermission(req.adminAccess, permission)) {
        return res.status(403).json({ error: 'Permission insuffisante', permission });
      }
      next();
    });
  };
}

function canAdmin(req, permission) {
  return hasAdminAccessPermission(req.adminAccess, permission);
}

function requireAdminPermissionInRoute(req, res, permission) {
  if (canAdmin(req, permission)) return true;
  res.status(403).json({ error: 'Permission insuffisante', permission });
  return false;
}

function buildAuthUser(row, adminAccess = null) {
  const isApproved = row.role === 'client' || row.role === 'admin' || row.is_approved === true;
  const user = {
    id: row.id,
    phone: row.phone,
    role: row.role,
    isApproved,
    isSuspended: row.is_suspended,
    suspensionReason: row.suspension_reason,
    fullName: row.full_name,
    email: row.email || null,
    city: row.city,
    serviceNeighborhoods: row.service_neighborhoods,
    isOnline: row.is_online,
    photoUrl: row.photo_url,
    language: row.language,
  };
  if (row.role === 'admin' && adminAccess) {
    user.adminRoleCodes = adminAccess.roleCodes;
    user.adminRoleCode = adminAccess.primaryRoleCode;
    user.adminRoleName = adminAccess.primaryRoleName;
    user.adminPermissions = adminAccess.permissions;
    user.adminScopes = adminAccess.scopes;
    user.isSuperAdmin = adminAccess.isSuperAdmin;
  }
  return user;
}

// users/profiles carry auth secrets (password_hash, otp_code) and role/approval
// flags — never list them publicly, never let a non-admin write role/approval
// on themselves, and never echo the secret columns back even to their owner.
const SENSITIVE_TABLES = new Set(['users', 'profiles']);
// Listés dans les deux graphies : stripSecretFields tourne aussi bien sur des
// lignes brutes (snake_case) que sur des lignes déjà passées par fromSnake
// (camelCase). Ne retirer qu'une graphie laissait fuiter otpCode/passwordHash.
const SECRET_USER_FIELDS = ['password_hash', 'otp_code', 'otp_expires_at', 'passwordHash', 'otpCode', 'otpExpiresAt'];
const ADMIN_ONLY_USER_FIELDS = ['role', 'is_approved', 'is_suspended', 'suspension_reason', 'password_hash'];
const ADMIN_TABLE_PERMISSIONS = {
  insert: {
    users: 'admin.users.update',
    profiles: 'admin.users.update',
    restaurants: 'restaurants.create',
    menu_items: 'restaurants.update_menu',
    applications: 'applications.view',
    media: 'media.manage',
  },
  update: {
    users: 'admin.users.update',
    profiles: 'admin.users.update',
    restaurants: 'restaurants.update_profile',
    menu_items: 'restaurants.update_menu',
    applications: 'applications.approve',
    orders: 'orders.update_status',
    reviews: 'reviews.moderate',
    point_recharges: 'points.manage',
  },
  delete: {
    users: 'admin.delete',
    profiles: 'admin.delete',
    restaurants: 'admin.delete',
    menu_items: 'restaurants.update_menu',
    applications: 'admin.delete',
    orders: 'admin.delete',
    reviews: 'reviews.moderate',
  },
};

async function requireAdminTablePermission(req, res, table, action) {
  if (req.user?.role !== 'admin') return true;
  const permission = ADMIN_TABLE_PERMISSIONS[action]?.[table];
  if (!permission) return true;
  req.adminAccess = req.adminAccess || await loadAdminAccess(pool, req.user.sub);
  return requireAdminPermissionInRoute(req, res, permission);
}

function stripSecretFields(row) {
  if (!row || typeof row !== 'object') return row;
  const clean = { ...row };
  for (const f of SECRET_USER_FIELDS) delete clean[f];
  return clean;
}

// ─── Helpers ──────────────────────────────────────────────────
const PUBLIC_RESTAURANT_MENU_FILTER = `EXISTS (
    SELECT 1
    FROM menu_items mi
    WHERE mi.restaurant_id = restaurants.id
      AND mi.is_available IS DISTINCT FROM false
  )`;

function optionalAuthUser(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}

function canSeeRestaurantsWithoutMenu(req) {
  const user = req.user || optionalAuthUser(req);
  return ['admin', 'restaurant'].includes(user?.role);
}

function shouldFilterPublicRestaurants(req, table) {
  return table === 'restaurants' && !canSeeRestaurantsWithoutMenu(req);
}

function appendWhereClause(where, clause) {
  return where ? `${where} AND ${clause}` : ` WHERE ${clause}`;
}

const CLIENT_FIRST_NAMES = [
  'Abena', 'Aicha', 'Alain', 'Brenda', 'Cedric', 'Charline', 'Clarisse', 'Diane',
  'Estelle', 'Fabrice', 'Flore', 'Gaelle', 'Herve', 'Ines', 'Joel', 'Kevin',
  'Larissa', 'Mireille', 'Nadine', 'Pauline', 'Raissa', 'Sandrine', 'Serge',
  'Thierry', 'Yannick', 'Yolande',
];

const CLIENT_LAST_NAMES = [
  'Abanda', 'Abega', 'Biloa', 'Djoumessi', 'Dongmo', 'Ebanda', 'Ekambi',
  'Essomba', 'Ewane', 'Fokou', 'Fotso', 'Kamdem', 'Kenfack', 'Mbarga',
  'Mballa', 'Mbia', 'Meka', 'Momo', 'Ndongo', 'Ngassa', 'Ngono', 'Njikam',
  'Njoya', 'Nkeng', 'Nlend', 'Noubi', 'Talla', 'Tchami', 'Zambo',
];

function seededIndex(seed, length, salt = 0) {
  let value = salt + 17;
  for (const ch of String(seed || 'client')) value = ((value * 31) + ch.charCodeAt(0)) >>> 0;
  return value % length;
}

function buildFallbackClientName(phone = '') {
  const seed = String(phone || Date.now());
  const first = CLIENT_FIRST_NAMES[seededIndex(seed, CLIENT_FIRST_NAMES.length, 23)];
  const last = CLIENT_LAST_NAMES[seededIndex(seed, CLIENT_LAST_NAMES.length, 71)];
  return `${first} ${last}`;
}

function isBlankName(name) {
  return !String(name || '').trim();
}

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

// Toutes les tables n'ont pas de colonne updated_at (deliveries, menu_items,
// applications, order_items, restaurants…). Le PATCH générique ne doit l'ajouter
// au UPDATE que si elle existe vraiment, sinon Postgres renvoie « column
// "updated_at" does not exist » et l'écriture échoue en 500 (ex. le livreur ne
// pouvait pas mettre à jour la ligne deliveries). Cache chargé une fois.
let _updatedAtTables = null;
async function tableHasUpdatedAt(table) {
  if (!_updatedAtTables) {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'updated_at'`
    );
    _updatedAtTables = new Set(rows.map((r) => r.table_name));
  }
  return _updatedAtTables.has(table);
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

// ─── Reviews / Avis ────────────────────────────────────────────
registerReviewRoutes(app, { pool, authRequired, adminRequired, adminPermissionRequired, fromSnake });
// Série PTS : routes /api/points/* — AVANT le /api/:table générique
// (déclaré plus bas), sinon « points » serait traité comme une table.
registerPointsRoutes(app, { pool, authRequired, adminRequired, adminPermissionRequired, fromSnake });
// Série LOY : routes /api/loyalty/* (MiamPoints fidélité client) — AVANT /api/:table.
registerLoyaltyRoutes(app, { pool, authRequired, adminPermissionRequired, fromSnake });
// Série TRK : /api/settings/* + /api/tracking/* (suivi livreur, mode démo) — AVANT /api/:table.
registerTrackingRoutes(app, { pool, authRequired, adminRequired, fromSnake });
// Série OPS : /api/admin/operations + /api/incidents (Centre Opérations) — AVANT /api/:table.
registerOperationsRoutes(app, { pool, authRequired, adminPermissionRequired, fromSnake });
// Série KYC : /api/admin/kyc/* (dossiers de vérification profils) — AVANT /api/:table.
registerKycRoutes(app, { pool, authRequired, adminPermissionRequired, fromSnake });

// ─── Admin : comptes, clients et validation directe ─────────────
const ADMIN_CREATABLE_ROLES = new Set(['restaurant', 'livreur']);
const DEFAULT_ADMIN_CREATED_PASSWORD = 'Miamexpress2025';

function cleanPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '').trim();
  if (digits.startsWith('00237')) digits = digits.slice(5);
  if (digits.startsWith('237') && digits.length > 3) digits = digits.slice(3);
  return digits;
}

function emailToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'utilisateur';
}

function cleanEmail(email) {
  // Tout email syntaxiquement valide est accepté tel quel. La restriction
  // historique gmail/yahoo (réalisme des données de démo) écartait les emails
  // réels (hotmail, domaines pro…) et resolveUserEmail les remplaçait par une
  // adresse inventée → connexion par email impossible pour ces comptes.
  const value = String(email || '').trim().toLowerCase();
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return '';
  return value;
}

function buildUserEmail(name, phone = '', role = 'client') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const first = emailToken(parts[0] || role || 'client');
  const last = emailToken(parts.length > 1 ? parts[parts.length - 1] : cleanPhone(phone).slice(-4) || 'miamexpress');
  const domain = `${first}.${last}`.length % 2 === 0 ? 'gmail.com' : 'yahoo.fr';
  return `${last}.${first}@${domain}`;
}

function resolveUserEmail({ email, name, phone, role }) {
  return cleanEmail(email) || buildUserEmail(name, phone, role);
}
function cleanText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toPublicUser(row) {
  return stripSecretFields(fromSnake(row));
}

async function upsertAdminCreatedUser({ role, phone, email, name, password, city, serviceNeighborhoods, approved }) {
  const normalizedPhone = cleanPhone(phone);
  if (!normalizedPhone) {
    const err = new Error('Telephone requis');
    err.status = 400;
    throw err;
  }
  if (!ADMIN_CREATABLE_ROLES.has(role)) {
    const err = new Error('Role invalide');
    err.status = 400;
    throw err;
  }
  const fullName = cleanText(name, normalizedPhone);
  const userEmail = resolveUserEmail({ email, name: fullName, phone: normalizedPhone, role });
  const hash = await bcrypt.hash(password || DEFAULT_ADMIN_CREATED_PASSWORD, SALT_ROUNDS);
  const { rows: [user] } = await pool.query(
    `INSERT INTO users (
       phone, email, password_hash, full_name, role, is_approved, city, service_neighborhoods,
       is_suspended, is_online, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, false, now())
     ON CONFLICT (phone) DO UPDATE SET
       email = EXCLUDED.email,
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       role = EXCLUDED.role,
       is_approved = EXCLUDED.is_approved,
       city = EXCLUDED.city,
       service_neighborhoods = EXCLUDED.service_neighborhoods,
       is_suspended = false,
       suspension_reason = null,
       updated_at = now()
     RETURNING *`,
    [
      normalizedPhone,
      userEmail,
      hash,
      fullName,
      role,
      approved !== false,
      city || null,
      Array.isArray(serviceNeighborhoods) && serviceNeighborhoods.length ? serviceNeighborhoods : null,
    ]
  );
  return user;
}

async function createOrUpdateRestaurantForUser(user, input) {
  const name = cleanText(input.restaurantName || input.name, 'Restaurant demo');
  const city = cleanText(input.city, 'Douala');
  const neighborhood = cleanText(input.neighborhood, 'Centre-ville');
  const address = cleanText(input.address, `${neighborhood}, ${city}`);
  const phone = cleanPhone(input.contactPhone || input.phone || user.phone);
  const email = resolveUserEmail({ email: input.email || user.email, name, phone, role: 'restaurant' });
  const { rows: [existing] } = await pool.query(
    `SELECT * FROM restaurants WHERE owner_id = $1 OR ($2::text <> '' AND phone = $2) ORDER BY created_at DESC LIMIT 1`,
    [user.id, phone]
  );

  if (existing) {
    const { rows: [restaurant] } = await pool.query(
      `UPDATE restaurants SET
         owner_id = $1,
         name = $2,
         address = $3,
         phone = $4,
         email = $5,
         city = $6,
         neighborhood = $7,
         description = $8,
         is_open = true
       WHERE id = $9
       RETURNING *`,
      [user.id, name, address, phone || null, email, city, neighborhood, input.notes || 'Restaurant partenaire valide par admin.', existing.id]
    );
    return restaurant;
  }

  const { rows: [restaurant] } = await pool.query(
    `INSERT INTO restaurants (
       owner_id, name, image, category, rating, review_count, delivery_time,
       delivery_fee, min_order, price_range, address, phone, email, hours, is_open,
       is_premium, tags, description, city, neighborhood, commission_rate
     )
     VALUES ($1,$2,$3,$4,0,0,$5,$6,$7,$8,$9,$10,$11,$12,true,false,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      user.id,
      name,
      input.restaurantPhoto || '/partner-kitchen.jpg',
      input.category || 'Camerounaise',
      input.deliveryTime || '30-45 min',
      Number(input.deliveryFee ?? 500),
      Number(input.minOrder ?? 1000),
      input.priceRange || '$$',
      address,
      phone || null,
      email,
      input.hours || '08:00 - 22:00',
      [city, neighborhood, 'Admin'],
      input.notes || 'Restaurant partenaire valide directement par admin.',
      city,
      neighborhood,
      Number(input.commissionRate ?? 0.12),
    ]
  );
  return restaurant;
}

async function createOrUpdateApplicationForUser(user, input, restaurantId = null) {
  const type = input.type;
  const { rows: [existing] } = await pool.query(
    `SELECT * FROM applications WHERE applicant_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT 1`,
    [user.id, type]
  );

  const values = [
    user.id,
    type,
    'approved',
    input.restaurantName || (type === 'restaurant' ? input.name : null),
    input.city || null,
    input.address || null,
    cleanPhone(input.contactPhone || input.phone || user.phone) || null,
    input.notes || (type === 'livreur' ? 'Livreur cree et valide directement par admin.' : 'Restaurant cree et valide directement par admin.'),
    restaurantId,
  ];

  if (existing) {
    const { rows: [application] } = await pool.query(
      `UPDATE applications SET
         status = $1,
         restaurant_name = $2,
         city = $3,
         address = $4,
         contact_phone = $5,
         notes = $6,
         restaurant_id = $7,
         reviewed_at = now()
       WHERE id = $9
       RETURNING *`,
      [...values.slice(2), existing.id]
    );
    return application;
  }
  const { rows: [application] } = await pool.query(
    `INSERT INTO applications (
       applicant_id, type, status, restaurant_name, city, address, contact_phone,
       notes, restaurant_id, reviewed_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
     RETURNING *`,
    values
  );
  return application;
}

app.get('/api/admin/rbac/me', authRequired, adminRequired, async (req, res) => {
  res.json({ data: req.adminAccess });
});

app.get('/api/admin/rbac/summary', authRequired, adminPermissionRequired('admin.roles.view'), async (req, res) => {
  try {
    const [admins, auditLogs] = await Promise.all([
      listAdminUsers(pool),
      canAdmin(req, 'audit.view') ? listAdminAuditLogs(pool, { limit: 40 }) : [],
    ]);
    res.json({
      data: {
        roles: adminRoleDefinitions(),
        permissions: adminPermissionDefinitions(),
        rolePermissions: rolePermissionMap(),
        admins: admins.map(fromSnake),
        auditLogs: auditLogs.map(fromSnake),
      },
    });
  } catch (err) {
    console.error('GET /api/admin/rbac/summary:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/rbac/users/:userId/roles', authRequired, adminPermissionRequired('admin.roles.update'), async (req, res) => {
  try {
    if (String(req.params.userId) === String(req.user.sub) && !canAdmin(req, 'admin.delete')) {
      return res.status(400).json({ error: 'Un admin ne peut pas modifier ses propres roles sans privilege Super Admin.' });
    }
    const before = await loadAdminAccess(pool, req.params.userId);
    const access = await replaceAdminUserRoles(pool, {
      adminUserId: req.params.userId,
      assignments: req.body?.assignments || req.body?.roles || [],
      changedBy: req.user.sub,
    });
    await writeAdminAuditLog(pool, req, {
      action: 'admin.roles.update',
      targetType: 'admin_user',
      targetId: req.params.userId,
      oldValue: before,
      newValue: access,
      reason: cleanText(req.body?.reason, 'Mise a jour des roles admin'),
    });
    res.json({ data: access });
  } catch (err) {
    console.error('PUT /api/admin/rbac/users/:userId/roles:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/admin/audit-logs', authRequired, adminPermissionRequired('audit.view'), async (req, res) => {
  try {
    const rows = await listAdminAuditLogs(pool, { limit: req.query.limit || 100 });
    res.json({ data: rows.map(fromSnake) });
  } catch (err) {
    console.error('GET /api/admin/audit-logs:', err.message);
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/admin/applications/:id/approve', authRequired, adminPermissionRequired('applications.approve'), async (req, res) => {
  try {
    const { rows: [application] } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!application) return res.status(404).json({ error: 'Candidature introuvable' });
    const approvalPermission = application.type === 'restaurant' ? 'restaurants.approve' : 'couriers.approve';
    if (!requireAdminPermissionInRoute(req, res, approvalPermission)) return;

    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id = $1', [application.applicant_id]);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    let restaurant = null;
    let restaurantId = req.body?.restaurantId || application.restaurant_id || null;
    if (application.type === 'restaurant') {
      if (restaurantId) {
        const { rows: [linked] } = await pool.query(
          `UPDATE restaurants SET owner_id = $1, is_open = true WHERE id = $2 RETURNING *`,
          [user.id, restaurantId]
        );
        restaurant = linked || null;
      } else {
        restaurant = await createOrUpdateRestaurantForUser(user, {
          type: 'restaurant',
          restaurantName: application.restaurant_name,
          city: application.city,
          address: application.address,
          contactPhone: application.contact_phone || user.phone,
          notes: application.notes,
        });
        restaurantId = restaurant.id;
      }
    }

    const { rows: [approvedUser] } = await pool.query(
      `UPDATE users SET is_approved = true, city = COALESCE($2, city), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [user.id, application.city || null]
    );

    try {
      await pool.query(
        `UPDATE profiles SET is_approved = true, city = COALESCE($2, city), updated_at = now() WHERE id = $1`,
        [user.id, application.city || null]
      );
    } catch (profileErr) {
      console.warn('Profil non synchronise pendant approbation:', profileErr.message);
    }

    const { rows: [approvedApplication] } = await pool.query(
      `UPDATE applications
       SET status = 'approved', restaurant_id = $2, reviewed_by = $3, reviewed_at = now()
       WHERE id = $1
       RETURNING *`,
      [application.id, restaurantId, req.user.sub]
    );

    io.emit('realtime:users', { eventType: 'UPDATE', new: toPublicUser(approvedUser) });
    io.emit('realtime:applications', { eventType: 'UPDATE', new: fromSnake(approvedApplication) });
    if (restaurant) io.emit('realtime:restaurants', { eventType: 'UPSERT', new: fromSnake(restaurant) });
    await writeAdminAuditLog(pool, req, {
      action: application.type === 'restaurant' ? 'restaurants.approve' : 'couriers.approve',
      targetType: 'application',
      targetId: application.id,
      oldValue: fromSnake(application),
      newValue: fromSnake(approvedApplication),
      reason: cleanText(req.body?.reason, 'Candidature approuvee'),
    });

    res.json({
      user: toPublicUser(approvedUser),
      application: fromSnake(approvedApplication),
      restaurant: restaurant ? fromSnake(restaurant) : null,
    });
  } catch (err) {
    console.error('POST /api/admin/applications/:id/approve:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/applications/:id/reject', authRequired, adminPermissionRequired('applications.reject'), async (req, res) => {
  try {
    const reason = cleanText(req.body?.reason, '');
    const { rows: [existingApplication] } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!existingApplication) return res.status(404).json({ error: 'Candidature introuvable' });
    const rejectPermission = existingApplication.type === 'restaurant' ? 'restaurants.reject' : 'couriers.reject';
    if (!requireAdminPermissionInRoute(req, res, rejectPermission)) return;
    const { rows: [application] } = await pool.query(
      `UPDATE applications
       SET status = 'rejected',
           notes = CASE
             WHEN $2::text <> '' THEN concat_ws(E'\n', NULLIF(notes, ''), 'Motif de rejet: ' || $2::text)
             ELSE notes
           END,
           reviewed_by = $3,
           reviewed_at = now()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, reason, req.user.sub]
    );
    if (!application) return res.status(404).json({ error: 'Candidature introuvable' });
    io.emit('realtime:applications', { eventType: 'UPDATE', new: fromSnake(application) });
    await writeAdminAuditLog(pool, req, {
      action: application.type === 'restaurant' ? 'restaurants.reject' : 'couriers.reject',
      targetType: 'application',
      targetId: application.id,
      newValue: fromSnake(application),
      reason: reason || 'Candidature rejetee',
    });
    res.json({ application: fromSnake(application) });
  } catch (err) {
    console.error('POST /api/admin/applications/:id/reject:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// O-3 : villes auxquelles un admin est restreint (scope). Retourne null pour un
// accès global (super_admin, ou rôle à scope 'global', ou aucun scope ville) →
// pas de filtre. Sinon la liste des villes autorisées, à passer en $ (text[]).
function adminCityScope(adminAccess) {
  if (!adminAccess || adminAccess.isSuperAdmin) return null;
  const scopes = Array.isArray(adminAccess.scopes) ? adminAccess.scopes : [];
  if (scopes.some((s) => s.scopeType === 'global')) return null;
  const cities = [...new Set(scopes.filter((s) => s.scopeType === 'city' && s.scopeValue).map((s) => s.scopeValue))];
  return cities.length ? cities : null;
}

app.get('/api/admin/customers', authRequired, adminPermissionRequired('customers.view'), async (req, res) => {
  try {
    const cityScope = adminCityScope(req.adminAccess);
    const { rows } = await pool.query(
      `SELECT
         u.*,
         count(o.id)::int AS order_count,
         COALESCE(sum(CASE WHEN o.status = 'delivered' THEN o.total ELSE 0 END), 0)::int AS total_spent,
         max(o.created_at) AS last_order_at,
         count(o.id) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_count
       FROM users u
       LEFT JOIN orders o ON o.customer_id = u.id
       WHERE u.role = 'client'
         AND ($1::text[] IS NULL OR u.city = ANY($1))
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      [cityScope]
    );

    const ids = rows.map((row) => row.id);
    let orderRows = [];
    if (ids.length) {
      const { rows: orders } = await pool.query(
        `SELECT
           o.*,
           r.name AS restaurant_name,
           COALESCE(
             json_agg(json_build_object(
               'id', oi.id,
               'menuItemId', oi.menu_item_id,
               'name', oi.name,
               'price', oi.price,
               'quantity', oi.quantity
             )) FILTER (WHERE oi.id IS NOT NULL),
             '[]'::json
           ) AS items
         FROM orders o
         LEFT JOIN restaurants r ON r.id = o.restaurant_id
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.customer_id = ANY($1::uuid[])
         GROUP BY o.id, r.name
         ORDER BY o.created_at DESC`,
        [ids]
      );
      orderRows = orders.map((order) => fromSnake(order));
    }

    const ordersByCustomer = new Map();
    for (const order of orderRows) {
      const key = String(order.customerId);
      if (!ordersByCustomer.has(key)) ordersByCustomer.set(key, []);
      ordersByCustomer.get(key).push(order);
    }

    const data = rows.map((row) => {
      const user = toPublicUser(row);
      return {
        ...user,
        name: user.fullName || null,
        profilePhoto: user.photoUrl || '',
        whatsapp: '',
        savedAddresses: [],
        orderCount: Number(row.order_count || 0),
        totalSpent: Number(row.total_spent || 0),
        lastOrderAt: row.last_order_at,
        cancelledCount: Number(row.cancelled_count || 0),
        orders: ordersByCustomer.get(String(row.id)) || [],
      };
    });

    res.json({ data });
  } catch (err) {
    console.error('GET /api/admin/customers:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/accounts', authRequired, adminRequired, async (req, res) => {
  try {
    const input = req.body || {};
    const type = input.type || input.role;
    const createPermission = type === 'restaurant' ? 'restaurants.create_approved' : 'couriers.create_approved';
    if (!requireAdminPermissionInRoute(req, res, createPermission)) return;
    const user = await upsertAdminCreatedUser({
      role: type,
      phone: input.contactPhone || input.phone,
      email: input.email,
      name: input.applicantName || input.name || input.restaurantName,
      password: input.password,
      city: input.city,
      serviceNeighborhoods: input.serviceNeighborhoods,
      approved: true,
    });

    let restaurant = null;
    if (type === 'restaurant') {
      restaurant = await createOrUpdateRestaurantForUser(user, { ...input, type });
    }
    const application = await createOrUpdateApplicationForUser(user, { ...input, type }, restaurant?.id ?? null);

    io.emit('realtime:users', { eventType: 'UPSERT', new: toPublicUser(user) });
    io.emit('realtime:applications', { eventType: 'UPSERT', new: fromSnake(application) });
    if (restaurant) io.emit('realtime:restaurants', { eventType: 'UPSERT', new: fromSnake(restaurant) });
    await writeAdminAuditLog(pool, req, {
      action: type === 'restaurant' ? 'restaurants.create_approved' : 'couriers.create_approved',
      targetType: type,
      targetId: user.id,
      newValue: { user: toPublicUser(user), application: fromSnake(application), restaurant: restaurant ? fromSnake(restaurant) : null },
      reason: cleanText(input.notes, type === 'restaurant' ? 'Restaurant cree et valide par admin' : 'Livreur cree et valide par admin'),
    });

    res.status(201).json({
      user: toPublicUser(user),
      application: fromSnake(application),
      restaurant: restaurant ? fromSnake(restaurant) : null,
      defaultPassword: DEFAULT_ADMIN_CREATED_PASSWORD,
    });
  } catch (err) {
    console.error('POST /api/admin/accounts:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.patch('/api/admin/customers/:id/suspension', authRequired, adminRequired, async (req, res) => {
  try {
    const suspended = Boolean(req.body?.isSuspended);
    const permission = suspended ? 'customers.block' : 'customers.unblock';
    if (!requireAdminPermissionInRoute(req, res, permission)) return;
    const reason = suspended ? (req.body?.reason || 'Bloque par admin') : null;
    const { rows: [user] } = await pool.query(
      `UPDATE users SET is_suspended = $1, suspension_reason = $2, updated_at = now()
       WHERE id = $3 AND role = 'client'
       RETURNING *`,
      [suspended, reason, req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'Client introuvable' });
    await writeAdminAuditLog(pool, req, {
      action: suspended ? 'customers.block' : 'customers.unblock',
      targetType: 'customer',
      targetId: user.id,
      newValue: toPublicUser(user),
      reason: reason || 'Deblocage client',
    });
    res.json({ data: toPublicUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/users/:id/password', authRequired, adminPermissionRequired('admin.users.password'), async (req, res) => {
  try {
    const password = String(req.body?.password || '');
    if (password.length < 4) return res.status(400).json({ error: 'Mot de passe trop court' });
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows: [user] } = await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [hash, req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    await writeAdminAuditLog(pool, req, {
      action: 'admin.users.password',
      targetType: 'user',
      targetId: user.id,
      newValue: { id: user.id, role: user.role, phone: user.phone },
      reason: cleanText(req.body?.reason, 'Reinitialisation mot de passe'),
    });
    res.json({ data: toPublicUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Generic table API ─────────────────────────────────────────
// GET /api/:table — list with filters (skips known non-table prefixes)
app.get('/api/:table', (req, res, next) => {
  const known = ['admin', 'auth', 'pay', 'rpc', 'delivery-fee', 'food-requests', 'points', 'loyalty', 'settings', 'tracking', 'incidents'];
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
      if (['select', 'order', 'page', 'limit', 'sort', 'sortDir', 'includeWithoutMenu'].includes(key)) continue;
      if (val.startsWith('eq.')) filters.push([key, 'eq', val.slice(3)]);
      else if (val.startsWith('neq.')) filters.push([key, 'neq', val.slice(4)]);
      else if (val.startsWith('in.')) filters.push([key, 'in', val.slice(3).split(',')]);
      else if (val.startsWith('gte.')) filters.push([key, 'gte', val.slice(4)]);
      else if (val.startsWith('lte.')) filters.push([key, 'lte', val.slice(4)]);
      else if (val === 'is.null') filters.push([key, 'is', null]);
      else filters.push([key, 'eq', val]);
    }
    const [where, whereVals] = buildWhere(filters);
    const effectiveWhere = shouldFilterPublicRestaurants(req, table)
      ? appendWhereClause(where, PUBLIC_RESTAURANT_MENU_FILTER)
      : where;
    const sort = req.query.sort ? [req.query.sort, req.query.sortDir || 'asc'] : null;
    const order = buildOrder(sort);
    const select = req.query.select === '*' ? '*' : (req.query.select || '*');
    const [limitClause, limitVals, page, limit] = buildPagination(req.query.page, req.query.limit, whereVals.length + 1);

    const countQuery = `SELECT count(*) FROM ${tbl}${effectiveWhere}`;
    const { rows: [{ count }] } = await pool.query(countQuery, whereVals);

    const dataQuery = `SELECT ${select} FROM ${tbl}${effectiveWhere}${order}${limitClause}`;
    const { rows } = await pool.query(dataQuery, [...whereVals, ...limitVals]);

    const data = rows.map(fromSnake).map(r => (SENSITIVE_TABLES.has(table) ? stripSecretFields(r) : r));
    res.json({ data, count: parseInt(count), page, limit });
  } catch (err) {
    console.error(`GET /api/${req.params.table}:`, err.message);
    // Si la valeur du filtre n'est pas compatible avec le type de la colonne
    // (ex. ?id=eq.1 sur une colonne uuid), on retourne un tableau vide plutôt
    // qu'une 500. Cela évite de bloquer le checkout quand le panier contient
    // encore des IDs numériques (mockData) alors que la base attend des UUID.
    if (err.message && err.message.includes('invalid input syntax for type')) {
      return res.json({ data: [], count: 0, page: 1, limit: 20 });
    }
    res.status(500).json({ error: err.message });
  }
}

// GET /api/:table/:id — single row (skip known non-table prefixes)
app.get('/api/:table/:id', (req, res, next) => {
  const known = ['admin', 'auth', 'pay', 'rpc', 'delivery-fee', 'food-requests', 'points', 'loyalty', 'settings', 'tracking', 'incidents'];
  if (known.includes(req.params.table) || req.path.startsWith('/api/admin/') || req.path.startsWith('/api/delivery-fee/') || req.path.startsWith('/api/food-requests/')) return next();
  if (SENSITIVE_TABLES.has(req.params.table)) return authRequired(req, res, () => handleSingle(req, res));
  handleSingle(req, res);
});

async function handleSingle(req, res) {
  try {
    const { table, id } = req.params;
    const tbl = quoteTable(table);
    const publicFilter = shouldFilterPublicRestaurants(req, table)
      ? ` AND ${PUBLIC_RESTAURANT_MENU_FILTER}`
      : '';
    const { rows: [row] } = await pool.query(`SELECT * FROM ${tbl} WHERE id = $1${publicFilter}`, [id]);
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
    if (SENSITIVE_TABLES.has(table) && req.user?.role === 'admin') {
      req.adminAccess = await loadAdminAccess(pool, req.user.sub);
      if (!requireAdminPermissionInRoute(req, res, 'admin.users.update')) return;
    }
    if (!(await requireAdminTablePermission(req, res, table, 'insert'))) return;
    // O-5 : un client suspendu ne peut pas creer de commande (blocage reel
    // cote serveur, pas seulement au front). Ref D-19.
    if (table === 'orders' && req.user?.role !== 'admin') {
      const { rows: [suspU] } = await pool.query('SELECT is_suspended FROM users WHERE id::text = $1', [String(req.user?.sub || '')]);
      if (suspU?.is_suspended) return res.status(403).json({ error: 'Compte suspendu : commande impossible. Contactez le support.' });
    }
    const tbl = quoteTable(table);
    const data = toSnake(req.body);
    if (data.phone) data.phone = cleanPhone(data.phone);
    if (data.contact_phone) data.contact_phone = cleanPhone(data.contact_phone);
    if (['users', 'profiles'].includes(table) && ['client', 'restaurant', 'livreur'].includes(data.role)) {
      if (isBlankName(data.full_name) && data.role === 'client') data.full_name = buildFallbackClientName(data.phone || data.id);
      if (!cleanEmail(data.email)) data.email = resolveUserEmail({ email: data.email, name: data.full_name, phone: data.phone || data.id, role: data.role });
    }
    if (!data.id) data.id = undefined;
    const keys = Object.keys(data).filter(k => data[k] !== undefined);
    const values = keys.map(k => data[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const { rows: [row] } = await pool.query(
      `INSERT INTO ${tbl} (${keys.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`,
      values
    );
    const clean = SENSITIVE_TABLES.has(table) ? stripSecretFields(fromSnake(row)) : fromSnake(row);
    if (table === 'orders') {
      startSmartDispatch(clean, pool, io);
    } else {
      io.emit(`realtime:${table}`, { eventType: 'INSERT', new: clean });
    }
    if (SENSITIVE_TABLES.has(table)) {
      await writeAdminAuditLog(pool, req, {
        action: 'admin.users.update',
        targetType: table,
        targetId: row.id,
        newValue: clean,
        reason: cleanText(req.body?.reason, 'Creation generique admin'),
      });
    }
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
      if (isAdmin) {
        req.adminAccess = await loadAdminAccess(pool, req.user.sub);
        if (!requireAdminPermissionInRoute(req, res, 'admin.users.update')) return;
      }
    }
    if (!(await requireAdminTablePermission(req, res, table, 'update'))) return;
    const tbl = quoteTable(table);
    const data = toSnake(req.body);
    if (data.phone) data.phone = cleanPhone(data.phone);
    if (data.contact_phone) data.contact_phone = cleanPhone(data.contact_phone);
    if (['users', 'profiles'].includes(table) && ['client', 'restaurant', 'livreur'].includes(data.role)) {
      if (!cleanEmail(data.email)) data.email = resolveUserEmail({ email: data.email, name: data.full_name, phone: data.phone || id, role: data.role });
    }
    // O-2 : borne les changements de statut de commande par role. Un client ne
    // peut QUE annuler sa propre commande (pending/confirmed) ; il ne peut jamais
    // passer une commande a un autre statut (ex. 'delivered'). Ref D-16.
    if (table === 'orders' && data.status !== undefined && req.user?.role === 'client') {
      const { rows: [ord] } = await pool.query("SELECT customer_id::text AS cust, status FROM orders WHERE id::text = $1", [String(id)]);
      if (!ord) return res.status(404).json({ error: 'Commande introuvable' });
      const own = ord.cust === String(req.user?.sub);
      const okCancel = own && data.status === 'cancelled' && ['pending', 'confirmed'].includes(ord.status);
      if (!okCancel) return res.status(403).json({ error: 'Action non autorisee sur cette commande.' });
    }
    // updated_at est géré par le serveur (now() ci-dessous) : on l'ignore s'il
    // arrive dans le corps, sinon UPDATE ... SET updated_at=$n, updated_at=now()
    // => "multiple assignments to same column updated_at" (500). Ce bug bloquait
    // toutes les transitions de statut de commande (confirmer/préparer/livrer),
    // les libs envoyant systématiquement updated_at dans le payload.
    let keys = Object.keys(data).filter(k => k !== 'id' && k !== 'updated_at');
    if (SENSITIVE_TABLES.has(table) && !isAdmin) {
      keys = keys.filter(k => !ADMIN_ONLY_USER_FIELDS.includes(k));
    }
    if (!keys.length) return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    const sets = keys.map((k, i) => `${k} = $${i + 2}`);
    if (await tableHasUpdatedAt(table)) sets.push('updated_at = now()');
    const values = [id, ...keys.map(k => data[k])];
    const { rows: [row] } = await pool.query(
      `UPDATE ${tbl} SET ${sets.join(',')} WHERE id = $1 RETURNING *`,
      values
    );
    if (!row) return res.status(404).json({ error: 'Non trouvé' });
    const clean = SENSITIVE_TABLES.has(table) ? stripSecretFields(fromSnake(row)) : fromSnake(row);
    io.emit(`realtime:${table}`, { eventType: 'UPDATE', new: clean });
    if (isAdmin && (SENSITIVE_TABLES.has(table) || ADMIN_TABLE_PERMISSIONS.update?.[table])) {
      await writeAdminAuditLog(pool, req, {
        action: ADMIN_TABLE_PERMISSIONS.update?.[table] || 'admin.users.update',
        targetType: table,
        targetId: row.id,
        newValue: clean,
        reason: cleanText(req.body?.reason, 'Modification generique admin'),
      });
    }
    res.json(clean);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/:table/:id
app.delete('/api/:table/:id', authRequired, adminPermissionRequired('admin.delete'), async (req, res) => {
  try {
    const { table, id } = req.params;
    const tbl = quoteTable(table);
    await pool.query(`DELETE FROM ${tbl} WHERE id = $1`, [id]);
    io.emit(`realtime:${table}`, { eventType: 'DELETE', old: { id } });
    await writeAdminAuditLog(pool, req, {
      action: 'admin.delete',
      targetType: table,
      targetId: id,
      reason: cleanText(req.body?.reason, 'Suppression definitive'),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Auth routes ──────────────────────────────────────────────
// POST /api/auth/send-otp
// ─── OTP par SMS (Twilio) — O-1 ───────────────────────────────
// Rate-limit simple en mémoire : 1 envoi / 60 s par numéro (anti-abus).
const otpLastSent = new Map();
function otpRateOk(bare) {
  const now = Date.now();
  const last = otpLastSent.get(bare) || 0;
  if (now - last < 60000) return false;
  otpLastSent.set(bare, now);
  return true;
}
const twilioConfigured = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
async function sendSmsViaTwilio(toE164, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return { sent: false, reason: 'twilio_not_configured' };
  try {
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: toE164, From: from, Body: body }).toString(),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return { sent: false, reason: `twilio_http_${resp.status}`, detail: detail.slice(0, 200) };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: 'twilio_exception', detail: err.message };
  }
}

app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    const raw = String(phone || '').replace(/\D/g, '');
    // Support cleaned (674465093) and prefixed (+237674465093) formats
    const bare = raw.replace(/^(?:00)?237/, '');
    if (!bare) return res.status(400).json({ error: 'Téléphone requis' });
    // O-1 : rate-limit anti-abus — 1 code / 60 s par numéro.
    if (!otpRateOk(bare)) return res.status(429).json({ error: 'Trop de demandes. Réessayez dans une minute.' });

    // Chercher les deux formats
    const { rows: users } = await pool.query(
      'SELECT id, phone FROM users WHERE phone = $1 OR phone = $2 LIMIT 1',
      [bare, `+237${bare}`]
    );
    const exists = users.length > 0;
    const exactPhone = exists ? users[0].phone : null;

    let smsSent = false;
    if (exists && exactPhone) {
      // O-1 : OTP réel aléatoire quand Twilio est configuré ; sinon repli démo
      // (12345) pour ne pas casser le login avant l'ajout des identifiants SMS.
      const twilio = twilioConfigured();
      const otp = twilio ? String(Math.floor(10000 + Math.random() * 90000)) : '12345';
      const expires = new Date(Date.now() + 10 * 60 * 1000);
      const fallbackName = buildFallbackClientName(exactPhone);
      await pool.query(
        `UPDATE users
         SET otp_code = $1,
             otp_expires_at = $2,
             full_name = CASE
               WHEN role = 'client' AND NULLIF(btrim(full_name), '') IS NULL THEN $4
               ELSE full_name
             END,
             updated_at = now()
         WHERE phone = $3`,
        [otp, expires, exactPhone, fallbackName]
      );
      if (twilio) {
        const e164 = String(exactPhone).startsWith('+') ? exactPhone : `+237${bare}`;
        const r = await sendSmsViaTwilio(e164, `MiamExpress : votre code de connexion est ${otp}. Valable 10 minutes.`);
        smsSent = r.sent;
        if (!r.sent) console.warn('OTP SMS non envoyé:', r.reason, r.detail || '');
      } else {
        console.log(`OTP (repli démo, Twilio non configuré) pour ${exactPhone}: ${otp}`);
      }
    }

    res.json({ success: true, exists, smsSent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-otp
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, code, requestedRole } = req.body;
    const raw = String(phone || '').replace(/\D/g, '');
    const bare = raw.replace(/^(?:00)?237/, '');
    const { rows: [user] } = await pool.query(
      `SELECT * FROM users WHERE (phone = $1 OR phone = $3) AND otp_code = $2 AND otp_expires_at > now()`,
      [bare, code, `+237${bare}`]
    );
    if (!user) return res.status(401).json({ error: 'Code invalide ou expiré' });

    // Le rôle ne doit JAMAIS être choisi par le client via requestedRole :
    // - un compte déjà établi (restaurant/livreur/admin) garde son rôle ; un
    //   requestedRole différent est un conflit (le front doit inviter à se
    //   connecter avec le bon profil), jamais un changement silencieux ;
    // - un compte client peut s'auto-attribuer un rôle applicant
    //   (restaurant/livreur, soumis à approbation), mais JAMAIS 'admin'.
    // Sans cette garde, requestedRole='admin' donnait un token admin (escalade)
    // et une connexion cliente rétrogradait un admin existant.
    const existingRole = user.role || 'client';
    let role;
    if (existingRole !== 'client') {
      if (requestedRole && requestedRole !== existingRole) {
        return res.status(409).json({ error: 'role-mismatch', existingRole });
      }
      role = existingRole;
    } else {
      role = (requestedRole && requestedRole !== 'admin') ? requestedRole : 'client';
    }
    const fallbackName = buildFallbackClientName(user.phone || phone);
    const { rows: [freshUser] } = await pool.query(
      `UPDATE users
       SET otp_code = NULL,
           otp_expires_at = NULL,
           role = $2::user_role,
           full_name = CASE
             WHEN $2::text = 'client' AND NULLIF(btrim(full_name), '') IS NULL THEN $3
             ELSE full_name
           END,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [user.id, role, fallbackName]
    );

    const updatedUser = freshUser || { ...user, role };
    const adminAccess = role === 'admin' ? await loadAdminAccess(pool, user.id) : null;
    const authUser = buildAuthUser(updatedUser, adminAccess);
    const token = jwt.sign({ sub: user.id, phone: updatedUser.phone, role, isApproved: authUser.isApproved }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ user: authUser, token, session: { access_token: token } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/signin — password sign-in
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { phone, email, password } = req.body;
    const identifier = String(phone || email || '').trim();
    const raw = identifier.replace(/\D/g, '');
    const bare = raw.replace(/^(?:00)?237/, '');
    const normalizedEmail = cleanEmail(identifier);
    const { rows: [user] } = await pool.query(
      `SELECT * FROM users WHERE phone = $1 OR phone = $2 OR lower(email) = lower($3) LIMIT 1`,
      [bare, `+237${bare}`, normalizedEmail || identifier.toLowerCase()]
    );
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

    const adminAccess = user.role === 'admin' ? await loadAdminAccess(pool, user.id) : null;
    const authUser = buildAuthUser(user, adminAccess);
    const token = jwt.sign({ sub: user.id, phone: user.phone, role: user.role, isApproved: authUser.isApproved }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ user: authUser, token, session: { access_token: token } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    // Support both formats: {phone, password, name, role} and Supabase {email, password, options: {data: {phone, full_name}}}
    const rawPhone = req.body.phone || req.body.options?.data?.phone || '';
    const phone = cleanPhone(rawPhone);
    const name = req.body.name || req.body.options?.data?.full_name || '';
    const password = req.body.password || '';
    const role = req.body.role || 'client';
    const fullName = isBlankName(name) && role === 'client' ? buildFallbackClientName(phone) : name;
    const email = resolveUserEmail({ email: req.body.email, name: fullName, phone, role });
    if (role === 'admin') return res.status(403).json({ error: 'La creation admin publique est interdite.' });
    if (!['client', 'restaurant', 'livreur'].includes(role)) return res.status(400).json({ error: 'Role invalide' });
    if (!phone) return res.status(400).json({ error: 'Numéro de téléphone requis' });
    // NE JAMAIS authentifier un compte existant depuis signup : sans cette garde,
    // un ON CONFLICT DO UPDATE renvoyait un JWT au rôle du compte existant sans
    // vérifier le mot de passe (usurpation admin/resto/livreur via le seul numéro).
    // Un numéro déjà inscrit doit passer par la connexion, pas par l'inscription.
    const { rows: existing } = await pool.query('SELECT 1 FROM users WHERE phone = $1', [phone]);
    if (existing.length) return res.status(409).json({ error: 'Ce numéro est déjà utilisé. Connectez-vous.' });
    // Quota par rôle (app_settings.quota_config) calculé sur les comptes RÉELS en
    // base — évite la création massive de profils. 0/absent = pas de limite.
    try {
      const { rows: [cfg] } = await pool.query("SELECT value FROM app_settings WHERE key = 'quota_config'");
      const max = cfg?.value?.[role];
      if (Number.isFinite(max) && max > 0) {
        const { rows: [{ n }] } = await pool.query('SELECT count(*)::int AS n FROM users WHERE role = $1', [role]);
        if (n >= max) return res.status(403).json({ error: `QUOTA_EXCEEDED: quota des ${role} atteint (${n}/${max}). Contactez l'administrateur.` });
      }
    } catch { /* app_settings absente : aucun quota appliqué */ }
    const hash = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (phone, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [phone, email, hash, fullName, role]
    );
    const authUser = buildAuthUser(user);
    const token = jwt.sign({ sub: user.id, phone: user.phone, role: user.role, isApproved: authUser.isApproved }, JWT_SECRET, { expiresIn: '30d' });
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
    const adminAccess = user.role === 'admin' ? await loadAdminAccess(pool, user.id) : null;
    res.json(buildAuthUser(user, adminAccess));
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
app.put('/api/admin/delivery-fee', authRequired, adminPermissionRequired('delivery_fees.manage'), async (req, res) => {
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
    await writeAdminAuditLog(pool, req, {
      action: 'delivery_fees.manage',
      targetType: 'delivery_fee_config',
      targetId: cfg.id || 'current',
      newValue: fromSnake(cfg),
      reason: cleanText(req.body?.reason, 'Mise a jour frais de livraison'),
    });
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
app.get('/api/admin/zones', authRequired, adminPermissionRequired('zones.manage'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT dz.*, u.full_name as disabled_by_name FROM disabled_zones dz LEFT JOIN users u ON dz.disabled_by = u.id ORDER BY dz.disabled_at DESC'
    );
    res.json({ data: rows.map(fromSnake), count: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/zones — désactiver une ville ou un quartier
app.post('/api/admin/zones', authRequired, adminPermissionRequired('zones.manage'), async (req, res) => {
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
    await writeAdminAuditLog(pool, req, {
      action: 'zones.manage',
      targetType: 'disabled_zone',
      targetId: zone.id,
      newValue: fromSnake(zone),
      reason: reason || 'Zone desactivee',
    });
    res.status(201).json({ ...fromSnake(zone), affectedRestaurants: affected.rows[0].count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/zones/:id — réactiver une zone
app.delete('/api/admin/zones/:id', authRequired, adminPermissionRequired('zones.manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: [zone] } = await pool.query('DELETE FROM disabled_zones WHERE id = $1 RETURNING *', [id]);
    if (!zone) return res.status(404).json({ error: 'Zone non trouvée' });
    // Le trigger AFTER DELETE réactive automatiquement les restaurants
    const affected = await pool.query(
      'SELECT count(*) FROM restaurants WHERE city = $1 AND ($2::text IS NULL OR neighborhood = $2) AND is_open = true',
      [zone.city, zone.neighborhood]
    );
    await writeAdminAuditLog(pool, req, {
      action: 'zones.manage',
      targetType: 'disabled_zone',
      targetId: zone.id,
      oldValue: fromSnake(zone),
      reason: 'Zone reactivee',
    });
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
app.get('/api/admin/zones/affected', authRequired, adminPermissionRequired('zones.manage'), async (req, res) => {
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
  console.log('🔗 Client WebSocket connecté');

  socket.on('register_user', (userId) => {
    socket.join(`user:${userId}`);
  });

  socket.on('accept_ping_order', (data) => {
    handleDriverPingResponse(socket, io, pool, { ...data, accepted: true });
  });

  socket.on('reject_ping_order', (data) => {
    handleDriverPingResponse(socket, io, pool, { ...data, accepted: false });
  });

  socket.on('subscribe', (table) => {
    socket.join(`realtime:${table}`);
  });
  socket.on('disconnect', () => console.log('❌ Client déconnecté'));
});

// ─── Start ─────────────────────────────────────────────────────
httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Miamexpress API sur http://127.0.0.1:${PORT}`);
  console.log(`   Health: http://127.0.0.1:${PORT}/health`);
});

export default app;






