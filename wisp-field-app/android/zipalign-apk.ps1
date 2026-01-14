# ZipAlign APK to fix ELF alignment issues
# This script aligns the APK after build to ensure proper ELF alignment

param(
    [string]$ApkPath = "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"
)

$ANDROID_HOME = $env:ANDROID_HOME
if (-not $ANDROID_HOME) {
    $ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}

$buildTools = Get-ChildItem "$ANDROID_HOME\build-tools" | Sort-Object Name -Descending | Select-Object -First 1
if (-not $buildTools) {
    Write-Host "ERROR: Android build-tools not found" -ForegroundColor Red
    exit 1
}

$zipalign = "$($buildTools.FullName)\zipalign.exe"
if (-not (Test-Path $zipalign)) {
    Write-Host "ERROR: zipalign not found at $zipalign" -ForegroundColor Red
    exit 1
}

$fullApkPath = Join-Path $PSScriptRoot $ApkPath
if (-not (Test-Path $fullApkPath)) {
    Write-Host "ERROR: APK not found at $fullApkPath" -ForegroundColor Red
    exit 1
}

$alignedApkPath = $fullApkPath -replace '\.apk$', '-aligned.apk'

Write-Host "Aligning APK..." -ForegroundColor Cyan
Write-Host "  Input:  $fullApkPath" -ForegroundColor Gray
Write-Host "  Output: $alignedApkPath" -ForegroundColor Gray
Write-Host ""

& $zipalign -v -p 4 $fullApkPath $alignedApkPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Alignment successful!" -ForegroundColor Green
    Write-Host "Replacing original APK with aligned version..." -ForegroundColor Cyan
    
    Remove-Item $fullApkPath -Force
    Rename-Item $alignedApkPath $fullApkPath
    
    Write-Host ""
    Write-Host "APK aligned and ready!" -ForegroundColor Green
    Write-Host "Location: $fullApkPath" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR: Alignment failed" -ForegroundColor Red
    exit 1
}

# ZipAlign APK to fix ELF alignment issues
# This script aligns the APK after build to ensure proper ELF alignment

param(
    [string]$ApkPath = "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"
)

$ANDROID_HOME = $env:ANDROID_HOME
if (-not $ANDROID_HOME) {
    $ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}

$buildTools = Get-ChildItem "$ANDROID_HOME\build-tools" | Sort-Object Name -Descending | Select-Object -First 1
if (-not $buildTools) {
    Write-Host "ERROR: Android build-tools not found" -ForegroundColor Red
    exit 1
}

$zipalign = "$($buildTools.FullName)\zipalign.exe"
if (-not (Test-Path $zipalign)) {
    Write-Host "ERROR: zipalign not found at $zipalign" -ForegroundColor Red
    exit 1
}

$fullApkPath = Join-Path $PSScriptRoot $ApkPath
if (-not (Test-Path $fullApkPath)) {
    Write-Host "ERROR: APK not found at $fullApkPath" -ForegroundColor Red
    exit 1
}

$alignedApkPath = $fullApkPath -replace '\.apk$', '-aligned.apk'

Write-Host "Aligning APK..." -ForegroundColor Cyan
Write-Host "  Input:  $fullApkPath" -ForegroundColor Gray
Write-Host "  Output: $alignedApkPath" -ForegroundColor Gray
Write-Host ""

& $zipalign -v -p 4 $fullApkPath $alignedApkPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Alignment successful!" -ForegroundColor Green
    Write-Host "Replacing original APK with aligned version..." -ForegroundColor Cyan
    
    Remove-Item $fullApkPath -Force
    Rename-Item $alignedApkPath $fullApkPath
    
    Write-Host ""
    Write-Host "APK aligned and ready!" -ForegroundColor Green
    Write-Host "Location: $fullApkPath" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR: Alignment failed" -ForegroundColor Red
    exit 1
}

# ZipAlign APK to fix ELF alignment issues
# This script aligns the APK after build to ensure proper ELF alignment

param(
    [string]$ApkPath = "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"
)

$ANDROID_HOME = $env:ANDROID_HOME
if (-not $ANDROID_HOME) {
    $ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}

$buildTools = Get-ChildItem "$ANDROID_HOME\build-tools" | Sort-Object Name -Descending | Select-Object -First 1
if (-not $buildTools) {
    Write-Host "ERROR: Android build-tools not found" -ForegroundColor Red
    exit 1
}

$zipalign = "$($buildTools.FullName)\zipalign.exe"
if (-not (Test-Path $zipalign)) {
    Write-Host "ERROR: zipalign not found at $zipalign" -ForegroundColor Red
    exit 1
}

$fullApkPath = Join-Path $PSScriptRoot $ApkPath
if (-not (Test-Path $fullApkPath)) {
    Write-Host "ERROR: APK not found at $fullApkPath" -ForegroundColor Red
    exit 1
}

$alignedApkPath = $fullApkPath -replace '\.apk$', '-aligned.apk'

Write-Host "Aligning APK..." -ForegroundColor Cyan
Write-Host "  Input:  $fullApkPath" -ForegroundColor Gray
Write-Host "  Output: $alignedApkPath" -ForegroundColor Gray
Write-Host ""

& $zipalign -v -p 4 $fullApkPath $alignedApkPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Alignment successful!" -ForegroundColor Green
    Write-Host "Replacing original APK with aligned version..." -ForegroundColor Cyan
    
    Remove-Item $fullApkPath -Force
    Rename-Item $alignedApkPath $fullApkPath
    
    Write-Host ""
    Write-Host "APK aligned and ready!" -ForegroundColor Green
    Write-Host "Location: $fullApkPath" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERROR: Alignment failed" -ForegroundColor Red
    exit 1
}







