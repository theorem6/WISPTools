---
title: "HSS Production System Guide"
description: "Complete production system guide for the Home Subscriber Server (HSS) including architecture, service configurations, MongoDB schema, subscriber management, monitoring, and security best practices"
category: "guides"
subcategory: "admin-guides"
tags: ["hss", "open5gs", "production", "subscriber-management", "mongodb", "diameter", "s6a"]
last_updated: "2025-12-19"
author: "Documentation Team"
difficulty: "advanced"
audience: "administrators"
---

# LTE WISP HSS Production Guide

Complete guide for the Open5GS HSS + Management Platform deployment.

---

## 📊 **System Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    LTE WISP Management Platform                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Web UI          │ HTTPS   │ Firebase         │ HTTP    │ HSS Management   │
│  (SvelteKit)     │────────▶│ Functions        │────────▶│ API              │
│  Firebase App    │         │ Proxy (hssProxy) │         │ (Node.js/Express)│
│  Hosting         │         │                  │         │ Port 3000        │
└──────────────────┘         └──────────────────┘         └──────────────────┘
                                                                    │
                                                                    │ REST API
                                                                    ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Remote MME      │ S6a     │ Open5GS HSS      │ MongoDB │ MongoDB Atlas    │
│  (eNodeB Sites)  │────────▶│ Diameter/S6a     │────────▶│ (Cloud Database) │
│                  │ TCP:3868│ Port 3868        │         │                  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

---

## 🖥️ **Server Details**

### **Production Server: acs-hss-server**
- **IP Address:** `136.112.111.167`
- **Hostname:** `acs-hss-server.c.lte-pci-mapper-65450042-bbf71.internal`
- **OS:** Ubuntu 24.04 LTS
- **Google Cloud Project:** `lte-pci-mapper-65450042-bbf71`
- **Zone:** `us-east4-c`

### **Services Running:**

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Open5GS HSS | 3868 | Diameter/S6a | MME authentication |
| HSS Management API | 3000 | HTTP/REST | Web UI backend |
| GenieACS CWMP | 7547 | TR-069 | CPE management |
| GenieACS NBI | 7557 | HTTP | GenieACS API |
| GenieACS FS | 7567 | HTTP | File server |
| GenieACS UI | 3333 | HTTP | Web interface |
| Prometheus Metrics | 9090 | HTTP | HSS monitoring |

---

## 🔐 **Open5GS HSS Configuration**

### **Configuration File:** `/etc/open5gs/hss.yaml`

```yaml
db_uri: mongodb+srv://user:****@cluster0.1radgkw.mongodb.net/open5gs  # Set via env; never commit real credentials

logger:
  level: info
  file:
    path: /var/log/open5gs/hss.log

global:
  max:
    ue: 1024

hss:
  freeDiameter: /etc/freeDiameter/hss.conf
  metrics:
    server:
      - address: 127.0.0.8
        port: 9090
```

### **FreeDiameter Configuration:** `/etc/freeDiameter/hss.conf`

```conf
Identity = "hss.open5gs.org";
Realm = "open5gs.org";

TLS_Cred = "/etc/freeDiameter/certs/hss.cert.pem", 
           "/etc/freeDiameter/certs/hss.key.pem";
TLS_CA = "/etc/freeDiameter/certs/cacert.pem";
TLS_DH_File = "/etc/freeDiameter/certs/dh2048.pem";

AppServThreads = 4;
Port = 3868;
SecPort = 5868;

No_SCTP;

# Listen on all interfaces (allows remote MME connections)
ListenOn = "0.0.0.0";

# Load FreeDiameter dictionaries
LoadExtension = "dbg_msg_dumps.fdx";
LoadExtension = "dict_nasreq.fdx";
LoadExtension = "dict_nas_mipv6.fdx";

# MME peer connection (configured per MME)
ConnectPeer = "mme.open5gs.org" { ConnectTo = "127.0.0.1"; No_TLS; };
```

