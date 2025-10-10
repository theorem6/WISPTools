#!/bin/bash

################################################################################
# GenieACS Installation with LTE WISP Customizations
# For PCI Management and Device Monitoring
################################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GenieACS Installation with LTE Customizations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Prompt for configuration
read -p "MongoDB Connection URI: " MONGODB_URI
read -p "External IP/Domain: " EXTERNAL_DOMAIN
EXTERNAL_IP=$(curl -s ifconfig.me)

echo ""
echo -e "${CYAN}Configuration:${NC}"
echo "  MongoDB: ${MONGODB_URI:0:40}..."
echo "  Domain: $EXTERNAL_DOMAIN"
echo "  External IP: $EXTERNAL_IP"
echo ""

read -p "Continue? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "Cancelled"
    exit 1
fi

# Step 1: Install GenieACS
echo ""
echo -e "${GREEN}[1/8]${NC} Installing GenieACS from NPM..."
sudo npm install -g genieacs

# Step 2: Create directory structure
echo -e "${GREEN}[2/8]${NC} Creating directory structure..."
sudo mkdir -p /opt/genieacs/{ext/{provisions,virtual-parameters,extensions},config,firmware,logs}
sudo chown -R $USER:$USER /opt/genieacs

# Step 3: Create configuration
echo -e "${GREEN}[3/8]${NC} Creating configuration..."
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
  "DEBUG": false
}
EOF

# Step 4: Create LTE Virtual Parameters
echo -e "${GREEN}[4/8]${NC} Creating LTE virtual parameters..."

# PCI Parameter
cat > /opt/genieacs/ext/virtual-parameters/pci.js << 'EOF'
// Extract PCI value from device
const pci = declare("Device.Cellular.Interface.1.X_LTE_Cell.PCI", {value: now});
if (pci.value && pci.value[0]) {
  return parseInt(pci.value[0]);
}
return null;
EOF

# EARFCN Parameter
cat > /opt/genieacs/ext/virtual-parameters/earfcn.js << 'EOF'
// Extract EARFCN (LTE frequency channel)
const earfcn = declare("Device.Cellular.Interface.1.X_LTE_Cell.EARFCN", {value: now});
if (earfcn.value && earfcn.value[0]) {
  return parseInt(earfcn.value[0]);
}
return null;
EOF

# Signal Strength
cat > /opt/genieacs/ext/virtual-parameters/signal-strength.js << 'EOF'
// Get RSSI signal strength
const rssi = declare("Device.Cellular.Interface.1.X_LTE_Cell.RSSI", {value: now});
if (rssi.value && rssi.value[0]) {
  const value = parseInt(rssi.value[0]);
  return {
    rssi: value,
    quality: value > -70 ? "Excellent" : value > -85 ? "Good" : value > -100 ? "Fair" : "Poor"
  };
}
return null;
EOF

# GPS Location
cat > /opt/genieacs/ext/virtual-parameters/gps-location.js << 'EOF'
// Extract GPS coordinates
const lat = declare("Device.GPS.Latitude", {value: now});
const lon = declare("Device.GPS.Longitude", {value: now});

if (lat.value && lat.value[0] && lon.value && lon.value[0]) {
  return {
    latitude: parseFloat(lat.value[0]),
    longitude: parseFloat(lon.value[0]),
    timestamp: Date.now()
  };
}
return null;
EOF

# LTE Info Summary
cat > /opt/genieacs/ext/virtual-parameters/lte-info.js << 'EOF'
// Complete LTE information summary
const pci = declare("Device.Cellular.Interface.1.X_LTE_Cell.PCI", {value: now});
const earfcn = declare("Device.Cellular.Interface.1.X_LTE_Cell.EARFCN", {value: now});
const rssi = declare("Device.Cellular.Interface.1.X_LTE_Cell.RSSI", {value: now});
const rsrp = declare("Device.Cellular.Interface.1.X_LTE_Cell.RSRP", {value: now});
const rsrq = declare("Device.Cellular.Interface.1.X_LTE_Cell.RSRQ", {value: now});
const sinr = declare("Device.Cellular.Interface.1.X_LTE_Cell.SINR", {value: now});

return {
  pci: pci.value ? parseInt(pci.value[0]) : null,
  earfcn: earfcn.value ? parseInt(earfcn.value[0]) : null,
  rssi: rssi.value ? parseInt(rssi.value[0]) : null,
  rsrp: rsrp.value ? parseInt(rsrp.value[0]) : null,
  rsrq: rsrq.value ? parseInt(rsrq.value[0]) : null,
  sinr: sinr.value ? parseInt(sinr.value[0]) : null,
  timestamp: Date.now()
};
EOF

# Step 5: Create Provisions
echo -e "${GREEN}[5/8]${NC} Creating provisions..."

# LTE Monitoring Provision
cat > /opt/genieacs/ext/provisions/lte-monitoring.js << 'EOF'
// Provision: Enable LTE parameter monitoring
const now = Date.now();
const refreshInterval = 300000; // 5 minutes

