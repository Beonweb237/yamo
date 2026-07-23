// ═══════════════════════════════════════════════════════════════
// Couche native Capacitor (CP8) — périmètre app mobile CLIENT.
// ═══════════════════════════════════════════════════════════════
// Tout est gardé par Capacitor.isNativePlatform() : sur le web, ce module
// est un no-op strict (aucune régression possible du site).

import { Capacitor } from '@capacitor/core';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/**
 * Initialisation native (appelée une fois au boot, après le montage du router) :
 * - bouton retour Android : back navigateur, sortie d'app à la racine ;
 * - deep links https://miamexpress.cm/... → navigation interne (/fr /en).
 */
export async function initNative(): Promise<void> {
  if (!isNative()) return;
  const { App } = await import('@capacitor/app');

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack || window.history.length > 1) window.history.back();
    else void App.exitApp();
  });

  App.addListener('appUrlOpen', ({ url }) => {
    try {
      const u = new URL(url);
      if (u.hostname.endsWith('miamexpress.cm')) {
        // Recharge sur le chemin ciblé — le préfixe /fr /en est géré par main.tsx.
        window.location.href = u.pathname + u.search;
      }
    } catch { /* URL non reconnue : ignorée */ }
  });
}

/**
 * Notifications push (FCM) — STUB. L'implémentation réelle (enregistrement du
 * token + @capacitor/push-notifications) viendra avec le backend de push.
 * Sur le web : no-op.
 */
export async function registerPushNotifications(): Promise<null> {
  return null; // stub honnête — aucun faux enregistrement
}

/**
 * Géolocalisation native — STUB (le web utilise déjà navigator.geolocation
 * là où c'est utile). Retourne null tant que le plugin natif n'est pas branché.
 */
export async function getNativePosition(): Promise<null> {
  return null;
}
