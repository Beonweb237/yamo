// scan-media.js — Importe tous les médias existants dans la médiathèque
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = './dist';
const PUBLIC = './public';
const UPLOADS = './uploads';
const MEDIA_FILE = UPLOADS + '/media.json';

// Ensure upload dirs exist
['dishes', 'restaurants', 'categories', 'general', 'banners', 'branding'].forEach(d => {
  const dir = UPLOADS + '/' + d;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Find all image files
const images = [];
function scan(dir, prefix) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    const st = fs.statSync(fp);
    if (st.isDirectory() && f !== 'assets' && f !== 'node_modules') {
      scan(fp, prefix);
    } else if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f)) {
      images.push({ path: fp, rel: path.relative(prefix || dir, fp) });
    }
  });
}
scan(DIST, DIST);
if (fs.existsSync(PUBLIC)) scan(PUBLIC, DIST);

// Categorize by filename pattern
function categorize(name) {
  const n = name.toLowerCase();
  if (/^menu-|^plat-|^drink-|dish/i.test(n)) return 'dishes';
  if (/^resto-|restaurant/i.test(n)) return 'restaurants';
  if (/^cat-|category/i.test(n)) return 'categories';
  if (/^hero-|banner|app-preview/i.test(n)) return 'banners';
  if (/^logo|^pwa/i.test(n)) return 'branding';
  return 'general';
}

const meta = [];
images.forEach(({ path: img, rel }) => {
  const name = path.basename(img);
  const folder = categorize(name);
  const st = fs.statSync(img);

  // Create symlink in uploads folder
  const linkPath = UPLOADS + '/' + folder + '/' + name;
  if (!fs.existsSync(linkPath)) {
    try { fs.symlinkSync(path.resolve(img), linkPath); } catch { }
  }

  meta.push({
    id: crypto.randomBytes(8).toString('hex'),
    filename: name,
    originalName: name,
    folder,
    path: folder + '/' + name,
    thumbnail: null,
    mimetype: name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : name.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg',
    size: st.size,
    width: null,
    height: null,
    uploadedAt: new Date().toISOString(),
    url: '/' + rel.replace(/\\/g, '/'),
    thumbUrl: null,
  });
});

fs.writeFileSync(MEDIA_FILE, JSON.stringify(meta, null, 2));
console.log('✅ ' + meta.length + ' médias importés dans la médiathèque');
// Afficher les 5 premiers
meta.slice(0, 5).forEach(m => console.log('  📸 ' + m.folder + '/' + m.filename + ' (' + Math.round(m.size / 1024) + ' KB)'));
if (meta.length > 5) console.log('  ... et ' + (meta.length - 5) + ' autres');
