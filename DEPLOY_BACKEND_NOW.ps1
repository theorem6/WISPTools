# PowerShell Script to Deploy Backend Dependency Updates to GCE
# This script will SSH to GCE server, pull latest code, install dependencies, and restart services

$ErrorActionPreference = "Stop"

Write-Host "🚀 Backend Dependency Updates Deployment" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$GCE_INSTANCE = "acs-hss-server"
$GCE_ZONE = "us-central1-a"
$REPO_DIR = "/opt/lte-pci-mapper"  # Primary location
$REPO_DIR_ALT = "/root/lte-pci-mapper"  # Alternative location

Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "  Instance: $GCE_INSTANCE"
Write-Host "  Zone: $GCE_ZONE"
Write-Host ""

# Check if gcloud is installed
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: gcloud CLI not found" -ForegroundColor Red
    Write-Host "   Please install Google Cloud SDK first" -ForegroundColor Yellow
    Write-Host "   Download from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ gcloud CLI found" -ForegroundColor Green
Write-Host ""

# Check authentication
Write-Host "🔐 Checking authentication..." -ForegroundColor Yellow
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authCheck -or $authCheck -eq "") {
    Write-Host "❌ Error: Not authenticated with gcloud" -ForegroundColor Red
    Write-Host "   Please run: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Authenticated as: $authCheck" -ForegroundColor Green
Write-Host ""

# Deployment commands to run on server
$deploymentCommands = @"
set -e

echo "🚀 Starting backend dependency updates deployment..."
echo ""

# Determine repo directory
if [ -d "$REPO_DIR/.git" ]; then
    REPO_DIR="$REPO_DIR"
elif [ -d "$REPO_DIR_ALT/.git" ]; then
    REPO_DIR="$REPO_DIR_ALT"
else
    echo "❌ Error: Repository not found at $REPO_DIR or $REPO_DIR_ALT"
    echo "   Please check repository location"
    exit 1
fi

echo "📁 Using repository directory: \$REPO_DIR"
echo ""

# Navigate to repo
cd "\$REPO_DIR"

# Pull latest changes
echo "📥 Pulling latest code from GitHub..."
git fetch origin main
git pull origin main --no-edit || {
    echo "⚠️  Pull failed, resetting to GitHub state..."
    git fetch origin main
    git reset --hard origin/main
}

echo "✅ Code updated from GitHub"
echo ""

# Check latest commit
echo "📝 Latest commit:"
git log -1 --oneline
echo ""

# Navigate to backend services
cd "\$REPO_DIR/backend-services"

# Install updated dependencies
echo "📦 Installing updated npm dependencies..."
npm install --production

echo ""
echo "✅ Dependencies installed"
echo ""

# Restart PM2 services
echo "🔄 Restarting PM2 services..."

# Restart main-api if exists
if pm2 list | grep -q "main-api"; then
    echo "  → Restarting main-api..."
    pm2 restart main-api --update-env
fi

# Restart epc-api if exists
if pm2 list | grep -q "epc-api"; then
    echo "  → Restarting epc-api..."
    pm2 restart epc-api --update-env
fi

# Restart hss-api if exists
if pm2 list | grep -q "hss-api"; then
    echo "  → Restarting hss-api..."
    pm2 restart hss-api --update-env
fi

# Or restart all
echo "  → Restarting all PM2 services..."
pm2 restart all --update-env || true

echo ""
echo "✅ Services restarted"
echo ""

# Save PM2 process list
pm2 save

echo ""
echo "📊 Service Status:"
pm2 status

echo ""
echo "✅ Backend deployment complete!"
echo ""

# Verify MongoDB Atlas connection
echo "🔍 Verifying MongoDB Atlas connection..."
sleep 2
pm2 logs main-api --lines 5 --nostream | grep -i "mongodb\|connected\|atlas" || echo "   (Check logs for connection status)"

echo ""
echo "✅ Deployment verification complete"
"@

Write-Host "📤 Connecting to GCE server and deploying..." -ForegroundColor Yellow
Write-Host ""

# Execute deployment commands on server
try {
    # Escape the commands for PowerShell
    $escapedCommands = $deploymentCommands -replace '`', '``' -replace '"', '`"' -replace '\$', '`$'
    
    # Run commands via SSH
    gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command="$deploymentCommands" --tunnel-through-iap
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Backend deployment completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🧪 Verify deployment:" -ForegroundColor Cyan
        Write-Host "  1. Check API health: https://hss.wisptools.io/api/health"
        Write-Host "  2. Check PM2 status on server"
        Write-Host "  3. Monitor logs for any errors"
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Deployment had issues. Exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "   Please check the output above for errors" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Deployment failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 Manual deployment instructions:" -ForegroundColor Yellow
    Write-Host "  1. SSH to server: gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --tunnel-through-iap"
    Write-Host "  2. Run: cd /opt/lte-pci-mapper"
    Write-Host "  3. Run: git pull origin main"
    Write-Host "  4. Run: cd backend-services && npm install --production"
    Write-Host "  5. Run: pm2 restart all"
    exit 1
}

Write-Host ""
Write-Host "🎉 All done!" -ForegroundColor Green

