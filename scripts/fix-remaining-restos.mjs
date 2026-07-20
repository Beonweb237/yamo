// Fix remaining restaurants with accents + seed their menus, orders & reviews
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'miamexpress',
  user: process.env.PGUSER || 'miamexpress',
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
});

async function query(sql, params = []) {
  return pool.query(sql, params);
}

async function main() {
  // Get all restaurant names to see exact matches
  const { rows: allRestos } = await query('SELECT id, name FROM restaurants ORDER BY name');
  console.log('=== Tous les restaurants dans la DB ===');
  allRestos.forEach(r => console.log(`  ${r.id.slice(0, 8)}... | ${r.name}`));

  // Find the missing ones by partial name match
  const targets = ['Limb', 'D lic', 'Yaound', 'Grill', 'lic'];
  const missing = allRestos.filter(r =>
    targets.some(t => r.name.includes(t))
  );

  console.log('\n=== Restaurants accentues trouves ===');
  missing.forEach(r => {
    const hasMenus = false; // We'll check
    console.log(`  ${r.name} (${r.id})`);
  });

  // For each missing resto, add menus
  const menuData = {
    'Limbe Surf & Turf': [
      ['Poisson braise', 'Poisson frais grille sauce jaune', 4500, 'Plats Principaux', true],
      ['Crevettes grillees', 'Crevettes grillees aux epices', 3500, 'Grillades', true],
      ['Riz au poisson', 'Riz blanc avec poisson sauce tomate', 3000, 'Plats Principaux', false],
      ['Plantains frits', 'Plantains murs frits', 1500, 'Accompagnements', true],
      ['Salade fruits de mer', 'Salade aux crevettes et calamars', 4000, 'Entrees', true],
    ],
    'Delice Express': [
      ['Burger Deluxe', 'Burger steak fromage frites', 3000, 'Fast-Food', true],
      ['Tacos poulet', 'Tacos au poulet croustillant', 2500, 'Fast-Food', true],
      ['Frites maison', 'Frites de pommes de terre maison', 1500, 'Accompagnements', true],
      ['Sandwich club', 'Sandwich poulet bacon legumes', 2500, 'Fast-Food', false],
      ['Milk-shake', 'Milk-shake aux fruits', 2000, 'Boissons', true],
    ],
    'Yaounde Grill': [
      ['Brochettes de boeuf', 'Brochettes de boeuf grillees', 2500, 'Grillades', true],
      ['Poulet braise', 'Poulet braise sauce piquante', 3500, 'Grillades', true],
      ['Poisson grille', 'Poisson grille plantains', 4000, 'Grillades', true],
      ['Plantains au four', 'Plantains cuits au four', 1500, 'Accompagnements', true],
      ['Haricots verts', 'Haricots verts sautes ail', 1500, 'Accompagnements', false],
    ],
  };

  // Try different name variations
  const nameVariations = {
    'Limbe Surf & Turf': ['Limbe Surf & Turf', 'Limbé Surf & Turf'],
    'Delice Express': ['Delice Express', 'Délice Express', 'D├®lice Express'],
    'Yaounde Grill': ['Yaounde Grill', 'Yaoundé Grill', 'Yaound├® Grill'],
  };

  let menusAdded = 0;
  for (const [key, variations] of Object.entries(nameVariations)) {
    let resto = null;
    for (const name of variations) {
      const { rows } = await query('SELECT id, name FROM restaurants WHERE name = $1', [name]);
      if (rows.length > 0) { resto = rows[0]; break; }
    }

    if (!resto) {
      console.log(`\n  ! Resto introuvable: ${key} (essaye les variantes: ${variations.join(', ')})`);
      continue;
    }

    console.log(`\n  ✓ Trouve: ${resto.name}`);

    // Add menus
    const items = menuData[key] || [];
    for (const [name, desc, price, cat, popular] of items) {
      await query(
        `INSERT INTO menu_items (restaurant_id, name, description, price, category, is_popular, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT DO NOTHING`,
        [resto.id, name, desc, price, cat, popular]
      );
      menusAdded++;
    }
    console.log(`     + ${items.length} menus ajoutes`);

    // Create orders with deliveries
    const { rows: clients } = await query("SELECT id FROM users WHERE role = 'client' LIMIT 5");
    const { rows: drivers } = await query("SELECT id FROM users WHERE role = 'livreur'");

    let ordCount = 0;
    for (let idx = 1; idx <= 3; idx++) {
      const client = clients[Math.floor(Math.random() * clients.length)];

      const { rows: [order] } = await query(
        `INSERT INTO orders (customer_id, restaurant_id, status, subtotal, total, delivery_fee, created_at, updated_at)
         VALUES ($1, $2, 'delivered', $3, $4, 500,
           now() - (($5 || ' hours')::interval), now() - (($6 || ' hours')::interval))
         RETURNING id`,
        [client.id, resto.id, 3000 + (idx * 2000), 3500 + (idx * 2000),
        idx * 48 + Math.floor(Math.random() * 24), idx * 24 + Math.floor(Math.random() * 12)]
      );

      const { rows: menuItems } = await query(
        'SELECT id, name, price FROM menu_items WHERE restaurant_id = $1 ORDER BY random() LIMIT 2',
        [resto.id]
      );
      for (const item of menuItems) {
        await query(
          'INSERT INTO order_items (order_id, menu_item_id, name, price, quantity) VALUES ($1, $2, $3, $4, 1)',
          [order.id, item.id, item.name, item.price]
        );
      }

      if (drivers.length > 0) {
        const driver = drivers[Math.floor(Math.random() * drivers.length)];
        await query(
          `INSERT INTO deliveries (order_id, driver_id, status, assigned_at, picked_up_at, delivered_at)
           VALUES ($1, $2, 'delivered',
             now() - (($3 || ' hours')::interval),
             now() - (($4 || ' hours')::interval),
             now() - (($5 || ' hours')::interval))`,
          [order.id, driver.id,
          idx * 36 + Math.floor(Math.random() * 12),
          idx * 30 + Math.floor(Math.random() * 6),
          idx * 24 + Math.floor(Math.random() * 6)]
        );
      }
      ordCount++;
    }
    console.log(`     + ${ordCount} commandes avec livraisons`);
  }

  console.log(`\n=== Total: ${menusAdded} menus ajoutes ===`);

  // Now run review seed
  console.log('\n=== Seed des avis... ===');
  await pool.end();

  // Use child process to run seed-review-examples
  const { execSync } = await import('child_process');
  const result = execSync('cd /home/ubuntu/miamexpress && node scripts/seed-review-examples.mjs 2>&1 || true', {
    env: { ...process.env, DB_PASSWORD: process.env.DB_PASSWORD || process.env.PGPASSWORD }
  });
  console.log(result.toString());
}

main().catch(err => { console.error(err); process.exit(1); });
