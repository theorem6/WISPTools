# Clear Metro bundler cache
Write-Host "Clearing Metro cache..." -ForegroundColor Cyan

# Stop any running Metro processes
$metroProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*metro*" }
if ($metroProcesses) {
    Write-Host "Stopping Metro processes..." -ForegroundColor Yellow
    $metroProcesses | Stop-Process -Force
}

# Clear Metro cache
$cachePaths = @(
    "$PSScriptRoot\node_modules\.cache",
    "$PSScriptRoot\.metro",
    "$env:TEMP\metro-*",
    "$env:TEMP\haste-map-*"
)

foreach ($path in $cachePaths) {
    if (Test-Path $path) {
        Write-Host "Removing: $path" -ForegroundColor Yellow
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Clear watchman if installed
if (Get-Command watchman -ErrorAction SilentlyContinue) {
    Write-Host "Clearing Watchman cache..." -ForegroundColor Yellow
    watchman watch-del-all 2>$null
}

Write-Host ""
Write-Host "Metro cache cleared!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start Metro: npm start -- --reset-cache" -ForegroundColor White
Write-Host "  2. In another terminal, build: cd android && .\gradlew.bat assembleDebug" -ForegroundColor White

# Clear Metro bundler cache
Write-Host "Clearing Metro cache..." -ForegroundColor Cyan

# Stop any running Metro processes
$metroProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*metro*" }
if ($metroProcesses) {
    Write-Host "Stopping Metro processes..." -ForegroundColor Yellow
    $metroProcesses | Stop-Process -Force
}

# Clear Metro cache
$cachePaths = @(
    "$PSScriptRoot\node_modules\.cache",
    "$PSScriptRoot\.metro",
    "$env:TEMP\metro-*",
    "$env:TEMP\haste-map-*"
)

foreach ($path in $cachePaths) {
    if (Test-Path $path) {
        Write-Host "Removing: $path" -ForegroundColor Yellow
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Clear watchman if installed
if (Get-Command watchman -ErrorAction SilentlyContinue) {
    Write-Host "Clearing Watchman cache..." -ForegroundColor Yellow
    watchman watch-del-all 2>$null
}

Write-Host ""
Write-Host "Metro cache cleared!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start Metro: npm start -- --reset-cache" -ForegroundColor White
Write-Host "  2. In another terminal, build: cd android && .\gradlew.bat assembleDebug" -ForegroundColor White

# Clear Metro bundler cache
Write-Host "Clearing Metro cache..." -ForegroundColor Cyan

# Stop any running Metro processes
$metroProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*metro*" }
if ($metroProcesses) {
    Write-Host "Stopping Metro processes..." -ForegroundColor Yellow
    $metroProcesses | Stop-Process -Force
}

# Clear Metro cache
$cachePaths = @(
    "$PSScriptRoot\node_modules\.cache",
    "$PSScriptRoot\.metro",
    "$env:TEMP\metro-*",
    "$env:TEMP\haste-map-*"
)

foreach ($path in $cachePaths) {
    if (Test-Path $path) {
        Write-Host "Removing: $path" -ForegroundColor Yellow
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Clear watchman if installed
if (Get-Command watchman -ErrorAction SilentlyContinue) {
    Write-Host "Clearing Watchman cache..." -ForegroundColor Yellow
    watchman watch-del-all 2>$null
}

Write-Host ""
Write-Host "Metro cache cleared!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start Metro: npm start -- --reset-cache" -ForegroundColor White
Write-Host "  2. In another terminal, build: cd android && .\gradlew.bat assembleDebug" -ForegroundColor White







