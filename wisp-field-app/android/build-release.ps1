# Build Release APK with bundled JavaScript
# This creates a standalone APK that doesn't need Metro

Write-Host "Building Release APK for WISP Field App..." -ForegroundColor Cyan
Write-Host ""

# Navigate to android directory
Set-Location $PSScriptRoot

# Clean previous builds
Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
.\gradlew clean

# Build release APK
Write-Host ""
Write-Host "Building release APK (this may take a few minutes)..." -ForegroundColor Yellow
.\gradlew assembleRelease

Write-Host ""
Write-Host "Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "APK Location:" -ForegroundColor Cyan
Write-Host "  app\build\outputs\apk\release\WISP-Field-App-v1.0.0-release.apk"
Write-Host ""
Write-Host "Install with:" -ForegroundColor Yellow
Write-Host "  adb install app\build\outputs\apk\release\WISP-Field-App-v1.0.0-release.apk"

