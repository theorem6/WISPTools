# Script to link existing documentation files to docs-site structure
# This creates symbolic links or copies files from docs/ to docs-site/

param(
    [switch]$Copy = $false  # Use Copy instead of symlinks (for Windows compatibility)
)

$ErrorActionPreference = "Continue"

# Get paths
$rootDir = Split-Path -Parent $PSScriptRoot
$docsRoot = Join-Path (Split-Path -Parent $rootDir) "docs"
$docsSite = $rootDir

Write-Host "Linking documentation files..." -ForegroundColor Cyan
Write-Host "Source: $docsRoot" -ForegroundColor Gray
Write-Host "Destination: $docsSite" -ForegroundColor Gray
Write-Host ""

# Function to create link or copy
function Link-Doc {
    param(
        [string]$Source,
        [string]$Dest
    )
    
    $destDir = Split-Path -Parent $Dest
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    
    if (Test-Path $Source) {
        if ($Copy) {
            Copy-Item -Path $Source -Destination $Dest -Force
            Write-Host "  ✅ Copied: $Source → $Dest" -ForegroundColor Green
        } else {
            # Try symlink first, fallback to copy on Windows
            try {
                if (Test-Path $Dest) {
                    Remove-Item $Dest -Force
                }
                New-Item -ItemType SymbolicLink -Path $Dest -Target $Source -Force | Out-Null
                Write-Host "  ✅ Linked: $Source → $Dest" -ForegroundColor Green
            } catch {
                Copy-Item -Path $Source -Destination $Dest -Force
                Write-Host "  ✅ Copied (symlink failed): $Source → $Dest" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "  ⚠️  Source not found: $Source" -ForegroundColor Yellow
    }
}

# Link key guide files
Write-Host "Linking guide files..." -ForegroundColor Yellow

# Admin guides
Link-Doc -Source (Join-Path $docsRoot "guides\MULTI_TENANT_SETUP_GUIDE.md") -Dest (Join-Path $docsSite "guides\admin-guides\multi-tenant-setup.md")
Link-Doc -Source (Join-Path $docsRoot "guides\ADMIN_AND_USER_MANAGEMENT.md") -Dest (Join-Path $docsSite "guides\admin-guides\admin-user-management.md")
Link-Doc -Source (Join-Path $docsRoot "hss\HSS_PRODUCTION_GUIDE.md") -Dest (Join-Path $docsSite "guides\admin-guides\hss-production.md")

Write-Host ""
Write-Host "✅ Documentation linking complete!" -ForegroundColor Green

