#!/bin/bash

echo "🚀 Deploying Backend Services to GCE..."

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

# Save PM2 configuration
pm2 save

# Show status
echo "📊 PM2 Status:"
pm2 status

echo "✅ Backend deployment complete!"
echo "📡 Main API: http://localhost:3000/health"
echo "📡 HSS API: http://localhost:3001/health"
