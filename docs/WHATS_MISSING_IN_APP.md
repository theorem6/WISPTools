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

## High impact (do soon)

### Customer portal & billing
- **Stripe in portal:** Add Stripe Elements (card form) to portal billing “Pay now” so customers can pay; backend already has `create-payment-intent`.
- **Invoices & dunning automation:** Schedule `generate-invoices` and `dunning/run` (cron on GCE or Cloud Scheduler). Admin buttons exist; automation is missing.
- **Backend deploy:** Complete backend deploy to GCE so billing endpoints respond (upload already done; run remote install + pm2 via Cloud Shell if SSH from Windows failed).

### Help & docs
- **End-user docs only:** Remove or relocate operator-only content (Firebase/GCE/deployment) from `/help` and quick tips so staff/customers see only end-user content.
- **Doc Phase 2/3:** Frontmatter and link audit for in-app docs; optionally single entry “Documentation” → `/help`.

### Frontend polish
- **ModuleWizardMenu runtime error:** If “ModuleWizardMenu is not defined” still appears on Customers (or other pages), fix chunking/component registration so the wizards dropdown works everywhere.
- **Wizard dropdown:** Confirm all 19+ wizards are in the dropdown and each opens via `?wizard=<id>` correctly.

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

- **Live chat:** If portal has “Live Chat” enabled, add a real widget or mark “Coming soon.”
- **KB search/categories:** Portal FAQ/KB already load; add search or categories for large KBs.
- **Single doc entry:** Consider one “Documentation”/“Help” entry (e.g. always `/help`), retire duplicate `/docs` paths.
- **Backend automation:** Document or add “deploy backend on git push” (e.g. Cloud Build).
- **API_BASE_URL:** Confirm backend env has correct public API base URL for deployment/TR-069 URLs.
- **Reporting:** Optional SLA, uptime, or ticket reports.

---

## Quick reference

| Goal | Action |
|------|--------|
| Billing 404s | Deploy backend to GCE (see BILLING_404_FIX.md); complete remote install if SSH failed |
| Stripe in portal | Add Stripe Elements to portal “Pay now”; keep backend create-payment-intent |
| Invoices & dunning | Add cron/Cloud Scheduler for generate-invoices and dunning/run |
| ModuleWizardMenu error | If still occurring, fix component/chunk loading on Customers (and any other page) |
| End-user docs only | Remove/hide operator docs from /help and quick tips |
| Field App in app | Build APK → upload → add “Download Field App” link |
| All wizards in menu | Verify dropdown lists all wizards and ?wizard= opens correct one |

---

*Update this file as items are completed. See NEXT_STEPS_FOR_APP.md for full narrative.*
