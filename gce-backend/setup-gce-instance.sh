#!/bin/bash

# GCE Instance Setup Script for GenieACS Backend
# This script sets up a complete GenieACS backend infrastructure on Google Compute Engine
# Run this script after creating and SSH'ing into your GCE instance

set -e

echo "=================================="
echo "GenieACS Backend Setup for GCE"
echo "=================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_error "Please do not run this script as root. It will use sudo when needed."
    exit 1
fi

# Prompt for configuration
echo "Please provide the following information:"
read -p "MongoDB Connection URI: " MONGODB_URI
read -p "MongoDB Database Name (default: genieacs): " MONGODB_DATABASE
MONGODB_DATABASE=${MONGODB_DATABASE:-genieacs}
read -p "External Domain or IP for CWMP connections: " EXTERNAL_DOMAIN
read -p "Firebase App URL (e.g., https://your-app.web.app): " FIREBASE_APP_URL
read -p "Your email for Let's Encrypt SSL: " SSL_EMAIL

# Get external IP
EXTERNAL_IP=$(curl -s ifconfig.me)
print_status "Detected external IP: $EXTERNAL_IP"

# Get internal IP
INTERNAL_IP=$(hostname -I | awk '{print $1}')
print_status "Detected internal IP: $INTERNAL_IP"

echo ""
echo "Configuration Summary:"
echo "  MongoDB URI: $MONGODB_URI"
echo "  MongoDB Database: $MONGODB_DATABASE"
echo "  External Domain: $EXTERNAL_DOMAIN"
echo "  External IP: $EXTERNAL_IP"
echo "  Internal IP: $INTERNAL_IP"
echo "  Firebase URL: $FIREBASE_APP_URL"
echo ""
read -p "Continue with this configuration? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    print_error "Setup cancelled"
    exit 1
fi

# Update system
print_status "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install required packages
print_status "Installing required packages..."
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw \
    htop

# Install Docker
print_status "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    print_status "Docker installed successfully"
else
    print_status "Docker is already installed"
fi

# Install Docker Compose
print_status "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed successfully"
else
    print_status "Docker Compose is already installed"
fi

# Install Node.js 20
print_status "Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    print_status "Node.js $(node -v) installed successfully"
else
    print_status "Node.js $(node -v) is already installed"
fi

# Install Nginx
print_status "Installing Nginx..."
sudo apt-get install -y nginx

# Install Certbot for SSL
print_status "Installing Certbot..."
sudo apt-get install -y certbot python3-certbot-nginx

# Install Coturn (STUN/TURN server)
print_status "Installing Coturn..."
sudo apt-get install -y coturn

# Create directory structure
print_status "Creating directory structure..."
sudo mkdir -p /opt/genieacs/{firmware,logs,config,data}
sudo mkdir -p /opt/backend-api
sudo mkdir -p /opt/stun
sudo mkdir -p /var/log/genieacs

# Set permissions
sudo chown -R $USER:$USER /opt/genieacs
sudo chown -R $USER:$USER /opt/backend-api

# Create GenieACS Docker Compose file
print_status "Creating GenieACS Docker Compose configuration..."
cat > /opt/genieacs/docker-compose.yml <<EOF
version: '3.8'

services:
  genieacs-cwmp:
    image: drumsergio/genieacs:latest
    container_name: genieacs-cwmp
    command: genieacs-cwmp
    ports:
      - "7547:7547"
    environment:
      - GENIEACS_CWMP_PORT=7547
      - GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}
      - GENIEACS_CWMP_INTERFACE=0.0.0.0
      - GENIEACS_CWMP_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-cwmp-access.log
      - NODE_OPTIONS=--max-old-space-size=2048
    volumes:
      - /opt/genieacs/logs:/var/log/genieacs
      - /opt/genieacs/config:/opt/genieacs/config
    restart: unless-stopped
    networks:
      - genieacs-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  genieacs-nbi:
    image: drumsergio/genieacs:latest
    container_name: genieacs-nbi
    command: genieacs-nbi
    ports:
      - "7557:7557"
    environment:
      - GENIEACS_NBI_PORT=7557
      - GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}
      - GENIEACS_NBI_INTERFACE=0.0.0.0
      - GENIEACS_NBI_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-nbi-access.log
      - NODE_OPTIONS=--max-old-space-size=2048
    volumes:
      - /opt/genieacs/logs:/var/log/genieacs
      - /opt/genieacs/config:/opt/genieacs/config
    restart: unless-stopped
    networks:
      - genieacs-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  genieacs-fs:
    image: drumsergio/genieacs:latest
    container_name: genieacs-fs
    command: genieacs-fs
    ports:
      - "7567:7567"
    environment:
      - GENIEACS_FS_PORT=7567
      - GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}
      - GENIEACS_FS_INTERFACE=0.0.0.0
      - GENIEACS_FS_HOSTNAME=${EXTERNAL_DOMAIN}
      - GENIEACS_FS_ACCESS_LOG_FILE=/var/log/genieacs/genieacs-fs-access.log
      - NODE_OPTIONS=--max-old-space-size=2048
    volumes:
      - /opt/genieacs/firmware:/opt/genieacs/ext
      - /opt/genieacs/logs:/var/log/genieacs
      - /opt/genieacs/config:/opt/genieacs/config
    restart: unless-stopped
    networks:
      - genieacs-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  genieacs-ui:
    image: drumsergio/genieacs:latest
    container_name: genieacs-ui
    command: genieacs-ui
    ports:
      - "8080:3000"
    environment:
      - GENIEACS_UI_PORT=3000
      - GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}
      - NODE_OPTIONS=--max-old-space-size=2048
    volumes:
      - /opt/genieacs/logs:/var/log/genieacs
      - /opt/genieacs/config:/opt/genieacs/config
    restart: unless-stopped
    networks:
      - genieacs-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  genieacs-network:
    driver: bridge
