# 🔥 Import GitHub Repository to Firebase IDE

## Method 1: Firebase CLI (Recommended)

### Step 1: Install Firebase CLI
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login
```

### Step 2: Clone and Setup
```bash
# Clone your repository
git clone https://github.com/theorem6/lte-pci-mapper.git
cd lte-pci-mapper

# Initialize Firebase project (choose your project: mapping-772cf)
firebase init

# Choose:
# - Hosting (for web app)
# - Functions (for backend functions)
# - Firestore (for database)
```

### Step 3: Configure Firebase
```bash
# Link to your Firebase project
firebase use --add

# Select: mapping-772cf (your project)
firebase use mapping-772cf
```

## Method 2: Direct GitHub Import (If Available)

### Firebase Console Method:
1. **Go to**: https://console.firebase.google.com/
2. **Select**: mapping-772cf project
3. **Go to**: Hosting or Functions
4. **Look for**: "Import from GitHub" or "Connect Repository"
5. **Enter**: `https://github.com/theorem6/lte-pci-mapper`

## Method 3: Firebase Extensions

### Install SvelteKit Firebase Integration:
```bash
# In your project directory
npm install @sveltejs/adapter-firebase
```

### Update svelte.config.js:
```javascript
import adapter from '@sveltejs/adapter-firebase';
import { defineConfig } from '@sveltejs/kit';

export default defineConfig({
  kit: {
    adapter: adapter({
      firebaseProject: 'mapping-772cf'
    })
  }
});
```

## Method 4: Manually Upload to Firebase IDE

### If Firebase has a web editor:
1. **Go to**: Firebase Console → Functions/Hosting
2. **Edit**: Browse and upload your src files manually
3. **Or**: Copy-paste the code from GitHub into Firebase editor

## Step-by-Step Firebase CLI Setup

```bash
# 1. Navigate to your local project
cd "C:\Users\david\Downloads\PCI_mapper"

# 2. Initialize Firebase (if not done)
firebase init

# 3. Select services:
# ✅ Hosting: Configure files for Firebase Hosting
# ✅ Functions: Configure a Cloud Functions directory
# ✅ Firestore: Configure Firestore

# 4. Choose options:
# - Project: mapping-772cf
# - Public directory: dist
# - Single-page app: Yes
# - Automatic builds: Yes
# - Functions language: JavaScript/TypeScript
```

## Firebase Hosting Configuration

Create `firebase.json`:
```json
{
  "hosting": {
    "public": "dist",
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
  },
  "functions": {
    "predeploy": [
      "npm run build"
    ]
  }
}
```

## Deploy Commands

```bash
# Build your SvelteKit app
npm run build

# Deploy to Firebase
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions
```

## Environment Variables in Firebase

### For Firebase Functions:
```bash
# Set environment variables
firebase functions:config:set gemini.api_key="AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg"
firebase functions:config:set arcgis.api_key="AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ"
```

## Firebase IDE Access

Once deployed, your app will be available at:
- **Hosting URL**: https://mapping-772cf.web.app
- **Custom Domain**: https://mapping-772cf.firebaseapp.com
- **Functions URL**: https://us-central1-mapping-772cf.cloudfunctions.net

## Troubleshooting Firebase IDE

### If you're using Firebase Web IDE:
1. **Check**: https://console.firebase.google.com/project/mapping-772cf
2. **Hosting**: Look for "Console" or "Editor" link
3. **Functions**: Go to Functions → Edit in Console

### If files don't appear:
1. **Refresh**: Firebase IDE cache
2. **Relink**: GitHub repository
3. **Redeploy**: From Firebase CLI

## Quick Start Command

```bash
# One-command setup (run in your project directory)
npm install -g firebase-tools && firebase login && firebase init && npm run build && firebase deploy
```

Your LTE PCI Mapper will be live at: **https://mapping-772cf.web.app** 🚀
