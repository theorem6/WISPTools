# Command Reference Card

Quick reference for common commands. Print this or keep it open during deployment.

---

## 🚀 Initial Deployment

### 1. Create GCE Instance (Local Machine)
```bash
cd PCI_mapper
./gce-backend/create-gce-instance.sh
```

### 2. Copy Setup Script
```bash
gcloud compute scp gce-backend/setup-gce-instance.sh genieacs-backend:~ --zone=us-central1-a
```

### 3. SSH to GCE
```bash
gcloud compute ssh genieacs-backend --zone=us-central1-a
```

### 4. Run Setup (On GCE)
```bash
chmod +x setup-gce-instance.sh
./setup-gce-instance.sh
```

### 5. Configure Frontend (Local Machine)
```bash
cd Module_Manager
cp apphosting.yaml.gce-backend apphosting.yaml
nano apphosting.yaml  # Update with your GCE IP/domain
```

### 6. Deploy Frontend
```bash
cd ..  # Back to project root
firebase deploy --only apphosting
gcloud run services update-traffic lte-pci-mapper --region=us-central1 --to-latest
```

---

## 🔍 Monitoring & Status

### Check All Services (On GCE)
```bash
/opt/monitor.sh
```

### Health Check
```bash
curl http://localhost:3000/health
curl https://your-domain.com/api/health
```

### Docker Containers
```bash
docker ps
docker stats
docker logs genieacs-cwmp
docker logs genieacs-nbi
docker logs genieacs-fs
docker logs genieacs-ui
```

### Backend API
```bash
sudo systemctl status backend-api
sudo journalctl -u backend-api -f
sudo journalctl -u backend-api -n 50
```

### STUN Server
```bash
sudo systemctl status coturn
sudo journalctl -u coturn -f
```

### Nginx
```bash
sudo systemctl status nginx
sudo nginx -t
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 Service Management

### Restart Services (On GCE)
```bash
# All GenieACS containers
cd /opt/genieacs && docker-compose restart

# Specific container
docker restart genieacs-cwmp
docker restart genieacs-nbi
docker restart genieacs-fs
docker restart genieacs-ui

# Backend API
sudo systemctl restart backend-api

# STUN server
sudo systemctl restart coturn

# Nginx
sudo systemctl reload nginx
```

### Stop Services
```bash
cd /opt/genieacs && docker-compose stop
sudo systemctl stop backend-api
sudo systemctl stop coturn
sudo systemctl stop nginx
```

### Start Services
```bash
cd /opt/genieacs && docker-compose start
sudo systemctl start backend-api
sudo systemctl start coturn
sudo systemctl start nginx
```

---

## 📋 Testing & Verification

### Test Backend (Local Machine)
```bash
BACKEND="https://your-domain.com"

# Health
curl ${BACKEND}/api/health

# GenieACS NBI
curl ${BACKEND}/nbi/devices

# Device stats
curl ${BACKEND}/api/devices/stats

# STUN config
curl ${BACKEND}/api/stun/config

# Firmware list
curl ${BACKEND}/api/firmware/list
```

### Test Frontend
```bash
# Open in browser
open https://lte-pci-mapper-nfomthzoza-uc.a.run.app

# Or curl
curl -I https://lte-pci-mapper-nfomthzoza-uc.a.run.app
```

### Test CWMP Port
```bash
curl -I http://YOUR-GCE-IP:7547
```

### Test Ports
```bash
# On GCE instance
sudo netstat -tulpn | grep -E '(80|443|3000|7547|7557|7567|8080|3478)'
```

---

## 🔐 SSL Certificates

### Check Certificate
```bash
sudo certbot certificates
```

### Renew Certificate
```bash
sudo certbot renew
sudo certbot renew --dry-run  # Test renewal
```

### Force Renew
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Initial SSL Setup
```bash
sudo certbot --nginx -d your-domain.com
```

---

## 💾 Backup & Restore

### Manual Firmware Backup
```bash
/opt/backup-firmware.sh
```

### Backup Configuration
```bash
tar -czf /tmp/config-backup-$(date +%Y%m%d).tar.gz \
  /opt/genieacs/docker-compose.yml \
  /opt/backend-api/ \
  /etc/nginx/sites-available/genieacs-backend \
  /etc/turnserver.conf
```

### Create GCE Snapshot (Local Machine)
```bash
gcloud compute disks snapshot genieacs-backend \
  --zone=us-central1-a \
  --snapshot-names=backup-$(date +%Y%m%d)
