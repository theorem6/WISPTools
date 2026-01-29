# Apply Nginx API routing fix on GCE backend (acs-hss-server).
# Fixes 404 "Route not found" path '/' when Cloud Function calls /api/internal/user-tenants.
#
# Prereqs: gcloud auth login
# Run from repo root: .\scripts\fix-nginx-api-routing-on-gce.ps1

$ErrorActionPreference = "Stop"
$InstanceName = "acs-hss-server"
$Zone = "us-central1-a"
$ScriptName = "fix-nginx-api-routing.sh"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ScriptsDir = Join-Path $RepoRoot "scripts"
$LocalScript = Join-Path $ScriptsDir $ScriptName

if (-not (Test-Path $LocalScript)) {
    Write-Host "Script not found: $LocalScript" -ForegroundColor Red
    exit 1
}

Write-Host "Copying $ScriptName to GCE instance..." -ForegroundColor Cyan
gcloud compute scp $LocalScript "${InstanceName}:/tmp/$ScriptName" --zone=$Zone --tunnel-through-iap
if ($LASTEXITCODE -ne 0) {
    Write-Host "SCP failed. Run: gcloud auth login" -ForegroundColor Red
    exit 1
}

Write-Host "Running Nginx fix on server (sudo)..." -ForegroundColor Cyan
gcloud compute ssh $InstanceName --zone=$Zone --tunnel-through-iap --command="sudo bash /tmp/$ScriptName && rm -f /tmp/$ScriptName"
if ($LASTEXITCODE -eq 0) {
    Write-Host "Done. /api/internal/* should now reach the Node app with the correct path." -ForegroundColor Green
} else {
    Write-Host "SSH command failed." -ForegroundColor Red
    exit 1
}
