# Next Items Needing to Be Added

**Source:** All project `.md` files (planning, status, and implementation docs).  
**Purpose:** Single list of remaining work, planned features, and TODOs so nothing is missed.

---

## 1. Wizards (2 remaining)

**Source:** `docs/WIZARD_IMPLEMENTATION_ADVISORY.md`

| Wizard | Module | Status |
|--------|--------|--------|
| TroubleshootingWizard | acs | ✅ Added (Troubleshoot button; backend diagnostics/reboot/refresh/factory-reset) |
| DeviceOnboardingWizard | acs | ✅ Added (Onboard Device button; API paths fixed) |
| DeploymentWizard | deployment | ✅ Added (Deploy Equipment button on Deploy) |
| SiteDeploymentWizard | deployment | ✅ Added (Add Site button on Deploy) |
| InventoryCheckInWizard | inventory | ✅ Exists |
| RMATrackingWizard | inventory | ✅ Added (Track RMA button on Inventory) |
| WorkOrderCreationWizard | workorders | ✅ Exists |
| CustomerOnboardingWizard | customers | ✅ Added (Onboarding Wizard on Customers) |
| SubscriberCreationWizard | hss | ✅ Added (Add Subscriber Wizard on HSS) |
| BandwidthPlanWizard | hss | ✅ Added (Add Plan Wizard on HSS) |
| SubscriberGroupWizard | hss | ✅ Added (Add Group Wizard on HSS) |
| ConflictResolutionWizard | pci | ✅ Added (Conflict Wizard button in PCI Resolution left sidebar) |
| DeviceRegistrationWizard (CBRS) | cbrs | ✅ Added (Register Device Wizard button on CBRS) |
| OrganizationSetupWizard | onboarding | ❌ TODO |
| InitialConfigurationWizard | onboarding | ❌ TODO |

**Completed:** 17 (ACS: DeviceRegistration, PresetCreation, BulkOperations, FirmwareUpdate, Troubleshooting, DeviceOnboarding; Deploy: SiteDeployment, DeploymentWizard; Inventory: CheckIn, RMATracking; WorkOrders: WorkOrderCreation; Customers: CustomerOnboarding; HSS: SubscriberCreation, BandwidthPlan, SubscriberGroup; PCI: ConflictResolution; CBRS: DeviceRegistration).  
**Remaining:** 2. Estimated 2–4 weeks for remaining wizards.

---

## 2. Customer Portal

**Sources:** `docs/CUSTOMER_PORTAL_IMPLEMENTATION_PLAN.md`, `docs/COMPREHENSIVE_AUDIT_AND_COMPLETION_PLAN.md`, `docs/WISP_ACTIVITIES_DEEP_DIVE.md`

- **Status:** Planned; routes and auth exist; full flow not implemented.
- **Remaining:**
  - Tenant branding (logo/colors) refinements
  - Create branding schema in tenant model
  - Build out portal route structure beyond placeholders
  - Ticket system for customers (wire to maintain module)
  - Branding customization UI for WISP admins
  - Optional: live chat (future), multi-language (future), 2FA (future)
- **Estimate:** 3–4 weeks for MVP.

---

## 3. Customer Billing

**Sources:** `docs/WISP_ACTIVITIES_DEEP_DIVE.md`, `docs/COMPREHENSIVE_AUDIT_AND_COMPLETION_PLAN.md`

- **Status:** Not implemented (only tenant subscriptions exist).
- **To add:**
  - Customer billing cycles
  - Invoicing and payments
  - SLA tracking (not yet planned in detail)
- **Note:** Documented, ready to implement when prioritized.

---

## 4. ACS / CPE Management

**Sources:** `docs/ACS_IMPLEMENTATION_COMPLETION.md`, `Module_Manager/src/routes/modules/acs-cpe-management/REFACTOR_SUMMARY.md`, `docs/ACS_FINAL_COMPLETION.md`

- **Done (recent):** Parameter editor, CPE performance API, TR-069 tasks, Preset Management UI (full page at `/modules/acs-cpe-management/presets`), Customer Linking (link/unlink in CPEPerformanceModal; backend PUT + DELETE `/api/tr069/devices/:deviceId/customer`).
- **Remaining:**
  - **Alert system** – Device offline, parameter thresholds, email/SMS; integrate with monitoring.
  - **Firmware management** – Version tracking, upgrade scheduling, bulk updates (backend TR-069 firmware upload exists; UI/scheduling to add).
  - **Optional:** Device grouping/tags, task queue UI, reporting/analytics, webhooks, mobile app, anomaly detection, device templates.

---

## 5. LTE/5G & Customer Form (Frontend)

**Source:** `docs/LTE_5G_INTEGRATION_COMPLETE.md`

