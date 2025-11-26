#!/bin/bash
# Build Generic Ubuntu Netinstall ISO for WISPTools EPC Deployment
# Creates a SMALL (~150-200MB) bootable ISO using casper kernel/initrd
# from Ubuntu Live Server ISO - these contain Subiquity for autoinstall support
#
# The ISO downloads the rest of the system over the network during install

set -e

# Colors for output
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
ISO_BUILD_DIR="/opt/epc-iso-builder/generic"
ISO_FILENAME="wisptools-epc-generic-netinstall.iso"
GCE_PUBLIC_IP="${GCE_PUBLIC_IP:-136.112.111.167}"
HSS_PORT="${HSS_PORT:-3001}"

# Casper boot files from Ubuntu 22.04 Live Server
# These are extracted from the full ISO but only ~150MB total
CASPER_DIR="/opt/base-images/casper"
KERNEL_PATH="${CASPER_DIR}/vmlinuz"
INITRD_PATH="${CASPER_DIR}/initrd"

# Ubuntu 22.04 LTS Live Server ISO (only needed to extract kernel/initrd once)
UBUNTU_VERSION="22.04.5"
UBUNTU_ISO_URL="https://releases.ubuntu.com/22.04/ubuntu-${UBUNTU_VERSION}-live-server-amd64.iso"

echo ""
print_status "═══════════════════════════════════════════════════════════"
print_status "  WISPTools.io Generic EPC ISO Builder (Minimal ~150MB)"
print_status "  Using Ubuntu ${UBUNTU_VERSION} Casper Kernel/Initrd"
print_status "═══════════════════════════════════════════════════════════"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Create directories
mkdir -p "$ISO_BUILD_DIR" "$ISO_OUTPUT_DIR" "$CASPER_DIR"
cd "$ISO_BUILD_DIR"

# Install required tools
print_status "Checking for required packages..."
REQUIRED_PACKAGES="xorriso p7zip-full wget curl grub-pc-bin grub-efi-amd64-bin mtools"
MISSING_PACKAGES=""

for pkg in $REQUIRED_PACKAGES; do
    if ! dpkg -l 2>/dev/null | grep -q "^ii  $pkg"; then
        MISSING_PACKAGES="$MISSING_PACKAGES $pkg"
    fi
done

if [ -n "$MISSING_PACKAGES" ]; then
    print_status "Installing missing packages:$MISSING_PACKAGES"
    apt-get update -qq
    apt-get install -y $MISSING_PACKAGES
    print_success "Packages installed"
else
    print_success "All required packages already installed"
fi

# Check if we already have valid casper files
NEED_DOWNLOAD=0

if [ -f "$KERNEL_PATH" ] && [ -f "$INITRD_PATH" ]; then
    KERNEL_SIZE=$(stat -c%s "$KERNEL_PATH" 2>/dev/null || echo "0")
    INITRD_SIZE=$(stat -c%s "$INITRD_PATH" 2>/dev/null || echo "0")
    
    # Kernel should be ~15MB, initrd should be ~100-150MB
    if [ "$KERNEL_SIZE" -gt 10000000 ] && [ "$INITRD_SIZE" -gt 80000000 ]; then
        print_success "Casper kernel/initrd already present"
        print_status "  Kernel: $(du -h "$KERNEL_PATH" | cut -f1)"
        print_status "  Initrd: $(du -h "$INITRD_PATH" | cut -f1)"
    else
        print_warning "Casper files exist but appear incomplete, will re-extract"
        NEED_DOWNLOAD=1
    fi
else
    NEED_DOWNLOAD=1
fi

