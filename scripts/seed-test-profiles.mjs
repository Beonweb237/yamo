// Seeds complete test profiles and workflow data in Supabase.
// Requires .env.server with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Usage: node scripts/seed-test-profiles.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvServer() {
  const path = join(__dirname, '..', '.env.server');
  const raw = readFileSync(path, 'utf-8');
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

const env = loadEnvServer();
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_USERS = [
  { key: 'admin', phone: '+237690000001', role: 'admin', fullName: 'Admin Test Yamo', approved: true },
  { key: 'client', phone: '+237690000002', role: 'client', fullName: 'Client Test Yamo', approved: true },
  { key: 'restaurant', phone: '+237690000003', role: 'restaurant', fullName: 'Restaurateur Test Yamo', approved: true },
  { key: 'livreur', phone: '+237690000004', role: 'livreur', fullName: 'Livreur Test Yamo', approved: true },
  { key: 'restaurant_pending', phone: '+237690000005', role: 'restaurant', fullName: 'Candidat Restaurant Test', approved: false },
  { key: 'livreur_pending', phone: '+237690000006', role: 'livreur', fullName: 'Candidat Livreur Test', approved: false },
];

const IDS = {
  restaurant: '11111111-1111-4111-8111-111111111111',
  menus: [
    '11111111-1111-4111-8111-111111111101',
    '11111111-1111-4111-8111-111111111102',
    '11111111-1111-4111-8111-111111111103',
    '11111111-1111-4111-8111-111111111104',
  ],
  addresses: [
    '33333333-3333-4333-8333-333333333201',
    '33333333-3333-4333-8333-333333333202',
    '33333333-3333-4333-8333-333333333203',
    '33333333-3333-4333-8333-333333333204',
    '33333333-3333-4333-8333-333333333205',
    '33333333-3333-4333-8333-333333333206',
    '33333333-3333-4333-8333-333333333207',
  ],
  orders: [
    '22222222-2222-4222-8222-222222222201',
    '22222222-2222-4222-8222-222222222202',
    '22222222-2222-4222-8222-222222222203',
    '22222222-2222-4222-8222-222222222204',
    '22222222-2222-4222-8222-222222222205',
    '22222222-2222-4222-8222-222222222206',
    '22222222-2222-4222-8222-222222222207',
  ],
  deliveries: [
    '55555555-5555-4555-8555-555555555205',
    '55555555-5555-4555-8555-555555555206',
  ],
  payments: [
    '44444444-4444-4444-8444-444444444201',
    '44444444-4444-4444-8444-444444444202',
    '44444444-4444-4444-8444-444444444203',
    '44444444-4444-4444-8444-444444444204',
    '44444444-4444-4444-8444-444444444205',
    '44444444-4444-4444-8444-444444444206',
    '44444444-4444-4444-8444-444444444207',
  ],
  applications: {
    restaurant: '66666666-6666-4666-8666-666666666201',
    livreur: '66666666-6666-4666-8666-666666666202',
    restaurantPending: '66666666-6666-4666-8666-666666666203',
    livreurPending: '66666666-6666-4666-8666-666666666204',
  },
};

function isoHoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function isoMinutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function buildPreparationFields(status) {
  if (status === 'pending' || status === 'cancelled') {
    return {
      confirmed_at: null,
      preparation_eta_minutes: null,
      estimated_ready_at: null,
      ready_at: null,
    };
  }

  if (status === 'confirmed') {
    return {
      confirmed_at: isoMinutesAgo(5),
      preparation_eta_minutes: 25,
      estimated_ready_at: isoMinutesFromNow(20),
      ready_at: null,
    };
  }

  if (status === 'preparing') {
    return {
      confirmed_at: isoMinutesAgo(12),
      preparation_eta_minutes: 25,
      estimated_ready_at: isoMinutesFromNow(13),
      ready_at: null,
    };
  }

  const estimatedReadyAt = isoMinutesAgo(status === 'ready' ? 5 : 20);
  return {
    confirmed_at: isoMinutesAgo(status === 'ready' ? 30 : 50),
    preparation_eta_minutes: 25,
    estimated_ready_at: estimatedReadyAt,
    ready_at: estimatedReadyAt,
  };
}

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

function normalizePhone(phone) {
  return String(phone ?? '').replace(/\D/g, '');
}

const pendingPhones = new Set(
  TEST_USERS.filter((user) => !user.approved).map((user) => normalizePhone(user.phone))
);

