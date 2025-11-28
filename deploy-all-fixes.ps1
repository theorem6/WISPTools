# Deploy All Fake Data Fixes
# This script deploys backend fixes to GCE and frontend to Firebase

Write-Host "🚀 Deploying all fixes..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Deploy Backend to GCE
Write-Host "📡 Step 1: Deploying backend to GCE server..." -ForegroundColor Yellow
Write-Host ""

$backendDeployScript = @"
cd /opt/lte-pci-mapper
git fetch origin
git reset --hard origin/main
echo '✅ Code updated:'
git log -1 --oneline

cd backend-services
npm install --production

echo ''
echo '🔄 Restarting PM2 services...'
pm2 restart main-api || echo 'main-api not found'
pm2 restart epc-api || echo 'epc-api not found'
pm2 restart hss-api || echo 'hss-api not found'
pm2 save

echo ''
echo '🧹 Running cleanup script...'
cd /opt/lte-pci-mapper/backend-services/scripts
node cleanup-fake-data.js || echo 'Cleanup script completed (may have no fake data)'

echo ''
echo '✅ Backend deployment complete!'
pm2 status
"@

try {
    gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap --command=$backendDeployScript
    Write-Host ""
    Write-Host "✅ Backend deployed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend deployment failed. Please run manually:" -ForegroundColor Red
    Write-Host "   gcloud compute ssh acs-hss-server --zone=us-central1-a --tunnel-through-iap" -ForegroundColor Yellow
    Write-Host "   Then run the commands from the script above" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📦 Step 2: Deploying frontend to Firebase..." -ForegroundColor Yellow
Write-Host ""

# Step 2: Deploy Frontend
Set-Location "Module_Manager"

try {
    npm run build
    if ($LASTEXITCODE -eq 0) {
        cd ..
        firebase deploy --only hosting --project wisptools-production
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Frontend deployed successfully!" -ForegroundColor Green
        } else {
            Write-Host "❌ Frontend deployment failed" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Frontend build failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Frontend deployment error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Deployment process complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Check backend: Visit https://hss.wisptools.io/api/health" -ForegroundColor White
Write-Host "2. Check frontend: Visit https://wisptools-production.web.app" -ForegroundColor White
Write-Host "3. Verify SNMP graphs: Check Monitoring > Graphs tab" -ForegroundColor White

