import type { CapacitorConfig } from '@capacitor/cli';

// App mobile CLIENT MiamExpress (CP8) — enveloppe Capacitor du build web.
// Build dédié : VITE_APP_TARGET=client npm run build (routes client uniquement),
// puis npx cap sync android. Voir docs/mobile-capacitor.md.
const config: CapacitorConfig = {
  appId: 'com.miamexpress.client',
  appName: 'MiamExpress',
  webDir: 'dist',
  server: {
    // Deep links https://miamexpress.cm/* ouvrent l'app (intent-filter Android).
    androidScheme: 'https',
  },
};

export default config;
