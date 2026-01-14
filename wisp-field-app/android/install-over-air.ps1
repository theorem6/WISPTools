# Install APK Over The Air (Wireless ADB)
# This script connects to your Android device wirelessly and installs the APK

param(
    [string]$DeviceIP = "192.168.1.5",
    [string]$PairingPort = "",
    [string]$ConnectionPort = "41987",
    [string]$PairingCode = ""
)

$adbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adbPath)) {
    $adbPath = "C:\Users\david\AppData\Local\Android\Sdk\platform-tools\adb.exe"
}

$apkPath = Join-Path $PSScriptRoot "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Wireless APK Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if APK exists
if (-not (Test-Path $apkPath)) {
    Write-Host "ERROR: APK not found at:" -ForegroundColor Red
    Write-Host $apkPath -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please build the APK first:" -ForegroundColor Yellow
    Write-Host "  .\gradlew.bat assembleDebug" -ForegroundColor Cyan
    exit 1
}

Write-Host "APK Found:" -ForegroundColor Green
Write-Host "  File: $(Split-Path $apkPath -Leaf)" -ForegroundColor Cyan
Write-Host "  Size: $([math]::Round((Get-Item $apkPath).Length / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host ""

# Check current connection
Write-Host "Checking ADB connection..." -ForegroundColor Yellow
$devices = & $adbPath devices 2>&1
if ($devices -match "device$") {
    Write-Host "Device already connected!" -ForegroundColor Green
} else {
    Write-Host "No device connected. Attempting wireless connection..." -ForegroundColor Yellow
    Write-Host ""
    
    # Try to connect directly if connection port provided
    if ($ConnectionPort) {
        Write-Host "Connecting to $DeviceIP`:$ConnectionPort..." -ForegroundColor Cyan
        & $adbPath connect "$DeviceIP`:$ConnectionPort" 2>&1 | Out-Host
        Start-Sleep -Seconds 2
        
        $devices = & $adbPath devices 2>&1
        if (-not ($devices -match "device$")) {
            Write-Host ""
            Write-Host "Connection failed. Please pair manually:" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "1. On your device: Settings > Developer Options > Wireless debugging" -ForegroundColor White
            Write-Host "2. Tap 'Pair device with pairing code'" -ForegroundColor White
            Write-Host "3. Run: adb pair $DeviceIP`:<pairing_port>" -ForegroundColor Cyan
            Write-Host "4. Enter pairing code when prompted" -ForegroundColor White
            Write-Host "5. Run: adb connect $DeviceIP`:<connection_port>" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Then run this script again." -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "Please provide connection details:" -ForegroundColor Yellow
        Write-Host "  .\install-over-air.ps1 -DeviceIP 192.168.1.5 -ConnectionPort 41987" -ForegroundColor Cyan
        exit 1
    }
}

# Verify connection
$devices = & $adbPath devices 2>&1
if (-not ($devices -match "device$")) {
    Write-Host "ERROR: Could not connect to device" -ForegroundColor Red
    exit 1
}

Write-Host "Device connected successfully!" -ForegroundColor Green
Write-Host ""

# Install APK
Write-Host "Installing APK over the air..." -ForegroundColor Cyan
Write-Host "This may take a minute for large APKs..." -ForegroundColor Gray
Write-Host ""

$installResult = & $adbPath install -r $apkPath 2>&1

if ($LASTEXITCODE -eq 0 -or $installResult -match "Success") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "INSTALLATION SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Launching app..." -ForegroundColor Cyan
    & $adbPath shell am start -n com.wispfieldapp/.MainActivity 2>&1 | Out-Null
    Write-Host ""
    Write-Host "App installed and launched!" -ForegroundColor Green
    Write-Host "Check your device for WISPTools.io" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR: Installation failed" -ForegroundColor Red
    Write-Host $installResult -ForegroundColor Yellow
    exit 1
}

# Install APK Over The Air (Wireless ADB)
# This script connects to your Android device wirelessly and installs the APK

param(
    [string]$DeviceIP = "192.168.1.5",
    [string]$PairingPort = "",
    [string]$ConnectionPort = "41987",
    [string]$PairingCode = ""
)

$adbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adbPath)) {
    $adbPath = "C:\Users\david\AppData\Local\Android\Sdk\platform-tools\adb.exe"
}

$apkPath = Join-Path $PSScriptRoot "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Wireless APK Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if APK exists
if (-not (Test-Path $apkPath)) {
    Write-Host "ERROR: APK not found at:" -ForegroundColor Red
    Write-Host $apkPath -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please build the APK first:" -ForegroundColor Yellow
    Write-Host "  .\gradlew.bat assembleDebug" -ForegroundColor Cyan
    exit 1
}

Write-Host "APK Found:" -ForegroundColor Green
Write-Host "  File: $(Split-Path $apkPath -Leaf)" -ForegroundColor Cyan
Write-Host "  Size: $([math]::Round((Get-Item $apkPath).Length / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host ""

