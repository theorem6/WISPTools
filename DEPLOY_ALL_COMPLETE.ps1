# PowerShell Script to Deploy Everything - Complete Deployment
# Deploys backend services AND ensures all agent scripts are available

$ErrorActionPreference = "Stop"

$GCE_INSTANCE = "acs-hss-server"
$GCE_ZONE = "us-central1-a"
$REPO_DIR = "/opt/lte-pci-mapper"
$SCRIPTS_DIR = "/var/www/html/downloads/scripts"

Write-Host "Complete Deployment - Backend + Agents" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is available
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: gcloud CLI not found" -ForegroundColor Red
    Write-Host "   Please install Google Cloud SDK first" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK: gcloud CLI found" -ForegroundColor Green
Write-Host ""

# Function to run command on GCE server
function Invoke-GCECmd {
    param([string]$Command)
    gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command=$Command --tunnel-through-iap
}

Write-Host "Connecting to GCE server..." -ForegroundColor Yellow
Write-Host ""

# STEP 1: Update Backend from GitHub
Write-Host "Step 1: Updating backend from GitHub..." -ForegroundColor Yellow
Invoke-GCECmd "cd $REPO_DIR; sudo bash scripts/deployment/update-backend-from-git.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Backend update failed" -ForegroundColor Red
    exit 1
}

Write-Host "OK: Backend code updated from GitHub" -ForegroundColor Green
Write-Host ""

# STEP 2: Install Backend Dependencies
Write-Host "Step 2: Installing backend dependencies..." -ForegroundColor Yellow
Invoke-GCECmd "cd $REPO_DIR/backend-services; sudo npm install --production"

Write-Host "OK: Dependencies installed" -ForegroundColor Green
Write-Host ""

# STEP 3: Ensure Scripts Directory Exists
Write-Host "Step 3: Setting up agent scripts directory..." -ForegroundColor Yellow
Invoke-GCECmd "sudo mkdir -p $SCRIPTS_DIR"
Invoke-GCECmd "sudo chown -R www-data:www-data /var/www/html/downloads"
Invoke-GCECmd "sudo chmod -R 755 /var/www/html/downloads"

Write-Host "OK: Scripts directory ready" -ForegroundColor Green
Write-Host ""

# STEP 4: Copy All Agent Scripts
Write-Host "Step 4: Copying agent scripts to download directory..." -ForegroundColor Yellow

$agentScripts = @(
    "epc-checkin-agent.sh",
    "epc-snmp-discovery.sh",
    "epc-snmp-discovery.js"
)

foreach ($script in $agentScripts) {
    Write-Host "  -> Copying $script..." -ForegroundColor Gray
    Invoke-GCECmd "sudo cp $REPO_DIR/backend-services/scripts/$script $SCRIPTS_DIR/"
    Invoke-GCECmd "sudo chmod 755 $SCRIPTS_DIR/$script"
}

Write-Host "OK: Agent scripts copied" -ForegroundColor Green
Write-Host ""

# STEP 5: Verify Scripts are Available
Write-Host "Step 5: Verifying scripts are accessible..." -ForegroundColor Yellow
Invoke-GCECmd "ls -lh $SCRIPTS_DIR/epc-*.sh $SCRIPTS_DIR/epc-*.js"

Write-Host "OK: Scripts verified" -ForegroundColor Green
Write-Host ""

# STEP 6: Restart Backend Services
Write-Host "Step 6: Restarting backend services..." -ForegroundColor Yellow
Invoke-GCECmd "pm2 restart all --update-env"
Invoke-GCECmd "pm2 save"

Write-Host "OK: Services restarted" -ForegroundColor Green
Write-Host ""

# STEP 7: Show Service Status
Write-Host "Step 7: Service Status" -ForegroundColor Yellow
Invoke-GCECmd "pm2 status"

Write-Host ""

# STEP 8: Show Latest Commit
Write-Host "Step 8: Latest Deployment Commit" -ForegroundColor Yellow
Invoke-GCECmd "cd $REPO_DIR; git log -1 --oneline"

Write-Host ""

# DEPLOYMENT COMPLETE
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host ""

Write-Host "Backend Services:" -ForegroundColor Cyan
Write-Host "  - Main API: https://hss.wisptools.io/api/health" -ForegroundColor White
Write-Host "  - EPC API: https://hss.wisptools.io/api/epc/status" -ForegroundColor White
Write-Host ""

Write-Host "Agent Scripts Available:" -ForegroundColor Cyan
Write-Host "  - https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh" -ForegroundColor White
Write-Host "  - https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.sh" -ForegroundColor White
Write-Host "  - https://hss.wisptools.io/downloads/scripts/epc-snmp-discovery.js" -ForegroundColor White
Write-Host ""

Write-Host "Agent Auto-Update:" -ForegroundColor Cyan
Write-Host "  - Remote agents will auto-update on next check-in (within 60 seconds)" -ForegroundColor White
Write-Host "  - Agents compare script hashes and download updates automatically" -ForegroundColor White
Write-Host ""

Write-Host "All systems deployed and ready!" -ForegroundColor Green
