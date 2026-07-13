// Generates simple PWA placeholder icons (192x192, 512x512) as green rounded squares.
// Install sharp first: npm install sharp --save-dev
// Then run: node scripts/generate-pwa-icons.mjs

import { createCanvas } from 'canvas';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(__dirname, '..', 'public');

function generateIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Rounded green background
  const r = size * 0.22;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.arcTo(size, 0, size, r, r);
  ctx.lineTo(size, size - r);
  ctx.arcTo(size, size, size - r, size, r);
  ctx.lineTo(r, size);
  ctx.arcTo(0, size, 0, size - r, r);
  ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();
  ctx.fillStyle = '#2D6A4F';
  ctx.fill();

  // White "Y" letter
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size * 0.45}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Y', size / 2, size / 2);

  writeFileSync(join(publicDir, filename), canvas.toBuffer('image/png'));
  console.log(`  ✓ ${filename}`);
}

generateIcon(192, 'pwa-192.png');
generateIcon(512, 'pwa-512.png');
console.log('Done.');
