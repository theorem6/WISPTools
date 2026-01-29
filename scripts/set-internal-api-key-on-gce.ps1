# Set INTERNAL_API_KEY on GCE backend (acs-hss-server) from Firebase Secret Manager.
# Ensures userTenants Cloud Function and backend share the same key so /api/user-tenants works.
#
# Prereqs: gcloud auth login, firebase login
# Run from repo root: .\scripts\set-internal-api-key-on-gce.ps1

$ErrorActionPreference = "Stop"
$InstanceName = "acs-hss-server"
$Zone = "us-central1-a"
$BackendDir = "/opt/lte-pci-mapper/backend-services"

Write-Host "Getting INTERNAL_API_KEY from Firebase Secret Manager..." -ForegroundColor Cyan
$key = (firebase functions:secrets:access INTERNAL_API_KEY 2>&1).Trim()
if (-not $key -or $key -match "Error|not found") {
    Write-Host "Failed to get secret. Run: firebase login" -ForegroundColor Red
    exit 1
}

$tempFile = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tempFile, $key)
    Write-Host "Copying key to GCE instance..." -ForegroundColor Cyan
    gcloud compute scp $tempFile "${InstanceName}:/tmp/internal_api_key.txt" --zone=$Zone --tunnel-through-iap
    if ($LASTEXITCODE -ne 0) {
        Write-Host "SCP failed. Run: gcloud auth login" -ForegroundColor Red
        exit 1
    }

    $remoteCmd = "set -e; cd $BackendDir; if [ -f .env ]; then grep -v '^INTERNAL_API_KEY=' .env > .env.tmp; else touch .env.tmp; fi; echo -n 'INTERNAL_API_KEY=' >> .env.tmp; cat /tmp/internal_api_key.txt >> .env.tmp; echo '' >> .env.tmp; mv .env.tmp .env; rm -f /tmp/internal_api_key.txt; sudo PM2_HOME=/root/.pm2 /usr/lib/node_modules/pm2/bin/pm2 restart main-api --update-env 2>/dev/null || pm2 restart main-api --update-env 2>/dev/null || true; echo Done."
    Write-Host "Setting INTERNAL_API_KEY on backend and restarting main-api..." -ForegroundColor Cyan
    gcloud compute ssh $InstanceName --zone=$Zone --tunnel-through-iap --command="$remoteCmd"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Done. /api/user-tenants should now return 200." -ForegroundColor Green
    } else {
        Write-Host "SSH command failed." -ForegroundColor Red
        exit 1
    }
} finally {
    if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
}
