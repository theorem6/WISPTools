# 🔧 Add Service Management API to Backend

## Overview

The new service management page needs API endpoints on the backend to check status and control PM2 services.

---

## 📋 Backend Changes Needed

### Add to your main backend server file (e.g., `/opt/hss-api/server.js` or equivalent):

```javascript
// Add near the top with other imports
const serviceManagementRouter = require('./backend-services/service-management');

// Add with other route mounts
app.use('/api/services', serviceManagementRouter);
```

---

## 🚀 Quick Installation (On Backend Server)

### Option 1: If you have the backend-update.zip uploaded:

The `service-management.js` file is already included in the zip. After extracting:

```bash
# The file will be at:
# /opt/hss-api/backend-services/service-management.js

# Now add it to your server:
# Edit your main server file and add the route
nano /opt/hss-api/server.js  # or whatever your main file is
```

### Option 2: Create the file manually via SSH:

Paste this into SSH terminal:

```bash
cat > /opt/hss-api/backend-services/service-management.js << 'ENDOFFILE'
// Service Management API
const express = require('express');
const { execSync } = require('child_process');
const router = express.Router();

const SERVICES = [
  { name: 'genieacs-nbi', displayName: 'GenieACS NBI', port: 7557, canRestart: true },
  { name: 'genieacs-cwmp', displayName: 'GenieACS CWMP', port: 7547, canRestart: true },
  { name: 'genieacs-fs', displayName: 'GenieACS FS', port: 7567, canRestart: true },
  { name: 'genieacs-ui', displayName: 'GenieACS UI', port: 8080, canRestart: true },
  { name: 'hss-api', displayName: 'HSS API', port: 3000, canRestart: true }
];

router.get('/:serviceName/status', (req, res) => {
  try {
    const { serviceName } = req.params;
    const service = SERVICES.find(s => s.name === serviceName);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    
    const output = execSync('pm2 jlist', { encoding: 'utf8' });
    const processes = JSON.parse(output);
    const process = processes.find(p => p.name === serviceName);
    
    if (process) {
      res.json({
        success: true,
        service: serviceName,
        status: process.pm2_env.status,
        running: process.pm2_env.status === 'online',
        uptime: process.pm2_env.pm_uptime,
        memory: process.monit.memory,
        cpu: process.monit.cpu
      });
    } else {
      res.json({ success: true, service: serviceName, status: 'stopped', running: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to check service status' });
  }
});

router.get('/all/status', (req, res) => {
  try {
    const output = execSync('pm2 jlist', { encoding: 'utf8' });
    const processes = JSON.parse(output);
    
    const serviceStatuses = SERVICES.map(service => {
      const process = processes.find(p => p.name === service.name);
      return process ? {
        name: service.name,
        displayName: service.displayName,
        port: service.port,
        status: process.pm2_env.status,
        running: process.pm2_env.status === 'online',
        canRestart: service.canRestart
      } : {
        name: service.name,
        displayName: service.displayName,
        port: service.port,
        status: 'stopped',
        running: false,
        canRestart: service.canRestart
      };
    });
    
    res.json({ success: true, services: serviceStatuses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get services status' });
  }
});

router.post('/:serviceName/restart', (req, res) => {
  try {
    const { serviceName } = req.params;
    const service = SERVICES.find(s => s.name === serviceName && s.canRestart);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    
    execSync(`pm2 restart ${serviceName}`);
    res.json({ success: true, message: `${service.displayName} restarted` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restart service' });
  }
});

router.post('/:serviceName/stop', (req, res) => {
  try {
    const { serviceName } = req.params;
    const service = SERVICES.find(s => s.name === serviceName && s.canRestart);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    
    execSync(`pm2 stop ${serviceName}`);
    res.json({ success: true, message: `${service.displayName} stopped` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop service' });
  }
});

router.post('/:serviceName/start', (req, res) => {
  try {
    const { serviceName } = req.params;
    const service = SERVICES.find(s => s.name === serviceName && s.canRestart);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    
    execSync(`pm2 start ${serviceName}`);
    res.json({ success: true, message: `${service.displayName} started` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start service' });
  }
});

module.exports = router;
ENDOFFILE

echo "✅ Service management API created"
```

---

## 🔌 Mount the Router

Find your main server file and add:

```javascript
// At the top
const serviceManagementRouter = require('./backend-services/service-management');

// With other routes
app.use('/api/services', serviceManagementRouter);
```

Then restart:

```bash
pm2 restart hss-api
```

---

## 🧪 Test the API

```bash
# Test status endpoint
curl http://localhost:3000/api/services/all/status

# Test restart
curl -X POST http://localhost:3000/api/services/genieacs-nbi/restart
```

---

## ✅ Result

After adding this, the ACS Admin → Services page will:
- ✅ Show real-time service status
- ✅ Display uptime, memory, CPU
- ✅ Allow restart/stop/start of services
- ✅ Auto-refresh every 30 seconds

**Add this to your backend and the service management will work!** 🎉

