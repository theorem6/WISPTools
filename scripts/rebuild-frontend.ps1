# PowerShell script to rebuild and test the Module Manager
# This script fixes common build issues and ensures a clean deployment

Write-Host "🔧 LTE WISP Management Platform - Rebuild Script" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Change to Module_Manager directory
Set-Location $PSScriptRoot

# Step 1: Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "build") {
    Remove-Item -Recurse -Force "build"
    Write-Host "   ✅ Removed build directory" -ForegroundColor Green
}
if (Test-Path ".svelte-kit") {
    Remove-Item -Recurse -Force ".svelte-kit"
    Write-Host "   ✅ Removed .svelte-kit cache" -ForegroundColor Green
}
if (Test-Path "node_modules/.vite") {
    Remove-Item -Recurse -Force "node_modules/.vite"
    Write-Host "   ✅ Removed Vite cache" -ForegroundColor Green
}

# Step 2: Install dependencies
Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ npm install failed!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Dependencies installed" -ForegroundColor Green

# Step 3: Sync SvelteKit
Write-Host ""
Write-Host "🔄 Syncing SvelteKit..." -ForegroundColor Yellow
npx svelte-kit sync
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ SvelteKit sync failed!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ SvelteKit synced" -ForegroundColor Green

# Step 4: Build the application
Write-Host ""
Write-Host "🏗️  Building application..." -ForegroundColor Yellow
$env:NODE_OPTIONS = "--max-old-space-size=6144"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Build completed successfully" -ForegroundColor Green

# Step 5: Verify build output
Write-Host ""
Write-Host "🔍 Verifying build output..." -ForegroundColor Yellow

$requiredPaths = @(
    "build/index.js",
    "build/handler.js",
    "build/client"
)

$allExist = $true
foreach ($path in $requiredPaths) {
    if (Test-Path $path) {
        Write-Host "   ✅ $path exists" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $path is missing!" -ForegroundColor Red
        $allExist = $false
    }
}

if (Test-Path "build/client/_app") {
    $fileCount = (Get-ChildItem -Path "build/client/_app" -Recurse -File).Count
    Write-Host "   ✅ Found $fileCount files in build/client/_app" -ForegroundColor Green
} else {
    Write-Host "   ❌ build/client/_app directory is missing!" -ForegroundColor Red
    $allExist = $false
}

if (-not $allExist) {
    Write-Host ""
    Write-Host "❌ Build verification failed!" -ForegroundColor Red
    exit 1
}

# Step 6: Test locally (optional)
Write-Host ""
Write-Host "✅ Build completed and verified successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 To test locally, run:" -ForegroundColor Cyan
Write-Host "   npm start" -ForegroundColor White
Write-Host ""
Write-Host "☁️  To deploy to Firebase, run:" -ForegroundColor Cyan
Write-Host "   cd .. && firebase deploy" -ForegroundColor White
Write-Host ""


