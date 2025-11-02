# 🚀 Deploy Monetization Updates

This guide will help you deploy the recent monetization changes to both **Firebase Frontend** and **GCE Backend**.

---

## 📋 What's Being Deployed

### Backend Changes:
- ✅ Admin authentication middleware (`admin-auth.js`)
- ✅ Billing API security updates (`billing-api.js`)
- ✅ Equipment pricing model and API (`equipment-pricing.js`)
- ✅ System routes security updates (`system.js`)
- ✅ Plans route cost estimation updates (`plans.js`)
- ✅ EPC deployment route updates (`epc-deployment.js`)

### Frontend Changes:
- ✅ Mobile app work orders integration
- ✅ Tower selector component
- ✅ Asset details updates

---

## 🔧 Part 1: Deploy Backend to GCE

### Option A: Using Deployment Script (Recommended)

**SSH into GCE server:**
```bash
ssh root@136.112.111.167
```

**Run deployment script:**
```bash
cd /root/lte-pci-mapper
chmod +x scripts/deployment/deploy-monetization-updates.sh
sudo bash scripts/deployment/deploy-monetization-updates.sh
```

The script will:
1. ✅ Pull latest code from GitHub
2. ✅ Create backup of existing files
3. ✅ Stop the hss-api service
4. ✅ Copy all new/updated files
5. ✅ Update server.js with new routes
6. ✅ Verify syntax of all files
7. ✅ Check/create .env file
8. ✅ Start the service
9. ✅ Test health endpoint

### Option B: Manual Deployment

If you prefer manual control:

```bash
# 1. SSH into GCE
ssh root@136.112.111.167

# 2. Pull latest code
cd /root/lte-pci-mapper
git pull origin main

# 3. Stop service
systemctl stop hss-api

# 4. Create backup
mkdir -p /opt/hss-api/backups/$(date +%Y%m%d-%H%M%S)
cp -r /opt/hss-api/*.js /opt/hss-api/backups/$(date +%Y%m%d-%H%M%S)/ 2>/dev/null || true

# 5. Create directories
mkdir -p /opt/hss-api/middleware
mkdir -p /opt/hss-api/models
mkdir -p /opt/hss-api/routes

# 6. Copy files
cp backend-services/middleware/admin-auth.js /opt/hss-api/middleware/
cp backend-services/billing-api.js /opt/hss-api/
cp backend-services/models/equipment-pricing.js /opt/hss-api/models/
cp backend-services/routes/equipment-pricing.js /opt/hss-api/routes/
cp backend-services/routes/system.js /opt/hss-api/routes/
cp backend-services/routes/plans.js /opt/hss-api/routes/
cp backend-services/routes/epc-deployment.js /opt/hss-api/routes/

# 7. Update server.js (if billing route not already there)
grep -q "app.use('/api/billing'" /opt/hss-api/server.js || \
  sed -i "/app.use('\/api\/system'/a app.use('/api/billing', require('./billing-api'));" /opt/hss-api/server.js

# 8. Verify syntax
cd /opt/hss-api
node --check middleware/admin-auth.js
node --check billing-api.js
node --check server.js

# 9. Create .env if needed
if [ ! -f /opt/hss-api/.env ]; then
  cp /root/lte-pci-mapper/backend-services/.env.example /opt/hss-api/.env
  echo "⚠️  IMPORTANT: Edit /opt/hss-api/.env and add PayPal credentials!"
fi

# 10. Start service
systemctl start hss-api
systemctl status hss-api
```

---

## 🔧 Part 2: Configure PayPal Credentials

**Edit the .env file on GCE:**
```bash
nano /opt/hss-api/.env
```

**Add your PayPal credentials:**
```bash
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
PAYPAL_ENVIRONMENT=sandbox
```

**Get credentials from:**
- Sandbox: https://developer.paypal.com/dashboard/applications/sandbox
- Live: https://developer.paypal.com/dashboard/applications/live

**Restart service after updating .env:**
```bash
systemctl restart hss-api
```

---

## 🌐 Part 3: Deploy Frontend to Firebase

The frontend will **auto-deploy** when you push to GitHub!

### Step 1: Check Git Status
```bash
git status
```

### Step 2: Stage Changes
```bash
git add Module_Manager/
git add wisp-field-app/
git add backend-services/
git add scripts/
git add *.md
```

