# LTE WISP Management Platform - Architecture Document

## 🎯 Vision
A comprehensive "Swiss Army Knife" solution for Wireless Internet Service Providers, providing end-to-end network management, inventory tracking, and operational tools.

---

## 🏛️ System Architecture

### Multi-Tenant SaaS Platform
- **Frontend**: SvelteKit + ArcGIS (Firebase App Hosting)
- **Backend**: Node.js/Express (Google Compute Engine)
- **Database**: MongoDB Atlas (primary), Firestore (auth/config)
- **Authentication**: Firebase Auth
- **Deployment**: Git-based auto-deployment

---

## 📦 Module Structure

### Core Modules (Implemented)
1. **PCI Resolution** - RF planning and interference management
2. **CBRS Management** - CBRS SAS integration and spectrum coordination
3. **ACS/CPE Management** - TR-069 device management via GenieACS
4. **HSS Management** - LTE core subscriber database
5. **Coverage Map** - Network topology visualization and asset management
6. **Distributed EPC** - Multi-site LTE core network management

### New Modules (Roadmap)

#### **Inventory Management Module**
**Purpose**: Centralized asset tracking across all network equipment

**Features**:
- Spreadsheet-like interface (AG Grid/Handsontable)
- Real-time inventory tracking by location
- Integration with all other modules
- Barcode/QR code support
- Purchase order management
- Warranty tracking
- Maintenance history
- Asset depreciation tracking
- Low stock alerts

**Integration Points**:
```
Coverage Map: Equipment at tower sites
ACS: CPE device lifecycle (warehouse → deployed → RMA)
HSS: SIM card inventory and provisioning
CBRS: CBSD equipment tracking
```

#### **Billing & Customer Management Module**
**Features**:
- Customer accounts and subscriptions
- Service plan management
- Usage-based billing
- Invoice generation
- Payment processing integration
- Automated suspension/reactivation
- Integration with HSS (data usage) and ACS (CPE status)

#### **Work Order & Field Operations Module**
**Features**:
- Installation scheduling
- Maintenance tickets
- Technician dispatch
- Mobile field app
- Equipment transfer tracking
- Time tracking
- Parts usage from inventory
- Customer signature capture
- Photo documentation

#### **Network Monitoring & Alerting Module**
**Features**:
- Real-time network health monitoring
- SNMP integration
- Alert management
- Performance metrics (already partially implemented)
- Automated incident creation
- Escalation workflows

#### **Reporting & Analytics Module**
**Features**:
- Executive dashboards
- Financial reports
- Network performance analytics
- Subscriber growth trends
- Equipment utilization
- Custom report builder
- Scheduled report delivery

#### **Vendor & Procurement Module**
**Features**:
- Vendor management
- Purchase requisitions
- Purchase order tracking
- Receiving and inspection
- Vendor performance tracking
- Contract management

---

## 🔐 Tenant Module Access Control

### Current State
- Tenants exist in system
- All tenants see all modules
- No granular access control

### Target State: Module Permissions System

#### Database Schema Addition
```typescript
// Firestore: /tenants/{tenantId}
interface TenantConfig {
  id: string;
  name: string;
  displayName: string;
  
  // Module Access Control
  enabledModules: {
    pciResolution: boolean;
    cbrsManagement: boolean;
    acsManagement: boolean;
    hssManagement: boolean;
    coverageMap: boolean;
    distributedEpc: boolean;
    inventory: boolean;
    billing: boolean;
    workOrders: boolean;
    monitoring: boolean;
    reporting: boolean;
    procurement: boolean;
  };
  
  // Module-specific limits
  moduleLimits: {
    maxSites?: number;
    maxSubscribers?: number;
    maxCPEs?: number;
    maxUsers?: number;
  };
  
  // Subscription tier
  subscriptionTier: 'free' | 'basic' | 'professional' | 'enterprise';
  
  // Feature flags
  features: {
    advancedReporting: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
    customIntegrations: boolean;
  };
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### Admin Interface
```
/admin/tenants
  └─ Tenant List
       ├─ Tenant Overview
       ├─ Module Access Control
       │    ├─ Toggle modules on/off
       │    ├─ Set usage limits
       │    └─ Configure module-specific settings
       ├─ User Management
       ├─ Billing & Subscription
       └─ Activity Logs
