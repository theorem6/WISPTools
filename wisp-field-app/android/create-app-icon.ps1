# Create WISP Field App Icon
# Generates launcher icons for Android

Add-Type -AssemblyName System.Drawing

$outputDir = "app\src\main\res"

# Define icon sizes for different densities
$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

function Create-Icon {
    param (
        [int]$size,
        [string]$outputPath
    )
    
    # Create bitmap
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    
    # Background - Purple gradient
    $brush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(124, 58, 237))  # Purple
    $brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(99, 102, 241))  # Indigo
    
    # Fill background with gradient effect
    $graphics.FillEllipse($brush1, 0, 0, $size, $size)
    
    # Add white signal waves/tower icon
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(2, $size/24))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    
    $centerX = $size / 2
    $centerY = $size / 2
    
    # Draw antenna tower (vertical line)
    $towerHeight = $size * 0.5
    $graphics.DrawLine($pen, $centerX, $centerY - $towerHeight/2, $centerX, $centerY + $towerHeight/2)
    
    # Draw signal waves (3 arcs on each side)
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1.5, $size/32))
    
    for ($i = 1; $i -le 3; $i++) {
        $arcSize = $size * 0.15 * $i
        $x = $centerX - $arcSize
        $y = $centerY - $arcSize
        
        # Left arc
        $graphics.DrawArc($whitePen, $x, $y, $arcSize * 2, $arcSize * 2, 135, 90)
        
        # Right arc  
        $graphics.DrawArc($whitePen, $x, $y, $arcSize * 2, $arcSize * 2, -45, 90)
    }
    
    # Save
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $bitmap.Dispose()
    $brush1.Dispose()
    $brush2.Dispose()
    $pen.Dispose()
    $whitePen.Dispose()
}

Write-Host "🎨 Generating WISP Field App Icons..." -ForegroundColor Cyan

foreach ($density in $sizes.Keys) {
    $size = $sizes[$density]
    $dir = Join-Path $outputDir $density
    
    # Create directory if it doesn't exist
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    
    # Create launcher icon
    $iconPath = Join-Path $dir "ic_launcher.png"
    Create-Icon -size $size -outputPath $iconPath
    $dimensions = "$size" + "x" + "$size"
    Write-Host "  Created $density ($dimensions px)" -ForegroundColor Green
    
    # Copy for round icon
    $roundIconPath = Join-Path $dir "ic_launcher_round.png"
    Copy-Item $iconPath $roundIconPath -Force
}

Write-Host "All icons generated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Icons created for:" -ForegroundColor Yellow
Write-Host "   - MDPI (48x48)"
Write-Host "   - HDPI (72x72)"
Write-Host "   - XHDPI (96x96)"
Write-Host "   - XXHDPI (144x144)"
Write-Host "   - XXXHDPI (192x192)"

