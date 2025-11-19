# Backend Services Architecture

**Date:** December 2024  
**GCE VM IP:** 136.112.111.167

## Overview

The backend consists of multiple Node.js services running on different ports on the GCE VM. Requests from the frontend go through Firebase Cloud Functions that proxy to these services.

---

## Service Architecture

### Port Allocation

| Port | Service | Process Name | Script | Purpose |
|------|---------|--------------|--------|---------|
| **3001** | Main API Server | `main-api` (PM2) | `backend-services/server.js` | Unified API for all business logic |
| **3002** | EPC/ISO Generation API | `epc-api` (PM2) | `backend-services/min-epc-server.js` | EPC ISO generation and deployment |
| **3000** | *(Reserved)* | - | - | Available for future services |
| **3868** | Open5GS HSS | System Service | - | HSS Diameter protocol (external) |
| **7557** | GenieACS NBI | System Service | - | GenieACS Northbound Interface |
| **7547** | GenieACS CWMP | System Service | - | GenieACS CWMP protocol |
| **7567** | GenieACS FS | System Service | - | GenieACS File Server |
| **8080** | GenieACS UI | System Service | - | GenieACS Web UI |

---

## Service Details

### Port 3001: Main API Server (`main-api`)

**Process Manager:** PM2  
**Script:** `backend-services/server.js`  
**Environment:** Production  
**Status:** Managed by PM2 ecosystem

**Handles ALL routes except EPC deployment:**
- `/api/auth/**` - Authentication
- `/api/users/**` - User management (tenant users, roles, permissions)
- `/api/customers/**` - Customer management
- `/api/work-orders/**` - Work order management
- `/api/plans/**` - Plan project management (PCI planning, marketing discovery)
- `/api/hss/**` - HSS subscriber management
- `/api/inventory/**` - Inventory management
- `/api/maintain/**` - Maintenance API
- `/api/billing/**` - Billing API
- `/api/network/**` - Network asset management (towers, sectors, CPE)
- `/api/tenants/**` - Tenant creation (first tenant only)
- `/admin/**` - Platform admin endpoints
- `/health` - Health check

**Key Routes:**
- `GET /api/users/tenant/:tenantId` - Get all users in tenant
- `GET /api/users/tenant/:tenantId/visible` - Get visible users based on role
- `GET /api/users/all` - Get all users (platform admin only)
- `POST /api/users/invite` - Invite user to tenant

**Firebase Cloud Function:** `apiProxy` (in `functions/src/index.ts`)
- Routes all `/api/**` requests (except `/api/deploy/**`) to port 3001
- Firebase Hosting rewrite: `/api/**` → `apiProxy` Cloud Function → `http://136.112.111.167:3001`

---

### Port 3002: EPC/ISO Generation API (`epc-api`)

**Process Manager:** PM2  
**Script:** `backend-services/min-epc-server.js` (or `gce-backend/server.js`)  
**Environment:** Production  
**Status:** Managed by PM2 ecosystem

**Handles EPC deployment routes:**
- `/api/deploy/**` - EPC ISO generation
- `/api/epc/**` - EPC management endpoints

**Key Routes:**
- `POST /api/deploy/generate-epc-iso` - Generate bootable ISO for EPC
- `POST /api/epc/:epc_id/generate-iso` - Generate ISO for specific EPC
- `GET /api/deploy/status/:epc_id` - Check ISO generation status

**Firebase Cloud Function:** `isoProxy` (in `functions/src/index.ts`)
- Routes all `/api/deploy/**` requests to port 3002
- Firebase Hosting rewrite: `/api/deploy/**` → `isoProxy` Cloud Function → `http://136.112.111.167:3002`

---

## Request Flow

### Example 1: Get Tenant Users
```
Frontend: GET /api/users/tenant/abc123
  ↓
Firebase Hosting Rewrite: /api/** → apiProxy
  ↓
Cloud Function (apiProxy): Receives request
  ↓
Proxy to: http://136.112.111.167:3001/api/users/tenant/abc123
  ↓
Backend Service (Port 3001): Processes request
  ↓
Response: JSON with user list
```

### Example 2: Generate EPC ISO
```
Frontend: POST /api/deploy/generate-epc-iso
  ↓
Firebase Hosting Rewrite: /api/deploy/** → isoProxy
  ↓
Cloud Function (isoProxy): Receives request
  ↓
Proxy to: http://136.112.111.167:3002/api/deploy/generate-epc-iso
  ↓
Backend Service (Port 3002): Processes ISO generation
  ↓
Response: ISO download URL or status
```

---

## Process Management

Both services are managed by PM2 using `ecosystem.config.js`:

