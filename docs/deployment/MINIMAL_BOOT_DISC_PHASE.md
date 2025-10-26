# Minimal Boot Disc System - Automated EPC Deployment

## Overview

This phase creates a minimal Ubuntu 24.04 LTS boot disc image that can be deployed on-the-fly to remote sites. The system boots, obtains network configuration via DHCP, and automatically registers with wisptools.io for management.

## Architecture

### Boot Sequence
1. **BIOS/UEFI Boot** → Load Ubuntu 24.04 minimal kernel
2. **Network Init** → DHCP on primary ethernet interface  
3. **First Boot** → Run registration script
4. **Check-In** → Contact wisptools.io EPC registration API
5. **Deploy** → Download and execute site-specific deployment script
6. **Monitor** → Start metrics agent for continuous monitoring

### System Components

```
┌─────────────────────────────────────────────────────────┐
│  Minimal Boot Disc (Ubuntu 24.04 LTS)                   │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Core OS (~400MB compressed)                   │    │
│  │  - Linux kernel 6.8+                            │    │
│  │  - systemd init                                 │    │
│  │  - NetworkManager/netplan (DHCP)               │    │
│  │  - curl, wget, ca-certificates                 │    │
│  │  - Node.js 20.x (for metrics agent)           │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  First-Boot Service                             │    │
│  │  - /opt/wisptools-register.sh                  │    │
│  │  - Runs once on first boot                     │    │
│  │  - Contacts wisptools.io API                   │    │
│  │  - Downloads deployment script                 │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ↓
┌─────────────────────────────────────────────────────────┐
│  wisptools.io (lte-pci-mapper-65450042-bbf71)          │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  EPC Registration API                           │    │
│  │  POST /api/epc/auto-register                   │    │
│  │  - Accepts hardware ID, IP, location           │    │
│  │  - Returns EPC credentials + deployment script │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Metrics Collection API                         │    │
│  │  POST /api/metrics/heartbeat                   │    │
│  │  POST /api/metrics/submit                      │    │
│  │  - EPC auth via X-EPC-Auth-Code                │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Base System Requirements

### Ubuntu 24.04 LTS Minimal
- **Base**: Ubuntu Server 24.04 LTS (Noble Numbat)
- **Kernel**: 6.8+ (HWE for newer hardware support)
- **Init**: systemd
- **Size**: ~400MB compressed ISO, ~1.2GB installed
- **Boot**: UEFI + Legacy BIOS support

### Essential Packages Only
```
# Core system
linux-image-generic
systemd
udev
kmod

# Networking
netplan.io
network-manager
iproute2
iputils-ping
dnsmasq-base
dhcpcd5

# Security & Certificates
ca-certificates
openssl
ssh

# Utilities
curl
wget
jq
git
nano

# Node.js (for metrics agent)
nodejs (20.x from NodeSource PPA)
npm

# Open5GS dependencies (installed later)
# These are NOT in the base image, downloaded during deployment
```

### Excluded Packages (Save Space)
- Desktop environment (no GUI)
- Documentation packages
- Kernel headers/dev packages
- Man pages
- Locales (except en_US.UTF-8)
- Printer support
- Bluetooth/WiFi firmware (if not needed)

## Registration Flow

### 1. Hardware Identification
```bash
# Generate unique hardware ID from:
HARDWARE_ID=$(cat /sys/class/dmi/id/product_uuid)
MAC_ADDRESS=$(ip link show | grep ether | head -1 | awk '{print $2}')
SERIAL=$(dmidecode -s system-serial-number)
```

### 2. Network Detection
```bash
# Get primary interface with default route
PRIMARY_IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
PRIMARY_IP=$(ip addr show $PRIMARY_IFACE | grep "inet " | awk '{print $2}' | cut -d/ -f1)
GATEWAY=$(ip route | grep default | awk '{print $3}' | head -1)
```

### 3. API Registration
```bash
# POST to wisptools.io
curl -X POST \
  https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/epc/auto-register \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -d '{
    "hardware_id": "'$HARDWARE_ID'",
    "mac_address": "'$MAC_ADDRESS'",
    "serial_number": "'$SERIAL'",
    "network": {
      "primary_ip": "'$PRIMARY_IP'",
      "gateway": "'$GATEWAY'",
      "interface": "'$PRIMARY_IFACE'"
    },
    "os_version": "Ubuntu 24.04 LTS",
    "boot_time": "'$(date -Iseconds)'",
    "auto_provision": true
  }'
```

### 4. Response Handling
```json
{
  "success": true,
  "epc_id": "epc_a1b2c3d4e5f6",
  "auth_code": "abc123...",
  "api_key": "xyz789...",
  "secret_key": "secret...",
  "site_name": "Auto-Provisioned Site",
  "network_config": {
    "mcc": "310",
    "mnc": "410",
    "tac": "1"
  },
  "deployment_script_url": "/api/epc/epc_a1b2c3d4e5f6/deployment-script",
  "message": "EPC auto-registered. Proceeding with installation..."
}
```

### 5. Execute Deployment
```bash
# Download deployment script
curl -o /tmp/deploy-epc.sh \
  "https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy${deployment_script_url}"

