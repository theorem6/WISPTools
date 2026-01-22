#!/bin/bash
# Install and configure central HSS and PCRF on GCE server
# This runs the subscriber database and policy/charging functions
# Remote EPCs connect to this for subscriber auth and policy decisions

set -e

echo "======================================"
echo "Installing Central HSS + PCRF"
echo "======================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo $0"
    exit 1
fi

CENTRAL_IP=$(hostname -I | awk '{print $1}')
REALM="wisptools.io"
CONFIG_DIR="/etc/open5gs"

echo ""
echo "Configuration:"
echo "  Server IP: $CENTRAL_IP"
echo "  Realm: $REALM"
echo ""

# Step 1: Add Open5GS repository (detect OS)
echo "[1/5] Adding Open5GS repository..."

# Detect OS and use correct repository
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" == "ubuntu" ]]; then
        # Ubuntu - use Ubuntu repository
        case "$VERSION_CODENAME" in
            noble|mantic)
                REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/xUbuntu_24.04/"
                ;;
            jammy)
                REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/xUbuntu_22.04/"
                ;;
            *)
                REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/xUbuntu_22.04/"
                ;;
        esac
        echo "Detected Ubuntu $VERSION_CODENAME"
    else
        # Debian
        REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/Debian_12/"
        echo "Detected Debian"
    fi
else
    REPO_URL="https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/Debian_12/"
fi

echo "deb [trusted=yes] $REPO_URL ./" > /etc/apt/sources.list.d/open5gs.list
apt-get update -qq

# Step 2: Install Open5GS (only HSS and PCRF components)
echo "[2/5] Installing Open5GS HSS and PCRF..."
apt-get install -y --no-install-recommends open5gs

# Step 3: Configure HSS
echo "[3/5] Configuring HSS..."
if [ -f "$CONFIG_DIR/hss.yaml" ]; then
    # Configure HSS to listen on all interfaces
    sed -i "s/127.0.0.8/0.0.0.0/g" "$CONFIG_DIR/hss.yaml"
    echo "HSS configured to listen on all interfaces"
fi

# Step 4: Configure PCRF
echo "[4/5] Configuring PCRF..."
if [ -f "$CONFIG_DIR/pcrf.yaml" ]; then
    # Configure PCRF to listen on all interfaces
    sed -i "s/127.0.0.9/0.0.0.0/g" "$CONFIG_DIR/pcrf.yaml"
    echo "PCRF configured to listen on all interfaces"
fi

# Configure FreeDiameter for HSS
mkdir -p /etc/freeDiameter
cat > /etc/freeDiameter/hss.conf << EOF
# Central HSS FreeDiameter configuration
Identity = "hss.${REALM}";
Realm = "${REALM}";
Port = 3868;

# Listen on all interfaces for remote EPCs
ListenOn = "0.0.0.0";

# TLS disabled for now (can be enabled later)
TLS_Cred = "/etc/freeDiameter/hss.cert.pem", "/etc/freeDiameter/hss.key.pem";
TLS_CA = "/etc/freeDiameter/cacert.pem";
TLS_DH_File = "/etc/freeDiameter/dh.pem";

# No TLS for initial setup
No_TLS;
EOF

# Configure FreeDiameter for PCRF
cat > /etc/freeDiameter/pcrf.conf << EOF
# Central PCRF FreeDiameter configuration
Identity = "pcrf.${REALM}";
Realm = "${REALM}";
Port = 3869;

# Listen on all interfaces for remote EPCs
ListenOn = "0.0.0.0";

# No TLS for initial setup
No_TLS;
EOF

# Step 5: Start only HSS and PCRF services
echo "[5/5] Starting HSS and PCRF services..."

# Disable services that run on remote EPCs
for svc in open5gs-mmed open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
    systemctl stop $svc 2>/dev/null || true
    systemctl disable $svc 2>/dev/null || true
done

# Enable and start HSS and PCRF
for svc in open5gs-hssd open5gs-pcrfd; do
    systemctl unmask $svc 2>/dev/null || true
    systemctl enable $svc
    systemctl restart $svc
done

# Open firewall ports
echo ""
echo "Opening firewall ports..."
# Diameter ports
iptables -A INPUT -p tcp --dport 3868 -j ACCEPT 2>/dev/null || true  # HSS Diameter
iptables -A INPUT -p tcp --dport 3869 -j ACCEPT 2>/dev/null || true  # PCRF Diameter
iptables -A INPUT -p sctp --dport 3868 -j ACCEPT 2>/dev/null || true # HSS Diameter SCTP
iptables -A INPUT -p sctp --dport 3869 -j ACCEPT 2>/dev/null || true # PCRF Diameter SCTP

# Save iptables rules
iptables-save > /etc/iptables/rules.v4 2>/dev/null || true

echo ""
echo "======================================"
echo "Central HSS + PCRF Installation Complete"
echo "======================================"
echo ""
echo "Server: $CENTRAL_IP"
echo "Realm: $REALM"
echo ""
echo "Service Status:"
for svc in open5gs-hssd open5gs-pcrfd; do
    STATUS=$(systemctl is-active $svc 2>/dev/null || echo "failed")
    printf "  %-20s %s\n" "$svc:" "$STATUS"
done
echo ""
echo "Diameter Ports:"
echo "  HSS:  3868 (TCP/SCTP)"
echo "  PCRF: 3869 (TCP/SCTP)"
echo ""
echo "Remote EPCs should connect to: $CENTRAL_IP"
echo ""
echo "======================================"

