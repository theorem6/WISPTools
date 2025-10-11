#!/bin/bash

################################################################################
# Simple Multi-Tenant GenieACS Installation
# Copy this entire script and paste into your SSH session
################################################################################

echo "Creating installation script..."

cat > /tmp/install-genieacs-mt.sh << 'EOFSCRIPT'
#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GenieACS Multi-Tenant Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get configuration
read -p "MongoDB Connection URI: " MONGODB_URI
read -p "External Domain/IP: " EXTERNAL_DOMAIN
EXTERNAL_IP=$(curl -s ifconfig.me || echo "unknown")

echo ""
echo "Configuration:"
echo "  MongoDB: ${MONGODB_URI:0:40}..."
echo "  Domain: $EXTERNAL_DOMAIN"
echo "  External IP: $EXTERNAL_IP"
echo ""

read -p "Continue? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "Cancelled"
    exit 1
fi

# Install GenieACS
echo -e "${GREEN}[1/7]${NC} Installing GenieACS..."
sudo npm install -g genieacs || { echo "Failed to install GenieACS"; exit 1; }

# Create directories
echo -e "${GREEN}[2/7]${NC} Creating directories..."
sudo mkdir -p /opt/genieacs/{ext/{provisions,virtual-parameters,extensions},config,firmware,logs}
sudo chown -R $USER:$USER /opt/genieacs

# Create config
echo -e "${GREEN}[3/7]${NC} Creating configuration..."
cat > /opt/genieacs/config/config.json << EOF
{
  "MONGODB_CONNECTION_URL": "${MONGODB_URI}",
  "EXT_DIR": "/opt/genieacs/ext",
  "CWMP_PORT": 7547,
  "CWMP_INTERFACE": "0.0.0.0",
  "NBI_PORT": 7557,
  "NBI_INTERFACE": "0.0.0.0",
  "FS_PORT": 7567,
  "FS_INTERFACE": "0.0.0.0",
  "FS_HOSTNAME": "${EXTERNAL_DOMAIN}",
  "UI_PORT": 3000,
  "LOG_LEVEL": "info",
  "MULTI_TENANT_ENABLED": true
}
EOF

# Create virtual parameters
echo -e "${GREEN}[4/7]${NC} Creating virtual parameters..."

cat > /opt/genieacs/ext/virtual-parameters/tenant-id.js << 'EOF'
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

cat > /opt/genieacs/ext/virtual-parameters/pci.js << 'EOF'
const pci = declare("Device.Cellular.Interface.1.X_LTE_Cell.PCI", {value: now});
if (pci.value && pci.value[0]) {
  return parseInt(pci.value[0]);
}
return null;
EOF

# Create provisions
echo -e "${GREEN}[5/7]${NC} Creating provisions..."

cat > /opt/genieacs/ext/provisions/tenant-setup.js << 'EOF'
const now = Date.now();
const connectionUrl = declare("Device.ManagementServer.ConnectionRequestURL", {value: now});
if (connectionUrl.value && connectionUrl.value[0]) {
  const url = connectionUrl.value[0];
  const tenantMatch = url.match(/\/cwmp\/([a-zA-Z0-9-_]+)/);
  if (tenantMatch) {
    const tenantId = tenantMatch[1];
    declare("Tags.tenant:" + tenantId, null, {value: true});
    log("Device tagged with tenant: " + tenantId);
  }
}
declare("Device.ManagementServer.PeriodicInformEnable", {value: now}, {value: true});
declare("Device.ManagementServer.PeriodicInformInterval", {value: now}, {value: 300});
EOF

# Create systemd services
echo -e "${GREEN}[6/7]${NC} Creating systemd services..."

# CWMP Service
sudo tee /etc/systemd/system/genieacs-cwmp.service > /dev/null << EOF
[Unit]
Description=GenieACS CWMP (Multi-Tenant)
After=network.target

[Service]
Type=simple
User=$USER
Environment="GENIEACS_CWMP_PORT=7547"
Environment="GENIEACS_CWMP_INTERFACE=0.0.0.0"
Environment="GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}"
Environment="GENIEACS_EXT_DIR=/opt/genieacs/ext"
ExecStart=$(which genieacs-cwmp)
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
Environment="GENIEACS_NBI_PORT=7557"
Environment="GENIEACS_NBI_INTERFACE=0.0.0.0"
Environment="GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}"
Environment="GENIEACS_EXT_DIR=/opt/genieacs/ext"
ExecStart=$(which genieacs-nbi)
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
Environment="GENIEACS_FS_PORT=7567"
Environment="GENIEACS_FS_INTERFACE=0.0.0.0"
Environment="GENIEACS_FS_HOSTNAME=${EXTERNAL_DOMAIN}"
Environment="GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}"
Environment="GENIEACS_EXT_DIR=/opt/genieacs/ext"
ExecStart=$(which genieacs-fs)
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
ExecStart=$(which genieacs-ui)
Restart=always
RestartSec=10
StandardOutput=append:/opt/genieacs/logs/genieacs-ui.log
StandardError=append:/opt/genieacs/logs/genieacs-ui.log

[Install]
WantedBy=multi-user.target
EOF

# Start services
echo -e "${GREEN}[7/7]${NC} Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui
sudo systemctl start genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui

sleep 3

# Check status
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Installation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Service Status:"
sudo systemctl is-active genieacs-cwmp && echo "  ✓ CWMP: Running" || echo "  ✗ CWMP: Failed"
sudo systemctl is-active genieacs-nbi && echo "  ✓ NBI: Running" || echo "  ✗ NBI: Failed"
sudo systemctl is-active genieacs-fs && echo "  ✓ FS: Running" || echo "  ✗ FS: Failed"
sudo systemctl is-active genieacs-ui && echo "  ✓ UI: Running" || echo "  ✗ UI: Failed"

echo ""
echo "Endpoints:"
echo "  CWMP: http://${EXTERNAL_DOMAIN}:7547"
echo "  NBI:  http://${EXTERNAL_IP}:7557"
echo "  FS:   http://${EXTERNAL_IP}:7567"
echo "  UI:   http://${EXTERNAL_IP}:3000"
echo ""
echo "Logs:"
echo "  tail -f /opt/genieacs/logs/genieacs-cwmp.log"
echo ""
echo "CWMP URL format for tenants:"
echo "  http://${EXTERNAL_DOMAIN}:7547/cwmp/{tenant-subdomain}"
echo ""

EOFSCRIPT

chmod +x /tmp/install-genieacs-mt.sh
echo ""
echo "✅ Installation script created at: /tmp/install-genieacs-mt.sh"
echo ""
echo "To install, run:"
echo "  sudo /tmp/install-genieacs-mt.sh"
echo ""

