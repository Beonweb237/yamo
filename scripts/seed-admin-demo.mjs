// MiamExpress - donnees demo admin idempotentes pour le VPS.
// Execute depuis le VPS: node scripts/seed-admin-demo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { ensureAdminRbacSchema, replaceAdminUserRoles } from '../server/src/admin-rbac.js';

const { Pool } = pg;
const DEFAULT_PASSWORD = 'Miamexpress2025';
const ADMIN_DEMO_PASSWORD = '12345';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

function cleanPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00237')) digits = digits.slice(5);
  if (digits.startsWith('237') && digits.length > 3) digits = digits.slice(3);
  return digits;
}

function emailToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '') || 'miamexpress';
}

function demoEmail(name, phone, role) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const first = emailToken(parts[0] || role || 'demo');
  const last = emailToken(parts.length > 1 ? parts[parts.length - 1] : cleanPhone(phone).slice(-4) || 'demo');
  const domain = `${first}.${last}`.length % 2 === 0 ? 'gmail.com' : 'yahoo.fr';
  return `${last}.${first}@${domain}`;
}

const adminDemoProfiles = [
  ['Administrateur Demo', '690000001', 'super_admin', 'global', null],
  ['Mimb Nout', '674465093', 'super_admin', 'global', null],
  ['Admin General Demo', '690000021', 'admin_general', 'global', null],
  ['Responsable Douala Demo', '690000022', 'city_manager', 'city', 'Douala'],
  ['Gestion Restaurants Demo', '690000023', 'restaurant_manager', 'global', null],
  ['Gestion Livreurs Demo', '690000024', 'courier_manager', 'global', null],
  ['Support Client Demo', '690000025', 'support_agent', 'global', null],
  ['Dispatcher Douala Demo', '690000026', 'dispatcher', 'city', 'Douala'],
  ['Finance Demo', '690000027', 'finance_manager', 'global', null],
  ['Moderation Demo', '690000028', 'quality_moderator', 'global', null],
  ['Analyste Demo', '690000029', 'readonly_analyst', 'global', null],
];

async function loadBcrypt() {
  try {
    const mod = await import('bcryptjs');
    return mod.default || mod;
  } catch {
    const mod = await import('../server/node_modules/bcryptjs/index.js');
    return mod.default || mod;
  }
}

