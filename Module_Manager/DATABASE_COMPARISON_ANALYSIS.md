# Database Architecture Analysis: PCI Mapper vs ACS Module

## Executive Summary

**Recommendation: Keep Firebase Firestore for PCI Mapper, MongoDB for ACS Module**

The two modules have fundamentally different use cases that justify different database solutions. This is a **strategic architectural decision**, not a lack of consistency.

---

## Current Architecture

### PCI Mapper Module
**Database:** Firebase Firestore  
**Authentication:** Firebase Auth  
**Data Model:** User-centric, multi-tenant

```
Firebase Firestore Collections:
├── networks/              (user-owned network projects)
│   ├── {networkId}/
│   │   ├── metadata      (name, market, location, owner)
│   │   └── cells/        (subcollection of cell sectors)
│   │       └── {cellId}/
└── users/                 (user profiles, preferences)
```

**Current Implementation:**
- `networkService.ts` - Full CRUD operations
- Real-time listeners
- User authentication integrated
- Security rules per user
- ~427 lines of service code

### ACS CPE Management Module
**Database:** MongoDB Atlas  
**Authentication:** None (operational system)  
**Data Model:** Shared operational data

```
MongoDB Collections:
├── devices               (CPE devices from GenieACS)
├── faults               (device faults and errors)
├── presets              (provisioning configurations)
├── provisions           (provisioning scripts)
└── files                (firmware/config files)
```

**Current Implementation:**
- API routes: `/api/cpe/*`, `/api/faults`, `/api/presets`, etc.
- Direct MongoDB driver
- No user ownership
- Shared operational database

---

## Detailed Comparison

### Use Case Differences

| Aspect | PCI Mapper | ACS Module |
|--------|-----------|------------|
| **Purpose** | Network planning projects | Device management operations |
| **Users** | Multiple users, isolated data | Single operator, shared data |
| **Data Ownership** | User-owned networks | System-wide operational data |
| **Collaboration** | Future multi-user networks | N/A (single operator) |
| **Data Lifecycle** | Long-term projects | Real-time operational |
| **Access Pattern** | User creates/edits own networks | All users access same devices |
| **Security Model** | Per-user isolation | Shared operational access |

### Technical Comparison

#### Firebase Firestore

**Strengths for PCI Mapper:**
1. ✅ **Built-in Authentication** - Firebase Auth already integrated
2. ✅ **Multi-Tenancy** - Native user-based data isolation
3. ✅ **Real-Time Sync** - Valuable for future collaboration features
4. ✅ **Security Rules** - Row-level security per user
5. ✅ **Offline Support** - Work without internet, sync later
6. ✅ **Subcollections** - Perfect for Network → Cells hierarchy
7. ✅ **Document Model** - Matches hierarchical network structure
8. ✅ **Automatic Indexing** - Query optimization out of the box
9. ✅ **Already Working** - 427 lines of tested service code

**Limitations:**
- ❌ Complex aggregations are harder
- ❌ No joins between collections
- ❌ Query limits (composite indexes needed)
- ❌ Pricing at high scale

#### MongoDB Atlas

**Strengths for ACS Module:**
1. ✅ **Operational Data** - Perfect for device management
2. ✅ **Flexible Schema** - Handle various device parameters
3. ✅ **Aggregation Pipeline** - Complex queries and analytics
4. ✅ **Better for Large Datasets** - Scales better for millions of devices
5. ✅ **Self-Hosted Option** - Can move to self-hosted MongoDB
6. ✅ **Geospatial Queries** - Find devices near locations
7. ✅ **Time Series** - Good for device metrics/history
8. ✅ **Already Working** - Integrated with GenieACS

**Limitations:**
- ❌ No built-in authentication (need custom auth)
- ❌ No real-time sync (need custom implementation)
- ❌ No offline support
- ❌ Manual security implementation

---

## Data Models Comparison

### PCI Mapper Data (Firebase)

```typescript
interface Network {
  id: string;
  name: string;
  market: string;
  location: NetworkLocation;
  cells: Cell[];              // User's network design
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;            // ⬅️ USER OWNERSHIP
  ownerEmail: string;         // ⬅️ USER ISOLATION
  isShared: boolean;          // ⬅️ FUTURE COLLABORATION
}

interface Cell {
  id: string;
  eNodeB: number;
  sector: number;
  pci: number;
  latitude: number;
  longitude: number;
  // ... network planning data
}
```

**Key Characteristics:**
- User-owned projects
- Hierarchical structure (Network → Sites → Sectors)
- Planning/design data
- Collaboration features planned

### ACS Data (MongoDB)

```typescript
interface CPEDevice {
  _id: string;
  deviceId: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  status: 'Online' | 'Offline';
  lastContact: Date;
  parameters: Record<string, any>;  // ⬅️ FLEXIBLE SCHEMA
  // ... operational data
}

interface Fault {
  _id: string;
  deviceId: string;
  code: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: Date;
  resolved: boolean;
  // ... operational metadata
}
```

