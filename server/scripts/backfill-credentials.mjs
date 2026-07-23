#!/usr/bin/env node
// ============================================================
// Backfill des identifiants restaurant / livreur (VPS Postgres)
// ============================================================
// Garantit que chaque restaurant et chaque livreur a un compte
// utilisable : téléphone présent et unique, email stocké (même
// formule que l'affichage admin), mot de passe par défaut, et
// restaurants.owner_id relié à un vrai compte user.
//
//   node scripts/backfill-credentials.mjs            → audit (dry-run)
//   node scripts/backfill-credentials.mjs --apply    → applique
//   node scripts/backfill-credentials.mjs --create-qa-admin  → crée l'admin QA temporaire
//   node scripts/backfill-credentials.mjs --delete-qa-admin  → le supprime
//
// À lancer depuis /home/ubuntu/miamexpress/server (bcrypt + pg + .env).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..');
const DEFAULT_PASSWORD = 'Miamexpress2025';
const SALT_ROUNDS = 10;
const APPLY = process.argv.includes('--apply');
const QA_ADMIN_PHONE = '699000099';

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
// Même ordre que src/index.js : ../../.env.server (racine miamexpress) prioritaire.
const env = {
  ...parseEnvFile(join(serverRoot, '.env')),
  ...parseEnvFile(join(serverRoot, '.env.server')),
  ...parseEnvFile(join(serverRoot, '..', '.env.server')),
  ...process.env,
};
const pool = new pg.Pool({
  host: env.DB_HOST || '127.0.0.1',
  port: Number(env.DB_PORT || 5432),
  database: env.DB_NAME || 'miamexpress',
  user: env.DB_USER || 'miamexpress',
  password: env.DB_PASSWORD,
});

// ── Même formule que le front (getUserEmail) et le serveur (buildUserEmail) ──
const emailToken = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'utilisateur';
function derivedEmail(name, phone) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const first = emailToken(parts[0] || 'client');
  const last = emailToken(parts.length > 1 ? parts[parts.length - 1] : String(phone || '').slice(-4) || 'miamexpress');
  const domain = `${first}.${last}`.length % 2 === 0 ? 'gmail.com' : 'yahoo.fr';
  return `${last}.${first}@${domain}`;
}

async function generatePhone(client, taken) {
  for (let i = 0; i < 200; i++) {
    const candidate = '659' + String(Math.floor(100000 + Math.random() * 900000));
    if (taken.has(candidate)) continue;
    const { rows } = await client.query(
      `SELECT 1 FROM users WHERE phone IN ($1, $2)
       UNION SELECT 1 FROM restaurants WHERE phone IN ($1, $2) LIMIT 1`,
      [candidate, `+237${candidate}`]
    );
    if (!rows.length) { taken.add(candidate); return candidate; }
  }
  throw new Error('Impossible de générer un numéro unique');
}

const actions = [];
function plan(label, fn) { actions.push({ label, fn }); }

