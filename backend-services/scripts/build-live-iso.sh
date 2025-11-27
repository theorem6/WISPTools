#!/bin/bash
# Build WISPTools EPC Live ISO
# Boots directly into working system - NO installation dialogs
# Auto-installs to local disk in background

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
print_status "  Boots directly into working system - NO installation prompts"
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
    grub-pc-bin grub-efi-amd64-bin mtools live-boot-doc 2>/dev/null || \
apt-get install -y debootstrap squashfs-tools xorriso isolinux syslinux-common \
    grub-pc-bin grub-efi-amd64-bin mtools

mkdir -p "$BUILD_DIR" "$ISO_OUTPUT_DIR"
cd "$BUILD_DIR"

# Clean previous
rm -rf "$BUILD_DIR/chroot" "$BUILD_DIR/iso" "$BUILD_DIR/scratch"
mkdir -p "$BUILD_DIR/chroot" "$BUILD_DIR/iso"/{live,boot/grub,isolinux,EFI/BOOT} "$BUILD_DIR/scratch"

# ============================================================================
# Build the live filesystem
# ============================================================================
print_status "Building live filesystem (this takes several minutes)..."

debootstrap --arch=amd64 --variant=minbase --include=\
linux-image-amd64,live-boot,systemd,systemd-sysv,\
openssh-server,curl,wget,ca-certificates,jq,\
python3,sudo,net-tools,iproute2,iputils-ping,\
pciutils,usbutils,parted,gdisk,dosfstools,e2fsprogs,\
vim-tiny,less,locales,console-setup,dbus,udev \
    bookworm "$BUILD_DIR/chroot" http://deb.debian.org/debian

print_success "Base system installed"

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

LOG="/var/log/wisptools.log"
DEVICE_CODE_FILE="/etc/wisptools/device-code.env"
INSTALLED_FILE="/var/lib/wisptools/.installed"
GCE_DOMAIN="__GCE_DOMAIN__"
HSS_PORT="__HSS_PORT__"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG"; }

# Generate device code if needed
if [ ! -f "$DEVICE_CODE_FILE" ]; then
    DEVICE_CODE=$(cat /dev/urandom | tr -dc 'A-Z0-9' | head -c8)
    echo "DEVICE_CODE=$DEVICE_CODE" > "$DEVICE_CODE_FILE"
fi
source "$DEVICE_CODE_FILE"

