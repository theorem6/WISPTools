---
title: Documentation Cleanup Plan
description: Plan for cleaning up temporary scripts and organizing documentation files.
---

# Documentation Cleanup Plan

**Date:** 2025-12-19  
**Purpose:** Detailed plan for cleaning up temporary scripts and organizing documentation files

---

## Scripts Cleanup

### Temporary Scripts to Archive/Remove

#### Root Directory (Temporary Debug/Test Scripts)

**Files to Remove:**
```bash
# Debug/test scripts
check_api_request.js
check_graph_logs.sh
comprehensive_graph_diagnostic.js
diagnose_graphs.js
test_device_query.js
test_graph_api.js
test-backend-update-generation.js
test-login-fixes.js
verify_api_call.js
```

**Action:** Delete these files (they were for temporary debugging)

#### backend-services/scripts (One-Time Cleanup Scripts)

**Files to Archive:**
```bash
# One-time cleanup scripts (completed, archive for reference)
remove-david-4gengineer-email.js  # ✅ Completed cleanup
clear-subdomains.js                # ✅ Completed cleanup
```

**Action:** Move to `docs/archive/scripts/` for reference

**Files to Review:**
```bash
# Review if still needed
cleanup-test-data.js              # Keep if needed for testing
cleanup-fake-data.js              # Review - remove if not needed
cleanup-firestore-test-data.js    # Remove if Firestore not used
```

### Operational Scripts (KEEP)

All other scripts in `backend-services/scripts/` are operational and should be kept:
- Deployment scripts
- Database maintenance scripts
- EPC management scripts
- Monitoring scripts
- Diagnostic scripts (regularly used)

---

## Documentation File Organization

### Root-Level Markdown Files

#### Move to `docs/status/` (Status Reports)

```bash
DEPLOYMENT_STATUS.md
DEPLOYMENT_COMPLETE.md
DEPLOYMENT_COMPLETE_EMPTY_STATE.md
DEPLOYMENT_FINAL_STATUS.md
ENHANCED_LOGGING_DEPLOYED.md
GRAPH_DEBUG_SUMMARY.md
GRAPH_FIX_DEPLOYED.md
GRAPH_ISSUE_ROOT_CAUSE.md
```

#### Move to `docs/fixes/` (Fix Summaries)

```bash
COMPREHENSIVE_FIX_SUMMARY.md
ROOT_CAUSE_AND_FIX.md
API_STATUS_AND_FIXES.md
API_CLIENT_AND_FIX_STATUS.md
```

#### Move to `docs/archive/` (Temporary/Historical)

```bash
ANSWERS_TO_YOUR_QUESTIONS.md
IMMEDIATE_ANSWERS.md
IMMEDIATE_ACTION_REQUIRED.md
URGENT_FIX_PLAN.md
FINAL_ANALYSIS_AND_ACTION_PLAN.md
COMPREHENSIVE_CODEBASE_AUDIT_REPORT.md
DEPENDENCY_ANALYSIS_REPORT.md
REPOSITORY_CLEANUP_ANALYSIS.md
```

#### Move to `docs/guides/` (Guides)

```bash
BACKEND_DEPLOYMENT_INSTRUCTIONS.md  # Or docs/deployment/
CHECK_LOGS_GUIDE.md
CHECK_NETWORK_TAB.md
DEBUG_INSTRUCTIONS.md
TROUBLESHOOTING_GUIDE.md
EPC_UPDATE_GUIDE.md
GIT_BASED_UPDATE_SYSTEM.md
REMOTE_AGENT_UPDATE_GUIDE.md
UPDATE_REMOTE_EPC_AGENT.md
UPDATE_EPC_SNMP_DISCOVERY.md
```

#### Move to `docs/deployment/` (Deployment Guides)

```bash
BACKEND_DEPLOYMENT_INSTRUCTIONS.md
FORCE_SNMP_SCAN.md
MANUAL_AGENT_UPDATE_COMMAND.md
MANUAL_EPC_UPDATE_COMMANDS.md
QUICK_EPC_UPDATE.txt  # Convert to .md
VERIFY_UPDATE.txt     # Convert to .md
```

#### Keep in Root (High-Level Documentation)

```bash
README.md           # Main project readme
ARCHITECTURE.md     # High-level architecture (consider moving to docs/guides/)
```

---

## Cleanup Script

### Script: `scripts/cleanup-docs.sh`

