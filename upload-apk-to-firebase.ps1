# Upload APK to Firebase Storage
# Makes the mobile app downloadable from the web platform

Write-Host "📱 Uploading WISP Multitool APK to Firebase Storage" -ForegroundColor Cyan
Write-Host "=" * 60

# Check if APK exists
$apkPath = "wisp-field-app\android\app\build\outputs\apk\release\WISP-Multitool-v1.0.0-release.apk"

if (-not (Test-Path $apkPath)) {
    # Try old name
    $apkPath = "wisp-field-app\android\app\build\outputs\apk\release\WISP-Field-App-v1.0.0-release.apk"
    
    if (-not (Test-Path $apkPath)) {
        Write-Host "❌ APK not found at expected location" -ForegroundColor Red
        Write-Host "Expected: $apkPath"
        Write-Host ""
        Write-Host "Please build the APK first:"
        Write-Host "  cd wisp-field-app"
        Write-Host "  .\build-production-apk.bat"
        exit 1
    }
}

Write-Host "✅ Found APK: $apkPath" -ForegroundColor Green

# Get file size
$fileSize = (Get-Item $apkPath).Length / 1MB
Write-Host "📊 Size: $([math]::Round($fileSize, 2)) MB"

# Upload to Firebase Storage
Write-Host ""
Write-Host "🔄 Uploading to Firebase Storage..."

$storagePath = "mobile-app/WISP-Multitool-v1.0.0-release.apk"

try {
    # Use Firebase CLI to upload
    $uploadCmd = "firebase storage:upload `"$apkPath`" `"$storagePath`" --public"
    Invoke-Expression $uploadCmd
    
    Write-Host ""
    Write-Host "=" * 60
    Write-Host "✅ APK UPLOADED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "=" * 60
    Write-Host ""
    Write-Host "📥 Download URL:"
    Write-Host "https://firebasestorage.googleapis.com/v0/b/lte-pci-mapper-65450042-bbf71.appspot.com/o/mobile-app%2FWISP-Multitool-v1.0.0-release.apk?alt=media"
    Write-Host ""
    Write-Host "This URL is now embedded in:"
    Write-Host "  - Help Desk module"
    Write-Host "  - Work Orders module"
    Write-Host "  - User Management module"
    Write-Host ""
    Write-Host "Field technicians can download the app directly from the web platform!"
    Write-Host ""
    
} catch {
    Write-Host "❌ Upload failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual upload instructions:"
    Write-Host "1. Go to Firebase Console: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/storage"
    Write-Host "2. Navigate to 'mobile-app' folder (create if needed)"
    Write-Host "3. Click 'Upload file'"
    Write-Host "4. Select: $apkPath"
    Write-Host "5. After upload, make file public (right-click → Get download URL)"
    exit 1
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

