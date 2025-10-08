# Fix Firebase App Hosting Traffic Routing (PowerShell)
# Forces traffic to the latest successful build

Write-Host "🔄 Fixing traffic routing for Firebase App Hosting..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Current Issue:" -ForegroundColor Yellow
Write-Host "  - New builds are deploying successfully"
Write-Host "  - But traffic is stuck on old failing revision"
Write-Host ""

$PROJECT_ID = "lte-pci-mapper-65450042-bbf71"
$SERVICE_NAME = "pci-mapper"
$REGION = "us-central1"

Write-Host "📊 Getting latest revision..." -ForegroundColor Cyan

# Get the latest ready revision
$LATEST_REVISION = gcloud run services describe $SERVICE_NAME `
  --region=$REGION `
  --project=$PROJECT_ID `
  --format='value(status.latestReadyRevisionName)'

Write-Host "✅ Latest ready revision: $LATEST_REVISION" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Routing 100% traffic to latest revision..." -ForegroundColor Cyan

# Update traffic to latest revision
gcloud run services update-traffic $SERVICE_NAME `
  --region=$REGION `
  --project=$PROJECT_ID `
  --to-latest

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "✅ Traffic successfully routed to latest revision!" -ForegroundColor Green
  Write-Host ""
  Write-Host "🌐 Your app should now be accessible at:" -ForegroundColor Cyan
  Write-Host "   https://pci-mapper-nfomthzoza-uc.a.run.app" -ForegroundColor White
  Write-Host ""
  Write-Host "🔍 Verify by checking for:" -ForegroundColor Cyan
  Write-Host "   - No more 'Cannot find module /workspace/index.js' errors"
  Write-Host "   - No more 'Cannot call goto on server' errors"
  Write-Host "   - No more 'Firebase auth/invalid-api-key' errors"
} else {
  Write-Host ""
  Write-Host "❌ Failed to update traffic routing" -ForegroundColor Red
  Write-Host ""
  Write-Host "Manual fix:" -ForegroundColor Yellow
  Write-Host "1. Go to: https://console.cloud.google.com/run/detail/us-central1/pci-mapper"
  Write-Host "2. Click 'MANAGE TRAFFIC'"
  Write-Host "3. Route 100% traffic to: $LATEST_REVISION"
  Write-Host "4. Click 'SAVE'"
}

