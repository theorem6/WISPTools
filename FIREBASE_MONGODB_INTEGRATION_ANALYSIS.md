# Firebase & MongoDB Integration Analysis for GenieACS

## Executive Summary

After analyzing the codebase and researching Firebase capabilities, I've identified **three viable approaches** for integrating GenieACS with your existing Firebase infrastructure. The key insight is that **Firebase Hosting cannot directly host MongoDB**, but there are several effective integration strategies.

## Current State Analysis

### ✅ What's Already Working
- **Firebase Project**: Fully configured with Firestore, Auth, Storage, and Functions
- **Firebase Functions**: Already deployed and working for PCI analysis
- **Firestore**: Active with proper rules and indexes
- **Firebase Auth**: Integrated with user management
- **Firebase Hosting**: Deployed and accessible

### 🔍 GenieACS MongoDB Requirements
From analyzing the GenieACS code, MongoDB is used for:
- **Device Storage**: TR-069 device configurations and parameters
- **Task Management**: Device provisioning and configuration tasks
- **Fault Tracking**: Device error logs and diagnostics
- **User Management**: GenieACS user accounts and permissions
- **Configuration**: System settings and presets
- **File Storage**: GridFS for firmware and configuration files

## 🎯 Recommended Solutions

### **Option 1: MongoDB Atlas + Firebase Integration** ⭐ (RECOMMENDED)

**Best for**: Production deployments with full GenieACS functionality

#### Architecture
```
PCI Mapper (Firebase Hosting) ↔ Firebase Functions ↔ MongoDB Atlas ↔ GenieACS Services
```

