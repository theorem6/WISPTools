# Firebase GenieACS Integration Deployment Script
# Run this script to deploy the complete integration

Write-Host "🔥 Deploying Firebase GenieACS Integration..." -ForegroundColor Green

# Check if Firebase CLI is installed
if (!(Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Firebase CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g firebase-tools
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install Firebase CLI. Please install Node.js first." -ForegroundColor Red
        exit 1
    }
}

# Check if logged in to Firebase
Write-Host "🔐 Checking Firebase authentication..." -ForegroundColor Blue
firebase projects:list
if ($LASTEXITCODE -ne 0) {
    Write-Host "🔐 Please login to Firebase first:" -ForegroundColor Yellow
    firebase login
}

# Set MongoDB connection URL
Write-Host "🗄️ Configuring MongoDB connection..." -ForegroundColor Blue
firebase functions:config:set mongodb.connection_url="mongodb+srv://genieacs-user:fg2E8I10Pnx58gYP@cluster0.1radgkw.mongodb.net/genieacs?retryWrites=true&w=majority&appName=Cluster0"

# Install Firebase Functions dependencies
Write-Host "📦 Installing Firebase Functions dependencies..." -ForegroundColor Blue
cd functions
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Build Firebase Functions
Write-Host "🔨 Building Firebase Functions..." -ForegroundColor Blue
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build functions" -ForegroundColor Red
    exit 1
}

cd ..

# Deploy Firebase Functions
Write-Host "🚀 Deploying Firebase Functions..." -ForegroundColor Blue
firebase deploy --only functions
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy functions" -ForegroundColor Red
    exit 1
}

# Deploy Firestore rules and indexes
Write-Host "📋 Deploying Firestore rules and indexes..." -ForegroundColor Blue
firebase deploy --only firestore:rules,firestore:indexes
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy Firestore configuration" -ForegroundColor Red
    exit 1
}

# Deploy Firebase Hosting (if needed)
Write-Host "🌐 Deploying Firebase Hosting..." -ForegroundColor Blue
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Failed to deploy hosting (this might be expected)" -ForegroundColor Yellow
}

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Next steps:" -ForegroundColor Cyan
Write-Host "1. Test the integration: curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/syncCPEDevices" -ForegroundColor White
Write-Host "2. Initialize GenieACS data in MongoDB Atlas" -ForegroundColor White
Write-Host "3. Update your PCI Mapper to use the new GenieACS service" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Firebase Console: https://console.firebase.google.com" -ForegroundColor Cyan
Write-Host "🗄️ MongoDB Atlas: https://cloud.mongodb.com" -ForegroundColor Cyan
