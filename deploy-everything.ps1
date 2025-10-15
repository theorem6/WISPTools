# Complete Automated Deployment Script (PowerShell)
# Deploys HSS + ACS + Frontend via Firebase App Hosting
#
# Project: lte-pci-mapper-65450042-bbf71
# Instance: genieacs-backend
# Zone: us-central1-a

param(
    [switch]$FirstTime
)

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🚀 Automated Cloud HSS + ACS Deployment" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project:  lte-pci-mapper-65450042-bbf71"
Write-Host "Instance: genieacs-backend"
Write-Host "Zone:     us-central1-a"
Write-Host ""
Write-Host "This will deploy:"
Write-Host "  ✅ Frontend → Firebase App Hosting"
Write-Host "  ✅ HSS Server → GCE genieacs-backend"
Write-Host "  ✅ GenieACS → GCE genieacs-backend"
Write-Host "  ✅ Nginx reverse proxy"
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# First-time setup
if ($FirstTime) {
    Write-Host "📋 First-time setup detected. Running prerequisite checks..." -ForegroundColor Yellow
    Write-Host ""
    
    # Check gcloud
    if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Error: gcloud CLI not found" -ForegroundColor Red
        Write-Host "   Install: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
        exit 1
    }
    
    # Check firebase
    if (!(Get-Command firebase -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Error: firebase CLI not found" -ForegroundColor Red
        Write-Host "   Install: npm install -g firebase-tools" -ForegroundColor Red
        exit 1
    }
    
    # Set project
    Write-Host "🔧 Setting Google Cloud project..." -ForegroundColor Yellow
    gcloud config set project lte-pci-mapper-65450042-bbf71
    
    # Check secrets
    Write-Host "🔐 Checking secrets..." -ForegroundColor Yellow
    $mongodbSecret = gcloud secrets describe mongodb-uri 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: mongodb-uri secret not found" -ForegroundColor Red
        Write-Host ""
        Write-Host "Create it with:"
        Write-Host "  echo YOUR_MONGODB_URI | gcloud secrets create mongodb-uri --data-file=-"
        Write-Host ""
        exit 1
    }
    
    $encryptionSecret = gcloud secrets describe hss-encryption-key 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  hss-encryption-key secret not found. Generating..." -ForegroundColor Yellow
        $encryptionKey = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
        $encryptionKey | gcloud secrets create hss-encryption-key --data-file=-
        Write-Host "✅ Generated and stored HSS encryption key" -ForegroundColor Green
    }
    
    # Check permissions
    Write-Host "🔑 Checking Cloud Build permissions..." -ForegroundColor Yellow
    $projectNumber = gcloud projects describe lte-pci-mapper-65450042-bbf71 --format="value(projectNumber)"
    
    # Grant secret access
    gcloud secrets add-iam-policy-binding mongodb-uri `
        --member="serviceAccount:${projectNumber}@cloudbuild.gserviceaccount.com" `
        --role="roles/secretmanager.secretAccessor" 2>$null
    
    gcloud secrets add-iam-policy-binding hss-encryption-key `
        --member="serviceAccount:${projectNumber}@cloudbuild.gserviceaccount.com" `
        --role="roles/secretmanager.secretAccessor" 2>$null
    
    # Grant compute permissions
    gcloud projects add-iam-policy-binding lte-pci-mapper-65450042-bbf71 `
        --member="serviceAccount:${projectNumber}@cloudbuild.gserviceaccount.com" `
        --role="roles/compute.admin" 2>$null
    
    gcloud projects add-iam-policy-binding lte-pci-mapper-65450042-bbf71 `
        --member="serviceAccount:${projectNumber}@cloudbuild.gserviceaccount.com" `
        --role="roles/iam.serviceAccountUser" 2>$null
    
    # Enable APIs
    Write-Host "🔌 Enabling required APIs..." -ForegroundColor Yellow
    gcloud services enable cloudbuild.googleapis.com --quiet
    gcloud services enable compute.googleapis.com --quiet
    gcloud services enable secretmanager.googleapis.com --quiet
    gcloud services enable apphosting.googleapis.com --quiet
    
    Write-Host ""
    Write-Host "✅ First-time setup complete!" -ForegroundColor Green
    Write-Host ""
}

# Deploy backend to GCE
Write-Host "📦 Step 1/3: Deploying HSS + GenieACS to GCE..." -ForegroundColor Cyan
Write-Host ""
gcloud builds submit --config=firebase-automation/deploy-hss-to-gce.yaml

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ GCE deployment failed" -ForegroundColor Red
    exit 1
}

# Get external IP
Write-Host ""
Write-Host "🌐 Getting external IP..." -ForegroundColor Cyan
$externalIp = gcloud compute instances describe genieacs-backend --zone=us-central1-a --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
Write-Host "   External IP: $externalIp" -ForegroundColor Green

# Update apphosting.yaml with IP
Write-Host ""
Write-Host "📝 Step 2/3: Updating configuration with external IP..." -ForegroundColor Cyan
$content = Get-Content -Path "apphosting.yaml" -Raw
$content = $content -replace '<GCE-IP>', $externalIp
Set-Content -Path "apphosting.yaml" -Value $content
Write-Host "   ✅ apphosting.yaml updated" -ForegroundColor Green

# Deploy frontend
Write-Host ""
Write-Host "🎨 Step 3/3: Deploying frontend to Firebase App Hosting..." -ForegroundColor Cyan
Write-Host ""
firebase deploy --only apphosting

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Your Services:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend:"
Write-Host "  https://lte-pci-mapper-65450042-bbf71.web.app" -ForegroundColor Yellow
Write-Host ""
Write-Host "Backend (GCE: $externalIp):" -ForegroundColor Cyan
Write-Host "  HSS REST API:     http://$externalIp/api/hss/" -ForegroundColor Yellow
Write-Host "  HSS S6a:          $externalIp:3868" -ForegroundColor Yellow
Write-Host "  GenieACS NBI:     http://$externalIp/nbi/" -ForegroundColor Yellow
Write-Host "  GenieACS CWMP:    http://$externalIp:7547" -ForegroundColor Yellow
Write-Host "  GenieACS UI:      http://$externalIp/admin/" -ForegroundColor Yellow
Write-Host "  Health Check:     http://$externalIp/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "📊 Monitoring:" -ForegroundColor Cyan
Write-Host "  Firebase Console: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71"
Write-Host "  GCE Console:      https://console.cloud.google.com/compute/instances?project=lte-pci-mapper-65450042-bbf71"
Write-Host ""
Write-Host "🧪 Test Your Deployment:" -ForegroundColor Cyan
Write-Host "  curl http://$externalIp/health"
Write-Host "  curl http://$externalIp/api/hss/health"
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Test the health endpoints above"
Write-Host "  2. Open the web UI and navigate to HSS Management"
Write-Host "  3. Create bandwidth plans and groups"
Write-Host "  4. Add test subscribers"
Write-Host "  5. Configure remote MME connections"
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

