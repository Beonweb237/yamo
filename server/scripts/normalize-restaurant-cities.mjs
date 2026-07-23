// Normalise les villes des restaurants vers les libellés canoniques (accents/casse),
// pour que le match « demande.ville = resto.ville » (exact) ne casse pas.
// DRY-RUN par défaut ; --apply pour écrire.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..');
const APPLY = process.argv.includes('--apply');
function parseEnvFile(p) { if (!existsSync(p)) return {}; const o = {}; for (const l of readFileSync(p, 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ''); } return o; }
const env = { ...parseEnvFile(join(serverRoot, '.env')), ...parseEnvFile(join(serverRoot, '.env.server')), ...parseEnvFile(join(serverRoot, '..', '.env.server')), ...process.env };
const pool = new pg.Pool({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 5432), database: env.DB_NAME || 'miamexpress', user: env.DB_USER || 'miamexpress', password: env.DB_PASSWORD });

// Villes canoniques (mêmes libellés que src/data/cities.ts). Toute variante
// (sans accent, casse) est ramenée à la forme canonique.
const CANONICAL = ['Douala', 'Yaoundé', 'Bafoussam', 'Bamenda', 'Garoua', 'Maroua', 'Kribi', 'Limbé', 'Buea', 'Ngaoundéré'];
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const canonicalOf = (city) => CANONICAL.find((c) => norm(c) === norm(city)) || null;

async function main() {
  const { rows } = await pool.query('SELECT DISTINCT city FROM restaurants');
  let fixed = 0;
  for (const { city } of rows) {
    const canon = canonicalOf(city);
    if (canon && canon !== city) {
      console.log(`  "${city}" → "${canon}"`);
      if (APPLY) await pool.query('UPDATE restaurants SET city = $1 WHERE city = $2', [canon, city]);
      fixed++;
    } else if (!canon) {
      console.log(`  ⚠ "${city}" — hors liste canonique (laissé tel quel)`);
    }
  }
  console.log(`\n${APPLY ? 'APPLIQUÉ' : 'DRY-RUN'} : ${fixed} ville(s) normalisée(s).`);
  await pool.end();
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
