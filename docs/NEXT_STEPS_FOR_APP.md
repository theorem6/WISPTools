---
title: Next Steps for WISPTools
description: Prioritized, actionable list of what to complete next for the app.
---

# Next Steps for WISPTools

**Purpose:** Prioritized, actionable list of what to complete next for the app.  
**Audience:** Product/development. Update this as items are done.

---

## 1. High impact (do soon) – completed

### 1.1 Customer portal – finish & harden ✅
- **Billing Portal Admin:** ✅ Portal setup → Billing Portal tab (Stripe/PayPal, invoice customization). Backend branding API saves/loads `branding.billingPortal`.
- **Stripe/PayPal in portal:** ✅ StripeCardForm.svelte on portal billing “Pay now”; backend `POST /api/customer-portal/billing/create-payment-intent` (set `STRIPE_SECRET_KEY` in production).
- **Dunning automation:** ✅ Backend has `POST /api/internal/cron/billing` and `backend-services/scripts/cron-billing.sh`. See [BILLING_CRON_AND_DUNNING_SCHEDULE.md](./BILLING_CRON_AND_DUNNING_SCHEDULE.md) to schedule (cron on GCE or Cloud Scheduler).
- **Invoice generation:** ✅ Same internal route runs generate-invoices + dunning; admin UI has Generate invoices / Run dunning buttons.

### 1.2 Help/docs for end users ✅
- **Operator-only docs:** ✅ End-user help at `/help` and quick tips; operator/deployment docs in repo `docs/` and in-app `/docs` (Reference, Project Status).
- **Doc system:** ✅ Frontmatter on key docs; in-app `/docs`, `/help`, project status at `/docs/reference/project-status`. Optional: more frontmatter, link audit, single doc entry.

### 1.3 Frontend – fix and polish ✅
- **ModuleWizardMenu:** ✅ Wizards dropdown and catalog aligned; Customers and other modules use getWizardsForPath.
- **Auth redirect:** ✅ Root layout redirects to `/login` when `!isAuthenticated` and not a public route.
- **Help page CSS:** ✅ `/help` uses `.help-container` and theme vars from `app.css`.

---

## 2. Medium impact (next) – completed or optional

### 2.1 Wizards and navigation ✅
- **Wizard pulldown:** ✅ All 19+ wizards in catalog; `/wizards` hub and module “More wizards” menus; `?wizard=<id>` opens correct wizard.
- **ACS menu:** ✅ ACS CPE Management has Devices, Presets, Alerts, Firmware, etc.; see docs/guides and ACS_FINAL_COMPLETION.md.

### 2.2 Mobile Field App (operational)
- **Build:** See [FIELD_APP_DOWNLOAD.md](./FIELD_APP_DOWNLOAD.md) and `wisp-field-app/android/RELEASE_BUILD_INSTRUCTIONS.md`.
- **Host APK:** Upload APK to Firebase Hosting (`Module_Manager/public/downloads/`), Storage, or GCE; get stable URL.
- **Download link:** ✅ Dashboard has “Download Field App” (📱) using `API_CONFIG.MOBILE_APP_DOWNLOAD_URL`; set in `Module_Manager/src/lib/config/api.ts` or env.

### 2.3 Notifications and UX ✅
- **Browser notifications:** ✅ NotificationCenter uses browser Notification API (with user permission) for new alerts.

---

## 3. Lower priority / optional

### 3.1 Documentation system
- **Phase 2:** ✅ Key docs have frontmatter; in-app `/docs`, `/help`, project status. Optional: add frontmatter to more files; fix broken links; code examples/diagrams.
- **Single doc entry:** Optional: one “Documentation” entry (e.g. `/help` only); currently both `/docs` and `/help` available.

### 3.2 Backend and ops ✅
- **Backend deploy:** ✅ GitHub Actions `deploy-backend-gce.yml`; manual fallback in [DEPLOY_BACKEND_FALLBACK.md](../DEPLOY_BACKEND_FALLBACK.md). Use `GOOGLE_APPLICATION_CREDENTIALS` or service account for Firebase deploy.
- **API_BASE_URL:** ✅ Documented in `backend-services/.env.example` and [deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md](./deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md), [DEPLOY_BACKEND_FALLBACK.md](../DEPLOY_BACKEND_FALLBACK.md).

### 3.3 Customer portal – extras
- **Live chat:** ✅ Portal shows “Coming soon” when Live Chat is enabled. Optional: integrate real chat widget.
- **Knowledge base:** ✅ FAQ and KB have search input; categories in data. Optional: richer search/categories for large KBs.

### 3.4 Monitoring and reporting
- **Advanced alerting:** Optional: monitoring alert rules, email/SMS escalation.
- **Reporting:** Optional: SLA, uptime, or ticket reports.

---

## 4. Quick reference

| Goal | Action |
|------|--------|
| Billing 404s | Deploy backend to GCE; if SSH fails run manual step (see [DEPLOY_BACKEND_FALLBACK.md](../DEPLOY_BACKEND_FALLBACK.md), [fixes/BILLING_404_FIX.md](./fixes/BILLING_404_FIX.md)) |
| Stripe in portal | ✅ StripeCardForm on portal “Pay now”; set STRIPE_SECRET_KEY in production |
| Invoices & dunning | Schedule cron: see [BILLING_CRON_AND_DUNNING_SCHEDULE.md](./BILLING_CRON_AND_DUNNING_SCHEDULE.md); or use admin UI buttons |
| Field App in app | Build APK (see [FIELD_APP_DOWNLOAD.md](./FIELD_APP_DOWNLOAD.md)); set MOBILE_APP_DOWNLOAD_URL; dashboard 📱 link already present |
| End-user docs | ✅ /help and quick tips; operator docs in /docs and repo docs/ |
| All wizards in menu | ✅ Catalog and dropdown; /wizards hub; ?wizard=<id> |
| Optional work | See [OPTIONAL_ITEMS.md](./OPTIONAL_ITEMS.md) and [WHATS_MISSING_IN_APP.md](./WHATS_MISSING_IN_APP.md) |

---

**Single checklist:** See **docs/WHATS_MISSING_IN_APP.md** for one-page done vs remaining.

*Update this file as items are completed or priorities change.*
