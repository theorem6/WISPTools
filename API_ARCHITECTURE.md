# API Architecture Overview

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Application                           │
│                  (Module Manager + PCI Module)                   │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   ArcGIS     │  │  Gemini AI   │  │   Wolfram    │          │
│  │     Maps     │  │   Service    │  │    Alpha     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Firebase App Hosting                          │
│                 (Environment Configuration)                      │
│                                                                   │
│  📄 apphosting.yaml (Production)                                │
│  📄 apphosting.staging.yaml (Staging)                           │
│  📄 apphosting.development.yaml (Development)                   │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Firebase Services Layer                       │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │   Auth     │  │ Firestore  │  │  Storage   │                │
│  └────────────┘  └────────────┘  └────────────┘                │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Firebase Cloud Functions                       │
│                      (Backend APIs)                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PCI Analysis Functions                                   │  │
│  │  • analyzePCI - Detect PCI conflicts                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  GenieACS Integration Functions                          │  │
│  │  • genieacsNBI - Northbound Interface API               │  │
│  │  • genieacsCWMP - TR-069 Protocol Handler               │  │
│  │  • genieacsFS - File Server for CPE devices             │  │
│  │  • syncCPEDevices - MongoDB → Firestore sync            │  │
│  │  • getCPEDevices - Query CPE devices                    │  │
│  │  • getCPEDevice - Get single device                     │  │
│  │  • updateCPELocation - Update device GPS                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Management Functions                                     │  │
│  │  • getPresets - GenieACS presets                        │  │
│  │  • createPreset - Create configuration preset           │  │
│  │  • deletePreset - Remove preset                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     External Services                            │
│                                                                   │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │   MongoDB Atlas    │  │   Google Cloud     │                │
│  │  (GenieACS Data)   │  │  (Secret Manager)  │                │
│  │                    │  │                    │                │
│  │  • devices         │  │  • MongoDB URIs    │                │
│  │  • presets         │  │  • API Keys        │                │
│  │  • provisions      │  │                    │                │
│  │  • faults          │  │                    │                │
│  └────────────────────┘  └────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

## 🔗 API Endpoints Map

### Base URL
```
Production:  https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net
Staging:     https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net
Development: http://localhost:5001/lte-pci-mapper-65450042-bbf71/us-central1
```

### Endpoint Categories

#### 📊 PCI Analysis
```
POST /analyzePCI
Body: { cells: Array<Cell> }
Response: { analysisId, conflicts, summary }
```

#### 🌐 GenieACS - CPE Device Management
```
GET  /getCPEDevices
     → Get all CPE devices from Firestore

GET  /getCPEDevice?id={deviceId}
     → Get single CPE device

POST /syncCPEDevices
     → Sync devices from MongoDB to Firestore

POST /updateCPELocation
Body: { deviceId, latitude, longitude }
     → Update device GPS coordinates
```

#### 🔌 GenieACS - Protocol Handlers
```
POST /genieacsCWMP
     → TR-069 CWMP protocol endpoint
     → CPE devices connect here for auto-configuration

GET  /genieacsNBI/*
     → Northbound Interface API
     → Full GenieACS API proxy

GET  /genieacsFS/*
     → File Server for firmware/config files
```

#### ⚙️ GenieACS - Configuration Management
```
GET  /getPresets
     → List all configuration presets

POST /createPreset
Body: { name, config }
     → Create new preset

DELETE /deletePreset?id={presetId}
       → Delete preset
```

## 📊 Data Flow

### 1. CPE Device Provisioning
```
CPE Device (TR-069)
    ↓
genieacsCWMP (Firebase Function)
    ↓
MongoDB (GenieACS Data)
    ↓
syncCPEDevices (Scheduled/Manual)
    ↓
Firestore (Cached Data)
    ↓
Module Manager UI
```

### 2. PCI Conflict Analysis
```
User Input (Cell Data)
    ↓
analyzePCI (Firebase Function)
    ↓
PCI Conflict Detection Algorithm
    ↓
Firestore (Analysis Results)
    ↓
Module Manager UI (Conflict Visualization)
```

