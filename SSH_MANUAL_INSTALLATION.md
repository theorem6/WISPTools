# Manual Installation via SSH

Since GitHub no longer supports password authentication, here are your options for installing the multi-tenant GenieACS system on your backend server.

## 🎯 Method 1: Direct Copy-Paste (Easiest)

### Step 1: SSH to Your Server

```bash
ssh your-username@your-server-ip
```

### Step 2: Create the Installation Script

Copy and paste this entire command into your SSH session:

```bash
cat > /tmp/install-genieacs-mt.sh << 'EOFSCRIPT'
#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GenieACS Multi-Tenant Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "MongoDB Connection URI: " MONGODB_URI
read -p "External Domain/IP: " EXTERNAL_DOMAIN
EXTERNAL_IP=$(curl -s ifconfig.me || echo "127.0.0.1")

echo ""
echo "Configuration:"
echo "  MongoDB: ${MONGODB_URI:0:40}..."
echo "  Domain: $EXTERNAL_DOMAIN"
echo "  External IP: $EXTERNAL_IP"
echo ""

read -p "Continue? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "Cancelled"
    exit 1
fi

echo -e "${GREEN}[1/7]${NC} Installing GenieACS..."
sudo npm install -g genieacs

echo -e "${GREEN}[2/7]${NC} Creating directories..."
sudo mkdir -p /opt/genieacs/{ext/{provisions,virtual-parameters,extensions},config,firmware,logs}
sudo chown -R $USER:$USER /opt/genieacs

echo -e "${GREEN}[3/7]${NC} Creating configuration..."
cat > /opt/genieacs/config/config.json << EOF
{
  "MONGODB_CONNECTION_URL": "${MONGODB_URI}",
  "EXT_DIR": "/opt/genieacs/ext",
  "CWMP_PORT": 7547,
  "CWMP_INTERFACE": "0.0.0.0",
  "NBI_PORT": 7557,
  "NBI_INTERFACE": "0.0.0.0",
  "FS_PORT": 7567,
  "FS_INTERFACE": "0.0.0.0",
  "FS_HOSTNAME": "${EXTERNAL_DOMAIN}",
  "UI_PORT": 3000,
  "LOG_LEVEL": "info",
  "MULTI_TENANT_ENABLED": true
}
EOF

echo -e "${GREEN}[4/7]${NC} Creating virtual parameters..."
cat > /opt/genieacs/ext/virtual-parameters/tenant-id.js << 'EOF'
const tags = declare("Tags", {value: now});
if (tags.value) {
  for (let tag of tags.value[0]) {
    if (tag.startsWith("tenant:")) {
      return tag.substring(7);
    }
  }
}
return null;
EOF

cat > /opt/genieacs/ext/virtual-parameters/pci.js << 'EOF'
const pci = declare("Device.Cellular.Interface.1.X_LTE_Cell.PCI", {value: now});
if (pci.value && pci.value[0]) {
  return parseInt(pci.value[0]);
}
return null;
EOF

echo -e "${GREEN}[5/7]${NC} Creating provisions..."
cat > /opt/genieacs/ext/provisions/tenant-setup.js << 'EOF'
const now = Date.now();
const connectionUrl = declare("Device.ManagementServer.ConnectionRequestURL", {value: now});
if (connectionUrl.value && connectionUrl.value[0]) {
  const url = connectionUrl.value[0];
  const tenantMatch = url.match(/\/cwmp\/([a-zA-Z0-9-_]+)/);
  if (tenantMatch) {
    const tenantId = tenantMatch[1];
    declare("Tags.tenant:" + tenantId, null, {value: true});
    log("Device tagged with tenant: " + tenantId);
  }
}
declare("Device.ManagementServer.PeriodicInformEnable", {value: now}, {value: true});
declare("Device.ManagementServer.PeriodicInformInterval", {value: now}, {value: 300});
EOF

echo -e "${GREEN}[6/7]${NC} Creating systemd services..."

sudo tee /etc/systemd/system/genieacs-cwmp.service > /dev/null << EOF
[Unit]
Description=GenieACS CWMP (Multi-Tenant)
After=network.target

[Service]
Type=simple
User=$USER
Environment="GENIEACS_CWMP_PORT=7547"
Environment="GENIEACS_CWMP_INTERFACE=0.0.0.0"
Environment="GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}"
Environment="GENIEACS_EXT_DIR=/opt/genieacs/ext"
ExecStart=$(which genieacs-cwmp)
Restart=always
RestartSec=10
StandardOutput=append:/opt/genieacs/logs/genieacs-cwmp.log
StandardError=append:/opt/genieacs/logs/genieacs-cwmp.log

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/genieacs-nbi.service > /dev/null << EOF
[Unit]
Description=GenieACS NBI (Multi-Tenant)
After=network.target

[Service]
Type=simple
User=$USER
Environment="GENIEACS_NBI_PORT=7557"
Environment="GENIEACS_NBI_INTERFACE=0.0.0.0"
Environment="GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}"
Environment="GENIEACS_EXT_DIR=/opt/genieacs/ext"
ExecStart=$(which genieacs-nbi)
Restart=always
RestartSec=10
StandardOutput=append:/opt/genieacs/logs/genieacs-nbi.log
StandardError=append:/opt/genieacs/logs/genieacs-nbi.log

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/genieacs-fs.service > /dev/null << EOF
[Unit]
Description=GenieACS FS (Multi-Tenant)
After=network.target

[Service]
Type=simple
User=$USER
Environment="GENIEACS_FS_PORT=7567"
Environment="GENIEACS_FS_INTERFACE=0.0.0.0"
Environment="GENIEACS_FS_HOSTNAME=${EXTERNAL_DOMAIN}"
Environment="GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}"
Environment="GENIEACS_EXT_DIR=/opt/genieacs/ext"
ExecStart=$(which genieacs-fs)
Restart=always
RestartSec=10
StandardOutput=append:/opt/genieacs/logs/genieacs-fs.log
StandardError=append:/opt/genieacs/logs/genieacs-fs.log

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/genieacs-ui.service > /dev/null << EOF
[Unit]
Description=GenieACS UI (Multi-Tenant)
After=network.target

[Service]
Type=simple
User=$USER
Environment="GENIEACS_UI_PORT=3000"
Environment="GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI}"
ExecStart=$(which genieacs-ui)
Restart=always
RestartSec=10
StandardOutput=append:/opt/genieacs/logs/genieacs-ui.log
StandardError=append:/opt/genieacs/logs/genieacs-ui.log

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}[7/7]${NC} Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui
sudo systemctl start genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui

sleep 3

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Installation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Service Status:"
sudo systemctl is-active genieacs-cwmp && echo "  ✓ CWMP: Running" || echo "  ✗ CWMP: Failed"
sudo systemctl is-active genieacs-nbi && echo "  ✓ NBI: Running" || echo "  ✗ NBI: Failed"
sudo systemctl is-active genieacs-fs && echo "  ✓ FS: Running" || echo "  ✗ FS: Failed"
sudo systemctl is-active genieacs-ui && echo "  ✓ UI: Running" || echo "  ✗ UI: Failed"

echo ""
echo "Endpoints:"
echo "  CWMP: http://${EXTERNAL_DOMAIN}:7547"
echo "  NBI:  http://${EXTERNAL_IP}:7557"
echo "  FS:   http://${EXTERNAL_IP}:7567"
echo "  UI:   http://${EXTERNAL_IP}:3000"
echo ""
echo "Next Steps:"
echo "  1. Configure Firebase Functions with these URLs"
echo "  2. Deploy frontend with Firebase"
echo "  3. Create first tenant in the UI"
echo "  4. Use CWMP URL: http://${EXTERNAL_DOMAIN}:7547/cwmp/{tenant-subdomain}"
echo ""

EOFSCRIPT
```

