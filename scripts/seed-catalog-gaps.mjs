// Fills catalog gaps left by the original seed: src/data/mockData.ts grew (more
// restaurants, more menu items per restaurant) after `npm run seed` last ran, so
// most restaurants in Supabase currently have an empty menu and 3 restaurants
// (La Bella Pizza, Fresh Juice & Co, Le Matin Doux) don't exist at all.
//
// Idempotent: matches restaurants by name, only inserts restaurants that don't
// exist yet and only inserts menu items whose (restaurant, name) pair is missing, and refreshes existing item images when mockData changed.
//
// Usage: node scripts/seed-catalog-gaps.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { restaurants, menuItems } from '../src/data/mockData.ts';

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

function toRestaurantRow(r) {
  return {
    name: r.name,
    image: r.image,
    category: r.category,
    rating: r.rating,
    review_count: r.reviewCount,
    delivery_time: r.deliveryTime,
    delivery_fee: r.deliveryFee,
    min_order: r.minOrder,
    price_range: r.priceRange,
    address: r.address,
    phone: r.phone,
    hours: r.hours,
    is_open: r.isOpen,
    tags: r.tags,
    is_premium: r.isPremium,
    description: r.description,
  };
}

function toMenuItemRow(m, restaurantId) {
  return {
    restaurant_id: restaurantId,
    name: m.name,
    description: m.description,
    price: m.price,
    category: m.category,
    image: m.image,
    is_popular: m.isPopular,
  };
}

async function main() {
  console.log('--- Legacy category normalization ---');
  const { error: normalizeError } = await supabase
    .from('restaurants')
    .update({ category: 'Camerounaise' })
    .eq('category', 'Cuisine camerounaise');
  if (normalizeError) console.error('  ✗ category normalization failed:', normalizeError.message);
  else console.log('  ✓ Cuisine camerounaise -> Camerounaise');
  const { data: existingRestaurants, error: rErr } = await supabase.from('restaurants').select('id, name');
  if (rErr) throw rErr;
  const dbIdByName = Object.fromEntries(existingRestaurants.map((r) => [r.name, r.id]));

  console.log('--- Missing restaurants ---');
  const mockIdToDbId = {};
  for (const r of restaurants) {
    if (dbIdByName[r.name]) {
      mockIdToDbId[r.id] = dbIdByName[r.name];
      continue;
    }
    const { data, error } = await supabase.from('restaurants').insert(toRestaurantRow(r)).select('id').single();
    if (error) {
      console.error(`  ✗ ${r.name}:`, error.message);
      continue;
    }
    mockIdToDbId[r.id] = data.id;
    dbIdByName[r.name] = data.id;
    console.log(`  ✓ inserted ${r.name} -> ${data.id}`);
  }

  console.log('--- Missing menu items ---');
  const { data: existingItems, error: mErr } = await supabase.from('menu_items').select('id, restaurant_id, name, image');
  if (mErr) throw mErr;
  const existingKey = new Set(existingItems.map((m) => `${m.restaurant_id}::${m.name}`));

  const rowsToInsert = [];
  for (const m of menuItems) {
    const dbRestaurantId = mockIdToDbId[m.restaurantId];
    if (!dbRestaurantId) continue;
    const key = `${dbRestaurantId}::${m.name}`;
    if (existingKey.has(key)) continue;
    rowsToInsert.push(toMenuItemRow(m, dbRestaurantId));
    existingKey.add(key);
  }

  if (rowsToInsert.length > 0) {
    const { error } = await supabase.from('menu_items').insert(rowsToInsert);
    if (error) console.error('  ✗ menu items insert failed:', error.message);
    else console.log(`  ✓ ${rowsToInsert.length} menu items inserted`);
  } else {
    console.log('  (nothing to insert)');
  }

  console.log('--- Existing menu image refresh ---');
  const mockImageByKey = new Map();
  for (const m of menuItems) {
    const dbRestaurantId = mockIdToDbId[m.restaurantId];
    if (!dbRestaurantId) continue;
    mockImageByKey.set(`${dbRestaurantId}::${m.name}`, m.image);
  }

  let refreshed = 0;
  for (const item of existingItems) {
    const expectedImage = mockImageByKey.get(`${item.restaurant_id}::${item.name}`);
    if (!expectedImage || item.image === expectedImage) continue;
    const { error } = await supabase.from('menu_items').update({ image: expectedImage }).eq('id', item.id);
    if (error) console.error(`  ✗ ${item.name}:`, error.message);
    else refreshed += 1;
  }
  console.log(refreshed ? `  ✓ ${refreshed} image(s) refreshed` : '  (nothing to refresh)');

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
