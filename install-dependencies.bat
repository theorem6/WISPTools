@echo off
echo 📦 Installing Node.js and Dependencies for LTE PCI Mapper...

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed
    echo.
    echo 📋 Please install Node.js first:
    echo 1. Go to https://nodejs.org/
    echo 2. Download LTS version (Node.js 20.x)
    echo 3. Run the installer
    echo 4. Restart Command Prompt
    echo 5. Run this script again
    echo.
    pause
    exit /b 1
)

:: Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed
    echo Please reinstall Node.js
    pause
    exit /b 1
)

echo ✅ Node.js and npm found

:: Display versions
for /f "tokens=*" %%i in ('node --version') do echo 📋 Node.js version: %%i
for /f "tokens=*" %%i in ('npm --version') do echo 📋 npm version: %%i

:: Check if package.json exists
if not exist "package.json" (
    echo ❌ package.json not found
    echo Please run this script from the project directory
    pause
    exit /b 1
)

echo ✅ package.json found

:: Install dependencies
echo 📦 Installing dependencies...
echo This may take a few minutes...
npm install --legacy-peer-deps

if %errorlevel% neq 0 (
    echo ❌ Dependency installation failed
    echo 💡 Try: npm install --force
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully

:: Display installed packages
echo 📋 Installed packages:
npm list --depth=0

:: Type check
echo 🔍 Running type checking...
npm run check

if %errorlevel% neq 0 (
    echo ⚠️ Type checking found issues, but continuing...
)

:: Build project
echo 🔨 Building project...
npm run build

if %errorlevel% neq 0 (
    echo ❌ Build failed
    echo 💡 Check the errors above
    pause
    exit /b 1
)

echo ✅ Build successful!

:: Start development server
echo 🚀 Starting development server...
echo 📍 App will be available at: http://localhost:5173
echo Press Ctrl+C to stop the server
echo.
npm run dev
