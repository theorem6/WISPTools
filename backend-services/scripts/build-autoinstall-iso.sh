#!/bin/bash
# Build WISPTools EPC Autoinstall ISO
# Uses Ubuntu Server autoinstall for FULLY AUTOMATIC installation
# Zero interaction - boots, installs OS to disk, reboots

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

print_status() { echo -e "${CYAN}▶${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Configuration
ISO_OUTPUT_DIR="/var/www/html/downloads/isos"
BUILD_DIR="/opt/epc-autoinstall-builder"
ISO_FILENAME="wisptools-epc-autoinstall.iso"
UBUNTU_ISO_URL="https://releases.ubuntu.com/22.04/ubuntu-22.04.4-live-server-amd64.iso"
UBUNTU_ISO="ubuntu-22.04-live-server-amd64.iso"
GCE_DOMAIN="${GCE_DOMAIN:-hss.wisptools.io}"
HSS_PORT="${HSS_PORT:-3001}"

echo ""
print_status "═══════════════════════════════════════════════════════════════"
print_status "  WISPTools EPC Autoinstall ISO Builder"
print_status "  Fully automatic installation - zero interaction"
print_status "═══════════════════════════════════════════════════════════════"
echo ""

if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root"
    exit 1
fi

# Install required packages
print_status "Installing required packages..."
apt-get update -qq
apt-get install -y p7zip-full xorriso wget curl whois genisoimage 2>/dev/null || \
apt-get install -y p7zip-full xorriso wget curl whois

mkdir -p "$BUILD_DIR" "$ISO_OUTPUT_DIR"
cd "$BUILD_DIR"

# Generate password hash for 'wisp123'
print_status "Generating password hash..."
WISP_PASSWORD_HASH=$(echo 'wisp123' | mkpasswd -m sha-512 -s)

# Download Ubuntu Server ISO if needed
if [ ! -f "$UBUNTU_ISO" ]; then
    print_status "Downloading Ubuntu Server ISO (~2.6GB)..."
    print_status "This may take 10-20 minutes depending on connection..."
    wget --progress=bar:force -O "$UBUNTU_ISO" "$UBUNTU_ISO_URL" || {
        print_error "Failed to download Ubuntu ISO"
        exit 1
    }
fi
print_success "Ubuntu ISO ready"

# Extract ISO
print_status "Extracting Ubuntu ISO..."
rm -rf iso_extract
7z x -oiso_extract "$UBUNTU_ISO" -y >/dev/null 2>&1 || {
    mkdir -p iso_extract
    mount -o loop "$UBUNTU_ISO" /mnt
    cp -rT /mnt iso_extract
    umount /mnt
}
chmod -R +w iso_extract
print_success "ISO extracted"

# ============================================================================
# Create the startup script (separate file for clarity)
# ============================================================================
print_status "Creating WISPTools startup script..."

cat > "$BUILD_DIR/wisptools-startup.sh" << 'STARTUPSCRIPT'
#!/bin/bash
# WISPTools EPC Startup Script
# Runs on first boot to display device code and check-in

LOG="/var/log/wisptools.log"
DEVICE_CODE_FILE="/etc/wisptools/device-code.env"
CONFIGURED_FILE="/var/lib/wisptools/.configured"
GCE_DOMAIN="__GCE_DOMAIN__"
HSS_PORT="__HSS_PORT__"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG"; }

# Generate device code if needed
mkdir -p /etc/wisptools /var/lib/wisptools
if [ ! -f "$DEVICE_CODE_FILE" ]; then
    DEVICE_CODE=$(cat /dev/urandom | tr -dc 'A-Z0-9' | head -c8)
    echo "DEVICE_CODE=$DEVICE_CODE" > "$DEVICE_CODE_FILE"
fi
source "$DEVICE_CODE_FILE"

# Get network info
sleep 5
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
MAC=$(ip link show 2>/dev/null | grep -A1 "state UP" | grep ether | head -1 | awk '{print $2}')

# Create web status page
mkdir -p /var/www/html
cat > /var/www/html/index.html << HTMLPAGE
<!DOCTYPE html>
<html>
<head>
    <title>WISPTools EPC</title>
    <meta http-equiv="refresh" content="30">
    <style>
        body { font-family: 'Segoe UI', Arial; text-align: center; padding: 40px; 
               background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); 
               color: #fff; min-height: 100vh; margin: 0; }
        h1 { color: #00ff88; }
        .code { font-size: 72px; font-weight: bold; color: #00ff88; 
                letter-spacing: 12px; margin: 40px 0; font-family: monospace; 
                text-shadow: 0 0 30px rgba(0,255,136,0.5); }
        .info { color: #aaa; margin: 10px 0; }
        .box { background: rgba(255,255,255,0.1); padding: 25px; 
               border-radius: 15px; margin: 20px auto; max-width: 500px; }
        .status { padding: 12px 30px; background: #ff9800; color: #000; 
                  font-weight: bold; border-radius: 25px; display: inline-block; }
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
        </ol>
    </div>
    <p class="info">IP: $IP | MAC: $MAC</p>
</body>
</html>
HTMLPAGE

# Restart nginx to serve the page
systemctl restart nginx 2>/dev/null || true

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
echo "║     Web UI:  http://$IP/"
echo "║     SSH:     ssh wisp@$IP  (password: wisp123)"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

log "Device code: $DEVICE_CODE, IP: $IP, MAC: $MAC"

# Check-in loop - contact server every 60 seconds
while [ ! -f "$CONFIGURED_FILE" ]; do
    RESPONSE=$(curl -s -X POST "https://$GCE_DOMAIN:$HSS_PORT/api/epc/checkin" \
        -H "Content-Type: application/json" \
        -d "{\"device_code\":\"$DEVICE_CODE\",\"hardware_id\":\"$MAC\",\"ip_address\":\"$IP\"}" 2>/dev/null) || true
    
    EPC_ID=$(echo "$RESPONSE" | jq -r '.epc_id // empty' 2>/dev/null)
    
    if [ -n "$EPC_ID" ] && [ "$EPC_ID" != "null" ]; then
        log "Assigned to EPC: $EPC_ID"
        echo "$RESPONSE" > /etc/wisptools/registration.json
        touch "$CONFIGURED_FILE"
        
        # Update web page
        sed -i 's/Waiting for Configuration/✅ Connected \& Configured/' /var/www/html/index.html
        sed -i 's/#ff9800/#4caf50/' /var/www/html/index.html
        
        echo "✅ Device configured! EPC ID: $EPC_ID"
        break
    fi
    
    sleep 60
done
STARTUPSCRIPT

# Replace placeholders in startup script
sed -i "s/__GCE_DOMAIN__/${GCE_DOMAIN}/g" "$BUILD_DIR/wisptools-startup.sh"
sed -i "s/__HSS_PORT__/${HSS_PORT}/g" "$BUILD_DIR/wisptools-startup.sh"

# Base64 encode the startup script for embedding in cloud-config
STARTUP_SCRIPT_B64=$(base64 -w0 "$BUILD_DIR/wisptools-startup.sh")

# ============================================================================
# Create the autoinstall configuration (user-data)
# ============================================================================
print_status "Creating autoinstall configuration..."

mkdir -p iso_extract/nocloud

cat > iso_extract/nocloud/user-data << EOF
#cloud-config
autoinstall:
  version: 1
  locale: en_US.UTF-8
  keyboard:
    layout: us
  identity:
    hostname: wisptools-epc
    username: wisp
    password: "${WISP_PASSWORD_HASH}"
  ssh:
    install-server: true
    allow-pw: true
  packages:
    - openssh-server
    - curl
    - wget
    - jq
    - python3
    - net-tools
    - snmpd
    - snmp
    - nginx
    - vim
  storage:
    layout:
      name: lvm
  late-commands:
    - echo 'wisp ALL=(ALL) NOPASSWD:ALL' > /target/etc/sudoers.d/wisp
    - chmod 440 /target/etc/sudoers.d/wisp
    - mkdir -p /target/opt/wisptools /target/etc/wisptools /target/var/lib/wisptools
    - echo '${STARTUP_SCRIPT_B64}' | base64 -d > /target/opt/wisptools/startup.sh
    - chmod +x /target/opt/wisptools/startup.sh
    - |
      cat > /target/etc/systemd/system/wisptools.service << 'SVCEOF'
      [Unit]
      Description=WISPTools EPC Startup
      After=network-online.target nginx.service
      Wants=network-online.target
      [Service]
      Type=oneshot
      ExecStart=/opt/wisptools/startup.sh
      RemainAfterExit=yes
      [Install]
      WantedBy=multi-user.target
      SVCEOF
    - curtin in-target --target=/target -- systemctl enable wisptools.service
    - curtin in-target --target=/target -- systemctl enable nginx
    - sed -i 's/#PasswordAuthentication.*/PasswordAuthentication yes/' /target/etc/ssh/sshd_config
    - sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /target/etc/ssh/sshd_config
EOF

# Create empty meta-data (required)
touch iso_extract/nocloud/meta-data

print_success "Autoinstall configuration created"

# ============================================================================
# Modify GRUB for autoinstall
# ============================================================================
print_status "Modifying boot configuration for autoinstall..."

# Update GRUB config
cat > iso_extract/boot/grub/grub.cfg << 'GRUBCFG'
set timeout=5
set default=0

menuentry "WISPTools EPC - Automatic Install" {
    set gfxpayload=keep
    linux   /casper/vmlinuz autoinstall ds=nocloud\;s=/cdrom/nocloud/ quiet ---
    initrd  /casper/initrd
}

menuentry "WISPTools EPC - Install (Safe Graphics)" {
    set gfxpayload=keep
    linux   /casper/vmlinuz autoinstall ds=nocloud\;s=/cdrom/nocloud/ nomodeset quiet ---
    initrd  /casper/initrd
}

menuentry "Boot from first hard disk" {
    exit
}
GRUBCFG

# Update isolinux for BIOS boot
if [ -d iso_extract/isolinux ]; then
    cat > iso_extract/isolinux/txt.cfg << 'TXTCFG'
default autoinstall
label autoinstall
  menu label ^WISPTools EPC - Automatic Install
  kernel /casper/vmlinuz
  append initrd=/casper/initrd autoinstall ds=nocloud;s=/cdrom/nocloud/ quiet ---
label safe
  menu label Install (Safe Graphics)
  kernel /casper/vmlinuz
  append initrd=/casper/initrd autoinstall ds=nocloud;s=/cdrom/nocloud/ nomodeset quiet ---
TXTCFG

    # Set timeout
    sed -i 's/timeout 0/timeout 50/' iso_extract/isolinux/isolinux.cfg 2>/dev/null || true
fi

print_success "Boot configuration updated"

# ============================================================================
# Rebuild the ISO
# ============================================================================
print_status "Rebuilding ISO (this takes a few minutes)..."

# Find the EFI image
EFI_IMG=""
[ -f iso_extract/boot/grub/efi.img ] && EFI_IMG="boot/grub/efi.img"
[ -f iso_extract/EFI/BOOT/efi.img ] && EFI_IMG="EFI/BOOT/efi.img"

cd iso_extract

xorriso -as mkisofs \
    -r -V "WISPTOOLS_EPC" \
    -J -joliet-long \
    -iso-level 3 \
    -partition_offset 16 \
    -b isolinux/isolinux.bin \
    -c isolinux/boot.cat \
    -no-emul-boot \
    -boot-load-size 4 \
    -boot-info-table \
    $([ -n "$EFI_IMG" ] && echo "-eltorito-alt-boot -e $EFI_IMG -no-emul-boot") \
    -o "$ISO_OUTPUT_DIR/$ISO_FILENAME" \
    . 2>&1 | grep -E "^xorriso|Written|ISO"

cd "$BUILD_DIR"

# Make ISO hybrid bootable from USB
print_status "Making ISO USB-bootable..."
if command -v isohybrid &>/dev/null; then
    isohybrid --uefi "$ISO_OUTPUT_DIR/$ISO_FILENAME" 2>/dev/null || true
fi

# Create checksums
cd "$ISO_OUTPUT_DIR"
sha256sum "$ISO_FILENAME" > "$ISO_FILENAME.sha256"
md5sum "$ISO_FILENAME" > "$ISO_FILENAME.md5"
chmod 644 "$ISO_FILENAME"*

ISO_SIZE=$(($(stat -c%s "$ISO_OUTPUT_DIR/$ISO_FILENAME") / 1024 / 1024))

# Cleanup
rm -rf "$BUILD_DIR/iso_extract"

echo ""
print_status "═══════════════════════════════════════════════════════════════"
print_success "  Autoinstall ISO Created Successfully!"
print_status "═══════════════════════════════════════════════════════════════"
echo ""
print_status "ISO: $ISO_OUTPUT_DIR/$ISO_FILENAME (${ISO_SIZE}MB)"
print_status "URL: https://${GCE_DOMAIN}/downloads/isos/$ISO_FILENAME"
echo ""
print_status "What happens when you boot this ISO:"
print_status "  1. Boots automatically (5 second countdown)"
print_status "  2. Wipes target disk completely"
print_status "  3. Installs Ubuntu + all packages"
print_status "  4. Creates wisp user with sudo"
print_status "  5. Installs WISPTools startup service"
print_status "  6. Reboots into installed system"
print_status "  7. Shows device code on screen + web"
echo ""
print_status "FULLY AUTOMATIC - zero interaction required!"
print_status "Credentials: wisp / wisp123"
echo ""
