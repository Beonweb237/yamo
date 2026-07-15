// ============================================================
// MiamExpress — Médiathèque API
// Gère l'upload, la liste et la suppression des médias
// Stockage : /home/ubuntu/miamexpress/uploads/
// ============================================================

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_ROOT = process.env.MEDIA_UPLOADS_ROOT || path.join(__dirname, '..', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

const FOLDERS = ['dishes', 'restaurants', 'categories', 'general', 'banners', 'branding'];

const app = express();
app.use(express.json());

// ── Ensure upload folders exist ──
FOLDERS.forEach(f => {
  const dir = path.join(UPLOADS_ROOT, f);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Metadata file ──
const META_FILE = path.join(UPLOADS_ROOT, 'media.json');

function readMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeMeta(meta) {
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}

// ── Multer config ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = (req.query.folder || 'general').replace(/[^a-z-]/g, '');
    const dir = path.join(UPLOADS_ROOT, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${name}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type non supporté. Types acceptés : ${ALLOWED_TYPES.join(', ')}`));
    }
  },
});

// ── CORS ──
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── POST /api/media/upload ──
app.post('/api/media/upload', (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni.' });
    }

    const folder = (req.query.folder || 'general').replace(/[^a-z-]/g, '');
    const relativePath = `${folder}/${req.file.filename}`;
    const absolutePath = path.join(UPLOADS_ROOT, relativePath);

    // Generate thumbnail for images (not SVG/GIF)
    let thumbnail = null;
    if (['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) {
      try {
        const thumbName = `thumb-${req.file.filename}`;
        const thumbPath = path.join(UPLOADS_ROOT, folder, thumbName);
        await sharp(absolutePath)
          .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);
        thumbnail = `${folder}/${thumbName}`;
      } catch { }
    }

    const sizes = {};
    try {
      const metadata = await sharp(absolutePath).metadata();
      sizes.width = metadata.width;
      sizes.height = metadata.height;
    } catch { }

    const mediaItem = {
      id: crypto.randomBytes(8).toString('hex'),
      filename: req.file.filename,
      originalName: req.file.originalname,
      folder,
      path: relativePath,
      thumbnail,
      mimetype: req.file.mimetype,
      size: req.file.size,
      width: sizes.width || null,
      height: sizes.height || null,
      uploadedAt: new Date().toISOString(),
      url: `/uploads/${relativePath}`,
      thumbUrl: thumbnail ? `/uploads/${thumbnail}` : null,
    };

    const meta = readMeta();
    meta.unshift(mediaItem);
    writeMeta(meta);

    res.json({ success: true, media: mediaItem });
  });
});

// ── GET /api/media ──
app.get('/api/media', (req, res) => {
  const { folder, search, page = '1', limit = '50' } = req.query;
  let meta = readMeta();

  if (folder && folder !== 'all') {
    meta = meta.filter(m => m.folder === folder);
  }
  if (search) {
    const q = search.toLowerCase();
    meta = meta.filter(m => m.originalName.toLowerCase().includes(q) || m.filename.toLowerCase().includes(q));
  }

  const total = meta.length;
  const start = (parseInt(page) - 1) * parseInt(limit);
  const items = meta.slice(start, start + parseInt(limit));

  res.json({
    items,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// ── GET /api/media/folders ──
app.get('/api/media/folders', (req, res) => {
  const meta = readMeta();
  const counts = {};
  FOLDERS.forEach(f => { counts[f] = 0; });
  meta.forEach(m => {
    if (counts[m.folder] !== undefined) counts[m.folder]++;
  });
  res.json({ folders: counts, total: meta.length });
});

// ── DELETE /api/media/:id ──
app.delete('/api/media/:id', (req, res) => {
  const meta = readMeta();
  const index = meta.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Média introuvable.' });
  }

  const item = meta[index];

  // Delete files
  const filePath = path.join(UPLOADS_ROOT, item.path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  if (item.thumbnail) {
    const thumbPath = path.join(UPLOADS_ROOT, item.thumbnail);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }

  meta.splice(index, 1);
  writeMeta(meta);

  res.json({ success: true });
});

// ── Serve uploaded files statically ──
app.use('/uploads', express.static(UPLOADS_ROOT, {
  maxAge: '30d',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=2592000');
  },
}));

// ── Start server ──
const PORT = process.env.MEDIA_PORT || 3003;

app.listen(PORT, () => {
  console.log(`📸 Médiathèque MiamExpress — http://localhost:${PORT}`);
  console.log(`   Stockage : ${UPLOADS_ROOT}`);
  console.log(`   Dossiers : ${FOLDERS.join(', ')}`);
});

export default app;
