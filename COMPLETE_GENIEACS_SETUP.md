# Complete GenieACS Integration Setup Guide

## 🏗️ Architecture Overview

```
CPE Devices (TR-069) → GenieACS Services → MongoDB → Firebase Functions → Firestore → ACS Module UI
```

## 📋 Prerequisites

### 1. Server Requirements
- **OS**: Ubuntu 20.04+ or CentOS 8+
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: 50GB+ free space
- **Network**: Public IP with ports 7547 (CWMP), 7557 (NBI), 8080 (UI) open

### 2. Software Requirements
- **Node.js**: v18+ 
- **MongoDB**: v5.0+
- **Git**: Latest version
- **PM2**: Process manager (optional)

## 🚀 Step 1: Install GenieACS

### Install Node.js and Dependencies
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Install GenieACS
```bash
# Clone GenieACS repository
git clone https://github.com/genieacs/genieacs.git
cd genieacs

# Install dependencies
npm install

# Build GenieACS
npm run build
```

## ⚙️ Step 2: Configure GenieACS

### Create Configuration Files
```bash
# Create config directory
sudo mkdir -p /etc/genieacs
sudo mkdir -p /var/log/genieacs
sudo mkdir -p /var/lib/genieacs
```

### GenieACS CWMP Configuration (`/etc/genieacs/config.json`)
```json
{
  "cwmp": {
    "port": 7547,
    "interface": "0.0.0.0",
    "ssl": false,
    "authentication": {
      "basic": {
        "username": "acs-username",
        "password": "acs-password"
      }
    }
  },
  "database": {
    "connectionString": "mongodb://localhost:27017/genieacs"
  },
  "files": {
    "uploadsPath": "/var/lib/genieacs/uploads"
  },
  "logging": {
    "level": "info",
    "path": "/var/log/genieacs/cwmp.log"
  }
}
```

### GenieACS NBI Configuration (`/etc/genieacs/nbi-config.json`)
```json
{
  "nbi": {
    "port": 7557,
    "interface": "0.0.0.0",
    "ssl": false,
    "authentication": {
      "basic": {
        "username": "nbi-username",
        "password": "nbi-password"
      }
    }
  },
  "database": {
    "connectionString": "mongodb://localhost:27017/genieacs"
  },
  "logging": {
    "level": "info",
    "path": "/var/log/genieacs/nbi.log"
  }
}
```

### GenieACS FS Configuration (`/etc/genieacs/fs-config.json`)
```json
{
  "fs": {
    "port": 7567,
    "interface": "0.0.0.0",
    "ssl": false,
    "uploadsPath": "/var/lib/genieacs/uploads",
    "downloadsPath": "/var/lib/genieacs/downloads"
  },
  "database": {
    "connectionString": "mongodb://localhost:27017/genieacs"
  },
  "logging": {
    "level": "info",
    "path": "/var/log/genieacs/fs.log"
  }
}
```

### GenieACS UI Configuration (`/etc/genieacs/ui-config.json`)
```json
{
  "ui": {
    "port": 8080,
    "interface": "0.0.0.0",
    "ssl": false,
    "staticPath": "/var/lib/genieacs/ui"
  },
  "database": {
    "connectionString": "mongodb://localhost:27017/genieacs"
  },
  "logging": {
    "level": "info",
    "path": "/var/log/genieacs/ui.log"
  }
}
```

## 🔧 Step 3: Create Systemd Services

### GenieACS CWMP Service (`/etc/systemd/system/genieacs-cwmp.service`)
```ini
[Unit]
Description=GenieACS CWMP Server
After=mongod.service
Wants=mongod.service

[Service]
Type=simple
User=genieacs
Group=genieacs
WorkingDirectory=/opt/genieacs
ExecStart=/usr/bin/node bin/genieacs-cwmp
Environment=NODE_ENV=production
Environment=GENIEACS_CONFIG_FILE=/etc/genieacs/config.json
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### GenieACS NBI Service (`/etc/systemd/system/genieacs-nbi.service`)
```ini
[Unit]
Description=GenieACS NBI Server
After=mongod.service
Wants=mongod.service

[Service]
Type=simple
User=genieacs
Group=genieacs
WorkingDirectory=/opt/genieacs
ExecStart=/usr/bin/node bin/genieacs-nbi
Environment=NODE_ENV=production
Environment=GENIEACS_CONFIG_FILE=/etc/genieacs/nbi-config.json
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### GenieACS FS Service (`/etc/systemd/system/genieacs-fs.service`)
```ini
[Unit]
Description=GenieACS File Server
After=mongod.service
Wants=mongod.service

[Service]
Type=simple
User=genieacs
Group=genieacs
WorkingDirectory=/opt/genieacs
ExecStart=/usr/bin/node bin/genieacs-fs
Environment=NODE_ENV=production
Environment=GENIEACS_CONFIG_FILE=/etc/genieacs/fs-config.json
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### GenieACS UI Service (`/etc/systemd/system/genieacs-ui.service`)
```ini
[Unit]
Description=GenieACS Web UI
After=mongod.service
Wants=mongod.service

[Service]
Type=simple
User=genieacs
Group=genieacs
WorkingDirectory=/opt/genieacs
ExecStart=/usr/bin/node bin/genieacs-ui
Environment=NODE_ENV=production
Environment=GENIEACS_CONFIG_FILE=/etc/genieacs/ui-config.json
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## 👤 Step 4: Create GenieACS User and Setup

