# Project Workflow Implementation Status

## ✅ Already Implemented

1. **Plan Mode Detection**: `planMode` and `planId` are tracked via URL params
2. **planId Passed to Modals**: AddSiteModal, AddSectorModal, AddCPEModal, AddBackhaulLinkModal all accept `planId`
3. **Objects Filtered by Plan**: Objects with `planId` only show when that plan's filter is enabled
4. **MapContextMenu Supports planMode**: Shows "Add to Plan" vs "Create" labels
5. **Plan Filtering**: Plans have `showOnMap` flag for filtering

## 🔨 Needs Implementation

### 1. Project Overlay System
**Status**: Partial - projects can group objects but no visual overlay yet

**Needed**:
- Visual overlay/highlighting for objects in project scope
- Project badge/indicator on objects
- Project scope visualization on map

### 2. Right-Click Context Menu Enhancement
**Status**: Basic support exists, needs enhancement

**Needed**:
- Add "Create Sector" and "Create CPE" options to context menu in plan mode
- Ensure all created objects get `planId` set
- Add visual feedback when creating project-specific objects

### 3. Deploy Module Integration
**Status**: Partial - deploy can see plans but filtering needs work

**Needed**:
- Show approved/ready projects in Deploy module
- Add project filter toggle in Deploy module
- Projects visible in Deploy should filter on/off map
- Approve/reject workflow from Deploy

### 4. Notification System
**Status**: Not implemented

**Needed**:
- Cloud Function to send notifications when project approved
- Firestore notifications collection
- Field app notification polling
- Notification UI in field app

### 5. Field App Workflow
**Status**: Not implemented

**Needed**:
- Project assignment to field techs
- Field app project view
- Deployment documentation interface
- Progress tracking
- Finalize project workflow

## Next Steps (Priority Order)

1. **Enhance MapContextMenu** - Add sector/CPE creation options in plan mode
2. **Project Overlay Visualization** - Add visual indicators for project objects
3. **Deploy Module Filtering** - Add project filter controls
4. **Notification System** - Cloud Function + Firestore
5. **Field App Integration** - Project workflow UI

