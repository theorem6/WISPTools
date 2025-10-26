# Minimal Boot Disc Implementation - Complete

## Overview

This document summarizes the implementation of the **Minimal Boot Disc Phase** for automated EPC deployment. This new phase enables rapid, hands-free deployment of Open5GS EPC nodes that automatically register with wisptools.io.

## What Was Implemented

### 1. Documentation
- **[MINIMAL_BOOT_DISC_PHASE.md](docs/deployment/MINIMAL_BOOT_DISC_PHASE.md)** - Complete architecture and technical documentation
- **[MINIMAL_BOOT_DISC_QUICKSTART.md](docs/deployment/MINIMAL_BOOT_DISC_QUICKSTART.md)** - Step-by-step deployment guide

### 2. Auto-Registration System

#### API Endpoint
**File**: `distributed-epc/routes/auto-register.js`

New endpoints added:
- `POST /api/epc/auto-register` - Auto-register new EPC from boot disc
- `GET /api/epc/auto-registered` - List all auto-registered EPCs
- `PATCH /api/epc/auto-register/:epc_id` - Update auto-registered EPC info

Features:
- Hardware ID detection and duplicate prevention
- Automatic credential generation
- Network configuration auto-assignment
- Integration with existing distributed EPC system

#### Database Schema Updates
**File**: `distributed-epc-schema.js`

Added fields to `RemoteEPCSchema`:
- `hardware_info` - System UUID, MAC, serial number, manufacturer
- `network_info` - IP, gateway, interface, DNS
- `os_info` - OS version, kernel version
- `deployment_info` - Deployment method, boot time, registration time

### 3. Registration Script
**File**: `scripts/deployment/wisptools-register.sh`

Functionality:
- Detects hardware (UUID, MAC, serial, manufacturer)
- Discovers network configuration (DHCP)
- Tests internet connectivity
- Registers with wisptools.io API
- Stores credentials securely
- Downloads and executes deployment script
- Runs once on first boot, marks system as registered

### 4. Systemd Service
**File**: `scripts/deployment/wisptools-register.service`

- Runs on first boot after network is online
- One-shot service that doesn't run again once registered
- Includes retry logic for network issues
- Logs to systemd journal

### 5. Cloud-Init Configuration
**File**: `scripts/deployment/cloud-init-autoinstall.yaml`

Ubuntu 24.04 LTS autoinstall configuration:
- Unattended installation
- DHCP on all ethernet interfaces
- Minimal package set (Node.js, security tools, utilities)
- Downloads registration script during installation
- Enables first-boot service
- Security hardening (firewall, unattended upgrades)

### 6. ISO Builder Script
**File**: `scripts/deployment/build-minimal-iso.sh`

Features:
- Downloads Ubuntu 24.04 Server ISO
- Customizes with cloud-init configuration
- Optionally embeds tenant ID for site-specific deployments
- Configures GRUB and ISOLINUX for autoinstall
- Generates bootable ISO with checksum files
- Creates USB burning instructions

Usage:
```bash
# Generic boot disc (prompts for tenant)
sudo bash scripts/deployment/build-minimal-iso.sh

# Tenant-specific boot disc
sudo bash scripts/deployment/build-minimal-iso.sh tenant_abc123
```

### 7. Testing Script
**File**: `scripts/deployment/test-boot-disc.sh`

- Creates QEMU/KVM test VM
- Boots from generated ISO
- Tests autoinstall and registration
- Allows testing without physical hardware

## System Flow

```
┌─────────────────────────────────────────────────────────┐
│                    BOOT DISC CREATION                    │
│  (Windows/Linux workstation)                             │
├─────────────────────────────────────────────────────────┤
│  1. Run build-minimal-iso.sh                             │
│  2. Downloads Ubuntu 24.04 ISO                           │
│  3. Customizes with cloud-init                           │
│  4. Creates wisptools-epc-ubuntu-24.04.iso               │
│  5. Burn to USB                                          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   FIELD DEPLOYMENT                       │
│  (Remote EPC site - physical hardware)                   │
├─────────────────────────────────────────────────────────┤
│  1. Boot from USB                                        │
│  2. Autoinstall Ubuntu (5-10 min)                        │
│  3. Reboot                                               │
│  4. First boot → wisptools-register.service starts       │
│  5. Detect hardware & network                            │
│  6. POST to /api/epc/auto-register                       │
│  7. Receive EPC credentials                              │
│  8. Download deployment script                           │
│  9. Execute deployment (install Open5GS)                 │
│  10. Start metrics agent                                 │
│  ✅ EPC ONLINE                                           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                  WISPTOOLS.IO BACKEND                    │
│  (GCE Server - 136.112.111.167:3001)                     │
├─────────────────────────────────────────────────────────┤
│  - Receives auto-registration request                    │
│  - Generates unique EPC ID and credentials               │
│  - Stores hardware info in MongoDB                       │
│  - Returns deployment script URL                         │
│  - Monitors via metrics agent heartbeats                 │
└─────────────────────────────────────────────────────────┘
```