EOF

print_status "GenieACS Docker Compose file created"

# Create Backend API server
print_status "Creating Backend API server..."
cat > /opt/backend-api/server.js <<'EOF'
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Firmware upload configuration
const firmwareDir = '/opt/genieacs/firmware';
const firmwareStorage = multer.diskStorage({
  destination: firmwareDir,
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${sanitized}`);
  }
});
const upload = multer({ 
  storage: firmwareStorage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'genieacs';
let mongoClient;

async function connectMongo() {
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  console.log('Connected to MongoDB');
}

// Health check
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };

  // Check GenieACS services
  const services = [
    { name: 'cwmp', port: 7547 },
    { name: 'nbi', port: 7557 },
    { name: 'fs', port: 7567 },
    { name: 'ui', port: 8080 }
  ];

  for (const service of services) {
    try {
      const response = await fetch(`http://localhost:${service.port}/`, { 
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      health.services[`genieacs_${service.name}`] = response.ok ? 'running' : 'unhealthy';
    } catch (error) {
      health.services[`genieacs_${service.name}`] = 'down';
    }
  }

  // Check MongoDB
  try {
    await mongoClient.db().admin().ping();
    health.services.mongodb = 'running';
  } catch (error) {
    health.services.mongodb = 'down';
  }

  const allHealthy = Object.values(health.services).every(s => s === 'running');
  res.status(allHealthy ? 200 : 503).json(health);
});

