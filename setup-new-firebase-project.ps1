# PowerShell script for setting up new Firebase project
# For Windows users

Write-Host "🔄 Setting up new Firebase project: lte-pci-mapper-65450042-bbf71" -ForegroundColor Cyan
Write-Host ""

# Create .env file
$envContent = @"
# Environment Variables for LTE PCI Mapper
# Firebase Project: lte-pci-mapper-65450042-bbf71

# Firebase Configuration - NEW PROJECT
PUBLIC_FIREBASE_API_KEY="AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0"
PUBLIC_FIREBASE_AUTH_DOMAIN="lte-pci-mapper-65450042-bbf71.firebaseapp.com"
PUBLIC_FIREBASE_PROJECT_ID="lte-pci-mapper-65450042-bbf71"
PUBLIC_FIREBASE_STORAGE_BUCKET="lte-pci-mapper-65450042-bbf71.firebasestorage.app"
PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1044782186913"
PUBLIC_FIREBASE_APP_ID="1:1044782186913:web:a5367441ce136118948be0"
PUBLIC_FIREBASE_MEASUREMENT_ID=""

# ArcGIS Configuration
PUBLIC_ARCGIS_API_KEY="AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ"

# Gemini AI Configuration
PUBLIC_GEMINI_API_KEY="AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg"

# Development Settings
NODE_ENV=development
PORT=5173
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host "✅ Created .env file with new Firebase credentials" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Enable Authentication in Firebase Console:"
Write-Host "   https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/authentication"
Write-Host ""
Write-Host "2. Create Firestore Database:"
Write-Host "   https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/firestore"
Write-Host ""
Write-Host "3. Deploy Firestore rules and indexes:"
Write-Host "   firebase deploy --only firestore:rules,firestore:indexes"
Write-Host ""
Write-Host "4. Test locally:"
Write-Host "   npm run dev"
Write-Host ""
Write-Host "5. Deploy to production:"
Write-Host "   firebase deploy"
Write-Host ""

