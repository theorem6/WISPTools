# Firebase Deploy Helper Script
# This ensures Firebase CLI works even if PATH isn't updated

$firebasePath = "C:\Users\david\AppData\Roaming\npm\firebase.cmd"

if (Test-Path $firebasePath) {
    Write-Host "Starting Firebase deployment..." -ForegroundColor Green
    & $firebasePath deploy
} else {
    Write-Host "Firebase CLI not found at $firebasePath" -ForegroundColor Red
    Write-Host "Attempting to use npx..." -ForegroundColor Yellow
    npx firebase-tools deploy
}


