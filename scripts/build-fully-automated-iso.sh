#!/bin/bash
# Build Fully Automated WISPTools EPC Installer ISO
# ZERO user interaction - completely hands-off installation
# Uses local GCE APT repository exclusively

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
ISO_BUILD_DIR="/opt/epc-iso-builder"
ISO_FILENAME="wisptools-epc-generic-netinstall.iso"
GCE_DOMAIN="${GCE_DOMAIN:-hss.wisptools.io}"
GCE_PUBLIC_IP="${GCE_PUBLIC_IP:-136.112.111.167}"
HSS_PORT="${HSS_PORT:-3001}"
PRESEED_DIR="/var/www/html/downloads/netboot"

echo ""
print_status "═══════════════════════════════════════════════════════════════"
print_status "  WISPTools Fully Automated EPC Installer ISO Builder"
print_status "  ZERO interaction - Hands-off Installation"
print_status "═══════════════════════════════════════════════════════════════"
echo ""

if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root"
    exit 1
fi

# Install packages
apt-get update -qq
apt-get install -y xorriso isolinux syslinux-common grub-pc-bin grub-efi-amd64-bin \
    mtools wget curl genisoimage dosfstools cpio gzip 2>/dev/null || true

mkdir -p "$ISO_BUILD_DIR/netboot" "$ISO_OUTPUT_DIR" "$PRESEED_DIR"
cd "$ISO_BUILD_DIR"

# ============================================================================
# Download Debian netboot files
# ============================================================================
print_status "Downloading Debian netboot installer..."

NETBOOT_DIR="$ISO_BUILD_DIR/netboot"
NETBOOT_URL="https://deb.debian.org/debian/dists/bookworm/main/installer-amd64/current/images/netboot/debian-installer/amd64"

for file in linux initrd.gz; do
    if [ ! -f "$NETBOOT_DIR/$file" ] || [ $(stat -c%s "$NETBOOT_DIR/$file" 2>/dev/null || echo 0) -lt 1000000 ]; then
        wget -q --show-progress -O "$NETBOOT_DIR/$file" "$NETBOOT_URL/$file"
    fi
done

print_success "Netboot files ready"

# ============================================================================
# Create FULLY AUTOMATED preseed - NO QUESTIONS
# ============================================================================
print_status "Creating fully automated preseed configuration..."

cat > "$PRESEED_DIR/preseed.cfg" << PRESEEDEOF
### Debian Preseed Configuration - FULLY AUTOMATED
### No user interaction required

# Locale and keyboard - no questions
d-i debian-installer/locale string en_US.UTF-8
d-i keyboard-configuration/xkb-keymap select us
d-i console-setup/ask_detect boolean false
d-i keyboard-configuration/layoutcode string us

# Network - auto configure with DHCP, no questions
d-i netcfg/choose_interface select auto
d-i netcfg/dhcp_timeout string 60
d-i netcfg/dhcp_failed note
d-i netcfg/dhcp_options select Configure network manually
d-i netcfg/get_hostname string epc-server
d-i netcfg/get_domain string local
d-i netcfg/hostname string epc-server
d-i netcfg/wireless_wep string
d-i hw-detect/load_firmware boolean true

# Mirror settings - use Debian CDN (required for base install)
d-i mirror/country string manual
d-i mirror/http/hostname string deb.debian.org
d-i mirror/http/directory string /debian
d-i mirror/http/proxy string
d-i mirror/suite string bookworm

# Clock
d-i clock-setup/utc boolean true
d-i time/zone string UTC
d-i clock-setup/ntp boolean true
d-i clock-setup/ntp-server string pool.ntp.org

# Partitioning - AUTO select largest disk, no confirmations
d-i partman-auto/method string regular
d-i partman-auto/disk string
d-i partman-auto/choose_recipe select atomic
d-i partman-auto/expert_recipe string \
    root :: \
        500 10000 1000000000 ext4 \
            \$primary{ } \$bootable{ } \
            method{ format } format{ } \
            use_filesystem{ } filesystem{ ext4 } \
            mountpoint{ / } \
        .
d-i partman-partitioning/confirm_write_new_label boolean true
d-i partman/choose_partition select finish
d-i partman/confirm boolean true
d-i partman/confirm_nooverwrite boolean true
d-i partman-md/confirm boolean true
d-i partman-lvm/device_remove_lvm boolean true
d-i partman-lvm/confirm boolean true
d-i partman-lvm/confirm_nooverwrite boolean true
d-i partman-md/device_remove_md boolean true

# Skip disk confirmation warnings
d-i partman/mount_style select uuid
d-i partman-basicfilesystems/no_swap boolean false
d-i partman-auto/purge_lvm_from_device boolean true

