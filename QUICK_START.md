# 🚀 Quick Start - Firebase Deployment

## ✅ What's Already Done

All your APIs are now linked to Firebase! Here's what's configured:

```
📦 Your Project
├── 🔥 Firebase Services
│   ├── Authentication ✅
│   ├── Firestore ✅
│   ├── Storage ✅
│   └── Functions ✅
│
├── 🗺️ ArcGIS Maps ✅
├── 🤖 Gemini AI ✅
├── 🔢 Wolfram Alpha ✅
└── 🗄️ MongoDB (needs setup)
```

## 🎯 3 Steps to Deploy

### Step 1: Set Up MongoDB (5 minutes)

Run the automated script:

**Windows (PowerShell):**
```powershell
.\setup-firebase-secrets.ps1
```

**Linux/Mac:**
```bash
chmod +x setup-firebase-secrets.sh
./setup-firebase-secrets.sh
```

When prompted, enter your MongoDB connection string:
```
mongodb+srv://username:password@cluster.mongodb.net/genieacs?retryWrites=true&w=majority
```

> **Don't have MongoDB?** Get a free cluster at [MongoDB Atlas](https://cloud.mongodb.com)

### Step 2: Set Environment Name (1 minute)

1. Go to [Firebase Console](https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting)
2. Click **"View dashboard"** on your backend
3. Go to **Settings** → **Environment**
4. Leave empty for production (or set to `production`)

### Step 3: Deploy! (2 minutes)

```bash
firebase deploy
```

That's it! 🎉

## 🌐 Your Live URLs

Once deployed, your app will be at:
```
Production:  https://lte-pci-mapper-65450042-bbf71.web.app
Functions:   https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net
```

## 🧪 Test Your APIs

### Test PCI Analysis
```bash
curl -X POST https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/analyzePCI \
  -H "Content-Type: application/json" \
  -d '{"cells":[{"pci":1,"latitude":40.7128,"longitude":-74.0060}]}'
```

### Test GenieACS Integration
```bash
# Sync CPE devices
curl -X POST https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/syncCPEDevices

# Get CPE devices
curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/getCPEDevices
```

## 📊 Monitor Your Deployment

View logs:
```bash
firebase functions:log
```

View specific function:
```bash
firebase functions:log --only analyzePCI
```

## 🎨 Environment Configurations

Your project now supports **3 environments**:

### 🏭 Production (default)
- High performance (2 CPU, 1GB RAM)
- Always warm (min 1 instance)
- Optimized for users

### 🧪 Staging
- Medium performance (1 CPU, 512MB RAM)
- Cold start OK
- For testing before production

### 💻 Development
- Low resources (1 CPU, 512MB RAM)
- Debug mode enabled
- For local testing

Switch environments by setting the **Environment name** in Firebase Console.

## 📚 Full Documentation

Need more details? Check out:
- **`API_CONFIGURATION_SUMMARY.md`** - Quick reference
- **`FIREBASE_API_SETUP.md`** - Complete setup guide
- **`FIREBASE_GENIEACS_DEPLOYMENT_GUIDE.md`** - GenieACS integration

## 🆘 Troubleshooting

### Error: "MongoDB connection failed"
→ Run the secrets setup script again and verify your connection string

### Error: "Function not found"
→ Run `firebase deploy --only functions`

### Error: "Environment variables undefined"
→ Make sure you pushed to GitHub (triggers auto-deployment)

### Need help?
Check the full documentation in **`FIREBASE_API_SETUP.md`**

---

## 🎉 You're Ready!

Your application has access to:
- ✅ Firebase Authentication & Firestore
- ✅ GenieACS TR-069 device management
- ✅ PCI conflict analysis
- ✅ ArcGIS mapping
- ✅ Gemini AI features
- ✅ Wolfram Alpha calculations

Just complete **Step 1** (MongoDB setup) and **Step 3** (deploy)!