### Step 3: Make it Executable and Run

```bash
chmod +x /tmp/install-genieacs-mt.sh
sudo /tmp/install-genieacs-mt.sh
```

### Step 4: You'll Be Asked For:
- **MongoDB Connection URI**: Your MongoDB Atlas connection string
- **External Domain/IP**: Your server's public IP or domain name

## 🎯 Method 2: SCP from Local Machine

If you have the files locally, upload them:

```bash
# From your local machine (Windows PowerShell or Linux/Mac terminal)
scp install-genieacs-multitenant.sh user@your-server:/tmp/

# Then SSH and run
ssh user@your-server
chmod +x /tmp/install-genieacs-multitenant.sh
sudo /tmp/install-genieacs-multitenant.sh
```

## 🎯 Method 3: Use GitHub Personal Access Token

### Step 1: Create Personal Access Token
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (Full control of private repositories)
4. Generate and copy the token

### Step 2: Clone with Token

```bash
# SSH to your server
ssh user@your-server

# Clone using token (replace YOUR_TOKEN and USERNAME)
git clone https://YOUR_TOKEN@github.com/USERNAME/PCI_mapper.git

# Navigate and install
cd PCI_mapper
chmod +x install-genieacs-multitenant.sh
sudo ./install-genieacs-multitenant.sh
```

