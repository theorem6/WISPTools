# 🔥 Firebase Web IDE - Pull and Deploy

## ✅ Changes Pushed to GitHub!

Your Module_Manager and all changes are now in your GitHub repository:
**https://github.com/theorem6/lte-pci-mapper**

---

## 📋 Steps for Firebase Web IDE

### Step 1: Pull Latest Changes

```bash
# Navigate to your repository (if already cloned)
cd lte-pci-mapper

# Pull latest changes
git pull origin main
```

**OR if you haven't cloned yet:**

```bash
# Clone the repository
git clone https://github.com/theorem6/lte-pci-mapper.git
cd lte-pci-mapper
```

### Step 2: Navigate to Module_Manager

```bash
# Go into the Module_Manager directory
cd Module_Manager

# Verify you're in the right place
pwd
# Should show: .../lte-pci-mapper/Module_Manager

# Check files
ls -la
# Should see: package.json, src/, firebase.json, etc.
```

### Step 3: Install Dependencies

```bash
# Install all npm packages
npm install
```

### Step 4: Build the Project

```bash
# Build for production
npm run build
```

### Step 5: Configure Firebase

```bash
# Make sure you're using the correct Firebase project
firebase use lte-pci-mapper-65450042-bbf71

# Verify
firebase projects:list
```

### Step 6: Deploy

```bash
# Deploy to Firebase Hosting
firebase deploy --only hosting
```

---

## 🚀 Quick Deploy (One Command)

After pulling, you can run everything at once:

```bash
cd lte-pci-mapper/Module_Manager && npm install && npm run build && firebase use lte-pci-mapper-65450042-bbf71 && firebase deploy --only hosting
```

---

## 📊 Repository Structure

Your GitHub repository now contains:

```
lte-pci-mapper/
├── Module_Manager/          ← NEW: Main landing page
│   ├── src/
│   │   ├── routes/
│   │   │   ├── +page.svelte         (Landing page)
│   │   │   └── modules/
│   │   │       └── pci-resolution/  (PCI module)
│   │   └── styles/
│   │       └── theme.css            (Unified theme)
│   ├── package.json
│   ├── firebase.json
│   └── README.md
│
├── PCI/                     ← PCI algorithms
├── Login_Logic/             ← Authentication
├── ARCGIS/                  ← Map visualization
├── ACS/                     ← Legacy app
│
└── Documentation files...
```

---

## 🔄 Future Update Workflow

### When You Make Changes on Windows:

```powershell
cd c:\Users\david\Downloads\PCI_mapper
git add -A
git commit -m "Describe your changes"
git push origin main
```

### In Firebase Web IDE (Pull and Deploy):

```bash
cd lte-pci-mapper
git pull origin main
cd Module_Manager
npm install
npm run build
firebase deploy --only hosting
```

---

## ✅ What You'll See

After deployment:

1. **Firebase Console**: 
   - https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/hosting

2. **Live URL**: 
   - Your Module_Manager will be live at your Firebase hosting URL

3. **Landing Page Features**:
   - LTE WISP Management Platform header
   - 4 module cards (PCI Resolution active)
   - Dark mode toggle
   - Professional UI

---

## 🛠️ Troubleshooting

### "npm: command not found"

```bash
# Check Node version
node --version

# If missing, Firebase Web IDE should have it
nvm use 18
```

### "firebase: command not found"

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase --version
```

### "Build failed"

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

### "Wrong directory"

```bash
# Make sure you're in Module_Manager
pwd
# Should end with: /lte-pci-mapper/Module_Manager

# If not:
cd lte-pci-mapper/Module_Manager
```

---

## 📋 Complete Command Sequence

**Copy and paste this entire block in Firebase Web IDE:**

```bash
# If already cloned, pull latest
cd lte-pci-mapper && git pull origin main

# OR if not cloned yet
git clone https://github.com/theorem6/lte-pci-mapper.git
cd lte-pci-mapper

# Navigate to Module_Manager
cd Module_Manager

# Install dependencies
npm install

# Build
npm run build

# Configure Firebase
firebase use lte-pci-mapper-65450042-bbf71

# Deploy
firebase deploy --only hosting

# Check your live URL!
```

---

## 🎉 Your Platform Will Be Live!

After deployment, your LTE WISP Management Platform will be accessible at your Firebase Hosting URL.

**Features you'll see:**
- ✅ Professional landing page
- ✅ Module Manager dashboard
- ✅ PCI Resolution module (ready for integration)
- ✅ Dark mode toggle with persistence
- ✅ Responsive design
- ✅ Coming soon modules (Coverage, Spectrum, Network Optimization)

---

## 📧 Summary

**GitHub Repo**: https://github.com/theorem6/lte-pci-mapper
**What's New**: Module_Manager/ directory with landing page
**To Deploy**: Pull, install, build, deploy (commands above)

**Ready to deploy your platform!** 🚀

