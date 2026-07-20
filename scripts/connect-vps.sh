#!/bin/bash

# ============================================================
# MiamExpress — Script de connexion au VPS (Bash)
# Usage : ./scripts/connect-vps.sh [command] [options]
# ============================================================

# Configuration par défaut
VPS_HOST="${VPS_HOST:-vps-0943c5fc.vps.ovh.ca}"
VPS_USER="${VPS_USER:-ubuntu}"
VPS_PATH="${VPS_PATH:-/home/ubuntu/miamexpress}"
VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/id_ed25519}"

COMMAND="${1:-help}"
DRY_RUN="${DRY_RUN:-false}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# ─────────────────────────────────────────────────────────────
# Affichage du header
# ─────────────────────────────────────────────────────────────
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         MiamExpress — Connexion au VPS                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Vérifier SSH
if ! command -v ssh &> /dev/null; then
  echo -e "${RED}❌ SSH introuvable${NC}"
  exit 1
fi

# Afficher les infos de connexion
echo -e "${CYAN}📡 Coordonnées de connexion :${NC}"
echo -e "   Hôte        : ${VPS_HOST}"
echo -e "   Utilisateur : ${VPS_USER}"
echo -e "   Chemin      : ${VPS_PATH}"

if [ -f "$VPS_SSH_KEY" ]; then
  echo -e "   ${GREEN}Clé SSH     : $VPS_SSH_KEY ✓${NC}"
  SSH_FLAGS="-i $VPS_SSH_KEY"
else
  echo -e "   ${YELLOW}⚠️  Clé SSH '$VPS_SSH_KEY' introuvable — utilisation de l'agent SSH par défaut${NC}"
  SSH_FLAGS=""
fi

echo ""

# ─────────────────────────────────────────────────────────────
# Commandes disponibles
# ─────────────────────────────────────────────────────────────
show_help() {
  echo -e "${CYAN}Commandes disponibles :${NC}"
  echo ""
  echo -e "  ${YELLOW}./connect-vps.sh shell${NC}              → Connexion shell interactive"
  echo -e "  ${YELLOW}./connect-vps.sh status${NC}             → Status des services"
  echo -e "  ${YELLOW}./connect-vps.sh logs${NC}               → Afficher les logs dernières"
  echo -e "  ${YELLOW}./connect-vps.sh restart-services${NC}   → Redémarrer les services"
  echo -e "  ${YELLOW}./connect-vps.sh check-disk${NC}         → Vérifier l'espace disque"
  echo -e "  ${YELLOW}./connect-vps.sh check-process${NC}      → Vérifier les processus Node"
  echo -e "  ${YELLOW}./connect-vps.sh update-app${NC}         → Mettre à jour l'application"
  echo -e "  ${YELLOW}./connect-vps.sh backup-db${NC}          → Sauvegarder la BD"
  echo -e "  ${YELLOW}./connect-vps.sh tunnel-db${NC}          → Tunnel SSH vers PostgreSQL"
  echo -e "  ${YELLOW}./connect-vps.sh help${NC}               → Afficher cette aide"
  echo ""
}

# ─────────────────────────────────────────────────────────────
# Exécution des commandes
# ─────────────────────────────────────────────────────────────
case "$COMMAND" in
  help)
    show_help
    ;;

  shell)
    echo -e "${YELLOW}🔗 Connexion shell interactive...${NC}"
    echo -e "${CYAN}   Tapez 'exit' pour quitter${NC}"
    echo ""
    if [ "$DRY_RUN" = "true" ]; then
      echo -e "${MAGENTA}[DRY-RUN] ssh $SSH_FLAGS $VPS_USER@$VPS_HOST${NC}"
    else
      ssh $SSH_FLAGS "$VPS_USER@$VPS_HOST"
    fi
    ;;

  status)
    echo -e "${YELLOW}🔍 Vérification du status des services...${NC}"
    if [ "$DRY_RUN" = "true" ]; then
      echo -e "${MAGENTA}[DRY-RUN]${NC}"
    fi
    ssh $SSH_FLAGS "$VPS_USER@$VPS_HOST" << 'EOF'
      echo "=== Nginx ===" && sudo systemctl status nginx --no-pager && \
      echo "" && \
      echo "=== Backend API (port 3002) ===" && sudo lsof -i :3002 || echo "Aucun processus sur le port 3002" && \
      echo "" && \
      echo "=== Media API (port 3003) ===" && sudo lsof -i :3003 || echo "Aucun processus sur le port 3003" && \
      echo "" && \
      echo "=== PostgreSQL ===" && sudo systemctl status postgresql --no-pager || echo "PostgreSQL non détecté"
