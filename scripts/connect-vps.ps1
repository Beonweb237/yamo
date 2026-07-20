param(
  [string]$VpsHost = "vps-0943c5fc.vps.ovh.ca",
  [string]$VpsUser = "ubuntu",
  [string]$VpsPath = "/home/ubuntu/miamexpress",
  [string]$SshKey = "$env:USERPROFILE\.ssh\id_ed25519_jackpot",
  [string]$Command = "shell",
  [switch]$DryRun
)

Write-Host "MiamExpress - Connexion VPS" -ForegroundColor Green
Write-Host ""
Write-Host "Host: $VpsHost"
Write-Host "User: $VpsUser"
Write-Host ""

if ($Command -eq "help") {
  Write-Host "Available commands:"
  Write-Host "  shell        - Interactive shell"
  Write-Host "  status       - Check service status"
  Write-Host "  logs         - Show logs"
  Write-Host "  check-disk   - Check disk space"
  Write-Host "  check-process- Check Node processes"
  Write-Host "  backup-db    - Backup database"
  Write-Host "  update-app   - Update application"
  exit 0
}

if ($Command -eq "shell") {
  Write-Host "Connecting to shell..." -ForegroundColor Yellow
  if ($DryRun) {
    Write-Host "[DRY-RUN] ssh $VpsUser@$VpsHost" -ForegroundColor Magenta
  }
  else {
    ssh $VpsUser@$VpsHost
  }
  exit 0
}

if ($Command -eq "status") {
  Write-Host "Checking services..." -ForegroundColor Yellow
  $cmd = "sudo systemctl status nginx --no-pager && echo '---' && (sudo lsof -i :3002 || echo 'No process on port 3002') && echo '---' && (sudo lsof -i :3003 || echo 'No process on port 3003')"
  if ($DryRun) {
    Write-Host "[DRY-RUN] ssh $VpsUser@$VpsHost" -ForegroundColor Magenta
  }
  else {
    ssh $VpsUser@$VpsHost $cmd
  }
  exit 0
}

if ($Command -eq "logs") {
  Write-Host "Showing logs..." -ForegroundColor Yellow
  if ($DryRun) {
    Write-Host "[DRY-RUN] ssh $VpsUser@$VpsHost sudo tail -50 /var/log/nginx/error.log" -ForegroundColor Magenta
  }
  else {
    ssh $VpsUser@$VpsHost "sudo tail -50 /var/log/nginx/error.log"
  }
  exit 0
}

if ($Command -eq "check-disk") {
  Write-Host "Checking disk space..." -ForegroundColor Yellow
  if ($DryRun) {
    Write-Host "[DRY-RUN] ssh $VpsUser@$VpsHost df -h /" -ForegroundColor Magenta
  }
  else {
    ssh $VpsUser@$VpsHost "df -h /"
  }
  exit 0
}

if ($Command -eq "check-process") {
  Write-Host "Checking Node processes..." -ForegroundColor Yellow
  if ($DryRun) {
    Write-Host "[DRY-RUN] ssh $VpsUser@$VpsHost ps aux | grep node" -ForegroundColor Magenta
  }
  else {
    ssh $VpsUser@$VpsHost "ps aux | grep -E 'node|npm' | grep -v grep || echo 'No Node processes'"
  }
  exit 0
}

if ($Command -eq "update-app") {
  Write-Host "Updating application..." -ForegroundColor Yellow
  $cmd = "cd $VpsPath && git pull origin main && npm install && npm run build"
  if ($DryRun) {
    Write-Host "[DRY-RUN] ssh $VpsUser@$VpsHost" -ForegroundColor Magenta
  }
  else {
    ssh $VpsUser@$VpsHost $cmd
  }
  exit 0
}

if ($Command -eq "backup-db") {
  Write-Host "Backing up database..." -ForegroundColor Yellow
  $ts = Get-Date -Format "yyyy-MM-dd_HHmmss"
  $cmd = "mkdir -p $VpsPath/backups && pg_dump -U postgres -d miamexpress > $VpsPath/backups/db_backup_$ts.sql && ls -lh $VpsPath/backups/"
  if ($DryRun) {
    Write-Host "[DRY-RUN] ssh $VpsUser@$VpsHost" -ForegroundColor Magenta
  }
  else {
    ssh $VpsUser@$VpsHost $cmd
  }
  exit 0
}

Write-Host "Command: $Command"
Write-Host "Dry run: $DryRun"
