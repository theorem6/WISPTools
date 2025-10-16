# Build Instructions for Module_Manager

## 📦 Required Setup Before Building

### 1. Install Dependencies

**On your build server, run:**

```bash
cd Module_Manager
npm install
```

This will install all required packages including:
- chart.js (for charts)
- firebase (for authentication)
- @arcgis/core (for mapping)
- mongodb (backend only, externalized from build)

### 2. Set Environment Variables

Create `.env` file in `Module_Manager/` directory:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Functions URL
VITE_FUNCTIONS_URL=https://us-central1-your-project.cloudfunctions.net
```

### 3. Build the Application

```bash
cd Module_Manager
npm run build
```

This will:
- ✅ Bundle all frontend dependencies (chart.js, arcgis, etc.)
- ✅ Externalize backend-only modules (mongodb)
- ✅ Create optimized production build in `build/` directory

## 🐛 Common Build Errors

### Error: Cannot resolve "chart.js"

**Solution:**
```bash
cd Module_Manager
npm install
```

Chart.js needs to be installed before building.

### Error: Cannot resolve "mongodb"

**Solution:**  
This is normal - mongodb is externalized (not bundled with frontend). Make sure `vite.config.ts` has:

```typescript
build: {
  rollupOptions: {
    external: ['mongodb', '@google-cloud/firestore']
  }
}
```

### Error: Out of memory

**Solution:**
```bash
# Increase Node memory
export NODE_OPTIONS="--max-old-space-size=6144"
npm run build
```

Or the package.json already has this configured:
```json
"build": "node --max-old-space-size=6144 node_modules/vite/bin/vite.js build"
```

## 🚀 Firebase Deployment

### Using Firebase App Hosting

```bash
# From project root
firebase deploy --only apphosting
```

Firebase will:
1. ✅ Upload your code
2. ✅ Run `npm install` automatically
3. ✅ Run `npm run build` automatically
4. ✅ Deploy to Cloud Run

### Manual Deployment

If building locally:

```bash
# Build
cd Module_Manager
npm run build

# Deploy to Firebase Hosting
cd ..
firebase deploy --only hosting
```

## 📋 Build Checklist

Before building:
- ✅ Node.js 20+ installed
- ✅ `npm install` completed in `Module_Manager/`
- ✅ All dependencies in package.json
- ✅ Environment variables set (if needed)
- ✅ vite.config.ts properly configured

## 🔍 Verify Build

After building:

```bash
# Check build output
ls -lh Module_Manager/build/

# Should see:
# - client/ (frontend assets)
# - server/ (SSR server)
# - index.js (entry point)
```

Test locally:
```bash
cd Module_Manager
npm start
# Opens on http://localhost:3000
```

## 🎯 Production Environment

### Required Packages in Production:

**Runtime dependencies** (needed when running):
```json
{
  "dependencies": {
    "@sveltejs/adapter-node": "^5.2.9",
    "@sveltejs/kit": "^2.7.4",
    "svelte": "^5.0.0",
    "express": "^4.18.2"
  }
}
```

**Build-time only** (bundled into build):
- chart.js ✅ (bundled)
- firebase ✅ (bundled)
- @arcgis/core ✅ (bundled)

**Backend-only** (externalized):
- mongodb ❌ (not in frontend bundle)

## 💡 Tips

1. **Always run `npm install` first** on a new build server
2. **Clear node_modules** if you get weird errors: `rm -rf node_modules package-lock.json && npm install`
3. **Check Node version**: `node --version` (should be 20+)
4. **Monitor memory** during build - may need 4-6GB RAM

---

**Last Updated**: 2025-10-11  
**Build Version**: 1.0.0

