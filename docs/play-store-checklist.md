# Checklist Play Store — MiamExpress (app client) — CP9

> Préparation complète pour la mise en ligne. **La signature (keystore) et la
> soumission Play Console restent entre les mains du propriétaire** — aucun
> secret ne transite par le repo ni par un agent.

## 1. Compte développeur
- [ ] Compte Google Play Console (frais unique 25 USD) : https://play.google.com/console
- [ ] Profil développeur : nom « MiamExpress », email support (ex. support@miamexpress.cm), site https://miamexpress.cm
- [ ] Vérification d'identité Google (pièce requise, délai possible de quelques jours)

## 2. Clé de signature (À FAIRE PAR LE PROPRIÉTAIRE — jamais commitée)
```bash
keytool -genkeypair -v -keystore miamexpress-release.keystore \
  -alias miamexpress -keyalg RSA -keysize 2048 -validity 10000
```
- [ ] Conserver le keystore + mots de passe dans un gestionnaire de secrets (2 sauvegardes hors machine)
- [ ] Recommandé : activer « Play App Signing » (Google garde la clé de release, vous gardez la clé d'upload)

## 3. Build AAB (poste avec Android Studio / SDK + JDK 17)
```bash
# 1. Build web périmètre client
VITE_APP_TARGET=client npm run build
npx cap sync android
# 2. AAB release (non signé si pas de signingConfig locale)
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```
- [ ] Configurer `android/app/build.gradle` → `signingConfigs.release` pointant le keystore local (chemin hors repo, via `keystore.properties` non commité)
- [ ] Version : `versionCode`/`versionName` dans `android/app/build.gradle` (commencer 1 / "1.0.0")

## 4. Fiche store (FR par défaut + EN)
- [ ] **Titre** (30 car.) : « MiamExpress — Livraison repas »
- [ ] **Description courte** (80 car.) FR : « Vos plats préférés livrés à Douala et Yaoundé. Paiement à la livraison. » · EN : « Your favourite meals delivered in Douala & Yaoundé. Pay on delivery. »
- [ ] **Description longue** FR/EN : restaurants partenaires, suivi de livraison, paiement à la livraison / Mobile Money, programmes repas santé, MiamPoints
- [ ] **Icône** 512×512 PNG (depuis `resources/icon.png`, généré via `npx capacitor-assets generate`)
- [ ] **Feature graphic** 1024×500
- [ ] **Captures** : min. 2 (recommandé 4-8) téléphone 16:9 — accueil, fiche resto, suivi commande, programmes santé (prendre sur émulateur en français)

## 5. Conformité
- [ ] **Politique de confidentialité** : URL publique requise → publier une page https://miamexpress.cm/fr/confidentialite (données collectées : téléphone, adresses de livraison, historique commandes ; pas de revente ; contact support)
- [ ] **Data safety form** (Play Console) : collecte téléphone + localisation approximative (adresse) + historique d'achats ; partagées avec restaurants/livreurs pour la livraison uniquement
- [ ] **Classification du contenu** (questionnaire IARC) : app de commerce, tout public
- [ ] **Catégorie** : Food & Drink (Cuisine et boissons)
- [ ] **Public cible** : 18+ (transactions) ou 13+ selon questionnaire ; pas de contenu enfants
- [ ] **App access** : fournir un compte de démo à Google si la revue le demande (compte client de test)

## 6. Tests avant soumission
- [ ] Internal testing track d'abord (upload AAB, testeurs par email)
- [ ] Parcours réels sur appareil : inscription OTP, commande COD, suivi, programmes, FR/EN
- [ ] Deep links https://miamexpress.cm (App Links : déposer `/.well-known/assetlinks.json` sur le VPS avec l'empreinte SHA-256 de la clé)

## 7. Soumission
- [ ] Production release → revue Google (quelques heures à quelques jours)
- [ ] Après publication : surveiller ANR/crashes (Play Console → Android vitals)

## STOP & DEMANDE (rappel)
Toute étape impliquant le **keystore**, un **compte externe** ou la **soumission**
est faite par le propriétaire. L'agent prépare, le propriétaire signe et soumet.
