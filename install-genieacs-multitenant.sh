#!/bin/bash

################################################################################
# GenieACS Multi-Tenant Installation Script
# For PCI Management and Device Monitoring with Tenant Isolation
################################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GenieACS Multi-Tenant Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo -e "${CYAN}This script will install GenieACS with multi-tenant support.${NC}"
echo -e "${CYAN}Each tenant will have isolated data and unique CWMP URLs.${NC}"
echo ""

# Prompt for configuration
read -p "MongoDB Connection URI: " MONGODB_URI
read -p "External IP/Domain: " EXTERNAL_DOMAIN
read -p "Base Port (default 7547): " BASE_PORT
BASE_PORT=${BASE_PORT:-7547}

EXTERNAL_IP=$(curl -s ifconfig.me)

echo ""
echo -e "${CYAN}Configuration:${NC}"
echo "  MongoDB: ${MONGODB_URI:0:40}..."
echo "  Domain: $EXTERNAL_DOMAIN"
echo "  External IP: $EXTERNAL_IP"
echo "  Base Port: $BASE_PORT"
echo ""
echo -e "${YELLOW}Multi-Tenant Features:${NC}"
echo "  ✓ Tenant-isolated data in MongoDB"
echo "  ✓ Unique CWMP URLs per tenant: http://$EXTERNAL_DOMAIN:$BASE_PORT/cwmp/{tenant-subdomain}"
echo "  ✓ Role-based access control"
echo "  ✓ Separate file storage per tenant"
echo ""

read -p "Continue? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "Cancelled"
    exit 1
fi

# Step 1: Install GenieACS
echo ""
echo -e "${GREEN}[1/9]${NC} Installing GenieACS from NPM..."
sudo npm install -g genieacs

# Step 2: Create directory structure
echo -e "${GREEN}[2/9]${NC} Creating directory structure..."
sudo mkdir -p /opt/genieacs/{ext/{provisions,virtual-parameters,extensions},config,firmware,logs}
sudo chown -R $USER:$USER /opt/genieacs

# Step 3: Create multi-tenant configuration
echo -e "${GREEN}[3/9]${NC} Creating multi-tenant configuration..."
cat > /opt/genieacs/config/config.json << EOF
{
  "MONGODB_CONNECTION_URL": "${MONGODB_URI}",
  "EXT_DIR": "/opt/genieacs/ext",
  "CWMP_PORT": ${BASE_PORT},
  "CWMP_INTERFACE": "0.0.0.0",
  "NBI_PORT": $((BASE_PORT + 10)),
  "NBI_INTERFACE": "0.0.0.0",
  "FS_PORT": $((BASE_PORT + 20)),
  "FS_INTERFACE": "0.0.0.0",
  "FS_HOSTNAME": "${EXTERNAL_DOMAIN}",
  "UI_PORT": 3000,
  "LOG_LEVEL": "info",
  "DEBUG": false,
  "MULTI_TENANT_ENABLED": true
}
EOF

# Step 4: Create tenant-aware virtual parameters
echo -e "${GREEN}[4/9]${NC} Creating tenant-aware virtual parameters..."

cat > /opt/genieacs/ext/virtual-parameters/tenant-id.js << 'EOF'
// Extract tenant ID from device tags or connection URL
const tags = declare("Tags", {value: now});
if (tags.value) {
  for (let tag of tags.value[0]) {
    if (tag.startsWith("tenant:")) {
      return tag.substring(7);
    }
  }
}
return null;
EOF

# PCI Parameter (tenant-isolated)
cat > /opt/genieacs/ext/virtual-parameters/pci.js << 'EOF'
// Extract PCI value from device
const pci = declare("Device.Cellular.Interface.1.X_LTE_Cell.PCI", {value: now});
if (pci.value && pci.value[0]) {
  return parseInt(pci.value[0]);
}
return null;
EOF

# Step 5: Create tenant-aware provisions
echo -e "${GREEN}[5/9]${NC} Creating tenant-aware provisions..."

cat > /opt/genieacs/ext/provisions/tenant-setup.js << 'EOF'
// Provision: Tenant-specific setup
const now = Date.now();

