# Install ARM64 Android App Script
# This script installs the ARM64-compatible Android app

$apkPath = "$PSScriptRoot\android\app\build\outputs\apk\debug\app-debug.apk"
$adbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools"

# Add ADB to PATH
$env:PATH = "$adbPath;$env:PATH"

Write-Host "WISP Field App ARM64 Installation Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if APK exists
if (!(Test-Path $apkPath)) {
    Write-Host "ERROR: APK file not found at $apkPath" -ForegroundColor Red
    Write-Host "Please build the app first with: .\gradlew.bat :app:assembleDebug" -ForegroundColor Yellow
    exit 1
}

Write-Host "APK found: $apkPath" -ForegroundColor Green

# Check connected devices
Write-Host "Checking connected devices..." -ForegroundColor Yellow
$devices = & adb devices 2>&1
if ($devices -match "device$") {
    Write-Host "Devices found:" -ForegroundColor Green
    Write-Host $devices
} else {
    Write-Host "No devices connected." -ForegroundColor Red
    Write-Host ""
    Write-Host "To connect your device:" -ForegroundColor Yellow
    Write-Host "1. Enable Developer Options on Android device"
    Write-Host "2. Enable USB Debugging"
    Write-Host "3. Connect via USB: adb devices (should show device)"
    Write-Host "4. Enable WiFi ADB: adb tcpip 5555"
    Write-Host "5. Disconnect USB cable"
    Write-Host "6. Connect via WiFi: adb connect <DEVICE_IP>:5555"
    Write-Host ""
    exit 1
}

# Install APK
Write-Host "Installing APK..." -ForegroundColor Yellow
$installResult = & adb install -r $apkPath 2>&1

if ($installResult -match "Success") {
    Write-Host "✅ APK installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now launch the WISP Field App on your device."
    Write-Host "Look for 'WISP Field App' in your app drawer."
} else {
    Write-Host "❌ Installation failed:" -ForegroundColor Red
    Write-Host $installResult
    exit 1
}
