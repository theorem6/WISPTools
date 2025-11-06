# PowerShell Script to Deploy Backend Routes
# Deploys updated routes to GCE backend server

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying Backend Routes to GCE" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$GCE_INSTANCE = "acs-hss-server"
$GCE_ZONE = "us-central1-a"
$GCE_PROJECT = "lte-pci-mapper-65450042-bbf71"
$GCE_IP = "136.112.111.167"
$REMOTE_DIR = "/opt/gce-backend"

Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "  Instance: $GCE_INSTANCE"
Write-Host "  Zone: $GCE_ZONE"
Write-Host "  IP: $GCE_IP"
Write-Host "  Remote Dir: $REMOTE_DIR"
Write-Host ""

# Check if gcloud is installed
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ gcloud CLI not found. Please install it first." -ForegroundColor Red
    Write-Host "   Download from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ gcloud CLI found" -ForegroundColor Green
Write-Host ""

# Deploy script to run on remote server (bash script as string)
$deployScript = 'set -e
echo "📥 Pulling latest code from GitHub..."
cd /root/lte-pci-mapper || cd /home/david/lte-pci-mapper || { echo "❌ Repo directory not found"; exit 1; }
git pull origin main

echo "✅ Code pulled successfully"
echo ""

echo "📋 Copying updated routes..."
mkdir -p /opt/gce-backend/routes/users
mkdir -p /opt/gce-backend/routes/backups

# Backup existing file
if [ -f /opt/gce-backend/routes/users/role-auth-middleware.js ]; then
    cp /opt/gce-backend/routes/users/role-auth-middleware.js /opt/gce-backend/routes/backups/role-auth-middleware.js.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up existing file"
fi

# Copy updated file
if [ -f backend-services/routes/users/role-auth-middleware.js ]; then
    cp backend-services/routes/users/role-auth-middleware.js /opt/gce-backend/routes/users/
    echo "✅ Copied role-auth-middleware.js"
else
    echo "❌ File not found: backend-services/routes/users/role-auth-middleware.js"
    exit 1
fi

echo ""
echo "🔄 Restarting PM2 service..."
pm2 restart main-api || { echo "⚠️  PM2 restart failed, trying to reload..."; pm2 reload main-api; }

sleep 3

echo ""
echo "🏥 Checking service health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
    echo "✅ Service is healthy (HTTP $HEALTH)"
else
    echo "⚠️  Health check returned HTTP $HEALTH"
    echo "Checking PM2 status..."
    pm2 status main-api
fi

echo ""
echo "✅ Deployment complete!"'

Write-Host "📤 Deploying to GCE server..." -ForegroundColor Yellow
Write-Host ""

# Execute deployment script on remote server
try {
    gcloud compute ssh $GCE_INSTANCE `
        --zone=$GCE_ZONE `
        --project=$GCE_PROJECT `
        --command=$deployScript
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Backend routes deployed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🧪 Verify deployment:" -ForegroundColor Cyan
        Write-Host "  curl http://$GCE_IP:3001/health" -ForegroundColor Gray
    } else {
        Write-Host ""
        Write-Host "❌ Deployment failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Deployment error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Alternative: SSH manually and run:" -ForegroundColor Yellow
    Write-Host "  ssh root@$GCE_IP" -ForegroundColor Gray
    Write-Host "  cd /root/lte-pci-mapper" -ForegroundColor Gray
    Write-Host "  git pull origin main" -ForegroundColor Gray
    Write-Host "  cp backend-services/routes/users/role-auth-middleware.js /opt/gce-backend/routes/users/" -ForegroundColor Gray
    Write-Host "  pm2 restart main-api" -ForegroundColor Gray
    exit 1
}

