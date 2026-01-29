# Wizard Implementation Advisory

**Date:** January 2025  
**Status:** Analysis Complete - Ready for Implementation

---

## 📊 Executive Summary

Based on comprehensive documentation review, **15+ wizards** need to be created across multiple modules. Currently, **4 ACS wizards** have been completed. This document outlines all required wizards organized by priority and module.

---

## ✅ Completed Wizards (ACS Module)

1. ✅ **DeviceRegistrationWizard** - Register CPE devices
2. ✅ **PresetCreationWizard** - Create TR-069 presets
3. ✅ **BulkOperationsWizard** - Bulk device operations
4. ✅ **FirmwareUpdateWizard** - Firmware management

---

## 🔴 High Priority Wizards (Critical for Core Functionality)

### 1. **Deployment Wizard** (Coverage Map Module)
**Priority:** 🔴 Critical  
**Module:** Coverage Map / Deploy  
**Status:** ✅ Added (Deploy Equipment button on Deploy; type → location → equipment → configure → checklist → complete)

**Purpose:** Guide field technicians through deploying equipment (sectors, radios, CPE)

**Steps:**
1. Select deployment type (Sector, Radio, CPE)
2. Choose location on map
3. Select equipment from inventory
4. Configure equipment parameters
5. Upload photos
6. Complete deployment checklist
7. Link to work order (optional)

**Features:**
- Auto-create sector when deploying radio
- Auto-link inventory item to sector
- Configuration templates
- Photo uploads
- GPS location capture
- Deployment checklist

**File:** `Module_Manager/src/lib/components/wizards/deployment/DeploymentWizard.svelte`

**Reference:** `docs/workflows/FIELD_OPERATIONS_WORKFLOWS.md` (lines 630-641)

---

### 2. **Troubleshooting Wizard** (ACS Module)
**Priority:** 🔴 Critical  
**Module:** ACS CPE Management  
**Status:** ✅ Added (Troubleshoot button + backend diagnostics/reboot/refresh/factory-reset)

**Purpose:** Guide users through diagnosing and fixing CPE device issues

**Steps:**
1. Select device with issue
2. Identify problem type (Offline, Slow, Configuration, etc.)
3. Run diagnostics
4. View suggested solutions
5. Apply fixes
6. Verify resolution

**Features:**
- Device diagnostics
- Common issue patterns
- Step-by-step troubleshooting
- Fix application
- Resolution verification

**File:** `Module_Manager/src/lib/components/wizards/acs/TroubleshootingWizard.svelte`

**Reference:** `docs/ACS_MONITORING_FEATURE_ANALYSIS.md` (line 197)

---

### 3. **Device Onboarding Wizard** (ACS Module)
**Priority:** 🔴 Critical  
**Module:** ACS CPE Management  
**Status:** ✅ Added (Onboard Device button; discovery, customer link, preset, HSS bandwidth-plans API)

**Purpose:** Comprehensive device onboarding flow (more detailed than DeviceRegistrationWizard)

**Steps:**
1. Device discovery (scan/enter serial)
2. Device information collection
3. Customer linking
4. Initial configuration
5. Preset application
6. Testing and verification
7. Completion

**Features:**
- Customer linking
- Service plan assignment
- Initial configuration
- Preset application
- Testing workflow

**File:** `Module_Manager/src/lib/components/wizards/acs/DeviceOnboardingWizard.svelte`

**Reference:** `docs/ACS_MONITORING_FEATURE_ANALYSIS.md` (line 191)

---

### 4. **Inventory Check-in Wizard** (Inventory Module)
**Priority:** 🔴 Critical  
**Module:** Inventory  
**Status:** ❌ Missing

**Purpose:** Guide warehouse staff through receiving and checking in inventory

**Steps:**
1. Scan/enter item serial number
2. Verify item details
3. Set location (warehouse/section)
4. Print label
5. Set status (Available)
6. Link to purchase order (optional)

**Features:**
- Barcode/QR scanning
- Location assignment
- Label printing
- Purchase order linking
- Bulk check-in support

**File:** `Module_Manager/src/lib/components/wizards/inventory/InventoryCheckInWizard.svelte`

**Reference:** `docs/workflows/FIELD_OPERATIONS_WORKFLOWS.md` (lines 669-675)

---

### 5. **Work Order Creation Wizard** (Work Orders Module)
**Priority:** 🔴 Critical  
**Module:** Work Orders / Maintain  
**Status:** ❌ Missing

**Purpose:** Guide users through creating work orders/tickets

**Steps:**
1. Select work order type (Installation, Repair, Maintenance, etc.)
2. Select affected equipment/customers
3. Set priority and SLA
4. Assign technician (optional)
5. Add description and notes
6. Attach files/photos
7. Create and notify

**Features:**
- Multiple work order types
- Equipment/customer linking
- Priority and SLA settings
- Technician assignment
- File attachments
- Notification system

**File:** `Module_Manager/src/lib/components/wizards/workorders/WorkOrderCreationWizard.svelte`

