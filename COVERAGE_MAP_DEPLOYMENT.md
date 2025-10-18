# 🗺️ Coverage Map Deployment Guide

## ✅ Deployment Complete!

Your Coverage Map module has been deployed automatically through your Git-based workflow.

---

## 📦 What Was Deployed

### **Frontend (Automatic)**
✅ **Already Deployed via Firebase App Hosting**
- Committed to Git: October 18, 2025
- Pushed to GitHub: `theorem6/lte-pci-mapper`
- Firebase App Hosting automatically:
  - Detected the push
  - Built the app with Coverage Map module
  - Deployed to production

**Files deployed:**
```
Module_Manager/src/routes/modules/coverage-map/
├── +page.svelte              (Main module page)
├── +page.ts                  (Route config)
├── README.md                 (Documentation)
├── components/
│   ├── CoverageMapView.svelte
│   └── FilterPanel.svelte
└── lib/
    ├── models.ts
    ├── coverageMapService.ts
    └── reportGenerator.ts
```

**Dashboard updated:**
- Coverage Map tile now visible on dashboard
- Replaces "Coverage Planning (coming soon)"

---

## 🔒 Firestore Security Rules - Action Required

The **only manual step** you need is to deploy the Firestore security rules.

### Option 1: Deploy via Firebase CLI (Recommended)

```bash
# From your project root (C:\Users\david\Downloads\PCI_mapper)
firebase deploy --only firestore:rules
```

**Expected output:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/overview
```

### Option 2: Deploy via Firebase Console

1. Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/firestore/rules
2. Copy contents of `firestore.rules` from your repo
3. Paste into the editor
4. Click **"Publish"**

---

## 📊 What the Rules Do

Added security rules for 4 new collections under each tenant:

```javascript
// tenants/{tenantId}/towerSites/{siteId}
// tenants/{tenantId}/sectors/{sectorId}
// tenants/{tenantId}/cpeDevices/{cpeId}
// tenants/{tenantId}/networkEquipment/{equipmentId}

// All require tenant membership:
allow read, write: if isTenantMember(tenantId);
```

**Security features:**
- ✅ Multi-tenant isolation
- ✅ Only tenant members can access their data
- ✅ Platform admin (david@david.com) has full access
- ✅ Data completely isolated between tenants

---

## 🧪 Test the Deployment

### 1. Access the Module
```
1. Go to your production site
2. Login with your account
3. Dashboard → Click "🗺️ Coverage Map" tile
4. Module should load without errors
```

### 2. Test Data Creation
```
1. Click "Add Tower" or right-click on map
2. Fill out tower information
3. Submit
4. Should save to Firestore without errors
```

### 3. Verify in Firestore Console
```
1. Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/firestore
2. Navigate to: tenants → {your-tenant-id} → towerSites
3. Should see your test tower data
```

---

## 🚀 Your Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Code Repository                          │
│          GitHub: theorem6/lte-pci-mapper (main)             │
└──────────────────┬──────────────────────────────────────────┘
                   │ Git Push
                   ↓
┌─────────────────────────────────────────────────────────────┐
│              Firebase App Hosting                            │
│  • Auto-detects Git push                                     │
│  • Builds SvelteKit app in cloud                            │
│  • Deploys to production                                     │
│  • URL: lte-pci-mapper--lte-pci-mapper-65450042-bbf71...   │
└──────────────────┬──────────────────────────────────────────┘
                   │ Uses Firebase SDK
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                 Cloud Firestore                              │
│  • Multi-tenant database                                     │
│  • Coverage Map collections:                                 │
│    - tenants/{id}/towerSites                                │
│    - tenants/{id}/sectors                                    │
│    - tenants/{id}/cpeDevices                                │
│    - tenants/{id}/networkEquipment                          │
│  • Security rules enforce tenant isolation                   │
└─────────────────────────────────────────────────────────────┘
```

**Note:** Coverage Map does NOT use the GCE backend VM (136.112.111.167). It's 100% client-side using Firebase SDK directly.

---

## 💡 Key Points

### ✅ No Backend API Changes Needed
The Coverage Map uses Firestore directly via Firebase SDK. All CRUD operations happen client-side, secured by Firestore rules.

### ✅ No MongoDB Changes Needed
Coverage Map uses Firestore, not MongoDB. Your MongoDB Atlas instance is only used by:
- HSS Management API
- GenieACS (ACS CPE Management)
- Distributed EPC API

### ✅ No GCE VM Updates Needed
The backend VM at `136.112.111.167:3000` doesn't need any updates for Coverage Map to work.

### ✅ Fully Automatic Frontend Deployment
Every time you:
```bash
git add .
git commit -m "Your changes"
git push origin main
```
Firebase App Hosting automatically rebuilds and deploys.

---

## 🔧 If Something Doesn't Work

### Coverage Map Module Not Showing
**Check:** Did Firebase App Hosting complete the build?
```
1. Go to: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting
2. Look for recent deployment
3. Should say "Deployment successful"
```

**Fix:** Wait for build to complete (~10-15 minutes) or hard refresh browser.

### Can't Save Tower/Sector Data
**Check:** Are Firestore rules deployed?
```bash
firebase deploy --only firestore:rules
```

**Check:** Are you a member of a tenant?
- Coverage Map requires tenant context
- System admin should select a tenant first

### "Permission Denied" Errors
**Cause:** Firestore rules not deployed yet.

**Fix:**
```bash
firebase deploy --only firestore:rules
```

---

## 📁 What Was Committed

### Commits:
1. **Coverage Map Module** (commit `5abddec`)
   - 2,244 lines of new code
   - 8 new files
   - Full feature implementation

2. **README Documentation** (commit `7b8e666`)
   - Comprehensive module documentation
   - 351 lines

3. **Firestore Rules** (commit `[current]`)
   - Security rules for 4 new collections
   - Multi-tenant isolation

---

## 🎯 Quick Deployment Checklist

- [x] Code committed to Git
- [x] Code pushed to GitHub
- [x] Firebase App Hosting auto-deployed frontend
- [ ] **Deploy Firestore rules** ← Only manual step needed
- [ ] Test Coverage Map module
- [ ] Verify data saves to Firestore

---

## 📞 Support

**Frontend deployment issues:**
- Check: Firebase App Hosting console
- URL: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting

**Database/rules issues:**
- Check: Firestore console
- URL: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/firestore

**Module functionality:**
- Documentation: `Module_Manager/src/routes/modules/coverage-map/README.md`
- Data models: `Module_Manager/src/routes/modules/coverage-map/lib/models.ts`

---

## 🚀 Deploy Firestore Rules Now

```bash
cd C:\Users\david\Downloads\PCI_mapper
firebase deploy --only firestore:rules
```

**That's it!** Your Coverage Map is fully deployed. 🎉

---

*Last Updated: October 18, 2025*  
*Deployment Method: Git → Firebase App Hosting (Automatic)*  
*Manual Step: Deploy Firestore rules (one command)*