```

#### Implementation Strategy
1. **Backend**: Add module check middleware
   ```javascript
   function requireModule(moduleName) {
     return async (req, res, next) => {
       const tenantId = req.tenantId;
       const tenant = await getTenantConfig(tenantId);
       
       if (!tenant.enabledModules[moduleName]) {
         return res.status(403).json({ 
           error: 'Module not enabled for this tenant' 
         });
       }
       next();
     };
   }
   
   // Usage
   router.get('/api/pci/...', requireModule('pciResolution'), ...);
   ```

2. **Frontend**: Dynamic module loading
   ```typescript
   // Check tenant permissions before showing module
   const availableModules = computed(() => {
     return allModules.filter(module => 
       $currentTenant.enabledModules[module.id]
     );
   });
   ```

3. **Dashboard**: Show only enabled modules
   ```svelte
   {#each availableModules as module}
     <ModuleTile {module} />
   {/each}
   ```

---

## 🗄️ Unified Inventory System Architecture

### Inventory Module Design

#### Location Hierarchy
```
├─ Warehouses
│   ├─ Main Warehouse
│   ├─ Regional Depots
│   └─ Service Vehicles
├─ Tower Sites (linked to Coverage Map)
│   ├─ Site A
│   │   ├─ Rack 1
│   │   │   ├─ RU 1-5: Equipment X
│   │   │   └─ RU 6-10: Equipment Y
│   │   └─ Outdoor Equipment
│   └─ Site B
├─ Customer Premises (deployed CPE)
└─ RMA / Repair Center
```

#### Inventory Operations

**Check-in** (Receiving):
- Scan barcode/QR
- Verify against PO
- Set location (warehouse)
- Update quantity
- Trigger low-stock alerts

**Check-out** (Deployment):
- Select items from inventory
- Assign to work order
- Set destination (tower/customer)
- Update location
- Track installer

**Transfer**:
- Between warehouses
- Warehouse → Tower
- Tower → Tower
- Customer → RMA

**Audit**:
- Physical count vs system
- Variance reporting
- Adjustment tracking

#### Integration with Coverage Map

**Bidirectional Sync**:
```
Coverage Map → Inventory:
  - Add equipment to tower → Create/update inventory record
  - Remove equipment → Update inventory location
  - View tower → See all equipment at location

Inventory → Coverage Map:
  - Deploy equipment → Update Coverage Map
  - Transfer equipment → Update site equipment list
  - View equipment → Jump to Coverage Map location
```

#### Spreadsheet Interface Features

**Grid Capabilities**:
- Inline editing
- Column filtering
- Sorting
- Grouping by category/location
- Pivot views
- Excel export/import
- Bulk operations
- Cell validation
- Formulas (calculated fields)

**Quick Actions**:
- Right-click context menu
- Bulk status changes
- Mass transfer
- Print labels/QR codes
- Quick search/filter

**Views**:
- All Inventory
- By Location
- By Category
- By Status
- Low Stock Alert
- Expiring Warranties
- RMA Queue
- Deployment Queue

---

## 📊 Data Flow Architecture

### Module Interconnections

```
┌─────────────────┐
│  Coverage Map   │◄────┐
│  (Master Topo)  │     │
└────────┬────────┘     │
         │              │
         ├─────────────►│
         │              │
    ┌────▼────┐    ┌────┴─────┐
    │   PCI   │    │ Inventory│
    │ Module  │    │  System  │
    └────┬────┘    └────┬─────┘
         │              │
         │         ┌────▼────┐
         │         │   ACS   │
         │         │  (CPE)  │
         │         └────┬────┘
         │              │
    ┌────▼────────┬─────▼────┐
    │    HSS      │   CBRS   │
    │(Subscribers)│ (Spectrum)│
    └─────────────┴──────────┘
```

### Unified Data Model

**Core Entities**:
1. **Sites** (UnifiedSite in MongoDB)
   - Master record for all tower locations
   - Extended by PCI, CBRS, Coverage Map

2. **Sectors** (UnifiedSector)
   - Radio coverage areas
   - Linked to sites
   - Extended by module-specific data

3. **CPE Devices** (UnifiedCPE)
   - Customer equipment
   - Linked to ACS (management)
   - Linked to Inventory (lifecycle)
   - Linked to HSS (subscriber)

4. **Equipment** (NetworkEquipment)
   - All physical assets
   - Linked to sites or warehouses
   - Comprehensive tracking

5. **Subscribers** (HSS)
   - User accounts
   - Linked to CPE
   - Linked to SIM inventory

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Current)
✅ Multi-tenant architecture
✅ Core modules operational
✅ Coverage Map with basic inventory
✅ Module-based architecture

### Phase 2: Inventory System (Next 2-4 weeks)
1. **Week 1-2**: Core Inventory Module
   - Database schema
   - Backend API (CRUD + special operations)
   - Basic spreadsheet interface
   - Location management

2. **Week 3-4**: Integration Layer
   - Coverage Map ↔ Inventory sync
   - ACS ↔ Inventory sync
   - HSS ↔ Inventory (SIM cards)
   - Barcode/QR generation

### Phase 3: Module Access Control (Week 5-6)
1. **Backend**:
   - Module permission middleware
   - Tenant configuration API
   - Usage limit enforcement

2. **Admin Interface**:
   - Tenant management dashboard
   - Module toggle interface
   - Subscription tier management

3. **Frontend**:
   - Dynamic module loading
   - Permission-based routing
   - Graceful feature degradation

### Phase 4: Advanced Features (Week 7-12)
1. **Billing Module** (Week 7-8)
2. **Work Orders** (Week 9-10)
3. **Advanced Reporting** (Week 11-12)

### Phase 5: Mobile & Field Apps (Month 4+)
1. Mobile inventory scanner
2. Field technician app
3. Customer self-service portal

---

## 💡 Key Design Decisions

### 1. Inventory Storage
**Decision**: MongoDB (unified with Coverage Map)
**Rationale**: 
- Consistent with existing architecture
- Better for complex, nested data
- Easier cross-module queries
- Better performance for large datasets

### 2. Spreadsheet Component
**Options**:
- AG Grid (Enterprise) - $1000/dev/year
- Handsontable (Commercial) - $990/dev/year
- Tabulator (Free, open source)
- Custom implementation

**Recommendation**: Start with Tabulator (free), upgrade to AG Grid if needed

### 3. Module Permissions
**Decision**: Configuration-based with Firestore
**Rationale**:
- Fast read access (cached in frontend)
- Easy admin UI updates
- No backend deployment for config changes
- Real-time updates

### 4. Data Sync Strategy
**Decision**: Event-driven with eventual consistency
**Rationale**:
- Modules remain independent
- Changes in one module trigger updates in others
- Graceful handling of failures
- Audit trail of all changes

---

## 📈 Success Metrics

### User Experience
- Module load time < 2 seconds
- Inventory search/filter < 500ms
- Map rendering < 3 seconds
- Mobile responsiveness

### System Performance
- Support 100+ concurrent users per tenant
- Handle 100,000+ inventory items
- 99.9% uptime SLA
- Real-time sync latency < 5 seconds

### Business Metrics
- Reduce inventory discrepancies by 80%
- Cut equipment search time by 70%
- Improve deployment efficiency by 50%
- Increase tenant satisfaction (NPS > 50)

---

## 🛡️ Security Considerations

### Multi-Tenancy
- Complete data isolation
- No cross-tenant access
- Tenant-specific encryption keys
- Audit logging per tenant

### Role-Based Access Control (RBAC)
```
Roles:
- Super Admin (platform owner)
- Tenant Admin
- Network Engineer
- Field Technician
- Billing Manager
- Read-Only User
```

### API Security
- JWT-based authentication
- Rate limiting per tenant
- API key management
- Webhook validation

---

## 🔧 Technology Stack

### Frontend
- **Framework**: SvelteKit
- **Maps**: ArcGIS JavaScript API
- **Spreadsheet**: AG Grid / Tabulator
- **State**: Svelte stores
- **Styling**: CSS variables + Tailwind

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB Atlas
- **Config**: Firestore
- **Auth**: Firebase Auth
- **Hosting**: Google Compute Engine

### DevOps
- **CI/CD**: GitHub Actions + Firebase
- **Monitoring**: Google Cloud Monitoring
- **Logging**: Structured JSON logs
- **Backups**: Automated daily MongoDB snapshots

---

## 📞 Next Steps

1. **Validate** this architecture with stakeholders
2. **Prioritize** features based on customer demand
3. **Design** detailed UI mockups for Inventory module
4. **Build** MVP of Inventory spreadsheet interface
5. **Test** with pilot customers
6. **Iterate** based on feedback

---

*This is a living document. Update as requirements evolve.*

