# Minimal Boot Disc - Quick Start Guide

## Overview

This guide walks you through creating and deploying the WISPTools.io minimal boot disc for automated EPC deployment.

## Prerequisites

### Build System Requirements
- Ubuntu 20.04 or 22.04 (or similar Debian-based Linux)
- Root/sudo access
- 10GB free disk space
- Internet connection

### Deployment Target Requirements
- x86_64 hardware (Intel/AMD CPU)
- 4GB+ RAM
- 20GB+ storage
- Ethernet port with DHCP network
- Internet connectivity

## Quick Start

### 1. Build the Boot Disc

```bash
# Clone the repository
git clone https://github.com/theorem6/lte-pci-mapper.git
cd lte-pci-mapper

# Run the ISO builder (without tenant ID - will prompt on boot)
sudo bash scripts/deployment/build-minimal-iso.sh

# Or with embedded tenant ID for site-specific deployments
sudo bash scripts/deployment/build-minimal-iso.sh tenant_abc123xyz
```

The build process will:
- Download Ubuntu 24.04 Server ISO (~2GB)
- Extract and customize with cloud-init
- Add WISPTools.io registration scripts
- Create bootable ISO in `iso-output/`

**Expected time**: 10-20 minutes (depending on internet speed)

### 2. Test in Virtual Machine

```bash
# Test the generated ISO
bash scripts/deployment/test-boot-disc.sh iso-output/wisptools-epc-ubuntu-24.04.iso
```

This will:
- Create a test VM with QEMU/KVM
- Boot from the ISO
- Perform automated installation
- Allow you to test first-boot registration

### 3. Burn to USB Drive

#### Linux
```bash
# Find your USB device (be careful!)
lsblk

# Burn ISO to USB (replace sdX with your USB device)
sudo dd if=iso-output/wisptools-epc-ubuntu-24.04.iso of=/dev/sdX bs=4M status=progress && sync
```

