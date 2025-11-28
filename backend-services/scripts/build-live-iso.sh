#!/bin/bash
# Build WISPTools EPC Live ISO
# Boots and auto-installs complete OS with EPC/SNMP to local disk
# Zero interaction required

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() { echo -e "${CYAN}▶${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Configuration
ISO_OUTPUT_DIR="/var/www/html/downloads/isos"
BUILD_DIR="/opt/epc-live-builder"
ISO_FILENAME="wisptools-epc-generic-netinstall.iso"
GCE_DOMAIN="${GCE_DOMAIN:-hss.wisptools.io}"
GCE_PUBLIC_IP="${GCE_PUBLIC_IP:-136.112.111.167}"
HSS_PORT="${HSS_PORT:-3001}"

echo ""
print_status "═══════════════════════════════════════════════════════════════"
print_status "  WISPTools EPC Live ISO Builder"
print_status "  Auto-installs complete OS with EPC/SNMP packages"
print_status "═══════════════════════════════════════════════════════════════"
echo ""

if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root"
    exit 1
fi

# Install packages
print_status "Installing required packages..."
apt-get update -qq
apt-get install -y debootstrap squashfs-tools xorriso isolinux syslinux-common \
    grub-pc-bin grub-efi-amd64-bin mtools 2>/dev/null || \
apt-get install -y debootstrap squashfs-tools xorriso isolinux syslinux-common \
    grub-pc-bin grub-efi-amd64-bin mtools

mkdir -p "$BUILD_DIR" "$ISO_OUTPUT_DIR"
cd "$BUILD_DIR"

# Clean previous
rm -rf "$BUILD_DIR/chroot" "$BUILD_DIR/iso" "$BUILD_DIR/scratch"
mkdir -p "$BUILD_DIR/chroot" "$BUILD_DIR/iso"/{live,boot/grub,isolinux,EFI/BOOT} "$BUILD_DIR/scratch"

# ============================================================================
# Build the filesystem with ALL packages
# ============================================================================
print_status "Building filesystem with EPC/SNMP packages (this takes 10-15 minutes)..."

# Minimal package list for EPC/SNMP server (command-line only)
# Core: boot, systemd, networking, ssh, disk tools, snmp
debootstrap --arch=amd64 --include=\
linux-image-amd64,live-boot,systemd,systemd-sysv,dbus,udev,\
openssh-server,curl,wget,ca-certificates,gnupg,sudo,\
net-tools,iproute2,iputils-ping,iptables,\
parted,gdisk,dosfstools,e2fsprogs,grub-pc,grub-efi-amd64,rsync,\
snmpd,snmp,cron \
    bookworm "$BUILD_DIR/chroot" http://deb.debian.org/debian

print_success "Base system installed"

# ============================================================================
# Add Open5GS repository and install EPC packages
# ============================================================================
print_status "Installing Open5GS EPC packages..."

# Add Open5GS repo with trusted=yes (upstream key often expires)
# Using trusted=yes as fallback since Open5GS GPG key frequently expires
cat > "$BUILD_DIR/chroot/etc/apt/sources.list.d/open5gs.list" << 'EOF'
deb [trusted=yes] https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/Debian_12/ ./
EOF

# Install ONLY the Open5GS EPC components needed for remote operation
# NOT HSS or PCRF - those run on the central server (hss.wisptools.io)
chroot "$BUILD_DIR/chroot" apt-get update -qq
if ! chroot "$BUILD_DIR/chroot" apt-get install -y --no-install-recommends \
    open5gs-mme \
    open5gs-sgwc \
    open5gs-sgwu \
    open5gs-smf \
    open5gs-upf; then
    print_status "Open5GS install failed, will retry on first boot"
fi

print_status "Remote EPC mode - HSS and PCRF run on central server (hss.wisptools.io)"

# Clean up apt cache to reduce image size
chroot "$BUILD_DIR/chroot" apt-get clean
chroot "$BUILD_DIR/chroot" rm -rf /var/lib/apt/lists/*

print_success "EPC packages configured (HSS disabled - uses central HSS)"

# ============================================================================
# Configure the live system
# ============================================================================
print_status "Configuring live system..."

# Hostname
echo "wisptools-epc" > "$BUILD_DIR/chroot/etc/hostname"
cat > "$BUILD_DIR/chroot/etc/hosts" << 'EOF'
127.0.0.1   localhost wisptools-epc
::1         localhost
EOF

# Create user
chroot "$BUILD_DIR/chroot" useradd -m -s /bin/bash -G sudo wisp
echo 'wisp:wisp123' | chroot "$BUILD_DIR/chroot" chpasswd
echo 'wisp ALL=(ALL) NOPASSWD:ALL' > "$BUILD_DIR/chroot/etc/sudoers.d/wisp"
chmod 440 "$BUILD_DIR/chroot/etc/sudoers.d/wisp"

# Auto-login on console
mkdir -p "$BUILD_DIR/chroot/etc/systemd/system/getty@tty1.service.d"
cat > "$BUILD_DIR/chroot/etc/systemd/system/getty@tty1.service.d/autologin.conf" << 'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin wisp --noclear %I $TERM
EOF

# Enable SSH with password auth
sed -i 's/#PermitRootLogin.*/PermitRootLogin no/' "$BUILD_DIR/chroot/etc/ssh/sshd_config"
sed -i 's/#PasswordAuthentication.*/PasswordAuthentication yes/' "$BUILD_DIR/chroot/etc/ssh/sshd_config"
chroot "$BUILD_DIR/chroot" systemctl enable ssh

# Network - DHCP on all interfaces
mkdir -p "$BUILD_DIR/chroot/etc/network"
cat > "$BUILD_DIR/chroot/etc/network/interfaces" << 'EOF'
auto lo
iface lo inet loopback

allow-hotplug eth0
iface eth0 inet dhcp

allow-hotplug ens3
iface ens3 inet dhcp

allow-hotplug enp0s3
iface enp0s3 inet dhcp
EOF

# Locale
echo "en_US.UTF-8 UTF-8" > "$BUILD_DIR/chroot/etc/locale.gen"
chroot "$BUILD_DIR/chroot" locale-gen
echo 'LANG=en_US.UTF-8' > "$BUILD_DIR/chroot/etc/default/locale"

# ============================================================================
# WISPTools components
# ============================================================================
print_status "Installing WISPTools components..."

mkdir -p "$BUILD_DIR/chroot/etc/wisptools"
mkdir -p "$BUILD_DIR/chroot/opt/wisptools"
mkdir -p "$BUILD_DIR/chroot/var/lib/wisptools"
mkdir -p "$BUILD_DIR/chroot/var/www/html"

# Main startup script - runs on every boot
cat > "$BUILD_DIR/chroot/opt/wisptools/startup.sh" << 'STARTUPEOF'
#!/bin/bash
# WISPTools EPC Startup Script
# Installs OS to disk, then configures EPC/SNMP

LOG="/var/log/wisptools.log"
DEVICE_CODE_FILE="/etc/wisptools/device-code.env"
INSTALLED_FILE="/var/lib/wisptools/.installed"
CONFIGURED_FILE="/var/lib/wisptools/.configured"
GCE_DOMAIN="__GCE_DOMAIN__"
HSS_PORT="__HSS_PORT__"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG"; }

# ============================================================================
# PHASE 1: Install to local disk if running from live media
# ============================================================================
if [ -d /run/live ] && [ ! -f "$INSTALLED_FILE" ]; then
    log "=== PHASE 1: Installing OS to local disk ==="
    
    # Show installation status on console
    clear
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                  ║"
    echo "║     WISPTools EPC - Installing to Local Disk                     ║"
    echo "║                                                                  ║"
    echo "║     Please wait... This takes 2-5 minutes                        ║"
    echo "║                                                                  ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Find target disk - exclude USB boot device and removable media
    # Method 1: Find the boot device from kernel command line
    BOOT_DEV=""
    for param in $(cat /proc/cmdline); do
        case "$param" in
            root=*) 
                BOOT_DEV="${param#root=}"
                ;;
            boot=*)
                BOOT_DEV="${param#boot=}"
                ;;
        esac
    done
    
    # Method 2: Find the device where /run/live is mounted (live-boot)
    LIVE_DEV=$(findmnt -n -o SOURCE /run/live/medium 2>/dev/null | sed 's/[0-9]*$//' | sed 's/p$//')
    [ -z "$LIVE_DEV" ] && LIVE_DEV=$(findmnt -n -o SOURCE /lib/live/mount/medium 2>/dev/null | sed 's/[0-9]*$//' | sed 's/p$//')
    
    # Method 3: Find USB/removable devices to exclude
    USB_DEVICES=""
    for disk in /sys/block/sd*; do
        [ -d "$disk" ] || continue
        DISK_NAME=$(basename "$disk")
        # Check if removable (USB drives usually are)
        if [ "$(cat "$disk/removable" 2>/dev/null)" = "1" ]; then
            USB_DEVICES="$USB_DEVICES /dev/$DISK_NAME"
            log "Detected removable/USB device: /dev/$DISK_NAME"
        fi
        # Also check transport type
        if readlink -f "$disk/device" 2>/dev/null | grep -q usb; then
            USB_DEVICES="$USB_DEVICES /dev/$DISK_NAME"
            log "Detected USB transport device: /dev/$DISK_NAME"
        fi
    done
    
    log "Boot device: $BOOT_DEV"
    log "Live media device: $LIVE_DEV"
    log "USB/Removable devices: $USB_DEVICES"
    
    TARGET_DISK=""
    
    # Get all block devices dynamically
    for disk in /dev/sda /dev/sdb /dev/sdc /dev/sdd /dev/vda /dev/vdb /dev/nvme0n1 /dev/nvme1n1 /dev/mmcblk0; do
        [ -b "$disk" ] || continue
        
        DISK_NAME=$(basename "$disk")
        
        # Skip if this is the live media
        [[ "$LIVE_DEV" == *"$disk"* ]] && { log "Skipping $disk (live media)"; continue; }
        
        # Skip if this is a known USB/removable device
        [[ "$USB_DEVICES" == *"$disk"* ]] && { log "Skipping $disk (USB/removable)"; continue; }
        
        # Skip if removable flag is set (double-check)
        if [ -f "/sys/block/$DISK_NAME/removable" ]; then
            [ "$(cat "/sys/block/$DISK_NAME/removable" 2>/dev/null)" = "1" ] && { log "Skipping $disk (removable flag)"; continue; }
        fi
        
        # Skip if connected via USB transport
        if readlink -f "/sys/block/$DISK_NAME/device" 2>/dev/null | grep -q usb; then
            log "Skipping $disk (USB transport)"
            continue
        fi
        
        SIZE=$(blockdev --getsize64 "$disk" 2>/dev/null || echo 0)
        SIZE_GB=$((SIZE / 1024 / 1024 / 1024))
        
        if [ "$SIZE" -gt 20000000000 ]; then  # > 20GB
            TARGET_DISK="$disk"
            log "Found target disk: $TARGET_DISK (${SIZE_GB}GB)"
            break
        else
            log "Skipping $disk (too small: ${SIZE_GB}GB, need >= 20GB)"
        fi
    done
    
    if [ -z "$TARGET_DISK" ]; then
        log "ERROR: No suitable disk found (need >= 20GB)"
        echo "ERROR: No disk >= 20GB found for installation!"
        sleep 10
    else
        log "Installing to $TARGET_DISK..."
        echo "Installing to $TARGET_DISK..."
        
        # Wipe and partition
        wipefs -af "$TARGET_DISK" 2>/dev/null || true
        parted -s "$TARGET_DISK" mklabel gpt
        parted -s "$TARGET_DISK" mkpart bios 1MiB 2MiB
        parted -s "$TARGET_DISK" set 1 bios_grub on
        parted -s "$TARGET_DISK" mkpart efi fat32 2MiB 514MiB
        parted -s "$TARGET_DISK" set 2 esp on
        parted -s "$TARGET_DISK" mkpart root ext4 514MiB 100%
        sleep 2
        partprobe "$TARGET_DISK" 2>/dev/null || true
        sleep 2
        
        # Partition device names
        if [[ "$TARGET_DISK" == *"nvme"* ]]; then
            PART_EFI="${TARGET_DISK}p2"
            PART_ROOT="${TARGET_DISK}p3"
        else
            PART_EFI="${TARGET_DISK}2"
            PART_ROOT="${TARGET_DISK}3"
        fi
        
        log "Formatting partitions..."
        mkfs.vfat -F32 "$PART_EFI"
        mkfs.ext4 -F -L wisptools "$PART_ROOT"
        
        # Mount target
        mkdir -p /mnt/target
        mount "$PART_ROOT" /mnt/target
        mkdir -p /mnt/target/boot/efi
        mount "$PART_EFI" /mnt/target/boot/efi
        
        log "Copying system files (this takes a few minutes)..."
        echo "Copying system files..."
        
        # Copy entire live system
        rsync -aAX --info=progress2 \
            --exclude='/dev/*' \
            --exclude='/proc/*' \
            --exclude='/sys/*' \
            --exclude='/tmp/*' \
            --exclude='/run/*' \
            --exclude='/mnt/*' \
            --exclude='/media/*' \
            --exclude='/lost+found' \
            --exclude='/var/lib/wisptools/.installed' \
            / /mnt/target/ 2>&1 | while read line; do
                echo -ne "\r$line                    "
            done
        echo ""
        
        # Generate fstab
        ROOT_UUID=$(blkid -s UUID -o value "$PART_ROOT")
        EFI_UUID=$(blkid -s UUID -o value "$PART_EFI")
        cat > /mnt/target/etc/fstab << FSTABEOF
