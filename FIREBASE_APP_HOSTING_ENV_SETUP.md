# 🔧 Firebase App Hosting Environment Variables Setup

## ❌ Error: `auth/invalid-api-key`

This error occurs when environment variables are not configured in Firebase App Hosting console.

## ✅ Solution: Set Environment Variables in Firebase Console

### Step 1: Go to App Hosting Settings

1. Open: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting
2. Click on your backend: **pci-mapper**
3. Click on **Settings** tab (or **Environment variables** section)

### Step 2: Add Environment Variables
SKU: CYG-CPCNAC5-3FT

### Step 3: Redeploy

After adding variables:

1. Click **Save** in Firebase Console
2. The app will automatically redeploy with new variables
3. Or manually trigger: **Actions** → **Rollout**

### Alternative: Use Firebase CLI

```bash
# Set environment variables via CLI
firebase apphosting:secrets:set PUBLIC_FIREBASE_API_KEY
# Paste: AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0

firebase apphosting:secrets:set PUBLIC_FIREBASE_AUTH_DOMAIN
# Paste: lte-pci-mapper-65450042-bbf71.firebaseapp.com

# Repeat for all variables...
```

## 🔍 Troubleshooting

### Issue: Variables not showing up

**Check:**
1. Are you in the right project? (lte-pci-mapper-65450042-bbf71)
2. Are you in **App Hosting** section (not Cloud Functions)?
3. Did you click **Save** after adding variables?

### Issue: Still getting invalid-api-key

**Solutions:**
1. Wait 2-3 minutes for deployment to complete
2. Clear browser cache and reload
3. Check Cloud Run logs for actual values being used:
   ```bash
   gcloud run services describe pci-mapper --region us-central1
   ```

### Issue: How to verify variables are set

**In Firebase Console:**
1. App Hosting → pci-mapper → Settings
2. Scroll to "Environment variables"
3. You should see all PUBLIC_* variables listed

**In deployed app (browser console):**
```javascript
// This will show if env vars are loaded
import { config } from '$lib/config';
console.log('Firebase Project:', config.firebase.projectId);
console.log('Has API Key:', config.firebase.apiKey ? 'Yes' : 'No');
```

## 📋 Complete Variable List (Copy-Paste Format)

For easy copying into Firebase Console:

```
Name: PUBLIC_FIREBASE_API_KEY
Value: AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0

Name: PUBLIC_FIREBASE_AUTH_DOMAIN
Value: lte-pci-mapper-65450042-bbf71.firebaseapp.com

Name: PUBLIC_FIREBASE_PROJECT_ID
Value: lte-pci-mapper-65450042-bbf71

Name: PUBLIC_FIREBASE_STORAGE_BUCKET
Value: lte-pci-mapper-65450042-bbf71.firebasestorage.app

Name: PUBLIC_FIREBASE_MESSAGING_SENDER_ID
Value: 1044782186913

Name: PUBLIC_FIREBASE_APP_ID
Value: 1:1044782186913:web:a5367441ce136118948be0

Name: PUBLIC_ARCGIS_API_KEY
Value: AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ

Name: PUBLIC_GEMINI_API_KEY
Value: AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg

Name: PUBLIC_WOLFRAM_APP_ID
Value: WQPAJ72446
```

## ⚡ Quick Fix Summary

1. **Go to**: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting
2. **Click**: Your backend (pci-mapper)
3. **Click**: Settings or Environment variables tab
4. **Add**: All PUBLIC_* variables listed above
5. **Save**: Click save button
6. **Wait**: 2-3 minutes for automatic redeployment
7. **Test**: Visit your deployed URL

## 🎯 Why This Happens

Firebase App Hosting builds your app in a container environment. Unlike local development where it reads from `.env` file, App Hosting needs variables to be explicitly configured in the console.

**Your code uses:**
```typescript
import { env } from '$env/dynamic/public';
const apiKey = env.PUBLIC_FIREBASE_API_KEY || '';
```

**This requires:** Environment variables set in App Hosting console

**Without them:** Variables are empty (`''`), causing `invalid-api-key` error

## ✅ After Fix

You should see:
```
✅ Deployment successful
✅ Authentication working
✅ Firebase connection active
✅ No invalid-api-key errors
```

---

**Need help?** Check the Firebase Console at the URLs above or review logs in Cloud Run.

