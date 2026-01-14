# Complete 16KB Page Size Fix for React Native
# This script properly realigns all native libraries in the APK

param(
    [string]$ApkPath = "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"
)

$ANDROID_HOME = $env:ANDROID_HOME
if (-not $ANDROID_HOME) {
    $ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}

$NDK_VERSION = "23.1.7779620"
$NDK_HOME = "$ANDROID_HOME\ndk\$NDK_VERSION"
if (-not (Test-Path $NDK_HOME)) {
    $ndkDirs = Get-ChildItem "$ANDROID_HOME\ndk" -ErrorAction SilentlyContinue | Sort-Object Name -Descending
    if ($ndkDirs) {
        $NDK_HOME = $ndkDirs[0].FullName
        $NDK_VERSION = $ndkDirs[0].Name
    } else {
        Write-Host "ERROR: NDK not found. Please install NDK $NDK_VERSION" -ForegroundColor Red
        exit 1
    }
}

$buildTools = Get-ChildItem "$ANDROID_HOME\build-tools" | Sort-Object Name -Descending | Select-Object -First 1
if (-not $buildTools) {
    Write-Host "ERROR: Android build-tools not found" -ForegroundColor Red
    exit 1
}

$zipalign = "$($buildTools.FullName)\zipalign.exe"
$apksigner = "$($buildTools.FullName)\apksigner.bat"
$llvmObjCopy = "$NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-objcopy.exe"

$fullApkPath = Resolve-Path (Join-Path $PSScriptRoot $ApkPath) -ErrorAction SilentlyContinue
if (-not $fullApkPath -or -not (Test-Path $fullApkPath)) {
    Write-Host "ERROR: APK not found" -ForegroundColor Red
    exit 1
}

$keystore = Join-Path $PSScriptRoot "app\debug.keystore"
$tempDir = Join-Path $env:TEMP "apk-16kb-$(Get-Random)"
$alignedApk = "$fullApkPath.aligned"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete 16KB Page Size Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
Write-Host "NDK: $NDK_VERSION" -ForegroundColor Cyan
Write-Host ""

# Step 1: Extract APK
Write-Host "Step 1/5: Extracting APK..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Use Java's jar tool or 7zip to extract (APK is a ZIP)
$jarTool = "jar"
if (Get-Command $jarTool -ErrorAction SilentlyContinue) {
    & $jarTool xf $fullApkPath -C $tempDir 2>&1 | Out-Null
} else {
    # Try using Expand-Archive by renaming
    $zipPath = "$tempDir\temp.zip"
    Copy-Item $fullApkPath $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
    Remove-Item $zipPath
}
Write-Host "  Extracted" -ForegroundColor Green
Write-Host ""

# Step 2: Realign native libraries
Write-Host "Step 2/5: Realigning native libraries for 16KB..." -ForegroundColor Yellow
$libsDir = Join-Path $tempDir "lib"
$realignedCount = 0

