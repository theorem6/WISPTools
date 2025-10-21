# Upload APK to Firebase Storage
# Makes the mobile app downloadable from the web platform

Write-Host "Mobile App Upload to Firebase Storage" -ForegroundColor Cyan
Write-Host ("=" * 60)

# Check if APK exists
$apkPath = "wisp-field-app\android\app\build\outputs\apk\release\WISP-Multitool-v1.0.0-release.apk"

if (-not (Test-Path $apkPath)) {
    $apkPath = "wisp-field-app\android\app\build\outputs\apk\release\WISP-Field-App-v1.0.0-release.apk"
    
    if (-not (Test-Path $apkPath)) {
        Write-Host "APK not found" -ForegroundColor Red
        Write-Host "Expected: $apkPath"
        Write-Host ""
        Write-Host "Please build the APK first:"
        Write-Host "  cd wisp-field-app"
        Write-Host "  .\build-production-apk.bat"
        exit 1
    }
}

Write-Host "Found APK: $apkPath" -ForegroundColor Green

# Get file size
$fileSize = (Get-Item $apkPath).Length / 1MB
Write-Host "Size: $([math]::Round($fileSize, 2)) MB"

# Manual upload instructions
Write-Host ""
Write-Host "MANUAL UPLOAD INSTRUCTIONS:" -ForegroundColor Yellow
Write-Host ("=" * 60)
Write-Host ""
Write-Host "1. Open Firebase Console Storage:"
Write-Host "   https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/storage"
Write-Host ""
Write-Host "2. Click 'Files' tab"
Write-Host ""
Write-Host "3. Create folder 'mobile-app' (if not exists)"
Write-Host ""
Write-Host "4. Click 'Upload file'"
Write-Host ""
Write-Host "5. Select this APK:"
Write-Host "   $apkPath"
Write-Host ""
Write-Host "6. After upload, click the file"
Write-Host ""
Write-Host "7. Click 'Get download URL' or make public"
Write-Host ""
Write-Host "8. The download URL will be:"
Write-Host "   https://firebasestorage.googleapis.com/v0/b/lte-pci-mapper-65450042-bbf71.appspot.com/o/mobile-app%2FWISP-Multitool-v1.0.0-release.apk?alt=media"
Write-Host ""
Write-Host ("=" * 60)
Write-Host "APK is ready for upload!" -ForegroundColor Green
Write-Host ("=" * 60)
Write-Host ""
Write-Host "Press Enter to continue..."
Read-Host
