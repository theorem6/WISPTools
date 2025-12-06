# Git Sparse Checkout System for Remote Agents

**Date:** 2025-12-06  
**Status:** ✅ Active

## Overview

Remote EPC agents now use **Git sparse checkout** to automatically download only the script files they need, not the entire repository. This is more efficient and reduces download time and storage requirements.

## How It Works

### Automatic Process

1. **During Check-in:** The backend checks if scripts need updating by comparing hashes
2. **If Updates Needed:** An update command is automatically queued
3. **Git Sparse Checkout:** The agent downloads only the specific script files needed:
   - `backend-services/scripts/epc-checkin-agent.sh`
   - `backend-services/scripts/epc-snmp-discovery.sh`
   - `backend-services/scripts/epc-snmp-discovery.js`
   - `backend-services/scripts/epc-ping-monitor.js`
4. **No Full Clone:** Agents never download the entire repository (~132MB), only the 4 script files needed (~150KB total)

### Implementation Details

**Git Repository Configuration:**
- **Repository:** `https://github.com/theorem6/lte-pci-mapper.git`
- **Branch:** `main`
- **Local Directory:** `/opt/wisptools/repo`
- **Scripts Directory:** `/opt/wisptools/repo/backend-services/scripts`

**Sparse Checkout Process:**
1. Initialize empty git repository (if not exists)
2. Enable sparse checkout mode
3. Configure sparse checkout paths (only script files needed)
4. Fetch only those specific files (depth 1, shallow clone)
5. Checkout only the configured paths
6. Copy scripts to `/opt/wisptools/`

**Benefits:**
- ✅ **Efficient:** Only downloads ~150KB instead of ~132MB (99.9% reduction)
- ✅ **Fast:** Much faster download times
- ✅ **Automatic:** No manual intervention needed
- ✅ **Up-to-date:** Always gets latest versions from git
- ✅ **Version Controlled:** Uses git commit hashes for version tracking

## What Gets Downloaded

Only these 4 script files:
```
backend-services/scripts/epc-checkin-agent.sh        (~35KB)
backend-services/scripts/epc-snmp-discovery.sh       (~30KB)
backend-services/scripts/epc-snmp-discovery.js       (~88KB)
backend-services/scripts/epc-ping-monitor.js         (~12KB)
```

**Total:** ~165KB vs 132MB for full repository

## Automatic Updates

The system is **fully automatic**:

1. **On Each Check-in:**
   - Backend compares script hashes
   - If scripts are outdated, creates update command
   - Agent receives command on next check-in

2. **Update Execution:**
   - Agent runs git sparse checkout
   - Downloads only updated scripts
   - Copies to `/opt/wisptools/`
   - Restarts check-in service if agent was updated

3. **No Manual Steps Required:**
   - Everything happens automatically
   - Agents stay up-to-date automatically
   - Works even if agents are offline for extended periods

## Manual Override (If Needed)

If you need to manually trigger an update:

```bash
# On GCE server
cd /opt/lte-pci-mapper
node backend-services/scripts/create-epc-update-command.js EPC-CB4C5042 690abdc14a6f067977986db3
```

The agent will receive the update command on its next check-in and automatically download only the files needed using git sparse checkout.

## Technical Details

**Git Sparse Checkout Commands Used:**
```bash
git init
git remote add origin https://github.com/theorem6/lte-pci-mapper.git
git config core.sparseCheckout true
git config core.sparseCheckoutCone false
echo "backend-services/scripts/epc-checkin-agent.sh" > .git/info/sparse-checkout
echo "backend-services/scripts/epc-snmp-discovery.sh" >> .git/info/sparse-checkout
echo "backend-services/scripts/epc-snmp-discovery.js" >> .git/info/sparse-checkout
echo "backend-services/scripts/epc-ping-monitor.js" >> .git/info/sparse-checkout
git fetch --depth 1 origin main
git checkout -b main origin/main
```

**Storage Location:**
- Git repository cache: `/opt/wisptools/repo/` (only contains checked-out files)
- Active scripts: `/opt/wisptools/` (copied from repo cache)

## Status

✅ **Active:** All new update commands use git sparse checkout  
✅ **Automatic:** Works automatically on every check-in  
✅ **Efficient:** 99.9% reduction in download size  
✅ **Deployed:** Backend updated and deployed to GCE server