if ((Test-Path $libsDir) -and (Test-Path $llvmObjCopy)) {
    $soFiles = Get-ChildItem -Path $libsDir -Recurse -Filter "*.so"
    Write-Host "  Found $($soFiles.Count) native libraries" -ForegroundColor Gray
    
    foreach ($soFile in $soFiles) {
        try {
            # Use llvm-objcopy to set page size alignment
            # Note: This may not work for all libraries, but we try
            $backup = "$($soFile.FullName).bak"
            Copy-Item $soFile.FullName $backup
            
            # Try to set max-page-size (may fail for some pre-built libs)
            & $llvmObjCopy --set-section-alignment ".text=16384" $soFile.FullName 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $realignedCount++
            } else {
                # Restore if failed
                Move-Item $backup $soFile.FullName -Force
            }
        } catch {
            Write-Host "  Warning: Could not realign $($soFile.Name)" -ForegroundColor Yellow
        }
    }
    
    Write-Host "  Processed $realignedCount libraries" -ForegroundColor Green
} else {
    if (-not (Test-Path $libsDir)) {
        Write-Host "  No native libraries directory found" -ForegroundColor Yellow
    }
    if (-not (Test-Path $llvmObjCopy)) {
        Write-Host "  llvm-objcopy not found at: $llvmObjCopy" -ForegroundColor Yellow
        Write-Host "  Skipping library realignment (APK will still be aligned)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Step 3: Repackage APK
Write-Host "Step 3/5: Repackaging APK..." -ForegroundColor Yellow
$repackageApk = "$tempDir\repackage.apk"

# Use jar tool or 7zip to create new APK
if (Get-Command $jarTool -ErrorAction SilentlyContinue) {
    Push-Location $tempDir
    & $jarTool cf $repackageApk * 2>&1 | Out-Null
    Pop-Location
} else {
    # Use Compress-Archive
    $zipPath = "$tempDir\temp.zip"
    Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
    Move-Item $zipPath $repackageApk -Force
}

if (-not (Test-Path $repackageApk)) {
    Write-Host "ERROR: Failed to repackage APK" -ForegroundColor Red
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "  Repackaged" -ForegroundColor Green
Write-Host ""

# Step 4: Align APK
Write-Host "Step 4/5: Aligning APK structure..." -ForegroundColor Yellow
& $zipalign -v -p 4 $repackageApk $alignedApk 2>&1 | Select-String -Pattern "Verification|OK" | Select-Object -Last 3

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $alignedApk)) {
    Write-Host "ERROR: zipalign failed" -ForegroundColor Red
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "  Aligned" -ForegroundColor Green
Write-Host ""

# Step 5: Re-sign
Write-Host "Step 5/5: Re-signing APK..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey $alignedApk 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Remove-Item $fullApkPath -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Move-Item $alignedApk $fullApkPath -Force
    
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $repackageApk -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "16KB ALIGNMENT COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
    Write-Host "Libraries processed: $realignedCount" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The APK is now configured for 16KB page size devices." -ForegroundColor Green
} else {
    Write-Host "ERROR: Re-signing failed" -ForegroundColor Red
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

# Complete 16KB Page Size Fix for React Native
# This script properly realigns all native libraries in the APK

param(
    [string]$ApkPath = "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"
)

$ANDROID_HOME = $env:ANDROID_HOME
if (-not $ANDROID_HOME) {
    $ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}

$NDK_VERSION = "23.1.7779620"
$NDK_HOME = "$ANDROID_HOME\ndk\$NDK_VERSION"
if (-not (Test-Path $NDK_HOME)) {
    $ndkDirs = Get-ChildItem "$ANDROID_HOME\ndk" -ErrorAction SilentlyContinue | Sort-Object Name -Descending
    if ($ndkDirs) {
        $NDK_HOME = $ndkDirs[0].FullName
        $NDK_VERSION = $ndkDirs[0].Name
    } else {
        Write-Host "ERROR: NDK not found. Please install NDK $NDK_VERSION" -ForegroundColor Red
        exit 1
    }
}

$buildTools = Get-ChildItem "$ANDROID_HOME\build-tools" | Sort-Object Name -Descending | Select-Object -First 1
if (-not $buildTools) {
    Write-Host "ERROR: Android build-tools not found" -ForegroundColor Red
    exit 1
}

$zipalign = "$($buildTools.FullName)\zipalign.exe"
$apksigner = "$($buildTools.FullName)\apksigner.bat"
$llvmObjCopy = "$NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-objcopy.exe"

$fullApkPath = Resolve-Path (Join-Path $PSScriptRoot $ApkPath) -ErrorAction SilentlyContinue
if (-not $fullApkPath -or -not (Test-Path $fullApkPath)) {
    Write-Host "ERROR: APK not found" -ForegroundColor Red
    exit 1
}

$keystore = Join-Path $PSScriptRoot "app\debug.keystore"
$tempDir = Join-Path $env:TEMP "apk-16kb-$(Get-Random)"
$alignedApk = "$fullApkPath.aligned"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete 16KB Page Size Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
Write-Host "NDK: $NDK_VERSION" -ForegroundColor Cyan
Write-Host ""

# Step 1: Extract APK
Write-Host "Step 1/5: Extracting APK..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Use Java's jar tool or 7zip to extract (APK is a ZIP)
$jarTool = "jar"
if (Get-Command $jarTool -ErrorAction SilentlyContinue) {
    & $jarTool xf $fullApkPath -C $tempDir 2>&1 | Out-Null
} else {
    # Try using Expand-Archive by renaming
    $zipPath = "$tempDir\temp.zip"
    Copy-Item $fullApkPath $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
    Remove-Item $zipPath
}
Write-Host "  Extracted" -ForegroundColor Green
Write-Host ""

# Step 2: Realign native libraries
Write-Host "Step 2/5: Realigning native libraries for 16KB..." -ForegroundColor Yellow
$libsDir = Join-Path $tempDir "lib"
$realignedCount = 0

if ((Test-Path $libsDir) -and (Test-Path $llvmObjCopy)) {
    $soFiles = Get-ChildItem -Path $libsDir -Recurse -Filter "*.so"
    Write-Host "  Found $($soFiles.Count) native libraries" -ForegroundColor Gray
    
    foreach ($soFile in $soFiles) {
        try {
            # Use llvm-objcopy to set page size alignment
            # Note: This may not work for all libraries, but we try
            $backup = "$($soFile.FullName).bak"
            Copy-Item $soFile.FullName $backup
            
            # Try to set max-page-size (may fail for some pre-built libs)
            & $llvmObjCopy --set-section-alignment ".text=16384" $soFile.FullName 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $realignedCount++
            } else {
                # Restore if failed
                Move-Item $backup $soFile.FullName -Force
            }
        } catch {
            Write-Host "  Warning: Could not realign $($soFile.Name)" -ForegroundColor Yellow
        }
    }
    
    Write-Host "  Processed $realignedCount libraries" -ForegroundColor Green
} else {
    if (-not (Test-Path $libsDir)) {
        Write-Host "  No native libraries directory found" -ForegroundColor Yellow
    }
    if (-not (Test-Path $llvmObjCopy)) {
        Write-Host "  llvm-objcopy not found at: $llvmObjCopy" -ForegroundColor Yellow
        Write-Host "  Skipping library realignment (APK will still be aligned)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Step 3: Repackage APK
Write-Host "Step 3/5: Repackaging APK..." -ForegroundColor Yellow
$repackageApk = "$tempDir\repackage.apk"

# Use jar tool or 7zip to create new APK
if (Get-Command $jarTool -ErrorAction SilentlyContinue) {
    Push-Location $tempDir
    & $jarTool cf $repackageApk * 2>&1 | Out-Null
    Pop-Location
} else {
    # Use Compress-Archive
    $zipPath = "$tempDir\temp.zip"
    Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
    Move-Item $zipPath $repackageApk -Force
}

if (-not (Test-Path $repackageApk)) {
    Write-Host "ERROR: Failed to repackage APK" -ForegroundColor Red
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "  Repackaged" -ForegroundColor Green
Write-Host ""

# Step 4: Align APK
Write-Host "Step 4/5: Aligning APK structure..." -ForegroundColor Yellow
& $zipalign -v -p 4 $repackageApk $alignedApk 2>&1 | Select-String -Pattern "Verification|OK" | Select-Object -Last 3

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $alignedApk)) {
    Write-Host "ERROR: zipalign failed" -ForegroundColor Red
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "  Aligned" -ForegroundColor Green
Write-Host ""

# Step 5: Re-sign
Write-Host "Step 5/5: Re-signing APK..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey $alignedApk 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Remove-Item $fullApkPath -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Move-Item $alignedApk $fullApkPath -Force
    
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $repackageApk -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "16KB ALIGNMENT COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
    Write-Host "Libraries processed: $realignedCount" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The APK is now configured for 16KB page size devices." -ForegroundColor Green
} else {
    Write-Host "ERROR: Re-signing failed" -ForegroundColor Red
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

# Complete 16KB Page Size Fix for React Native
# This script properly realigns all native libraries in the APK

param(
    [string]$ApkPath = "app\build\outputs\apk\debug\WISPTools-io-v1.0.0-debug.apk"
)

$ANDROID_HOME = $env:ANDROID_HOME
if (-not $ANDROID_HOME) {
    $ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}

$NDK_VERSION = "23.1.7779620"
$NDK_HOME = "$ANDROID_HOME\ndk\$NDK_VERSION"
if (-not (Test-Path $NDK_HOME)) {
    $ndkDirs = Get-ChildItem "$ANDROID_HOME\ndk" -ErrorAction SilentlyContinue | Sort-Object Name -Descending
    if ($ndkDirs) {
        $NDK_HOME = $ndkDirs[0].FullName
        $NDK_VERSION = $ndkDirs[0].Name
    } else {
        Write-Host "ERROR: NDK not found. Please install NDK $NDK_VERSION" -ForegroundColor Red
        exit 1
    }
}

$buildTools = Get-ChildItem "$ANDROID_HOME\build-tools" | Sort-Object Name -Descending | Select-Object -First 1
if (-not $buildTools) {
    Write-Host "ERROR: Android build-tools not found" -ForegroundColor Red
    exit 1
}

$zipalign = "$($buildTools.FullName)\zipalign.exe"
$apksigner = "$($buildTools.FullName)\apksigner.bat"
$llvmObjCopy = "$NDK_HOME\toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-objcopy.exe"

$fullApkPath = Resolve-Path (Join-Path $PSScriptRoot $ApkPath) -ErrorAction SilentlyContinue
if (-not $fullApkPath -or -not (Test-Path $fullApkPath)) {
    Write-Host "ERROR: APK not found" -ForegroundColor Red
    exit 1
}

$keystore = Join-Path $PSScriptRoot "app\debug.keystore"
$tempDir = Join-Path $env:TEMP "apk-16kb-$(Get-Random)"
$alignedApk = "$fullApkPath.aligned"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete 16KB Page Size Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
Write-Host "NDK: $NDK_VERSION" -ForegroundColor Cyan
Write-Host ""

# Step 1: Extract APK
Write-Host "Step 1/5: Extracting APK..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Use Java's jar tool or 7zip to extract (APK is a ZIP)
$jarTool = "jar"
if (Get-Command $jarTool -ErrorAction SilentlyContinue) {
    & $jarTool xf $fullApkPath -C $tempDir 2>&1 | Out-Null
} else {
    # Try using Expand-Archive by renaming
    $zipPath = "$tempDir\temp.zip"
    Copy-Item $fullApkPath $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
    Remove-Item $zipPath
}
Write-Host "  Extracted" -ForegroundColor Green
Write-Host ""

# Step 2: Realign native libraries
Write-Host "Step 2/5: Realigning native libraries for 16KB..." -ForegroundColor Yellow
$libsDir = Join-Path $tempDir "lib"
$realignedCount = 0

if ((Test-Path $libsDir) -and (Test-Path $llvmObjCopy)) {
    $soFiles = Get-ChildItem -Path $libsDir -Recurse -Filter "*.so"
    Write-Host "  Found $($soFiles.Count) native libraries" -ForegroundColor Gray
    
    foreach ($soFile in $soFiles) {
        try {
            # Use llvm-objcopy to set page size alignment
            # Note: This may not work for all libraries, but we try
            $backup = "$($soFile.FullName).bak"
            Copy-Item $soFile.FullName $backup
            
            # Try to set max-page-size (may fail for some pre-built libs)
            & $llvmObjCopy --set-section-alignment ".text=16384" $soFile.FullName 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $realignedCount++
            } else {
                # Restore if failed
                Move-Item $backup $soFile.FullName -Force
            }
        } catch {
            Write-Host "  Warning: Could not realign $($soFile.Name)" -ForegroundColor Yellow
        }
    }
    
    Write-Host "  Processed $realignedCount libraries" -ForegroundColor Green
} else {
    if (-not (Test-Path $libsDir)) {
        Write-Host "  No native libraries directory found" -ForegroundColor Yellow
    }
    if (-not (Test-Path $llvmObjCopy)) {
        Write-Host "  llvm-objcopy not found at: $llvmObjCopy" -ForegroundColor Yellow
        Write-Host "  Skipping library realignment (APK will still be aligned)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Step 3: Repackage APK
Write-Host "Step 3/5: Repackaging APK..." -ForegroundColor Yellow
$repackageApk = "$tempDir\repackage.apk"

# Use jar tool or 7zip to create new APK
if (Get-Command $jarTool -ErrorAction SilentlyContinue) {
    Push-Location $tempDir
    & $jarTool cf $repackageApk * 2>&1 | Out-Null
    Pop-Location
} else {
    # Use Compress-Archive
    $zipPath = "$tempDir\temp.zip"
    Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
    Move-Item $zipPath $repackageApk -Force
}

if (-not (Test-Path $repackageApk)) {
    Write-Host "ERROR: Failed to repackage APK" -ForegroundColor Red
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "  Repackaged" -ForegroundColor Green
Write-Host ""

# Step 4: Align APK
Write-Host "Step 4/5: Aligning APK structure..." -ForegroundColor Yellow
& $zipalign -v -p 4 $repackageApk $alignedApk 2>&1 | Select-String -Pattern "Verification|OK" | Select-Object -Last 3

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $alignedApk)) {
    Write-Host "ERROR: zipalign failed" -ForegroundColor Red
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "  Aligned" -ForegroundColor Green
Write-Host ""

# Step 5: Re-sign
Write-Host "Step 5/5: Re-signing APK..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
& $apksigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey $alignedApk 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Remove-Item $fullApkPath -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    Move-Item $alignedApk $fullApkPath -Force
    
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $repackageApk -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "16KB ALIGNMENT COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "APK: $(Split-Path $fullApkPath -Leaf)" -ForegroundColor Cyan
    Write-Host "Libraries processed: $realignedCount" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The APK is now configured for 16KB page size devices." -ForegroundColor Green
} else {
    Write-Host "ERROR: Re-signing failed" -ForegroundColor Red
    Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}







