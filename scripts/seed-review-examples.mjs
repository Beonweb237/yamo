// Seed example reviews directly in the VPS PostgreSQL database.
// Supabase is intentionally not used here.
//
// Usage:
//   npm run seed:reviews
//   node scripts/seed-review-examples.mjs --limit=8
//   node scripts/seed-review-examples.mjs --test

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = new Set(process.argv.slice(2));

const REVIEW_TEMPLATES = [
  {
    rating: 5,
    comment: 'Commande livree chaude, portions genereuses et emballage tres soigne. Experience premium du debut a la fin.',
    tags: ['plats chauds', 'emballage soigne', 'rapide'],
    authorName: 'Client test A.',
  },
  {
    rating: 5,
    comment: 'Le restaurant a respecte les indications et la qualite etait constante. Je recommande sans hesitation.',
    tags: ['qualite constante', 'instructions respectees', 'savoureux'],
    authorName: 'Client test B.',
  },
  {
    rating: 4,
    comment: 'Tres bonne commande, livraison propre et service fluide. Une petite marge sur le delai, mais l ensemble reste excellent.',
    tags: ['service fluide', 'bon gout', 'fiable'],
    authorName: 'Client test C.',
  },
  {
    rating: 5,
    comment: 'Presentation impeccable, plat bien assaisonne et suivi de commande rassurant. C est exactement le niveau attendu.',
    tags: ['presentation', 'bien assaisonne', 'suivi clair'],
    authorName: 'Client test D.',
  },
  {
    rating: 4,
    comment: 'Bon rapport qualite prix et repas arrive dans un tres bon etat. Je commanderai encore chez ce restaurant.',
    tags: ['bon rapport qualite prix', 'repas intact', 'recommande'],
    authorName: 'Client test E.',
  },
];

const DRIVER_TEMPLATES = [
  {
    rating: 5,
    comment: 'Livreur poli, appel clair a l arrivee et remise de commande tres professionnelle.',
    tags: ['poli', 'communication claire', 'professionnel'],
  },
  {
    rating: 4,
    comment: 'Livraison bien geree et commande remise sans probleme. Bonne experience globale.',
    tags: ['livraison fiable', 'commande intacte'],
  },
];

const DISH_TEMPLATES = [
  {
    rating: 5,
    comment: 'Plat tres bien execute, gout net et portion satisfaisante.',
    tags: ['savoureux', 'bonne portion'],
  },
  {
    rating: 4,
    comment: 'Bon plat, bien emballe et conforme a la commande.',
    tags: ['conforme', 'bien emballe'],
  },
];

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function loadEnv() {
  const fileEnv = Object.assign(
    {},
    parseEnvFile(join(appRoot, '.env')),
    parseEnvFile(join(appRoot, '.env.local')),
    parseEnvFile(join(appRoot, '.env.server')),
    parseEnvFile(join(appRoot, 'server', '.env.server')),
  );
  return { ...fileEnv, ...process.env };
}

function getArgValue(name, fallback) {
  const prefix = `${name}=`;
  const arg = [...args].find((value) => value.startsWith(prefix));
  if (!arg) return fallback;
  return arg.slice(prefix.length);
}

function makePool(env) {
  const sslEnabled = env.DB_SSL === 'true' || env.PGSSLMODE === 'require';
  const ssl = sslEnabled ? { rejectUnauthorized: false } : undefined;
  if (env.DATABASE_URL) {
    return new Pool({ connectionString: env.DATABASE_URL, ssl });
  }
  return new Pool({
    host: env.DB_HOST || env.PGHOST || '127.0.0.1',
    port: Number(env.DB_PORT || env.PGPORT || 5432),
    database: env.DB_NAME || env.PGDATABASE || 'miamexpress',
    user: env.DB_USER || env.PGUSER || 'miamexpress',
    password: env.DB_PASSWORD || env.PGPASSWORD || 'REMOVED_SECRET',
    ssl,
  });
}

function describeDbTarget(env) {
  if (env.DATABASE_URL) return 'DATABASE_URL';
  const host = env.DB_HOST || env.PGHOST || '127.0.0.1';
  const port = env.DB_PORT || env.PGPORT || 5432;
  const database = env.DB_NAME || env.PGDATABASE || 'miamexpress';
  const user = env.DB_USER || env.PGUSER || 'miamexpress';
  return `${user}@${host}:${port}/${database}`;
}

async function tableExists(client, tableName) {
  const { rows } = await client.query('SELECT to_regclass($1) AS name', [`public.${tableName}`]);
  return Boolean(rows[0]?.name);
}

async function getColumns(client, tableName) {
  const { rows } = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return new Set(rows.map((row) => row.column_name));
}

