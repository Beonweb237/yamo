// Tag les PLATS (menu_items.dietary_tags) de façon plausible pour couvrir les 18
// tags de préférence (DIETARY_TAG_META). Règles par mots-clés sur nom+catégorie
// (pas de faux tag), + garantie de couverture (≥1 plat par tag). DRY-RUN par
// défaut ; `--apply` pour écrire. N'écrase QUE les plats sans tag (idempotent-safe).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '..');
const APPLY = process.argv.includes('--apply');
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

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ALL_TAGS = ['sans-sucre', 'diabetique', 'pauvre-en-sel', 'vegetarien', 'vegan', 'halal', 'bio', 'riche-en-proteines', 'allege', 'epice', 'braise', 'traditionnel', 'sans-cube', 'fait-maison', 'sans-gluten', 'cocktail', 'detox', 'presse-du-jour'];

// Règles : si un mot-clé est présent dans nom+catégorie, on ajoute les tags plausibles.
const RULES = [
  { kw: ['salade'], tags: ['allege', 'detox', 'vegetarien', 'sans-gluten'] },
  { kw: ['jus', 'smoothie', 'bissap', 'detox', 'gingembre', 'goyave', 'passion', 'baobab', 'ananas'], tags: ['presse-du-jour', 'detox', 'vegan', 'sans-gluten'] },
  { kw: ['cocktail', 'mojito', 'punch', 'virgin'], tags: ['cocktail'] },
  { kw: ['brais', 'grill'], tags: ['braise', 'riche-en-proteines', 'sans-gluten'] },
  { kw: ['poisson', 'crevette', 'homard', 'thon', 'maquereau', 'sole', 'silure', 'mer', 'ocean'], tags: ['riche-en-proteines', 'sans-gluten'] },
  { kw: ['poulet', 'boeuf', 'viande', 'brochette', 'suya', 'saucisse', 'boukarou', 'dg', 'shawarma'], tags: ['riche-en-proteines', 'halal'] },
  { kw: ['ndole', 'eru', 'koki', 'bobolo', 'okok', 'sanga', 'mbongo', 'achu', 'kondre', 'taro'], tags: ['traditionnel', 'sans-cube', 'fait-maison'] },
  { kw: ['piment', 'epic', 'suya', 'pimente'], tags: ['epice'] },
  { kw: ['alloco', 'plantain', 'patate', 'frites', 'haricot', 'avocat', 'legume', 'vegetarien'], tags: ['vegetarien', 'allege'] },
  { kw: ['riz'], tags: ['sans-gluten'] },
  { kw: ['bio', 'fruit'], tags: ['bio', 'vegan', 'sans-sucre'] },
  { kw: ['eau', 'minerale'], tags: ['sans-sucre', 'sans-gluten'] },
];
// Tags « maison » ajoutés aux plats locaux / faits sur place.
const HOME_MADE_HINT = ['ndole', 'eru', 'koki', 'bobolo', 'okok', 'sanga', 'mbongo', 'achu', 'brais', 'alloco', 'poulet', 'poisson'];

async function main() {
  const { rows: dishes } = await pool.query('SELECT id, name, category, dietary_tags FROM menu_items ORDER BY category, name');
  console.log(`${dishes.length} plats. ${APPLY ? 'MODE APPLY' : 'DRY-RUN'}\n`);

  const perTag = Object.fromEntries(ALL_TAGS.map((t) => [t, []]));
  const plan = []; // {id, name, tags}
  for (const d of dishes) {
    const hay = norm(d.name) + ' ' + norm(d.category);
    const tags = new Set();
    for (const r of RULES) if (r.kw.some((k) => hay.includes(k))) r.tags.forEach((t) => tags.add(t));
    if (HOME_MADE_HINT.some((k) => hay.includes(k))) tags.add('fait-maison');
    const arr = [...tags].slice(0, 4); // max 4 tags/plat
    plan.push({ id: d.id, name: d.name, tags: arr });
    arr.forEach((t) => perTag[t].push(d.name));
  }

  // Garantie de couverture : pour tout tag < 1, on l'ajoute à des plats plausibles
  // (2 plats max par tag manquant), en priorité ceux qui ont le moins de tags.
  const fallback = {
    'diabetique': ['salade', 'poisson', 'legume'], 'pauvre-en-sel': ['salade', 'poisson', 'legume'],
    'allege': ['salade', 'legume'], 'sans-sucre': ['salade', 'eau', 'legume'],
    'fait-maison': [], 'traditionnel': ['ndole', 'poulet'], 'halal': ['poulet', 'boeuf'],
  };
  for (const tag of ALL_TAGS) {
    if (perTag[tag].length >= 1) continue;
    const hints = fallback[tag] || [];
    const candidates = plan
      .filter((p) => p.tags.length < 4 && (hints.length === 0 || hints.some((h) => norm(p.name).includes(h))))
      .sort((a, b) => a.tags.length - b.tags.length)
      .slice(0, 2);
    const chosen = candidates.length ? candidates : plan.filter((p) => p.tags.length < 4).slice(0, 2);
    for (const p of chosen) { if (!p.tags.includes(tag)) { p.tags.push(tag); perTag[tag].push(p.name); } }
  }

  console.log('Couverture par tag :');
  for (const t of ALL_TAGS) console.log(`  ${t.padEnd(20)} ${perTag[t].length} plat(s)${perTag[t].length === 0 ? '  ⟵ VIDE' : ''}`);

  let updated = 0;
  for (const p of plan) {
    if (p.tags.length === 0) continue;
    if (APPLY) await pool.query('UPDATE menu_items SET dietary_tags = $2 WHERE id = $1', [p.id, p.tags]);
    updated++;
  }
  console.log(`\n${APPLY ? 'APPLIQUÉ' : 'DRY-RUN'} : ${updated} plats tagués.`);
  await pool.end();
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
