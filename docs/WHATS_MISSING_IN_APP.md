---
title: What's Missing in the App
description: Single checklist of remaining work for WISPTools (from NEXT_STEPS_FOR_APP, NEXT_ITEMS_TO_ADD, implementation docs).
---

# What's Missing in the App

**Purpose:** One place to see what’s done vs what’s left.  
**Sources:** NEXT_STEPS_FOR_APP.md, NEXT_ITEMS_TO_ADD.md, implementation status docs.

---

## Already done (no action)

| Item | Status |
|------|--------|
| Auth redirect when logged out | Root layout redirects to `/login` when `!isAuthenticated` and not a public route |
| Help page CSS | `.help-container` and help styles live in `app.css`; theme variables used |
| ModuleWizardMenu on Customers | Import present; wizard id set to `customer-onboarding` for URL consistency |
| Generate invoices / dunning endpoints | Backend routes exist; **deploy backend to GCE** so 404s go away (see docs/fixes/BILLING_404_FIX.md) |
| Customer portal: branding, tickets, FAQ/KB | Implemented; portal routes, tickets→work orders, published FAQ/KB |
| Wizards (19+) | All implemented; wizard catalog and dropdown aligned; Customers module uses customer-onboarding |
| **Stripe in portal** | **Done.** Stripe Elements card form in portal billing “Pay now”; `StripeCardForm.svelte` + `@stripe/stripe-js`; publishable key from portal branding |
| **Invoices & dunning automation** | **Doc added.** See `docs/BILLING_CRON_AND_DUNNING_SCHEDULE.md` for cron and Cloud Scheduler options |
| **Field App download link** | **Done.** Dashboard header has 📱 link using `API_CONFIG.MOBILE_APP_DOWNLOAD_URL` |
| **End-user docs only** | **Done.** Help page “Cloud Backend” text no longer mentions Firebase/GCE |
| **Browser notifications** | **Done.** NotificationCenter uses Notification API and requests permission |

---

## High impact (do soon) – completed

### Customer portal & billing ✅
- **Stripe in portal:** ✅ Stripe Elements (StripeCardForm.svelte) on portal billing “Pay now”; backend create-payment-intent.
- **Invoices & dunning automation:** ✅ Doc `docs/BILLING_CRON_AND_DUNNING_SCHEDULE.md`; internal route `POST /api/internal/cron/billing`; cron script `backend-services/scripts/cron-billing.sh`.
- **Backend deploy:** Use `deploy-backend-to-gce.ps1`; if SSH fails, run manual `gcloud compute ssh …` (see DEPLOY_BACKEND_FALLBACK.md).
- **Portal route polish:** ✅ “Back to Dashboard” on service, FAQ, and KB (and when feature disabled).

### Help & docs ✅
- **End-user docs only:** ✅ Help page no longer exposes operator-only content.
- **Doc Phase 2/3:** ✅ Frontmatter on key docs; in-app /docs, /help, project status. Optional: more frontmatter, link audit.

### Frontend polish ✅
- **ModuleWizardMenu:** Wizards dropdown and catalog aligned; Customers and other modules use getWizardsForPath.
- **Wizard dropdown:** All 19+ wizards in catalog; `/wizards` hub and module menus open correct wizard via `?wizard=<id>`.

---

## Medium impact (next)

### Field App
- Build Android APK (`wisp-field-app/`), upload to Storage/GCE, add a “Download Field App” link on dashboard or a module.

### ACS
- Every ACS function has a clear menu item or entry in ACS CPE Management.

### Notifications
- Notification center uses browser Notification API (with user permission) for new alerts.

---

## Lower priority / optional

- **Live chat:** ✅ Portal “Live Chat” shows “Coming soon” placeholder when enabled.
- **KB search/categories:** ✅ Portal FAQ and KB have search input; categories in data.
- **Single doc entry:** Optional: one “Documentation”/“Help” entry; currently /docs and /help both available.
- **Backend automation:** ✅ GitHub Actions deploy-backend-gce.yml; DEPLOY_BACKEND_FALLBACK.md for manual step.
- **API_BASE_URL:** ✅ Documented in backend-services/.env.example and docs/deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md, DEPLOY_BACKEND_FALLBACK.md.
- **Reporting:** Optional SLA, uptime, or ticket reports.

---

## Quick reference

| Goal | Action |
|------|--------|
| Billing 404s | Deploy backend to GCE; if SSH failed run manual step (see [DEPLOY_BACKEND_FALLBACK.md](../DEPLOY_BACKEND_FALLBACK.md), [fixes/BILLING_404_FIX.md](./fixes/BILLING_404_FIX.md)) |
| Stripe in portal | ✅ StripeCardForm on portal “Pay now”; set STRIPE_SECRET_KEY in production |
| Invoices & dunning | Schedule cron: see [BILLING_CRON_AND_DUNNING_SCHEDULE.md](./BILLING_CRON_AND_DUNNING_SCHEDULE.md); or use admin UI buttons |
| Field App in app | Build APK (see [FIELD_APP_DOWNLOAD.md](./FIELD_APP_DOWNLOAD.md)); set MOBILE_APP_DOWNLOAD_URL; dashboard 📱 link present |
| End-user docs | ✅ /help and quick tips; operator docs in /docs and repo docs/ |
| All wizards in menu | ✅ Catalog and dropdown; /wizards hub; ?wizard=<id> |
| **Optional work** | See [OPTIONAL_ITEMS.md](./OPTIONAL_ITEMS.md) for full list of optional items |
| **Full doc index** | See [docs/README.md](./README.md) for status, operational setup, and full index |

---

*Update this file as items are completed. See NEXT_STEPS_FOR_APP.md for full narrative.*
