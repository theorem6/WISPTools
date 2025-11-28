#!/bin/bash
# Complete EPC/SNMP Device Setup Script
# Sets up or resets an EPC/SNMP device with all required services
# Usage: sudo bash setup-epc-device.sh [--force]

set -e

FORCE_RECONFIGURE=false
if [ "$1" = "--force" ]; then
    FORCE_RECONFIGURE=true
    echo "⚠️  Force reconfiguration mode enabled"
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root: sudo bash $0"
    exit 1
fi

# Configuration
CENTRAL_HSS="hss.wisptools.io"
HSS_PORT=3001
LOG="/var/log/wisptools-setup.log"
CONFIG_DIR="/etc/wisptools"
OPEN5GS_CONFIG_DIR="/etc/open5gs"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SETUP] $1" | tee -a "$LOG"
}

# Print header
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║     WISPTools EPC/SNMP Device Setup Script                        ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

log "Starting device setup..."

# ============================================================================
# Step 1: Get Device Information
# ============================================================================
log "Step 1: Gathering device information..."

# Get device code
if [ -f "$CONFIG_DIR/device-code.env" ]; then
    source "$CONFIG_DIR/device-code.env"
elif [ -f "$CONFIG_DIR/device_code" ]; then
    DEVICE_CODE=$(cat "$CONFIG_DIR/device_code")
else
    DEVICE_CODE=$(ip link show | grep -A1 "state UP" | grep link/ether | head -1 | awk '{print $2}' | tr -d ':' | cut -c1-8 | tr '[:lower:]' '[:upper:]')
    mkdir -p "$CONFIG_DIR"
    echo "DEVICE_CODE=$DEVICE_CODE" > "$CONFIG_DIR/device-code.env"
    chmod 600 "$CONFIG_DIR/device-code.env"
    log "Generated new device code: $DEVICE_CODE"
fi

# Get hardware ID
HARDWARE_ID=$(cat /sys/class/dmi/id/product_uuid 2>/dev/null || \
              ip link show | grep ether | head -1 | awk '{print $2}' | tr -d ':')

# Get IP address
IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')

log "Device Code: $DEVICE_CODE"
log "Hardware ID: $HARDWARE_ID"
log "IP Address: $IP_ADDR"

# ============================================================================
# Step 2: Check Registration with Central Server
# ============================================================================
log "Step 2: Checking registration with central server..."

RESPONSE=$(curl -s -X POST "https://${CENTRAL_HSS}:${HSS_PORT}/api/epc/checkin" \
    -H "Content-Type: application/json" \
    -d "{\"device_code\":\"$DEVICE_CODE\",\"hardware_id\":\"$HARDWARE_ID\",\"ip_address\":\"$IP_ADDR\"}" 2>/dev/null) || true

EPC_ID=$(echo "$RESPONSE" | jq -r '.epc_id // empty' 2>/dev/null)
STATUS=$(echo "$RESPONSE" | jq -r '.status // empty' 2>/dev/null)
CHECKIN_TOKEN=$(echo "$RESPONSE" | jq -r '.checkin_token // empty' 2>/dev/null)
CONFIG=$(echo "$RESPONSE" | jq -r '.config // {}' 2>/dev/null)

if [ -n "$EPC_ID" ] && [ "$EPC_ID" != "null" ] && [ "$STATUS" = "ok" ]; then
    log "✅ Device is registered (EPC ID: $EPC_ID)"
    
    # Save registration data
    mkdir -p "$CONFIG_DIR"
    echo "$RESPONSE" > "$CONFIG_DIR/registration.json"
    chmod 600 "$CONFIG_DIR/registration.json"
    
    # Extract configuration
    ENABLE_EPC=$(echo "$CONFIG" | jq -r '.enable_epc // false' 2>/dev/null)
    ENABLE_SNMP=$(echo "$CONFIG" | jq -r '.enable_snmp // false' 2>/dev/null)
    
    # Get network configuration
    MCC=$(echo "$CONFIG" | jq -r '.hss_config.mcc // .network_config.mcc // "001"' 2>/dev/null)
    MNC=$(echo "$CONFIG" | jq -r '.hss_config.mnc // .network_config.mnc // "01"' 2>/dev/null)
    TAC=$(echo "$CONFIG" | jq -r '.network_config.tac // "1"' 2>/dev/null)
    REALM=$(echo "$CONFIG" | jq -r '.hss_config.diameter_realm // "wisptools.io"' 2>/dev/null)
