# PowerShell Script to Deploy All - Complete Deployment
# Deploys backend to GCE and ensures all scripts are in place

$ErrorActionPreference = "Stop"

$GCE_INSTANCE = "acs-hss-server"
$GCE_ZONE = "us-central1-a"
$REPO_DIR = "/opt/lte-pci-mapper"
$SCRIPTS_DIR = "/var/www/html/downloads/scripts"

Write-Host "🚀 Starting Complete Deployment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is available
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: gcloud CLI not found" -ForegroundColor Red
    Write-Host "   Please install Google Cloud SDK first" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ gcloud CLI found" -ForegroundColor Green
Write-Host ""

# Function to run command on GCE server
function Invoke-GCECmd {
    param([string]$Command)
    gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command=$Command
}

Write-Host "📡 Connecting to GCE server..." -ForegroundColor Yellow
Write-Host ""

# Step 1: Update backend from GitHub
Write-Host "📥 Step 1: Updating backend from GitHub..." -ForegroundColor Yellow
Invoke-GCECmd "cd $REPO_DIR && sudo bash scripts/deployment/update-backend-from-git.sh"

Write-Host ""
Write-Host "✅ Backend updated from GitHub" -ForegroundColor Green
Write-Host ""

# Step 2: Ensure scripts directory exists
Write-Host "📁 Step 2: Ensuring scripts directory exists..." -ForegroundColor Yellow
Invoke-GCECmd "sudo mkdir -p $SCRIPTS_DIR; sudo chown -R www-data:www-data /var/www/html/downloads; sudo chmod -R 755 /var/www/html/downloads"

Write-Host ""
Write-Host "✅ Scripts directory ready" -ForegroundColor Green
Write-Host ""

# Step 3: Copy EPC scripts to download directory
Write-Host "📋 Step 3: Copying EPC scripts to download directory..." -ForegroundColor Yellow

# Copy check-in agent
Write-Host "  → Copying epc-checkin-agent.sh..." -ForegroundColor Gray
Invoke-GCECmd "sudo cp $REPO_DIR/backend-services/scripts/epc-checkin-agent.sh $SCRIPTS_DIR/; sudo chmod 755 $SCRIPTS_DIR/epc-checkin-agent.sh"

# Copy SNMP discovery script
Write-Host "  → Copying epc-snmp-discovery.sh..." -ForegroundColor Gray
Invoke-GCECmd "sudo cp $REPO_DIR/backend-services/scripts/epc-snmp-discovery.sh $SCRIPTS_DIR/; sudo chmod 755 $SCRIPTS_DIR/epc-snmp-discovery.sh"

Write-Host ""
Write-Host "✅ Scripts copied successfully" -ForegroundColor Green
Write-Host ""

# Step 4: Verify services are running
Write-Host "🔍 Step 4: Verifying services..." -ForegroundColor Yellow
Invoke-GCECmd "pm2 status"

Write-Host ""
Write-Host "✅ Services verified" -ForegroundColor Green
Write-Host ""

# Step 5: Show latest commit
Write-Host "📝 Step 5: Latest deployment commit..." -ForegroundColor Yellow
Invoke-GCECmd "cd $REPO_DIR && git log -1 --oneline"

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 Services:" -ForegroundColor Cyan
Write-Host "  - Frontend: https://wisptools-production.web.app"
Write-Host "  - Backend API: https://hss.wisptools.io"
Write-Host ""
Write-Host "📋 Scripts available at:" -ForegroundColor Cyan
Write-Host "  - https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh"
Write-Host "  - https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.sh"
Write-Host ""
