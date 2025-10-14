# Deploy All Tenant System and CBRS Fixes
# This deploys both Firestore rules and the updated application code

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🚀 Deploying Tenant System Refactor" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Deploy Firestore Rules
Write-Host "📋 Step 1: Deploying Firestore Rules..." -ForegroundColor Yellow
Write-Host "   - Updated tenant permissions" -ForegroundColor Gray
Write-Host "   - Added CBRS config permissions" -ForegroundColor Gray
Write-Host "   - Added CBRS devices permissions" -ForegroundColor Gray
Write-Host ""

firebase deploy --only firestore:rules

Write-Host ""
Write-Host "✅ Firestore rules deployed!" -ForegroundColor Green
Write-Host ""

# Step 2: Build and Deploy the App
Write-Host "📦 Step 2: Building and deploying application..." -ForegroundColor Yellow
Write-Host "   - New centralized tenant store" -ForegroundColor Gray
Write-Host "   - TenantGuard component" -ForegroundColor Gray
Write-Host "   - Simplified CBRS module" -ForegroundColor Gray
Write-Host "   - All db() function fixes" -ForegroundColor Gray
Write-Host ""

# Navigate to Module_Manager directory
Push-Location Module_Manager

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
  Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
  npm install
}

# Build the app
Write-Host "🔨 Building application..." -ForegroundColor Yellow
npm run build

# Return to root
Pop-Location

# Deploy to Firebase App Hosting
Write-Host "🚀 Deploying to Firebase App Hosting..." -ForegroundColor Yellow
firebase deploy --only apphosting

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Wait 1-2 minutes for deployment to finish" -ForegroundColor White
Write-Host "2. Clear browser cache (Ctrl + Shift + Delete)" -ForegroundColor White
Write-Host "3. Hard refresh your app (Ctrl + F5)" -ForegroundColor White
Write-Host "4. Login and test!" -ForegroundColor White
Write-Host ""
Write-Host "Expected behavior:" -ForegroundColor Cyan
Write-Host "  ✅ Tenant loads: 'Peterson Consulting'" -ForegroundColor Green
Write-Host "  ✅ No redirect loops" -ForegroundColor Green
Write-Host "  ✅ CBRS config saves successfully" -ForegroundColor Green
Write-Host "  ✅ No permission errors" -ForegroundColor Green
Write-Host "  ✅ Fast page loads (~50ms)" -ForegroundColor Green
Write-Host ""

