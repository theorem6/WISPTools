---
title: Continuation Completion – Code Reference
description: Completed work from the continuation session with code and file locations.
---

# Continuation Completion – Code Reference

Completed items and the code/files that implement them. Use this doc to locate or verify each completion.

---

## 1. Customer Portal (UI + features)

| What | Code / file |
|------|-------------|
| "Setup Portal" → "Customize Portal" (label + tooltip + tab description) | `Module_Manager/src/routes/modules/customers/+page.svelte` – portal tab description text, primary button text, `title` attribute (all say "Customize Portal") |
| Portal feature: enableBilling | `backend-services/models/tenant.js`, `models/tenant.js` – `branding.features.enableBilling` (default true). `backend-services/routes/branding-api.js` – defaultBranding.features.enableBilling. `Module_Manager/src/lib/services/brandingService.ts` – TenantBranding.features.enableBilling. |
| Portal-setup: Billing toggle + save/load | `Module_Manager/src/routes/modules/customers/portal-setup/+page.svelte` – variable `enableBilling`, load in loadExistingConfig, save in saveBranding + saveFeatures, Features tab toggle "💳 Billing & Invoices" |

---

## 2. Customer Billing – SLA

| What | Code / file |
|------|-------------|
| SLA schema (responseTimeHours, uptimePercent, notes) | `backend-services/models/customer-billing.js` – `sla` sub-schema |
| PUT allows `sla` | `backend-services/routes/customer-billing.js` – `allowed` includes `'sla'` |
| POST accepts `sla` on create/update | `backend-services/routes/customer-billing.js` – destructure `sla` from `req.body`, merge on existing doc, pass to `CustomerBilling.create()` |
| Frontend types | `Module_Manager/src/lib/services/customerBillingService.ts` – `CustomerBillingSLA`, `CustomerBilling.sla` |
| SLA form + load/save | `Module_Manager/src/routes/modules/customers/components/CustomerBillingModal.svelte` – form fields `slaResponseTimeHours`, `slaUptimePercent`, `slaNotes`; load from `billing.sla`; save via `update(..., { sla })` or `createOrUpdate(..., { sla })` |

---

## 3. Onboarding Wizards (OrganizationSetup + InitialConfiguration)

| What | Code / file |
|------|-------------|
| OrganizationSetupWizard component | `Module_Manager/src/lib/components/wizards/OrganizationSetupWizard.svelte` – tenant display, "Edit in Settings" → `/dashboard?panel=settings` |
| InitialConfigurationWizard component | `Module_Manager/src/lib/components/wizards/InitialConfigurationWizard.svelte` – Coverage Map, CBRS, ACS, Monitoring setup links |
| Exports | `Module_Manager/src/lib/components/wizards/index.ts` – `OrganizationSetupWizard`, `InitialConfigurationWizard` |
| Catalog entries + "Open" on page | `Module_Manager/src/routes/wizards/+page.svelte` – entries `organization-setup`, `initial-configuration`; state `showOrgWizard`, `showConfigWizard`; buttons open wizards on same page |
| First-Time Setup step links | `Module_Manager/src/lib/components/wizards/FirstTimeSetupWizard.svelte` – step 1: "Open full Organization Setup wizard"; step 3: "Open full Initial Configuration wizard"; imports and renders both wizards, `.btn-link` style |

---

## 4. RMATrackingWizard export

| What | Code / file |
|------|-------------|
| Export from wizards index | `Module_Manager/src/lib/components/wizards/index.ts` – `export { default as RMATrackingWizard } from './inventory/RMATrackingWizard.svelte'` |

---

## 5. Documentation – Frontmatter and status

| What | Code / file |
|------|-------------|
| Frontmatter (title, description) | `docs/WHERE_WE_ARE_AND_NEXT_STEPS.md`, `docs/NEXT_ITEMS_TO_ADD.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/PROJECT_WORKFLOW_STATUS.md`, `docs/CUSTOMER_PORTAL_IMPLEMENTATION_PLAN.md`, `docs/WIZARD_IMPLEMENTATION_ADVISORY.md`, `docs/LTE_5G_INTEGRATION_COMPLETE.md`, `docs/DOCUMENTATION_PLAN_SUMMARY.md`, `docs/ENHANCEMENTS.md` |
| API_BASE_URL note in deploy section | `docs/WHERE_WE_ARE_AND_NEXT_STEPS.md` – "Set **API_BASE_URL** in backend env …" in Deploy & infra, refs `.env.example` and `DEPLOY_BACKEND_FALLBACK.md` |
| NEXT_ITEMS_TO_ADD – wizards section | `docs/NEXT_ITEMS_TO_ADD.md` – "Wizards (all implemented)", OrganizationSetup + InitialConfiguration marked ✅, "Remaining: 0" |
| NEXT_ITEMS_TO_ADD – Customer Billing section | Same file – status "Phase 1 in place", SLA + cycles done, POST accepts sla |
| NEXT_ITEMS_TO_ADD – ACS section | Same file – Alerts UI + firmware UI/scheduling noted as done |
| NEXT_ITEMS_TO_ADD – Summary table | Same file – table rows for Wizards, ACS, LTE/5G, Customer Billing, Backend updated to ✅ or current status |
| NEXT_ITEMS_TO_ADD – Phase 2 docs | Same file – Phase 2 text lists frontmatter-added docs |
| ENHANCEMENTS – Done list + future sections | `docs/ENHANCEMENTS.md` – CBRS encryption, CPE performance, keyboard nav, push/email approval, ACS parameter editor, Hardware EPC in Done; High value (future): Customer Portal; Optional: Monitoring/Map, Field app |