### Step 3: Commit
```bash
git commit -m "feat: Deploy monetization updates

- Admin authentication middleware
- Billing API security updates
- Equipment pricing system
- Mobile app work orders integration
- Tower selector component"
```

### Step 4: Push to Trigger Auto-Deploy
```bash
git push origin main
```

### Step 5: Monitor Deployment

**Firebase App Hosting will automatically:**
1. Detect the push (~30 seconds)
2. Start building (~1 minute)
3. Build completes (~5-10 minutes)
4. Deploy (~2-3 minutes)
5. **Total: ~10-15 minutes**

**Monitor in Firebase Console:**
```
https://console.firebase.google.com/project/lte-pci-mapper-65450042-bbf71/apphosting
```

Look for:
- ✅ Build started
- ✅ Build succeeded
- ✅ Deployment complete
- ✅ New version live

---

## ✅ Verification Steps

### Backend Verification

**1. Check Service Status:**
```bash
systemctl status hss-api
```
Should show: `active (running)`

**2. Test Health Endpoint:**
```bash
curl http://localhost:3001/health
```
Should return: `{"status":"ok",...}`

**3. Test Billing Endpoint (requires admin token):**
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:3001/api/billing/plans
```
Should return subscription plans (or 401 if token invalid)

**4. Check Logs:**
```bash
journalctl -u hss-api -n 50 -f
```
Should show no errors, server running on port 3001

### Frontend Verification

**1. Visit Live Site:**
```
https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app
```

**2. Check Console (F12):**
- Should see no errors
- Firebase initialized properly

**3. Test Features:**
- ✅ Login works
- ✅ Mobile app work orders load
- ✅ Tower selector works in mobile app

---

## 🐛 Troubleshooting

### Backend Service Won't Start

**Check logs:**
```bash
journalctl -u hss-api -n 100 --no-pager
```

**Common issues:**
1. **Syntax error** → Check with `node --check /opt/hss-api/server.js`
2. **Missing dependencies** → Run `npm install` in `/opt/hss-api`
3. **Port in use** → Check with `lsof -i:3001`

**Restore backup:**
```bash
cd /opt/hss-api
cp backups/TIMESTAMP/*.js .
systemctl start hss-api
```

### Frontend Build Fails

**Check Firebase App Hosting logs:**
1. Go to Firebase Console → App Hosting
2. Click on failed build
3. Review build logs

**Common issues:**
1. **Out of memory** → Increase `runConfig.memoryMiB` in `apphosting.yaml`
2. **TypeScript errors** → Fix in local code, then push again
3. **Missing dependencies** → Check `package.json`

### PayPal Credentials Not Working

**Verify .env file:**
```bash
cat /opt/hss-api/.env | grep PAYPAL
```

**Test with curl:**
```bash
# Test billing endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/api/billing/plans
```

**Check logs for errors:**
```bash
journalctl -u hss-api | grep -i paypal
```

---

## 📊 Deployment Summary

### Files Deployed to GCE Backend:
- `/opt/hss-api/middleware/admin-auth.js` (NEW)
- `/opt/hss-api/billing-api.js` (UPDATED)
- `/opt/hss-api/models/equipment-pricing.js` (NEW)
- `/opt/hss-api/routes/equipment-pricing.js` (NEW)
- `/opt/hss-api/routes/system.js` (UPDATED)
- `/opt/hss-api/routes/plans.js` (UPDATED)
- `/opt/hss-api/routes/epc-deployment.js` (UPDATED)
- `/opt/hss-api/server.js` (UPDATED - routes added)

### Frontend Auto-Deployed:
- `Module_Manager/` - Main SvelteKit app
- `wisp-field-app/` - Mobile React Native app

---

## 🎉 Success Indicators

After deployment, you should see:

**Backend:**
- ✅ Service running: `systemctl status hss-api`
- ✅ Health endpoint responds: `curl http://localhost:3001/health`
- ✅ No errors in logs: `journalctl -u hss-api`
- ✅ Billing endpoint accessible (with auth)

**Frontend:**
- ✅ Site loads without errors
- ✅ Login works
- ✅ Mobile app work orders functional
- ✅ No console errors

---

## 📞 Support

If deployment fails:
1. Check logs: `journalctl -u hss-api -n 100`
2. Verify syntax: `node --check /opt/hss-api/server.js`
3. Check service: `systemctl status hss-api`
4. Review Firebase App Hosting build logs

---

**Last Updated:** December 2024  
**Status:** ✅ Ready to deploy
