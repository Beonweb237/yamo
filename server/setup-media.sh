#!/usr/bin/env bash
# ============================================================
# MiamExpress — Setup Médiathèque
# Usage: bash setup-media.sh
# ============================================================
set -euo pipefail

APP_ROOT="/home/ubuntu/miamexpress"
MEDIA_PORT=3002

echo "=== MiamExpress — Installation Médiathèque ==="

# 1. Install dependencies
echo "1/5 Installation des dépendances..."
cd "$APP_ROOT"
npm install express multer sharp 2>&1 | tail -3

# 2. Create uploads structure
echo "2/5 Création des dossiers..."
mkdir -p "$APP_ROOT/uploads"/{dishes,restaurants,categories,general,banners,branding}
chmod -R 755 "$APP_ROOT/uploads"

# 3. Start media API with PM2
echo "3/5 Démarrage API médiathèque (port $MEDIA_PORT)..."
if pm2 list 2>/dev/null | grep -q "miamexpress-media"; then
  pm2 restart miamexpress-media
else
  pm2 start "$APP_ROOT/server/media-api.js" \
    --name miamexpress-media \
    --interpreter node \
    --env MEDIA_PORT=$MEDIA_PORT \
    --env MEDIA_UPLOADS_ROOT="$APP_ROOT/uploads"
fi
pm2 save

# 4. Update Nginx to proxy media API
echo "4/5 Configuration Nginx..."
NGINX_CONF="/etc/nginx/sites-enabled/miamexpress.cm"

# Check if media proxy already exists
if grep -q "api/media" "$NGINX_CONF" 2>/dev/null; then
  echo "   Proxy média déjà configuré dans Nginx."
else
  # Add media proxy before the SPA fallback location /
  sudo sed -i '/location \/ {/i\
    # Médiathèque API proxy\
    location /api/media {\
        proxy_pass http://127.0.0.1:'"$MEDIA_PORT"'/api/media;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        client_max_body_size 20M;\
    }\
\
    # Uploads statiques\
    location /uploads/ {\
        alias '"$APP_ROOT"'/uploads/;\
        expires 30d;\
        add_header Cache-Control "public, max-age=2592000";\
    }\
' "$NGINX_CONF"
  echo "   Proxy média ajouté à Nginx."
fi

# 5. Reload Nginx
echo "5/5 Rechargement Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✅ Médiathèque installée !"
echo "   API  : http://localhost:$MEDIA_PORT/api/media"
echo "   URL  : https://miamexpress.cm/admin/media"
echo ""
echo "   PM2  : pm2 status miamexpress-media"
echo "   Logs : pm2 logs miamexpress-media"
