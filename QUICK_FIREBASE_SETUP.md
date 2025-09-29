# 🚀 Quick Firebase Setup (No CLI Required)

## Option 1: Firebase Console Upload

### Step 1: Access Firebase Console
1. **Go to**: https://console.firebase.google.com/project/mapping-772cf
2. **Hosting Section**: Click "Hosting" → "Connect GitHub repository"

### Step 2: Connect Repository
1. **Repository URL**: `https://github.com/theorem6/lte-pci-mapper`
2. **Branch**: `master`
3. **Build Settings**:
   ```
   Build command: npm run build
   Output directory: dist
   ```

### Step 3: Environment Variables
```bash
PUBLIC_FIREBASE_API_KEY=AIzaSyDb5KthFS4DY4hZ_B8jsA3uxEsu6snQqWA
PUBLIC_FIREBASE_AUTH_DOMAIN=mapping-772cf.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=mapping-772cf
PUBLIC_ARCGIS_API_KEY=AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ
PUBLIC_GEMINI_API_KEY=AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg
```

## Option 2: Download and Upload Manually

### Step 1: Download ZIP from GitHub
1. **Go to**: https://github.com/theorem6/lte-pci-mapper/archive/refs/heads/master.zip
2. **Extract**: Download and extract the ZIP file

### Step 2: Create Firebase Hosting Site
1. **Firebase Console**: https://console.firebase.google.com/project/mapping-772cf/hosting
2. **Add another site**: Create new hosting site
3. **Upload files**: Drag and drop the extracted files

### Step 3: Configure Build (if Firebase build service available)
- **Build command**: Not needed for static files
- **Output directory<｜tool▁call▁begin｜>**: Leave empty or use root `/`

## Option 3: Firebase Functions Editor

### Access Firebase Functions Editor:
1. **URL**: https:`//console.firebase.google.com/project/mapping-772cf/functions`
2. **Edit in Console**: Use Firebase's online code editor
3. **Upload functions**: Upload the `functions/` folder contents

## Option 4: Google Cloud Shell

### Use Cloud Shell (Browser-based):
1. **Open**: https://console.cloud.google.com/home/dashboard?project=mapping-772cf
2. **Click**: Terminal icon (Cloud Shell)
3. **Run**:
```bash
git clone https://github.com/theorem6/lte-pci-mapper.git
cd lte-pci-mapper
npm install
npm run build
firebase deploy
```

## Your Firebase Project Info

```
Project ID: mapping-772cf
Repository: https://github.com/theorem6/lte-pci-mapper
Web App URL: https://mapping-772cf.web.app (after deployment)
Dashboard: https://console.firebase.google project/mapping-772cf
```

## Pre-configured Firebase Files

Your repository now includes:
✅ `firebase.json` - Hosting configuration
✅ `firestore.rules` - Database security rules  
✅ `functions/` - Cloud Functions for PCI analysis
✅ `firestore.indexes.json` - Database indexes
✅ `storage.rules` - Storage security rules

## Expected Firebase Services

After import, you'll have:
🔥 **Hosting** - Your web app
🔥 **Firestore** - Database for PCI analyses
🔥 **Functions** - Server-side PCI processing
🔥 **Storage** - File uploads/exports

## Quick Test URLs

Once deployed:
- **Main App**: https://mapping-772cf.web.app
- **Functions**: https://us-central1-mapping-772cf.cloudfunctions.net/analyzePCI
- **API Docs**: https://console.firebase.google.com/project/mapping-772cf/functions

**Choose the method that works best for your setup!** 🚀