---

## 6. Backend – API_BASE_URL usage (existing; documented)

| What | Code / file |
|------|-------------|
| Env example | `backend-services/.env.example` – `# API_BASE_URL=...` |
| TR-069 firmware/photo base URL | `backend-services/routes/tr069.js` – `process.env.API_BASE_URL \|\| (req.protocol + '://' + req.get('host'))` |
| Deployment photos base URL | `backend-services/routes/plans/plans-deployment-photos.js` – same pattern |
| Plan hardware service | `backend-services/services/planHardwareService.js` – `process.env.API_BASE_URL \|\| 'http://localhost:3001'` |
| Deploy fallback doc | `DEPLOY_BACKEND_FALLBACK.md` – documents API_BASE_URL for deployment photos |

---

## Continuation (latest session)

| What | Code / file |
|------|-------------|
| Portal billing: redirect when disabled | `Module_Manager/src/routes/modules/customers/portal/billing/+page.svelte` – when `!featureEnabled`, `goto('/modules/customers/portal/dashboard')` instead of showing "feature disabled" |
| Docs frontmatter (6 more) | `docs/COMPREHENSIVE_AUDIT_AND_COMPLETION_PLAN.md`, `DOCUMENTATION_SYSTEM_PLAN.md`, `BACKEND_ARCHITECTURE.md`, `WISP_ACTIVITIES_DEEP_DIVE.md`, `FIREBASE_ADMIN_SDK_SETUP.md`, `DOCUMENTATION_CLEANUP_PLAN.md` |
| Docs frontmatter (4 more) | `docs/ONBOARDING_IMPLEMENTATION_STATUS.md`, `ACS_FINAL_COMPLETION.md`, `README.md`, `deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md` |
| NEXT_ITEMS Phase 2 list | `docs/NEXT_ITEMS_TO_ADD.md` – Phase 2 frontmatter list extended with above files |
| **Portal enableTickets** | Backend: `tenant.js` + `branding-api.js` – `features.enableTickets` (default true). Frontend: `brandingService.ts`, `portal-setup/+page.svelte` (toggle "🎫 Support Tickets"), `BrandedHeader.svelte`, `dashboard/+page.svelte`, `portal/tickets/+page.svelte`, `tickets/new/+page.svelte`, `tickets/[id]/+page.svelte` – hide/redirect when disabled |
| **Docs frontmatter (guides/fixes/status)** | `guides/MONITORING_AND_ALERTING.md`, `TR069_FIRMWARE_UPGRADE_GUIDE.md`, `CBRS_MODULE_COMPLETE.md`, `MULTI_TENANT_ARCHITECTURE.md`; `fixes/AUTH_401_INSUFFICIENT_PERMISSION.md`, `CRITICAL_FIX_SUMMARY.md`; `status/DEPLOYMENT_STATUS.md`, `EPC_MONITORING_STATUS.md` |
| **Monitoring/Map** | `NEXT_ITEMS_TO_ADD.md` §7 – noted topology exists: Monitoring has NetworkTopologyMap; coverage map has ArcGIS Polyline for links |
| **Backend deploy** | **Fully automated:** Backend deploys on every push to `main` via `.github/workflows/deploy-backend-gce.yml`. **Finish (one-time):** Push a commit to trigger CI, or run Option A from Cloud Shell (see `DEPLOY_BACKEND_FALLBACK.md`) if the VM still has files only in `/tmp/backend-services-deploy`. |
| **NEXT_ITEMS table** | Customer Portal, Monitoring/Map, Backend rows updated; Backend row notes manual SSH from Cloud Shell when plink fails |
| **Doc link audit** | `docs/README.md` internal links (deployment/, hss/, guides/, ../Module_Manager/) verified; targets exist |

---

## Quick file list (changed or referenced)

- `Module_Manager/src/routes/modules/customers/+page.svelte`
- `Module_Manager/src/routes/modules/customers/components/CustomerBillingModal.svelte`
- `Module_Manager/src/lib/services/customerBillingService.ts`
- `Module_Manager/src/lib/components/wizards/OrganizationSetupWizard.svelte`
- `Module_Manager/src/lib/components/wizards/InitialConfigurationWizard.svelte`
- `Module_Manager/src/lib/components/wizards/FirstTimeSetupWizard.svelte`
- `Module_Manager/src/lib/components/wizards/index.ts`
- `Module_Manager/src/routes/wizards/+page.svelte`
- `backend-services/models/customer-billing.js`
- `backend-services/routes/customer-billing.js`
- `docs/WHERE_WE_ARE_AND_NEXT_STEPS.md`
- `docs/NEXT_ITEMS_TO_ADD.md`
- `docs/ENHANCEMENTS.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/PROJECT_WORKFLOW_STATUS.md`
- `docs/CUSTOMER_PORTAL_IMPLEMENTATION_PLAN.md`
- `docs/WIZARD_IMPLEMENTATION_ADVISORY.md`
- `docs/LTE_5G_INTEGRATION_COMPLETE.md`
- `docs/DOCUMENTATION_PLAN_SUMMARY.md`