### **Service Management:**

```bash
# Start/Stop/Restart HSS
systemctl start open5gs-hssd
systemctl stop open5gs-hssd
systemctl restart open5gs-hssd

# Check status
systemctl status open5gs-hssd

# View logs
journalctl -u open5gs-hssd -f
tail -f /var/log/open5gs/hss.log

# Check if listening
netstat -tlnp | grep 3868
```

---

## 📡 **MME Connection Configuration**

### **MME Requirements**

Your remote MME needs to connect to the cloud HSS via the S6a/Diameter interface.

### **MME Configuration (Open5GS MME Example)**

On your MME server, configure `/etc/open5gs/mme.yaml`:

```yaml
mme:
  freeDiameter: /etc/freeDiameter/mme.conf
  
  s1ap:
    server:
      - address: YOUR_MME_IP
  
  gtpc:
    server:
      - address: YOUR_MME_IP
  
  gummei:
    - plmn_id:
        mcc: 001
        mnc: 01
      mme_gid: 2
      mme_code: 1
  
  tai:
    - plmn_id:
        mcc: 001
        mnc: 01
      tac: 1
  
  security:
    integrity_order: [EIA2, EIA1, EIA0]
    ciphering_order: [EEA0, EEA1, EEA2]
```

### **MME FreeDiameter Configuration:** `/etc/freeDiameter/mme.conf`

```conf
Identity = "mme.open5gs.org";
Realm = "open5gs.org";

# Connect to cloud HSS
ConnectPeer = "hss.open5gs.org" { 
    ConnectTo = "136.112.111.167"; 
    Port = 3868;
    No_TLS;  # Use TLS in production!
};

Port = 3868;
SecPort = 5868;

No_SCTP;

ListenOn = "0.0.0.0";

LoadExtension = "dbg_msg_dumps.fdx";
LoadExtension = "dict_nasreq.fdx";
LoadExtension = "dict_nas_mipv6.fdx";
```

### **Network/Firewall Requirements**

**On HSS Server (136.112.111.167):**
```bash
# Allow Diameter/S6a from MME
ufw allow from MME_IP to any port 3868 proto tcp

# Or allow from all (less secure)
ufw allow 3868/tcp
```

**On MME Server:**
```bash
# Ensure MME can reach HSS
ping 136.112.111.167
telnet 136.112.111.167 3868
```

### **Test MME-HSS Connection**

```bash
# On HSS server, watch for incoming connections
journalctl -u open5gs-hssd -f

# On MME server, start MME
systemctl start open5gs-mmed

# You should see in HSS logs:
# "Diameter peer 'mme.open5gs.org' connected"
```

---

## 🗄️ **MongoDB Atlas Collections**

The HSS uses these collections in MongoDB Atlas:

### **1. `subscribers` Collection**

Stores subscriber authentication and profile data:

```javascript
{
  imsi: "001010000000001",           // 15-digit IMSI
  msisdn: "+1234567890",             // Phone number (optional)
  ki: "465B5CE8B199B49FAA5F0A2EE238A6BC",  // 128-bit auth key
  opc: "E8ED289DEBA952E4283B54E88E6183CA", // Operator code
  amf: "8000",                       // AMF field
  sqn: 64,                           // Sequence number
  
  security: {
    k: "465B5CE8B199B49FAA5F0A2EE238A6BC",
    opc: "E8ED289DEBA952E4283B54E88E6183CA",
    amf: "8000",
    sqn: 64
  },
  
  access_restriction_data: 32,
  subscriber_status: 0,              // 0=active, 1=inactive
  network_access_mode: 0,
  
  subscribed_rau_tau_timer: 12,
  
  slice: [
    {
      sst: 1,
      default_indicator: true,
      session: [
        {
          name: "internet",
          type: 3,  // IPv4
          qos: {
            index: 9,
            arp: {
              priority_level: 8,
              pre_emption_capability: 1,
              pre_emption_vulnerability: 1
            }
          },
          ambr: {
            uplink: { value: 1, unit: 3 },    // 1 Gbps
            downlink: { value: 1, unit: 3 }   // 1 Gbps
          }
        }
      ]
    }
  ],
  
  // Custom fields for management
  subscriber_name: "John Doe",
  email: "john@example.com",
  group_id: "group_001",
  bandwidth_plan_id: "plan_001",
  created_at: ISODate("2025-10-16T00:00:00Z"),
  updated_at: ISODate("2025-10-16T00:00:00Z")
}
```

