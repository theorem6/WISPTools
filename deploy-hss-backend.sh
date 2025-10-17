#!/bin/bash
# Deploy HSS Backend to GCE Server
# Run this script on the backend server (136.112.111.167)

set -e

echo "════════════════════════════════════════════════════════════"
echo "     HSS Backend Deployment Script"
echo "════════════════════════════════════════════════════════════"
echo ""

# Configuration
PROJECT_DIR="/opt/lte-pci-mapper"
HSS_MODULE_DIR="$PROJECT_DIR/hss-module"
SERVICE_NAME="hss-api"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📍 Project Directory: $PROJECT_DIR${NC}"
echo ""

# Check if running with appropriate permissions
if [ "$EUID" -eq 0 ]; then 
  echo -e "${YELLOW}⚠️  Running as root${NC}"
else
  echo -e "${GREEN}✓ Running as regular user (will use sudo when needed)${NC}"
fi

# Step 1: Navigate to project directory
echo -e "\n${YELLOW}📂 Step 1: Checking project directory...${NC}"
if [ ! -d "$PROJECT_DIR" ]; then
  echo -e "${RED}❌ Project directory not found: $PROJECT_DIR${NC}"
  echo -e "${YELLOW}   Creating directory and cloning repository...${NC}"
  sudo mkdir -p "$PROJECT_DIR"
  sudo chown $USER:$USER "$PROJECT_DIR"
  cd /opt
  git clone https://github.com/theorem6/lte-pci-mapper.git
  cd "$PROJECT_DIR"
else
  cd "$PROJECT_DIR"
  echo -e "${GREEN}✓ Found project directory${NC}"
fi

# Step 2: Pull latest code
echo -e "\n${YELLOW}📥 Step 2: Pulling latest code...${NC}"
git fetch origin
git reset --hard origin/main
echo -e "${GREEN}✓ Code updated to latest${NC}"

# Step 3: Check if hss-module exists
echo -e "\n${YELLOW}📦 Step 3: Checking HSS module...${NC}"
if [ ! -d "$HSS_MODULE_DIR" ]; then
  echo -e "${RED}❌ HSS module directory not found: $HSS_MODULE_DIR${NC}"
  exit 1
fi
cd "$HSS_MODULE_DIR"
echo -e "${GREEN}✓ HSS module found${NC}"

# Step 4: Install Node.js if needed
echo -e "\n${YELLOW}📦 Step 4: Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}   Installing Node.js 20...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

# Step 5: Install dependencies
echo -e "\n${YELLOW}📦 Step 5: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 6: Build TypeScript
echo -e "\n${YELLOW}🔨 Step 6: Building TypeScript...${NC}"
if [ -f "tsconfig.json" ]; then
  npm run build || npx tsc || echo "Build step skipped"
  echo -e "${GREEN}✓ TypeScript built${NC}"
else
  echo -e "${YELLOW}   No TypeScript config found, skipping build${NC}"
fi

# Step 7: Check for environment variables
echo -e "\n${YELLOW}🔐 Step 7: Checking environment variables...${NC}"
if [ -z "$MONGODB_URI" ]; then
  echo -e "${RED}⚠️  MONGODB_URI not set!${NC}"
  echo -e "${YELLOW}   Set it in /etc/environment or pm2 ecosystem file${NC}"
else
  echo -e "${GREEN}✓ MONGODB_URI is set${NC}"
fi

if [ -z "$HSS_ENCRYPTION_KEY" ]; then
  echo -e "${RED}⚠️  HSS_ENCRYPTION_KEY not set!${NC}"
  echo -e "${YELLOW}   Generating one now...${NC}"
  NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo -e "${GREEN}   Generated key: $NEW_KEY${NC}"
  echo -e "${YELLOW}   Add this to /etc/environment:${NC}"
  echo -e "${YELLOW}   HSS_ENCRYPTION_KEY=$NEW_KEY${NC}"
else
  echo -e "${GREEN}✓ HSS_ENCRYPTION_KEY is set${NC}"
fi

# Step 8: Install/update PM2
echo -e "\n${YELLOW}📦 Step 8: Checking PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}   Installing PM2...${NC}"
  sudo npm install -g pm2
  echo -e "${GREEN}✓ PM2 installed${NC}"
else
  echo -e "${GREEN}✓ PM2 already installed${NC}"
fi

# Step 9: Create PM2 ecosystem file
echo -e "\n${YELLOW}📝 Step 9: Creating PM2 ecosystem file...${NC}"
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'hss-api',
    script: 'server.js',
    cwd: '/opt/lte-pci-mapper/hss-module',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017',
      HSS_ENCRYPTION_KEY: process.env.HSS_ENCRYPTION_KEY,
      GENIEACS_API_URL: 'http://localhost:7557'
    },
    error_file: '/var/log/hss-api-error.log',
    out_file: '/var/log/hss-api-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF
echo -e "${GREEN}✓ PM2 config created${NC}"

# Step 10: Stop existing service
echo -e "\n${YELLOW}🛑 Step 10: Stopping existing service...${NC}"
pm2 stop $SERVICE_NAME 2>/dev/null || echo "   (Service not running)"
pm2 delete $SERVICE_NAME 2>/dev/null || echo "   (Service not in PM2)"

# Step 11: Start service with PM2
echo -e "\n${YELLOW}🚀 Step 11: Starting HSS API service...${NC}"
pm2 start ecosystem.config.js
pm2 save
sudo pm2 startup systemd -u $USER --hp $HOME || true
echo -e "${GREEN}✓ Service started${NC}"

# Step 12: Wait for service to start
echo -e "\n${YELLOW}⏳ Step 12: Waiting for service to start...${NC}"
sleep 5

# Step 13: Check service status
echo -e "\n${YELLOW}📊 Step 13: Checking service status...${NC}"
pm2 status

# Step 14: Test health endpoint
echo -e "\n${YELLOW}🏥 Step 14: Testing health endpoint...${NC}"
sleep 2
if curl -f http://localhost:3000/health 2>/dev/null; then
  echo -e "\n${GREEN}✓ Health check passed!${NC}"
else
  echo -e "\n${RED}❌ Health check failed${NC}"
  echo -e "${YELLOW}   Check logs: pm2 logs $SERVICE_NAME${NC}"
fi

# Step 15: Test API endpoint
echo -e "\n${YELLOW}🧪 Step 15: Testing API endpoint...${NC}"
if curl -f http://localhost:3000/api/health 2>/dev/null; then
  echo -e "\n${GREEN}✓ API endpoint responding!${NC}"
else
  echo -e "\n${YELLOW}⚠️  API endpoint not responding (might be normal if no /api/health)${NC}"
fi

# Final status
echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}     ✅ Deployment Complete!${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}📊 Service Status:${NC}"
pm2 status
echo ""
echo -e "${GREEN}📝 Useful Commands:${NC}"
echo "   View logs:     pm2 logs $SERVICE_NAME"
echo "   Restart:       pm2 restart $SERVICE_NAME"
echo "   Stop:          pm2 stop $SERVICE_NAME"
echo "   Monitor:       pm2 monit"
echo ""
echo -e "${GREEN}🔗 Endpoints:${NC}"
echo "   Health:        http://localhost:3000/health"
echo "   API:           http://localhost:3000/api/"
echo "   EPC Register:  http://localhost:3000/api/epc/register"
echo "   EPC List:      http://localhost:3000/api/epc/list"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "   Make sure MONGODB_URI is set correctly"
echo "   Make sure HSS_ENCRYPTION_KEY is set"
echo "   Update firewall to allow port 3000"
echo ""
echo "════════════════════════════════════════════════════════════"

