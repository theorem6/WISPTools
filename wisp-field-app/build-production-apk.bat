@echo off
echo ==========================================
echo WISP Field App - Production Build
echo ==========================================
echo.
echo Building RELEASE APK with:
echo   - JavaScript bundle included
echo   - Optimized and minified
echo   - Connects to cloud backend
echo   - No Metro bundler required
echo.
echo This may take 3-5 minutes...
echo.

cd /d "%~dp0\android"

echo [Step 1/4] Cleaning previous builds...
call gradlew.bat clean
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Clean failed
    pause
    exit /b 1
)

echo.
echo [Step 2/4] Bundling JavaScript...
echo.

echo [Step 3/4] Compiling native code...
echo.

echo [Step 4/4] Building Release APK...
call gradlew.bat assembleRelease
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo ==========================================
echo BUILD SUCCESSFUL!
echo ==========================================
echo.
echo Your production APK is ready:
echo.
echo   Location:
echo   android\app\build\outputs\apk\release\WISP-Field-App-v1.0.0-release.apk
echo.
echo   Size: ~30-50 MB (optimized)
echo.
echo To install on your device:
echo   1. Copy APK to your phone
echo   2. Open and install (allow unknown sources if needed)
echo.
echo Or use ADB:
echo   adb install -r android\app\build\outputs\apk\release\WISP-Field-App-v1.0.0-release.apk
echo.
echo ==========================================
pause

