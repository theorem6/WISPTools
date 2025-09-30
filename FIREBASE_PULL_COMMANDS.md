# 🔄 Firebase Web IDE - Pull Latest Code Commands

## 🎯 Since Repository is Already Connected

Your Firebase Web IDE is connected to GitHub. Here are the commands to pull the latest clean code:

## 🚀 **Commands to Pull Latest Code:**

### **Option 1: Firebase Console (Recommended)**

1. **Go to**: https://console.firebase.google.com/project/mapping-772cf/hosting
2. **Find your connected repository**: `theorem6/lte-pci-mapper`
3. **Click**: "Redeploy" or "Deploy latest"
4. **Or**: "Sync" or "Pull latest" button

### **Option 2: Firebase CLI Commands**

If you have Firebase CLI access in the Web IDE:

```bash
# Pull latest from GitHub
git pull origin main

# Install/update dependencies
npm install

# Build the project
npm run build

# Deploy to Firebase
firebase deploy
```

### **Option 3: Force Redeploy**

```bash
# Force pull latest changes
git fetch origin
git reset --hard origin/main

# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# Build and deploy
npm run build
firebase deploy
```

### **Option 4: Complete Reset**

```bash
# Remove all local changes
git clean -fd
git reset --hard HEAD

# Pull latest from main branch
git pull origin main

# Force reinstall dependencies
npm run force-install

# Build and deploy
npm run build
firebase deploy
```

## 🔧 **Specific Commands for Your Project:**

### **Pull Latest Dependencies:**
```bash
# Update to latest versions
npm run update-deps

# Or manually:
npx npm-check-updates -u
npm install
```

### **Build and Deploy:**
```bash
# Build the project
npm run build

# Deploy to Firebase
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions
```

## 📋 **Environment Variables Check:**

Make sure these are set in Firebase Console:

```env
PUBLIC_FIREBASE_API_KEY=AIzaSyDb5KthFS4DY4hZ_B8jsA3uxEsu6snQqWA
PUBLIC_FIREBASE_AUTH_DOMAIN=mapping-772cf.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=mapping-772cf
PUBLIC_ARCGIS_API_KEY=AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ
PUBLIC_GEMINI_API_KEY=AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg
```

## 🎯 **Quick One-Liner Commands:**

### **Pull and Deploy:**
```bash
git pull origin main && npm install && npm run build && firebase deploy
```

### **Force Update Everything:**
```bash
git fetch origin && git reset --hard origin/main && npm run force-install && npm run build && firebase deploy
```

### **Update Dependencies and Deploy:**
```bash
npm run update-deps && npm run build && firebase deploy
```

## 🔍 **Check Current Status:**

```bash
# Check git status
git status

# Check current branch
git branch

# Check latest commits
git log --oneline -5

# Check if connected to correct remote
git remote -v
```

## 🚨 **If Commands Don't Work:**

### **Check Firebase CLI:**
```bash
# Check if Firebase CLI is available
firebase --version

# Login to Firebase
firebase login

# Check current project
firebase projects:list
```

### **Check Node.js:**
```bash
# Check Node.js version
node --version

# Check npm version
npm --version
```

## 🎉 **Expected Result:**

After running these commands, you should have:
- ✅ Latest clean code from GitHub
- ✅ Updated dependencies (Svelte 5.0, SvelteKit 2.7.4, etc.)
- ✅ Working ArcGIS integration
- ✅ Firebase backend configured
- ✅ Gemini AI analysis
- ✅ Professional UI/UX

**Your app will be live at**: https://mapping-772cf.web.app

## 🚀 **Recommended Command Sequence:**

```bash
# 1. Pull latest code
git pull origin main

# 2. Update dependencies
npm run update-deps

# 3. Build project
npm run build

# 4. Deploy to Firebase
firebase deploy
```

**Run these commands in your Firebase Web IDE terminal!** 🚀
