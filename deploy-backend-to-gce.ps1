# Deploy Backend Services to GCE VM via gcloud
# Default target: acs-hss-server (us-central1-a)

param(
    [string]$InstanceName = "acs-hss-server",
    [string]$Zone = "us-central1-a",
    [string]$Project = "",
    [string]$RepoDir = "/opt/lte-pci-mapper",
    [string]$Branch = "main"
)

Write-Host "Deploying backend services to GCE via gcloud..." -ForegroundColor Green

# Ensure gcloud is available
$gcloudCmd = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloudCmd) {
    Write-Host "gcloud CLI not found. Install Google Cloud SDK and try again." -ForegroundColor Red
    exit 1
}

# Resolve active project if not provided
if (-not $Project) {
    $Project = (gcloud config get-value project 2>$null).Trim()
}
if (-not $Project) {
    Write-Host "No GCP project set. Run: gcloud config set project <PROJECT_ID>" -ForegroundColor Red
    exit 1
}

Write-Host "Project: $Project" -ForegroundColor Cyan
Write-Host "Instance: $InstanceName ($Zone)" -ForegroundColor Cyan
Write-Host "Repo: $RepoDir (branch: $Branch)" -ForegroundColor Cyan

# Build remote deployment script (avoid local expansion)
$remoteScript = @'
set -e
REPO_DIR="__REPO_DIR__"
BRANCH="__BRANCH__"

[ -d "$REPO_DIR" ] || (sudo mkdir -p "$REPO_DIR" && sudo chown "$USER":"$USER" "$REPO_DIR" && git clone https://github.com/theorem6/WISPTools.git "$REPO_DIR")

cd "$REPO_DIR"
git fetch origin
git reset --hard "origin/$BRANCH"

cd backend-services
npm install --omit=dev

command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js

pm2 save || true
'@

$remoteScript = $remoteScript -replace "__REPO_DIR__", $RepoDir
$remoteScript = $remoteScript -replace "__BRANCH__", $Branch
$remoteCommand = ($remoteScript -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }) -join "; "
$remoteCommand = $remoteCommand -replace "'", "''"

Write-Host "Connecting and deploying..." -ForegroundColor Yellow
gcloud compute ssh $InstanceName --project $Project --zone $Zone --command "$remoteCommand"

Write-Host "Backend deployment complete." -ForegroundColor Green
