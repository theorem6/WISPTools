# Fully Automated Deployment System - Complete

## Overview

The WISPTools.io minimal boot disc system is now **fully automated and tenant-specific**, requiring **zero user interaction** from boot to operational EPC with cloud connectivity.

## 🚀 Complete Automation Flow

```
┌─────────────────────────────────────────────────────────────┐
│  CREATE TENANT-SPECIFIC BOOT DISC                           │
│  (One-time on workstation)                                   │
├─────────────────────────────────────────────────────────────┤
│  $ sudo bash scripts/deployment/build-minimal-iso.sh \      │
│      tenant_abc123                                           │
│                                                              │
│  ✅ Downloads Ubuntu 24.04 ISO                              │
│  ✅ Embeds tenant ID in ISO                                 │
│  ✅ Creates bootable USB image                              │
│  ✅ Generates checksums                                      │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  FIELD DEPLOYMENT                                            │
│  (Technician just boots from USB - NO INTERACTION)          │
├─────────────────────────────────────────────────────────────┤
│  1. Boot from USB                                            │
│  2. Ubuntu auto-installs (5-10 min)                          │
│  3. System reboots                                           │
│  4. DHCP obtains network config                              │
│  5. wisptools-register.service starts                        │
│  6. Hardware detected automatically                          │
│  7. Network configuration detected                           │
│  8. POST to /api/epc/auto-register                           │
│  9. Receive EPC credentials + deployment script              │
│  10. Download and execute deployment script                  │
│  11. Install Open5GS components                              │
│  12. Configure MME/SGW/UPF/etc                               │
│  13. Connect to Cloud HSS (hss.wisptools.io)                 │
│  14. Start metrics agent                                     │
│  15. Begin reporting to wisptools.io                         │
│  ✅ EPC ONLINE - Ready for eNodeB connections                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│  CLOUD MONITORING                                            │
│  (Automatic continuous monitoring)                           │
├─────────────────────────────────────────────────────────────┤
│  • Heartbeat every 60 seconds                                │
│  • Full metrics every 60 seconds                             │
│  • Attach/detach events in real-time                         │
│  • Dashboard shows EPC status                                │
│  • Alerts on failures                                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### ✅ Zero-Touch Deployment
- **NO** user prompts during installation
- **NO** configuration needed
- **NO** technical knowledge required
- Just boot from USB and walk away

### ✅ Tenant-Specific
- Tenant ID embedded in ISO during creation
- Each EPC auto-registers to correct tenant
- Unique EPC ID and credentials generated
- Tenant-specific network configuration (MCC/MNC/TAC)

### ✅ DHCP Network Auto-Configuration
- Automatically obtains IP via DHCP
- Detects gateway and DNS
- Tests internet connectivity
- Configures all EPC components with detected IP

### ✅ Cloud HSS Integration
- Connects to `hss.wisptools.io` (or 136.112.111.167:3001)
- FreeDiameter configured automatically
- MME/PCRF connect to cloud HSS via Diameter
- No local HSS database needed

### ✅ Per-EPC, Per-Tenant Scripts
- Deployment script generated for each EPC
- Includes EPC-specific credentials
- Tenant-specific network settings
- Site name and location info

### ✅ Fully Automated Installation
- All Open5GS components installed
- Network configured automatically
- Services enabled and started
- Metrics agent configured with credentials

## Technical Details

### Tenant ID Embedding

#### During ISO Creation:
```bash
# Build tenant-specific ISO
sudo bash scripts/deployment/build-minimal-iso.sh tenant_wisp123

# ISO includes:
# - /etc/wisptools/tenant.conf with WISPTOOLS_TENANT_ID="tenant_wisp123"
# - cloud-init copies this file during installation
# - wisptools-register.sh reads it on first boot
```

#### Multiple Methods for Tenant ID:
1. **Embedded in ISO** (preferred for production)
2. **Boot parameter**: `wisptools_tenant=tenant_id`
3. **Config file**: `/etc/wisptools/tenant.conf`
4. **Manual entry**: Fallback if interactive terminal available

### Auto-Registration API

**Endpoint**: `POST /api/epc/auto-register`

**Request** (automatically generated):
```json
{
  "hardware_id": "550e8400-e29b-41d4-a716-446655440000",
  "mac_address": "00:11:22:33:44:55",
  "serial_number": "ABC123",
  "system_info": {
    "manufacturer": "Dell Inc.",
    "product": "PowerEdge R640",
    "hostname": "wisp-epc-node"
  },
  "network": {
    "primary_ip": "192.168.1.100",
    "gateway": "192.168.1.1",
    "interface": "ens160",
    "netmask": "24",
    "dns_servers": "8.8.8.8,8.8.4.4"
  },
  "os_info": {
    "os_version": "Ubuntu 24.04 LTS",
    "kernel_version": "6.8.0-45-generic"
  },
  "boot_time": "2025-10-26T10:30:00Z",
  "auto_provision": true
}
```

**Response**:
```json
{
  "success": true,
  "epc_id": "epc_a1b2c3d4e5f6",
  "auth_code": "abc123def456...",
  "api_key": "xyz789uvw012...",
  "secret_key": "secret_key_here...",
  "site_name": "Auto-wisp-epc-node",
  "network_config": {
    "mcc": "001",
    "mnc": "01",
    "tac": "54321",
    "apn": "internet",
    "dns_primary": "8.8.8.8",
    "dns_secondary": "8.8.4.4"
  },
  "deployment_script_url": "/api/epc/epc_a1b2c3d4e5f6/deployment-script",
  "message": "EPC auto-registered successfully..."
}
```

### Deployment Script Generation

**Generated per-EPC with**:
- EPC ID and credentials
- Tenant ID
- Network configuration (MCC/MNC/TAC)
- Cloud HSS address (hss.wisptools.io:3001)
- Auto-detected IP addresses
- Metrics agent configuration

**Script includes**:
1. Install Open5GS packages
2. Configure MME with tenant/EPC identity
3. Configure SGW-C/SGW-U/SMF/UPF/PCRF
4. Set up FreeDiameter for Cloud HSS
5. Install and configure metrics agent
6. Enable and start all services
7. Verify service status

### Cloud HSS Configuration

**FreeDiameter MME Config** (auto-generated):
```
Identity = "mme.epc_a1b2c3d4e5f6.wisptools.local";
Realm = "wisptools.local";

