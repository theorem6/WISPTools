#!/bin/bash
# Fix Port Allocation - Complete Solution
# Moves ISO Generation API to port 3002
# Keeps HSS Management API on port 3001
#
# Usage: sudo bash fix-port-allocation.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${PURPLE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║ $(printf '%58s' "$1")${NC} ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
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

# Check root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_header "Port Allocation Fix"

echo "Current Port Allocation:"
echo "  Port 3000: GenieACS UI"
echo "  Port 3001: HSS Management API (main backend)"
echo "  Port 3002: ISO Generation API (NEW)"
echo "  Port 7547: CWMP (TR-069)"
echo "  Port 7557: GenieACS NBI"
echo "  Port 7567: GenieACS FS"
echo ""

# Step 1: Stop conflicting service
print_header "Step 1: Stop Conflicting Services"

print_status "Stopping gce-backend service..."
systemctl stop gce-backend.service 2>/dev/null || print_warning "Service not running"

# Check what's using port 3001
print_status "Checking port 3001..."
PORT_3001=$(lsof -ti:3001 2>/dev/null || echo "")
if [ -n "$PORT_3001" ]; then
    print_success "Port 3001 in use by HSS Management API (correct)"
else
    print_warning "Port 3001 not in use"
fi

# Step 2: Update GCE Backend Service to use port 3002
print_header "Step 2: Update gce-backend.service to Port 3002"

if [ -f "/etc/systemd/system/gce-backend.service" ]; then
    print_status "Backing up service file..."
    cp /etc/systemd/system/gce-backend.service /etc/systemd/system/gce-backend.service.backup
    
    print_status "Updating port to 3002..."
    sed -i 's/Environment="PORT=3001"/Environment="PORT=3002"/' /etc/systemd/system/gce-backend.service
    sed -i 's/Environment="HSS_PORT=3001"/Environment="HSS_PORT=3002"/' /etc/systemd/system/gce-backend.service
    
    print_success "gce-backend.service updated to port 3002"
else
    print_warning "gce-backend.service not found, will be created on next deployment"
fi

# Step 3: Update server.js if it exists
print_header "Step 3: Update Backend Server Files"

if [ -f "/opt/gce-backend/server.js" ]; then
    print_status "Checking /opt/gce-backend/server.js..."
    if grep -q "const PORT = process.env.PORT || 3001" /opt/gce-backend/server.js; then
        sed -i 's/const PORT = process.env.PORT || 3001/const PORT = process.env.PORT || 3002/' /opt/gce-backend/server.js
        print_success "server.js updated to default port 3002"
    else
        print_success "server.js already configured correctly"
    fi
fi

# Step 4: Ensure HSS API is on port 3001
print_header "Step 4: Verify HSS Management API (Port 3001)"

HSS_SERVICES=("hss-api" "wisptools-backend" "unified-backend")
HSS_SERVICE_FOUND=""

for service in "${HSS_SERVICES[@]}"; do
    if systemctl list-units --type=service --all | grep -q "$service.service"; then
        HSS_SERVICE_FOUND="$service"
        print_success "Found HSS service: $service.service"
        break
    fi
done

if [ -n "$HSS_SERVICE_FOUND" ]; then
    if systemctl is-active --quiet "$HSS_SERVICE_FOUND.service"; then
        print_success "$HSS_SERVICE_FOUND.service is running on port 3001"
    else
        print_warning "$HSS_SERVICE_FOUND.service is not running"
        read -p "Start it now? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            systemctl start "$HSS_SERVICE_FOUND.service"
            print_success "$HSS_SERVICE_FOUND.service started"
        fi
    fi
else
    print_warning "No HSS service found, this may need manual setup"
fi

# Step 5: Configure firewall for port 3002
print_header "Step 5: Configure Firewall"

if command -v ufw >/dev/null 2>&1; then
    print_status "Opening port 3002 in UFW..."
    ufw allow 3002/tcp comment "ISO Generation API"
    print_success "Port 3002 opened in UFW"
fi

print_status "Checking Google Cloud Firewall..."
echo "Run this command from your local machine with gcloud CLI:"
echo ""
echo "  gcloud compute firewall-rules create allow-iso-api-3002 \\"
echo "    --allow tcp:3002 \\"
echo "    --source-ranges 0.0.0.0/0 \\"
echo "    --description 'Allow ISO Generation API access' \\"
echo "    --project lte-pci-mapper-65450042-bbf71"
echo ""

# Step 6: Reload systemd and start services
print_header "Step 6: Start Services"

print_status "Reloading systemd daemon..."
systemctl daemon-reload

if [ -f "/etc/systemd/system/gce-backend.service" ]; then
    print_status "Starting gce-backend.service on port 3002..."
    systemctl enable gce-backend.service
    systemctl start gce-backend.service
    
    sleep 2
    
    if systemctl is-active --quiet gce-backend.service; then
        print_success "gce-backend.service running on port 3002"
    else
        print_error "gce-backend.service failed to start"
        print_status "Checking logs..."
        journalctl -u gce-backend.service -n 20 --no-pager
    fi
fi

# Step 7: Verify port allocation
print_header "Step 7: Verify Port Allocation"

print_status "Current port usage:"
for port in 3000 3001 3002; do
    PID=$(lsof -ti:$port 2>/dev/null || echo "")
    if [ -n "$PID" ]; then
        SERVICE=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
        print_success "Port $port: ✓ $SERVICE (PID: $PID)"
    else
        print_warning "Port $port: ✗ Not in use"
    fi
done

# Step 8: Test endpoints
print_header "Step 8: Test Endpoints"

print_status "Testing HSS API (port 3001)..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    print_success "HSS API responding on port 3001"
else
    print_warning "HSS API not responding on port 3001"
fi

print_status "Testing ISO Generation API (port 3002)..."
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    print_success "ISO Generation API responding on port 3002"
else
    print_warning "ISO Generation API not responding on port 3002"
fi

# Summary
print_header "CONFIGURATION COMPLETE"

echo ""
echo -e "${GREEN}✓ Port allocation fixed!${NC}"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}PORT ALLOCATION${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  ✓ Port 3000: GenieACS UI"
echo "  ✓ Port 3001: HSS Management API (main backend)"
echo "  ✓ Port 3002: ISO Generation API"
echo "  ✓ Port 7547: CWMP (TR-069)"
echo "  ✓ Port 7557: GenieACS NBI"
echo "  ✓ Port 7567: GenieACS FS"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}API ENDPOINTS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  HSS Management:  http://136.112.111.167:3001/api/"
echo "  ISO Generation:  http://136.112.111.167:3002/api/"
echo "  GenieACS UI:     http://136.112.111.167:3000/"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}NEXT STEPS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "1. Open port 3002 in Google Cloud Firewall (run from local machine):"
echo "   gcloud compute firewall-rules create allow-iso-api-3002 --allow tcp:3002"
echo ""
echo "2. Update frontend to use port 3002 for ISO generation"
echo ""
echo "3. Verify services:"
echo "   curl http://136.112.111.167:3001/health  # HSS API"
echo "   curl http://136.112.111.167:3002/health  # ISO API"
echo ""

exit 0

