# One-liner to fix GCE backend structure
# Paste this entire block into your GCE SSH session:

cd ~/lte-pci-mapper && \
echo "🔧 Fixing GCE Backend Structure..." && \
echo "📁 Current directory: $(pwd)" && \
echo "📋 Directory contents:" && \
ls -la && \
if [ -d "backend-services" ]; then \
  echo "✅ backend-services directory found" && \
  if [ -f "backend-services/server.js" ]; then \
    echo "✅ server.js found in backend-services" && \
    cat > server.js << 'EOF'
#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
console.log('🚀 Starting LTE WISP Management Platform on GCE...');
const backendDir = path.join(__dirname, 'backend-services');
if (!fs.existsSync(backendDir)) {
  console.error('❌ Backend services directory not found:', backendDir);
  process.exit(1);
}
const serverFile = path.join(backendDir, 'server.js');
if (!fs.existsSync(serverFile)) {
  console.error('❌ Backend server.js not found:', serverFile);
  process.exit(1);
}
console.log('🔧 Starting backend services from:', backendDir);
process.chdir(backendDir);
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
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down backend server...');
  serverProcess.kill('SIGINT');
});
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down backend server...');
  serverProcess.kill('SIGTERM');
});
EOF
    chmod +x server.js && \
    echo "✅ Created root-level server.js" && \
    if [ -f "backend-services/package.json" ]; then \
      echo "✅ package.json found in backend-services" && \
      if [ ! -d "backend-services/node_modules" ]; then \
        echo "📦 Installing backend dependencies..." && \
        cd backend-services && npm install && cd ..; \
      else \
        echo "✅ node_modules already exists"; \
      fi; \
    else \
      echo "❌ package.json not found in backend-services"; \
    fi; \
  else \
    echo "❌ server.js not found in backend-services" && \
    echo "📋 Contents of backend-services:" && \
    ls -la backend-services/; \
  fi; \
else \
  echo "❌ backend-services directory not found" && \
  echo "📋 Available directories:" && \
  ls -la | grep "^d"; \
fi && \
echo "🎯 Backend structure fix complete!" && \
echo "📋 Final directory structure:" && \
ls -la | head -20 && \
echo "" && \
echo "🚀 To start the server, run:" && \
echo "   node server.js" && \
echo "" && \
echo "🔧 Or use PM2:" && \
echo "   pm2 start server.js --name 'main-api'" && \
echo "   pm2 start backend-services/routes/hss-management.js --name 'hss-api' -- --port 3001"
