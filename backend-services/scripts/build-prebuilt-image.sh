#!/bin/bash
# Build Pre-built WISPTools EPC Disk Image
# Creates a ready-to-boot disk image - NO installation required
# Just write to drive and boot

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
IMAGE_DIR="/var/www/html/downloads/images"
IMAGE_NAME="wisptools-epc-server"
IMAGE_SIZE="4G"  # 4GB raw, compresses to ~500MB
GCE_DOMAIN="${GCE_DOMAIN:-hss.wisptools.io}"
GCE_PUBLIC_IP="${GCE_PUBLIC_IP:-136.112.111.167}"
HSS_PORT="${HSS_PORT:-3001}"
BUILD_DIR="/opt/epc-image-builder"

echo ""
print_status "═══════════════════════════════════════════════════════════════"
print_status "  WISPTools Pre-built EPC Server Image Builder"
print_status "  Ready-to-boot image - NO installation required"
print_status "═══════════════════════════════════════════════════════════════"
echo ""

if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root"
    exit 1
fi

# Install required packages
print_status "Installing required packages..."
apt-get update -qq
apt-get install -y debootstrap qemu-utils parted kpartx dosfstools e2fsprogs \
    grub-pc-bin grub-efi-amd64-bin grub2-common gzip pigz 2>/dev/null || \
apt-get install -y debootstrap parted dosfstools e2fsprogs grub-pc-bin grub2-common gzip

mkdir -p "$IMAGE_DIR" "$BUILD_DIR"
cd "$BUILD_DIR"

# Clean up any previous builds
print_status "Cleaning up previous builds..."
umount -R "$BUILD_DIR/mnt" 2>/dev/null || true
losetup -D 2>/dev/null || true
rm -rf "$BUILD_DIR/mnt"
rm -f "$BUILD_DIR/$IMAGE_NAME.raw"

# ============================================================================
# Create disk image
# ============================================================================
print_status "Creating ${IMAGE_SIZE} disk image..."
truncate -s "$IMAGE_SIZE" "$BUILD_DIR/$IMAGE_NAME.raw"

# Partition the image (GPT with BIOS boot partition + EFI + root)
print_status "Partitioning disk image..."
parted -s "$BUILD_DIR/$IMAGE_NAME.raw" mklabel gpt
parted -s "$BUILD_DIR/$IMAGE_NAME.raw" mkpart bios 1MiB 2MiB
parted -s "$BUILD_DIR/$IMAGE_NAME.raw" set 1 bios_grub on
parted -s "$BUILD_DIR/$IMAGE_NAME.raw" mkpart efi fat32 2MiB 102MiB
parted -s "$BUILD_DIR/$IMAGE_NAME.raw" set 2 esp on
parted -s "$BUILD_DIR/$IMAGE_NAME.raw" mkpart root ext4 102MiB 100%

# Setup loop device
print_status "Setting up loop device..."
LOOP_DEV=$(losetup --show -fP "$BUILD_DIR/$IMAGE_NAME.raw")
echo "Loop device: $LOOP_DEV"

# Wait for partitions
sleep 2
partprobe "$LOOP_DEV" 2>/dev/null || true
sleep 1

# Format partitions
print_status "Formatting partitions..."
mkfs.vfat -F32 "${LOOP_DEV}p2"
mkfs.ext4 -F -L wisptools-root "${LOOP_DEV}p3"

# Mount root
print_status "Mounting filesystems..."
mkdir -p "$BUILD_DIR/mnt"
mount "${LOOP_DEV}p3" "$BUILD_DIR/mnt"
mkdir -p "$BUILD_DIR/mnt/boot/efi"
mount "${LOOP_DEV}p2" "$BUILD_DIR/mnt/boot/efi"

