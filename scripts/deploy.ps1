# ============================================================
# MiamExpress — Script de déploiement (Windows → VPS)
# Usage : .\scripts\deploy.ps1 [-VpsHost <host>] [-VpsUser <user>] [-VpsPath <path>] [-SshKey <path>] [-SkipBuild] [-DryRun]
# ============================================================
param(
  [string]$VpsHost = "vps-0943c5fc.vps.ovh.ca",
  [string]$VpsUser = "ubuntu",
  [string]$VpsPath = "/home/ubuntu/miamexpress",
  [string]$SshKey = "$env:USERPROFILE\.ssh\id_ed25519",
  [switch]$SkipBuild,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Resolve-Path "$ScriptDir\.."

# Construire les flags SSH
$sshFlags = ""
$scpFlags = ""
if (Test-Path $SshKey) {
  $sshFlags = "-i `"$SshKey`""
  $scpFlags = "-i `"$SshKey`""
  Write-Host "   🔑 Clé SSH : $SshKey" -ForegroundColor DarkGray
}
else {
  Write-Host "   ⚠️  Clé SSH '$SshKey' introuvable — utilisation de l'agent SSH par défaut" -ForegroundColor Yellow
}

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║       MiamExpress — Déploiement Windows → VPS           ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# ── 1. Vérifications ──────────────────────────────────────
Write-Host "── 1/6 Vérifications ────────────────────────────────────" -ForegroundColor Cyan

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  Write-Host "❌ SSH introuvable — installez OpenSSH Client" -ForegroundColor Red
  exit 1
}
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
  Write-Host "❌ SCP introuvable — installez OpenSSH Client" -ForegroundColor Red
  exit 1
}

# Test SSH connection
$sshCmd = "ssh $sshFlags -o ConnectTimeout=5 -o BatchMode=yes $VpsUser@$VpsHost"
$sshTest = Invoke-Expression "$sshCmd 'echo OK'" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Connexion SSH échouée vers $VpsUser@$VpsHost" -ForegroundColor Red
  Write-Host "   Vérifiez votre clé : $SshKey" -ForegroundColor Yellow
  Write-Host "   Ou testez : ssh -i ~/.ssh/ma_cle $VpsUser@$VpsHost" -ForegroundColor Yellow
  Write-Host "   $sshTest" -ForegroundColor DarkGray
  exit 1
}
Write-Host "   ✅ SSH $VpsUser@$VpsHost OK"

# Check Node.js locally
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "❌ Node.js introuvable localement" -ForegroundColor Red
  exit 1
}
Write-Host "   ✅ Node $(node -v)"

if ($DryRun) {
  Write-Host "   🔍 DRY RUN — aucune modification ne sera faite" -ForegroundColor Yellow
}

# ── 2. Build frontend ─────────────────────────────────────
if (-not $SkipBuild) {
  Write-Host "── 2/6 Build frontend ───────────────────────────────────" -ForegroundColor Cyan
  Set-Location $AppDir
  Write-Host "   npm run build..."
  npm run build 2>&1 | Select-Object -Last 5
  if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build échoué" -ForegroundColor Red
    exit 1
  }
  Write-Host "   ✅ Build OK → dist/"
}
else {
  Write-Host "── 2/6 Build frontend ⏭️  (--SkipBuild)" -ForegroundColor DarkGray
}

# ── 3. Sync fichiers vers le VPS ──────────────────────────
Write-Host "── 3/6 Sync dist/ → VPS ─────────────────────────────────" -ForegroundColor Cyan

$distDir = "$AppDir\dist"
if (-not (Test-Path $distDir)) {
  Write-Host "❌ $distDir introuvable — lancez 'npm run build' d'abord" -ForegroundColor Red
  exit 1
}

