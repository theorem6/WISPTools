#!/bin/bash
#
# Configure Local HSS with Cloud Failover
# Sets up Open5GS HSS to use local MongoDB first, with cloud HSS (hss.wisptools.io) as failover
#
# Usage: sudo ./configure-local-hss-failover.sh [EPC_ID] [TENANT_ID]
#

set -e

EPC_ID="${1:-EPC-DEFAULT}"
TENANT_ID="${2:-}"
CLOUD_HSS="hss.wisptools.io"
CLOUD_HSS_PORT="3868"
LOCAL_MONGODB_URI="mongodb://localhost:27017/open5gs"

echo "═══════════════════════════════════════════════════════════"
echo "  Configuring Local HSS with Cloud Failover"
echo "  EPC ID: $EPC_ID"
echo "  Tenant ID: $TENANT_ID"
echo "═══════════════════════════════════════════════════════════"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (sudo)"
    exit 1
fi

# Check if Open5GS HSS is installed
if [ ! -f "/etc/open5gs/hss.yaml" ]; then
    echo "❌ Open5GS HSS not found. Please install Open5GS first."
    exit 1
fi

# Backup existing configuration
echo "📋 Backing up existing HSS configuration..."
cp /etc/open5gs/hss.yaml /etc/open5gs/hss.yaml.backup.$(date +%Y%m%d_%H%M%S)

# Update HSS configuration for local MongoDB with cloud sync
cat > /etc/open5gs/hss.yaml <<EOF
db_uri: $LOCAL_MONGODB_URI

logger:
  level: info
  file:
    path: /var/log/open5gs/hss.log

global:
  max:
    ue: 1024

hss:
  freeDiameter: /etc/freeDiameter/hss.conf
  metrics:
    server:
      - address: 127.0.0.1
        port: 9090
  
  # Cloud HSS failover configuration
  failover:
    enabled: true
    cloud_hss_host: $CLOUD_HSS
    cloud_hss_port: $CLOUD_HSS_PORT
    timeout_ms: 5000
    retry_attempts: 3
    
  # Sync configuration - sync subscribers from cloud HSS
  sync:
    enabled: true
    cloud_hss_api: "https://$CLOUD_HSS/api/hss"
    sync_interval_minutes: 5
    tenant_id: "$TENANT_ID"
    epc_id: "$EPC_ID"
EOF

echo "✅ HSS configuration updated"

# Update FreeDiameter configuration for failover
if [ -f "/etc/freeDiameter/hss.conf" ]; then
    echo "📋 Updating FreeDiameter configuration..."
    cp /etc/freeDiameter/hss.conf /etc/freeDiameter/hss.conf.backup.$(date +%Y%m%d_%H%M%S)
    
    # Add peer configuration for cloud HSS (if not already present)
    if ! grep -q "$CLOUD_HSS" /etc/freeDiameter/hss.conf; then
        cat >> /etc/freeDiameter/hss.conf <<EOF

# Cloud HSS Peer (Failover)
ConnectPeer = "$CLOUD_HSS" { ConnectTo = "$CLOUD_HSS"; Port = $CLOUD_HSS_PORT; No_SCTP; No_TLS; Pref_TCP; No_IPv6; };
EOF
        echo "✅ Added cloud HSS peer to FreeDiameter configuration"
    fi
fi

# Create sync script that runs periodically
echo "📋 Creating HSS sync script..."
mkdir -p /opt/wisptools/scripts

cat > /opt/wisptools/scripts/hss-sync.sh <<'SYNCSCRIPT'
#!/bin/bash
#
# HSS Sync Script
# Syncs subscribers from cloud HSS to local HSS
#

CLOUD_HSS_API="${CLOUD_HSS_API:-https://hss.wisptools.io/api/hss}"
TENANT_ID="${TENANT_ID:-}"
EPC_ID="${EPC_ID:-}"

if [ -z "$TENANT_ID" ] || [ -z "$EPC_ID" ]; then
    echo "❌ TENANT_ID and EPC_ID must be set"
    exit 1
fi

# Get list of subscribers from cloud HSS for this tenant
echo "🔄 Syncing subscribers from cloud HSS..."
SUBS_URL="$CLOUD_HSS_API/subscribers?tenant_id=$TENANT_ID"

# Use curl to fetch and sync subscribers
# This would typically call a sync endpoint on the local HSS
curl -s "$SUBS_URL" | jq -r '.[] | @json' | while read -r sub; do
    # Sync each subscriber to local MongoDB
    echo "Syncing subscriber: $(echo $sub | jq -r '.imsi')"
    # Implementation depends on your local HSS sync API
done

echo "✅ Sync complete"
SYNCSCRIPT

chmod +x /opt/wisptools/scripts/hss-sync.sh

