# 🔥 Firebase Web IDE Setup - Linux Environment

## For Firebase Web IDE (Cloud Shell - Linux)

Firebase Web IDE runs on **Linux**, so you need bash scripts (.sh) instead of PowerShell (.ps1).

---

## 🎯 Two Approaches

### **Approach 1: Work Locally, Push to GitHub, Pull in Firebase** (Recommended)

This is the easiest workflow:

1. **Set up Git locally** (Windows)
2. **Push to GitHub**
3. **Pull in Firebase Web IDE**

### **Approach 2: Upload Directly to Firebase Web IDE**

Upload your Module_Manager folder directly to Firebase Web IDE.

---

## 📋 Approach 1: Local → GitHub → Firebase (Recommended)

### **Step 1: Setup Git Locally (Windows)**

```powershell
# On your Windows machine
cd c:\Users\david\Downloads\Module_Manager

# Initialize git
git init
git branch -M main

# Add files
git add .

# Commit
git commit -m "Initial commit: LTE WISP Management Platform"
```

### **Step 2: Create GitHub Repository**

1. Go to: https://github.com/new
2. Name: `lte-wisp-platform`
3. Description: "LTE WISP Management Platform"
4. **Don't** check "Initialize with README"
5. Click "Create repository"
6. Copy the repository URL

### **Step 3: Push to GitHub**

```powershell
# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/lte-wisp-platform.git

# Push
git push -u origin main
```

### **Step 4: Clone in Firebase Web IDE**

Now in **Firebase Web IDE** (Linux terminal):

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/lte-wisp-platform.git

# Navigate into it
cd lte-wisp-platform

# Install dependencies
npm install

# Build
npm run build

# Deploy
firebase deploy --only hosting
```

### **Step 5: Future Updates**

**On Windows** (make changes):
```powershell
cd c:\Users\david\Downloads\Module_Manager
# Make your changes...
git add .
git commit -m "Updated features"
git push origin main
```

**In Firebase Web IDE** (pull changes):
```bash
cd lte-wisp-platform
git pull origin main
npm install
npm run build
firebase deploy --only hosting
```

---

## 📋 Approach 2: Direct Upload to Firebase Web IDE

### **Step 1: Zip Your Module_Manager**

On Windows:
```powershell
cd c:\Users\david\Downloads
Compress-Archive -Path Module_Manager -DestinationPath Module_Manager.zip
```

Or right-click Module_Manager folder → Send to → Compressed (zipped) folder

### **Step 2: Upload to Firebase Web IDE**

1. Open Firebase Web IDE
2. Click **Upload** button or **File** → **Upload**
3. Select `Module_Manager.zip`
4. Wait for upload

### **Step 3: Extract in Firebase Web IDE**

```bash
# Unzip
unzip Module_Manager.zip

# Navigate
cd Module_Manager

# Install
npm install

# Build
npm run build

# Deploy
firebase deploy --only hosting
```

---

## 🔧 Firebase Web IDE Terminal Commands

Once you have Module_Manager in Firebase Web IDE, use these commands:

### **Initial Setup**

```bash
# Navigate to your project
cd Module_Manager

# Check Node.js version (should be 18+)
node --version
npm --version

# Install dependencies
npm install

# Verify everything works
npm run dev
```

### **Build and Deploy**

```bash
# Build for production
npm run build

# Initialize Firebase (if first time)
firebase init hosting

# Select:
# - Existing project: mapping-772cf
# - Public directory: build
# - Single-page app: Yes
# - Automatic builds: No

# Deploy
firebase deploy --only hosting

# Or deploy everything
firebase deploy
```

### **Git Operations** (if using GitHub)

```bash
# Check status
git status

# Pull latest changes
git pull origin main

# Make changes and push
git add .
git commit -m "Your message"
git push origin main
```

---

## 🔗 Connect Firebase Project

### **If Firebase Not Initialized**

```bash
# Login (if needed)
firebase login

# List your projects
firebase projects:list

# Use your project
firebase use mapping-772cf
# or
firebase use lte-pci-mapper-65450042-bbf71