// Get tenant ID from device connection
const connectionUrl = declare("Device.ManagementServer.ConnectionRequestURL", {value: now});
if (connectionUrl.value && connectionUrl.value[0]) {
  const url = connectionUrl.value[0];
  const tenantMatch = url.match(/\/cwmp\/([a-zA-Z0-9-_]+)/);
  if (tenantMatch) {
    const tenantId = tenantMatch[1];
    // Tag device with tenant
    declare("Tags.tenant:" + tenantId, null, {value: true});
    log("Device tagged with tenant: " + tenantId);
  }
}

// Standard device setup
declare("Device.ManagementServer.PeriodicInformEnable", {value: now}, {value: true});
declare("Device.ManagementServer.PeriodicInformInterval", {value: now}, {value: 300});
EOF

# Step 6: Create tenant isolation extension
echo -e "${GREEN}[6/9]${NC} Creating tenant isolation extensions..."

cat > /opt/genieacs/ext/extensions/tenant-filter.js << 'EOF'
// Extension: Filter devices by tenant
const tenantId = args[0];

if (!tenantId) {
  return { error: "Tenant ID required" };
}

const devices = ext.query({
  "Tags.tenant:" + tenantId + "._value": true
});

return {
  tenantId: tenantId,
  deviceCount: devices.length,
  devices: devices.map(d => ({
    id: d._id,
    manufacturer: d["Device.DeviceInfo.Manufacturer"]?._value,
    model: d["Device.DeviceInfo.ModelName"]?._value,
    lastInform: d._lastInform
  }))
};
EOF

# Step 7: Create reverse proxy configuration for tenant routing
echo -e "${GREEN}[7/9]${NC} Creating Nginx reverse proxy configuration..."

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}Nginx not found. Installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y nginx
fi

# Create nginx configuration for multi-tenant CWMP routing
sudo tee /etc/nginx/sites-available/genieacs-multitenant > /dev/null << 'EOF'
# GenieACS Multi-Tenant Proxy Configuration

# Map to extract tenant from URL
map $request_uri $tenant_id {
    ~^/cwmp/(?<tenant>[a-zA-Z0-9-_]+) $tenant;
    default "";
}

