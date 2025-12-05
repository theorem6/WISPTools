# Deployment Script for Mac Compatibility Fixes
# Run this script to build and deploy the Mac compatibility fixes

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploying Mac Compatibility Fixes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build the project
Write-Host "Step 1: Building project..." -ForegroundColor Yellow
Set-Location "Module_Manager"
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed! Exiting." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "build\client\index.html")) {
    Write-Host "Build output not found! Exiting." -ForegroundColor Red
    exit 1
}

Write-Host "Build successful!" -ForegroundColor Green
Write-Host ""

# Step 2: Deploy to Firebase
Write-Host "Step 2: Deploying to Firebase..." -ForegroundColor Yellow
Set-Location ".."
firebase deploy --only hosting

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deployment failed! Check Firebase CLI and authentication." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Clear browser cache (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)" -ForegroundColor White
Write-Host "2. Test map functionality on Mac" -ForegroundColor White
Write-Host "3. Verify trackpad gestures work correctly" -ForegroundColor White
Write-Host ""