# Initialize hosting
firebase init hosting
```

### **Configure firebase.json**

The `firebase.json` file is already created for you:

```json
{
  "hosting": {
    "public": "build",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

---

## 🚀 Quick Deploy Workflow

### **Complete Deployment (First Time)**

```bash
# 1. Navigate to Module_Manager
cd Module_Manager

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Login to Firebase
firebase login

# 5. Select project
firebase use mapping-772cf

# 6. Deploy
firebase deploy --only hosting
```

### **Update Deployment (After Changes)**

```bash
# 1. Pull changes (if using GitHub)
git pull origin main

# 2. Install any new dependencies
npm install

# 3. Build
npm run build

# 4. Deploy
firebase deploy --only hosting
```

---

## 🛠️ Scripts I Created for You

### **For Linux (Firebase Web IDE):**

- ✅ `Module_Manager/setup-github.sh` - Bash script for git setup

**To use**:
```bash
cd Module_Manager
chmod +x setup-github.sh
./setup-github.sh
```

### **For Windows (Your Local Machine):**

- ✅ `Module_Manager/setup-github.ps1` - PowerShell script
- ✅ `push-to-github.ps1` - PowerShell push script

---

## 📋 Firebase Web IDE Workflow Summary

### **Recommended Workflow:**

```
┌─────────────────────────────────────────────────┐
│ 1. Work Locally (Windows)                      │
│    - Edit files in VS Code/Cursor              │
│    - Test locally: npm run dev                 │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 2. Push to GitHub (Windows)                    │
│    - git add .                                  │
│    - git commit -m "message"                    │
│    - git push origin main                       │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 3. Pull in Firebase Web IDE (Linux)            │
│    - git pull origin main                       │
│    - npm install                                │
│    - npm run build                              │
│    - firebase deploy                            │
└─────────────────────────────────────────────────┘
```

---

## 🔍 Troubleshooting Firebase Web IDE

### **"npm: command not found"**

```bash
# Check Node.js installation
node --version

# If not installed, Firebase Web IDE should have it
# Try:
nvm use 18
# or
nvm use 20
```

### **"firebase: command not found"**

```bash
# Install Firebase Tools
npm install -g firebase-tools

# Verify
firebase --version
```

### **"Permission denied" on .sh script**

```bash
# Make script executable
chmod +x setup-github.sh

# Then run
./setup-github.sh
```

### **"Build failed"**

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Try build again
npm run build
```

### **"Cannot find module"**

```bash
# Ensure you're in the right directory
pwd
# Should show: .../Module_Manager

# Install dependencies
npm install
```

---

## 📊 Environment Comparison

| Feature | Windows (Local) | Firebase Web IDE (Linux) |
|---------|----------------|--------------------------|
| OS | Windows 10/11 | Linux (Cloud Shell) |
| Scripts | `.ps1` PowerShell | `.sh` Bash |
| Path separator | `\` backslash | `/` forward slash |
| Commands | PowerShell | Bash |
| Best for | Development | Deployment |

---

## 🎯 Your Next Steps (Firebase Web IDE)

### **Option A: If you already pushed to GitHub**

```bash
# In Firebase Web IDE terminal
git clone https://github.com/YOUR_USERNAME/lte-wisp-platform.git
cd lte-wisp-platform
npm install
npm run build
firebase use mapping-772cf
firebase deploy --only hosting
```

### **Option B: If starting fresh**

1. **On Windows**: Run setup locally and push to GitHub
2. **In Firebase Web IDE**: Clone and deploy (see Option A)

### **Option C: Direct upload**

1. Zip Module_Manager folder on Windows
2. Upload to Firebase Web IDE
3. Extract and deploy

---

## 📚 Key Files for Firebase Web IDE

Already created for you:

- ✅ `firebase.json` - Hosting configuration
- ✅ `.gitignore` - Git ignore rules
- ✅ `setup-github.sh` - Bash setup script (Linux)
- ✅ `package.json` - Dependencies

---

## 🚀 Quick Commands Reference

```bash
# Navigation
cd Module_Manager

# Install
npm install

# Development
npm run dev

# Build
npm run build

# Firebase
firebase login
firebase use mapping-772cf
firebase deploy --only hosting

# Git
git clone URL
git pull origin main
git status
git add .
git commit -m "message"
git push origin main
```

---

## ✅ Ready to Deploy!

**Easiest path right now:**

1. **On Windows**: Push Module_Manager to GitHub (use the PowerShell script)
2. **In Firebase Web IDE**: Clone from GitHub
3. **Deploy**: `npm install && npm run build && firebase deploy`

Your platform will be live! 🎉

---

**Documentation**: 
- This guide: `FIREBASE_WEB_IDE_SETUP.md`
- Complete setup: `SETUP_GIT_AND_DEPLOY.md`
- Quick start: `Module_Manager/QUICK_START.md`