if [ "$NEED_DOWNLOAD" -eq 1 ]; then
    print_status "Need to extract casper files from Ubuntu Live Server ISO..."
    
    # Check if we have a cached ISO
    CACHED_ISO="${ISO_BUILD_DIR}/ubuntu-${UBUNTU_VERSION}-live-server.iso"
    
    if [ -f "$CACHED_ISO" ]; then
        ISO_SIZE=$(stat -c%s "$CACHED_ISO" 2>/dev/null || echo "0")
        if [ "$ISO_SIZE" -gt 1500000000 ]; then
            print_success "Using cached Ubuntu ISO"
        else
            print_warning "Cached ISO is incomplete, re-downloading..."
            rm -f "$CACHED_ISO"
        fi
    fi
    
    if [ ! -f "$CACHED_ISO" ]; then
        print_status "Downloading Ubuntu ${UBUNTU_VERSION} Live Server ISO..."
        print_status "URL: $UBUNTU_ISO_URL"
        print_status "This is a one-time download (~2GB)..."
        print_status "The generated boot ISO will only be ~150MB"
        
        wget -q --show-progress -O "$CACHED_ISO" "$UBUNTU_ISO_URL" || {
            print_error "Failed to download Ubuntu ISO"
            exit 1
        }
        print_success "Ubuntu ISO downloaded"
    fi
    
    # Extract just the casper files we need
    print_status "Extracting casper kernel and initrd (this is what we need for autoinstall)..."
    
    TEMP_EXTRACT="${ISO_BUILD_DIR}/temp_extract"
    rm -rf "$TEMP_EXTRACT"
    mkdir -p "$TEMP_EXTRACT"
    
    # Extract only casper directory from ISO
    7z x "$CACHED_ISO" -o"$TEMP_EXTRACT" casper/vmlinuz casper/initrd > /dev/null 2>&1 || {
        # Fallback: extract everything if selective extraction fails
        print_warning "Selective extraction failed, extracting full ISO..."
        7z x "$CACHED_ISO" -o"$TEMP_EXTRACT" > /dev/null 2>&1
    }
    
    # Copy casper files
    if [ -f "$TEMP_EXTRACT/casper/vmlinuz" ]; then
        cp "$TEMP_EXTRACT/casper/vmlinuz" "$KERNEL_PATH"
        cp "$TEMP_EXTRACT/casper/initrd" "$INITRD_PATH"
        chmod 644 "$KERNEL_PATH" "$INITRD_PATH"
        print_success "Casper files extracted"
        print_status "  Kernel: $(du -h "$KERNEL_PATH" | cut -f1)"
        print_status "  Initrd: $(du -h "$INITRD_PATH" | cut -f1)"
    else
        print_error "Could not find casper files in ISO"
        exit 1
    fi
    
    # Cleanup temp extraction
    rm -rf "$TEMP_EXTRACT"
    
    # Optionally remove the large ISO to save space (keep for rebuilds)
    # rm -f "$CACHED_ISO"
    print_status "Keeping cached ISO for future rebuilds: $CACHED_ISO"
fi

# Verify casper files
if [ ! -f "$KERNEL_PATH" ] || [ ! -f "$INITRD_PATH" ]; then
    print_error "Casper files not found"
    exit 1
fi

# Create netboot autoinstall configuration on web server
print_status "Creating netboot autoinstall configuration..."
NETBOOT_DIR="/var/www/html/downloads/netboot/generic"
mkdir -p "$NETBOOT_DIR"

# Create user-data (autoinstall configuration)
cat > "$NETBOOT_DIR/user-data" << 'USERDATA'
#cloud-config
autoinstall:
  version: 1
  interactive-sections: []
  
  locale: en_US.UTF-8
  keyboard:
    layout: us
  
  identity:
    hostname: epc-generic
    # Password: wisp123 (change immediately after deployment)
    password: "$6$rounds=4096$WISPToolsSalt$e4nFmKTgLQkPBvQlUGE7yP6VzSbHKRn3JvVxKU8JWYM4FhFBOvGW8gCvLCqvnAhxN8vJGrKTvY/0LHUmxGJKe."
    username: wisp
  
  ssh:
    install-server: yes
    allow-pw: yes
  
  network:
    network:
      version: 2
      ethernets:
        all-en:
          match:
            name: "en*"
          dhcp4: true
          dhcp6: false
        all-eth:
          match:
            name: "eth*"
          dhcp4: true
          dhcp6: false
  
  storage:
    layout:
      name: direct
      match:
        size: largest
  
  packages:
    - curl
    - wget
    - ca-certificates
    - gnupg
    - lsb-release
    - openssh-server
    - jq
    - net-tools
  
  late-commands:
    # Create wisptools directories
    - curtin in-target --target=/target -- mkdir -p /etc/wisptools
    - curtin in-target --target=/target -- mkdir -p /opt/wisptools
    - curtin in-target --target=/target -- mkdir -p /var/lib/wisptools
    
    # Generate device code for check-in
    - curtin in-target --target=/target -- bash -c "DEVICE_CODE=\$(head /dev/urandom | tr -dc 'A-Z' | head -c4)\$(head /dev/urandom | tr -dc '0-9' | head -c4); echo \"DEVICE_CODE=\$DEVICE_CODE\" > /etc/wisptools/device-code.env; chmod 644 /etc/wisptools/device-code.env"
    
    # Create the check-in script that phones home
    - |
      cat > /target/opt/wisptools/checkin.sh << 'CHECKINSCRIPT'