### **2. `subscriber_groups` Collection**

```javascript
{
  group_id: "group_001",
  tenant_id: "tenant_001",
  name: "Residential Users",
  description: "Standard residential service",
  default_bandwidth_plan_id: "plan_001",
  member_count: 150,
  created_at: ISODate("2025-10-16T00:00:00Z")
}
```

### **3. `bandwidth_plans` Collection**

```javascript
{
  plan_id: "plan_001",
  tenant_id: "tenant_001",
  name: "Gold Plan",
  description: "Premium high-speed service",
  upload_mbps: 100,
  download_mbps: 500,
  qci: 9,
  apn: "internet",
  created_at: ISODate("2025-10-16T00:00:00Z")
}
```

---

## 🔧 **Useful Commands**

### **HSS Service**

```bash
# Check HSS status
systemctl status open5gs-hssd

# View real-time logs
journalctl -u open5gs-hssd -f

# Check if listening on S6a port
netstat -tlnp | grep 3868

# View metrics
curl http://127.0.0.8:9090/metrics

# Restart HSS
systemctl restart open5gs-hssd
```

### **HSS Management API**

```bash
# Check API status
systemctl status hss-api.service

# View API logs
journalctl -u hss-api.service -f

# Test API endpoints
curl http://localhost:3000/health
curl http://localhost:3000/subscribers
curl http://localhost:3000/bandwidth-plans
curl http://localhost:3000/groups

# Restart API
systemctl restart hss-api.service
```

### **GenieACS**

```bash
# Check all GenieACS services
systemctl status genieacs-{cwmp,nbi,fs,ui}

# Restart all services
systemctl restart genieacs-{cwmp,nbi,fs,ui}

# View logs
journalctl -u genieacs-cwmp -f
```

### **MongoDB Connection Test**

```bash
# Test Atlas connectivity
mongosh "mongodb+srv://user:****@cluster0.1radgkw.mongodb.net/open5gs"

# Query subscribers
db.subscribers.find().pretty()
db.subscribers.count()

# Check collections
show collections
```

---

## 🧪 **Testing the Complete System**

### **1. Add a Test Subscriber via Web UI**

1. Go to: `https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/modules/hss-management`
2. Click "Subscribers" tab
3. Click "➕ Add Subscriber"
4. Fill in the form:
   - **IMSI:** `001010000000001`
   - **Subscriber Name:** Test User
   - **Ki:** Click "🎲 Generate"
   - **OPc:** Click "🎲 Generate"
   - **Select Group:** (create one first if none exist)
   - **Select Bandwidth Plan:** (create one first)
5. Click "✅ Add Subscriber"

### **2. Verify in MongoDB**

```bash
mongosh "mongodb+srv://user:****@cluster0.1radgkw.mongodb.net/open5gs"

db.subscribers.findOne({imsi: "001010000000001"})
```

### **3. Test MME Connection**

On your MME server:
```bash
# Start MME
systemctl start open5gs-mmed

# Watch for S6a authentication
journalctl -u open5gs-mmed -f
```

On HSS server:
```bash
# Watch for incoming S6a requests
journalctl -u open5gs-hssd -f
tail -f /var/log/open5gs/hss.log
```

You should see:
- ✅ MME connects to HSS
- ✅ Authentication Information Request (AIR)
- ✅ Authentication Information Answer (AIA) with auth vectors
- ✅ Update Location Request (ULR)
- ✅ Update Location Answer (ULA)

