## Plan & Deploy Unified Map Architecture

### Goals
- Provide a planning sandbox where engineers can stage proposed sites/devices without touching production data until authorization.
- Reuse the same map foundation across Plan, Deploy, and Monitor modules while enabling capability-specific tooling.
- Enable promotion of approved plan assets into production inventory with full audit trail.
- Allow Deploy to consume authorized plans, assign tasks, and push them to field/mobile clients.

### Data Model Additions

#### `PlanProject` (existing)
- Extend with `mapConfig` (view preferences) and `stagedFeatureCounts` (summary of plan-layer features).
- Track `authorizedAt`, `authorizedBy`, and `authorizationNotes` (already present but ensure they persist).

#### `PlanLayerFeature` (new collection)
Represents a staged object that exists only within a plan until authorized.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | |
| `tenantId` | string | Indexed |
| `planId` | string | Indexed |
| `featureType` | enum(`site`,`sector`,`cpe`,`equipment`,`link`,`note`) | |
| `geometry` | GeoJSON (Point/LineString/Polygon) | |
| `properties` | Mixed | Stores form data identical to production models |
| `status` | enum(`draft`,`pending-review`,`approved`,`rejected`) | Used for internal plan workflows |
| `createdBy`, `updatedBy` | string | user identifiers |
| `createdAt`, `updatedAt` | Date | |

#### `PlanTask` (optional phase-2)
- Sits between plan authorization and deployment to capture engineering tasks before handing to field crews.

### API Overview

`/api/plans` (existing)
- Extend `GET /:id` to include staged feature counts and optional preview payload.
- Add `POST /:id/features` CRUD endpoints for `PlanLayerFeature`.
- Add `POST /:id/authorize` to promote staged features via transaction (new pipeline described below).

`/api/map/layers`
- New unified map endpoint returning production + plan layers depending on requesting module.
  - Query params: `mode=plan|deploy|monitor`, `planId`, `includeProduction=true/false`.
  - Returns: `{ production: {...}, planDraft: {...}, deployTasks: {...} }` depending on context.

### Authorization Pipeline
1. Validate plan status (`approved`).
2. Fetch all `PlanLayerFeature` records for the plan.
3. For each feature type:
   - Convert staged properties into corresponding production model (`UnifiedSite`, `UnifiedSector`, etc.).
   - Record `originPlanId` on production records for traceability.
4. Mark staged features `status='authorized'` and archive snapshot.
5. Update `PlanProject.status='authorized'` and append audit entry.

### Shared Map Architecture

Create `Module_Manager/src/lib/map/` with the following:
- `MapLayerManager.ts` – orchestrates fetching layers via new backend endpoint.
- `MapCapabilities.ts` – defines what actions are enabled (e.g., Plan: `canAddTemporary`, Deploy: `canCompleteTask`, Monitor: `readOnly`).
- `useMapContext.ts` – shared store for selected plan, feature selections, and capabilities.

#### Frontend Modules
- **Plan**: loads production layer as read-only overlay, provides toolbox to add plan-layer features using `MapLayerManager.createFeature()`.
- **Deploy**: loads production + authorized plan features, surfaces deployment tasks, syncs completion status back via `/api/deploy/projects`.
- **Monitor**: loads production only; same component but capability set is read-only.

### Deploy Module Updates
1. When viewing projects, request `/api/plans?status=authorized` to list deployable plans.
2. Provide task assignment UI (using `PlanTask` or existing work-order service) to push tasks to mobile clients.
3. Integrate map to show authorized features, allow marking items as installed/tested.

### Security & Authorization
- All plan-layer endpoints require both tenant auth and role check (planner/admin by default).
- Ensure production mutation only occurs during authorization flow with transactional safeguards (using MongoDB sessions).

### Migration Strategy
1. Deploy new collections and endpoints alongside existing functionality.
2. Refactor Plan UI to consume new map services.
3. Introduce Deploy project view referencing authorized plans.
4. Gradually retire iframe-based coverage-map embedding once shared map is stable.

### Next Steps
- Implement backend models (`PlanLayerFeature`) and CRUD routes.
- Build MapLayerManager + capability system in frontend.
- Refactor Plan module to use new map pipeline (phase 1 minimal create/view).
- Extend Deploy module with project list, map, and task distribution (phase 2).

### Workstream Outline

#### Backend
1. **Models**
   - `PlanLayerFeature` schema (with indexes on `tenantId`, `planId`, `featureType`).
   - Optional `PlanLayerArchive` for keeping authorized snapshot (phase 2).
2. **Routes**
   - `/api/plans/:id/features` CRUD (list, create, update, delete, bulk import/export).
   - `/api/plans/:id/authorize` transactional promotion.
   - `/api/map/layers` unified layer endpoint.
3. **Services**
   - Helper to transform plan-layer features into production models.
   - Audit trail entries on `PlanProject` (`events` array).

#### Frontend (Plan module)
1. Replace iframe with shared map component.
2. Provide toolbox for adding temporary features (site, sector, device, note).
3. Persist staged features via new `/features` endpoints.
4. Display staged vs production layers with visual differentiation.
5. Implement plan authorization UI (review staged items, submit for approval).

#### Frontend (Deploy module)
1. Add `DeployProjectsStore` that fetches `/api/plans?status=authorized` and exposes derived summaries (site counts, outstanding tasks).
2. Render shared map in deploy mode with layer toggles for: production, authorized plan features, work progress markers.
3. Integrate task assignment drawer:
   - create tasks (`PlanTask`) per staged feature or manual entry.
   - sync to work-order service or push notifications to mobile clients.
4. Provide deployment checklist UI (mark site as staged/in-progress/completed, attach photos, upload test metrics).
5. Expose “Push to field devices” action that publishes deployment packages via existing push service or Firebase messaging.

#### Monitor module integration
1. Consume shared map in read-only mode for live telemetry.
2. Toggle visibility of authorized plans vs historical layers.

