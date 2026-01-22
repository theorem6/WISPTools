# Deploy Backend Services to GCE VM
# GCE VM: 136.112.111.167:3001 (HSS Management API)

Write-Host "🚀 Deploying Backend Services to GCE VM..." -ForegroundColor Green

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Check if we're in the right directory
if (-not (Test-Path (Join-Path $scriptDir "backend-services"))) {
    Write-Host "❌ backend-services directory not found. Please run from project root." -ForegroundColor Red
    exit 1
}

# Create deployment package
Write-Host "📦 Creating deployment package..." -ForegroundColor Yellow
$deployDir = Join-Path $scriptDir "backend-deployment"
if (-not $deployDir) {
    Write-Host "❌ Deployment directory path is empty." -ForegroundColor Red
    exit 1
}
Write-Host "📁 Deployment directory: $deployDir" -ForegroundColor Cyan
if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

# Copy backend services
Write-Host "📋 Copying backend services..." -ForegroundColor Yellow
Copy-Item -Recurse (Join-Path $scriptDir "backend-services\*") -Destination $deployDir

# Create package.json for deployment
Write-Host "📄 Creating deployment package.json..." -ForegroundColor Yellow
$packageJson = @{
    name = "lte-wisp-backend"
    version = "1.0.0"
    description = "LTE WISP Management Platform Backend Services"
    main = "server.js"
    scripts = @{
        start = "node server.js"
        dev = "nodemon server.js"
    }
    dependencies = @{
        express = "^4.18.2"
        cors = "^2.8.5"
        helmet = "^7.0.0"
        "express-rate-limit" = "^6.7.0"
        dotenv = "^16.3.1"
        multer = "^1.4.5-lts.1"
        "node-snmp" = "^2.1.0"
        "snmp-native" = "^1.0.27"
        "node-routeros" = "^1.1.0"
        "node-ssh" = "^13.1.0"
        archiver = "^6.0.1"
        "node-gpg" = "^0.6.2"
        winston = "^3.10.0"
        axios = "^1.5.0"
    }
    devDependencies = @{
        nodemon = "^3.0.1"
    }
    engines = @{
        node = ">=18.0.0"
    }
} | ConvertTo-Json -Depth 3

Set-Content -Path (Join-Path $deployDir "package.json") -Value $packageJson

# Create main server file
Write-Host "🖥️ Creating main server file..." -ForegroundColor Yellow
$serverJs = @'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    'https://wisptools-production.web.app',
    'https://wisptools-production.firebaseapp.com',
    'http://localhost:5173',
    'http://localhost:4173'
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      apt: 'active',
      snmp: 'active', 
      mikrotik: 'active',
      epc: 'active'
    }
  });
});

// API Routes
try {
  // APT Repository Routes
  if (require('fs').existsSync('./routes/epcUpdates.js')) {
    app.use('/api/epc-updates', require('./routes/epcUpdates'));
    console.log('✅ EPC Updates API loaded');
  }

  // SNMP Monitoring Routes  
  if (require('fs').existsSync('./routes/snmpMonitoring.js')) {
    app.use('/api/snmp', require('./routes/snmpMonitoring'));
    console.log('✅ SNMP Monitoring API loaded');
  }

  // Mikrotik API Routes
  if (require('fs').existsSync('./routes/mikrotikAPI.js')) {
    app.use('/api/mikrotik', require('./routes/mikrotikAPI'));
    console.log('✅ Mikrotik API loaded');
  }

  // EPC Metrics Routes
  if (require('fs').existsSync('./routes/epcMetrics.js')) {
    app.use('/api/epc', require('./routes/epcMetrics'));
    console.log('✅ EPC Metrics API loaded');
  }

} catch (error) {
  console.error('❌ Error loading API routes:', error.message);
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 LTE WISP Backend Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 SNMP API: http://localhost:${PORT}/api/snmp`);
  console.log(`🌐 Mikrotik API: http://localhost:${PORT}/api/mikrotik`);
  console.log(`📦 APT API: http://localhost:${PORT}/api/epc-updates`);
  console.log(`📊 EPC Metrics API: http://localhost:${PORT}/api/epc`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});
'@

Set-Content -Path (Join-Path $deployDir "server.js") -Value $serverJs

# Create environment file template
Write-Host "🔧 Creating environment template..." -ForegroundColor Yellow
$envTemplate = @'
# LTE WISP Backend Configuration
NODE_ENV=production
PORT=3001

# Database Configuration (if needed)
# MONGODB_URI=mongodb://localhost:27017/lte-wisp
# MYSQL_HOST=localhost
# MYSQL_USER=root
# MYSQL_PASSWORD=
# MYSQL_DATABASE=lte_wisp

# SNMP Configuration
SNMP_DEFAULT_COMMUNITY=public
SNMP_DEFAULT_PORT=161
SNMP_DEFAULT_TIMEOUT=5000

