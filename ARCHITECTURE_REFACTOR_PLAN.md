# Architecture Refactoring Plan: Firebase App Hosting + GCE Backend

## Executive Summary

This document outlines the complete refactoring strategy to separate the LTE WISP Management Platform into:
- **Frontend**: Firebase App Hosting (SvelteKit application)
- **Backend**: Google Compute Engine (GenieACS, STUN, firmware storage)

---

## Current Architecture

### Frontend (Module_Manager)
- **Platform**: Firebase App Hosting (Cloud Run)
- **Technology**: SvelteKit 5 + TypeScript
- **Components**:
  - Authentication (Firebase Auth)
  - Dashboard & Module System
  - PCI Resolution Module
  - ACS/CPE Management Module
  - Interactive ArcGIS Maps
- **Current Issues**:
  - Proxying GenieACS services through localhost (doesn't work in Cloud Run)
  - Cannot expose TR-069 CWMP port (7547) for CPE device connections
  - Cannot host long-running services

### Backend Services (Currently Mixed)
- **Firebase Functions**:
  - PCI analysis
  - MongoDB-backed presets/faults management
  - GenieACS bridge functions (limited)
- **GenieACS Services** (currently localhost, won't work in production):
  - **CWMP** (port 7547): TR-069 protocol for CPE device management
  - **NBI** (port 7557): REST API for device operations
  - **FS** (port 7567): Firmware/file server
  - **UI** (port 8080): GenieACS admin interface
- **Database**:
  - **Firestore**: User data, networks, PCI analyses
  - **MongoDB Atlas**: GenieACS device data, presets, faults

---

## Target Architecture

### Frontend: Firebase App Hosting
```
┌─────────────────────────────────────────────────┐
│   Firebase App Hosting (Cloud Run)              │
│                                                  │
│   ┌────────────────────────────────────────┐   │
│   │  SvelteKit Application                 │   │
│   │  - Authentication UI                   │   │
│   │  - Dashboard                           │   │
│   │  - PCI Resolution Module               │   │
│   │  - ACS/CPE Management UI               │   │
│   │  - ArcGIS Interactive Maps             │   │
│   └────────────────────────────────────────┘   │
│                                                  │
│   Connects to:                                  │
│   • Firebase Auth (authentication)              │
│   • Firestore (user data, networks)             │
│   • GCE Backend API (GenieACS operations)       │
│   • Cloud Storage (static assets)               │
└─────────────────────────────────────────────────┘
```

### Backend: Google Compute Engine
```
┌─────────────────────────────────────────────────────────────────┐
│  Google Compute Engine Instance (e2-medium or e2-standard-2)    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Docker Containers / Services                           │   │
│  │                                                          │   │
│  │  1. GenieACS Services                                   │   │
│  │     • CWMP Server (port 7547) ← CPE devices connect     │   │
│  │     • NBI API (port 7557)                               │   │
│  │     • File Server (port 7567)                           │   │
│  │     • UI Dashboard (port 8080)                          │   │
│  │                                                          │   │
│  │  2. Nginx Reverse Proxy (ports 80/443)                  │   │
│  │     • SSL/TLS termination                               │   │
│  │     • Routes to internal services                       │   │
│  │     • CORS handling                                     │   │
│  │     • Authentication middleware                         │   │
│  │                                                          │   │
│  │  3. STUN Server (port 3478/UDP)                         │   │
│  │     • Coturn STUN/TURN server                           │   │
│  │     • NAT traversal for CPE devices                     │   │
│  │     • Enables direct connections                        │   │
│  │                                                          │   │
│  │  4. Firmware Storage                                    │   │
│  │     • Local disk storage (/opt/genieacs/firmware)       │   │
│  │     • Served via File Server                            │   │
│  │     • Upload/download endpoints                         │   │
│  │     • Version management                                │   │
│  │                                                          │   │
│  │  5. Backend API Server (Node.js/Express) (port 3000)    │   │
│  │     • REST API for frontend                             │   │
│  │     • GenieACS integration                              │   │
│  │     • Firmware management                               │   │
│  │     • STUN/TURN configuration                           │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Persistent Storage:                                            │
│  • /opt/genieacs/firmware (firmware files)                      │
│  • /opt/genieacs/logs (service logs)                            │
│  • /opt/genieacs/config (configuration files)                   │
│                                                                  │
│  External Connections:                                          │
│  • MongoDB Atlas (GenieACS database)                            │
│  • Cloud Storage (backup firmware)                              │
│  • Firebase (authentication validation)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Network Architecture

### Port Configuration

| Service | Internal Port | External Port | Protocol | Public Access |
|---------|--------------|---------------|----------|---------------|
| Nginx HTTP | 80 | 80 | TCP | Yes |
| Nginx HTTPS | 443 | 443 | TCP | Yes |
| Backend API | 3000 | - | TCP | Via Nginx |
| CWMP (TR-069) | 7547 | 7547 | TCP | Yes (CPE devices) |
| NBI API | 7557 | - | TCP | Via Nginx |
| File Server | 7567 | - | TCP | Via Nginx |
| GenieACS UI | 8080 | - | TCP | Via Nginx |
| STUN | 3478 | 3478 | UDP | Yes |
| TURN | 3478 | 3478 | TCP | Yes (optional) |

### Firewall Rules (GCE)

```bash
# Allow HTTP/HTTPS
gcloud compute firewall-rules create allow-http-https \
  --allow tcp:80,tcp:443 \
  --target-tags=genieacs-backend

# Allow CWMP (TR-069)
gcloud compute firewall-rules create allow-cwmp \
  --allow tcp:7547 \
  --target-tags=genieacs-backend \
  --description="TR-069 CWMP for CPE devices"

# Allow STUN/TURN
gcloud compute firewall-rules create allow-stun-turn \
  --allow udp:3478,tcp:3478 \
  --target-tags=genieacs-backend \
  --description="STUN/TURN for NAT traversal"
```

---

## Implementation Plan

### Phase 1: GCE Infrastructure Setup

#### 1.1. Create GCE Instance
```bash
# Create instance with appropriate specs
gcloud compute instances create genieacs-backend \
  --project=lte-pci-mapper-65450042-bbf71 \
  --zone=us-central1-a \
  --machine-type=e2-standard-2 \
  --network-interface=network-tier=PREMIUM,subnet=default \
  --maintenance-policy=MIGRATE \
  --tags=genieacs-backend,http-server,https-server \
  --image=ubuntu-2004-focal-v20231213 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-balanced \
  --boot-disk-device-name=genieacs-backend
```

#### 1.2. Reserve Static IP
```bash
# Reserve external IP
gcloud compute addresses create genieacs-backend-ip \
  --region=us-central1

# Get the IP address
gcloud compute addresses describe genieacs-backend-ip \
  --region=us-central1 --format='value(address)'
```

#### 1.3. Initial Server Setup
```bash
# SSH into instance
gcloud compute ssh genieacs-backend --zone=us-central1-a

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Nginx
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### Phase 2: GenieACS Deployment

#### 2.1. Directory Structure
```bash
sudo mkdir -p /opt/genieacs/{firmware,logs,config,data}
sudo mkdir -p /opt/backend-api
sudo mkdir -p /opt/stun
```

#### 2.2. GenieACS Docker Compose
Create `/opt/genieacs/docker-compose.yml`:
```yaml
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
      - GENIEACS_MONGODB_CONNECTION_URL=mongodb+srv://genieacs-user:<password>@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority
      - GENIEACS_CWMP_INTERFACE=0.0.0.0
    volumes:
      - /opt/genieacs/logs:/var/log/genieacs
    restart: unless-stopped
    networks:
      - genieacs-network

  genieacs-nbi:
    image: drumsergio/genieacs:latest
    container_name: genieacs-nbi
    command: genieacs-nbi
    ports:
      - "7557:7557"
    environment:
      - GENIEACS_NBI_PORT=7557
      - GENIEACS_MONGODB_CONNECTION_URL=mongodb+srv://genieacs-user:<password>@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority
      - GENIEACS_NBI_INTERFACE=0.0.0.0
    volumes:
      - /opt/genieacs/logs:/var/log/genieacs
    restart: unless-stopped
    networks:
      - genieacs-network

  genieacs-fs:
    image: drumsergio/genieacs:latest
    container_name: genieacs-fs
    command: genieacs-fs
    ports:
      - "7567:7567"
    environment:
      - GENIEACS_FS_PORT=7567
      - GENIEACS_MONGODB_CONNECTION_URL=mongodb+srv://genieacs-user:<password>@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority
      - GENIEACS_FS_INTERFACE=0.0.0.0
      - GENIEACS_FS_HOSTNAME=<your-gce-ip-or-domain>
    volumes:
      - /opt/genieacs/firmware:/opt/genieacs/fs
      - /opt/genieacs/logs:/var/log/genieacs
    restart: unless-stopped
    networks:
      - genieacs-network

  genieacs-ui:
    image: drumsergio/genieacs:latest
    container_name: genieacs-ui
    command: genieacs-ui
    ports:
      - "8080:3000"
    environment:
      - GENIEACS_UI_PORT=3000
      - GENIEACS_MONGODB_CONNECTION_URL=mongodb+srv://genieacs-user:<password>@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority
    volumes:
      - /opt/genieacs/logs:/var/log/genieacs
    restart: unless-stopped
    networks:
      - genieacs-network

networks:
  genieacs-network:
    driver: bridge
```

### Phase 3: STUN Server Setup

#### 3.1. Install Coturn
```bash
sudo apt-get install -y coturn
```

#### 3.2. Configure Coturn
Create `/etc/turnserver.conf`:
```conf
# Listening interfaces
listening-ip=0.0.0.0
listening-port=3478
relay-ip=<GCE-INTERNAL-IP>
external-ip=<GCE-EXTERNAL-IP>

# STUN/TURN settings
fingerprint
lt-cred-mech

# Realm
realm=genieacs.yourdomain.com

# Logging
verbose
log-file=/var/log/turnserver.log

# Security
no-tlsv1
no-tlsv1_1

# User authentication (optional)
# user=username:password

# STUN-only mode (no TURN relay)
stun-only
```

#### 3.3. Enable and Start Coturn
```bash
sudo systemctl enable coturn
sudo systemctl start coturn
```

### Phase 4: Backend API Server

#### 4.1. Create Backend API
Create `/opt/backend-api/server.js`:
```javascript
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
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
app.use(express.json());

// Firmware upload configuration
const firmwareStorage = multer.diskStorage({
  destination: '/opt/genieacs/firmware/',
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});
const upload = multer({ storage: firmwareStorage });

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
let mongoClient;

async function connectMongo() {
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  console.log('Connected to MongoDB');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      genieacs_cwmp: 'running',
      genieacs_nbi: 'running',
      genieacs_fs: 'running',
      stun: 'running'
    }
  });
});

// GenieACS NBI proxy
app.all('/api/genieacs/nbi/*', async (req, res) => {
  const path = req.params[0];
  const url = `http://localhost:7557/${path}`;
  
  try {
    const response = await fetch(url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Firmware management
app.post('/api/firmware/upload', upload.single('firmware'), async (req, res) => {
  try {
    const { filename, path: filepath, size } = req.file;
    const { version, model, description } = req.body;
    
    // Save firmware metadata to MongoDB
    const db = mongoClient.db('genieacs');
    await db.collection('firmware').insertOne({
      filename,
      filepath,
      size,
      version,
      model,
      description,
      uploadedAt: new Date(),
      uploadedBy: req.user?.uid || 'system'
    });
    
    res.json({
      success: true,
      filename,
      size,
      url: `/api/firmware/download/${filename}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/firmware/list', async (req, res) => {
  try {
    const db = mongoClient.db('genieacs');
    const firmwareList = await db.collection('firmware')
      .find()
      .sort({ uploadedAt: -1 })
      .toArray();
    
    res.json(firmwareList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/firmware/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join('/opt/genieacs/firmware', filename);
    
    const stats = await fs.stat(filepath);
    if (!stats.isFile()) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filepath);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

app.delete('/api/firmware/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join('/opt/genieacs/firmware', filename);
    
    // Delete file
    await fs.unlink(filepath);
    
    // Delete from database
    const db = mongoClient.db('genieacs');
    await db.collection('firmware').deleteOne({ filename });
    
    res.json({ success: true, message: 'Firmware deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// STUN/TURN configuration endpoint
app.get('/api/stun/config', (req, res) => {
  res.json({
    stunServers: [
      {
        urls: `stun:${process.env.EXTERNAL_IP}:3478`
      }
    ],
    turnServers: [] // Add TURN if needed
  });
});

// Start server
connectMongo().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend API server running on port ${PORT}`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
```

#### 4.2. Package.json
Create `/opt/backend-api/package.json`:
```json
{
  "name": "genieacs-backend-api",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "mongodb": "^6.3.0"
  }
}
```

#### 4.3. Environment File
Create `/opt/backend-api/.env`:
```env
PORT=3000
MONGODB_URI=mongodb+srv://genieacs-user:<password>@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority
ALLOWED_ORIGINS=https://lte-pci-mapper-nfomthzoza-uc.a.run.app,https://lte-pci-mapper-65450042-bbf71.web.app
EXTERNAL_IP=<your-gce-external-ip>
```

#### 4.4. Systemd Service
Create `/etc/systemd/system/backend-api.service`:
```ini
[Unit]
Description=GenieACS Backend API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/backend-api
EnvironmentFile=/opt/backend-api/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable backend-api
sudo systemctl start backend-api
```

### Phase 5: Nginx Configuration

#### 5.1. Main Nginx Config
Create `/etc/nginx/sites-available/genieacs-backend`:
```nginx
# Backend API upstream
upstream backend_api {
    server 127.0.0.1:3000;
}

# GenieACS NBI upstream
upstream genieacs_nbi {
    server 127.0.0.1:7557;
}

# GenieACS FS upstream
upstream genieacs_fs {
    server 127.0.0.1:7567;
}

# GenieACS UI upstream
upstream genieacs_ui {
    server 127.0.0.1:8080;
}

# HTTP server (redirect to HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name <your-domain-or-ip>;

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name <your-domain-or-ip>;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/<your-domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<your-domain>/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # CORS headers
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;

    # Handle OPTIONS requests
    if ($request_method = 'OPTIONS') {
        return 204;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # GenieACS NBI
    location /nbi/ {
        proxy_pass http://genieacs_nbi/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # GenieACS File Server
    location /fs/ {
        proxy_pass http://genieacs_fs/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # GenieACS UI
    location /admin/ {
        proxy_pass http://genieacs_ui/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Health check
    location /health {
        proxy_pass http://backend_api/health;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/genieacs-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Phase 6: Frontend Refactoring

#### 6.1. Update Environment Variables
Update `Module_Manager/apphosting.yaml` to point to GCE backend:
```yaml
env:
  # GCE Backend Configuration
  - variable: PUBLIC_BACKEND_API_URL
    value: "https://<your-gce-domain-or-ip>/api"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_GENIEACS_NBI_URL
    value: "https://<your-gce-domain-or-ip>/nbi"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_GENIEACS_CWMP_URL
    value: "http://<your-gce-ip>:7547"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_GENIEACS_FS_URL
    value: "https://<your-gce-domain-or-ip>/fs"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_STUN_SERVER
    value: "stun:<your-gce-ip>:3478"
    availability:
      - BUILD
      - RUNTIME
```

#### 6.2. Remove Localhost Proxies
Delete these files (they're no longer needed):
- `Module_Manager/src/routes/cwmp/[...path]/+server.ts`
- `Module_Manager/src/routes/fs/[...path]/+server.ts`
- `Module_Manager/src/routes/nbi/[...path]/+server.ts`

#### 6.3. Update API Clients
Update GenieACS client to use new backend:

`Module_Manager/src/lib/genieacs/api/nbiClient.ts`:
```typescript
const BACKEND_API_URL = import.meta.env.PUBLIC_BACKEND_API_URL || 'https://your-gce-backend.com/api';
const GENIEACS_NBI_URL = import.meta.env.PUBLIC_GENIEACS_NBI_URL || 'https://your-gce-backend.com/nbi';

export class NBIClient {
  // Update all fetch calls to use GENIEACS_NBI_URL or BACKEND_API_URL
}
```

---

## Security Considerations

### 1. Authentication
- Implement Firebase Auth token validation on GCE backend
- Use API keys for service-to-service communication
- Implement rate limiting

### 2. Network Security
- Use Cloud Armor for DDoS protection
- Implement firewall rules (principle of least privilege)
- Enable VPC Service Controls
- Use private IPs where possible

### 3. Data Security
- Encrypt data in transit (HTTPS/TLS)
- Encrypt data at rest (GCE disk encryption)
- Regular security updates
- Implement audit logging

### 4. TR-069 Security
- Use connection request authentication
- Implement device certificate validation
- Monitor for suspicious device behavior
- Implement device whitelisting

---

## Cost Estimation

### GCE Instance (e2-standard-2)
- **vCPUs**: 2
- **Memory**: 8 GB
- **Cost**: ~$50/month (with sustained use discount)

### Storage
- **Boot disk**: 50 GB SSD (~$8/month)
- **Firmware storage**: ~$0.17/GB/month

### Network
- **Egress**: First 1 GB free, then $0.12/GB (Americas)
- **Static IP**: ~$7.20/month

### Total Estimated Cost
- **Base**: ~$65-75/month
- **With traffic**: ~$80-100/month (moderate usage)

---

## Monitoring & Maintenance

### Health Checks
```bash
# GenieACS services
docker ps
docker logs genieacs-cwmp
docker logs genieacs-nbi

# Backend API
sudo systemctl status backend-api
sudo journalctl -u backend-api -f

# STUN server
sudo systemctl status coturn
sudo journalctl -u coturn -f

# Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log
```

### Backup Strategy
1. **Firmware files**: Daily backup to Cloud Storage
2. **Configuration**: Version controlled in Git
3. **MongoDB**: Automated Atlas backups
4. **GCE disk snapshots**: Weekly snapshots

---

## Migration Checklist

- [ ] Create GCE instance with static IP
- [ ] Configure firewall rules
- [ ] Install and configure Docker
- [ ] Deploy GenieACS containers
- [ ] Install and configure Coturn (STUN)
- [ ] Deploy backend API server
- [ ] Configure Nginx reverse proxy
- [ ] Set up SSL certificates (Let's Encrypt)
- [ ] Update MongoDB connection strings
- [ ] Test GenieACS services locally
- [ ] Update frontend environment variables
- [ ] Remove frontend proxy routes
- [ ] Update API clients
- [ ] Test end-to-end connectivity
- [ ] Configure monitoring and logging
- [ ] Set up backup automation
- [ ] Update documentation
- [ ] Deploy frontend to Firebase App Hosting
- [ ] Test CPE device connections
- [ ] Verify firmware upload/download
- [ ] Test STUN server
- [ ] Monitor for issues

---

## Next Steps

1. **Create GCE instance and configure infrastructure**
2. **Deploy GenieACS services and STUN server**
3. **Set up backend API and Nginx**
4. **Update frontend configuration**
5. **Test and validate**
6. **Deploy to production**

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-10  
**Status**: Ready for Implementation

