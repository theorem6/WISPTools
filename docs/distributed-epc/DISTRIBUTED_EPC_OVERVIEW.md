# Distributed EPC System - Overview

## Introduction

The Distributed EPC system extends the LTE WISP Management Platform to support **cloud-based HSS authentication** with **multiple remote EPC sites**. This architecture allows a single cloud HSS to authenticate subscribers across geographically distributed EPCs, with real-time monitoring and management.

## Architecture

### Cloud Components (Already Built)
1. **Cloud HSS** - Open5GS HSS running on server (`136.112.111.167`)
2. **HSS Management API** - Node.js/Express API for subscriber management
3. **Web Dashboard** - SvelteKit frontend for management

### New Distributed Components
1. **Remote EPC Management** - Register, monitor, and manage remote EPC sites
2. **Metrics Collection API** - Receive real-time metrics from remote EPCs
3. **Open5GS Metrics Agent** - Node.js agent running on each remote EPC
4. **Real-time Dashboard** - Monitor all EPCs from cloud (modeled after http://72.55.193.194:8088/)

## Reference Dashboard

The system replicates the **Nimbus Solutions Open5GS Network Monitor** (http://72.55.193.194:8088/) which provides:

### Key Metrics Tracked
- **Per-APN attached subscribers**
- **Multi-APN IMSIs** - Subscribers using multiple APNs
- **Attach/Detach Events** - Real-time and historical (60 min rolling window)
- **OGSTUN Pool** - IP address pool utilization
- **CellID Status** - Total, active, inactive cells
- **eNB Base Stations** - S1 connection status, uptime, last seen
- **Component Status** - MME, SGWC, SGWU, UPF, SMF, PCRF health
- **System Resources** - CPU, memory, disk usage
- **Log Freshness** - Latest log timestamps for each component

### Visualizations
- **Time series graphs** - IMSIs over time (30 days)
- **Event timeline** - Attach/detach events
- **Status tables** - Enhanced roster, eNB list
- **Filters** - By customer, CellID, APN, status

## Data Flow

```
┌─────────────────┐
│ Remote EPC Site │
│   (Open5GS)     │
└────────┬────────┘
         │
         │ Metrics Agent (Node.js)
         │ - Collects system metrics
         │ - Parses Open5GS logs
         │ - Tracks attach/detach
         │ - Every 60 seconds
         │
         ▼
┌─────────────────┐
│   Cloud API     │
│ (Firebase Fn)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   MongoDB       │
│  (Atlas)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Web Dashboard  │
│  (SvelteKit)    │
└─────────────────┘
```

## Key Features

### 1. EPC Registration & Authentication
- Each remote EPC gets a unique **AUTH_CODE**, **API_KEY**, and **SECRET_KEY**
- HMAC-SHA256 signature verification for all API calls
- Per-tenant isolation - EPCs can only access their tenant's data

### 2. Real-time Metrics
- System resources (CPU, memory, disk, load)
- Open5GS component status (MME, SGWC, SGWU, UPF, SMF, PCRF)
- Subscriber statistics (attached, detached, active sessions)
- eNB S1 connections
- OGSTUN IP pool utilization
- Log freshness indicators

### 3. Event Tracking
- Attach events - When UE connects
- Detach events - When UE disconnects
- Session duration and data usage
- Historical event log (90 days retention)

### 4. Alerting
- EPC offline detection (no heartbeat > 5 minutes)
- High CPU/memory/disk usage
- Component down alerts
- IP pool exhaustion warnings
- eNB disconnection alerts

### 5. Multi-Tenant Support
- Each tenant can have multiple EPC sites
- Subscriber data isolated per tenant
- HSS entries are tenant-specific
- Dashboard filters by tenant

## MongoDB Collections

### Core Collections
1. **remote_epcs** - EPC site registrations and configuration
2. **epc_metrics** - Time-series metrics (90-day TTL)
3. **subscriber_sessions** - Active and historical sessions
4. **attach_detach_events** - Event log (90-day TTL)
5. **epc_alerts** - System alerts and notifications

### Existing HSS Collections (Extended)
6. **subscribers** - Subscriber records (IMSI, Ki, OPc, etc.)
7. **groups** - Subscriber groups
8. **bandwidth_plans** - QoS profiles

## Installation Components

### 1. Cloud Backend (Already Done)
- ✅ HSS API deployed on `136.112.111.167:3000`
- ✅ Firebase Functions proxy for HTTPS
- ✅ MongoDB connection established
- 🔄 Need to integrate distributed EPC API

### 2. Remote EPC Installation
```bash
# One-command installation script
sudo ./install-distributed-epc.sh

# Prompts for:
# - Site name
# - MCC/MNC/TAC
# - APN configuration
# - IP pool
# - Cloud API credentials
```

### 3. Metrics Agent
```bash
# Runs as systemd service
systemctl status open5gs-metrics-agent

# Configuration
/etc/open5gs/metrics-agent.env

# Logs
journalctl -u open5gs-metrics-agent -f
```

## API Endpoints

### EPC Management (Tenant-facing)
- `POST /api/epc/register` - Register new EPC site
- `GET /api/epc/list` - List all EPCs for tenant
- `GET /api/epc/:epc_id` - Get EPC details and latest metrics
- `PUT /api/epc/:epc_id` - Update EPC configuration
- `DELETE /api/epc/:epc_id` - Remove EPC

### Metrics Collection (EPC-facing)
- `POST /api/metrics/heartbeat` - EPC heartbeat (every 60s)
- `POST /api/metrics/submit` - Submit metrics data
- `POST /api/metrics/attach` - Log attach event
- `POST /api/metrics/detach` - Log detach event

### Dashboard (UI-facing)
- `GET /api/dashboard` - Main dashboard data
- `GET /api/metrics/history` - Historical metrics
- `GET /api/subscribers/roster` - Subscriber list
- `GET /api/events/attach-detach` - Event timeline

## Security

### Authentication Layers
1. **Tenant-level**: X-Tenant-ID header required for all tenant endpoints
2. **EPC-level**: AUTH_CODE + API_KEY + HMAC signature for metrics endpoints
3. **User-level**: Firebase Auth for web UI access

### Data Isolation
- All queries scoped by `tenant_id`
- EPCs can only submit data for their own `epc_id`
- No cross-tenant data access

## Deployment Roadmap

### Phase 1: Backend & API ✅ (Just Completed)
- [x] MongoDB schemas designed
- [x] Distributed EPC API created
- [x] Open5GS metrics agent built
- [x] Installation scripts created

### Phase 2: Cloud Integration (Next)
- [ ] Integrate distributed-epc-api.js into existing backend
- [ ] Deploy updated backend to `136.112.111.167`
- [ ] Create Firebase Functions proxy for EPC endpoints
- [ ] Update HSS module to show remote EPCs tab

### Phase 3: Frontend Dashboard (Next)
- [ ] Create Remote EPCs management page
- [ ] Build real-time monitoring dashboard (like Nimbus)
- [ ] Add graphs and visualizations
- [ ] Implement filtering and search

### Phase 4: GitHub & Documentation (Next)
- [ ] Fork Open5GS to user's GitHub
- [ ] Fork rapid5gs (if needed)
- [ ] Create distributed EPC deployment repo
- [ ] Write comprehensive documentation

### Phase 5: Testing & Refinement
- [ ] Test EPC registration flow
- [ ] Test metrics collection
- [ ] Test attach/detach event tracking
- [ ] Load testing with multiple EPCs
- [ ] Security audit

## GitHub Repositories

### Planned Forks
1. **open5gs-distributed** - Fork of Open5GS with distributed EPC configs
2. **rapid5gs-distributed** (optional) - Modified rapid5gs for cloud HSS
3. **lte-pci-mapper** (existing) - Main management platform

### New Additions to lte-pci-mapper
- `/distributed-epc-schema.js` - MongoDB schemas
- `/distributed-epc-api.js` - API endpoints
- `/open5gs-metrics-agent.js` - Metrics collection agent
- `/install-distributed-epc.sh` - Installation script
- `/docs/distributed-epc/` - Documentation

## Metrics Agent Details

### What it Collects
- **System**: CPU, memory, disk, load average (via `os` module, `top`, `df`)
- **Open5GS Components**: Status of each daemon (via `systemctl`)
- **Subscribers**: Active sessions, attach/detach counts (from MongoDB or logs)
- **eNBs**: S1 connections, CellIDs (parsed from MME logs)
- **IP Pool**: OGSTUN utilization (from UPF/SMF config and state)
- **Logs**: Freshness timestamps (file `mtime`)

### Collection Methods
1. **systemd** - Component status (`systemctl is-active`)
2. **Log parsing** - MME/SMF logs for attach/detach, eNB connections
3. **MongoDB** (optional) - Direct HSS database queries
4. **Network namespace** - OGSTUN interface status
5. **System calls** - CPU, memory, disk via `os` and shell commands

### Configurable Options
- Collection interval (default: 60 seconds)
- Enabled metrics (can disable certain collections)
- Log level (error, warn, info, debug)

## Next Steps

1. **Integrate API into existing backend**
   ```bash
   # Add to deploy-hss-api.sh
   const distributedEPCRouter = require('./distributed-epc-api');
   app.use('/api', distributedEPCRouter);
   ```

2. **Create frontend components**
   - `Module_Manager/src/routes/modules/hss-management/components/RemoteEPCs.svelte`
   - `Module_Manager/src/routes/modules/hss-management/components/EPCMonitor.svelte`
   - `Module_Manager/src/routes/modules/hss-management/components/MetricsGraph.svelte`

3. **Fork repositories**
   ```bash
   # Use GitHub API or manual fork
   # Customize for distributed deployment
   ```

4. **Documentation**
   - Deployment guide
   - API reference
   - Troubleshooting guide
   - Architecture diagrams

## References

- **Nimbus Monitor**: http://72.55.193.194:8088/
- **Open5GS**: https://open5gs.org/
- **rapid5gs**: https://rapid5gs.com/
- **Our HSS API**: http://136.112.111.167:3000

---

**Status**: Phase 1 Complete - Ready for integration and frontend development
**Last Updated**: 2025-10-17

