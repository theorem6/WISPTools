# Firebase GenieACS Integration - Deployment Guide

## 🎯 Overview

This guide provides step-by-step instructions for deploying the GenieACS integration with Firebase, allowing you to manage TR-069 CPE devices through your existing Firebase infrastructure.

## 📋 Prerequisites

- ✅ Firebase project with Firestore, Functions, and Hosting enabled
- ✅ Firebase CLI installed (`npm install -g firebase-tools`)
- ✅ MongoDB Atlas account (free tier available)
- ✅ Node.js 20+ installed

## 🚀 Step 1: MongoDB Atlas Setup

### 1.1 Create MongoDB Atlas Cluster

1. **Go to MongoDB Atlas**: https://cloud.mongodb.com
2. **Create Account** (if you don't have one)
3. **Create New Cluster**:
   - Choose **M0 Sandbox** (Free tier)
   - Select **AWS** as provider
   - Choose **US East (N. Virginia)** region
   - Cluster Name: `genieacs-cluster`

### 1.2 Configure Network Access

1. **Go to Network Access** in MongoDB Atlas
2. **Add IP Address**:
   - For development: `0.0.0.0/0` (Allow access from anywhere)
   - For production: Add specific IP ranges
3. **Create Database User**:
   - Username: `genieacs-user`
   - Password: Generate strong password
   - Database User Privileges: `Read and write to any database`

### 1.3 Get Connection String

1. **Go to Database** → **Connect**
2. **Choose "Connect your application"**
3. **Copy connection string**:
   ```
   mongodb+srv://genieacs-user:<password>@genieacs-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

## 🔥 Step 2: Firebase Configuration

### 2.1 Set Environment Variables

```bash
# Set MongoDB connection URL
firebase functions:config:set \
  mongodb.connection_url="mongodb+srv://genieacs-user:YOUR_PASSWORD@genieacs-cluster.xxxxx.mongodb.net/genieacs?retryWrites=true&w=majority"

# Verify configuration
firebase functions:config:get
```

### 2.2 Update Firebase Functions Dependencies

```bash
cd functions
npm install mongodb@^4.17.2
npm run build
```

## 🚀 Step 3: Deploy Firebase Functions

### 3.1 Deploy GenieACS Integration Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:syncCPEDevices,functions:getCPEDevices,functions:genieacsNBI
```

### 3.2 Deploy Firestore Rules and Indexes

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes
```

## 🧪 Step 4: Testing the Integration

### 4.1 Test Firebase Functions

```bash
# Test CPE device sync
curl -X POST https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/syncCPEDevices

# Test getting CPE devices
curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/getCPEDevices
```

### 4.2 Test from PCI Mapper

```typescript
// In your PCI Mapper application
import { createFirebaseGenieACSService } from '$lib/genieacs/config/firebaseGenieacsConfig';

const genieacsService = createFirebaseGenieACSService('YOUR_PROJECT_ID');

// Test getting devices
const devices = await genieacsService.getCPEDevices();
console.log('CPE Devices:', devices);

// Test syncing devices
const syncResult = await genieacsService.syncCPEDevices();
console.log('Sync Result:', syncResult);
```

## 📊 Step 5: Initialize GenieACS Data

### 5.1 Set Up GenieACS Collections in MongoDB

```javascript
// Connect to MongoDB Atlas and create initial collections
use genieacs;

// Create devices collection with sample data
db.devices.insertOne({
  _id: "sample-device-1",
  _deviceId: {
    Manufacturer: "Nokia",
    OUI: "001E58",
    ProductClass: "LTE Router",
    SerialNumber: "SN123456789"
  },
  _lastInform: new Date(),
  _registered: new Date(),
  "Device.DeviceInfo.Manufacturer": "Nokia",
  "Device.DeviceInfo.ProductClass": "LTE Router",
  "Device.DeviceInfo.SerialNumber": "SN123456789",
  "Device.DeviceInfo.SoftwareVersion": "1.0.0",
  "Device.GPS.Latitude": "40.7128",
  "Device.GPS.Longitude": "-74.0060",
  "Device.IP.Interface.1.IPAddress": "192.168.1.100",
  "Device.Ethernet.Interface.1.MACAddress": "00:1E:58:12:34:56"
});
```

### 5.2 Trigger Initial Sync

```bash
# Trigger sync from Firebase Functions
curl -X POST https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/syncCPEDevices
```

## 🔧 Step 6: Configure GenieACS Services

### 6.1 Set Up GenieACS CWMP (TR-069 Protocol)

```bash
# Deploy GenieACS CWMP service
firebase deploy --only functions:genieacsCWMP

# Configure CPE devices to connect to:
# https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/genieacsCWMP
```

### 6.2 Set Up GenieACS File Server

```bash
# Deploy GenieACS File Server
firebase deploy --only functions:genieacsFS

# File server URL:
# https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/genieacsFS
```

## 📱 Step 7: Update PCI Mapper Frontend

### 7.1 Update GenieACS Service Configuration

```typescript
// src/lib/genieacs/services/genieacsService.ts
import { createFirebaseGenieACSService } from '../config/firebaseGenieacsConfig';

export class FirebaseGenieACSService {
  private firebaseService: FirebaseGenieACSService;
  
  constructor(config: GenieACSServiceConfig) {
    this.firebaseService = createFirebaseGenieACSService(
      'YOUR_PROJECT_ID',
      {
        enableFirestoreSync: true,
        syncInterval: 30000
      }
    );
  }
  
  async getAllDevices(): Promise<CPEDevice[]> {
    return this.firebaseService.getCPEDevices();
  }
  
  async getDevicesWithGPS(): Promise<CPEDevice[]> {
    return this.firebaseService.getDevicesWithGPS();
  }
  
  async syncDevices(): Promise<void> {
    await this.firebaseService.syncCPEDevices();
  }
}
```

### 7.2 Update Map Component

```typescript
// src/lib/genieacs/mappers/enhancedArcGISMapper.ts
import { FirebaseGenieACSService } from '../config/firebaseGenieacsConfig';

export class EnhancedPCIArcGISMapper {
  private genieacsService: FirebaseGenieACSService;
  
  constructor() {
    this.genieacsService = createFirebaseGenieACSService('YOUR_PROJECT_ID');
  }
  
  async loadCPEDevices(): Promise<void> {
    const devices = await this.genieacsService.getDevicesWithGPS();
    await this.renderCPEDevices(devices);
  }
}
```

## 🔄 Step 8: Set Up Automatic Sync

### 8.1 Enable Scheduled Sync

The scheduled sync function is already deployed and will run every 5 minutes automatically. You can monitor it in the Firebase Console under Functions.

### 8.2 Manual Sync Trigger

```typescript
// Trigger manual sync from your application
const genieacsService = createFirebaseGenieACSService('YOUR_PROJECT_ID');
const result = await genieacsService.syncCPEDevices();
console.log(`Synced ${result.synced} devices, ${result.errors} errors`);
```

## 📊 Step 9: Monitoring and Maintenance

### 9.1 Monitor Firebase Functions

```bash
# View function logs
firebase functions:log

# View specific function logs
firebase functions:log --only syncCPEDevices
```

### 9.2 Monitor MongoDB Atlas

1. **Go to MongoDB Atlas Console**
2. **Monitor**: Database performance, storage usage, connection metrics
3. **Set up alerts** for storage and performance thresholds

### 9.3 Monitor Firestore Usage

1. **Go to Firebase Console** → **Firestore**
2. **Monitor**: Document count, read/write operations, storage usage
3. **Review indexes** performance in Firestore indexes tab

## 🚨 Troubleshooting

### Common Issues

#### 1. MongoDB Connection Failed
```bash
# Check connection string
firebase functions:config:get

# Test connection
curl -X POST https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/syncCPEDevices
```

#### 2. Firestore Permission Denied
```bash
# Deploy updated rules
firebase deploy --only firestore:rules

# Check authentication
firebase auth:export users.json
```

#### 3. Function Timeout
```bash
# Increase timeout in function configuration
# Edit functions/src/genieacsIntegration.ts
export const syncCPEDevices = onRequest({
  region: 'us-central1',
  memory: '1GiB',        // Increase memory
  timeoutSeconds: 120    // Increase timeout
}, async (req, res) => {
  // ...
});
```

## 📈 Performance Optimization

### 1. Optimize Firestore Queries

```typescript
// Use composite indexes for complex queries
const q = query(
  collection(db, 'cpe_devices'),
  where('status', '==', 'online'),
  where('location.latitude', '>', 0),
  orderBy('lastSync', 'desc'),
  limit(100)
);
```

### 2. Implement Caching

```typescript
// Cache frequently accessed data
const cache = new Map();
const getCachedDevices = async () => {
  if (cache.has('devices')) {
    return cache.get('devices');
  }
  
  const devices = await genieacsService.getCPEDevices();
  cache.set('devices', devices);
  setTimeout(() => cache.delete('devices'), 30000); // 30s cache
  return devices;
};
```

### 3. Batch Operations

```typescript
// Batch Firestore writes for better performance
const batch = db.batch();
devices.forEach(device => {
  const ref = db.collection('cpe_devices').doc(device.id);
  batch.set(ref, device);
});
await batch.commit();
```

## 💰 Cost Optimization

### 1. MongoDB Atlas
- **Free Tier**: 512MB storage, shared RAM
- **Production**: Start with M10 ($57/month) and scale as needed

### 2. Firebase Functions
- **Free Tier**: 2M invocations/month
- **Production**: $0.40/million requests after free tier

### 3. Firestore
- **Free Tier**: 1GB storage, 50K reads, 20K writes/day
- **Production**: $0.18/GB storage, $0.06/100K reads

## 🎯 Next Steps

1. **Deploy to Production**: Use production MongoDB Atlas cluster
2. **Set up Monitoring**: Configure alerts and dashboards
3. **Scale as Needed**: Monitor usage and scale resources
4. **Add Features**: Implement additional GenieACS features as needed

## 📞 Support

- **Firebase Documentation**: https://firebase.google.com/docs
- **MongoDB Atlas Documentation**: https://docs.atlas.mongodb.com
- **GenieACS Documentation**: https://docs.genieacs.com

---

**🎉 Congratulations!** Your GenieACS integration with Firebase is now deployed and ready to manage TR-069 CPE devices through your PCI Mapper application.
