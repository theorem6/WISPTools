# Quick Deploy with Automatic Secret Configuration
# One-command setup for all Firebase secrets and deployment

param(
    [string]$MongoDbUri = "",
    [string]$FederatedWirelessKey = "",
    [switch]$SkipDeploy = $false
)

$PROJECT_ID = "lte-pci-mapper-65450042-bbf71"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 Quick Deploy with Secrets" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if firebase CLI is available
Write-Host "Checking Firebase CLI..." -ForegroundColor Yellow
$firebasePath = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebasePath) {
    Write-Host "❌ Firebase CLI not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Firebase CLI:" -ForegroundColor Yellow
    Write-Host "  npm install -g firebase-tools" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run: firebase login" -ForegroundColor White
    exit 1
}

Write-Host "✅ Firebase CLI found" -ForegroundColor Green
Write-Host ""

# Configure Google SAS Secret
Write-Host "Configuring Google SAS Client Secret..." -ForegroundColor Yellow
$googleSecret = "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"
$googleSecret | firebase functions:secrets:set google-sas-client-secret --project=$PROJECT_ID --data-file=- --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Google SAS secret configured" -ForegroundColor Green
    $googleConfigured = $true
} else {
    Write-Host "❌ Failed to configure Google SAS secret" -ForegroundColor Red
    $googleConfigured = $false
}

Write-Host ""

# Configure MongoDB if provided
$mongoConfigured = $false
if (-not [string]::IsNullOrWhiteSpace($MongoDbUri)) {
    Write-Host "Configuring MongoDB URI..." -ForegroundColor Yellow
    $MongoDbUri | firebase functions:secrets:set mongodb-uri --project=$PROJECT_ID --data-file=- --force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ MongoDB URI configured" -ForegroundColor Green
        $mongoConfigured = $true
    } else {
        Write-Host "❌ Failed to configure MongoDB URI" -ForegroundColor Red
    }
    Write-Host ""
}

# Configure Federated Wireless if provided
$fwConfigured = $false
if (-not [string]::IsNullOrWhiteSpace($FederatedWirelessKey)) {
    Write-Host "Configuring Federated Wireless API Key..." -ForegroundColor Yellow
    $FederatedWirelessKey | firebase functions:secrets:set federated-wireless-api-key --project=$PROJECT_ID --data-file=- --force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Federated Wireless key configured" -ForegroundColor Green
        $fwConfigured = $true
    } else {
        Write-Host "❌ Failed to configure Federated Wireless key" -ForegroundColor Red
    }
    Write-Host ""
}

# Update apphosting.yaml to uncomment configured secrets
Write-Host "Updating apphosting.yaml..." -ForegroundColor Yellow
$apphostingPath = "Module_Manager\apphosting.yaml"

if ($googleConfigured) {
    # Uncomment Google SAS secret
    (Get-Content $apphostingPath) -replace '#   secret: google-sas-client-secret', '    secret: google-sas-client-secret' `
                                  -replace '# - variable: GOOGLE_SAS_CLIENT_SECRET', '  - variable: GOOGLE_SAS_CLIENT_SECRET' | 
    Set-Content $apphostingPath
    Write-Host "✅ Enabled GOOGLE_SAS_CLIENT_SECRET in apphosting.yaml" -ForegroundColor Green
}

if ($mongoConfigured) {
    # Uncomment MongoDB secret
    (Get-Content $apphostingPath) -replace '#   secret: mongodb-uri', '    secret: mongodb-uri' `
                                  -replace '# - variable: MONGODB_URI', '  - variable: MONGODB_URI' | 
    Set-Content $apphostingPath
    Write-Host "✅ Enabled MONGODB_URI in apphosting.yaml" -ForegroundColor Green
}

if ($fwConfigured) {
    # Uncomment Federated Wireless secret
    (Get-Content $apphostingPath) -replace '#   secret: federated-wireless-api-key', '    secret: federated-wireless-api-key' `
                                  -replace '# - variable: FEDERATED_WIRELESS_API_KEY', '  - variable: FEDERATED_WIRELESS_API_KEY' | 
    Set-Content $apphostingPath
    Write-Host "✅ Enabled FEDERATED_WIRELESS_API_KEY in apphosting.yaml" -ForegroundColor Green
}

Write-Host ""

# Commit changes
Write-Host "Committing configuration changes..." -ForegroundColor Yellow
git add Module_Manager/apphosting.yaml
git commit -m "config: Enable configured Firebase secrets"
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Changes pushed to GitHub" -ForegroundColor Green
} else {
    Write-Host "⚠️  Git push may have failed (check manually)" -ForegroundColor Yellow
}

Write-Host ""

# Deploy if not skipped
if (-not $SkipDeploy) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "🚀 Deploying to Firebase" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Deploying App Hosting..." -ForegroundColor Yellow
    firebase deploy --only apphosting --project=$PROJECT_ID
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Deployment successful!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Deployment failed" -ForegroundColor Red
        Write-Host "Check the error messages above" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuration Summary:" -ForegroundColor Cyan
Write-Host "  • Google SAS: $(if($googleConfigured){'✅ Configured'}else{'❌ Not configured'})" -ForegroundColor White
Write-Host "  • MongoDB: $(if($mongoConfigured){'✅ Configured'}else{'⏭️  Optional'})" -ForegroundColor White
Write-Host "  • Federated Wireless: $(if($fwConfigured){'✅ Configured'}else{'⏭️  Optional'})" -ForegroundColor White
Write-Host ""

if ($googleConfigured) {
    Write-Host "Next: Configure platform keys in UI" -ForegroundColor Yellow
    Write-Host "  1. Open: https://your-app-url.run.app" -ForegroundColor White
    Write-Host "  2. Go to: Tenant Management > CBRS Platform Keys" -ForegroundColor White
    Write-Host "  3. Enter Client ID and save" -ForegroundColor White
}

Write-Host ""

