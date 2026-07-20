import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  host: '127.0.0.1', port: 5432, database: 'miamexpress',
  user: 'miamexpress', password: 'REMOVED_SECRET'
});

const stats = await pool.query(`
  SELECT
    (SELECT count(*) FROM users WHERE role = 'livreur') as livreurs,
    (SELECT count(*) FROM menu_items) as menus,
    (SELECT count(*) FROM reviews WHERE is_test = false) as avis_publics,
    (SELECT count(*) FROM orders WHERE status = 'delivered') as commandes,
    (SELECT count(*) FROM deliveries) as livraisons
`);
console.log('=== Statistiques globales ===');
console.log(stats.rows[0]);

const byResto = await pool.query(`
  SELECT r.name as restaurant,
    count(mi.id) as plats,
    count(rev.id) FILTER (WHERE rev.is_test = false) as avis,
    round(avg(rev.rating)::numeric,1) FILTER (WHERE rev.is_test = false) as note
  FROM restaurants r
  LEFT JOIN menu_items mi ON mi.restaurant_id = r.id
  LEFT JOIN reviews rev ON rev.restaurant_id = r.id AND rev.is_test = false
  GROUP BY r.id, r.name ORDER BY r.name
`);
console.log('\n=== Par restaurant ===');
for (const r of byResto.rows) {
  console.log(`  ${r.restaurant.padEnd(22)} | ${String(r.plats).padStart(2)} plats | ${String(r.avis).padStart(2)} avis | ${r.note || '-'}/5`);
}

const byType = await pool.query(`
  SELECT target_type, count(*) as total FROM reviews WHERE is_test = false GROUP BY target_type
`);
console.log('\n=== Par type d avis ===');
for (const r of byType.rows) {
  console.log(`  ${r.target_type.padEnd(12)}: ${r.total} avis`);
}

await pool.end();