### 3. Map Visualization
```
User Opens PCI Module
    ↓
ArcGIS Map Initialization
    ↓
getCPEDevices (Firebase Function)
    ↓
Firestore (Device Data)
    ↓
ArcGIS Layer Rendering
    ↓
Interactive Map Display
```

## 🔐 Security Architecture

### Authentication Flow
```
User Login
    ↓
Firebase Authentication
    ↓
ID Token Generated
    ↓
Token in Firestore Security Rules
    ↓
Authorized Access to Data
```

### API Security Layers
1. **Firebase Authentication** - User identity
2. **Firestore Security Rules** - Data access control
3. **CORS Protection** - Origin validation
4. **Cloud Secret Manager** - Sensitive credentials
5. **Environment Variables** - Configuration isolation

### Secret Management
```
MongoDB Credentials
    ↓
Google Cloud Secret Manager
    ↓
Firebase Functions Runtime
    ↓
MongoDB Connection (Never exposed to client)
```

## 🌍 Environment Strategy

### Production
- **Purpose**: Live user traffic
- **Resources**: High (2 CPU, 1GB RAM)
- **Database**: `genieacs` (production data)
- **URL**: `lte-pci-mapper-65450042-bbf71.web.app`
- **Min Instances**: 1 (always warm)

### Staging
- **Purpose**: Pre-production testing
- **Resources**: Medium (1 CPU, 512MB RAM)
- **Database**: `genieacs-staging` (test data)
- **URL**: `lte-pci-mapper-staging.web.app`
- **Min Instances**: 0 (cold start OK)

### Development
- **Purpose**: Local development
- **Resources**: Low (1 CPU, 512MB RAM)
- **Database**: `genieacs-dev` (dev data)
- **URL**: `localhost:5173`
- **Features**: Debug mode, verbose logging

## 📈 Scaling Strategy

### Current Configuration
- **Auto-scaling**: 0-10 instances (production)
- **Concurrency**: 100 requests/instance
- **Memory**: 1GB per instance
- **Timeout**: 30 seconds per request

### Cost Optimization
- **Free Tier**: 2M function invocations/month
- **Cold Start**: Acceptable for non-production
- **Firestore Caching**: Reduces MongoDB queries
- **MongoDB Atlas Free**: 512MB storage

## 🔄 API Integration Flow

### Frontend → Backend Communication
```typescript
// Client-side code
import { env } from '$env/dynamic/public';

// Call Firebase Function
const response = await fetch(
  env.PUBLIC_GENIEACS_NBI_URL + '/devices',
  {
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    }
  }
);

const devices = await response.json();
```

### Backend → Database Communication
```typescript
// Firebase Function
import { db } from './firebaseInit';
import { MongoClient } from 'mongodb';

// Read from Firestore (fast cache)
const devicesSnapshot = await db.collection('cpe_devices').get();

// Sync from MongoDB (source of truth)
const mongoClient = await MongoClient.connect(process.env.MONGODB_URI);
const devices = await mongoClient.db().collection('devices').find().toArray();
```

## 🎯 Key Features

### Real-time Capabilities
- ✅ Live PCI conflict detection
- ✅ Real-time device status updates
- ✅ Instant map rendering
- ✅ WebSocket support (future)

### Offline Support (Future)
- 📝 Cached Firestore queries
- 📝 IndexedDB for offline maps
- 📝 Background sync when online

### Multi-tenancy (Future)
- 📝 User-specific networks
- 📝 Organization-level access control
- 📝 Shared device pools

## 📚 Related Documentation

- **`QUICK_START.md`** - Get started in 3 steps
- **`API_CONFIGURATION_SUMMARY.md`** - Configuration reference
- **`FIREBASE_API_SETUP.md`** - Detailed setup guide
- **`FIREBASE_GENIEACS_DEPLOYMENT_GUIDE.md`** - GenieACS integration

---

**🏗️ Your application is built on a modern, scalable, serverless architecture!**

