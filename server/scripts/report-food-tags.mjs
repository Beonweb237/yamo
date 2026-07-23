// Diagnostic : couverture des 18 tags de préférence (DIETARY_TAG_META) par les
// PLATS (menu_items) et les PROGRAMMES (meal_programs). Lecture seule.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..');
function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const env = { ...parseEnvFile(join(serverRoot, '.env')), ...parseEnvFile(join(serverRoot, '.env.server')), ...parseEnvFile(join(serverRoot, '..', '.env.server')), ...process.env };
const pool = new pg.Pool({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 5432), database: env.DB_NAME || 'miamexpress', user: env.DB_USER || 'miamexpress', password: env.DB_PASSWORD });

const TAGS = ['sans-sucre', 'diabetique', 'pauvre-en-sel', 'vegetarien', 'vegan', 'halal', 'bio', 'riche-en-proteines', 'allege', 'epice', 'braise', 'traditionnel', 'sans-cube', 'fait-maison', 'sans-gluten', 'cocktail', 'detox', 'presse-du-jour'];

async function main() {
  // Colonne tags des menu_items ?
  const cols = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'menu_items' AND (column_name ILIKE '%tag%' OR column_name ILIKE '%diet%')`
  );
  console.log('Colonnes tags de menu_items :', cols.rows.map((c) => `${c.column_name}(${c.data_type})`).join(', ') || 'AUCUNE');
  const tagCol = cols.rows[0]?.column_name;
  const { rows: [{ n: totalDishes }] } = await pool.query('SELECT count(*) n FROM menu_items');
  console.log('Total plats (menu_items) :', totalDishes);

  console.log('\nTag                    | plats | programmes');
  console.log('-----------------------|-------|-----------');
  for (const tag of TAGS) {
    let dishCount = 0;
    if (tagCol) {
      const isArray = cols.rows[0].data_type === 'ARRAY';
      const q = isArray
        ? `SELECT count(*) n FROM menu_items WHERE $1 = ANY(${tagCol})`
        : `SELECT count(*) n FROM menu_items WHERE ${tagCol}::text ILIKE '%' || $1 || '%'`;
      dishCount = Number((await pool.query(q, [tag])).rows[0].n);
    }
    const progCount = Number((await pool.query('SELECT count(*) n FROM meal_programs WHERE $1 = ANY(dietary_tags)', [tag])).rows[0].n);
    const flag = dishCount === 0 ? '  ⟵ 0 plat' : '';
    console.log(`${tag.padEnd(22)} | ${String(dishCount).padStart(5)} | ${String(progCount).padStart(9)}${flag}`);
  }
  await pool.end();
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
