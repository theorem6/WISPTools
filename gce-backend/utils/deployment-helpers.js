// Full Deployment Script Helper Functions
// Isolated utilities for EPC deployment script generation - DO NOT MODIFY unless fixing deployment issues
// 
// NOTE: Octal escape sequences (\1, \2, etc.) must be double-escaped (\\1, \\2)
//       in JavaScript template strings to avoid syntax errors

/**
 * Generate full EPC deployment script with Open5GS installation
 * This installs all EPC components and dependencies automatically
 */
function generateFullDeploymentScript(epc_id, gce_ip, hss_port) {
  // Default network config (can be fetched from database later)
  const defaultMcc = '001';
  const defaultMnc = '01';
  const defaultTac = '1';
  const defaultApn = 'internet';
  const defaultDnsPrimary = '8.8.8.8';
  const defaultDnsSecondary = '8.8.4.4';
  
  return `#!/bin/bash
# WISPTools.io Full EPC Deployment Script
# EPC: ${epc_id}
# This script automatically installs and configures Open5GS EPC

set -e

# Color codes for output
CYAN='\\033[0;36m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m' # No Color

print_status() {
    echo -e "\${CYAN}→\${NC} \$1"
}

print_success() {
    echo -e "\${GREEN}✓\${NC} \$1"
}

print_error() {
    echo -e "\${RED}✗\${NC} \$1"
}

print_header() {
    echo ""
    echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
    echo -e "\${CYAN}  \$1\${NC}"
    echo -e "\${CYAN}═══════════════════════════════════════════════════════════\${NC}"
    echo ""
}

# Load credentials
source /etc/wisptools/credentials.env

# Use ORIGIN_HOST_FQDN as S6a Identity (unique per EPC)
# This was generated during ISO creation: mme-{epc-id}.wisptools.io
S6A_IDENTITY="\${ORIGIN_HOST_FQDN:-mme.\$EPC_ID.wisptools.local}"
if [ -z "\$ORIGIN_HOST_FQDN" ]; then
    print_status "ORIGIN_HOST_FQDN not found, using fallback: \$S6A_IDENTITY"
else
    print_success "Using unique S6a Identity: \$S6A_IDENTITY"
fi

print_header "WISPTools.io EPC Deployment"
echo "EPC ID: \$EPC_ID"
echo "Tenant ID: \$TENANT_ID"
echo "S6a Identity: \$S6A_IDENTITY"
echo "Cloud HSS: ${gce_ip}:${hss_port}"
echo ""

# Auto-detect network configuration
print_header "Network Configuration (Auto-Detected)"
MME_IP=$(ip route get 8.8.8.8 2>/dev/null | awk '{print \$7; exit}' || hostname -I | awk '{print \$1}')
if [ -z "\$MME_IP" ]; then
    print_error "Could not detect IP address"
    exit 1
fi

SGWC_IP="\$MME_IP"
SGWU_IP="\$MME_IP"
SMF_IP="\$MME_IP"
UPF_IP="\$MME_IP"

print_success "Auto-detected Primary IP: \$MME_IP"
print_status "All EPC components will use: \$MME_IP"
echo ""

# Persist framebuffer/console settings in GRUB to avoid graphics initialization
print_header "Configuring GRUB for headless/text-only operation"
if [ -f /etc/default/grub ]; then
  print_status "Updating /etc/default/grub kernel parameters"
  # Ensure GRUB_CMDLINE_LINUX_DEFAULT exists
  if ! grep -q '^GRUB_CMDLINE_LINUX_DEFAULT=' /etc/default/grub; then
    echo 'GRUB_CMDLINE_LINUX_DEFAULT="quiet"' >> /etc/default/grub
  fi
  # Inject parameters idempotently: nomodeset nofb text and serial consoles (removed vga=normal, deprecated)
  sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT="\\(.*\\)"/GRUB_CMDLINE_LINUX_DEFAULT="\\1 nomodeset nofb text console=ttyS0,115200n8 console=tty1"/g' /etc/default/grub
  # Configure GRUB graphics mode for VirtualBox compatibility
  if ! grep -q '^GRUB_GFXMODE=' /etc/default/grub; then
    echo 'GRUB_GFXMODE=1024x768' >> /etc/default/grub
  fi
  if ! grep -q '^GRUB_GFXPAYLOAD_LINUX=' /etc/default/grub; then
    echo 'GRUB_GFXPAYLOAD_LINUX=keep' >> /etc/default/grub
  fi
  print_status "Running update-grub (or grub-mkconfig fallback)"
  if command -v update-grub >/dev/null 2>&1; then
    update-grub >/dev/null 2>&1 || true
  else
    grub-mkconfig -o /boot/grub/grub.cfg >/dev/null 2>&1 || true
  fi
  print_success "GRUB updated for headless boot with VirtualBox compatibility"
else
  print_status "/etc/default/grub not found, skipping persistent framebuffer disable"
fi

# Network configuration
MCC="${defaultMcc}"
MNC="${defaultMnc}"
TAC="${defaultTac}"
APN_NAME="${defaultApn}"
APN_POOL="10.45.0.0/16"
DNS_PRIMARY="${defaultDnsPrimary}"
DNS_SECONDARY="${defaultDnsSecondary}"
HSS_ADDR="${gce_ip}"
HSS_PORT="${hss_port}"

print_header "Installing Dependencies"
print_status "Updating package lists..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

print_status "Installing essential build tools and dependencies..."
# Install all required packages for EPC deployment - explicitly exclude GUI dependencies
# Using --no-install-recommends to prevent pulling in GUI packages
apt-get install -y --no-install-recommends \\
    wget curl gnupg software-properties-common apt-transport-https ca-certificates \\
    build-essential git make gcc g++ autoconf automake libtool pkg-config \\
    libssl-dev libpcre3-dev zlib1g-dev libncurses5-dev libreadline-dev \\
    libyaml-dev libffi-dev python3 python3-pip \\
    systemd networkd-dispatcher net-tools iproute2 iputils-ping \\
    dbus dbus-user-session \\
    logrotate rsyslog cron \\
    vim nano less \\
    jq \\
    bash-completion || print_warning "Some packages may have failed (continuing...)"

print_header "Installing Node.js"
if ! command -v node &> /dev/null; then
    print_status "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_success "Node.js \$(node --version) installed"
else
    print_success "Node.js \$(node --version) already installed"
fi

print_status "Installing monitoring tools..."
apt-get install -y sysstat net-tools iftop vnstat htop

print_header "Installing Open5GS"
print_status "Adding Open5GS repository..."
add-apt-repository -y ppa:open5gs/latest
apt-get update -qq

print_status "Installing Open5GS EPC components..."
apt-get install -y open5gs-mme open5gs-sgwc open5gs-sgwu open5gs-smf open5gs-upf open5gs-pcrf freeDiameter

print_header "Configuring EPC Components"

# Configure MME
print_status "Configuring MME..."
cat > /etc/open5gs/mme.yaml <<EOF
mme:
  freeDiameter: /etc/freeDiameter/mme.conf
  s1ap:
    - addr: \$MME_IP
  gtpc:
    - addr: \$SGWC_IP
  gummei:
    plmn_id:
      mcc: \${MCC}
      mnc: \${MNC}
    mme_gid: 2
    mme_code: 1
  tai:
    plmn_id:
      mcc: \${MCC}
      mnc: \${MNC}
    tac: \${TAC}
  security:
    integrity_order: [EIA2, EIA1, EIA0]
    ciphering_order: [EEA0, EEA1, EEA2]
  network_name:
    full: "WISPTools.io EPC"
    short: "WISPTools"
  guami:
    plmn_id:
      mcc: \${MCC}
      mnc: \${MNC}
    amf_id:
      region: 2
      set: 1
EOF

# Configure SGW-C
print_status "Configuring SGW-C..."
cat > /etc/open5gs/sgwc.yaml <<EOF
sgwc:
  gtpc:
    - addr: \$SGWC_IP
  pfcp:
    - addr: \$SGWC_IP
  sgwu:
    - addr: \$SGWU_IP
EOF

# Configure SGW-U
print_status "Configuring SGW-U..."
cat > /etc/open5gs/sgwu.yaml <<EOF
sgwu:
  gtpu:
    - addr: \$SGWU_IP
  pfcp:
    - addr: \$SGWU_IP
  sgwc:
    - addr: \$SGWC_IP
EOF

# Configure SMF
print_status "Configuring SMF..."
cat > /etc/open5gs/smf.yaml <<EOF
smf:
  gtpc:
    - addr: \$SMF_IP
  pfcp:
    - addr: \$SMF_IP
  upf:
    - addr: \$UPF_IP
  dns:
    - \$DNS_PRIMARY
    - \$DNS_SECONDARY
  subnet:
    - addr: \$APN_POOL
  ue_pool:
    - addr: \$APN_POOL
EOF

# Configure UPF
print_status "Configuring UPF..."
cat > /etc/open5gs/upf.yaml <<EOF
upf:
  gtpu:
    - addr: \$UPF_IP
  pfcp:
    - addr: \$UPF_IP
  smf:
    - addr: \$SMF_IP
EOF

# Configure PCRF
print_status "Configuring PCRF..."
cat > /etc/open5gs/pcrf.yaml <<EOF
pcrf:
  freeDiameter: /etc/freeDiameter/pcrf.conf
  gtpc:
    - addr: 127.0.0.1
EOF

print_header "Configuring Diameter Connection to Cloud HSS"
print_status "Setting up FreeDiameter MME configuration..."

# Create FreeDiameter MME configuration
cat > /etc/freeDiameter/mme.conf <<EOF
# FreeDiameter MME Configuration for Cloud HSS
# EPC: \$EPC_ID / Tenant: \$TENANT_ID
# S6a Identity (unique per EPC): \$S6A_IDENTITY
Identity = "\$S6A_IDENTITY";
Realm = "wisptools.local";

# Listening configuration
ListenOn = "\$MME_IP";
Port = 3868;

# Connect to Cloud HSS
ConnectPeer = "hss.wisptools.cloud" { ConnectTo = "\$HSS_ADDR"; No_TLS; Port = \$HSS_PORT; };

# Application configuration
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_s6a.fdx";

# Security and performance
No_IPv6;
No_SCTP;
EOF

# Create FreeDiameter PCRF configuration
print_status "Setting up FreeDiameter PCRF configuration..."
# Use same unique ID pattern for PCRF (derived from MME identity)
PCRF_IDENTITY=$(echo \$S6A_IDENTITY | sed 's/^mme-/pcrf-/')
cat > /etc/freeDiameter/pcrf.conf <<EOF
# FreeDiameter PCRF Configuration for Cloud HSS
# EPC: \$EPC_ID / Tenant: \$TENANT_ID
# PCRF Identity (matches MME): \$PCRF_IDENTITY
Identity = "\$PCRF_IDENTITY";
Realm = "wisptools.local";

# Listening configuration
ListenOn = "\$MME_IP";
Port = 3869;

# Connect to Cloud HSS
ConnectPeer = "hss.wisptools.cloud" { ConnectTo = "\$HSS_ADDR"; No_TLS; Port = \$HSS_PORT; };

# Application configuration
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_gx.fdx";
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_rx.fdx";

# Security and performance
No_IPv6;
No_SCTP;
EOF

print_success "FreeDiameter configured to connect to Cloud HSS at \$HSS_ADDR:\$HSS_PORT"

print_header "Starting Open5GS Services"
print_status "Enabling and starting all EPC components..."

systemctl enable open5gs-mmed
systemctl enable open5gs-sgwcd
systemctl enable open5gs-sgwud
systemctl enable open5gs-smfd
systemctl enable open5gs-upfd
systemctl enable open5gs-pcrfd

systemctl start open5gs-mmed
systemctl start open5gs-sgwcd
systemctl start open5gs-sgwud
systemctl start open5gs-smfd
systemctl start open5gs-upfd
systemctl start open5gs-pcrfd

sleep 3

# Check service status
print_status "Checking service status..."
if systemctl is-active --quiet open5gs-mmed && \\
   systemctl is-active --quiet open5gs-sgwcd && \\
   systemctl is-active --quiet open5gs-sgwud && \\
   systemctl is-active --quiet open5gs-smfd && \\
   systemctl is-active --quiet open5gs-upfd && \\
   systemctl is-active --quiet open5gs-pcrfd; then
    print_success "All Open5GS services are running"
else
    print_error "Some services failed to start. Check logs: journalctl -u open5gs-*"
fi

print_header "Deployment Complete"
print_success "EPC \$EPC_ID has been deployed successfully!"
echo ""
echo "Configuration Summary:"
echo "  MME IP: \$MME_IP"
echo "  Cloud HSS: \$HSS_ADDR:\$HSS_PORT"
echo "  MCC/MNC: \${MCC}/\${MNC}"
echo "  TAC: \${TAC}"
echo "  APN: \$APN_NAME"
echo ""
echo "Services running:"
systemctl list-units --type=service --state=running | grep open5gs || true
echo ""
print_success "EPC is ready to accept connections!"
echo ""

exit 0
`;
}

module.exports = {
  generateFullDeploymentScript
};