EOF
    ;;

  logs)
    echo -e "${YELLOW}📋 Affichage des derniers logs...${NC}"
    if [ "$DRY_RUN" = "true" ]; then
      echo -e "${MAGENTA}[DRY-RUN]${NC}"
    fi
    ssh $SSH_FLAGS "$VPS_USER@$VPS_HOST" << EOF
      echo "=== Logs Nginx (dernières 30 lignes) ===" && \
      sudo tail -30 /var/log/nginx/error.log && \
      echo "" && \
      echo "=== Logs App (si présent) ===" && \
      tail -30 $VPS_PATH/logs/app.log 2>/dev/null || echo "Fichier logs/app.log absent"
EOF
    ;;

  restart-services)
    echo -e "${YELLOW}🔄 Redémarrage des services...${NC}"
    if [ "$DRY_RUN" = "true" ]; then
      echo -e "${MAGENTA}[DRY-RUN]${NC}"
    fi
    ssh $SSH_FLAGS "$VPS_USER@$VPS_HOST" << 'EOF'
      echo "Redémarrage de Nginx..." && \
      sudo systemctl restart nginx && \
      echo "✓ Nginx redémarré" && \
      echo "" && \
      echo "Vérification des services..." && \
      sudo systemctl status nginx postgresql --no-pager || true
EOF
    ;;

  check-disk)
    echo -e "${YELLOW}💾 Vérification de l'espace disque...${NC}"
    if [ "$DRY_RUN" = "true" ]; then
      echo -e "${MAGENTA}[DRY-RUN]${NC}"
    fi
    ssh $SSH_FLAGS "$VPS_USER@$VPS_HOST" "df -h / && echo '' && du -sh $VPS_PATH/* 2>/dev/null | sort -h || echo 'Répertoire absent'"
    ;;

  check-process)
    echo -e "${YELLOW}⚙️  Vérification des processus Node.js...${NC}"
    if [ "$DRY_RUN" = "true" ]; then
      echo -e "${MAGENTA}[DRY-RUN]${NC}"
    fi
    ssh $SSH_FLAGS "$VPS_USER@$VPS_HOST" "ps aux | grep -E 'node|npm' | grep -v grep || echo 'Aucun processus Node.js actif'"
    ;;

  update-app)
    echo -e "${YELLOW}📦 Mise à jour de l'application...${NC}"
    if [ "$DRY_RUN" = "true" ]; then
      echo -e "${MAGENTA}[DRY-RUN]${NC}"
    fi
    ssh $SSH_FLAGS "$VPS_USER@$VPS_HOST" << EOF
      cd $VPS_PATH && \
      git pull origin main && \
      npm install && \
      npm run build && \
      echo "" && \
      echo "✓ Application mise à jour"
EOF
    ;;

  backup-db)
    echo -e "${YELLOW}🔐 Sauvegarde de la base de données...${NC}"
    TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
    if [ "$DRY_RUN" = "true" ]; then
      echo -e "${MAGENTA}[DRY-RUN]${NC}"
    fi
    ssh $SSH_FLAGS "$VPS_USER@$VPS_HOST" << EOF
      mkdir -p $VPS_PATH/backups && \
      pg_dump -U postgres -d miamexpress > $VPS_PATH/backups/db_backup_$TIMESTAMP.sql && \
      echo "✓ Sauvegarde créée : backups/db_backup_$TIMESTAMP.sql" && \
      ls -lh $VPS_PATH/backups/
EOF
    ;;

  tunnel-db)
    echo -e "${YELLOW}🔐 Tunnel SSH vers PostgreSQL...${NC}"
    echo -e "${CYAN}   Connexion locale : localhost:5432${NC}"
    echo -e "${CYAN}   Tapez Ctrl+C pour terminer${NC}"
    echo ""
    if [ "$DRY_RUN" = "true" ]; then
      echo -e "${MAGENTA}[DRY-RUN] ssh -L 5432:localhost:5432 $VPS_USER@$VPS_HOST -N${NC}"
    else
      ssh $SSH_FLAGS -L 5432:localhost:5432 "$VPS_USER@$VPS_HOST" -N
    fi
    ;;

  *)
    echo -e "${RED}❌ Commande inconnue : '$COMMAND'${NC}"
    echo ""
    show_help
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}✓ Opération terminée${NC}"
