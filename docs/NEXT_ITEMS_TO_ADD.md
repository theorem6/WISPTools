---
title: Next Items Needing to Be Added
description: Single list of remaining work, planned features, and TODOs for WISPTools.
---

# Next Items Needing to Be Added

**Source:** All project `.md` files (planning, status, and implementation docs).  
**Purpose:** Single list of remaining work, planned features, and TODOs so nothing is missed.

---

## 1. Wizards (all implemented)

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
| OrganizationSetupWizard | onboarding | ✅ Added (standalone wizard; open from /wizards or step 1 of First-Time Setup) |
| InitialConfigurationWizard | onboarding | ✅ Added (standalone wizard; open from /wizards or step 3 of First-Time Setup) |

**Completed:** 19 (ACS: DeviceRegistration, PresetCreation, BulkOperations, FirmwareUpdate, Troubleshooting, DeviceOnboarding; Deploy: SiteDeployment, DeploymentWizard; Inventory: CheckIn, RMATracking; WorkOrders: WorkOrderCreation; Customers: CustomerOnboarding; HSS: SubscriberCreation, BandwidthPlan, SubscriberGroup; PCI: ConflictResolution; CBRS: DeviceRegistration).  
**Remaining:** 0. All planned wizards implemented.

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

- **Status:** Phase 1 in place. Per-customer billing records with service plan, billing cycle, and SLA (response time, uptime %, notes) via `CustomerBillingModal` and backend `GET/POST/PUT /api/customer-billing`. Backend POST accepts `sla` on create.
- **Done:** Billing cycles (monthly/annual, day of month), SLA tracking (response time hours, uptime percent, notes).
- **To add (later):** Invoicing and payments UI, Stripe integration, invoice history.

---

## 4. ACS / CPE Management

**Sources:** `docs/ACS_IMPLEMENTATION_COMPLETION.md`, `Module_Manager/src/routes/modules/acs-cpe-management/REFACTOR_SUMMARY.md`, `docs/ACS_FINAL_COMPLETION.md`

- **Done:** Parameter editor, CPE performance API, TR-069 tasks, Preset Management UI (`/modules/acs-cpe-management/presets`), Customer Linking, **Alert system** (rules + active alerts at `/modules/acs-cpe-management/alerts`; backend `GET/POST/PUT/DELETE /api/tr069/alerts/rules`, `GET /api/tr069/alerts`), **Firmware management** (version tracking, upgrade scheduling at `/modules/acs-cpe-management/firmware`; backend `GET /api/tr069/firmware`, `POST /api/tr069/firmware/upgrade`, upload, download).
- **Optional (later):** Alert integration with monitoring/email/SMS; device grouping/tags, task queue UI, reporting/analytics, webhooks, mobile app, anomaly detection, device templates.

---

## 5. LTE/5G & Customer Form (Frontend)

**Source:** `docs/LTE_5G_INTEGRATION_COMPLETE.md`

- **Backend:** Done (HSS sync, MME status, etc.).
- **Frontend:** Done. `AddEditCustomerModal.svelte` has service type selector, LTE auth (IMSI, Ki, OPc), MAC, and QoS (QCI, data quota, priority).
- **Next (optional):** Test customer creation with 4G/5G, verify HSS sync; add customer count widgets and online/offline indicators; alerts for HSS sync failures.

---

## 6. Documentation System

**Source:** `docs/IMPLEMENTATION_STATUS.md`, `docs/DOCUMENTATION_PLAN_SUMMARY.md`

- **Docs are integrated into the main app:** No separate docs site. Use <code>/docs</code> (Documentation home, Reference, Project Status) and <code>/help</code> (topic-based help). Dashboard has a 📖 Documentation button; Help page links to /docs.
- **Phase 2:** Frontmatter added to key docs (WHERE_WE_ARE_AND_NEXT_STEPS, NEXT_ITEMS_TO_ADD, IMPLEMENTATION_STATUS, PROJECT_WORKFLOW_STATUS, CUSTOMER_PORTAL_IMPLEMENTATION_PLAN, WIZARD_IMPLEMENTATION_ADVISORY, LTE_5G_INTEGRATION_COMPLETE, DOCUMENTATION_PLAN_SUMMARY, ENHANCEMENTS, COMPREHENSIVE_AUDIT_AND_COMPLETION_PLAN, DOCUMENTATION_SYSTEM_PLAN, BACKEND_ARCHITECTURE, WISP_ACTIVITIES_DEEP_DIVE, FIREBASE_ADMIN_SDK_SETUP, DOCUMENTATION_CLEANUP_PLAN, ONBOARDING_IMPLEMENTATION_STATUS, ACS_FINAL_COMPLETION, README, deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS). Remaining: add to more files; fix broken links; update cross-references.
- **Phase 3 (optional):** Code examples, Mermaid diagrams, API playground; optional static export from repo docs for external reference.

---

## 7. Monitoring & Map

**Sources:** `docs/WISP_ACTIVITIES_DEEP_DIVE.md`, `Module_Manager/src/routes/modules/coverage-map/lib/REFACTORING_SUMMARY.md`

- **Topology:** Monitoring module has **Network Topology** view (`NetworkTopologyMap.svelte`) with layout, physics, labels, and device connections; coverage map uses ArcGIS Polyline for backhaul/links.
- SNMP configuration endpoint (referenced; confirm implemented or add).
- Advanced alerting rules (basic exists).
- Predictive analytics (optional / later).
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
| ~~High~~ | ~~Wizards~~ | ✅ All implemented (OrganizationSetup, InitialConfiguration, and 17 others) |
| High | Customer Portal | ✅ Branding + feature toggles (enableBilling, enableTickets); tickets wired to work orders. Remaining: route polish, optional live chat/KB |
| ~~High~~ | ~~ACS~~ | ✅ Alerts UI + firmware UI/scheduling exist; optional: email/SMS integration |
| ~~Medium~~ | ~~LTE/5G~~ | ✅ AddEditCustomerModal has service type, LTE auth (IMSI/Ki/OPc), MAC, QoS (QCI, data quota, priority) |
| Medium | Documentation | Frontmatter added to key docs; remaining: more frontmatter, link audit (docs in app at /docs, /help) |
| ~~Medium~~ | ~~Customer Billing~~ | ✅ Phase 1: cycles, SLA (response/uptime/notes); later: invoicing, Stripe |
| Lower | Monitoring/Map | ✅ Topology in Monitoring module + ArcGIS links in coverage map; optional: advanced alerts, badges |
| Lower | Field App | Branded app icon |
| Lower | Backend | API_BASE_URL documented; deploy: run manual SSH step from Cloud Shell if Upload succeeds but plink fails (see DEPLOY_BACKEND_FALLBACK.md) |

---

*Generated from project .md files. Update this doc as items are completed or new plans are added.*

**In-app docs:** Documentation is integrated into the main app. Use **Dashboard → 📖 Documentation** or go to **/docs** (Documentation home, Reference, Project Status) and **/help** (topic-based help). Project Status is at **/docs/reference/project-status**.
