# Firebase App Hosting Deployment Commands

## 🚀 Deploy Frontend Changes

Since you mentioned pulling rollouts directly from Firebase App Hosting, here are the commands:

### **Option 1: Automatic Deployment (Recommended)**

Firebase App Hosting automatically deploys when you push to GitHub main branch.

**Status Check:**
```bash
# Check if deployment is in progress
firebase apphosting:rollouts:list
```

**The latest commits include:**
- `11f9857` - Remote EPCs management UI
- `b4072ab` - Comprehensive monitoring dashboard  
- Frontend changes are already pushed ✅

### **Option 2: Manual Trigger via Firebase CLI**

If auto-deployment didn't trigger, manually create a rollout:

```bash
cd Module_Manager

# Create a new rollout
firebase apphosting:rollouts:create

# Or specify backend
firebase apphosting:rollouts:create --backend lte-pci-mapper
```

### **Option 3: Force New Build**

Sometimes you need to force a rebuild:

```bash
cd Module_Manager

# Make a trivial change to trigger rebuild
echo "# Build trigger $(date)" >> apphosting.yaml

# Commit and push
git add apphosting.yaml
git commit -m "chore: Trigger Firebase App Hosting rebuild"
git push origin main
```

### **Option 4: Check Current Deployment**

See what's currently deployed:

```bash
# List backends
firebase apphosting:backends:list

# Check rollout status
firebase apphosting:rollouts:list

# View specific rollout
firebase apphosting:rollouts:describe ROLLOUT_ID
```

---

## 🔍 **Verify Deployment**

### **Check if Remote EPCs Tab Appears:**

1. Open: https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/
2. Navigate: Dashboard → HSS & Subscriber Management
3. Look for tabs at the top:
   - 📊 Dashboard
   - 👥 Subscribers
   - 📦 Groups
   - 🚀 Bandwidth Plans
   - 🌐 MME Connections
   - 📥 Bulk Import
   - **🌐 Remote EPCs** ← Should be here!

### **If You Don't See It:**

1. **Hard refresh:** `Ctrl + Shift + R` (Chrome) or `Cmd + Shift + R` (Mac)
2. **Clear cache:** Browser DevTools → Application → Clear Storage
3. **Check build status:** `firebase apphosting:rollouts:list`
4. **Trigger new build:** See Option 3 above

---

## 📝 **Files That Changed (Frontend):**

These files were added/modified and pushed to GitHub:

```
Module_Manager/src/routes/modules/hss-management/+page.svelte
  - Added "Remote EPCs" tab button
  - Added RemoteEPCs import
  - Added tab content rendering

Module_Manager/src/routes/modules/hss-management/components/RemoteEPCs.svelte
  - NEW: 1000+ lines
  - EPC registration form
  - EPC list with status
  - Download deployment script

Module_Manager/src/routes/modules/hss-management/components/EPCMonitor.svelte
  - NEW: 900+ lines
  - Real-time monitoring dashboard
  - Subscriber roster
  - Attach/detach events
  - Metrics history
```

All committed in: `11f9857` and `b4072ab`

---

## ⚡ **Quick Deploy**

If you're not seeing changes, run this:

```bash
cd C:\Users\david\Downloads\PCI_mapper\Module_Manager
firebase apphosting:rollouts:create
```

This will force a new deployment with all the latest frontend changes.

---

## 🎯 **Expected Result**

After deployment completes:
- ✅ "Remote EPCs" tab appears in HSS module
- ✅ Can register new EPC sites
- ✅ Can download deployment scripts
- ✅ Can monitor EPCs in real-time

**Firebase App Hosting URL:**
```
https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/modules/hss-management
```

---

**Try the hard refresh first, then check rollout status!** 🚀

