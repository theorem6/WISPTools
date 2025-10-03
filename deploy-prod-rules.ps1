# Deploy Production Firestore Security Rules
# This script deploys the secure production rules (firestore.rules)
# 
# WARNING: This will replace any existing rules in Firebase Console!

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Deploy Production Security Rules" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "⚠️  WARNING: This will deploy PRODUCTION security rules!" -ForegroundColor Yellow
Write-Host "   - Users will ONLY see their own networks" -ForegroundColor Yellow
Write-Host "   - File: firestore.rules (NOT firestore.rules.dev)" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Deploy production rules? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "📋 Deploying firestore.rules..." -ForegroundColor Green

# Check if Firebase CLI is installed
if (!(Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Firebase CLI not installed" -ForegroundColor Red
    Write-Host "   Install with: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

# Deploy Firestore rules
Write-Host "   Running: firebase deploy --only firestore:rules" -ForegroundColor Cyan
firebase deploy --only firestore:rules

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Production rules deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔒 Security is now active:" -ForegroundColor Green
    Write-Host "   - Users can ONLY see their own networks" -ForegroundColor Green
    Write-Host "   - Users can ONLY modify their own networks" -ForegroundColor Green
    Write-Host "   - Users CANNOT access other users' data" -ForegroundColor Green
    Write-Host ""
    Write-Host "🧪 Test by signing in with different accounts" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "   Check Firebase CLI login: firebase login" -ForegroundColor Yellow
    Write-Host "   Check project: firebase use" -ForegroundColor Yellow
    exit 1
}

