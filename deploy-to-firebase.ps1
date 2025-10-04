# Deploy to Firebase App Hosting
# This script builds and deploys your app to Firebase so you can see changes in the web IDE

Write-Host "🚀 Deploying PCI Mapper to Firebase App Hosting..." -ForegroundColor Cyan
Write-Host ""

# Check if firebase CLI is installed
$firebaseInstalled = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseInstalled) {
    Write-Host "❌ Firebase CLI not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Firebase CLI first:" -ForegroundColor Yellow
    Write-Host "  npm install -g firebase-tools" -ForegroundColor White
    Write-Host ""
    Write-Host "Then login:" -ForegroundColor Yellow
    Write-Host "  firebase login" -ForegroundColor White
    exit 1
}

Write-Host "✓ Firebase CLI found" -ForegroundColor Green
Write-Host ""

# Show current project
Write-Host "📋 Current Firebase project:" -ForegroundColor Cyan
firebase use

Write-Host ""
Write-Host "🔨 Building application..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ Build successful" -ForegroundColor Green
Write-Host ""

Write-Host "📤 Deploying to Firebase App Hosting..." -ForegroundColor Cyan
firebase apphosting:backends:deploy pci-mapper

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Your changes are now live in the Firebase Web IDE!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "View your app at:" -ForegroundColor Yellow
    firebase apphosting:backends:list
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Check the error message above." -ForegroundColor Yellow
}

