# PowerShell script to deploy development Firestore rules

Write-Host "🔄 Deploying DEVELOPMENT Firestore Rules..." -ForegroundColor Cyan
Write-Host "⚠️  These rules are MORE PERMISSIVE - use for testing only!" -ForegroundColor Yellow
Write-Host ""

# Backup current rules
if (-not (Test-Path "firestore.rules.backup")) {
    Copy-Item "firestore.rules" "firestore.rules.backup"
    Write-Host "✅ Backed up production rules to firestore.rules.backup" -ForegroundColor Green
}

# Use development rules
Copy-Item "firestore.rules.dev" "firestore.rules" -Force
Write-Host "✅ Copied development rules to firestore.rules" -ForegroundColor Green
Write-Host ""

# Deploy
Write-Host "📤 Deploying to Firebase..." -ForegroundColor Cyan
firebase deploy --only firestore:rules

Write-Host ""
Write-Host "✅ Development rules deployed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Try accessing your app - permissions should work now"
Write-Host "2. Check Firebase Console: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/firestore/rules"
Write-Host "3. When ready for production, run: .\deploy-prod-rules.ps1"
Write-Host ""
Write-Host "⚠️  Remember: Development rules allow ANY authenticated user to read/write" -ForegroundColor Yellow
Write-Host "    Switch to production rules before going live!"
Write-Host ""

