#!/bin/bash

# Clean Git Pull for GCE Backend
# This script wipes the directory and pulls fresh from Git

echo "🧹 Cleaning and pulling fresh from Git..."

# Navigate to home directory
cd ~

# Remove the existing directory if it exists
if [ -d "lte-pci-mapper" ]; then
    echo "🗑️ Removing existing lte-pci-mapper directory..."
    rm -rf lte-pci-mapper
fi

# Clone fresh from Git
echo "📥 Cloning fresh from Git..."
git clone https://github.com/theorem6/lte-pci-mapper.git

# Navigate to the project directory
cd lte-pci-mapper

echo "📁 Current directory: $(pwd)"
echo "📋 Directory contents:"
ls -la

# Check if backend-services directory exists
if [ -d "backend-services" ]; then
    echo "✅ backend-services directory found"
    
    # Check if server.js exists in backend-services
    if [ -f "backend-services/server.js" ]; then
        echo "✅ server.js found in backend-services"
        
        # Install backend dependencies
        echo "📦 Installing backend dependencies..."
        cd backend-services
        npm install
        cd ..
        
        # Create a root-level server.js that points to backend-services
        cat > server.js << 'EOF'
#!/usr/bin/env node

/**
 * Root Server Entry Point for GCE
 * 
 * This file serves as the main entry point for the LTE WISP Management Platform.
 * It starts the backend services from the backend-services directory.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting LTE WISP Management Platform on GCE...');
console.log('📁 Working directory:', process.cwd());

// Check if backend-services directory exists
const backendDir = path.join(__dirname, 'backend-services');
if (!fs.existsSync(backendDir)) {
  console.error('❌ Backend services directory not found:', backendDir);
  process.exit(1);
}

// Check if server.js exists in backend-services
const serverFile = path.join(backendDir, 'server.js');
if (!fs.existsSync(serverFile)) {
  console.error('❌ Backend server.js not found:', serverFile);
  process.exit(1);
}

console.log('🔧 Starting backend services from:', backendDir);

// Change to backend-services directory and start the server
process.chdir(backendDir);

// Start the backend server
const serverProcess = spawn('node', ['server.js'], {
  stdio: 'inherit',
  cwd: backendDir
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start backend server:', error);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  console.log(`🔚 Backend server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down backend server...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down backend server...');
  serverProcess.kill('SIGTERM');
});
EOF
        
        chmod +x server.js
        echo "✅ Created root-level server.js"
        
    else
        echo "❌ server.js not found in backend-services"
        echo "📋 Contents of backend-services:"
        ls -la backend-services/
    fi
    
else
    echo "❌ backend-services directory not found"
    echo "📋 Available directories:"
    ls -la | grep "^d"
fi

# Set up environment variables
echo "🔧 Setting up environment variables..."
export MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0"
export PORT=3000

echo "🎯 Clean Git pull complete!"
echo "📋 Final directory structure:"
ls -la | head -20

echo ""
echo "🚀 To start the server, run:"
echo "   node server.js"
echo ""
echo "🔧 Or use PM2:"
echo "   pm2 start server.js --name 'main-api'"
echo "   pm2 start backend-services/routes/hss-management.js --name 'hss-api' -- --port 3001"
echo ""
echo "🌐 Server will be available at:"
echo "   http://$(curl -s ifconfig.me):3000"