**Key Characteristics:**
- System-wide operational data
- No user ownership
- Real-time device status
- Flexible device parameters

---

## Migration Cost Analysis

### Option 1: Keep Both (RECOMMENDED)

**Effort:** None  
**Risk:** None  
**Benefits:**
- ✅ Each module optimized for its use case
- ✅ No refactoring required
- ✅ Maintain existing features
- ✅ Can evolve independently

**Ongoing Costs:**
- Two database systems to maintain
- Firebase pricing for PCI data (~$25-50/month for moderate use)
- MongoDB pricing for ACS data (~$57/month shared cluster)

### Option 2: Migrate PCI Mapper to MongoDB

**Effort:** High (2-3 weeks)  
**Risk:** High  
**Tasks Required:**
1. ❌ Rewrite `networkService.ts` (427 lines)
2. ❌ Implement custom authentication
3. ❌ Build user isolation logic
4. ❌ Remove Firebase dependencies
5. ❌ Migrate existing data
6. ❌ Implement security middleware
7. ❌ Test all CRUD operations
8. ❌ Rewrite real-time sync (if needed)
9. ❌ Update all API routes
10. ❌ Migration scripts for existing users

**Features Lost:**
- Real-time synchronization
- Offline support
- Firebase Auth integration
- Built-in security rules
- Automatic scaling

**Benefits:**
- ✅ Single database system
- ✅ Unified API architecture
- ✅ Potential cost savings (at scale)

### Option 3: Migrate ACS to Firebase

**Effort:** Medium (1-2 weeks)  
**Risk:** Medium  
**NOT Recommended** because:
- ACS doesn't need user isolation
- ACS doesn't need real-time sync
- MongoDB better for operational data
- Would lose aggregation capabilities
- Would lose flexible schema for device parameters

---

## Real-World Scenarios

### Scenario 1: Multi-User RF Planning Company

**Need:** 10 RF engineers, each managing 5-10 networks

**Firebase (Current):**
```typescript
// Each engineer sees only their networks
const networks = await networkService.getUserNetworks(userId);
// ✅ Automatic isolation
// ✅ Real-time collaboration
// ✅ Security rules enforced
```

**MongoDB (Proposed):**
```typescript
// Must manually filter by user
const networks = await db.collection('networks')
  .find({ ownerId: userId })  // ⬅️ Must remember this EVERYWHERE
  .toArray();
// ❌ Easy to forget filter → security leak
// ❌ No real-time updates
// ❌ Custom auth middleware
```

### Scenario 2: Large ISP with 50,000 CPE Devices

**MongoDB (Current):**
```typescript
// Efficient queries for operational data
const criticalFaults = await db.collection('faults')
  .aggregate([
    { $match: { severity: 'CRITICAL', resolved: false } },
    { $lookup: { from: 'devices', ... } },
    { $group: { _id: '$region', count: { $sum: 1 } } }
  ]);
// ✅ Complex aggregations
// ✅ No per-user overhead
// ✅ Efficient at scale
```

**Firebase (Proposed):**
```typescript
// Would need to query multiple collections
const faults = await db.collection('faults')
  .where('severity', '==', 'CRITICAL')
  .where('resolved', '==', false)
  .get();
// ❌ Limited query capabilities
// ❌ No joins (must fetch devices separately)
// ❌ More expensive at scale
```

---

## Architecture Patterns

### Current: Hybrid Architecture (RECOMMENDED)

```
┌─────────────────────────────────────────┐
│   LTE WISP Management Platform          │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐    ┌──────────────┐ │
│  │ PCI Mapper   │    │ ACS Module   │ │
│  ├──────────────┤    ├──────────────┤ │
│  │ User Projects│    │ Operations   │ │
│  │ Multi-tenant │    │ Shared Data  │ │
│  │ Collaboration│    │ Real-time    │ │
│  └──────┬───────┘    └──────┬───────┘ │
│         │                   │         │
│    ┌────▼─────┐        ┌───▼────┐   │
│    │ Firebase │        │MongoDB │   │
│    │Firestore │        │ Atlas  │   │
│    └──────────┘        └────────┘   │
│                                      │
└──────────────────────────────────────┘
```

**Benefits:**
- Each module uses optimal database
- Clear separation of concerns
- Independent scaling
- Different pricing models
- Each can evolve independently

### Alternative: MongoDB Only

