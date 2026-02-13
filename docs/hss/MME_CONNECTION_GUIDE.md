# MME Connection Guide - Connecting Remote MMEs to Cloud HSS

This guide explains how to configure remote MME installations to connect to the cloud-based Open5GS HSS.

---

## 🎯 **Overview**

Your cloud HSS is accessible at:
- **IP Address:** `136.112.111.167`
- **Port:** `3868` (Diameter/S6a)
- **Identity:** `hss.open5gs.org`
- **Realm:** `open5gs.org`

---

## 📋 **Prerequisites**

### **On MME Server:**

1. ✅ Open5GS MME installed
2. ✅ Network connectivity to `136.112.111.167:3868`
3. ✅ FreeDiameter installed and configured
4. ✅ Proper PLMN/TAI configuration matching your network

### **Network Requirements:**

```bash
# Test connectivity from MME to HSS
ping 136.112.111.167
telnet 136.112.111.167 3868

# Should connect successfully
```

---

## ⚙️ **MME Configuration**

### **Step 1: Configure MME Service**

Edit `/etc/open5gs/mme.yaml`:

```yaml
logger:
  file:
    path: /var/log/open5gs/mme.log
  level: info

global:
  max:
    ue: 1024

mme:
  # FreeDiameter configuration for S6a interface
  freeDiameter: /etc/freeDiameter/mme.conf
  
  # S1AP interface (connects to eNodeB)
  s1ap:
    server:
      - address: YOUR_MME_IP_ADDRESS
        port: 36412
  
  # GTPC interface (connects to SGW)
  gtpc:
    server:
      - address: YOUR_MME_IP_ADDRESS
  
  # GUMMEI (Globally Unique MME Identifier)
  gummei:
    - plmn_id:
        mcc: 001  # Mobile Country Code (change to your MCC)
        mnc: 01   # Mobile Network Code (change to your MNC)
      mme_gid: 2  # MME Group ID
      mme_code: 1 # MME Code
  
  # TAI (Tracking Area Identity)
  tai:
    - plmn_id:
        mcc: 001  # Must match eNodeB and USIM
        mnc: 01   # Must match eNodeB and USIM
      tac: 1      # Tracking Area Code (change to match your eNodeB)
  
  # Security algorithms
  security:
    integrity_order: [EIA2, EIA1, EIA0]
    ciphering_order: [EEA0, EEA1, EEA2]
  
  # Network name
  network_name:
    full: Your Network Name
    short: YourNet
  
  # MME name for display
  mme_name: mme.open5gs.org
```

### **Step 2: Configure FreeDiameter for S6a**

Edit `/etc/freeDiameter/mme.conf`:

```conf
##############################################################
# FreeDiameter Configuration for Open5GS MME
# S6a Interface - Connects to Cloud HSS
##############################################################

# Local MME Identity
Identity = "mme.open5gs.org";
Realm = "open5gs.org";

# Local Diameter ports
Port = 3868;
SecPort = 5868;

# Use TCP only (no SCTP) for cloud compatibility
No_SCTP;

# Listen on all interfaces
ListenOn = "0.0.0.0";

# Application threads
AppServThreads = 4;

##############################################################
# TLS Configuration (Optional - for secure connections)
##############################################################

# For non-TLS (testing/internal network):
# Use No_TLS in ConnectPeer directive below

# For TLS (production):
# Uncomment and configure:
# TLS_Cred = "/etc/freeDiameter/certs/mme.cert.pem",
#            "/etc/freeDiameter/certs/mme.key.pem";
# TLS_CA = "/etc/freeDiameter/certs/cacert.pem";
# TLS_DH_File = "/etc/freeDiameter/certs/dh2048.pem";

##############################################################
# Dictionary Extensions
##############################################################

LoadExtension = "dbg_msg_dumps.fdx";
LoadExtension = "dict_nasreq.fdx";
LoadExtension = "dict_nas_mipv6.fdx";

##############################################################
# Peer Configuration - Cloud HSS
##############################################################

# Connect to Cloud HSS
ConnectPeer = "hss.open5gs.org" {
    # Cloud HSS IP address
    ConnectTo = "136.112.111.167";
    
    # Diameter port
    Port = 3868;
    
    # No TLS for now (use TLS in production!)
    No_TLS;
    
    # TCP only
    No_SCTP;
    
    # Connection timers (seconds)
    TcTimer = 30;
    TwTimer = 30;
};

##############################################################
# Optional: Additional HSS peers for redundancy
##############################################################

# ConnectPeer = "hss2.open5gs.org" {
#     ConnectTo = "BACKUP_HSS_IP";
#     Port = 3868;
#     No_TLS;
# };
```