async function listAllAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function ensureAuthUser(testUser, existingByPhone) {
  const existing = existingByPhone.get(normalizePhone(testUser.phone));
  if (existing) {
    await must(
      `update auth user ${testUser.phone}`,
      supabase.auth.admin.updateUserById(existing.id, {
        user_metadata: { full_name: testUser.fullName, role: testUser.role, test_profile: true },
      })
    );
    return existing.id;
  }

  const data = await must(
    `create auth user ${testUser.phone}`,
    supabase.auth.admin.createUser({
      phone: testUser.phone,
      phone_confirm: true,
      user_metadata: { full_name: testUser.fullName, role: testUser.role, test_profile: true },
    })
  );
  return data.user.id;
}

async function ensureProfiles() {
  const authUsers = await listAllAuthUsers();
  const existingByPhone = new Map(authUsers.filter((u) => u.phone).map((u) => [normalizePhone(u.phone), u]));
  const ids = {};

  for (const testUser of TEST_USERS) {
    const profilePhone = normalizePhone(testUser.phone);
    const { data: matchingProfiles, error: matchingError } = await supabase
      .from('profiles')
      .select('id, phone')
      .in('phone', [testUser.phone, profilePhone]);
    if (matchingError) throw matchingError;

    let id;
    const existingProfile = matchingProfiles?.[0];
    const authWithPhone = existingByPhone.get(profilePhone);

    if (existingProfile) {
      id = existingProfile.id;
      if (authWithPhone && authWithPhone.id !== id) {
        await must(`delete duplicate auth user ${authWithPhone.phone}`, supabase.auth.admin.deleteUser(authWithPhone.id));
        existingByPhone.delete(profilePhone);
      }
      await must(
        `attach phone to auth user ${testUser.phone}`,
        supabase.auth.admin.updateUserById(id, {
          phone: profilePhone,
          phone_confirm: true,
          user_metadata: { full_name: testUser.fullName, role: testUser.role, test_profile: true },
        })
      );
      existingByPhone.set(profilePhone, { id, phone: profilePhone });
    } else {
      id = await ensureAuthUser(testUser, existingByPhone);
    }

    ids[testUser.key] = id;
    await must(
      `upsert profile ${testUser.phone}`,
      supabase.from('profiles').upsert(
        {
          id,
          phone: profilePhone,
          full_name: testUser.fullName,
          role: testUser.role,
          is_approved: testUser.approved,
        },
        { onConflict: 'id' }
      )
    );
  }

  const { data: existingProfiles, error } = await supabase
    .from('profiles')
    .select('id, phone, role, is_approved')
    .in('role', ['restaurant', 'livreur']);
  if (error) throw error;

  const toApprove = existingProfiles.filter((profile) => !pendingPhones.has(normalizePhone(profile.phone)));
  for (const profile of toApprove) {
    if (!profile.is_approved) {
      await must(
        `approve existing ${profile.role} ${profile.phone}`,
        supabase.from('profiles').update({ is_approved: true }).eq('id', profile.id)
      );
    }
  }

  return ids;
}
async function ensureRestaurantAndMenu(profileIds) {
  await must(
    'upsert test restaurant',
    supabase.from('restaurants').upsert(
      {
        id: IDS.restaurant,
        owner_id: profileIds.restaurant,
        name: 'Yamo Test Kitchen',
        image: '/resto-ndole.jpg',
        category: 'Camerounaise',
        rating: 4.8,
        review_count: 128,
        delivery_time: '25-35 min',
        delivery_fee: 500,
        min_order: 2000,
        price_range: '€€',
        address: 'Akwa, Douala',
        phone: '+237 690 00 00 03',
        hours: '08:00 - 22:00',
        is_open: true,
        is_premium: true,
        tags: ['Test', 'Camerounaise', 'Livraison'],
        description: 'Restaurant de test complet pour valider le tableau de bord restaurateur, les menus et les commandes.',
      },
      { onConflict: 'id' }
    )
  );

  const menuRows = [
    { id: IDS.menus[0], restaurant_id: IDS.restaurant, name: 'Ndolé Test', description: 'Ndolé aux arachides avec viande et crevettes.', price: 3500, category: 'Plats Principaux', image: '/plat-ndole.jpg', is_popular: true, is_available: true },
    { id: IDS.menus[1], restaurant_id: IDS.restaurant, name: 'Poulet DG Test', description: 'Poulet DG avec plantains dorés.', price: 4000, category: 'Plats Principaux', image: '/plat-pouletdg.jpg', is_popular: true, is_available: true },
    { id: IDS.menus[2], restaurant_id: IDS.restaurant, name: 'Brochettes Test', description: 'Brochettes de bœuf grillées.', price: 2500, category: 'Grillades', image: '/plat-brochettes.jpg', is_popular: false, is_available: true },
    { id: IDS.menus[3], restaurant_id: IDS.restaurant, name: 'Jus de Gingembre Test', description: 'Jus frais maison.', price: 1200, category: 'Boissons', image: '/drink-gingembre.jpg', is_popular: false, is_available: true },
  ];
  await must('upsert test menu', supabase.from('menu_items').upsert(menuRows, { onConflict: 'id' }));
}

