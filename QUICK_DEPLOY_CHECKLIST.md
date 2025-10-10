# Quick Deployment Checklist

Use this checklist to deploy the refactored architecture.

## 📋 Pre-Deployment

- [ ] **gcloud CLI** installed and authenticated
- [ ] **Firebase CLI** installed and authenticated
- [ ] **MongoDB Atlas** connection URI ready
- [ ] **Domain name** configured (optional)
- [ ] **Email** for SSL certificate
- [ ] **Project access** verified (lte-pci-mapper-65450042-bbf71)

---

## 🖥️ Part 1: GCE Backend (15-20 minutes)

### 1.1 Create Instance
```bash
cd PCI_mapper
chmod +x gce-backend/create-gce-instance.sh
./gce-backend/create-gce-instance.sh
```
- [ ] Script completed successfully
- [ ] External IP noted: ___________________

### 1.2 Setup Services
```bash
gcloud compute scp gce-backend/setup-gce-instance.sh genieacs-backend:~ --zone=us-central1-a
gcloud compute ssh genieacs-backend --zone=us-central1-a
chmod +x setup-gce-instance.sh
./setup-gce-instance.sh
```

**Information to provide:**
- [ ] MongoDB URI: `mongodb+srv://genieacs-user:<password>@...`
- [ ] MongoDB Database: `genieacs`
- [ ] External Domain: `___________________`
- [ ] Firebase App URL: `https://lte-pci-mapper-nfomthzoza-uc.a.run.app`
- [ ] SSL Email: `___________________`

### 1.3 Verify Backend
```bash
# On GCE instance
/opt/monitor.sh
curl http://localhost:3000/health
```
- [ ] All services running
- [ ] Health check passes

### 1.4 Configure DNS (If using domain)
- [ ] A record added pointing to GCE IP
- [ ] DNS propagated (wait 5-30 min)
- [ ] SSL certificate obtained

### 1.5 Test Externally
```bash
# From local machine
curl https://your-domain.com/api/health
```
- [ ] Backend accessible externally
- [ ] Health check returns "healthy"

---

## 🎨 Part 2: Frontend Deployment (10 minutes)

### 2.1 Update Configuration
```bash
cd Module_Manager
cp apphosting.yaml.gce-backend apphosting.yaml
nano apphosting.yaml
```

**Replace these values:**
- [ ] `<YOUR-GCE-DOMAIN>` → Your actual domain
- [ ] `<YOUR-GCE-IP>` → Your GCE external IP

### 2.2 Test Build
```bash
npm install
npm run build
```
- [ ] Build completes successfully
- [ ] No errors

### 2.3 Deploy
```bash
cd ..  # Back to project root
firebase deploy --only apphosting
```
- [ ] Deployment successful
- [ ] Deployment URL received

### 2.4 Route Traffic
```bash
gcloud run services update-traffic lte-pci-mapper \
  --region=us-central1 \
  --project=lte-pci-mapper-65450042-bbf71 \
  --to-latest
```
- [ ] Traffic routed to latest version

---

## ✅ Part 3: Verification (5 minutes)

### 3.1 Backend Tests
```bash
BACKEND_URL="https://your-domain.com"

# Health
curl ${BACKEND_URL}/api/health

# GenieACS
curl ${BACKEND_URL}/nbi/devices

# STUN
curl ${BACKEND_URL}/api/stun/config
```
- [ ] Health check passes
- [ ] GenieACS NBI responds
- [ ] STUN config available

### 3.2 Frontend Tests
Open: `https://lte-pci-mapper-nfomthzoza-uc.a.run.app`

- [ ] Application loads
- [ ] Login works
- [ ] Dashboard displays
- [ ] No console errors
- [ ] Backend connection works

### 3.3 CPE Test (Optional)
Configure test CPE with:
```
ACS URL: http://YOUR-GCE-IP:7547
```
- [ ] CPE connects successfully
- [ ] Visible in GenieACS NBI

---

## 📊 Part 4: Post-Deployment

### 4.1 Set Up Monitoring
```bash
# On GCE instance
crontab -e
# Add: */5 * * * * /opt/monitor.sh >> /var/log/monitor.log 2>&1
```
- [ ] Monitoring cron job added

### 4.2 Set Up Backups
```bash
# On GCE instance
crontab -e
# Add: 0 2 * * * /opt/backup-firmware.sh >> /var/log/firmware-backup.log 2>&1
```
- [ ] Backup cron job added

### 4.3 Document Configuration
Record these values for future reference:

```
GCE External IP: ___________________
GCE Domain: ___________________
MongoDB URI: ___________________
Frontend URL: ___________________
Backend API URL: ___________________
CWMP URL: ___________________
STUN Server: ___________________
SSL Certificate Expiry: ___________________
```

---

## 🎯 Success Criteria

All must be ✅ to consider deployment successful:

- [ ] ✅ GCE instance running
- [ ] ✅ All Docker containers running (CWMP, NBI, FS, UI)
- [ ] ✅ Backend API responding
- [ ] ✅ STUN server accessible
- [ ] ✅ Nginx serving traffic
- [ ] ✅ SSL certificates installed
- [ ] ✅ Frontend deployed
- [ ] ✅ Frontend connects to backend
- [ ] ✅ GenieACS integration working
- [ ] ✅ Health checks passing
- [ ] ✅ No errors in logs
- [ ] ✅ Monitoring configured
- [ ] ✅ Backups configured

---

## 🆘 Quick Troubleshooting

### Backend health check fails
```bash
docker ps
sudo systemctl status backend-api
sudo journalctl -u backend-api -n 50
```

### Frontend can't connect to backend
- Check CORS configuration in Nginx
- Verify environment variables in apphosting.yaml
- Check browser console for errors

### CPE devices can't connect
```bash
curl -I http://YOUR-GCE-IP:7547
sudo ufw status | grep 7547
docker logs genieacs-cwmp
```

### SSL certificate issues
```bash
sudo certbot certificates
sudo certbot renew
sudo nginx -t && sudo systemctl reload nginx
```

---

## 📚 Next Steps

After successful deployment:

1. **Configure CPE devices** to connect to CWMP
2. **Set up monitoring alerts** (Cloud Monitoring)
3. **Review security settings**
4. **Test failover procedures**
5. **Document custom configurations**
6. **Train team on new architecture**

---

## 🎉 Deployment Complete!

Once all checkboxes are marked:

✅ **Frontend**: Running on Firebase App Hosting  
✅ **Backend**: Running on Google Compute Engine  
✅ **GenieACS**: Fully operational with TR-069  
✅ **STUN**: NAT traversal configured  
✅ **Monitoring**: Active and logging  
✅ **Backups**: Automated and scheduled  

---

**Deployment Date**: ___________________  
**Deployed By**: ___________________  
**Version**: 1.0  

---

*For detailed instructions, see: `DEPLOYMENT_GUIDE_GCE_BACKEND.md`*

