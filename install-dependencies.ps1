# PowerShell Script to Install Node.js and Dependencies

Write-Host "📦 Installing Node.js and Dependencies for LTE PCI Mapper..." -ForegroundColor Green

# Function to check if command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Check if Node.js is installed
if (-not (Test-Command "node")) {
    Write-Host "❌ Node.js is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 Please install Node.js first:" -ForegroundColor Yellow
    Write-Host "1. Go to https://nodejs.org/" -ForegroundColor Cyan
    Write-Host "2. Download LTS version (Node.js 20.x)" -ForegroundColor Cyan
    Write-Host "3. Run the installer" -ForegroundColor Cyan
    Write-Host "4. Restart PowerShell" -ForegroundColor Cyan
    Write-Host "5. Run this script again" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is installed
if (-not (Test-Command "npm")) {
    Write-Host "❌ npm is not installed" -ForegroundColor Red
    Write-Host "Please reinstall Node.js" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Node.js and npm found" -ForegroundColor Green

# Display versions
$nodeVersion = node --version
$npmVersion = npm --version
Write-Host "📋 Node.js version: $nodeVersion" -ForegroundColor Cyan
Write-Host "📋 npm version: $npmVersion" -ForegroundColor Cyan

# Check if package.json exists
if (-not (Test-Path "package.json")) {
    Write-Host "❌ package.json not found" -ForegroundColor Red
    Write-Host "Please run this script from the project directory" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ package.json found" -ForegroundColor Green

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Yellow
npm install --legacy-peer-deps

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Dependency installation failed" -ForegroundColor Red
    Write-Host "💡 Try: npm install --force" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green

# Display installed packages
Write-Host "📋 Installed packages:" -ForegroundColor Cyan
npm list --depth=0

# Type check
Write-Host "🔍 Running type checking..." -ForegroundColor Yellow
npm run check

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Type checking found issues, but continuing..." -ForegroundColor Yellow
}

# Build project
Write-Host "🔨 Building project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    Write-Host "💡 Check the errors above" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green

# Start development server
Write-Host "🚀 Starting development server..." -ForegroundColor Green
Write-Host "📍 App will be available at: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""
npm run dev