async function ensureOrders(profileIds) {
  const addresses = IDS.addresses.map((id, index) => ({
    id,
    user_id: profileIds.client,
    label: index === 0 ? 'Maison test' : `Adresse test ${index + 1}`,
    city: ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Buea', 'Kribi', 'Bamenda'][index],
    neighborhood: ['Akwa', 'Bastos', 'Tamdja', 'Plateau', 'Molyko', 'Ngoyé', 'Nkwen'][index],
    landmark: ['Immeuble blanc', 'Près pharmacie', 'Face marché', 'Station-service', 'Université', 'Front de mer', 'Carrefour principal'][index],
    full_text: `${['Akwa', 'Bastos', 'Tamdja', 'Plateau', 'Molyko', 'Ngoyé', 'Nkwen'][index]}, ${['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Buea', 'Kribi', 'Bamenda'][index]} — ${['Immeuble blanc', 'Près pharmacie', 'Face marché', 'Station-service', 'Université', 'Front de mer', 'Carrefour principal'][index]}`,
    lat: [4.0511, 3.8792, 5.4781, 9.3014, 4.1534, 2.9406, 5.9631][index],
    lng: [9.7679, 11.5247, 10.4176, 13.3977, 9.2423, 9.9108, 10.1591][index],
  }));
  await must('upsert addresses', supabase.from('addresses').upsert(addresses, { onConflict: 'id' }));

  const orderSpecs = [
    { status: 'pending', total: 5200, method: 'cash', payment: 'pending', hours: 2, note: 'Commande client en attente.' },
    { status: 'confirmed', total: 6500, method: 'mtn_momo', payment: 'paid', hours: 5, note: 'Commande confirmée par le restaurant.' },
    { status: 'preparing', total: 4700, method: 'orange_money', payment: 'paid', hours: 8, note: 'Commande en préparation cuisine.' },
    { status: 'ready', total: 7500, method: 'cash', payment: 'pending', hours: 12, note: 'Commande prête, disponible pour livreur.' },
    { status: 'delivering', total: 5900, method: 'cash', payment: 'pending', hours: 20, note: 'Commande assignée au livreur test.' },
    { status: 'delivered', total: 8100, method: 'mtn_momo', payment: 'paid', hours: 30, note: 'Commande livrée par le livreur test.' },
    { status: 'cancelled', total: 4000, method: 'cash', payment: 'refunded', hours: 40, note: 'Commande annulée pour test admin.' },
  ];

  const orders = orderSpecs.map((spec, index) => ({
    id: IDS.orders[index],
    customer_id: profileIds.client,
    restaurant_id: IDS.restaurant,
    address_id: IDS.addresses[index],
    status: spec.status,
    subtotal: spec.total - 500,
    delivery_fee: 500,
    total: spec.total,
    payment_method: spec.method,
    payment_status: spec.payment,
    notes: spec.note,
    ...buildPreparationFields(spec.status),
    created_at: isoHoursAgo(spec.hours),
    updated_at: isoHoursAgo(Math.max(spec.hours - 0.5, 0)),
  }));
  await must('upsert orders', supabase.from('orders').upsert(orders, { onConflict: 'id' }));

  const orderItems = orders.flatMap((order, index) => {
    const firstQty = index % 2 === 0 ? 1 : 2;
    const secondQty = index % 3 === 0 ? 2 : 1;
    return [
      {
        id: `77777777-7777-4777-8777-777777777${String(index + 1).padStart(3, '0')}`,
        order_id: order.id,
        menu_item_id: IDS.menus[index % IDS.menus.length],
        name: ['Ndolé Test', 'Poulet DG Test', 'Brochettes Test', 'Jus de Gingembre Test'][index % IDS.menus.length],
        price: [3500, 4000, 2500, 1200][index % IDS.menus.length],
        quantity: firstQty,
      },
      {
        id: `77777777-7777-4777-8777-777777778${String(index + 1).padStart(3, '0')}`,
        order_id: order.id,
        menu_item_id: IDS.menus[(index + 1) % IDS.menus.length],
        name: ['Ndolé Test', 'Poulet DG Test', 'Brochettes Test', 'Jus de Gingembre Test'][(index + 1) % IDS.menus.length],
        price: [3500, 4000, 2500, 1200][(index + 1) % IDS.menus.length],
        quantity: secondQty,
      },
    ];
  });
  await must('upsert order items', supabase.from('order_items').upsert(orderItems, { onConflict: 'id' }));

  const deliveries = [
    {
      id: IDS.deliveries[0],
      order_id: IDS.orders[4],
      driver_id: profileIds.livreur,
      status: 'assigned',
      lat: 4.0611,
      lng: 9.7779,
      assigned_at: isoHoursAgo(19.5),
      picked_up_at: null,
      delivered_at: null,
    },
    {
      id: IDS.deliveries[1],
      order_id: IDS.orders[5],
      driver_id: profileIds.livreur,
      status: 'delivered',
      lat: 3.8792,
      lng: 11.5247,
      assigned_at: isoHoursAgo(29.5),
      picked_up_at: isoHoursAgo(29),
      delivered_at: isoHoursAgo(28),
    },
  ];
  await must('upsert deliveries', supabase.from('deliveries').upsert(deliveries, { onConflict: 'id' }));

  const payments = orderSpecs.map((spec, index) => ({
    id: IDS.payments[index],
    order_id: IDS.orders[index],
    method: spec.method,
    amount: spec.total,
    provider_reference: `TEST-${String(index + 1).padStart(3, '0')}`,
    status: spec.payment,
    created_at: isoHoursAgo(spec.hours),
  }));
  await must('upsert payments', supabase.from('payments').upsert(payments, { onConflict: 'id' }));
}

