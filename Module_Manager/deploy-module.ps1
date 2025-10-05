# Deploy GenieACS Module to Firebase Web IDE
# Run this script to deploy the complete GenieACS module

Write-Host "🚀 Deploying GenieACS CPE Management Module..." -ForegroundColor Green

# Navigate to Module Manager
Set-Location Module_Manager

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
npm install

# Build the project
Write-Host "🔨 Building the project..." -ForegroundColor Blue
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Check if Firebase CLI is available
if (!(Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️ Firebase CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g firebase-tools
}

# Deploy to Firebase
Write-Host "🔥 Deploying to Firebase..." -ForegroundColor Blue
firebase deploy --only hosting

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 GenieACS CPE Management Module is now live!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 What's available:" -ForegroundColor Yellow
    Write-Host "   - PCI Resolution & Network Optimization" -ForegroundColor White
    Write-Host "   - GenieACS CPE Management (NEW!)" -ForegroundColor White
    Write-Host "   - TR-069 device monitoring" -ForegroundColor White
    Write-Host "   - GPS location mapping" -ForegroundColor White
    Write-Host "   - Real-time CPE status" -ForegroundColor White
    Write-Host ""
    Write-Host "🔗 Access your platform at the Firebase hosting URL" -ForegroundColor Cyan
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Check the error messages above for details." -ForegroundColor Yellow
}

# Return to original directory
Set-Location ..