### **Step 3: Generate TLS Certificates (Optional for Production)**

```bash
# Create certificate directory
mkdir -p /etc/freeDiameter/certs
cd /etc/freeDiameter/certs

# Generate CA certificate
openssl req -new -x509 -days 3650 -nodes \
  -newkey rsa:2048 \
  -out cacert.pem \
  -keyout cakey.pem \
  -subj "/C=US/ST=State/L=City/O=YourOrg/CN=Root CA"

# Generate MME certificate
openssl req -new -nodes \
  -newkey rsa:2048 \
  -out mme.csr \
  -keyout mme.key.pem \
  -subj "/C=US/ST=State/L=City/O=YourOrg/CN=mme.open5gs.org"

# Sign the certificate
openssl x509 -req -days 3650 \
  -in mme.csr \
  -CA cacert.pem \
  -CAkey cakey.pem \
  -CAcreateserial \
  -out mme.cert.pem

# Generate DH parameters
openssl dhparam -out dh2048.pem 2048

# Set permissions
chmod 644 *.pem
chown -R open5gs:open5gs /etc/freeDiameter/certs
```

Then update `/etc/freeDiameter/mme.conf` to use TLS and remove `No_TLS;` from ConnectPeer.

### **Step 4: Start MME Service**

```bash
# Enable and start MME
systemctl enable open5gs-mmed
systemctl start open5gs-mmed

# Check status
systemctl status open5gs-mmed

# Watch logs for S6a connection
journalctl -u open5gs-mmed -f
```

You should see:
```
Diameter peer 'hss.open5gs.org' is now connected
```

---

## 🧪 **Verify MME-HSS Connection**

### **On MME Server:**

```bash
# Check MME status
systemctl status open5gs-mmed

# View MME logs
journalctl -u open5gs-mmed -n 100 --no-pager | grep -i "hss\|diameter\|s6a"

# You should see:
# - "Trying to connect to hss.open5gs.org"
# - "Peer hss.open5gs.org connected"
# - No connection errors
```

### **On HSS Server (136.112.111.167):**

```bash
# Watch for incoming MME connection
journalctl -u open5gs-hssd -f

# You should see:
# - "Diameter peer 'mme.open5gs.org' connected"
# - Authentication requests when UE attaches

# Check active connections
tail -f /var/log/open5gs/hss.log | grep "peer\|connect"
```

### **Test Authentication Flow:**

1. **Attach a UE** to your eNodeB connected to the MME
2. **Watch MME logs:**
   ```bash
   journalctl -u open5gs-mmed -f | grep -i "s6a\|auth"
   ```
3. **Watch HSS logs:**
   ```bash
   tail -f /var/log/open5gs/hss.log | grep -i "auth\|air\|ula"
   ```

**Expected flow:**
```
MME → HSS: AIR (Authentication Information Request)
HSS → MME: AIA (Authentication Information Answer) + Auth Vectors
MME → HSS: ULR (Update Location Request)
HSS → MME: ULA (Update Location Answer)
UE: ✅ Attached successfully
```

---

## 🌐 **Multiple MME Deployment**

### **Scenario: Multiple eNodeB Sites with Local MMEs**

```
Site 1 (MME 1) ─┐
Site 2 (MME 2) ─┼──▶ Cloud HSS (136.112.111.167:3868)
Site 3 (MME 3) ─┘
```

### **On Each MME:**

Configure the same cloud HSS connection in `/etc/freeDiameter/mme.conf`:

```conf
ConnectPeer = "hss.open5gs.org" {
    ConnectTo = "136.112.111.167";
    Port = 3868;
    No_TLS;
};
```

### **On HSS Server:**

Add each MME peer to `/etc/freeDiameter/hss.conf`:

```conf
# MME Site 1
ConnectPeer = "mme1.open5gs.org" { ConnectTo = "MME1_IP"; No_TLS; };

# MME Site 2
ConnectPeer = "mme2.open5gs.org" { ConnectTo = "MME2_IP"; No_TLS; };

# MME Site 3
ConnectPeer = "mme3.open5gs.org" { ConnectTo = "MME3_IP"; No_TLS; };
```

Then restart:
```bash
systemctl restart open5gs-hssd
```

---

## 🔍 **Diameter Message Debugging**

### **Enable Detailed Diameter Logging**

On HSS server, edit `/etc/freeDiameter/hss.conf`:

```conf
# Add this line for verbose debugging
LoadExtension = "dbg_msg_dumps.fdx" : "/var/log/open5gs/diameter-debug.log";
```

Restart HSS:
```bash
systemctl restart open5gs-hssd
```

