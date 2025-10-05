# 🔥 Firebase Web IDE - Quick Command Reference

## For Linux Environment (Firebase Cloud Shell)

---

## 🚀 First Time Setup

### **If Using GitHub (Recommended)**

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/lte-wisp-platform.git
cd lte-wisp-platform

# Install dependencies
npm install

# Build
npm run build

# Setup Firebase
firebase login
firebase use mapping-772cf

# Deploy
firebase deploy --only hosting
```

### **If Uploading Directly**

```bash
# After uploading and extracting ZIP
cd Module_Manager

# Install
npm install

# Build  
npm run build

# Setup Firebase
firebase login
firebase use mapping-772cf

# Deploy
firebase deploy --only hosting
```

---

## 🔄 Update Workflow

### **Pull Changes from GitHub**

```bash
# Navigate to project
cd lte-wisp-platform  # or Module_Manager

# Pull latest
git pull origin main

# Install any new dependencies
npm install

# Build
npm run build

# Deploy
firebase deploy --only hosting
```

---

## 📦 Essential Commands

### **Project Setup**
```bash
# Check Node version
node --version

# Check npm version  
npm --version

# Install dependencies
npm install

# Clean install (if issues)
rm -rf node_modules package-lock.json && npm install
```

### **Build Commands**
```bash
# Development server (testing)
npm run dev

# Production build
npm run build

# Type checking
npm run check
```

### **Firebase Commands**
```bash
# Login
firebase login

# List projects
firebase projects:list

# Use specific project
firebase use mapping-772cf

# Initialize hosting
firebase init hosting

# Deploy everything
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# View hosting URL
firebase hosting:sites:list
```

### **Git Commands**
```bash
# Check status
git status

# Pull latest changes
git pull origin main

# View commit history
git log --oneline -10

# Show remote URL
git remote -v
```

---

## 🛠️ Troubleshooting Commands

### **Fix Permission Issues**
```bash
# Make script executable
chmod +x setup-github.sh

# Run script
./setup-github.sh
```

### **Fix Node Modules**
```bash
# Remove and reinstall
rm -rf node_modules package-lock.json
npm install
```

### **Check Build Output**
```bash
# List build directory
ls -la build/

# Check build size
du -sh build/
```

### **View Firebase Logs**
```bash
# View deployment logs
firebase hosting:channel:list

# Check project info
firebase projects:list
```

---

## 📋 Complete Deploy Sequence

**Copy and paste this entire block:**

```bash
# Navigate to project
cd lte-wisp-platform

# Pull latest (if using GitHub)
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Deploy
firebase deploy --only hosting

# Done! Check your live URL
```

---

## 🎯 Your Specific Setup

**GitHub Repository**: (to be created)
- Name: `lte-wisp-platform`
- URL: `https://github.com/YOUR_USERNAME/lte-wisp-platform.git`

**Firebase Project**: 
- Project ID: `mapping-772cf`
- Console: https://console.firebase.google.com/project/mapping-772cf

**Commands for your setup**:
```bash
git clone https://github.com/YOUR_USERNAME/lte-wisp-platform.git
cd lte-wisp-platform
npm install
npm run build
firebase use mapping-772cf
firebase deploy --only hosting
```

---

## 🔄 Daily Workflow

### **When You Make Changes Locally**

**On Windows**:
```powershell
git add .
git commit -m "Your changes"
git push origin main
```

**In Firebase Web IDE**:
```bash
cd lte-wisp-platform
git pull origin main
npm run build
firebase deploy --only hosting
```

---

## ⚡ One-Line Shortcuts

```bash
# Quick update and deploy
git pull && npm install && npm run build && firebase deploy --only hosting

# Force clean build and deploy
rm -rf node_modules build && npm install && npm run build && firebase deploy --only hosting

# Check everything
node --version && npm --version && firebase --version && git status
```

---

## 📁 File Structure in Firebase Web IDE

```
/workspace/
├── lte-wisp-platform/        # Your project
│   ├── src/
│   │   ├── routes/
│   │   └── styles/
│   ├── build/                # After npm run build
│   ├── node_modules/         # After npm install
│   ├── package.json
│   ├── firebase.json
│   └── README.md
```

---

## 🆘 Common Errors & Fixes

### **"fatal: not a git repository"**
```bash
# You're not in the right directory
cd lte-wisp-platform  # or wherever your project is
```

### **"npm: command not found"**
```bash
# Check Node installation
which node
which npm

# If missing, Node should be pre-installed in Firebase Web IDE
# Try different version
nvm use 18
```

### **"firebase: command not found"**
```bash
# Install Firebase Tools
npm install -g firebase-tools
firebase --version
```

### **"Error: HTTP Error: 404"**
```bash
# Wrong project ID
firebase use mapping-772cf

# Or check available projects
firebase projects:list
```

### **Build errors**
```bash
# Clean everything
rm -rf node_modules package-lock.json build .svelte-kit
npm install
npm run build
```

---

## ✅ Verify Everything Works

```bash
# 1. Check you're in the right place
pwd
# Should show: .../lte-wisp-platform or .../Module_Manager

# 2. Check files exist
ls -la
# Should see: package.json, src/, firebase.json

# 3. Check Node
node --version
npm --version
# Should show v18+ or v20+

# 4. Check Firebase
firebase --version
firebase projects:list
# Should show your project

# 5. Test build locally
npm run build
# Should create build/ directory

# 6. Deploy
firebase deploy --only hosting
# Should show success and URL
```

---

## 🚀 Quick Deploy NOW

**Just run this:**

```bash
# Setup (first time only)
git clone https://github.com/YOUR_USERNAME/lte-wisp-platform.git
cd lte-wisp-platform
npm install
firebase use mapping-772cf

# Build and deploy
npm run build
firebase deploy --only hosting
```

**Your app will be live at**: `https://mapping-772cf.web.app`

---

**Keep this file handy for quick reference!** 📌

