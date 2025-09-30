@echo off
echo 🚀 Starting LTE PCI Mapper Dependency Update...

:: Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ npm found

:: Display versions
for /f "tokens=*" %%i in ('node --version') do echo 📋 Node.js version: %%i
for /f "tokens=*" %%i in ('npm --version') do echo 📋 npm version: %%i

:: Backup current state
echo 💾 Creating backup...
git add .
git commit -m "Backup before dependency update - %date% %time%"

:: Remove old dependencies
echo 🗑️ Removing old dependencies...
if exist "node_modules" (
    rmdir /s /q "node_modules"
    echo ✅ Removed node_modules
)

if exist "package-lock.json" (
    del "package-lock.json"
    echo ✅ Removed package-lock.json
)

:: Install npm-check-updates
echo 📦 Installing npm-check-updates...
npm install -g npm-check-updates

:: Update package.json
echo 🔄 Updating package.json to latest versions...
npx npm-check-updates -u

:: Install dependencies
echo 📥 Installing updated dependencies...
npm install

:: Type check
echo 🔍 Running type checking...
npm run check

:: Build project
echo 🔨 Building project...
npm run build

if %errorlevel% equ 0 (
    echo ✅ Build successful!
    echo 🚀 Starting development server...
    echo Press Ctrl+C to stop the server
    npm run dev
) else (
    echo ❌ Build failed! Please check the errors above.
    echo 💡 Try running 'npm run force-install' to reset
)

echo 🎉 Dependency update completed!
pause