else
    log "⚠️  Device not registered on server yet"
    log "   Please register this device in the WISPTools Portal first"
    log "   Device Code: $DEVICE_CODE"
    
    ENABLE_EPC=false
    ENABLE_SNMP=false
    MCC="001"
    MNC="01"
    TAC="1"
    REALM="wisptools.io"
fi

# ============================================================================
# Step 3: Install/Update Check-in Agent
# ============================================================================
log "Step 3: Installing/updating check-in agent..."

mkdir -p /opt/wisptools
curl -fsSL "https://${CENTRAL_HSS}/downloads/scripts/epc-checkin-agent.sh" -o /opt/wisptools/epc-checkin-agent.sh
chmod +x /opt/wisptools/epc-checkin-agent.sh

# Install check-in agent service
if [ -f /opt/wisptools/epc-checkin-agent.sh ]; then
    /opt/wisptools/epc-checkin-agent.sh install
    log "✅ Check-in agent installed and running"
else
    log "⚠️  Failed to download check-in agent"
fi

# ============================================================================
# Step 4: Configure Open5GS EPC (if enabled)
# ============================================================================
if [ "$ENABLE_EPC" = "true" ] || [ "$FORCE_RECONFIGURE" = "true" ]; then
    log "Step 4: Configuring Open5GS EPC..."
    
    # Check if Open5GS is installed
    if ! command -v open5gs-mmed &>/dev/null; then
        log "Installing Open5GS EPC packages..."
        
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
        
        # Install ONLY EPC components (NOT HSS/PCRF)
        apt-get install -y --no-install-recommends \
            open5gs-mme \
            open5gs-sgwc \
            open5gs-sgwu \
            open5gs-smf \
            open5gs-upf
        
        log "✅ Open5GS EPC packages installed"
    else
        log "Open5GS already installed"
    fi
    
    # Check if already configured (unless force)
    if [ "$FORCE_RECONFIGURE" = "false" ]; then
        if systemctl is-active --quiet open5gs-mmed 2>/dev/null && \
           [ -f "$OPEN5GS_CONFIG_DIR/mme.yaml" ] && \
           [ -f "/etc/freeDiameter/mme.conf" ]; then
            log "Open5GS already configured and running - skipping reconfiguration"
            log "Use --force flag to force reconfiguration"
        else
            FORCE_RECONFIGURE=true
        fi
    fi
    
    if [ "$FORCE_RECONFIGURE" = "true" ]; then
        log "Configuring Open5GS EPC..."
        
        # Configure MME
        if [ -f "$OPEN5GS_CONFIG_DIR/mme.yaml" ]; then
            log "Setting PLMN identity (MCC: $MCC, MNC: $MNC, TAC: $TAC)..."
            sed -i "s/mcc:.*/mcc: $MCC/" "$OPEN5GS_CONFIG_DIR/mme.yaml"
            sed -i "s/mnc:.*/mnc: $MNC/" "$OPEN5GS_CONFIG_DIR/mme.yaml"
            sed -i "s/tac:.*/tac: $TAC/" "$OPEN5GS_CONFIG_DIR/mme.yaml"
            log "✅ MME configured"
        fi
        
        # Configure FreeDiameter for central HSS
        log "Configuring Diameter connection to central HSS..."
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
ConnectPeer = "hss.${REALM}" { ConnectTo = "${CENTRAL_HSS}"; Port = 3868; };
DIAMEOF
        log "✅ Diameter configured to connect to $CENTRAL_HSS"
        
        # Disable local HSS and PCRF
        log "Disabling local HSS and PCRF (using central services)..."
        for svc in open5gs-hssd open5gs-pcrfd; do
            systemctl stop $svc 2>/dev/null || true
            systemctl disable $svc 2>/dev/null || true
            systemctl mask $svc 2>/dev/null || true
        done
        log "✅ Local HSS/PCRF disabled"
        
        # Configure SMF for central PCRF
        if [ -f "$OPEN5GS_CONFIG_DIR/smf.yaml" ]; then
            log "Configuring SMF for central PCRF..."
            sed -i "s/127.0.0.7/${CENTRAL_HSS}/g" "$OPEN5GS_CONFIG_DIR/smf.yaml" 2>/dev/null || true
            log "✅ SMF configured for central PCRF"
        fi
        
        # Start EPC services
        log "Starting EPC services..."
        for svc in open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
            systemctl enable $svc 2>/dev/null || true
            systemctl restart $svc 2>/dev/null || true
            sleep 1
        done
        log "✅ EPC services started"
    fi
