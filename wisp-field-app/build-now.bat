@echo off
echo ========================================
echo Building Android APK
echo ========================================
echo.

set JAVA_HOME=C:\Users\david\AppData\Local\Microsoft\jdk-17.0.13.11-hotspot
set ANDROID_HOME=C:\Users\david\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%PATH%

cd android
echo Java: %JAVA_HOME%
echo Android SDK: %ANDROID_HOME%
echo.
echo Starting build - this will take 3-5 minutes...
echo Please wait for completion...
echo.

call gradlew.bat assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo BUILD SUCCESSFUL!
    echo ========================================
    echo.
    if exist "app\build\outputs\apk\debug\app-debug.apk" (
        echo APK Location: %CD%\app\build\outputs\apk\debug\app-debug.apk
    )
) else (
    echo.
    echo ========================================
    echo BUILD FAILED
    echo ========================================
    echo Check error messages above
)

pause

@echo off
echo ========================================
echo Building Android APK
echo ========================================
echo.

set JAVA_HOME=C:\Users\david\AppData\Local\Microsoft\jdk-17.0.13.11-hotspot
set ANDROID_HOME=C:\Users\david\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%PATH%

cd android
echo Java: %JAVA_HOME%
echo Android SDK: %ANDROID_HOME%
echo.
echo Starting build - this will take 3-5 minutes...
echo Please wait for completion...
echo.

call gradlew.bat assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo BUILD SUCCESSFUL!
    echo ========================================
    echo.
    if exist "app\build\outputs\apk\debug\app-debug.apk" (
        echo APK Location: %CD%\app\build\outputs\apk\debug\app-debug.apk
    )
) else (
    echo.
    echo ========================================
    echo BUILD FAILED
    echo ========================================
    echo Check error messages above
)

pause

@echo off
echo ========================================
echo Building Android APK
echo ========================================
echo.

set JAVA_HOME=C:\Users\david\AppData\Local\Microsoft\jdk-17.0.13.11-hotspot
set ANDROID_HOME=C:\Users\david\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%PATH%

cd android
echo Java: %JAVA_HOME%
echo Android SDK: %ANDROID_HOME%
echo.
echo Starting build - this will take 3-5 minutes...
echo Please wait for completion...
echo.

call gradlew.bat assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo BUILD SUCCESSFUL!
    echo ========================================
    echo.
    if exist "app\build\outputs\apk\debug\app-debug.apk" (
        echo APK Location: %CD%\app\build\outputs\apk\debug\app-debug.apk
    )
) else (
    echo.
    echo ========================================
    echo BUILD FAILED
    echo ========================================
    echo Check error messages above
)

pause







