# Deploy GCE Backend ISO Route - PowerShell Script
# Deploys the updated epc-deployment route to the GCE server

$GCE_SERVER = "136.112.111.167"
$GCE_USER = "root"
$REPO_DIR = "/root/lte-pci-mapper"
$BACKEND_DIR = "/opt/gce-backend"

Write-Host "🚀 Deploying GCE Backend ISO Route..." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Target: ${GCE_USER}@${GCE_SERVER}" -ForegroundColor Cyan
Write-Host "Backend: ${BACKEND_DIR}" -ForegroundColor Cyan
Write-Host ""

# SSH command to deploy
$deployScript = @"
set -e

REPO_DIR="$REPO_DIR"
BACKEND_DIR="$BACKEND_DIR"

echo "📥 Pulling latest code from GitHub..."
cd `$REPO_DIR
git pull origin main || {
    echo "⚠️  Git pull failed, trying to fetch and reset..."
    git fetch origin main
    git reset --hard origin/main
}

echo "✅ Code updated"
echo ""

echo "📋 Copying updated backend files..."
mkdir -p `$BACKEND_DIR/routes
mkdir -p `$BACKEND_DIR/logs

if [ -f "`$REPO_DIR/gce-backend/routes/epc-deployment.js" ]; then
    cp "`$REPO_DIR/gce-backend/routes/epc-deployment.js" "`$BACKEND_DIR/routes/"
    echo "✅ Copied epc-deployment.js"
else
    echo "❌ epc-deployment.js not found in repo"
    exit 1
fi

if [ -f "`$REPO_DIR/gce-backend/server.js" ]; then
    cp "`$REPO_DIR/gce-backend/server.js" "`$BACKEND_DIR/"
    echo "✅ Copied server.js"
fi

echo ""

# Restart service
if systemctl list-units --type=service --all | grep -q "gce-backend.service"; then
    echo "🔄 Restarting gce-backend.service..."
    systemctl daemon-reload
    systemctl restart gce-backend.service
    sleep 3
    
    if systemctl is-active --quiet gce-backend.service; then
        echo "✅ gce-backend.service restarted successfully"
    else
        echo "⚠️  Service issues, checking logs..."
        journalctl -u gce-backend.service -n 20 --no-pager
    fi
elif pm2 list | grep -q "epc-api\|gce-backend"; then
    echo "🔄 Restarting PM2 service..."
    pm2 restart epc-api --update-env || pm2 restart gce-backend --update-env
    pm2 save
    echo "✅ PM2 service restarted"
else
    echo "⚠️  No service found. Starting manually..."
    cd `$BACKEND_DIR
    nohup PORT=3002 node server.js > logs/server.log 2>&1 &
    echo "✅ Started manually on port 3002"
fi

echo ""
echo "🧪 Testing endpoint..."
sleep 3

curl -s http://localhost:3002/health && echo "✅ Health check passed" || echo "⚠️  Health check failed"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Service Status:"
systemctl status gce-backend.service --no-pager -l | head -5 || pm2 status | head -10
"@

Write-Host "📤 Executing deployment on GCE server..." -ForegroundColor Yellow
ssh ${GCE_USER}@${GCE_SERVER} $deployScript

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Test the endpoint:" -ForegroundColor Cyan
Write-Host "  curl -X POST http://${GCE_SERVER}:3002/api/deploy/generate-epc-iso -H 'Content-Type: application/json' -H 'X-Tenant-ID: test' -d '{`"siteName`":`"Test Site`"}'"

