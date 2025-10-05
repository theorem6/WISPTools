# 🔥 Firebase Environment Variables Setup

## ⚠️ Error: auth/invalid-api-key

This error means environment variables are not set in Firebase App Hosting.

---

## ✅ Solution: Set Environment Variables in Firebase Console

### Step 1: Go to Firebase Console

Visit: **https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting**

### Step 2: Select Your Backend

Click on your deployed backend (e.g., "module-manager" or "pci-mapper")

### Step 3: Go to Settings/Environment Variables

Click "Settings" tab or "Environment variables" section

### Step 4: Add These Variables

Copy and paste each one:

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

### Step 5: Save and Redeploy

1. Click **Save**
2. Wait for automatic redeploy (2-3 minutes)
3. Or manually click **Actions** → **Rollout**

---

## 🔄 Alternative: Deploy with .env File

If you're deploying from Firebase Web IDE terminal:

### Create .env file in Module_Manager:

```bash
cd ~/lte-pci-mapper/Module_Manager

# Create .env file
cat > .env << 'EOF'
PUBLIC_FIREBASE_API_KEY="AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0"
PUBLIC_FIREBASE_AUTH_DOMAIN="lte-pci-mapper-65450042-bbf71.firebaseapp.com"
PUBLIC_FIREBASE_PROJECT_ID="lte-pci-mapper-65450042-bbf71"
PUBLIC_FIREBASE_STORAGE_BUCKET="lte-pci-mapper-65450042-bbf71.firebasestorage.app"
PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1044782186913"
PUBLIC_FIREBASE_APP_ID="1:1044782186913:web:a5367441ce136118948be0"
PUBLIC_ARCGIS_API_KEY="AAPT85fOqywZsicJupSmVSCGrjWNNjURUpnE--wnh6GZUreHU00VSEoRGgbf0JZjKYEmLnUXJw8E5r8Nz55eqYvvfcecdjs2BjpjcShOZgei0o-Myxttbl5f1qu9-AfdJaw4w3ugB4-uH6dh9v0PNN--vklICR-vCwt8YjMxw7CBrsZ5vxsZjo_jp31mV5hlMSSxQMJsKtFh0ltDrN4YwuK_8ZLmHMdIp5w9_jZrqJVlC2I.AT2_12sjSDHZ"
PUBLIC_GEMINI_API_KEY="AIzaSyAVBmH_eC98f6GCIpHZJ8B_y40TuoIjXOg"
PUBLIC_WOLFRAM_APP_ID="WQPAJ72446"
EOF

# Build and deploy
npm run build
firebase deploy --only hosting
```

---

## ⚡ Quick Fix

**For immediate testing in Firebase Web IDE:**

```bash
cd ~/lte-pci-mapper/Module_Manager
cp ../ACS/.env .env
npm run build
firebase deploy --only hosting
```

This copies the working .env from ACS to Module_Manager.

---

## 🎯 Why This Happens

**Local Development**: Reads from `.env` file ✅

**Firebase App Hosting**: Needs variables set in Console (doesn't read .env file) ❌

**Solution**: Set them in Firebase Console OR use Firebase Hosting (reads .env during build)

---

## ✅ After Setting Environment Variables

Your app should:
- ✅ Firebase authentication works
- ✅ ArcGIS map loads
- ✅ No `invalid-api-key` errors
- ✅ Full PCI application functional

---

**Set the environment variables in Firebase Console now!** 🚀

Direct link: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting

