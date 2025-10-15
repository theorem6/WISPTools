# Frontend to Backend Connection Configuration

## Backend Server
**IP Address:** `136.112.111.167`

## Services Running on Backend

| Service | Port | URL | Status |
|---------|------|-----|--------|
| GenieACS CWMP (TR-069) | 7547 | http://136.112.111.167:7547 | ✅ Running |
| GenieACS NBI (API) | 7557 | http://136.112.111.167:7557 | ✅ Running |
| GenieACS File Server | 7567 | http://136.112.111.167:7567 | ✅ Running |
| GenieACS UI | 3333 | http://136.112.111.167:3333 | ✅ Running |
| Open5GS HSS (S6a/Diameter) | 3868 | - | ✅ Running |
| HSS Management API | 3000 | http://136.112.111.167:3000 | ❌ NOT DEPLOYED YET |

## Frontend Environment Configuration

### Step 1: Create `.env` file in `Module_Manager/` directory

```bash
cd Module_Manager
cat > .env << 'EOF'
# Backend Server: 136.112.111.167

# GenieACS Services
PUBLIC_GENIEACS_NBI_URL=http://136.112.111.167:7557
PUBLIC_GENIEACS_CWMP_URL=http://136.112.111.167:7547
PUBLIC_GENIEACS_FS_URL=http://136.112.111.167:7567
PUBLIC_GENIEACS_UI_URL=http://136.112.111.167:3333

# HSS Management API (needs deployment)
VITE_HSS_API_URL=http://136.112.111.167:3000

# Backend API
PUBLIC_BACKEND_API_URL=http://136.112.111.167:3000/api

# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyCaMoHY6ZKcV_uazY0HlwolxVgPwwLT8V0
VITE_FIREBASE_AUTH_DOMAIN=lte-pci-mapper-65450042-bbf71.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=lte-pci-mapper-65450042-bbf71
VITE_FIREBASE_STORAGE_BUCKET=lte-pci-mapper-65450042-bbf71.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1044782186913
VITE_FIREBASE_APP_ID=1:1044782186913:web:e1d47cdb7b1d89bb0b6f9c
VITE_FIREBASE_MEASUREMENT_ID=
EOF
```

### Step 2: Rebuild Frontend

```bash
npm run build
```

### Step 3: Deploy Frontend

Deploy to Firebase Hosting:
```bash
firebase deploy --only hosting
```

## What's Missing: HSS Management API

The **Node.js HSS Management API** is not yet deployed on the server. You currently have:
- ✅ Open5GS HSS daemon (C-based, for MME S6a/Diameter authentication)
- ✅ GenieACS services (for CPE management)
- ❌ Node.js HSS Management API (for subscriber CRUD operations via web UI)

### To Deploy HSS Management API

You need to deploy the Node.js HSS management API from `hss-module/` to the server. Here's a quick deployment script:

<details>
<summary>Click to expand HSS Management API deployment script</summary>

```bash
#!/bin/bash
# Deploy HSS Management API to server

MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

# Create HSS API directory
mkdir -p /opt/hss-api
cd /opt/hss-api

# Install dependencies
npm init -y
npm install express mongoose cors body-parser dotenv

# Create server file
cat > server.js << 'EOFJS'
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hss';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Dashboard stats
app.get('/dashboard/stats', async (req, res) => {
  try {
    const stats = {
      totalSubscribers: 0,
      activeSubscribers: 0,
      inactiveSubscribers: 0,
      totalGroups: 0,
      recentActivations: 0
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`🚀 HSS Management API running on port \${PORT}\`);
});
EOFJS

# Create .env file
cat > .env << EOFENV
MONGODB_URI=$MONGODB_URI
PORT=3000
NODE_ENV=production
EOFENV

# Create systemd service
cat > /etc/systemd/system/hss-api.service << 'EOFSVC'
[Unit]
Description=HSS Management API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hss-api
EnvironmentFile=/opt/hss-api/.env
ExecStart=/usr/bin/node /opt/hss-api/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOFSVC

# Start service
systemctl daemon-reload
systemctl enable hss-api
systemctl start hss-api

# Check status
sleep 2
systemctl status hss-api --no-pager
curl http://localhost:3000/health

echo ""
echo "✅ HSS Management API deployed!"
echo "Test: curl http://136.112.111.167:3000/health"
```

</details>

## Testing the Connection

### Test GenieACS API:
```bash
curl http://136.112.111.167:7557/devices
```

### Test HSS API (once deployed):
```bash
curl http://136.112.111.167:3000/health
curl http://136.112.111.167:3000/dashboard/stats
```

### Access GenieACS UI:
Open in browser: http://136.112.111.167:3333

## Quick Setup Commands

**On your local machine (Windows):**
```powershell
cd Module_Manager

# Create .env file with backend IP
@"
PUBLIC_GENIEACS_NBI_URL=http://136.112.111.167:7557
PUBLIC_GENIEACS_CWMP_URL=http://136.112.111.167:7547
PUBLIC_GENIEACS_FS_URL=http://136.112.111.167:7567
PUBLIC_GENIEACS_UI_URL=http://136.112.111.167:3333
VITE_HSS_API_URL=http://136.112.111.167:3000
PUBLIC_BACKEND_API_URL=http://136.112.111.167:3000/api
"@ | Out-File -FilePath .env -Encoding UTF8

# Build and deploy
npm run build
firebase deploy --only hosting
```

**On your server (to deploy HSS API):**
```bash
# SSH into 136.112.111.167 and run the HSS API deployment script above
```

## Summary

1. ✅ GenieACS is running and accessible
2. ✅ Open5GS HSS daemon is running (for MME authentication)
3. ❌ HSS Management API needs to be deployed for web UI subscriber management
4. ⏳ Frontend needs `.env` file created and redeployed

**Next step:** Create the `.env` file locally and deploy HSS Management API to the server.

