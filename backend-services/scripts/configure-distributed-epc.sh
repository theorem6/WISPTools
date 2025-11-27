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

# Step 1: Ensure Open5GS is installed
echo "[1/5] Checking Open5GS installation..."
if ! command -v open5gs-mmed &>/dev/null; then
    log "Installing Open5GS..."
    echo "deb [trusted=yes] https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/Debian_12/ ./" > /etc/apt/sources.list.d/open5gs.list
    apt-get update -qq
    apt-get install -y --no-install-recommends open5gs
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
echo "[4/6] Disabling local HSS and PCRF (using central services)..."
for svc in open5gs-hssd open5gs-pcrfd; do
    systemctl stop $svc 2>/dev/null || true
    systemctl disable $svc 2>/dev/null || true
    systemctl mask $svc 2>/dev/null || true
done
log "Local HSS and PCRF disabled"

# Step 5: Configure SMF to connect to central PCRF
echo "[5/6] Configuring SMF for central PCRF..."
if [ -f "$CONFIG_DIR/smf.yaml" ]; then
    # Update PCRF peer address to central server
    sed -i "s/127.0.0.7/${CENTRAL_HSS}/g" "$CONFIG_DIR/smf.yaml" 2>/dev/null || true
    log "SMF configured for central PCRF at $CENTRAL_HSS"
fi

# Step 6: Start EPC services (NOT HSS or PCRF)
echo "[6/6] Starting EPC services..."
for svc in open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
    systemctl enable $svc 2>/dev/null || true
    systemctl restart $svc 2>/dev/null || true
done
log "EPC services started"

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

