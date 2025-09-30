# 🧪 Local Testing Guide - LTE PCI Mapper

## 🎯 **Test Dependencies Locally Before Committing**

Since npm isn't available in this environment, here's how to test locally on your machine:

## 🚀 **Local Testing Steps:**

### **Step 1: Install Node.js and npm**

1. **Download Node.js**: https://nodejs.org/ (LTS version 20+)
2. **Install**: Follow the installation wizard
3. **Verify**: Open terminal and run:
   ```bash
   node --version  # Should show v20.x.x or higher
   npm --version   # Should show 10.x.x or higher
   ```

### **Step 2: Clone and Test Project**

```bash
# Clone the repository
git clone https://github.com/theorem6/lte-pci-mapper.git
cd lte-pci-mapper

# Install dependencies with legacy peer deps
npm install --legacy-peer-deps

# Run type checking
npm run check

# Start development server
npm run dev
```

### **Step 3: Test Build**

```bash
# Build the project
npm run build

# Preview the build
npm run preview
```

### **Step 4: Test Firebase Integration**

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Test Firebase functions locally
firebase emulators:start
```

## 🔧 **Testing Checklist:**

### **✅ Basic Functionality:**
- [ ] `npm install --legacy-peer-deps` completes without errors
- [ ] `npm run check` passes TypeScript validation
- [ ] `npm run dev` starts development server
- [ ] `npm run build` creates dist folder successfully
- [ ] `npm run preview` serves the built app

### **✅ Application Features:**
- [ ] App loads in browser (usually http://localhost:5173)
- [ ] Sample LTE cell data loads
- [ ] ArcGIS map renders correctly
- [ ] PCI conflict detection works
- [ ] Export functionality works
- [ ] Responsive design works on mobile

### **✅ Firebase Integration:**
- [ ] Firebase configuration loads
- [ ] Environment variables are set correctly
- [ ] Firestore rules are valid
- [ ] Cloud Functions compile
- [ ] Firebase emulator starts

### **✅ Dependencies:**
- [ ] Svelte 5.0 works correctly
- [ ] SvelteKit 2.7.4 routing works
- [ ] TypeScript 5.7.2 compiles
- [ ] ArcGIS 4.32.0 maps load
- [ ] Firebase 11.1.0 connects

## 🚨 **Common Issues and Solutions:**

### **Issue: ERESOLVE Dependency Conflicts**
```bash
# Solution: Use legacy peer deps
npm install --legacy-peer-deps
```

### **Issue: TypeScript Errors**
```bash
# Solution: Check TypeScript version
npm run check
```

### **Issue: ArcGIS Map Not Loading**
```bash
# Solution: Check API key in config
# Verify PUBLIC_ARCGIS_API_KEY is set
```

### **Issue: Firebase Connection Failed**
```bash
# Solution: Check Firebase config
# Verify all PUBLIC_FIREBASE_* variables are set
```

## 🎯 **Test Commands:**

### **Quick Test Sequence:**
```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Type check
npm run check

# 3. Start dev server
npm run dev

# 4. In another terminal, test build
npm run build

# 5. Test preview
npm run preview
```

### **Comprehensive Test:**
```bash
# Full test sequence
npm install --legacy-peer-deps && \
npm run check && \
npm run build && \
npm run preview
```

## 📋 **Environment Variables for Local Testing:**

Create `.env` file in project root:
```env
PUBLIC_FIREBASE_API_KEY=AIzaSyDb5KthFS4DY4hZ_B8jsA3uxEsu6snQqWA
PUBLIC_FIREBASE_AUTH_DOMAIN=mapping-772cf.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID=mapping-772cf
PUBLIC_FIREBASE_STORAGE_BUCKET=mapping-772cf.firebasestorage.app
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=483370858924
PUBLIC_FIREBASE_APP_ID=1:483370858924:web:b4890ced5af95e3153e209
PUBLIC_FIREBASE_MEASUREMENT_ID=G-2T2D6CWTTV
PUBLIC_ARCGIS_API_KEY=AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ
PUBLIC_GEMINI_API_KEY=AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg
```

## 🎉 **Expected Results:**

### **Development Server:**
- **URL**: http://localhost:5173
- **Features**: Hot reload, TypeScript checking, SvelteKit routing

### **Build Output:**
- **Folder**: `dist/`
- **Files**: Optimized HTML, CSS, JS bundles
- **Size**: Should be reasonable (under 10MB)

### **Preview Server:**
- **URL**: http://localhost:4173
- **Features**: Production-like environment

## 🚀 **After Successful Testing:**

```bash
# Commit tested changes
git add .
git commit -m "Test and verify all dependencies work correctly"

# Push to GitHub
git push origin main
```

## 📊 **Performance Benchmarks:**

### **Build Time:**
- **Development**: < 30 seconds
- **Production**: < 60 seconds

### **Bundle Size:**
- **Main bundle**: < 2MB
- **Total assets**: < 10MB

### **Load Time:**
- **First load**: < 3 seconds
- **Subsequent loads**: < 1 second

**Run these tests locally before committing to ensure everything works!** 🚀
