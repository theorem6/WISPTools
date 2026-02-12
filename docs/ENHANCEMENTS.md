---
title: WISPTools – Further Enhancements
description: Prioritized list of improvements; items marked Done are already implemented.
---

# WISPTools – Further Enhancements

Prioritized list of improvements you can tackle next. Items marked **Done** are already implemented.

---

## Done (this pass)

- **Wizards button** – Button with wizard icon to the left of Settings on dashboard (no card).
- **Notifications apiProxy** – Path from `?path=` and `req.query.path` so `/api/notifications` and `/count` no longer 400 when called via Cloud Function URL.
- **NotificationCenter** – `loadError` store + error state and Retry button in the panel (used when the service throws, e.g. network).
- **Header buttons a11y** – Wizards and Settings buttons have `aria-label` and `type="button"`.
- **Notifications: surface 400 as retry** – `notificationService` now throws on 400/5xx so the store sets `loadError` and the user sees “Couldn’t load” + Retry.
- **GlobalSettings backend persistence** – Backend `GET/PUT /api/tenant-settings` (tenant-scoped); frontend `tenantSettingsService` + GlobalSettings load/save from API with localStorage fallback.
- **NotificationCenter: retry when empty** – Subtle “Retry” button when list is empty (no error) so users can re-fetch.
- **Dashboard / module cards a11y** – Module and admin cards have `aria-label="Open {name}. {description}"`.
- **Keyboard: Escape** – NotificationCenter panel closes on Escape.
- **CBRS config encryption** – Firebase callables saveCbrsConfigSecure / loadCbrsConfigSecure (AES-256-GCM); set CBRS_CONFIG_ENCRYPTION_KEY in Functions config.
- **CPE performance data** – CPEPerformanceModal calls getDeviceParameters and maps TR-069 params to performance data; fallback to device metrics on error.
- **Keyboard navigation** – Focus trap and Tab cycle in GlobalSettings and NotificationCenter; Escape closes; panel gets role="dialog" and focus on open.
- **Push or email on project approval** – onNotificationCreated sends SendGrid email and FCM push when a project_approved notification is created.
- **ACS parameter editor** – ParameterEditorModal in TR069Actions; Edit Parameters button; POST setParameterValues via /api/tr069/tasks.
- **Hardware module EPC** – EPC ID kept readonly/auto-generated per product decision; no further change unless requirements change.

---

## High value (future)

1. **Customer Portal MVP** – ✅ **Done.** Branding schema + UI (Portal Setup), ticket wiring (tickets → work orders), billing (Stripe/PayPal in portal, invoice list, dunning cron), route polish (dashboard, billing, tickets, FAQ, KB, service status, live-chat placeholder). Optional later: live chat integration, KB search enhancements.

---

## UX / polish (future)

2. **Optional focus trap** – Additional modals could use focus trap if needed.

---

## Optional / later

3. **Monitoring/Map** – Connection topology drawing, advanced alerting rules, predictive analytics.
4. **Field app** – Branded app icon (see ICON_BRANDING.md).

---

## Quick reference – key files

| Area              | File(s) |
|-------------------|--------|
| Notifications API | `Module_Manager/src/lib/services/notificationService.ts` |
| Notifications UI | `Module_Manager/src/lib/components/common/NotificationCenter.svelte`, `notificationStore.ts` |
| apiProxy path     | `functions/src/index.ts` (apiProxy handler) |
| Wizards / Settings | `Module_Manager/src/lib/components/SettingsButton.svelte` |
| GlobalSettings   | `Module_Manager/src/lib/components/GlobalSettings.svelte`, `tenantSettingsService.ts` |
| Tenant settings API | `backend-services/routes/tenant-settings.js` |
| CBRS config      | `Module_Manager/src/routes/modules/cbrs-management/lib/services/configService.ts` |
| CPE performance   | `Module_Manager/src/lib/components/acs/CPEPerformanceModal.svelte` |
