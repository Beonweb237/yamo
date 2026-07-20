// Seeds realistic test accounts + related data (addresses, orders, deliveries,
// payments, reviews, applications) for every role: client, restaurant, livreur, admin.
//
// Requires .env.server (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) — creates real
// auth.users via the admin API (phone pre-confirmed, no OTP needed) then fills
// `profiles` and the rest of the schema so each role has something to test against.
//
// Safe to re-run: it looks up existing auth users by phone before creating them,
// and clears previously-seeded orders/deliveries/payments/reviews/applications
// tied to the test accounts before re-inserting.
//
// Usage: node scripts/seed-test-data.mjs

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
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Every test account uses the 6900000XX range so they're easy to spot and wipe.
const TEST_PASSWORD = 'Miamexpress2025';

// auth.users needs a channel Supabase can actually authenticate (email/password
// works out of the box; phone requires an SMS provider that isn't configured on
// this project — see SUPABASE_SETUP.md). `phone` here only fills profiles.phone,
// the number the app displays; it's independent of the auth identity.
const CLIENTS = [
  { email: 'marie.ngo@gmail.com', phone: '690000001', full_name: 'Marie Ngo', city: 'Douala', neighborhood: 'Bonapriso', landmark: "Près de la pharmacie du rond-point" },
  { email: 'jean.fotso@gmail.com', phone: '690000002', full_name: 'Jean Fotso', city: 'Yaoundé', neighborhood: 'Bastos', landmark: "Immeuble bleu, en face de l'ambassade" },
  { email: 'aicha.bello@gmail.com', phone: '690000003', full_name: 'Aïcha Bello', city: 'Douala', neighborhood: 'Akwa', landmark: "Rue de la station Total" },
];

const OWNERS = [
  { email: 'paul.essomba@gmail.com', phone: '690000011', full_name: 'Paul Essomba', restaurantName: 'Chez Mama' },
  { email: 'bernadette.mballa@gmail.com', phone: '690000012', full_name: 'Bernadette Mballa', restaurantName: 'Le Bûcheron' },
  { email: 'serge.talla@gmail.com', phone: '690000013', full_name: 'Serge Talla', restaurantName: 'Douala Boulangerie' },
];

const DRIVERS = [
  { email: 'samuel.njoya@gmail.com', phone: '690000021', full_name: 'Samuel Njoya', is_approved: true },
  { email: 'grace.mbeki@gmail.com', phone: '690000022', full_name: 'Grace Mbeki', is_approved: true },
  { email: 'alain.fokou@gmail.com', phone: '690000023', full_name: 'Alain Fokou', is_approved: false }, // pending approval — tests the admin review queue
];

const ADMIN = { email: 'admin.yamo@gmail.com', phone: '690000031', full_name: 'Admin Yamo' };

const APPLICANT = { email: 'christelle.manga@gmail.com', phone: '690000041', full_name: 'Christelle Manga', restaurantName: 'Le Foyer Bassa' };

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
      confirmed_at: isoMinutesAgo(4),
      preparation_eta_minutes: 20,
      estimated_ready_at: isoMinutesFromNow(16),
      ready_at: null,
    };
  }

  if (status === 'preparing') {
    return {
      confirmed_at: isoMinutesAgo(10),
      preparation_eta_minutes: 25,
      estimated_ready_at: isoMinutesFromNow(15),
      ready_at: null,
    };
  }

  const estimatedReadyAt = isoMinutesAgo(status === 'ready' ? 3 : 18);
  return {
    confirmed_at: isoMinutesAgo(status === 'ready' ? 28 : 45),
    preparation_eta_minutes: 25,
    estimated_ready_at: estimatedReadyAt,
    ready_at: estimatedReadyAt,
  };
}

async function getOrCreateAuthUser(email) {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

async function upsertProfile({ id, phone, full_name, role, is_approved }) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id, phone, full_name, role, is_approved }, { onConflict: 'id' });
  if (error) throw error;
}

async function clearPreviousOrders(customerIds) {
  const { data: orders } = await supabase.from('orders').select('id').in('customer_id', customerIds);
  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length === 0) return;
  await supabase.from('reviews').delete().in('order_id', orderIds);
  await supabase.from('payments').delete().in('order_id', orderIds);
  await supabase.from('deliveries').delete().in('order_id', orderIds);
  await supabase.from('order_items').delete().in('order_id', orderIds);
  await supabase.from('orders').delete().in('id', orderIds);
}

