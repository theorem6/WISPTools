# Delete ACS/TR-069 Devices for Peterson Consulting

This script deletes all ACS/TR-069 devices from GenieACS for the "Peterson Consulting" tenant.

## Option 1: Via Backend API (Recommended)

The backend now has a DELETE endpoint at `/api/tr069/devices` that will delete all devices for a tenant.

### On GCE Server:

```bash
# SSH to the GCE server
ssh your-user@136.112.111.167

# Navigate to backend-services
cd /path/to/backend-services

# Run the script (it will call the local backend)
node scripts/delete-tenant-acs-via-api.js
```

### Or use curl directly:

```bash
curl -X DELETE https://136.112.111.167:3001/api/tr069/devices \
  -H "X-Tenant-ID: 690abdc14a6f067977986db3" \
  -H "Content-Type: application/json"
```

## Option 2: Direct MongoDB Script

If the API approach doesn't work, you can run the MongoDB script directly on the server:

```bash
# SSH to GCE server
ssh your-user@136.112.111.167

# Navigate to backend-services
cd /path/to/backend-services

# Install dependencies if needed
npm install

# Run the MongoDB script
node scripts/delete-tenant-acs-devices.js
```

## Tenant Information

- **Tenant ID**: `690abdc14a6f067977986db3`
- **Tenant Name**: Peterson Consulting

## What Gets Deleted

- All ACS/TR-069 devices in GenieACS with `_tenantId` or `tenantId` matching the tenant ID
- Related tasks for those devices

## Warning

⚠️ **This action cannot be undone!** Make sure you want to delete all ACS devices for this tenant before running.