# Make executable and run
chmod +x /tmp/deploy-epc.sh
bash /tmp/deploy-epc.sh
```

## Boot Disc Creation

### Method 1: Cloud-Init ISO (Recommended)
Create an ISO with cloud-init autoinstall configuration:

```yaml
#cloud-config
autoinstall:
  version: 1
  identity:
    hostname: wisp-epc-node
    password: "$6$rounds=4096$saltsalt$hashhash"
    username: wisp
  ssh:
    install-server: yes
    allow-pw: no
  storage:
    layout:
      name: direct
      match:
        size: largest
  network:
    version: 2
    ethernets:
      any:
        match:
          name: en*
        dhcp4: true
        dhcp6: false
  late-commands:
    - curtin in-target --target=/target -- wget -O /opt/wisptools-register.sh https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/scripts/deployment/wisptools-register.sh
    - curtin in-target --target=/target -- chmod +x /opt/wisptools-register.sh
    - curtin in-target --target=/target -- systemctl enable wisptools-register.service
```

### Method 2: Custom Preseed
Use debian-installer preseed for fully automated installation.

### Method 3: Live System Customization
Customize Ubuntu Live Server ISO with:
- Squashfs filesystem modifications
- Custom initramfs
- Preloaded scripts

## First-Boot Service

### systemd Service Unit
```ini
[Unit]
Description=WISPTools.io Auto-Registration Service
After=network-online.target
Wants=network-online.target
ConditionPathExists=!/var/lib/wisptools/.registered

[Service]
Type=oneshot
ExecStart=/opt/wisptools-register.sh
RemainAfterExit=yes
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Registration Script
See `scripts/deployment/wisptools-register.sh` for full implementation.

## Tenant Configuration

### Embedded Tenant ID
For site-specific discs, embed the tenant ID:

```bash
# Burned into ISO at build time
echo "WISPTOOLS_TENANT_ID=tenant_12345" > /etc/wisptools/tenant.conf
```

### Dynamic Tenant Discovery
For generic discs, use location-based or operator-prompt:

```bash
# Prompt during first boot
read -p "Enter your WISPTools Tenant ID: " TENANT_ID
echo "WISPTOOLS_TENANT_ID=$TENANT_ID" > /etc/wisptools/tenant.conf
```

## Security Considerations

### Secure Boot
- Sign kernel and bootloader for UEFI Secure Boot
- Validate all downloaded scripts with GPG signatures

### Credentials Storage
```bash
# Store credentials securely
mkdir -p /etc/wisptools
chmod 700 /etc/wisptools

cat > /etc/wisptools/credentials.env <<EOF
EPC_AUTH_CODE="${auth_code}"
EPC_API_KEY="${api_key}"
EPC_SECRET_KEY="${secret_key}"
EPC_ID="${epc_id}"
EOF

chmod 600 /etc/wisptools/credentials.env
```

### Network Security
- TLS 1.3 only for API connections
- Certificate pinning for wisptools.io
- Firewall rules (ufw) enabled by default

## Deployment Scenarios

### 1. Physical Server Deployment
```
1. Burn ISO to USB drive
2. Boot from USB on target hardware
3. Ubuntu autoinstalls (5-10 minutes)
4. System reboots
5. First-boot service runs
6. EPC registers and deploys
```

### 2. VM Deployment (Development)
```
1. Load ISO in VM (VirtualBox, VMware, KVM)
2. Autoinstall proceeds
3. Bridge network to get real DHCP
4. Test registration flow
```

### 3. PXE Network Boot
```
1. Configure PXE server with minimal ISO
2. Target system PXE boots
3. Download kernel/initrd over TFTP
4. Autoinstall from HTTP
5. Register and deploy
```

### 4. Cloud Instance (GCE/AWS/Azure)
```
1. Upload custom image to cloud provider
2. Launch instance
3. Cloud-init handles initial config
4. Register with wisptools.io
5. Deploy EPC components
```

## Monitoring & Management

### Health Checks
After registration, the system:
1. Starts `open5gs-metrics-agent` service
2. Sends heartbeat every 60 seconds
3. Reports full metrics every 5 minutes

### Remote Management
Once registered, system can be:
- Updated via wisptools.io API commands
- Reconfigured remotely
- Monitored in real-time dashboard
- Debugged via SSH (if enabled)

## Build Scripts

### ISO Builder
See: `scripts/deployment/build-minimal-iso.sh`

### Testing
See: `scripts/deployment/test-boot-disc.sh`

## Implementation Phases

### Phase 1: Manual ISO Creation ✅ (This Document)
- Document requirements
- Create registration script
- Define API endpoints needed

### Phase 2: API Endpoints
- Implement `/api/epc/auto-register` endpoint
- Add hardware ID tracking to database
- Create auto-provisioning logic

### Phase 3: ISO Builder Script
- Automated ISO creation script
- Cloud-init configuration generator
- Tenant ID embedding

### Phase 4: Testing & Validation
- VM testing
- Physical hardware testing
- PXE boot testing

### Phase 5: Production Deployment
- Create production ISOs
- Distribute to field technicians
- Monitor auto-registrations

## Next Steps

1. **Implement Auto-Register API** (distributed-epc)
   - Add `/api/epc/auto-register` route
   - Handle hardware ID uniqueness
   - Generate site configurations

2. **Create Registration Script** (wisptools-register.sh)
   - Hardware detection
   - API call with retry logic
   - Deployment script execution

3. **Build ISO Creator** (build-minimal-iso.sh)
   - Download Ubuntu 24.04 Server ISO
   - Customize with cloud-init
   - Repack ISO with custom scripts

4. **Test in Lab**
   - Create test VM
   - Boot from ISO
   - Verify registration
   - Check EPC deployment

5. **Document for Field Use**
   - Create technician guide
   - USB burning instructions
   - Troubleshooting guide

---

**Status**: 📋 Planning Phase  
**Target**: Q4 2025  
**Owner**: Infrastructure Team  
**Dependencies**: 
- Distributed EPC API (✅ Complete)
- HSS Management Backend (✅ Complete)
- Metrics Collection System (✅ Complete)

