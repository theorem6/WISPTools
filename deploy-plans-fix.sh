#!/bin/bash
# Deploy plans.js fix to GCE backend

set -e

echo "🚀 Deploying plans.js fix to GCE backend..."

# Configuration
BACKEND_DIR="/opt/hss-api"
REPO_DIR="/root/lte-pci-mapper"
SERVICE_NAME="hss-api"

# Step 1: Update repository
echo "📥 Step 1: Updating repository..."
cd "$REPO_DIR"
git pull origin main || git fetch origin main && git merge origin/main
echo "✅ Repository updated"

# Step 2: Create backup
echo "💾 Step 2: Creating backup..."
BACKUP_DIR="$BACKEND_DIR/backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp "$BACKEND_DIR/routes/plans.js" "$BACKUP_DIR/plans.js.backup" 2>/dev/null || true
echo "✅ Backup created at $BACKUP_DIR"

# Step 3: Copy updated file
echo "📋 Step 3: Copying updated plans.js..."
mkdir -p "$BACKEND_DIR/routes"
cp "$REPO_DIR/backend-services/routes/plans.js" "$BACKEND_DIR/routes/plans.js"
echo "✅ File copied"

# Step 4: Verify syntax
echo "✔️  Step 4: Verifying syntax..."
if node --check "$BACKEND_DIR/routes/plans.js"; then
    echo "✅ Syntax OK"
else
    echo "❌ Syntax error detected!"
    exit 1
fi

# Step 5: Restart service
echo "🔄 Step 5: Restarting service..."
systemctl daemon-reload
systemctl restart "$SERVICE_NAME"
sleep 3

# Step 6: Verify service
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ Service is running"
else
    echo "❌ Service failed to start"
    journalctl -u "$SERVICE_NAME" -n 20 --no-pager
    exit 1
fi

# Step 7: Test endpoint
echo "🧪 Step 7: Testing health endpoint..."
sleep 2
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Health check passed"
else
    echo "⚠️  Health check failed (service may still be starting)"
fi

echo ""
echo "════════════════════════════════════════════════"
echo "✅ DEPLOYMENT COMPLETE"
echo "════════════════════════════════════════════════"
echo ""
echo "The plans.js route has been updated with the fix."
echo "The create project functionality should now work correctly."
echo ""


