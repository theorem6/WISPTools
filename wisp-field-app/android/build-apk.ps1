# Build APK using Android Studio's Gradle with lenient validation
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

Write-Host "Building APK..." -ForegroundColor Green
Write-Host "JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Cyan
Write-Host "ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Cyan

# Build with lenient validation and without daemon
.\gradlew.bat assembleDebug `
    --no-daemon `
    --no-build-cache `
    -Dorg.gradle.warning.mode=none `
    -Pandroid.injected.build.model.only=false `
    -Pandroid.injected.build.model.only.advanced=false `
    -Pandroid.enableAdditionalTestOutput=false

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "APK Location:" -ForegroundColor Yellow
    Write-Host "  $(Resolve-Path 'app\build\outputs\apk\debug\app-debug.apk')" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ BUILD FAILED" -ForegroundColor Red
}

