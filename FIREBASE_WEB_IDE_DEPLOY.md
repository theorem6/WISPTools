# 🔥 Deploy LTE WISP Management Platform to Firebase Web IDE

## Overview

To test the new Module Manager in Firebase Web IDE, you need to push it to your GitHub repository and then pull/sync in Firebase.

---

## 🚀 Quick Deploy Steps

### Option 1: Deploy Module_Manager (Recommended)

The Module_Manager is the new main application. Deploy this to test the platform.

```bash
# 1. Navigate to Module_Manager
cd Module_Manager

# 2. Initialize git (if not already)
git init

# 3. Add all files
git add .

# 4. Commit
git commit -m "Initial Module Manager - LTE WISP Management Platform"

# 5. Add remote (use your existing GitHub repo or create new one)
git remote add origin https://github.com/YOUR_USERNAME/lte-wisp-platform.git

# 6. Push to GitHub
git push -u origin main
```

### Option 2: Push from Main Project Directory

If you want to push everything including documentation:

```bash
# From PCI_mapper directory
cd c:\Users\david\Downloads\PCI_mapper

# Add and commit all changes
git add .
git commit -m "Transform to LTE WISP Management Platform with Module Manager"

# Push to GitHub
git push origin main
```

---

## 🔗 Connect to Firebase Web IDE

### Method 1: Firebase App Hosting (Recommended)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project

2. **Navigate to App Hosting**
   - Click "App Hosting" in left sidebar
   - Or go to: https://console.firebase.google.com/project/YOUR_PROJECT_ID/apphosting

3. **Connect GitHub Repository**
   - Click "Get Started" or "Add Backend"
   - Authorize Firebase to access your GitHub
   - Select repository: `YOUR_USERNAME/lte-wisp-platform`
   - Choose branch: `main`
   - Set root directory: `Module_Manager` (if deploying just the Module Manager)

4. **Configure Build**
   - Build command: `npm run build`
   - Output directory: `build` or `.svelte-kit/output`
   - Install command: `npm install`

5. **Set Environment Variables**
   ```
   PUBLIC_FIREBASE_API_KEY=your_api_key
   PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

6. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Access your app at the provided URL

---

## 🔄 Sync/Pull Updates

### After Pushing Changes to GitHub

**In Firebase Console**:

1. Go to **App Hosting** → Your Backend
2. Click **"Actions"** → **"Deploy Latest"**
3. Or click **"Redeploy"** button
4. Firebase will automatically pull latest code and deploy

**Automatic Syncing**:
- Firebase App Hosting can auto-deploy on every GitHub push
- Enable in Settings → Build Configuration → Auto-deploy

---

## 📦 What to Deploy

### For Module Manager Testing

Deploy the **Module_Manager** fork:

```
GitHub Repo Structure:
your-repo/
├── Module_Manager/      ← Point Firebase here
│   ├── src/
│   ├── package.json
│   └── svelte.config.js
└── (other forks)
```

### Firebase Configuration

Create `Module_Manager/firebase.json`:

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

Create `Module_Manager/.firebaserc`:

```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

---

## 🛠️ Setup Firebase CLI Deployment

### Install Firebase Tools

```powershell
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Navigate to Module_Manager
cd Module_Manager

# Initialize Firebase
firebase init

# Select:
# - Hosting
# - Use existing project
# - Public directory: build
# - Single-page app: Yes
# - Automatic builds: Yes (if using GitHub)
```

### Deploy from Local

```bash
# Build the project
npm run build

# Deploy to Firebase
firebase deploy

# Or deploy only hosting
firebase deploy --only hosting
```

### Deploy URL

Your app will be live at:
- `https://YOUR_PROJECT_ID.web.app`
- `https://YOUR_PROJECT_ID.firebaseapp.com`

---

## 🔧 Project-Specific Configuration

### For Your Current Firebase Project

Based on previous configurations, you likely have:

**Project ID**: One of these:
- `mapping-772cf`
- `lte-pci-mapper-65450042-bbf71`

