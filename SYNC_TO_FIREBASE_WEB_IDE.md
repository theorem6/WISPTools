# 🔄 Synchronize Code to Firebase Web IDE

## 🎯 **Goal: Override Firebase Web IDE with Latest Code from GitHub**

Your local code is updated and pushed to GitHub. Now synchronize it with Firebase Web IDE.

## 📋 **Method 1: Pull Latest Code from GitHub (Recommended)**

### **In Firebase Web IDE Terminal:**

```bash
# Navigate to project directory
cd ~/lte-pci-mapper

# Check current status
git status

# Pull latest code from GitHub (this will override local changes)
git fetch origin
git reset --hard origin/main

# Verify files are updated
ls -la

# Install dependencies (no legacy flags needed)
npm install

# Build the project
npm run build

# Deploy to Firebase
firebase deploy
```

## 📋 **Method 2: Force Sync with GitHub**

### **If Method 1 doesn't work:**

```bash
# Navigate to project directory
cd ~/lte-pci-mapper

# Remove all local changes
git clean -fd
git reset --hard HEAD

# Pull latest from main branch
git pull origin main --force

# Install dependencies
npm install

# Build
npm run build

# Deploy
firebase deploy
```

## 📋 **Method 3: Clone Fresh Repository**

### **If you want a completely clean start:**

```bash
# Remove old directory
cd ~
rm -rf lte-pci-mapper

# Clone fresh from GitHub
git clone https://github.com/theorem6/lte-pci-mapper.git
cd lte-pci-mapper

# Install dependencies
npm install

# Build
npm run build

# Deploy
firebase deploy
```

## 📁 **Expected Directory Structure After Sync:**

```
lte-pci-mapper/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   └── DarkModeToggle.svelte
│   │   ├── arcgisMap.ts
│   │   ├── config.ts
│   │   ├── darkMode.ts
│   │   ├── firebase.ts
│   │   ├── geminiService.ts
│   │   └── pciMapper.ts
│   ├── routes/
│   │   ├── +layout.svelte
│   │   └── +page.svelte
│   ├── app.css
│   └── app.html
├── functions/
│   ├── src/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── package.json
├── vite.config.ts
├── svelte.config.js
├── tsconfig.json
├── README.md
└── ... (other files)
```

## 🔍 **Verify Sync is Successful:**

```bash
# Check git status
git status
# Should show: "Your branch is up to date with 'origin/main'"

# Check latest commit
git log -1
# Should show: "Remove legacy dependencies and conflicts..."

# List all files
ls -la src/lib/
# Should show: darkMode.ts, components/DarkModeToggle.svelte

# Check package.json
cat package.json | grep version
# Should show: "version": "1.0.0"

# Verify dark mode files exist
ls src/lib/components/
# Should show: DarkModeToggle.svelte

ls src/lib/darkMode.ts
# Should exist
```

## 🚀 **Complete Sync Command Sequence:**

```bash
# 1. Navigate to project
cd ~/lte-pci-mapper

# 2. Pull latest code (force override)
git fetch origin
git reset --hard origin/main

# 3. Verify sync
git status
git log -1

# 4. Check directory structure
ls -la src/lib/
ls -la src/lib/components/

# 5. Install dependencies
npm install

# 6. Build project
npm run build

# 7. Deploy to Firebase
firebase deploy
```

## ⚠️ **Important Notes:**

### **This will override ALL local changes:**
- ✅ Latest dark mode implementation
- ✅ Updated package.json (no legacy deps)
- ✅ New dark mode components
- ✅ Updated styling
- ✅ Latest dependencies
- ✅ All bug fixes

### **Files that will be updated:**
- `package.json` - Clean dependencies
- `src/app.css` - Dark mode styles
- `src/routes/+layout.svelte` - Dark mode toggle
- `src/routes/+page.svelte` - Dark mode support
- `src/lib/darkMode.ts` - New file
- `src/lib/components/DarkModeToggle.svelte` - New file
- `src/lib/arcgisMap.ts` - Dark theme support

## 🎯 **Expected Results After Sync:**

```bash
lte-pci-mapper-01284229:~/lte-pci-mapper{main}$ git reset --hard origin/main
HEAD is now at 3b2a03d Remove legacy dependencies and conflicts

lte-pci-mapper-01284229:~/lte-pci-mapper{main}$ npm install
added 1234 packages in 45s

lte-pci-mapper-01284229:~/lte-pci-mapper{main}$ npm run build
vite v6.0.1 building for production...
✓ 1234 modules transformed.
✓ built in 12.34s

lte-pci-mapper-01284229:~/lte-pci-mapper{main}$ firebase deploy
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/mapping-772cf/overview
Hosting URL: https://mapping-772cf.web.app
```

## 🔧 **Troubleshooting:**

### **Issue: "Your local changes would be overwritten"**
```bash
# Solution: Force reset
git reset --hard origin/main
```

### **Issue: "Cannot pull with rebase"**
```bash
# Solution: Force pull
git fetch origin
git reset --hard origin/main
```

### **Issue: "Merge conflicts"**
```bash
# Solution: Abort and force sync
git merge --abort
git reset --hard origin/main
```

### **Issue: "npm install fails"**
```bash
# Solution: Clean install
rm -rf node_modules package-lock.json
npm install
```

## 🎉 **After Successful Sync:**

Your Firebase Web IDE will have:
- ✅ Latest code from GitHub
- ✅ Dark mode fully implemented
- ✅ Clean dependencies (no legacy)
- ✅ All latest features
- ✅ Updated styling
- ✅ Bug fixes

**Your app will be live at: https://mapping-772cf.web.app** 🚀

## 🚀 **Quick Command for Firebase Web IDE:**

```bash
cd ~/lte-pci-mapper && git fetch origin && git reset --hard origin/main && npm install && npm run build && firebase deploy
```

**Run this one-liner to sync everything and deploy!** 🚀
