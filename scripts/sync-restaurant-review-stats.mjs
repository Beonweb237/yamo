// Synchronise restaurants.rating/review_count depuis review_summaries.
// Execute depuis le VPS: node scripts/sync-restaurant-review-stats.mjs
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

function loadEnvFile(relativePath) {
  const filePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('.env.server');
loadEnvFile('server/.env.server');

const pool = new Pool({
  host: process.env.DB_HOST || process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
  database: process.env.DB_NAME || process.env.PGDATABASE || 'miamexpress',
  user: process.env.DB_USER || process.env.PGUSER || 'miamexpress',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
});

try {
  const { rows } = await pool.query(
    `UPDATE restaurants r
     SET rating = COALESCE(s.rating_avg, 0),
         review_count = COALESCE(s.review_count, 0)
     FROM restaurants base
     LEFT JOIN review_summaries s
       ON s.target_type = 'restaurant'
      AND s.target_id = base.id::text
     WHERE r.id = base.id
     RETURNING r.id, r.name, r.rating, r.review_count`
  );

  const nonZero = rows.filter((row) => Number(row.review_count) > 0).length;
  const zero = rows.length - nonZero;
  console.log(`Restaurants synchronises: ${rows.length}`);
  console.log(`Avec avis reels: ${nonZero}`);
  console.log(`Sans avis reels: ${zero}`);
  console.table(rows.slice(0, 12).map((row) => ({
    name: row.name,
    rating: Number(row.rating),
    review_count: Number(row.review_count),
  })));
} finally {
  await pool.end();
}