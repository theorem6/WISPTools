# 🚀 Final Backend Setup

## What You Need to Do

### 1. Upload & Install Backend Files

```powershell
# Upload from PowerShell
scp backend-update.zip david@136.112.111.167:/home/david/
scp install-backend-modules.sh david@136.112.111.167:/home/david/
```

```bash
# Install on backend SSH
cd /home/david
chmod +x install-backend-modules.sh
./install-backend-modules.sh
```

### 2. Add System Management Router to server.js

```bash
# Quick one-liner to add the router
sudo sed -i '/const express = require/a const systemManagementRouter = require('\''./backend-services/system-management'\'');' /opt/hss-api/server.js && \
sudo sed -i '/module\.exports/i app.use('\''/api/system'\'', systemManagementRouter);\n' /opt/hss-api/server.js && \
pm2 restart hss-api && \
echo "✅ System management router added and service restarted"
```

---

## ✅ What You'll Get

### New Module: `/modules/backend-management`

**Platform Admin Only (david@david.com):**
- 🔧 Monitor all PM2 services
- ⚡ Restart/Stop/Start services
- 📊 View CPU, memory, disk usage
- 🔄 Restart all services at once
- 🔴 Reboot entire VM
- 📋 Quick link to Cloud Logs

**Features:**
- Auto-refreshes every 10 seconds
- Real-time service status
- Confirmation dialogs for critical actions
- Professional admin UI with red banner
- Mobile responsive

---

## 🧪 After Cloud Build Completes

1. **Navigate to** `/modules/backend-management`
2. **Verify** you see the red admin banner
3. **Check** service statuses load
4. **Test** a service restart button

---

## 📦 Files Included in backend-update.zip

- `distributed-epc-api.js` (with OAuth token & enhanced metrics)
- `distributed-epc/` (11 modular files)
- `backend-services/` (6 files including **system-management.js**)
- `deployment-files/` (2 files)

---

**Cloud Build is deploying the frontend now. Add the backend router and you're done!** 🎉

