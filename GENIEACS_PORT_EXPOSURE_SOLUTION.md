# GenieACS Port Exposure Solution

## Problem

GenieACS services are running inside the Firebase App Hosting container on:
- Port 7547 (CWMP)
- Port 7557 (NBI)
- Port 7567 (FS)
- Port 3000 (UI)

But Firebase App Hosting only exposes **port 8080** externally.

## Solution: Use SvelteKit API Routes as Proxies

Since we're already using SvelteKit, we can create API routes that proxy to the internal GenieACS ports.

### Architecture:

```
External World
     ↓
Firebase App Hosting (Port 8080 only)
     ↓
SvelteKit API Routes
     ↓
GenieACS Services (localhost:7547, 7557, 7567, 3000)
```

### Implementation:

Already created at this commit:
- ✅ `/api/genieacs/*` routes proxy to GenieACS NBI (7557)
- ✅ Services accessible via: `https://your-app.web.app/api/genieacs/*`

### For CPE Devices (CWMP Port 7547):

CPE devices need to connect to TR-069 endpoint. Options:

#### Option 1: Use Firebase Functions (Recommended)
Already configured in your Functions:
- `genieacsCWMP` function at: `https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/genieacsCWMP`

CPE devices should connect to this URL.

#### Option 2: Cloud Run for GenieACS
Deploy GenieACS to Cloud Run where you can expose specific ports.

## Current Setup

Your configuration already points to Firebase Functions:
```yaml
PUBLIC_GENIEACS_CWMP_URL: "https://...cloudfunctions.net/genieacsCWMP"
PUBLIC_GENIEACS_NBI_URL: "https://...cloudfunctions.net/genieacsNBI"
```

This means GenieACS is meant to run via Firebase Functions, not in the App Hosting container.

## Recommendation

Services showing as "online" in the admin panel means the internal health checks are working, but:

1. **For production use**: Deploy GenieACS to Cloud Run (can expose any port)
2. **For current setup**: Use the Firebase Functions already configured
3. **CPE devices**: Point them to the Firebase Functions URLs

The services are running but not directly accessible externally by design (security).

