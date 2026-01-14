@echo off
echo WISP Field App ARM64 Installation Script
echo ========================================
echo.

set APK_PATH=%~dp0android\app\build\outputs\apk\debug\app-debug.apk
set ADB_PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools

REM Add ADB to PATH
set PATH=%ADB_PATH%;%PATH%

REM Check if APK exists
if not exist "%APK_PATH%" (
    echo ERROR: APK file not found at %APK_PATH%
    echo Please build the app first with: gradlew.bat :app:assembleDebug
    pause
    exit /b 1
)

echo APK found: %APK_PATH%
echo.

REM Check connected devices
echo Checking connected devices...
adb devices | findstr "device" >nul
if %errorlevel% neq 0 (
    echo No devices connected.
    echo.
    echo To connect your device:
    echo 1. Enable Developer Options on Android device
    echo 2. Enable USB Debugging
    echo 3. Connect via USB: adb devices (should show device)
    echo 4. Enable WiFi ADB: adb tcpip 5555
    echo 5. Disconnect USB cable
    echo 6. Connect via WiFi: adb connect ^<DEVICE_IP^>:5555
    echo.
    pause
    exit /b 1
)

REM Install APK
echo Installing APK...
adb install -r "%APK_PATH%"

if %errorlevel% equ 0 (
    echo.
    echo SUCCESS: APK installed successfully!
    echo.
    echo You can now launch the WISP Field App on your device.
    echo Look for 'WISP Field App' in your app drawer.
) else (
    echo.
    echo ERROR: Installation failed!
)

pause