# ============================================================================
# Bootstrap Debian
# ============================================================================
print_status "Bootstrapping Debian bookworm (this takes a few minutes)..."
debootstrap --arch=amd64 --variant=minbase --include=\
systemd,systemd-sysv,udev,dbus,\
linux-image-amd64,grub-pc,grub-efi-amd64,\
openssh-server,curl,wget,ca-certificates,jq,net-tools,\
python3,sudo,vim-tiny,locales,console-setup,\
iproute2,iputils-ping,netbase,ifupdown,dhcpcd5 \
    bookworm "$BUILD_DIR/mnt" http://deb.debian.org/debian

print_success "Base system installed"

# ============================================================================
# Configure the system
# ============================================================================
print_status "Configuring system..."

# Mount required filesystems for chroot
mount --bind /dev "$BUILD_DIR/mnt/dev"
mount --bind /dev/pts "$BUILD_DIR/mnt/dev/pts"
mount -t proc proc "$BUILD_DIR/mnt/proc"
mount -t sysfs sys "$BUILD_DIR/mnt/sys"

# Set hostname
echo "epc-server" > "$BUILD_DIR/mnt/etc/hostname"
cat > "$BUILD_DIR/mnt/etc/hosts" << 'EOF'
127.0.0.1   localhost
127.0.1.1   epc-server

::1         localhost ip6-localhost ip6-loopback
ff02::1     ip6-allnodes
ff02::2     ip6-allrouters
EOF

# Configure network (DHCP on all interfaces)
cat > "$BUILD_DIR/mnt/etc/network/interfaces" << 'EOF'
auto lo
iface lo inet loopback

allow-hotplug eth0
iface eth0 inet dhcp

allow-hotplug ens3
iface ens3 inet dhcp

allow-hotplug enp0s3
iface enp0s3 inet dhcp

allow-hotplug enp1s0
iface enp1s0 inet dhcp
EOF

# Configure fstab
ROOT_UUID=$(blkid -s UUID -o value "${LOOP_DEV}p3")
EFI_UUID=$(blkid -s UUID -o value "${LOOP_DEV}p2")
cat > "$BUILD_DIR/mnt/etc/fstab" << EOF
UUID=$ROOT_UUID /           ext4    errors=remount-ro 0 1
UUID=$EFI_UUID  /boot/efi   vfat    umask=0077        0 1
EOF

# Create user
print_status "Creating user 'wisp'..."
chroot "$BUILD_DIR/mnt" useradd -m -s /bin/bash -G sudo wisp
echo 'wisp:wisp123' | chroot "$BUILD_DIR/mnt" chpasswd
echo 'wisp ALL=(ALL) NOPASSWD:ALL' > "$BUILD_DIR/mnt/etc/sudoers.d/wisp"
chmod 440 "$BUILD_DIR/mnt/etc/sudoers.d/wisp"

# Enable SSH
chroot "$BUILD_DIR/mnt" systemctl enable ssh

# Configure locale
echo "en_US.UTF-8 UTF-8" > "$BUILD_DIR/mnt/etc/locale.gen"
chroot "$BUILD_DIR/mnt" locale-gen
echo 'LANG=en_US.UTF-8' > "$BUILD_DIR/mnt/etc/default/locale"

# ============================================================================
# Install WISPTools components
# ============================================================================
print_status "Installing WISPTools components..."

mkdir -p "$BUILD_DIR/mnt/etc/wisptools"
mkdir -p "$BUILD_DIR/mnt/opt/wisptools"
mkdir -p "$BUILD_DIR/mnt/var/lib/wisptools"
mkdir -p "$BUILD_DIR/mnt/var/www/html"

# Create check-in script
cat > "$BUILD_DIR/mnt/opt/wisptools/checkin.sh" << 'CHECKINEOF'
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
    chmod 644 "$DEVICE_CODE_FILE"
fi

log "Device Code: $DEVICE_CODE"

# Wait for network
for i in {1..60}; do
    ping -c1 8.8.8.8 &>/dev/null && break
    sleep 2
done

