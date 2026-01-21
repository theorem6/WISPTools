/**
 * Generate Open5GS installation and configuration section
 * @param {Object} config - Configuration object
 * @param {string} config.deploymentType - Deployment type
 */
function generateOpen5GSInstallation(config) {
  const { deploymentType } = config;
  
  return `# EPC Installation (conditional based on deployment type)
if [ "\\$INSTALL_EPC" = "1" ]; then

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
    - addr: \\$MME_IP
  gtpc:
    - addr: \\$SGWC_IP
  gummei:
    plmn_id:
      mcc: \\${MCC}
      mnc: \\${MNC}
    mme_gid: 2
    mme_code: 1
  tai:
    plmn_id:
      mcc: \\${MCC}
      mnc: \\${MNC}
    tac: \\${TAC}
  security:
    integrity_order: [EIA2, EIA1, EIA0]
    ciphering_order: [EEA0, EEA1, EEA2]
  network_name:
    full: "WISPTools.io EPC"
    short: "WISPTools"
  guami:
    plmn_id:
      mcc: \\${MCC}
      mnc: \\${MNC}
    amf_id:
      region: 2
      set: 1
EOF

# Configure SGW-C
print_status "Configuring SGW-C..."
cat > /etc/open5gs/sgwc.yaml <<EOF
sgwc:
  gtpc:
    - addr: \\$SGWC_IP
  pfcp:
    - addr: \\$SGWC_IP
  sgwu:
    - addr: \\$SGWU_IP
EOF

# Configure SGW-U
print_status "Configuring SGW-U..."
cat > /etc/open5gs/sgwu.yaml <<EOF
sgwu:
  gtpu:
    - addr: \\$SGWU_IP
  pfcp:
    - addr: \\$SGWU_IP
  sgwc:
    - addr: \\$SGWC_IP
EOF

# Configure SMF
print_status "Configuring SMF..."
cat > /etc/open5gs/smf.yaml <<EOF
smf:
  gtpc:
    - addr: \\$SMF_IP
  pfcp:
    - addr: \\$SMF_IP
  upf:
    - addr: \\$UPF_IP
  dns:
    - \\$DNS_PRIMARY
    - \\$DNS_SECONDARY
  subnet:
    - addr: \\$APN_POOL
  ue_pool:
    - addr: \\$APN_POOL
EOF

# Configure UPF
print_status "Configuring UPF..."
cat > /etc/open5gs/upf.yaml <<EOF
upf:
  gtpu:
    - addr: \\$UPF_IP
  pfcp:
    - addr: \\$UPF_IP
  smf:
    - addr: \\$SMF_IP
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
# EPC: \\$EPC_ID / Tenant: \\$TENANT_ID
# S6a Identity (unique per EPC): \\$S6A_IDENTITY
Identity = "\\$S6A_IDENTITY";
Realm = "wisptools.local";

# Listening configuration
ListenOn = "\\$MME_IP";
Port = 3868;

# Connect to Cloud HSS
ConnectPeer = "hss.wisptools.cloud" { ConnectTo = "\\$HSS_ADDR"; No_TLS; Port = \\$HSS_PORT; };

# Application configuration
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_s6a.fdx";

# Security and performance
No_IPv6;
No_SCTP;
EOF

# Create FreeDiameter PCRF configuration
print_status "Setting up FreeDiameter PCRF configuration..."
# Use same unique ID pattern for PCRF (derived from MME identity)
PCRF_IDENTITY=$(echo \\$S6A_IDENTITY | sed 's/^mme-/pcrf-/')
cat > /etc/freeDiameter/pcrf.conf <<EOF
# FreeDiameter PCRF Configuration for Cloud HSS
# EPC: \\$EPC_ID / Tenant: \\$TENANT_ID
# PCRF Identity (matches MME): \\$PCRF_IDENTITY
Identity = "\\$PCRF_IDENTITY";
Realm = "wisptools.local";

# Listening configuration
ListenOn = "\\$MME_IP";
Port = 3869;

# Connect to Cloud HSS
ConnectPeer = "hss.wisptools.cloud" { ConnectTo = "\\$HSS_ADDR"; No_TLS; Port = \\$HSS_PORT; };

# Application configuration
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_gx.fdx";
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_rx.fdx";

# Security and performance
No_IPv6;
No_SCTP;
EOF

print_success "FreeDiameter configured to connect to Cloud HSS at \\$HSS_ADDR:\\$HSS_PORT"

print_header "Open5GS Performance Tuning"
print_status "Applying socket buffer and performance optimizations..."

# Create sysctl configuration for socket buffer tuning
cat > /etc/sysctl.d/99-open5gs.conf << 'SYSCTLEOF'
# Open5GS Performance Tuning: Socket Buffer Optimization for High-Throughput LTE Core
# Based on production tuning that eliminated UDP socket buffer overflows

# Socket Buffer Sizes - 64MB/128MB max
net.core.rmem_max = 67108864
net.core.wmem_max = 134217728
net.core.rmem_default = 16777216
net.core.wmem_default = 16777216

# UDP Buffer Minimums
net.ipv4.udp_rmem_min = 131072
net.ipv4.udp_wmem_min = 262144

# UDP Memory (pages: min pressure max)
net.ipv4.udp_mem = 65536 131072 262144

# Backlog Queue (handle bursts)
net.core.netdev_max_backlog = 250000
net.core.netdev_budget = 600

# TCP Tuning
net.ipv4.tcp_rmem = 4096 87380 67108864
net.ipv4.tcp_wmem = 4096 65536 67108864
net.core.somaxconn = 65535

# Connection Handling
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15

# Required for GTP tunneling
net.ipv4.ip_forward = 1
SYSCTLEOF

# Apply sysctl settings immediately
sysctl -p /etc/sysctl.d/99-open5gs.conf
print_success "Socket buffer tuning applied"

# Create systemd override for open5gs-sgwud service priority
print_status "Configuring SGWU/UPF service priority..."
mkdir -p /etc/systemd/system/open5gs-sgwud.service.d
cat > /etc/systemd/system/open5gs-sgwud.service.d/priority.conf << 'PRIORITYEOF'
[Service]
Nice=-10
CPUSchedulingPolicy=fifo
CPUSchedulingPriority=50
PRIORITYEOF
print_success "SGWU/UPF service priority configured"

# Create systemd service for GTP tunnel interface tuning
print_status "Creating GTP tunnel interface tuning service..."
cat > /etc/systemd/system/open5gs-tuning.service << 'TUNINGEOFSERVICE'
[Unit]
Description=Open5GS Performance Tuning Service
After=network.target open5gs-upfd.service
Wants=open5gs-upfd.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c 'if ip link show ogstun >/dev/null 2>&1; then ip link set ogstun txqueuelen 10000; echo "GTP tunnel interface tuned"; else echo "Waiting for ogstun interface..."; sleep 5; ip link set ogstun txqueuelen 10000 || true; fi'
ExecStartPost=/bin/sleep 2
StandardOutput=journal
StandardError=journal
SyslogIdentifier=open5gs-tuning

[Install]
WantedBy=multi-user.target
TUNINGEOFSERVICE

systemctl daemon-reload
systemctl enable open5gs-tuning.service
print_success "GTP tunnel interface tuning service created"

else
  print_status "Skipping EPC installation (deployment type: ${deploymentType})"
fi  # End of INSTALL_EPC section
`;
}

module.exports = { generateOpen5GSInstallation };
