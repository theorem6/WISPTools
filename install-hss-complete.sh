#!/bin/bash
# Complete HSS Installation Script - Beginning to End
# Deploys Cloud HSS + GenieACS to GCE instance: genieacs-backend
# Project: lte-pci-mapper-65450042-bbf71
# Zone: us-central1-a

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Complete HSS Installation - Beginning to End"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Project:  lte-pci-mapper-65450042-bbf71"
echo "Instance: genieacs-backend"
echo "Zone:     us-central1-a"
echo ""
echo "This script will:"
echo "  1. Create Google Cloud secrets"
echo "  2. Create/configure GCE instance"
echo "  3. Install HSS server"
echo "  4. Install GenieACS"
echo "  5. Initialize databases"
echo "  6. Create sample data (plans, groups)"
echo "  7. Start all services"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="lte-pci-mapper-65450042-bbf71"
INSTANCE_NAME="genieacs-backend"
ZONE="us-central1-a"
MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

# ============================================================================
# STEP 1: Set Google Cloud Project
# ============================================================================
echo -e "${BLUE}Step 1/10: Setting Google Cloud project...${NC}"
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✅ Project set${NC}"
echo ""

# ============================================================================
# STEP 2: Create Secrets
# ============================================================================
echo -e "${BLUE}Step 2/10: Creating secrets in Secret Manager...${NC}"

# MongoDB URI
if gcloud secrets describe mongodb-uri &>/dev/null; then
  echo -e "${YELLOW}⚠️  mongodb-uri secret already exists${NC}"
else
  echo -n "$MONGODB_URI" | gcloud secrets create mongodb-uri --data-file=-
  echo -e "${GREEN}✅ Created mongodb-uri secret${NC}"
fi

# HSS Encryption Key
if gcloud secrets describe hss-encryption-key &>/dev/null; then
  echo -e "${YELLOW}⚠️  hss-encryption-key secret already exists${NC}"
else
  ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo -n "$ENCRYPTION_KEY" | gcloud secrets create hss-encryption-key --data-file=-
  echo -e "${GREEN}✅ Created hss-encryption-key secret${NC}"
  echo -e "${YELLOW}   Encryption key: $ENCRYPTION_KEY${NC}"
fi
echo ""

# ============================================================================
# STEP 3: Grant Cloud Build Permissions
# ============================================================================
echo -e "${BLUE}Step 3/10: Granting Cloud Build permissions...${NC}"

PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Grant secret access
gcloud secrets add-iam-policy-binding mongodb-uri \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor" &>/dev/null || true

gcloud secrets add-iam-policy-binding hss-encryption-key \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor" &>/dev/null || true

# Grant compute permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/compute.admin" &>/dev/null || true

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/iam.serviceAccountUser" &>/dev/null || true

echo -e "${GREEN}✅ Permissions granted${NC}"
echo ""

# ============================================================================
# STEP 4: Enable Required APIs
# ============================================================================
echo -e "${BLUE}Step 4/10: Enabling required APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable compute.googleapis.com --quiet
gcloud services enable secretmanager.googleapis.com --quiet
echo -e "${GREEN}✅ APIs enabled${NC}"
echo ""

# ============================================================================
# STEP 5: Create GCE Instance (if doesn't exist)
# ============================================================================
echo -e "${BLUE}Step 5/10: Creating/verifying GCE instance...${NC}"

if gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE &>/dev/null; then
  echo -e "${YELLOW}⚠️  Instance $INSTANCE_NAME already exists${NC}"
else
  echo "Creating instance $INSTANCE_NAME..."
  
  # Create static IP
  gcloud compute addresses create ${INSTANCE_NAME}-ip --region=us-central1 2>/dev/null || true
  STATIC_IP=$(gcloud compute addresses describe ${INSTANCE_NAME}-ip --region=us-central1 --format='get(address)')
  
  # Create firewall rules
  echo "Creating firewall rules..."
  gcloud compute firewall-rules create allow-acs-http --allow tcp:80,tcp:443 --target-tags=acs-server 2>/dev/null || true
  gcloud compute firewall-rules create allow-acs-tr069 --allow tcp:7547 --target-tags=acs-server 2>/dev/null || true
  gcloud compute firewall-rules create allow-hss-api --allow tcp:3000 --target-tags=acs-server 2>/dev/null || true
  gcloud compute firewall-rules create allow-hss-s6a --allow tcp:3868 --target-tags=acs-server 2>/dev/null || true
  gcloud compute firewall-rules create allow-genieacs-nbi --allow tcp:7557 --target-tags=acs-server 2>/dev/null || true
  gcloud compute firewall-rules create allow-genieacs-ui --allow tcp:3333 --target-tags=acs-server 2>/dev/null || true
  
  # Create instance
  gcloud compute instances create $INSTANCE_NAME \
    --zone=$ZONE \
    --machine-type=e2-standard-2 \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-balanced \
    --tags=acs-server,http-server,https-server \
    --address=$STATIC_IP \
    --metadata=google-logging-enabled=true \
    --scopes=https://www.googleapis.com/auth/cloud-platform
  
  echo -e "${GREEN}✅ Instance created${NC}"
  echo "⏳ Waiting 30 seconds for instance to be ready..."
  sleep 30
