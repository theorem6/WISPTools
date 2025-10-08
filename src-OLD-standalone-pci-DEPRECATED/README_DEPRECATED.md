# ⚠️ DEPRECATED - Old Standalone PCI Manager

## 🚫 DO NOT USE THIS DIRECTORY

This directory contains the **OLD standalone PCI Conflict Manager** that was used before the Module Manager system.

### Why This Exists:
- Historical reference only
- Kept for code reference/recovery if needed
- **NOT used in deployments**

### Current Active App:
The active application is now in: **`/Module_Manager`**

### What's the Difference?

#### This Directory (OLD - DEPRECATED):
```
src/
├── routes/+page.svelte    ← Loads directly to PCI map
├── No login system
├── No dashboard
├── No module system
└── Browser tab: "LTE PCI Conflict Manager"
```

#### Module Manager (NEW - ACTIVE):
```
Module_Manager/src/
├── routes/
│   ├── login/                      ← Login page
│   ├── dashboard/                  ← Dashboard with tiles
│   └── modules/pci-resolution/     ← Integrated PCI module
├── Modern architecture
├── Modular design
└── Browser tab: "LTE WISP Management Platform"
```

### Firebase Deployment:
Firebase App Hosting now deploys from `/Module_Manager` as configured in `firebase.json`:

```json
"apphosting": {
  "backendId": "lte-pci-mapper",
  "rootDir": "/Module_Manager"  ← Deploys Module Manager
}
```

### Can This Be Deleted?
Yes, but it's kept for reference. If you're certain you don't need it:

```bash
git rm -rf src-OLD-standalone-pci-DEPRECATED
git commit -m "Remove deprecated standalone PCI app"
git push origin main
```

### Migration Complete:
All functionality from this old app has been migrated and integrated into the Module Manager system.

---

**Last Updated**: 2025-10-08  
**Status**: DEPRECATED  
**Replacement**: `/Module_Manager`

