# Build Android APK Script
# Run this script to build the Android APK with all dependencies

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building Android APK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set Java path
$jdkPath = "$env:LOCALAPPDATA\Microsoft\jdk-17.0.13.11-hotspot"
if (Test-Path "$jdkPath\bin\java.exe") {
    $env:JAVA_HOME = $jdkPath
    $env:PATH = "$jdkPath\bin;$env:PATH"
    Write-Host "✓ Java found: $jdkPath" -ForegroundColor Green
} else {
    Write-Host "✗ Java not found at $jdkPath" -ForegroundColor Red
    exit 1
}

# Set Android SDK
$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $sdkPath) {
    $env:ANDROID_HOME = $sdkPath
    Write-Host "✓ Android SDK found: $sdkPath" -ForegroundColor Green
} else {
    Write-Host "✗ Android SDK not found" -ForegroundColor Red
    exit 1
}

# Ensure local.properties exists
$localProps = "android\local.properties"
if (-not (Test-Path $localProps)) {
    "sdk.dir=$($sdkPath.Replace('\', '\\'))" | Out-File -FilePath $localProps -Encoding ASCII
    Write-Host "✓ Created local.properties" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting Gradle build..." -ForegroundColor Yellow
Write-Host "This will take 3-5 minutes. Please wait..." -ForegroundColor Yellow
Write-Host ""

# Change to android directory and build
Set-Location android
.\gradlew.bat assembleDebug

# Check if build succeeded
if ($LASTEXITCODE -eq 0) {
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $apk = Get-Item $apkPath
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✅ BUILD SUCCESSFUL!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "APK Location: $($apk.FullName)" -ForegroundColor Cyan
        Write-Host "Size: $([math]::Round($apk.Length / 1MB, 2)) MB" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "To install on device:" -ForegroundColor Yellow
        Write-Host "  adb install $($apk.FullName)" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ BUILD FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Check the error messages above" -ForegroundColor Yellow
}

Set-Location ..

# Build Android APK Script
# Run this script to build the Android APK with all dependencies

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building Android APK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set Java path
$jdkPath = "$env:LOCALAPPDATA\Microsoft\jdk-17.0.13.11-hotspot"
if (Test-Path "$jdkPath\bin\java.exe") {
    $env:JAVA_HOME = $jdkPath
    $env:PATH = "$jdkPath\bin;$env:PATH"
    Write-Host "✓ Java found: $jdkPath" -ForegroundColor Green
} else {
    Write-Host "✗ Java not found at $jdkPath" -ForegroundColor Red
    exit 1
}

# Set Android SDK
$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $sdkPath) {
    $env:ANDROID_HOME = $sdkPath
    Write-Host "✓ Android SDK found: $sdkPath" -ForegroundColor Green
} else {
    Write-Host "✗ Android SDK not found" -ForegroundColor Red
    exit 1
}

# Ensure local.properties exists
$localProps = "android\local.properties"
if (-not (Test-Path $localProps)) {
    "sdk.dir=$($sdkPath.Replace('\', '\\'))" | Out-File -FilePath $localProps -Encoding ASCII
    Write-Host "✓ Created local.properties" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting Gradle build..." -ForegroundColor Yellow
Write-Host "This will take 3-5 minutes. Please wait..." -ForegroundColor Yellow
Write-Host ""

# Change to android directory and build
Set-Location android
.\gradlew.bat assembleDebug

# Check if build succeeded
if ($LASTEXITCODE -eq 0) {
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $apk = Get-Item $apkPath
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✅ BUILD SUCCESSFUL!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "APK Location: $($apk.FullName)" -ForegroundColor Cyan
        Write-Host "Size: $([math]::Round($apk.Length / 1MB, 2)) MB" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "To install on device:" -ForegroundColor Yellow
        Write-Host "  adb install $($apk.FullName)" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ BUILD FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Check the error messages above" -ForegroundColor Yellow
}

Set-Location ..

# Build Android APK Script
# Run this script to build the Android APK with all dependencies

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building Android APK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set Java path
$jdkPath = "$env:LOCALAPPDATA\Microsoft\jdk-17.0.13.11-hotspot"
if (Test-Path "$jdkPath\bin\java.exe") {
    $env:JAVA_HOME = $jdkPath
    $env:PATH = "$jdkPath\bin;$env:PATH"
    Write-Host "✓ Java found: $jdkPath" -ForegroundColor Green
} else {
    Write-Host "✗ Java not found at $jdkPath" -ForegroundColor Red
    exit 1
}

# Set Android SDK
$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $sdkPath) {
    $env:ANDROID_HOME = $sdkPath
    Write-Host "✓ Android SDK found: $sdkPath" -ForegroundColor Green
} else {
    Write-Host "✗ Android SDK not found" -ForegroundColor Red
    exit 1
}

# Ensure local.properties exists
$localProps = "android\local.properties"
if (-not (Test-Path $localProps)) {
    "sdk.dir=$($sdkPath.Replace('\', '\\'))" | Out-File -FilePath $localProps -Encoding ASCII
    Write-Host "✓ Created local.properties" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting Gradle build..." -ForegroundColor Yellow
Write-Host "This will take 3-5 minutes. Please wait..." -ForegroundColor Yellow
Write-Host ""

# Change to android directory and build
Set-Location android
.\gradlew.bat assembleDebug

# Check if build succeeded
if ($LASTEXITCODE -eq 0) {
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $apk = Get-Item $apkPath
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✅ BUILD SUCCESSFUL!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "APK Location: $($apk.FullName)" -ForegroundColor Cyan
        Write-Host "Size: $([math]::Round($apk.Length / 1MB, 2)) MB" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "To install on device:" -ForegroundColor Yellow
        Write-Host "  adb install $($apk.FullName)" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ BUILD FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Check the error messages above" -ForegroundColor Yellow
}

Set-Location ..







