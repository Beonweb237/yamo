// MiamExpress - Import complet des donnees mock vers VPS
// Execute sur le VPS: node scripts/seed-comprehensive-import.mjs
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'miamexpress',
  user: process.env.PGUSER || 'miamexpress',
  password: process.env.PGPASSWORD || 'REMOVED_SECRET',
});

async function query(sql, params = []) {
  return pool.query(sql, params);
}

async function main() {
  console.log('=== Import complet des donnees locales vers VPS ===\n');

  // 1. Creer des livreurs
  const drivers = [
    ['Boris Kamga', '+237677000001'],
    ['Chantal Ngo', '+237677000002'],
    ['David Essomba', '+237677000003'],
  ];

  for (const [name, phone] of drivers) {
    const { rows } = await query(
      `INSERT INTO users (role, full_name, phone, created_at)
       SELECT 'livreur', $1, $2, now() - interval '2 days'
       WHERE NOT EXISTS (SELECT 1 FROM users WHERE phone = $2)
       RETURNING id`,
      [name, phone]
    );
    if (rows.length) console.log(`  + Livreur: ${name}`);
    else console.log(`  ~ Livreur deja existant: ${name}`);
  }

  // 2. Ajouter des menus
  const menus = [
    {
      resto: 'Bafoussam Food', items: [
        ['Ndole Bafoussam', 'Ndole traditionnel prepare avec des feuilles de ndole', 3500, 'Plats Principaux', true],
        ['Fufu corn et sauce jaune', 'Fufu de mais accompagne de sauce jaune aux haricots', 2500, 'Plats Principaux', false],
        ['Brochettes de boeuf', 'Brochettes de boeuf grillees au feu de bois', 2000, 'Grillades', true],
        ['Miondo', 'Miondo servi avec sauce arachide', 1800, 'Accompagnements', false],
      ]
    },
    {
      resto: 'Limbe Surf & Turf', items: [
        ['Poisson braise Limbe', 'Poisson frais grille accompagne de plantains', 4500, 'Plats Principaux', true],
        ['Brochettes de crevettes', 'Crevettes grillees aux epices', 3500, 'Grillades', true],
        ['Riz au poisson', 'Riz blanc accompagne de poisson frais en sauce', 3000, 'Plats Principaux', false],
        ['Plantains frits', 'Plantains murs frits', 1500, 'Accompagnements', true],
      ]
    },
    {
      resto: 'Saveurs du Terroir', items: [
        ['Eru et fufu', 'Feuilles deru preparees avec du waterleaf et du fufu', 3500, 'Plats Principaux', true],
        ['Poulet a la moambe', 'Poulet mijote dans une sauce aux noix de palme', 4000, 'Plats Principaux', true],
        ['Miondo sauce gombo', 'Miondo traditionnel avec sauce gombo', 2000, 'Accompagnements', true],
        ['Taro pile', 'Taro pile accompagne de sauce jaune', 2500, 'Accompagnements', false],
      ]
    },
    {
      resto: 'Ocean Kribi', items: [
        ['Poisson braise Kribi', 'Poisson frais grille sauce jaune', 4000, 'Plats Principaux', true],
        ['Crevettes sautees', 'Crevettes sautees au beurre et a l ail', 3500, 'Grillades', true],
        ['Riz sauce tomate', 'Riz blanc avec sauce tomate maison', 2500, 'Accompagnements', true],
        ['Salade d avocat', 'Salade d avocat aux crevettes', 3000, 'Entrees', false],
      ]
    },
    {
      resto: 'Pizza Hot Douala', items: [
        ['Pizza Margherita', 'Tomate, mozzarella, basilic frais', 3500, 'Pizza', true],
        ['Pizza Camerounaise', 'Poulet, plantain, fromage', 4500, 'Pizza', true],
        ['Pizza 4 Fromages', 'Mozzarella, chevre, gorgonzola, parmesan', 5000, 'Pizza', false],
        ['Calzone', 'Chausson garni de viande et legumes', 4000, 'Pizza', true],
      ]
    },
    {
      resto: 'Le Jardin Secret', items: [
        ['Salade verte', 'Salade verte avec vinaigrette maison', 2500, 'Entrees', true],
        ['Bowl vegetarien', 'Bol de quinoa, legumes rotis, avocat', 4000, 'Plats Principaux', true],
        ['Soupe de legumes', 'Soupe de legumes frais de saison', 2000, 'Entrees', false],
        ['Smoothie bowl', 'Bol de smoothie aux fruits frais et granola', 3500, 'Petit-Dejeuner', true],
      ]
    },
    {
      resto: 'Delice Express', items: [
        ['Burger Deluxe', 'Burger avec steak, fromage, frites', 3000, 'Fast-Food', true],
        ['Tacos poulet', 'Tacos au poulet croustillant', 2500, 'Fast-Food', true],
        ['Frites maison', 'Frites de pommes de terre maison', 1500, 'Accompagnements', true],
        ['Sandwich club', 'Sandwich poulet, bacon, legumes', 2500, 'Fast-Food', false],
      ]
    },
    {
      resto: 'Yaounde Grill', items: [
        ['Brochettes de boeuf', 'Brochettes de boeuf grillees', 2500, 'Grillades', true],
        ['Poulet braise', 'Poulet braise sauce piquante', 3500, 'Grillades', true],
        ['Poisson grille', 'Poisson grille accompagne de plantains', 4000, 'Grillades', true],
        ['Plantains au four', 'Plantains cuits au four', 1500, 'Accompagnements', true],
      ]
    },
    {
      resto: 'Chez Jeanne', items: [
        ['Sauce gombo', 'Sauce gombo traditionnelle avec viande', 3000, 'Plats Principaux', true],
        ['Beignets de mais', 'Beignets de mais sucres', 1200, 'Petit-Dejeuner', true],
        ['Jus de bissap', 'Jus de bissap maison', 1500, 'Boissons', true],
      ]
    },
    {
      resto: 'Le Wouri', items: [
        ['Boeuf bourguignon', 'Boeuf mijote au vin rouge', 5000, 'Plats Principaux', true],
        ['Carpaccio de boeuf', 'Carpaccio de boeuf a l italienne', 4000, 'Entrees', false],
        ['Creme brulee', 'Creme brulee a la vanille', 2500, 'Desserts', true],
        ['Plateau de fromages', 'Selection de fromages affines', 4500, 'Entrees', true],
      ]
    },
  ];

  let menuCount = 0;
  for (const { resto, items } of menus) {
    const { rows: [restaurant] } = await query('SELECT id FROM restaurants WHERE name = $1', [resto]);
    if (!restaurant) { console.log(`  ! Resto introuvable: ${resto}`); continue; }

    for (const [name, desc, price, cat, popular] of items) {
      await query(
        `INSERT INTO menu_items (restaurant_id, name, description, price, category, is_popular, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT DO NOTHING`,
        [restaurant.id, name, desc, price, cat, popular]
      );
      menuCount++;
    }
  }
  console.log(`  + ${menuCount} menus ajoutes`);

  // 3. Creer des commandes livrees pour tous les restaurants
  const { rows: clients } = await query("SELECT id FROM users WHERE role = 'client' LIMIT 10");
  const { rows: drivers2 } = await query("SELECT id FROM users WHERE role = 'livreur'");
  const { rows: restaurants } = await query('SELECT id, name FROM restaurants ORDER BY name');

  let orderCount = 0;
  for (const resto of restaurants) {
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

      // Ajouter des items aleatoires du menu
      const { rows: menuItems } = await query(
        'SELECT id, name, price FROM menu_items WHERE restaurant_id = $1 ORDER BY random() LIMIT $2',
        [resto.id, 1 + Math.floor(Math.random() * 2)]
      );

      for (const item of menuItems) {
        await query(
          'INSERT INTO order_items (order_id, menu_item_id, name, price, quantity) VALUES ($1, $2, $3, $4, 1)',
          [order.id, item.id, item.name, item.price]
        );
      }

      // Assigner un livreur
      if (drivers2.length > 0) {
        const driver = drivers2[Math.floor(Math.random() * drivers2.length)];
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

      orderCount++;
    }
  }
  console.log(`  + ${orderCount} commandes livrees avec livraisons`);

  // 4. Nettoyer anciennes commandes sans livraison
  const { rowCount: deleted } = await query(
    `DELETE FROM orders WHERE id IN (
      SELECT o.id FROM orders o 
      LEFT JOIN deliveries d ON d.order_id = o.id 
      WHERE d.id IS NULL AND o.status = 'delivered'
    )`
  );
  if (deleted) console.log(`  - ${deleted} anciennes commandes sans livraison supprimees`);

  // 5. Resultats
  const { rows: stats } = await query(`
    SELECT 
      (SELECT count(*) FROM users WHERE role = 'livreur') as livreurs,
      (SELECT count(*) FROM menu_items) as menus,
      (SELECT count(*) FROM orders WHERE status = 'delivered') as commandes,
      (SELECT count(*) FROM deliveries) as livraisons
  `);
  console.log('\n=== Resultats ===');
  console.log(`  Livreurs:     ${stats[0].livreurs}`);
  console.log(`  Menus/plats:  ${stats[0].menus}`);
  console.log(`  Commandes:    ${stats[0].commandes}`);
  console.log(`  Livraisons:   ${stats[0].livraisons}`);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
