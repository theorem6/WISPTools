# Dependency Updates Deployment Plan

**Date:** December 2024  
**Status:** Ready for deployment

---

## Deployment Checklist

### 1. Frontend Deployment (Firebase Hosting) ✅ IN PROGRESS

- [x] Package.json updated
- [x] npm install completed
- [x] Build successful
- [ ] Deploy to Firebase Hosting
- [ ] Verify deployment

### 2. Backend Deployment (GCE Server) ⏳ PENDING

**Steps to Deploy:**
1. SSH to GCE server: `gcloud compute ssh acs-hss-server --zone=us-central1-a`
2. Navigate to repo: `cd /opt/lte-pci-mapper` (or `/root/lte-pci-mapper`)
3. Pull latest changes: `git pull origin main`
4. Install updated dependencies: `cd backend-services && npm install --production`
5. Restart services: `pm2 restart all` or `pm2 restart main-api`
6. Verify services running: `pm2 status`

**Alternative (Automated):**
- Use deployment script if available

### 3. Firebase Functions Deployment ⏳ PENDING

**Steps to Deploy:**
1. Navigate to functions directory
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Deploy: `firebase deploy --only functions --project wisptools-production`

### 4. Remote EPC Agents ⏳ PENDING

**Agent Scripts:**
- Agent scripts are served from GCE server at `/var/www/html/downloads/scripts/`
- After backend deployment, scripts will be available
- Agents auto-update on next check-in
- No manual deployment needed for agents

**Files that need to be on server:**
- `/var/www/html/downloads/scripts/epc-checkin-agent.sh`
- `/var/www/html/downloads/scripts/epc-snmp-discovery.js`
- `/var/www/html/downloads/scripts/epc-snmp-discovery.sh`

---

## Deployment Commands

### Frontend Deployment

```bash
cd Module_Manager
npm install
npm run build
cd ..
firebase deploy --only hosting --project wisptools-production
```

### Backend Deployment (Manual)

```bash
# SSH to GCE server
gcloud compute ssh acs-hss-server --zone=us-central1-a

# On server:
cd /opt/lte-pci-mapper  # or /root/lte-pci-mapper
git pull origin main
cd backend-services
npm install --production
pm2 restart all
pm2 status
```

### Firebase Functions Deployment

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions --project wisptools-production
```

---

## Verification Steps

After deployment:

1. **Frontend:**
   - Visit: https://wisptools-production.web.app
   - Verify pages load
   - Check browser console for errors

2. **Backend:**
   - Check health endpoint: https://hss.wisptools.io/api/health
   - Verify API endpoints respond
   - Check PM2 status on server

3. **Functions:**
   - Verify functions deploy successfully
   - Check function logs

4. **Agents:**
   - Wait for next agent check-in
   - Verify agents download updated scripts
   - Check agent logs

---

**Note:** Currently deploying frontend. Backend and functions deployment will follow.

