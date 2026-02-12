---
title: Billing automation – invoice generation and dunning
description: How to schedule generate-invoices and dunning/run (cron or Cloud Scheduler).
---

# Billing automation: invoice generation and dunning

The backend exposes:

- **POST /api/customer-billing/generate-invoices** – creates invoices for billing records where `nextBillingDate` has passed.
- **POST /api/customer-billing/dunning/run** – processes overdue invoices (reminders, suspension after threshold).

Both require **X-Tenant-ID** and (via apiProxy) **Authorization: Bearer \<token\>**. For scheduled runs you typically use an **internal key** or a **service account** so the caller is trusted.

---

## Option 1: Cron on GCE (same server as backend)

On the GCE instance where the backend runs, you can run a script that calls the backend with an internal key.

### 1. Internal key

Ensure the backend has **INTERNAL_API_KEY** set (same value the apiProxy Cloud Function uses). The script will send this in a header the backend accepts for internal cron routes.

### 2. Internal cron route (recommended)

The backend has **POST /api/internal/cron/billing** that accepts **x-internal-key** and optionally **X-Tenant-ID**. If **X-Tenant-ID** is omitted, it runs generate-invoices and dunning for **all tenants**. Use the script on GCE:

**Script:** `backend-services/scripts/cron-billing.sh`. It reads **INTERNAL_API_KEY** from the environment or, if not set, from a `.env` file (script tries `../../.env` relative to the script, i.e. repo root). If your `.env` is in `backend-services/`, either export **INTERNAL_API_KEY** in the crontab or ensure the script can read it (e.g. `source /opt/lte-pci-mapper/backend-services/.env` before running).

```bash
# On GCE, ensure INTERNAL_API_KEY is in backend .env (or export in crontab), then:
/opt/lte-pci-mapper/backend-services/scripts/cron-billing.sh
```

Crontab (run daily at 00:05):

```cron
5 0 * * * /opt/lte-pci-mapper/backend-services/scripts/cron-billing.sh
```

**Setup script:** From repo root on GCE, run `./scripts/setup-billing-cron.sh` to add or update the crontab entry automatically. See [scripts/setup-billing-cron.sh](../scripts/setup-billing-cron.sh).

### 3. Cron job calling the public API

If the backend does not have an internal cron route, use a script that:

1. Gets a token (e.g. Firebase custom token for a service user, or another auth that apiProxy accepts), or
2. Calls the backend **directly on localhost** (bypassing apiProxy) if the cron runs on the same machine.

**Direct localhost (same server as backend):**

```bash
# Generate invoices (run daily, e.g. at 00:05)
curl -s -X POST http://127.0.0.1:3001/api/customer-billing/generate-invoices \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"

# Dunning (run daily, e.g. at 01:00)
curl -s -X POST http://127.0.0.1:3001/api/customer-billing/dunning/run \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: YOUR_TENANT_ID"
```

You must either add middleware that allows these paths when **x-internal-key** is set (and no tenant filter), or run one request per tenant with a valid tenant ID.

**Crontab example (one tenant):**

```cron
5 0 * * * curl -s -X POST http://127.0.0.1:3001/api/customer-billing/generate-invoices -H "Content-Type: application/json" -H "X-Tenant-ID: YOUR_TENANT_ID"
0 1 * * * curl -s -X POST http://127.0.0.1:3001/api/customer-billing/dunning/run -H "Content-Type: application/json" -H "X-Tenant-ID: YOUR_TENANT_ID"
```

---

## Option 2: Google Cloud Scheduler + Cloud Functions / HTTP

1. Create a Cloud Function (or a small HTTP service) that:
   - Verifies a secret (e.g. Cloud Scheduler OIDC or a shared secret).
   - Calls the backend at `https://hss.wisptools.io/api/customer-billing/generate-invoices` and `.../dunning/run` with the required headers (e.g. **X-Tenant-ID**, and either **Authorization** or an internal key if the backend supports it).

2. Create two Cloud Scheduler jobs (e.g. daily):
   - One that triggers the “generate-invoices” HTTP target.
   - One that triggers the “dunning” HTTP target.

3. Ensure the backend accepts requests from the Cloud Function (e.g. by checking **x-internal-key** or by using a service account token that apiProxy accepts).

---

## Option 3: Admin UI only (no schedule)

The Module_Manager **Customers → Billing** tab has **Generate invoices** and **Run dunning** buttons. Staff can run these manually. No cron or Cloud Scheduler is required; automation is optional.

---

## Summary

| Method | Pros | Cons |
|--------|------|------|
| Cron on GCE (localhost) | Simple, no extra services | Per-tenant or internal route needed; runs on one server |
| Cloud Scheduler + HTTP | Managed, multi-region | Need a callable HTTP endpoint and auth (internal key or token) |
| Admin UI only | No setup | Manual; not suitable for daily automation |

For a single-tenant or small setup, cron on GCE with **X-Tenant-ID** (and optional **x-internal-key** route) is the simplest. For multi-tenant or fully managed scheduling, use Cloud Scheduler and a small HTTP/Cloud Function that calls the backend with the appropriate headers.
