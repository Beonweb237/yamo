// Canaux de support MiamExpress (business plan §13 : WhatsApp Business en priorité).
// Les valeurs par défaut ci-dessous peuvent être remplacées par l'admin via
// /admin/apparence (SiteConfig.support) — toujours passer par les getters.

import { readSiteConfigSync } from '../lib/siteConfig';

/** Numéro WhatsApp Business au format international sans '+' ni espaces (défaut) */
export const WHATSAPP_NUMBER = '237677777777';

/** Numéro d'appel du support (format tel:) (défaut) */
export const SUPPORT_PHONE = '677777777';

/** Numéro WhatsApp effectif (override admin sinon défaut). */
export function getSupportWhatsapp(): string {
  return readSiteConfigSync().support?.whatsapp || WHATSAPP_NUMBER;
}

/** Numéro d'appel effectif (override admin sinon défaut). */
export function getSupportPhone(): string {
  return readSiteConfigSync().support?.phone || SUPPORT_PHONE;
}

/** Horaires du support si configurés par l'admin (sinon undefined). */
export function getSupportHours(): string | undefined {
  return readSiteConfigSync().support?.hours;
}

export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${getSupportWhatsapp()}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
