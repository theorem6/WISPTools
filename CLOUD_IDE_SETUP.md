# 🌥️ Cloud IDE Setup - Get Your Code Ready

## The Issue

You're in a Cloud IDE (Google Cloud Shell, etc.) but the `PCI_mapper` directory doesn't exist yet. You need to get your code there first!

---

## ✅ Solution 1: Clone from GitHub (BEST)

### If your code is on GitHub:

```bash
# Clone your repository
git clone https://github.com/YOUR-USERNAME/PCI_mapper.git

# Or if you've already set it up:
git clone https://github.com/YOUR-USERNAME/lte-pci-mapper.git

# Navigate into it
cd PCI_mapper
```

### Don't remember your GitHub repo URL?

From your **local machine** (Windows), check:

```powershell
cd C:\Users\david\Downloads\PCI_mapper
git remote -v
```

This will show your GitHub URL. Use that in the cloud IDE.

---

## ✅ Solution 2: Push to GitHub First (If Not Already)

If your code isn't on GitHub yet, push it from your local machine:

### On Your Local Windows Machine:

```powershell
cd C:\Users\david\Downloads\PCI_mapper

# Check if you have a remote
git remote -v

# If no remote, add one (create repo on GitHub first!)
git remote add origin https://github.com/YOUR-USERNAME/PCI_mapper.git

# Push everything
git add .
git commit -m "Fixed frontend deployment configuration"
git push -u origin main
```

### Then in Cloud IDE:

```bash
# Clone it
git clone https://github.com/YOUR-USERNAME/PCI_mapper.git
cd PCI_mapper
```

---

## ✅ Solution 3: Use Cloud Shell File Upload

If you don't want to use GitHub:

### In Google Cloud Shell:

1. Click the **⋮** menu (three dots) at top right
2. Click **Upload file** or **Upload folder**
3. Upload your entire `PCI_mapper` folder
4. Wait for upload to complete

**Note:** This can be slow for large projects!

---

## ✅ Solution 4: Use gcloud to Copy Files

### From Your Local Machine:

```powershell
# Compress the project
cd C:\Users\david\Downloads
tar -czf PCI_mapper.tar.gz PCI_mapper

# Upload to Cloud Storage
gsutil cp PCI_mapper.tar.gz gs://YOUR-BUCKET-NAME/

# Or upload directly to Cloud Shell
gcloud cloud-shell scp localhost:PCI_mapper.tar.gz cloudshell:~/
```

### In Cloud Shell:

```bash
# Extract
tar -xzf PCI_mapper.tar.gz
cd PCI_mapper
```

---

## 🎯 Recommended Approach

**Use GitHub!** It's the best way because:

1. ✅ **Version control** - Track all changes
2. ✅ **Automatic deployments** - Firebase can deploy from GitHub
3. ✅ **Easy sync** - Update cloud IDE anytime
4. ✅ **Backup** - Code is safe in the cloud
5. ✅ **Collaboration** - Easy to share and work together

---

## 📋 Complete Setup Steps

### Step 1: Push to GitHub (Local Machine)

```powershell
cd C:\Users\david\Downloads\PCI_mapper

# Stage all your fixed files
git add .

# Commit the fixes
git commit -m "Fixed all frontend deployment issues: rootDirectory, tsconfig, svelte-kit sync"

# Push to GitHub
git push origin main
```

### Step 2: Open Cloud Shell

Go to: https://console.cloud.google.com/?cloudshell=true

### Step 3: Clone in Cloud Shell

```bash
# Clone your repo
git clone https://github.com/YOUR-USERNAME/PCI_mapper.git

# Navigate in
cd PCI_mapper

# Verify files
ls -la Module_Manager/src/app.html
# Should show the file exists!
```

### Step 4: Deploy from Cloud Shell

```bash
# Login to Firebase
firebase login --no-localhost

# Set project
firebase use lte-pci-mapper-65450042-bbf71

# Deploy!
firebase deploy --only apphosting
```

---

## 🔍 Verify You're Ready

After getting the code in Cloud Shell, verify:

```bash
# Check you're in the right place
pwd
# Should show: /home/YOUR_USERNAME/PCI_mapper

# Check the key files exist
ls Module_Manager/src/app.html
# Should exist

# Check configuration
grep "rootDirectory" apphosting.yaml
# Should show: rootDirectory: Module_Manager

# Check tsconfig
grep "extends" Module_Manager/tsconfig.json
# Should show: "extends": "./.svelte-kit/tsconfig.json"
```

---

## 🚀 Quick Start Commands

```bash
# 1. Clone (first time only)
git clone https://github.com/YOUR-USERNAME/PCI_mapper.git
cd PCI_mapper

# 2. Login to Firebase
firebase login --no-localhost

# 3. Set project
firebase use lte-pci-mapper-65450042-bbf71

# 4. Deploy
firebase deploy --only apphosting
```

---

## 🔄 Update Code in Cloud Shell Later

When you make changes locally and push to GitHub:

```bash
# In Cloud Shell
cd PCI_mapper

# Pull latest changes
git pull origin main

# Deploy updated code
firebase deploy --only apphosting
```

---

## 🆘 Troubleshooting

### Can't find GitHub URL?

**On local machine:**
```powershell
cd C:\Users\david\Downloads\PCI_mapper
git remote -v
```

If it shows nothing, you haven't set up GitHub yet.

### GitHub repo doesn't exist?

Create one:
1. Go to https://github.com
2. Click **New repository**
3. Name it `PCI_mapper` or `lte-pci-mapper`
4. Don't initialize with README (you already have code)
5. Copy the URL shown
6. On local machine:
   ```powershell
   git remote add origin https://github.com/YOUR-USERNAME/PCI_mapper.git
   git push -u origin main
   ```

### Firebase login issues in Cloud Shell?

Use the `--no-localhost` flag:
```bash
firebase login --no-localhost
```

This gives you a URL to visit in your browser for authentication.

### Permission denied when deploying?

Make sure you're authenticated:
```bash
# Check gcloud auth
gcloud auth list

# Login if needed
gcloud auth login

# Check Firebase
firebase login:list
```

---

## 💡 Best Practice: GitHub + Firebase Workflow

### Ideal Setup:

```
Your Local Machine (Windows)
    ↓ (git push)
GitHub Repository
    ↓ (git clone / git pull)
Cloud Shell
    ↓ (firebase deploy)
Firebase App Hosting
```

### Benefits:

1. **Version control** - All changes tracked
2. **Easy updates** - Just `git pull` in Cloud Shell
3. **Automatic backups** - Code safe on GitHub
4. **Team collaboration** - Easy to share
5. **CI/CD ready** - Can automate deployments

---

## 🎯 Your Next Steps

1. **On Local Machine:**
   ```powershell
   cd C:\Users\david\Downloads\PCI_mapper
   git add .
   git commit -m "All deployment fixes applied"
   git push origin main
   ```

2. **In Cloud Shell:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/PCI_mapper.git
   cd PCI_mapper
   firebase login --no-localhost
   firebase deploy --only apphosting
   ```

3. **Watch it deploy!** 🚀

---

## 📚 Related Docs

- `ALL_FIXES_APPLIED.md` - Summary of what was fixed
- `DEPLOY_FRONTEND_NOW.md` - Deployment guide
- `QUICK_FIX_CARD.md` - Quick reference

---

**Status**: Waiting for code in Cloud IDE  
**Action**: Clone from GitHub or upload code  
**Then**: Deploy with `firebase deploy --only apphosting`

🌥️ **Get your code into the cloud and let's deploy!**

