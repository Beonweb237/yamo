# 🚀 Scripts MiamExpress

Ce répertoire contient les scripts de gestion, déploiement et maintenance de l'application.

---

## 📁 Liste des scripts

### 🌐 Connexion VPS

#### **Windows (PowerShell)**
```powershell
.\connect-vps.ps1 -Command shell              # Shell interactif
.\connect-vps.ps1 -Command status             # Status des services
.\connect-vps.ps1 -Command logs               # Afficher les logs
.\connect-vps.ps1 -Command restart-services   # Redémarrer les services
.\connect-vps.ps1 -Command check-disk         # Espace disque
.\connect-vps.ps1 -Command check-process      # Processus Node.js
.\connect-vps.ps1 -Command update-app         # Mettre à jour l'app
.\connect-vps.ps1 -Command backup-db          # Sauvegarder la BD
.\connect-vps.ps1 -Command help               # Aide
```

#### **Linux / macOS (Bash)**
```bash
chmod +x connect-vps.sh  # Rendre exécutable (une seule fois)

./connect-vps.sh shell              # Shell interactif
./connect-vps.sh status             # Status des services
./connect-vps.sh logs               # Afficher les logs
./connect-vps.sh restart-services   # Redémarrer les services
./connect-vps.sh check-disk         # Espace disque
./connect-vps.sh check-process      # Processus Node.js
./connect-vps.sh update-app         # Mettre à jour l'app
./connect-vps.sh backup-db          # Sauvegarder la BD
./connect-vps.sh tunnel-db          # Tunnel SSH → PostgreSQL
./connect-vps.sh help               # Aide
```

#### **Via npm (Windows)**
```bash
npm run vps:shell          # Shell interactif
npm run vps:status         # Status des services
npm run vps:logs           # Afficher les logs
npm run vps:restart        # Redémarrer les services
npm run vps:disk           # Espace disque
npm run vps:process        # Processus Node.js
npm run vps:update         # Mettre à jour l'app
npm run vps:backup         # Sauvegarder la BD
```

---

### 🚀 Déploiement

#### **Déployer vers VPS (Windows)**
```powershell
npm run deploy              # Déploiement complet
npm run deploy:dry          # Simulation (sans exécution)
```

**Paramètres personnalisés :**
```powershell
.\deploy.ps1 -VpsHost votre-host -VpsUser votre-user -VpsPath /chemin
```

---

### 🌱 Initialisation données

#### **Seed (données de test)**
```bash
npm run seed                # Seed historique Supabase (LEGACY)
npm run seed:reviews        # Créer des avis de test
npm run seed:test-profiles  # Créer des profils de test
```

⚠️ **Note** : `npm run seed` et `npm run seed:test-profiles` sont des scripts **hérités Supabase**. À ne pas utiliser. Utiliser `npm run seed:reviews` pour les données de test.

---

### ✅ Vérification

#### **Vérifier la structure du catalogue**
```bash
npm run verify:catalog
```

Cela vérifie :
- Les items du menu
- Les plats dupliqués
- Les IDs orphelins
- Les images manquantes

---

### 🔧 Autres scripts (répertoire scripts/)

| Fichier | Rôle | Usage |
|---|---|---|
| `clean-vps-dist.sh` | Nettoyage dist VPS | À ne pas lancer sans demande expresse |
| `deploy-vps.sh` | Déploiement Bash (Linux) | Alternative Bash à `deploy.ps1` |
| `fix-media-paths.cjs` | Corriger les chemins médias | `node fix-media-paths.cjs` |
| `generate-pwa-icons.mjs` | Générer icônes PWA | `node generate-pwa-icons.mjs` |
| `migrate-images.mjs` | Migrer images vers `/uploads` | `node migrate-images.mjs` |
| `scan-media.js` | Scanner les ressources médias | `node scan-media.js` |
| `seed-catalog-gaps.mjs` | Compléter le catalogue | `node seed-catalog-gaps.mjs` |
| `verify-catalog.mjs` | Vérifier le catalogue | `npm run verify:catalog` |

---

## 🔐 Configuration

### Configuration par défaut

Les scripts utilisent ces coordonnées VPS par défaut :

```
Hôte        : vps-0943c5fc.vps.ovh.ca
Utilisateur : ubuntu
Chemin      : /home/ubuntu/miamexpress
Clé SSH     : ~/.ssh/id_ed25519
```

### Configuration personnalisée

Créez un fichier `.env.server` :

```bash
cp ../.env.server.example ../.env.server
```

Modifiez les valeurs :

```bash
VPS_HOST=votre-host.com
VPS_USER=votre-user
VPS_PATH=/votre/chemin
VPS_SSH_KEY=$HOME/.ssh/ma-cle
```

---

## 🔑 Prérequis

### Windows

- **OpenSSH Client** : Installer depuis Paramètres → Fonctionnalités optionnelles
- **PowerShell 5.0+** : Vérifier avec `$PSVersionTable.PSVersion`

### Linux / macOS

- **OpenSSH** : Généralement pré-installé
- **Bash 3.0+** : Vérifier avec `bash --version`

---

## 🛡️ Sécurité

✅ **À faire :**
- Garder les clés SSH sécurisées : `chmod 600 ~/.ssh/id_ed25519`
- Utiliser `.env.server` pour les coordonnées personnalisées
- Ignorer les logs sensibles

❌ **À ne pas faire :**
- Committer `.env.server` avec de vrais identifiants
- Committer les clés SSH privées
- Partager les mots de passe VPS
- Utiliser l'option `-DryRun` en production

---

## 📊 Logs et débogage

### Consulter les logs

```bash
# Nginx errors
npm run vps:logs

# Nginx access
ssh ubuntu@vps-0943c5fc.vps.ovh.ca "sudo tail -50 /var/log/nginx/access.log"

# App logs
ssh ubuntu@vps-0943c5fc.vps.ovh.ca "tail -50 /home/ubuntu/miamexpress/logs/app.log"
```

### Vérifier les services

```bash
npm run vps:status
```

Affiche :
- Status Nginx
- Processus sur port 3002 (Backend API)
- Processus sur port 3003 (Media API)
- Status PostgreSQL

---

## 🐛 Dépannage

### Erreur : Script non exécutable (Linux/macOS)

```bash
chmod +x connect-vps.sh
chmod +x deploy-vps.sh
```

### Erreur : SSH introuvable

```bash
# Installer OpenSSH (Linux)
sudo apt-get install openssh-client

# Installer OpenSSH (macOS)
brew install openssh
```

### Erreur : Clé SSH refusée

```bash
ssh-copy-id -i ~/.ssh/id_ed25519 ubuntu@vps-0943c5fc.vps.ovh.ca
```

---

## 📖 Documentation connexe

- [Guide complet de connexion VPS](../docs/vps-connexion-guide.md)
- [Plan de déploiement](../docs/ux-implementation-plan.md)
- [Guide stratégique](../docs/guide-strategique-yamo.md)

---

## 📞 Support

Pour toute question, consultez la [documentation complète](../docs/vps-connexion-guide.md).
