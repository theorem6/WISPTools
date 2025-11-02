# Automated Backend Deployment Script for PowerShell
# Deploys backend changes to GCE and restarts services automatically

param(
    [string]$InstanceName = "acs-hss-server",
    [string]$Zone = "us-central1-a",
    [string]$Project = "lte-pci-mapper-65450042-bbf71"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting automated backend deployment..." -ForegroundColor Cyan

# Check if gcloud is authenticated
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authCheck -or $authCheck -eq "") {
    Write-Host "❌ Error: Not authenticated with gcloud" -ForegroundColor Red
    Write-Host "Please run: gcloud auth login"
    exit 1
}

$tempDir = "/tmp/backend-deploy-$(Get-Random)"

Write-Host "📦 Preparing deployment..." -ForegroundColor Yellow
gcloud compute ssh $InstanceName --zone=$Zone --command="mkdir -p $tempDir"

# Files to deploy
$files = @(
    "backend-services/routes/customers.js",
    "backend-services/models/customer.js",
    "backend-services/routes/work-orders.js",
    "backend-services/models/work-order.js",
    "backend-services/routes/plans.js",
    "backend-services/models/plan.js"
)

# Copy files to server
Write-Host "📤 Copying files to server..." -ForegroundColor Yellow
foreach ($file in $files) {
    if (Test-Path $file) {
        $filename = Split-Path $file -Leaf
        Write-Host "  → Copying $filename"
        gcloud compute scp $file "$($InstanceName):$tempDir/$filename" --zone=$Zone
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Failed to copy $file" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⚠️  File not found: $file (skipping)" -ForegroundColor Yellow
    }
}

# Deploy and restart
Write-Host "🔧 Deploying to /opt/hss-api..." -ForegroundColor Yellow

$deployScript = @"
set -e
BACKUP_DIR="/opt/hss-api/routes/backups/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p `$BACKUP_DIR
mkdir -p /opt/hss-api/routes
mkdir -p /opt/hss-api/models

# Backup and copy customers route
if [ -f /opt/hss-api/customer-api.js ]; then
    cp /opt/hss-api/customer-api.js `$BACKUP_DIR/customer-api.js.backup 2>/dev/null || true
fi
if [ -f $tempDir/customers.js ]; then
    cp $tempDir/customers.js /opt/hss-api/customer-api.js
    sed -i 's|../models/customer|./customer-schema|g' /opt/hss-api/customer-api.js
    chown root:root /opt/hss-api/customer-api.js
    node --check /opt/hss-api/customer-api.js || exit 1
fi

# Copy models
if [ -f $tempDir/customer.js ]; then
    if [ -f /opt/hss-api/customer-schema.js ]; then
        cp /opt/hss-api/customer-schema.js `$BACKUP_DIR/customer-schema.js.backup 2>/dev/null || true
    fi
    cp $tempDir/customer.js /opt/hss-api/customer-schema.js
    chown root:root /opt/hss-api/customer-schema.js
    node --check /opt/hss-api/customer-schema.js || exit 1
fi

# Copy other routes
if [ -f $tempDir/work-orders.js ]; then
    if [ -f /opt/hss-api/routes/work-orders.js ]; then
        cp /opt/hss-api/routes/work-orders.js `$BACKUP_DIR/work-orders.js.backup 2>/dev/null || true
    fi
    cp $tempDir/work-orders.js /opt/hss-api/routes/work-orders.js
    chown root:root /opt/hss-api/routes/work-orders.js
    node --check /opt/hss-api/routes/work-orders.js || exit 1
fi

if [ -f $tempDir/plans.js ]; then
    if [ -f /opt/hss-api/routes/plans.js ]; then
        cp /opt/hss-api/routes/plans.js `$BACKUP_DIR/plans.js.backup 2>/dev/null || true
    fi
    cp $tempDir/plans.js /opt/hss-api/routes/plans.js
    chown root:root /opt/hss-api/routes/plans.js
    node --check /opt/hss-api/routes/plans.js || exit 1
fi

rm -rf $tempDir
echo '✅ Files deployed successfully'
"@

gcloud compute ssh $InstanceName --zone=$Zone --command=$deployScript
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

# Restart service
Write-Host "🔄 Restarting hss-api service..." -ForegroundColor Yellow
gcloud compute ssh $InstanceName --zone=$Zone --command="sudo systemctl daemon-reload && sudo systemctl restart hss-api && sleep 3 && sudo systemctl status hss-api --no-pager -l | head -n 15"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Service restart failed" -ForegroundColor Red
    exit 1
}

# Health check
Write-Host "🏥 Checking service health..." -ForegroundColor Yellow
$health = gcloud compute ssh $InstanceName --zone=$Zone --command="curl -s http://localhost:3001/health 2>/dev/null || curl -s http://localhost:3000/health 2>/dev/null || echo 'FAILED'"

if ($health -match "healthy") {
    Write-Host "✅ Service is healthy!" -ForegroundColor Green
    Write-Host $health
} else {
    Write-Host "⚠️  Service health check returned:" -ForegroundColor Yellow
    Write-Host $health
    Write-Host "⚠️  Service may still be starting up. Please check manually." -ForegroundColor Yellow
}

Write-Host "✨ Deployment complete!" -ForegroundColor Green