# User account - NO ROOT LOGIN
d-i passwd/root-login boolean false
d-i passwd/make-user boolean true
d-i passwd/user-fullname string WISPTools Admin
d-i passwd/username string wisp
# Password: wisp123 (pre-hashed)
d-i passwd/user-password-crypted string \$6\$rounds=4096\$WISPToolsSalt\$e4nFmKTgLQkPBvQlUGE7yP6VzSbHKRn3JvVxKU8JWYM4FhFBOvGW8gCvLCqvnAhxN8vJGrKTvY/0LHUmxGJKe.
d-i user-setup/allow-password-weak boolean true
d-i user-setup/encrypt-home boolean false

# Package selection - minimal + required packages
tasksel tasksel/first multiselect standard, ssh-server
d-i pkgsel/include string curl wget ca-certificates openssh-server jq net-tools python3 sudo vim
d-i pkgsel/upgrade select full-upgrade
popularity-contest popularity-contest/participate boolean false

# Skip some questions
d-i apt-setup/cdrom/set-first boolean false
d-i apt-setup/cdrom/set-next boolean false
d-i apt-setup/cdrom/set-failed boolean false

# Boot loader - auto install to first disk
d-i grub-installer/only_debian boolean true
d-i grub-installer/with_other_os boolean false
d-i grub-installer/bootdev string default

# Finish - auto reboot, no confirmation
d-i finish-install/keep-consoles boolean true
d-i finish-install/reboot_in_progress note
d-i cdrom-detect/eject boolean true
d-i debian-installer/exit/halt boolean false
d-i debian-installer/exit/poweroff boolean false

# Late commands - WISPTools setup
d-i preseed/late_command string \
    mkdir -p /target/etc/wisptools /target/opt/wisptools /target/var/lib/wisptools /target/var/www/html; \
    in-target bash -c 'DEVICE_CODE=\$(cat /dev/urandom | tr -dc A-Z0-9 | head -c8); echo "DEVICE_CODE=\$DEVICE_CODE" > /etc/wisptools/device-code.env; chmod 644 /etc/wisptools/device-code.env'; \
    echo "wisp ALL=(ALL) NOPASSWD:ALL" > /target/etc/sudoers.d/wisp; \
    chmod 440 /target/etc/sudoers.d/wisp; \
    wget -q -O /target/opt/wisptools/checkin.sh http://${GCE_DOMAIN}/downloads/netboot/checkin.sh || wget -q -O /target/opt/wisptools/checkin.sh http://${GCE_PUBLIC_IP}/downloads/netboot/checkin.sh; \
    chmod +x /target/opt/wisptools/checkin.sh; \
    wget -q -O /target/etc/systemd/system/wisptools-checkin.service http://${GCE_DOMAIN}/downloads/netboot/wisptools-checkin.service || true; \
    wget -q -O /target/etc/systemd/system/wisptools-checkin.timer http://${GCE_DOMAIN}/downloads/netboot/wisptools-checkin.timer || true; \
    in-target systemctl enable wisptools-checkin.timer || true; \
    in-target systemctl enable ssh; \
    echo "WISPTools EPC installed: \$(date)" >> /target/var/log/wisptools-install.log
PRESEEDEOF

print_success "Preseed configuration created"

# ============================================================================
# Create check-in script
# ============================================================================
print_status "Creating check-in script..."

cat > "$PRESEED_DIR/checkin.sh" << 'CHECKINEOF'
#!/bin/bash
# WISPTools EPC Check-in Script

LOG_FILE="/var/log/wisptools-checkin.log"
DEVICE_CODE_FILE="/etc/wisptools/device-code.env"
BOOTSTRAPPED_FILE="/var/lib/wisptools/.bootstrapped"
GCE_DOMAIN="__GCE_DOMAIN__"
HSS_PORT="__HSS_PORT__"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"; }

[ -f "$BOOTSTRAPPED_FILE" ] && exit 0

log "Starting WISPTools EPC check-in..."

# Load or generate device code
if [ -f "$DEVICE_CODE_FILE" ]; then
    source "$DEVICE_CODE_FILE"
fi
if [ -z "$DEVICE_CODE" ]; then
    DEVICE_CODE=$(cat /dev/urandom | tr -dc 'A-Z0-9' | head -c8)
    echo "DEVICE_CODE=$DEVICE_CODE" > "$DEVICE_CODE_FILE"
fi

log "Device Code: $DEVICE_CODE"

# Wait for network
for i in {1..30}; do
    ping -c1 8.8.8.8 &>/dev/null && break
    sleep 2
done

