# Deploy EPC Check-in Fixes to Backend Server
# This script deploys the backend fixes for EPC command issues

param(
    [string]$InstanceName = "acs-hss-server",
    [string]$Zone = "us-central1-a",
    [string]$Project = "lte-pci-mapper-65450042-bbf71"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying EPC Check-in Backend Fixes..." -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is available
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: gcloud CLI not found" -ForegroundColor Red
    Write-Host "Please install Google Cloud SDK or use manual deployment" -ForegroundColor Yellow
    exit 1
}

# Check if authenticated
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authCheck -or $authCheck -eq "") {
    Write-Host "❌ Error: Not authenticated with gcloud" -ForegroundColor Red
    Write-Host "Please run: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Authenticated as: $authCheck" -ForegroundColor Green
Write-Host ""

# Files to deploy
$files = @(
    @{Local="backend-services/routes/epc-checkin.js"; Remote="/opt/lte-pci-mapper/backend-services/routes/epc-checkin.js"},
    @{Local="backend-services/services/epc-checkin-service.js"; Remote="/opt/lte-pci-mapper/backend-services/services/epc-checkin-service.js"},
    @{Local="backend-services/utils/epc-auto-update.js"; Remote="/opt/lte-pci-mapper/backend-services/utils/epc-auto-update.js"},
    @{Local="backend-services/scripts/check-queued-commands.js"; Remote="/opt/lte-pci-mapper/backend-services/scripts/check-queued-commands.js"}
)

# Verify files exist locally
Write-Host "📋 Verifying files..." -ForegroundColor Yellow
$missingFiles = @()
foreach ($file in $files) {
    if (-not (Test-Path $file.Local)) {
        $missingFiles += $file.Local
        Write-Host "  ❌ Missing: $($file.Local)" -ForegroundColor Red
    } else {
        Write-Host "  ✅ Found: $($file.Local)" -ForegroundColor Green
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Some files are missing. Please ensure you're running from the project root." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Create backup and deploy script
$deployScript = @"
set -e
REPO_DIR="/opt/lte-pci-mapper"
BACKUP_DIR="`$REPO_DIR/backend-services/backups/backup-`$(date +%Y%m%d-%H%M%S)"
mkdir -p `$BACKUP_DIR

echo "📦 Backing up current files..."
cp `$REPO_DIR/backend-services/routes/epc-checkin.js `$BACKUP_DIR/epc-checkin.js.backup 2>/dev/null || true
cp `$REPO_DIR/backend-services/services/epc-checkin-service.js `$BACKUP_DIR/epc-checkin-service.js.backup 2>/dev/null || true
cp `$REPO_DIR/backend-services/utils/epc-auto-update.js `$BACKUP_DIR/epc-auto-update.js.backup 2>/dev/null || true
echo "✅ Backups created in `$BACKUP_DIR"

echo ""
echo "📥 Deploying updated files..."
"@

# Add file copy commands
foreach ($file in $files) {
    $filename = Split-Path $file.Local -Leaf
    $deployScript += @"

# Deploy $filename
if [ -f `$REPO_DIR/$($file.Local) ]; then
    echo "  → Updating $filename..."
    # File will be copied via SCP below
else
    echo "  → Creating $filename..."
fi
"@
}

$deployScript += @"

echo ""
echo "🔍 Verifying file syntax..."
node -c `$REPO_DIR/backend-services/routes/epc-checkin.js || { echo "❌ Syntax error in epc-checkin.js"; exit 1; }
node -c `$REPO_DIR/backend-services/services/epc-checkin-service.js || { echo "❌ Syntax error in epc-checkin-service.js"; exit 1; }
node -c `$REPO_DIR/backend-services/utils/epc-auto-update.js || { echo "❌ Syntax error in epc-auto-update.js"; exit 1; }
node -c `$REPO_DIR/backend-services/scripts/check-queued-commands.js || { echo "❌ Syntax error in check-queued-commands.js"; exit 1; }

chmod +x `$REPO_DIR/backend-services/scripts/check-queued-commands.js

echo "✅ All files verified"
echo ""
echo "🔄 Restarting backend services..."

# Restart services using PM2
if command -v pm2 >/dev/null 2>&1; then
    # Restart EPC API (port 3002) - this handles check-in endpoints
    if pm2 list | grep -q "epc-api"; then
        echo "  → Restarting epc-api..."
        pm2 restart epc-api --update-env
    fi
    
    # Restart HSS API (port 3001) if it exists
    if pm2 list | grep -q "hss-api"; then
        echo "  → Restarting hss-api..."
        pm2 restart hss-api --update-env
    fi
    
    # Restart Main API (port 3000) if it exists
    if pm2 list | grep -q "main-api"; then
        echo "  → Restarting main-api..."
        pm2 restart main-api --update-env
    fi
    
    echo ""
    echo "📊 Service status:"
    pm2 status
else
    echo "⚠️  PM2 not found, trying systemctl..."
    if systemctl is-active --quiet lte-pci-mapper-backend 2>/dev/null; then
        systemctl restart lte-pci-mapper-backend
        systemctl status lte-pci-mapper-backend --no-pager -l | head -n 15
    else
        echo "⚠️  No known service manager found. Please restart services manually."
    fi
fi

echo ""
echo "✅ Deployment complete!"
"@

# Copy files to server
Write-Host "📤 Copying files to server..." -ForegroundColor Yellow
foreach ($file in $files) {
    Write-Host "  → Copying $($file.Local)..." -ForegroundColor Cyan
    $result = gcloud compute scp $file.Local "$($InstanceName):$($file.Remote)" --zone=$Zone --tunnel-through-iap 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to copy $($file.Local)" -ForegroundColor Red
        Write-Host $result
        exit 1
    }
}

Write-Host "✅ All files copied" -ForegroundColor Green
Write-Host ""

# Run deployment script on server
Write-Host "🔧 Running deployment script on server..." -ForegroundColor Yellow
$result = gcloud compute ssh $InstanceName --zone=$Zone --tunnel-through-iap --command=$deployScript 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    Write-Host $result
    exit 1
}

Write-Host $result

# Health check
Write-Host ""
Write-Host "🏥 Checking service health..." -ForegroundColor Yellow
$health = gcloud compute ssh $InstanceName --zone=$Zone --tunnel-through-iap --command="curl -s http://localhost:3002/health 2>/dev/null || curl -s http://localhost:3001/health 2>/dev/null || curl -s http://localhost:3000/health 2>/dev/null || echo 'FAILED'"

if ($health -match "healthy" -or $health -match "ok" -or $health -match "running") {
    Write-Host "✅ Service is healthy!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Health check response: $health" -ForegroundColor Yellow
    Write-Host "⚠️  Service may still be starting. Please check manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✨ Backend deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Deploy agent script on EPC device (you'll handle this)" -ForegroundColor White
Write-Host "  2. Monitor backend logs: pm2 logs epc-api" -ForegroundColor White
Write-Host "  3. Check queued commands: node backend-services/scripts/check-queued-commands.js EPC-CB4C5042" -ForegroundColor White
Write-Host ""

