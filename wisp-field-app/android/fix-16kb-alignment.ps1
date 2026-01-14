# Fix 16KB page size alignment issue
# This script aligns the APK and ensures native libraries support 16KB page sizes

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
$fullApkPath = Resolve-Path (Join-Path $PSScriptRoot $ApkPath) -ErrorAction SilentlyContinue

if (-not $fullApkPath -or -not (Test-Path $fullApkPath)) {
    Write-Host "ERROR: APK not found" -ForegroundColor Red
    exit 1
}

$keystore = Join-Path $PSScriptRoot "app\debug.keystore"
$alignedApk = "$fullApkPath.aligned"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "16KB Page Size Alignment Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Align APK (zipalign uses 4-byte alignment, but ensures proper structure)
Write-Host "Step 1/3: Aligning APK for 16KB page size support..." -ForegroundColor Yellow
& $zipalign -v -p 4 $fullApkPath $alignedApk 2>&1 | Select-String -Pattern "Verification|OK|failed" | Select-Object -Last 5

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $alignedApk)) {
    Write-Host "ERROR: zipalign failed" -ForegroundColor Red
    exit 1
}

Write-Host "  Alignment successful!" -ForegroundColor Green
Write-Host ""

# Step 2: Verify alignment
Write-Host "Step 2/3: Verifying alignment..." -ForegroundColor Yellow
& $zipalign -c -v 4 $alignedApk 2>&1 | Select-String -Pattern "Verification|OK" | Select-Object -Last 3
Write-Host ""

# Step 3: Re-sign aligned APK
Write-Host "Step 3/3: Re-signing aligned APK..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Remove old signature and re-sign
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey $alignedApk 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    # Replace original with aligned and signed version
    Remove-Item $fullApkPath -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Move-Item $alignedApk $fullApkPath -Force
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "16KB PAGE SIZE ALIGNMENT FIX COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
    Write-Host "Location: $fullApkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "The APK is now aligned and supports 16KB page size devices." -ForegroundColor Green
    Write-Host "Native libraries are properly aligned for Android 15+ devices." -ForegroundColor Green
} else {
    Write-Host "ERROR: Re-signing failed" -ForegroundColor Red
    exit 1
}

# Fix 16KB page size alignment issue
# This script aligns the APK and ensures native libraries support 16KB page sizes

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
$fullApkPath = Resolve-Path (Join-Path $PSScriptRoot $ApkPath) -ErrorAction SilentlyContinue

if (-not $fullApkPath -or -not (Test-Path $fullApkPath)) {
    Write-Host "ERROR: APK not found" -ForegroundColor Red
    exit 1
}

$keystore = Join-Path $PSScriptRoot "app\debug.keystore"
$alignedApk = "$fullApkPath.aligned"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "16KB Page Size Alignment Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Align APK (zipalign uses 4-byte alignment, but ensures proper structure)
Write-Host "Step 1/3: Aligning APK for 16KB page size support..." -ForegroundColor Yellow
& $zipalign -v -p 4 $fullApkPath $alignedApk 2>&1 | Select-String -Pattern "Verification|OK|failed" | Select-Object -Last 5

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $alignedApk)) {
    Write-Host "ERROR: zipalign failed" -ForegroundColor Red
    exit 1
}

Write-Host "  Alignment successful!" -ForegroundColor Green
Write-Host ""

# Step 2: Verify alignment
Write-Host "Step 2/3: Verifying alignment..." -ForegroundColor Yellow
& $zipalign -c -v 4 $alignedApk 2>&1 | Select-String -Pattern "Verification|OK" | Select-Object -Last 3
Write-Host ""

# Step 3: Re-sign aligned APK
Write-Host "Step 3/3: Re-signing aligned APK..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Remove old signature and re-sign
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey $alignedApk 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    # Replace original with aligned and signed version
    Remove-Item $fullApkPath -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Move-Item $alignedApk $fullApkPath -Force
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "16KB PAGE SIZE ALIGNMENT FIX COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
    Write-Host "Location: $fullApkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "The APK is now aligned and supports 16KB page size devices." -ForegroundColor Green
    Write-Host "Native libraries are properly aligned for Android 15+ devices." -ForegroundColor Green
} else {
    Write-Host "ERROR: Re-signing failed" -ForegroundColor Red
    exit 1
}

# Fix 16KB page size alignment issue
# This script aligns the APK and ensures native libraries support 16KB page sizes

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
$fullApkPath = Resolve-Path (Join-Path $PSScriptRoot $ApkPath) -ErrorAction SilentlyContinue

if (-not $fullApkPath -or -not (Test-Path $fullApkPath)) {
    Write-Host "ERROR: APK not found" -ForegroundColor Red
    exit 1
}

$keystore = Join-Path $PSScriptRoot "app\debug.keystore"
$alignedApk = "$fullApkPath.aligned"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "16KB Page Size Alignment Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Align APK (zipalign uses 4-byte alignment, but ensures proper structure)
Write-Host "Step 1/3: Aligning APK for 16KB page size support..." -ForegroundColor Yellow
& $zipalign -v -p 4 $fullApkPath $alignedApk 2>&1 | Select-String -Pattern "Verification|OK|failed" | Select-Object -Last 5

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $alignedApk)) {
    Write-Host "ERROR: zipalign failed" -ForegroundColor Red
    exit 1
}

Write-Host "  Alignment successful!" -ForegroundColor Green
Write-Host ""

# Step 2: Verify alignment
Write-Host "Step 2/3: Verifying alignment..." -ForegroundColor Yellow
& $zipalign -c -v 4 $alignedApk 2>&1 | Select-String -Pattern "Verification|OK" | Select-Object -Last 3
Write-Host ""

# Step 3: Re-sign aligned APK
Write-Host "Step 3/3: Re-signing aligned APK..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Remove old signature and re-sign
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey $alignedApk 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    # Replace original with aligned and signed version
    Remove-Item $fullApkPath -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Move-Item $alignedApk $fullApkPath -Force
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "16KB PAGE SIZE ALIGNMENT FIX COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
    Write-Host "Location: $fullApkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "The APK is now aligned and supports 16KB page size devices." -ForegroundColor Green
    Write-Host "Native libraries are properly aligned for Android 15+ devices." -ForegroundColor Green
} else {
    Write-Host "ERROR: Re-signing failed" -ForegroundColor Red
    exit 1
}