#### Windows
1. Download [Rufus](https://rufus.ie/)
2. Select your USB drive
3. Select the ISO file
4. Click "Start"

#### macOS
```bash
# Find your USB device
diskutil list

# Unmount the device
diskutil unmountDisk /dev/diskX

# Burn ISO (replace diskX with your USB device)
sudo dd if=iso-output/wisptools-epc-ubuntu-24.04.iso of=/dev/rdiskX bs=1m

# Eject
diskutil eject /dev/diskX
```

### 4. Deploy to Hardware

1. **Insert USB** into target hardware
2. **Boot from USB** (press F12, F2, or DEL during boot to access boot menu)
3. **Watch installation** (5-10 minutes)
   - System will auto-install Ubuntu 24.04
   - No interaction required
   - System will reboot automatically
4. **First boot** (2-5 minutes)
   - System will detect hardware
   - Auto-register with wisptools.io
   - Download and execute deployment script
   - Install and configure Open5GS EPC

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Boot from USB                                                │
│   ↓                                                          │
│ Automated Ubuntu Installation (5-10 min)                    │
│   ↓                                                          │
│ Reboot                                                       │
│   ↓                                                          │
│ First Boot - Network Detection                              │
│   ↓                                                          │
│ Hardware Identification                                      │
│   ↓                                                          │
│ Register with wisptools.io                                   │
│   ↓                                                          │
│ Download Deployment Script                                   │
│   ↓                                                          │
│ Install Open5GS Components (10-15 min)                      │
│   ↓                                                          │
│ Configure EPC                                                │
│   ↓                                                          │
│ Start Metrics Agent                                          │
│   ↓                                                          │
│ ✅ EPC ONLINE                                                │
└─────────────────────────────────────────────────────────────┘
```

## Tenant Configuration

### Option 1: Generic Boot Disc (No Tenant ID)
System will prompt for tenant ID on first boot.

**Best for**: Small deployments, testing, multiple tenants

```bash
sudo bash scripts/deployment/build-minimal-iso.sh
```

### Option 2: Tenant-Specific Boot Disc
Tenant ID embedded in ISO, no prompt needed.

**Best for**: Large deployments, single tenant, field technicians

```bash
sudo bash scripts/deployment/build-minimal-iso.sh tenant_abc123xyz
```

## Default Credentials

**Username**: `wisp`  
**Password**: `wisp123`

⚠️ **IMPORTANT**: Change immediately after first login!

```bash
# SSH to the system
ssh wisp@<ip-address>

# Change password
passwd
```

## Network Requirements

### Required:
- ✅ DHCP server on network
- ✅ Internet connectivity
- ✅ Outbound HTTPS (port 443) to:
  - `us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net`
  - `github.com` (for script downloads)
  - `deb.nodesource.com` (for Node.js)
  - `ppa.launchpad.net` (for Open5GS)

### Optional:
- SSH access (port 22) for remote management
- Static IP assignment (can be configured after installation)

## Monitoring Deployment

### During Installation
Watch the screen - you'll see:
- Ubuntu installer progress
- Package installation
- Cloud-init execution
- System reboot

### After First Boot
Check registration status:
```bash
# View registration log
sudo tail -f /var/log/wisptools-register.log

# Check service status
sudo systemctl status wisptools-register.service

# View full system log
sudo journalctl -u wisptools-register.service -f
```

### In wisptools.io Dashboard
1. Log in to wisptools.io
2. Navigate to **Distributed EPC** section
3. Look for new auto-registered EPC
4. Verify status shows "online"
5. Check metrics are being received

## Troubleshooting

### Installation Hangs
- Check BIOS boot order (USB should be first)
- Verify ISO integrity: `sha256sum -c wisptools-epc-ubuntu-24.04.iso.sha256`
- Try recreating USB drive
- Test in VM first

### Network Not Detected
- Verify DHCP is working: `sudo dhclient -v`
- Check cable connection
- Try different network port
- Review: `journalctl -xe | grep network`

### Registration Fails
- Check internet connectivity: `curl https://www.google.com`
- Verify tenant ID (if embedded or prompted)
- Check logs: `sudo cat /var/log/wisptools-register.log`
- Test API manually:
  ```bash
  curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/health
  ```

### Can't Login
- Default credentials: `wisp` / `wisp123`
- Access via physical console if SSH not working
- Boot to recovery mode if needed

## Advanced Configuration

### Custom Packages
Edit `cloud-init-autoinstall.yaml` and add to `packages:` section:
```yaml
packages:
  - your-package-here
```

### Custom Network Config
Edit network section in `cloud-init-autoinstall.yaml`:
```yaml
network:
  version: 2
  ethernets:
    ens160:  # Specific interface
      addresses: [192.168.1.100/24]
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
```

### Firewall Rules
Default firewall rules are set but not enabled during autoinstall.
They're configured during EPC deployment.

To manually configure:
```bash
sudo ufw enable
sudo ufw allow 22    # SSH
sudo ufw allow 3868  # Diameter (HSS)
sudo ufw status
```

## USB Deployment at Scale

### Creating Multiple USBs
```bash
# Build ISO once
sudo bash scripts/deployment/build-minimal-iso.sh tenant_abc123

# Clone to multiple USBs
for disk in /dev/sdb /dev/sdc /dev/sdd; do
    sudo dd if=iso-output/wisptools-epc-ubuntu-24.04.iso of=$disk bs=4M status=progress
done
```

### USB Labeling
Use permanent marker or label maker to mark USBs:
```
┌──────────────────────┐
│ WISPTools EPC v1.0   │
│ Ubuntu 24.04 LTS     │
│ Auto-Deploy          │
│ Created: 2025-10-26  │
└──────────────────────┘
```

## Production Checklist

Before deploying to production sites:

- [ ] Test ISO in VM successfully
- [ ] Test ISO on physical hardware
- [ ] Verify auto-registration works
- [ ] Confirm EPC components install correctly
- [ ] Check metrics are being reported
- [ ] Test SSH access
- [ ] Verify network security (firewall)
- [ ] Document site-specific configuration
- [ ] Train field technicians on deployment process
- [ ] Prepare support documentation
- [ ] Set up monitoring alerts in wisptools.io

## Getting Help

### Documentation
- [Full Architecture Document](MINIMAL_BOOT_DISC_PHASE.md)
- [Distributed EPC Guide](../distributed-epc/DISTRIBUTED_EPC_OVERVIEW.md)
- [API Documentation](../../BACKEND_API_DOCUMENTATION.md)

### Logs to Check
```bash
# Registration
/var/log/wisptools-register.log

# Installation
/var/log/wisptools-install.log

# First boot
/var/log/wisptools-firstboot.log

# System logs
journalctl -xe
```

### Support
- GitHub Issues: https://github.com/theorem6/lte-pci-mapper/issues
- Project Documentation: https://github.com/theorem6/lte-pci-mapper

## Next Steps After Deployment

Once your EPC is deployed and online:

1. **Verify Status** in wisptools.io dashboard
2. **Update Site Info** (location, contact, notes)
3. **Configure Network** (MCC/MNC/TAC if needed)
4. **Add Subscribers** to HSS
5. **Connect eNodeB** to the EPC
6. **Test UE Attach** with a test phone/modem
7. **Monitor Metrics** for proper operation
8. **Set Up Alerts** for failures

## Success Criteria

Your deployment is successful when:
- ✅ System boots and installs without errors
- ✅ Auto-registration completes successfully
- ✅ EPC ID and credentials are saved
- ✅ Open5GS components are installed and running
- ✅ Metrics agent is sending heartbeats
- ✅ System appears "online" in wisptools.io dashboard
- ✅ All Open5GS services are active: MME, SGW-C, SGW-U, SMF, UPF, PCRF
- ✅ Network interfaces are configured correctly
- ✅ System can communicate with cloud HSS

---

**Status**: 🚀 Ready for Production  
**Version**: 1.0  
**Last Updated**: October 26, 2025