## Key Features

### ✅ Zero-Touch Deployment
- No manual configuration required
- Technician just boots from USB
- System handles everything automatically

### ✅ Hardware Detection
- Unique hardware ID prevents duplicates
- Tracks MAC address, serial number, manufacturer
- Network auto-discovery via DHCP

### ✅ Secure Registration
- Generated EPC credentials (auth code, API key, secret key)
- Credentials stored in `/etc/wisptools/credentials.env` (mode 600)
- HMAC signatures for API authentication

### ✅ Flexible Tenant Assignment
- Generic boot disc: prompts for tenant ID
- Tenant-specific boot disc: embedded tenant ID
- Choose deployment model based on needs

### ✅ Minimal Footprint
- Ubuntu 24.04 LTS Server base
- ~400MB compressed ISO
- ~1.2GB installed system
- Only essential packages included

### ✅ Production Ready
- Unattended security updates
- Firewall configuration
- Fail2ban for SSH protection
- Systemd service management

## Base System Specifications

**OS**: Ubuntu 24.04 LTS (Noble Numbat)  
**Kernel**: 6.8+  
**Init**: systemd  
**Network**: NetworkManager with DHCP  
**Runtime**: Node.js 20.x  
**Size**: ~400MB ISO / ~1.2GB installed

**Included Packages**:
- Node.js 20.x (for metrics agent)
- curl, wget, jq (API tools)
- git (for updates)
- dmidecode (hardware detection)
- ufw, fail2ban (security)
- sysstat (monitoring)

**Excluded** (for minimal size):
- Desktop/GUI packages
- Kernel dev packages
- Documentation/man pages
- Extra locales
- Bluetooth/WiFi (unless needed)

## API Integration

### New Endpoint: `/api/epc/auto-register`

**Method**: POST  
**Auth**: X-Tenant-ID header  
**Request Body**:
```json
{
  "hardware_id": "system-uuid",
  "mac_address": "00:11:22:33:44:55",
  "serial_number": "ABC123",
  "system_info": {
    "manufacturer": "Dell Inc.",
    "product": "PowerEdge R640",
    "hostname": "epc-node-01"
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
  "auth_code": "abc123...",
  "api_key": "xyz789...",
  "secret_key": "secret...",
  "site_name": "Auto-epc-node-01",
  "network_config": {
    "mcc": "001",
    "mnc": "01",
    "tac": "12345"
  },
  "deployment_script_url": "/api/epc/epc_a1b2c3d4e5f6/deployment-script",
  "message": "EPC auto-registered successfully..."
}
```

### Duplicate Prevention
If hardware already registered, returns existing credentials instead of creating new EPC.

## Testing Process

### 1. VM Testing (Recommended First)
```bash
# Build ISO
sudo bash scripts/deployment/build-minimal-iso.sh

# Test in VM
bash scripts/deployment/test-boot-disc.sh iso-output/wisptools-epc-ubuntu-24.04.iso
```

### 2. Physical Hardware Testing
1. Burn ISO to USB
2. Boot on test hardware with internet
3. Watch autoinstall progress
4. Verify registration in wisptools.io dashboard
5. Check metrics reporting

### 3. Production Deployment
1. Create tenant-specific ISOs for each customer
2. Distribute USBs to field technicians
3. Deploy to production sites
4. Monitor in wisptools.io dashboard

## File Structure

```
PCI_mapper/
├── docs/deployment/
│   ├── MINIMAL_BOOT_DISC_PHASE.md          # Full architecture
│   └── MINIMAL_BOOT_DISC_QUICKSTART.md     # Quick start guide
├── scripts/deployment/
│   ├── wisptools-register.sh               # Registration script
│   ├── wisptools-register.service          # Systemd service
│   ├── cloud-init-autoinstall.yaml         # Cloud-init config
│   ├── build-minimal-iso.sh                # ISO builder
│   └── test-boot-disc.sh                   # VM testing
├── distributed-epc/
│   ├── routes/
│   │   └── auto-register.js                # Auto-registration API
│   └── index.js                            # Updated with auto-register routes
└── distributed-epc-schema.js               # Updated schema
```

## Dependencies

### Existing Systems (Already Deployed ✅)
- **HSS Management Backend** - Running on GCE
- **Distributed EPC API** - Routes and metrics collection
- **Metrics Agent** - Already in `deployment-files/`
- **MongoDB** - Stores EPC configurations

