# Create launcher icons using ImageMagick or fallback to copying from React Native template
$resPath = "app\src\main\res"

# Icon sizes for each density
$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

Write-Host "Creating launcher icons..." -ForegroundColor Cyan

# Try to copy from React Native's default icons if they exist
$rnIconPath = "..\..\node_modules\react-native\template\android\app\src\main\res"

if (Test-Path $rnIconPath) {
    Write-Host "Copying default React Native icons..." -ForegroundColor Yellow
    Copy-Item -Path "$rnIconPath\mipmap-*" -Destination $resPath -Recurse -Force
    Write-Host "✅ Icons copied successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  React Native template icons not found" -ForegroundColor Yellow
    Write-Host "Creating placeholder icons..." -ForegroundColor Yellow
    
    # Create a simple strings.xml for app name
    @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">WISP Field App</string>
</resources>
"@ | Out-File -FilePath "$resPath\values\strings.xml" -Encoding UTF8
    
    Write-Host "ℹ️  Please add launcher icons manually or use Android Studio's Image Asset tool" -ForegroundColor Cyan
    Write-Host "   Right-click res → New → Image Asset in Android Studio" -ForegroundColor Cyan
}

Write-Host "Done!" -ForegroundColor Green