async function assertReviewsReady(client) {
  const hasReviews = await tableExists(client, 'reviews');
  const hasSummaries = await tableExists(client, 'review_summaries');
  if (!hasReviews || !hasSummaries) {
    throw new Error('La migration avis n est pas appliquee. Applique app/server/migrations/20260716_reviews.sql puis relance ce seed.');
  }

  const columns = await getColumns(client, 'reviews');
  const required = [
    'order_id',
    'customer_id',
    'restaurant_id',
    'target_type',
    'target_id',
    'rating',
    'comment',
    'tags',
    'status',
    'is_test',
  ];
  const missing = required.filter((column) => !columns.has(column));
  if (missing.length) {
    throw new Error(`La table reviews existe mais le schema est incomplet: ${missing.join(', ')}.`);
  }
}

async function fetchDeliveredOrders(client, limit) {
  const hasDeliveries = await tableExists(client, 'deliveries');
  const deliveryJoin = hasDeliveries
    ? `LEFT JOIN LATERAL (
         SELECT d.driver_id::text AS delivery_driver_id
         FROM deliveries d
         WHERE d.order_id::text = o.id::text AND d.driver_id IS NOT NULL
         ORDER BY d.id::text
         LIMIT 1
       ) d ON true`
    : '';
  const deliverySelect = hasDeliveries ? ', d.delivery_driver_id' : ", NULL::text AS delivery_driver_id";

  const orderColumns = await getColumns(client, 'orders');
  const timeColumns = ['delivered_at', 'updated_at', 'created_at']
    .filter((column) => orderColumns.has(column))
    .map((column) => `o.${column}`);
  const orderBy = timeColumns.length ? `ORDER BY COALESCE(${timeColumns.join(', ')}) DESC` : 'ORDER BY o.id::text';

  const { rows } = await client.query(
    `SELECT o.*, r.name AS restaurant_name, u.full_name AS customer_name${deliverySelect}
     FROM orders o
     LEFT JOIN restaurants r ON r.id::text = o.restaurant_id::text
     LEFT JOIN users u ON u.id::text = o.customer_id::text
     ${deliveryJoin}
     WHERE o.status = 'delivered'
     ${orderBy}
     LIMIT $1`,
    [limit],
  );
  return rows;
}

