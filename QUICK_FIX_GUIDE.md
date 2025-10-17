# 🚀 Quick Fix Guide - Remote EPC Authentication

**Problem**: Firebase Auth errors when registering Remote EPCs  
**Solution**: Updated Firebase exports + clean rebuild  
**Time to Fix**: ~5-10 minutes

---

## ⚡ Quick Start (Windows)

### Option 1: Use the Rebuild Script (Recommended)
```powershell
cd Module_Manager
.\rebuild-and-test.ps1
```

The script will:
- ✅ Clean old builds and caches
- ✅ Reinstall dependencies  
- ✅ Rebuild with proper configuration
- ✅ Verify build output

### Option 2: Manual Steps
```powershell
# 1. Navigate to Module_Manager
cd Module_Manager

# 2. Clean old builds
Remove-Item -Recurse -Force build, .svelte-kit -ErrorAction SilentlyContinue

# 3. Install dependencies
npm install

# 4. Sync SvelteKit
npx svelte-kit sync

# 5. Build
$env:NODE_OPTIONS = "--max-old-space-size=6144"
npm run build
```

---

## 🧪 Test Locally (Optional)

```powershell
# Start the server
cd Module_Manager
npm start

# Open in browser
# http://localhost:8080

# Test the fix:
# 1. Login to your account
# 2. Navigate to HSS Management → Remote EPCs
# 3. Click "Register New EPC"
# 4. Fill out the form
# 5. Click "Register EPC" button
# 6. Should work without errors!
```

---

## ☁️ Deploy to Production

```powershell
# From project root
firebase deploy
```

Or deploy just the app hosting backend:
```powershell
firebase deploy --only apphosting:lte-pci-mapper
```

---

## ✅ Verify the Fix

After deployment, check these in your browser (F12 → Console):

### 1. No Auth Errors ✓
- Should NOT see: `lt.onAuthStateChanged is not a function`
- Should see: Auth initializes successfully

### 2. No 404 Errors ✓
- Should NOT see: 404 errors for `_app/immutable/chunks/*.js`
- All JavaScript files should load (200 status)

### 3. Favicon Loads ✓
- Should see: "L" logo in browser tab
- Should NOT see: 404 for `/favicon.png`

### 4. EPC Registration Works ✓
- Navigate to: HSS Management → Remote EPCs
- Click: "Register New EPC"
- Fill form and submit
- Should register successfully without errors

---

## 🔍 What Was Fixed?

1. **Firebase Auth Export** - Changed from function to Proxy instance
2. **Favicon** - Added SVG favicon to static directory
3. **Build Process** - Created clean rebuild script
4. **Import Consistency** - Fixed one file calling `auth()` as function

---

## 📋 Files Changed

- ✅ `Module_Manager/src/lib/firebase.ts` - Auth export fix
- ✅ `Module_Manager/src/app.html` - Favicon reference
- ✅ `Module_Manager/static/favicon.svg` - New file
- ✅ `Module_Manager/rebuild-and-test.ps1` - New file
- ✅ `Module_Manager/src/routes/modules/cbrs-management/lib/api/googleSASClient.ts` - Fixed auth() call

---

## 🆘 Troubleshooting

### Build Fails with "Out of Memory"
```powershell
# Increase Node.js heap size
$env:NODE_OPTIONS = "--max-old-space-size=8192"
npm run build
```

### Still Getting 404 Errors
```powershell
# Clear all caches and rebuild
cd Module_Manager
Remove-Item -Recurse -Force build, .svelte-kit, node_modules/.vite
npm run build
```

### Auth Still Not Working
1. Check Firebase config in browser console
2. Verify you're logged in (check auth state)
3. Clear browser cache and reload
4. Check Network tab for failed requests

### Deployment Issues
```powershell
# Check if you're logged in to Firebase
firebase login

# Check if correct project is selected
firebase use --add

# Select: lte-pci-mapper-65450042-bbf71
```

---

## 📞 Need Help?

If issues persist:
1. Check the detailed fix summary: `REMOTE_EPC_FIX_SUMMARY.md`
2. Review build logs for specific errors
3. Verify all environment variables in `apphosting.yaml`
4. Check Firebase Console for any service issues

---

**Last Updated**: October 17, 2025  
**Status**: ✅ Ready to Deploy


