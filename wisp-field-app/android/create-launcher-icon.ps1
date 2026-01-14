# Create WISPTools Field Tool Launcher Icon
# Generates PNG icons from the vector logo for Android launcher

Add-Type -AssemblyName System.Drawing

$resPath = "app\src\main\res"

# Define icon sizes for different densities
$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

function Create-IconFromLogo {
    param (
        [int]$size,
        [string]$outputPath
    )
    
    # Create bitmap with transparent background
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)
    
    # Black background (as per branding requirements)
    $blackBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 23, 42)) # #0f172a
    $graphics.FillEllipse($blackBrush, 0, 0, $size, $size)
    
    # Draw hexagonal border
    $cyanPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(0, 217, 255), [Math]::Max(2, $size/60)) # #00d9ff
    $cyanPen.Width = [Math]::Max(2, $size/60)
    
    $centerX = $size / 2
    $centerY = $size / 2
    $radius = $size * 0.35
    
    # Hexagon points
    $points = New-Object System.Drawing.PointF[](6)
    for ($i = 0; $i -lt 6; $i++) {
        $angle = [Math]::PI / 3 * $i - [Math]::PI / 6
        $points[$i] = New-Object System.Drawing.PointF(
            $centerX + $radius * [Math]::Cos($angle),
            $centerY + $radius * [Math]::Sin($angle)
        )
    }
    
    $graphics.DrawPolygon($cyanPen, $points)
    
    # Draw the pixelated 'W' with gradient (green to blue)
    $wBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Point]::new(0, 0),
        [System.Drawing.Point]::new($size, $size),
        [System.Drawing.Color]::FromArgb(16, 185, 129), # #10b981 (green)
        [System.Drawing.Color]::FromArgb(59, 130, 246)  # #3b82f6 (blue)
    )
    
    $wWidth = $size * 0.4
    $wHeight = $size * 0.3
    $wX = $centerX - $wWidth / 2
    $wY = $centerY - $wHeight / 2
    $blockSize = $wWidth / 5
    
    # Draw pixelated W (5 vertical blocks)
    $graphics.FillRectangle($wBrush, $wX, $wY, $blockSize, $wHeight)
    $graphics.FillRectangle($wBrush, $wX + $blockSize, $wY + $wHeight * 0.5, $blockSize, $wHeight * 0.5)
    $graphics.FillRectangle($wBrush, $wX + $blockSize * 2, $wY, $blockSize, $wHeight)
    $graphics.FillRectangle($wBrush, $wX + $blockSize * 3, $wY + $wHeight * 0.5, $blockSize, $wHeight * 0.5)
    $graphics.FillRectangle($wBrush, $wX + $blockSize * 4, $wY, $blockSize, $wHeight)
    
    # Save as PNG
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $graphics.Dispose()
    $bitmap.Dispose()
    $blackBrush.Dispose()
    $cyanPen.Dispose()
    $wBrush.Dispose()
}

Write-Host "🎨 Generating WISPTools Field Tool Launcher Icons..." -ForegroundColor Cyan

foreach ($density in $sizes.Keys) {
    $size = $sizes[$density]
    $dir = Join-Path $resPath $density
    
    # Create directory if it doesn't exist
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    
    # Create launcher icon
    $iconPath = Join-Path $dir "ic_launcher.png"
    Create-IconFromLogo -size $size -outputPath $iconPath
    $dimensions = "$size" + "x" + "$size"
    Write-Host "  ✅ Created $density ($dimensions px)" -ForegroundColor Green
    
    # Copy for round icon
    $roundIconPath = Join-Path $dir "ic_launcher_round.png"
    Copy-Item $iconPath $roundIconPath -Force
}

Write-Host ""
Write-Host "✅ All launcher icons generated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Icons created for:" -ForegroundColor Yellow
Write-Host "   - MDPI (48x48)"
Write-Host "   - HDPI (72x72)"
Write-Host "   - XHDPI (96x96)"
Write-Host "   - XXHDPI (144x144)"
Write-Host "   - XXXHDPI (192x192)"
