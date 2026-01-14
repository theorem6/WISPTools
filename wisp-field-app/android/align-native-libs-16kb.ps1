param(
  [string]$ApkPath = "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"
)

$ANDROID_HOME = $env:ANDROID_HOME
if (-not $ANDROID_HOME) { $ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }

$NDK_HOME = "$ANDROID_HOME\ndk\23.1.7779620"
if (-not (Test-Path $NDK_HOME)) {
  $ndkDirs = Get-ChildItem "$ANDROID_HOME\ndk" -ErrorAction SilentlyContinue | Sort-Object Name -Descending
  if ($ndkDirs) { $NDK_HOME = $ndkDirs[0].FullName } else { Write-Host "ERROR: NDK not found" -ForegroundColor Red; exit 1 }
}

$buildTools = Get-ChildItem "$ANDROID_HOME\build-tools" | Sort-Object Name -Descending | Select-Object -First 1
if (-not $buildTools) { Write-Host "ERROR: Android build-tools not found" -ForegroundColor Red; exit 1 }

$zipalign = "$($buildTools.FullName)\zipalign.exe"
$apksigner = "$($buildTools.FullName)\apksigner.bat"
$llvmReadObj = "$NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-readobj.exe"

$fullApkPath = Resolve-Path (Join-Path $PSScriptRoot $ApkPath) -ErrorAction SilentlyContinue
if (-not $fullApkPath -or -not (Test-Path $fullApkPath)) { Write-Host "ERROR: APK not found" -ForegroundColor Red; exit 1 }

$keystore = Join-Path $PSScriptRoot "app\debug.keystore"
$tempDir = Join-Path $env:TEMP "apk-align-$(Get-Random)"
$alignedApk = "$fullApkPath.aligned"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "16KB Page Size Alignment" -ForegroundColor Cyan
Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Extract APK (for inspection only)
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Expand-Archive -Path $fullApkPath -DestinationPath $tempDir -Force

# Step 2: Report ELF p_align values (best-effort)
$libsDir = Join-Path $tempDir "lib"
if (Test-Path $libsDir -and (Test-Path $llvmReadObj)) {
  Get-ChildItem -Path $libsDir -Recurse -Filter "*.so" | ForEach-Object {
    $out = & $llvmReadObj -l $_.FullName 2>&1 | Select-String "Align"
    $needs = $out -notmatch "16384"
    Write-Host ("{0} -> {1}" -f $_.Name, ($(if ($needs) { "ALIGN < 16384" } else { "OK" })))
  }
}

# Step 3: 16KB zip alignment
Write-Host "Aligning APK (zipalign -p 16384)..." -ForegroundColor Yellow
& $zipalign -v -p 16384 $fullApkPath $alignedApk 2>&1 | Select-String -Pattern "Verification|OK|failed" | Select-Object -Last 5
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $alignedApk)) { Write-Host "ERROR: zipalign failed" -ForegroundColor Red; Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue; exit 1 }

# Step 4: Re-sign
Write-Host "Re-signing aligned APK..." -ForegroundColor Yellow
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey $alignedApk 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Re-signing failed" -ForegroundColor Red; Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue; exit 1 }

# Swap files
Remove-Item $fullApkPath -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Move-Item $alignedApk $fullApkPath -Force
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Done. APK realigned and re-signed." -ForegroundColor Green