fi
echo ""

# ============================================================================
# STEP 6: Install Base Dependencies on GCE
# ============================================================================
echo -e "${BLUE}Step 6/10: Installing base dependencies on GCE...${NC}"

gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
  set -e
  echo '📦 Updating system...'
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
  
  echo '📦 Installing Node.js 20...'
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
  sudo apt-get install -y nodejs -qq
  
  echo '📦 Installing MongoDB client...'
  wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add - 2>/dev/null
  echo 'deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse' | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y mongodb-mongosh -qq
  
  echo '📦 Installing Docker...'
  sudo apt-get install -y docker.io docker-compose -qq
  sudo systemctl enable docker >/dev/null 2>&1
  sudo systemctl start docker
  sudo usermod -aG docker \$USER
  
  echo '📦 Installing Nginx...'
  sudo apt-get install -y nginx -qq
  
  echo '✅ Base dependencies installed'
"

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# ============================================================================
# STEP 7: Deploy HSS Module to GCE
# ============================================================================
echo -e "${BLUE}Step 7/10: Deploying HSS module to GCE...${NC}"

# Create tarball of HSS module
echo "Packaging HSS module..."
cd hss-module
tar -czf /tmp/hss-module.tar.gz . 2>/dev/null
cd ..

# Copy to instance
echo "Copying to GCE instance..."
gcloud compute scp /tmp/hss-module.tar.gz ${INSTANCE_NAME}:~ --zone=$ZONE --quiet

# Extract and install
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
  set -e
  
  echo '📂 Setting up HSS directory...'
  sudo mkdir -p /opt/hss-server
  sudo chown \$USER:\$USER /opt/hss-server
  
  echo '📦 Extracting HSS module...'
  tar -xzf hss-module.tar.gz -C /opt/hss-server/
  
  echo '📦 Installing dependencies...'
  cd /opt/hss-server
  npm install --production --silent 2>/dev/null || npm install --silent
  npm install milenage mongodb express cors --silent 2>/dev/null
  
  echo '✅ HSS module deployed'
"

echo -e "${GREEN}✅ HSS module deployed${NC}"
echo ""

# ============================================================================
# STEP 8: Configure HSS Service
# ============================================================================
echo -e "${BLUE}Step 8/10: Configuring HSS service...${NC}"

# Get secrets
MONGODB_URI_SECRET=$(gcloud secrets versions access latest --secret="mongodb-uri")
HSS_KEY_SECRET=$(gcloud secrets versions access latest --secret="hss-encryption-key")

# Create config file
cat > /tmp/hss-config.json <<EOF
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
    "uri": "${MONGODB_URI_SECRET}",
    "database": "hss"
  },
  "acs_integration": {
    "enabled": true,
    "sync_interval_minutes": 5,
    "genieacs_mongodb_uri": "${MONGODB_URI_SECRET}",
    "genieacs_database": "genieacs"
  },
  "features": {
    "capture_imei": true,
    "track_sessions": true,
    "audit_logging": true
  }
}
EOF

# Copy config
gcloud compute scp /tmp/hss-config.json ${INSTANCE_NAME}:/opt/hss-server/config.json --zone=$ZONE --quiet

# Create systemd service and initialize database
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
  set -e
  
  echo '🔧 Creating systemd service...'
  sudo tee /etc/systemd/system/hss.service > /dev/null <<'SYSTEMD'
[Unit]
Description=Cloud HSS Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/hss-server
Environment=\"NODE_ENV=production\"
Environment=\"HSS_ENCRYPTION_KEY=${HSS_KEY_SECRET}\"
Environment=\"MONGODB_URI=${MONGODB_URI_SECRET}\"
ExecStart=/usr/bin/node /opt/hss-server/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SYSTEMD
  
  echo '🗄️ Initializing HSS database...'
  cd /opt/hss-server
  export HSS_ENCRYPTION_KEY='${HSS_KEY_SECRET}'
  export MONGODB_URI='${MONGODB_URI_SECRET}'
  node scripts/init-database.js || echo 'Database init completed (may already exist)'
  
  echo '🚀 Starting HSS service...'
  sudo systemctl daemon-reload
  sudo systemctl enable hss
  sudo systemctl start hss
  
  echo '✅ HSS service started'
  sleep 5
  sudo systemctl status hss --no-pager
"

echo -e "${GREEN}✅ HSS service configured and running${NC}"
echo ""

# ============================================================================
# STEP 9: Deploy GenieACS (if not already running)
# ============================================================================
echo -e "${BLUE}Step 9/10: Deploying GenieACS...${NC}"

gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
  set -e
  
  # Check if already running
  if docker ps | grep -q genieacs 2>/dev/null; then
    echo '✅ GenieACS already running'
    exit 0
  fi
  
  echo '📦 Setting up GenieACS...'
  sudo mkdir -p /opt/genieacs
  
  sudo tee /opt/genieacs/docker-compose.yml > /dev/null <<'COMPOSE'
version: '3.8'
services:
  genieacs-cwmp:
    image: drumsergio/genieacs:latest
    container_name: genieacs-cwmp
    restart: always
    network_mode: host
    environment:
      - GENIEACS_CWMP_INTERFACE=0.0.0.0
      - GENIEACS_CWMP_PORT=7547
      - GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI_SECRET}
    command: genieacs-cwmp

  genieacs-nbi:
    image: drumsergio/genieacs:latest
    container_name: genieacs-nbi
    restart: always
    network_mode: host
    environment:
      - GENIEACS_NBI_INTERFACE=0.0.0.0
      - GENIEACS_NBI_PORT=7557
      - GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI_SECRET}
    command: genieacs-nbi

  genieacs-fs:
    image: drumsergio/genieacs:latest
    container_name: genieacs-fs
    restart: always
    network_mode: host
    environment:
      - GENIEACS_FS_INTERFACE=0.0.0.0
      - GENIEACS_FS_PORT=7567
      - GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI_SECRET}
    command: genieacs-fs

  genieacs-ui:
    image: drumsergio/genieacs:latest
    container_name: genieacs-ui
    restart: always
    network_mode: host
    environment:
      - GENIEACS_UI_INTERFACE=0.0.0.0
      - GENIEACS_UI_PORT=3333
      - GENIEACS_MONGODB_CONNECTION_URL=${MONGODB_URI_SECRET}
    command: genieacs-ui
COMPOSE
  
  echo '🚀 Starting GenieACS containers...'
  cd /opt/genieacs
  sudo docker-compose up -d
  
  echo '✅ GenieACS deployed'
  sleep 5
  docker ps
"

echo -e "${GREEN}✅ GenieACS deployed${NC}"
echo ""

# ============================================================================
# STEP 10: Configure Nginx Reverse Proxy
# ============================================================================
echo -e "${BLUE}Step 10/10: Configuring Nginx...${NC}"

gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
  set -e
  
  echo '⚙️  Configuring Nginx reverse proxy...'
  sudo tee /etc/nginx/sites-available/acs-hss > /dev/null <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    client_max_body_size 100M;
    
    # HSS REST API
    location /api/hss/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # GenieACS NBI API
    location /nbi/ {
        proxy_pass http://localhost:7557/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_connect_timeout 30s;
    }
    
    # GenieACS File Server
    location /fs/ {
        proxy_pass http://localhost:7567/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        client_max_body_size 500M;
    }
    
    # GenieACS UI
    location /admin/ {
        proxy_pass http://localhost:3333/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
    
    # Health check
    location /health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 'healthy';
    }
}
NGINX
  
  echo '⚙️  Enabling site...'
  sudo ln -sf /etc/nginx/sites-available/acs-hss /etc/nginx/sites-enabled/
  sudo rm -f /etc/nginx/sites-enabled/default
  
  echo '⚙️  Testing Nginx configuration...'
  sudo nginx -t
  
  echo '🔄 Reloading Nginx...'
  sudo systemctl reload nginx
  
  echo '✅ Nginx configured'
"

echo -e "${GREEN}✅ Nginx configured${NC}"
echo ""

# ============================================================================
# Get External IP and Display Results
# ============================================================================
echo -e "${BLUE}Getting external IP address...${NC}"
EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}  ✅ INSTALLATION COMPLETE!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}🌐 External IP:${NC} $EXTERNAL_IP"
echo ""
echo -e "${BLUE}📡 Service Endpoints:${NC}"
echo "   HSS REST API:     http://$EXTERNAL_IP/api/hss/"
echo "   HSS S6a:          $EXTERNAL_IP:3868"
echo "   GenieACS NBI:     http://$EXTERNAL_IP/nbi/"
echo "   GenieACS CWMP:    http://$EXTERNAL_IP:7547"
echo "   GenieACS UI:      http://$EXTERNAL_IP/admin/"
echo "   Health Check:     http://$EXTERNAL_IP/health"
echo ""
echo -e "${BLUE}🧪 Test Your Installation:${NC}"
echo "   curl http://$EXTERNAL_IP/health"
echo "   curl http://$EXTERNAL_IP/api/hss/health"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "   1. Test health endpoints above"
echo "   2. Initialize sample data: ./init-hss-sample-data.sh $EXTERNAL_IP"
echo "   3. Update apphosting.yaml with IP: $EXTERNAL_IP"
echo "   4. Deploy frontend: firebase deploy --only apphosting"
echo "   5. Open web UI and navigate to HSS Management"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Save IP for next script
echo "$EXTERNAL_IP" > .hss-external-ip.txt
echo -e "${GREEN}💾 External IP saved to .hss-external-ip.txt${NC}"
echo ""

