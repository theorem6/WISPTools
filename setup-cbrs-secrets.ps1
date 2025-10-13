# Setup CBRS SAS API Secrets for Firebase (PowerShell)
# This configures the platform-level shared API credentials

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "CBRS SAS API Secrets Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_ID = "lte-pci-mapper-65450042-bbf71"

Write-Host "Setting up Firebase secrets for Google SAS..." -ForegroundColor Yellow

# Google SAS OAuth Client Secret
$clientSecret = "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"
$clientSecret | firebase functions:secrets:set GOOGLE_SAS_CLIENT_SECRET --project=$PROJECT_ID --data-file=-

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Google SAS Client Secret configured" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to configure Google SAS Client Secret" -ForegroundColor Red
    Write-Host "You may need to run: firebase login" -ForegroundColor Yellow
}

Write-Host ""

# Instructions for Federated Wireless (when available)
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "To configure Federated Wireless:" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "When you receive your Federated Wireless API key, run:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  'YOUR_FW_API_KEY' | firebase functions:secrets:set FEDERATED_WIRELESS_API_KEY --project=$PROJECT_ID --data-file=-" -ForegroundColor White
Write-Host ""

# MongoDB URI (if not already set)
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "MongoDB URI:" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If MongoDB is not yet configured, run:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  'YOUR_MONGODB_URI' | firebase functions:secrets:set MONGODB_URI --project=$PROJECT_ID --data-file=-" -ForegroundColor White
Write-Host ""

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Google SAS Configuration:" -ForegroundColor Yellow
Write-Host "  Client ID: 1044782186913-7ukvo096g0r9oal2lg2tehiunae49ceq.apps.googleusercontent.com" -ForegroundColor White
Write-Host "  Client Secret: *** (stored in Firebase Secrets)" -ForegroundColor White
Write-Host "  Endpoint: https://sas.googleapis.com/v1" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Deploy functions: firebase deploy --only functions" -ForegroundColor White
Write-Host "  2. Go to: Tenant Management > CBRS Platform Keys" -ForegroundColor White
Write-Host "  3. Enter Client ID: 1044782186913-7ukvo096g0r9oal2lg2tehiunae49ceq.apps.googleusercontent.com" -ForegroundColor White
Write-Host "  4. System will use the secret automatically" -ForegroundColor White
Write-Host ""

