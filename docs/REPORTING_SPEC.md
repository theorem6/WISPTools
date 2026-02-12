---
title: Reporting – SLA, Uptime, Ticket Reports (Spec)
description: Specification for optional reporting features. Not yet implemented.
---

# Reporting – SLA, Uptime, Ticket Reports (Spec)

Optional reporting features for WISPTools. **Status: Not implemented.** This document describes what would be needed.

---

## SLA Reports

**Purpose:** Show SLA compliance (e.g. response time, resolution time vs targets).

**Data needed:**
- Ticket created/resolved timestamps
- SLA targets per tenant (e.g. "respond within 4h", "resolve within 48h")
- Optional: ticket priority, category

**Backend:**
- `GET /api/reports/sla` – query params: `tenantId`, `startDate`, `endDate`
- Returns: compliance rate, average response/resolution times, breaches

**UI:**
- Reports page or Customers → Reports tab
- Date range picker, tenant filter
- Table/chart: compliance %, by priority, by period

---

## Uptime Reports

**Purpose:** Show uptime/downtime for monitored devices or sites.

**Data needed:**
- Monitoring/health check history (e.g. from GenieACS, SNMP, or custom checks)
- Site/device identifiers
- Timestamps of up/down events

**Backend:**
- `GET /api/reports/uptime` – query params: `tenantId`, `siteId` or `deviceId`, `startDate`, `endDate`
- Returns: uptime %, downtime incidents, MTTR

**UI:**
- Reports page with site/device selector
- Uptime % gauge, incident list, timeline

---

## Ticket Reports

**Purpose:** Ticket volume, resolution time, backlog.

**Data needed:**
- Tickets from customer portal (Firestore or backend)
- Created, updated, closed timestamps
- Status, priority, assignee

**Backend:**
- `GET /api/reports/tickets` – query params: `tenantId`, `startDate`, `endDate`, `groupBy` (day/week/month)
- Returns: counts by status, resolution time stats, volume over time

**UI:**
- Reports page
- Charts: tickets created vs resolved, avg resolution time, backlog trend

---

## Implementation Order

1. **Ticket reports** – Easiest if ticket data already exists in Firestore/backend.
2. **SLA reports** – Depends on ticket data + SLA target configuration.
3. **Uptime reports** – Depends on monitoring data being stored and queryable.

---

## Related

- [OPTIONAL_ITEMS.md](./OPTIONAL_ITEMS.md) – Reporting listed under "Reporting (later)"
- [guides/MONITORING_AND_ALERTING.md](./guides/MONITORING_AND_ALERTING.md) – Monitoring data sources