# Connect to Cloud HSS
ConnectPeer = "hss.wisptools.cloud" { 
    ConnectTo = "hss.wisptools.io"; 
    No_TLS; 
    Port = 3001; 
};

# Fallback to IP
ConnectPeer = "hss.cloud" { 
    ConnectTo = "136.112.111.167"; 
    No_TLS; 
    Port = 3001; 
};
```

### Metrics Agent Configuration

**Auto-configured with**:
```bash
# /etc/wisptools/metrics-agent.env
EPC_API_URL=https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy
EPC_ID=epc_a1b2c3d4e5f6
EPC_AUTH_CODE=abc123...
EPC_API_KEY=xyz789...
EPC_SECRET_KEY=secret...
EPC_TENANT_ID=tenant_wisp123
EPC_METRICS_INTERVAL=60
```

**Metrics sent**:
- Heartbeat every 60 seconds
- System metrics (CPU, memory, disk)
- Open5GS component status
- Subscriber counts
- Network throughput
- Attach/detach events

## Deployment Scenarios

### Scenario 1: Single WISP with Multiple Sites
```bash
# Create one tenant-specific ISO
sudo bash scripts/deployment/build-minimal-iso.sh tenant_mywisp

# Burn to 10 USB drives
# Send to 10 tower sites
# Each boots and auto-registers
# All appear in your tenant dashboard
```

### Scenario 2: WISP Service Provider (Multiple Tenants)
```bash
# Create ISOs for each tenant
sudo bash scripts/deployment/build-minimal-iso.sh tenant_wisp_a
sudo bash scripts/deployment/build-minimal-iso.sh tenant_wisp_b
sudo bash scripts/deployment/build-minimal-iso.sh tenant_wisp_c

# Each tenant gets their own USB
# EPCs register to correct tenant automatically
# No cross-tenant visibility
```

### Scenario 3: Lab Testing
```bash
# Create test tenant ISO
sudo bash scripts/deployment/build-minimal-iso.sh tenant_lab_test

# Test in VM
bash scripts/deployment/test-boot-disc.sh path/to/iso

