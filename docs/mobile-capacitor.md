# App mobile CLIENT — Capacitor (CP8)

> Périmètre : application **client** uniquement (pas de dashboards resto/livreur/admin).
> Le web ne change pas : `VITE_APP_TARGET` absent → build strictement identique.

## Architecture

| Élément | Rôle |
|---|---|
| `capacitor.config.ts` | appId `com.miamexpress.client`, webDir `dist`, scheme https |
| `android/` | Projet Android généré (`npx cap add android`), committé |
| `src/native/index.ts` | Couche native gardée par `Capacitor.isNativePlatform()` : bouton retour Android, deep links `miamexpress.cm`, stubs push (FCM) & géoloc — **no-op strict sur le web** |
| `src/App.tsx` | `VITE_APP_TARGET=client` → les routes back-office sont éliminées du bundle (constante remplacée au build par Vite) |
| `resources/icon.png` | Source d'icône (logo MiamExpress) |

## Build & lancement local

```bash
# 1. Build web en périmètre client (routes admin/dashboards exclues du bundle)
VITE_APP_TARGET=client npm run build
# (PowerShell : $env:VITE_APP_TARGET='client'; npm run build)

# 2. Sync vers le projet Android
npx cap sync android

# 3. Ouvrir/lancer (nécessite Android Studio + SDK)
npx cap open android      # ouvre Android Studio
npx cap run android       # build + lance sur un émulateur/appareil
```

## Icône & splash

`resources/icon.png` est la source. Génération des déclinaisons (nécessite le
paquet officiel, à lancer une fois sur un poste avec réseau) :

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --android
```

## Ce qui reste natif « stub » (volontairement honnête)

- **Push (FCM)** : `registerPushNotifications()` renvoie `null` — brancher
  `@capacitor/push-notifications` + endpoint VPS d'enregistrement des tokens.
- **Géolocalisation native** : `getNativePosition()` renvoie `null` — le web
  utilise déjà `navigator.geolocation` (fonctionne aussi en WebView).

## Notes

- Deep links : `androidScheme: 'https'` + listener `appUrlOpen` (src/native) ;
  déclarer l'intent-filter `miamexpress.cm` dans `android/app/src/main/AndroidManifest.xml`
  au moment de la mise en prod store (App Links + assetlinks.json côté VPS).
- Aucune clé de signature dans le repo. AAB/signature : voir `docs/play-store-checklist.md`.
