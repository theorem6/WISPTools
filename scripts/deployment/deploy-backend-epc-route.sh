#!/bin/bash
# Deploy EPC Deployment Route to GCE Backend
# Updates the backend with the latest epc-deployment.js route

set -e

BACKEND_DIR="/opt/hss-api"
REPO_DIR="/root/lte-pci-mapper"
SERVICE_NAME="hss-api"

echo "🚀 Deploying EPC Deployment Route to Backend"
echo "============================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
cd "$REPO_DIR"
git pull origin main
echo "✅ Code updated"

# Stop service
echo "⏹️  Stopping backend service..."
systemctl stop "$SERVICE_NAME" || true
echo "✅ Service stopped"

# Verify route file exists
if [ ! -f "$REPO_DIR/backend-services/routes/epc-deployment.js" ]; then
    echo "❌ Route file not found: backend-services/routes/epc-deployment.js"
    exit 1
fi

# Copy route file
echo "📋 Copying epc-deployment.js route..."
mkdir -p "$BACKEND_DIR/routes"
cp "$REPO_DIR/backend-services/routes/epc-deployment.js" "$BACKEND_DIR/routes/epc-deployment.js"
echo "✅ Route file copied"

# Check if server.js needs updating
if grep -q "epc-deployment" "$BACKEND_DIR/server.js"; then
    echo "✅ server.js already has epc-deployment route registered"
else
    echo "📝 Updating server.js to register epc-deployment route..."
    
    # Backup server.js
    cp "$BACKEND_DIR/server.js" "$BACKEND_DIR/server.js.backup-$(date +%Y%m%d-%H%M%S)"
    
    # Check if we need to add the route registration
    # The route should be: app.use('/api/deploy', require('./routes/epc-deployment'));
    if [ -f "$BACKEND_DIR/server.js" ]; then
        if ! grep -q "require('./routes/epc-deployment')" "$BACKEND_DIR/server.js"; then
            # Add route registration before the last app.use or app.listen
            sed -i '/app.listen/i\
app.use('\''/api/deploy'\'', require('\''./routes/epc-deployment'\''));
' "$BACKEND_DIR/server.js"
            echo "✅ server.js updated with route registration"
        fi
    fi
fi

# Verify syntax
echo "🔍 Verifying Node.js syntax..."
node -c "$BACKEND_DIR/routes/epc-deployment.js" || {
    echo "❌ Syntax error in epc-deployment.js"
    exit 1
}
echo "✅ Syntax valid"

# Install any missing dependencies
echo "📦 Checking dependencies..."
cd "$BACKEND_DIR"
if [ -f "package.json" ]; then
    npm install --production --quiet 2>/dev/null || true
fi

# Start service
echo "▶️  Starting backend service..."
systemctl start "$SERVICE_NAME"
sleep 3

# Verify service is running
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ Service is running"
else
    echo "❌ Service failed to start"
    echo "Checking logs..."
    journalctl -u "$SERVICE_NAME" -n 20 --no-pager
    exit 1
fi

# Test endpoint
echo "🧪 Testing ISO generation endpoint..."
sleep 2
curl -s http://localhost:3001/api/deploy/generate-epc-iso -X POST \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: test" \
    -d '{"siteName":"test","location":{},"networkConfig":{},"contact":{},"hssConfig":{}}' \
    > /dev/null 2>&1 && echo "✅ Endpoint responding" || echo "⚠️  Endpoint may need verification"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Backend is running with EPC deployment route at:"
echo "  POST /api/deploy/generate-epc-iso"
echo ""

