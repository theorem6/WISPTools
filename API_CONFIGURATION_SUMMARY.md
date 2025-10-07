# API Configuration Summary

## ✅ What Has Been Configured

All APIs have been linked to your Firebase project using **Firebase App Hosting** environment-based configuration as per the [official Firebase guide](https://firebase.google.com/docs/app-hosting/multiple-environments).

## 📁 Configuration Files Created

### Environment Configuration Files
- ✅ **`apphosting.yaml`** - Production configuration (base)
- ✅ **`apphosting.staging.yaml`** - Staging environment overrides
- ✅ **`apphosting.development.yaml`** - Development environment overrides

### Documentation
- ✅ **`FIREBASE_API_SETUP.md`** - Complete setup and usage guide
- ✅ **`setup-firebase-secrets.sh`** - Linux/Mac secret setup script
- ✅ **`setup-firebase-secrets.ps1`** - Windows PowerShell secret setup script

## 🔗 APIs Configured

### Firebase Services
| Service | Variable | Status |
|---------|----------|--------|
| Firebase Auth | `PUBLIC_FIREBASE_API_KEY` | ✅ Configured |
| Firebase Auth Domain | `PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ Configured |
| Firebase Project | `PUBLIC_FIREBASE_PROJECT_ID` | ✅ Configured |
| Firebase Storage | `PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ Configured |
| Firebase Messaging | `PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ Configured |
| Firebase App | `PUBLIC_FIREBASE_APP_ID` | ✅ Configured |

### Firebase Functions (Backend APIs)
| Function | Endpoint | Status |
|----------|----------|--------|
| GenieACS NBI | `PUBLIC_GENIEACS_NBI_URL` | ✅ Configured |
| GenieACS CWMP | `PUBLIC_GENIEACS_CWMP_URL` | ✅ Configured |
| GenieACS File Server | `PUBLIC_GENIEACS_FS_URL` | ✅ Configured |
| Sync CPE Devices | `PUBLIC_SYNC_CPE_DEVICES_URL` | ✅ Configured |
| Get CPE Devices | `PUBLIC_GET_CPE_DEVICES_URL` | ✅ Configured |
| PCI Analysis | `PUBLIC_PCI_ANALYSIS_URL` | ✅ Configured |

### External APIs
| API | Variable | Status |
|-----|----------|--------|
| ArcGIS Maps | `PUBLIC_ARCGIS_API_KEY` | ✅ Configured |
| Gemini AI | `PUBLIC_GEMINI_API_KEY` | ✅ Configured |
| Wolfram Alpha | `PUBLIC_WOLFRAM_APP_ID` | ✅ Configured |

### Database Configuration
| Database | Variable | Status |
|----------|----------|--------|
| MongoDB (Production) | `MONGODB_URI` (secret) | ⚠️ Needs setup |
| MongoDB (Staging) | `MONGODB_URI` (secret) | ⚠️ Needs setup |
| MongoDB (Development) | `MONGODB_URI` (secret) | ⚠️ Needs setup |

## 🚀 Quick Start

### 1. Set Up MongoDB Secrets

**Option A: Use the automated script**
```bash
# Linux/Mac
chmod +x setup-firebase-secrets.sh
./setup-firebase-secrets.sh

# Windows PowerShell
.\setup-firebase-secrets.ps1
```

**Option B: Manual setup**
```bash
# Set production MongoDB secret
firebase functions:secrets:set mongodb-connection-url
# Paste your MongoDB connection string when prompted

# Set staging MongoDB secret (optional)
firebase functions:secrets:set mongodb-staging-connection-url

# Set development MongoDB secret (optional)
firebase functions:secrets:set mongodb-dev-connection-url
```

### 2. Configure Environment Name in Firebase Console

1. Go to [Firebase Console → App Hosting](https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting)
2. Click **View dashboard** on your backend
3. Go to **Settings** → **Environment**
4. Set **Environment name**:
   - Production: Leave empty or set to `production`
   - Staging: Set to `staging`
   - Development: Set to `development`

### 3. Deploy to Firebase

```bash
# Deploy everything
firebase deploy

# Or deploy specific services
firebase deploy --only functions
firebase deploy --only hosting
```

### 4. Access APIs in Your Code

```typescript
import { env } from '$env/dynamic/public';

// Firebase Functions
const response = await fetch(env.PUBLIC_GENIEACS_NBI_URL);

// PCI Analysis
const analysis = await fetch(env.PUBLIC_PCI_ANALYSIS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cells: [...] })
});
```

## 🎯 Environment-Specific Configurations

### Production (`apphosting.yaml`)
- CPU: 2 cores
- Memory: 1024 MiB
- Min Instances: 1 (always warm)
- Max Instances: 10
- Concurrency: 100

### Staging (`apphosting.staging.yaml`)
- CPU: 1 core
- Memory: 512 MiB
- Min Instances: 0 (cold start OK)
- Max Instances: 3
- Concurrency: 50

### Development (`apphosting.development.yaml`)
- CPU: 1 core
- Memory: 512 MiB
- Min Instances: 0
- Max Instances: 2
- Concurrency: 10
- Debug Mode: Enabled

## 📊 API Endpoints Reference

### Base URL
```
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net
```

### Available Endpoints

#### GenieACS Integration
```bash
# Get CPE devices
GET /getCPEDevices

# Sync CPE devices from MongoDB
POST /syncCPEDevices

# Get single CPE device
GET /getCPEDevice?id={deviceId}

# Update CPE location
POST /updateCPELocation
Body: { deviceId, latitude, longitude }

# GenieACS NBI proxy
GET /genieacsNBI/*

# GenieACS CWMP (TR-069)
POST /genieacsCWMP

# GenieACS File Server
GET /genieacsFS/*
```

#### PCI Analysis
```bash
# Analyze PCI conflicts
POST /analyzePCI
Body: { cells: [...] }
```

## 🔐 Security

### Environment Variables
- All `PUBLIC_*` variables are exposed to the client (browser)
- Non-public variables (like `MONGODB_URI`) are only available server-side
- Secrets are stored in Google Cloud Secret Manager

### API Keys Security
- ✅ Firebase API Key: Safe to expose (restricted by Firebase Security Rules)
- ✅ ArcGIS API Key: Safe to expose (HTTP referrer restrictions can be set)
- ⚠️ Gemini API Key: Consider using Firebase Functions proxy
- ⚠️ Wolfram API Key: Consider using Firebase Functions proxy

### CORS Configuration
- Production: `lte-pci-mapper-65450042-bbf71.web.app`
- Staging: `lte-pci-mapper-staging.web.app` + `localhost:5173`
- Development: `localhost:5173`

## 📚 Additional Documentation

For detailed information, see:
- **`FIREBASE_API_SETUP.md`** - Complete setup guide
- **`FIREBASE_GENIEACS_DEPLOYMENT_GUIDE.md`** - GenieACS integration guide
- [Firebase App Hosting Docs](https://firebase.google.com/docs/app-hosting)
- [Multiple Environments Guide](https://firebase.google.com/docs/app-hosting/multiple-environments)

## ✅ Next Steps

1. [ ] Run `setup-firebase-secrets.sh` or `setup-firebase-secrets.ps1`
2. [ ] Set environment name in Firebase Console
3. [ ] Deploy to Firebase: `firebase deploy`
4. [ ] Test APIs using examples in `FIREBASE_API_SETUP.md`
5. [ ] Monitor function logs: `firebase functions:log`

---

**🎉 All APIs are now linked and ready to use!**