// GenieACS NBI proxy
app.all('/genieacs/nbi/*', async (req, res) => {
  const path = req.params[0];
  const url = `http://localhost:7557/${path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;
  
  try {
    const options = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(url, options);
    const data = await response.text();
    
    res.status(response.status)
       .set('Content-Type', response.headers.get('content-type'))
       .send(data);
  } catch (error) {
    console.error('NBI Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Firmware management
app.post('/firmware/upload', upload.single('firmware'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, path: filepath, size } = req.file;
    const { version, model, description } = req.body;
    
    // Save firmware metadata to MongoDB
    const db = mongoClient.db(MONGODB_DATABASE);
    const result = await db.collection('firmware').insertOne({
      filename,
      originalName: req.file.originalname,
      filepath,
      size,
      version: version || 'unknown',
      model: model || 'unknown',
      description: description || '',
      uploadedAt: new Date(),
      uploadedBy: req.headers['x-user-id'] || 'system'
    });
    
    res.json({
      success: true,
      id: result.insertedId,
      filename,
      size,
      url: `/api/firmware/download/${filename}`
    });
  } catch (error) {
    console.error('Firmware upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/firmware/list', async (req, res) => {
  try {
    const db = mongoClient.db(MONGODB_DATABASE);
    const firmwareList = await db.collection('firmware')
      .find()
      .sort({ uploadedAt: -1 })
      .toArray();
    
    res.json(firmwareList);
  } catch (error) {
    console.error('Firmware list error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/firmware/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(firmwareDir, filename);
    
    const stats = await fs.stat(filepath);
    if (!stats.isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filepath);
  } catch (error) {
    console.error('Firmware download error:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

app.delete('/firmware/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(firmwareDir, filename);
    
    // Delete file
    await fs.unlink(filepath);
    
    // Delete from database
    const db = mongoClient.db(MONGODB_DATABASE);
    await db.collection('firmware').deleteOne({ filename });
    
    res.json({ success: true, message: 'Firmware deleted' });
  } catch (error) {
    console.error('Firmware delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// STUN/TURN configuration endpoint
app.get('/stun/config', (req, res) => {
  res.json({
    stunServers: [
      {
        urls: `stun:${process.env.EXTERNAL_IP}:3478`
      }
    ],
    turnServers: []
  });
});

// Device statistics
app.get('/devices/stats', async (req, res) => {
  try {
    const db = mongoClient.db(MONGODB_DATABASE);
    const total = await db.collection('devices').countDocuments();
    const online = await db.collection('devices').countDocuments({
      '_lastInform': { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });
    
    res.json({
      total,
      online,
      offline: total - online
    });
  } catch (error) {
    console.error('Device stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
connectMongo().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend API server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});
EOF

# Create Backend API package.json
cat > /opt/backend-api/package.json <<EOF
{
  "name": "genieacs-backend-api",
  "version": "1.0.0",
  "description": "Backend API for GenieACS integration",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "NODE_ENV=development node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "mongodb": "^6.3.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
EOF

# Create Backend API environment file
cat > /opt/backend-api/.env <<EOF
PORT=3000
NODE_ENV=production
MONGODB_URI=${MONGODB_URI}
MONGODB_DATABASE=${MONGODB_DATABASE}
ALLOWED_ORIGINS=${FIREBASE_APP_URL}
EXTERNAL_IP=${EXTERNAL_IP}
EOF

# Install Backend API dependencies
print_status "Installing Backend API dependencies..."
cd /opt/backend-api
npm install

# Create systemd service for Backend API
print_status "Creating systemd service for Backend API..."
sudo tee /etc/systemd/system/backend-api.service > /dev/null <<EOF
[Unit]
Description=GenieACS Backend API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/backend-api
EnvironmentFile=/opt/backend-api/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Configure Coturn (STUN/TURN server)
print_status "Configuring Coturn..."
sudo tee /etc/turnserver.conf > /dev/null <<EOF
# Listening interfaces
listening-ip=${INTERNAL_IP}
listening-port=3478
relay-ip=${INTERNAL_IP}
external-ip=${EXTERNAL_IP}

# STUN/TURN settings
fingerprint
lt-cred-mech

# Realm
realm=${EXTERNAL_DOMAIN}

# Logging
verbose
log-file=/var/log/turnserver.log

# Security
no-tlsv1
no-tlsv1_1
no-dtls

# STUN-only mode (disable TURN relay to save bandwidth)
stun-only

# Performance
max-bps=0
min-port=49152
max-port=65535
EOF

# Enable Coturn
sudo sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn

# Configure Nginx
print_status "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/genieacs-backend > /dev/null <<EOF
# Backend API upstream
upstream backend_api {
    server 127.0.0.1:3000;
    keepalive 32;
}

# GenieACS NBI upstream
upstream genieacs_nbi {
    server 127.0.0.1:7557;
    keepalive 32;
}

# GenieACS FS upstream
upstream genieacs_fs {
    server 127.0.0.1:7567;
    keepalive 32;
}

# GenieACS UI upstream
upstream genieacs_ui {
    server 127.0.0.1:8080;
    keepalive 32;
}

# HTTP server
server {
    listen 80;
    listen [::]:80;
    server_name ${EXTERNAL_DOMAIN} ${EXTERNAL_IP};

    # Health check (no redirect)
    location /health {
        proxy_pass http://backend_api/health;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${EXTERNAL_DOMAIN} ${EXTERNAL_IP};

    # SSL certificates (will be configured by certbot)
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # CORS headers
    add_header 'Access-Control-Allow-Origin' '\$http_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS, PATCH' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-User-Id' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Max-Age' '3600' always;

    # Handle OPTIONS requests
    if (\$request_method = 'OPTIONS') {
        return 204;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend_api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # GenieACS NBI
    location /nbi/ {
        proxy_pass http://genieacs_nbi/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }

    # GenieACS File Server
    location /fs/ {
        proxy_pass http://genieacs_fs/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        client_max_body_size 100M;
        proxy_read_timeout 600s;
    }

    # GenieACS UI
    location /admin/ {
        proxy_pass http://genieacs_ui/;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Root endpoint
    location / {
        return 200 '{"status":"ok","message":"GenieACS Backend"}';
        add_header Content-Type application/json;
    }
}
EOF

# Enable Nginx site
sudo ln -sf /etc/nginx/sites-available/genieacs-backend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
print_status "Testing Nginx configuration..."
sudo nginx -t

# Configure firewall
print_status "Configuring UFW firewall..."
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 7547/tcp comment 'TR-069 CWMP'
sudo ufw allow 3478/udp comment 'STUN'
sudo ufw allow 3478/tcp comment 'TURN'
sudo ufw status

# Start services
print_status "Starting services..."

# Start GenieACS containers
cd /opt/genieacs
docker-compose up -d

# Start Backend API
sudo systemctl daemon-reload
sudo systemctl enable backend-api
sudo systemctl start backend-api

# Start Coturn
sudo systemctl enable coturn
sudo systemctl start coturn

# Reload Nginx
sudo systemctl enable nginx
sudo systemctl restart nginx

# Wait for services to start
print_status "Waiting for services to start..."
sleep 10

# Check service status
print_status "Checking service status..."
echo ""
echo "GenieACS Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Backend API:"
sudo systemctl status backend-api --no-pager -l | head -10
echo ""
echo "Coturn:"
sudo systemctl status coturn --no-pager -l | head -10
echo ""
echo "Nginx:"
sudo systemctl status nginx --no-pager -l | head -10

# Setup SSL certificate (if domain is provided)
if [ "$EXTERNAL_DOMAIN" != "$EXTERNAL_IP" ]; then
    print_warning "SSL certificate setup..."
    print_warning "Make sure your domain ${EXTERNAL_DOMAIN} points to ${EXTERNAL_IP}"
    read -p "Has your domain DNS been configured? (y/n): " DNS_READY
    
    if [ "$DNS_READY" == "y" ]; then
        print_status "Obtaining SSL certificate..."
        sudo certbot --nginx -d ${EXTERNAL_DOMAIN} --non-interactive --agree-tos -m ${SSL_EMAIL} --redirect
    else
        print_warning "SSL certificate skipped. Run this later:"
        echo "  sudo certbot --nginx -d ${EXTERNAL_DOMAIN}"
    fi
fi

# Create monitoring script
print_status "Creating monitoring script..."
cat > /opt/monitor.sh <<'MONITOR_EOF'
#!/bin/bash

echo "===== GenieACS Backend Status ====="
echo ""
echo "Docker Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}"
echo ""
echo "Backend API:"
sudo systemctl status backend-api --no-pager -l | grep -E "(Active|Memory|CPU)" | head -3
echo ""
echo "Coturn:"
sudo systemctl status coturn --no-pager -l | grep Active
echo ""
echo "Nginx:"
sudo systemctl status nginx --no-pager -l | grep Active
echo ""
echo "Health Check:"
curl -s http://localhost:3000/health | jq .
echo ""
echo "Disk Usage:"
df -h | grep -E "(Filesystem|/dev/sda1|/opt)"
echo ""
echo "Memory Usage:"
free -h
MONITOR_EOF

chmod +x /opt/monitor.sh

# Create backup script
print_status "Creating backup script..."
cat > /opt/backup-firmware.sh <<'BACKUP_EOF'
#!/bin/bash
# Backup firmware to Cloud Storage
# Configure gsutil first: gcloud auth login

BACKUP_BUCKET="gs://your-backup-bucket/firmware-backups"
BACKUP_DATE=$(date +%Y-%m-%d)

echo "Backing up firmware to ${BACKUP_BUCKET}/${BACKUP_DATE}..."
gsutil -m rsync -r /opt/genieacs/firmware ${BACKUP_BUCKET}/${BACKUP_DATE}/
echo "Backup complete!"
BACKUP_EOF

chmod +x /opt/backup-firmware.sh

# Final summary
echo ""
echo "==========================================="
print_status "Setup Complete!"
echo "==========================================="
echo ""
echo "Services Status:"
echo "  GenieACS CWMP: http://${EXTERNAL_IP}:7547"
echo "  GenieACS NBI:  https://${EXTERNAL_DOMAIN}/nbi/"
echo "  GenieACS FS:   https://${EXTERNAL_DOMAIN}/fs/"
echo "  GenieACS UI:   https://${EXTERNAL_DOMAIN}/admin/"
echo "  Backend API:   https://${EXTERNAL_DOMAIN}/api/"
echo "  Health Check:  https://${EXTERNAL_DOMAIN}/api/health"
echo "  STUN Server:   stun:${EXTERNAL_IP}:3478"
echo ""
echo "Configuration Files:"
echo "  GenieACS:     /opt/genieacs/docker-compose.yml"
echo "  Backend API:  /opt/backend-api/server.js"
echo "  Backend Env:  /opt/backend-api/.env"
echo "  Nginx:        /etc/nginx/sites-available/genieacs-backend"
echo "  Coturn:       /etc/turnserver.conf"
echo ""
echo "Useful Commands:"
echo "  Monitor status:      /opt/monitor.sh"
echo "  View API logs:       sudo journalctl -u backend-api -f"
echo "  View GenieACS logs:  docker-compose -f /opt/genieacs/docker-compose.yml logs -f"
echo "  Restart services:    cd /opt/genieacs && docker-compose restart"
echo "  Backup firmware:     /opt/backup-firmware.sh"
echo ""
print_warning "Next steps:"
echo "  1. Test health endpoint: curl https://${EXTERNAL_DOMAIN}/api/health"
echo "  2. Configure CPE devices to connect to: http://${EXTERNAL_IP}:7547"
echo "  3. Update frontend environment variables"
echo "  4. Set up automated backups (cron job)"
echo "  5. Configure monitoring/alerting"
echo ""
print_status "Done!"

