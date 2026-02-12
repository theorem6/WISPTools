---
title: Optional Items – Remaining Work
description: All optional and polish items; no blocking work. Reference for future enhancements.
---

# Optional Items – Remaining Work

All high- and medium-priority work is complete. This document lists **optional** items only. Nothing here is required for the app to function.

---

## Documentation

| Item | Details | Doc |
|------|---------|-----|
| More frontmatter | Add `title`/`description` to more files in `docs/` | [DOCUMENTATION_PLAN_SUMMARY.md](./DOCUMENTATION_PLAN_SUMMARY.md) |
| Link audit | Script: `scripts/check-docs-links.cjs` checks internal links in `docs/` | Run: `node scripts/check-docs-links.cjs` |
| Code examples / diagrams | Mermaid + curl example in [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) | [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) |
| Single doc entry | Done “Documentation” entry (e.g. `/help` only) Done: Help is main entry; Help links to /docs; /docs links to /help. | — |

---

## Customer Portal

| Item | Details | Doc |
|------|---------|-----|
| Live chat integration | Done: Portal Setup → Features → Live Chat embed code (Tawk.to, Crisp, etc.). Widget injects when enabled | [CUSTOMER_PORTAL_ACCESS_AND_PAGES.md](./CUSTOMER_PORTAL_ACCESS_AND_PAGES.md) |
| KB search enhancements | Done: portal KB has category filter dropdown when articles have category; search filters by title, content, category. | — |

---

## ACS / CPE Management

| Item | Details | Doc |
|------|---------|-----|
| Alert email/SMS | ✅ Documented: see [guides/MONITORING_AND_ALERTING.md](./guides/MONITORING_AND_ALERTING.md) section "Alert email/SMS integration" (SendGrid/SMS, backend notify helper). TR-069 alerts can use same pattern. | [ACS_FINAL_COMPLETION.md](./ACS_FINAL_COMPLETION.md), [guides/MONITORING_AND_ALERTING.md](./guides/MONITORING_AND_ALERTING.md) |
| Device grouping/tags | Done: Device tags (backend `DeviceTag` model, GET/PUT device-tags, filter + edit in device list). | — |
| Task queue UI | Done: GET /api/tr069/tasks + Task Queue page under ACS CPE Management. | — |

---

## Monitoring & Map

| Item | Details | Doc |
|------|---------|-----|
| Advanced alerting | ✅ Documented: see [guides/MONITORING_AND_ALERTING.md](./guides/MONITORING_AND_ALERTING.md) section "Advanced alerting and escalation" (escalation policy, more rules, coverage map badges). | [guides/MONITORING_AND_ALERTING.md](./guides/MONITORING_AND_ALERTING.md) |
| Coverage map badges | Documented: backend can expose alert counts per site/device; map can call API and render badge. See same section in MONITORING_AND_ALERTING. | — |

---

## Field App

| Item | Details | Doc |
|------|---------|-----|
| Branded app icon | ✅ Documented: see [FIELD_APP_DOWNLOAD.md](./FIELD_APP_DOWNLOAD.md) section "Branded app icon" (assets, Android res paths, rebuild, ICON_BRANDING.md). | [FIELD_APP_DOWNLOAD.md](./FIELD_APP_DOWNLOAD.md), wisp-field-app docs |

---

## Backend / Ops

| Item | Details | Doc |
|------|---------|-----|
| Billing cron schedule | Setup script: `./scripts/setup-billing-cron.sh` on GCE adds crontab. Or add manually per doc. | [BILLING_CRON_AND_DUNNING_SCHEDULE.md](./BILLING_CRON_AND_DUNNING_SCHEDULE.md) |
| Field App URL | APK in `Module_Manager/static/downloads/wisp-field-app.apk`; `MOBILE_APP_DOWNLOAD_URL` = `/downloads/wisp-field-app.apk`. Rebuild APK when updating. | [FIELD_APP_DOWNLOAD.md](./FIELD_APP_DOWNLOAD.md) |

---

## Reporting (later)

| Item | Details | Doc |
|------|---------|-----|
| SLA reports | Optional SLA compliance reports – not implemented | [REPORTING_SPEC.md](./REPORTING_SPEC.md) |
| Uptime reports | Optional uptime/downtime reports – not implemented | [REPORTING_SPEC.md](./REPORTING_SPEC.md) |
| Ticket reports | Optional ticket volume/resolution reports – not implemented | [REPORTING_SPEC.md](./REPORTING_SPEC.md) |

---

## Related docs

- **Status and planning:** [WHERE_WE_ARE_AND_NEXT_STEPS.md](./WHERE_WE_ARE_AND_NEXT_STEPS.md), [NEXT_ITEMS_TO_ADD.md](./NEXT_ITEMS_TO_ADD.md), [WHATS_MISSING_IN_APP.md](./WHATS_MISSING_IN_APP.md)
- **In-app:** Dashboard → 📖 Help, or go to `/docs` and `/docs/reference/project-status`

**Last updated:** January 2026
