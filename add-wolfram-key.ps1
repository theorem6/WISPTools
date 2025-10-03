# PowerShell script to add Wolfram Alpha API key to .env

Write-Host "🔑 Adding Wolfram Alpha API Key to .env..." -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found!" -ForegroundColor Yellow
    Write-Host "Creating new .env file..." -ForegroundColor Cyan
    
    # Create from template
    Copy-Item "env.example" ".env"
    Write-Host "✅ Created .env from env.example" -ForegroundColor Green
}

# Read current .env content
$envContent = Get-Content ".env" -Raw

# Check if Wolfram key already exists
if ($envContent -match "PUBLIC_WOLFRAM_APP_ID") {
    Write-Host "ℹ️  Wolfram Alpha key already configured in .env" -ForegroundColor Yellow
    
    # Update the value
    $envContent = $envContent -replace 'PUBLIC_WOLFRAM_APP_ID=".*"', 'PUBLIC_WOLFRAM_APP_ID="WQPAJ72446"'
    $envContent = $envContent -replace 'PUBLIC_WOLFRAM_APP_ID=.*', 'PUBLIC_WOLFRAM_APP_ID="WQPAJ72446"'
    $envContent | Set-Content ".env" -NoNewline
    
    Write-Host "✅ Updated Wolfram Alpha key to: WQPAJ72446" -ForegroundColor Green
} else {
    Write-Host "Adding Wolfram Alpha configuration..." -ForegroundColor Cyan
    
    # Find where to insert (before Development Settings)
    if ($envContent -match "# Development Settings") {
        $envContent = $envContent -replace "(# Development Settings)", "# Wolfram Alpha Configuration`r`nPUBLIC_WOLFRAM_APP_ID=`"WQPAJ72446`"`r`n`r`n`$1"
    } else {
        # Append to end
        $envContent += "`r`n`r`n# Wolfram Alpha Configuration`r`nPUBLIC_WOLFRAM_APP_ID=`"WQPAJ72446`"`r`n"
    }
    
    $envContent | Set-Content ".env" -NoNewline
    Write-Host "✅ Added Wolfram Alpha key: WQPAJ72446" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart your dev server: npm run dev"
Write-Host "2. Test optimization with Wolfram validation"
Write-Host "3. Check console for Wolfram query logs"
Write-Host ""
Write-Host "✨ Wolfram Alpha API is now configured!" -ForegroundColor Green
Write-Host ""

