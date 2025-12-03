#!/bin/bash
# Configure remote EPC for distributed mode with central HSS
# Central HSS: hss.wisptools.io

set -e

echo "======================================"
echo "Configuring Distributed EPC"
echo "Central HSS: hss.wisptools.io"
echo "======================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo $0"
    exit 1
fi

# Central HSS configuration
CENTRAL_HSS="hss.wisptools.io"
HSS_DIAMETER_PORT=3868
CONFIG_DIR="/etc/open5gs"
LOG="/var/log/wisptools.log"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [EPC] $1" | tee -a "$LOG"; }

# Load registration data
REG_DATA=$(cat /etc/wisptools/registration.json 2>/dev/null || echo "{}")

# Get device code from the correct location
if [ -f /etc/wisptools/device-code.env ]; then
    source /etc/wisptools/device-code.env
elif [ -f /etc/wisptools/device_code ]; then
    DEVICE_CODE=$(cat /etc/wisptools/device_code)
else
    DEVICE_CODE=$(hostname | md5sum | cut -c1-8 | tr '[:lower:]' '[:upper:]')
fi

# Get configuration from registration or use defaults
EPC_ID=$(echo "$REG_DATA" | jq -r '.epc_id // empty' 2>/dev/null)
MCC=$(echo "$REG_DATA" | jq -r '.config.hss_config.mcc // .config.network_config.mcc // "001"' 2>/dev/null)
MNC=$(echo "$REG_DATA" | jq -r '.config.hss_config.mnc // .config.network_config.mnc // "01"' 2>/dev/null)
TAC=$(echo "$REG_DATA" | jq -r '.config.network_config.tac // "1"' 2>/dev/null)
REALM=$(echo "$REG_DATA" | jq -r '.config.hss_config.diameter_realm // "wisptools.io"' 2>/dev/null)

MME_IP=$(hostname -I | awk '{print $1}')

echo ""
log "Configuration:"
log "  EPC ID: ${EPC_ID:-not registered yet}"
log "  Device Code: $DEVICE_CODE"
log "  Central HSS: $CENTRAL_HSS"
log "  MCC/MNC: $MCC/$MNC"
log "  TAC: $TAC"
log "  MME IP: $MME_IP"
echo ""

# Step 1: Ensure Open5GS EPC components are installed (NOT HSS/PCRF)
echo "[1/6] Checking Open5GS installation..."
if ! command -v open5gs-mmed &>/dev/null; then
    log "Installing Open5GS EPC components..."
    
    # Detect OS for correct repository
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
            ubuntu)
                case "$VERSION_CODENAME" in
                    noble|mantic) REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/xUbuntu_24.04/" ;;
                    jammy) REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/xUbuntu_22.04/" ;;
                    *) REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/xUbuntu_22.04/" ;;
                esac
                ;;
            *)
                REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/Debian_12/"
                ;;
        esac
    else
        REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/Debian_12/"
    fi
    
    echo "deb [trusted=yes] $REPO_URL ./" > /etc/apt/sources.list.d/open5gs.list
    apt-get update -qq
    
    # Install ONLY the EPC components needed - NOT HSS or PCRF
    apt-get install -y --no-install-recommends \
        open5gs-mme \
        open5gs-sgwc \
        open5gs-sgwu \
        open5gs-smf \
        open5gs-upf
else
    log "Open5GS already installed"
fi

# Step 2: Configure MME
echo "[2/5] Configuring MME..."
if [ -f "$CONFIG_DIR/mme.yaml" ]; then
    log "Setting PLMN identity..."
    sed -i "s/mcc:.*/mcc: $MCC/" "$CONFIG_DIR/mme.yaml"
    sed -i "s/mnc:.*/mnc: $MNC/" "$CONFIG_DIR/mme.yaml"
    sed -i "s/tac:.*/tac: $TAC/" "$CONFIG_DIR/mme.yaml"
    log "MME configured"
else
    log "WARNING: MME config not found at $CONFIG_DIR/mme.yaml"
fi

