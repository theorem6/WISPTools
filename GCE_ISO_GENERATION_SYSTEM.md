# GCE-Based ISO Generation System

## Overview

The system now generates **small bootable ISOs (~150MB) on the GCE server** with unique EPC credentials embedded. These ISOs download the full deployment during first boot, ensuring each EPC has a unique code for cloud reporting.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  WISPTOOLS.IO UI (Firebase)                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Deploy EPC Tab                                     │     │
│  │  1. User registers new EPC                          │     │
│  │  2. Backend generates unique credentials            │     │
│  │  3. User clicks "💿 ISO" button                     │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
                          │ POST /api/epc/:id/generate-iso
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  GCE SERVER (136.112.111.167)                                │
│  ┌────────────────────────────────────────────────────┐     │
│  │  ISO Generation Service                             │     │
│  │  1. Receives EPC credentials                        │     │
│  │  2. Creates cloud-init config with embedded creds   │     │
│  │  3. Builds minimal ISO (~150MB)                     │     │
│  │  4. Returns download URL                            │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  ISO Download Directory                             │     │
│  │  /var/www/html/downloads/isos/                      │     │
│  │  - wisptools-epc-{id}-{hash}.iso                    │     │
│  │  - wisptools-epc-{id}-{hash}.iso.sha256             │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Bootstrap Endpoint                                  │     │
│  │  GET /api/epc/:id/bootstrap                         │     │
│  │  - Returns bootstrap script                         │     │
│  │  - Requires auth_code for security                  │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Full Deployment Endpoint                           │     │
│  │  GET /api/epc/:id/full-deployment                   │     │
│  │  - Returns complete Open5GS deployment script       │     │
│  │  - Includes HSS configuration                       │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
                          │ HTTP Download
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  USER DOWNLOADS ISO                                          │
│  curl -O http://136.112.111.167/downloads/isos/epc-*.iso    │
└──────────────────────────────────────────────────────────────┘
                          │ Burn to USB
                          ↓
┌──────────────────────────────────────────────────────────────┐
│  TARGET HARDWARE - FIRST BOOT                                │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Phase 1: Ubuntu Installation (5-10 min)           │     │
│  │  - Autoinstall from ISO                             │     │
│  │  - Get IP via DHCP                                  │     │
│  │  - Credentials embedded in /etc/wisptools/          │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Phase 2: Bootstrap (first boot)                    │     │
│  │  - wisptools-bootstrap.service starts               │     │
│  │  - wget bootstrap script from GCE                   │     │
│  │  - Authenticates with embedded auth_code            │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Phase 3: Full Deployment (10-15 min)              │     │
│  │  - wget full-deployment script from GCE             │     │
│  │  - Install Open5GS packages                         │     │
│  │  - Configure Cloud HSS connection                   │     │
│  │  - Set up metrics agent with unique code            │     │
│  │  - Start all services                               │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Phase 4: Online & Reporting                        │     │
│  │  - Connects to HSS at 136.112.111.167:3001         │     │
│  │  - Reports metrics with unique EPC ID               │     │
│  │  - Appears online in dashboard                      │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. ISO Generation Endpoint (GCE)

**File**: `gce-backend/routes/epc-deployment.js`

**Endpoint**: `POST /api/epc/:epc_id/generate-iso`

**Request**:
```json
{
  "tenant_id": "tenant_abc123",
  "auth_code": "unique_auth_code_here",
  "api_key": "unique_api_key_here",
  "secret_key": "unique_secret_here",
  "site_name": "Tower Site Alpha"
}
```

**Response**:
```json
{
  "success": true,
  "epc_id": "epc_a1b2c3d4",
  "iso_filename": "wisptools-epc-a1b2c3d4-8f7e6d5c.iso",
  "download_url": "http://136.112.111.167/downloads/isos/wisptools-epc-a1b2c3d4-8f7e6d5c.iso",
  "checksum_url": "http://136.112.111.167/downloads/isos/wisptools-epc-a1b2c3d4-8f7e6d5c.iso.sha256",
  "size_mb": 150,
  "message": "ISO generation initiated..."
}
```

**What It Does**:
1. Creates cloud-init config with embedded credentials
2. Builds minimal Ubuntu 24.04 ISO (~150MB)
3. Embeds bootstrap script
4. Saves to `/var/www/html/downloads/isos/`
5. Generates SHA256 checksum
6. Returns download URL

### 2. Bootstrap Endpoint (GCE)

**Endpoint**: `GET /api/epc/:epc_id/bootstrap?auth_code=xxx`

**Authentication**: Requires `auth_code` query parameter

**Response**: Shell script that:
1. Loads embedded credentials from `/etc/wisptools/credentials.env`
2. Tests network connectivity to GCE server
3. Downloads full deployment script
4. Executes full deployment
5. Marks system as bootstrapped

