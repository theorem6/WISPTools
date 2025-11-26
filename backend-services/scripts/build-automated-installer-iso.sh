#!/bin/bash
# Build Fully Automated WISPTools EPC Installer ISO
# Uses Debian netboot for reliable unattended installation
# Supports UEFI + Legacy BIOS boot
# Uses local GCE APT repository - no external downloads needed

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() { echo -e "${CYAN}▶${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

# Configuration
ISO_OUTPUT_DIR="/var/www/html/downloads/isos"
ISO_BUILD_DIR="/opt/epc-iso-builder"
ISO_FILENAME="wisptools-epc-generic-netinstall.iso"
APT_REPO_DIR="/var/www/html/apt"
GCE_DOMAIN="${GCE_DOMAIN:-hss.wisptools.io}"
GCE_PUBLIC_IP="${GCE_PUBLIC_IP:-136.112.111.167}"
HSS_PORT="${HSS_PORT:-3001}"

# Debian version for netboot
DEBIAN_VERSION="bookworm"
DEBIAN_MIRROR="https://deb.debian.org/debian"

echo ""
print_status "═══════════════════════════════════════════════════════════════"
print_status "  WISPTools.io Automated EPC Installer ISO Builder"
print_status "  Using Debian ${DEBIAN_VERSION} netboot + Local APT Repository"
print_status "═══════════════════════════════════════════════════════════════"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Install required packages
print_status "Installing required packages..."
apt-get update -qq
apt-get install -y xorriso isolinux syslinux-common grub-pc-bin grub-efi-amd64-bin \
    mtools wget curl genisoimage dosfstools debian-installer-12-netboot-amd64 2>/dev/null || \
apt-get install -y xorriso isolinux syslinux-common grub-pc-bin grub-efi-amd64-bin \
    mtools wget curl genisoimage dosfstools

# Create directories
mkdir -p "$ISO_BUILD_DIR/netboot" "$ISO_OUTPUT_DIR" "$APT_REPO_DIR"
cd "$ISO_BUILD_DIR"

# ============================================================================
# STEP 1: Download Debian netboot files
# ============================================================================
print_status "Downloading Debian netboot installer files..."

NETBOOT_DIR="$ISO_BUILD_DIR/netboot"
NETBOOT_URL="https://deb.debian.org/debian/dists/${DEBIAN_VERSION}/main/installer-amd64/current/images/netboot/debian-installer/amd64"

# Download kernel and initrd
for file in linux initrd.gz; do
    if [ ! -f "$NETBOOT_DIR/$file" ] || [ $(stat -c%s "$NETBOOT_DIR/$file" 2>/dev/null || echo 0) -lt 1000000 ]; then
        print_status "Downloading $file..."
        wget -q --show-progress -O "$NETBOOT_DIR/$file" "$NETBOOT_URL/$file" || {
            print_error "Failed to download $file"
            exit 1
        }
    else
        print_success "$file already cached"
    fi
done

print_success "Netboot files ready"

# ============================================================================
# STEP 2: Create preseed configuration for automated install
# ============================================================================
print_status "Creating preseed configuration..."

PRESEED_DIR="/var/www/html/downloads/netboot"
mkdir -p "$PRESEED_DIR"

# Create comprehensive preseed file
cat > "$PRESEED_DIR/preseed.cfg" << 'PRESEEDCFG'
### Localization
d-i debian-installer/locale string en_US.UTF-8
d-i keyboard-configuration/xkb-keymap select us
d-i console-setup/ask_detect boolean false

### Network configuration
d-i netcfg/choose_interface select auto
d-i netcfg/get_hostname string epc-server
d-i netcfg/get_domain string wisptools.local
d-i netcfg/hostname string epc-server

# Don't ask for proxy
d-i mirror/http/proxy string

### Mirror settings - Use GCE local repository
d-i mirror/protocol string http
d-i mirror/country string manual
d-i mirror/http/hostname string __GCE_DOMAIN__
d-i mirror/http/directory string /apt
d-i mirror/http/proxy string
d-i mirror/suite string stable

# Fallback to Debian if local repo fails
d-i apt-setup/use_mirror boolean true
d-i apt-setup/services-select multiselect security, updates
d-i apt-setup/security_host string security.debian.org

### Clock and time zone
d-i clock-setup/utc boolean true
d-i time/zone string UTC
d-i clock-setup/ntp boolean true

### Partitioning
d-i partman-auto/method string regular
d-i partman-auto/choose_recipe select atomic
d-i partman-partitioning/confirm_write_new_label boolean true
d-i partman/choose_partition select finish
d-i partman/confirm boolean true
d-i partman/confirm_nooverwrite boolean true

# Handle LVM if present
d-i partman-lvm/device_remove_lvm boolean true
d-i partman-md/device_remove_md boolean true
d-i partman-lvm/confirm boolean true
d-i partman-lvm/confirm_nooverwrite boolean true

### User account
d-i passwd/root-login boolean false
d-i passwd/user-fullname string WISPTools Administrator
d-i passwd/username string wisp
# Password: wisp123
d-i passwd/user-password-crypted string $6$rounds=4096$WISPToolsSalt$e4nFmKTgLQkPBvQlUGE7yP6VzSbHKRn3JvVxKU8JWYM4FhFBOvGW8gCvLCqvnAhxN8vJGrKTvY/0LHUmxGJKe.

### Package selection
tasksel tasksel/first multiselect standard, ssh-server
d-i pkgsel/include string curl wget ca-certificates gnupg lsb-release openssh-server jq net-tools python3 python3-pip sudo vim htop

# No popularity contest
popularity-contest popularity-contest/participate boolean false

### Boot loader
d-i grub-installer/only_debian boolean true
d-i grub-installer/bootdev string default
d-i grub-installer/with_other_os boolean false

### Finish up
d-i finish-install/reboot_in_progress note
d-i debian-installer/exit/poweroff boolean false

### Late commands - WISPTools setup
d-i preseed/late_command string \
    in-target mkdir -p /etc/wisptools /opt/wisptools /var/lib/wisptools; \
    in-target bash -c 'DEVICE_CODE=$(head /dev/urandom | tr -dc A-Z | head -c4)$(head /dev/urandom | tr -dc 0-9 | head -c4); echo "DEVICE_CODE=$DEVICE_CODE" > /etc/wisptools/device-code.env; chmod 644 /etc/wisptools/device-code.env'; \
    wget -O /target/opt/wisptools/checkin.sh http://__GCE_DOMAIN__/downloads/netboot/checkin.sh; \
    in-target chmod +x /opt/wisptools/checkin.sh; \
    wget -O /target/etc/systemd/system/wisptools-checkin.service http://__GCE_DOMAIN__/downloads/netboot/wisptools-checkin.service; \
    wget -O /target/etc/systemd/system/wisptools-checkin.timer http://__GCE_DOMAIN__/downloads/netboot/wisptools-checkin.timer; \
    in-target systemctl enable wisptools-checkin.timer; \
    in-target systemctl enable ssh; \
    in-target bash -c 'echo "wisp ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/wisp'; \
    echo "WISPTools EPC installed: $(date)" >> /target/var/log/wisptools-install.log
PRESEEDCFG

# Replace variables
sed -i "s/__GCE_DOMAIN__/${GCE_DOMAIN}/g" "$PRESEED_DIR/preseed.cfg"

print_success "Preseed configuration created"

# ============================================================================
# STEP 3: Create the check-in script
# ============================================================================
print_status "Creating check-in script..."

cat > "$PRESEED_DIR/checkin.sh" << 'CHECKINSH'
#!/bin/bash
# WISPTools EPC Check-in Script
# Phones home to get EPC configuration

set -e

LOG_FILE="/var/log/wisptools-checkin.log"
CREDENTIALS_FILE="/etc/wisptools/credentials.env"
DEVICE_CODE_FILE="/etc/wisptools/device-code.env"
BOOTSTRAPPED_FILE="/var/lib/wisptools/.bootstrapped"
GCE_DOMAIN="__GCE_DOMAIN__"
HSS_PORT="__HSS_PORT__"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Exit if already bootstrapped
if [ -f "$BOOTSTRAPPED_FILE" ]; then
    log "Already bootstrapped, exiting"
    exit 0
fi

log "Starting WISPTools EPC check-in..."

# Load device code
if [ -f "$DEVICE_CODE_FILE" ]; then
    source "$DEVICE_CODE_FILE"
fi

if [ -z "$DEVICE_CODE" ]; then
    # Generate one if missing
    DEVICE_CODE=$(head /dev/urandom | tr -dc 'A-Z' | head -c4)$(head /dev/urandom | tr -dc '0-9' | head -c4)
    echo "DEVICE_CODE=$DEVICE_CODE" > "$DEVICE_CODE_FILE"
    chmod 644 "$DEVICE_CODE_FILE"
fi

log "Device Code: $DEVICE_CODE"

# Wait for network
log "Waiting for network..."
for i in {1..60}; do
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        log "Network is up"
        break
    fi
    sleep 2
done

# Get hardware info
HARDWARE_ID=$(ip link show | grep -A1 "state UP" | grep ether | head -1 | awk '{print $2}')
if [ -z "$HARDWARE_ID" ]; then
    HARDWARE_ID=$(cat /sys/class/net/*/address 2>/dev/null | grep -v 00:00:00:00:00:00 | head -1)
fi

IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')
log "Hardware ID: $HARDWARE_ID, IP: $IP_ADDR"

# Create device status page
mkdir -p /var/www/html
cat > /var/www/html/index.html << STATUSHTML
<!DOCTYPE html>
<html>
<head>
    <title>WISPTools EPC Device</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #eee; min-height: 100vh; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { color: #00ff88; margin-bottom: 10px; }
        .code { font-size: 64px; font-weight: bold; color: #00ff88; letter-spacing: 12px; margin: 40px 0; font-family: monospace; text-shadow: 0 0 20px rgba(0,255,136,0.5); }
        .info { color: #888; margin: 15px 0; font-size: 14px; }
        .status { padding: 15px 30px; border-radius: 8px; display: inline-block; font-weight: bold; }
        .waiting { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: #000; }
        .instructions { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 30px 0; text-align: left; }
        .instructions li { margin: 10px 0; }
        code { background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 4px; }
    </style>
    <meta http-equiv="refresh" content="30">
</head>
<body>
    <div class="container">
        <h1>🛡️ WISPTools EPC Device</h1>
        <p>Enter this code in the WISPTools Management Portal:</p>
        <div class="code">$DEVICE_CODE</div>
        <div class="status waiting">⏳ Waiting for Configuration</div>
        <div class="instructions">
            <h3>📋 Next Steps:</h3>
            <ol>
                <li>Log in to <a href="https://wisptools-production.web.app" style="color:#00ff88">WISPTools Portal</a></li>
                <li>Go to <strong>Deploy</strong> module</li>
                <li>Find your EPC deployment and enter code: <code>$DEVICE_CODE</code></li>
                <li>This device will automatically configure itself</li>
            </ol>
        </div>
        <p class="info">Hardware ID: $HARDWARE_ID</p>
        <p class="info">IP Address: $IP_ADDR</p>
        <p class="info">This page refreshes automatically every 30 seconds</p>
    </div>
</body>
</html>
STATUSHTML

# Start simple HTTP server
if ! pgrep -f "python3 -m http.server 80" > /dev/null; then
    cd /var/www/html && nohup python3 -m http.server 80 &>/dev/null &
    log "Started HTTP server for device status page at http://$IP_ADDR/"
fi

# Display device code on console
echo ""
echo "=============================================="
echo "  WISPTools EPC Device Code: $DEVICE_CODE"
echo "=============================================="
echo "  Enter this code in the management portal"
echo "  Device IP: $IP_ADDR"
echo "=============================================="
echo ""

# Phone home
log "Checking in with GCE server..."
RESPONSE=$(curl -s -X POST "https://$GCE_DOMAIN:$HSS_PORT/api/epc/checkin" \
    -H "Content-Type: application/json" \
    -d "{
        \"device_code\": \"$DEVICE_CODE\",
        \"hardware_id\": \"$HARDWARE_ID\",
        \"hostname\": \"$(hostname)\",
        \"ip_address\": \"$IP_ADDR\",
        \"os_version\": \"$(cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"')\"
    }" 2>&1) || {
    log "ERROR: Failed to contact GCE server, will retry..."
    exit 1
}

log "Response: $RESPONSE"

# Check response
EPC_ID=$(echo "$RESPONSE" | jq -r '.epc_id // empty' 2>/dev/null)
STATUS=$(echo "$RESPONSE" | jq -r '.status // empty' 2>/dev/null)

if [ "$STATUS" = "waiting" ] || [ -z "$EPC_ID" ] || [ "$EPC_ID" = "null" ]; then
    log "Device code not yet linked. Waiting for user to enter code in portal..."
    exit 1
fi

log "Assigned EPC: $EPC_ID"

# Save credentials
CHECKIN_TOKEN=$(echo "$RESPONSE" | jq -r '.checkin_token // empty' 2>/dev/null)
cat > "$CREDENTIALS_FILE" << CREDS
EPC_ID=$EPC_ID
CHECKIN_TOKEN=$CHECKIN_TOKEN
GCE_DOMAIN=$GCE_DOMAIN
HSS_PORT=$HSS_PORT
HARDWARE_ID=$HARDWARE_ID
DEVICE_CODE=$DEVICE_CODE
CREDS
chmod 600 "$CREDENTIALS_FILE"

# Download and run deployment script
log "Downloading deployment script..."
curl -s -o /opt/wisptools/deploy.sh "https://$GCE_DOMAIN:$HSS_PORT/api/epc/$EPC_ID/deploy?checkin_token=$CHECKIN_TOKEN" || {
    log "ERROR: Failed to download deployment script"
    exit 1
}

chmod +x /opt/wisptools/deploy.sh
log "Running deployment..."
bash /opt/wisptools/deploy.sh 2>&1 | tee -a "$LOG_FILE"

# Mark as bootstrapped
touch "$BOOTSTRAPPED_FILE"

# Update status page
cat > /var/www/html/index.html << STATUSHTML
<!DOCTYPE html>
<html>
<head>
    <title>WISPTools EPC Device - Connected</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #eee; min-height: 100vh; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { color: #00ff88; }
        .code { font-size: 48px; font-weight: bold; color: #00ff88; letter-spacing: 8px; margin: 30px 0; }
        .info { color: #888; margin: 15px 0; }
        .status { padding: 15px 30px; border-radius: 8px; display: inline-block; font-weight: bold; background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); color: #fff; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ WISPTools EPC Device</h1>
        <div class="code">$DEVICE_CODE</div>
        <div class="status">🟢 Connected & Configured</div>
        <p class="info">EPC ID: $EPC_ID</p>
        <p class="info">Hardware ID: $HARDWARE_ID</p>
        <p class="info">IP Address: $IP_ADDR</p>
    </div>
</body>
</html>
STATUSHTML

log "Check-in and deployment complete!"
CHECKINSH

# Replace variables
sed -i "s/__GCE_DOMAIN__/${GCE_DOMAIN}/g" "$PRESEED_DIR/checkin.sh"
sed -i "s/__HSS_PORT__/${HSS_PORT}/g" "$PRESEED_DIR/checkin.sh"
chmod +x "$PRESEED_DIR/checkin.sh"

# Create systemd service
cat > "$PRESEED_DIR/wisptools-checkin.service" << 'SERVICEUNIT'
[Unit]
Description=WISPTools EPC Check-in Service
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/wisptools/checkin.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEUNIT

# Create systemd timer
cat > "$PRESEED_DIR/wisptools-checkin.timer" << 'TIMERUNIT'
[Unit]
Description=WISPTools EPC Check-in Timer
After=network-online.target

[Timer]
OnBootSec=30
OnUnitActiveSec=60
AccuracySec=10

[Install]
WantedBy=timers.target
TIMERUNIT

print_success "Check-in script and services created"

# ============================================================================
# STEP 4: Build the ISO
# ============================================================================
print_status "Building bootable ISO..."

ISO_ROOT="$ISO_BUILD_DIR/iso_root"
rm -rf "$ISO_ROOT"
mkdir -p "$ISO_ROOT"/{boot/grub,isolinux,install.amd,.disk}

# Copy netboot files
cp "$NETBOOT_DIR/linux" "$ISO_ROOT/install.amd/vmlinuz"
cp "$NETBOOT_DIR/initrd.gz" "$ISO_ROOT/install.amd/initrd.gz"

# Copy isolinux files for BIOS boot
if [ -d /usr/lib/ISOLINUX ]; then
    cp /usr/lib/ISOLINUX/isolinux.bin "$ISO_ROOT/isolinux/"
    cp /usr/lib/ISOLINUX/ldlinux.c32 "$ISO_ROOT/isolinux/" 2>/dev/null || true
elif [ -f /usr/lib/syslinux/isolinux.bin ]; then
    cp /usr/lib/syslinux/isolinux.bin "$ISO_ROOT/isolinux/"
    cp /usr/lib/syslinux/ldlinux.c32 "$ISO_ROOT/isolinux/" 2>/dev/null || true
fi

# Copy syslinux modules
for mod in libutil.c32 libcom32.c32 menu.c32 vesamenu.c32 ldlinux.c32; do
    for dir in /usr/lib/syslinux/modules/bios /usr/share/syslinux /usr/lib/syslinux; do
        if [ -f "$dir/$mod" ]; then
            cp "$dir/$mod" "$ISO_ROOT/isolinux/" 2>/dev/null || true
            break
        fi
    done
done

# Create isolinux config (BIOS boot)
cat > "$ISO_ROOT/isolinux/isolinux.cfg" << ISOLINUXCFG
DEFAULT wisptools
TIMEOUT 50
PROMPT 0

UI menu.c32

MENU TITLE WISPTools EPC Installer
MENU COLOR border       30;44   #40ffffff #a0000000 std
MENU COLOR title        1;36;44 #9033ccff #a0000000 std
MENU COLOR sel          7;37;40 #e0ffffff #20ffffff all
MENU COLOR unsel        37;44   #50ffffff #a0000000 std

LABEL wisptools
    MENU LABEL ^WISPTools EPC - Automated Install
    MENU DEFAULT
    KERNEL /install.amd/vmlinuz
    APPEND initrd=/install.amd/initrd.gz auto=true priority=critical url=http://${GCE_DOMAIN}/downloads/netboot/preseed.cfg interface=auto netcfg/dhcp_timeout=60 --- quiet

LABEL manual
    MENU LABEL ^Manual Install (Expert)
    KERNEL /install.amd/vmlinuz
    APPEND initrd=/install.amd/initrd.gz --- quiet

LABEL local
    MENU LABEL ^Boot from Hard Disk
    LOCALBOOT 0
ISOLINUXCFG

# Create GRUB config (UEFI boot)
cat > "$ISO_ROOT/boot/grub/grub.cfg" << GRUBCFG
set timeout=5
set default=0

insmod all_video
insmod gfxterm
insmod png

if loadfont /boot/grub/fonts/unicode.pf2 ; then
    set gfxmode=auto
    terminal_output gfxterm
fi

set menu_color_normal=white/black
set menu_color_highlight=black/light-green

menuentry "WISPTools EPC - Automated Install" {
    linux /install.amd/vmlinuz auto=true priority=critical url=http://${GCE_DOMAIN}/downloads/netboot/preseed.cfg interface=auto netcfg/dhcp_timeout=60 --- quiet
    initrd /install.amd/initrd.gz
}

menuentry "Manual Install (Expert)" {
    linux /install.amd/vmlinuz --- quiet
    initrd /install.amd/initrd.gz
}

menuentry "Boot from Hard Disk" {
    set root=(hd0)
    chainloader +1
}
GRUBCFG

# Create disk info
echo "WISPTools EPC Installer - Debian ${DEBIAN_VERSION}" > "$ISO_ROOT/.disk/info"

# Create UEFI boot image
print_status "Creating UEFI boot image..."
mkdir -p "$ISO_ROOT/EFI/BOOT"

# Create EFI boot image
dd if=/dev/zero of="$ISO_ROOT/boot/grub/efi.img" bs=1M count=4 2>/dev/null
mkfs.vfat "$ISO_ROOT/boot/grub/efi.img" >/dev/null
mmd -i "$ISO_ROOT/boot/grub/efi.img" ::/EFI ::/EFI/BOOT

# Create GRUB EFI binary
grub-mkimage -o /tmp/bootx64.efi -p /boot/grub -O x86_64-efi \
    normal linux boot all_video configfile part_gpt part_msdos fat iso9660 search search_fs_uuid search_label

mcopy -i "$ISO_ROOT/boot/grub/efi.img" /tmp/bootx64.efi ::/EFI/BOOT/BOOTX64.EFI
mcopy -i "$ISO_ROOT/boot/grub/efi.img" "$ISO_ROOT/boot/grub/grub.cfg" ::/EFI/BOOT/grub.cfg
cp /tmp/bootx64.efi "$ISO_ROOT/EFI/BOOT/BOOTX64.EFI"

# Build the ISO
print_status "Building final ISO..."
OUTPUT_ISO="$ISO_OUTPUT_DIR/$ISO_FILENAME"
rm -f "$OUTPUT_ISO"

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
    -isohybrid-mbr /usr/lib/ISOLINUX/isohdpfx.bin 2>/dev/null || \
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
    -o "$OUTPUT_ISO" \
    "$ISO_ROOT"

# Make hybrid for USB boot
if command -v isohybrid &>/dev/null; then
    isohybrid --uefi "$OUTPUT_ISO" 2>/dev/null || true
fi

# Verify ISO was created
if [ ! -f "$OUTPUT_ISO" ] || [ ! -s "$OUTPUT_ISO" ]; then
    print_error "ISO creation failed"
    exit 1
fi

# Generate checksums
cd "$ISO_OUTPUT_DIR"
sha256sum "$ISO_FILENAME" > "$ISO_FILENAME.sha256"
md5sum "$ISO_FILENAME" > "$ISO_FILENAME.md5"
chmod 644 "$ISO_FILENAME" "$ISO_FILENAME.sha256" "$ISO_FILENAME.md5"

# Get sizes
ISO_SIZE=$(stat -c%s "$OUTPUT_ISO")
ISO_SIZE_MB=$((ISO_SIZE / 1024 / 1024))

# Cleanup
rm -rf "$ISO_ROOT"

echo ""
print_status "═══════════════════════════════════════════════════════════════"
print_success "  WISPTools EPC Installer ISO Built Successfully!"
print_status "═══════════════════════════════════════════════════════════════"
echo ""
print_status "ISO Location: $OUTPUT_ISO"
print_status "ISO Size: ${ISO_SIZE_MB}MB"
print_status "Download URL: https://${GCE_DOMAIN}/downloads/isos/${ISO_FILENAME}"
echo ""
print_status "Features:"
print_status "  ✓ UEFI + Legacy BIOS boot support"
print_status "  ✓ Fully automated installation"
print_status "  ✓ Uses local APT repository"
print_status "  ✓ Auto check-in with device code"
print_status "  ✓ Hybrid ISO - works from USB or CD"
echo ""
print_status "Default credentials:"
print_status "  Username: wisp"
print_status "  Password: wisp123"
echo ""
print_status "After boot, find device code at:"
print_status "  Console output OR http://<device-ip>/"
echo ""

exit 0

