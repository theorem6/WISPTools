# Firebase API Configuration Guide

This guide explains how to link all APIs to your Firebase project using the environment-based configuration approach.

## 📋 Overview

Your project now uses **Firebase App Hosting** with environment-specific configurations following the [official Firebase multiple environments guide](https://firebase.google.com/docs/app-hosting/multiple-environments).

## 🗂️ Configuration Files

- **`apphosting.yaml`** - Base configuration (Production)
- **`apphosting.staging.yaml`** - Staging environment overrides
- **`apphosting.development.yaml`** - Development environment overrides

## 🔐 Step 1: Set Up MongoDB Secrets

### 1.1 Create MongoDB Atlas Connection String

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Get your connection string from **Database → Connect → Connect your application**
3. Format: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`

### 1.2 Store MongoDB Secrets in Firebase

```bash
# Production MongoDB Secret
firebase functions:secrets:set mongodb-connection-url

# When prompted, paste your production MongoDB connection string:
# mongodb+srv://genieacs-user:YOUR_PASSWORD@genieacs-cluster.xxxxx.mongodb.net/genieacs?retryWrites=true&w=majority

# Staging MongoDB Secret
firebase functions:secrets:set mongodb-staging-connection-url

# Development MongoDB Secret (optional)
firebase functions:secrets:set mongodb-dev-connection-url
```

### 1.3 Grant Service Account Access to Secrets

```bash
# Get your service account email
firebase projects:list

# Grant access (run for each secret)
gcloud secrets add-iam-policy-binding mongodb-connection-url \
  --member=serviceAccount:lte-pci-mapper-65450042-bbf71@appspot.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor \
  --project=lte-pci-mapper-65450042-bbf71
```

## 🌐 Step 2: Configure Environment Names

### 2.1 Set Environment Name in Firebase Console

1. **Go to Firebase Console**: https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71
2. **Select App Hosting** from left navigation
3. **Click "View dashboard"** on your backend
4. **Go to Settings tab** → **Environment**
5. **Set Environment name**:
   - For production backend: leave empty or set to `production`
   - For staging backend: set to `staging`
   - For dev backend: set to `development`

### 2.2 Environment Resolution

Firebase App Hosting automatically selects the configuration file:

```
Environment Name = "staging"
→ Loads: apphosting.staging.yaml + apphosting.yaml (merged)

Environment Name = "development"
→ Loads: apphosting.development.yaml + apphosting.yaml (merged)

Environment Name = empty/not set
→ Loads: apphosting.yaml only
```

## 🔗 Step 3: API Endpoints Available

### Firebase Functions APIs

All Firebase Functions are deployed to:
```
https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net
```

#### GenieACS Integration APIs

| Function | Endpoint | Description |
|----------|----------|-------------|
| `genieacsNBI` | `/genieacsNBI` | GenieACS Northbound Interface |
| `genieacsCWMP` | `/genieacsCWMP` | TR-069 CWMP Protocol Handler |
| `genieacsFS` | `/genieacsFS` | GenieACS File Server |
| `syncCPEDevices` | `/syncCPEDevices` | Sync CPE devices from MongoDB to Firestore |
| `getCPEDevices` | `/getCPEDevices` | Get all CPE devices from Firestore |
| `getCPEDevice` | `/getCPEDevice` | Get single CPE device by ID |
| `updateCPELocation` | `/updateCPELocation` | Update CPE device location |

#### PCI Analysis API

| Function | Endpoint | Description |
|----------|----------|-------------|
| `analyzePCI` | `/analyzePCI` | Analyze PCI conflicts |

### External APIs

| API | Key Variable | Configured In |
|-----|--------------|---------------|
| Firebase | `PUBLIC_FIREBASE_API_KEY` | apphosting.yaml |
| ArcGIS | `PUBLIC_ARCGIS_API_KEY` | apphosting.yaml |
| Gemini AI | `PUBLIC_GEMINI_API_KEY` | apphosting.yaml |
| Wolfram Alpha | `PUBLIC_WOLFRAM_APP_ID` | apphosting.yaml |
| MongoDB | `MONGODB_URI` (secret) | Firebase Secrets |

## 📦 Step 4: Using APIs in Your Application

### 4.1 Access Environment Variables

In your SvelteKit application, access these variables using:

```typescript
// Client-side and Server-side
import { env } from '$env/dynamic/public';

const firebaseApiKey = env.PUBLIC_FIREBASE_API_KEY;
const functionsUrl = env.PUBLIC_FIREBASE_FUNCTIONS_URL;
const genieacsNbiUrl = env.PUBLIC_GENIEACS_NBI_URL;
```

### 4.2 Example: Call GenieACS API

```typescript
// src/lib/services/genieacsApiService.ts
import { env } from '$env/dynamic/public';

export class GenieACSAPIService {
  private baseUrl = env.PUBLIC_GENIEACS_NBI_URL;

  async getCPEDevices() {
    const response = await fetch(`${env.PUBLIC_GET_CPE_DEVICES_URL}`);
    return response.json();
  }

  async syncDevices() {
    const response = await fetch(`${env.PUBLIC_SYNC_CPE_DEVICES_URL}`, {
      method: 'POST'
    });
    return response.json();
  }

  async getDeviceParameters(deviceId: string) {
    const response = await fetch(`${this.baseUrl}/devices/${deviceId}/parameters`);
    return response.json();
  }
}
```

### 4.3 Example: Call PCI Analysis API

```typescript
// src/lib/services/pciApiService.ts
import { env } from '$env/dynamic/public';

export async function analyzePCI(cells: any[]) {
  const response = await fetch(env.PUBLIC_PCI_ANALYSIS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cells })
  });
  return response.json();
}
```

## 🚀 Step 5: Deploy to Firebase

### 5.1 Deploy Everything

```bash
# Deploy all services
firebase deploy

