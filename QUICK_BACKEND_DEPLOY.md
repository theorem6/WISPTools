# 🚀 Quick Backend Deploy

## TL;DR - 3 Commands

### From PowerShell:
```powershell
scp backend-update.zip david@136.112.111.167:/home/david/
scp install-backend-modules.sh david@136.112.111.167:/home/david/
```

### From SSH:
```bash
cd /home/david && chmod +x install-backend-modules.sh && ./install-backend-modules.sh
```

**Done!** ✅

---

## 📦 What Gets Installed

- ✅ Updated `distributed-epc-api.js` with OAuth token & enhanced metrics
- ✅ Modular `distributed-epc/` directory (11 modules)
- ✅ `backend-services/` directory (5 services)
- ✅ `deployment-files/` with metrics agent

---

## ✨ What's New

- **OAuth Token:** Can download from private GitHub
- **Enhanced Metrics:** CPU, memory, disk, network, subscribers
- **Interactive Deployment:** Rapid5GS-style script
- **Modular Code:** Professional architecture

---

## 🔧 If Something Goes Wrong

The script automatically:
- ✅ Creates backup before changes
- ✅ Verifies syntax before applying
- ✅ Rolls back if errors detected

Manual restore:
```bash
sudo cp /opt/hss-api/backups/TIMESTAMP/distributed-epc-api.js /opt/hss-api/
sudo pm2 restart hss-api
```

---

## 📋 After Installation

Test it works:
1. Register new EPC in web interface
2. Download deployment script
3. Verify OAuth token present
4. Run on test Ubuntu server

**See `BACKEND_UPLOAD_INSTRUCTIONS.md` for full details**

---

*Ready to deploy!* 🎉