```bash
#!/bin/bash
# Documentation Cleanup Script
# This script organizes documentation files and archives temporary scripts

set -e

echo "========================================"
echo "WISPTools Documentation Cleanup"
echo "========================================"
echo ""

# Create archive directories
echo "[1/6] Creating archive directories..."
mkdir -p docs/archive/scripts
mkdir -p docs/status
mkdir -p docs/archive/temporary

# Archive one-time cleanup scripts
echo "[2/6] Archiving one-time cleanup scripts..."
if [ -f "backend-services/scripts/remove-david-4gengineer-email.js" ]; then
  mv backend-services/scripts/remove-david-4gengineer-email.js docs/archive/scripts/
  echo "  ✅ Archived remove-david-4gengineer-email.js"
fi

if [ -f "backend-services/scripts/clear-subdomains.js" ]; then
  mv backend-services/scripts/clear-subdomains.js docs/archive/scripts/
  echo "  ✅ Archived clear-subdomains.js"
fi

# Remove temporary root-level scripts
echo "[3/6] Removing temporary root-level scripts..."
TEMPORARY_SCRIPTS=(
  "check_api_request.js"
  "check_graph_logs.sh"
  "comprehensive_graph_diagnostic.js"
  "diagnose_graphs.js"
  "test_device_query.js"
  "test_graph_api.js"
  "test-backend-update-generation.js"
  "test-login-fixes.js"
  "verify_api_call.js"
)

for script in "${TEMPORARY_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    rm -f "$script"
    echo "  ✅ Removed $script"
  fi
done

# Move status reports
echo "[4/6] Moving status reports to docs/status/..."
STATUS_FILES=(
  "DEPLOYMENT_STATUS.md"
  "DEPLOYMENT_COMPLETE.md"
  "DEPLOYMENT_COMPLETE_EMPTY_STATE.md"
  "DEPLOYMENT_FINAL_STATUS.md"
  "ENHANCED_LOGGING_DEPLOYED.md"
  "GRAPH_DEBUG_SUMMARY.md"
  "GRAPH_FIX_DEPLOYED.md"
  "GRAPH_ISSUE_ROOT_CAUSE.md"
)

for file in "${STATUS_FILES[@]}"; do
  if [ -f "$file" ]; then
    mv "$file" docs/status/
    echo "  ✅ Moved $file → docs/status/"
  fi
done

# Move fix summaries
echo "[5/6] Moving fix summaries to docs/fixes/..."
FIX_FILES=(
  "COMPREHENSIVE_FIX_SUMMARY.md"
  "ROOT_CAUSE_AND_FIX.md"
  "API_STATUS_AND_FIXES.md"
  "API_CLIENT_AND_FIX_STATUS.md"
)

for file in "${FIX_FILES[@]}"; do
  if [ -f "$file" ]; then
    mv "$file" docs/fixes/
    echo "  ✅ Moved $file → docs/fixes/"
  fi
done

# Move temporary/historical docs to archive
echo "[6/6] Moving temporary docs to archive/..."
ARCHIVE_FILES=(
  "ANSWERS_TO_YOUR_QUESTIONS.md"
  "IMMEDIATE_ANSWERS.md"
  "IMMEDIATE_ACTION_REQUIRED.md"
  "URGENT_FIX_PLAN.md"
  "FINAL_ANALYSIS_AND_ACTION_PLAN.md"
  "COMPREHENSIVE_CODEBASE_AUDIT_REPORT.md"
  "DEPENDENCY_ANALYSIS_REPORT.md"
  "REPOSITORY_CLEANUP_ANALYSIS.md"
)

for file in "${ARCHIVE_FILES[@]}"; do
  if [ -f "$file" ]; then
    mv "$file" docs/archive/temporary/
    echo "  ✅ Moved $file → docs/archive/temporary/"
  fi
done

echo ""
echo "========================================"
echo "✅ Cleanup Complete!"
echo "========================================"
echo ""
echo "Summary:"
echo "  - Archived scripts: docs/archive/scripts/"
echo "  - Status reports: docs/status/"
echo "  - Fix summaries: docs/fixes/"
echo "  - Historical docs: docs/archive/temporary/"
echo ""
echo "Next steps:"
echo "  1. Review moved files"
echo "  2. Update any hardcoded file paths"
echo "  3. Commit changes"
```

---

## File Mapping Reference

### Status Reports → `docs/status/`

| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| `DEPLOYMENT_STATUS.md` | `docs/status/` | Historical status |
| `DEPLOYMENT_COMPLETE.md` | `docs/status/` | Historical status |
| `DEPLOYMENT_FINAL_STATUS.md` | `docs/status/` | Historical status |
| `GRAPH_DEBUG_SUMMARY.md` | `docs/status/` | Historical status |
| `GRAPH_FIX_DEPLOYED.md` | `docs/status/` | Historical status |

### Fix Summaries → `docs/fixes/`

| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| `COMPREHENSIVE_FIX_SUMMARY.md` | `docs/fixes/` | Historical fix record |
| `ROOT_CAUSE_AND_FIX.md` | `docs/fixes/` | Historical fix record |
| `API_STATUS_AND_FIXES.md` | `docs/fixes/` | Historical fix record |

### Temporary Docs → `docs/archive/temporary/`

| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| `ANSWERS_TO_YOUR_QUESTIONS.md` | `docs/archive/temporary/` | Historical Q&A |
| `IMMEDIATE_ANSWERS.md` | `docs/archive/temporary/` | Historical Q&A |
| `URGENT_FIX_PLAN.md` | `docs/archive/temporary/` | Historical planning |

---

## Verification Checklist

After cleanup, verify:

- [ ] All temporary scripts removed from root
- [ ] One-time cleanup scripts archived
- [ ] Documentation files organized into proper directories
- [ ] No broken links (run link checker)
- [ ] Git history preserved (files moved, not deleted)
- [ ] README.md still in root
- [ ] Architecture docs accessible
- [ ] All references updated

---

## Rollback Plan

If issues occur:

1. All files are moved (not deleted), so can be moved back
2. Git history preserved for deleted scripts
3. Can restore from `docs/archive/` if needed

---

**Last Updated:** 2025-12-19  
**Status:** Ready for Execution