# Watch auto-registration in dashboard
# Verify metrics reporting
# Test eNodeB connectivity
```

## Network Requirements

### Required (Minimum):
- ✅ DHCP server on network
- ✅ Internet connectivity (outbound)
- ✅ Port 443 outbound (HTTPS to wisptools.io)

### Recommended:
- Static DHCP reservation (for consistent MME IP)
- Firewall rules for eNodeB connections (S1AP port 36412)
- QoS for S1-U GTP traffic

### Cloud HSS Connectivity:
- **Hostname**: `hss.wisptools.io` (future)
- **Current IP**: `136.112.111.167`
- **Port**: `3001` (HSS Management API)
- **Protocol**: Diameter (S6a interface)
- **Fallback**: System tries hostname first, falls back to IP

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BOOT DISC ISO                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Ubuntu 24.04 Base                                  │    │
│  │  + cloud-init autoinstall                           │    │
│  │  + wisptools-register.sh                            │    │
│  │  + Embedded Tenant ID                               │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                        ↓ (boots)
┌─────────────────────────────────────────────────────────────┐
│                    EPC NODE                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Network Auto-Config (DHCP)                         │    │
│  │  ├─ IP: 192.168.1.100                               │    │
│  │  ├─ Gateway: 192.168.1.1                            │    │
│  │  └─ DNS: 8.8.8.8, 8.8.4.4                           │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Open5GS EPC Stack                                  │    │
│  │  ├─ MME (S1-MME @ :36412)                           │    │
│  │  ├─ SGW-C/SGW-U                                     │    │
│  │  ├─ SMF/UPF                                         │    │
│  │  └─ PCRF                                            │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  FreeDiameter (Diameter Client)                     │    │
│  │  └─ Connects to Cloud HSS                           │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Metrics Agent                                      │    │
│  │  └─ Reports every 60s to wisptools.io              │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
              ↓ (Diameter S6a)          ↓ (HTTPS)
┌─────────────────────────────────────────────────────────────┐
│              WISPTOOLS.IO CLOUD                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Cloud HSS (hss.wisptools.io:3001)                  │    │
│  │  ├─ Diameter Server (S6a interface)                 │    │
│  │  ├─ Subscriber Database (MongoDB)                   │    │
│  │  └─ Authentication Vectors                          │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Auto-Registration API                              │    │
│  │  ├─ POST /api/epc/auto-register                     │    │
│  │  ├─ Generates EPC credentials                       │    │
│  │  └─ Returns deployment script                       │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Metrics Collection API                             │    │
│  │  ├─ POST /api/metrics/heartbeat                     │    │
│  │  ├─ POST /api/metrics/submit                        │    │
│  │  └─ Stores in MongoDB                               │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Dashboard & Management                             │    │
│  │  ├─ Tenant Dashboard                                │    │
│  │  ├─ EPC Status Monitoring                           │    │
│  │  ├─ Subscriber Management                           │    │
│  │  └─ Real-time Metrics                               │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Files Modified

### Backend API:
- ✅ `distributed-epc/routes/auto-register.js` - Auto-registration with tenant support
- ✅ `distributed-epc/utils/script-generator.js` - Automated deployment scripts
- ✅ `distributed-epc/index.js` - Added auto-register routes

### Deployment Scripts:
- ✅ `scripts/deployment/wisptools-register.sh` - Enhanced tenant detection
- ✅ `scripts/deployment/build-minimal-iso.sh` - Tenant ID embedding

### Schema:
- ✅ `distributed-epc-schema.js` - Hardware/network/deployment info

## Success Criteria

### For Technician:
1. Receive USB drive
2. Boot target hardware from USB
3. Wait 15-20 minutes
4. Verify "EPC ONLINE" message on console
5. Done - no other steps needed

### For Network Operator:
1. Create tenant-specific ISO once
2. See new EPC appear in dashboard
3. Verify heartbeat and metrics
4. Configure eNodeB to point to new MME
5. Add subscribers via HSS Management
6. Monitor in real-time dashboard

### For System:
1. ✅ Boot and install without interaction
2. ✅ Detect hardware and network
3. ✅ Register with correct tenant
4. ✅ Download and execute deployment
5. ✅ Connect to Cloud HSS
6. ✅ Start reporting metrics
7. ✅ Accept eNodeB connections

## Production Readiness

### ✅ Implemented:
- Zero-touch deployment
- Tenant-specific configuration
- DHCP network auto-configuration
- Cloud HSS integration
- Per-EPC deployment scripts
- Automated service installation
- Metrics agent with authentication
- Duplicate hardware prevention
- Error handling and logging

### 🔄 TODO for Production:
- [ ] Tenant MCC/MNC pool management
- [ ] Geographic IP geolocation for location
- [ ] HSS DNS (hss.wisptools.io) configuration
- [ ] TLS/certificate support for Diameter
- [ ] Advanced health monitoring and alerts
- [ ] Remote management capabilities
- [ ] OTA software updates

## Deployment Timeline

### Week 1: Testing
- Build test ISO
- Deploy in VM
- Verify auto-registration
- Test metrics collection

### Week 2: Pilot
- Create production ISOs for 2-3 tenants
- Deploy to 5-10 sites
- Monitor for issues
- Gather feedback

### Week 3: Scale
- Create ISOs for all tenants
- Deploy to production sites
- Monitor dashboard
- Support field deployments

## Support & Monitoring

### Logs to Monitor:
```bash
# Registration
tail -f /var/log/wisptools-register.log

# Metrics agent
journalctl -u open5gs-metrics-agent -f

# Open5GS services
journalctl -u open5gs-mmed -f
```

### Dashboard Monitoring:
- https://wisptools.io/distributed-epc
- Real-time EPC status
- Metrics graphs
- Subscriber activity
- Alert history

## Conclusion

The WISPTools.io minimal boot disc system provides **complete automation** from boot to operational EPC:

✅ **Zero-touch**: No user interaction required  
✅ **Tenant-specific**: Isolated per tenant  
✅ **DHCP**: Automatic network configuration  
✅ **Cloud HSS**: Connects to hss.wisptools.io  
✅ **Per-EPC**: Unique credentials and config  
✅ **Automated**: Full software installation  
✅ **Monitored**: Real-time metrics to cloud  

**Just boot, walk away, and monitor from dashboard!**

---

**Implementation Date**: October 26, 2025  
**Version**: 2.0 - Fully Automated  
**Status**: ✅ Complete - Ready for Testing  
**Repository**: theorem6/lte-pci-mapper

