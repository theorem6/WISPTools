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

# Enable services
systemctl daemon-reload
systemctl enable wisptools-epc-checkin.service
systemctl enable wisptools-device-status.service

# Generate device code and create status page immediately
/opt/wisptools/scripts/generate-device-code.sh > /dev/null
/opt/wisptools/scripts/device-status.sh || true

# Start check-in service (will run on next boot if network is ready)
# Note: Check-in waits for device_code to be registered
if systemctl is-active --quiet network-online.target; then
  systemctl start wisptools-device-status.service || true
  # Don't start check-in automatically - wait for registration
fi

echo "WISPTools EPC Installer installed successfully"
POSTINST

chmod +x DEBIAN/postinst

# Create device code generator script
cat > opt/wisptools/scripts/generate-device-code.sh << DEVICECODE
#!/bin/bash
# Generate unique device code for registration
# Format: 4 letters + 4 numbers (e.g., ABCD1234)

DEVICE_CODE_FILE="/etc/wisptools/device-code"

# Check if device code already exists
if [ -f "\$DEVICE_CODE_FILE" ]; then
  cat "\$DEVICE_CODE_FILE"
  exit 0
fi

# Generate new device code
# 4 random uppercase letters + 4 random digits
LETTERS=\$(cat /dev/urandom | tr -dc 'A-Z' | fold -w 4 | head -n 1)
NUMBERS=\$(cat /dev/urandom | tr -dc '0-9' | fold -w 4 | head -n 1)
DEVICE_CODE="\${LETTERS}\${NUMBERS}"

# Save device code
mkdir -p /etc/wisptools
echo "\$DEVICE_CODE" > "\$DEVICE_CODE_FILE"
chmod 644 "\$DEVICE_CODE_FILE"

echo "\$DEVICE_CODE"
DEVICECODE

chmod +x opt/wisptools/scripts/generate-device-code.sh

# Create check-in service script
cat > opt/wisptools/scripts/checkin.sh << CHECKIN
#!/bin/bash
# WISPTools EPC Check-in Service
# Phones home to GCE server to get EPC configuration

set -e

GCE_SERVER="${GCE_PUBLIC_IP}"
HSS_PORT="${HSS_PORT}"
CHECKIN_URL="http://\${GCE_SERVER}:\${HSS_PORT}/api/epc/checkin"

# Generate or retrieve device code
DEVICE_CODE=\$(/opt/wisptools/scripts/generate-device-code.sh)

if [ -z "\$DEVICE_CODE" ]; then
  echo "[Check-in] ERROR: Could not generate device code"
  exit 1
fi

# Get hardware identifier (MAC address of first network interface)
HW_ID=\$(ip link show | grep -A1 "^[0-9]*: en" | grep "link/ether" | head -1 | awk '{print \$2}' | tr -d ':')

if [ -z "\$HW_ID" ]; then
  echo "[Check-in] ERROR: Could not determine hardware ID"
  exit 1
fi

echo "[Check-in] Device Code: \$DEVICE_CODE"
echo "[Check-in] Hardware ID: \$HW_ID"
echo "[Check-in] Connecting to GCE server: \${GCE_SERVER}:\${HSS_PORT}"

# Check in with device code and hardware ID (retry if device code not linked yet)
MAX_CHECKIN_RETRIES=60
CHECKIN_RETRY=0
EPC_ID=""
CHECKIN_TOKEN=""

while [ \$CHECKIN_RETRY -lt \$MAX_CHECKIN_RETRIES ]; do
  echo "[Check-in] Attempt \$((CHECKIN_RETRY + 1))/\$MAX_CHECKIN_RETRIES..."
  
  HTTP_CODE=\$(curl -s -o /tmp/checkin-response.json -w "%{http_code}" -X POST "\${CHECKIN_URL}" \\
    -H "Content-Type: application/json" \\
    -d "{\\"device_code\\": \\"\${DEVICE_CODE}\\", \\"hardware_id\\": \\"\${HW_ID}\\"}" || echo "000")
  
  if [ "\$HTTP_CODE" = "000" ]; then
    echo "[Check-in] ERROR: Failed to connect to GCE server"
    exit 1
  fi
  
  RESPONSE=\$(cat /tmp/checkin-response.json 2>/dev/null || echo "{}")
  
  # Check if device code is linked (200 = success, 202 = waiting)
  if [ "\$HTTP_CODE" = "200" ]; then
    EPC_ID=\$(echo "\$RESPONSE" | jq -r '.epc_id // empty')
    CHECKIN_TOKEN=\$(echo "\$RESPONSE" | jq -r '.checkin_token // empty')
    
    if [ -n "\$EPC_ID" ] && [ -n "\$CHECKIN_TOKEN" ]; then
      echo "[Check-in] Device code linked! EPC ID: \$EPC_ID"
      break
    fi
  elif [ "\$HTTP_CODE" = "202" ]; then
    MESSAGE=\$(echo "\$RESPONSE" | jq -r '.message // "Device code not linked yet"')
    echo "[Check-in] Waiting for device code to be linked..."
    echo "[Check-in] \$MESSAGE"
    echo "[Check-in] Device code: \$DEVICE_CODE"
    echo "[Check-in] Please enter this code in the device configuration page"
    
    # Wait before retrying (30 seconds)
    if [ \$CHECKIN_RETRY -lt \$((MAX_CHECKIN_RETRIES - 1)) ]; then
      echo "[Check-in] Retrying in 30 seconds..."
      sleep 30
    fi
  else
    ERROR_MSG=\$(echo "\$RESPONSE" | jq -r '.error // .message // "Unknown error"')
    echo "[Check-in] ERROR: HTTP \$HTTP_CODE - \$ERROR_MSG"
    exit 1
  fi
  
  CHECKIN_RETRY=\$((CHECKIN_RETRY + 1))
