#!/bin/bash
# Quick one-step fix for GenieACS paths

echo "Finding GenieACS location..."
GENIEACS_BIN=$(npm root -g)/genieacs/bin/genieacs-cwmp

if [ ! -f "$GENIEACS_BIN" ]; then
  echo "ERROR: GenieACS not found at $GENIEACS_BIN"
  echo "Checking alternate locations..."
  
  # Check common locations
  for path in /usr/local/lib/node_modules/genieacs/bin /usr/lib/node_modules/genieacs/bin /opt/node_modules/genieacs/bin; do
    if [ -f "$path/genieacs-cwmp" ]; then
      GENIEACS_BIN="$path/genieacs-cwmp"
      echo "Found at: $path"
      break
    fi
  done
fi

GENIEACS_DIR=$(dirname "$GENIEACS_BIN")
echo "GenieACS binaries: $GENIEACS_DIR"
echo ""
echo "Files found:"
ls -la $GENIEACS_DIR/

# Stop all services
echo ""
echo "Stopping services..."
systemctl stop genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui

# Create new service files
echo "Creating service files..."

cat > /etc/systemd/system/genieacs-cwmp.service << EOF
[Unit]
Description=GenieACS CWMP
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=$(which node) $GENIEACS_DIR/genieacs-cwmp
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/genieacs-nbi.service << EOF
[Unit]
Description=GenieACS NBI
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=$(which node) $GENIEACS_DIR/genieacs-nbi
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/genieacs-fs.service << EOF
[Unit]
Description=GenieACS FS
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=$(which node) $GENIEACS_DIR/genieacs-fs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/genieacs-ui.service << EOF
[Unit]
Description=GenieACS UI
After=network.target

[Service]
User=genieacs
EnvironmentFile=/opt/genieacs/genieacs.env
ExecStart=$(which node) $GENIEACS_DIR/genieacs-ui
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd..."
systemctl daemon-reload

echo "Starting services..."
systemctl start genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui

sleep 3

echo ""
echo "Service status:"
systemctl status genieacs-cwmp --no-pager | head -20

echo ""
echo "Testing API..."
curl -s http://localhost:7557/devices | head -5 || echo "API not responding yet"

echo ""
echo "Done! Check with: systemctl status genieacs-cwmp"