### 3. Full Deployment Endpoint (GCE)

**Endpoint**: `GET /api/epc/:epc_id/full-deployment?auth_code=xxx`

**Authentication**: Requires `auth_code` query parameter

**Response**: Complete Open5GS deployment script including:
- Open5GS package installation
- MME/SGW/UPF/PCRF configuration
- Cloud HSS connection setup (136.112.111.167:3001)
- FreeDiameter Diameter configuration
- Metrics agent installation
- Service startup and verification

## Embedded Credentials

Each ISO contains unique credentials in `/etc/wisptools/credentials.env`:

```bash
# WISPTools.io EPC Credentials
# DO NOT SHARE OR MODIFY
EPC_ID=epc_a1b2c3d4e5f6
TENANT_ID=tenant_abc123
EPC_AUTH_CODE=unique_auth_code_32_chars
EPC_API_KEY=unique_api_key_64_chars
EPC_SECRET_KEY=unique_secret_key_64_chars
GCE_SERVER=136.112.111.167
HSS_PORT=3001
```

These credentials:
- ✅ **Unique per EPC** - No two EPCs share credentials
- ✅ **Secure** - Permissions set to 600 (owner read/write only)
- ✅ **Authenticate downloads** - Required for bootstrap and deployment
- ✅ **Enable metrics** - Unique code for cloud reporting
- ✅ **Embedded at ISO creation** - No configuration needed

## ISO Contents

### Minimal ISO (~150MB)

The small ISO contains:
- Ubuntu 24.04 LTS minimal base
- Cloud-init autoinstall configuration
- Embedded EPC credentials
- Bootstrap script reference
- Network configuration (DHCP)

### NOT in ISO (Downloaded at Runtime)

The following are downloaded from GCE during first boot:
- Open5GS packages
- Full deployment scripts
- Metrics agent
- Configuration files
- Dependencies

## Deployment Flow

### Step 1: Register EPC (User)
```
1. User navigates to Deploy EPC tab
2. Clicks "Register New EPC"
3. Fills in site details
4. System generates unique credentials:
   - EPC ID: epc_random_hex
   - Auth Code: 32-char hex
   - API Key: 64-char hex
   - Secret Key: 64-char hex
5. EPC saved to MongoDB
```

### Step 2: Generate ISO (User)
```
1. User finds registered EPC in list
2. Clicks "💿 ISO" button
3. UI calls GCE: POST /api/epc/:id/generate-iso
4. GCE generates minimal ISO with credentials
5. ISO saved to /var/www/html/downloads/isos/
6. User receives download URL
```

### Step 3: Download & Burn (User)
```
1. User downloads ISO from GCE
2. Verifies checksum
3. Burns to USB:
   dd if=wisptools-epc-*.iso of=/dev/sdX bs=4M
4. Ships USB to field technician
```

### Step 4: Boot & Install (Automated)
```
1. Technician boots target hardware from USB
2. Ubuntu autoinstall starts (no interaction)
3. System installs Ubuntu 24.04 minimal
4. Embedded credentials copied to /etc/wisptools/
5. System reboots
```

### Step 5: First Boot & Bootstrap (Automated)
```
1. wisptools-bootstrap.service starts
2. Loads credentials from /etc/wisptools/credentials.env
3. Tests connectivity to GCE (136.112.111.167)
4. Downloads bootstrap script:
   GET /api/epc/:id/bootstrap?auth_code=xxx
5. Executes bootstrap script
```

### Step 6: Full Deployment (Automated)
```
1. Bootstrap script downloads full deployment:
   GET /api/epc/:id/full-deployment?auth_code=xxx
2. Installs Open5GS packages
3. Configures Cloud HSS connection
4. Sets up Diameter (S6a) to 136.112.111.167:3868
5. Installs metrics agent with unique EPC ID
6. Starts all services
7. Marks as bootstrapped
```

### Step 7: Online & Reporting (Automated)
```
1. MME connects to Cloud HSS
2. Metrics agent starts reporting
3. First heartbeat sent to wisptools.io
4. EPC appears "online" in dashboard
5. Metrics flow every 60 seconds
```

## Security

### Unique Codes
- Each EPC has unique `auth_code`, `api_key`, `secret_key`
- Credentials required for all downloads from GCE
- Prevents unauthorized access to deployment scripts

### Authentication Flow
```
ISO → Embedded Creds → Bootstrap (auth_code) → Full Deploy (auth_code) → Metrics (api_key + secret)
```

### File Permissions
```bash
/etc/wisptools/credentials.env  # 600 (owner r/w only)
/opt/wisptools/bootstrap.sh     # 755 (executable)
```

## GCE Server Setup