# WISPTools EPC System
UUID=$ROOT_UUID  /           ext4  errors=remount-ro  0 1
UUID=$EFI_UUID   /boot/efi   vfat  umask=0077         0 1
FSTABEOF
        
        log "Installing bootloader..."
        echo "Installing bootloader..."
        
        # Bind mounts for chroot
        mount --bind /dev /mnt/target/dev
        mount --bind /dev/pts /mnt/target/dev/pts
        mount --bind /proc /mnt/target/proc
        mount --bind /sys /mnt/target/sys
        mount --bind /run /mnt/target/run
        
        # Install GRUB for BIOS
        chroot /mnt/target grub-install --target=i386-pc "$TARGET_DISK" 2>/dev/null || log "BIOS GRUB failed (OK if UEFI)"
        
        # Install GRUB for UEFI
        chroot /mnt/target grub-install --target=x86_64-efi --efi-directory=/boot/efi --removable 2>/dev/null || log "UEFI GRUB failed (OK if BIOS)"
        
        # Update GRUB config
        chroot /mnt/target update-grub 2>/dev/null || true
        
        # Mark as installed
        touch /mnt/target/var/lib/wisptools/.installed
        
        # Cleanup
        umount /mnt/target/run 2>/dev/null || true
        umount /mnt/target/sys
        umount /mnt/target/proc
        umount /mnt/target/dev/pts
        umount /mnt/target/dev
        umount /mnt/target/boot/efi
        umount /mnt/target
        
        log "=== Installation complete! Rebooting to installed system... ==="
        echo ""
        echo "╔══════════════════════════════════════════════════════════════════╗"
        echo "║                                                                  ║"
        echo "║     Installation Complete!                                       ║"
        echo "║                                                                  ║"
        echo "║     Remove USB drive and system will reboot in 10 seconds...     ║"
        echo "║                                                                  ║"
        echo "╚══════════════════════════════════════════════════════════════════╝"
        echo ""
        sleep 10
        reboot
        exit 0
    fi