function loadEnvFile(relativePath) {
  const filePath = path.resolve(projectRoot, relativePath);
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
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
loadEnvFile('.env');

const pool = new Pool({
  host: process.env.DB_HOST || process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
  database: process.env.DB_NAME || process.env.PGDATABASE || 'miamexpress',
  user: process.env.DB_USER || process.env.PGUSER || 'miamexpress',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
});

const demoClients = [
  ['Amina Ndongo', '650200001', 'Douala'],
  ['Yannick Talla', '650200002', 'Douala'],
  ['Clarisse Mballa', '650200003', 'Yaounde'],
  ['Patrick Essomba', '650200004', 'Yaounde'],
  ['Rita Fotso', '650200005', 'Bafoussam'],
  ['Michel Kamdem', '650200006', 'Bafoussam'],
  ['Sandra Ebelle', '650200007', 'Limbe'],
  ['Eric Muna', '650200008', 'Limbe'],
  ['Diane Atangana', '650200009', 'Kribi'],
  ['Joel Nsame', '650200010', 'Kribi'],
  ['Nadia Fopa', '650200011', 'Douala'],
  ['Kevin Mbarga', '650200012', 'Yaounde'],
  ['Prisca Ngono', '650200013', 'Bafoussam'],
  ['Cedric Wambo', '650200014', 'Limbe'],
  ['Grace Enow', '650200015', 'Kribi'],
];

const cities = {
  Douala: ['Bonamoussadi', 'Akwa', 'Bonaberi', 'Makepe'],
  Yaounde: ['Bastos', 'Mvog-Mbi', 'Etoudi', 'Mendong'],
  Bafoussam: ['Tamdja', 'Djeleng', 'Kamkop', 'Banengo'],
  Kribi: ['Mboa Manga', 'Mpalla', 'Ngoye', 'Administratif'],
};

const driverSubmissions = Object.entries(cities).flatMap(([city, zones], cityIndex) =>
  zones.map((zone, zoneIndex) => ({
    name: `Livreur soumis ${city} ${zoneIndex + 1}`,
    phone: `651${String(cityIndex + 1).padStart(2, '0')}${String(zoneIndex + 1).padStart(3, '0')}`,
    city,
    address: zone,
    notes: `Candidature demo livreur en attente - zone ${zone}. Moto disponible, pieces a verifier par admin.`,
  }))
);

const restaurantSubmissions = [
  ['Le Comptoir de Bonamoussadi', '652300001', 'Douala', 'Bonamoussadi'],
  ['Akwa Lunch House', '652300002', 'Douala', 'Akwa'],
  ['Bastos Saveurs', '652300003', 'Yaounde', 'Bastos'],
  ['Mvog-Mbi Grill', '652300004', 'Yaounde', 'Mvog-Mbi'],
  ['Tamdja Food Lab', '652300005', 'Bafoussam', 'Tamdja'],
  ['Kamkop Delices', '652300006', 'Bafoussam', 'Kamkop'],
  ['Kribi Ocean Demo', '652300007', 'Kribi', 'Mboa Manga'],
  ['Mpalla Seafood Demo', '652300008', 'Kribi', 'Mpalla'],
].map(([restaurantName, phone, city, zone]) => ({
  ownerName: `Responsable ${restaurantName}`,
  restaurantName,
  phone,
  city,
  address: `${zone}, ${city}`,
  notes: `Candidature demo restaurant en attente - ${restaurantName}. Menu, photos et horaires a valider.`,
}));

async function query(sql, params = []) {
  return pool.query(sql, params);
}

async function upsertDemoUser({ role, name, phone, city, approved, passwordHash }) {
  const normalizedPhone = cleanPhone(phone);
  const email = demoEmail(name, normalizedPhone, role);
  const { rows: [user] } = await query(
    `INSERT INTO users (
       phone, email, password_hash, full_name, role, is_approved, is_suspended, is_online, city, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, false, false, $7, now(), now())
     ON CONFLICT (phone) DO UPDATE SET
       email = EXCLUDED.email,
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       role = EXCLUDED.role,
       city = COALESCE(EXCLUDED.city, users.city),
       is_approved = CASE WHEN users.is_approved THEN true ELSE EXCLUDED.is_approved END,
       is_suspended = false,
       suspension_reason = null,
       updated_at = now()
     RETURNING *`,
    [normalizedPhone, email, passwordHash, name, role, approved, city || null]
  );
  return user;
}

async function ensurePendingApplication({ user, type, restaurantName, city, address, phone, notes }) {
  const { rows: [existing] } = await query(
    `SELECT * FROM applications WHERE applicant_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT 1`,
    [user.id, type]
  );

  if (existing) {
    const { rows: [updated] } = await query(
      `UPDATE applications SET
         restaurant_name = $3,
         city = $4,
         address = $5,
         contact_phone = $6,
         notes = CASE WHEN status = 'pending' THEN $7 ELSE notes END
       WHERE id = $1 AND applicant_id = $2
       RETURNING *`,
      [existing.id, user.id, restaurantName || null, city || null, address || null, cleanPhone(phone || user.phone) || user.phone, notes || null]
    );
    return { row: updated, created: false };
  }

  const { rows: [created] } = await query(
    `INSERT INTO applications (
       applicant_id, type, status, restaurant_name, city, address, contact_phone, notes, restaurant_id, created_at
     )
     VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, null, now())
     RETURNING *`,
    [user.id, type, restaurantName || null, city || null, address || null, cleanPhone(phone || user.phone) || user.phone, notes || null]
  );
  return { row: created, created: true };
}

async function main() {
  console.log('=== Seed admin demo MiamExpress ===');
  const bcrypt = await loadBcrypt();
  const defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const adminPasswordHash = await bcrypt.hash(ADMIN_DEMO_PASSWORD, 10);
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email text');

  await ensureAdminRbacSchema(pool);
  let adminProfilesTouched = 0;
  for (const [name, phone, roleCode, scopeType, scopeValue] of adminDemoProfiles) {
    const adminUser = await upsertDemoUser({
      role: 'admin',
      name,
      phone,
      city: scopeType === 'city' ? scopeValue : 'Douala',
      approved: true,
      passwordHash: adminPasswordHash,
    });
    await replaceAdminUserRoles(pool, {
      adminUserId: adminUser.id,
      assignments: [{ roleCode, scopeType, scopeValue }],
      changedBy: 'seed-admin-demo',
    });
    adminProfilesTouched += 1;
  }

  let clientsTouched = 0;
  for (const [name, phone, city] of demoClients) {
    await upsertDemoUser({ role: 'client', name, phone, city, approved: true, passwordHash: defaultPasswordHash });
    clientsTouched += 1;
  }

  let driverAppsCreated = 0;
  for (const driver of driverSubmissions) {
    const user = await upsertDemoUser({
      role: 'livreur',
      name: driver.name,
      phone: driver.phone,
      city: driver.city,
      approved: false,
      passwordHash: defaultPasswordHash,
    });
    const result = await ensurePendingApplication({
      user,
      type: 'livreur',
      city: driver.city,
      address: driver.address,
      phone: driver.phone,
      notes: driver.notes,
    });
    if (result.created) driverAppsCreated += 1;
  }

  let restaurantAppsCreated = 0;
  for (const resto of restaurantSubmissions) {
    const user = await upsertDemoUser({
      role: 'restaurant',
      name: resto.ownerName,
      phone: resto.phone,
      city: resto.city,
      approved: false,
      passwordHash: defaultPasswordHash,
    });
    const result = await ensurePendingApplication({
      user,
      type: 'restaurant',
      restaurantName: resto.restaurantName,
      city: resto.city,
      address: resto.address,
      phone: resto.phone,
      notes: resto.notes,
    });
    if (result.created) restaurantAppsCreated += 1;
  }

  const { rows: [clientStats] } = await query("SELECT count(*)::int AS total FROM users WHERE role = 'client'");
  const { rows: appStats } = await query(
    `SELECT type, status, count(*)::int AS total
     FROM applications
     WHERE type IN ('livreur', 'restaurant')
     GROUP BY type, status
     ORDER BY type, status`
  );

  console.log(`Clients demo verifies: ${clientsTouched} (total clients en base: ${clientStats.total})`);
  console.log(`Nouvelles candidatures livreurs creees: ${driverAppsCreated}`);
  console.log(`Nouvelles candidatures restaurants creees: ${restaurantAppsCreated}`);
  console.table(appStats);
  console.log(`Profils admin demo synchronises: ${adminProfilesTouched}`);
  console.log(`Mot de passe demo operationnel commun: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('Seed admin demo echoue:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });


