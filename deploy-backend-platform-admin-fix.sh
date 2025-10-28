#!/bin/bash
# Deploy backend with platform admin and tenant isolation fixes
# Run this script from your Windows environment

echo "🚀 Deploying backend with platform admin and tenant isolation fixes..."
echo ""

# Connect to GCE server and deploy
ssh root@136.112.111.167 << 'EOF'
  set -e
  
  cd /root/lte-pci-mapper
  
  echo "📥 Pulling latest code..."
  git pull origin main
  
  echo "🔄 Restarting main-api service..."
  pm2 restart main-api
  
  echo "✅ Deployment complete!"
  pm2 logs main-api --lines 20
EOF

echo ""
echo "✅ Backend deployed successfully!"
echo "Platform admin (david@david.com) now has master tenant rights."
echo "Regular users require tenant selection for data isolation."

