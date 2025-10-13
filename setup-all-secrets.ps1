# Automated Firebase Secrets Setup
# Configures all secrets for the LTE WISP Management Platform

param(
    [string]$MongoDbUri = "",
    [string]$FederatedWirelessKey = ""
)

$PROJECT_ID = "lte-pci-mapper-65450042-bbf71"
$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Firebase Secrets Automated Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $PROJECT_ID" -ForegroundColor Yellow
Write-Host ""

# Function to create secret
function Set-FirebaseSecret {
    param(
        [string]$SecretName,
        [string]$SecretValue,
        [string]$Description
    )
    
    if ([string]::IsNullOrWhiteSpace($SecretValue)) {
        Write-Host "⏭️  Skipping $SecretName (no value provided)" -ForegroundColor Yellow
        return $false
    }
    
    Write-Host "Setting secret: $SecretName..." -ForegroundColor White
    
    try {
        # Check if firebase CLI is available
        $firebasePath = Get-Command firebase -ErrorAction SilentlyContinue
        if (-not $firebasePath) {
            Write-Host "❌ Firebase CLI not found. Please install: npm install -g firebase-tools" -ForegroundColor Red
            return $false
        }
        
        # Set the secret using data-file from stdin
        $SecretValue | firebase functions:secrets:set $SecretName --project=$PROJECT_ID --data-file=- --force 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $SecretName configured successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Failed to set $SecretName" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error setting $SecretName : $_" -ForegroundColor Red
        return $false
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 1: Google SAS Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Google SAS Client Secret
$googleSecret = "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"
$result1 = Set-FirebaseSecret -SecretName "google-sas-client-secret" `
                              -SecretValue $googleSecret `
                              -Description "Google SAS OAuth Client Secret"

Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 2: MongoDB Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrWhiteSpace($MongoDbUri)) {
    Write-Host "⚠️  MongoDB URI not provided" -ForegroundColor Yellow
    Write-Host "   To set MongoDB URI later, run:" -ForegroundColor White
    Write-Host "   'YOUR_MONGODB_URI' | firebase functions:secrets:set mongodb-uri --project=$PROJECT_ID --data-file=-" -ForegroundColor Gray
} else {
    $result2 = Set-FirebaseSecret -SecretName "mongodb-uri" `
                                  -SecretValue $MongoDbUri `
                                  -Description "MongoDB Connection URI for GenieACS"
}

Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 3: Federated Wireless Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ([string]::IsNullOrWhiteSpace($FederatedWirelessKey)) {
    Write-Host "⚠️  Federated Wireless API key not provided" -ForegroundColor Yellow
    Write-Host "   To set Federated Wireless key later, run:" -ForegroundColor White
    Write-Host "   'YOUR_FW_API_KEY' | firebase functions:secrets:set federated-wireless-api-key --project=$PROJECT_ID --data-file=-" -ForegroundColor Gray
} else {
    $result3 = Set-FirebaseSecret -SecretName "federated-wireless-api-key" `
                                  -SecretValue $FederatedWirelessKey `
                                  -Description "Federated Wireless SAS API Key"
}

Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($result1) {
    Write-Host "✅ Google SAS Client Secret: Configured" -ForegroundColor Green
} else {
    Write-Host "❌ Google SAS Client Secret: Failed or Skipped" -ForegroundColor Red
}

if ([string]::IsNullOrWhiteSpace($MongoDbUri)) {
    Write-Host "⏭️  MongoDB URI: Not provided (optional)" -ForegroundColor Yellow
} else {
    if ($result2) {
        Write-Host "✅ MongoDB URI: Configured" -ForegroundColor Green
    } else {
        Write-Host "❌ MongoDB URI: Failed" -ForegroundColor Red
    }
}

if ([string]::IsNullOrWhiteSpace($FederatedWirelessKey)) {
    Write-Host "⏭️  Federated Wireless API Key: Not provided (optional)" -ForegroundColor Yellow
} else {
    if ($result3) {
        Write-Host "✅ Federated Wireless API Key: Configured" -ForegroundColor Green
    } else {
        Write-Host "❌ Federated Wireless API Key: Failed" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($result1) {
    Write-Host "1. Uncomment secrets in Module_Manager/apphosting.yaml:" -ForegroundColor Yellow
    Write-Host "   - GOOGLE_SAS_CLIENT_SECRET" -ForegroundColor White
    if ($result2) {
        Write-Host "   - MONGODB_URI" -ForegroundColor White
    }
    if ($result3) {
        Write-Host "   - FEDERATED_WIRELESS_API_KEY" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "2. Commit and push changes:" -ForegroundColor Yellow
    Write-Host "   git add Module_Manager/apphosting.yaml" -ForegroundColor White
    Write-Host "   git commit -m 'config: Enable configured secrets'" -ForegroundColor White
    Write-Host "   git push origin main" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Deploy:" -ForegroundColor Yellow
    Write-Host "   firebase deploy --only apphosting" -ForegroundColor White
    Write-Host ""
    Write-Host "4. Configure Platform Keys in UI:" -ForegroundColor Yellow
    Write-Host "   - Go to: Tenant Management > CBRS Platform Keys" -ForegroundColor White
    Write-Host "   - Enter Client ID: 1044782186913-7ukvo096g0r9oal2lg2tehiunae49ceq.apps.googleusercontent.com" -ForegroundColor White
    Write-Host "   - Save" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Usage instructions
Write-Host "Usage Examples:" -ForegroundColor Cyan
Write-Host ""
Write-Host "With MongoDB URI:" -ForegroundColor White
Write-Host "  .\setup-all-secrets.ps1 -MongoDbUri 'mongodb+srv://user:pass@cluster.mongodb.net/db'" -ForegroundColor Gray
Write-Host ""
Write-Host "With Federated Wireless:" -ForegroundColor White
Write-Host "  .\setup-all-secrets.ps1 -FederatedWirelessKey 'fw_live_abc123...'" -ForegroundColor Gray
Write-Host ""
Write-Host "With both:" -ForegroundColor White
Write-Host "  .\setup-all-secrets.ps1 -MongoDbUri 'mongodb+srv://...' -FederatedWirelessKey 'fw_live_...'" -ForegroundColor Gray
Write-Host ""