# Check current connection
Write-Host "Checking ADB connection..." -ForegroundColor Yellow
$devices = & $adbPath devices 2>&1
if ($devices -match "device$") {
    Write-Host "Device already connected!" -ForegroundColor Green
} else {
    Write-Host "No device connected. Attempting wireless connection..." -ForegroundColor Yellow
    Write-Host ""
    
    # Try to connect directly if connection port provided
    if ($ConnectionPort) {
        Write-Host "Connecting to $DeviceIP`:$ConnectionPort..." -ForegroundColor Cyan
        & $adbPath connect "$DeviceIP`:$ConnectionPort" 2>&1 | Out-Host
        Start-Sleep -Seconds 2
        
        $devices = & $adbPath devices 2>&1
        if (-not ($devices -match "device$")) {
            Write-Host ""
            Write-Host "Connection failed. Please pair manually:" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "1. On your device: Settings > Developer Options > Wireless debugging" -ForegroundColor White
            Write-Host "2. Tap 'Pair device with pairing code'" -ForegroundColor White
            Write-Host "3. Run: adb pair $DeviceIP`:<pairing_port>" -ForegroundColor Cyan
            Write-Host "4. Enter pairing code when prompted" -ForegroundColor White
            Write-Host "5. Run: adb connect $DeviceIP`:<connection_port>" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Then run this script again." -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "Please provide connection details:" -ForegroundColor Yellow
        Write-Host "  .\install-over-air.ps1 -DeviceIP 192.168.1.5 -ConnectionPort 41987" -ForegroundColor Cyan
        exit 1
    }
}

# Verify connection
$devices = & $adbPath devices 2>&1
if (-not ($devices -match "device$")) {
    Write-Host "ERROR: Could not connect to device" -ForegroundColor Red
    exit 1
}

Write-Host "Device connected successfully!" -ForegroundColor Green
Write-Host ""

# Install APK
Write-Host "Installing APK over the air..." -ForegroundColor Cyan
Write-Host "This may take a minute for large APKs..." -ForegroundColor Gray
Write-Host ""

$installResult = & $adbPath install -r $apkPath 2>&1

if ($LASTEXITCODE -eq 0 -or $installResult -match "Success") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "INSTALLATION SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Launching app..." -ForegroundColor Cyan
    & $adbPath shell am start -n com.wispfieldapp/.MainActivity 2>&1 | Out-Null
    Write-Host ""
    Write-Host "App installed and launched!" -ForegroundColor Green
    Write-Host "Check your device for WISPTools.io" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR: Installation failed" -ForegroundColor Red
    Write-Host $installResult -ForegroundColor Yellow
    exit 1
}

# Install APK Over The Air (Wireless ADB)
# This script connects to your Android device wirelessly and installs the APK

param(
    [string]$DeviceIP = "192.168.1.5",
    [string]$PairingPort = "",
    [string]$ConnectionPort = "41987",
    [string]$PairingCode = ""
)

$adbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adbPath)) {
    $adbPath = "C:\Users\david\AppData\Local\Android\Sdk\platform-tools\adb.exe"
}

$apkPath = Join-Path $PSScriptRoot "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Wireless APK Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if APK exists
if (-not (Test-Path $apkPath)) {
    Write-Host "ERROR: APK not found at:" -ForegroundColor Red
    Write-Host $apkPath -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please build the APK first:" -ForegroundColor Yellow
    Write-Host "  .\gradlew.bat assembleDebug" -ForegroundColor Cyan
    exit 1
}

Write-Host "APK Found:" -ForegroundColor Green
Write-Host "  File: $(Split-Path $apkPath -Leaf)" -ForegroundColor Cyan
Write-Host "  Size: $([math]::Round((Get-Item $apkPath).Length / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host ""

# Check current connection
Write-Host "Checking ADB connection..." -ForegroundColor Yellow
$devices = & $adbPath devices 2>&1
if ($devices -match "device$") {
    Write-Host "Device already connected!" -ForegroundColor Green
} else {
    Write-Host "No device connected. Attempting wireless connection..." -ForegroundColor Yellow
    Write-Host ""
    
    # Try to connect directly if connection port provided
    if ($ConnectionPort) {
        Write-Host "Connecting to $DeviceIP`:$ConnectionPort..." -ForegroundColor Cyan
        & $adbPath connect "$DeviceIP`:$ConnectionPort" 2>&1 | Out-Host
        Start-Sleep -Seconds 2
        
        $devices = & $adbPath devices 2>&1
        if (-not ($devices -match "device$")) {
            Write-Host ""
            Write-Host "Connection failed. Please pair manually:" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "1. On your device: Settings > Developer Options > Wireless debugging" -ForegroundColor White
            Write-Host "2. Tap 'Pair device with pairing code'" -ForegroundColor White
            Write-Host "3. Run: adb pair $DeviceIP`:<pairing_port>" -ForegroundColor Cyan
            Write-Host "4. Enter pairing code when prompted" -ForegroundColor White
            Write-Host "5. Run: adb connect $DeviceIP`:<connection_port>" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Then run this script again." -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "Please provide connection details:" -ForegroundColor Yellow
        Write-Host "  .\install-over-air.ps1 -DeviceIP 192.168.1.5 -ConnectionPort 41987" -ForegroundColor Cyan
        exit 1
    }
}

# Verify connection
$devices = & $adbPath devices 2>&1
if (-not ($devices -match "device$")) {
    Write-Host "ERROR: Could not connect to device" -ForegroundColor Red
    exit 1
}

Write-Host "Device connected successfully!" -ForegroundColor Green
Write-Host ""

# Install APK
Write-Host "Installing APK over the air..." -ForegroundColor Cyan
Write-Host "This may take a minute for large APKs..." -ForegroundColor Gray
Write-Host ""

$installResult = & $adbPath install -r $apkPath 2>&1

if ($LASTEXITCODE -eq 0 -or $installResult -match "Success") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "INSTALLATION SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Launching app..." -ForegroundColor Cyan
    & $adbPath shell am start -n com.wispfieldapp/.MainActivity 2>&1 | Out-Null
    Write-Host ""
    Write-Host "App installed and launched!" -ForegroundColor Green
    Write-Host "Check your device for WISPTools.io" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR: Installation failed" -ForegroundColor Red
    Write-Host $installResult -ForegroundColor Yellow
    exit 1
}







