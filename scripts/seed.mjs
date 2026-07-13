// Seeds the Supabase `restaurants` and `menu_items` tables from src/data/mockData.ts.
// Requires .env.server (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) — the service role
// key bypasses RLS, which is why this only ever runs server-side, never in the browser.
//
// Usage: node scripts/seed.mjs

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
    id: r.id.length === 36 ? r.id : undefined, // let Postgres generate a uuid for the short mock ids
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
  console.log(`Seeding ${restaurants.length} restaurants...`);
  const idMap = {}; // mock id -> real Supabase uuid

  for (const r of restaurants) {
    const { data, error } = await supabase
      .from('restaurants')
      .insert(toRestaurantRow(r))
      .select('id')
      .single();
    if (error) {
      console.error(`Failed to insert restaurant "${r.name}":`, error.message);
      continue;
    }
    idMap[r.id] = data.id;
    console.log(`  ✓ ${r.name} -> ${data.id}`);
  }

  const menuRows = menuItems
    .filter((m) => idMap[m.restaurantId])
    .map((m) => toMenuItemRow(m, idMap[m.restaurantId]));

  console.log(`Seeding ${menuRows.length} menu items...`);
  const { error: menuError } = await supabase.from('menu_items').insert(menuRows);
  if (menuError) {
    console.error('Failed to insert menu items:', menuError.message);
  } else {
    console.log(`  ✓ ${menuRows.length} menu items inserted`);
  }

  console.log('Done.');
}

main();
