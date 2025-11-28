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

# Check if we have existing registration data first
if [ -f "$CONFIG_DIR/registration.json" ]; then
    log "Found existing registration data, loading..."
    EXISTING_RESPONSE=$(cat "$CONFIG_DIR/registration.json")
    EXISTING_EPC_ID=$(echo "$EXISTING_RESPONSE" | jq -r '.epc_id // empty' 2>/dev/null)
    
    if [ -n "$EXISTING_EPC_ID" ] && [ "$EXISTING_EPC_ID" != "null" ]; then
        log "Found existing EPC ID in registration data: $EXISTING_EPC_ID"
        RESPONSE="$EXISTING_RESPONSE"
    fi
fi

# Attempt check-in with central server
if [ -z "$RESPONSE" ] || [ -z "$(echo "$RESPONSE" | jq -r '.epc_id // empty' 2>/dev/null)" ]; then
    log "Attempting check-in with central server..."
    RESPONSE=$(curl -s -X POST "https://${CENTRAL_HSS}:${HSS_PORT}/api/epc/checkin" \
        -H "Content-Type: application/json" \
        -d "{\"device_code\":\"$DEVICE_CODE\",\"hardware_id\":\"$HARDWARE_ID\",\"ip_address\":\"$IP_ADDR\"}" 2>&1) || true
    
    # Check for curl errors
    if echo "$RESPONSE" | grep -q "curl:"; then
        log "⚠️  Error connecting to server: $RESPONSE"
        RESPONSE="{}"
    fi
fi

# Parse response
EPC_ID=$(echo "$RESPONSE" | jq -r '.epc_id // empty' 2>/dev/null)
STATUS=$(echo "$RESPONSE" | jq -r '.status // empty' 2>/dev/null)
CHECKIN_TOKEN=$(echo "$RESPONSE" | jq -r '.checkin_token // empty' 2>/dev/null)
CONFIG=$(echo "$RESPONSE" | jq -r '.config // {}' 2>/dev/null)
ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // .message // empty' 2>/dev/null)

# Debug: Show response if not successful
if [ -z "$EPC_ID" ] || [ "$EPC_ID" = "null" ] || [ "$STATUS" != "ok" ]; then
    log "Check-in response: $RESPONSE"
    
    if [ -n "$ERROR_MSG" ]; then
        log "Error from server: $ERROR_MSG"
    fi
    
    if [ "$STATUS" = "unregistered" ]; then
        log "⚠️  Device code not found in database"
        log "   Device Code: $DEVICE_CODE"
        log "   Please register this device in the WISPTools Portal:"
        log "   1. Go to HSS Management → Remote EPCs"
        log "   2. Click 'Add EPC' or find existing EPC"
        log "   3. Enter device code: $DEVICE_CODE"
    else
        log "⚠️  Device not registered on server yet"
        log "   Status: ${STATUS:-unknown}"
        log "   Device Code: $DEVICE_CODE"
    fi
fi

# Check if device is registered
if [ -n "$EPC_ID" ] && [ "$EPC_ID" != "null" ] && [ "$STATUS" = "ok" ]; then
    log "✅ Device is registered (EPC ID: $EPC_ID)"
    
    # Save registration data
    mkdir -p "$CONFIG_DIR"
    echo "$RESPONSE" > "$CONFIG_DIR/registration.json"
    chmod 600 "$CONFIG_DIR/registration.json"
    
    # Extract configuration - try multiple paths
    ENABLE_EPC=$(echo "$CONFIG" | jq -r '.enable_epc // false' 2>/dev/null)
    ENABLE_SNMP=$(echo "$CONFIG" | jq -r '.enable_snmp // .snmp_enabled // false' 2>/dev/null)
    
    # Get network configuration - try multiple paths in response
    MCC=$(echo "$RESPONSE" | jq -r '.config.hss_config.mcc // .config.network_config.mcc // .hss_config.mcc // .network_config.mcc // "001"' 2>/dev/null)
    MNC=$(echo "$RESPONSE" | jq -r '.config.hss_config.mnc // .config.network_config.mnc // .hss_config.mnc // .network_config.mnc // "01"' 2>/dev/null)
    TAC=$(echo "$RESPONSE" | jq -r '.config.network_config.tac // .network_config.tac // "1"' 2>/dev/null)
    REALM=$(echo "$RESPONSE" | jq -r '.config.hss_config.diameter_realm // .hss_config.diameter_realm // "wisptools.io"' 2>/dev/null)
    
    # If still no config, try reading from existing config files
    if [ "$MCC" = "001" ] && [ "$MNC" = "01" ] && [ -f "$CONFIG_DIR/config.env" ]; then
        source "$CONFIG_DIR/config.env" 2>/dev/null || true
        MCC="${MCC:-001}"
        MNC="${MNC:-01}"
        TAC="${TAC:-1}"
        REALM="${REALM:-wisptools.io}"
    fi
    
    log "Configuration: MCC=$MCC, MNC=$MNC, TAC=$TAC, EPC=$ENABLE_EPC, SNMP=$ENABLE_SNMP"