- **Backend:** Done (HSS sync, MME status, etc.).
- **Frontend TODO:** Update `AddEditCustomerModal.svelte`:
  - Service type selector
  - LTE authentication fields (IMSI, Ki, OPc)
  - MAC address field
  - Enhanced speed package / QoS fields
- **Next:** Test customer creation with 4G/5G, verify HSS sync; add customer count widgets and online/offline indicators; alerts for HSS sync failures.

---

## 6. Documentation System

**Source:** `docs/IMPLEMENTATION_STATUS.md`, `docs/DOCUMENTATION_PLAN_SUMMARY.md`

- **Docs are integrated into the main app:** No separate docs site. Use <code>/docs</code> (Documentation home, Reference, Project Status) and <code>/help</code> (topic-based help). Dashboard has a 📖 Documentation button; Help page links to /docs.
- **Phase 2:** Add frontmatter to remaining repo <code>docs/</code> files; fix broken links; update cross-references.
- **Phase 3 (optional):** Code examples, Mermaid diagrams, API playground; optional static export from repo docs for external reference.

---

## 7. Monitoring & Map

**Sources:** `docs/WISP_ACTIVITIES_DEEP_DIVE.md`, `Module_Manager/src/routes/modules/coverage-map/lib/REFACTORING_SUMMARY.md`

- SNMP configuration endpoint (referenced; confirm implemented or add).
- Connection topology drawing in ArcGIS (marked TODO).
- Advanced alerting rules (basic exists).
- Predictive analytics (missing).
- Coverage map: optional project badge/indicator on objects; optional visual feedback when adding to plan.

---

## 8. Field App & Branding

**Source:** `wisp-field-app/android/RELEASE_BUILD_INSTRUCTIONS.md`

- Replace app icon with branded icons (see ICON_BRANDING.md).

---

## 9. Backend / Ops

**Sources:** `docs/PROJECT_WORKFLOW_STATUS.md`, `docs/WHERE_WE_ARE_AND_NEXT_STEPS.md`, `DEPLOYMENT_VERIFICATION_COMPLETE.md`

- **Optional:** Use `DEPLOY_BACKEND_FALLBACK.md` when SSH from Windows fails; document manual `gcloud compute ssh` steps.
- **API_BASE_URL:** Set in backend env so deployment photo URLs (GridFS) use correct public base URL behind load balancer/Cloud Run.
- **Backend optimizations:** `backend-services/OPTIMIZATION_PROGRESS.md` – OUI lookup + config + network helpers + OID walk extracted; modularization pending.

---

## 10. Where We Are doc – Known gaps (updated)

**Source:** `docs/WHERE_WE_ARE_AND_NEXT_STEPS.md`

- **Done:** GitHub token security, repo URL alignment, CBRS encryption, CPE performance API, keyboard/focus, push/email on approval, ACS parameter editor, backend TODOs (firmware upload, CBRS import, epcMetrics→incidents, activity logging, installation-doc notifications).
- **Optional:** EPC ID in Hardware module – kept readonly/auto-generated per product decision; no further change needed unless requirements change.

---

## 11. ENHANCEMENTS.md – Already done

**Source:** `docs/ENHANCEMENTS.md`

- CBRS encryption, CPE performance data, keyboard navigation, push/email on approval, ACS parameter editor, Hardware EPC ID note – all addressed; ENHANCEMENTS.md can be updated to mark these done.

---

## Summary Table (what to add next)

| Priority | Area | Item |
|----------|------|------|
| High | Wizards | 5 remaining (Deployment, ConflictResolution, CBRS DeviceRegistration, OrganizationSetup, InitialConfiguration) |
| High | Customer Portal | Branding schema + UI, ticket wiring, portal route polish |
| High | ACS | Alert integration (device offline, thresholds, email/SMS); firmware UI/scheduling |
| ~~Medium~~ | ~~LTE/5G~~ | ✅ AddEditCustomerModal already has service type, LTE auth (IMSI/Ki/OPc), MAC, QoS (QCI, data quota, priority) |
| Medium | Documentation | Frontmatter in repo docs/; links; optional code examples/diagrams (docs integrated in app at /docs, /help) |
| Medium | Customer Billing | Billing cycles, invoicing, SLA tracking (when prioritized) |
| Lower | Monitoring/Map | Topology drawing, advanced alerts, optional badges/feedback |
| Lower | Field App | Branded app icon |
| Lower | Backend | API_BASE_URL env, optional deploy fallback doc, SNMP/modularization |

---

*Generated from project .md files. Update this doc as items are completed or new plans are added.*

**In-app docs:** Documentation is integrated into the main app. Use **Dashboard → 📖 Documentation** or go to **/docs** (Documentation home, Reference, Project Status) and **/help** (topic-based help). Project Status is at **/docs/reference/project-status**.