// Refresh LTE parameters periodically
declare("Device.Cellular.Interface.1.X_LTE_Cell.PCI", {value: now}, {value: now + refreshInterval});
declare("Device.Cellular.Interface.1.X_LTE_Cell.EARFCN", {value: now}, {value: now + refreshInterval});
declare("Device.Cellular.Interface.1.X_LTE_Cell.RSSI", {value: now}, {value: now + refreshInterval});
declare("Device.Cellular.Interface.1.X_LTE_Cell.RSRP", {value: now}, {value: now + refreshInterval});
declare("Device.Cellular.Interface.1.X_LTE_Cell.RSRQ", {value: now}, {value: now + refreshInterval});
declare("Device.Cellular.Interface.1.X_LTE_Cell.SINR", {value: now}, {value: now + refreshInterval});

// GPS location
declare("Device.GPS.Latitude", {value: now}, {value: now + refreshInterval});
declare("Device.GPS.Longitude", {value: now}, {value: now + refreshInterval});

// Set inform interval to 5 minutes
declare("Device.ManagementServer.PeriodicInformInterval", {value: now}, {value: 300});

log("LTE monitoring enabled for device");
EOF

# Initial Setup Provision
cat > /opt/genieacs/ext/provisions/initial-setup.js << 'EOF'
// Provision: Initial device setup
const now = Date.now();

// Get device info
const manufacturer = declare("Device.DeviceInfo.Manufacturer", {value: now});
const model = declare("Device.DeviceInfo.ModelName", {value: now});
const serial = declare("Device.DeviceInfo.SerialNumber", {value: now});

log("Device: " + manufacturer.value[0] + " " + model.value[0] + " (" + serial.value[0] + ")");

// Enable periodic inform
declare("Device.ManagementServer.PeriodicInformEnable", {value: now}, {value: true});
declare("Device.ManagementServer.PeriodicInformInterval", {value: now}, {value: 300});

log("Initial setup complete");
EOF

# Step 6: Create Extensions
echo -e "${GREEN}[6/8]${NC} Creating extensions..."

# PCI Conflict Detection Extension
cat > /opt/genieacs/ext/extensions/check-pci-conflicts.js << 'EOF'
// Extension: Check for PCI conflicts across all devices
const devices = ext.query({
  "Device.Cellular.Interface.1.X_LTE_Cell.PCI._value": { $exists: true }
});

const pciMap = {};
const conflicts = [];

devices.forEach(device => {
  const pci = device["Device.Cellular.Interface.1.X_LTE_Cell.PCI"]?._value;
  if (pci) {
    if (pciMap[pci]) {
      conflicts.push({
        pci: parseInt(pci),
        device1: pciMap[pci],
        device2: device._id
      });
    } else {
      pciMap[pci] = device._id;
    }
  }
});

return {
  totalDevices: devices.length,
  uniquePCIs: Object.keys(pciMap).length,
  conflicts: conflicts,
  conflictCount: conflicts.length
};
EOF

# Step 7: Create systemd services
echo -e "${GREEN}[7/8]${NC} Creating systemd services..."

# CWMP Service
sudo tee /etc/systemd/system/genieacs-cwmp.service > /dev/null << EOF
[Unit]
Description=GenieACS CWMP
After=network.target

[Service]
Type=simple
User=$USER
Environment="GENIEACS_CWMP_PORT=7547"
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
Description=GenieACS NBI
After=network.target

[Service]
Type=simple
User=$USER
Environment="GENIEACS_NBI_PORT=7557"
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
Description=GenieACS FS
After=network.target

[Service]
Type=simple
User=$USER
Environment="GENIEACS_FS_PORT=7567"
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
Description=GenieACS UI
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

# Step 8: Start services
echo -e "${GREEN}[8/8]${NC} Starting services..."
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

echo ""
echo -e "${CYAN}Testing Services:${NC}"
curl -s http://localhost:7557/devices | head -c 100
echo ""

echo ""
echo -e "${CYAN}Service Endpoints:${NC}"
echo "  CWMP (TR-069): http://${EXTERNAL_IP}:7547"
echo "  NBI API: http://localhost:7557"
echo "  File Server: http://localhost:7567"
echo "  UI: http://localhost:3000"
echo ""
echo -e "${CYAN}Customizations Created:${NC}"
echo "  Virtual Parameters: /opt/genieacs/ext/virtual-parameters/"
echo "  Provisions: /opt/genieacs/ext/provisions/"
echo "  Extensions: /opt/genieacs/ext/extensions/"
echo ""
echo -e "${CYAN}Logs:${NC}"
echo "  /opt/genieacs/logs/"
echo ""
echo -e "${CYAN}Useful Commands:${NC}"
echo "  sudo systemctl status genieacs-cwmp"
echo "  sudo systemctl restart genieacs-cwmp"
echo "  curl http://localhost:7557/devices"
echo "  tail -f /opt/genieacs/logs/genieacs-cwmp.log"
echo ""
echo "✅ GenieACS with LTE customizations is running!"
echo ""