async function fetchDishForOrder(client, orderId) {
  if (!(await tableExists(client, 'order_items'))) return null;
  try {
    const { rows } = await client.query(
      `SELECT oi.menu_item_id::text AS dish_id, COALESCE(oi.name, mi.name) AS dish_name
       FROM order_items oi
       LEFT JOIN menu_items mi ON mi.id::text = oi.menu_item_id::text
       WHERE oi.order_id::text = $1 AND oi.menu_item_id IS NOT NULL
       ORDER BY oi.id::text
       LIMIT 1`,
      [String(orderId)],
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function insertReview(client, review) {
  const { rows: existing } = await client.query(
    `SELECT id FROM reviews
     WHERE order_id::text = $1
       AND target_type = $2
       AND target_id = $3
       AND COALESCE(dish_id, '') = COALESCE($4, '')
     LIMIT 1`,
    [review.orderId, review.targetType, review.targetId, review.dishId ?? ''],
  );
  if (existing[0]) return { inserted: false, id: existing[0].id };

  const { rows } = await client.query(
    `INSERT INTO reviews (
       order_id, customer_id, restaurant_id, target_type, target_id,
       driver_id, dish_id, rating, comment, tags, author_name,
       is_verified_order, is_test, status, created_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,'published',$13)
     RETURNING id`,
    [
      review.orderId,
      review.customerId,
      review.restaurantId,
      review.targetType,
      review.targetId,
      review.driverId ?? null,
      review.dishId ?? null,
      review.rating,
      review.comment,
      review.tags,
      review.authorName,
      review.isTest,
      review.createdAt,
    ],
  );
  return { inserted: true, id: rows[0].id };
}

async function seedReviews(client, orders, isTest) {
  const stats = { inserted: 0, skipped: 0, restaurantReviews: 0, driverReviews: 0, dishReviews: 0 };
  const touchedRestaurantIds = new Set();

  for (const [index, order] of orders.entries()) {
    const base = REVIEW_TEMPLATES[index % REVIEW_TEMPLATES.length];
    const createdAt = new Date(Date.now() - (index + 1) * 4 * 60 * 60 * 1000).toISOString();
    const orderId = String(order.id);
    const restaurantId = String(order.restaurant_id);
    const customerId = String(order.customer_id);
    const driverId = order.driver_id ? String(order.driver_id) : order.delivery_driver_id;
    touchedRestaurantIds.add(restaurantId);

    const restaurantReview = await insertReview(client, {
      orderId,
      customerId,
      restaurantId,
      targetType: 'restaurant',
      targetId: restaurantId,
      rating: base.rating,
      comment: base.comment,
      tags: base.tags,
      authorName: base.authorName,
      isTest,
      createdAt,
    });
    restaurantReview.inserted ? stats.inserted++ : stats.skipped++;
    stats.restaurantReviews++;

    if (driverId) {
      const driver = DRIVER_TEMPLATES[index % DRIVER_TEMPLATES.length];
      const driverReview = await insertReview(client, {
        orderId,
        customerId,
        restaurantId,
        targetType: 'driver',
        targetId: String(driverId),
        driverId: String(driverId),
        rating: driver.rating,
        comment: driver.comment,
        tags: driver.tags,
        authorName: base.authorName,
        isTest,
        createdAt,
      });
      driverReview.inserted ? stats.inserted++ : stats.skipped++;
      stats.driverReviews++;
    }

    const dish = await fetchDishForOrder(client, orderId);
    if (dish?.dish_id) {
      const dishTemplate = DISH_TEMPLATES[index % DISH_TEMPLATES.length];
      const dishReview = await insertReview(client, {
        orderId,
        customerId,
        restaurantId,
        targetType: 'dish',
        targetId: String(dish.dish_id),
        dishId: String(dish.dish_id),
        rating: dishTemplate.rating,
        comment: dishTemplate.comment,
        tags: dishTemplate.tags,
        authorName: base.authorName,
        isTest,
        createdAt,
      });
      dishReview.inserted ? stats.inserted++ : stats.skipped++;
      stats.dishReviews++;
    }
  }

  return { stats, touchedRestaurantIds: [...touchedRestaurantIds] };
}

async function printSummaries(client, restaurantIds) {
  if (!restaurantIds.length) return;
  const { rows } = await client.query(
    `SELECT s.target_id, r.name AS restaurant_name, s.rating_avg, s.rating_weighted, s.review_count, s.verified_count
     FROM review_summaries s
     LEFT JOIN restaurants r ON r.id::text = s.target_id::text
     WHERE s.target_type = 'restaurant' AND s.target_id = ANY($1::text[])
     ORDER BY s.rating_weighted DESC, s.review_count DESC`,
    [restaurantIds],
  );

  console.log('\nSynthese visible par le frontend:');
  for (const row of rows) {
    const name = row.restaurant_name || row.target_id;
    console.log(`- ${name}: ${row.rating_avg}/5 (${row.review_count} avis, score ${row.rating_weighted}, verifies ${row.verified_count})`);
  }
}

async function main() {
  const env = loadEnv();
  const limit = Math.max(1, Math.min(30, Number(getArgValue('--limit', '8')) || 8));
  const isTest = args.has('--test');
  const pool = makePool(env);

  console.log(`Connexion Postgres: ${describeDbTarget(env)}`);
  console.log(`Mode avis: ${isTest ? 'test interne (is_test=true)' : 'public demo (is_test=false, visible)'}`);
  if (!env.DATABASE_URL && !env.DB_PASSWORD && !env.PGPASSWORD) {
    console.log('Avertissement: DB_PASSWORD/DATABASE_URL absent, utilisation des identifiants dev par defaut.');
  }

  const client = await pool.connect();
  try {
    await assertReviewsReady(client);
    const orders = await fetchDeliveredOrders(client, limit);
    if (!orders.length) {
      throw new Error('Aucune commande livree trouvee. Cree ou finalise une commande de simulation en status delivered, puis relance ce seed.');
    }

    const { stats, touchedRestaurantIds } = await seedReviews(client, orders, isTest);
    console.log(`\nAvis traites: ${stats.inserted} crees, ${stats.skipped} deja presents.`);
    console.log(`Cibles: ${stats.restaurantReviews} restaurants, ${stats.driverReviews} livreurs, ${stats.dishReviews} plats.`);
    await printSummaries(client, touchedRestaurantIds);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  if (err.code === '28P01') {
    console.error('\nSeed avis interrompu: identifiants Postgres invalides. Definis DB_PASSWORD ou DATABASE_URL dans app/.env.server puis relance npm run seed:reviews.');
  } else if (err.code === 'ECONNREFUSED') {
    console.error('\nSeed avis interrompu: Postgres est inaccessible. Verifie DB_HOST/DB_PORT ou lance le tunnel/serveur VPS.');
  } else {
    console.error(`\nSeed avis interrompu: ${err.message}`);
  }
  process.exit(1);
});
