# 📋 HSS Installation - Copy & Paste Commands

## Just Copy These Commands Into Your Server Terminal

### Step 1: Navigate to Home Directory and Create Install Directory

```bash
cd ~
mkdir -p hss-install
cd hss-install
```

### Step 2: Download HSS Module from GitHub

```bash
curl -L https://github.com/theorem6/lte-pci-mapper/archive/refs/heads/main.zip -o lte-pci-mapper.zip
unzip -q lte-pci-mapper.zip
cd lte-pci-mapper-main/hss-module
```

### Step 3: Set Configuration Variables

```bash
# Set MongoDB URI
export MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

# Generate encryption key
export HSS_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Show the key (SAVE THIS!)
echo "Your HSS Encryption Key: $HSS_ENCRYPTION_KEY"
echo "⚠️  SAVE THIS KEY SECURELY!"
```

### Step 4: Install HSS

```bash
# Create HSS directory
sudo mkdir -p /opt/hss-server
sudo chown $USER:$USER /opt/hss-server

# Copy files
cp -r . /opt/hss-server/

# Install dependencies
cd /opt/hss-server
npm install --production
npm install milenage mongodb express cors
```

### Step 5: Create Configuration File

```bash
cat > /opt/hss-server/config.json << 'EOF'
{
  "server": {
    "host": "0.0.0.0",
    "rest_api_port": 3000,
    "s6a_port": 3868
  },
  "diameter": {
    "realm": "lte-pci-mapper.com",
    "identity": "hss.lte-pci-mapper.com",
    "vendor_id": 10415,
    "product_name": "Cloud HSS"
  },
  "mongodb": {
    "uri": "MONGODB_URI_PLACEHOLDER",
    "database": "hss"
  },
  "acs_integration": {
    "enabled": true,
    "sync_interval_minutes": 5,
    "genieacs_mongodb_uri": "MONGODB_URI_PLACEHOLDER",
    "genieacs_database": "genieacs"
  },
  "features": {
    "capture_imei": true,
    "track_sessions": true,
    "audit_logging": true
  }
}
EOF

# Update config with actual MongoDB URI
sed -i "s|MONGODB_URI_PLACEHOLDER|$MONGODB_URI|g" /opt/hss-server/config.json
```

### Step 6: Initialize Database

```bash
cd /opt/hss-server
node scripts/init-database.js
```

### Step 7: Create Systemd Service

```bash
sudo tee /etc/systemd/system/hss.service > /dev/null << EOF
[Unit]
Description=Cloud HSS Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/hss-server
Environment="NODE_ENV=production"
Environment="HSS_ENCRYPTION_KEY=$HSS_ENCRYPTION_KEY"
Environment="MONGODB_URI=$MONGODB_URI"
ExecStart=/usr/bin/node /opt/hss-server/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

### Step 8: Start HSS Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable hss
sudo systemctl start hss
```

### Step 9: Verify Installation

```bash
# Check status
sudo systemctl status hss

# Test API
curl http://localhost:3000/health

# Should return: {"status": "healthy", ...}
```

---

## ✅ That's It!

HSS is now installed and running. 

### Test It Works:

```bash
# Get external IP
EXTERNAL_IP=$(curl -s ifconfig.me)
echo "Your external IP: $EXTERNAL_IP"

# Test from internet (in browser or curl)
echo "Test URL: http://$EXTERNAL_IP/api/hss/health"
```

---

## 🔧 Useful Commands

```bash
# View logs
sudo journalctl -u hss -f

# Restart service
sudo systemctl restart hss

# Stop service
sudo systemctl stop hss

# Start service
sudo systemctl start hss
```

---

**Installation complete!** 🎉

Your encryption key: Check the output from Step 3 and save it securely!




