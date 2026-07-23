// Diagnostic : pourquoi une demande culinaire n'apparaît pas côté resto ?
// Compare la ville des food_requests ouvertes aux villes des restaurants. Lecture seule.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..');
function parseEnvFile(p) { if (!existsSync(p)) return {}; const o = {}; for (const l of readFileSync(p, 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ''); } return o; }
const env = { ...parseEnvFile(join(serverRoot, '.env')), ...parseEnvFile(join(serverRoot, '.env.server')), ...parseEnvFile(join(serverRoot, '..', '.env.server')), ...process.env };
const pool = new pg.Pool({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 5432), database: env.DB_NAME || 'miamexpress', user: env.DB_USER || 'miamexpress', password: env.DB_PASSWORD });
async function main() {
  const fr = await pool.query("SELECT id, title, city, status, expires_at, expires_at > now() AS not_expired FROM food_requests ORDER BY created_at DESC LIMIT 10");
  console.log('=== FOOD_REQUESTS (10 dernières) ===');
  fr.rows.forEach(r => console.log(`  [${r.status}] "${r.title}" | ville="${r.city}" | expire ${r.not_expired ? 'plus tard ✅' : 'EXPIRÉ ❌'}`));
  const openCities = await pool.query("SELECT DISTINCT city FROM food_requests WHERE status='open' AND expires_at > now()");
  console.log('\nVilles des demandes OUVERTES :', openCities.rows.map(r => `"${r.city}"`).join(', ') || '(aucune)');
  const rc = await pool.query("SELECT city, count(*) n FROM restaurants GROUP BY city ORDER BY n DESC");
  console.log('\n=== VILLES DES RESTAURANTS ===');
  rc.rows.forEach(r => console.log(`  "${r.city}" → ${r.n} resto(s)`));
  // Match exact ?
  console.log('\n=== MATCH (demande ouverte ↔ resto même ville, exact) ===');
  for (const oc of openCities.rows) {
    const m = await pool.query('SELECT count(*) n FROM restaurants WHERE city = $1', [oc.city]);
    console.log(`  demande ville "${oc.city}" → ${m.rows[0].n} resto(s) qui la verraient`);
  }
  await pool.end();
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
