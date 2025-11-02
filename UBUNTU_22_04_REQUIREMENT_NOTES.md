# Ubuntu 22.04 LTS Requirement - Customer Notes

## Summary
All EPC deployment scripts now **require Ubuntu 22.04 LTS Server**. This document outlines where customers see this requirement and how it's communicated.

---

## Changes Made

### 1. **Deployment Script Header** ✅
**File:** `backend-services/routes/epc.js`

**Location:** Script header (lines 149-159)

**Customer sees:**
```bash
# ⚠️ REQUIREMENTS:
#   - Ubuntu 22.04 LTS (Jammy) Server is REQUIRED
#   - This script is designed specifically for Ubuntu 22.04 LTS
#   - Open5GS PPA packages are optimized for Ubuntu 22.04 LTS
#   - Other Ubuntu/Debian versions may not work correctly
#
# 📋 Pre-Installation Checklist:
#   ✓ Ubuntu 22.04 LTS Server installed
#   ✓ Root or sudo access available
#   ✓ Network connectivity configured
#   ✓ At least 2GB RAM and 10GB disk space
```

### 2. **System Verification** ✅
**File:** `backend-services/routes/epc.js`

**Location:** After root check (lines 209-226)

**What happens:**
- Script checks `/etc/os-release`
- Verifies `ID=ubuntu` and `VERSION_ID=22.04`
- If wrong OS detected, shows clear error:
  ```
  ERROR: This script REQUIRES Ubuntu 22.04 LTS (Jammy)
  Detected: [Actual OS]
  Please install Ubuntu 22.04 LTS Server before running this script.
  Download: https://ubuntu.com/download/server
  ```
- Exits with error code 1

### 3. **Installation Step Notes** ✅
**File:** `backend-services/routes/epc.js`

**Location:** Open5GS installation (lines 332-337)

**Customer sees:**
```
[INFO] Adding Open5GS repository (Ubuntu 22.04 LTS compatible)...
[INFO] Installing Open5GS EPC components (pre-built packages, no compilation)...
[INFO] Note: These packages are optimized for Ubuntu 22.04 LTS
```

### 4. **Completion Message** ✅
**File:** `backend-services/routes/epc.js`

**Location:** Deployment complete (lines 818-820)

**Customer sees:**
```
[INFO] Installation Method: Package-based (no compilation required)
[INFO] OS Requirement: Ubuntu 22.04 LTS ✓
```

### 5. **Frontend Download Notice** ✅
**File:** `Module_Manager/src/routes/modules/hss-management/components/RemoteEPCs.svelte`

**Location:** Before script download (lines 336-349)

**Customer sees:**
```
⚠️ REQUIREMENT NOTICE

This deployment script REQUIRES Ubuntu 22.04 LTS Server.

• The script will verify Ubuntu 22.04 LTS before proceeding
• Open5GS packages are optimized for Ubuntu 22.04 LTS
• Other versions may not work correctly

Do you have Ubuntu 22.04 LTS installed?
Click OK to download, or Cancel to install Ubuntu 22.04 LTS first.
```

**If customer clicks Cancel:**
- Opens Ubuntu Server download page in new tab

### 6. **HTTP Headers** ✅
**Files:** 
- `backend-services/routes/epc.js` (line 130)
- `backend-services/routes/epc-deployment.js` (line 611)

**Headers set:**
```
X-Requirement-Note: This script requires Ubuntu 22.04 LTS Server
```

---

## Customer Journey

### Scenario 1: Customer Downloads Script from UI
1. ✅ Sees requirement notice dialog
2. ✅ Clicks OK → Downloads script
3. ✅ Opens script → Sees requirement in header
4. ✅ Runs script → OS verification happens
5. ✅ If wrong OS → Clear error message with download link

### Scenario 2: Customer Uses ISO Auto-Install
1. ✅ ISO is Ubuntu 22.04 LTS netboot
2. ✅ System installs Ubuntu 22.04 LTS
3. ✅ Bootstrap script downloads deployment script
4. ✅ Deployment script verifies Ubuntu 22.04 LTS ✓
5. ✅ Continues with installation

### Scenario 3: Customer Has Wrong OS
1. ✅ Script detects wrong OS version
2. ✅ Shows clear error message
3. ✅ Provides download link to Ubuntu 22.04 LTS Server
4. ✅ Exits cleanly (doesn't attempt installation)

---

## Benefits

✅ **Clear Communication:** Customers know requirement upfront  
✅ **Prevents Errors:** Script fails fast if wrong OS  
✅ **Helpful Guidance:** Provides download link when needed  
✅ **Multiple Touchpoints:** Requirement visible at every step  
✅ **Professional:** Proper error handling and messaging

---

## Testing Checklist

- [ ] Download script from UI → See requirement notice
- [ ] Cancel download → Opens Ubuntu download page
- [ ] Run script on Ubuntu 22.04 LTS → Verifies and continues
- [ ] Run script on Ubuntu 20.04 → Shows error and link
- [ ] Run script on Debian → Shows error and link
- [ ] Check script header → Requirement visible
- [ ] Check completion message → OS requirement noted

---

**Status:** ✅ Complete  
**Customer Visibility:** High (multiple touchpoints)  
**Error Prevention:** Strong (pre-flight checks)