else
    log "Step 4: Open5GS EPC not enabled (skipping)"
fi

# ============================================================================
# Step 5: Configure SNMP Agent (if enabled)
# ============================================================================
if [ "$ENABLE_SNMP" = "true" ] || [ "$FORCE_RECONFIGURE" = "true" ]; then
    log "Step 5: Configuring SNMP agent..."
    
    # Install SNMP if not installed
    if ! command -v snmpd &>/dev/null; then
        log "Installing SNMP packages..."
        apt-get update -qq
        apt-get install -y snmpd snmp
        log "✅ SNMP packages installed"
    else
        log "SNMP already installed"
    fi
    
    # Configure SNMP
    SNMP_CONF="/etc/snmp/snmpd.conf"
    SNMP_COMMUNITY="${SNMP_COMMUNITY:-public}"
    SNMP_LOCATION="${SNMP_LOCATION:-WISPTools EPC}"
    SNMP_CONTACT="${SNMP_CONTACT:-admin@example.com}"
    
    # Backup original config
    [ -f "$SNMP_CONF" ] && cp "$SNMP_CONF" "$SNMP_CONF.bak"
    
    # Create SNMP configuration
    cat > "$SNMP_CONF" << SNMPCONFEOF
# WISPTools SNMP Configuration
# Generated: $(date)

# System info
sysLocation    $SNMP_LOCATION
sysContact     $SNMP_CONTACT
sysServices    72

# Access control
rocommunity $SNMP_COMMUNITY default

# Disk monitoring
disk / 10%
disk /var 10%

# Load monitoring
load 12 10 5

# Process monitoring (remote EPC - no HSS)
proc sshd
proc open5gs-mmed 1 1
proc open5gs-smfd 1 1

# Extend scripts for custom OIDs
extend epc-status /opt/wisptools/snmp-epc-status.sh
extend device-code /bin/cat $CONFIG_DIR/device-code.env

# AgentX for sub-agents
master agentx
agentXSocket /var/agentx/master

# Logging
dontLogTCPWrappersConnects yes
SNMPCONFEOF
    
    # Create EPC status script for SNMP
    mkdir -p /opt/wisptools
    cat > /opt/wisptools/snmp-epc-status.sh << 'STATUSEOF'
#!/bin/bash
# Check Open5GS services status (remote EPC - no HSS/PCRF)
SERVICES="open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd"
STATUS="OK"
for svc in $SERVICES; do
    if ! systemctl is-active --quiet $svc 2>/dev/null; then
        STATUS="DEGRADED: $svc down"
        break
    fi
done
echo "$STATUS"
STATUSEOF
    chmod +x /opt/wisptools/snmp-epc-status.sh
    
    # Enable and start SNMP
    systemctl enable snmpd
    systemctl restart snmpd
    log "✅ SNMP agent configured and running"
else
    log "Step 5: SNMP not enabled (skipping)"
fi

# ============================================================================
# Step 6: Install SNMP Discovery Scripts
# ============================================================================
log "Step 6: Installing SNMP discovery scripts..."

mkdir -p /opt/wisptools

# Download Node.js SNMP discovery script
curl -fsSL "https://${CENTRAL_HSS}/downloads/scripts/epc-snmp-discovery.js" -o /opt/wisptools/epc-snmp-discovery.js
chmod +x /opt/wisptools/epc-snmp-discovery.js 2>/dev/null || true