if ($DryRun) {
  Write-Host "   [DRY RUN] rsync -avz --delete dist/ ${VpsUser}@${VpsHost}:${VpsPath}/dist/" -ForegroundColor DarkGray
}
else {
  # Use SCP if rsync is not available on Windows
  $rsyncAvailable = Get-Command rsync -ErrorAction SilentlyContinue
  if ($rsyncAvailable) {
    Write-Host "   rsync dist/ → $VpsPath/dist/ ..."
    rsync -avz -e "ssh $sshFlags" --delete "$distDir/" "$VpsUser@$VpsHost`:$VpsPath/dist/" 2>&1 | Select-Object -Last 3
  }
  else {
    Write-Host "   scp dist/ → $VpsPath/dist/ ..."
    # Remove old dist on server first
    Invoke-Expression "ssh $sshFlags $VpsUser@$VpsHost 'rm -rf $VpsPath/dist/*'"
    # Upload new files
    Invoke-Expression "scp $scpFlags -r '$distDir\*' $VpsUser@$VpsHost`:$VpsPath/dist/" 2>&1 | Select-Object -Last 3
  }
  Write-Host "   ✅ dist/ synchronisé"
}

# ── 4. Sync scripts serveur ───────────────────────────────
Write-Host "── 4/6 Sync server/ → VPS ───────────────────────────────" -ForegroundColor Cyan

$serverDir = "$AppDir\server"
if (Test-Path $serverDir) {
  if ($DryRun) {
    Write-Host "   [DRY RUN] scp -r server/* ${VpsUser}@${VpsHost}:${VpsPath}/server/" -ForegroundColor DarkGray
  }
  else {
    if ($rsyncAvailable) {
      rsync -avz -e "ssh $sshFlags" --exclude 'node_modules' "$serverDir/" "$VpsUser@$VpsHost`:$VpsPath/server/" 2>&1 | Select-Object -Last 3
    }
    else {
      Invoke-Expression "scp $scpFlags -r '$serverDir\*' $VpsUser@$VpsHost`:$VpsPath/server/" 2>&1 | Select-Object -Last 3
    }
    Write-Host "   ✅ server/ synchronisé"
  }
}
else {
  Write-Host "   ⚠️  $serverDir absent — skip" -ForegroundColor Yellow
}

# ── 5. Sync scripts de déploiement ────────────────────────
Write-Host "── 5/6 Sync scripts → VPS ───────────────────────────────" -ForegroundColor Cyan

$deployScript = "$ScriptDir\deploy-vps.sh"
if (Test-Path $deployScript) {
  if ($DryRun) {
    Write-Host "   [DRY RUN] scp deploy-vps.sh → $VpsPath/scripts/" -ForegroundColor DarkGray
  }
  else {
    Invoke-Expression "ssh $sshFlags $VpsUser@$VpsHost 'mkdir -p $VpsPath/scripts'"
    Invoke-Expression "scp $scpFlags $deployScript $VpsUser@$VpsHost`:$VpsPath/scripts/deploy-vps.sh"
    Invoke-Expression "ssh $sshFlags $VpsUser@$VpsHost 'chmod +x $VpsPath/scripts/deploy-vps.sh'"
    Write-Host "   ✅ deploy-vps.sh envoyé"
  }
}

# ── 6. Exécution côté VPS ─────────────────────────────────
Write-Host "── 6/6 Exécution VPS ────────────────────────────────────" -ForegroundColor Cyan

if ($DryRun) {
  Write-Host "   [DRY RUN] ssh $VpsUser@$VpsHost 'bash $VpsPath/scripts/deploy-vps.sh'" -ForegroundColor DarkGray
}
else {
  Write-Host "   Lancement de deploy-vps.sh sur le VPS..."
  Write-Host ""
  Invoke-Expression "ssh $sshFlags -t $VpsUser@$VpsHost 'bash $VpsPath/scripts/deploy-vps.sh'"
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Déploiement terminé                                 ║" -ForegroundColor Green
Write-Host "║                                                        ║" -ForegroundColor Green
Write-Host "║  Production : https://miamexpress.cm                    ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