# Get network info
sleep 5  # Wait for network
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')
HARDWARE_ID=$(ip link show 2>/dev/null | grep -A1 "state UP" | grep ether | head -1 | awk '{print $2}')
[ -z "$HARDWARE_ID" ] && HARDWARE_ID=$(cat /sys/class/net/*/address 2>/dev/null | grep -v 00:00:00:00:00:00 | head -1)

# Create web status page
cat > /var/www/html/index.html << HTMLEOF
<!DOCTYPE html>
<html>
<head>
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
            <li>Enter device code: <strong>$DEVICE_CODE</strong></li>
            <li>Device will configure automatically</li>
        </ol>
    </div>
    <p class="info">IP: $IP_ADDR | MAC: $HARDWARE_ID</p>
</body>
</html>
HTMLEOF

# Start web server
cd /var/www/html && python3 -m http.server 80 &>/dev/null &

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
echo "║     Web UI:  http://$IP_ADDR/                             ║"
echo "║     SSH:     ssh wisp@$IP_ADDR  (password: wisp123)       ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Check-in loop
while true; do
    [ -f "/var/lib/wisptools/.configured" ] && break
    
    RESPONSE=$(curl -s -X POST "https://$GCE_DOMAIN:$HSS_PORT/api/epc/checkin" \
        -H "Content-Type: application/json" \
        -d "{\"device_code\":\"$DEVICE_CODE\",\"hardware_id\":\"$HARDWARE_ID\",\"ip_address\":\"$IP_ADDR\"}" 2>/dev/null) || true
    
    EPC_ID=$(echo "$RESPONSE" | jq -r '.epc_id // empty' 2>/dev/null)
    
    if [ -n "$EPC_ID" ] && [ "$EPC_ID" != "null" ]; then
        log "Assigned to EPC: $EPC_ID"
        CHECKIN_TOKEN=$(echo "$RESPONSE" | jq -r '.checkin_token // empty')
        
        # Download and run deployment
        curl -s -o /opt/wisptools/deploy.sh "https://$GCE_DOMAIN:$HSS_PORT/api/epc/$EPC_ID/deploy?checkin_token=$CHECKIN_TOKEN"
        chmod +x /opt/wisptools/deploy.sh
        bash /opt/wisptools/deploy.sh 2>&1 | tee -a "$LOG"
        
        touch /var/lib/wisptools/.configured
        
        # Update status page
        sed -i 's/Waiting for Configuration/✅ Connected \& Configured/' /var/www/html/index.html
        sed -i 's/#ff9800/#4caf50/' /var/www/html/index.html
        
        echo ""
        echo "✅ Device configured successfully!"
        break
    fi
    
    sleep 60
done

# If running from live media, install to disk in background
if [ ! -f "$INSTALLED_FILE" ] && [ -d /run/live ]; then
    log "Running from live media - will install to disk..."
    /opt/wisptools/install-to-disk.sh &
fi
STARTUPEOF

sed -i "s/__GCE_DOMAIN__/${GCE_DOMAIN}/g" "$BUILD_DIR/chroot/opt/wisptools/startup.sh"
sed -i "s/__HSS_PORT__/${HSS_PORT}/g" "$BUILD_DIR/chroot/opt/wisptools/startup.sh"
chmod +x "$BUILD_DIR/chroot/opt/wisptools/startup.sh"

# Install to disk script (runs in background)
cat > "$BUILD_DIR/chroot/opt/wisptools/install-to-disk.sh" << 'INSTALLEOF'
#!/bin/bash
# Install live system to local disk

LOG="/var/log/wisptools-install.log"
INSTALLED_FILE="/var/lib/wisptools/.installed"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG"; }

[ -f "$INSTALLED_FILE" ] && exit 0

log "Starting installation to local disk..."

# Find target disk (largest disk that's not the boot device)
BOOT_DEV=$(findmnt -n -o SOURCE / | sed 's/[0-9]*$//' | sed 's/p$//')
TARGET_DISK=""

for disk in /dev/sd? /dev/nvme?n? /dev/vd?; do
    [ -b "$disk" ] || continue
    [ "$disk" = "$BOOT_DEV" ] && continue
    
    SIZE=$(blockdev --getsize64 "$disk" 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 10000000000 ]; then  # > 10GB
        TARGET_DISK="$disk"
        break
    fi
done

if [ -z "$TARGET_DISK" ]; then
    log "No suitable target disk found"
    exit 1
fi

log "Installing to $TARGET_DISK..."

# Partition disk
parted -s "$TARGET_DISK" mklabel gpt
parted -s "$TARGET_DISK" mkpart bios 1MiB 2MiB
parted -s "$TARGET_DISK" set 1 bios_grub on
parted -s "$TARGET_DISK" mkpart efi fat32 2MiB 102MiB
parted -s "$TARGET_DISK" set 2 esp on
parted -s "$TARGET_DISK" mkpart root ext4 102MiB 100%

sleep 2

# Determine partition names
if [[ "$TARGET_DISK" == *"nvme"* ]]; then
    PART_PREFIX="${TARGET_DISK}p"
else
    PART_PREFIX="${TARGET_DISK}"
fi

mkfs.vfat -F32 "${PART_PREFIX}2"
mkfs.ext4 -F -L wisptools-root "${PART_PREFIX}3"

# Mount and copy
mkdir -p /mnt/target
mount "${PART_PREFIX}3" /mnt/target
mkdir -p /mnt/target/boot/efi
mount "${PART_PREFIX}2" /mnt/target/boot/efi

log "Copying system files..."
rsync -aAXv --exclude={"/dev/*","/proc/*","/sys/*","/tmp/*","/run/*","/mnt/*","/media/*","/lost+found"} / /mnt/target/

# Update fstab
ROOT_UUID=$(blkid -s UUID -o value "${PART_PREFIX}3")
EFI_UUID=$(blkid -s UUID -o value "${PART_PREFIX}2")
cat > /mnt/target/etc/fstab << FSTABEOF
UUID=$ROOT_UUID /           ext4    errors=remount-ro 0 1
UUID=$EFI_UUID  /boot/efi   vfat    umask=0077        0 1
FSTABEOF

# Install GRUB
mount --bind /dev /mnt/target/dev
mount --bind /proc /mnt/target/proc
mount --bind /sys /mnt/target/sys

chroot /mnt/target grub-install --target=i386-pc "$TARGET_DISK" 2>/dev/null || true
chroot /mnt/target grub-install --target=x86_64-efi --efi-directory=/boot/efi --removable 2>/dev/null || true
chroot /mnt/target update-grub

# Mark as installed
touch /mnt/target/var/lib/wisptools/.installed

# Cleanup
umount /mnt/target/sys /mnt/target/proc /mnt/target/dev
umount /mnt/target/boot/efi
umount /mnt/target

log "Installation complete! System will boot from disk on next restart."
touch "$INSTALLED_FILE"
INSTALLEOF
chmod +x "$BUILD_DIR/chroot/opt/wisptools/install-to-disk.sh"

# Systemd service for startup
cat > "$BUILD_DIR/chroot/etc/systemd/system/wisptools-startup.service" << 'EOF'
[Unit]
Description=WISPTools EPC Startup
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/opt/wisptools/startup.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

chroot "$BUILD_DIR/chroot" systemctl enable wisptools-startup.service

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
DEFAULT live
TIMEOUT 30
PROMPT 0

UI menu.c32

MENU TITLE WISPTools EPC Server
MENU COLOR border       30;44   #40ffffff #a0000000 std
MENU COLOR title        1;36;44 #9033ccff #a0000000 std
MENU COLOR sel          7;37;40 #e0ffffff #20ffffff all

LABEL live
    MENU LABEL ^WISPTools EPC Server (Auto Boot)
    MENU DEFAULT
    KERNEL /live/vmlinuz
    APPEND initrd=/live/initrd boot=live toram quiet splash

LABEL live-install
    MENU LABEL Install to Disk
    KERNEL /live/vmlinuz
    APPEND initrd=/live/initrd boot=live toram quiet splash auto-install=true
EOF

# GRUB for UEFI
cat > "$BUILD_DIR/iso/boot/grub/grub.cfg" << 'EOF'
set timeout=3
set default=0

insmod all_video

menuentry "WISPTools EPC Server" {
    linux /live/vmlinuz boot=live toram quiet splash
    initrd /live/initrd
}

menuentry "WISPTools EPC Server (Install to Disk)" {
    linux /live/vmlinuz boot=live toram quiet splash auto-install=true
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
print_success "  Live ISO Created Successfully!"
print_status "═══════════════════════════════════════════════════════════════"
echo ""
print_status "ISO: $ISO_OUTPUT_DIR/$ISO_FILENAME (${ISO_SIZE}MB)"
print_status "URL: https://${GCE_DOMAIN}/downloads/isos/$ISO_FILENAME"
echo ""
print_status "Features:"
print_status "  ✓ Boots directly into working system"
print_status "  ✓ NO installation prompts or dialogs"
print_status "  ✓ UEFI + Legacy BIOS boot"
print_status "  ✓ Runs entirely from RAM (fast)"
print_status "  ✓ Auto-installs to disk in background"
print_status "  ✓ Device code displayed on screen"
echo ""
print_status "Credentials: wisp / wisp123"
echo ""