#!/bin/bash
# WISPTools EPC Check-in Script
# Phones home to get EPC configuration based on device code

set -e

LOG_FILE="/var/log/wisptools-checkin.log"
CREDENTIALS_FILE="/etc/wisptools/credentials.env"
DEVICE_CODE_FILE="/etc/wisptools/device-code.env"
BOOTSTRAPPED_FILE="/var/lib/wisptools/.bootstrapped"
GCE_SERVER="__GCE_SERVER__"
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
    log "ERROR: No device code found"
    exit 1
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

# Get hardware ID (primary MAC address)
HARDWARE_ID=$(ip link show | grep -A1 "state UP" | grep ether | head -1 | awk '{print $2}')
if [ -z "$HARDWARE_ID" ]; then
    HARDWARE_ID=$(cat /sys/class/net/*/address 2>/dev/null | grep -v 00:00:00:00:00:00 | head -1)
fi
log "Hardware ID: $HARDWARE_ID"

# Get system info
HOSTNAME=$(hostname)
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')
log "Hostname: $HOSTNAME, IP: $IP_ADDR"

# Create device status page for user to see device code
mkdir -p /var/www/html
cat > /var/www/html/device-status.html << STATUSHTML
<!DOCTYPE html>
<html>
<head>
    <title>WISPTools EPC Device</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #eee; }
        .code { font-size: 48px; font-weight: bold; color: #00ff88; letter-spacing: 8px; margin: 30px 0; }
        .info { color: #888; margin: 20px 0; }
        .status { padding: 10px 20px; border-radius: 5px; display: inline-block; }
        .waiting { background: #ff9800; color: #000; }
        .connected { background: #4caf50; color: #fff; }
    </style>
    <meta http-equiv="refresh" content="30">
</head>
<body>
    <h1>WISPTools EPC Device</h1>
    <p>Enter this code in the device configuration page:</p>
    <div class="code">$DEVICE_CODE</div>
    <p class="info">Hardware ID: $HARDWARE_ID</p>
    <p class="info">IP Address: $IP_ADDR</p>
    <div class="status waiting" id="status">Waiting for configuration...</div>
    <p class="info">This page refreshes automatically every 30 seconds</p>
</body>
</html>
STATUSHTML

# Start simple HTTP server if not already running
if ! pgrep -f "python3.*SimpleHTTPServer\|python3 -m http.server" > /dev/null; then
    cd /var/www/html && python3 -m http.server 80 &>/dev/null &
    log "Started HTTP server for device status page"
fi

# Phone home to GCE server with device code
log "Checking in with GCE server at $GCE_SERVER:$HSS_PORT..."

RESPONSE=$(curl -s -X POST "http://$GCE_SERVER:$HSS_PORT/api/epc/checkin" \
    -H "Content-Type: application/json" \
    -d "{
        \"device_code\": \"$DEVICE_CODE\",
        \"hardware_id\": \"$HARDWARE_ID\",
        \"hostname\": \"$HOSTNAME\",
        \"ip_address\": \"$IP_ADDR\",
        \"os_version\": \"$(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"')\"
    }" 2>&1) || {
    log "ERROR: Failed to contact GCE server, will retry..."
    exit 1
}

log "Check-in response: $RESPONSE"

# Check if we got an EPC assignment
EPC_ID=$(echo "$RESPONSE" | jq -r '.epc_id // empty')
STATUS=$(echo "$RESPONSE" | jq -r '.status // empty')

if [ "$STATUS" = "waiting" ]; then
    log "Device code not yet linked. User needs to enter code $DEVICE_CODE in management portal."
    exit 1
fi

if [ -z "$EPC_ID" ] || [ "$EPC_ID" = "null" ]; then
    log "No EPC assigned yet. Waiting for configuration..."
    exit 1
fi

log "Assigned EPC: $EPC_ID"

# Save credentials
CHECKIN_TOKEN=$(echo "$RESPONSE" | jq -r '.checkin_token // empty')
cat > "$CREDENTIALS_FILE" << CREDS
# WISPTools EPC Credentials
# Generated: $(date)
EPC_ID=$EPC_ID
CHECKIN_TOKEN=$CHECKIN_TOKEN
GCE_SERVER=$GCE_SERVER
HSS_PORT=$HSS_PORT
HARDWARE_ID=$HARDWARE_ID
DEVICE_CODE=$DEVICE_CODE
CREDS
chmod 600 "$CREDENTIALS_FILE"

# Download and run deployment script
log "Downloading deployment script..."
DEPLOY_SCRIPT="/opt/wisptools/deploy.sh"
curl -s -o "$DEPLOY_SCRIPT" "http://$GCE_SERVER:$HSS_PORT/api/epc/$EPC_ID/deploy?checkin_token=$CHECKIN_TOKEN" || {
    log "ERROR: Failed to download deployment script"
    exit 1
}

chmod +x "$DEPLOY_SCRIPT"
log "Running deployment script..."
bash "$DEPLOY_SCRIPT" 2>&1 | tee -a "$LOG_FILE"

# Mark as bootstrapped
touch "$BOOTSTRAPPED_FILE"

# Update status page
cat > /var/www/html/device-status.html << STATUSHTML
<!DOCTYPE html>
<html>
<head>
    <title>WISPTools EPC Device - Connected</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #1a1a2e; color: #eee; }
        .code { font-size: 48px; font-weight: bold; color: #00ff88; letter-spacing: 8px; margin: 30px 0; }
        .info { color: #888; margin: 20px 0; }
        .status { padding: 10px 20px; border-radius: 5px; display: inline-block; }
        .connected { background: #4caf50; color: #fff; }
    </style>
</head>
<body>
    <h1>WISPTools EPC Device</h1>
    <div class="code">$DEVICE_CODE</div>
    <p class="info">EPC ID: $EPC_ID</p>
    <p class="info">Hardware ID: $HARDWARE_ID</p>
    <p class="info">IP Address: $IP_ADDR</p>
    <div class="status connected">Connected & Configured</div>
</body>
</html>
STATUSHTML

log "Check-in and deployment complete!"
exit 0
CHECKINSCRIPT
    - curtin in-target --target=/target -- sed -i "s/__GCE_SERVER__/${GCE_SERVER}/g" /opt/wisptools/checkin.sh
    - curtin in-target --target=/target -- sed -i "s/__HSS_PORT__/${HSS_PORT}/g" /opt/wisptools/checkin.sh
    - curtin in-target --target=/target -- chmod +x /opt/wisptools/checkin.sh
    
    # Create systemd service for check-in (runs every minute until connected)
    - |
      cat > /target/etc/systemd/system/wisptools-epc-checkin.service << 'SERVICEUNIT'
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
    
    # Create timer to retry check-in every minute
    - |
      cat > /target/etc/systemd/system/wisptools-epc-checkin.timer << 'TIMERUNIT'
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
    
    # Enable the check-in timer
    - curtin in-target --target=/target -- systemctl enable wisptools-epc-checkin.timer
    
    # Enable SSH
    - curtin in-target --target=/target -- systemctl enable ssh
    
    # Log installation completion
    - curtin in-target --target=/target -- bash -c "echo 'WISPTools EPC ISO installed: $(date)' >> /var/log/wisptools-install.log"
USERDATA

# Replace placeholder variables in user-data
sed -i "s/\${GCE_SERVER}/${GCE_PUBLIC_IP}/g" "$NETBOOT_DIR/user-data"
sed -i "s/\${HSS_PORT}/${HSS_PORT}/g" "$NETBOOT_DIR/user-data"

# Create meta-data
cat > "$NETBOOT_DIR/meta-data" << METADATA
instance-id: wisptools-epc-generic
local-hostname: epc-generic
METADATA

print_success "Netboot configuration created at $NETBOOT_DIR"

# Build the minimal ISO
print_status "Building minimal bootable ISO..."

ISO_ROOT="${ISO_BUILD_DIR}/iso_root"
rm -rf "$ISO_ROOT"
mkdir -p "$ISO_ROOT/casper" "$ISO_ROOT/boot/grub" "$ISO_ROOT/.disk"

# Copy casper files
cp "$KERNEL_PATH" "$ISO_ROOT/casper/vmlinuz"
cp "$INITRD_PATH" "$ISO_ROOT/casper/initrd"
chmod 644 "$ISO_ROOT/casper/vmlinuz" "$ISO_ROOT/casper/initrd"

# Create GRUB config for network-based autoinstall
cat > "$ISO_ROOT/boot/grub/grub.cfg" << GRUBCFG
set timeout=5
set default=0

menuentry "WISPTools EPC - Automated Install (Network)" {
    set gfxpayload=keep
    linux   /casper/vmlinuz autoinstall ds=nocloud-net\;s=http://${GCE_PUBLIC_IP}:${HSS_PORT}/downloads/netboot/generic/ ip=dhcp ---
    initrd  /casper/initrd
}

menuentry "WISPTools EPC - Manual Install" {
    set gfxpayload=keep
    linux   /casper/vmlinuz ip=dhcp ---
    initrd  /casper/initrd
}

menuentry "Boot from first hard disk" {
    set root=(hd0)
    chainloader +1
}
GRUBCFG

# Create disk info
echo "WISPTools EPC Ubuntu 22.04 LTS Netboot" > "$ISO_ROOT/.disk/info"

# Build ISO with grub-mkrescue (creates proper UEFI + BIOS bootable ISO)
print_status "Creating ISO image with grub-mkrescue..."
OUTPUT_ISO="$ISO_OUTPUT_DIR/$ISO_FILENAME"
rm -f "$OUTPUT_ISO"

grub-mkrescue -o "$OUTPUT_ISO" "$ISO_ROOT" 2>&1 | grep -v "xorriso.*NOTE" || true

# Verify ISO was created
if [ ! -f "$OUTPUT_ISO" ] || [ ! -s "$OUTPUT_ISO" ]; then
    print_error "ISO creation failed"
    exit 1
fi

# Get ISO size
ISO_SIZE=$(stat -c%s "$OUTPUT_ISO")
ISO_SIZE_MB=$((ISO_SIZE / 1024 / 1024))

print_success "ISO created: $OUTPUT_ISO (${ISO_SIZE_MB}MB)"

# Generate checksums
print_status "Generating checksums..."
cd "$ISO_OUTPUT_DIR"
sha256sum "$ISO_FILENAME" > "$ISO_FILENAME.sha256"
md5sum "$ISO_FILENAME" > "$ISO_FILENAME.md5"

# Set permissions
chmod 644 "$OUTPUT_ISO" "$ISO_FILENAME.sha256" "$ISO_FILENAME.md5"

# Cleanup
rm -rf "$ISO_ROOT"

echo ""
print_status "═══════════════════════════════════════════════════════════"
print_success "  Minimal Generic ISO built successfully!"
print_status "═══════════════════════════════════════════════════════════"
echo ""
print_status "ISO Location: $OUTPUT_ISO"
print_status "ISO Size: ${ISO_SIZE_MB}MB (vs ~2GB for full ISO)"
print_status "Download URL: http://${GCE_PUBLIC_IP}/downloads/isos/${ISO_FILENAME}"
echo ""
print_status "How it works:"
print_status "  1. Boot from this small ISO (~${ISO_SIZE_MB}MB)"
print_status "  2. Kernel/initrd contain Ubuntu installer (Subiquity)"
print_status "  3. Installer fetches autoinstall config from GCE server"
print_status "  4. System downloads packages over network during install"
print_status "  5. After install, device displays code and phones home"
echo ""
print_status "Default credentials:"
print_status "  Username: wisp"
print_status "  Password: wisp123"
echo ""
print_warning "IMPORTANT: Requires network connectivity during installation!"
echo ""

exit 0
