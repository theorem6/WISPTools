# New Firebase Project Setup Guide

## Overview

This guide will help you set up a fresh Firebase project from scratch, using GitHub as the source of truth.

## Prerequisites

1. **GitHub Repository**: `theorem6/lte-pci-mapper` (source of truth)
2. **Firebase CLI**: Installed and authenticated
3. **Google Cloud Account**: With billing enabled

## Step 1: Create New Firebase Project

### Via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `wisptools-production` (or your preferred name)
4. Click **Continue**
5. **Google Analytics**: 
   - Choose whether to enable (recommended: Yes)
   - Select or create an Analytics account
6. Click **Create project**
7. Wait for project creation to complete
8. Click **Continue**

### Via Firebase CLI

```bash
firebase projects:create wisptools-production --display-name "WISPTools Production"
```

## Step 2: Get Project ID

After project creation, note the **Project ID** (e.g., `wisptools-production-abc123`)

## Step 3: Create Firebase Hosting Site

### Via Firebase Console

1. Go to **Hosting** in the left sidebar
2. Click **"Get started"** or **"Add site"**
3. Enter site ID: `wisptools-io`
4. Click **"Continue"**
5. Site will be created with URL: `wisptools-io.web.app`

### Via Firebase CLI

```bash
firebase hosting:sites:create wisptools-io --project YOUR_PROJECT_ID
```

## Step 4: Create Firebase Web App

### Via Firebase Console

1. Go to **Project Settings** (gear icon)
2. Scroll to **"Your apps"** section
3. Click **Web app icon** (`</>`) or **"Add app"** → **Web**
4. Enter app nickname: `wisptools-web`
5. **Register app** (don't add Firebase Hosting yet)
6. Copy the **Firebase configuration** (you'll need this)

### Via Firebase CLI

```bash
firebase apps:create WEB wisptools-web --project YOUR_PROJECT_ID
```

## Step 5: Link Hosting Site to Web App

### Via Firebase Console

1. Go to **Hosting** → Sites
2. Click on `wisptools-io` site
3. Click **"Connect app"** or **"Link app"**
4. Select the `wisptools-web` app you just created
5. Click **"Link"**

## Step 6: Add Custom Domain

### Via Firebase Console

1. Go to **Hosting** → Sites → `wisptools-io`
2. Click **"Add custom domain"**
3. Enter domain: `wisptools.io`
4. Follow DNS setup instructions:
   - Add A record pointing to Firebase IPs
   - Add AAAA records for IPv6
   - Verify domain ownership
5. Wait for SSL certificate provisioning (can take hours)

## Step 7: Update Local Configuration

### Update .firebaserc

```json
{
  "projects": {
    "default": "YOUR_NEW_PROJECT_ID"
  }
}
```

### Update firebase.json

```json
{
  "hosting": {
    "site": "wisptools-io",
    "public": "Module_Manager/build/client",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "headers": [
      {
        "source": "/api/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate, max-age=0"
          }
        ]
      },
      {
        "source": "**/_app/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(html|json)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      }
    ],
    "rewrites": [
      {
        "source": "/api/deploy/**",
        "function": "isoProxy"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "functions": {
    "source": "functions",
    "predeploy": [
      "npm --prefix \"$RESOURCE_DIR\" install",
      "npm --prefix \"$RESOURCE_DIR\" run build"
    ],
    "runtime": "nodejs20"
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

### Update Module_Manager/src/lib/firebase.ts

Replace with the new Firebase configuration from Step 4:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_NEW_API_KEY",
  authDomain: "YOUR_NEW_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_NEW_PROJECT_ID",
  storageBucket: "YOUR_NEW_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_NEW_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" // Optional
};
```

## Step 8: Add Authorized Domains

1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add these domains:
   - `wisptools.io`
   - `wisptools-io.web.app`
   - `wisptools-io.firebaseapp.com`
   - `localhost` (for development)

## Step 9: Set Up Firebase Functions

```bash
# Initialize functions (if not already done)
cd functions
npm install

# Deploy functions
firebase deploy --only functions --project YOUR_NEW_PROJECT_ID
```

## Step 10: Update GitHub Actions

Update `.github/workflows/firebase-hosting.yml`:

```yaml
env:
  FIREBASE_PROJECT_ID: YOUR_NEW_PROJECT_ID
  # ... rest of config
```

## Step 11: Deploy from Git

```bash
# From project root
cd Module_Manager
npm install
npm run build

# Deploy to new Firebase project
firebase deploy --only hosting:wisptools-io --project YOUR_NEW_PROJECT_ID
```

## Step 12: Verify

1. Check `https://wisptools-io.web.app` loads
2. Check `https://wisptools.io` loads (after DNS propagation)
3. Test authentication works
4. Test API calls work

## Clean Slate Checklist

- [ ] New Firebase project created
- [ ] Hosting site `wisptools-io` created
- [ ] Web app created and linked to hosting
- [ ] Custom domain `wisptools.io` added
- [ ] All authorized domains added
- [ ] `.firebaserc` updated with new project ID
- [ ] `firebase.json` configured for single site
- [ ] `Module_Manager/src/lib/firebase.ts` updated with new config
- [ ] GitHub Actions workflow updated
- [ ] Firebase Functions deployed
- [ ] Frontend deployed and working
- [ ] All domains tested

## Migration Notes

### What to Keep from Old Project

- **Firestore Data**: Export from old project, import to new
- **Firebase Auth Users**: May need to recreate or migrate
- **Storage Files**: Export from old project, import to new
- **Functions Code**: Use existing code from Git

### What to Leave Behind

- Old Firebase project (can be deleted later)
- Old hosting sites
- Old app configurations

## Next Steps

1. Create new Firebase project
2. Follow steps above
3. Test everything
4. Update DNS for `wisptools.io` if needed
5. Delete old project once everything works

