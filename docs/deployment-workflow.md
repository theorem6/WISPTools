# Deployment Workflow & Testing Checklist

## End-to-End Flow

1. **Plan Creation**
   - Create plan via `/api/plans`.
   - Add staged features through `/api/plans/:id/features` (sites, equipment).
   - `PlanLayerFeature` summary auto-updates on each change.

2. **Plan Approval & Authorization**
   - Set plan `status='ready'`, then `POST /plans/:id/approve`.
   - `POST /plans/:id/authorize` promotes staged features to production:
     - Transactionally creates `UnifiedSite`/`NetworkEquipment` with `originPlanId` trace.
     - Plan status updated to `authorized`, visibility toggled off.

3. **Deployment Preparation**
   - Deploy module fetches authorized plans via `planService.getPlans()`.
   - `mapLayerManager` loads production assets + authorized plan features into shared map context.
   - “Deploy Plan” action (placeholder) calls `planService.getPlanFeatures()` and logs the package (ready for future push integration).

## Testing Checklist

- [ ] **Backend**
  - Create plan, add staged features (site & equipment), ensure `/plans/:id/features` endpoints return expected data & summary.
  - Authorize plan and verify production collections contain promoted assets with `originPlanId`.
  - Confirm `PlanLayerFeature` statuses move to `authorized` and summary resets.

- [ ] **Plan Module UI**
  - Create project, observe shared map summary update.
  - Stage feature and confirm count increments in shared map summary.
  - Approve/Authorize project and confirm Plan map switches to production view.

- [ ] **Deploy Module UI**
  - Authorized plan appears in filter list; toggling visibility focuses shared map on that plan.
  - “Deploy Plan” button shows toast with feature counts (placeholder push message).
  - Deployed hardware modal still accessible; backend data unaffected.

- [ ] **Shared Map Coverage**
  - Switch between Plan/Deploy to ensure shared context updates correctly.
  - Production asset count matches `getAllExistingHardware()` output.

- [ ] **Regression**
  - Tenant login flow loads without error.
  - Other modules (PCI, Frequency, Deployed hardware) remain functional when opened from Deploy.

## Future Enhancements
- Integrate deployment package push with work-order or notification service.
- Replace `SharedMap` placeholder with interactive map rendering (Mapbox/Leaflet etc.).
- Expand staged feature promotion to sectors/CPE links.

