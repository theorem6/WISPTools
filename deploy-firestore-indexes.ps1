Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploying Firestore Indexes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will deploy the required Firestore indexes to Firebase." -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Continue? (Y/N)"
if ($confirmation -ne 'Y' -and $confirmation -ne 'y') {
    Write-Host "Deployment cancelled." -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "Deploying indexes..." -ForegroundColor Green

firebase deploy --only firestore:indexes

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The index may take 2-5 minutes to build." -ForegroundColor Yellow
Write-Host "You can check the status in Firebase Console:" -ForegroundColor Yellow
Write-Host "https://console.firebase.google.com/project/petersonmappingapp/firestore/indexes" -ForegroundColor Blue
Write-Host ""
Read-Host "Press Enter to exit"

