// Contrôle global d'intégrité : aucune donnée affichée qui ne soit adossée à un
// profil réel. Vérifie les liens FK vers `users` et la dérivation des identités
// d'avis. Sort en code ≠ 0 si une anomalie « dure » est détectée.
//
// Usage :
//   npm run verify:integrity
//   node scripts/verify-data-integrity.mjs
//
// En mode mock (pas de base joignable), le script no-op (exit 0).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

function loadEnv() {
  // Priorité alignée sur l'app (index.js) : la racine `.env.server` est la source
  // canonique ; `server/.env.server` n'est qu'un repli hérité (plus basse priorité).
  const fileEnv = Object.assign(
    {},
    parseEnvFile(join(appRoot, 'server', '.env.server')),
    parseEnvFile(join(appRoot, '.env')),
    parseEnvFile(join(appRoot, '.env.local')),
    parseEnvFile(join(appRoot, '.env.server')),
  );
  return { ...fileEnv, ...process.env };
}

function makePool(env) {
  if (env.DATABASE_URL) return new Pool({ connectionString: env.DATABASE_URL });
  return new Pool({
    host: env.DB_HOST || env.PGHOST || '127.0.0.1',
    port: Number(env.DB_PORT || env.PGPORT || 5432),
    database: env.DB_NAME || env.PGDATABASE || 'miamexpress',
    user: env.DB_USER || env.PGUSER || 'miamexpress',
    password: env.DB_PASSWORD || env.PGPASSWORD,
  });
}

// Dérivation SQL identique à anonymizeName (serveur + seed).
const FN = `btrim(regexp_replace(coalesce(u.full_name, ''), '\\s+', ' ', 'g'))`;
const DERIVED = `CASE WHEN fn = '' THEN NULL WHEN position(' ' in fn) = 0 THEN fn
  ELSE split_part(fn, ' ', 1) || ' ' || upper(left(split_part(fn, ' ', 2), 1)) || '.' END`;

// hard = true → toute valeur > 0 fait échouer l'audit.
const CHECKS = [
  { id: 'REV-A', hard: true, label: 'Avis sans client (customer_id NULL)',
    sql: `SELECT count(*)::int AS n FROM reviews WHERE customer_id IS NULL` },
  { id: 'REV-B', hard: true, label: 'Avis à customer_id orphelin (aucun users)',
    sql: `SELECT count(*)::int AS n FROM reviews r WHERE r.customer_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.customer_id)` },
  { id: 'REV-C', hard: false, label: 'Avis dont le client n a pas le rôle client (info)',
    sql: `SELECT count(*)::int AS n FROM reviews r JOIN users u ON u.id = r.customer_id WHERE u.role <> 'client'` },
  { id: 'REV-D', hard: true, label: 'Identité d avis non dérivée du profil (nom fabriqué)',
    sql: `SELECT count(*)::int AS n FROM reviews r JOIN users u ON u.id = r.customer_id,
          LATERAL (SELECT ${FN} AS fn) x WHERE r.author_name IS DISTINCT FROM (${DERIVED})` },
  { id: 'REV-E', hard: false, label: 'Avis is_test publiés (filtrés du public par l API) (info)',
    sql: `SELECT count(*)::int AS n FROM reviews WHERE is_test = true AND status = 'published'` },
];

// Toute table à FK vers users : lignes dont la colonne pointe vers un users absent.
const FK_TABLES = [
  ['reviews', 'customer_id'], ['orders', 'customer_id'], ['orders', 'driver_id'],
  ['deliveries', 'driver_id'], ['applications', 'applicant_id'], ['restaurants', 'owner_id'],
  ['payout_requests', 'driver_id'], ['food_requests', 'customer_id'], ['addresses', 'user_id'],
];

async function tableExists(client, name) {
  const { rows } = await client.query('SELECT to_regclass($1) AS t', [`public.${name}`]);
  return Boolean(rows[0]?.t);
}

async function main() {
  const env = loadEnv();
  const pool = makePool(env);
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.log(`ℹ️  Base non joignable (mode mock ?) — audit ignoré. [${err.code || err.message}]`);
    await pool.end().catch(() => {});
    process.exit(0);
  }

  const results = [];
  let failures = 0;

  try {
    for (const c of CHECKS) {
      const { rows } = await client.query(c.sql);
      const n = rows[0].n;
      const ok = !c.hard || n === 0;
      if (!ok) failures++;
      results.push({ id: c.id, n, hard: c.hard, ok, label: c.label });
    }
    for (const [table, col] of FK_TABLES) {
      if (!(await tableExists(client, table))) continue;
      const { rows } = await client.query(
        `SELECT count(*)::int AS n FROM ${table} t WHERE t.${col} IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.${col})`
      );
      const n = rows[0].n;
      const ok = n === 0;
      if (!ok) failures++;
      results.push({ id: `FK ${table}.${col}`, n, hard: true, ok, label: `Orphelins ${table}.${col} → users` });
    }
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }

  console.log('\n=== Contrôle d intégrité — données adossées à un profil ===\n');
  for (const r of results) {
    const badge = !r.hard ? 'ℹ️ ' : r.ok ? '✅' : '❌';
    console.log(`${badge} ${String(r.id).padEnd(20)} ${String(r.n).padStart(5)}  ${r.label}`);
  }
  console.log('');

  if (failures > 0) {
    console.error(`❌ ${failures} anomalie(s) dure(s) détectée(s) — intégrité NON conforme.`);
    process.exit(1);
  }
  console.log('✅ Intégrité conforme : toute donnée affichée est adossée à un profil réel.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erreur audit:', err.message);
  process.exit(2);
});
