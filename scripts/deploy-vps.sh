#!/usr/bin/env bash
# ============================================================
# MiamExpress — Script de déploiement VPS (côté serveur)
# Usage (sur le VPS) : bash deploy-vps.sh
# ============================================================
set -euo pipefail

# ── Configuration ─────────────────────────────────────────
APP_ROOT="/home/ubuntu/miamexpress"
DIST_DIR="$APP_ROOT/dist"
UPLOADS_DIR="$APP_ROOT/uploads"
SERVER_DIR="$APP_ROOT/server"
API_DIR="$SERVER_DIR/server"
MEDIA_API="$SERVER_DIR/media-api.js"
NGINX_CONF="$SERVER_DIR/miamexpress-nginx.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/miamexpress.cm"

PM2_API="miamexpress-api"
PM2_MEDIA="miamexpress-media"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║       MiamExpress — Déploiement VPS (serveur)           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Vérification de l'environnement ────────────────────
echo "── 1/6 Vérification ──────────────────────────────────────"
if [ ! -d "$APP_ROOT" ]; then
  echo "❌ $APP_ROOT introuvable — le projet n'est pas installé."
  echo "   Clonez d'abord : git clone <repo> $APP_ROOT"
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "❌ Node.js requis"; exit 1; }
command -v pm2 >/dev/null 2>&1 || { echo "❌ PM2 requis : npm i -g pm2"; exit 1; }
echo "   ✅ Environnement OK — Node $(node -v), PM2 $(pm2 -v 2>/dev/null || echo 'installé')"

# ── 2. Sauvegarde de l'ancienne version ───────────────────
echo "── 2/6 Sauvegarde ────────────────────────────────────────"
BACKUP_DIR="$APP_ROOT/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
if [ -d "$DIST_DIR" ]; then
  cp -r "$DIST_DIR" "$BACKUP_DIR/dist"
  echo "   ✅ Dist sauvegardé → $BACKUP_DIR/dist"
else
  echo "   ⚠️  Aucun dist à sauvegarder (premier déploiement ?)"
fi

# ── 3. Dépendances serveur ────────────────────────────────
echo "── 3/6 Dépendances ───────────────────────────────────────"
if [ -f "$API_DIR/package.json" ]; then
  cd "$API_DIR"
  npm install --production 2>&1 | tail -3
  echo "   ✅ API dependencies OK"
else
  echo "   ⚠️  $API_DIR/package.json absent — packages API non installés"
fi

# Pour la médiathèque (si elle tourne en standalone)
if [ -f "$MEDIA_API" ]; then
  # Vérifier si express/multer/sharp sont installés globalement ou dans server/
  cd "$APP_ROOT"
  npm ls express >/dev/null 2>&1 || npm install express multer sharp 2>&1 | tail -3
  echo "   ✅ Média dependencies OK"
fi

# ── 4. Redémarrage des services PM2 ──────────────────────
echo "── 4/6 Services PM2 ──────────────────────────────────────"

restart_pm2() {
  local name=$1
  local script=$2
  local port=$3
  if pm2 list 2>/dev/null | grep -q "$name"; then
    pm2 restart "$name" 2>&1 | tail -1
    echo "   ✅ $name redémarré"
  else
    if [ -f "$script" ]; then
      pm2 start "$script" --name "$name" --interpreter node --env PORT="$port" 2>&1 | tail -1
      echo "   ✅ $name lancé (port $port)"
    else
      echo "   ⚠️  $script absent — $name non lancé"
    fi
  fi
}

restart_pm2 "$PM2_API" "$API_DIR/src/index.js" 3002
restart_pm2 "$PM2_MEDIA" "$MEDIA_API" 3003

pm2 save 2>&1 | tail -1

# ── 5. Nginx ──────────────────────────────────────────────
echo "── 5/6 Nginx ─────────────────────────────────────────────"
if [ -f "$NGINX_CONF" ]; then
  sudo cp "$NGINX_CONF" "$NGINX_ENABLED"
  echo "   ✅ Configuration Nginx copiée"
else
  echo "   ⚠️  $NGINX_CONF absent — configuration Nginx non mise à jour"
fi

sudo nginx -t 2>&1 | tail -1
sudo systemctl reload nginx 2>&1
echo "   ✅ Nginx rechargé"

# ── 6. Permissions ─────────────────────────────────────────
echo "── 6/6 Permissions ───────────────────────────────────────"
mkdir -p "$UPLOADS_DIR"/{dishes,restaurants,categories,general,banners,branding}
chmod -R 755 "$UPLOADS_DIR"
chmod -R 755 "$DIST_DIR"
echo "   ✅ Permissions OK"

# ── Résumé ─────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ Déploiement terminé !                               ║"
echo "║                                                        ║"
echo "║  Site    : https://miamexpress.cm                       ║"
echo "║  API     : http://localhost:3002                        ║"
echo "║  Média   : http://localhost:3003                        ║"
echo "║                                                        ║"
echo "║  Backup  : $BACKUP_DIR                                  ║"
echo "║                                                        ║"
echo "║  pm2 status              Voir les processus            ║"
echo "║  pm2 logs                Voir les logs                 ║"
echo "║  bash deploy-vps.sh      Redéployer                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
