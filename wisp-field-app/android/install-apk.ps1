# Simple APK Installation Script
# Run this once your device is connected via ADB

$adbPath = "C:\Users\david\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$apkPath = "C:\Users\david\Downloads\WISPTools\wisp-field-app\android\app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"

Write-Host "========================================" -ForegroundColor Green
Write-Host "WISPTools.io APK Installation" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check device connection
Write-Host "Checking device connection..." -ForegroundColor Cyan
$devices = & $adbPath devices 2>&1
Write-Host $devices

if (-not ($devices -match "device")) {
    Write-Host ""
    Write-Host "ERROR: No device connected!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To connect wirelessly:" -ForegroundColor Yellow
    Write-Host "  1. On device: Settings > Developer Options > Wireless debugging" -ForegroundColor White
    Write-Host "  2. Note the IP address and port shown" -ForegroundColor White
    Write-Host "  3. Run: adb connect <IP>:<port>" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Example: adb connect 192.168.1.5:41987" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "Device connected!" -ForegroundColor Green
Write-Host ""

# Check if APK exists
if (-not (Test-Path $apkPath)) {
    Write-Host "ERROR: APK not found!" -ForegroundColor Red
    Write-Host "Path: $apkPath" -ForegroundColor Yellow
    exit 1
}

Write-Host "APK Details:" -ForegroundColor Cyan
Write-Host "  File: $(Split-Path $apkPath -Leaf)" -ForegroundColor White
Write-Host "  Size: $([math]::Round((Get-Item $apkPath).Length / 1MB, 2)) MB" -ForegroundColor White
Write-Host ""

# Install APK
Write-Host "Installing APK..." -ForegroundColor Yellow
Write-Host "(This may take a minute for large APKs)" -ForegroundColor Gray
Write-Host ""

$installResult = & $adbPath install -r $apkPath 2>&1
Write-Host $installResult

if ($installResult -match "Success" -or $LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "INSTALLATION SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Launching app..." -ForegroundColor Cyan
    & $adbPath shell am start -n com.wispfieldapp/.MainActivity 2>&1 | Out-Null
    
    Write-Host ""
    Write-Host "WISPTools.io is now installed and running!" -ForegroundColor Green
    Write-Host "Check your device for the app." -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR: Installation failed" -ForegroundColor Red
    Write-Host "Check the error message above." -ForegroundColor Yellow
    exit 1
}

# Simple APK Installation Script
# Run this once your device is connected via ADB

$adbPath = "C:\Users\david\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$apkPath = "C:\Users\david\Downloads\WISPTools\wisp-field-app\android\app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"

Write-Host "========================================" -ForegroundColor Green
Write-Host "WISPTools.io APK Installation" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check device connection
Write-Host "Checking device connection..." -ForegroundColor Cyan
$devices = & $adbPath devices 2>&1
Write-Host $devices

if (-not ($devices -match "device")) {
    Write-Host ""
    Write-Host "ERROR: No device connected!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To connect wirelessly:" -ForegroundColor Yellow
    Write-Host "  1. On device: Settings > Developer Options > Wireless debugging" -ForegroundColor White
    Write-Host "  2. Note the IP address and port shown" -ForegroundColor White
    Write-Host "  3. Run: adb connect <IP>:<port>" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Example: adb connect 192.168.1.5:41987" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "Device connected!" -ForegroundColor Green
Write-Host ""

# Check if APK exists
if (-not (Test-Path $apkPath)) {
    Write-Host "ERROR: APK not found!" -ForegroundColor Red
    Write-Host "Path: $apkPath" -ForegroundColor Yellow
    exit 1
}

Write-Host "APK Details:" -ForegroundColor Cyan
Write-Host "  File: $(Split-Path $apkPath -Leaf)" -ForegroundColor White
Write-Host "  Size: $([math]::Round((Get-Item $apkPath).Length / 1MB, 2)) MB" -ForegroundColor White
Write-Host ""

# Install APK
Write-Host "Installing APK..." -ForegroundColor Yellow
Write-Host "(This may take a minute for large APKs)" -ForegroundColor Gray
Write-Host ""

$installResult = & $adbPath install -r $apkPath 2>&1
Write-Host $installResult

if ($installResult -match "Success" -or $LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "INSTALLATION SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Launching app..." -ForegroundColor Cyan
    & $adbPath shell am start -n com.wispfieldapp/.MainActivity 2>&1 | Out-Null
    
    Write-Host ""
    Write-Host "WISPTools.io is now installed and running!" -ForegroundColor Green
    Write-Host "Check your device for the app." -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR: Installation failed" -ForegroundColor Red
    Write-Host "Check the error message above." -ForegroundColor Yellow
    exit 1
}

# Simple APK Installation Script
# Run this once your device is connected via ADB

$adbPath = "C:\Users\david\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$apkPath = "C:\Users\david\Downloads\WISPTools\wisp-field-app\android\app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"

Write-Host "========================================" -ForegroundColor Green
Write-Host "WISPTools.io APK Installation" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check device connection
Write-Host "Checking device connection..." -ForegroundColor Cyan
$devices = & $adbPath devices 2>&1
Write-Host $devices

if (-not ($devices -match "device")) {
    Write-Host ""
    Write-Host "ERROR: No device connected!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To connect wirelessly:" -ForegroundColor Yellow
    Write-Host "  1. On device: Settings > Developer Options > Wireless debugging" -ForegroundColor White
    Write-Host "  2. Note the IP address and port shown" -ForegroundColor White
    Write-Host "  3. Run: adb connect <IP>:<port>" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Example: adb connect 192.168.1.5:41987" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "Device connected!" -ForegroundColor Green
Write-Host ""

# Check if APK exists
if (-not (Test-Path $apkPath)) {
    Write-Host "ERROR: APK not found!" -ForegroundColor Red
    Write-Host "Path: $apkPath" -ForegroundColor Yellow
    exit 1
}

Write-Host "APK Details:" -ForegroundColor Cyan
Write-Host "  File: $(Split-Path $apkPath -Leaf)" -ForegroundColor White
Write-Host "  Size: $([math]::Round((Get-Item $apkPath).Length / 1MB, 2)) MB" -ForegroundColor White
Write-Host ""

# Install APK
Write-Host "Installing APK..." -ForegroundColor Yellow
Write-Host "(This may take a minute for large APKs)" -ForegroundColor Gray
Write-Host ""

$installResult = & $adbPath install -r $apkPath 2>&1
Write-Host $installResult

if ($installResult -match "Success" -or $LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "INSTALLATION SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Launching app..." -ForegroundColor Cyan
    & $adbPath shell am start -n com.wispfieldapp/.MainActivity 2>&1 | Out-Null
    
    Write-Host ""
    Write-Host "WISPTools.io is now installed and running!" -ForegroundColor Green
    Write-Host "Check your device for the app." -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR: Installation failed" -ForegroundColor Red
    Write-Host "Check the error message above." -ForegroundColor Yellow
    exit 1
}