#### Implementation
1. **Deploy GenieACS on Firebase Functions**
2. **Use MongoDB Atlas** (Google Cloud's MongoDB service)
3. **Create Firebase Functions** as API bridge
4. **Integrate with existing Firestore** for PCI data

#### Benefits
- ✅ Full GenieACS functionality preserved
- ✅ MongoDB expertise and tooling available
- ✅ Scalable cloud infrastructure
- ✅ Integrated with existing Firebase project
- ✅ Cost-effective for large deployments

#### Setup Steps
```bash
# 1. Create MongoDB Atlas cluster
# 2. Deploy GenieACS as Firebase Function
# 3. Create API bridge functions
# 4. Update GenieACS config to use Atlas
```

### **Option 2: Firestore MongoDB Compatibility Layer** 

**Best for**: Simpler deployments with limited GenieACS features

#### Architecture
```
PCI Mapper (Firebase) ↔ Firestore (MongoDB Compatible) ↔ GenieACS (Modified)
```

#### Implementation
1. **Use Firestore Enterprise** with MongoDB compatibility
2. **Modify GenieACS** to use Firestore MongoDB API
3. **Deploy GenieACS** as Firebase Functions

#### Benefits
- ✅ Single Firebase project
- ✅ No external database dependencies
- ✅ Integrated billing and management

#### Limitations
- ❌ Requires Firestore Enterprise (higher cost)
- ❌ Limited MongoDB feature compatibility
- ❌ May require GenieACS code modifications

### **Option 3: Hybrid Architecture**

**Best for**: Gradual migration with existing systems

#### Architecture
```
PCI Mapper (Firebase) ↔ Firebase Functions ↔ MongoDB (Local/Cloud) ↔ GenieACS
```

#### Implementation
1. **Keep GenieACS** on separate server with MongoDB
2. **Create Firebase Functions** as API gateway
3. **Sync relevant data** to Firestore for PCI integration

## 🚀 Detailed Implementation: Option 1 (Recommended)

### Phase 1: MongoDB Atlas Setup

#### 1.1 Create MongoDB Atlas Cluster
```bash
# MongoDB Atlas Setup
1. Go to https://cloud.mongodb.com
2. Create new cluster (M0 free tier available)
3. Configure network access (allow Firebase Functions IPs)
4. Create database user
5. Get connection string
```

#### 1.2 Configure Firebase Environment
```bash
# Add to Firebase Functions environment
firebase functions:config:set \
  mongodb.connection_url="mongodb+srv://username:password@cluster.mongodb.net/genieacs" \
  mongodb.database_name="genieacs"
```

### Phase 2: GenieACS Firebase Functions Deployment

#### 2.1 Create GenieACS Function Structure
```
functions/
├── genieacs/
│   ├── src/
│   │   ├── cwmp.ts          # TR-069 CWMP service
│   │   ├── nbi.ts           # Northbound Interface
│   │   ├── fs.ts            # File Server
│   │   └── ui.ts            # Web UI
│   ├── package.json
│   └── tsconfig.json
```

#### 2.2 Deploy GenieACS as Firebase Functions
```typescript
// functions/genieacs/src/index.ts
import { onRequest } from 'firebase-functions/v2/https';
import { MongoClient } from 'mongodb';
import * as genieacs from './genieacs-core';

const mongoClient = new MongoClient(process.env.MONGODB_CONNECTION_URL!);

export const genieacsCWMP = onRequest({
  region: 'us-central1',
  memory: '1GiB',
  timeoutSeconds: 30
}, async (req, res) => {
  // GenieACS CWMP endpoint
  await genieacs.handleCWMP(req, res, mongoClient);
});

export const genieacsNBI = onRequest({
  region: 'us-central1',
  memory: '512MiB'
}, async (req, res) => {
  // GenieACS Northbound Interface
  await genieacs.handleNBI(req, res, mongoClient);
});
```

### Phase 3: Firebase Functions API Bridge

#### 3.1 Create CPE Device Management Functions
```typescript
// functions/src/cpeManagement.ts
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { MongoClient } from 'mongodb';

const db = getFirestore();
const mongoClient = new MongoClient(process.env.MONGODB_CONNECTION_URL!);

export const syncCPEDevices = onRequest(async (req, res) => {
  // Sync CPE devices from GenieACS to Firestore
  const devices = await getCPEDevicesFromGenieACS();
  
  for (const device of devices) {
    await db.collection('cpe_devices').doc(device.id).set({
      ...device,
      lastSync: new Date(),
      source: 'genieacs'
    });
  }
  
  res.json({ synced: devices.length });
});

export const getCPEDevices = onRequest(async (req, res) => {
  // Get CPE devices from Firestore (for PCI Mapper)
  const snapshot = await db.collection('cpe_devices').get();
  const devices = snapshot.docs.map(doc => doc.data());
  
  res.json({ devices });
});
```

### Phase 4: Integration with Existing PCI Mapper

#### 4.1 Update GenieACS Service
```typescript
// src/lib/genieacs/services/genieacsService.ts
export class FirebaseGenieACSService {
  private functionsUrl: string;
  
  constructor() {
    this.functionsUrl = 'https://us-central1-your-project.cloudfunctions.net';
  }
  
  async getDevices(): Promise<CPEDevice[]> {
    // Use Firebase Functions instead of direct MongoDB
    const response = await fetch(`${this.functionsUrl}/getCPEDevices`);
    const data = await response.json();
    return data.devices;
  }
  
  async syncDevices(): Promise<void> {
    // Trigger sync from GenieACS to Firestore
    await fetch(`${this.functionsUrl}/syncCPEDevices`, {
      method: 'POST'
    });
  }
}
```

#### 4.2 Update Firebase Configuration
```json
// firebase.json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20",
    "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

### Phase 5: Firestore Rules for CPE Data

#### 5.1 Update Firestore Rules
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Existing PCI Mapper rules...
    
    // CPE Devices collection
    match /cpe_devices/{deviceId} {
      allow read, write: if isAuthenticated();
      allow read: if resource.data.isPublic == true;
    }
    
    // CPE Performance data
    match /cpe_performance/{deviceId} {
      allow read, write: if isAuthenticated();
    }
  }
}
```

#### 5.2 Update Firestore Indexes
```json
// firestore.indexes.json
{
  "indexes": [
    // Existing indexes...
    {
      "collectionGroup": "cpe_devices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "location.latitude", "order": "ASCENDING" },
        { "fieldPath": "location.longitude", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "cpe_devices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "lastContact", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## 📊 Cost Analysis

### MongoDB Atlas (Option 1)
- **M0 Free Tier**: 512MB storage, shared RAM
- **M10 Production**: ~$57/month for 2GB RAM, 10GB storage
- **M30 Production**: ~$180/month for 8GB RAM, 40GB storage

### Firestore Enterprise (Option 2)
- **Standard Firestore**: $0.18/GB storage, $0.06/100k reads
- **Enterprise**: Requires contact for pricing
- **MongoDB Compatibility**: Additional cost

### Firebase Functions
- **GenieACS Functions**: ~$0.40/million requests
- **Data Transfer**: $0.12/GB

## 🔧 Migration Strategy

### Step 1: Setup MongoDB Atlas (Week 1)
1. Create MongoDB Atlas cluster
2. Configure network access
3. Test connectivity from Firebase Functions

### Step 2: Deploy GenieACS Functions (Week 2)
1. Create Firebase Functions for GenieACS services
2. Deploy CWMP, NBI, FS, and UI endpoints
3. Test TR-069 communication

### Step 3: Create Integration Layer (Week 3)
1. Build Firebase Functions API bridge
2. Sync CPE data to Firestore
3. Update PCI Mapper to use new service

### Step 4: Testing & Optimization (Week 4)
1. Test with real CPE devices
2. Optimize performance
3. Monitor costs and usage

## 🎯 Benefits of This Approach

### Technical Benefits
- ✅ **Preserves GenieACS functionality** - No feature loss
- ✅ **Leverages Firebase ecosystem** - Auth, Hosting, Functions
- ✅ **Scalable architecture** - MongoDB Atlas scales automatically
- ✅ **Integrated billing** - Firebase + MongoDB Atlas
- ✅ **Real-time sync** - Firestore updates for PCI Mapper

### Operational Benefits
- ✅ **Single deployment** - Everything through Firebase
- ✅ **Integrated monitoring** - Firebase Console + MongoDB Atlas
- ✅ **Backup & recovery** - Built-in MongoDB Atlas features
- ✅ **Security** - Firebase Auth + MongoDB Atlas security

### Cost Benefits
- ✅ **Pay-as-you-scale** - No upfront infrastructure costs
- ✅ **Free tier available** - MongoDB Atlas M0 free tier
- ✅ **Integrated billing** - Manage costs in one place

## 🚀 Quick Start Implementation

### Immediate Next Steps
1. **Create MongoDB Atlas account** and free cluster
2. **Update Firebase Functions** to include MongoDB client
3. **Deploy GenieACS** as Firebase Functions
4. **Test with CPE simulator** or real devices

### Code Changes Required
- ✅ **Minimal changes** to existing PCI Mapper
- ✅ **GenieACS configuration** update for MongoDB Atlas
- ✅ **Firebase Functions** for API bridge
- ✅ **Firestore rules** for CPE data access

## 📋 Conclusion

**Option 1 (MongoDB Atlas + Firebase Integration)** is the recommended approach because:

1. **Preserves full GenieACS functionality** without code modifications
2. **Integrates seamlessly** with existing Firebase infrastructure  
3. **Provides scalable cloud database** with MongoDB expertise
4. **Cost-effective** with free tier available
5. **Future-proof** architecture that can scale with your needs

This approach gives you the best of both worlds: the power of GenieACS with MongoDB and the convenience of Firebase's integrated ecosystem for your PCI Mapper application.
