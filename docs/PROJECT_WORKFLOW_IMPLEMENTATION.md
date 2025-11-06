# Project Workflow Implementation Plan

## Overview
Projects are overlays that group existing map objects and enable creation of project-specific objects. The workflow spans Plan → Deploy → Field App.

## Architecture

### 1. Project Overlay System
- **Purpose**: Projects overlay/group existing map objects (towers, sectors, CPE, equipment)
- **Implementation**: 
  - Projects have a `scope` field that references existing object IDs
  - Projects can be toggled on/off via `showOnMap` filter
  - When a project is visible, its scope objects are highlighted/grouped visually
  - Plan module shows all projects with filter controls

### 2. Right-Click Context Menu for Project-Specific Objects
- **Purpose**: Create objects that only exist within a project context
- **Implementation**:
  - When a project is active (`planMode=true`), right-click shows project-specific options
  - Objects created in plan mode get `planId` field set
  - Objects with `planId` only show when that project's filter is enabled
  - MapContextMenu already supports planMode - enhance it

### 3. Deploy Module Integration
- **Purpose**: View and filter approved projects for deployment
- **Implementation**:
  - Deploy module shows projects with status `approved` or `ready`
  - Projects can be filtered on/off the map via `showOnMap` toggle
  - Deploy module can approve/reject plans
  - Approved plans trigger notifications to field techs

### 4. Field Tech Notification System
- **Purpose**: Notify field techs when projects are approved
- **Implementation**:
  - When deploy approves a project, send notification to assigned field techs
  - Use Firebase Cloud Messaging (FCM) for push notifications
  - Store notification in Firestore for offline access
  - Field app polls for new notifications

### 5. Field App Workflow
- **Purpose**: Field techs deploy, document, and finalize projects
- **Implementation**:
  - Field app receives approved project notifications
  - Field tech can view project details, scope, and requirements
  - Field tech documents deployment progress (photos, notes, status)
  - Field tech marks project as deployed/finalized
  - Updates sync back to main system

## Database Schema Changes

### PlanProject Model (already exists)
```javascript
{
  name: String,
  description: String,
  status: 'draft' | 'active' | 'ready' | 'approved' | 'rejected' | 'deployed' | 'cancelled',
  tenantId: String,
  createdBy: String,
  scope: {
    towers: [String],      // Existing tower IDs
    sectors: [String],     // Existing sector IDs
    cpeDevices: [String],  // Existing CPE IDs
    equipment: [String],   // Existing equipment IDs
    backhauls: [String]    // Existing backhaul IDs
  },
  projectObjects: {        // NEW: Objects created specifically for this project
    towers: [String],      // New tower IDs created in plan mode
    sectors: [String],     // New sector IDs created in plan mode
    cpeDevices: [String],  // New CPE IDs created in plan mode
    equipment: [String]    // New equipment IDs created in plan mode
  },
  assignedTo: String,      // Field tech user ID
  assignedAt: Date,        // When assigned
  showOnMap: Boolean,      // Filter toggle
  deployment: {
    startDate: Date,
    endDate: Date,
    status: String,
    progress: Number,
    documentation: [{
      type: String,        // 'photo' | 'note' | 'checklist'
      url: String,
      timestamp: Date,
      createdBy: String
    }]
  }
}
```

### Network Object Models (UnifiedSite, UnifiedSector, etc.)
- Add `planId` field (optional) - indicates object was created for a specific project
- Objects with `planId` only show when that project's filter is enabled

### Notifications Collection (Firestore)
```javascript
{
  userId: String,
  type: 'project_approved' | 'project_assigned' | 'project_updated',
  projectId: String,
  title: String,
  message: String,
  read: Boolean,
  createdAt: Timestamp,
  data: {
    projectName: String,
    assignedBy: String,
    // ... other relevant data
  }
}
```

## Implementation Steps

### Phase 1: Project Overlay System ✅ (Partial)
- [x] Projects have scope field
- [ ] Enhance map to show project overlays (visual grouping)
- [ ] Add project filter controls to Plan module
- [ ] Objects in project scope get visual indicator

### Phase 2: Right-Click Project Mode
- [ ] Enhance MapContextMenu to show project-specific options
- [ ] When creating objects in plan mode, set `planId` field
- [ ] Filter objects by `planId` when project filter is off
- [ ] Update AddSiteModal, AddSectorModal, etc. to accept `planId`

### Phase 3: Deploy Module Integration
- [ ] Show approved/ready projects in Deploy module
- [ ] Add project filter toggle (showOnMap) in Deploy
- [ ] Approve/reject projects from Deploy module
- [ ] Send notifications when project approved

### Phase 4: Notification System
- [ ] Create Cloud Function for sending notifications
- [ ] Store notifications in Firestore
- [ ] Field app polls for notifications
- [ ] Display notifications in field app

### Phase 5: Field App Workflow
- [ ] Field app project view
- [ ] Deployment documentation interface
- [ ] Progress tracking
- [ ] Finalize project workflow

## API Endpoints Needed

### Plans API (enhance existing)
- `PUT /api/plans/:id/assign` - Assign project to field tech
- `PUT /api/plans/:id/progress` - Update deployment progress
- `POST /api/plans/:id/documentation` - Add deployment documentation
- `PUT /api/plans/:id/finalize` - Mark project as deployed

### Notifications API (new)
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read
- `POST /api/notifications` - Create notification (internal)

## Frontend Components Needed

### Plan Module
- `ProjectOverlayView.svelte` - Visual overlay showing project scope
- `ProjectFilterControls.svelte` - Toggle projects on/off map

### Deploy Module
- `ProjectApprovalList.svelte` - List of projects ready for approval
- `ProjectFilterPanel.svelte` - Filter projects on/off map

### Shared Components
- `ProjectBadge.svelte` - Badge showing project affiliation
- `ProjectScopeView.svelte` - Display project scope objects

### Field App (future)
- `ProjectList.svelte` - List of assigned projects
- `ProjectDetails.svelte` - Project details view
- `DeploymentDocumentation.svelte` - Document deployment progress
- `ProjectProgress.svelte` - Track deployment progress

## Testing Checklist

- [ ] Create project overlays existing objects
- [ ] Right-click creates project-specific objects
- [ ] Project-specific objects only show when project filter enabled
- [ ] Deploy module shows approved projects
- [ ] Deploy can filter projects on/off map
- [ ] Approving project sends notification
- [ ] Field tech receives notification
- [ ] Field tech can view project details
- [ ] Field tech can document deployment
- [ ] Field tech can finalize project

