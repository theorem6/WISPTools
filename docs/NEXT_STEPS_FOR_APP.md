# Next Steps for WISPTools

**Purpose:** Prioritized, actionable list of what to complete next for the app.  
**Audience:** Product/development. Update this as items are done.

---

## 1. High impact (do soon)

### 1.1 Customer portal – finish & harden
- **Billing Portal Admin:** Already added (Portal setup → Billing Portal tab: Stripe/PayPal, invoice customization). Ensure backend is deployed so `branding.billingPortal` is saved/loaded.
- **Stripe/PayPal in portal:** Backend has `POST /api/customer-portal/billing/create-payment-intent` (needs `STRIPE_SECRET_KEY`). Add Stripe Elements (card form) on the portal billing “Pay now” flow so customers can pay without leaving the app.
- **Dunning automation:** Backend has `POST /api/customer-billing/dunning/run`. Run it on a schedule (cron or Cloud Scheduler) so overdue reminders and suspension run automatically.
- **Invoice generation:** Backend has `POST /api/customer-billing/generate-invoices`. Trigger it (cron or admin button) so invoices are created from billing cycles.

### 1.2 Help/docs for end users
- **Remove operator-only docs from end-user help:** Per your note, remove or relocate Firebase/GCE/deployment docs from what customers and WISP staff see. Keep only end-user–facing content at `/help` and in quick tips.
- **Doc system plan (Phase 2/3):** Finish frontmatter and link audit for in-app docs; optionally complete VitePress docs-site wiring and deployment so “Documentation” points to a single, consistent experience.

### 1.3 Frontend – fix and polish
- **ModuleWizardMenu error:** Resolve “ModuleWizardMenu is not defined” on Customers page (add missing import or component registration) so the wizards dropdown works.
- **Auth redirect:** Done. Root layout redirects to `/login` when `!isAuthenticated` and not a public route.
- **Help page CSS:** Done. `/help` uses `.help-container` and theme vars from `app.css`; in-app nav used.

---

## 2. Medium impact (next)

### 2.1 Wizards and navigation
- **Wizard pulldown:** Ensure all wizards (19+) are listed in the Wizards dropdown and that each entry opens the correct wizard (e.g. `?wizard=...` + module handling).
- **ACS menu:** Ensure every ACS function has a clear menu item or entry point in the ACS CPE Management module.

### 2.2 Mobile Field App
- **Build:** Compile the latest Android app (see `wisp-field-app/` and any RELEASE_BUILD or BUILD instructions).
- **Host APK:** Upload the built APK to Firebase Storage or GCE (or existing host) and get a stable download URL.
- **Download link:** Add a prominent “Download Field App” (or similar) link on the main app (e.g. dashboard or a module page) that points to that URL. Quick tips already mention the Field App; the link should work.

### 2.3 Notifications and UX
- **Browser notifications:** Ensure the notification center requests and uses the browser’s notification API (with user approval) for new alerts so users get system-level notifications when appropriate.

---

## 3. Lower priority / optional

### 3.1 Documentation system
- **DOCUMENTATION_SYSTEM_PLAN:** Execute Phase 1 cleanup (remove or archive temporary scripts per the plan), then continue Phase 2 (structure, frontmatter, links).
- **Single doc entry:** Consider making “Documentation” or “Help” a single entry (e.g. always `/help`) and removing duplicate or legacy paths (e.g. `/docs`) so there’s one place for end-user docs.

### 3.2 Backend and ops
- **Backend deploy:** If not already automated, document or add a simple “deploy backend on git push” (e.g. Cloud Build or GCE startup script pulling from GitHub). Use `GOOGLE_APPLICATION_CREDENTIALS` or a service account for Firebase deploy instead of deprecated `--token` where possible.
- **API_BASE_URL:** Confirm backend env has the correct public API base URL for deployment/TR-069 photo and firmware URLs.

### 3.3 Customer portal – extras
- **Live chat:** If “Live Chat” is enabled in portal features, implement or plug in a real chat widget; otherwise keep it hidden or clearly “Coming soon.”
- **Knowledge base:** Portal already loads FAQ/KB from portal-content; optionally add search or categories for large KBs.

### 3.4 Monitoring and reporting
- **Advanced alerting:** Optional improvements to monitoring alert rules and escalation.
- **Reporting:** Optional SLA, uptime, or ticket reports for help desk and management.

---

## 4. Quick reference

| Goal | Action |
|------|--------|
| Fix Customers page crash | Fix `ModuleWizardMenu` import/usage on Customers page |
| Fix help page styling | Done – global CSS and theme vars in app.css |
| Redirect when logged out | Done – root layout redirects to /login |
| Billing 404s | Deploy backend to GCE; complete remote install if SSH failed (see docs/fixes/BILLING_404_FIX.md) |
| Stripe in portal | Add Stripe Elements to portal billing “Pay now”; keep backend create-payment-intent |
| Invoices & dunning | Schedule or trigger generate-invoices and dunning/run |
| Field App in app | Build APK → upload → add download link on main app |
| End-user docs only | Remove/hide Firebase, GCE, deployment docs from /help and quick tips |
| All wizards in menu | List all wizards in dropdown and fix open-by-id behavior |

---

**Single checklist:** See **docs/WHATS_MISSING_IN_APP.md** for one-page done vs remaining.

*Update this file as items are completed or priorities change.*