# Download bash SNMP discovery script (fallback)
curl -fsSL "https://${CENTRAL_HSS}/downloads/scripts/epc-snmp-discovery.sh" -o /opt/wisptools/epc-snmp-discovery.sh
chmod +x /opt/wisptools/epc-snmp-discovery.sh 2>/dev/null || true

# Download npm package installer
curl -fsSL "https://${CENTRAL_HSS}/downloads/scripts/install-epc-npm-packages.sh" -o /opt/wisptools/install-epc-npm-packages.sh
chmod +x /opt/wisptools/install-epc-npm-packages.sh 2>/dev/null || true

log "✅ SNMP discovery scripts installed"

# ============================================================================
# Step 7: Mark Device as Configured
# ============================================================================
log "Step 7: Marking device as configured..."

touch /var/lib/wisptools/.configured
systemctl disable wisptools-startup.service 2>/dev/null || true

log "✅ Device marked as configured"

# ============================================================================
# Step 8: Verify Services Status
# ============================================================================
log "Step 8: Verifying services status..."

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    Service Status Report                         ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Check-in agent
if systemctl is-active --quiet wisptools-checkin 2>/dev/null; then
    echo "✅ Check-in Agent:     RUNNING"
else
    echo "❌ Check-in Agent:     NOT RUNNING"
fi

# Open5GS services
if [ "$ENABLE_EPC" = "true" ] || [ "$FORCE_RECONFIGURE" = "true" ]; then
    for svc in open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
        if systemctl is-active --quiet $svc 2>/dev/null; then
            echo "✅ $svc: RUNNING"
        else
            echo "❌ $svc: NOT RUNNING"
        fi
    done
    
    # Verify HSS/PCRF are disabled
    for svc in open5gs-hssd open5gs-pcrfd; do
        if systemctl is-enabled --quiet $svc 2>/dev/null; then
            echo "⚠️  $svc: ENABLED (should be disabled - using central)"
        else
            echo "✅ $svc: DISABLED (correct - using central)"
        fi
    done
fi

# SNMP agent
if [ "$ENABLE_SNMP" = "true" ] || [ "$FORCE_RECONFIGURE" = "true" ]; then
    if systemctl is-active --quiet snmpd 2>/dev/null; then
        echo "✅ SNMP Agent:         RUNNING"
    else
        echo "❌ SNMP Agent:         NOT RUNNING"
    fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    Device Information                           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Device Code:     $DEVICE_CODE"
echo "EPC ID:          ${EPC_ID:-not registered}"
echo "IP Address:      $IP_ADDR"
echo "Central HSS:     $CENTRAL_HSS"
if [ -n "$EPC_ID" ] && [ "$EPC_ID" != "null" ]; then
    echo "Registration:    ✅ Registered"
else
    echo "Registration:    ⚠️  Not registered - register in portal"
fi
echo ""

# ============================================================================
# Step 9: Test Connectivity
# ============================================================================
log "Step 9: Testing connectivity..."

# Test check-in
log "Testing check-in with central server..."
TEST_RESPONSE=$(curl -s -X POST "https://${CENTRAL_HSS}:${HSS_PORT}/api/epc/checkin" \
    -H "Content-Type: application/json" \
    -d "{\"device_code\":\"$DEVICE_CODE\",\"hardware_id\":\"$HARDWARE_ID\",\"ip_address\":\"$IP_ADDR\"}" 2>/dev/null) || true

if echo "$TEST_RESPONSE" | jq -e '.status == "ok"' &>/dev/null; then
    echo "✅ Check-in:           SUCCESS"
else
    echo "❌ Check-in:           FAILED"
    echo "   Response: $TEST_RESPONSE"
fi

# Test SNMP (if enabled)
if [ "$ENABLE_SNMP" = "true" ] && command -v snmpget &>/dev/null; then
    if snmpget -v2c -c public localhost 1.3.6.1.2.1.1.1.0 &>/dev/null; then
        echo "✅ SNMP:               RESPONDING"
    else
        echo "❌ SNMP:               NOT RESPONDING"
    fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║     ✅ Device Setup Complete!                                     ║"
echo "║                                                                  ║"
echo "║     Log file: $LOG"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

log "Device setup complete!"