async function ensureApplications(profileIds) {
  const applications = [
    {
      id: IDS.applications.restaurant,
      applicant_id: profileIds.restaurant,
      type: 'restaurant',
      status: 'approved',
      restaurant_name: 'Yamo Test Kitchen',
      city: 'Douala',
      address: 'Akwa',
      contact_phone: '+237 690 00 00 03',
      notes: 'Candidature restaurant test approuvée.',
      restaurant_id: IDS.restaurant,
      reviewed_by: profileIds.admin,
      reviewed_at: isoHoursAgo(48),
      created_at: isoHoursAgo(72),
    },
    {
      id: IDS.applications.livreur,
      applicant_id: profileIds.livreur,
      type: 'livreur',
      status: 'approved',
      restaurant_name: null,
      city: 'Douala',
      address: 'Akwa',
      contact_phone: '+237 690 00 00 04',
      notes: 'Candidature livreur test approuvée.',
      restaurant_id: null,
      reviewed_by: profileIds.admin,
      reviewed_at: isoHoursAgo(36),
      created_at: isoHoursAgo(60),
    },
    {
      id: IDS.applications.restaurantPending,
      applicant_id: profileIds.restaurant_pending,
      type: 'restaurant',
      status: 'pending',
      restaurant_name: 'Saveurs Test Pending',
      city: 'Bafoussam',
      address: 'Tamdja',
      contact_phone: '+237 690 00 00 05',
      notes: 'Candidature restaurant en attente pour tester la validation admin.',
      restaurant_id: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: isoHoursAgo(10),
    },
    {
      id: IDS.applications.livreurPending,
      applicant_id: profileIds.livreur_pending,
      type: 'livreur',
      status: 'pending',
      restaurant_name: null,
      city: 'Garoua',
      address: 'Plateau',
      contact_phone: '+237 690 00 00 06',
      notes: 'Candidature livreur en attente pour tester la validation admin.',
      restaurant_id: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: isoHoursAgo(6),
    },
  ];
  await must('upsert applications', supabase.from('applications').upsert(applications, { onConflict: 'id' }));
}

async function main() {
  console.log('Seeding complete test profiles...');
  const profileIds = await ensureProfiles();
  await ensureRestaurantAndMenu(profileIds);
  await ensureOrders(profileIds);
  await ensureApplications(profileIds);

  const { count: profilesCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { count: ordersCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  const { count: pendingAppsCount } = await supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log('Done. Test accounts:');
  for (const user of TEST_USERS) {
    console.log(`  ${user.role.padEnd(10)} ${user.phone} ${user.approved ? 'approved' : 'pending'}`);
  }
  console.log(`Profiles in DB: ${profilesCount ?? 'n/a'}`);
  console.log(`Orders in DB: ${ordersCount ?? 'n/a'}`);
  console.log(`Pending applications in DB: ${pendingAppsCount ?? 'n/a'}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});





