# 🔧 Manual HSS Installation via SSH

## Quick Install (Since You Have SSH Access)

### Step 1: Upload HSS Module to Server

From Firebase Studio or your local machine:

```bash
# Package the hss-module
cd hss-module
tar -czf hss-module.tar.gz .

# Upload to your GCE instance
gcloud compute scp hss-module.tar.gz genieacs-backend:~ --zone=us-central1-a
```

### Step 2: SSH into Server

```bash
gcloud compute ssh genieacs-backend --zone=us-central1-a
```

### Step 3: Extract and Install

On the server:

```bash
# Extract module
tar -xzf hss-module.tar.gz
cd hss-module

# Make install script executable
chmod +x install-on-server.sh

# Run installation
./install-on-server.sh
```

**The script will prompt you for:**
1. MongoDB URI (or use default)
2. Generate new encryption key? (yes/no)

**Then it will:**
- ✅ Install HSS to `/opt/hss-server`
- ✅ Install Node.js dependencies
- ✅ Initialize MongoDB database
- ✅ Create systemd service
- ✅ Start HSS service

### Step 4: Verify Installation

```bash
# Check service status
sudo systemctl status hss

# Test HSS API
curl http://localhost:3000/health

# View logs
sudo journalctl -u hss -f
```

---

## 🔧 Quick Commands

### Service Management

```bash
# Start HSS
sudo systemctl start hss

# Stop HSS
sudo systemctl stop hss

# Restart HSS
sudo systemctl restart hss

# Check status
sudo systemctl status hss

# View logs (live)
sudo journalctl -u hss -f

# View recent logs
sudo journalctl -u hss -n 100
```

### Test Endpoints

```bash
# Health check
curl http://localhost:3000/health

# HSS API health
curl http://localhost:3000/api/health

# List subscribers (will be empty initially)
curl http://localhost:3000/api/subscribers \
  -H "X-Tenant-ID: tenant_001"
```

### Create Sample Data

```bash
# Create bandwidth plan
curl -X POST http://localhost:3000/api/bandwidth-plans \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_001" \
  -d '{
    "plan_name": "Gold Plan",
    "plan_id": "plan_gold",
    "tenantId": "tenant_001",
    "bandwidth": {
      "download_mbps": 100,
      "upload_mbps": 50
    },
    "qos": { "qci": 9 }
  }'

# Create group
curl -X POST http://localhost:3000/api/groups \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_001" \
  -d '{
    "group_name": "Residential Users",
    "group_id": "group_residential",
    "tenantId": "tenant_001",
    "default_plan_id": "plan_gold"
  }'

# Add subscriber
curl -X POST http://localhost:3000/api/subscribers \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_001" \
  -d '{
    "tenantId": "tenant_001",
    "imsi": "001010123456789",
    "ki": "00112233445566778899AABBCCDDEEFF",
    "opc": "63BFA50EE6523365FF14C1F45F88737D",
    "user_info": { "full_name": "Test User" },
    "group_membership": { "group_id": "group_residential" }
  }'
```

---

## 🆘 Troubleshooting

### HSS Won't Start

```bash
# Check logs for errors
sudo journalctl -u hss -n 50

# Common issues:
# 1. MongoDB connection
mongosh "$MONGODB_URI" --eval "db.serverStatus()"

# 2. Port already in use
sudo netstat -tulpn | grep 3000

# 3. Missing dependencies
cd /opt/hss-server && npm install
```

### Port Already in Use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process (if safe)
sudo kill -9 PID
```

### Configuration Issues

```bash
# Check config file
cat /opt/hss-server/config.json

# Verify environment
sudo systemctl cat hss | grep Environment
```

---

## 📝 Quick Setup Summary

1. **Upload**: `gcloud compute scp hss-module.tar.gz genieacs-backend:~`
2. **SSH**: `gcloud compute ssh genieacs-backend --zone=us-central1-a`
3. **Extract**: `tar -xzf hss-module.tar.gz && cd hss-module`
4. **Install**: `chmod +x install-on-server.sh && ./install-on-server.sh`
5. **Test**: `curl http://localhost:3000/health`

**Total time**: ~5 minutes  
**Result**: HSS running on your ACS server!

---

**Need help?** Check the logs: `sudo journalctl -u hss -f`

