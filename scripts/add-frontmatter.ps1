# Script to add frontmatter to documentation files
# This script analyzes markdown files and adds appropriate frontmatter

param(
    [string]$FilePath,
    [string]$Category = "",
    [string]$Subcategory = "",
    [string]$Title = "",
    [string]$Description = ""
)

$ErrorActionPreference = "Continue"

function Add-Frontmatter {
    param(
        [string]$File,
        [hashtable]$Metadata
    )
    
    $content = Get-Content -Path $File -Raw
    
    # Check if frontmatter already exists
    if ($content -match '^---\s*\r?\n.*?\r?\n---\s*\r?\n') {
        Write-Host "  ℹ️  Frontmatter already exists in $File" -ForegroundColor Gray
        return
    }
    
    # Extract title from first H1 if not provided
    if (-not $Metadata.Title) {
        if ($content -match '^#\s+(.+)$') {
            $Metadata.Title = $matches[1].Trim()
        } else {
            $Metadata.Title = (Get-Item $File).BaseName -replace '_', ' ' -replace '-', ' '
            $Metadata.Title = (Get-Culture).TextInfo.ToTitleCase($Metadata.Title.ToLower())
        }
    }
    
    # Generate description if not provided
    if (-not $Metadata.Description) {
        # Try to extract from first paragraph
        if ($content -match '(?s)---\s*\r?\n---\s*\r?\n\s*(.+?)\r?\n\r?\n') {
            $firstPara = $matches[1].Trim()
            if ($firstPara.Length -gt 200) {
                $Metadata.Description = $firstPara.Substring(0, 200) + "..."
            } else {
                $Metadata.Description = $firstPara
            }
        } else {
            $Metadata.Description = "Documentation for " + $Metadata.Title
        }
    }
    
    # Build frontmatter
    $frontmatter = @"
---
title: "$($Metadata.Title)"
description: "$($Metadata.Description)"
category: "$($Metadata.Category)"
$(if ($Metadata.Subcategory) { "subcategory: `"$($Metadata.Subcategory)`"`r`n" }else { "" })tags: [$($Metadata.Tags -join ', ')]
last_updated: "$(Get-Date -Format 'yyyy-MM-dd')"
author: "Documentation Team"
difficulty: "$($Metadata.Difficulty)"
audience: "$($Metadata.Audience)"
---

"@
    
    # Add frontmatter to content
    $newContent = $frontmatter + $content
    
    # Write back to file
    Set-Content -Path $File -Value $newContent -NoNewline
    Write-Host "  ✅ Added frontmatter to $File" -ForegroundColor Green
}

# Main execution
if ($FilePath) {
    if (Test-Path $FilePath) {
        $metadata = @{
            Category = if ($Category) { $Category } else { "guides" }
            Subcategory = $Subcategory
            Title = $Title
            Description = $Description
            Tags = @("documentation")
            Difficulty = "intermediate"
            Audience = "all"
        }
        
        Add-Frontmatter -File $FilePath -Metadata $metadata
    } else {
        Write-Host "File not found: $FilePath" -ForegroundColor Red
    }
} else {
    Write-Host "Usage: .\add-frontmatter.ps1 -FilePath <path> [-Category <category>] [-Subcategory <subcategory>] [-Title <title>] [-Description <description>]" -ForegroundColor Yellow
}