### **4. Test UE Attachment**

1. Power on a UE (phone/modem) with SIM containing the IMSI
2. UE should attach to eNodeB
3. Check HSS logs for authentication:

```bash
tail -f /var/log/open5gs/hss.log | grep "001010000000001"
```

4. Verify IMEI is captured:

```bash
mongosh "mongodb+srv://user:****@cluster0.1radgkw.mongodb.net/open5gs"

db.subscribers.findOne(
  {imsi: "001010000000001"},
  {imei: 1, last_seen: 1}
)
```

---

## 📋 **Subscriber Management Workflows**

### **Create Bandwidth Plans**

1. Go to "Bandwidth Plans" tab
2. Create standard plans:
   - **Bronze:** 25 Mbps ↓ / 10 Mbps ↑
   - **Silver:** 100 Mbps ↓ / 50 Mbps ↑
   - **Gold:** 500 Mbps ↓ / 100 Mbps ↑

### **Create Subscriber Groups**

1. Go to "Groups" tab
2. Create groups:
   - **Residential:** For home users
   - **Business:** For business customers
   - **VIP:** Premium customers
3. Assign default bandwidth plan to each group

### **Add Individual Subscriber**

1. Go to "Subscribers" tab
2. Click "➕ Add Subscriber"
3. Fill in all required fields
4. Assign to group and plan
5. Click "Add"

### **Bulk Import Subscribers**

1. Go to "Bulk Import" tab
2. Download CSV template
3. Fill in subscriber data (IMSI, Ki, OPc, etc.)
4. Upload CSV file
5. Review preview
6. Click "Import"
7. Check results for any errors

### **Enable/Disable Subscribers**

1. Go to "Subscribers" tab
2. Find subscriber
3. Click toggle switch or "⚙️" menu
4. Select "Enable" or "Disable"
5. Changes sync to MongoDB and HSS immediately

---

## 🔒 **Security Considerations**

### **TLS/SSL**

Currently using:
- ✅ Self-signed certificates for FreeDiameter (S6a interface)
- ✅ Firebase Functions HTTPS proxy for web UI

**For production:**
1. Get a domain name (e.g., `hss.4gengineer.com`)
2. Use Google Cloud Load Balancer with managed SSL
3. Configure FreeDiameter to use proper TLS certificates
4. Enable mutual TLS (mTLS) between MME and HSS

### **Network Security**

```bash
# Restrict S6a port to known MME IPs only
ufw delete allow 3868/tcp
ufw allow from MME_IP_1 to any port 3868 proto tcp
ufw allow from MME_IP_2 to any port 3868 proto tcp

# Restrict management API to authorized IPs
ufw allow from ADMIN_IP to any port 3000 proto tcp
```

### **MongoDB Security**

- ✅ Using MongoDB Atlas with authentication
- ✅ Network access restricted via Atlas IP whitelist
- ✅ SSL/TLS encryption in transit
- ⚠️ Enable encryption at rest in Atlas settings
- ⚠️ Set up regular automated backups

---

## 📊 **Monitoring & Alerting**

### **HSS Prometheus Metrics**

Access metrics at: `http://127.0.0.8:9090/metrics`

Key metrics:
- `open5gs_hss_sessions_total` - Active sessions
- `open5gs_hss_auth_requests_total` - Authentication requests
- `open5gs_hss_auth_failures_total` - Failed authentications

### **Set Up Monitoring Stack**

```bash
# Install Prometheus and Grafana (optional)
docker run -d -p 9091:9090 prom/prometheus
docker run -d -p 3001:3000 grafana/grafana

# Configure Prometheus to scrape HSS metrics
# Add to prometheus.yml:
# - job_name: 'open5gs-hss'
#   static_configs:
#     - targets: ['127.0.0.8:9090']
```

