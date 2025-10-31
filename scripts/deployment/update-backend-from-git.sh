#!/bin/bash
# Update Backend Services from GitHub
# This script pulls latest code from GitHub and restarts services
# Run with: sudo bash scripts/deployment/update-backend-from-git.sh

set -e

REPO_DIR="/opt/lte-pci-mapper"
BACKEND_DIR="$REPO_DIR/backend-services"

echo "🔄 Updating backend from GitHub..."
echo ""

# Check if repo exists
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "📥 Initializing git repository..."
  cd "$REPO_DIR"
  git init
  git remote add origin https://github.com/theorem6/lte-pci-mapper.git 2>/dev/null || git remote set-url origin https://github.com/theorem6/lte-pci-mapper.git
  git config user.name "GCE Server"
  git config user.email "server@wisptools.io"
  # Add all existing files
  git add -A
  git commit -m "Initial commit from server" || true
  echo "✅ Git repository initialized"
fi

echo "📥 Pulling latest code from GitHub..."
cd "$REPO_DIR"
git fetch origin main || {
  echo "⚠️  Could not fetch from GitHub (may require authentication or repo may be private)"
  echo "📋 Current code will be used. To sync manually:"
  echo "   1. Commit current changes: git add -A && git commit -m 'Server state'"
  echo "   2. Pull from GitHub: git pull origin main"
  exit 0
}

# Try to merge/pull
git pull origin main --no-edit || {
  echo "⚠️  Pull failed, resetting to GitHub state..."
  git fetch origin main
  git reset --hard origin/main
}

echo "✅ Code updated from GitHub"
echo ""

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
  echo "❌ Backend directory not found: $BACKEND_DIR"
  exit 1
fi

# Install dependencies if package.json changed
echo "📦 Checking for dependency updates..."
cd "$BACKEND_DIR"
if [ -f "package.json" ]; then
  npm install --production --silent || {
    echo "⚠️  npm install had warnings, but continuing..."
  }
fi

echo ""
echo "🔄 Restarting backend services..."

# Restart EPC API (port 3002)
if pm2 list | grep -q "epc-api"; then
  echo "  - Restarting epc-api..."
  pm2 restart epc-api --update-env
else
  echo "  - Starting epc-api..."
  cd "$BACKEND_DIR"
  PORT=3002 pm2 start min-epc-server.js --name epc-api
fi

# Restart HSS API (port 3001)
if pm2 list | grep -q "hss-api"; then
  echo "  - Restarting hss-api..."
  pm2 restart hss-api --update-env
fi

# Restart Main API (port 3000) if exists
if pm2 list | grep -q "main-api"; then
  echo "  - Restarting main-api..."
  pm2 restart main-api --update-env
fi

echo ""
echo "✅ Backend services updated and restarted"
echo ""
echo "📊 Service status:"
pm2 status
echo ""
echo "📝 Latest commit:"
cd "$REPO_DIR"
git log -1 --oneline
echo ""
echo "✅ Deployment complete!"