done

if [ -z "\$EPC_ID" ] || [ -z "\$CHECKIN_TOKEN" ]; then
  echo "[Check-in] ERROR: Device code not linked after \$MAX_CHECKIN_RETRIES attempts"
  echo "[Check-in] Device code: \$DEVICE_CODE"
  echo "[Check-in] Please enter this code in the device configuration page and the device will check in automatically"
  exit 1
fi

APT_REPO_URL=\$(echo "\$RESPONSE" | jq -r '.apt_repo_url // empty')

echo "[Check-in] ✓ Device code linked successfully"
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

# Create device status web page script
cat > opt/wisptools/scripts/device-status.sh << STATUS
#!/bin/bash
# Generate device status page showing device code

DEVICE_CODE_FILE="/etc/wisptools/device-code"
STATUS_FILE="/var/www/html/device-status.html"

# Get device code
if [ -f "\$DEVICE_CODE_FILE" ]; then
  DEVICE_CODE=\$(cat "\$DEVICE_CODE_FILE")
else
  DEVICE_CODE=\$(/opt/wisptools/scripts/generate-device-code.sh)
fi

# Get IP address
IP_ADDRESS=\$(ip route get 1.1.1.1 | awk '{print \$7; exit}')

# Generate status page
mkdir -p /var/www/html
cat > "\$STATUS_FILE" << HTML
<!DOCTYPE html>
<html>
<head>
  <title>WISPTools Device Registration</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 30px; }
    .code { font-size: 48px; font-weight: bold; color: #0066cc; letter-spacing: 8px; margin: 30px 0; padding: 20px; background: #f0f0f0; border-radius: 5px; font-family: monospace; }
    .instructions { color: #666; line-height: 1.6; margin-top: 30px; }
    .ip { color: #999; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>WISPTools Device Registration</h1>
    <p>Enter this code in the WISPTools deployment interface:</p>
    <div class="code">\$DEVICE_CODE</div>
    <div class="instructions">
      <p><strong>Instructions:</strong></p>
      <ol style="text-align: left; display: inline-block;">
        <li>Go to the WISPTools deployment interface</li>
        <li>Enter the device code shown above</li>
        <li>Complete the EPC configuration</li>
        <li>This device will automatically connect and deploy</li>
      </ol>
    </div>
    <div class="ip">Device IP: \$IP_ADDRESS</div>
  </div>
</body>
</html>
HTML

chmod 644 "\$STATUS_FILE"
echo "Device status page created at http://\$IP_ADDRESS/device-status.html"
STATUS

chmod +x opt/wisptools/scripts/device-status.sh

chmod +x opt/wisptools/scripts/checkin.sh

# Create systemd service for check-in
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

# Create systemd service for device status page
cat > usr/lib/systemd/system/wisptools-device-status.service << STATUS_SERVICE
[Unit]
Description=WISPTools Device Status Page
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/wisptools/scripts/device-status.sh
RemainAfterExit=yes
StandardOutput=journal+console
StandardError=journal+console

[Install]
WantedBy=multi-user.target
STATUS_SERVICE

# Build package
cd "$BUILD_DIR"
dpkg-deb --build "${PACKAGE_NAME}" "${PACKAGE_NAME}_${PACKAGE_VERSION}_all.deb"

echo "[Package Builder] Package built: ${BUILD_DIR}/${PACKAGE_NAME}_${PACKAGE_VERSION}_all.deb"
echo "[Package Builder] Package size: $(du -h "${BUILD_DIR}/${PACKAGE_NAME}_${PACKAGE_VERSION}_all.deb" | cut -f1)"

# Output package path for use by other scripts
echo "${BUILD_DIR}/${PACKAGE_NAME}_${PACKAGE_VERSION}_all.deb"

