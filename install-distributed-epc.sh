#!/bin/bash

###############################################################################
# Distributed EPC Installation Script
# 
# This script installs Open5GS in a distributed EPC configuration
# with cloud-based HSS authentication and metrics collection.
#
# Based on rapid5gs but customized for distributed deployment
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
OPEN5GS_VERSION="v2.7.6"
EPC_MODE="distributed" # distributed or standalone
CLOUD_HSS_API="https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}❌ Please run as root${NC}"
  exit 1
fi

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     Distributed EPC Installation Script                  ║"
echo "║     Open5GS + Cloud HSS + Metrics Agent                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Prompt for configuration
echo -e "${YELLOW}📝 EPC Site Configuration${NC}"
echo ""

read -p "Enter site name (e.g., 'Main Tower'): " SITE_NAME
read -p "Enter MCC (Mobile Country Code, e.g., '001'): " MCC
read -p "Enter MNC (Mobile Network Code, e.g., '01'): " MNC
read -p "Enter TAC (Tracking Area Code, e.g., '1'): " TAC
read -p "Enter APN name (e.g., 'internet'): " APN_NAME
read -p "Enter subscriber IP pool (e.g., '10.45.0.0/16'): " IP_POOL

echo ""
echo -e "${YELLOW}☁️  Cloud HSS Registration${NC}"
echo "You need to register this EPC site in the cloud management portal first."
echo "Go to: https://your-app-url/modules/hss-management"
echo "Navigate to: Remote EPCs tab -> Register New EPC"
echo ""

read -p "Enter AUTH CODE from registration: " AUTH_CODE
read -p "Enter API KEY from registration: " API_KEY
read -p "Enter SECRET KEY from registration: " SECRET_KEY

echo ""
echo -e "${GREEN}✅ Configuration received${NC}"
echo ""

# Update system
echo -e "${BLUE}📦 Updating system packages...${NC}"
apt-get update
apt-get install -y software-properties-common curl wget gnupg2

# Add Open5GS repository
echo -e "${BLUE}📦 Adding Open5GS repository...${NC}"
add-apt-repository -y ppa:open5gs/latest
apt-get update

# Install Open5GS core components
echo -e "${BLUE}📦 Installing Open5GS components...${NC}"
apt-get install -y \
  open5gs-mme \
  open5gs-sgwc \
  open5gs-sgwu \
  open5gs-upf \
  open5gs-smf \
  open5gs-pcrf \
  open5gs-nrf \
  open5gs-ausf \
  open5gs-udm \
  open5gs-udr \
  open5gs-nssf \
  open5gs-bsf \
  open5gs-pcf

# DO NOT install local HSS - we use cloud HSS
echo -e "${YELLOW}⚠️  Skipping local HSS installation (using cloud HSS)${NC}"

# Install Node.js for metrics agent
echo -e "${BLUE}📦 Installing Node.js...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Create metrics agent directory
echo -e "${BLUE}🔧 Setting up metrics agent...${NC}"
mkdir -p /opt/open5gs-metrics-agent
cp open5gs-metrics-agent.js /opt/open5gs-metrics-agent/
chmod +x /opt/open5gs-metrics-agent/open5gs-metrics-agent.js

# Install dependencies
cd /opt/open5gs-metrics-agent
npm init -y
npm install node-fetch@2

# Create environment file for metrics agent
cat > /etc/open5gs/metrics-agent.env <<EOF
EPC_API_URL=${CLOUD_HSS_API}
EPC_AUTH_CODE=${AUTH_CODE}
EPC_API_KEY=${API_KEY}
EPC_SECRET_KEY=${SECRET_KEY}
EPC_METRICS_INTERVAL=60
EOF

chmod 600 /etc/open5gs/metrics-agent.env

# Install systemd service
cp open5gs-metrics-agent.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable open5gs-metrics-agent

# Configure Open5GS for distributed mode
echo -e "${BLUE}🔧 Configuring Open5GS for distributed EPC mode...${NC}"

# Get local IP address
LOCAL_IP=$(ip route get 8.8.8.8 | awk -F"src " 'NR==1{split($2,a," ");print a[1]}')

