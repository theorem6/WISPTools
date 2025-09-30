# PowerShell Script to Update Dependencies
# LTE PCI Conflict Mapper - Dependency Update Script

Write-Host "🚀 Starting LTE PCI Mapper Dependency Update..." -ForegroundColor Green

# Function to check if command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Check if npm is available
if (-not (Test-Command "npm")) {
    Write-Host "❌ npm is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ npm found" -ForegroundColor Green

# Check Node.js version
$nodeVersion = node --version
Write-Host "📋 Node.js version: $nodeVersion" -ForegroundColor Cyan

# Check npm version
$npmVersion = npm --version
Write-Host "📋 npm version: $npmVersion" -ForegroundColor Cyan

# Backup current state
Write-Host "💾 Creating backup..." -ForegroundColor Yellow
git add .
git commit -m "Backup before dependency update - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Remove old dependencies
Write-Host "🗑️ Removing old dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
    Write-Host "✅ Removed node_modules" -ForegroundColor Green
}

if (Test-Path "package-lock.json") {
    Remove-Item -Force "package-lock.json"
    Write-Host "✅ Removed package-lock.json" -ForegroundColor Green
}

# Install npm-check-updates globally if not present
Write-Host "📦 Installing npm-check-updates..." -ForegroundColor Yellow
npm install -g npm-check-updates

# Update package.json to latest versions
Write-Host "🔄 Updating package.json to latest versions..." -ForegroundColor Yellow
npx npm-check-updates -u

# Install updated dependencies
Write-Host "📥 Installing updated dependencies..." -ForegroundColor Yellow
npm install

# Run type checking
Write-Host "🔍 Running type checking..." -ForegroundColor Yellow
npm run check

# Build project
Write-Host "🔨 Building project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful!" -ForegroundColor Green
    
    # Start development server
    Write-Host "🚀 Starting development server..." -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
    npm run dev
} else {
    Write-Host "❌ Build failed! Please check the errors above." -ForegroundColor Red
    Write-Host "💡 Try running 'npm run force-install' to reset" -ForegroundColor Yellow
}

Write-Host "🎉 Dependency update completed!" -ForegroundColor Green