```javascript
// PM2 Commands
pm2 start ecosystem.config.js    # Start all services
pm2 stop ecosystem.config.js     # Stop all services
pm2 restart ecosystem.config.js  # Restart all services
pm2 logs main-api                # View main API logs
pm2 logs epc-api                 # View EPC API logs
pm2 status                       # Check service status
```

---

## Environment Variables

### Main API (Port 3001)
```bash
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
FIREBASE_PROJECT_ID=wisptools-production
FIREBASE_SERVICE_ACCOUNT_KEY=/opt/lte-pci-mapper/backend-services/wisptools-production-firebase-adminsdk.json
MONGODB_URI=mongodb+srv://...
ARCGIS_API_KEY=...
ARCGIS_OAUTH_CLIENT_ID=...
ARCGIS_OAUTH_CLIENT_SECRET=...
```

### EPC API (Port 3002)
```bash
NODE_ENV=production
PORT=3002
HOST=0.0.0.0
FIREBASE_PROJECT_ID=wisptools-production
FIREBASE_SERVICE_ACCOUNT_KEY=/opt/lte-pci-mapper/backend-services/wisptools-production-firebase-adminsdk.json
ARCGIS_API_KEY=...
ARCGIS_OAUTH_CLIENT_ID=...
ARCGIS_OAUTH_CLIENT_SECRET=...
GCE_PUBLIC_IP=136.112.111.167
HSS_PORT=3001  # Note: HSS Management API is on port 3001
```

---

## Firebase Cloud Functions

### apiProxy
- **Region:** us-central1
- **Memory:** 512MiB
- **Timeout:** 60 seconds
- **Routes:** All `/api/**` except `/api/deploy/**`
- **Backend:** `http://136.112.111.167:3001`

### isoProxy
- **Region:** us-central1
- **Memory:** 512MiB
- **Timeout:** 300 seconds (5 minutes for ISO generation)
- **Routes:** All `/api/deploy/**`
- **Backend:** `http://136.112.111.167:3002`

---

## Troubleshooting

### Connection Refused Errors

**Symptom:** `ERR_CONNECTION_REFUSED` when calling `/api/users/**` or other main API routes

**Possible Causes:**
1. Main API service (port 3001) is not running
   ```bash
   pm2 status              # Check if main-api is running
   pm2 logs main-api       # Check for errors
   pm2 restart main-api    # Restart if needed
   ```

2. Firebase Cloud Function `apiProxy` not deployed or misconfigured
   ```bash
   cd functions
   firebase deploy --only functions:apiProxy
   ```

3. Network connectivity issue between Cloud Function and GCE VM
   - Check GCE firewall rules (ports 3001, 3002 should be open)
   - Verify VM IP address is correct: `136.112.111.167`

4. CORS configuration issue
   - Check `backend-services/config/app.js` for allowed origins
   - Verify Firebase Hosting domain is in CORS whitelist

**Diagnosis:**
```bash
# Check if service is listening
curl http://136.112.111.167:3001/health
curl http://136.112.111.167:3002/health

# Check PM2 status
pm2 status
pm2 logs main-api --lines 50
pm2 logs epc-api --lines 50
```

---

## Deployment

### Deploy Backend Services

**Main API (Port 3001):**
```bash
cd backend-services
git pull origin main
npm install
pm2 restart main-api
```

**EPC API (Port 3002):**
```bash
cd backend-services
git pull origin main
npm install
pm2 restart epc-api
```

**Both Services:**
```bash
cd backend-services
git pull origin main
npm install
pm2 restart ecosystem.config.js
```

### Deploy Firebase Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

---

## Health Checks

### Main API (Port 3001)
```bash
curl http://136.112.111.167:3001/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "user-management-system",
  "port": 3001,
  "timestamp": "2024-12-01T12:00:00.000Z"
}
```

### EPC API (Port 3002)
```bash
curl http://136.112.111.167:3002/health
```

---

## Security

- All requests require Firebase Authentication token in `Authorization: Bearer <token>` header
- Tenant ID must be provided in `X-Tenant-ID` header for tenant-scoped operations
- CORS is configured to only allow authorized Firebase Hosting domains
- Services listen on `0.0.0.0` to accept connections from Cloud Functions
- Firewall rules on GCE should only allow traffic from Cloud Functions IP ranges

---

## Database

Both services connect to the same MongoDB Atlas cluster:
- Main API: Full read/write access to all collections
- EPC API: Read-only access (if configured) or full access as needed

---

## Notes

- Port 3000 is reserved for future services (possibly a separate HSS service)
- GenieACS services (ports 7557, 7547, 7567, 8080) are separate system services, not managed by PM2
- Open5GS HSS (port 3868) is a separate system service
- HSS Management API runs on port 3001 alongside the main API (different route: `/api/hss/**`)

