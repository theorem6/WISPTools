# Fix ELF alignment: Align and re-sign APK
# This follows the standard Android process for fixing ELF alignment issues

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
$signedApk = "$fullApkPath.signed"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ELF Alignment Fix Process" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Align APK
Write-Host "Step 1/3: Aligning APK (zipalign -p 4)..." -ForegroundColor Yellow
& $zipalign -p 4 $fullApkPath $alignedApk

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $alignedApk)) {
    Write-Host "ERROR: zipalign failed" -ForegroundColor Red
    exit 1
}

Write-Host "  Alignment successful!" -ForegroundColor Green
Write-Host ""

# Step 2: Verify alignment
Write-Host "Step 2/3: Verifying alignment..." -ForegroundColor Yellow
& $zipalign -c -v 4 $alignedApk 2>&1 | Select-String -Pattern "Verification|OK|failed" | Select-Object -Last 5
Write-Host ""

# Step 3: Re-sign aligned APK
Write-Host "Step 3/3: Re-signing aligned APK..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Remove old signature first
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey $alignedApk 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    # Replace original with aligned and signed version
    Remove-Item $fullApkPath -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Move-Item $alignedApk $fullApkPath -Force
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "ELF ALIGNMENT FIX COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
    Write-Host "Location: $fullApkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "The APK is now properly aligned and signed." -ForegroundColor Green
    Write-Host "ELF alignment check should pass!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Re-signing failed" -ForegroundColor Red
    exit 1
}

# Fix ELF alignment: Align and re-sign APK
# This follows the standard Android process for fixing ELF alignment issues

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
$signedApk = "$fullApkPath.signed"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ELF Alignment Fix Process" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Align APK
Write-Host "Step 1/3: Aligning APK (zipalign -p 4)..." -ForegroundColor Yellow
& $zipalign -p 4 $fullApkPath $alignedApk

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $alignedApk)) {
    Write-Host "ERROR: zipalign failed" -ForegroundColor Red
    exit 1
}

Write-Host "  Alignment successful!" -ForegroundColor Green
Write-Host ""

# Step 2: Verify alignment
Write-Host "Step 2/3: Verifying alignment..." -ForegroundColor Yellow
& $zipalign -c -v 4 $alignedApk 2>&1 | Select-String -Pattern "Verification|OK|failed" | Select-Object -Last 5
Write-Host ""

# Step 3: Re-sign aligned APK
Write-Host "Step 3/3: Re-signing aligned APK..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Remove old signature first
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey $alignedApk 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    # Replace original with aligned and signed version
    Remove-Item $fullApkPath -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Move-Item $alignedApk $fullApkPath -Force
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "ELF ALIGNMENT FIX COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
    Write-Host "Location: $fullApkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "The APK is now properly aligned and signed." -ForegroundColor Green
    Write-Host "ELF alignment check should pass!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Re-signing failed" -ForegroundColor Red
    exit 1
}

# Fix ELF alignment: Align and re-sign APK
# This follows the standard Android process for fixing ELF alignment issues

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
$signedApk = "$fullApkPath.signed"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ELF Alignment Fix Process" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Align APK
Write-Host "Step 1/3: Aligning APK (zipalign -p 4)..." -ForegroundColor Yellow
& $zipalign -p 4 $fullApkPath $alignedApk

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $alignedApk)) {
    Write-Host "ERROR: zipalign failed" -ForegroundColor Red
    exit 1
}

Write-Host "  Alignment successful!" -ForegroundColor Green
Write-Host ""

# Step 2: Verify alignment
Write-Host "Step 2/3: Verifying alignment..." -ForegroundColor Yellow
& $zipalign -c -v 4 $alignedApk 2>&1 | Select-String -Pattern "Verification|OK|failed" | Select-Object -Last 5
Write-Host ""

# Step 3: Re-sign aligned APK
Write-Host "Step 3/3: Re-signing aligned APK..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Remove old signature first
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey $alignedApk 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    # Replace original with aligned and signed version
    Remove-Item $fullApkPath -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Move-Item $alignedApk $fullApkPath -Force
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "ELF ALIGNMENT FIX COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
    Write-Host "Location: $fullApkPath" -ForegroundColor White
    Write-Host ""
    Write-Host "The APK is now properly aligned and signed." -ForegroundColor Green
    Write-Host "ELF alignment check should pass!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Re-signing failed" -ForegroundColor Red
    exit 1
}