```
┌─────────────────────────────────────────┐
│   LTE WISP Management Platform          │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐    ┌──────────────┐ │
│  │ PCI Mapper   │    │ ACS Module   │ │
│  ├──────────────┤    ├──────────────┤ │
│  │ NEEDS REWRITE│    │ Works        │ │
│  │ + Custom Auth│    │              │ │
│  │ - Lost Featrs│    │              │ │
│  └──────┬───────┘    └──────┬───────┘ │
│         │                   │         │
│         └───────┬───────────┘         │
│                 │                     │
│            ┌────▼────┐               │
│            │MongoDB  │               │
│            │ Atlas   │               │
│            └─────────┘               │
│                                      │
└──────────────────────────────────────┘
```

**Drawbacks:**
- Lose Firebase features
- Custom auth implementation
- More security concerns
- Lose real-time sync
- High refactoring cost

---

## Recommendation Details

### Keep Hybrid Architecture

**Reasons:**

1. **Different Use Cases**
   - PCI Mapper: User projects (planning)
   - ACS Module: Operations (real-time devices)

2. **User Requirements**
   - PCI Mapper users need isolated workspaces
   - ACS operators need shared operational view

3. **Feature Preservation**
   - Real-time collaboration (planned)
   - Offline work capability
   - Firebase Auth integration
   - Security by default

4. **Cost Efficiency**
   - Firebase costs scale with user data
   - MongoDB costs scale with operational data
   - Both stay within reasonable limits

5. **Development Velocity**
   - No rewrite needed
   - Focus on features, not refactoring
   - Each module can evolve independently

6. **Future Flexibility**
   - Can add more modules
   - Each can choose optimal database
   - Microservices-ready architecture

---

## When to Reconsider

**Migrate to MongoDB if:**
1. ✅ PCI Mapper reaches 100,000+ networks (scale issue)
2. ✅ Firebase costs exceed $500/month (cost issue)
3. ✅ Need complex analytics across networks (query issue)
4. ✅ Need self-hosted solution (compliance issue)
5. ✅ User authentication becomes problematic (auth issue)

**Current Status:**
- ❌ None of these conditions are met
- ❌ Firebase works well for current needs
- ❌ No compelling reason to migrate

---

## Implementation Recommendation

### Enhance Current Architecture

Instead of migrating, **improve the hybrid setup**:

1. **Shared Utilities**
   ```typescript
   // Create common patterns
   src/lib/db/
   ├── firebase/
   │   ├── networkService.ts    (existing)
   │   └── authService.ts       (existing)
   └── mongodb/
       ├── cpeService.ts        (new)
       ├── faultsService.ts     (new)
       └── presetsService.ts    (new)
   ```

2. **Consistent API Patterns**
   ```typescript
   // Both return same result shape
   interface ServiceResult<T> {
     success: boolean;
     data?: T;
     error?: string;
   }
   ```

3. **Unified Error Handling**
   ```typescript
   // Common error handling
   class DatabaseError extends Error {
     constructor(message: string, public source: 'firebase' | 'mongodb') {
       super(message);
     }
   }
   ```

4. **Documentation**
   - Document why each module uses its database
   - Create migration guide if needed in future
   - Maintain this analysis document

---

## Cost Comparison

### Firebase Firestore (PCI Mapper)

**Typical Usage:**
- 10 active users
- 50 networks total
- 5,000 cell sectors total
- 10,000 reads/day
- 1,000 writes/day

**Monthly Cost:** ~$25-50

### MongoDB Atlas (ACS Module)

**Typical Usage:**
- 10,000 CPE devices
- 50,000 faults/month
- 1,000 presets
- Continuous sync operations

**Monthly Cost:** ~$57 (M10 shared cluster)

### Combined Total

**Monthly:** ~$82-107  
**Annual:** ~$984-1,284

**Both are cost-effective** for the value provided. Migration would not significantly reduce costs until very high scale.

---

## Conclusion

**KEEP HYBRID ARCHITECTURE**

✅ **Recommended:** Maintain Firebase for PCI Mapper, MongoDB for ACS  
❌ **Not Recommended:** Migrate PCI Mapper to MongoDB  
❌ **Not Recommended:** Migrate ACS to Firebase

**This is strategic architecture, not technical debt.**

The different use cases justify different databases. Focus development effort on features, not unnecessary refactoring.

**Next Steps:**
1. ✅ Document this decision
2. ✅ Create unified service patterns
3. ✅ Enhance both implementations
4. ✅ Monitor costs and scale
5. ✅ Revisit if conditions change

---

## Additional Notes

### Multi-Database is Industry Standard

Many successful applications use multiple databases:

- **Uber:** PostgreSQL (trips), Redis (real-time), Cassandra (analytics)
- **Netflix:** MySQL (billing), Cassandra (viewing history), EVCache (caching)
- **Airbnb:** MySQL (bookings), Elasticsearch (search), Redis (caching)

**Using the right database for each use case is a sign of mature architecture.**

### Future Considerations

If the platform grows:
- Add Redis for caching
- Add Elasticsearch for full-text search
- Add TimeSeries DB for metrics
- Add Graph DB for network topology

**Each module should use the optimal data store for its use case.**

