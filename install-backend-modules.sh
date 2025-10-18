#!/bin/bash
# Script to install modularized backend files from /home/david
# Run this on the backend server after uploading backend-update.zip

set -e

echo "🚀 Installing Modularized Backend Files"
echo "========================================"
echo ""

# Check if zip file exists
if [ ! -f /home/david/backend-update.zip ]; then
    echo "❌ Error: /home/david/backend-update.zip not found"
    echo "Please upload the file first using:"
    echo "  scp backend-update.zip david@136.112.111.167:/home/david/"
    exit 1
fi

# Check if unzip is installed
if ! command -v unzip &> /dev/null; then
    echo "📦 Installing unzip..."
    sudo apt-get update -qq
    sudo apt-get install -y unzip
fi

# Create backup directory
BACKUP_DIR="/opt/hss-api/backups/$(date +%Y%m%d_%H%M%S)"
echo "💾 Creating backup in $BACKUP_DIR..."
sudo mkdir -p "$BACKUP_DIR"

# Backup existing files
if [ -f /opt/hss-api/distributed-epc-api.js ]; then
    sudo cp /opt/hss-api/distributed-epc-api.js "$BACKUP_DIR/"
    echo "   ✅ Backed up distributed-epc-api.js"
fi

if [ -d /opt/hss-api/distributed-epc ]; then
    sudo cp -r /opt/hss-api/distributed-epc "$BACKUP_DIR/"
    echo "   ✅ Backed up distributed-epc/ directory"
fi

if [ -d /opt/hss-api/backend-services ]; then
    sudo cp -r /opt/hss-api/backend-services "$BACKUP_DIR/"
    echo "   ✅ Backed up backend-services/ directory"
fi

# Extract the new files to temp directory
echo ""
echo "📦 Extracting new files..."
sudo rm -rf /tmp/backend-update
sudo mkdir -p /tmp/backend-update
unzip -q /home/david/backend-update.zip -d /tmp/backend-update

# Copy files to /opt/hss-api/
echo ""
echo "📝 Installing new files to /opt/hss-api/..."

# Change to temp directory
cd /tmp/backend-update

# Copy main API file
if [ -f distributed-epc-api.js ]; then
    sudo cp distributed-epc-api.js /opt/hss-api/
    echo "   ✅ Installed distributed-epc-api.js"
fi

# Copy schema file
if [ -f distributed-epc-schema.js ]; then
    sudo cp distributed-epc-schema.js /opt/hss-api/
    echo "   ✅ Installed distributed-epc-schema.js"
fi

# Copy modular directory
if [ -d distributed-epc ]; then
    sudo rm -rf /opt/hss-api/distributed-epc
    sudo cp -r distributed-epc /opt/hss-api/
    echo "   ✅ Installed distributed-epc/ modules (11 files)"
fi

# Copy backend services
if [ -d backend-services ]; then
    sudo rm -rf /opt/hss-api/backend-services
    sudo cp -r backend-services /opt/hss-api/
    echo "   ✅ Installed backend-services/ (5 files)"
fi

# Copy deployment files
if [ -d deployment-files ]; then
    sudo mkdir -p /opt/hss-api/deployment-files
    sudo cp -r deployment-files/* /opt/hss-api/deployment-files/
    echo "   ✅ Installed deployment-files/ (2 files)"
fi

# Return to safe directory before PM2 operations
cd /opt/hss-api

# Fix permissions
echo ""
echo "🔐 Setting permissions..."
sudo chown -R root:root /opt/hss-api/
sudo find /opt/hss-api/ -type f -name "*.js" -exec chmod 644 {} \;

# Verify syntax of main file
echo ""
echo "🔍 Verifying JavaScript syntax..."
if node -c /opt/hss-api/distributed-epc-api.js; then
    echo "   ✅ distributed-epc-api.js syntax OK"
else
    echo "   ❌ Syntax error detected!"
    echo "   Restoring backup..."
    sudo cp "$BACKUP_DIR/distributed-epc-api.js" /opt/hss-api/
    sudo pm2 restart hss-api
    exit 1
fi

# Check if using modular structure (distributed-epc/index.js exists)
if [ -f /opt/hss-api/distributed-epc/index.js ]; then
    echo ""
    echo "📋 Modular structure detected!"
    echo "   You can now use: require('./distributed-epc') instead of require('./distributed-epc-api')"
    echo ""
    echo "   To migrate to modular API:"
    echo "   1. Update your main server file to use: const router = require('./distributed-epc');"
    echo "   2. Test that all endpoints work"
    echo "   3. (Optional) Remove distributed-epc-api.js once migration is complete"
fi

# Restart PM2
echo ""
echo "🔄 Restarting hss-api service..."
sudo pm2 restart hss-api

# Wait for restart
sleep 3

# Check service status
echo ""
echo "📊 Service Status:"
pm2 status hss-api

echo ""
echo "📋 Recent Logs (checking for errors):"
pm2 logs hss-api --lines 30 --nostream

# Clean up
echo ""
echo "🧹 Cleaning up temporary files..."
rm -rf /tmp/backend-update
rm /home/david/backend-update.zip
echo "   ✅ Cleaned up"

echo ""
echo "═══════════════════════════════════════"
echo "🎉 Backend Update Complete!"
echo "═══════════════════════════════════════"
echo ""
echo "✅ Files installed to /opt/hss-api/"
echo "✅ Backup created in $BACKUP_DIR"
echo "✅ Service restarted successfully"
echo ""
echo "📁 New Structure:"
echo "   /opt/hss-api/"
echo "   ├── distributed-epc-api.js         (monolithic - current)"
echo "   ├── distributed-epc/               (modular - new)"
echo "   │   ├── index.js"
echo "   │   ├── middleware/"
echo "   │   ├── routes/"
echo "   │   ├── services/"
echo "   │   ├── utils/"
echo "   │   └── models/"
echo "   ├── backend-services/"
echo "   └── deployment-files/"
echo ""
echo "🧪 Test the deployment:"
echo "   1. Register a new EPC in the web interface"
echo "   2. Download the deployment script"
echo "   3. Verify it contains the OAuth token and enhanced metrics"
echo ""
echo "📚 Documentation: See distributed-epc/README.md"
echo ""

# If errors were found in logs, show them
if pm2 logs hss-api --lines 50 --nostream | grep -i "error" > /dev/null; then
    echo "⚠️  WARNING: Errors detected in logs. Please review above."
else
    echo "✅ No errors detected in logs!"
fi

echo ""
echo "Done! 🎉"

