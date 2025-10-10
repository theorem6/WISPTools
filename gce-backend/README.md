# GenieACS Backend on Google Compute Engine

This directory contains scripts and configurations for deploying the GenieACS backend infrastructure on Google Compute Engine.

## Overview

The backend deployment includes:
- **GenieACS Services**: CWMP (TR-069), NBI API, File Server, UI Dashboard
- **Backend API**: Node.js/Express server for frontend integration
- **STUN Server**: Coturn for NAT traversal
- **Firmware Storage**: Local disk storage with upload/download capabilities
- **Nginx**: Reverse proxy with SSL/TLS termination

## Architecture

```
Internet
    │
    ├─→ Port 80/443 (HTTP/HTTPS) ──→ Nginx ──→ Backend Services
    ├─→ Port 7547 (TR-069 CWMP) ───→ GenieACS CWMP (CPE devices)
    └─→ Port 3478 (STUN/UDP) ──────→ Coturn
```

## Prerequisites

### Local Machine
- gcloud CLI installed and configured
- Access to GCP project: `lte-pci-mapper-65450042-bbf71`
- Appropriate IAM permissions (Compute Admin)

### Required Information
- MongoDB Atlas connection URI
- Firebase App URL
- Domain name (optional, can use IP)
- Email for SSL certificate

## Deployment Steps

### Step 1: Create GCE Instance

From your local machine, run the creation script:

```bash
cd gce-backend
chmod +x create-gce-instance.sh
./create-gce-instance.sh
```

This will:
- Reserve a static external IP address
- Create firewall rules for HTTP/HTTPS, TR-069, and STUN
- Create an e2-standard-2 instance (2 vCPU, 8 GB RAM)
- Configure security settings

**Expected time**: 2-3 minutes

### Step 2: Copy Setup Script to Instance

```bash
gcloud compute scp setup-gce-instance.sh genieacs-backend:~ --zone=us-central1-a
```

### Step 3: SSH into Instance

```bash
gcloud compute ssh genieacs-backend --zone=us-central1-a
```

### Step 4: Run Setup Script

On the GCE instance:

```bash
chmod +x setup-gce-instance.sh
./setup-gce-instance.sh
```

You will be prompted for:
- MongoDB Connection URI
- MongoDB Database Name (default: genieacs)
- External Domain or IP
- Firebase App URL
- Email for Let's Encrypt SSL

**Expected time**: 10-15 minutes

The script will:
1. Update system packages
2. Install Docker, Node.js, Nginx, Coturn
3. Deploy GenieACS services in Docker containers
4. Configure Backend API server
5. Set up STUN server
6. Configure Nginx reverse proxy
7. Set up firewall rules
8. Start all services
9. Optionally configure SSL certificates

### Step 5: Verify Deployment

Check service status:

```bash
/opt/monitor.sh
```

Test health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-10T12:00:00.000Z",
  "services": {
    "genieacs_cwmp": "running",
    "genieacs_nbi": "running",
    "genieacs_fs": "running",
    "genieacs_ui": "running",
    "mongodb": "running"
  }
}
```

### Step 6: Configure DNS (Optional)

If using a custom domain:

1. Add an A record pointing to your GCE external IP
2. Wait for DNS propagation (5-30 minutes)
3. Run certbot to obtain SSL certificate:

```bash
sudo certbot --nginx -d your-domain.com
```

### Step 7: Update Frontend Configuration

Update `Module_Manager/apphosting.yaml` with the GCE backend URLs:

```yaml
env:
  # GCE Backend Configuration
  - variable: PUBLIC_BACKEND_API_URL
    value: "https://your-domain.com/api"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_GENIEACS_NBI_URL
    value: "https://your-domain.com/nbi"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_GENIEACS_CWMP_URL
    value: "http://YOUR-GCE-IP:7547"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_GENIEACS_FS_URL
    value: "https://your-domain.com/fs"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_GENIEACS_UI_URL
    value: "https://your-domain.com/admin"
    availability:
      - BUILD
      - RUNTIME
  
  - variable: PUBLIC_STUN_SERVER
    value: "stun:YOUR-GCE-IP:3478"
    availability:
      - BUILD
      - RUNTIME
```

## Service Endpoints

After deployment, the following endpoints will be available:

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | `https://your-domain.com/api/` | Main backend API |
| Health Check | `https://your-domain.com/api/health` | Service health status |
| GenieACS NBI | `https://your-domain.com/nbi/` | Device management API |
| GenieACS FS | `https://your-domain.com/fs/` | Firmware file server |
| GenieACS UI | `https://your-domain.com/admin/` | Admin dashboard |
| CWMP (TR-069) | `http://YOUR-IP:7547` | CPE device connections |
| STUN Server | `stun:YOUR-IP:3478` | NAT traversal |

## API Examples

### Health Check
```bash
curl https://your-domain.com/api/health
```

### List Devices (NBI)
```bash
curl https://your-domain.com/nbi/devices
```

### Upload Firmware
```bash
curl -X POST https://your-domain.com/api/firmware/upload \
  -F "firmware=@firmware.bin" \
  -F "version=1.0.0" \
  -F "model=CPE-1000"
```

### List Firmware
```bash
curl https://your-domain.com/api/firmware/list
```

### Get STUN Configuration
```bash
curl https://your-domain.com/api/stun/config
```

## Management Commands

### Monitor Services

View real-time status:
```bash
/opt/monitor.sh
```

### View Logs

Backend API logs:
```bash
sudo journalctl -u backend-api -f
```

GenieACS logs:
```bash
docker-compose -f /opt/genieacs/docker-compose.yml logs -f
```

Nginx logs:
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

Coturn logs:
```bash
sudo journalctl -u coturn -f
```

### Restart Services