**Reference:** `docs/workflows/FIELD_OPERATIONS_WORKFLOWS.md` (lines 582-613)

---

## 🟡 Medium Priority Wizards (Important for User Experience)

### 6. **RMA Tracking Wizard** (Inventory Module)
**Priority:** 🟡 Medium  
**Module:** Inventory  
**Status:** ✅ Added (Track RMA button on Inventory)

**Purpose:** Guide RMA (Return Merchandise Authorization) workflow

**Steps:**
1. Select item for RMA
2. Enter failure reason
3. Generate RMA ticket
4. Link to vendor RMA number
5. Ship tracking
6. Receive and test
7. Repair/replace decision
8. Return to stock

**Features:**
- RMA ticket generation
- Vendor integration
- Shipment tracking
- Testing workflow
- Cost tracking
- Turnaround time reporting

**File:** `Module_Manager/src/lib/components/wizards/inventory/RMATrackingWizard.svelte`

**Reference:** `docs/workflows/FIELD_OPERATIONS_WORKFLOWS.md` (lines 653-663)

---

### 7. **Customer Onboarding Wizard** (Customers Module)
**Priority:** 🟡 Medium  
**Module:** Customers  
**Status:** ✅ Added (Onboarding Wizard on Customers)

**Purpose:** Guide customer creation and service setup

**Steps:**
1. Enter customer information
2. Select service plan
3. Assign installation address
4. Schedule installation (optional)
5. Link CPE device (optional)
6. Create customer account
7. Send welcome email

**Features:**
- Customer information collection
- Service plan assignment
- Address management
- Installation scheduling
- Device linking
- Account creation

**File:** `Module_Manager/src/lib/components/wizards/customers/CustomerOnboardingWizard.svelte`

---

### 8. **HSS Subscriber Creation Wizard** (HSS Module)
**Priority:** 🟡 Medium  
**Module:** HSS Management  
**Status:** ✅ Added (Add Subscriber Wizard on HSS)

**Purpose:** Guide subscriber creation with all required HSS parameters

**Steps:**
1. Enter subscriber information (IMSI, MSISDN)
2. Generate security keys (Ki, OPc, AMF, SQN)
3. Select bandwidth plan
4. Assign subscriber group
5. Configure QoS settings
6. Link to customer (optional)
7. Create subscriber

**Features:**
- IMSI/MSISDN entry
- Security key generation
- Bandwidth plan selection
- Group assignment
- QoS configuration
- Customer linking

**File:** `Module_Manager/src/lib/components/wizards/hss/SubscriberCreationWizard.svelte`

---

### 9. **PCI Conflict Resolution Wizard** (PCI Module)
**Priority:** 🟡 Medium  
**Module:** PCI Resolution  
**Status:** ✅ Added (Conflict Wizard button in left sidebar; analyze → review → optimize → apply → verify)

**Purpose:** Guide users through resolving PCI conflicts

**Steps:**
1. Identify conflicts
2. Review conflict details
3. Select resolution strategy (Auto, Manual, Suggest)
4. Preview changes
5. Apply PCI reassignments
6. Verify resolution

**Features:**
- Conflict visualization
- Resolution strategies
- Change preview
- Batch operations
- Verification

**File:** `Module_Manager/src/lib/components/wizards/pci/ConflictResolutionWizard.svelte`

---

### 10. **Site Deployment Wizard** (Coverage Map Module)
**Priority:** 🟡 Medium  
**Module:** Coverage Map / Deploy  
**Status:** ✅ Added (Add Site button on Deploy)

**Purpose:** Guide through deploying a complete tower site

**Steps:**
1. Select site location
2. Configure tower details
3. Add sectors (3 or 4)
4. Configure each sector
5. Link equipment
6. Set up backhaul
7. Test connectivity
8. Complete deployment

**Features:**
- Multi-sector configuration
- Equipment linking
- Backhaul setup
- Testing workflow
- Documentation

**File:** `Module_Manager/src/lib/components/wizards/coverage/SiteDeploymentWizard.svelte`

---

## 🟢 Lower Priority Wizards (Nice to Have)

### 11. **Organization Setup Wizard** (Separate Component)
**Priority:** 🟢 Low  
**Module:** Onboarding  
**Status:** ⚠️ Partially exists in FirstTimeSetupWizard

**Purpose:** Dedicated organization setup flow

**File:** `Module_Manager/src/lib/components/wizards/onboarding/OrganizationSetupWizard.svelte`

**Reference:** `docs/COMPREHENSIVE_AUDIT_AND_COMPLETION_PLAN.md` (line 65)

---

### 12. **Initial Configuration Wizard** (Separate Component)
**Priority:** 🟢 Low  
**Module:** Onboarding  
**Status:** ⚠️ Partially exists in FirstTimeSetupWizard

**Purpose:** Initial platform configuration after organization setup

**File:** `Module_Manager/src/lib/components/wizards/onboarding/InitialConfigurationWizard.svelte`