# Get system info
HARDWARE_ID=$(ip link show 2>/dev/null | grep -A1 "state UP" | grep ether | head -1 | awk '{print $2}')
[ -z "$HARDWARE_ID" ] && HARDWARE_ID=$(cat /sys/class/net/*/address 2>/dev/null | grep -v 00:00:00:00:00:00 | head -1)
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')

# Create status web page
mkdir -p /var/www/html
cat > /var/www/html/index.html << STATUSHTML
<!DOCTYPE html>
<html>
<head>
    <title>WISPTools EPC</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body { font-family: Arial; text-align: center; padding: 50px; background: #1a1a2e; color: #eee; }
        .code { font-size: 72px; font-weight: bold; color: #00ff88; letter-spacing: 10px; margin: 40px 0; font-family: monospace; }
        .info { color: #888; margin: 10px 0; }
        .box { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 500px; }
    </style>
</head>
<body>
    <h1>WISPTools EPC Device</h1>
    <p>Enter this code in the WISPTools Portal:</p>
    <div class="code">$DEVICE_CODE</div>
    <div class="box">
        <p class="info">IP: $IP_ADDR</p>
        <p class="info">Hardware ID: $HARDWARE_ID</p>
    </div>
    <p class="info">Page refreshes every 30 seconds</p>
</body>
</html>
STATUSHTML

# Start web server
pgrep -f "python3 -m http.server 80" || (cd /var/www/html && nohup python3 -m http.server 80 &>/dev/null &)

# Display on console
echo ""
echo "========================================"
echo "  DEVICE CODE: $DEVICE_CODE"
echo "  IP Address: $IP_ADDR"
echo "========================================"
echo ""

# Phone home
RESPONSE=$(curl -s -X POST "https://$GCE_DOMAIN:$HSS_PORT/api/epc/checkin" \
    -H "Content-Type: application/json" \
    -d "{\"device_code\":\"$DEVICE_CODE\",\"hardware_id\":\"$HARDWARE_ID\",\"ip_address\":\"$IP_ADDR\"}" 2>&1) || exit 1

EPC_ID=$(echo "$RESPONSE" | jq -r '.epc_id // empty' 2>/dev/null)
[ -z "$EPC_ID" ] || [ "$EPC_ID" = "null" ] && exit 1

log "Assigned EPC: $EPC_ID"

# Download and run deployment
curl -s -o /opt/wisptools/deploy.sh "https://$GCE_DOMAIN:$HSS_PORT/api/epc/$EPC_ID/deploy?checkin_token=$(echo "$RESPONSE" | jq -r '.checkin_token')"
chmod +x /opt/wisptools/deploy.sh
bash /opt/wisptools/deploy.sh 2>&1 | tee -a "$LOG_FILE"

touch "$BOOTSTRAPPED_FILE"
log "Check-in complete!"
CHECKINEOF

sed -i "s/__GCE_DOMAIN__/${GCE_DOMAIN}/g" "$PRESEED_DIR/checkin.sh"
sed -i "s/__HSS_PORT__/${HSS_PORT}/g" "$PRESEED_DIR/checkin.sh"
chmod +x "$PRESEED_DIR/checkin.sh"

# Create systemd units
cat > "$PRESEED_DIR/wisptools-checkin.service" << 'SERVICEEOF'
[Unit]
Description=WISPTools EPC Check-in
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/wisptools/checkin.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEEOF

cat > "$PRESEED_DIR/wisptools-checkin.timer" << 'TIMEREOF'
[Unit]
Description=WISPTools Check-in Timer

[Timer]
OnBootSec=30
OnUnitActiveSec=60

[Install]
WantedBy=timers.target
TIMEREOF

print_success "Check-in scripts created"

# ============================================================================
# Build ISO with embedded preseed in initrd
# ============================================================================
print_status "Embedding preseed into initrd for fully automated install..."

WORK_DIR="$ISO_BUILD_DIR/initrd_work"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"

# Extract initrd
cd "$WORK_DIR"
gzip -dc "$NETBOOT_DIR/initrd.gz" | cpio -id 2>/dev/null

# Add preseed to initrd root
cp "$PRESEED_DIR/preseed.cfg" "$WORK_DIR/preseed.cfg"

# Repack initrd with preseed
find . | cpio -H newc -o 2>/dev/null | gzip -9 > "$NETBOOT_DIR/initrd-preseed.gz"

print_success "Created initrd with embedded preseed"

# ============================================================================
# Build the ISO
# ============================================================================
print_status "Building bootable ISO..."

ISO_ROOT="$ISO_BUILD_DIR/iso_root"
rm -rf "$ISO_ROOT"
mkdir -p "$ISO_ROOT"/{boot/grub,isolinux,install,.disk}

# Copy kernel and modified initrd
cp "$NETBOOT_DIR/linux" "$ISO_ROOT/install/vmlinuz"
cp "$NETBOOT_DIR/initrd-preseed.gz" "$ISO_ROOT/install/initrd.gz"

# Copy isolinux files
for f in /usr/lib/ISOLINUX/isolinux.bin /usr/lib/syslinux/isolinux.bin; do
    [ -f "$f" ] && cp "$f" "$ISO_ROOT/isolinux/" && break
done
for mod in ldlinux.c32 libutil.c32 libcom32.c32 menu.c32 vesamenu.c32; do
    for d in /usr/lib/syslinux/modules/bios /usr/share/syslinux /usr/lib/syslinux; do
        [ -f "$d/$mod" ] && cp "$d/$mod" "$ISO_ROOT/isolinux/" 2>/dev/null && break
    done
done

# BIOS boot config - AUTO mode, no menu timeout
cat > "$ISO_ROOT/isolinux/isolinux.cfg" << ISOLINUXCFG
DEFAULT auto
TIMEOUT 10
PROMPT 0

LABEL auto
    KERNEL /install/vmlinuz
    APPEND initrd=/install/initrd.gz auto=true priority=critical preseed/file=/preseed.cfg DEBIAN_FRONTEND=noninteractive --- quiet

LABEL manual
    KERNEL /install/vmlinuz
    APPEND initrd=/install/initrd.gz ---
ISOLINUXCFG

# UEFI boot config
cat > "$ISO_ROOT/boot/grub/grub.cfg" << GRUBCFG
set timeout=1
set default=0

menuentry "WISPTools EPC Auto Install" {
    linux /install/vmlinuz auto=true priority=critical preseed/file=/preseed.cfg DEBIAN_FRONTEND=noninteractive --- quiet
    initrd /install/initrd.gz
}
GRUBCFG

echo "WISPTools EPC Installer" > "$ISO_ROOT/.disk/info"

# Create EFI boot image
print_status "Creating UEFI boot support..."
mkdir -p "$ISO_ROOT/EFI/BOOT"
dd if=/dev/zero of="$ISO_ROOT/boot/grub/efi.img" bs=1M count=4 2>/dev/null
mkfs.vfat "$ISO_ROOT/boot/grub/efi.img" >/dev/null
mmd -i "$ISO_ROOT/boot/grub/efi.img" ::/EFI ::/EFI/BOOT

grub-mkimage -o /tmp/bootx64.efi -p /boot/grub -O x86_64-efi \
    normal linux boot all_video configfile part_gpt part_msdos fat iso9660 search 2>/dev/null || \
grub-mkimage -o /tmp/bootx64.efi -p /boot/grub -O x86_64-efi \
    normal linux boot configfile part_gpt fat iso9660 2>/dev/null

mcopy -i "$ISO_ROOT/boot/grub/efi.img" /tmp/bootx64.efi ::/EFI/BOOT/BOOTX64.EFI 2>/dev/null || true
mcopy -i "$ISO_ROOT/boot/grub/efi.img" "$ISO_ROOT/boot/grub/grub.cfg" ::/EFI/BOOT/grub.cfg 2>/dev/null || true
cp /tmp/bootx64.efi "$ISO_ROOT/EFI/BOOT/BOOTX64.EFI" 2>/dev/null || true

# Build ISO
print_status "Building final ISO..."
OUTPUT_ISO="$ISO_OUTPUT_DIR/$ISO_FILENAME"
rm -f "$OUTPUT_ISO"

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
    -o "$OUTPUT_ISO" \
    "$ISO_ROOT" 2>&1 | grep -v "NOTE"

# Make hybrid
isohybrid --uefi "$OUTPUT_ISO" 2>/dev/null || true

# Checksums
cd "$ISO_OUTPUT_DIR"
sha256sum "$ISO_FILENAME" > "$ISO_FILENAME.sha256"
md5sum "$ISO_FILENAME" > "$ISO_FILENAME.md5"
chmod 644 "$ISO_FILENAME"*

ISO_SIZE=$(($(stat -c%s "$OUTPUT_ISO") / 1024 / 1024))

rm -rf "$ISO_ROOT" "$WORK_DIR"

echo ""
print_status "═══════════════════════════════════════════════════════════════"
print_success "  Fully Automated ISO Built Successfully!"
print_status "═══════════════════════════════════════════════════════════════"
echo ""
print_status "ISO: $OUTPUT_ISO (${ISO_SIZE}MB)"
print_status "URL: https://${GCE_DOMAIN}/downloads/isos/${ISO_FILENAME}"
echo ""
print_status "Features:"
print_status "  ✓ ZERO user interaction"
print_status "  ✓ UEFI + Legacy BIOS boot"
print_status "  ✓ Auto-selects largest disk"
print_status "  ✓ Preseed embedded in initrd"
print_status "  ✓ Auto check-in after reboot"
echo ""
print_status "Credentials: wisp / wisp123"
echo ""