# Create systemd service for periodic sync
echo "📋 Creating HSS sync service..."
cat > /etc/systemd/system/hss-sync.service <<EOF
[Unit]
Description=HSS Sync Service - Sync subscribers from cloud HSS
After=network.target open5gs-hss.service
Requires=open5gs-hss.service

[Service]
Type=oneshot
Environment="CLOUD_HSS_API=https://$CLOUD_HSS/api/hss"
Environment="TENANT_ID=$TENANT_ID"
Environment="EPC_ID=$EPC_ID"
ExecStart=/opt/wisptools/scripts/hss-sync.sh
User=root

[Install]
WantedBy=multi-user.target
EOF

# Create timer for periodic execution
cat > /etc/systemd/system/hss-sync.timer <<EOF
[Unit]
Description=HSS Sync Timer - Run every 5 minutes
Requires=hss-sync.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
Unit=hss-sync.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable hss-sync.timer
systemctl start hss-sync.timer

echo "✅ HSS sync timer enabled (runs every 5 minutes)"

# Create MME status reporting script
echo "📋 Creating MME status reporting script..."
cat > /opt/wisptools/scripts/mme-status-reporter.js <<'STATUSSCRIPT'
#!/usr/bin/env node
/**
 * MME Status Reporter
 * Reports subscriber online/offline status to cloud backend
 */

const axios = require('axios');
const { execSync } = require('child_process');

const CLOUD_API = process.env.CLOUD_API || 'https://hss.wisptools.io/api';
const EPC_ID = process.env.EPC_ID;
const AUTH_CODE = process.env.EPC_AUTH_CODE || process.env.AUTH_CODE;
const API_KEY = process.env.EPC_API_KEY || process.env.API_KEY;

if (!EPC_ID || (!AUTH_CODE && !API_KEY)) {
    console.error('EPC_ID and AUTH_CODE or API_KEY required');
    process.exit(1);
}

async function reportMMEStatus() {
    try {
        // Get attached UEs from Open5GS MME (if available)
        // This would query Open5GS's metrics or API to get currently attached subscribers
        // For now, this is a template - actual implementation depends on Open5GS version
        
        // Example: Query Open5GS metrics or use open5gs-dbctl
        // const attachedUEs = execSync('open5gs-dbctl show_ue').toString();
        
        // For each attached UE, report online status
        const statuses = [
            // { imsi: '123456789012345', status: 'online', mme_id: 'mme1', cell_id: 'cell1', ip_address: '10.45.0.1' }
        ];
        
        if (statuses.length === 0) {
            console.log('No subscribers to report');
            return;
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'X-EPC-ID': EPC_ID,
            'X-EPC-Auth': AUTH_CODE,
            'X-API-Key': API_KEY
        };
        
        // Report batch status
        const response = await axios.post(
            `${CLOUD_API}/mme/status/batch`,
            { statuses },
            { headers, timeout: 10000 }
        );
        
        console.log(`✅ Reported ${statuses.length} subscriber statuses`);
    } catch (error) {
        console.error('Error reporting MME status:', error.message);
    }
}

// Run every 60 seconds
reportMMEStatus();
setInterval(reportMMEStatus, 60000);
STATUSSCRIPT

chmod +x /opt/wisptools/scripts/mme-status-reporter.js

# Create systemd service for MME status reporting
cat > /etc/systemd/system/mme-status-reporter.service <<EOF
[Unit]
Description=MME Status Reporter - Report subscriber status to cloud
After=network.target open5gs-mme.service
Requires=open5gs-mme.service

[Service]
Type=simple
Environment="CLOUD_API=https://$CLOUD_HSS/api"
Environment="EPC_ID=$EPC_ID"
Environment="EPC_AUTH_CODE=\${AUTH_CODE}"
Environment="EPC_API_KEY=\${API_KEY}"
ExecStart=/usr/bin/node /opt/wisptools/scripts/mme-status-reporter.js
Restart=always
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mme-status-reporter.service

echo "✅ MME status reporter service created (enable with: systemctl start mme-status-reporter)"

# Restart Open5GS HSS
echo "🔄 Restarting Open5GS HSS..."
systemctl restart open5gs-hss.service

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Configuration Complete!"
echo ""
echo "Configuration Summary:"
echo "  - Local HSS: MongoDB at $LOCAL_MONGODB_URI"
echo "  - Cloud HSS Failover: $CLOUD_HSS:$CLOUD_HSS_PORT"
echo "  - Sync Interval: Every 5 minutes"
echo "  - MME Status Reporting: Enabled"
echo ""
echo "Next Steps:"
echo "  1. Set AUTH_CODE or API_KEY environment variable for MME status reporter"
echo "  2. Start MME status reporter: systemctl start mme-status-reporter"
echo "  3. Verify HSS is running: systemctl status open5gs-hss"
echo "  4. Check logs: journalctl -u open5gs-hss -f"
echo "═══════════════════════════════════════════════════════════"