```bash
# Create genieacs user
sudo useradd -r -s /bin/false genieacs

# Copy GenieACS to system location
sudo cp -r /path/to/genieacs /opt/genieacs
sudo chown -R genieacs:genieacs /opt/genieacs

# Create necessary directories
sudo mkdir -p /var/lib/genieacs/{uploads,downloads,ui}
sudo mkdir -p /var/log/genieacs
sudo chown -R genieacs:genieacs /var/lib/genieacs
sudo chown -R genieacs:genieacs /var/log/genieacs

# Copy configuration files
sudo cp /path/to/configs/* /etc/genieacs/
sudo chown -R genieacs:genieacs /etc/genieacs
```

## 🚀 Step 5: Enable and Start Services

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable genieacs-cwmp
sudo systemctl enable genieacs-nbi
sudo systemctl enable genieacs-fs
sudo systemctl enable genieacs-ui

# Start services
sudo systemctl start genieacs-cwmp
sudo systemctl start genieacs-nbi
sudo systemctl start genieacs-fs
sudo systemctl start genieacs-ui

# Check status
sudo systemctl status genieacs-cwmp
sudo systemctl status genieacs-nbi
sudo systemctl status genieacs-fs
sudo systemctl status genieacs-ui
```

## 🔥 Step 6: Configure Firebase Functions Bridge

### Update Firebase Functions to connect to GenieACS
```typescript
// In functions/src/genieacsIntegration.ts
const GENIEACS_NBI_URL = 'http://your-server-ip:7557';
const GENIEACS_UI_URL = 'http://your-server-ip:8080';

// Update the functions to proxy requests to GenieACS
export const proxyGenieACS = onRequest({
  region: 'us-central1',
  memory: '256MiB'
}, async (req, res) => {
  // Proxy requests to GenieACS NBI
  const response = await fetch(`${GENIEACS_NBI_URL}${req.path}`, {
    method: req.method,
    headers: req.headers,
    body: req.body
  });
  
  const data = await response.json();
  res.json(data);
});
```

## 🌐 Step 7: Configure Network and Security

### Firewall Rules
```bash
# Allow GenieACS ports
sudo ufw allow 7547/tcp  # CWMP
sudo ufw allow 7557/tcp  # NBI
sudo ufw allow 7567/tcp  # FS
sudo ufw allow 8080/tcp  # UI

# Allow MongoDB (if external access needed)
sudo ufw allow 27017/tcp
```

### Nginx Reverse Proxy (Optional)
```nginx
# /etc/nginx/sites-available/genieacs
server {
    listen 80;
    server_name your-domain.com;
    
    location /cwmp {
        proxy_pass http://localhost:7547;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /nbi {
        proxy_pass http://localhost:7557;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /fs {
        proxy_pass http://localhost:7567;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🧪 Step 8: Test the Integration

### Test GenieACS Services
```bash
# Test CWMP (should return empty response)
curl http://localhost:7547

# Test NBI (should return API info)
curl http://localhost:7557

# Test FS (should return file server info)
curl http://localhost:7567

# Test UI (should return web interface)
curl http://localhost:8080
```

### Test Firebase Functions Bridge
```bash
# Test Firebase Functions
curl https://us-central1-lte-pci-mapper.cloudfunctions.net/getCPEDevices
```

## 📊 Step 9: Monitor and Maintain

### Service Management Commands
```bash
# Check all services status
sudo systemctl status genieacs-*

# View logs
sudo journalctl -u genieacs-cwmp -f
sudo journalctl -u genieacs-nbi -f
sudo journalctl -u genieacs-fs -f
sudo journalctl -u genieacs-ui -f

# Restart services
sudo systemctl restart genieacs-cwmp
sudo systemctl restart genieacs-nbi
sudo systemctl restart genieacs-fs
sudo systemctl restart genieacs-ui
```

### Database Backup
```bash
# Backup MongoDB
mongodump --db genieacs --out /backup/genieacs-$(date +%Y%m%d)

# Restore MongoDB
mongorestore --db genieacs /backup/genieacs-20250106/genieacs
```

## 🎯 Expected Results

After completing this setup:

1. **GenieACS CWMP** running on port 7547 (TR-069 protocol)
2. **GenieACS NBI** running on port 7557 (REST API)
3. **GenieACS FS** running on port 7567 (File server)
4. **GenieACS UI** running on port 8080 (Web interface)
5. **MongoDB** storing all GenieACS data
6. **Firebase Functions** bridging to GenieACS services
7. **ACS Module** in your web app displaying CPE devices and data

## 🔧 Troubleshooting

### Common Issues:
1. **Services won't start**: Check logs with `journalctl -u service-name`
2. **MongoDB connection errors**: Verify MongoDB is running and accessible
3. **Port conflicts**: Check if ports are already in use with `netstat -tlnp`
4. **Permission errors**: Ensure genieacs user owns all files and directories

### Useful Commands:
```bash
# Check if ports are listening
sudo netstat -tlnp | grep -E ':(7547|7557|7567|8080)'

# Check MongoDB status
sudo systemctl status mongod

# Check GenieACS logs
sudo tail -f /var/log/genieacs/*.log
```

This setup provides a complete, production-ready GenieACS installation that integrates with your Firebase-based ACS module! 🚀
