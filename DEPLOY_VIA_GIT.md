# 🚀 Deploy via Firebase App Hosting (Git Integration)

**Your Setup**: Firebase App Hosting pulls directly from Git and builds in the cloud.

---

## ✅ Code Fixes Applied

All the code fixes have been completed:
- ✅ Firebase Auth export fixed (Proxy pattern)
- ✅ Favicon added (SVG)
- ✅ app.html updated
- ✅ googleSASClient.ts fixed

---

## 📤 Deployment Steps (Git-based)

### Step 1: Check Git Status
```powershell
git status
```

You should see these modified files:
- `Module_Manager/src/lib/firebase.ts`
- `Module_Manager/src/app.html`
- `Module_Manager/static/favicon.svg` (new)
- `Module_Manager/src/routes/modules/cbrs-management/lib/api/googleSASClient.ts`
- Plus documentation files

### Step 2: Stage the Changes
```powershell
# Stage the critical fixes
git add Module_Manager/src/lib/firebase.ts
git add Module_Manager/src/app.html
git add Module_Manager/static/
git add Module_Manager/src/routes/modules/cbrs-management/lib/api/googleSASClient.ts

# Optionally add documentation
git add QUICK_FIX_GUIDE.md
git add REMOTE_EPC_FIX_SUMMARY.md
git add DEPLOY_VIA_GIT.md
```

### Step 3: Commit the Changes
```powershell
git commit -m "Fix: Remote EPC authentication and build issues

- Fixed Firebase Auth export using Proxy pattern
- Added favicon.svg to prevent 404 errors
- Fixed auth() function call in googleSASClient
- Resolves 'onAuthStateChanged is not a function' error"
```

### Step 4: Push to Trigger Deployment
```powershell
git push origin main
```

### Step 5: Monitor the Deployment

Firebase App Hosting will automatically:
1. Detect the new commit
2. Pull the latest code
3. Run the build command from `apphosting.yaml`
4. Deploy the new version

**Monitor in Firebase Console:**
```
https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting
```

Look for:
- ✅ Build started
- ✅ Build succeeded
- ✅ Deployment complete
- ✅ New version live

---

## 🔍 Verify Build Command

Your `apphosting.yaml` should have a build command that:
1. Installs dependencies: `npm install`
2. Syncs SvelteKit: `npx svelte-kit sync`
3. Builds with enough memory: `NODE_OPTIONS="--max-old-space-size=6144" npm run build`

Current build command in `apphosting.yaml`:
```yaml
buildCommand: npm install && npx svelte-kit sync && NODE_OPTIONS="--max-old-space-size=6144" npm run build && ls -lh build/client/_app/immutable/entry/ || echo "⚠️  Build directory check failed"
```

✅ This looks good!

---

## ⏱️ Deployment Timeline

1. **Push to Git**: Immediate
2. **Firebase detects change**: ~30 seconds
3. **Build starts**: ~1 minute
4. **Build completes**: ~5-10 minutes (ArcGIS + Firebase is large)
5. **Deployment**: ~2-3 minutes
6. **Total time**: ~10-15 minutes

---

## 🧪 Test After Deployment

Once deployment is complete:

### 1. Check the Live Site
```
https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app
```

### 2. Open DevTools (F12)
- Console tab: Should see no errors
- Network tab: All JavaScript files should load (200 status)

### 3. Test Remote EPC Registration
1. Login to your account
2. Navigate to: **HSS Management → Remote EPCs**
3. Click: **"Register New EPC"**
4. Fill out the form
5. Click: **"Register EPC"**
6. Should work without errors! ✅

### 4. Expected Console Output
```
🔥 Firebase Config: {apiKey: '✅ Set', authDomain: '✅ Set', ...}
🔥 Firebase app initialized
🔐 Firebase Auth: Persistence set to LOCAL
📊 Firestore initialized
```

### 5. Should NOT See
```
❌ TypeError: lt.onAuthStateChanged is not a function
❌ 404 /favicon.png
❌ 404 /_app/immutable/chunks/3WRbznsp.js
```

---

## 🔄 If Build Fails in Cloud

Check the Firebase App Hosting build logs:

1. Go to Firebase Console → App Hosting
2. Click on your backend: `lte-pci-mapper`
3. Click on the failed build
4. Review build logs

Common issues:
- **Out of memory**: Increase in `runConfig.memoryMiB`
- **Missing dependencies**: Check `package.json`
- **TypeScript errors**: Review the logs

---

## 🆘 Troubleshooting

### Build Succeeds but Still Getting Errors

**Clear browser cache:**
```
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
```

**Check deployed version:**
```
View page source → Look for build hash in script URLs
Should be NEW hashes, not old ones
```

### Auth Still Not Working

**Verify environment variables:**
Check that `apphosting.yaml` has all Firebase config variables:
- `PUBLIC_FIREBASE_API_KEY`
- `PUBLIC_FIREBASE_AUTH_DOMAIN`
- `PUBLIC_FIREBASE_PROJECT_ID`
- etc.

### Git Push Doesn't Trigger Build

**Check Firebase App Hosting connection:**
1. Firebase Console → App Hosting
2. Verify Git integration is active
3. Check branch settings (should be `main`)

**Manual trigger:**
```powershell
# Force a rebuild from Firebase Console
# Or use Firebase CLI
firebase apphosting:rollouts:create lte-pci-mapper
```

---

## 📊 Build Performance

Your current settings:
- **Memory**: 6GB heap for build (good for ArcGIS)
- **Runtime Memory**: 2048 MiB (2GB)
- **CPU**: 1 core
- **Max Instances**: 5

This should handle the build fine.

---

## ✅ Post-Deployment Checklist

After the deployment completes:

- [ ] Site loads without errors
- [ ] Favicon appears in browser tab
- [ ] Login works
- [ ] HSS Management loads
- [ ] Remote EPCs tab loads
- [ ] "Register New EPC" button works
- [ ] Form submission succeeds
- [ ] No console errors
- [ ] No 404 errors in Network tab

---

## 🎯 Summary

**What you need to do:**
```powershell
# 1. Commit the fixes
git add Module_Manager/
git commit -m "Fix: Remote EPC authentication and build issues"

# 2. Push to trigger deployment
git push origin main

# 3. Wait ~10-15 minutes for build + deployment

# 4. Test the live site
```

**What Firebase will do automatically:**
1. Detect your push
2. Pull latest code
3. Build in the cloud with proper configuration
4. Deploy the new version
5. Route traffic to the new build

---

**No local build needed!** All the code fixes are done. Just commit and push! 🚀

---

**Last Updated**: October 17, 2025  
**Deployment Type**: Firebase App Hosting (Git Integration)  
**Status**: ✅ Ready to commit and push