else
    log "⚠️  Device not registered - will continue with minimal setup"
    
    # Try to use existing config if available
    if [ -f "$CONFIG_DIR/config.env" ]; then
        source "$CONFIG_DIR/config.env" 2>/dev/null || true
        ENABLE_EPC="${ENABLE_EPC:-false}"
        ENABLE_SNMP="${ENABLE_SNMP:-false}"
        MCC="${MCC:-001}"
        MNC="${MNC:-01}"
        TAC="${TAC:-1}"
        REALM="${REALM:-wisptools.io}"
        log "Using existing configuration from config.env"
    else
        ENABLE_EPC=false
        ENABLE_SNMP=false
        MCC="001"
        MNC="01"
        TAC="1"
        REALM="wisptools.io"
    fi
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

# Install Node.js and npm if not installed (needed for CDP/LLDP discovery)
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    log "Installing Node.js and npm for SNMP discovery (required for CDP/LLDP support)..."
    
    # Detect OS for correct Node.js installation
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        case "$ID" in
            ubuntu|debian)
                # Install Node.js 18.x LTS
                curl -fsSL https://deb.nodesource.com/setup_18.x | bash - 2>/dev/null || {
                    log "WARNING: Failed to install Node.js from NodeSource, trying system package..."
                    apt-get update -qq
                    apt-get install -y nodejs npm 2>/dev/null || log "WARNING: Could not install Node.js"
                }
                apt-get install -y nodejs 2>/dev/null || log "WARNING: Node.js installation may have failed"
                ;;
            *)
                log "WARNING: Unsupported OS for automatic Node.js installation"
                log "   Please install Node.js manually if you need CDP/LLDP discovery"
                ;;
        esac
    fi
    
    # Verify installation
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        log "✅ Node.js $(node --version) and npm $(npm --version) installed"
    else
        log "⚠️  Node.js/npm not installed - SNMP discovery will use bash fallback (no CDP/LLDP)"
    fi
else
    log "Node.js $(node --version) and npm $(npm --version) already installed"
fi

# Download Node.js SNMP discovery script
curl -fsSL "https://${CENTRAL_HSS}/downloads/scripts/epc-snmp-discovery.js" -o /opt/wisptools/epc-snmp-discovery.js
chmod +x /opt/wisptools/epc-snmp-discovery.js 2>/dev/null || true

# Download bash SNMP discovery script (fallback)
curl -fsSL "https://${CENTRAL_HSS}/downloads/scripts/epc-snmp-discovery.sh" -o /opt/wisptools/epc-snmp-discovery.sh
chmod +x /opt/wisptools/epc-snmp-discovery.sh 2>/dev/null || true

# Download npm package installer
curl -fsSL "https://${CENTRAL_HSS}/downloads/scripts/install-epc-npm-packages.sh" -o /opt/wisptools/install-epc-npm-packages.sh
chmod +x /opt/wisptools/install-epc-npm-packages.sh 2>/dev/null || true

# Install npm packages if Node.js is available
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 && [ -f /opt/wisptools/epc-snmp-discovery.js ]; then
    log "Installing npm packages for SNMP discovery (ping-scanner, net-snmp)..."
    cd /opt/wisptools
    
    # Initialize package.json if needed
    if [ ! -f "package.json" ]; then
        npm init -y >/dev/null 2>&1 || true
    fi
    
    # Install required packages
    npm install --no-save ping-scanner net-snmp >/dev/null 2>&1 || {
        log "⚠️  Failed to install npm packages - CDP/LLDP discovery may not work"
        log "   Running installer script manually..."
        bash /opt/wisptools/install-epc-npm-packages.sh || true
    }
    
    log "✅ npm packages installed (CDP/LLDP discovery enabled)"
else
    log "⚠️  Node.js/npm not available - using bash fallback (limited functionality)"
fi

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

# Try to get EPC ID from multiple sources if not already set
if [ -z "$EPC_ID" ] || [ "$EPC_ID" = "null" ]; then
    # Try from registration.json
    if [ -f "$CONFIG_DIR/registration.json" ]; then
        EPC_ID=$(jq -r '.epc_id // empty' "$CONFIG_DIR/registration.json" 2>/dev/null)
    fi
    
    # Try from check-in agent cache
    if [ -z "$EPC_ID" ] || [ "$EPC_ID" = "null" ]; then
        if [ -f /tmp/epc-tenant-id ] && [ -f /tmp/epc-id ]; then
            EPC_ID=$(cat /tmp/epc-id 2>/dev/null)
        fi
    fi
fi

echo "Device Code:     $DEVICE_CODE"
if [ -n "$EPC_ID" ] && [ "$EPC_ID" != "null" ] && [ "$EPC_ID" != "" ]; then
    echo "EPC ID:          $EPC_ID"
    echo "Registration:    ✅ Registered"
else
    echo "EPC ID:          (not found in database)"
    echo "Registration:    ⚠️  Not registered"
    echo ""
    echo "To register this device:"
    echo "  1. Go to https://wisptools-production.web.app"
    echo "  2. Navigate to: HSS Management → Remote EPCs"
    echo "  3. Click 'Add EPC' or find existing EPC"
    echo "  4. Enter Device Code: $DEVICE_CODE"
    echo ""
    echo "The device will automatically configure after registration."
fi
echo "IP Address:      $IP_ADDR"
echo "Central HSS:     $CENTRAL_HSS"
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

