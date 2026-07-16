import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number { const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLng = (lng2 - lng1) * Math.PI / 180; const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
export function estimateTime(km: number): number { return Math.max(1, Math.round(km * 3)); }

/** Génère un slug URL-friendly à partir d'un nom. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // enlever les accents
    .replace(/[''"]/g, '')            // enlever les apostrophes/guillemets
    .replace(/[^a-z0-9]+/g, '-')     // tout ce qui n'est pas alphanum → tiret
    .replace(/^-+|-+$/g, '')         // enlever les tirets au début/fin
    .replace(/-{2,}/g, '-')          // réduire les tirets multiples
    .slice(0, 60);                   // longueur max raisonnable
}