# Step 3: Configure Diameter connection to central HSS
echo "[3/5] Configuring Diameter connection..."
mkdir -p /etc/freeDiameter

cat > /etc/freeDiameter/mme.conf << DIAMEOF
# FreeDiameter configuration for distributed EPC
# Generated: $(date)
# EPC ID: ${EPC_ID:-$DEVICE_CODE}
# Device Code: $DEVICE_CODE
# Connects to central HSS at $CENTRAL_HSS

Identity = "mme-${DEVICE_CODE}.${REALM}";
Realm = "${REALM}";

# Central HSS peer
ConnectPeer = "hss.${REALM}" { ConnectTo = "${CENTRAL_HSS}"; Port = ${HSS_DIAMETER_PORT}; };
DIAMEOF

log "Diameter configured to connect to $CENTRAL_HSS"

# Step 4: Disable local HSS and PCRF (they run centrally)
echo "[4/7] Disabling local HSS and PCRF (using central services)..."
for svc in open5gs-hssd open5gs-pcrfd; do
    systemctl stop $svc 2>/dev/null || true
    systemctl disable $svc 2>/dev/null || true
    systemctl mask $svc 2>/dev/null || true
done
log "Local HSS and PCRF disabled"

# Step 5: Configure SMF to connect to central PCRF
echo "[5/7] Configuring SMF for central PCRF..."
if [ -f "$CONFIG_DIR/smf.yaml" ]; then
    # Update PCRF peer address to central server
    sed -i "s/127.0.0.7/${CENTRAL_HSS}/g" "$CONFIG_DIR/smf.yaml" 2>/dev/null || true
    log "SMF configured for central PCRF at $CENTRAL_HSS"
fi

# Step 6: Apply Open5GS Performance Tuning
echo "[6/8] Applying Open5GS performance tuning..."
log "Configuring socket buffer and performance optimizations..."

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
sysctl -p /etc/sysctl.d/99-open5gs.conf >/dev/null 2>&1
log "Socket buffer tuning applied"

# Create systemd override for open5gs-sgwud service priority
mkdir -p /etc/systemd/system/open5gs-sgwud.service.d
cat > /etc/systemd/system/open5gs-sgwud.service.d/priority.conf << 'PRIORITYEOF'
[Service]
Nice=-10
CPUSchedulingPolicy=fifo
CPUSchedulingPriority=50
PRIORITYEOF
log "SGWU/UPF service priority configured"

# Create systemd service for GTP tunnel interface tuning
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
log "GTP tunnel interface tuning service created"

# Step 7: Start EPC services (NOT HSS or PCRF)
echo "[7/8] Starting EPC services..."
for svc in open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
    systemctl enable $svc 2>/dev/null || true
    systemctl restart $svc 2>/dev/null || true
done

# Wait for UPF to create ogstun interface, then start tuning service
sleep 3
systemctl start open5gs-tuning 2>/dev/null || true

log "EPC services started"

# Step 8: Install/update check-in agent for remote management
echo "[8/8] Installing check-in agent..."
curl -fsSL "https://${CENTRAL_HSS}/downloads/scripts/epc-checkin-agent.sh" -o /opt/wisptools/epc-checkin-agent.sh
chmod +x /opt/wisptools/epc-checkin-agent.sh
/opt/wisptools/epc-checkin-agent.sh install
log "Check-in agent installed and running"

# Show final status
echo ""
echo "======================================"
echo "EPC Configuration Complete"
echo "======================================"
echo ""
echo "Central HSS/PCRF: $CENTRAL_HSS"
echo "EPC ID: ${EPC_ID:-not registered yet}"
echo "Device Code: $DEVICE_CODE"
echo ""
echo "Local Services (running on this EPC):"
for svc in open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
    STATUS=$(systemctl is-active $svc 2>/dev/null || echo "failed")
    printf "  %-20s %s\n" "$svc:" "$STATUS"
done
echo ""
echo "Central Services (at $CENTRAL_HSS):"
echo "  open5gs-hssd:        CENTRAL (subscriber database)"
echo "  open5gs-pcrfd:       CENTRAL (policy/charging)"
echo ""
echo "======================================"