### Quick Deploy Commands

```bash
# 1. Navigate to Module_Manager
cd c:\Users\david\Downloads\Module_Manager

# 2. Initialize Firebase (if needed)
firebase init hosting

# 3. Select your project
firebase use mapping-772cf
# or
firebase use lte-pci-mapper-65450042-bbf71

# 4. Build
npm run build

# 5. Deploy
firebase deploy --only hosting
```

---

## 📋 Complete Deployment Checklist

### Pre-Deploy

- [ ] Module_Manager code is complete
- [ ] Theme system is working locally (`npm run dev`)
- [ ] Dark mode toggle works
- [ ] All modules are accessible
- [ ] No console errors

### GitHub Push

- [ ] Repository created on GitHub
- [ ] Code pushed to main branch
- [ ] `.gitignore` includes `node_modules`, `build`, `.svelte-kit`
- [ ] README.md updated

### Firebase Setup

- [ ] Firebase project selected
- [ ] App Hosting or Hosting configured
- [ ] Environment variables set
- [ ] Build configuration correct
- [ ] Custom domain (optional)

### Post-Deploy

- [ ] Site loads at Firebase URL
- [ ] Landing page displays correctly
- [ ] Theme toggle works
- [ ] Module navigation works
- [ ] Mobile responsive
- [ ] Dark mode persists

---

## 🔍 Troubleshooting

### Build Fails

```bash
# Check Node.js version (need 18+)
node --version

# Clean install
rm -rf node_modules package-lock.json
npm install

# Test build locally
npm run build
```

### Firebase Deploy Fails

```bash
# Check Firebase login
firebase login --reauth

# Check project
firebase projects:list

# Use correct project
firebase use YOUR_PROJECT_ID

# Try deploying again
firebase deploy --only hosting
```

### App Shows Blank Page

**Check**:
1. Build output directory is correct (`build` or `.svelte-kit/output`)
2. Firebase hosting public directory matches build output
3. SPA rewrite rule is configured
4. Check browser console for errors

**Fix**:
```json
// firebase.json
{
  "hosting": {
    "public": "build",  // or ".svelte-kit/output/client"
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Environment Variables Not Working

In Firebase Console:
1. Go to App Hosting → Settings
2. Add environment variables with `PUBLIC_` prefix
3. Redeploy after adding variables

---

## 🎯 Recommended Workflow

### 1. Local Development

```bash
cd Module_Manager
npm run dev
# Test at http://localhost:5173
```

### 2. Push to GitHub

```bash
git add .
git commit -m "Update: describe changes"
git push origin main
```

### 3. Deploy to Firebase

**Option A: Automatic (if configured)**
- Firebase auto-deploys on push

**Option B: Manual via Console**
- Firebase Console → App Hosting → Deploy Latest

**Option C: CLI**
```bash
npm run build
firebase deploy --only hosting
```

### 4. Test Live

- Visit: `https://your-project-id.web.app`
- Test all features
- Check mobile responsiveness
- Verify dark mode

---

## 📱 Access Your Deployed App

After successful deployment:

1. **Primary URL**: `https://YOUR_PROJECT_ID.web.app`
2. **Alternative URL**: `https://YOUR_PROJECT_ID.firebaseapp.com`
3. **Custom Domain**: Configure in Firebase Console → Hosting

---

## 🚀 Quick Deploy Now

**Fastest way to deploy**:

```bash
# 1. Go to Module_Manager
cd c:\Users\david\Downloads\Module_Manager

# 2. Build
npm run build

# 3. Login to Firebase (if needed)
firebase login

# 4. Initialize (if first time)
firebase init hosting

# 5. Deploy
firebase deploy --only hosting
```

Your LTE WISP Management Platform will be live! 🎉

---

## 📚 Additional Resources

- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Firebase App Hosting Docs](https://firebase.google.com/docs/app-hosting)
- [SvelteKit Deployment](https://kit.svelte.dev/docs/adapter-auto)

---

**Ready to deploy your new platform!** 🚀

