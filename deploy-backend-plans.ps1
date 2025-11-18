# PowerShell Script to Deploy Backend Plans Route
# Deploys plans.js and related services to GCE server

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying Backend Plans Route to GCE" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$GCE_INSTANCE = "acs-hss-server"
$GCE_ZONE = "us-central1-a"

Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "  Instance: $GCE_INSTANCE"
Write-Host "  Zone: $GCE_ZONE"
Write-Host ""

# Deploy command (bash syntax for remote server)
$deployCommand = 'cd /opt/lte-pci-mapper && git pull origin main && cd backend-services && pm2 restart main-api && sleep 3 && pm2 logs main-api --lines 30 --nostream'

Write-Host "📤 Deploying to GCE server..." -ForegroundColor Yellow

try {
    gcloud compute ssh $GCE_INSTANCE `
        --zone=$GCE_ZONE `
        --tunnel-through-iap `
        --command=$deployCommand
    
    Write-Host ""
    Write-Host "✅ Deployment complete!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "❌ Deployment failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Try running manually:" -ForegroundColor Yellow
    Write-Host "gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --tunnel-through-iap --command=`"cd /opt/lte-pci-mapper && git pull origin main && cd backend-services && pm2 restart main-api`""
    exit 1
}