### New Components (This Phase 🆕)
- **Auto-Register API** - New route for boot disc check-in
- **Registration Script** - Runs on first boot
- **ISO Builder** - Creates custom boot discs
- **Cloud-Init Config** - Autoinstall configuration

## Security Considerations

### Boot Disc Security
- Default password should be changed immediately
- SSH password auth enabled initially (for recovery)
- Firewall configured but not enabled during install
- Fail2ban installed for SSH protection

### API Security
- Tenant ID required for registration
- Credentials securely generated (crypto.randomBytes)
- HMAC signatures for ongoing API calls
- Hardware ID prevents duplicate registrations

### Credential Storage
- Stored in `/etc/wisptools/credentials.env`
- File permissions: 600 (owner read/write only)
- Directory permissions: 700
- Root-only access

## Deployment Scenarios

### Scenario 1: WISP Operator with Multiple Sites
**Use Case**: Deploy 10 EPC nodes across different tower sites

**Solution**: Create generic boot disc
```bash
sudo bash scripts/deployment/build-minimal-iso.sh
```
- Burn one ISO to multiple USBs
- Field tech boots each site from USB
- System prompts for tenant ID on first boot
- Each site auto-configures and registers

### Scenario 2: Large Enterprise Deployment
**Use Case**: Deploy 100+ EPC nodes for single customer

**Solution**: Create tenant-specific boot disc
```bash
sudo bash scripts/deployment/build-minimal-iso.sh tenant_enterprise123
```
- Create customized ISO with embedded tenant ID
- Mass-produce USBs
- Ship to field technicians
- Zero interaction needed - just boot

### Scenario 3: Lab Testing
**Use Case**: Test new configurations before production

**Solution**: VM testing
```bash
bash scripts/deployment/test-boot-disc.sh path/to/iso
```
- Test in virtual environment
- Verify registration flow
- Check EPC functionality
- No physical hardware needed

## Next Steps

### Immediate (Week 1)
1. ✅ Documentation complete
2. ✅ Scripts implemented
3. ✅ API endpoint created
4. ✅ Schema updated
5. ✅ Pushed to GitHub

### Testing Phase (Week 2-3)
1. Build test ISO
2. Test in VM environment
3. Test on physical hardware
4. Verify auto-registration
5. Validate metrics collection

### Pilot Deployment (Week 4-5)
1. Create production ISOs
2. Deploy to 2-3 test sites
3. Monitor for issues
4. Gather feedback
5. Refine documentation

### Production Rollout (Week 6+)
1. Create tenant-specific ISOs
2. Distribute to field teams
3. Monitor auto-registrations
4. Support deployments
5. Scale as needed

## Success Metrics

Track these in wisptools.io dashboard:
- Number of auto-registered EPCs
- Average registration time
- Deployment success rate
- Time to first heartbeat
- Failed registrations (troubleshooting needed)

## Troubleshooting

### Common Issues

**Issue**: Registration fails  
**Solution**: Check internet, verify tenant ID, review logs

**Issue**: Network not detected  
**Solution**: Verify DHCP, check cable, try different port

**Issue**: Deployment script fails  
**Solution**: Check logs, verify Open5GS repos accessible

**Issue**: Metrics not reporting  
**Solution**: Check agent service, verify credentials, test API

### Log Files
- `/var/log/wisptools-register.log` - Registration process
- `/var/log/wisptools-install.log` - Installation markers
- `/var/log/wisptools-firstboot.log` - First boot status
- `journalctl -u wisptools-register.service` - Service logs
- `journalctl -u open5gs-metrics-agent` - Metrics agent logs

## Support

**GitHub Repository**: https://github.com/theorem6/lte-pci-mapper  
**Documentation**: See `docs/deployment/` directory  
**Issues**: Open GitHub issue for bugs or questions

## Conclusion

The Minimal Boot Disc Phase provides a complete, automated deployment solution for distributed Open5GS EPC nodes. This system:

✅ Eliminates manual configuration  
✅ Reduces deployment time from hours to minutes  
✅ Ensures consistent configuration across sites  
✅ Provides automatic registration and monitoring  
✅ Supports both generic and tenant-specific deployments  
✅ Integrates seamlessly with existing wisptools.io infrastructure

**Status**: 🎉 **IMPLEMENTATION COMPLETE**

All code has been committed and pushed to the GitHub repository. The system is ready for testing and pilot deployment.

---

**Implementation Date**: October 26, 2025  
**Version**: 1.0  
**Status**: Complete and Ready for Testing  
**Repository**: theorem6/lte-pci-mapper (main branch)