View Diameter messages:
```bash
tail -f /var/log/open5gs/diameter-debug.log
```

### **Common S6a Messages**

| Message | Code | Direction | Purpose |
|---------|------|-----------|---------|
| AIR | 318 | MME → HSS | Request authentication vectors |
| AIA | 318 | HSS → MME | Send authentication vectors |
| ULR | 316 | MME → HSS | Update subscriber location |
| ULA | 316 | HSS → MME | Confirm location update |
| PUR | 321 | MME → HSS | Purge UE data |
| PUA | 321 | HSS → MME | Confirm purge |
| NOR | 323 | HSS → MME | Notification |
| NOA | 323 | MME → HSS | Acknowledge notification |

---

## 🔐 **Security Best Practices**

### **1. Enable TLS on S6a Interface**

For production, always use TLS:

```conf
# In /etc/freeDiameter/mme.conf
ConnectPeer = "hss.open5gs.org" {
    ConnectTo = "136.112.111.167";
    Port = 5868;  # Use SecPort instead of Port
    # Remove No_TLS
};
```

### **2. Use IPsec/VPN Between MME and HSS**

For additional security:
- Set up WireGuard or IPsec tunnel between MME and HSS
- Route Diameter traffic through encrypted tunnel
- Use private IP addresses within VPN

### **3. Implement Rate Limiting**

On HSS server:
```bash
# Limit connections per IP
iptables -A INPUT -p tcp --dport 3868 -m connlimit --connlimit-above 10 -j REJECT
```

### **4. Monitor for Anomalies**

```bash
# Alert on high authentication failure rate
# Alert on unknown MME connection attempts
# Alert on unusual traffic patterns
```

---

## 📊 **Performance Tuning**

### **HSS Server**

```yaml
# In /etc/open5gs/hss.yaml
global:
  max:
    ue: 10000  # Increase for large deployments

hss:
  freeDiameter: /etc/freeDiameter/hss.conf
```

### **FreeDiameter**

```conf
# In /etc/freeDiameter/hss.conf
AppServThreads = 8;  # Increase for high load
```

### **System Limits**

```bash
# Increase file descriptors
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# Increase connection tracking
sysctl -w net.netfilter.nf_conntrack_max=1000000
```

---

## 🧪 **Testing Checklist**

### **1. Basic Connectivity**

```bash
# From MME server
telnet 136.112.111.167 3868
# Should connect successfully
```

### **2. Diameter Peer Connection**

```bash
# Start MME
systemctl start open5gs-mmed

# Check MME logs
journalctl -u open5gs-mmed -n 50 | grep -i diameter

# Should see: "Peer hss.open5gs.org is now connected"
```

### **3. Authentication Test**

```bash
# Add test subscriber via web UI:
# IMSI: 001010000000001
# Ki: (generated)
# OPc: (generated)

# Configure USIM with same credentials
# Attach UE to eNodeB

# Watch MME logs:
journalctl -u open5gs-mmed -f

# Watch HSS logs:
ssh root@136.112.111.167 "tail -f /var/log/open5gs/hss.log"
```

### **4. Verify in MongoDB**

```bash
# Check if subscriber authenticated
mongosh "mongodb+srv://user:****@cluster0.1radgkw.mongodb.net/open5gs"  # Use MONGODB_URI from env

db.subscribers.findOne(
  {imsi: "001010000000001"},
  {imsi: 1, last_auth: 1, attach_count: 1}
)
```

---

## 🚨 **Common Issues & Solutions**

### **Issue: MME Can't Connect to HSS**

**Symptoms:**
```
Error: Connection to peer hss.open5gs.org failed
```

**Solutions:**
```bash
# 1. Check firewall on HSS server
ssh root@136.112.111.167 "ufw status | grep 3868"

# 2. Verify HSS is listening
ssh root@136.112.111.167 "netstat -tlnp | grep 3868"

# 3. Check HSS logs for errors
ssh root@136.112.111.167 "journalctl -u open5gs-hssd -n 50"

# 4. Test network connectivity
traceroute 136.112.111.167
ping -c 5 136.112.111.167
```

### **Issue: Authentication Failures**

**Symptoms:**
```
Authentication rejected by HSS
```

**Solutions:**
```bash
# 1. Verify subscriber exists in MongoDB
mongosh "..." --eval 'db.subscribers.findOne({imsi: "YOUR_IMSI"})'

# 2. Check Ki/OPc match between SIM and database

# 3. Verify PLMN matches
# MME mcc/mnc must match:
# - eNodeB configuration
# - USIM PLMN
# - TAI configuration

# 4. Check HSS logs for specific error
ssh root@136.112.111.167 "grep -i 'YOUR_IMSI' /var/log/open5gs/hss.log"
```