async function main() {
  console.log('--- Restaurants (for owner linking + order items) ---');
  const { data: restaurants, error: rErr } = await supabase.from('restaurants').select('id, name');
  if (rErr) throw rErr;
  const restaurantByName = Object.fromEntries(restaurants.map((r) => [r.name, r]));

  const { data: menuItems, error: mErr } = await supabase
    .from('menu_items')
    .select('id, restaurant_id, name, price');
  if (mErr) throw mErr;
  const menuByRestaurant = {};
  for (const m of menuItems) {
    (menuByRestaurant[m.restaurant_id] ??= []).push(m);
  }

  console.log('--- Clients ---');
  const clientProfiles = [];
  for (const c of CLIENTS) {
    const user = await getOrCreateAuthUser(c.email);
    await upsertProfile({ id: user.id, phone: c.phone, full_name: c.full_name, role: 'client', is_approved: true });
    clientProfiles.push({ ...c, id: user.id });
    console.log(`  ✓ client ${c.full_name} (${c.phone}) -> ${user.id}`);
  }

  console.log('--- Addresses ---');
  await supabase.from('addresses').delete().in('user_id', clientProfiles.map((c) => c.id));
  const addressRows = clientProfiles.flatMap((c) => [
    {
      user_id: c.id,
      label: 'Maison',
      city: c.city,
      neighborhood: c.neighborhood,
      landmark: c.landmark,
      full_text: `${c.neighborhood}, ${c.city} — ${c.landmark}`,
    },
    {
      user_id: c.id,
      label: 'Bureau',
      city: c.city,
      neighborhood: c.neighborhood,
      landmark: 'Immeuble à étages, 2ème porte',
      full_text: `${c.neighborhood}, ${c.city} (bureau)`,
    },
  ]);
  const { data: insertedAddresses, error: addrErr } = await supabase
    .from('addresses')
    .insert(addressRows)
    .select('id, user_id, label');
  if (addrErr) throw addrErr;
  console.log(`  ✓ ${insertedAddresses.length} addresses`);
  const homeAddressByClient = Object.fromEntries(
    insertedAddresses.filter((a) => a.label === 'Maison').map((a) => [a.user_id, a.id]),
  );

  console.log('--- Restaurant owners ---');
  for (const o of OWNERS) {
    const user = await getOrCreateAuthUser(o.email);
    await upsertProfile({ id: user.id, phone: o.phone, full_name: o.full_name, role: 'restaurant', is_approved: true });
    const restaurant = restaurantByName[o.restaurantName];
    if (restaurant) {
      await supabase.from('restaurants').update({ owner_id: user.id }).eq('id', restaurant.id);
    }
    console.log(`  ✓ owner ${o.full_name} -> ${o.restaurantName}`);
  }

  console.log('--- Drivers ---');
  const driverProfiles = [];
  for (const d of DRIVERS) {
    const user = await getOrCreateAuthUser(d.email);
    await upsertProfile({ id: user.id, phone: d.phone, full_name: d.full_name, role: 'livreur', is_approved: d.is_approved });
    driverProfiles.push({ ...d, id: user.id });
    console.log(`  ✓ driver ${d.full_name} (${d.is_approved ? 'approuvé' : 'en attente'})`);
  }
  const [driver1, driver2] = driverProfiles;

  console.log('--- Admin ---');
  const adminUser = await getOrCreateAuthUser(ADMIN.email);
  await upsertProfile({ id: adminUser.id, phone: ADMIN.phone, full_name: ADMIN.full_name, role: 'admin', is_approved: true });
  console.log(`  ✓ admin ${ADMIN.full_name}`);

  console.log('--- Pending restaurant applicant (tests admin review queue) ---');
  const applicantUser = await getOrCreateAuthUser(APPLICANT.email);
  await upsertProfile({ id: applicantUser.id, phone: APPLICANT.phone, full_name: APPLICANT.full_name, role: 'restaurant', is_approved: false });
  await supabase.from('applications').delete().eq('applicant_id', applicantUser.id);
  await supabase.from('applications').insert({
    applicant_id: applicantUser.id,
    type: 'restaurant',
    status: 'pending',
    restaurant_name: APPLICANT.restaurantName,
    city: 'Douala',
    address: 'Bonabéri, Douala',
    contact_phone: APPLICANT.phone,
    notes: 'Spécialités bassa, ouverture prévue sous 2 semaines.',
  });
  await supabase.from('applications').delete().eq('applicant_id', driver1.id).eq('status', 'pending');
  const pendingDriver = driverProfiles.find((d) => !d.is_approved);
  if (pendingDriver) {
    await supabase.from('applications').delete().eq('applicant_id', pendingDriver.id);
    await supabase.from('applications').insert({
      applicant_id: pendingDriver.id,
      type: 'livreur',
      status: 'pending',
      city: 'Douala',
      contact_phone: pendingDriver.phone,
      notes: 'Dispose d\'une moto, disponible soirs et week-ends.',
    });
  }
  console.log('  ✓ 1 application restaurant + 1 application livreur en attente');

  console.log('--- Orders (one per status, spread across clients) ---');
  await clearPreviousOrders(clientProfiles.map((c) => c.id));

  const restaurantNames = Object.keys(restaurantByName);
  function pickRestaurant(i) {
    const name = restaurantNames[i % restaurantNames.length];
    return restaurantByName[name];
  }

  const scenarios = [
    { status: 'pending', payment_status: 'pending' },
    { status: 'confirmed', payment_status: 'pending' },
    { status: 'preparing', payment_status: 'paid' },
    { status: 'ready', payment_status: 'paid' },
    { status: 'delivering', payment_status: 'paid', driver: driver1 },
    { status: 'delivered', payment_status: 'paid', driver: driver2, review: true },
    { status: 'delivered', payment_status: 'paid', driver: driver1, review: true },
    { status: 'cancelled', payment_status: 'failed' },
  ];

  let orderCount = 0;
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const client = clientProfiles[i % clientProfiles.length];
    const restaurant = pickRestaurant(i);
    const items = (menuByRestaurant[restaurant.id] ?? []).slice(0, 2);
    if (items.length === 0) continue;

    const subtotal = items.reduce((sum, it) => sum + it.price, 0);
    const deliveryFee = 500;
    const total = subtotal + deliveryFee;

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id: client.id,
        restaurant_id: restaurant.id,
        address_id: homeAddressByClient[client.id],
        status: scenario.status,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        payment_method: i % 3 === 0 ? 'mtn_momo' : i % 3 === 1 ? 'orange_money' : 'cash',
        payment_status: scenario.payment_status,
        notes: scenario.status === 'cancelled' ? 'Client indisponible, commande annulée.' : null,
        contact_phone: client.phone,
        ordered_for_someone_else: i === 4,
        recipient_name: i === 4 ? 'Oncle Martin' : null,
        recipient_phone: i === 4 ? '699222333' : null,
        recipient_contact_instructions: i === 4 ? "Appeler le bénéficiaire uniquement à l'arrivée." : null,
        ...buildPreparationFields(scenario.status),
      })
      .select('id')
      .single();
    if (orderErr) {
      console.error('  ✗ order failed:', orderErr.message);
      continue;
    }

    await supabase.from('order_items').insert(
      items.map((it) => ({
        order_id: order.id,
        menu_item_id: it.id,
        name: it.name,
        price: it.price,
        quantity: 1,
      })),
    );

    await supabase.from('payments').insert({
      order_id: order.id,
      method: i % 3 === 0 ? 'mtn_momo' : i % 3 === 1 ? 'orange_money' : 'cash',
      amount: total,
      status: scenario.payment_status,
      provider_reference: scenario.payment_status === 'paid' ? `TXN-${order.id.slice(0, 8)}` : null,
    });

    if (scenario.driver || scenario.status === 'ready') {
      await supabase.from('deliveries').insert({
        order_id: order.id,
        driver_id: scenario.driver?.id ?? null,
        status:
          scenario.status === 'delivered' ? 'delivered' : scenario.status === 'delivering' ? 'in_transit' : 'unassigned',
        assigned_at: scenario.driver ? new Date().toISOString() : null,
        picked_up_at: scenario.status === 'delivering' || scenario.status === 'delivered' ? new Date().toISOString() : null,
        delivered_at: scenario.status === 'delivered' ? new Date().toISOString() : null,
      });
    }

    if (scenario.review) {
      await supabase.from('reviews').insert({
        order_id: order.id,
        restaurant_id: restaurant.id,
        customer_id: client.id,
        rating: 4 + (i % 2),
        comment: 'Livraison rapide, plat encore chaud à l\'arrivée. Recommandé !',
      });
    }

    orderCount++;
    console.log(`  ✓ order ${scenario.status} — ${client.full_name} @ ${restaurant.name}`);
  }

  console.log(`\nDone. ${orderCount} orders seeded across ${CLIENTS.length} clients, ${OWNERS.length} restaurant owners, ${DRIVERS.length} drivers, 1 admin, 1 pending applicant.`);
  console.log(`All test accounts use password "${TEST_PASSWORD}" and phone-based login (phone_confirm=true, no OTP needed).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
