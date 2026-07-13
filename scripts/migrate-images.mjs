// Migrates all local images (public/*.jpg, public/*.png) to Supabase Storage
// and updates the restaurants + menu_items tables to point to storage URLs.
//
// Usage: node scripts/migrate-images.mjs

import { readFileSync, readdirSync } from 'node:fs';
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
const BUCKET = 'menu-images';
const PUBLIC_DIR = join(__dirname, '..', 'public');
const STORAGE_URL = `${env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

async function main() {
  // 1. Create or ensure bucket exists
  console.log('📦 Creating bucket...');
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw listErr;

  const existing = buckets.find((b) => b.name === BUCKET);
  if (!existing) {
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (createErr) throw createErr;
    console.log(`  ✓ Bucket "${BUCKET}" créé (public)`);
  } else {
    // Ensure public
    await supabase.storage.updateBucket(BUCKET, { public: true });
    console.log(`  ✓ Bucket "${BUCKET}" déjà existant`);
  }

  // 2. Upload all images from public/
  const files = readdirSync(PUBLIC_DIR).filter(
    (f) => /\.(jpg|jpeg|png|webp|svg)$/i.test(f) && !f.startsWith('pwa-') && !f.startsWith('favicon')
  );
  console.log(`\n📤 Upload de ${files.length} images...`);

  const uploaded = [];
  for (const file of files) {
    const buffer = readFileSync(join(PUBLIC_DIR, file));
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(file, buffer, { upsert: true, contentType: file.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg' });
    if (error) {
      console.log(`  ✗ ${file}: ${error.message}`);
    } else {
      uploaded.push(file);
      if (uploaded.length % 10 === 0) console.log(`  ... ${uploaded.length}/${files.length}`);
    }
  }
  console.log(`  ✓ ${uploaded.length} images uploadées`);

  // 3. Update restaurants table
  console.log('\n🔄 Mise à jour restaurants...');
  const { data: restaurants, error: restErr } = await supabase.from('restaurants').select('id, image');
  if (restErr) throw restErr;

  let updatedResto = 0;
  for (const r of restaurants) {
    const filename = r.image?.replace('/', '');
    if (!filename || !uploaded.includes(filename)) continue;
    const newUrl = `${STORAGE_URL}/${filename}`;
    const { error } = await supabase.from('restaurants').update({ image: newUrl }).eq('id', r.id);
    if (!error) updatedResto++;
  }
  console.log(`  ✓ ${updatedResto} restaurants mis à jour`);

  // 4. Update menu_items table
  console.log('\n🔄 Mise à jour menu_items...');
  const { data: items, error: itemErr } = await supabase.from('menu_items').select('id, image');
  if (itemErr) throw itemErr;

  let updatedItems = 0;
  for (const m of items) {
    if (!m.image) continue;
    // Skip base64 images (data:...)
    if (m.image.startsWith('data:')) continue;
    const filename = m.image.replace('/', '');
    if (!uploaded.includes(filename)) continue;
    const newUrl = `${STORAGE_URL}/${filename}`;
    const { error } = await supabase.from('menu_items').update({ image: newUrl }).eq('id', m.id);
    if (!error) updatedItems++;
  }
  console.log(`  ✓ ${updatedItems} menu_items mis à jour`);

  console.log(`\n✅ Migration terminée !`);
  console.log(`   Storage URL: ${STORAGE_URL}/`);
  console.log(`   Exemple: ${STORAGE_URL}/${uploaded[0]}`);
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