# Configure MME
cat > /etc/open5gs/mme.yaml <<EOF
logger:
  file: /var/log/open5gs/mme.log
  level: info

mme:
  freeDiameter: /etc/freeDiameter/mme.conf
  s1ap:
    server:
      - address: ${LOCAL_IP}
  gtpc:
    server:
      - address: ${LOCAL_IP}
  gummei: 
    - plmn_id:
        mcc: ${MCC}
        mnc: ${MNC}
      mme_gid: 2
      mme_code: 1
  tai:
    - plmn_id:
        mcc: ${MCC}
        mnc: ${MNC}
      tac: ${TAC}
  security:
    integrity_order : [ EIA2, EIA1, EIA0 ]
    ciphering_order : [ EEA0, EEA1, EEA2 ]

sgwc:
  gtpc:
    client:
      sgwc:
        - address: 127.0.0.2

smf:
  gtpc:
    client:
      smf:
        - address: 127.0.0.4
EOF

# Configure FreeDiameter for cloud HSS
echo -e "${BLUE}🔧 Configuring FreeDiameter for cloud HSS...${NC}"

# Extract cloud HSS hostname from API URL
HSS_HOST=$(echo ${CLOUD_HSS_API} | sed -e 's|^[^/]*//||' -e 's|/.*$||' -e 's|:.*$||')

cat > /etc/freeDiameter/mme.conf <<EOF
Identity = "mme.${MCC}${MNC}.3gppnetwork.org";
Realm = "${MCC}${MNC}.3gppnetwork.org";

# Disable local TLS for cloud HSS (handled by HTTPS)
TLS_Cred = "/etc/freeDiameter/mme.cert.pem", "/etc/freeDiameter/mme.key.pem";
TLS_CA = "/etc/freeDiameter/cacert.pem";

LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_dcca_3gpp.fdx";
LoadExtension = "/usr/lib/x86_64-linux-gnu/freeDiameter/dict_s6a.fdx";

# Cloud HSS connection
ConnectPeer = "hss.${MCC}${MNC}.3gppnetwork.org" { ConnectTo = "${HSS_HOST}"; Port = 3868; };
EOF

# Generate self-signed certificates for FreeDiameter
if [ ! -f /etc/freeDiameter/mme.cert.pem ]; then
  openssl req -new -x509 -days 3650 -nodes \
    -subj "/CN=mme.${MCC}${MNC}.3gppnetwork.org" \
    -keyout /etc/freeDiameter/mme.key.pem \
    -out /etc/freeDiameter/mme.cert.pem
fi

# Configure SGWC
cat > /etc/open5gs/sgwc.yaml <<EOF
logger:
  file: /var/log/open5gs/sgwc.log
  level: info

sgwc:
  gtpc:
    server:
      - address: 127.0.0.2
  pfcp:
    server:
      - address: 127.0.0.2
    client:
      sgwu:
        - address: 127.0.0.6
EOF

# Configure SGWU
cat > /etc/open5gs/sgwu.yaml <<EOF
logger:
  file: /var/log/open5gs/sgwu.log
  level: info

sgwu:
  pfcp:
    server:
      - address: 127.0.0.6
  gtpu:
    server:
      - address: 127.0.0.6
EOF

# Configure SMF
cat > /etc/open5gs/smf.yaml <<EOF
logger:
  file: /var/log/open5gs/smf.log
  level: info

smf:
  sbi:
    server:
      - address: 127.0.0.4
        port: 7777
  pfcp:
    server:
      - address: 127.0.0.4
    client:
      upf:
        - address: 127.0.0.7
  gtpc:
    server:
      - address: 127.0.0.4
  gtpu:
    server:
      - address: 127.0.0.4
  metrics:
    server:
      - address: 127.0.0.4
        port: 9090
  subnet:
    - addr: ${IP_POOL%%/*}
      mask: ${IP_POOL##*/}
      apn: ${APN_NAME}
  dns:
    - 8.8.8.8
    - 8.8.4.4
EOF

# Configure UPF
cat > /etc/open5gs/upf.yaml <<EOF
logger:
  file: /var/log/open5gs/upf.log
  level: info

