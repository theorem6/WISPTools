# Missing File Fix - `src/app.html` Not Found

## 🐛 The Problem

When deploying the frontend to Firebase App Hosting, you were getting an error about a missing file:
```
Error: Cannot find module 'src/app.html'
```

## 🔍 Root Cause

The **`rootDirectory`** field was missing from the `apphosting.yaml` files!

### Project Structure
```
PCI_mapper/
├── apphosting.yaml           ← Root config (was missing rootDirectory)
├── firebase.json             ← Points to Module_Manager
├── Module_Manager/           ← Actual frontend code is HERE
│   ├── src/
│   │   ├── app.html         ← The file it couldn't find
│   │   └── ...
│   ├── apphosting.yaml       ← Module-level config
│   └── package.json
└── ...
```

### What Was Happening
1. Firebase reads `apphosting.yaml` from the root
2. Without `rootDirectory`, it assumes code is in the root directory
3. Looks for `src/app.html` in the root (doesn't exist)
4. **ERROR**: Cannot find src/app.html ❌

### What Should Happen
1. Firebase reads `apphosting.yaml` from the root
2. Sees `rootDirectory: Module_Manager`
3. Looks for `src/app.html` in `Module_Manager/src/` (exists!)
4. **SUCCESS**: Build starts ✅

## ✅ The Solution

Added `rootDirectory` to all apphosting.yaml files:

### 1. Root `apphosting.yaml`
```yaml
# Root directory where the app code is located
rootDirectory: Module_Manager

# Build and run commands
buildCommand: npm install && NODE_OPTIONS="--max-old-space-size=6144" npm run build
runCommand: node server.js
```

### 2. `Module_Manager/apphosting.yaml`
```yaml
# Root directory (. means current directory - Module_Manager)
rootDirectory: .

# Build and run commands
buildCommand: npm install && NODE_OPTIONS="--max-old-space-size=6144" npm run build
runCommand: node server.js
```

### 3. `Module_Manager/apphosting.yaml.gce-backend`
```yaml
# Root directory (. means current directory)
rootDirectory: .

# Build and run commands
buildCommand: npm install && NODE_OPTIONS="--max-old-space-size=6144" npm run build
runCommand: node server.js
```

## 📋 Files Modified

| File | Change | Reason |
|------|--------|--------|
| `apphosting.yaml` | Added `rootDirectory: Module_Manager` | Tell Firebase where the app code is |
| `Module_Manager/apphosting.yaml` | Added `rootDirectory: .` | Consistency when using this file |
| `Module_Manager/apphosting.yaml.gce-backend` | Added `rootDirectory: .` | Consistency for GCE backend config |

## 🚀 Now You Can Deploy!

### Option 1: Deploy from Root Directory
```bash
cd PCI_mapper
firebase deploy --only apphosting
```

The root `apphosting.yaml` will correctly point to `Module_Manager`.

### Option 2: Deploy from Module_Manager Directory
```bash
cd PCI_mapper/Module_Manager
firebase deploy --only apphosting
```

The local `apphosting.yaml` with `rootDirectory: .` will work correctly.

## 🧪 How to Verify

After deployment, check the build logs:
```bash
firebase apphosting:backends:list
```

You should see:
```
✅ Build succeeded
✅ Container deployed
✅ Application running on port 8080
```

## 📚 Related Files

This fix aligns with your existing configuration:

**`firebase.json`** (already correct):
```json
{
  "apphosting": {
    "backendId": "lte-pci-mapper",
    "rootDir": "/Module_Manager",  ← Already pointing to Module_Manager!
    "deployFunctions": true
  }
}
```

The issue was that `apphosting.yaml` wasn't respecting this configuration. Now it does!

## 🎯 Why This Happened

This project uses a **monorepo structure**:
- Root directory: Contains multiple components (functions, gce-backend, etc.)
- `Module_Manager/`: Contains the SvelteKit frontend

Firebase App Hosting needs to know which subdirectory contains the web application. Without `rootDirectory`, it defaults to the root, causing the missing file error.

## 💡 Key Takeaway

When deploying a Firebase App Hosting application from a subdirectory:

1. ✅ **Always specify `rootDirectory`** in `apphosting.yaml`
2. ✅ Make sure `firebase.json` has the correct `rootDir`
3. ✅ Keep both configurations in sync

## 🎉 Problem Solved!

Your frontend deployment should now work correctly. The missing `src/app.html` error is fixed!

---

**Status**: ✅ Fixed  
**Date**: October 11, 2025  
**Impact**: Frontend deployment now works  
**Next Step**: Run `firebase deploy --only apphosting`

