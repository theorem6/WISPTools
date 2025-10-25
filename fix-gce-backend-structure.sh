#!/bin/bash

# Fix GCE Backend Structure
# This script consolidates the backend structure on the GCE server

echo "🔧 Fixing GCE Backend Structure..."

# Navigate to the project directory
cd ~/lte-pci-mapper

echo "📁 Current directory: $(pwd)"
echo "📋 Directory contents:"
ls -la

# Check if backend-services directory exists
if [ -d "backend-services" ]; then
    echo "✅ backend-services directory found"
    
    # Check if server.js exists in backend-services
    if [ -f "backend-services/server.js" ]; then
        echo "✅ server.js found in backend-services"
        
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

# Check if package.json exists in backend-services
if [ -f "backend-services/package.json" ]; then
    echo "✅ package.json found in backend-services"
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "backend-services/node_modules" ]; then
        echo "📦 Installing backend dependencies..."
        cd backend-services
        npm install
        cd ..
    else
        echo "✅ node_modules already exists"
    fi
else
    echo "❌ package.json not found in backend-services"
fi

# Check if the server can start
echo "🧪 Testing server startup..."
if [ -f "server.js" ]; then
    echo "✅ Root server.js exists"
    echo "📋 Server file permissions:"
    ls -la server.js
else
    echo "❌ Root server.js not found"
fi

echo "🎯 Backend structure fix complete!"
echo "📋 Final directory structure:"
ls -la | head -20

echo ""
echo "🚀 To start the server, run:"
echo "   node server.js"
echo ""
echo "🔧 Or use PM2:"
echo "   pm2 start server.js --name 'main-api'"
echo "   pm2 start backend-services/routes/hss-management.js --name 'hss-api' -- --port 3001"
