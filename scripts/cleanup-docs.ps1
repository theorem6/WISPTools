# Documentation Cleanup Script (PowerShell version)
# This script organizes documentation files and archives temporary scripts
# Based on DOCUMENTATION_CLEANUP_PLAN.md

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WISPTools Documentation Cleanup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create archive directories
Write-Host "[1/6] Creating archive directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "docs\archive\scripts" | Out-Null
New-Item -ItemType Directory -Force -Path "docs\archive\temporary" | Out-Null
New-Item -ItemType Directory -Force -Path "docs\status" | Out-Null
Write-Host "  ✅ Archive directories created" -ForegroundColor Green

# Archive one-time cleanup scripts
Write-Host "[2/6] Archiving one-time cleanup scripts..." -ForegroundColor Yellow
if (Test-Path "backend-services\scripts\remove-david-4gengineer-email.js") {
  Move-Item -Path "backend-services\scripts\remove-david-4gengineer-email.js" -Destination "docs\archive\scripts\" -Force
  Write-Host "  ✅ Archived remove-david-4gengineer-email.js" -ForegroundColor Green
}

if (Test-Path "backend-services\scripts\clear-subdomains.js") {
  Move-Item -Path "backend-services\scripts\clear-subdomains.js" -Destination "docs\archive\scripts\" -Force
  Write-Host "  ✅ Archived clear-subdomains.js" -ForegroundColor Green
}

# Remove temporary root-level scripts
Write-Host "[3/6] Removing temporary root-level scripts..." -ForegroundColor Yellow
$temporaryScripts = @(
  "check_api_request.js",
  "check_graph_logs.sh",
  "comprehensive_graph_diagnostic.js",
  "diagnose_graphs.js",
  "test_device_query.js",
  "test_graph_api.js",
  "test-backend-update-generation.js",
  "test-login-fixes.js",
  "verify_api_call.js"
)

$removedCount = 0
foreach ($script in $temporaryScripts) {
  if (Test-Path $script) {
    Remove-Item $script -Force
    Write-Host "  ✅ Removed $script" -ForegroundColor Green
    $removedCount++
  }
}
if ($removedCount -eq 0) {
  Write-Host "  ℹ️  No temporary scripts found to remove" -ForegroundColor Gray
}

# Move status reports
Write-Host "[4/6] Moving status reports to docs/status/..." -ForegroundColor Yellow
$statusFiles = @(
  "DEPLOYMENT_STATUS.md",
  "DEPLOYMENT_COMPLETE.md",
  "DEPLOYMENT_COMPLETE_EMPTY_STATE.md",
  "DEPLOYMENT_FINAL_STATUS.md",
  "ENHANCED_LOGGING_DEPLOYED.md",
  "GRAPH_DEBUG_SUMMARY.md",
  "GRAPH_FIX_DEPLOYED.md",
  "GRAPH_ISSUE_ROOT_CAUSE.md"
)

$movedCount = 0
foreach ($file in $statusFiles) {
  if (Test-Path $file) {
    Move-Item -Path $file -Destination "docs\status\" -Force
    Write-Host "  ✅ Moved $file → docs/status/" -ForegroundColor Green
    $movedCount++
  }
}
if ($movedCount -eq 0) {
  Write-Host "  ℹ️  No status files found to move" -ForegroundColor Gray
}

# Move fix summaries
Write-Host "[5/6] Moving fix summaries to docs/fixes/..." -ForegroundColor Yellow
$fixFiles = @(
  "COMPREHENSIVE_FIX_SUMMARY.md",
  "ROOT_CAUSE_AND_FIX.md",
  "API_STATUS_AND_FIXES.md",
  "API_CLIENT_AND_FIX_STATUS.md"
)

$movedCount = 0
foreach ($file in $fixFiles) {
  if (Test-Path $file) {
    Move-Item -Path $file -Destination "docs\fixes\" -Force
    Write-Host "  ✅ Moved $file → docs/fixes/" -ForegroundColor Green
    $movedCount++
  }
}
if ($movedCount -eq 0) {
  Write-Host "  ℹ️  No fix files found to move" -ForegroundColor Gray
}

# Move temporary/historical docs to archive
Write-Host "[6/6] Moving temporary docs to archive/..." -ForegroundColor Yellow
$archiveFiles = @(
  "ANSWERS_TO_YOUR_QUESTIONS.md",
  "IMMEDIATE_ANSWERS.md",
  "IMMEDIATE_ACTION_REQUIRED.md",
  "URGENT_FIX_PLAN.md",
  "FINAL_ANALYSIS_AND_ACTION_PLAN.md",
  "COMPREHENSIVE_CODEBASE_AUDIT_REPORT.md",
  "DEPENDENCY_ANALYSIS_REPORT.md",
  "REPOSITORY_CLEANUP_ANALYSIS.md"
)

$movedCount = 0
foreach ($file in $archiveFiles) {
  if (Test-Path $file) {
    Move-Item -Path $file -Destination "docs\archive\temporary\" -Force
    Write-Host "  ✅ Moved $file → docs/archive/temporary/" -ForegroundColor Green
    $movedCount++
  }
}
if ($movedCount -eq 0) {
  Write-Host "  ℹ️  No archive files found to move" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Cleanup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  - Archived scripts: docs/archive/scripts/" -ForegroundColor White
Write-Host "  - Status reports: docs/status/" -ForegroundColor White
Write-Host "  - Fix summaries: docs/fixes/" -ForegroundColor White
Write-Host "  - Historical docs: docs/archive/temporary/" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review moved files" -ForegroundColor White
Write-Host "  2. Update any hardcoded file paths" -ForegroundColor White
Write-Host "  3. Commit changes" -ForegroundColor White
Write-Host ""