# This deploys:
# - Firebase Functions (GenieACS integration, PCI analysis)
# - Firebase Hosting (Module Manager)
# - Firestore Rules and Indexes
```

### 5.2 Deploy Specific Services

```bash
# Deploy only Functions
firebase deploy --only functions

# Deploy only Hosting
firebase deploy --only hosting

# Deploy only Firestore
firebase deploy --only firestore
```

## 🧪 Step 6: Test Your APIs

### 6.1 Test Firebase Functions

```bash
# Test PCI Analysis
curl -X POST https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/analyzePCI \
  -H "Content-Type: application/json" \
  -d '{"cells": [{"pci": 1, "latitude": 40.7128, "longitude": -74.0060}]}'

# Test CPE Device Sync
curl -X POST https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/syncCPEDevices

# Test Get CPE Devices
curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/getCPEDevices
```

### 6.2 Monitor Function Logs

```bash
# View all function logs
firebase functions:log

# View specific function
firebase functions:log --only analyzePCI
```

## 📊 Step 7: Monitor API Usage

### 7.1 Firebase Console Monitoring

1. **Go to Firebase Console** → **Functions**
2. **View metrics**: Invocations, errors, execution time
3. **Check logs**: Real-time function logs

### 7.2 Cloud Secret Manager

1. **Go to Google Cloud Console** → **Secret Manager**
2. **Monitor**: Secret access, versions
3. **Audit**: Who accessed secrets and when

## 🔧 Troubleshooting

### Common Issues

#### 1. Environment Variables Not Loading

**Problem**: Variables from `apphosting.yaml` are undefined

**Solution**:
```bash
# Verify environment name is set correctly in Firebase Console
# Check that apphosting.[environment].yaml file exists
# Rebuild and redeploy
```

#### 2. MongoDB Connection Failed

**Problem**: Functions can't connect to MongoDB

**Solution**:
```bash
# Verify secret exists
firebase functions:secrets:list

# Verify secret value
firebase functions:secrets:access mongodb-connection-url

# Check MongoDB network access allows Firebase IPs (0.0.0.0/0 for testing)
```

#### 3. CORS Errors

**Problem**: API calls blocked by CORS

**Solution**:
```typescript
// Verify ALLOWED_ORIGINS in apphosting.yaml includes your domain
// Firebase Functions already have CORS middleware enabled
```

## 🎯 Next Steps

1. ✅ **Set up MongoDB secrets** (Step 1)
2. ✅ **Configure environment names** (Step 2)
3. ✅ **Deploy to Firebase** (Step 5)
4. ✅ **Test APIs** (Step 6)
5. 📚 **Integrate APIs into your application** (Step 4)

## 📚 Additional Resources

- [Firebase App Hosting Docs](https://firebase.google.com/docs/app-hosting)
- [Multiple Environments Guide](https://firebase.google.com/docs/app-hosting/multiple-environments)
- [Cloud Secret Manager](https://cloud.google.com/secret-manager/docs)
- [MongoDB Atlas](https://docs.atlas.mongodb.com/)

---

**🎉 All APIs are now linked to your Firebase project!**

Your application can now:
- ✅ Use Firebase Authentication, Firestore, Storage
- ✅ Call Firebase Functions for PCI analysis
- ✅ Integrate with GenieACS for TR-069 device management
- ✅ Use ArcGIS for mapping
- ✅ Leverage Gemini AI for intelligent features
- ✅ Query Wolfram Alpha for computational data

