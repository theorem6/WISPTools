#!/bin/bash

# Backend Services Restart Script for GCE
# This script stops, updates, and restarts all backend services

echo "🔄 Restarting Backend Services on GCE..."

# Navigate to backend services directory
cd /home/david/PCI_mapper/backend-services || cd ~/PCI_mapper/backend-services || cd /opt/PCI_mapper/backend-services

# Kill existing processes
echo "🛑 Stopping existing services..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "node.*hss-management" 2>/dev/null || true
pkill -f "pm2" 2>/dev/null || true

# Wait for processes to stop
sleep 2

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install --silent

# Set environment variables
export MONGODB_URI="mongodb+srv://david:David123!@cluster0.mongodb.net/lte-pci-mapper?retryWrites=true&w=majority"
export PORT=3000
export NODE_ENV=production

# Start services using PM2 (recommended for production)
echo "🚀 Starting services with PM2..."

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Start main API server on port 3000
pm2 start server.js --name "main-api" -- --port 3000

# Start HSS management API on port 3001 (if the route file exists)
if [ -f "routes/hss-management.js" ]; then
    pm2 start routes/hss-management.js --name "hss-api" -- --port 3001
fi

# Save PM2 configuration
pm2 save

# Show status
echo "✅ Services started. Status:"
pm2 status

# Show logs for verification
echo "📋 Recent logs:"
pm2 logs --lines 10

# Verify ports are listening
echo "🔍 Verifying ports..."
netstat -tlnp | grep :3000 && echo "✅ Port 3000 (Main API) is listening" || echo "❌ Port 3000 not listening"
netstat -tlnp | grep :3001 && echo "✅ Port 3001 (HSS API) is listening" || echo "❌ Port 3001 not listening"

echo "🎉 Backend services restart complete!"
echo "📊 Use 'pm2 status' to check service status"
echo "📋 Use 'pm2 logs' to view logs"
echo "🔄 Use 'pm2 restart all' to restart all services"
