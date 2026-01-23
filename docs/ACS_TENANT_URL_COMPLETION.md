# ACS Multi-Tenant URL Completion

## Summary
Completed the ACS implementation with proper tenant-specific CWMP URLs. Each tenant now has a unique URL for device connections.

## Changes Made

### Backend Changes (`backend-services/routes/tr069.js`)
1. **Updated `/api/tr069/configuration` GET endpoint**:
   - Now generates tenant-specific CWMP URL: `https://wisptools.io/cwmp/{tenant-subdomain}`
   - Returns both `cwmpUrl` and `genieacsApiUrl` in configuration response

2. **Updated `/api/tr069/configuration` POST endpoint**:
   - Automatically generates tenant-specific CWMP URL if not provided
   - Updates tenant's `cwmpUrl` field in database
   - Stores GenieACS API URL in tenant settings

### Tenant Creation Updates
1. **`backend-services/routes/tenants.js`**:
   - Updated to generate CWMP URL: `https://wisptools.io/cwmp/{subdomain}`

2. **`backend-services/routes/admin/tenants.js`**:
   - Updated to generate CWMP URL: `https://wisptools.io/cwmp/{subdomain}`

### Firebase Functions (`firebase.json`)
1. **Added CWMP routing**:
   - Added rewrite rule: `/cwmp/**` → `handleCWMPMultitenant` function
   - Enables tenant-specific CWMP endpoints: `https://wisptools.io/cwmp/{tenant-subdomain}`

### Frontend Changes (`Module_Manager/src/routes/modules/acs-cpe-management/settings/+page.svelte`)
1. **Enhanced ACS Settings Page**:
   - Fetches tenant-specific CWMP URL from backend API
   - Displays CWMP URL with copy button
   - Shows GenieACS NBI API URL if configured
   - Improved styling for URL display

### Code Cleanup (`functions/src/index.ts`)
1. **Deprecated single-tenant exports**:
   - Commented out single-tenant GenieACS functions (kept for backward compatibility)
   - Documented that multi-tenant versions should be used

## Tenant-Specific URL Format

Each tenant gets a unique CWMP URL:
```
https://wisptools.io/cwmp/{tenant-subdomain}
```

Example:
- Tenant subdomain: `acme-wireless`
- CWMP URL: `https://wisptools.io/cwmp/acme-wireless`

## How It Works

1. **Device Connection**:
   - CPE device connects to tenant-specific URL: `https://wisptools.io/cwmp/{subdomain}`
   - Firebase Hosting routes `/cwmp/**` to `handleCWMPMultitenant` function
   - Function extracts tenant ID from URL path
   - Request is forwarded to GenieACS CWMP server with tenant context

2. **Tenant Isolation**:
   - Each tenant's devices connect to their unique URL
   - GenieACS filters devices by `_tenantId` metadata
   - Backend API enforces tenant isolation via `X-Tenant-ID` header

3. **Configuration Management**:
   - Backend automatically generates CWMP URL when tenant is created
   - URL is stored in tenant's `cwmpUrl` field
   - Frontend fetches and displays URL in ACS Settings page

## Deployment Checklist

- [x] Backend API endpoints updated
- [x] Tenant creation updated
- [x] Firebase Functions routing configured
- [x] Frontend settings page updated
- [x] Code cleanup completed
- [ ] Deploy backend to GCE
- [ ] Deploy Firebase Functions
- [ ] Deploy frontend to Firebase Hosting
- [ ] Test tenant-specific URLs
- [ ] Verify device connections work

## Testing

1. **Create a new tenant**:
   - Verify CWMP URL is generated correctly
   - Format: `https://wisptools.io/cwmp/{subdomain}`

2. **View ACS Settings**:
   - Navigate to ACS CPE Management → Settings
   - Verify CWMP URL is displayed
   - Test copy button functionality

3. **Device Connection**:
   - Configure CPE device with tenant's CWMP URL
   - Verify device connects and appears in tenant's device list
   - Verify other tenants cannot see this device

## Environment Variables

Backend should have:
- `CWMP_BASE_URL` or `PUBLIC_CWMP_BASE_URL` (defaults to `https://wisptools.io`)

## Notes

- Single-tenant GenieACS functions are deprecated but kept for backward compatibility
- All new implementations should use multi-tenant versions
- CWMP URLs are automatically generated and cannot be manually overridden (for consistency)