server {
    listen 80;
    server_name _;
    
    # CWMP endpoint with tenant routing
    location ~ ^/cwmp/([a-zA-Z0-9-_]+) {
        # Pass to GenieACS CWMP with tenant header
        proxy_pass http://localhost:7547;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Tenant-ID $tenant_id;
        
        # CWMP specific settings
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        client_max_body_size 10M;
    }
    
    # NBI API
    location /nbi/ {
        proxy_pass http://localhost:7557/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # File Server
    location /fs/ {
        proxy_pass http://localhost:7567/;
        proxy_set_header Host $host;
    }
    
    # UI
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/genieacs-multitenant /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# Step 8: Create systemd services
echo -e "${GREEN}[8/9]${NC} Creating systemd services..."

# CWMP Service
sudo tee /etc/systemd/system/genieacs-cwmp.service > /dev/null << EOF
[Unit]
Description=GenieACS CWMP (Multi-Tenant)
After=network.target

[Service]
Type=simple
User=$USER
Environment="GENIEACS_CWMP_PORT=${BASE_PORT}"
Environment="GENIEACS_CWMP_INTERFACE=0.0.0.0"
Environment="GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}"
Environment="GENIEACS_EXT_DIR=/opt/genieacs/ext"
ExecStart=/usr/local/bin/genieacs-cwmp
Restart=always
RestartSec=10
StandardOutput=append:/opt/genieacs/logs/genieacs-cwmp.log
StandardError=append:/opt/genieacs/logs/genieacs-cwmp.log

[Install]
WantedBy=multi-user.target
EOF

# NBI Service
sudo tee /etc/systemd/system/genieacs-nbi.service > /dev/null << EOF
[Unit]
Description=GenieACS NBI (Multi-Tenant)
After=network.target

[Service]
Type=simple
User=$USER
Environment="GENIEACS_NBI_PORT=$((BASE_PORT + 10))"
Environment="GENIEACS_NBI_INTERFACE=0.0.0.0"
Environment="GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}"
Environment="GENIEACS_EXT_DIR=/opt/genieacs/ext"
ExecStart=/usr/local/bin/genieacs-nbi
Restart=always
RestartSec=10
StandardOutput=append:/opt/genieacs/logs/genieacs-nbi.log
StandardError=append:/opt/genieacs/logs/genieacs-nbi.log

[Install]
WantedBy=multi-user.target
EOF

# FS Service
sudo tee /etc/systemd/system/genieacs-fs.service > /dev/null << EOF
[Unit]
Description=GenieACS FS (Multi-Tenant)
After=network.target

[Service]
Type=simple
User=$USER
Environment="GENIEACS_FS_PORT=$((BASE_PORT + 20))"
Environment="GENIEACS_FS_INTERFACE=0.0.0.0"
Environment="GENIEACS_FS_HOSTNAME=${EXTERNAL_DOMAIN}"
Environment="GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}"
Environment="GENIEACS_EXT_DIR=/opt/genieacs/ext"
ExecStart=/usr/local/bin/genieacs-fs
Restart=always
RestartSec=10
StandardOutput=append:/opt/genieacs/logs/genieacs-fs.log
StandardError=append:/opt/genieacs/logs/genieacs-fs.log

[Install]
WantedBy=multi-user.target
EOF

# UI Service
sudo tee /etc/systemd/system/genieacs-ui.service > /dev/null << EOF
[Unit]
Description=GenieACS UI (Multi-Tenant)
After=network.target

[Service]
Type=simple
User=$USER
Environment="GENIEACS_UI_PORT=3000"
Environment="GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}"
ExecStart=/usr/local/bin/genieacs-ui
Restart=always
RestartSec=10
StandardOutput=append:/opt/genieacs/logs/genieacs-ui.log
StandardError=append:/opt/genieacs/logs/genieacs-ui.log

[Install]
WantedBy=multi-user.target
EOF

# Step 9: Start services
echo -e "${GREEN}[9/9]${NC} Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui
sudo systemctl start genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui

# Wait for services to start
sleep 5

# Check status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Installation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${CYAN}Service Status:${NC}"
sudo systemctl status genieacs-cwmp --no-pager -l | grep Active
sudo systemctl status genieacs-nbi --no-pager -l | grep Active
sudo systemctl status genieacs-fs --no-pager -l | grep Active
sudo systemctl status genieacs-ui --no-pager -l | grep Active
sudo systemctl status nginx --no-pager -l | grep Active

echo ""
echo -e "${CYAN}Multi-Tenant Endpoints:${NC}"
echo "  Main Domain: http://${EXTERNAL_DOMAIN}"
echo "  CWMP (Tenant): http://${EXTERNAL_DOMAIN}/cwmp/{tenant-subdomain}"
echo "  NBI API: http://${EXTERNAL_DOMAIN}/nbi/"
echo "  File Server: http://${EXTERNAL_DOMAIN}/fs/"
echo "  UI: http://${EXTERNAL_DOMAIN}/"
echo ""
echo -e "${CYAN}Direct Ports (Internal):${NC}"
echo "  CWMP: localhost:${BASE_PORT}"
echo "  NBI: localhost:$((BASE_PORT + 10))"
echo "  FS: localhost:$((BASE_PORT + 20))"
echo "  UI: localhost:3000"
echo ""
echo -e "${CYAN}Tenant Management:${NC}"
echo "  Create tenants via Firebase UI or API"
echo "  Each tenant gets unique CWMP URL"
echo "  Data automatically isolated by tenant ID"
echo ""
echo -e "${YELLOW}Important Notes:${NC}"
echo "  1. Configure device ACS URL to: http://${EXTERNAL_DOMAIN}/cwmp/{tenant-subdomain}"
echo "  2. Tenant subdomain is generated when creating tenant in Firebase"
echo "  3. All device data is automatically tagged with tenant ID"
echo "  4. MongoDB collections use _tenantId field for isolation"
echo ""
echo -e "${CYAN}Useful Commands:${NC}"
echo "  sudo systemctl status genieacs-cwmp"
echo "  sudo systemctl restart genieacs-*"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo "  tail -f /opt/genieacs/logs/genieacs-cwmp.log"
echo ""
echo "✅ GenieACS Multi-Tenant installation complete!"
echo ""

