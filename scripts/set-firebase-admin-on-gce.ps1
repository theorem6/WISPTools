# Set Firebase Admin credentials on GCE backend (acs-hss-server) so the backend can verify
# Firebase ID tokens for /api/tenant-settings, /api/notifications, and other verifyAuth routes.
#
# Prereqs: gcloud auth login; a Firebase service account JSON key file.
# Get the key: Firebase Console → Project Settings → Service accounts → Generate new private key.
#
# Usage (from repo root):
#   .\scripts\set-firebase-admin-on-gce.ps1 -KeyPath "C:\path\to\wisptools-production-xxxxx.json"
#   .\scripts\set-firebase-admin-on-gce.ps1   # prompts for path
#
# After running, main-api is restarted. /api/tenant-settings and /api/notifications should return 200 instead of 401.

param(
    [string]$KeyPath
)

$ErrorActionPreference = "Stop"
$InstanceName = "acs-hss-server"
$Zone = "us-central1-a"
$BackendDir = "/opt/lte-pci-mapper/backend-services"

if (-not $KeyPath) {
    Write-Host "Usage: .\scripts\set-firebase-admin-on-gce.ps1 -KeyPath `"C:\path\to\your-firebase-adminsdk.json`"" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Get the key file from: Firebase Console → Project Settings (gear) → Service accounts → Generate new private key" -ForegroundColor Cyan
    exit 1
}

if (-not (Test-Path $KeyPath)) {
    Write-Host "Key file not found: $KeyPath" -ForegroundColor Red
    exit 1
}

Write-Host "Reading and base64-encoding service account JSON..." -ForegroundColor Cyan
$jsonBytes = [System.IO.File]::ReadAllBytes($KeyPath)
$base64 = [Convert]::ToBase64String($jsonBytes)

$tempFile = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tempFile, $base64)
    Write-Host "Copying to GCE instance..." -ForegroundColor Cyan
    gcloud compute scp $tempFile "${InstanceName}:/tmp/firebase_sa_b64.txt" --zone=$Zone --tunnel-through-iap
    if ($LASTEXITCODE -ne 0) {
        Write-Host "SCP failed. Run: gcloud auth login" -ForegroundColor Red
        exit 1
    }

    $remoteCmd = "set -e; cd $BackendDir; if [ -f .env ]; then grep -v '^FIREBASE_SERVICE_ACCOUNT_BASE64=' .env > .env.tmp || true; else touch .env.tmp; fi; echo -n 'FIREBASE_SERVICE_ACCOUNT_BASE64=' >> .env.tmp; cat /tmp/firebase_sa_b64.txt >> .env.tmp; echo '' >> .env.tmp; mv .env.tmp .env; rm -f /tmp/firebase_sa_b64.txt; sudo PM2_HOME=/root/.pm2 /usr/lib/node_modules/pm2/bin/pm2 restart main-api --update-env 2>/dev/null || true; echo Done."
    Write-Host "Setting FIREBASE_SERVICE_ACCOUNT_BASE64 on backend and restarting main-api..." -ForegroundColor Cyan
    gcloud compute ssh $InstanceName --zone=$Zone --tunnel-through-iap --command="$remoteCmd"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Done. Backend can now verify Firebase tokens; /api/tenant-settings and /api/notifications should return 200." -ForegroundColor Green
    } else {
        Write-Host "SSH command failed." -ForegroundColor Red
        exit 1
    }
} finally {
    if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
}