```

### List Snapshots
```bash
gcloud compute snapshots list
```

---

## 🔥 Firewall Management

### Check UFW Status (On GCE)
```bash
sudo ufw status verbose
```

### Check GCE Firewall Rules (Local Machine)
```bash
gcloud compute firewall-rules list
gcloud compute firewall-rules describe allow-tr069-cwmp
gcloud compute firewall-rules describe allow-stun-turn
```

---

## 📊 Resource Monitoring

### Disk Usage
```bash
df -h
du -sh /opt/genieacs/firmware/*
```

### Memory Usage
```bash
free -h
```

### CPU Usage
```bash
top
htop  # If installed
```

### Network Usage
```bash
iftop  # If installed
netstat -i
```

### Docker Resource Usage
```bash
docker stats
docker system df
```

---

## 🔧 Troubleshooting

### Service Won't Start
```bash
# Check logs
sudo journalctl -xe
sudo journalctl -u backend-api -n 100
docker logs genieacs-cwmp --tail 100

# Check configuration
sudo nginx -t
docker-compose -f /opt/genieacs/docker-compose.yml config
```

### Can't Connect Externally
```bash
# Check firewall
sudo ufw status
gcloud compute firewall-rules list

# Check if service is listening
sudo netstat -tulpn | grep PORT

# Test from localhost
curl http://localhost:PORT
```

### CORS Errors
```bash
# Check Nginx CORS config
sudo cat /etc/nginx/sites-available/genieacs-backend | grep -A 5 CORS

# Check backend ALLOWED_ORIGINS
cat /opt/backend-api/.env | grep ALLOWED_ORIGINS
```

### MongoDB Connection Issues
```bash
# Test connection
cat /opt/backend-api/.env | grep MONGODB_URI

# Check logs
sudo journalctl -u backend-api | grep -i mongo
docker logs genieacs-nbi | grep -i mongo
```

---

## 📝 Configuration Files

### Main Configuration Files
```bash
# GenieACS
/opt/genieacs/docker-compose.yml

# Backend API
/opt/backend-api/server.js
/opt/backend-api/.env

# Nginx
/etc/nginx/sites-available/genieacs-backend

# STUN server
/etc/turnserver.conf

# UFW
/etc/ufw/user.rules
```

### View Configuration
```bash
cat /opt/genieacs/docker-compose.yml
cat /opt/backend-api/.env
sudo cat /etc/nginx/sites-available/genieacs-backend
```

### Edit Configuration
```bash
nano /opt/genieacs/docker-compose.yml
nano /opt/backend-api/.env
sudo nano /etc/nginx/sites-available/genieacs-backend
```

---

## 🌐 Network Information

### Get External IP (On GCE)
```bash
curl ifconfig.me
curl -4 icanhazip.com
```

### Get Internal IP
```bash
hostname -I | awk '{print $1}'
ip addr show | grep "inet " | grep -v 127.0.0.1
```

### DNS Lookup
```bash
nslookup your-domain.com
dig your-domain.com
```

---

## 📦 Updates

### Update System Packages
```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get dist-upgrade -y
```

### Update Docker Images
```bash
cd /opt/genieacs
docker-compose pull
docker-compose up -d
```

### Update Backend API
```bash
cd /opt/backend-api
npm update
sudo systemctl restart backend-api
```

---

## 🔑 Authentication & Access

### SSH to GCE (Local Machine)
```bash
gcloud compute ssh genieacs-backend --zone=us-central1-a
```

### Copy Files to GCE
```bash
gcloud compute scp LOCAL_FILE genieacs-backend:REMOTE_PATH --zone=us-central1-a
```

### Copy Files from GCE
```bash
gcloud compute scp genieacs-backend:REMOTE_FILE LOCAL_PATH --zone=us-central1-a
```

---

## 🎯 Quick Tests

### All-in-One Health Check
```bash
curl -s https://your-domain.com/api/health | jq .
```

### Test All Endpoints
```bash
BACKEND="https://your-domain.com"
echo "Health:" && curl -s ${BACKEND}/api/health | jq .status
echo "NBI:" && curl -s ${BACKEND}/nbi/devices | jq length
echo "STUN:" && curl -s ${BACKEND}/api/stun/config | jq .
```

### Frontend Test
```bash
curl -I https://lte-pci-mapper-nfomthzoza-uc.a.run.app | head -1
```

---

## 💡 Useful Aliases

Add to `~/.bashrc`:
```bash
alias monitor='/opt/monitor.sh'
alias backend-logs='sudo journalctl -u backend-api -f'
alias docker-logs='docker-compose -f /opt/genieacs/docker-compose.yml logs -f'
alias nginx-reload='sudo nginx -t && sudo systemctl reload nginx'
alias health='curl -s http://localhost:3000/health | jq .'
```

Then: `source ~/.bashrc`

---

## 📞 Emergency Commands

### Service is Down - Restart Everything
```bash
cd /opt/genieacs && docker-compose restart
sudo systemctl restart backend-api
sudo systemctl restart nginx
```

### Disk Full - Clean Docker
```bash
docker system prune -a --volumes
```

### High CPU - Identify Culprit
```bash
top -bn1 | head -20
docker stats --no-stream
```

### Out of Memory
```bash
free -h
sudo systemctl restart backend-api
docker-compose restart
```

---

## 📚 Reference

- **Full Documentation**: [README_REFACTORING.md](README_REFACTORING.md)
- **Deployment Guide**: [DEPLOYMENT_GUIDE_GCE_BACKEND.md](DEPLOYMENT_GUIDE_GCE_BACKEND.md)
- **Operations Guide**: [gce-backend/README.md](gce-backend/README.md)
- **Quick Checklist**: [QUICK_DEPLOY_CHECKLIST.md](QUICK_DEPLOY_CHECKLIST.md)

---

**Pro Tip**: Bookmark this file for quick reference during operations!

**Last Updated**: 2025-10-10