### **Alerts to Configure**

1. HSS service down
2. MongoDB connection lost
3. High authentication failure rate
4. Diameter peer disconnected
5. Disk space low
6. Memory usage high

---

## 🔄 **Backup & Recovery**

### **MongoDB Backup**

MongoDB Atlas automatic backups:
- Go to Atlas Console → Backup tab
- Enable Continuous Backup or Cloud Backup Snapshots
- Configure retention policy (7-30 days recommended)

### **Manual Backup**

```bash
# Backup to local file
mongosh "mongodb+srv://..." --eval "db.subscribers.find()" > subscribers_backup.json

# Or use mongodump
mongodump --uri="mongodb+srv://user:****@cluster0.1radgkw.mongodb.net/open5gs" --out=/backup/
```

### **Configuration Backup**

```bash
# Backup HSS configs
tar -czf hss-config-backup-$(date +%Y%m%d).tar.gz \
  /etc/open5gs/hss.yaml \
  /etc/freeDiameter/hss.conf \
  /etc/freeDiameter/certs/ \
  /opt/hss-api/
```

---

## 🚨 **Troubleshooting**

### **HSS Not Starting**

```bash
# Check logs
journalctl -u open5gs-hssd -n 100 --no-pager
tail -100 /var/log/open5gs/hss.log

# Common issues:
# 1. MongoDB connection failed
#    - Check MongoDB Atlas IP whitelist
#    - Verify credentials in hss.yaml
#
# 2. FreeDiameter crash
#    - Check /etc/freeDiameter/hss.conf syntax
#    - Verify certificates exist and are readable
#
# 3. Port already in use
#    - Check: netstat -tlnp | grep 3868
#    - Kill conflicting process
```

### **MME Can't Connect to HSS**

```bash
# On MME, test connectivity
telnet 136.112.111.167 3868

# If fails, check:
# 1. Firewall on HSS server
ufw status

# 2. HSS listening on correct interface
netstat -tlnp | grep 3868

# 3. FreeDiameter logs
tail -f /var/log/open5gs/hss.log
```

### **Authentication Failures**

```bash
# Check HSS logs for errors
grep -i "error\|fail" /var/log/open5gs/hss.log | tail -20

# Verify subscriber exists in MongoDB
mongosh "mongodb+srv://..." --eval 'db.subscribers.findOne({imsi: "IMSI_HERE"})'

# Check Ki/OPc values match between SIM and database
```

### **Web UI Not Loading Data**

```bash
# Check Firebase Functions proxy
curl https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/bandwidth-plans

# Check backend API
curl http://localhost:3000/bandwidth-plans

# Check service
systemctl status hss-api.service
```

---

## 📚 **Additional Resources**

- **Open5GS Documentation:** https://open5gs.org/open5gs/docs/
- **3GPP S6a Specification:** TS 29.272
- **FreeDiameter:** http://www.freediameter.net/
- **MongoDB Atlas:** https://www.mongodb.com/atlas

---

## 📞 **Support Contacts**

- **HSS Service Issues:** Check `/var/log/open5gs/hss.log`
- **Web UI Issues:** Firebase Console logs
- **MongoDB Issues:** MongoDB Atlas support
- **Network Issues:** Google Cloud Network logs

---

## ✅ **Production Checklist**

Before going live:

- [ ] HSS service running and stable
- [ ] MongoDB Atlas backups configured
- [ ] Firewall rules properly configured
- [ ] TLS certificates for production
- [ ] Monitoring and alerting set up
- [ ] MME successfully connecting
- [ ] Test UE can attach and authenticate
- [ ] Bandwidth plans created
- [ ] Subscriber groups configured
- [ ] IMEI capture working
- [ ] GenieACS integration tested
- [ ] Team trained on web UI
- [ ] Documentation complete
- [ ] Disaster recovery plan in place

---

**System Status: ✅ PRODUCTION READY**

Last Updated: October 16, 2025

