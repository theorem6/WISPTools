#!/bin/bash

echo "🚀 Deploying Complete Backend Services to GCE (Including GenieACS)..."

# Navigate to the project directory
cd ~/lte-pci-mapper/backend-services || { echo "Error: backend-services directory not found."; exit 1; }

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Set environment variables
export MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0"
export PORT=3000
export HSS_PORT=3001

# Stop existing PM2 processes
echo "🛑 Stopping existing processes..."
pm2 stop all
pm2 delete all

# Start main API server (port 3000)
echo "🚀 Starting main API server on port 3000..."
pm2 start server.js --name "main-api" -- --port 3000

# Start HSS API server (port 3001)
echo "🚀 Starting HSS API server on port 3001..."
pm2 start hss-server.js --name "hss-api" -- --port 3001

# Check if GenieACS services are running via systemctl
echo "🔍 Checking GenieACS services..."

# GenieACS services that should be running via systemctl
GENIEACS_SERVICES=("genieacs-cwmp" "genieacs-nbi" "genieacs-fs" "genieacs-ui")

for service in "${GENIEACS_SERVICES[@]}"; do
    if systemctl is-active --quiet "$service"; then
        echo "✅ $service is running via systemctl"
    else
        echo "⚠️  $service is not running via systemctl"
        echo "   Attempting to start $service..."
        sudo systemctl start "$service" || echo "   Failed to start $service"
    fi
done

# Save PM2 configuration
pm2 save

# Show status
echo "📊 PM2 Status:"
pm2 status

echo "📊 Systemctl GenieACS Status:"
for service in "${GENIEACS_SERVICES[@]}"; do
    echo "  $service: $(systemctl is-active $service)"
done

echo ""
echo "✅ Backend deployment complete!"
echo "📡 Main API: http://localhost:3000/health"
echo "📡 HSS API: http://localhost:3001/health"
echo "📡 GenieACS NBI: http://localhost:7557"
echo "📡 GenieACS CWMP: http://localhost:7547"
echo "📡 GenieACS FS: http://localhost:7567"
echo "📡 GenieACS UI: http://localhost:8080"
