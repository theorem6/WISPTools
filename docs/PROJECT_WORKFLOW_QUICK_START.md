---
title: Project Workflow – Quick Start
description: Implemented project overlay, deploy integration, notifications, and field app flows.
---

# Project Workflow Implementation Summary

**See also:** [PROJECT_WORKFLOW_STATUS.md](./PROJECT_WORKFLOW_STATUS.md) for detailed status and next steps.

## ✅ Implemented Features

### 1. Project Overlay System
- ✅ Projects can group existing objects via `scope` field
- ✅ Objects with `planId` only show when project filter is enabled
- ✅ Plan mode detection via URL params (`planMode=true&planId=xxx`)
- ✅ Per-project color overlay on coverage map (palette: green, blue, amber, violet, cyan, red, lime, pink)
- ✅ Project scope polygons rendered when overlay is shown (Deploy filter / MapLayerManager)

### 2. Right-Click Context Menu
- ✅ MapContextMenu supports plan mode
- ✅ Shows "Add to Plan" vs "Create" labels
- ✅ "Add Sector to Plan" and "Add CPE Device to Plan" in plan mode; modals receive `planId` so created objects are plan-scoped
- ✅ All modals (AddSiteModal, AddSectorModal, AddCPEModal) accept `planId` prop

### 3. Deploy Module Integration
- ✅ Deploy module shows ready/approved plans
- ✅ Plan approval workflow; optional "Assign to" tech when approving
- ✅ Project filter panel toggles projects on/off map (MapLayerManager overlays)
- ✅ Approved plans trigger in-app notifications; optional SendGrid/Cloud Function for email

### 4. Notification System
- ✅ Firestore `notifications` collection; backend GET /count, PUT /:id/read
- ✅ In-app NotificationCenter (bell) on dashboard; project approvals shown
- ✅ Optional: Cloud Function + SendGrid for project-approval email; field app notification polling

### 5. Field App Workflow
- ✅ Backend: `GET /api/plans/mobile/:userId?filter=assigned-to-me` returns plans assigned to that user
- ✅ Approve payload can include `assignedToUserId` / `assignedToName`; stored in `plan.deployment`
- ✅ Field app PlansScreen: "My Projects" | "All Plans" toggle; "My Projects" uses the filter
- ✅ Backend `PATCH /api/plans/mobile/:userId/:planId/deployment` for stage/notes (assigned techs only)
- ✅ PlanDetailsScreen: Progress & Notes — update deployment stage, save field notes
- 🔨 **Optional:** Photo upload for installation (documentation.installationPhotos)

## Next Immediate Steps

1. **Field app:** Add "My Projects" screen calling `GET /api/plans/mobile/:userId?filter=assigned-to-me`
2. **Field app:** Deployment documentation and progress tracking UI
3. **Optional:** Project badge on sectors/CPE in list or map popup

## How To Use Current Implementation

### Creating a Project
1. Go to Plan module
2. Click "New Project"
3. Enter project name and description
4. Project is created with status "draft"

### Adding Objects to Project (Plan Mode)
1. In Plan module, open or create a project
2. Navigate to coverage map with `?planMode=true&planId=PROJECT_ID`
3. Right-click on map to see "Add to Plan" options
4. Create sites, sectors, or CPE devices — they are linked to the project

### Viewing and Approving in Deploy
1. Go to Deploy module
2. Use Plans / Approved filter; toggle projects on/off map
3. Approve (and optionally assign to a tech); approved plans trigger notifications and appear in NotificationCenter

### Field app – "My Projects"
- Call `GET /api/plans/mobile/:userId?filter=assigned-to-me` to list plans assigned to the current user.
- Use `GET /api/plans/mobile/:userId/:planId` for details.

## API Endpoints

- `POST /api/plans` - Create project
- `GET /api/plans` - Get all projects
- `PUT /api/plans/:id` - Update project
- `PUT /api/plans/:id/toggle-visibility` - Toggle `showOnMap`
- `POST /api/plans/:id/approve` - Approve project (body: `{ notes?, assignedToUserId?, assignedToName? }`)
- `POST /api/plans/:id/reject` - Reject project
- `GET /api/plans/mobile/:userId` - Plans for mobile (query: `role`, `filter=assigned-to-me`)

## Database Schema

Projects are stored in MongoDB `planprojects` with:
- `scope` - References existing object IDs
- `showOnMap` - Filter toggle
- `status` - draft | ready | approved | authorized | deployed | cancelled
- `deployment.assignedTo`, `deployment.assignedToName`, `deployment.assignedTeam` - Assignment for field app "My Projects"

Network objects can have `planId` when created in plan mode.
