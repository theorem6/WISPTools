# Script to check and fix backend service on GCE server
# Run this after authenticating with: gcloud auth login

$ErrorActionPreference = "Stop"

Write-Host "🔧 Backend Service Fix Script" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

$InstanceName = "acs-hss-server"
$Zone = "us-central1-a"

# Check authentication
Write-Host "Checking gcloud authentication..." -ForegroundColor Yellow
$authCheck = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authCheck -or $authCheck -eq "") {
    Write-Host "❌ Error: Not authenticated with gcloud" -ForegroundColor Red
    Write-Host "Please run: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Authenticated as: $authCheck" -ForegroundColor Green
Write-Host ""

# Step 1: Check PM2 status
Write-Host "Step 1: Checking PM2 service status..." -ForegroundColor Cyan
$pm2Status = gcloud compute ssh $InstanceName --zone=$Zone --command="pm2 status" --tunnel-through-iap 2>&1
Write-Host $pm2Status
Write-Host ""

# Step 2: Check if main-api is running
Write-Host "Step 2: Checking main-api service..." -ForegroundColor Cyan
$mainApiCheck = gcloud compute ssh $InstanceName --zone=$Zone --command="pm2 list | grep main-api || echo 'main-api not found'" --tunnel-through-iap 2>&1
Write-Host $mainApiCheck
Write-Host ""

# Step 3: Check backend health
Write-Host "Step 3: Testing backend health endpoint..." -ForegroundColor Cyan
$healthCheck = gcloud compute ssh $InstanceName --zone=$Zone --command="curl -s http://localhost:3001/health || echo 'Health check failed'" --tunnel-through-iap 2>&1
Write-Host $healthCheck
Write-Host ""

# Step 4: Check recent logs for errors
Write-Host "Step 4: Checking recent logs for errors..." -ForegroundColor Cyan
$logs = gcloud compute ssh $InstanceName --zone=$Zone --command="pm2 logs main-api --lines 20 --nostream 2>&1 | tail -20" --tunnel-through-iap 2>&1
Write-Host $logs
Write-Host ""

# Step 5: Restart the service
Write-Host "Step 5: Restarting main-api service..." -ForegroundColor Cyan
$restart = gcloud compute ssh $InstanceName --zone=$Zone --command="cd /opt/lte-pci-mapper/backend-services 2>/dev/null || cd /root/lte-pci-mapper/backend-services 2>/dev/null || cd ~/lte-pci-mapper/backend-services; pm2 restart main-api && sleep 3 && pm2 status" --tunnel-through-iap 2>&1
Write-Host $restart
Write-Host ""

# Step 6: Verify health after restart
Write-Host "Step 6: Verifying service is healthy..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
$healthAfter = gcloud compute ssh $InstanceName --zone=$Zone --command="curl -s http://localhost:3001/health" --tunnel-through-iap 2>&1
Write-Host $healthAfter
Write-Host ""

if ($healthAfter -match "healthy") {
    Write-Host "✅ Backend service is now healthy!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Test from Android app now." -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Service may still be starting. Check logs:" -ForegroundColor Yellow
    Write-Host "   gcloud compute ssh $InstanceName --zone=$Zone --tunnel-through-iap" -ForegroundColor White
    Write-Host "   pm2 logs main-api" -ForegroundColor White
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
