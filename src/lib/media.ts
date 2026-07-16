// Pipeline images (LOT-14 / CONF-37).
//
// Client d'upload vers l'API média VPS (même contrat qu'AdminMedia.tsx :
// POST /api/media/upload?folder= → { success, media: { url: '/uploads/…' } })
// précédé d'une compression canvas côté navigateur (max 1280 px, JPEG q0.7)
// pour le contexte 3G camerounais.
//
// Sans VPS (mode mock, VITE_USE_VPS_API absent), on conserve le repli
// base64 historique — mais sur l'image compressée, ce qui allège d'autant
// le localStorage. La compression échouée renvoie le fichier d'origine.

import { isVpsApiEnabled } from './payments';

const API_BASE = '/api/media';
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.7;

/**
 * Redimensionne (max 1280 px de côté) et ré-encode en JPEG q0.7.
 * Renvoie le fichier d'origine si le format n'est pas une image matricielle
 * exploitable (SVG, fichier corrompu) ou si le canvas échoue.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    // Ne garder la version compressée que si elle est réellement plus légère.
    if (blob && blob.size < file.size) return blob;
    return file;
  } catch {
    return file;
  }
}

/** Upload vers l'API média VPS. Renvoie l'URL publique `/uploads/…`. */
export async function uploadMedia(blob: Blob, folder: string, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', blob, filename);
  const res = await fetch(`${API_BASE}/upload?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `Upload échoué (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!data?.media?.url) throw new Error("Réponse d'upload invalide");
  return data.media.url as string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Pipeline complet pour une image de formulaire (plat, profil resto) :
 * compression, puis URL `/uploads/…` en mode VPS ou data-URL en mode mock.
 */
export async function processFormImage(file: File, folder = 'menu'): Promise<string> {
  const compressed = await compressImage(file);
  if (isVpsApiEnabled) {
    const name = file.name.replace(/\.[^.]+$/, '') + (compressed !== file ? '.jpg' : '');
    return uploadMedia(compressed, folder, name || file.name);
  }
  return blobToDataUrl(compressed);
}
