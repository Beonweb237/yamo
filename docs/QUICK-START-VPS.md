# 🚀 Démarrage Rapide — Connexion VPS

Suivez ces étapes pour vous connecter au VPS **MiamExpress** en 2 minutes.

---

## ⚡ Installation rapide (première fois)

### 1️⃣ Vérifier OpenSSH

**Windows:**
```powershell
ssh -V  # Doit afficher la version
```

Si non installé → Paramètres → Fonctionnalités optionnelles → Ajouter OpenSSH Client

**Linux / macOS:**
```bash
ssh -V  # Doit afficher la version
```

### 2️⃣ Générer ou trouver votre clé SSH

```bash
# Vérifier si vous avez une clé
ls ~/.ssh/id_ed25519

# Si absent, créer une (appuyer sur Entrée à chaque prompt)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
```

### 3️⃣ Envoyer votre clé publique au VPS

```bash
ssh-copy-id -i ~/.ssh/id_ed25519 ubuntu@vps-0943c5fc.vps.ovh.ca
```

(Tapez le mot de passe VPS, puis c'est fini)

---

## ✅ Connexion classique (après installation)

### Via npm (recommandé)

```bash
cd app/
npm run vps:shell          # Se connecter
npm run vps:status         # Voir les services
npm run vps:logs           # Voir les logs
```

### Via ligne de commande

```bash
# Windows
.\app\scripts\connect-vps.ps1 -Command shell

# Linux / macOS
./app/scripts/connect-vps.sh shell
```

### Via SSH directement

```bash
ssh ubuntu@vps-0943c5fc.vps.ovh.ca
```

---

## 📋 Commandes essentielles

```bash
# Shell interactif VPS
npm run vps:shell

# Vérifier les services
npm run vps:status

# Voir les logs
npm run vps:logs

# Redémarrer les services
npm run vps:restart

# Vérifier l'espace disque
npm run vps:disk

# Vérifier les processus Node
npm run vps:process

# Mettre à jour l'app
npm run vps:update

# Sauvegarder la BD
npm run vps:backup
```

---

## 🔧 Configuration personnalisée (optionnel)

```bash
cd app/
cp .env.server.example .env.server
```

Modifiez `.env.server` avec vos coordonnées personnalisées.

---

## 🌐 Coordonnées VPS actuelles

| Information | Valeur |
|---|---|
| Hôte | `vps-0943c5fc.vps.ovh.ca` |
| Utilisateur | `ubuntu` |
| Chemin app | `/home/ubuntu/miamexpress` |
| Domaine | `miamexpress.cm` |

---

## 🐛 Dépannage rapide

| Erreur | Solution |
|---|---|
| SSH introuvable | Installer OpenSSH Client |
| Clé refusée | `ssh-copy-id -i ~/.ssh/id_ed25519 ubuntu@...` |
| Connexion refusée | Vérifier la connectivité réseau |
| Permission refusée | Vérifier les droits sudo |

---

## 📖 Documentation complète

- [Guide complet VPS](docs/vps-connexion-guide.md)
- [Scripts disponibles](scripts/README.md)
- [Plan d'implémentation](docs/ux-implementation-plan.md)

---

## 🎯 Prochaines étapes

1. ✅ Connexion testée
2. 📊 Explorer les services avec `npm run vps:status`
3. 📋 Consulter les logs avec `npm run vps:logs`
4. 🔄 Redémarrer les services avec `npm run vps:restart` si nécessaire
5. 📚 Lire le guide complet pour les opérations avancées