async function main() {
  const client = await pool.connect();
  try {
    if (process.argv.includes('--create-qa-admin')) {
      const hash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
      await client.query(
        `INSERT INTO users (phone, email, password_hash, full_name, role, is_approved)
         VALUES ($1, 'qa.admin@miamexpress.cm', $2, 'QA Admin (temporaire)', 'admin', true)
         ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', is_approved = true`,
        [QA_ADMIN_PHONE, hash]
      );
      console.log(`Admin QA prêt : ${QA_ADMIN_PHONE} / ${DEFAULT_PASSWORD} — À SUPPRIMER après les tests (--delete-qa-admin).`);
      return;
    }
    if (process.argv.includes('--delete-qa-admin')) {
      const { rowCount } = await client.query(`DELETE FROM users WHERE phone = $1 AND role = 'admin' AND full_name = 'QA Admin (temporaire)'`, [QA_ADMIN_PHONE]);
      console.log(rowCount ? 'Admin QA supprimé.' : 'Admin QA introuvable (déjà supprimé ?).');
      return;
    }

    if (process.argv.includes('--check-passwords')) {
      // Lecture seule : le hash de chaque compte correspond-il au mot de passe
      // par défaut affiché dans l'admin ? (un reset admin le rend différent — normal)
      const { rows } = await client.query(
        `SELECT u.full_name, u.phone, u.role, u.password_hash
         FROM users u WHERE u.role IN ('restaurant', 'livreur') ORDER BY u.role, u.full_name`
      );
      // Candidats connus du projet (défaut admin, gen-hash.js, OTP démo…)
      const candidates = [DEFAULT_PASSWORD, 'admin2026', 'miamexpress', 'Miamexpress2026', 'MiamExpress2025', '12345', 'demo2025', 'password'];
      const counts = new Map(); let missing = 0, unknown = 0;
      for (const u of rows) {
        if (!u.password_hash) { missing++; console.log(`  ✗ [${u.role}] ${u.full_name || u.phone} : AUCUN mot de passe`); continue; }
        let matched = null;
        for (const c of candidates) if (await bcrypt.compare(c, u.password_hash)) { matched = c; break; }
        if (matched) counts.set(matched, (counts.get(matched) || 0) + 1);
        else { unknown++; console.log(`  ? [${u.role}] ${u.full_name || u.phone} : aucun candidat ne correspond`); }
      }
      console.log(`\n${rows.length} comptes — répartition :`);
      for (const [pwd, n] of counts) console.log(`  ${n} × « ${pwd} »`);
      console.log(`  ${unknown} inconnus, ${missing} sans mot de passe.`);
      return;
    }

    if (process.argv.includes('--sync-passwords')) {
      // Aligne l'affichage admin (Miamexpress2025) sur la réalité : les comptes
      // restés au mot de passe de seed « 12345 » (ou sans mot de passe) sont
      // remis au défaut. Un vrai reset admin (autre valeur) n'est JAMAIS écrasé.
      const SEED_PASSWORD = '12345';
      const { rows } = await client.query(
        `SELECT id, full_name, phone, role, password_hash FROM users WHERE role IN ('restaurant', 'livreur')`
      );
      const hash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
      const targets = [];
      for (const u of rows) {
        if (await bcrypt.compare(DEFAULT_PASSWORD, u.password_hash || '')) continue; // déjà bon
        if (!u.password_hash || await bcrypt.compare(SEED_PASSWORD, u.password_hash)) targets.push(u);
      }
      console.log(`${targets.length}/${rows.length} comptes à réaligner sur « ${DEFAULT_PASSWORD} » :`);
      for (const u of targets) console.log(`  • [${u.role}] ${u.full_name || u.phone}`);
      if (!APPLY) { console.log('\nDry-run. Relancer avec --sync-passwords --apply.'); return; }
      for (const u of targets) {
        await client.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [hash, u.id]);
        console.log('  ✓', u.full_name || u.phone);
      }
      console.log('Synchronisation terminée.');
      return;
    }

    const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    const taken = new Set();

    // ── 1. Restaurants : owner, téléphone, email ────────────
    const { rows: restos } = await client.query(
      `SELECT r.id, r.name, r.phone, r.owner_id, u.id AS user_id, u.phone AS user_phone,
              u.email AS user_email, (u.password_hash IS NOT NULL) AS has_pwd
       FROM restaurants r LEFT JOIN users u ON u.id = r.owner_id ORDER BY r.name`
    );
    for (const r of restos) {
      let ownerId = r.user_id;
      let ownerPhone = r.user_phone || r.phone || null;
      if (ownerPhone) ownerPhone = ownerPhone.replace(/\D/g, '').replace(/^(?:00)?237/, '') || null;

      if (!ownerId) {
        // Chercher un user restaurant existant portant le téléphone du resto
        if (ownerPhone) {
          const { rows: [u] } = await client.query(
            `SELECT id, phone, email, (password_hash IS NOT NULL) AS has_pwd FROM users WHERE phone IN ($1, $2) LIMIT 1`,
            [ownerPhone, `+237${ownerPhone}`]
          );
          if (u) { ownerId = u.id; r.user_email = u.email; r.has_pwd = u.has_pwd; }
        }
        if (!ownerId) {
          const phone = ownerPhone || await generatePhone(client, taken);
          const email = derivedEmail(r.name, phone);
          plan(`[resto] ${r.name} : créer compte owner (${phone} / ${email} / mdp défaut) + lier owner_id`, async () => {
            const { rows: [nu] } = await client.query(
              `INSERT INTO users (phone, email, password_hash, full_name, role, is_approved)
               VALUES ($1, $2, $3, $4, 'restaurant', true)
               ON CONFLICT (phone) DO UPDATE SET role = 'restaurant', is_approved = true
               RETURNING id`,
              [phone, email, defaultHash, r.name]
            );
            await client.query(`UPDATE restaurants SET owner_id = $1, phone = COALESCE(NULLIF(phone, ''), $2) WHERE id = $3`, [nu.id, phone, r.id]);
          });
          continue;
        }
        const oid = ownerId;
        plan(`[resto] ${r.name} : lier owner_id → user existant ${oid}`, () =>
          client.query(`UPDATE restaurants SET owner_id = $1 WHERE id = $2`, [oid, r.id]));
      }

      // Compte owner existant : compléter les manques
      const fixes = [];
      if (!ownerPhone) {
        const phone = await generatePhone(client, taken);
        fixes.push(['téléphone ' + phone, `UPDATE users SET phone = '${phone}' WHERE id = $1`,
          `UPDATE restaurants SET phone = COALESCE(NULLIF(phone,''), '${phone}') WHERE id = '${r.id}'`]);
        ownerPhone = phone;
      } else if (!r.phone) {
        plan(`[resto] ${r.name} : recopier téléphone owner ${ownerPhone} sur la fiche restaurant`, () =>
          client.query(`UPDATE restaurants SET phone = $1 WHERE id = $2`, [ownerPhone, r.id]));
      }
      if (!r.user_email) fixes.push(['email ' + derivedEmail(r.name, ownerPhone), `UPDATE users SET email = '${derivedEmail(r.name, ownerPhone)}' WHERE id = $1`]);
      if (!r.has_pwd) fixes.push(['mot de passe défaut', null, null, 'pwd']);
      for (const [label, sql, extraSql, kind] of fixes) {
        const oid = ownerId;
        plan(`[resto] ${r.name} : ${label}`, async () => {
          if (kind === 'pwd') await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2 AND password_hash IS NULL`, [defaultHash, oid]);
          else { await client.query(sql, [oid]); if (extraSql) await client.query(extraSql); }
        });
      }
    }

    // ── 2. Livreurs : téléphone, email, mot de passe ────────
    const { rows: drivers } = await client.query(
      `SELECT id, full_name, phone, email, (password_hash IS NOT NULL) AS has_pwd FROM users WHERE role = 'livreur' ORDER BY full_name`
    );
    for (const d of drivers) {
      const bare = (d.phone || '').replace(/\D/g, '').replace(/^(?:00)?237/, '');
      if (!bare) {
        const phone = await generatePhone(client, taken);
        plan(`[livreur] ${d.full_name || d.id} : téléphone ${phone}`, () =>
          client.query(`UPDATE users SET phone = $1 WHERE id = $2`, [phone, d.id]));
        d.phone = phone;
      }
      if (!d.email) {
        const email = derivedEmail(d.full_name, d.phone);
        plan(`[livreur] ${d.full_name || d.id} : email ${email}`, () =>
          client.query(`UPDATE users SET email = $1 WHERE id = $2`, [email, d.id]));
      }
      if (!d.has_pwd) {
        plan(`[livreur] ${d.full_name || d.id} : mot de passe défaut`, () =>
          client.query(`UPDATE users SET password_hash = $1 WHERE id = $2 AND password_hash IS NULL`, [defaultHash, d.id]));
      }
    }

    // ── Rapport / application ───────────────────────────────
    console.log(`Audit : ${restos.length} restaurants, ${drivers.length} livreurs — ${actions.length} correction(s) nécessaires.`);
    for (const a of actions) console.log('  •', a.label);
    if (!APPLY) { console.log('\nDry-run. Relancer avec --apply pour appliquer.'); return; }
    for (const a of actions) { await a.fn(); console.log('  ✓', a.label); }
    console.log('Backfill terminé.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error('ERREUR :', err.message); process.exit(1); });