### Required Directories
```bash
/opt/epc-iso-builder/          # ISO build workspace
/opt/base-images/              # Base Ubuntu ISO storage
/var/www/html/downloads/isos/  # Public ISO downloads
/opt/deployment-scripts/       # Full deployment scripts
```

### Required Packages
```bash
sudo apt-get install -y \
  xorriso \
  p7zip-full \
  isolinux \
  nginx \
  nodejs \
  npm
```

### Required Services
```bash
# Nginx for HTTP downloads
sudo systemctl enable nginx
sudo systemctl start nginx

# Node.js backend for API
cd /opt/gce-backend
npm install
node server.js &
```

## UI Integration

### DeployEPC.svelte Changes

**Two Buttons Per EPC**:
1. **📜 Script** - Downloads deployment script for existing servers
2. **💿 ISO** - Generates and provides ISO download

**ISO Generation Flow**:
```javascript
async function downloadBootISO(epc) {
  // Call GCE to generate ISO
  const response = await fetch(`${HSS_API}/epc/${epc.epc_id}/generate-iso`, {
    method: 'POST',
    headers: { 'Authorization', 'X-Tenant-ID' },
    body: JSON.stringify({
      tenant_id, auth_code, api_key, secret_key, site_name
    })
  });
  
  // Show download URL
  const data = await response.json();
  alert(`Download: ${data.download_url}`);
  window.open(data.download_url, '_blank');
}
```

## Benefits

### 1. Small ISO Size
- **~150MB** vs ~2GB for full ISO
- Faster downloads
- Easier distribution
- Less storage needed

### 2. Unique Credentials
- Every EPC has unique code
- Proper authentication
- Secure cloud reporting
- No credential sharing

### 3. Centralized Hosting
- All files on GCE server
- Easy updates
- Version control
- Single source of truth

### 4. Dynamic Deployment
- Download latest scripts at runtime
- Can update deployment without rebuilding ISOs
- Push fixes without new ISOs

### 5. Scalable
- Generate ISOs on-demand
- No pre-building needed
- Handles many tenants
- Parallel ISO generation

## Monitoring

### Track in Dashboard
- Number of ISOs generated per tenant
- Download statistics
- Deployment success rate
- Time to first heartbeat
- Failed deployments

### Logs to Monitor
```bash
# GCE Server
/var/log/nginx/access.log        # ISO downloads
/var/log/epc-deployment.log      # ISO generation
/opt/gce-backend/logs/api.log    # API requests

# EPC Node
/var/log/wisptools-bootstrap.log # Bootstrap process
journalctl -u wisptools-bootstrap.service
```

## Troubleshooting

### ISO Generation Fails
- Check GCE disk space: `df -h`
- Verify base ISO exists: `/opt/base-images/ubuntu-24.04-minimal.iso`
- Check permissions: `/var/www/html/downloads/isos/`
- Review logs: `/var/log/epc-deployment.log`

### Download Fails
- Verify nginx running: `systemctl status nginx`
- Check firewall: Port 80 open
- Test: `curl http://136.112.111.167/downloads/isos/`

### Bootstrap Fails
- Check network: Can EPC reach GCE?
- Verify credentials embedded: `cat /etc/wisptools/credentials.env`
- Check auth_code valid
- Review: `/var/log/wisptools-bootstrap.log`

### Deployment Fails
- Check Open5GS repos accessible
- Verify internet connectivity
- Review deployment script execution
- Check: `journalctl -xe`

## Future Enhancements

### Planned
- [ ] Real-time ISO generation progress
- [ ] Automatic cleanup of old ISOs
- [ ] ISO caching and reuse
- [ ] Multi-architecture support (ARM64)
- [ ] Signed ISOs for security
- [ ] PXE boot option

### Nice-to-Have
- [ ] Web UI for ISO generation on GCE
- [ ] Bulk ISO generation
- [ ] ISO generation queue
- [ ] Customization options
- [ ] Pre-built ISO library

## Summary

**What Changed**:
- ✅ ISOs now generated on GCE server
- ✅ Small ISOs (~150MB) with embedded credentials
- ✅ Full deployment downloaded at runtime
- ✅ Unique code per EPC for cloud reporting
- ✅ All files hosted on GCE

**User Experience**:
1. Register EPC → Get unique credentials
2. Click "ISO" button → GCE generates ISO
3. Download small ISO → Burn to USB
4. Boot hardware → Fully automated
5. Watch dashboard → EPC comes online

**Technical Benefits**:
- Unique credentials per EPC
- Small, fast ISOs
- Centralized file hosting
- Dynamic deployments
- Easy updates
- Secure authentication

---

**Status**: ✅ Implemented  
**Location**: GCE Server (136.112.111.167)  
**Files**: `gce-backend/routes/epc-deployment.js`, `Module_Manager/.../DeployEPC.svelte`  
**Repository**: theorem6/lte-pci-mapper

