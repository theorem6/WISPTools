@echo off
echo ========================================
echo Building Standalone WISP Field APK
echo ========================================
echo.
echo This creates an APK with JavaScript bundled
echo No Metro bundler needed - connects to cloud backend
echo.

cd /d "%~dp0"

echo [1/3] Cleaning previous builds...
call gradlew clean

echo.
echo [2/3] Bundling JavaScript and building APK...
call gradlew assembleRelease

echo.
echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo.
echo Your APK is ready at:
echo   app\build\outputs\apk\release\WISP-Field-App-v1.0.0-release.apk
echo.
echo Install with:
echo   adb install -r app\build\outputs\apk\release\WISP-Field-App-v1.0.0-release.apk
echo.
pause

