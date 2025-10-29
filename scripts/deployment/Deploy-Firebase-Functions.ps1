# Deploy Firebase Cloud Functions
# Specifically updates hssProxy and other functions after code changes

param(
    [string]$FunctionName = "hssProxy",
    [switch]$AllFunctions = $false,
    [switch]$BuildOnly = $false
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Firebase Functions Deployment Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is installed
Write-Host "Checking Firebase CLI installation..." -ForegroundColor Yellow
try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI found: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Firebase CLI:" -ForegroundColor Yellow
    Write-Host "  npm install -g firebase-tools" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or use Cloud Shell deployment script instead:" -ForegroundColor Yellow
    Write-Host "  See: scripts/deployment/deploy-firebase-functions.sh" -ForegroundColor Cyan
    exit 1
}

# Navigate to functions directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)
$functionsDir = Join-Path $projectRoot "functions"

if (-not (Test-Path $functionsDir)) {
    Write-Host "❌ Functions directory not found: $functionsDir" -ForegroundColor Red
    exit 1
}

Push-Location $functionsDir

try {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed"
    }
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
    Write-Host ""

    Write-Host "🔨 Building TypeScript..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    Write-Host "✅ Build successful" -ForegroundColor Green
    Write-Host ""

    if ($BuildOnly) {
        Write-Host "✅ Build-only mode complete" -ForegroundColor Green
        exit 0
    }

    # Deploy
    if ($AllFunctions) {
        Write-Host "🚀 Deploying ALL functions..." -ForegroundColor Yellow
        firebase deploy --only functions
    } else {
        Write-Host "🚀 Deploying function: $FunctionName" -ForegroundColor Yellow
        firebase deploy --only functions:$FunctionName
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Deployment failed"
    }

    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Function URLs:" -ForegroundColor Cyan
    if ($AllFunctions -or $FunctionName -eq "hssProxy") {
        Write-Host "  hssProxy: https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "🧪 Test the proxy:" -ForegroundColor Cyan
    Write-Host "  curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/health" -ForegroundColor Gray
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
} finally {
    Pop-Location
}