### **Issue: Diameter CER/CEA Timeout**

**Symptoms:**
```
Capabilities Exchange Request timeout
```

**Solutions:**
```bash
# 1. Check if identities match
# MME config: Identity = "mme.open5gs.org"
# HSS config: ConnectPeer = "mme.open5gs.org"

# 2. Verify realm matches
# Both: Realm = "open5gs.org"

# 3. Increase timeout in mme.conf
TcTimer = 60;
TwTimer = 60;
```

### **Issue: Subscriber Not Found**

**Symptoms:**
```
HSS returns: User Unknown
```

**Solutions:**
```bash
# 1. Add subscriber via web UI first
# https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app/modules/hss-management

# 2. Verify in MongoDB
mongosh "..." --eval 'db.subscribers.find({imsi: {$regex: "00101"}}).count()'

# 3. Check IMSI format (must be exactly 15 digits)
# Correct: 001010000000001
# Wrong: 1010000000001 (missing leading zeros)
```

---

## 📈 **Scaling Considerations**

### **For Large Deployments (1000+ subscribers):**

1. **Increase HSS Resources:**
   ```bash
   # Upgrade GCE VM instance type
   gcloud compute instances set-machine-type acs-hss-server \
     --machine-type=n2-standard-4 \
     --zone=us-east4-c
   ```

2. **Enable MongoDB Sharding:**
   - Configure in MongoDB Atlas
   - Shard key: `imsi`

3. **Add HSS Redundancy:**
   - Deploy second HSS instance
   - Configure MMEs with both HSS peers
   - Use DNS round-robin or load balancer

4. **Optimize FreeDiameter:**
   ```conf
   AppServThreads = 16;
   No_Stats;  # Disable if not needed
   ```

---

## 🔄 **Maintenance Procedures**

### **HSS Updates/Restart**

```bash
# 1. Notify MME administrators of maintenance window

# 2. On HSS server
systemctl stop open5gs-hssd

# 3. Perform updates/maintenance

# 4. Start HSS
systemctl start open5gs-hssd

# 5. Verify all MMEs reconnected
journalctl -u open5gs-hssd -n 100 | grep "peer.*connected"
```

### **Adding New MME**

1. **On new MME:** Configure as described above
2. **On HSS server:** Add peer to `/etc/freeDiameter/hss.conf`
3. **Restart HSS:** `systemctl restart open5gs-hssd`
4. **Start new MME:** `systemctl start open5gs-mmed`
5. **Verify connection** in both logs

### **Removing MME**

1. **Stop MME:** `systemctl stop open5gs-mmed`
2. **On HSS:** Remove peer from `/etc/freeDiameter/hss.conf`
3. **Restart HSS:** `systemctl restart open5gs-hssd`

---

## 📞 **Emergency Procedures**

### **HSS Service Down**

```bash
# Quick restart
ssh root@136.112.111.167 "systemctl restart open5gs-hssd"

# If still failing, check:
ssh root@136.112.111.167 "journalctl -u open5gs-hssd -n 100"

# Common fixes:
# - MongoDB connection lost → Check Atlas status
# - FreeDiameter crash → Check certificate expiry
# - Port conflict → Check for rogue processes
```

### **Mass Authentication Failures**

```bash
# 1. Check HSS status
ssh root@136.112.111.167 "systemctl status open5gs-hssd"

# 2. Check MongoDB connectivity
ssh root@136.112.111.167 "mongosh 'mongodb+srv://...' --eval 'db.serverStatus()'"

# 3. Check for database corruption
# 4. Restore from backup if needed
```

---

## 📚 **Reference Documents**

- **3GPP TS 29.272:** S6a interface specification
- **3GPP TS 33.401:** LTE security architecture
- **Open5GS Docs:** https://open5gs.org/open5gs/docs/guide/02-building-open5gs-from-sources/
- **FreeDiameter:** http://www.freediameter.net/trac/

---

## ✅ **Pre-Production Checklist**

Before connecting production MMEs:

- [ ] HSS service stable for 24+ hours
- [ ] MongoDB backups configured and tested
- [ ] Firewall rules properly configured
- [ ] Test subscriber can authenticate
- [ ] TLS certificates deployed (production)
- [ ] Monitoring and alerting active
- [ ] Emergency procedures documented
- [ ] Team trained on troubleshooting
- [ ] Backup HSS available (optional but recommended)
- [ ] DDoS protection configured

---

**Document Version:** 1.0  
**Last Updated:** October 16, 2025  
**Contact:** HSS Admin Team

