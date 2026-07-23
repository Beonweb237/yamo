import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'

// PWA désactivé — le Service Worker causait des erreurs MIME à chaque déploiement
// (anciens fichiers JS hashés servis en HTML par le fallback SPA)
// import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    inspectAttr(),
    react(),
  ],
  server: {
    // PORT est injecté par l'outillage dev (autoPort) quand 3000 est occupé ;
    // 3000 reste le défaut en usage direct (npm run dev).
    port: Number(process.env.PORT) || 3000,
    // En dev, /api est proxifié vers le backend (par défaut la prod VPS) pour
    // tester le mode API (VITE_USE_VPS_API=true) sans problème de CORS —
    // même chemin relatif qu'en production derrière Nginx.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY || 'https://miamexpress.cm',
        changeOrigin: true,
        secure: true,
      },
      // Les images sont stockées en chemins relatifs /uploads/... servis par
      // Nginx en prod. En dev, sans ce proxy, elles renvoient 404 (le serveur
      // Vite n'a pas ces fichiers) → images cassées. On proxifie vers le VPS.
      '/uploads': {
        target: process.env.VITE_DEV_API_PROXY || 'https://miamexpress.cm',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
