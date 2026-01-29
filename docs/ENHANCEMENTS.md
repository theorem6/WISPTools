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

---

## High value

1. **CBRS config encryption**  
   `configService.ts` has a TODO for proper encryption of CBRS config (e.g. via Firebase Functions or KMS).

2. **CPE performance data**  
   `CPEPerformanceModal.svelte` uses placeholder data; replace with real API for device performance.

---

## UX / polish

3. **Keyboard navigation**  
   Ensure Wizards and Settings are focusable in a logical order (already tabindex/role; optional: focus trap in modals).

---

## Optional / later

6. **Push or email on project approval**  
   Cloud Function (e.g. SendGrid) to notify assignee when a plan is approved (see PROJECT_WORKFLOW_STATUS §4).

7. **ACS parameter editor**  
   REFACTOR_SUMMARY mentions a TODO for a parameter editor in ACS/CPE management.

8. **Hardware module**  
    EPC edit field is readonly/disabled; consider allowing edit when appropriate or clarifying why it’s fixed.

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
