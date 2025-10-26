#!/bin/bash
# WISPTools.io Auto-Registration Script
# Runs on first boot of minimal Ubuntu 24.04 deployment disc
# Registers system with wisptools.io and deploys EPC components

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
WISPTOOLS_API_URL="https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy"
REGISTRATION_MARKER="/var/lib/wisptools/.registered"
CREDENTIALS_FILE="/etc/wisptools/credentials.env"
CONFIG_DIR="/etc/wisptools"
LOG_FILE="/var/log/wisptools-register.log"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

print_header() {
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}     $1${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════${NC}"
}

print_status() {
    echo -e "${CYAN}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if already registered
if [ -f "$REGISTRATION_MARKER" ]; then
    log "System already registered. Exiting."
    print_success "System already registered with wisptools.io"
    exit 0
fi

print_header "WISPTools.io Auto-Registration"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root"
    exit 1
fi

# Create config directory
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
mkdir -p "$(dirname $REGISTRATION_MARKER)"

# Get Tenant ID
print_status "Checking for tenant configuration..."
TENANT_ID=""

# Check for embedded tenant ID
if [ -f "$CONFIG_DIR/tenant.conf" ]; then
    source "$CONFIG_DIR/tenant.conf"
    if [ -n "$WISPTOOLS_TENANT_ID" ]; then
        TENANT_ID="$WISPTOOLS_TENANT_ID"
        print_success "Found embedded tenant ID: $TENANT_ID"
    fi
fi

# Check kernel command line for tenant ID (can be passed at boot)
if [ -z "$TENANT_ID" ]; then
    CMDLINE_TENANT=$(grep -oP 'wisptools_tenant=\K[^\s]+' /proc/cmdline 2>/dev/null || echo "")
    if [ -n "$CMDLINE_TENANT" ]; then
        TENANT_ID="$CMDLINE_TENANT"
        print_success "Found tenant ID from boot parameters: $TENANT_ID"
        # Save for future boots
        echo "WISPTOOLS_TENANT_ID=$TENANT_ID" > "$CONFIG_DIR/tenant.conf"
        chmod 600 "$CONFIG_DIR/tenant.conf"
    fi
fi

# If no tenant ID found, use default for testing (can be overridden)
if [ -z "$TENANT_ID" ]; then
    # For automated deployment, we need a tenant ID
    # This should be set during ISO creation or boot parameters
    print_error "No tenant ID configured"
    print_error "This system cannot auto-register without a tenant ID"
    print_status "Please create boot disc with embedded tenant ID:"
    print_status "  sudo bash scripts/deployment/build-minimal-iso.sh YOUR_TENANT_ID"
    
    # Allow manual entry as fallback
    if [ -t 0 ]; then
        # Interactive terminal available
        echo ""
        echo "Or enter your WISPTools.io Tenant ID now:"
        echo "(Find this in wisptools.io dashboard under Settings > Tenant Info)"
        echo ""
        read -p "Tenant ID: " TENANT_ID
        
        if [ -z "$TENANT_ID" ]; then
            print_error "Tenant ID is required for registration"
            exit 1
        fi
        
        # Save tenant ID for future use
        echo "WISPTOOLS_TENANT_ID=$TENANT_ID" > "$CONFIG_DIR/tenant.conf"
        chmod 600 "$CONFIG_DIR/tenant.conf"
    else
        # Non-interactive - cannot proceed
        print_error "Cannot proceed without tenant ID in non-interactive mode"
        exit 1
    fi
fi

# Collect hardware information
print_header "Hardware Detection"

print_status "Detecting hardware..."

# System UUID (most reliable)
HARDWARE_ID=""
if [ -f /sys/class/dmi/id/product_uuid ]; then
    HARDWARE_ID=$(cat /sys/class/dmi/id/product_uuid 2>/dev/null || echo "")
fi

# Fallback to MAC-based ID if no UUID
if [ -z "$HARDWARE_ID" ]; then
    HARDWARE_ID=$(ip link show | grep ether | head -1 | awk '{print $2}' | tr -d ':')
fi

# MAC Address
MAC_ADDRESS=$(ip link show | grep ether | head -1 | awk '{print $2}')

# Serial Number
SERIAL=$(dmidecode -s system-serial-number 2>/dev/null || echo "unknown")

# System Info
MANUFACTURER=$(dmidecode -s system-manufacturer 2>/dev/null || echo "unknown")
PRODUCT=$(dmidecode -s system-product-name 2>/dev/null || echo "unknown")

print_success "Hardware ID: $HARDWARE_ID"
print_success "MAC Address: $MAC_ADDRESS"
print_success "Serial: $SERIAL"
print_success "System: $MANUFACTURER $PRODUCT"

# Detect network configuration
print_header "Network Detection"

print_status "Detecting network configuration..."

# Wait for network to be ready
MAX_WAIT=60
WAIT_COUNT=0
while ! ip route | grep -q default && [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    print_status "Waiting for network... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
done

if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
    print_error "Network not available after $MAX_WAIT seconds"
    exit 1
fi

# Get primary interface
PRIMARY_IFACE=$(ip route | grep default | awk '{print $5}' | head -1)
PRIMARY_IP=$(ip addr show "$PRIMARY_IFACE" | grep "inet " | awk '{print $2}' | cut -d/ -f1)
GATEWAY=$(ip route | grep default | awk '{print $3}' | head -1)
NETMASK=$(ip addr show "$PRIMARY_IFACE" | grep "inet " | awk '{print $2}' | cut -d/ -f2)

# DNS servers
DNS_SERVERS=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}' | tr '\n' ',' | sed 's/,$//')

print_success "Interface: $PRIMARY_IFACE"
print_success "IP Address: $PRIMARY_IP/$NETMASK"
print_success "Gateway: $GATEWAY"
print_success "DNS: $DNS_SERVERS"

# Test internet connectivity
print_status "Testing internet connectivity..."
if curl -s --connect-timeout 5 https://www.google.com > /dev/null; then
    print_success "Internet connectivity verified"
else
    print_error "No internet connectivity"
    exit 1
fi

# Prepare registration payload
print_header "Registering with WISPTools.io"

HOSTNAME=$(hostname)
OS_VERSION=$(lsb_release -d | cut -f2)
KERNEL_VERSION=$(uname -r)
BOOT_TIME=$(date -Iseconds)

PAYLOAD=$(cat <<EOF
{
  "hardware_id": "$HARDWARE_ID",
  "mac_address": "$MAC_ADDRESS",
  "serial_number": "$SERIAL",
  "system_info": {
    "manufacturer": "$MANUFACTURER",
    "product": "$PRODUCT",
    "hostname": "$HOSTNAME"
  },
  "network": {
    "primary_ip": "$PRIMARY_IP",
    "gateway": "$GATEWAY",
    "interface": "$PRIMARY_IFACE",
    "netmask": "$NETMASK",
    "dns_servers": "$DNS_SERVERS"
  },
  "os_info": {
    "os_version": "$OS_VERSION",
    "kernel_version": "$KERNEL_VERSION"
  },
  "boot_time": "$BOOT_TIME",
  "auto_provision": true
}
EOF
)

log "Registration payload prepared"

# Send registration request
print_status "Sending registration request..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "$WISPTOOLS_API_URL/api/epc/auto-register" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: $TENANT_ID" \
    -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" != "200" ]; then
    print_error "Registration failed (HTTP $HTTP_CODE)"
    log "Response: $RESPONSE_BODY"
    echo "$RESPONSE_BODY"
    exit 1
fi

print_success "Registration successful!"
log "Registration response: $RESPONSE_BODY"

# Parse response
EPC_ID=$(echo "$RESPONSE_BODY" | jq -r '.epc_id')
AUTH_CODE=$(echo "$RESPONSE_BODY" | jq -r '.auth_code')
API_KEY=$(echo "$RESPONSE_BODY" | jq -r '.api_key')
SECRET_KEY=$(echo "$RESPONSE_BODY" | jq -r '.secret_key')
SITE_NAME=$(echo "$RESPONSE_BODY" | jq -r '.site_name')
DEPLOYMENT_SCRIPT_URL=$(echo "$RESPONSE_BODY" | jq -r '.deployment_script_url')

if [ -z "$EPC_ID" ] || [ "$EPC_ID" = "null" ]; then
    print_error "Failed to parse registration response"
    log "Response: $RESPONSE_BODY"
    exit 1
fi

print_success "EPC ID: $EPC_ID"
print_success "Site Name: $SITE_NAME"

# Save credentials
print_status "Saving credentials..."

cat > "$CREDENTIALS_FILE" <<EOF
# WISPTools.io EPC Credentials
# Generated: $(date)
# DO NOT SHARE THESE CREDENTIALS

EPC_ID="$EPC_ID"
EPC_AUTH_CODE="$AUTH_CODE"
EPC_API_KEY="$API_KEY"
EPC_SECRET_KEY="$SECRET_KEY"
EPC_SITE_NAME="$SITE_NAME"
EPC_TENANT_ID="$TENANT_ID"
EPC_API_URL="$WISPTOOLS_API_URL"

# Export for use in deployment scripts
export EPC_ID
export EPC_AUTH_CODE
export EPC_API_KEY
export EPC_SECRET_KEY
export EPC_SITE_NAME
export EPC_TENANT_ID
export EPC_API_URL
EOF

chmod 600 "$CREDENTIALS_FILE"
print_success "Credentials saved to $CREDENTIALS_FILE"

# Download and execute deployment script
if [ -n "$DEPLOYMENT_SCRIPT_URL" ] && [ "$DEPLOYMENT_SCRIPT_URL" != "null" ]; then
    print_header "Downloading Deployment Script"
    
    DEPLOY_SCRIPT="/tmp/wisptools-deploy-epc.sh"
    
    print_status "Downloading from: $WISPTOOLS_API_URL$DEPLOYMENT_SCRIPT_URL"
    
    if curl -s -o "$DEPLOY_SCRIPT" "$WISPTOOLS_API_URL$DEPLOYMENT_SCRIPT_URL"; then
        print_success "Deployment script downloaded"
        
        chmod +x "$DEPLOY_SCRIPT"
        
        print_header "Executing Deployment Script"
        echo ""
        
        # Source credentials for deployment script
        source "$CREDENTIALS_FILE"
        
        # Execute deployment
        if bash "$DEPLOY_SCRIPT"; then
            print_success "Deployment completed successfully"
        else
            print_error "Deployment script failed"
            log "Deployment script failed with exit code $?"
            # Don't exit - mark as registered anyway
        fi
    else
        print_error "Failed to download deployment script"
        log "Failed to download from: $WISPTOOLS_API_URL$DEPLOYMENT_SCRIPT_URL"
    fi
else
    print_warning "No deployment script URL provided"
    print_status "Manual deployment may be required"
fi

# Mark as registered
touch "$REGISTRATION_MARKER"
chmod 600 "$REGISTRATION_MARKER"

print_header "Registration Complete"
print_success "System registered with wisptools.io"
print_success "EPC ID: $EPC_ID"
print_success "Site: $SITE_NAME"
echo ""
print_status "System is now managed by wisptools.io"
print_status "Metrics agent will start automatically"
echo ""

log "Registration completed successfully"

exit 0

