#!/bin/bash
# Deploy HSS Backend (No Git Required)
# Run this in the directory where you uploaded the hss-module files

set -e

echo "════════════════════════════════════════════════════════════"
echo "     HSS Backend Deployment (Direct Upload)"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
  echo "❌ server.js not found!"
  echo "   Make sure you're in the hss-module directory"
  exit 1
fi

echo "✓ Found server.js"
echo "✓ Current directory: $(pwd)"
echo ""

# Install Node.js if needed
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
  echo "   Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "✓ Node.js $(node --version)"
echo "✓ npm $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Install PM2 globally
echo "📦 Checking PM2..."
if ! command -v pm2 &> /dev/null; then
  echo "   Installing PM2..."
  sudo npm install -g pm2
fi
echo "✓ PM2 installed"
echo ""

# Check environment variables
echo "🔐 Checking environment variables..."
if [ -z "$MONGODB_URI" ]; then
  echo "⚠️  MONGODB_URI not set!"
  echo "   Set it now or the service will fail to start"
  echo "   export MONGODB_URI='your-mongodb-connection-string'"
else
  echo "✓ MONGODB_URI is set"
fi

if [ -z "$HSS_ENCRYPTION_KEY" ]; then
  echo "⚠️  HSS_ENCRYPTION_KEY not set!"
  echo "   Generating one..."
  NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  export HSS_ENCRYPTION_KEY="$NEW_KEY"
  echo "   Generated: $NEW_KEY"
  echo "   Add to /etc/environment: HSS_ENCRYPTION_KEY=$NEW_KEY"
else
  echo "✓ HSS_ENCRYPTION_KEY is set"
fi
echo ""

# Stop existing service
echo "🛑 Stopping existing service..."
pm2 stop hss-api 2>/dev/null || echo "   (not running)"
pm2 delete hss-api 2>/dev/null || echo "   (not in PM2)"
echo ""

# Start service
echo "🚀 Starting HSS API service..."
pm2 start server.js \
  --name hss-api \
  --time \
  -i 1 \
  --env production \
  --log /var/log/hss-api.log \
  --error /var/log/hss-api-error.log

pm2 save
sudo pm2 startup systemd -u $USER --hp $HOME || true
echo "✓ Service started"
echo ""

# Wait a moment
echo "⏳ Waiting for service to initialize..."
sleep 5
echo ""

# Check status
echo "📊 Service status:"
pm2 status
echo ""

# Test health
echo "🏥 Testing health endpoint..."
sleep 2
if curl -f http://localhost:3000/health 2>/dev/null; then
  echo ""
  echo "✓ Health check PASSED!"
else
  echo ""
  echo "❌ Health check FAILED"
  echo "   Check logs: pm2 logs hss-api"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "     ✅ Deployment Complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📝 Useful Commands:"
echo "   View logs:    pm2 logs hss-api"
echo "   Restart:      pm2 restart hss-api"
echo "   Stop:         pm2 stop hss-api"
echo "   Monitor:      pm2 monit"
echo ""
echo "🔗 Endpoints:"
echo "   Health:       http://localhost:3000/health"
echo "   EPC API:      http://localhost:3000/api/epc/"
echo ""


