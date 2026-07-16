// Canaux de support MiamExpress (business plan §13 : WhatsApp Business en priorité)

/** Numéro WhatsApp Business au format international sans '+' ni espaces */
export const WHATSAPP_NUMBER = '237677777777';

/** Numéro d'appel du support (format tel:) */
export const SUPPORT_PHONE = '+237677777777';

export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