upf:
  pfcp:
    server:
      - address: 127.0.0.7
  gtpu:
    server:
      - address: ${LOCAL_IP}
  subnet:
    - addr: ${IP_POOL%%/*}
      mask: ${IP_POOL##*/}
      dev: ogstun
EOF

# Configure PCRF
cat > /etc/open5gs/pcrf.yaml <<EOF
logger:
  file: /var/log/open5gs/pcrf.log
  level: info

pcrf:
  freeDiameter: /etc/freeDiameter/pcrf.conf
EOF

# Setup OGSTUN interface
echo -e "${BLUE}🔧 Setting up OGSTUN network interface...${NC}"

# Create OGSTUN interface
ip tuntap add name ogstun mode tun
ip addr add ${IP_POOL%%/*}/${IP_POOL##*/} dev ogstun
ip link set ogstun up

# Enable IP forwarding
sysctl -w net.ipv4.ip_forward=1
sysctl -w net.ipv6.conf.all.forwarding=1

# Add NAT rules
iptables -t nat -A POSTROUTING -s ${IP_POOL} ! -o ogstun -j MASQUERADE

# Make persistent
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
echo "net.ipv6.conf.all.forwarding=1" >> /etc/sysctl.conf

# Save iptables rules
apt-get install -y iptables-persistent
netfilter-persistent save

# Create startup script for OGSTUN
cat > /etc/systemd/system/ogstun-setup.service <<EOF
[Unit]
Description=Setup OGSTUN interface for Open5GS
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'ip tuntap add name ogstun mode tun || true; ip addr add ${IP_POOL%%/*}/${IP_POOL##*/} dev ogstun || true; ip link set ogstun up'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ogstun-setup
systemctl start ogstun-setup

# Start Open5GS services
echo -e "${BLUE}🚀 Starting Open5GS services...${NC}"

systemctl enable open5gs-mmed
systemctl enable open5gs-sgwcd
systemctl enable open5gs-sgwud
systemctl enable open5gs-upfd
systemctl enable open5gs-smfd
systemctl enable open5gs-pcrfd

systemctl start open5gs-mmed
systemctl start open5gs-sgwcd
systemctl start open5gs-sgwud
systemctl start open5gs-upfd
systemctl start open5gs-smfd
systemctl start open5gs-pcrfd

# Wait for services to start
sleep 5

# Start metrics agent
echo -e "${BLUE}🚀 Starting metrics collection agent...${NC}"
systemctl start open5gs-metrics-agent

# Check service status
echo ""
echo -e "${BLUE}📊 Service Status:${NC}"
systemctl status open5gs-mmed --no-pager -l | head -10
systemctl status open5gs-metrics-agent --no-pager -l | head -10

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅ Distributed EPC Installation Complete!           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 Site Configuration:${NC}"
echo "   Site Name: ${SITE_NAME}"
echo "   MCC/MNC: ${MCC}/${MNC}"
echo "   TAC: ${TAC}"
echo "   APN: ${APN_NAME}"
echo "   IP Pool: ${IP_POOL}"
echo "   Local IP: ${LOCAL_IP}"
echo ""
echo -e "${BLUE}☁️  Cloud HSS:${NC}"
echo "   API: ${CLOUD_HSS_API}"
echo "   Auth Code: ${AUTH_CODE}"
echo ""
echo -e "${BLUE}📊 Monitoring:${NC}"
echo "   Metrics Agent: Active (60s interval)"
echo "   Dashboard: Check cloud management portal"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "   1. Verify EPC appears as 'online' in cloud dashboard"
echo "   2. Add subscribers in HSS management portal"
echo "   3. Connect eNodeB to this EPC (S1-MME: ${LOCAL_IP}:36412)"
echo "   4. Monitor attach events in real-time dashboard"
echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "   Check status: systemctl status open5gs-mmed"
echo "   View logs: tail -f /var/log/open5gs/mme.log"
echo "   Agent logs: journalctl -u open5gs-metrics-agent -f"
echo "   Test connection: ping 10.45.0.1 (from UE)"
echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"

