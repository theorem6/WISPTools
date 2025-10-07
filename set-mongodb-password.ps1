# Simple PowerShell script to set MongoDB password in apphosting.yaml files

Write-Host "🔐 MongoDB Password Setup" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your MongoDB connection string:"
Write-Host "mongodb+srv://genieacs-user:<db_password>@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
Write-Host ""
Write-Host "Please enter your MongoDB Atlas password for user 'genieacs-user':" -ForegroundColor Yellow

$securePassword = Read-Host -AsSecureString
$MONGODB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)

if ([string]::IsNullOrWhiteSpace($MONGODB_PASSWORD)) {
    Write-Host "❌ Password cannot be empty" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📝 Updating configuration files..." -ForegroundColor Yellow

# Update apphosting.yaml
(Get-Content apphosting.yaml) -replace '<db_password>', $MONGODB_PASSWORD | Set-Content apphosting.yaml
Write-Host "✅ Updated apphosting.yaml" -ForegroundColor Green

# Update apphosting.staging.yaml
(Get-Content apphosting.staging.yaml) -replace '<db_password>', $MONGODB_PASSWORD | Set-Content apphosting.staging.yaml
Write-Host "✅ Updated apphosting.staging.yaml" -ForegroundColor Green

# Update apphosting.development.yaml
(Get-Content apphosting.development.yaml) -replace '<db_password>', $MONGODB_PASSWORD | Set-Content apphosting.development.yaml
Write-Host "✅ Updated apphosting.development.yaml" -ForegroundColor Green

Write-Host ""
Write-Host "✅ All configuration files updated!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Cyan
Write-Host "1. cd functions; npm install"
Write-Host "2. cd ..; firebase deploy"
Write-Host ""
Write-Host "⚠️  Important: Your password is now in the config files." -ForegroundColor Yellow
Write-Host "    Do NOT commit these files to public repositories!"
Write-Host "    Consider using Firebase Secrets for production."
Write-Host ""

