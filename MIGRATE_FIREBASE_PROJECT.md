# 🔄 Firebase Project Migration Guide

## Current Status

✅ **`.firebaserc`** - Already configured with new project: `lte-pci-mapper-65450042-bbf71`

## 📋 Migration Steps

### 1. **Update Local .env File**

```bash
# Copy the production config to .env
cp .env.production .env
```

Or create `.env` manually with these values:

```bash
# Firebase Configuration - NEW PROJECT
PUBLIC_FIREBASE_API_KEY="AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0"
PUBLIC_FIREBASE_AUTH_DOMAIN="lte-pci-mapper-65450042-bbf71.firebaseapp.com"
PUBLIC_FIREBASE_PROJECT_ID="lte-pci-mapper-65450042-bbf71"
PUBLIC_FIREBASE_STORAGE_BUCKET="lte-pci-mapper-65450042-bbf71.firebasestorage.app"
PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1044782186913"
PUBLIC_FIREBASE_APP_ID="1:1044782186913:web:a5367441ce136118948be0"
PUBLIC_FIREBASE_MEASUREMENT_ID=""

# ArcGIS Configuration
PUBLIC_ARCGIS_API_KEY="AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ"

# Gemini AI Configuration
PUBLIC_GEMINI_API_KEY="AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg"

# Development Settings
NODE_ENV=development
PORT=5173
```

### 2. **Set Environment Variables in Firebase Console** (for production deployment)

Go to: [Firebase Console](https://console.firebase.google.com) → **lte-pci-mapper-65450042-bbf71** → **App Hosting** → **Environment Variables**

Add these variables:
```
PUBLIC_FIREBASE_API_KEY = AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0
PUBLIC_FIREBASE_AUTH_DOMAIN = lte-pci-mapper-65450042-bbf71.firebaseapp.com
PUBLIC_FIREBASE_PROJECT_ID = lte-pci-mapper-65450042-bbf71
PUBLIC_FIREBASE_STORAGE_BUCKET = lte-pci-mapper-65450042-bbf71.firebasestorage.app
PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 1044782186913
PUBLIC_FIREBASE_APP_ID = 1:1044782186913:web:a5367441ce136118948be0
PUBLIC_ARCGIS_API_KEY = AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ
PUBLIC_GEMINI_API_KEY = AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg
```

### 3. **Set Up Firestore & Authentication in New Project**

#### Enable Authentication:
1. Go to: **Authentication** → **Get Started**
2. Enable **Email/Password** sign-in method
3. Enable **Google** sign-in method (optional)

#### Create Firestore Database:
1. Go to: **Firestore Database** → **Create database**
2. Choose **Start in production mode**
3. Select region (same as your project region)

#### Deploy Firestore Rules:
```bash
firebase deploy --only firestore:rules
```

#### Deploy Firestore Indexes:
```bash
firebase deploy --only firestore:indexes
```

### 4. **Migrate Data from Old Project (if needed)**

#### Export from old project:
```bash
# Set to old project
firebase use petersonmappingapp

# Export Firestore data
gcloud firestore export gs://petersonmappingapp.appspot.com/firestore-backup

# Export users
firebase auth:export users.json --format=json
```

#### Import to new project:
```bash
# Set to new project
firebase use lte-pci-mapper-65450042-bbf71

# Import Firestore data
gcloud firestore import gs://petersonmappingapp.appspot.com/firestore-backup

# Import users
firebase auth:import users.json --hash-algo=SCRYPT
```

### 5. **Test Locally**

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Test that Firebase connection works
# - Try signing in
# - Try loading networks
# - Check console for errors
```

### 6. **Deploy to New Project**

```bash
# Deploy everything
firebase deploy

# Or deploy specific services
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## 📊 Project Comparison

| Setting | Old Project | New Project |
|---------|-------------|-------------|
| Project ID | `petersonmappingapp` | `lte-pci-mapper-65450042-bbf71` |
| API Key | `AIzaSyC9pkcLlAt...` | `AIzaSyCaMoHY6ZKcV...` |
| Auth Domain | `petersonmappingapp.firebaseapp.com` | `lte-pci-mapper-65450042-bbf71.firebaseapp.com` |
| Sender ID | `234761360561` | `1044782186913` |

## ⚠️ Important Notes

1. **Don't delete the old project** until you've verified everything works in the new one
2. **Users will need to re-authenticate** (different auth domain)
3. **Data won't transfer automatically** - you need to export/import
4. **Update any external references** (webhooks, APIs, etc.)
5. **Test thoroughly** before switching production traffic

## ✅ Verification Checklist

- [ ] Local `.env` file updated
- [ ] Firebase Console environment variables set
- [ ] Authentication enabled (Email/Password)
- [ ] Firestore database created
- [ ] Firestore rules deployed
- [ ] Firestore indexes deployed
- [ ] Data migrated (if needed)
- [ ] Users migrated (if needed)
- [ ] Local testing complete
- [ ] Production deployment successful
- [ ] Production testing complete

## 🆘 Rollback Plan

If something goes wrong:

```bash
# Switch back to old project
firebase use petersonmappingapp

# Restore old .env
cp .env.backup .env

# Deploy old config
npm run dev
```

## 📞 Support

If you encounter issues:
1. Check Firebase Console for error logs
2. Check browser console for client-side errors
3. Verify all environment variables are set correctly
4. Ensure Firestore rules allow your operations

