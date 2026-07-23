#!/usr/bin/env node
// ============================================================
// Sécurisation des comptes admin (série SEC — 21/07/2026)
// ============================================================
// Remplace le mot de passe « 12345 » de TOUS les comptes admin :
//   - le VRAI admin (REAL_ADMIN_PHONE) reçoit un mot de passe fort COMMUNIQUÉ ;
//   - les comptes de démo + parasites reçoivent un mot de passe fort ALÉATOIRE
//     (neutralisés — 12345 ne fonctionne plus nulle part).
// Lecture seule sans --apply. À lancer depuis /home/ubuntu/miamexpress/server.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..');
const APPLY = process.argv.includes('--apply');
const REAL_ADMIN_PHONE = '674465093'; // Mimb Nout (mimb.nout@gmail.com)
const SALT = 10;

function parseEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const l of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const env = { ...parseEnv(join(serverRoot, '.env.server')), ...parseEnv(join(serverRoot, '..', '.env.server')), ...process.env };
const pool = new pg.Pool({
  host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 5432),
  database: env.DB_NAME || 'miamexpress', user: env.DB_USER || 'miamexpress', password: env.DB_PASSWORD,
});

// Mot de passe fort mais lisible pour le vrai admin (à retransmettre).
function readablePassword() {
  const words = ['Miam', 'Djolof', 'Ndole', 'Wouri', 'Sanaga', 'Buea', 'Kribi', 'Limbe'];
  const w = words[crypto.randomInt(words.length)];
  const n = crypto.randomInt(1000, 9999);
  const s = '!@#$%&*'[crypto.randomInt(7)];
  return `${w}-Admin-${n}${s}`;
}
const randomStrong = () => crypto.randomBytes(18).toString('base64url');

async function main() {
  const { rows } = await pool.query("SELECT id, phone, email, full_name FROM users WHERE role = 'admin' ORDER BY phone");
  const real = rows.find((r) => r.phone === REAL_ADMIN_PHONE);
  const others = rows.filter((r) => r.phone !== REAL_ADMIN_PHONE);

  const realPwd = readablePassword();
  console.log(`Admins: ${rows.length} — vrai admin: ${real ? real.email + ' (' + real.phone + ')' : 'INTROUVABLE'}`);
  console.log(`Comptes démo/parasites à neutraliser: ${others.length}`);
  if (!APPLY) { console.log('\nDry-run. Relancer avec --apply.'); return; }

  if (real) {
    await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [await bcrypt.hash(realPwd, SALT), real.id]);
    console.log('\n================ IDENTIFIANTS ADMIN (à conserver) ================');
    console.log(`  Connexion    : ${real.email}  OU  téléphone ${real.phone}`);
    console.log(`  Mot de passe : ${realPwd}`);
    console.log('==================================================================');
  }
  for (const o of others) {
    await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [await bcrypt.hash(randomStrong(), SALT), o.id]);
  }
  console.log(`\n${others.length} comptes admin démo/parasites neutralisés (mot de passe aléatoire). « 12345 » ne fonctionne plus.`);
}
main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); }).finally(() => pool.end());
