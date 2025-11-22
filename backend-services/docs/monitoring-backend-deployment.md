# Monitoring Backend Deployment Documentation

## Overview

The LTE WISP Monitoring Backend runs on port 3003 on the GCE VM (`acs-hss-server`, IP: `136.112.111.167`). It provides APIs for network monitoring, device management, and EPC deployment.

## Architecture

### Server File
- **Location**: `backend-services/monitoring-backend-server.js`
- **Deployed Location**: `/home/david_peterson_consulting_com/lte-wisp-backend/server.js`
- **Port**: 3003
- **Service Name**: `lte-wisp-backend.service`

### Routes Included

1. **Monitoring Routes** (`/api/monitoring`)
   - Device status and metrics
   - Dashboard data
   - SNMP monitoring

2. **EPC Routes** (`/api/epc`)
   - EPC device listing
   - EPC metrics
   - EPC deployment status

3. **Mikrotik Routes** (`/api/mikrotik`)
   - Mikrotik device management
   - RouterOS API integration

4. **SNMP Routes** (`/api/snmp`)
   - SNMP device discovery
   - SNMP metrics collection
   - SNMP trap handling

5. **Network Routes** (`/api/network`)
   - Sites, sectors, CPE listing
   - Network equipment management
   - Plan layer integration

6. **Deploy Routes** (`/api/deploy`)
   - EPC ISO generation
   - Deployment script generation
   - Cloud-init configuration

## Deployment Process

### Prerequisites

1. Git installed on GCE VM
2. Node.js 16+ installed
3. MongoDB connection configured
4. Service account with appropriate permissions

### Deployment Steps

1. **Pull Latest Code**
   ```bash
   cd /tmp
   git clone https://github.com/theorem6/lte-pci-mapper.git lte-pci-mapper-deploy
   cd lte-pci-mapper-deploy
   ```

2. **Run Deployment Script**
   ```bash
   cd backend-services/scripts
   chmod +x deploy-monitoring-backend-via-git.sh
   sudo ./deploy-monitoring-backend-via-git.sh
   ```

   Or manually:
   ```bash
   # Copy server file
   cp backend-services/monitoring-backend-server.js /home/david_peterson_consulting_com/lte-wisp-backend/server.js
   
   # Copy routes
   cp backend-services/routes/*.js /home/david_peterson_consulting_com/lte-wisp-backend/routes/
   
   # Copy models
   cp backend-services/models/network.js /home/david_peterson_consulting_com/lte-wisp-backend/models/
   
   # Install dependencies
   cd /home/david_peterson_consulting_com/lte-wisp-backend
   npm install --production
   
   # Restart service
   sudo systemctl restart lte-wisp-backend
   ```

3. **Verify Deployment**
   ```bash
   # Check service status
   sudo systemctl status lte-wisp-backend
   
   # Test health endpoint
   curl http://localhost:3003/health
   
   # Test network endpoint
   curl -H 'X-Tenant-ID: 690abdc14a6f067977986db3' http://localhost:3003/api/network/sectors
   ```

## Directory Structure

```
/home/david_peterson_consulting_com/lte-wisp-backend/
├── server.js                 # Main server file
├── package.json             # Dependencies
├── routes/
│   ├── monitoring.js        # Monitoring routes
│   ├── epc.js              # EPC routes
│   ├── mikrotik.js         # Mikrotik routes
│   ├── snmp.js             # SNMP routes
│   ├── network.js          # Network routes (sites, sectors, CPE, equipment)
│   └── epc-deployment.js   # Deployment routes (ISO generation)
├── models/
│   └── network.js          # Network models (UnifiedSite, UnifiedCPE, etc.)
└── logs/
    ├── backend.log         # Application logs
    └── backend-error.log   # Error logs
```

## ISO Directory Configuration

The backend requires the following directories for ISO generation:

- `/var/www/html/downloads/isos` - Nginx-served ISO downloads
- `/tmp/iso-downloads` - Temporary ISO storage
- `/opt/epc-iso-builder` - ISO build workspace

These are automatically created during deployment.

## Systemd Service

The service is managed via systemd:

```bash
# Start service
sudo systemctl start lte-wisp-backend

# Stop service
sudo systemctl stop lte-wisp-backend

# Restart service
sudo systemctl restart lte-wisp-backend

# View logs
sudo journalctl -u lte-wisp-backend -f

# Check status
sudo systemctl status lte-wisp-backend
```

## Environment Variables

Configured in systemd service file:
- `NODE_ENV=production`
- `PORT=3003`
- `MONGODB_URI=mongodb+srv://...`

## Troubleshooting

### Service Not Starting

1. Check logs:
   ```bash
   sudo journalctl -u lte-wisp-backend -n 50
   ```

2. Check syntax:
   ```bash
   node -c /home/david_peterson_consulting_com/lte-wisp-backend/server.js
   ```

3. Verify routes exist:
   ```bash
   ls -la /home/david_peterson_consulting_com/lte-wisp-backend/routes/
   ```

### Missing Routes Error

If endpoints return "Cannot GET /api/network/*":
1. Verify routes are copied to `routes/` directory
2. Check `server.js` includes route registration
3. Restart service: `sudo systemctl restart lte-wisp-backend`

### ISO Generation Errors

If ISO generation fails with "ENOENT: no such file or directory":
1. Create directories:
   ```bash
   sudo mkdir -p /var/www/html/downloads/isos
   sudo mkdir -p /tmp/iso-downloads
   sudo mkdir -p /opt/epc-iso-builder
   sudo chmod 755 /var/www/html/downloads/isos
   ```

2. Verify permissions:
   ```bash
   ls -la /var/www/html/downloads/
   ```

### MongoDB Connection Errors

1. Verify MongoDB URI in systemd service
2. Check network connectivity to MongoDB Atlas
3. Verify MongoDB credentials

## API Endpoints

### Health Check
```
GET /health
```

### Network APIs
```
GET /api/network/sites
GET /api/network/sectors
GET /api/network/cpe
GET /api/network/equipment
```

### Deployment APIs
```
POST /api/deploy/generate-epc-iso
```

All endpoints require `X-Tenant-ID` header.

## Version History

- **2025-11-22**: Initial deployment with network and deploy routes
- **2025-11-22**: Added ISO directory creation to deployment script

## Related Files

- `backend-services/monitoring-backend-server.js` - Server implementation
- `backend-services/scripts/deploy-monitoring-backend-via-git.sh` - Deployment script
- `backend-services/routes/network.js` - Network API routes
- `backend-services/routes/epc-deployment.js` - Deployment API routes