fi

# ============================================================================
# PHASE 2: System is installed - show device code and configure
# ============================================================================
log "=== PHASE 2: Device code and configuration ==="

# Generate device code if needed
if [ ! -f "$DEVICE_CODE_FILE" ]; then
    DEVICE_CODE=$(cat /dev/urandom | tr -dc 'A-Z0-9' | head -c8)
    echo "DEVICE_CODE=$DEVICE_CODE" > "$DEVICE_CODE_FILE"
    chmod 600 "$DEVICE_CODE_FILE"
fi
source "$DEVICE_CODE_FILE"

# Wait for network and get IP address with retry
log "Waiting for network and DHCP..."
IP_ADDR=""
for i in {1..30}; do
    # Try multiple methods to get IP
    # Method 1: hostname -I (most reliable when DHCP is working)
    IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}' | grep -v '^$')
    
    # Method 2: ip addr (look for non-loopback, non-link-local addresses)
    if [ -z "$IP_ADDR" ]; then
        IP_ADDR=$(ip -4 addr show scope global 2>/dev/null | grep -oP '(?<=inet\s)\d+\.\d+\.\d+\.\d+' | head -1)
    fi
    
    # Method 3: Check each interface directly
    if [ -z "$IP_ADDR" ]; then
        for iface in $(ls /sys/class/net/ | grep -v lo); do
            IFACE_IP=$(ip -4 addr show dev "$iface" 2>/dev/null | grep -oP '(?<=inet\s)\d+\.\d+\.\d+\.\d+' | head -1)
            if [ -n "$IFACE_IP" ] && [[ ! "$IFACE_IP" =~ ^169\.254\. ]]; then
                IP_ADDR="$IFACE_IP"
                break
            fi
        done
    fi
    
    if [ -n "$IP_ADDR" ] && [[ ! "$IP_ADDR" =~ ^169\.254\. ]]; then
        log "Got IP address: $IP_ADDR"
        break
    fi
    
    log "Waiting for DHCP... attempt $i/30"
    sleep 2
done

if [ -z "$IP_ADDR" ] || [[ "$IP_ADDR" =~ ^169\.254\. ]]; then
    IP_ADDR="(awaiting DHCP)"
    log "WARNING: Could not get valid IP address"
fi

# Get hardware ID (MAC address)
HARDWARE_ID=""
for iface in $(ls /sys/class/net/ | grep -v lo); do
    MAC=$(cat /sys/class/net/$iface/address 2>/dev/null)
    if [ -n "$MAC" ] && [ "$MAC" != "00:00:00:00:00:00" ]; then
        HARDWARE_ID="$MAC"
        break
    fi
done
[ -z "$HARDWARE_ID" ] && HARDWARE_ID=$(ip link show 2>/dev/null | grep -A1 "state UP" | grep ether | head -1 | awk '{print $2}')
[ -z "$HARDWARE_ID" ] && HARDWARE_ID="unknown"

log "Hardware ID: $HARDWARE_ID"

# Start nginx for status page
mkdir -p /var/www/html
systemctl start nginx 2>/dev/null || python3 -m http.server 80 -d /var/www/html &>/dev/null &

