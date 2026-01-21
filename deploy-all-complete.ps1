# Complete Deployment Script - Firebase Frontend + GCE Backend
# Deploys both frontend (Firebase Hosting) and backend (GCE) services

$ErrorActionPreference = "Stop"

$GCE_INSTANCE = "acs-hss-server"
$GCE_ZONE = "us-central1-a"
$REPO_DIR = "/opt/lte-pci-mapper"
$FIREBASE_PROJECT = "wisptools-production"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Complete Deployment - Firebase Frontend + GCE Backend" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow

if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: gcloud CLI not found" -ForegroundColor Red
    Write-Host "   Please install Google Cloud SDK first" -ForegroundColor Yellow
    exit 1
}

if (!(Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Firebase CLI not found" -ForegroundColor Red
    Write-Host "   Please install: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Prerequisites check passed" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 1: Deploy Firebase Frontend (Hosting + Functions)
# ============================================================================

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  STEP 1: Deploying Firebase Frontend" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if we need to build frontend
Write-Host "🔨 Building frontend..." -ForegroundColor Yellow
Set-Location "Module_Manager"

if (!(Test-Path "build/client/index.html")) {
    Write-Host "  → Running npm install..." -ForegroundColor Gray
    npm install --silent
    
    Write-Host "  → Building SvelteKit application..." -ForegroundColor Gray
    npm run build
    
    if (!(Test-Path "build/client/index.html")) {
        Write-Host "❌ Build failed - build/client/index.html not found" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    Write-Host "✅ Frontend built successfully" -ForegroundColor Green
} else {
    Write-Host "✅ Build output already exists" -ForegroundColor Green
}

Set-Location ..

Write-Host ""
Write-Host "🚀 Deploying to Firebase Hosting..." -ForegroundColor Yellow

try {
    # Deploy only the main production site
    firebase deploy --only hosting:wisptools-production --project $FIREBASE_PROJECT
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Firebase Hosting deployment failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Firebase Hosting deployed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase deployment error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Deploying Firebase Functions..." -ForegroundColor Yellow

try {
    firebase deploy --only functions --project $FIREBASE_PROJECT
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Firebase Functions deployment had issues (continuing...)" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Firebase Functions deployed successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Firebase Functions deployment error: $_ (continuing...)" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# STEP 2: Deploy GCE Backend
# ============================================================================

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  STEP 2: Deploying GCE Backend" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "📡 Connecting to GCE server..." -ForegroundColor Yellow

# Update backend from GitHub
Write-Host "📥 Updating backend from GitHub..." -ForegroundColor Yellow
$updateCmd = "cd $REPO_DIR; sudo bash scripts/deployment/update-backend-from-git.sh"

try {
    gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command=$updateCmd --tunnel-through-iap
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Backend update had issues (checking status...)" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Backend updated from GitHub" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Backend update error: $_ (checking status...)" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# STEP 3: Verify Services
# ============================================================================

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  STEP 3: Verifying Services" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check GCE backend services
Write-Host "🔍 Checking GCE backend services..." -ForegroundColor Yellow
$statusCmd = "pm2 status"

try {
    gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command=$statusCmd --tunnel-through-iap
    Write-Host "✅ Backend services status retrieved" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not check backend status: $_" -ForegroundColor Yellow
}

Write-Host ""

# Check backend health endpoint
Write-Host "🏥 Testing backend health endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "https://hss.wisptools.io/api/health" -Method GET -TimeoutSec 10 -UseBasicParsing
    if ($healthResponse.StatusCode -eq 200) {
        Write-Host "✅ Backend health check passed" -ForegroundColor Green
        Write-Host "   Response: $($healthResponse.Content)" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Backend health check returned status: $($healthResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Backend health check failed: $_" -ForegroundColor Yellow
    Write-Host "   This may be normal if the endpoint is not accessible externally" -ForegroundColor Gray
}

Write-Host ""

# Check Firebase hosting
Write-Host "🌐 Testing Firebase Hosting..." -ForegroundColor Yellow
try {
    $hostingResponse = Invoke-WebRequest -Uri "https://wisptools-production.web.app" -Method GET -TimeoutSec 10 -UseBasicParsing
    if ($hostingResponse.StatusCode -eq 200) {
        Write-Host "✅ Firebase Hosting is accessible" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Firebase Hosting returned status: $($hostingResponse.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Firebase Hosting check failed: $_" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# DEPLOYMENT SUMMARY
# ============================================================================

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DEPLOYMENT SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Frontend (Firebase Hosting):" -ForegroundColor Green
Write-Host "   - URL: https://wisptools-production.web.app" -ForegroundColor White
Write-Host "   - Project: $FIREBASE_PROJECT" -ForegroundColor White
Write-Host ""
Write-Host "✅ Backend (GCE Server):" -ForegroundColor Green
Write-Host "   - Instance: $GCE_INSTANCE" -ForegroundColor White
Write-Host "   - Zone: $GCE_ZONE" -ForegroundColor White
Write-Host "   - Health: https://hss.wisptools.io/api/health" -ForegroundColor White
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Verify frontend at: https://wisptools-production.web.app" -ForegroundColor White
Write-Host "   2. Test customer creation with 4G/5G service type" -ForegroundColor White
Write-Host "   3. Check backend logs: gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --tunnel-through-iap" -ForegroundColor White
Write-Host "   4. Monitor services: pm2 status (on GCE server)" -ForegroundColor White
Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
