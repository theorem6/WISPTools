# Project Workflow Implementation Status

## ✅ Already Implemented

1. **Plan Mode Detection**: `planMode` and `planId` are tracked via URL params
2. **planId Passed to Modals**: AddSiteModal, AddSectorModal, AddCPEModal, AddBackhaulLinkModal all accept `planId`
3. **Objects Filtered by Plan**: Objects with `planId` only show when that plan's filter is enabled
4. **MapContextMenu Supports planMode**: Shows "Add to Plan" vs "Create" labels
5. **Plan Filtering**: Plans have `showOnMap` flag for filtering

## 🔨 Needs Implementation

### 1. Project Overlay System
**Status**: ✅ Visual overlay done; badge/indicator optional

**Done**:
- Per-project color overlay on coverage map (`arcgisMapController.renderProjectOverlays()` uses palette: green, blue, amber, violet, cyan, red, lime, pink) so multiple projects are visually distinct
- Project scope polygons rendered when project overlay is shown (Deploy filter / MapLayerManager)

**Optional next**:
- Project badge/indicator on individual objects (sectors/CPE) in list or map popup

### 2. Right-Click Context Menu Enhancement
**Status**: ✅ Sector/CPE options in plan mode done

**Done**:
- "Add Sector to Plan" and "Add CPE Device to Plan" shown in MapContextMenu when `planMode` is true; coverage-map `handleContextMenuAction` opens AddSectorModal / AddCPEModal with `planId={effectivePlanId}` and `initialLatitude={contextMenuLat}` so created objects are plan-scoped

**Optional next**:
- Visual feedback (e.g. toast or highlight) when a project-specific object is created from the map

### 3. Deploy Module Integration
**Status**: ✅ Complete for overlay + filter

**Done**:
- Show approved/ready projects in Deploy module
- Project filter panel (Approved) toggles project visibility on map
- Visibility toggle calls `mapLayerManager.showProjectOverlay` / `hideProjectOverlay`; map updates immediately
- MapLayerManager syncs `visibleProjects` and `projectOverlays` to mapContext for iframe
- Approve/reject workflow from Deploy (Plan list modal)

### 4. Notification System
**Status**: ✅ In-app complete; Cloud/push/field app optional

**Done**:
- Firestore `notifications` collection (created when plan is approved via `createProjectApprovalNotification`)
- Firestore composite index on `notifications`: (userId ASC, createdAt DESC) — defined in `firestore.indexes.json`; run `firebase deploy --only firestore:indexes` if needed
- Backend GET /api/notifications, GET /count, PUT /:id/read with Firebase auth
- In-app NotificationCenter (bell + dropdown) on dashboard; project approvals appear there
- NotificationCenter refreshes only when the panel is opened (no reactive loop)

**Done (field app §4):**
- apiService.getNotifications(), getUnreadNotificationCount(), markNotificationRead(id)
- NotificationsScreen lists notifications, "Open My Projects" for project_approved; HomeScreen has Deployment Plans + Notifications buttons (when navigator registers Plans + Notifications)

**Optional next**:
- Cloud Function to send push/email when project approved (SendGrid already optional)

### 5. Field App Workflow
**Status**: ✅ My Projects + deployment progress/notes done

**Done**:
- Assign on approve: Deploy PlanApprovalModal accepts optional "Assign to tech" (user ID + name); backend stores in `plan.deployment.assignedTo` / `assignedToName` / `assignedTeam`
- `GET /api/plans/mobile/:userId?filter=assigned-to-me` returns plans assigned to that user
- Field app PlansScreen: "My Projects" | "All Plans" toggle; "My Projects" uses `filter=assigned-to-me`
- Backend `PATCH /api/plans/mobile/:userId/:planId/deployment`: update `deploymentStage`, `notes`, `documentation.notes` (assigned techs only); plan details include `deployment` for tower-crew/installer
- Field app PlanDetailsScreen: "Progress & Notes" for tower-crew/installer — stage buttons, field notes, Save notes; installation photos: "Take photo" / "Choose from library" upload via backend (MongoDB Atlas GridFS when possible, Firebase Storage fallback), or paste URLs and Save photo URLs — PATCH accepts `documentation.installationPhotos` (§5 in-app camera/upload done)

**Storage:** Backend `POST /api/plans/mobile/:userId/:planId/deployment/photos` (multipart) stores in **MongoDB Atlas (GridFS)** when connected; falls back to **Firebase Storage** if GridFS fails. `GET /api/plans/deployment-photos/:planId/:fileId` serves from GridFS.

**Done (navigator):** Field app uses React Navigation in `src/navigation/AppNavigator.tsx`; Plans, Notifications, PlanDetails and all HomeScreen routes (QRScanner, Checkin, Checkout, etc.) are wired. App.tsx shows Login or Home based on auth, then navigator handles Plans/Notifications/PlanDetails.

## Next Steps (Priority Order)

1. **Enhance MapContextMenu** - ✅ Done (sector/CPE "Add to Plan" + modal wiring; see §2)
2. **Project Overlay Visualization** - ✅ Done (per-project colors in coverage map; see §1)
3. **Deploy Module Filtering** - ✅ Done (project filter panel, MapLayerManager overlay sync; see §3)
4. **Notification System** - ✅ In-app complete; Cloud Function + Firestore optional (see §4)
5. **Field App Integration** - ✅ Done (My Projects, assign on approve, deployment progress/notes, photo URLs; see §5)

## Optional follow-ups

- **Backend deploy:** Use `DEPLOY_BACKEND_FALLBACK.md` (or `docs/deployment/DEPLOY_BACKEND_MANUAL.md`) when SSH from Windows fails; run the manual `gcloud compute ssh` steps from Cloud Shell or a host with working IAP.
- **API_BASE_URL:** Set in backend env (see `backend-services/.env.example`) so deployment photo URLs (GridFS) use the correct public base URL when served behind a load balancer or Cloud Run.

