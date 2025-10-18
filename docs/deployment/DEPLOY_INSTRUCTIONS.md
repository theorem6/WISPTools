# Deploy HSS Backend - No Git Required

## Step 1: Upload Files

Upload these files/folders to your server at `/opt/lte-pci-mapper/`:

```
hss-module/
  ├── api/
  │   ├── epc-management.ts    ← NEW FILE (has all EPC endpoints)
  │   └── rest-api.ts           ← UPDATED (imports epc-management)
  ├── services/
  ├── schema/
  ├── scripts/
  ├── server.js
  ├── package.json
  └── tsconfig.json (if exists)

deploy-hss-no-git.sh              ← Deployment script
```

**Upload using SCP from your Windows machine:**

```powershell
# From c:\Users\david\Downloads\PCI_mapper\
scp -r hss-module user@136.112.111.167:/opt/lte-pci-mapper/
scp deploy-hss-no-git.sh user@136.112.111.167:/opt/lte-pci-mapper/hss-module/
```

**Or use WinSCP / FileZilla to drag & drop these folders**

---

## Step 2: Run Deployment Script

SSH to the server and run:

```bash
cd /opt/lte-pci-mapper/hss-module
chmod +x deploy-hss-no-git.sh
sudo ./deploy-hss-no-git.sh
```

---

## Step 3: Set Environment Variables (if needed)

If the script warns about missing env vars:

```bash
# Add to /etc/environment
sudo nano /etc/environment

# Add these lines:
MONGODB_URI="mongodb+srv://genieacs-user:PASSWORD@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
HSS_ENCRYPTION_KEY="<the-key-script-generated>"

# Save and reload
source /etc/environment
```

Then restart:
```bash
pm2 restart hss-api
```

---

## Alternative: Manual Deployment

If you prefer manual steps:

```bash
cd /opt/lte-pci-mapper/hss-module

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install dependencies
npm install

# Start service
pm2 start server.js --name hss-api
pm2 save

# Check status
pm2 status
pm2 logs hss-api
```

---

## Verify It's Working

```bash
# Test health endpoint
curl http://localhost:3000/health

# Test EPC endpoint
curl http://localhost:3000/api/epc/list -H "X-Tenant-ID: test"
```

Should return JSON responses, not errors.

---

## Then Test from Browser

1. Clear browser cache (Ctrl+Shift+R)
2. Navigate to HSS Management → Remote EPCs
3. Register a new EPC
4. Download deployment script ✅

---

## Important Files Changed

**NEW:** `hss-module/api/epc-management.ts`
- All the EPC endpoints (register, list, deployment-script, delete, heartbeat, dashboard)

**UPDATED:** `hss-module/api/rest-api.ts`
- Line 12: Added `import epcManagementRouter from './epc-management';`
- Line 19: Added `app.use('/epc', epcManagementRouter);`

These 2 files are the only changes needed to make EPC management work!