**Reference:** `docs/COMPREHENSIVE_AUDIT_AND_COMPLETION_PLAN.md` (line 66)

---

### 13. **Bandwidth Plan Creation Wizard** (HSS Module)
**Priority:** 🟢 Low  
**Module:** HSS Management  
**Status:** ✅ Added (Add Plan Wizard on HSS)

**Purpose:** Guide bandwidth plan creation

**File:** `Module_Manager/src/lib/components/wizards/hss/BandwidthPlanWizard.svelte`

---

### 14. **Subscriber Group Creation Wizard** (HSS Module)
**Priority:** 🟢 Low  
**Module:** HSS Management  
**Status:** ✅ Added (Add Group Wizard on HSS)

**Purpose:** Guide subscriber group creation

**File:** `Module_Manager/src/lib/components/wizards/hss/SubscriberGroupWizard.svelte`

---

### 15. **CBRS Device Registration Wizard** (CBRS Module)
**Priority:** 🟢 Low  
**Module:** CBRS Management  
**Status:** ✅ Added (Register Device Wizard button; device info → location → review → add)

**Purpose:** Guide CBRS device registration with SAS

**File:** `Module_Manager/src/lib/components/wizards/cbrs/DeviceRegistrationWizard.svelte`

---

## 📋 Implementation Recommendations

### Phase 1: Critical Wizards (2-3 weeks)
1. Deployment Wizard
2. Troubleshooting Wizard
3. Device Onboarding Wizard
4. Inventory Check-in Wizard
5. Work Order Creation Wizard

### Phase 2: Medium Priority (2-3 weeks)
6. RMA Tracking Wizard
7. Customer Onboarding Wizard
8. HSS Subscriber Creation Wizard
9. PCI Conflict Resolution Wizard ✅
10. Site Deployment Wizard

### Phase 3: Lower Priority (1-2 weeks)
11-15. Remaining wizards

---

## 🏗️ Architecture Recommendations

### Directory Structure
```
Module_Manager/src/lib/components/wizards/
├── BaseWizard.svelte (✅ Created)
├── ModuleWizardManager.svelte (✅ Created)
├── index.ts (✅ Created)
│
├── acs/
│   ├── DeviceRegistrationWizard.svelte (✅ Created)
│   ├── PresetCreationWizard.svelte (✅ Created)
│   ├── BulkOperationsWizard.svelte (✅ Created)
│   ├── FirmwareUpdateWizard.svelte (✅ Created)
│   ├── TroubleshootingWizard.svelte (✅ Created)
│   └── DeviceOnboardingWizard.svelte (✅ Created)
│
├── deployment/
│   ├── DeploymentWizard.svelte (❌ TODO)
│   └── SiteDeploymentWizard.svelte (✅ Created)
│
├── inventory/
│   ├── InventoryCheckInWizard.svelte (✅ Exists)
│   └── RMATrackingWizard.svelte (✅ Created)
│
├── workorders/
│   └── WorkOrderCreationWizard.svelte (✅ Exists)
│
├── customers/
│   └── CustomerOnboardingWizard.svelte (✅ Created)
│
├── hss/
│   ├── SubscriberCreationWizard.svelte (✅ Created)
│   ├── BandwidthPlanWizard.svelte (✅ Created)
│   └── SubscriberGroupWizard.svelte (✅ Created)
│
├── pci/
│   └── ConflictResolutionWizard.svelte (✅ Added)
│
├── cbrs/
│   └── DeviceRegistrationWizard.svelte (✅ Added)
│
└── onboarding/
    ├── OrganizationSetupWizard.svelte (❌ TODO)
    └── InitialConfigurationWizard.svelte (❌ TODO)
```

---

## 📝 Notes

- All wizards should extend `BaseWizard` component
- Use `ModuleWizardManager` for centralized wizard orchestration
- Follow existing wizard patterns for consistency
- Each wizard should have proper error handling and validation
- Include loading states for async operations
- Support keyboard navigation (Escape to close)
- Ensure responsive design for mobile devices

---

## 🎯 Next Steps

1. **Review this advisory** with stakeholders
2. **Prioritize wizard creation** based on business needs
3. **Create implementation plan** with timelines
4. **Assign development tasks** to team members
5. **Begin Phase 1 implementation** (Critical wizards)

---

**Total Wizards Needed:** 15  
**Completed:** 12 (ACS: 4; Deploy: SiteDeployment; Inventory: CheckIn, RMA; WorkOrders: WorkOrderCreation; Customers: CustomerOnboarding; HSS: SubscriberCreation, BandwidthPlan, SubscriberGroup)  
**Remaining:** 7

**Estimated Development Time (remaining):**
- Phase 1 (Critical): Troubleshooting, DeviceOnboarding, Deployment — 2-3 weeks
- Phase 2/3: ConflictResolution, CBRS DeviceRegistration, OrganizationSetup, InitialConfiguration — 2-3 weeks
- **Remaining: ~3-5 weeks**
