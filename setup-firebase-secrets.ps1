# Setup Firebase Secrets for GenieACS MongoDB Integration
# PowerShell version for Windows users

Write-Host "🔐 Firebase Secrets Setup for PCI Mapper" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is installed
try {
    firebase --version | Out-Null
    Write-Host "✅ Firebase CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g firebase-tools"
    exit 1
}

# Login to Firebase
Write-Host "🔑 Logging into Firebase..." -ForegroundColor Yellow
firebase login

# Set project
Write-Host "📋 Setting Firebase project..." -ForegroundColor Yellow
firebase use lte-pci-mapper-65450042-bbf71

Write-Host ""
Write-Host "📝 We'll now set up MongoDB connection secrets for each environment." -ForegroundColor Cyan
Write-Host ""

# Production MongoDB Secret
Write-Host "🏭 PRODUCTION MongoDB Secret" -ForegroundColor Green
Write-Host "----------------------------" -ForegroundColor Green
Write-Host "Please enter your PRODUCTION MongoDB connection string:"
Write-Host "Format: mongodb+srv://username:password@cluster.mongodb.net/genieacs?retryWrites=true&w=majority"
$prodMongoUri = Read-Host "Production MongoDB URI"

if ($prodMongoUri) {
    echo $prodMongoUri | firebase functions:secrets:set mongodb-connection-url
    Write-Host "✅ Production MongoDB secret set!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Skipping production secret (empty input)" -ForegroundColor Yellow
}

Write-Host ""

# Staging MongoDB Secret
Write-Host "🧪 STAGING MongoDB Secret" -ForegroundColor Green
Write-Host "-------------------------" -ForegroundColor Green
Write-Host "Please enter your STAGING MongoDB connection string (or press Enter to skip):"
$stagingMongoUri = Read-Host "Staging MongoDB URI"

if ($stagingMongoUri) {
    echo $stagingMongoUri | firebase functions:secrets:set mongodb-staging-connection-url
    Write-Host "✅ Staging MongoDB secret set!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Skipping staging secret (empty input)" -ForegroundColor Yellow
}

Write-Host ""

# Development MongoDB Secret
Write-Host "💻 DEVELOPMENT MongoDB Secret" -ForegroundColor Green
Write-Host "-----------------------------" -ForegroundColor Green
Write-Host "Please enter your DEVELOPMENT MongoDB connection string (or press Enter to skip):"
$devMongoUri = Read-Host "Development MongoDB URI"

if ($devMongoUri) {
    echo $devMongoUri | firebase functions:secrets:set mongodb-dev-connection-url
    Write-Host "✅ Development MongoDB secret set!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Skipping development secret (empty input)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📊 Listing all configured secrets..." -ForegroundColor Yellow
firebase functions:secrets:list

Write-Host ""
Write-Host "✅ Secret setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Set environment name in Firebase Console:"
Write-Host "   https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting"
Write-Host ""
Write-Host "2. Deploy your functions:"
Write-Host "   firebase deploy --only functions"
Write-Host ""
Write-Host "3. Test your APIs:"
Write-Host "   See FIREBASE_API_SETUP.md for testing instructions"
Write-Host ""