Restart all GenieACS containers:
```bash
cd /opt/genieacs
docker-compose restart
```

Restart Backend API:
```bash
sudo systemctl restart backend-api
```

Restart Nginx:
```bash
sudo systemctl restart nginx
```

Restart Coturn:
```bash
sudo systemctl restart coturn
```

### Stop Services

```bash
cd /opt/genieacs
docker-compose stop
sudo systemctl stop backend-api
sudo systemctl stop coturn
```

### Start Services

```bash
cd /opt/genieacs
docker-compose start
sudo systemctl start backend-api
sudo systemctl start coturn
```

## Backup and Restore

### Backup Firmware Files

Manual backup:
```bash
/opt/backup-firmware.sh
```

Set up automated daily backup (cron):
```bash
crontab -e
```

Add this line:
```
0 2 * * * /opt/backup-firmware.sh >> /var/log/firmware-backup.log 2>&1
```

### Backup Configuration

Configuration files are located in:
- `/opt/genieacs/docker-compose.yml` - GenieACS services
- `/opt/backend-api/server.js` - Backend API
- `/opt/backend-api/.env` - Environment variables
- `/etc/nginx/sites-available/genieacs-backend` - Nginx config
- `/etc/turnserver.conf` - STUN/TURN config

Backup all configs:
```bash
tar -czf configs-backup-$(date +%Y%m%d).tar.gz \
  /opt/genieacs/docker-compose.yml \
  /opt/backend-api/ \
  /etc/nginx/sites-available/genieacs-backend \
  /etc/turnserver.conf
```

### GCE Disk Snapshots

Create snapshot from local machine:
```bash
gcloud compute disks snapshot genieacs-backend \
  --zone=us-central1-a \
  --snapshot-names=genieacs-backup-$(date +%Y%m%d)
```

## Troubleshooting

### Services Not Starting

Check Docker:
```bash
docker ps -a
docker logs genieacs-cwmp
docker logs genieacs-nbi
```

Check Backend API:
```bash
sudo systemctl status backend-api
sudo journalctl -u backend-api -n 50
```

### Cannot Connect to Services

Check firewall:
```bash
sudo ufw status
```

Check if ports are listening:
```bash
sudo netstat -tulpn | grep -E '(80|443|7547|7557|7567|8080|3000|3478)'
```

Test from localhost:
```bash
curl http://localhost:3000/health
curl http://localhost:7557/devices
```

### MongoDB Connection Issues

Test MongoDB connection:
```bash
# From Node.js
node -e "const {MongoClient} = require('mongodb'); \
  const client = new MongoClient('YOUR-MONGODB-URI'); \
  client.connect().then(() => {console.log('Connected!'); process.exit(0);}) \
  .catch(err => {console.error('Error:', err); process.exit(1);})"
```

### CPE Devices Not Connecting

Verify CWMP service:
```bash
docker logs genieacs-cwmp
curl -I http://localhost:7547
```

Check firewall allows port 7547:
```bash
sudo ufw status | grep 7547
```

Test from external network:
```bash
curl -I http://YOUR-EXTERNAL-IP:7547
```

### SSL Certificate Issues

Check certificate:
```bash
sudo certbot certificates
```

Renew certificate:
```bash
sudo certbot renew
```

Test SSL:
```bash
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

## Performance Tuning

### Increase Docker Container Resources

Edit `/opt/genieacs/docker-compose.yml` and add resource limits:

```yaml
services:
  genieacs-nbi:
    # ... existing config ...
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          memory: 1G
```

### Optimize Nginx

Edit `/etc/nginx/nginx.conf`:

```nginx
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    keepalive_requests 100;
    
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

### Monitor Resource Usage

```bash
# CPU and memory
htop

# Disk I/O
iostat -x 1

# Network
iftop

# Docker stats
docker stats
```

## Security Best Practices

1. **Regular Updates**
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   ```

2. **Firewall Configuration**
   - Only open necessary ports
   - Use UFW or GCE firewall rules
   - Whitelist known IP ranges if possible

3. **SSL/TLS**
   - Always use HTTPS for web interfaces
   - Keep certificates up to date
   - Use strong cipher suites

4. **Authentication**
   - Implement API key authentication
   - Use Firebase Auth for user endpoints
   - Rotate credentials regularly

5. **Monitoring**
   - Set up Cloud Monitoring alerts
   - Monitor disk space
   - Track failed login attempts
   - Monitor for unusual traffic patterns

## Cost Optimization

Current estimated cost: **$65-100/month**

To reduce costs:

1. **Use Preemptible VM** (if acceptable downtime):
   ```bash
   --preemptible --maintenance-policy=TERMINATE
   ```
   Saves ~60-80%

2. **Smaller Machine Type** (if load is low):
   - e2-small: 2 GB RAM (~$15/month)
   - e2-medium: 4 GB RAM (~$30/month)

3. **Scheduled Scaling**:
   - Shut down during off-hours
   - Use Cloud Scheduler to start/stop

4. **Committed Use Discounts**:
   - Save 37% with 1-year commitment
   - Save 55% with 3-year commitment

## Support and Maintenance

### Regular Maintenance Tasks

**Daily**:
- Check service health
- Review logs for errors
- Monitor disk space

**Weekly**:
- Review security logs
- Check for system updates
- Backup configurations

**Monthly**:
- Review resource usage
- Optimize costs
- Update software versions
- Test disaster recovery

### Getting Help

- **GenieACS Documentation**: https://docs.genieacs.com/
- **GCE Documentation**: https://cloud.google.com/compute/docs
- **Project Issues**: File issues in your Git repository

## License

This deployment configuration is part of the LTE WISP Management Platform project.

---

**Last Updated**: 2025-10-10
**Version**: 1.0

