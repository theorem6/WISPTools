// Bootstrap Script Helper Functions
// Isolated utilities for bootstrap script generation - DO NOT MODIFY unless fixing bootstrap issues

/**
 * Generate bootstrap script that downloads full deployment
 */
function generateBootstrapScript(epc_id, gce_ip, hss_port) {
  return `#!/bin/bash
# WISPTools.io EPC Bootstrap Script
# EPC: ${epc_id}
# This script runs on first boot and downloads the full deployment

set -e

# Load credentials
source /etc/wisptools/credentials.env

echo "🚀 WISPTools.io EPC Bootstrap"
echo "EPC ID: $EPC_ID"
echo "Tenant ID: $TENANT_ID"
echo ""

# Check network connectivity
echo "📡 Checking network..."
MAX_RETRIES=30
RETRY=0
while ! ping -c 1 ${gce_ip} > /dev/null 2>&1; do
    RETRY=$((RETRY + 1))
    if [ $RETRY -gt $MAX_RETRIES ]; then
        echo "❌ Cannot reach GCE server at ${gce_ip}"
        exit 1
    fi
    echo "Waiting for network... ($RETRY/$MAX_RETRIES)"
    sleep 2
done

echo "✅ Network connectivity confirmed"
echo ""

# Download full deployment script from GCE
echo "📥 Downloading full deployment script from GCE server..."
wget -O /tmp/full-deployment.sh \\
    "http://${gce_ip}:${hss_port}/api/epc/$EPC_ID/full-deployment?auth_code=$EPC_AUTH_CODE"

if [ $? -ne 0 ]; then
    echo "❌ Failed to download deployment script"
    exit 1
fi

echo "✅ Deployment script downloaded"
echo ""

# Make executable and run
chmod +x /tmp/full-deployment.sh
echo "🚀 Executing full deployment..."
bash /tmp/full-deployment.sh

# Mark as bootstrapped
mkdir -p /var/lib/wisptools
touch /var/lib/wisptools/.bootstrapped

echo ""
echo "✅ Bootstrap complete!"
echo "EPC $EPC_ID is now deployed and connected to Cloud HSS"
echo ""

exit 0
`;
}

module.exports = {
  generateBootstrapScript
};