# Check if already configured - verify with server if configured file exists
if [ -f "$CONFIGURED_FILE" ]; then
    log "Configuration file found, verifying with server..."
    
    # Also check if Open5GS services are running (additional verification)
    EPC_SERVICES_RUNNING=false
    if systemctl is-active --quiet open5gs-mmed 2>/dev/null || \
       systemctl is-active --quiet open5gs-sgwcd 2>/dev/null || \
       systemctl is-active --quiet open5gs-smfd 2>/dev/null; then
        EPC_SERVICES_RUNNING=true
        log "Open5GS services are running - system is fully configured"
    fi
    
    # Verify device is still registered on server
    RESPONSE=$(curl -s -X POST "https://$GCE_DOMAIN:$HSS_PORT/api/epc/checkin" \
        -H "Content-Type: application/json" \
        -d "{\"device_code\":\"$DEVICE_CODE\",\"hardware_id\":\"$HARDWARE_ID\",\"ip_address\":\"$IP_ADDR\"}" 2>/dev/null) || true
    
    EPC_ID=$(echo "$RESPONSE" | jq -r '.epc_id // empty' 2>/dev/null)
    STATUS=$(echo "$RESPONSE" | jq -r '.status // empty' 2>/dev/null)
    
    # Skip deployment if registered AND (services running OR config files exist)
    if [ -n "$EPC_ID" ] && [ "$EPC_ID" != "null" ] && [ "$STATUS" = "ok" ]; then
        if [ "$EPC_SERVICES_RUNNING" = "true" ] || [ -f /etc/open5gs/mme.yaml ]; then
            log "Device already configured and registered on server - skipping deployment"
        source /etc/wisptools/config.env 2>/dev/null || true
        
        # Create running status page
    cat > /var/www/html/index.html << HTMLEOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>WISPTools EPC - Running</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body { font-family: 'Segoe UI', Arial; text-align: center; padding: 40px; background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); color: #fff; min-height: 100vh; margin: 0; }
        h1 { color: #4caf50; }
        .code { font-size: 48px; font-weight: bold; color: #00ff88; font-family: monospace; }
        .info { color: #aaa; margin: 10px 0; }
        .box { background: rgba(255,255,255,0.1); padding: 25px; border-radius: 15px; margin: 20px auto; max-width: 600px; text-align: left; }
        .status { padding: 12px 30px; background: #4caf50; color: #fff; font-weight: bold; border-radius: 25px; display: inline-block; }
        .service { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .running { color: #4caf50; }
        .stopped { color: #f44336; }
    </style>
</head>
<body>
    <h1>✅ WISPTools EPC Device</h1>
    <div class="status">System Running</div>
    <div class="code">$DEVICE_CODE</div>
    <div class="box">
        <h3>📊 Services Status:</h3>
        <div class="service"><span>Open5GS MME</span><span id="mme">Checking...</span></div>
        <div class="service"><span>Open5GS HSS</span><span id="hss">Checking...</span></div>
        <div class="service"><span>Open5GS SGW</span><span id="sgwc">Checking...</span></div>
        <div class="service"><span>Open5GS PGW</span><span id="smf">Checking...</span></div>
        <div class="service"><span>SNMP Agent</span><span id="snmp">Checking...</span></div>
    </div>
    <p class="info">IP: $IP_ADDR | MAC: $HARDWARE_ID</p>
</body>
</html>
HTMLEOF
    
    # Display on console
    clear
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                  ║"
    echo "║     WISPTools EPC Device - Running                               ║"
    echo "║                                                                  ║"
    echo "║     Device Code: $DEVICE_CODE                                 ║"
    echo "║     IP Address:  $IP_ADDR"
    echo "║                                                                  ║"
    echo "║     SSH: ssh wisp@$IP_ADDR  (password: wisp123)"
    echo "║                                                                  ║"
    # Disable startup service so it doesn't run on next reboot
    log "Disabling startup service - device is already configured"
    systemctl disable wisptools-startup.service 2>/dev/null || true
    
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
    exit 0
    else
        log "Device not registered on server, re-entering deployment mode"
        rm -f "$CONFIGURED_FILE"
    fi
fi

# Before showing waiting page, check if device is already registered on server
log "Checking if device is already registered on server..."
RESPONSE=$(curl -s -X POST "https://$GCE_DOMAIN:$HSS_PORT/api/epc/checkin" \
    -H "Content-Type: application/json" \
    -d "{\"device_code\":\"$DEVICE_CODE\",\"hardware_id\":\"$HARDWARE_ID\",\"ip_address\":\"$IP_ADDR\"}" 2>/dev/null) || true

EPC_ID=$(echo "$RESPONSE" | jq -r '.epc_id // empty' 2>/dev/null)
STATUS=$(echo "$RESPONSE" | jq -r '.status // empty' 2>/dev/null)

if [ -n "$EPC_ID" ] && [ "$EPC_ID" != "null" ] && [ "$STATUS" = "ok" ]; then
    log "Device is already registered on server - marking as configured"
    
    # Device is registered, mark as configured and skip waiting page
    mkdir -p /etc/wisptools
    source /etc/wisptools/config.env 2>/dev/null || true
    
    # Save registration info if available
    echo "$RESPONSE" > /etc/wisptools/registration.json 2>/dev/null || true
    
    # Create the configured file
    touch "$CONFIGURED_FILE"
    
    # Disable startup service so it doesn't run on next reboot
    log "Disabling startup service - device is already configured"
    systemctl disable wisptools-startup.service 2>/dev/null || true
    
    # Create running status page (skip waiting)
    cat > /var/www/html/index.html << HTMLEOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>WISPTools EPC - Running</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body { font-family: 'Segoe UI', Arial; text-align: center; padding: 40px; background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); color: #fff; min-height: 100vh; margin: 0; }
        h1 { color: #4caf50; }
        .code { font-size: 48px; font-weight: bold; color: #00ff88; font-family: monospace; }
        .info { color: #aaa; margin: 10px 0; }
        .box { background: rgba(255,255,255,0.1); padding: 25px; border-radius: 15px; margin: 20px auto; max-width: 600px; text-align: left; }
        .status { padding: 12px 30px; background: #4caf50; color: #fff; font-weight: bold; border-radius: 25px; display: inline-block; }
        .service { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .running { color: #4caf50; }
        .stopped { color: #f44336; }
    </style>
</head>
<body>
    <h1>✅ WISPTools EPC Device</h1>
    <div class="status">System Running</div>
    <div class="code">$DEVICE_CODE</div>
    <div class="box">
        <h3>📊 Services Status:</h3>
        <div class="service"><span>Open5GS MME</span><span id="mme">Checking...</span></div>
        <div class="service"><span>Open5GS SGW-C</span><span id="sgwc">Checking...</span></div>
        <div class="service"><span>Open5GS SGW-U</span><span id="sgwu">Checking...</span></div>
        <div class="service"><span>Open5GS SMF</span><span id="smf">Checking...</span></div>
        <div class="service"><span>Open5GS UPF</span><span id="upf">Checking...</span></div>
        <div class="service"><span>SNMP Agent</span><span id="snmp">Checking...</span></div>
    </div>
    <p class="info">IP: $IP_ADDR | MAC: $HARDWARE_ID</p>
</body>
</html>
HTMLEOF
    
    clear
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                  ║"
    echo "║     WISPTools EPC Device - Running                               ║"
    echo "║                                                                  ║"
    echo "║     Device Code: $DEVICE_CODE                                 ║"
    echo "║     IP Address:  $IP_ADDR"
    echo "║                                                                  ║"
    echo "║     SSH: ssh wisp@$IP_ADDR  (password: wisp123)"
    echo "║                                                                  ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
    exit 0
fi

# Create waiting status page (only shown if device is NOT registered)
cat > /var/www/html/index.html << HTMLEOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>WISPTools EPC</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body { font-family: 'Segoe UI', Arial; text-align: center; padding: 40px; background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); color: #fff; min-height: 100vh; margin: 0; }
        h1 { color: #00ff88; }
        .code { font-size: 72px; font-weight: bold; color: #00ff88; letter-spacing: 12px; margin: 40px 0; font-family: monospace; text-shadow: 0 0 30px rgba(0,255,136,0.5); }
        .info { color: #aaa; margin: 10px 0; }
        .box { background: rgba(255,255,255,0.1); padding: 25px; border-radius: 15px; margin: 20px auto; max-width: 500px; }
        .status { padding: 12px 30px; background: #ff9800; color: #000; font-weight: bold; border-radius: 25px; display: inline-block; }
        ol { text-align: left; line-height: 2.2; }
        a { color: #00ff88; }
    </style>
</head>
<body>
    <h1>🛡️ WISPTools EPC Device</h1>
    <p>Enter this code in the WISPTools Portal:</p>
    <div class="code">$DEVICE_CODE</div>
    <div class="status">⏳ Waiting for Configuration</div>
    <div class="box">
        <h3>📋 Next Steps:</h3>
        <ol>
            <li>Go to <a href="https://wisptools-production.web.app">WISPTools Portal</a></li>
            <li>Navigate to <strong>Deploy</strong> module</li>
            <li>Click <strong>Add Hardware → EPC/SNMP Server</strong></li>
            <li>Enter device code: <strong>$DEVICE_CODE</strong></li>
            <li>Device will configure automatically</li>
        </ol>
    </div>
    <p class="info">IP: $IP_ADDR | MAC: $HARDWARE_ID</p>
</body>
</html>
HTMLEOF

# Display on console
clear
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║     WISPTools EPC Device Ready                                   ║"
echo "║                                                                  ║"
echo "║     DEVICE CODE:  $DEVICE_CODE                                ║"
echo "║                                                                  ║"
echo "║     Enter this code in the WISPTools Portal                      ║"
echo "║                                                                  ║"
echo "║     Web UI:  http://$IP_ADDR/"
echo "║     SSH:     ssh wisp@$IP_ADDR  (password: wisp123)"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# Check-in loop - wait for configuration from portal
# ============================================================================
log "Waiting for configuration from portal..."

while true; do
    [ -f "$CONFIGURED_FILE" ] && break
    
    # Update IP if it changed
    NEW_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    [ -n "$NEW_IP" ] && IP_ADDR="$NEW_IP"
    
    RESPONSE=$(curl -s -X POST "https://$GCE_DOMAIN:$HSS_PORT/api/epc/checkin" \
        -H "Content-Type: application/json" \
        -d "{\"device_code\":\"$DEVICE_CODE\",\"hardware_id\":\"$HARDWARE_ID\",\"ip_address\":\"$IP_ADDR\"}" 2>/dev/null) || true
    
    EPC_ID=$(echo "$RESPONSE" | jq -r '.epc_id // empty' 2>/dev/null)
    
    if [ -n "$EPC_ID" ] && [ "$EPC_ID" != "null" ]; then
        log "Assigned to EPC: $EPC_ID - downloading configuration..."
        echo "Configuring device..."
        
        CHECKIN_TOKEN=$(echo "$RESPONSE" | jq -r '.checkin_token // empty')
        CONFIG=$(echo "$RESPONSE" | jq -r '.config // empty')
        
        # Save config
        mkdir -p /etc/wisptools
        echo "$RESPONSE" > /etc/wisptools/registration.json
        
        # Extract what to enable
        ENABLE_EPC=$(echo "$CONFIG" | jq -r '.enable_epc // false' 2>/dev/null)
        ENABLE_SNMP=$(echo "$CONFIG" | jq -r '.enable_snmp // false' 2>/dev/null)
        
        # Download deployment script
        curl -s -o /opt/wisptools/deploy.sh \
            "https://$GCE_DOMAIN:$HSS_PORT/api/epc/$EPC_ID/deploy?checkin_token=$CHECKIN_TOKEN" 2>/dev/null || true
        
        if [ -s /opt/wisptools/deploy.sh ]; then
            chmod +x /opt/wisptools/deploy.sh
            log "Running deployment script..."
            bash /opt/wisptools/deploy.sh 2>&1 | tee -a "$LOG"
        fi
        
        # Configure EPC if enabled (only if not already configured)
        if [ "$ENABLE_EPC" = "true" ]; then
            # Check if Open5GS is already configured and running
            if systemctl is-active --quiet open5gs-mmed 2>/dev/null && \
               [ -f /etc/open5gs/mme.yaml ] && \
               [ -f /etc/freeDiameter/mme.conf ]; then
                log "Open5GS already configured and running - skipping reconfiguration"
            else
                log "Configuring EPC services..."
                /opt/wisptools/configure-epc.sh 2>&1 | tee -a "$LOG" || true
            fi
        fi
        
        # Configure SNMP if enabled
        if [ "$ENABLE_SNMP" = "true" ]; then
            log "Configuring SNMP agent..."
            /opt/wisptools/configure-snmp.sh 2>&1 | tee -a "$LOG" || true
        fi
        
        touch "$CONFIGURED_FILE"
        
        # Disable startup service so deployment doesn't run on next reboot
        log "Disabling startup service - deployment complete"
        systemctl disable wisptools-startup.service 2>/dev/null || true
        
        # Update status page
        sed -i 's/Waiting for Configuration/✅ Connected \& Configured/' /var/www/html/index.html
        sed -i 's/#ff9800/#4caf50/' /var/www/html/index.html
        
        echo ""
        echo "╔══════════════════════════════════════════════════════════════════╗"
        echo "║                                                                  ║"
        echo "║     ✅ Device Configured Successfully!                           ║"
        echo "║     Startup service disabled - reboots will skip deployment     ║"
        echo "║                                                                  ║"
        echo "╚══════════════════════════════════════════════════════════════════╝"
        echo ""
        break
    fi
    
    sleep 30
done
STARTUPEOF

sed -i "s/__GCE_DOMAIN__/${GCE_DOMAIN}/g" "$BUILD_DIR/chroot/opt/wisptools/startup.sh"
sed -i "s/__HSS_PORT__/${HSS_PORT}/g" "$BUILD_DIR/chroot/opt/wisptools/startup.sh"
chmod +x "$BUILD_DIR/chroot/opt/wisptools/startup.sh"

# EPC configuration script
cat > "$BUILD_DIR/chroot/opt/wisptools/configure-epc.sh" << 'EPCEOF'
#!/bin/bash
# Configure Open5GS EPC

LOG="/var/log/wisptools.log"
CONFIG_DIR="/etc/open5gs"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [EPC] $1" | tee -a "$LOG"; }

log "Configuring Open5GS EPC (Distributed Mode)..."

# Central HSS configuration
CENTRAL_HSS="hss.wisptools.io"
HSS_DIAMETER_PORT=3868

# Load configuration from registration
source /etc/wisptools/config.env 2>/dev/null || true
REG_DATA=$(cat /etc/wisptools/registration.json 2>/dev/null)

# Get EPC ID and configuration from registration
EPC_ID=$(echo "$REG_DATA" | jq -r '.epc_id // empty' 2>/dev/null)
# Get device code from correct location
if [ -f /etc/wisptools/device-code.env ]; then
    source /etc/wisptools/device-code.env
elif [ -f /etc/wisptools/device_code ]; then
    DEVICE_CODE=$(cat /etc/wisptools/device_code)
else
    DEVICE_CODE="UNKNOWN"
fi
MCC=$(echo "$REG_DATA" | jq -r '.config.hss_config.mcc // .config.network_config.mcc // "001"' 2>/dev/null)
MNC=$(echo "$REG_DATA" | jq -r '.config.hss_config.mnc // .config.network_config.mnc // "01"' 2>/dev/null)
TAC=$(echo "$REG_DATA" | jq -r '.config.network_config.tac // "1"' 2>/dev/null)
REALM=$(echo "$REG_DATA" | jq -r '.config.hss_config.diameter_realm // "wisptools.io"' 2>/dev/null)

MME_IP=$(hostname -I | awk '{print $1}')

log "EPC ID: ${EPC_ID:-not registered}"
log "Device Code: $DEVICE_CODE"
log "Central HSS: $CENTRAL_HSS"
log "MCC/MNC: $MCC/$MNC, TAC: $TAC"

# Check if Open5GS is already installed AND configured
OPEN5GS_INSTALLED=false
OPEN5GS_CONFIGURED=false

# Check if Open5GS packages are installed
if command -v open5gs-mmed &>/dev/null; then
    OPEN5GS_INSTALLED=true
    log "Open5GS packages already installed"
    
    # Check if services are running (indicates it's configured)
    if systemctl is-active --quiet open5gs-mmed 2>/dev/null || \
       systemctl is-active --quiet open5gs-sgwcd 2>/dev/null || \
       systemctl is-active --quiet open5gs-smfd 2>/dev/null; then
        OPEN5GS_CONFIGURED=true
        log "Open5GS services are running - already configured"
    elif [ -f "$CONFIG_DIR/mme.yaml" ] && [ -f "/etc/freeDiameter/mme.conf" ]; then
        # Config files exist - likely configured
        OPEN5GS_CONFIGURED=true
        log "Open5GS configuration files exist - already configured"
    fi
fi

# Only install if not installed
if [ "$OPEN5GS_INSTALLED" = "false" ]; then
    log "Installing Open5GS EPC packages (NOT HSS/PCRF - those are central)..."
    echo "deb [trusted=yes] https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/Debian_12/ ./" > /etc/apt/sources.list.d/open5gs.list
    apt-get update -qq
    # Install ONLY the EPC components - NOT HSS or PCRF
    apt-get install -y --no-install-recommends \
        open5gs-mme \
        open5gs-sgwc \
        open5gs-sgwu \
        open5gs-smf \
        open5gs-upf
    OPEN5GS_INSTALLED=true
else
    log "Skipping Open5GS installation - already installed"
fi

# Skip configuration if already configured
if [ "$OPEN5GS_CONFIGURED" = "true" ]; then
    log "Open5GS already configured and running - skipping reconfiguration"
    log "To force reconfiguration, stop services and remove config files"
    
    # Just ensure services are enabled and started
    for svc in open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
        systemctl enable $svc 2>/dev/null || true
        systemctl start $svc 2>/dev/null || true
    done
    
    # Ensure local HSS/PCRF are disabled
    for svc in open5gs-hssd open5gs-pcrfd; do
        systemctl stop $svc 2>/dev/null || true
        systemctl disable $svc 2>/dev/null || true
        systemctl mask $svc 2>/dev/null || true
    done
    
    log "Open5GS services verified and running"
    exit 0
fi

# Configure MME to connect to central HSS
if [ -f "$CONFIG_DIR/mme.yaml" ]; then
    log "Configuring MME for central HSS..."
    
    # Set PLMN identity
    sed -i "s/mcc:.*/mcc: $MCC/" "$CONFIG_DIR/mme.yaml"
    sed -i "s/mnc:.*/mnc: $MNC/" "$CONFIG_DIR/mme.yaml"
    sed -i "s/tac:.*/tac: $TAC/" "$CONFIG_DIR/mme.yaml"
    
    # Set MME identity using EPC ID
    if [ -n "$EPC_ID" ]; then
        sed -i "s/mme_gid:.*/mme_gid: 1/" "$CONFIG_DIR/mme.yaml"
        sed -i "s/mme_code:.*/mme_code: 1/" "$CONFIG_DIR/mme.yaml"
    fi
fi

# Configure FreeDiameter for MME to connect to central HSS
DIAMETER_CONF="/etc/freeDiameter/mme.conf"
if [ -f "$DIAMETER_CONF" ] || [ -d "/etc/freeDiameter" ]; then
    log "Configuring Diameter connection to central HSS..."
    mkdir -p /etc/freeDiameter
    
    # Set MME as Diameter client connecting to central HSS
    cat > "$DIAMETER_CONF" << DIAMEOF
# FreeDiameter configuration for distributed EPC
# EPC ID: ${EPC_ID:-$DEVICE_CODE}
# Connects to central HSS at $CENTRAL_HSS

Identity = "mme-${DEVICE_CODE}.${REALM}";
Realm = "${REALM}";

# Central HSS peer
ConnectPeer = "hss.${REALM}" { ConnectTo = "${CENTRAL_HSS}"; Port = ${HSS_DIAMETER_PORT}; };
DIAMEOF
fi

# IMPORTANT: Disable local HSS and PCRF - they run centrally at hss.wisptools.io
log "Disabling local HSS and PCRF (using central services at $CENTRAL_HSS)..."
for svc in open5gs-hssd open5gs-pcrfd; do
    systemctl stop $svc 2>/dev/null || true
    systemctl disable $svc 2>/dev/null || true
    systemctl mask $svc 2>/dev/null || true
done

# Configure SMF to connect to central PCRF
if [ -f "$CONFIG_DIR/smf.yaml" ]; then
    log "Configuring SMF for central PCRF..."
    # Update PCRF peer address to central server
    sed -i "s/127.0.0.7/${CENTRAL_HSS}/g" "$CONFIG_DIR/smf.yaml" 2>/dev/null || true
fi

# Enable and start EPC services (NOT HSS or PCRF)
log "Starting EPC services..."
for svc in open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
    systemctl enable $svc 2>/dev/null || true
    systemctl start $svc 2>/dev/null || true
done

log "EPC configuration complete (Central HSS: $CENTRAL_HSS)"

# Show status
echo ""
echo "Open5GS EPC Status (Distributed Mode):"
echo "  Central HSS/PCRF: $CENTRAL_HSS"
echo "  EPC ID: ${EPC_ID:-not registered}"
echo "  Device Code: $DEVICE_CODE"
echo ""
echo "Local Services (running on this EPC):"
for svc in open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
    STATUS=$(systemctl is-active $svc 2>/dev/null || echo "not installed")
    printf "  %-20s %s\n" "$svc:" "$STATUS"
done
echo ""
echo "Central Services (at $CENTRAL_HSS):"
echo "  open5gs-hssd:        CENTRAL (subscriber database)"
echo "  open5gs-pcrfd:       CENTRAL (policy/charging)"

# Install and start check-in agent
log "Installing check-in agent..."
curl -fsSL https://${CENTRAL_HSS}/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh
chmod +x /opt/wisptools/epc-checkin-agent.sh
/opt/wisptools/epc-checkin-agent.sh install

# Download SNMP discovery scripts (Node.js preferred, bash as fallback)
log "Installing SNMP discovery scripts..."
curl -fsSL https://${CENTRAL_HSS}/downloads/scripts/epc-snmp-discovery.js -o /opt/wisptools/epc-snmp-discovery.js 2>/dev/null || true
if [ -f /opt/wisptools/epc-snmp-discovery.js ]; then
    chmod +x /opt/wisptools/epc-snmp-discovery.js
    log "Node.js SNMP discovery script installed"
    
    # Install npm packages if Node.js is available
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        log "Installing npm packages for SNMP discovery..."
        cd /opt/wisptools
        npm init -y >/dev/null 2>&1 || true
        npm install --no-save ping-scanner net-snmp >/dev/null 2>&1 || log "Warning: Failed to install npm packages, will use fallback methods"
    fi
fi

# Bash version (fallback)
curl -fsSL https://${CENTRAL_HSS}/downloads/scripts/epc-snmp-discovery.sh -o /opt/wisptools/epc-snmp-discovery.sh 2>/dev/null || true
if [ -f /opt/wisptools/epc-snmp-discovery.sh ]; then
    chmod +x /opt/wisptools/epc-snmp-discovery.sh 2>/dev/null || true
    log "Bash SNMP discovery script installed (fallback)"
fi

log "EPC configuration complete. Check-in agent and SNMP discovery installed."
EPCEOF
chmod +x "$BUILD_DIR/chroot/opt/wisptools/configure-epc.sh"

# SNMP configuration script
cat > "$BUILD_DIR/chroot/opt/wisptools/configure-snmp.sh" << 'SNMPEOF'
#!/bin/bash
# Configure SNMP Agent

LOG="/var/log/wisptools.log"
SNMP_CONF="/etc/snmp/snmpd.conf"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [SNMP] $1" | tee -a "$LOG"; }

log "Configuring SNMP agent..."

# Load configuration
source /etc/wisptools/config.env 2>/dev/null || true
REG_DATA=$(cat /etc/wisptools/registration.json 2>/dev/null)

SNMP_COMMUNITY="${SNMP_COMMUNITY:-public}"
SNMP_LOCATION="${SNMP_LOCATION:-WISPTools EPC}"
SNMP_CONTACT="${SNMP_CONTACT:-admin@example.com}"

# Install if needed
if ! command -v snmpd &>/dev/null; then
    log "Installing SNMP packages..."
    apt-get update -qq
    apt-get install -y snmpd snmp
fi

# Backup original config
[ -f "$SNMP_CONF" ] && cp "$SNMP_CONF" "$SNMP_CONF.bak"

# Create SNMP configuration
cat > "$SNMP_CONF" << SNMPCONFEOF
# WISPTools SNMP Configuration
# Generated: $(date)

# System info
sysLocation    $SNMP_LOCATION
sysContact     $SNMP_CONTACT
sysServices    72

# Access control
rocommunity $SNMP_COMMUNITY default

# Disk monitoring
disk / 10%
disk /var 10%

# Load monitoring
load 12 10 5

# Process monitoring (remote EPC - no HSS)
proc sshd
proc open5gs-mmed 1 1
proc open5gs-smfd 1 1

# Extend scripts for custom OIDs
extend epc-status /opt/wisptools/snmp-epc-status.sh
extend device-code /bin/cat /etc/wisptools/device-code.env

# AgentX for sub-agents
master agentx
agentXSocket /var/agentx/master

# Logging
dontLogTCPWrappersConnects yes
SNMPCONFEOF

# Create EPC status script for SNMP
cat > /opt/wisptools/snmp-epc-status.sh << 'STATUSEOF'
#!/bin/bash
# Check Open5GS services status (remote EPC - no HSS/PCRF)
SERVICES="open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd"
STATUS="OK"
for svc in $SERVICES; do
    if ! systemctl is-active --quiet $svc 2>/dev/null; then
        STATUS="DEGRADED: $svc down"
        break
    fi
done
echo "$STATUS"
STATUSEOF
chmod +x /opt/wisptools/snmp-epc-status.sh

# Enable and start SNMP
systemctl enable snmpd
systemctl restart snmpd

log "SNMP configuration complete"

# Test SNMP
sleep 2
if snmpwalk -v2c -c "$SNMP_COMMUNITY" localhost system 2>/dev/null | head -1; then
    log "SNMP agent responding"
else
    log "WARNING: SNMP agent not responding"
fi
SNMPEOF
chmod +x "$BUILD_DIR/chroot/opt/wisptools/configure-snmp.sh"

# Default config.env
cat > "$BUILD_DIR/chroot/etc/wisptools/config.env" << 'CONFEOF'
# WISPTools EPC Configuration
# This file is updated when the device is configured from the portal

# EPC Settings
MCC=001
MNC=01
TAC=1
ENABLE_EPC=false

# SNMP Settings  
SNMP_COMMUNITY=public
SNMP_LOCATION=WISPTools EPC
SNMP_CONTACT=admin@example.com
ENABLE_SNMP=false

# Cloud Settings
GCE_DOMAIN=hss.wisptools.io
HSS_PORT=3001
CONFEOF

# Systemd service for startup - runs early in boot, before login
cat > "$BUILD_DIR/chroot/etc/systemd/system/wisptools-startup.service" << 'EOF'
[Unit]
Description=WISPTools EPC Startup and Installation
# Run early, just after basic system is up
After=local-fs.target systemd-remount-fs.service
Before=getty@tty1.service display-manager.service
# Don't wait for network - we need to install first
DefaultDependencies=no

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/opt/wisptools/startup.sh
StandardOutput=journal+console
StandardError=journal+console
# Give it time to complete installation
TimeoutStartSec=600

[Install]
WantedBy=sysinit.target
EOF

chroot "$BUILD_DIR/chroot" systemctl enable wisptools-startup.service

# ALSO add fallback: run from .bashrc on auto-login (belt and suspenders)
cat >> "$BUILD_DIR/chroot/home/wisp/.bashrc" << 'BASHRCEOF'

# WISPTools auto-start on login (fallback if systemd service doesn't run)
if [ -d /run/live ] && [ ! -f /var/lib/wisptools/.installed ]; then
    echo ""
    echo "Starting WISPTools installation..."
    echo ""
    sudo /opt/wisptools/startup.sh
fi
BASHRCEOF

# Also add to .profile for login shells
cat >> "$BUILD_DIR/chroot/home/wisp/.profile" << 'PROFILEEOF'

# WISPTools auto-start on login (fallback)
if [ -d /run/live ] && [ ! -f /var/lib/wisptools/.installed ]; then
    echo ""
    echo "Starting WISPTools installation..."
    echo ""
    sudo /opt/wisptools/startup.sh
fi
PROFILEEOF

# Ensure wisp owns the files
chroot "$BUILD_DIR/chroot" chown wisp:wisp /home/wisp/.bashrc /home/wisp/.profile

# Clean up chroot
chroot "$BUILD_DIR/chroot" apt-get clean
rm -rf "$BUILD_DIR/chroot/var/lib/apt/lists/*"
rm -rf "$BUILD_DIR/chroot/tmp/*"

print_success "Live system configured"

# ============================================================================
# Create squashfs
# ============================================================================
print_status "Creating compressed filesystem (this takes a few minutes)..."

mksquashfs "$BUILD_DIR/chroot" "$BUILD_DIR/iso/live/filesystem.squashfs" \
    -comp xz -Xbcj x86 -b 1M -no-duplicates

# Copy kernel and initrd
cp "$BUILD_DIR/chroot/boot/vmlinuz-"* "$BUILD_DIR/iso/live/vmlinuz"
cp "$BUILD_DIR/chroot/boot/initrd.img-"* "$BUILD_DIR/iso/live/initrd"

print_success "Squashfs created"

# ============================================================================
# Create bootloader configs
# ============================================================================
print_status "Creating boot configuration..."

# ISOLINUX for BIOS
cp /usr/lib/ISOLINUX/isolinux.bin "$BUILD_DIR/iso/isolinux/" 2>/dev/null || \
cp /usr/lib/syslinux/isolinux.bin "$BUILD_DIR/iso/isolinux/"

for mod in ldlinux.c32 libutil.c32 libcom32.c32 menu.c32 vesamenu.c32; do
    for d in /usr/lib/syslinux/modules/bios /usr/share/syslinux /usr/lib/syslinux; do
        [ -f "$d/$mod" ] && cp "$d/$mod" "$BUILD_DIR/iso/isolinux/" 2>/dev/null && break
    done
done

cat > "$BUILD_DIR/iso/isolinux/isolinux.cfg" << 'EOF'
DEFAULT install
TIMEOUT 30
PROMPT 0

UI menu.c32

MENU TITLE WISPTools EPC/SNMP Server
MENU COLOR border       30;44   #40ffffff #a0000000 std
MENU COLOR title        1;36;44 #9033ccff #a0000000 std
MENU COLOR sel          7;37;40 #e0ffffff #20ffffff all

LABEL install
    MENU LABEL ^Install WISPTools EPC/SNMP (Automatic)
    MENU DEFAULT
    KERNEL /live/vmlinuz
    APPEND initrd=/live/initrd boot=live toram quiet splash

LABEL install-verbose
    MENU LABEL Install with Verbose Output
    KERNEL /live/vmlinuz
    APPEND initrd=/live/initrd boot=live toram
EOF

# GRUB for UEFI
cat > "$BUILD_DIR/iso/boot/grub/grub.cfg" << 'EOF'
set timeout=3
set default=0

insmod all_video

menuentry "Install WISPTools EPC/SNMP (Automatic)" {
    linux /live/vmlinuz boot=live toram quiet splash
    initrd /live/initrd
}

menuentry "Install with Verbose Output" {
    linux /live/vmlinuz boot=live toram
    initrd /live/initrd
}
EOF

# Create EFI boot image
print_status "Creating UEFI boot support..."
dd if=/dev/zero of="$BUILD_DIR/iso/boot/grub/efi.img" bs=1M count=4 2>/dev/null
mkfs.vfat "$BUILD_DIR/iso/boot/grub/efi.img" >/dev/null
mmd -i "$BUILD_DIR/iso/boot/grub/efi.img" ::/EFI ::/EFI/BOOT

grub-mkimage -o "$BUILD_DIR/scratch/bootx64.efi" -p /boot/grub -O x86_64-efi \
    normal linux boot all_video configfile part_gpt part_msdos fat iso9660 search 2>/dev/null || \
grub-mkimage -o "$BUILD_DIR/scratch/bootx64.efi" -p /boot/grub -O x86_64-efi \
    normal linux boot configfile fat iso9660 2>/dev/null

mcopy -i "$BUILD_DIR/iso/boot/grub/efi.img" "$BUILD_DIR/scratch/bootx64.efi" ::/EFI/BOOT/BOOTX64.EFI
mcopy -i "$BUILD_DIR/iso/boot/grub/efi.img" "$BUILD_DIR/iso/boot/grub/grub.cfg" ::/EFI/BOOT/grub.cfg
cp "$BUILD_DIR/scratch/bootx64.efi" "$BUILD_DIR/iso/EFI/BOOT/BOOTX64.EFI"
cp "$BUILD_DIR/iso/boot/grub/grub.cfg" "$BUILD_DIR/iso/EFI/BOOT/"

# ============================================================================
# Build ISO
# ============================================================================
print_status "Building ISO..."

ISOHDPFX=""
[ -f /usr/lib/ISOLINUX/isohdpfx.bin ] && ISOHDPFX="-isohybrid-mbr /usr/lib/ISOLINUX/isohdpfx.bin"

xorriso -as mkisofs \
    -r -V "WISPTOOLS_EPC" \
    -J -joliet-long \
    -b isolinux/isolinux.bin \
    -c isolinux/boot.cat \
    -boot-load-size 4 \
    -boot-info-table \
    -no-emul-boot \
    -eltorito-alt-boot \
    -e boot/grub/efi.img \
    -no-emul-boot \
    $ISOHDPFX \
    -o "$ISO_OUTPUT_DIR/$ISO_FILENAME" \
    "$BUILD_DIR/iso" 2>&1 | grep -v "NOTE"

# Make hybrid
isohybrid --uefi "$ISO_OUTPUT_DIR/$ISO_FILENAME" 2>/dev/null || true

# Checksums
cd "$ISO_OUTPUT_DIR"
sha256sum "$ISO_FILENAME" > "$ISO_FILENAME.sha256"
md5sum "$ISO_FILENAME" > "$ISO_FILENAME.md5"
chmod 644 "$ISO_FILENAME"*

ISO_SIZE=$(($(stat -c%s "$ISO_OUTPUT_DIR/$ISO_FILENAME") / 1024 / 1024))

# Cleanup
rm -rf "$BUILD_DIR/chroot" "$BUILD_DIR/iso" "$BUILD_DIR/scratch"

echo ""
print_status "═══════════════════════════════════════════════════════════════"
print_success "  WISPTools EPC/SNMP ISO Created Successfully!"
print_status "═══════════════════════════════════════════════════════════════"
echo ""
print_status "ISO: $ISO_OUTPUT_DIR/$ISO_FILENAME (${ISO_SIZE}MB)"
print_status "URL: https://${GCE_DOMAIN}/downloads/isos/$ISO_FILENAME"
echo ""
print_status "What this ISO does:"
print_status "  1. Boots from USB/CD"
print_status "  2. Auto-installs complete OS to local disk"
print_status "  3. Includes Open5GS EPC + SNMP agent packages"
print_status "  4. Reboots into installed system"
print_status "  5. Displays device code on screen"
print_status "  6. Configures EPC/SNMP when linked in portal"
echo ""
print_status "Features:"
print_status "  ✓ Zero interaction required"
print_status "  ✓ UEFI + Legacy BIOS boot"
print_status "  ✓ Complete OS with all packages"
print_status "  ✓ Open5GS EPC (MME, HSS, SGW, PGW)"
print_status "  ✓ SNMP monitoring agent"
echo ""
print_status "Credentials: wisp / wisp123"
echo ""

