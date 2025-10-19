# Implementation Priorities - LTE WISP Platform

## 🎯 Immediate Priorities (Next 2-4 Weeks)

---

## Priority 1: Centralized Inventory Module 📦

### Why This First?
- You already have partial inventory in Coverage Map
- Foundation for all other modules
- High ROI - immediate operational value
- Required for complete WISP solution

### What to Build:

#### A. Inventory Grid Interface
```
/modules/inventory/+page.svelte
  - AG Grid or Tabulator spreadsheet component
  - Real-time filtering and sorting
  - Inline editing
  - Bulk operations
  - Export to CSV/Excel
```

#### B. Inventory Management Backend
```
/backend-services/inventory-api.js
  - CRUD operations
  - Location tracking
  - Transfer operations
  - Bulk import/export
  - Low stock alerts
```

#### C. Integration Points
1. **Coverage Map Integration**:
   - Click tower → "View Equipment" button
   - Shows filtered inventory at that location
   - Quick add from inventory to tower
   
2. **ACS Integration**:
   - Auto-create inventory record for new CPE
   - Status sync (deployed → RMA → retired)
   - Serial number linking

3. **HSS Integration**:
   - SIM card inventory
   - Bulk SIM provisioning from inventory

### Features by Week:

**Week 1: Core Inventory**
- [ ] Database schema (expand NetworkEquipment model)
- [ ] Backend API with CRUD operations
- [ ] Basic grid interface with sorting/filtering
- [ ] Add/Edit/Delete operations

**Week 2: Location Tracking**
- [ ] Location hierarchy (warehouse, tower, vehicle, customer)
- [ ] Transfer operations
- [ ] Location history tracking
- [ ] Search by location

**Week 3: Integration**
- [ ] Coverage Map integration (view equipment at tower)
- [ ] ACS CPE lifecycle sync
- [ ] Quick deployment workflows
- [ ] Status transitions

**Week 4: Advanced Features**
- [ ] Barcode/QR code generation
- [ ] Low stock alerts
- [ ] Warranty expiration tracking
- [ ] Bulk import/export

---

## Priority 2: Module Access Control System 🔐

### Why This Second?
- Foundation for SaaS business model
- Different customers need different features
- Enables tiered pricing
- Platform scalability

### What to Build:

#### A. Tenant Configuration
```typescript
// Firestore: /tenants/{tenantId}/config
{
  enabledModules: {
    pciResolution: true,
    cbrsManagement: false,  // Can turn off per tenant
    acsManagement: true,
    hssManagement: true,
    coverageMap: true,
    inventory: true,
    billing: false,  // Not yet available
    // ... etc
  },
  moduleLimits: {
    maxSites: 50,
    maxSubscribers: 5000,
    maxCPEs: 1000
  }
}
```

#### B. Admin Interface
```
/admin/tenants/[tenantId]
  ├─ Overview
  ├─ Module Access Control (toggles for each module)
  ├─ Usage Limits (number inputs)
  ├─ Subscription Tier (dropdown)
  └─ Activity Logs
```

#### C. Frontend Permission Checks
```typescript
// lib/stores/modulePermissions.ts
export const availableModules = derived(
  currentTenant,
  ($tenant) => {
    return allModules.filter(module => 
      $tenant?.config?.enabledModules?.[module.id]
    );
  }
);

// Usage in +layout.svelte
{#each $availableModules as module}
  <ModuleTile {module} />
{/each}
```

#### D. Backend Permission Middleware
```javascript
// backend-services/module-auth.js
function requireModule(moduleName) {
  return async (req, res, next) => {
    const tenantConfig = await getTenantConfig(req.tenantId);
    
    if (!tenantConfig.enabledModules[moduleName]) {
      return res.status(403).json({
        error: 'Module not enabled',
        message: `The ${moduleName} module is not available for your account`
      });
    }
    
    next();
  };
}

// Apply to routes
app.use('/api/pci/*', requireModule('pciResolution'));
app.use('/api/cbrs/*', requireModule('cbrsManagement'));
// ... etc
```

### Implementation Steps:

**Week 5: Backend Foundation**
- [ ] Add module permissions to tenant schema
- [ ] Create module auth middleware
- [ ] Apply to all API routes
- [ ] Add usage limit checks

**Week 6: Admin Interface**
- [ ] Tenant list page in admin
- [ ] Module toggle interface
- [ ] Usage limits configuration
- [ ] Real-time permission updates

**Week 7: Frontend Integration**
- [ ] Dynamic module loading based on permissions
- [ ] Graceful error handling for disabled modules
- [ ] Show "upgrade" prompts for unavailable features
- [ ] Test with multiple tenant configurations

---

## Priority 3: Complete Inventory-Coverage Map Integration 🗺️

### Current State:
- ✅ Can add equipment to towers via "Add Equipment Inventory"
- ❌ No centralized view of all equipment
- ❌ No easy way to move equipment between sites
- ❌ No comprehensive equipment search

### Target State:

#### A. Enhanced Tower View
```
Click Tower → Actions Menu:
  - View Equipment (NEW - opens inventory filtered to this site)
  - Add Equipment (from inventory or new)
  - Transfer Equipment (move to another site)
  - Equipment History
```

