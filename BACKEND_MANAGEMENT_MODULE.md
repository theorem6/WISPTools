# 🖥️ Backend Management Module - Complete!

## Overview

Created a new **admin-only module** for backend server management, separate from ACS/CPE management.

---

## ✅ What Was Created

### Frontend Module (Auto-deployed via Cloud Build)
```
Module_Manager/src/routes/modules/backend-management/
├── +page.svelte                      # Main admin page (platform admin only)
├── components/
│   ├── ServiceStatus.svelte          # PM2 service monitoring & control
│   ├── SystemResources.svelte        # CPU, memory, disk, uptime
│   └── QuickActions.svelte           # Restart all, reboot VM, view logs
```

### Backend API (Needs to be added to server)
```
backend-services/system-management.js
Routes:
- GET /api/system/services/status     # All PM2 services
- GET /api/system/resources            # CPU, memory, disk, uptime
- POST /api/system/services/:name/restart
- POST /api/system/services/:name/stop
- POST /api/system/services/:name/start
- POST /api/system/restart-all         # Restart all PM2 services
- POST /api/system/reboot               # Reboot entire VM
```

---

## 🔐 Security

**Platform Admin Only:**
- Only accessible to `david@david.com`
- Shows red "Platform Administrator Mode" banner
- Auto-redirects non-admins to modules page
- All backend API endpoints require admin authentication

---

## 🎯 Features

### Service Monitoring:
- ✅ Real-time status of all PM2 services
- ✅ Shows uptime, memory, CPU usage
- ✅ Restart count
- ✅ Auto-refresh every 10 seconds
- ✅ Status indicators (🟢 online, 🔴 offline, ⚪ unknown)

### Service Control:
- ✅ **Restart** - Restart individual service
- ✅ **Stop** - Stop service (shows Start button when stopped)
- ✅ **Start** - Start stopped service

### System Monitoring:
- ✅ **Memory** - Total, used, free, percentage
- ✅ **CPU** - Usage percentage, core count
- ✅ **Disk** - Total, used, available, percentage
- ✅ **Uptime** - System uptime
- ✅ **Load Average** - 1, 5, 15 minute averages

### Quick Actions:
- ✅ **Restart All Services** - Restart all PM2 services at once
- ✅ **Reboot VM** - Full system reboot (1-2 min downtime)
- ✅ **View Cloud Logs** - Opens Google Cloud Logging

---

## 📦 Backend Installation

### Step 1: Add to server.js

On your backend server (`/opt/hss-api/server.js`), add:

```javascript
// Add with other requires
const systemManagementRouter = require('./backend-services/system-management');

// Add with other route mounts
app.use('/api/system', systemManagementRouter);
```

### Step 2: Quick Installation Script

Paste this into SSH:

```bash
# Check if already added
grep -q "system-management" /opt/hss-api/server.js && echo "✅ Already added" || {
  # Backup
  sudo cp /opt/hss-api/server.js /opt/hss-api/server.js.backup.$(date +%Y%m%d_%H%M%S)
  
  # Add the require statement
  sudo sed -i '/const express = require/a const systemManagementRouter = require('\''./backend-services/system-management'\'');' /opt/hss-api/server.js
  
  # Add the route mount
  sudo sed -i '/module\.exports/i app.use('\''/api/system'\'', systemManagementRouter);\n' /opt/hss-api/server.js
  
  echo "✅ System management router added"
  
  # Restart
  pm2 restart hss-api
  pm2 logs hss-api --lines 20 --nostream
}
```

---

## 🧪 Testing

After Cloud Build deploys and you add the backend routes:

1. **Navigate to:** https://your-app.com/modules/backend-management
2. **Verify** red admin banner shows
3. **Check** service status cards appear
4. **Test** restart button on a service
5. **Monitor** system resources update

---

## 📋 Services Monitored

| Service | Port | Description | Control |
|---------|------|-------------|---------|
| **genieacs-nbi** | 7557 | Device management API | ✅ |
| **genieacs-cwmp** | 7547 | TR-069 ACS server | ✅ |
| **genieacs-fs** | 7567 | File server | ✅ |
| **genieacs-ui** | 8080 | Web interface | ✅ |
| **hss-api** | 3000 | HSS REST API | ✅ |
| **mongodb** | 27017 | Database | ⚠️ View only |

---

## ⚡ Quick Actions

### Restart All Services
- Restarts all PM2 services at once
- Useful after configuration changes
- ~5 second downtime

### Reboot VM
- Full system reboot
- 1-2 minute downtime
- Use for kernel updates or major issues

### View Cloud Logs
- Opens Google Cloud Logging console
- View detailed logs for all services
- Debug errors and issues

---

## 🎨 UI Features

- ✅ **Platform admin banner** - Red warning banner
- ✅ **Access control** - Auto-redirect for non-admins
- ✅ **Real-time updates** - Auto-refresh every 10 seconds
- ✅ **Status indicators** - Color-coded service status
- ✅ **Responsive design** - Works on mobile
- ✅ **CSS variables** - No hardcoded values
- ✅ **Confirmation dialogs** - Prevents accidental actions

---

## 🚀 Deployment

### Frontend:
✅ Auto-deploys via Cloud Build (commit d9c847d)

### Backend:
📋 Manual steps required:
1. Upload `backend-update.zip` (includes system-management.js)
2. Run `install-backend-modules.sh`
3. Add router to `server.js` (see script above)
4. Restart PM2

---

## 📍 Access URL

After deployment:
```
https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/modules/backend-management
```

**Only `david@david.com` can access** - all others redirected.

---

## ✅ Benefits

✅ **Centralized control** - Manage all services in one place  
✅ **Real-time monitoring** - Live status updates  
✅ **Quick troubleshooting** - Restart services without SSH  
✅ **System visibility** - See resource usage at a glance  
✅ **Secure** - Platform admin only  
✅ **Professional UI** - Clean, modern interface  

**Your new admin module is ready to deploy!** 🎉

---

*Created: October 17, 2025*  
*Module: /modules/backend-management*  
*Access: Platform Admin Only*