# Mikrotik Configuration
MIKROTIK_DEFAULT_PORT=8728
MIKROTIK_DEFAULT_TIMEOUT=10000

# APT Repository Configuration
APT_REPO_PATH=/var/lib/apt/repository
GPG_KEY_NAME=lte-wisp-repo
GPG_KEY_EMAIL=admin@wisptools.io

# Security
JWT_SECRET=your-super-secret-jwt-key-here
API_KEY=your-api-key-here

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/lte-wisp/backend.log
'@

Set-Content -Path (Join-Path $deployDir ".env.example") -Value $envTemplate

# Create deployment instructions
Write-Host "📋 Creating deployment instructions..." -ForegroundColor Yellow
$deployInstructions = @'
# Backend Deployment Instructions for GCE VM

## Server Details
- **GCE VM IP**: 136.112.111.167
- **Backend Port**: 3001 (HSS Management API)
- **Frontend Port**: 3000 (GenieACS UI)

## Deployment Steps

### 1. Upload Files to GCE VM
```bash
# Upload the deployment package to GCE VM
scp -r backend-deployment/ user@136.112.111.167:/opt/lte-wisp-backend/

# Or use rsync for incremental updates
rsync -avz --delete backend-deployment/ user@136.112.111.167:/opt/lte-wisp-backend/
```

### 2. SSH into GCE VM and Install
```bash
ssh user@136.112.111.167

# Navigate to deployment directory
cd /opt/lte-wisp-backend

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
nano .env  # Edit configuration as needed

# Create log directory
sudo mkdir -p /var/log/lte-wisp
sudo chown $USER:$USER /var/log/lte-wisp

# Test the server
npm start
```

### 3. Setup as System Service (Recommended)
```bash
# Create systemd service file
sudo tee /etc/systemd/system/lte-wisp-backend.service > /dev/null <<EOF
[Unit]
Description=LTE WISP Backend Services
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/lte-wisp-backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable lte-wisp-backend
sudo systemctl start lte-wisp-backend

# Check service status
sudo systemctl status lte-wisp-backend

# View logs
sudo journalctl -u lte-wisp-backend -f
```

### 4. Configure Firewall
```bash
# Open port 3001 for backend API
sudo ufw allow 3001/tcp

# Verify firewall status
sudo ufw status
```

### 5. Verify Deployment
```bash
# Test health endpoint
curl http://localhost:3001/health

# Test from external (replace with actual IP)
curl http://136.112.111.167:3001/health
```

## API Endpoints Available

- **Health Check**: `GET /health`
- **SNMP API**: `/api/snmp/*`
- **Mikrotik API**: `/api/mikrotik/*` 
- **APT Repository**: `/api/epc-updates/*`
- **EPC Metrics**: `/api/epc/*`

## Troubleshooting

### Check Service Status
```bash
sudo systemctl status lte-wisp-backend
sudo journalctl -u lte-wisp-backend --no-pager -l
```

### Check Port Usage
```bash
sudo netstat -tlnp | grep :3001
sudo ss -tlnp | grep :3001
```

### Check Logs
```bash
tail -f /var/log/lte-wisp/backend.log
sudo journalctl -u lte-wisp-backend -f
```

### Restart Service
```bash
sudo systemctl restart lte-wisp-backend
```

## Security Notes

1. **Firewall**: Ensure only necessary ports are open
2. **Environment**: Keep `.env` file secure with proper permissions
3. **Updates**: Regularly update Node.js and dependencies
4. **Monitoring**: Set up monitoring for the service
5. **Backups**: Regular backups of configuration and data

## Integration with Frontend

The frontend (deployed to Firebase) will connect to:
- **Backend API**: `http://136.112.111.167:3001`
- **CORS**: Already configured for `wisptools-production.web.app`

Make sure the frontend API configuration points to the correct GCE VM endpoint.
'@

Set-Content -Path (Join-Path $deployDir "DEPLOYMENT_INSTRUCTIONS.md") -Value $deployInstructions

Write-Host "✅ Backend deployment package created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Deployment package location: $deployDir" -ForegroundColor Cyan
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Review the deployment package in: $deployDir" -ForegroundColor White
Write-Host "   2. Upload to GCE VM: 136.112.111.167" -ForegroundColor White  
Write-Host "   3. Follow instructions in: $deployDir/DEPLOYMENT_INSTRUCTIONS.md" -ForegroundColor White
Write-Host ""
Write-Host "🌐 GCE VM Details:" -ForegroundColor Cyan
Write-Host "   - IP: 136.112.111.167" -ForegroundColor White
Write-Host "   - Backend Port: 3001 (HSS Management API)" -ForegroundColor White
Write-Host "   - Frontend Port: 3000 (GenieACS UI)" -ForegroundColor White
Write-Host ""
Write-Host "🎯 Frontend already deployed to: https://wisptools-production.web.app" -ForegroundColor Green

