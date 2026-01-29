---
title: Multi-Tenant GenieACS Architecture
description: GenieACS multi-tenant system architecture and frontend/backend layers.
---

# Multi-Tenant GenieACS Architecture

## 🎨 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                          │
│                      (SvelteKit Module Manager)                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │ Login/Signup │  │ Tenant Setup  │  │ Tenant Selector    │  │
│  │ /login       │  │ /tenant-setup │  │ /tenant-selector   │  │
│  └──────────────┘  └───────────────┘  └────────────────────┘  │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │ Dashboard    │  │ Tenant Admin  │  │ Device Management  │  │
│  │ /dashboard   │  │ /tenant-admin │  │ /modules/acs-cpe   │  │
│  └──────────────┘  └───────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTPS + JWT
┌─────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION LAYER                       │
│                      (Firebase Authentication)                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  User Login → Generate JWT Token → Verify on Each Request │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                     API/FUNCTIONS LAYER                         │
│                    (Firebase Cloud Functions)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │            Tenant Middleware                            │    │
│  │  • Extract JWT token                                    │    │
│  │  • Verify user authentication                           │    │
│  │  • Extract tenant ID from request                       │    │
│  │  • Validate user-tenant association                     │    │
│  │  • Check role and permissions                           │    │
│  │  • Add tenant context to request                        │    │
│  └────────────────────────────────────────────────────────┘    │
│                         ↓ Tenant Context                        │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Multi-Tenant GenieACS Functions               │    │
│  │                                                          │    │
│  │  • syncGenieACSDevicesMultitenant                       │    │
│  │    - Sync devices with tenant filtering                 │    │
│  │                                                          │    │
│  │  • proxyGenieACSNBIMultitenant                          │    │
│  │    - Proxy NBI requests with tenant context             │    │
│  │                                                          │    │
│  │  • getDeviceParametersMultitenant                       │    │
│  │    - Get device params (tenant validated)               │    │
│  │                                                          │    │
│  │  • executeDeviceTaskMultitenant                         │    │
│  │    - Execute tasks (permission checked)                 │    │
│  │                                                          │    │
│  │  • handleCWMPMultitenant                                │    │
│  │    - Handle device connections (tenant from URL)        │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                      ROUTING LAYER                              │
│                         (Nginx)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  /cwmp/tenant-a  ──→  Extract "tenant-a" ──→  GenieACS CWMP    │
│  /cwmp/tenant-b  ──→  Extract "tenant-b" ──→  + X-Tenant-ID    │
│  /cwmp/tenant-c  ──→  Extract "tenant-c" ──→  header           │
│                                                                  │
│  /nbi/*          ──→  GenieACS NBI API                          │
│  /fs/*           ──→  GenieACS File Server                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    GENIEACS SERVICES LAYER                      │
│                    (GenieACS Core Services)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ CWMP Service │  │  NBI Service │  │  File Server (FS)  │   │
│  │ Port 7547    │  │  Port 7557   │  │  Port 7567         │   │
│  │              │  │              │  │                    │   │
│  │ • TR-069     │  │ • REST API   │  │ • Firmware files   │   │
│  │ • Device     │  │ • Device mgmt│  │ • Config backups   │   │
│  │   conn.      │  │ • Tasks      │  │ • GridFS storage   │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
│                                                                  │
│  All services receive X-Tenant-ID header                        │
│  All operations filtered by tenant                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                │
├───────────────────────────────┬─────────────────────────────────┤
│   FIRESTORE                   │   MONGODB (GenieACS)            │
├───────────────────────────────┼─────────────────────────────────┤
│  Collections:                 │  Collections:                   │
│                               │                                 │
│  • tenants                    │  • devices                      │
│    - Tenant metadata          │    + _tenantId field            │
│    - Settings                 │    + Tags.tenant:{id}           │
│    - Limits                   │                                 │
│    - CWMP URL                 │  • tasks                        │
│                               │    + _tenantId field            │
│  • user_tenants               │                                 │
│    - User-tenant mapping      │  • faults                       │
│    - Roles                    │    + _tenantId field            │
│    - Permissions              │                                 │
│                               │  • presets                      │
│  • tenant_invitations         │    + _tenantId field            │
│    - Invite users             │                                 │
│                               │  • operations                   │
│  • tenants/{id}/cpe_devices   │    + _tenantId field            │
│    - Synced device data       │                                 │
│                               │  • fs_{tenantId} (GridFS)       │
│  • tenants/{id}/cwmp_logs     │    - Tenant-specific files      │
│    - Connection logs          │                                 │
│                               │                                 │
└───────────────────────────────┴─────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                       DEVICES LAYER                             │
│                    (TR-069/CWMP Devices)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Customer A Devices  →  http://domain.com/cwmp/tenant-a-abc123 │
│  Customer B Devices  →  http://domain.com/cwmp/tenant-b-def456 │
│  Customer C Devices  →  http://domain.com/cwmp/tenant-c-ghi789 │
│                                                                  │
│  Each tenant's devices connect to their unique CWMP URL         │
│  Complete data isolation at connection level                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Examples

### 1. User Login and Tenant Selection

```
User → /login
  ↓ Email + Password
Firebase Auth → Verify Credentials
  ↓ JWT Token
Frontend → /tenant-selector
  ↓ GET user's tenants
Firestore → user_tenants collection
  ↓ List of tenant IDs
Firestore → tenants collection
  ↓ Tenant details
Frontend → Display tenant list
  ↓ User selects tenant
localStorage → Save selectedTenantId
  ↓ Redirect
Frontend → /dashboard (with tenant context)
```

### 2. Device Connection (CWMP)

```
Device → http://domain.com/cwmp/acme-abc123
  ↓ TR-069 Inform
Nginx → Extract "acme-abc123" from URL
  ↓ Add X-Tenant-ID header
GenieACS CWMP → Receive connection
  ↓ Process TR-069 request
MongoDB → Save device data with _tenantId: "acme-abc123"
  ↓ Tag device
MongoDB → Update Tags: {"tenant:acme-abc123": true}
  ↓ Send response
Device ← InformResponse
```

### 3. API Request (Get Devices)

```
Frontend → GET /api/devices
  ↓ Authorization: Bearer {JWT}
Firebase Functions → Verify JWT
  ↓ Extract user ID
tenantMiddleware → Get tenant from request/localStorage
  ↓ Validate user-tenant association
Firestore → Check user_tenants/{userId}_{tenantId}
  ↓ Confirmed ✓
tenantMiddleware → Add tenant context to request
  ↓ context: {tenantId, userId, role, permissions}
GenieACS NBI → Query devices
  ↓ Filter: {_tenantId: "acme-abc123"}
MongoDB → Return matching devices
  ↓ Device list (tenant-filtered)
Frontend ← Display devices
```

### 4. Execute Device Task

```
Frontend → POST /executeDeviceTask
  ↓ {deviceId, taskName, parameter, value}
  ↓ Authorization: Bearer {JWT}
tenantMiddleware → Verify auth + tenant
  ↓ Check permissions
tenantMiddleware → Validate canManageDevices = true
  ↓ Permission OK ✓
GenieACS Functions → Verify device belongs to tenant
  ↓ Query: {_id: deviceId, _tenantId: tenantId}
MongoDB → Device found ✓
  ↓ Create task
MongoDB → Insert task with _tenantId
  ↓ Task created
GenieACS → Execute on next device inform
  ↓ Success
Frontend ← Task confirmation
```

## 🔐 Security Layers

### Layer 1: Authentication
- Firebase JWT tokens
- Token expiry (1 hour)
- Automatic refresh
- Secure HttpOnly cookies (optional)

### Layer 2: Authorization
- User-tenant association validated
- Role-based access control
- Permission checks per operation
- Owner/Admin/Operator/Viewer roles

### Layer 3: Data Isolation
- MongoDB: `_tenantId` field on all documents
- Firestore: Tenant-specific subcollections
- GridFS: Tenant-specific buckets
- Queries automatically filtered

### Layer 4: URL Isolation
- Unique CWMP URL per tenant
- Nginx extracts tenant from URL
- Device connections tenant-tagged
- No cross-tenant contamination

### Layer 5: API Isolation
- All functions wrapped with tenant middleware
- Context validated on every request
- Response data filtered by tenant
- Error messages don't leak tenant info

## 📊 Scalability

### Horizontal Scaling

```
                    ┌─────────────┐
                    │ Load Balancer│
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
      ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
      │ GenieACS│    │ GenieACS│    │ GenieACS│
      │ Instance│    │ Instance│    │ Instance│
      │    1    │    │    2    │    │    3    │
      └────┬────┘    └────┬────┘    └────┬────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌──────▼──────┐
                    │   MongoDB   │
                    │   Cluster   │
                    └─────────────┘
```

### Database Sharding (Future)

```
Tenant A, B, C  →  MongoDB Shard 1
Tenant D, E, F  →  MongoDB Shard 2
Tenant G, H, I  →  MongoDB Shard 3

Each shard handles subset of tenants
Query routing by _tenantId
```

## 🎯 Design Principles

### 1. Complete Isolation
- No shared data between tenants
- Unique URLs prevent cross-contamination
- Separate storage namespaces

### 2. Scalability First
- Add tenants without code changes
- Database optimized for multi-tenancy
- Horizontal scaling ready

### 3. Security by Default
- Authentication required everywhere
- Authorization checks on every operation
- Data filtered at query level

### 4. Developer Friendly
- Simple tenant middleware
- Context automatically injected
- Helper functions for filtering

### 5. Operations Ready
- Monitoring per tenant
- Logs tagged with tenant ID
- Easy troubleshooting

## 🚀 Performance Optimizations

### MongoDB Indexes

```javascript
// Essential indexes for multi-tenancy
db.devices.createIndex({ "_tenantId": 1, "_lastInform": -1 });
db.devices.createIndex({ "_tenantId": 1, "_id": 1 });
db.tasks.createIndex({ "_tenantId": 1, "timestamp": -1 });
db.faults.createIndex({ "_tenantId": 1, "resolved": 1 });
```

### Caching Strategy

```javascript
// Cache tenant data in memory
const tenantCache = new Map();

async function getTenant(tenantId) {
  if (tenantCache.has(tenantId)) {
    return tenantCache.get(tenantId);
  }
  
  const tenant = await firestore.collection('tenants').doc(tenantId).get();
  tenantCache.set(tenantId, tenant.data());
  
  return tenant.data();
}
```

### Connection Pooling

```javascript
// MongoDB connection pool per tenant (advanced)
const connectionPools = new Map();

function getPool(tenantId) {
  if (!connectionPools.has(tenantId)) {
    const pool = new MongoClient(connectionUrl, {
      maxPoolSize: 10,
      appName: `tenant-${tenantId}`
    });
    connectionPools.set(tenantId, pool);
  }
  return connectionPools.get(tenantId);
}
```

## 📈 Monitoring Architecture

### Metrics per Tenant

```javascript
{
  tenantId: "acme-abc123",
  metrics: {
    deviceCount: 47,
    activeDevices: 45,
    offlineDevices: 2,
    tasksToday: 123,
    faultsOpen: 5,
    storageUsedMB: 247,
    apiCallsToday: 1543,
    cwmpConnectionsToday: 450
  }
}
```

### Logging Strategy

```
[2025-10-11 10:30:45] [TENANT:acme-abc123] [USER:user-456] Device device-789 informed
[2025-10-11 10:31:12] [TENANT:acme-abc123] [USER:user-456] Task created: refreshParams
[2025-10-11 10:31:45] [TENANT:acme-abc123] Device device-789 task executed successfully
```

---

**Architecture Version**: 1.0.0  
**Last Updated**: 2025-10-11

