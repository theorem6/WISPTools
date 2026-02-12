---
title: Backend & Integration Notes
description: Intentional stubs, TODOs, and integration points for backend and Firebase Functions.
---

# Backend & Integration Notes

This document describes intentional stubs, TODOs, and integration points for backend and Firebase Functions.

---

## GenieACS in Firebase Functions

### Placeholder services (intentionally stubbed)

The file **`functions/src/simpleGenieacsServices.ts`** (and compiled `functions/lib/simpleGenieacsServices.js`) defines **placeholder** HTTP endpoints:

- `genieacsCWMP` – CWMP (TR-069) service placeholder  
- `genieacsNBI` – Northbound Interface placeholder  
- `genieacsFS` – Frontend Service placeholder  
- `genieacsUI` – UI service placeholder  

These are **intentionally stubbed**. They return a success payload with a note that full functionality requires MongoDB/GenieACS integration. They are **not** exported in the current `functions/src/index.ts` (that block is commented out).

### Production GenieACS integration

Production uses:

- **`genieacsBridgeMultitenant.ts`** – Proxies to a real GenieACS NBI; syncs devices, gets parameters, executes tasks.  
- **`genieacsServicesMultitenant.ts`** – NBI and FS endpoints backed by GenieACS MongoDB when `GENIEACS_NBI_URL` (or tenant-specific URL) is configured.

To enable full ACS in production:

1. Deploy and configure a GenieACS instance (NBI URL, optional MongoDB).  
2. Set `GENIEACS_NBI_URL` (or tenant-specific URLs) in Firebase Functions config / environment.  
3. Use the multi-tenant exports from `index.ts`: `proxyGenieACSNBIMultitenant`, `syncGenieACSDevicesMultitenant`, `handleCWMPMultitenant`, `getDeviceParametersMultitenant`, `executeDeviceTaskMultitenant`, `genieacsNBIMultitenant`, `genieacsFSMultitenant`.

---

## CBRS SAS API (Google Spectrum Access System)

**Location:** `functions/src/cbrsManagement.ts`

The code **does** call the real **Google SAS Portal API**:

- **User IDs:** `getSASUserIDs` calls `https://sasportal.googleapis.com/v1alpha1/customers` and `v1/customers` with the user’s OAuth token.  
- When the API returns `response.ok`, the real customer list is parsed and returned.  
- **Fallback:** When the API call fails (e.g. 4xx/5xx, wrong scope, or endpoint not yet confirmed), the function returns **sample/stub data** so the UI can still be used. The in-code TODOs (“Replace with actual Google SAS API call when endpoint is confirmed”) refer to **removing or narrowing this fallback** once the correct SAS Portal endpoint and OAuth scopes are confirmed for your environment.

To rely fully on the real API:

1. Ensure the Google account used for CBRS has SAS Portal access and the correct OAuth scopes (e.g. `https://www.googleapis.com/auth/sasportal`).  
2. Use the same API URLs or update them per [Google SAS Portal API](https://developers.google.com/spectrum-access-system).  
3. When the real API is stable, remove or restrict the fallback stub response so only real API data is returned.

---

## GenieACS integration – device metrics (bandwidth, latency, packet loss)

**Location:** `functions/src/genieacsIntegration.ts` (e.g. in `convertGenieACSDeviceToCPE`)

Performance metrics are currently:

- **`bandwidth`:** `0` – TODO: derive from GenieACS/device traffic stats (e.g. WAN byte counters, throughput parameters) when available.  
- **`latency`:** `0` – TODO: implement ping-based or NBI-based latency measurement.  
- **`packetLoss`:** `0` – TODO: derive from device error/drop stats when exposed via GenieACS parameters.

These fields are left as zero until:

1. GenieACS (or the CPE) exposes the relevant parameters (e.g. traffic, errors), or  
2. A separate ping/latency service is integrated and the result is stored or passed into this conversion.

No stub API is used here; the integration is intentionally minimal until data sources are defined.

---

## Provisions and presets – `createdBy` from auth context

**Locations:**

- `functions/src/provisionsManagement.ts` – create/update provision  
- `functions/src/presetsManagement.ts` – create/update preset  

Previously, `createdBy` was set to `'system'` when creating provisions/presets via HTTP. It is now set from the **auth context** when possible:

- The handler reads the `Authorization: Bearer <token>` header.  
- It verifies the Firebase ID token and uses `decodedToken.uid` as `createdBy`.  
- If no valid token is present, it falls back to `'system'`.

This applies to the Firebase Functions that use `onRequest` and accept a Bearer token; callers must send the Firebase ID token in the `Authorization` header for correct attribution.
