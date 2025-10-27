# Project Structure

This document explains the organization of the WISPTools.io LTE Platform codebase.

## Directory Structure

```
PCI_mapper/                          # Git repository root
├── Module_Manager/                  # Frontend SvelteKit Application
│   ├── src/                         # Source code
│   │   ├── routes/                  # SvelteKit routes (pages)
│   │   ├── lib/                     # Shared libraries and components
│   │   │   ├── firebase.ts          # Firebase initialization
│   │   │   ├── services/            # Business logic services
│   │   │   ├── stores/              # Svelte stores (state management)
│   │   │   └── components/          # Reusable Svelte components
│   ├── static/                      # Static assets (images, etc.)
│   ├── package.json                 # Frontend dependencies
│   └── svelte.config.js             # SvelteKit configuration
│
├── functions/                       # Firebase Cloud Functions
│   ├── src/
│   │   └── index.ts                # Cloud Functions (proxies for backend APIs)
│   └── package.json
│
├── gce-backend/                    # GCE (Google Compute Engine) Backend Services
│   ├── routes/
│   │   └── epc-deployment.js       # EPC ISO generation and management
│   ├── server.js                   # Express server (ports 3001, 3002)
│   └── package.json
│
├── hss-module/                     # HSS (Home Subscriber Server) Module
│   └── api/
│       └── epc-management.ts      # EPC registration and management API
│
├── distributed-epc/               # Distributed EPC Management
│   ├── routes/                    # API routes for EPC management
│   ├── utils/                     # Utility functions
│   └── index.js                   # Main API entry point
│
├── scripts/                       # Automation and deployment scripts
│   └── deployment/               # Deployment automation
│       ├── deploy-all-automated.sh    # Full GCE backend setup
│       ├── deploy-gce-iso-builder.sh  # ISO generation setup
│       └── fix-port-allocation.sh     # Port conflict resolution
│
└── docs/                         # Documentation files

```

## Architecture Overview

### Frontend (`Module_Manager/`)
- **Technology**: SvelteKit with TypeScript
- **Deployment**: Firebase Hosting (static files)
- **Authentication**: Firebase Auth
- **Database**: Firestore (Firebase)
- **API Access**: Via Firebase Cloud Functions

### Backend Services

#### 1. Firebase Cloud Functions (`functions/`)
- **Purpose**: HTTPS proxies for HTTP backend APIs
- **Functions**:
  - `hssProxy`: Proxies to GCE port 3001 (HSS Management)
  - `isoProxy`: Proxies to GCE port 3002 (ISO Generation)

#### 2. GCE Server (136.112.111.167)
- **OS**: Ubuntu 24.04 LTS
- **Services**:
  - Port **3001**: HSS Management API
  - Port **3002**: ISO Generation API
- **Deployment**: Automated via `deploy-all-automated.sh`

### Database Architecture

#### MongoDB Atlas (Cloud)
- **Collections**:
  - `remoteEPCs`: Registered EPC instances
  - `epcMetrics`: EPC performance data
  - `users`: User accounts
  - `tenants`: Tenant organizations

#### Firestore (Firebase)
- **Collections**:
  - `users`: User accounts (synced with MongoDB)
  - `tenants`: Tenant organizations
  - `networkSites`: Network sites (for EPC registration)
  - Various module-specific collections

## Module Breakdown

### Core Modules (in `Module_Manager/src/routes/modules/`)

1. **hss-management** (HSS Management)
   - Remote EPC registration
   - EPC monitoring
   - ISO generation
   - Key files:
     - `RemoteEPCs.svelte`: EPC management interface
     - `EPCMonitor.svelte`: Monitoring dashboard

2. **coverage-map** (Coverage Mapping)
   - ArcGIS map integration
   - Tower site management
   - Signal coverage visualization

3. **acs-cpe-management** (GenieACS CPE Management)
   - Device monitoring
   - Configuration management
   - File management

4. **deploy** (Deployment)
   - EPC deployment scripts
   - ISO download
   - Configuration generation

5. **inventory** (Inventory Management)
   - Asset tracking
   - Equipment management

6. **work-orders** (Work Orders)
   - Ticket management
   - Technician dispatch

## Deployment Flow

### Frontend Deployment
```bash
cd Module_Manager
npm run build
firebase deploy --only hosting
```

### Backend Deployment (GCE)
```bash
# SSH to GCE server
ssh root@136.112.111.167

# Pull latest code
cd /root/lte-pci-mapper
git pull origin main

# Run deployment script
bash scripts/deployment/deploy-all-automated.sh
```

### Cloud Functions Deployment
```bash
firebase deploy --only functions
```

## Key Configuration Files

### `firebase.json`
- **Hosting**: Configured to deploy `Module_Manager/build`
- **Functions**: Configures `functions/` directory
- **No App Hosting**: Frontend uses Firebase Hosting only

### `Module_Manager/svelte.config.js`
- **Adapter**: `@sveltejs/adapter-node` for SSR
- **Build Output**: `build/` directory

### Environment Variables
- **Frontend**: Firestore configuration (Firebase project)
- **Backend**: MongoDB Atlas URI (in systemd service)
- **GCE**: Environment variables set in systemd service files

## Common Issues and Solutions

### Port Conflicts
- **Port 3001**: HSS Management API (must not be in use)
- **Port 3002**: ISO Generation API (must not be in use)
- **Fix**: Run `scripts/deployment/fix-port-allocation.sh`

### App Hosting Build Failures
- **Cause**: Misconfigured `apphosting.yaml` files
- **Solution**: Remove all `apphosting*.yaml` files (now fixed)

### Site Loading Issues
- **Cause**: CORS or API proxy issues
- **Solution**: Use direct Firestore access (implemented in `RemoteEPCs.svelte`)

## Development Workflow

1. **Make changes in `Module_Manager/`**
2. **Build**: `npm run build`
3. **Test locally**: `npm run preview`
4. **Deploy**: `firebase deploy --only hosting` (auto-commits)
5. **Backend changes**: SSH to GCE and run deployment script

## Git Workflow [[memory:9553541]]
- **Master**: Cursor IDE (Windows) - all development happens here
- **Push**: Automatically commits and pushes to `theorem6/lte-pci-mapper`
- **No development**: Firebase Web IDE is for testing/deployment verification only

