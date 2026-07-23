// Seed de programmes santé (meal_programs) — série FOOD.
// Crée une multitude raisonnable de programmes PUBLIÉS répartis sur de vrais
// restaurants, pour que /programmes soit visible. Idempotent (skip si (resto,nom)
// existe déjà). DRY-RUN par défaut ; `--apply` pour insérer réellement.
// À lancer depuis /home/ubuntu/miamexpress/server : node scripts/seed-meal-programs.mjs --apply
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

// Programmes santé variés (contexte camerounais).
// IMPORTANT : dietary_tags = IDs EXACTS de DIETARY_TAG_META (src/lib/dishes.ts), le
// vocabulaire du profil alimentaire client. Sinon la reco profil↔programmes et les
// filtres ne matchent pas. IDs valides : sans-sucre, diabetique, pauvre-en-sel,
// vegetarien, vegan, halal, bio, riche-en-proteines, allege, epice, braise,
// traditionnel, sans-cube, fait-maison, sans-gluten, cocktail, detox, presse-du-jour.
const TEMPLATES = [
  { name: 'Programme Diabète Équilibre', description: '28 déjeuners pauvres en sucre à index glycémique bas, pour un bon contrôle de la glycémie. Livrés chaque jour.', targetAudience: 'Personnes diabétiques', dietaryTags: ['sans-sucre', 'diabetique'], durationWeeks: 4, mealsCount: 28, priceFcfa: 42000, schedule: { frequence: 'quotidien' } },
  { name: 'Minceur & Détox', description: 'Repas légers, riches en légumes et protéines maigres, pour perdre du poids sainement sur un mois.', targetAudience: 'Perte de poids', dietaryTags: ['allege', 'detox'], durationWeeks: 4, mealsCount: 20, priceFcfa: 38000, schedule: { frequence: 'hebdomadaire', jours: ['lun', 'mar', 'mer', 'jeu', 'ven'] } },
  { name: 'Prise de Masse Sportif', description: 'Repas hyperprotéinés et énergétiques pour accompagner la musculation et la prise de masse.', targetAudience: 'Sportifs', dietaryTags: ['riche-en-proteines', 'fait-maison'], durationWeeks: 6, mealsCount: 42, priceFcfa: 60000, schedule: { frequence: 'quotidien' } },
  { name: 'Nutrition Femme Enceinte', description: 'Menus riches en fer, folates et calcium, pensés pour la grossesse. Suivi doux et régulier.', targetAudience: 'Femmes enceintes', dietaryTags: ['bio', 'fait-maison'], durationWeeks: 8, mealsCount: 40, priceFcfa: 55000, schedule: { frequence: 'hebdomadaire', jours: ['lun', 'mer', 'ven'] } },
  { name: 'Repas Doux Séniors', description: 'Plats faciles à mâcher et à digérer, équilibrés pour les personnes âgées. Portions adaptées.', targetAudience: '3e âge', dietaryTags: ['pauvre-en-sel', 'allege'], durationWeeks: 4, mealsCount: 28, priceFcfa: 40000, schedule: { frequence: 'quotidien' } },
  { name: 'Végétarien Gourmand', description: 'Une semaine sur quatre de plats végétariens variés et savoureux, 100% sans viande.', targetAudience: 'Végétariens', dietaryTags: ['vegetarien', 'fait-maison'], durationWeeks: 4, mealsCount: 24, priceFcfa: 36000, schedule: { frequence: 'hebdomadaire', jours: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam'] } },
  { name: 'Cœur & Tension', description: 'Repas pauvres en sel et en graisses saturées, favorables au cœur et à la tension artérielle.', targetAudience: 'Hypertension', dietaryTags: ['pauvre-en-sel', 'sans-sucre'], durationWeeks: 4, mealsCount: 28, priceFcfa: 44000, schedule: { frequence: 'quotidien' } },
  { name: 'Halal Équilibré', description: 'Menus équilibrés 100% halal, viandes certifiées, pour toute la famille.', targetAudience: 'Tous', dietaryTags: ['halal', 'traditionnel'], durationWeeks: 4, mealsCount: 28, priceFcfa: 41000, schedule: { frequence: 'quotidien' } },
  { name: 'Budget Étudiant Sain', description: 'Des repas complets et bon marché pour bien manger malgré un petit budget. Idéal étudiants.', targetAudience: 'Étudiants', dietaryTags: ['traditionnel', 'fait-maison'], durationWeeks: 4, mealsCount: 20, priceFcfa: 25000, schedule: { frequence: 'hebdomadaire', jours: ['lun', 'mer', 'ven'] } },
  { name: 'Cuisine Locale Santé', description: 'Le meilleur de la cuisine camerounaise, revisité léger : ndolé, eru, sauces allégées.', targetAudience: 'Tous', dietaryTags: ['traditionnel', 'sans-cube'], durationWeeks: 4, mealsCount: 28, priceFcfa: 39000, schedule: { frequence: 'quotidien' } },
  { name: 'Sans Gluten Confort', description: 'Menus 100% sans gluten, sûrs pour les personnes intolérantes ou cœliaques. Cuisine maison.', targetAudience: 'Intolérance au gluten', dietaryTags: ['sans-gluten', 'fait-maison'], durationWeeks: 4, mealsCount: 28, priceFcfa: 46000, schedule: { frequence: 'quotidien' } },
  { name: '100% Vegan', description: 'Une alimentation entièrement végétale, variée et gourmande, sans aucun produit animal.', targetAudience: 'Vegans', dietaryTags: ['vegan', 'bio'], durationWeeks: 4, mealsCount: 24, priceFcfa: 43000, schedule: { frequence: 'hebdomadaire', jours: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam'] } },
];

async function main() {
  const { rows: restos } = await pool.query(
    `SELECT id, name FROM restaurants ORDER BY name LIMIT 8`
  );
  if (restos.length === 0) { console.error('Aucun restaurant en base — abandon.'); await pool.end(); process.exit(1); }
  console.log(`${restos.length} restaurants cibles. ${APPLY ? 'MODE APPLY' : 'DRY-RUN (ajouter --apply pour insérer)'}\n`);

  let created = 0, updated = 0;
  for (let i = 0; i < TEMPLATES.length; i++) {
    const resto = restos[i % restos.length];
    const tpl = TEMPLATES[i];
    const params = [resto.id, tpl.name, tpl.description, tpl.targetAudience, tpl.dietaryTags, tpl.durationWeeks, tpl.mealsCount, JSON.stringify(tpl.schedule), tpl.priceFcfa];
    const exists = await pool.query('SELECT id FROM meal_programs WHERE restaurant_id = $1 AND name = $2 LIMIT 1', [resto.id, tpl.name]);
    if (exists.rowCount) {
      // Auto-correction : met à jour les tags (et le reste) si le programme existe déjà.
      if (APPLY) {
        await pool.query(
          `UPDATE meal_programs SET description=$3, target_audience=$4, dietary_tags=$5,
             duration_weeks=$6, meals_count=$7, schedule=$8::jsonb, price_fcfa=$9,
             status='published', updated_at=now()
           WHERE restaurant_id=$1 AND name=$2`,
          params
        );
      }
      updated++;
      console.log(`  ~ MAJ : ${tpl.name} @ ${resto.name} [${tpl.dietaryTags.join(', ')}]`);
      continue;
    }
    if (APPLY) {
      await pool.query(
        `INSERT INTO meal_programs
           (restaurant_id, name, description, target_audience, dietary_tags, duration_weeks, meals_count, schedule, price_fcfa, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,'published')`,
        params
      );
    }
    created++;
    console.log(`  ${APPLY ? '+' : '·'} ${tpl.name} → ${resto.name} [${tpl.dietaryTags.join(', ')}] (${tpl.priceFcfa.toLocaleString()} FCFA)`);
  }

  const { rows: [{ count }] } = await pool.query("SELECT count(*) FROM meal_programs WHERE status = 'published'");
  console.log(`\n${APPLY ? 'APPLIQUÉ' : 'DRY-RUN'} : ${created} créé(s), ${updated} mis à jour. Total publiés en base : ${count}.`);
  await pool.end();
}
main().catch((e) => { console.error('SEED ERROR:', e.message); process.exit(1); });
