# Generic ISO Deployment Architecture

## Overview

This document describes the new generic ISO deployment approach that replaces the per-EPC ISO generation system. Instead of creating a custom ISO for each EPC deployment, we now use a single generic ISO that phones home to the GCE server to get EPC-specific configuration.

## Architecture

### Components

1. **Generic Netinstall ISO** (`wisptools-epc-generic-netinstall.iso`)
   - Built once and reused for all EPC deployments
   - Contains Ubuntu 22.04 LTS netinstall with autoinstall configuration
   - Automatically installs `wisptools-epc-installer` package from apt repository

2. **APT Repository** (`/var/www/html/apt-repos/main`)
   - Hosts the `wisptools-epc-installer` Debian package
   - Served via nginx on the GCE server
   - Includes GPG key for package verification

3. **wisptools-epc-installer Package**
   - Debian package containing:
     - Check-in service (`wisptools-epc-checkin.service`)
     - Check-in script that phones home to GCE server
     - Systemd service that runs on first boot

4. **Hardware Check-in API**
   - `POST /api/epc/checkin` - Hardware registers with MAC address
   - `GET /api/epc/:epc_id/deploy` - Downloads deployment script after check-in

5. **EPC Registration API**
   - `POST /api/deploy/register-epc` - Creates EPC record in database
   - Returns generic ISO download URL and check-in token

## Workflow

### 1. EPC Registration (Frontend)
```
User fills out deployment form → POST /api/deploy/register-epc
→ EPC record created in database
→ Returns generic ISO URL and check-in token
```

### 2. ISO Download
```
User downloads generic ISO (same ISO for all deployments)
→ Burns to USB
→ Boots hardware from USB
```

### 3. Autoinstall Process
```
Ubuntu autoinstall runs
→ Installs base system
→ Adds WISPTools apt repository
→ Installs wisptools-epc-installer package
→ Enables wisptools-epc-checkin.service
```

### 4. Hardware Check-in (First Boot)
```
System boots → Network comes online
→ wisptools-epc-checkin.service starts
→ Extracts MAC address (hardware_id)
→ POST /api/epc/checkin with hardware_id
→ Server finds unassigned EPC or matches by hardware_id
→ Returns EPC configuration and check-in token
```

### 5. Deployment Script Download
```
Check-in script downloads deployment script
→ GET /api/epc/:epc_id/deploy?checkin_token=xxx
→ Runs deployment script
→ EPC is fully configured and connected
```

## Setup Instructions

### On GCE Server

1. **Build Generic ISO** (one-time):
```bash
cd /opt/lte-pci-mapper/backend-services/scripts
chmod +x setup-generic-iso.sh
./setup-generic-iso.sh
```

2. **Setup APT Repository** (one-time):
```bash
cd /opt/lte-pci-mapper/backend-services/scripts
chmod +x setup-apt-repository.sh
./setup-apt-repository.sh
```

3. **Deploy Backend Services**:
```bash
# Pull latest code
cd /opt/lte-pci-mapper/backend-services
git pull

# Restart services
pm2 restart main-api epc-api
```

### Updating the Package

If you need to update the `wisptools-epc-installer` package:

```bash
# Build new package
cd /opt/lte-pci-mapper/backend-services/scripts
./build-epc-installer-package.sh

# Add to repository
reprepro includedeb stable /tmp/wisptools-epc-installer-build/wisptools-epc-installer_1.0.0_all.deb
```

## API Endpoints

### POST /api/deploy/register-epc
Register a new EPC for deployment.

**Request:**
```json
{
  "siteName": "Site Name",
  "location": {...},
  "networkConfig": {...},
  "hssConfig": {...},
  ...
}
```

**Response:**
```json
{
  "success": true,
  "epc_id": "epc_...",
  "checkin_token": "...",
  "iso_download_url": "http://.../wisptools-epc-generic-netinstall.iso",
  "message": "..."
}
```

### POST /api/epc/checkin
Hardware check-in endpoint (called by wisptools-epc-installer).

**Request:**
```json
{
  "hardware_id": "aa:bb:cc:dd:ee:ff"
}
```

**Response:**
```json
{
  "epc_id": "epc_...",
  "checkin_token": "...",
  "apt_repo_url": "http://.../apt-repos/main",
  "gce_server": "136.112.111.167",
  "hss_port": "3001",
  "origin_host_fqdn": "mme-....wisptools.io"
}
```

### GET /api/epc/:epc_id/deploy?checkin_token=xxx
Download deployment script after check-in.

**Response:** Shell script (text/x-shellscript)

### GET /api/deploy/generic-iso
Get generic ISO download information.

**Response:**
```json
{
  "success": true,
  "iso_download_url": "http://.../wisptools-epc-generic-netinstall.iso",
  "iso_checksum_url": "http://.../wisptools-epc-generic-netinstall.iso.sha256",
  "iso_size_mb": "45.2"
}
```

## Benefits

1. **Single ISO**: One ISO for all deployments, no per-EPC generation
2. **Faster**: No ISO generation wait time
3. **Scalable**: Can handle unlimited deployments with same ISO
4. **Secure**: Credentials not embedded in ISO, retrieved securely at runtime
5. **Flexible**: Can update deployment scripts without rebuilding ISO
6. **Reliable**: No heredoc/script generation issues

## Migration from Old System

The old `/api/deploy/generate-epc-iso` endpoint is still available but deprecated. Frontend should be updated to use `/api/deploy/register-epc` instead.

