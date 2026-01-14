# Align and re-sign APK for proper ELF alignment
# This script: 1) zipaligns the APK, 2) re-signs it

param(
    [string]$ApkPath = "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"
)

$ANDROID_HOME = $env:ANDROID_HOME
if (-not $ANDROID_HOME) {
    $ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}

$JAVA_HOME = $env:JAVA_HOME
if (-not $JAVA_HOME) {
    $JAVA_HOME = "C:\Users\david\AppData\Local\Microsoft\jdk-17.0.13.11-hotspot"
}

$buildTools = Get-ChildItem "$ANDROID_HOME\build-tools" | Sort-Object Name -Descending | Select-Object -First 1
if (-not $buildTools) {
    Write-Host "ERROR: Android build-tools not found" -ForegroundColor Red
    exit 1
}

$zipalign = "$($buildTools.FullName)\zipalign.exe"
$apksigner = "$($buildTools.FullName)\apksigner.bat"
$jarsigner = "$JAVA_HOME\bin\jarsigner.exe"

$fullApkPath = Join-Path $PSScriptRoot $ApkPath
if (-not (Test-Path $fullApkPath)) {
    Write-Host "ERROR: APK not found at $fullApkPath" -ForegroundColor Red
    exit 1
}

$keystore = Join-Path $PSScriptRoot "app\debug.keystore"
$tempAligned = "$fullApkPath.tmp"

Write-Host "Step 1: Aligning APK for ELF alignment..." -ForegroundColor Cyan
& $zipalign -v -p 4 $fullApkPath $tempAligned

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: zipalign failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Replacing original with aligned APK..." -ForegroundColor Cyan
Remove-Item $fullApkPath -Force
Rename-Item $tempAligned $fullApkPath

Write-Host ""
Write-Host "Step 3: Re-signing aligned APK..." -ForegroundColor Cyan
Start-Sleep -Seconds 1

# Use jarsigner (more reliable than apksigner for in-place signing)
& $jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 `
    -keystore $keystore `
    -storepass android `
    -keypass android `
    $fullApkPath androiddebugkey

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "APK ALIGNED AND RE-SIGNED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "File: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
    Write-Host "Location: $fullApkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "ELF alignment check should now pass!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ERROR: Re-signing failed" -ForegroundColor Red
    exit 1
}

# Align and re-sign APK for proper ELF alignment
# This script: 1) zipaligns the APK, 2) re-signs it

param(
    [string]$ApkPath = "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"
)

$ANDROID_HOME = $env:ANDROID_HOME
if (-not $ANDROID_HOME) {
    $ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}

$JAVA_HOME = $env:JAVA_HOME
if (-not $JAVA_HOME) {
    $JAVA_HOME = "C:\Users\david\AppData\Local\Microsoft\jdk-17.0.13.11-hotspot"
}

$buildTools = Get-ChildItem "$ANDROID_HOME\build-tools" | Sort-Object Name -Descending | Select-Object -First 1
if (-not $buildTools) {
    Write-Host "ERROR: Android build-tools not found" -ForegroundColor Red
    exit 1
}

$zipalign = "$($buildTools.FullName)\zipalign.exe"
$apksigner = "$($buildTools.FullName)\apksigner.bat"
$jarsigner = "$JAVA_HOME\bin\jarsigner.exe"

$fullApkPath = Join-Path $PSScriptRoot $ApkPath
if (-not (Test-Path $fullApkPath)) {
    Write-Host "ERROR: APK not found at $fullApkPath" -ForegroundColor Red
    exit 1
}

$keystore = Join-Path $PSScriptRoot "app\debug.keystore"
$tempAligned = "$fullApkPath.tmp"

Write-Host "Step 1: Aligning APK for ELF alignment..." -ForegroundColor Cyan
& $zipalign -v -p 4 $fullApkPath $tempAligned

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: zipalign failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Replacing original with aligned APK..." -ForegroundColor Cyan
Remove-Item $fullApkPath -Force
Rename-Item $tempAligned $fullApkPath

Write-Host ""
Write-Host "Step 3: Re-signing aligned APK..." -ForegroundColor Cyan
Start-Sleep -Seconds 1

# Use jarsigner (more reliable than apksigner for in-place signing)
& $jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 `
    -keystore $keystore `
    -storepass android `
    -keypass android `
    $fullApkPath androiddebugkey

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "APK ALIGNED AND RE-SIGNED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "File: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
    Write-Host "Location: $fullApkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "ELF alignment check should now pass!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ERROR: Re-signing failed" -ForegroundColor Red
    exit 1
}

# Align and re-sign APK for proper ELF alignment
# This script: 1) zipaligns the APK, 2) re-signs it

param(
    [string]$ApkPath = "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"
)

$ANDROID_HOME = $env:ANDROID_HOME
if (-not $ANDROID_HOME) {
    $ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}

$JAVA_HOME = $env:JAVA_HOME
if (-not $JAVA_HOME) {
    $JAVA_HOME = "C:\Users\david\AppData\Local\Microsoft\jdk-17.0.13.11-hotspot"
}

$buildTools = Get-ChildItem "$ANDROID_HOME\build-tools" | Sort-Object Name -Descending | Select-Object -First 1
if (-not $buildTools) {
    Write-Host "ERROR: Android build-tools not found" -ForegroundColor Red
    exit 1
}

$zipalign = "$($buildTools.FullName)\zipalign.exe"
$apksigner = "$($buildTools.FullName)\apksigner.bat"
$jarsigner = "$JAVA_HOME\bin\jarsigner.exe"

$fullApkPath = Join-Path $PSScriptRoot $ApkPath
if (-not (Test-Path $fullApkPath)) {
    Write-Host "ERROR: APK not found at $fullApkPath" -ForegroundColor Red
    exit 1
}

$keystore = Join-Path $PSScriptRoot "app\debug.keystore"
$tempAligned = "$fullApkPath.tmp"

Write-Host "Step 1: Aligning APK for ELF alignment..." -ForegroundColor Cyan
& $zipalign -v -p 4 $fullApkPath $tempAligned

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: zipalign failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Replacing original with aligned APK..." -ForegroundColor Cyan
Remove-Item $fullApkPath -Force
Rename-Item $tempAligned $fullApkPath

Write-Host ""
Write-Host "Step 3: Re-signing aligned APK..." -ForegroundColor Cyan
Start-Sleep -Seconds 1

# Use jarsigner (more reliable than apksigner for in-place signing)
& $jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 `
    -keystore $keystore `
    -storepass android `
    -keypass android `
    $fullApkPath androiddebugkey

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "APK ALIGNED AND RE-SIGNED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "File: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
    Write-Host "Location: $fullApkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "ELF alignment check should now pass!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ERROR: Re-signing failed" -ForegroundColor Red
    exit 1
}