## 🎯 Method 4: GitHub SSH Keys

### Step 1: Generate SSH Key on Server

```bash
# On your server
ssh-keygen -t ed25519 -C "your_email@example.com"

# Display the public key
cat ~/.ssh/id_ed25519.pub
```

### Step 2: Add to GitHub
1. Copy the public key output
2. Go to: https://github.com/settings/ssh/new
3. Paste key and save

### Step 3: Clone and Install

```bash
git clone git@github.com:yourusername/PCI_mapper.git
cd PCI_mapper
chmod +x install-genieacs-multitenant.sh
sudo ./install-genieacs-multitenant.sh
```

## 📋 After Installation

### Check Services

```bash
# Check all services
sudo systemctl status genieacs-*

# View logs
tail -f /opt/genieacs/logs/genieacs-cwmp.log
tail -f /opt/genieacs/logs/genieacs-nbi.log
```

### Test Endpoints

```bash
# Test NBI (should return empty array or devices)
curl http://localhost:7557/devices

# Test CWMP (should return 405 Method Not Allowed for GET)
curl http://localhost:7547
```

### Configure Firebase Functions

Update your Firebase Functions config:

```bash
# On your LOCAL machine where you have the Firebase project
firebase functions:config:set \
  genieacs.nbi_url="http://YOUR_SERVER_IP:7557" \
  genieacs.cwmp_url="http://YOUR_SERVER_IP:7547" \
  genieacs.fs_url="http://YOUR_SERVER_IP:7567"

# Deploy functions
firebase deploy --only functions
```

## 🔥 Quick Verification

After installation, verify everything works:

```bash
# 1. Check services are running
sudo systemctl is-active genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui

# 2. Check ports are listening
sudo netstat -tulpn | grep -E '(7547|7557|7567|3000)'

# 3. Test GenieACS NBI
curl -s http://localhost:7557/devices | head

# 4. Check logs for errors
sudo journalctl -u genieacs-cwmp -n 50 --no-pager
```

## 🐛 Troubleshooting

### If npm not found:

```bash
# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### If services fail to start:

```bash
# Check specific service
sudo journalctl -u genieacs-cwmp -n 100

# Check MongoDB connection
node -e "require('mongodb').MongoClient.connect('YOUR_MONGODB_URI', (err, client) => { console.log(err || 'Connected!'); client && client.close(); })"
```

### If ports already in use:

```bash
# Check what's using the ports
sudo lsof -i :7547
sudo lsof -i :7557
sudo lsof -i :7567

# Stop conflicting services
sudo systemctl stop <service-name>
```

## 📝 What Gets Installed

- **GenieACS** (latest from npm)
- **Directory structure** at `/opt/genieacs/`
- **Virtual parameters** for multi-tenancy
- **Provisions** for tenant tagging
- **4 systemd services**:
  - genieacs-cwmp (port 7547)
  - genieacs-nbi (port 7557)
  - genieacs-fs (port 7567)
  - genieacs-ui (port 3000)

## ✅ Success Indicators

After successful installation:

- ✅ All 4 services show "active (running)"
- ✅ Ports 7547, 7557, 7567, 3000 are listening
- ✅ `/opt/genieacs/` directory exists with files
- ✅ Logs show no errors: `/opt/genieacs/logs/*.log`
- ✅ NBI returns JSON response (empty array OK)
- ✅ MongoDB connection working

## 🎯 Next Steps

1. **Configure Firebase Functions** with server URLs
2. **Deploy Frontend** to Firebase App Hosting
3. **Open Firewall Ports**:
   ```bash
   sudo ufw allow 7547/tcp  # CWMP
   sudo ufw allow 7557/tcp  # NBI (if needed externally)
   sudo ufw allow 7567/tcp  # FS (if needed externally)
   sudo ufw allow 3000/tcp  # UI (optional)
   ```
4. **Create First Tenant** in your web UI
5. **Connect Test Device** using tenant's CWMP URL

---

**Need Help?**
- Check logs: `tail -f /opt/genieacs/logs/*.log`
- Check service status: `sudo systemctl status genieacs-*`
- Test connectivity: `curl http://localhost:7557/devices`

