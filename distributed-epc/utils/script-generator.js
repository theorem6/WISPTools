// Deployment Script Generator for Remote EPCs
// Generates interactive bash scripts for Open5GS installation and configuration

/**
 * Generate a complete deployment script for a remote EPC
 * @param {Object} epc - EPC configuration object
 * @returns {string} - Bash script content
 */
function generateDeploymentScript(epc) {
  const mcc = epc.network_config?.mcc || '001';
  const mnc = epc.network_config?.mnc || '01';
  const tac = epc.network_config?.tac || '1';
  
  return `#!/bin/bash
# 🚀 Complete EPC Deployment Script - Rapid5GS Style
# Site: ${epc.site_name}
# EPC ID: ${epc.epc_id}
# Generated: ${new Date().toISOString()}

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
PURPLE='\\033[0;35m'
CYAN='\\033[0;36m'
NC='\\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "\\n\${BLUE}[INFO]\${NC} \$1"
}

print_success() {
    echo -e "\\n\${GREEN}[SUCCESS]\${NC} \$1"
}

print_warning() {
    echo -e "\\n\${YELLOW}[WARNING]\${NC} \$1"
}

print_error() {
    echo -e "\\n\${RED}[ERROR]\${NC} \$1"
}

print_header() {
    echo -e "\\n\${PURPLE}═══════════════════════════════════════════════════════════\${NC}"
    echo -e "\${PURPLE}     \$1\${NC}"
    echo -e "\${PURPLE}═══════════════════════════════════════════════════════════\${NC}"
}

# Interactive configuration
print_header "Remote EPC Deployment - ${epc.site_name}"
echo -e "\${CYAN}EPC ID:\${NC} ${epc.epc_id}"
echo -e "\${CYAN}Location:\${NC} ${epc.location?.city || 'Not specified'}, ${epc.location?.state || 'Not specified'}"
echo -e "\${CYAN}Coordinates:\${NC} ${epc.location?.coordinates?.latitude || 'N/A'}, ${epc.location?.coordinates?.longitude || 'N/A'}"
echo -e "\${CYAN}Network:\${NC} MCC=${mcc} MNC=${mnc} TAC=${tac}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  print_error "Please run as root (use sudo)"
  exit 1
fi

# Interactive IP configuration
print_header "Network Configuration"
echo "Please provide the following network information:"
echo ""

# Get MME IP
read -p "MME IP Address (S1AP interface) [default: auto-detect]: " MME_IP
if [ -z "$MME_IP" ]; then
    MME_IP=$(ip route get 8.8.8.8 | awk '{print $7; exit}')
    print_status "Auto-detected MME IP: $MME_IP"
fi

# Get SGW-C IP
read -p "SGW-C IP Address (S11 interface) [default: $MME_IP]: " SGWC_IP
if [ -z "$SGWC_IP" ]; then
    SGWC_IP="$MME_IP"
fi

# Get SGW-U IP
read -p "SGW-U IP Address (S1-U interface) [default: $MME_IP]: " SGWU_IP
if [ -z "$SGWU_IP" ]; then
    SGWU_IP="$MME_IP"
fi

# Get SMF IP
read -p "SMF IP Address (N4 interface) [default: $MME_IP]: " SMF_IP
if [ -z "$SMF_IP" ]; then
    SMF_IP="$MME_IP"
fi

# Get UPF IP
read -p "UPF IP Address (N3 interface) [default: $MME_IP]: " UPF_IP
if [ -z "$UPF_IP" ]; then
    UPF_IP="$MME_IP"
fi

# Get Cloud HSS IP
read -p "Cloud HSS IP Address [default: 136.112.111.167]: " HSS_IP
if [ -z "$HSS_IP" ]; then
    HSS_IP="136.112.111.167"
fi

# Get DNS servers
read -p "Primary DNS Server [default: 8.8.8.8]: " DNS_PRIMARY
if [ -z "$DNS_PRIMARY" ]; then
    DNS_PRIMARY="8.8.8.8"
fi

read -p "Secondary DNS Server [default: 8.8.4.4]: " DNS_SECONDARY
if [ -z "$DNS_SECONDARY" ]; then
    DNS_SECONDARY="8.8.4.4"
fi

# Get APN configuration
read -p "APN Name [default: internet]: " APN_NAME
if [ -z "$APN_NAME" ]; then
    APN_NAME="internet"
fi

read -p "APN IP Pool (CIDR) [default: 10.45.0.0/16]: " APN_POOL
if [ -z "$APN_POOL" ]; then
    APN_POOL="10.45.0.0/16"
fi

echo ""
print_status "Configuration Summary:"
echo "  MME IP: $MME_IP"
echo "  SGW-C IP: $SGWC_IP"
echo "  SGW-U IP: $SGWU_IP"
echo "  SMF IP: $SMF_IP"
echo "  UPF IP: $UPF_IP"
echo "  Cloud HSS IP: $HSS_IP"
echo "  DNS: $DNS_PRIMARY, $DNS_SECONDARY"
echo "  APN: $APN_NAME ($APN_POOL)"
echo ""

read -p "Continue with installation? [Y/n]: " CONFIRM
if [[ $CONFIRM =~ ^[Nn]$ ]]; then
    print_warning "Installation cancelled by user"
    exit 0
fi

print_header "Installing Dependencies"
print_status "Updating package lists..."
apt-get update -qq

print_status "Installing required packages..."
apt-get install -y wget curl gnupg software-properties-common apt-transport-https ca-certificates

print_header "Installing Node.js"
print_status "Node.js is required for the metrics agent..."
if ! command -v node &> /dev/null; then
    print_status "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    print_success "Node.js $(node --version) installed"
else
    print_success "Node.js $(node --version) already installed"
fi

print_status "Installing monitoring tools..."
apt-get install -y sysstat net-tools iftop vnstat

print_header "Installing Open5GS"
print_status "Adding Open5GS repository..."
add-apt-repository -y ppa:open5gs/latest
apt-get update -qq

print_status "Installing Open5GS EPC components..."
apt-get install -y open5gs-mme open5gs-sgwc open5gs-sgwu open5gs-smf open5gs-upf open5gs-pcrf

print_header "Configuring EPC Components"

# Configure MME
print_status "Configuring MME..."
cat > /etc/open5gs/mme.yaml <<EOF
mme:
  freeDiameter: /etc/freeDiameter/mme.conf
  s1ap:
    - addr: $MME_IP
  gtpc:
    - addr: $SGWC_IP
  gummei:
    plmn_id:
      mcc: ${mcc}
      mnc: ${mnc}
    mme_gid: 2
    mme_code: 1
  tai:
    plmn_id:
      mcc: ${mcc}
      mnc: ${mnc}
    tac: ${tac}
  security:
    integrity_order: [EIA2, EIA1, EIA0]
    ciphering_order: [EEA0, EEA1, EEA2]
  network_name:
    full: "Cloud HSS EPC"
    short: "CloudEPC"
  guami:
    plmn_id:
      mcc: ${mcc}
      mnc: ${mnc}
    amf_id:
      region: 2
      set: 1
EOF

# Configure SGW-C
print_status "Configuring SGW-C..."
cat > /etc/open5gs/sgwc.yaml <<EOF
sgwc:
  gtpc:
    - addr: $SGWC_IP
  pfcp:
    - addr: $SGWC_IP
  sgwu:
    - addr: $SGWU_IP
EOF

# Configure SGW-U
print_status "Configuring SGW-U..."
cat > /etc/open5gs/sgwu.yaml <<EOF
sgwu:
  gtpu:
    - addr: $SGWU_IP
  pfcp:
    - addr: $SGWU_IP
  sgwc:
    - addr: $SGWC_IP
EOF

# Configure SMF
print_status "Configuring SMF..."
cat > /etc/open5gs/smf.yaml <<EOF
smf:
  gtpc:
    - addr: $SMF_IP
  pfcp:
    - addr: $SMF_IP
  upf:
    - addr: $UPF_IP
  dns:
    - $DNS_PRIMARY
    - $DNS_SECONDARY
  subnet:
    - addr: $APN_POOL
  ue_pool:
    - addr: $APN_POOL
EOF

# Configure UPF
print_status "Configuring UPF..."
cat > /etc/open5gs/upf.yaml <<EOF
upf:
  gtpu:
    - addr: $UPF_IP
  pfcp:
    - addr: $UPF_IP
  smf:
    - addr: $SMF_IP
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
Identity = "mme.${epc.site_name.replace(/[^a-zA-Z0-9]/g, '')}.local";
Realm = "local";

# TLS Configuration
TLS_Cred = "/etc/freeDiameter/mme.cert.pem", "/etc/freeDiameter/mme.key.pem";
TLS_CA = "/etc/freeDiameter/ca.cert.pem";

# Connect to Cloud HSS
ConnectPeer = "hss.cloud" { ConnectTo = "$HSS_IP"; No_TLS; };
ConnectPeer = "pcrf.cloud" { ConnectTo = "$HSS_IP"; No_TLS; };

# Application configuration
AppServers = "mme.local";
AppServers = "pcrf.local";

# Security
No_IPv6;
No_SCTP;
EOF

print_status "Setting up FreeDiameter PCRF configuration..."
cat > /etc/freeDiameter/pcrf.conf <<EOF
# FreeDiameter PCRF Configuration for Cloud HSS
Identity = "pcrf.${epc.site_name.replace(/[^a-zA-Z0-9]/g, '')}.local";
Realm = "local";

# TLS Configuration
TLS_Cred = "/etc/freeDiameter/pcrf.cert.pem", "/etc/freeDiameter/pcrf.key.pem";
TLS_CA = "/etc/freeDiameter/ca.cert.pem";

# Connect to Cloud HSS
ConnectPeer = "hss.cloud" { ConnectTo = "$HSS_IP"; No_TLS; };

# Application configuration
AppServers = "pcrf.local";

# Security
No_IPv6;
No_SCTP;
EOF

print_header "Setting Up Metrics Agent"
print_status "Creating metrics collection agent..."

# Download metrics agent from GitHub (private repo)
GITHUB_TOKEN="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"
print_status "Downloading metrics agent from GitHub..."
curl -H "Authorization: token \${GITHUB_TOKEN}" \\
  -o /opt/open5gs-metrics-agent.js \\
  https://raw.githubusercontent.com/theorem6/lte-pci-mapper/main/deployment-files/open5gs-metrics-agent.js

if [ $? -eq 0 ]; then
    print_success "Metrics agent downloaded"
    # Configure environment variables
    cat > /opt/open5gs-metrics-agent.env <<EOF
HSS_API_URL=${process.env.VITE_HSS_API_URL || 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy'}
EPC_ID=${epc.epc_id}
TENANT_ID=${epc.tenant_id}
EOF
else
    print_warning "Download failed, metrics agent will not be configured"
fi

chmod +x /opt/open5gs-metrics-agent.js

# Install MongoDB driver for metrics agent
print_status "Installing MongoDB driver for metrics agent..."
cd /opt
npm install mongodb

# Initialize network monitoring
print_status "Initializing network monitoring..."
vnstat --create -i ogstun 2>/dev/null || true
systemctl enable vnstat
systemctl start vnstat

# Create systemd service for metrics agent
cat > /etc/systemd/system/open5gs-metrics-agent.service <<EOF
[Unit]
Description=Open5GS Metrics Agent
After=network.target

[Service]
Type=simple
User=root
EnvironmentFile=/opt/open5gs-metrics-agent.env
ExecStart=/usr/bin/node /opt/open5gs-metrics-agent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

print_header "Starting Services"
print_status "Enabling and starting Open5GS services..."

systemctl daemon-reload
systemctl enable open5gs-mmed
systemctl enable open5gs-sgwcd
systemctl enable open5gs-sgwud
systemctl enable open5gs-smfd
systemctl enable open5gs-upfd
systemctl enable open5gs-pcrfd
systemctl enable open5gs-metrics-agent

print_status "Starting services..."
systemctl start open5gs-mmed
sleep 2
systemctl start open5gs-sgwcd
sleep 2
systemctl start open5gs-sgwud
sleep 2
systemctl start open5gs-smfd
sleep 2
systemctl start open5gs-upfd
sleep 2
systemctl start open5gs-pcrfd
sleep 2
systemctl start open5gs-metrics-agent

print_header "Verification"
print_status "Checking service status..."

services=("open5gs-mmed" "open5gs-sgwcd" "open5gs-sgwud" "open5gs-smfd" "open5gs-upfd" "open5gs-pcrfd" "open5gs-metrics-agent")

for service in "\${services[@]}"; do
    if systemctl is-active --quiet $service; then
        print_success "$service is running"
    else
        print_error "$service failed to start"
        systemctl status $service --no-pager
    fi
done

print_header "Deployment Complete!"
print_success "EPC deployment completed successfully!"
echo ""
echo -e "\${CYAN}EPC Configuration:\${NC}"
echo "  Site: ${epc.site_name}"
echo "  EPC ID: ${epc.epc_id}"
echo "  MME IP: $MME_IP"
echo "  Cloud HSS: $HSS_IP"
echo ""
echo -e "\${CYAN}Service Status:\${NC}"
systemctl status open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd open5gs-pcrfd --no-pager
echo ""
echo -e "\${CYAN}Next Steps:\${NC}"
echo "1. Configure your eNodeB to connect to MME at $MME_IP:36412"
echo "2. Add subscribers via the Cloud HSS web interface"
echo "3. Monitor EPC status in the dashboard"
echo ""
print_success "Your EPC is now online and connected to the Cloud HSS!"
`;
}

module.exports = {
  generateDeploymentScript
};

