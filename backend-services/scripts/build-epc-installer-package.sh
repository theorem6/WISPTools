#!/bin/bash
# Build wisptools-epc-installer Debian Package
# This package contains the check-in service that phones home to GCE

set -e

PACKAGE_NAME="wisptools-epc-installer"
PACKAGE_VERSION="1.0.0"
BUILD_DIR="/tmp/${PACKAGE_NAME}-build"
GCE_PUBLIC_IP="${GCE_PUBLIC_IP:-136.112.111.167}"
HSS_PORT="${HSS_PORT:-3001}"

echo "[Package Builder] Building ${PACKAGE_NAME} package..."

# Clean build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/${PACKAGE_NAME}"

# Create package directory structure
cd "$BUILD_DIR/${PACKAGE_NAME}"
mkdir -p DEBIAN usr/lib/systemd/system etc/wisptools opt/wisptools/scripts

# Create control file
cat > DEBIAN/control << CONTROL
Package: ${PACKAGE_NAME}
Version: ${PACKAGE_VERSION}
Section: admin
Priority: optional
Architecture: all
Depends: curl, wget, jq, systemd
Maintainer: WISPTools <support@wisptools.io>
Description: WISPTools EPC Installer and Check-in Service
 This package provides the check-in service that connects EPC hardware
 to the WISPTools cloud management platform.
CONTROL

# Create postinst script
cat > DEBIAN/postinst << POSTINST
#!/bin/bash
set -e

echo "Installing WISPTools EPC Installer..."

# Enable check-in service
systemctl daemon-reload
systemctl enable wisptools-epc-checkin.service

# Start check-in service (will run on next boot if network is ready)
if systemctl is-active --quiet network-online.target; then
  systemctl start wisptools-epc-checkin.service || true
fi

echo "WISPTools EPC Installer installed successfully"
POSTINST

chmod +x DEBIAN/postinst

# Create check-in service script
cat > opt/wisptools/scripts/checkin.sh << CHECKIN
#!/bin/bash
# WISPTools EPC Check-in Service
# Phones home to GCE server to get EPC configuration

set -e

GCE_SERVER="${GCE_PUBLIC_IP}"
HSS_PORT="${HSS_PORT}"
CHECKIN_URL="http://\${GCE_SERVER}:\${HSS_PORT}/api/epc/checkin"

# Get hardware identifier (MAC address of first network interface)
HW_ID=\$(ip link show | grep -A1 "^[0-9]*: en" | grep "link/ether" | head -1 | awk '{print \$2}' | tr -d ':')

if [ -z "\$HW_ID" ]; then
  echo "[Check-in] ERROR: Could not determine hardware ID"
  exit 1
fi

echo "[Check-in] Hardware ID: \$HW_ID"
echo "[Check-in] Connecting to GCE server: \${GCE_SERVER}:\${HSS_PORT}"

# Check in with hardware ID
RESPONSE=\$(curl -s -X POST "\${CHECKIN_URL}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"hardware_id\\": \\"\${HW_ID}\\"}" || echo "ERROR")

if [ "\$RESPONSE" = "ERROR" ] || [ -z "\$RESPONSE" ]; then
  echo "[Check-in] ERROR: Failed to connect to GCE server"
  exit 1
fi

# Parse response
EPC_ID=\$(echo "\$RESPONSE" | jq -r '.epc_id // empty')
CHECKIN_TOKEN=\$(echo "\$RESPONSE" | jq -r '.checkin_token // empty')
APT_REPO_URL=\$(echo "\$RESPONSE" | jq -r '.apt_repo_url // empty')

if [ -z "\$EPC_ID" ] || [ -z "\$CHECKIN_TOKEN" ]; then
  echo "[Check-in] ERROR: Invalid response from server"
  echo "[Check-in] Response: \$RESPONSE"
  exit 1
fi

echo "[Check-in] EPC ID: \$EPC_ID"
echo "[Check-in] Check-in token received"

# Save EPC configuration
mkdir -p /etc/wisptools
cat > /etc/wisptools/epc-config.env << CONFIG
EPC_ID=\${EPC_ID}
CHECKIN_TOKEN=\${CHECKIN_TOKEN}
GCE_SERVER=\${GCE_SERVER}
HSS_PORT=\${HSS_PORT}
APT_REPO_URL=\${APT_REPO_URL}
CONFIG

chmod 600 /etc/wisptools/epc-config.env

# Download and run EPC deployment script
echo "[Check-in] Downloading EPC deployment script..."
DEPLOY_URL="http://\${GCE_SERVER}:\${HSS_PORT}/api/epc/\${EPC_ID}/deploy?checkin_token=\${CHECKIN_TOKEN}"

curl -s "\${DEPLOY_URL}" -o /tmp/epc-deploy.sh || {
  echo "[Check-in] ERROR: Failed to download deployment script"
  exit 1
}

chmod +x /tmp/epc-deploy.sh
echo "[Check-in] Running EPC deployment..."
/tmp/epc-deploy.sh

echo "[Check-in] EPC deployment complete"
CHECKIN

chmod +x opt/wisptools/scripts/checkin.sh

# Create systemd service
cat > usr/lib/systemd/system/wisptools-epc-checkin.service << SERVICE
[Unit]
Description=WISPTools EPC Check-in Service
After=network-online.target
Wants=network-online.target
ConditionPathExists=!/var/lib/wisptools/.configured

[Service]
Type=oneshot
ExecStart=/opt/wisptools/scripts/checkin.sh
RemainAfterExit=yes
StandardOutput=journal+console
StandardError=journal+console
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
SERVICE

# Build package
cd "$BUILD_DIR"
dpkg-deb --build "${PACKAGE_NAME}" "${PACKAGE_NAME}_${PACKAGE_VERSION}_all.deb"

echo "[Package Builder] Package built: ${BUILD_DIR}/${PACKAGE_NAME}_${PACKAGE_VERSION}_all.deb"
echo "[Package Builder] Package size: $(du -h "${BUILD_DIR}/${PACKAGE_NAME}_${PACKAGE_VERSION}_all.deb" | cut -f1)"

# Output package path for use by other scripts
echo "${BUILD_DIR}/${PACKAGE_NAME}_${PACKAGE_VERSION}_all.deb"