# Get system info
HARDWARE_ID=$(ip link show 2>/dev/null | grep -A1 "state UP" | grep ether | head -1 | awk '{print $2}')
[ -z "$HARDWARE_ID" ] && HARDWARE_ID=$(cat /sys/class/net/*/address 2>/dev/null | grep -v 00:00:00:00:00:00 | head -1)
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')

# Create status web page
cat > /var/www/html/index.html << STATUSHTML
<!DOCTYPE html>
<html>
<head>
    <title>WISPTools EPC</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body { font-family: 'Segoe UI', Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); color: #fff; min-height: 100vh; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { color: #00ff88; font-size: 2em; }
        .code { font-size: 80px; font-weight: bold; color: #00ff88; letter-spacing: 15px; margin: 50px 0; font-family: 'Courier New', monospace; text-shadow: 0 0 30px rgba(0,255,136,0.5); }
        .info { color: #aaa; margin: 15px 0; font-size: 16px; }
        .box { background: rgba(255,255,255,0.1); padding: 25px; border-radius: 15px; margin: 30px 0; backdrop-filter: blur(10px); }
        .status { display: inline-block; padding: 10px 25px; background: #ff9800; color: #000; font-weight: bold; border-radius: 25px; }
        ol { text-align: left; line-height: 2; }
        a { color: #00ff88; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛡️ WISPTools EPC Device</h1>
        <p>Enter this code in the WISPTools Portal:</p>
        <div class="code">$DEVICE_CODE</div>
        <div class="status">⏳ Waiting for Configuration</div>
        <div class="box">
            <h3>📋 Next Steps:</h3>
            <ol>
                <li>Go to <a href="https://wisptools-production.web.app" target="_blank">WISPTools Portal</a></li>
                <li>Navigate to <strong>Deploy</strong> → EPC Configuration</li>
                <li>Enter device code: <strong>$DEVICE_CODE</strong></li>
                <li>Device will configure automatically</li>
            </ol>
        </div>
        <p class="info">IP Address: $IP_ADDR</p>
        <p class="info">Hardware ID: $HARDWARE_ID</p>
    </div>
</body>
</html>
STATUSHTML

# Start web server
pgrep -f "python3 -m http.server 80" || (cd /var/www/html && nohup python3 -m http.server 80 &>/dev/null &)

# Display on console
clear
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   WISPTools EPC Device Ready                               ║"
echo "║                                                            ║"
echo "║   DEVICE CODE: $DEVICE_CODE                             ║"
echo "║                                                            ║"
echo "║   Enter this code in the WISPTools Portal                  ║"
echo "║                                                            ║"
echo "║   Web UI: http://$IP_ADDR/                          ║"
echo "║   SSH:    ssh wisp@$IP_ADDR                         ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Phone home
log "Checking in with $GCE_DOMAIN..."
RESPONSE=$(curl -s -X POST "https://$GCE_DOMAIN:$HSS_PORT/api/epc/checkin" \
    -H "Content-Type: application/json" \
    -d "{\"device_code\":\"$DEVICE_CODE\",\"hardware_id\":\"$HARDWARE_ID\",\"ip_address\":\"$IP_ADDR\"}" 2>&1) || exit 1

EPC_ID=$(echo "$RESPONSE" | jq -r '.epc_id // empty' 2>/dev/null)
[ -z "$EPC_ID" ] || [ "$EPC_ID" = "null" ] && exit 1

log "Assigned EPC: $EPC_ID"

# Download and run deployment
CHECKIN_TOKEN=$(echo "$RESPONSE" | jq -r '.checkin_token // empty' 2>/dev/null)
curl -s -o /opt/wisptools/deploy.sh "https://$GCE_DOMAIN:$HSS_PORT/api/epc/$EPC_ID/deploy?checkin_token=$CHECKIN_TOKEN"
chmod +x /opt/wisptools/deploy.sh
bash /opt/wisptools/deploy.sh 2>&1 | tee -a "$LOG_FILE"

touch "$BOOTSTRAPPED_FILE"

# Update status page
sed -i 's/Waiting for Configuration/✅ Connected \& Configured/' /var/www/html/index.html
sed -i 's/#ff9800/#4caf50/' /var/www/html/index.html

log "Check-in complete!"
CHECKINEOF

sed -i "s/__GCE_DOMAIN__/${GCE_DOMAIN}/g" "$BUILD_DIR/mnt/opt/wisptools/checkin.sh"
sed -i "s/__HSS_PORT__/${HSS_PORT}/g" "$BUILD_DIR/mnt/opt/wisptools/checkin.sh"
chmod +x "$BUILD_DIR/mnt/opt/wisptools/checkin.sh"

# Create first-boot script
cat > "$BUILD_DIR/mnt/opt/wisptools/first-boot.sh" << 'FIRSTBOOTEOF'
#!/bin/bash
# First boot initialization

# Generate unique device code
if [ ! -f /etc/wisptools/device-code.env ]; then
    DEVICE_CODE=$(cat /dev/urandom | tr -dc 'A-Z0-9' | head -c8)
    echo "DEVICE_CODE=$DEVICE_CODE" > /etc/wisptools/device-code.env
    chmod 644 /etc/wisptools/device-code.env
fi

# Regenerate SSH host keys (unique per device)
rm -f /etc/ssh/ssh_host_*
ssh-keygen -A

# Resize root partition to fill disk
ROOT_PART=$(findmnt -n -o SOURCE /)
ROOT_DISK=$(echo $ROOT_PART | sed 's/[0-9]*$//')
PART_NUM=$(echo $ROOT_PART | grep -oE '[0-9]+$')

# Grow partition
growpart $ROOT_DISK $PART_NUM 2>/dev/null || true
resize2fs $ROOT_PART 2>/dev/null || true

# Remove this script from running again
systemctl disable wisptools-first-boot.service

# Start check-in
systemctl start wisptools-checkin.timer
FIRSTBOOTEOF
chmod +x "$BUILD_DIR/mnt/opt/wisptools/first-boot.sh"

# Create systemd services
cat > "$BUILD_DIR/mnt/etc/systemd/system/wisptools-first-boot.service" << 'EOF'
[Unit]
Description=WISPTools First Boot Setup
After=network-online.target
Wants=network-online.target
Before=wisptools-checkin.timer

[Service]
Type=oneshot
ExecStart=/opt/wisptools/first-boot.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

cat > "$BUILD_DIR/mnt/etc/systemd/system/wisptools-checkin.service" << 'EOF'
[Unit]
Description=WISPTools EPC Check-in
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/wisptools/checkin.sh
StandardOutput=journal
StandardError=journal
EOF

cat > "$BUILD_DIR/mnt/etc/systemd/system/wisptools-checkin.timer" << 'EOF'
[Unit]
Description=WISPTools Check-in Timer

[Timer]
OnBootSec=30
OnUnitActiveSec=60

[Install]
WantedBy=timers.target
EOF

# Enable services
chroot "$BUILD_DIR/mnt" systemctl enable wisptools-first-boot.service
chroot "$BUILD_DIR/mnt" systemctl enable wisptools-checkin.timer

# ============================================================================
# Install GRUB bootloader
# ============================================================================
print_status "Installing GRUB bootloader..."

# Install GRUB for BIOS
chroot "$BUILD_DIR/mnt" grub-install --target=i386-pc --boot-directory=/boot "$LOOP_DEV" 2>/dev/null || true

# Install GRUB for EFI
chroot "$BUILD_DIR/mnt" grub-install --target=x86_64-efi --efi-directory=/boot/efi --boot-directory=/boot --removable 2>/dev/null || true

# Create GRUB config
cat > "$BUILD_DIR/mnt/boot/grub/grub.cfg" << 'EOF'
set timeout=3
set default=0

menuentry "WISPTools EPC Server" {
    linux /vmlinuz root=LABEL=wisptools-root ro quiet
    initrd /initrd.img
}
EOF

# Update initramfs
chroot "$BUILD_DIR/mnt" update-initramfs -u -k all 2>/dev/null || true

print_success "GRUB installed"

# ============================================================================
# Clean up and compress
# ============================================================================
print_status "Cleaning up..."

# Clean apt cache
chroot "$BUILD_DIR/mnt" apt-get clean
rm -rf "$BUILD_DIR/mnt/var/lib/apt/lists/*"
rm -rf "$BUILD_DIR/mnt/var/cache/apt/*"
rm -rf "$BUILD_DIR/mnt/tmp/*"

# Unmount
sync
umount "$BUILD_DIR/mnt/dev/pts" 2>/dev/null || true
umount "$BUILD_DIR/mnt/dev" 2>/dev/null || true
umount "$BUILD_DIR/mnt/proc" 2>/dev/null || true
umount "$BUILD_DIR/mnt/sys" 2>/dev/null || true
umount "$BUILD_DIR/mnt/boot/efi" 2>/dev/null || true
umount "$BUILD_DIR/mnt" 2>/dev/null || true

# Detach loop device
losetup -d "$LOOP_DEV"

# Zero free space for better compression (optional, takes time)
print_status "Optimizing image for compression..."

# Compress image
print_status "Compressing image (this takes a few minutes)..."
if command -v pigz &>/dev/null; then
    pigz -9 -k -f "$BUILD_DIR/$IMAGE_NAME.raw"
else
    gzip -9 -k -f "$BUILD_DIR/$IMAGE_NAME.raw"
fi

# Move to download directory
mv "$BUILD_DIR/$IMAGE_NAME.raw.gz" "$IMAGE_DIR/$IMAGE_NAME.img.gz"
mv "$BUILD_DIR/$IMAGE_NAME.raw" "$IMAGE_DIR/$IMAGE_NAME.img"

# Create checksums
cd "$IMAGE_DIR"
sha256sum "$IMAGE_NAME.img.gz" > "$IMAGE_NAME.img.gz.sha256"
sha256sum "$IMAGE_NAME.img" > "$IMAGE_NAME.img.sha256"

# Set permissions
chmod 644 "$IMAGE_DIR/$IMAGE_NAME"*

# Get sizes
RAW_SIZE=$(du -h "$IMAGE_DIR/$IMAGE_NAME.img" | cut -f1)
COMPRESSED_SIZE=$(du -h "$IMAGE_DIR/$IMAGE_NAME.img.gz" | cut -f1)

echo ""
print_status "═══════════════════════════════════════════════════════════════"
print_success "  Pre-built Image Created Successfully!"
print_status "═══════════════════════════════════════════════════════════════"
echo ""
print_status "Compressed: $IMAGE_DIR/$IMAGE_NAME.img.gz ($COMPRESSED_SIZE)"
print_status "Raw:        $IMAGE_DIR/$IMAGE_NAME.img ($RAW_SIZE)"
echo ""
print_status "Download URL: https://${GCE_DOMAIN}/downloads/images/$IMAGE_NAME.img.gz"
echo ""
print_status "To deploy:"
print_status "  1. Download: wget https://${GCE_DOMAIN}/downloads/images/$IMAGE_NAME.img.gz"
print_status "  2. Write to disk: gunzip -c $IMAGE_NAME.img.gz | sudo dd of=/dev/sdX bs=4M status=progress"
print_status "  3. Boot the device"
print_status "  4. Device code will display on screen and at http://<device-ip>/"
echo ""
print_status "Credentials: wisp / wisp123"
echo ""
print_status "Features:"
print_status "  ✓ NO installation required - just boot"
print_status "  ✓ UEFI + Legacy BIOS boot"
print_status "  ✓ Auto-expands to fill disk on first boot"
print_status "  ✓ Unique device code generated per device"
print_status "  ✓ Auto check-in with WISPTools portal"
echo ""

