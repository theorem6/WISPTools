# Repository Cleanup Analysis

**Date:** 2025-12-06  
**Git Objects:** ~15,000 in packs (132.51 MiB)  
**Tracked Files:** 1,443

## Issues Found

### 1. Duplicate Backend Directories ⚠️

**Problem:** Both `gce-backend/` and `backend-services/` contain duplicate files:

- ✅ **`backend-services/`** - Main active backend (deployed to GCE port 3001/3002)
- ❓ **`gce-backend/`** - Supposedly "isolated" ISO generation code, but duplicates exist:
  - `routes/epc-deployment.js` (duplicated)
  - `utils/bootstrap-helpers.js` (duplicated)
  - `utils/iso-helpers.js` (may be unique)
  - `utils/deployment-helpers.js` (may be unique)

**Status:** According to docs, `gce-backend/` was meant for ISO generation isolation, but:
- The active deployment uses `backend-services/min-epc-server.js` (port 3002)
- `backend-services/routes/epc-deployment.js` is the active route
- `gce-backend/` appears to be unused/legacy

**Recommendation:** 
- Verify `gce-backend/` is not referenced anywhere
- If unused, remove it
- If needed, merge unique ISO helpers into `backend-services/utils/`

### 2. Deprecated Directory 🗑️

**`src-OLD-standalone-pci-DEPRECATED/`** - 72 tracked files
- Marked as deprecated
- README says it can be deleted
- All functionality migrated to `Module_Manager/`

**Recommendation:** Remove after confirming not needed

### 3. Binary Files in Git 💾

**Tracked .zip files:**
- `backend-update.zip` (50KB)
- `distributed-epc-modules.zip` (14KB)

**Issue:** These should not be in git (should be in .gitignore)

**Recommendation:** 
- Add `*.zip` to `.gitignore`
- Remove from git history: `git rm --cached *.zip`

### 4. Excessive Root Markdown Files 📄

**112 markdown files in root directory** - Many are:
- Deployment status reports (`DEPLOYMENT_COMPLETE.md`, `FINAL_DEPLOYMENT_STATUS.md`, etc.)
- Fix summaries (`FIXES_APPLIED.md`, `EPC_FIXES_SUMMARY.md`, etc.)
- Temporary documentation

**Recommendation:** Move to `docs/` subdirectories:
- `docs/deployment/` - Deployment status/summaries
- `docs/fixes/` - Fix summaries and reports
- `docs/guides/` - User/developer guides (already exists)

### 5. Potential Unused Files 📦

**Root-level files that may be obsolete:**
- `distributed-epc-api.js` - Old monolithic API (replaced by modular structure?)
- `distributed-epc-schema.js` - May be duplicate of `backend-services/models/distributed-epc-schema.js`
- Various `.sh` and `.ps1` scripts that may be duplicated in `scripts/` directory

**Recommendation:** Audit and remove if duplicates exist

## Cleanup Plan

## Detailed Findings

### Root Schema Files - OBSOLETE ✅

**`distributed-epc-schema.js`** (root) vs **`backend-services/models/distributed-epc-schema.js`**
- Root version is OLDER (missing fields: `site_id`, `deployment_type`, etc.)
- Active version is in `backend-services/models/`
- Root version not referenced anywhere
- **Safe to remove:** ✅ YES

**`distributed-epc-api.js`** (root)
- Appears to be old monolithic API
- Replaced by modular `backend-services/server.js`
- **Status:** Need to verify if referenced

### gce-backend Directory - LEGACY ⚠️

**Findings:**
- Referenced in ONE script: `backend-services/scripts/deploy-from-uploaded-files.sh` (line 50: fallback reference)
- Active deployment uses `backend-services/routes/epc-deployment.js`
- ISO generation runs on port 3002 via `backend-services/min-epc-server.js`
- `gce-backend/` appears to be legacy/unused

**Files in gce-backend:**
- `routes/epc-deployment.js` - DUPLICATE of `backend-services/routes/epc-deployment.js`
- `utils/bootstrap-helpers.js` - DUPLICATE of `backend-services/utils/bootstrap-helpers.js`
- `utils/iso-helpers.js` - Need to check if unique
- `utils/deployment-helpers.js` - Need to check if unique

**Recommendation:** 
1. Compare `gce-backend/utils/*.js` with `backend-services/utils/` to find unique files
2. If any unique ISO helpers exist, merge into `backend-services/utils/`
3. Remove `gce-backend/` directory

### Phase 1: Safe Cleanup (No Breaking Changes)
1. ✅ Add `*.zip` to `.gitignore` (currently missing)
2. ✅ Remove `.zip` files from git tracking (2 files)
3. ✅ Remove deprecated `src-OLD-standalone-pci-DEPRECATED/` directory (72 files)
4. ✅ Remove root `distributed-epc-schema.js` (obsolete duplicate)
5. ✅ Move root markdown files to appropriate `docs/` subdirectories

### Phase 2: Backend Directory Audit
1. ✅ Compare `gce-backend/utils/` with `backend-services/utils/` for unique files
2. ✅ Merge any unique ISO helpers into `backend-services/utils/`
3. ✅ Remove `gce-backend/` directory (if confirmed unused)

### Phase 3: File Deduplication
1. ✅ Verify `distributed-epc-api.js` is not referenced (appears obsolete)
2. ✅ Remove if obsolete
3. ✅ Check for duplicate scripts in root vs `scripts/` directory

### Estimated Impact

**Files to Remove:**
- ~74 files from deprecated directory
- ~2 .zip files from tracking
- ~112 markdown files to move (not remove, just organize)

**Size Reduction:**
- ~50-70 files removed from tracking
- Better organization (easier navigation)

**Risk Level:** Low (all changes are non-breaking)

