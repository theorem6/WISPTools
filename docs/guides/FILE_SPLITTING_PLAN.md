# File Splitting and Modularization Plan

## Overview

Several files have grown large (>30KB) and should be split into logical modules for better maintainability, testability, and deployment.

## Priority Files to Split

### 1. distributed-epc-api.js (36KB) ⭐ HIGH PRIORITY
**Current State:** Monolithic EPC management API with authentication, routes, and utilities mixed together.

**Proposed Structure:**
```
distributed-epc/
├── index.js                          # Main router export
├── middleware/
│   ├── auth.js                       # authenticateEPC, requireTenant
│   └── validation.js                 # Request validation middleware
├── routes/
│   ├── registration.js               # POST /epc/register
│   ├── management.js                 # GET/DELETE /epc/*
│   ├── deployment-script.js          # GET /epc/:id/deployment-script
│   ├── heartbeat.js                  # POST /epc/:id/heartbeat
│   └── monitoring.js                 # GET /epc/dashboard, /epc/:id/metrics
├── services/
│   ├── epc-service.js                # Business logic for EPC operations
│   ├── metrics-service.js            # Metrics collection and processing
│   └── alert-service.js              # Alert generation logic
├── utils/
│   ├── script-generator.js           # generateDeploymentScript()
│   └── crypto-utils.js               # Key generation utilities
└── models/
    └── index.js                      # Re-export from distributed-epc-schema.js
```

### 2. cbrs-management/+page.svelte (54KB) ⭐ HIGH PRIORITY
**Current State:** Single file with CBSD management, grants, spectrum visualization.

**Proposed Structure:**
```
cbrs-management/
├── +page.svelte                      # Main layout (< 10KB)
├── components/
│   ├── CBSDList.svelte              # CBSD device list
│   ├── CBSDDetails.svelte           # Device details panel
│   ├── GrantManagement.svelte       # Grant controls
│   ├── SpectrumVisualization.svelte # Spectrum chart
│   ├── DeviceRegistration.svelte    # New device form
│   └── SettingsModal.svelte         # Already separated ✓
└── lib/
    ├── cbrs-api.ts                  # API client
    ├── grant-helpers.ts             # Grant logic
    └── spectrum-calc.ts             # Spectrum calculations
```

### 3. functions/src/cbrsManagement.ts (38KB)
**Current State:** All CBRS Firebase Functions in one file.

**Proposed Structure:**
```
functions/src/cbrs/
├── index.ts                         # Export all functions
├── device-management.ts             # registerDevice, listDevices
├── grant-management.ts              # requestGrant, heartbeat, relinquish
├── spectrum-inquiry.ts              # spectrumInquiry
└── utils/
    ├── sas-client.ts                # Google/FW SAS API client
    └── validation.ts                # Request validators
```

### 4. Module_Manager/src/lib/components/SiteEditor.svelte (38KB)
**Current State:** Site editing with inline map, validation, and form logic.

**Proposed Structure:**
```
lib/components/site-editor/
├── SiteEditor.svelte                # Main component (< 15KB)
├── SiteForm.svelte                  # Form fields
├── SiteMap.svelte                   # Map with location picker
├── SiteCells.svelte                 # Cell list/editor
└── lib/
    ├── site-validation.ts           # Form validation
    └── site-api.ts                  # API calls
```

### 5. pciOptimizerSimple.ts (52KB)
**Current State:** PCI optimization algorithm in one large file.

**Proposed Structure:**
```
lib/pci/
├── optimizer.ts                     # Main optimizer export (< 10KB)
├── algorithms/
│   ├── simple.ts                    # Simple algorithm
│   ├── advanced.ts                  # Advanced algorithm
│   └── conflict-detection.ts        # Conflict checker
├── models/
│   ├── cell.ts                      # Cell model
│   ├── site.ts                      # Site model
│   └── neighbor.ts                  # Neighbor model
└── utils/
    ├── distance-calc.ts             # Distance calculations
    └── pci-helpers.ts               # PCI utilities
```

## Implementation Steps

### Phase 1: Backend API (distributed-epc-api.js)
1. Create directory structure
2. Extract middleware to separate files
3. Split routes into individual files
4. Move business logic to services
5. Extract utilities
6. Update imports in main file
7. Test all endpoints
8. Update deployment

### Phase 2: Frontend Components
1. Split large Svelte components
2. Extract shared logic to lib files
3. Create component-specific utilities
4. Update imports
5. Test all functionality

### Phase 3: Cloud Functions
1. Split CBRS functions
2. Create shared utilities
3. Update function exports
4. Test deployments
5. Update documentation

## Benefits

✅ **Maintainability:** Easier to find and fix bugs  
✅ **Testability:** Can test individual modules  
✅ **Reusability:** Shared utilities can be imported  
✅ **Performance:** Better tree-shaking and code splitting  
✅ **Collaboration:** Multiple developers can work on different modules  
✅ **Deployment:** Can deploy only changed modules  

## Testing Strategy

1. **Unit Tests:** Test individual modules in isolation
2. **Integration Tests:** Test module interactions
3. **E2E Tests:** Test full workflows
4. **Performance Tests:** Ensure no performance regression

## Rollout Plan

1. ✅ Create documentation (this file)
2. Create feature branch: `refactor/modularization`
3. Implement Phase 1 (backend API)
4. Deploy and test in staging
5. Implement Phase 2 (frontend components)
6. Implement Phase 3 (cloud functions)
7. Final testing
8. Merge to main
9. Deploy to production

## Timeline

- **Week 1:** Phase 1 (Backend API split)
- **Week 2:** Phase 2 (Frontend components)
- **Week 3:** Phase 3 (Cloud functions)
- **Week 4:** Testing and deployment

## Notes

- Maintain backward compatibility during transition
- Update all documentation with new structure
- Add JSDoc comments to all exported functions
- Consider using barrel exports (index.js) for cleaner imports

