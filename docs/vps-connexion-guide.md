# 🌐 Guide de Connexion VPS — MiamExpress

Ce guide explique comment se connecter au serveur VPS et gérer l'application.

---

## 📋 Informations VPS

| Information | Valeur |
|---|---|
| **Hôte** | `vps-0943c5fc.vps.ovh.ca` |
| **Utilisateur** | `ubuntu` |
| **Chemin application** | `/home/ubuntu/miamexpress` |
| **Clé SSH** | `~/.ssh/id_ed25519` (par défaut) |
| **Domaine** | `miamexpress.cm` |
| **Backend API** | Port `3002` (`/api/*`) |
| **Media API** | Port `3003` (`/api/media`) |
| **Base de données** | PostgreSQL |

---

## 🔧 Installation prérequis

### Windows (PowerShell)

```powershell
# Installer OpenSSH Client
# Paramètres → Applications → Fonctionnalités optionnelles 
# → Ajouter une fonctionnalité → OpenSSH Client

# Vérifier
ssh -V
```

### Linux / macOS

```bash
# OpenSSH est généralement déjà installé
ssh -V
```

### Générer une clé SSH (si nécessaire)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
```

---

## 🚀 Scripts de connexion

### Windows (PowerShell)

Tous les scripts se lancent depuis le répertoire `app/` :

```powershell
# Shell interactif
.\scripts\connect-vps.ps1 -Command shell

# Vérifier le status des services
.\scripts\connect-vps.ps1 -Command status

# Afficher les logs
.\scripts\connect-vps.ps1 -Command logs

# Redémarrer les services
.\scripts\connect-vps.ps1 -Command restart-services

# Vérifier l'espace disque
.\scripts\connect-vps.ps1 -Command check-disk

# Vérifier les processus Node.js
.\scripts\connect-vps.ps1 -Command check-process

# Mettre à jour l'application
.\scripts\connect-vps.ps1 -Command update-app

# Sauvegarder la base de données
.\scripts\connect-vps.ps1 -Command backup-db

# Mode simulation (sans exécution)
.\scripts\connect-vps.ps1 -Command status -DryRun
```

### Linux / macOS

```bash
# Rendre exécutable (une seule fois)
chmod +x scripts/connect-vps.sh

# Shell interactif
./scripts/connect-vps.sh shell

# Vérifier le status des services
./scripts/connect-vps.sh status

# Afficher les logs
./scripts/connect-vps.sh logs

# Redémarrer les services
./scripts/connect-vps.sh restart-services

# Vérifier l'espace disque
./scripts/connect-vps.sh check-disk

# Vérifier les processus Node.js
./scripts/connect-vps.sh check-process

# Mettre à jour l'application
./scripts/connect-vps.sh update-app

# Sauvegarder la base de données
./scripts/connect-vps.sh backup-db

# Tunnel SSH vers PostgreSQL (utile pour les outils locaux)
./scripts/connect-vps.sh tunnel-db

# Mode simulation (sans exécution)
DRY_RUN=true ./scripts/connect-vps.sh status
```

---

## ⚙️ Configuration personnalisée

Si vous avez des coordonnées VPS différentes, créez un fichier `.env.server` depuis le modèle :

```bash
cp .env.server.example .env.server
```

Puis modifiez les valeurs :

```bash
VPS_HOST=votre-host.com
VPS_USER=votre-user
VPS_PATH=/votre/chemin/app
VPS_SSH_KEY=$HOME/.ssh/ma-cle
```

Les scripts chargeront automatiquement ces valeurs.

---

## 🔑 Sécurité

- ⚠️ **Ne commitez JAMAIS** `.env.server` avec les vrais identifiants
- ⚠️ **Ne commitez JAMAIS** vos clés SSH privées
- ✅ Le fichier `.env.server` est dans `.gitignore`
- ✅ Gardez vos clés SSH sécurisées (`chmod 600 ~/.ssh/id_ed25519`)

---

## 📊 Commandes utiles du VPS

### Consulter les logs

```bash
# Logs Nginx (erreurs)
sudo tail -100 /var/log/nginx/error.log

# Logs Nginx (accès)
sudo tail -100 /var/log/nginx/access.log

# Logs application
tail -100 /home/ubuntu/miamexpress/logs/app.log
```

### Vérifier les services

```bash
# Nginx
sudo systemctl status nginx

# PostgreSQL
sudo systemctl status postgresql

# Processus Node.js
ps aux | grep node
```

### Redémarrer les services

```bash
# Nginx
sudo systemctl restart nginx

# PostgreSQL
sudo systemctl restart postgresql
```

### Gestion des fichiers

```bash
# Aller à l'application
cd /home/ubuntu/miamexpress

# Voir la structure
ls -la

# Espace disque
df -h

# Poids des dossiers
du -sh *
```

### Sauvegarde/Restauration PostgreSQL

```bash
# Sauvegarder
pg_dump -U postgres -d miamexpress > backup.sql

# Restaurer
psql -U postgres -d miamexpress < backup.sql
```

---

## 🐛 Dépannage

### ❌ Erreur : SSH introuvable

**Cause** : OpenSSH Client n'est pas installé  
**Solution** : Installer OpenSSH Client depuis les paramètres Windows

### ❌ Erreur : Clé SSH refusée

**Cause** : La clé SSH n'est pas enregistrée sur le VPS  
**Solution** :
```bash
ssh-copy-id -i ~/.ssh/id_ed25519 ubuntu@vps-0943c5fc.vps.ovh.ca
```

### ❌ Erreur : Connexion refusée

**Cause** : Le VPS n'est pas accessible  
**Solution** : Vérifier la connectivité réseau et les pare-feu

### ❌ Erreur : Permission refusée pour `sudo`

**Cause** : L'utilisateur n'a pas les droits suffisants  
**Solution** : Vérifier les droits sudo de l'utilisateur `ubuntu`

---

## 📱 Contexte Cameroun

Pour les déploiements au Cameroun :

- **Réseau 3G instable** → Préférer des connections de courte durée
- **Bande passante limitée** → Minimiser les transferts de gros fichiers
- **Paiement à la livraison essentiel** → Vérifier la config MoMo/Orange Money
- **WhatsApp/Téléphone important** → S'assurer que les notifications fonctionnent

---

## 📞 Support

Pour toute question, consultez :
- [Documentation VPS](../docs/)
- [Plan d'implémentation UX](../docs/ux-implementation-plan.md)
- [Guide stratégique](../docs/guide-strategique-yamo.md)