#### B. Inventory Module Features
```
Inventory Grid Columns:
  - Category
  - Type
  - Manufacturer/Model
  - Serial Number
  - Current Location (click to view on map)
  - Status
  - Condition
  - Last Updated
  - Actions (Edit, Move, View History)
```

#### C. Bidirectional Navigation
```
Coverage Map → Inventory:
  Tower details → "View Equipment" → Filtered inventory list

Inventory → Coverage Map:
  Equipment row → "View Location" → Map centered on tower
```

---

## Priority 4: System Admin Dashboard Enhancement 🛠️

### Add to /admin:

```
/admin/
  ├─ Dashboard (overview of all tenants)
  ├─ Tenants/
  │   ├─ List all tenants
  │   ├─ [tenantId]/
  │   │   ├─ Overview
  │   │   ├─ Module Access Control ⭐ NEW
  │   │   ├─ Usage Statistics
  │   │   ├─ Users
  │   │   └─ Billing
  ├─ System Health
  │   ├─ API Status
  │   ├─ Database Health
  │   ├─ Background Jobs
  │   └─ Error Logs
  └─ Platform Settings
      ├─ Available Modules
      ├─ Feature Flags
      └─ System Configuration
```

---

## Quick Win Features (Can Build Anytime)

### 1. Equipment Quick Actions
- Barcode scanner for check-in/check-out
- QR code labels for equipment
- Mobile-friendly inventory lookup

### 2. Reporting
- Equipment utilization report
- Inventory valuation
- Warranty expiration alerts
- Low stock notifications

### 3. Workflow Improvements
- Bulk equipment deployment
- Equipment reservation system
- Maintenance scheduling
- RMA tracking workflow

---

## Technical Debt to Address

### 1. Consolidate Equipment Models
Currently equipment data is scattered:
- Coverage Map: NetworkEquipment
- ACS: CPE devices (Firestore)
- HSS: Subscriber data

**Solution**: Unified inventory model with module extensions

### 2. Improve Data Sync
Some modules use Firestore, some use MongoDB

**Solution**: Event-driven sync layer with webhooks

### 3. Module Independence
Modules are tightly coupled in some areas

**Solution**: Well-defined APIs between modules

---

## Recommended Approach

### Sprint 1 (Week 1-2): Inventory Foundation
1. Expand NetworkEquipment schema for full inventory
2. Build inventory API with all CRUD operations
3. Create basic grid interface (use Tabulator - it's free)
4. Add location tracking and transfers

### Sprint 2 (Week 3-4): Coverage Map Integration
1. Add "View Equipment" to tower actions menu
2. Link inventory to Coverage Map locations
3. Build equipment transfer workflow
4. Add quick deployment from inventory

### Sprint 3 (Week 5-6): Module Permissions
1. Add enabledModules to tenant config
2. Create admin interface for module toggles
3. Implement backend permission checks
4. Update frontend to show/hide modules

### Sprint 4 (Week 7-8): Polish & Testing
1. Barcode/QR code generation
2. Advanced filters and search
3. Bulk operations
4. User documentation
5. Pilot testing with selected tenants

---

## Success Criteria

### Inventory Module:
- ✅ Track 10,000+ items without performance issues
- ✅ Search/filter < 500ms
- ✅ Equipment deployment time reduced by 50%
- ✅ Inventory accuracy > 95%

### Module Permissions:
- ✅ Admin can toggle modules in < 30 seconds
- ✅ Changes apply immediately (no page refresh)
- ✅ Users see only enabled modules
- ✅ API properly enforces permissions

### Integration:
- ✅ Coverage Map shows equipment count per tower
- ✅ One-click navigation between map and inventory
- ✅ Equipment transfers tracked with history
- ✅ ACS CPE automatically appears in inventory

---

## Resources Needed

### Development Time:
- **Inventory Module**: 2-3 weeks (1 developer)
- **Module Permissions**: 1-2 weeks (1 developer)
- **Integration**: 1-2 weeks (1 developer)
- **Testing & Polish**: 1 week

**Total**: 5-8 weeks for complete implementation

### Technology Decisions:
- **Spreadsheet Component**: Start with Tabulator (free), upgrade to AG Grid if needed
- **Barcode Scanner**: Use ZXing or QuaggaJS (free)
- **QR Codes**: Use qrcode library (free)

---

## Questions to Answer

1. **Pricing Model**: Will you charge per module? Per user? Per site?
2. **Free Tier**: What modules should be available in free tier?
3. **Upgrade Path**: How do customers upgrade/downgrade?
4. **Inventory Priority**: Which equipment categories are most important first?
5. **Mobile Access**: Do field techs need mobile inventory access now or later?

---

## Next Steps

1. **Review this architecture document**
2. **Prioritize features** based on customer needs
3. **Choose spreadsheet component** (I recommend starting with Tabulator)
4. **Design inventory UI mockups**
5. **Start Sprint 1** - Build inventory foundation

Ready to begin implementation? Let me know which priority you want to tackle first!

