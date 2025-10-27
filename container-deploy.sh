#!/bin/bash

# Container-friendly WISPTools.io Deployment Script
# This script works in containerized environments without systemd

set -e

echo "🚀 WISPTools.io Container Deployment"
echo "===================================="

# Configuration
DEPLOY_DIR="/opt/wisptools"
BACKUP_DIR="/opt/wisptools-backup-$(date +%Y%m%d-%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    print_error "Not in a git repository"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
print_status "Current branch: $CURRENT_BRANCH"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes. Stashing them..."
    git stash push -m "Auto-stash before deployment $(date)"
fi

# Pull latest changes
print_status "Pulling latest changes..."
git fetch origin
git reset --hard origin/$CURRENT_BRANCH

# Create deployment directory
print_status "Creating deployment directory..."
mkdir -p "$DEPLOY_DIR"

# Create backup if exists
if [ -d "$DEPLOY_DIR/backend-services" ]; then
    print_status "Creating backup..."
    cp -r "$DEPLOY_DIR" "$BACKUP_DIR"
    print_status "Backup created at: $BACKUP_DIR"
fi

# Copy backend services
print_status "Deploying backend services..."
cp -r backend-services "$DEPLOY_DIR/"

# Install dependencies
print_status "Installing dependencies..."
cd "$DEPLOY_DIR/backend-services"
npm install --production

# Create startup scripts
print_status "Creating startup scripts..."

# Backend API startup script
cat > "$DEPLOY_DIR/start-backend.sh" << 'EOF'
#!/bin/bash
echo "🚀 Starting WISPTools Backend API..."
cd /opt/wisptools/backend-services
export NODE_ENV=production
export PORT=3000
node server-modular.js
EOF

# HSS startup script
cat > "$DEPLOY_DIR/start-hss.sh" << 'EOF'
#!/bin/bash
echo "🚀 Starting WISPTools HSS Service..."
cd /opt/wisptools/backend-services
export NODE_ENV=production
export PORT=3001
node server.js
EOF

# Make scripts executable
chmod +x "$DEPLOY_DIR/start-backend.sh"
chmod +x "$DEPLOY_DIR/start-hss.sh"

# Create Docker Compose file for easy deployment
print_status "Creating Docker Compose configuration..."
cat > "$DEPLOY_DIR/docker-compose.yml" << 'EOF'
version: '3.8'

services:
  backend-api:
    build: .
    container_name: wisptools-backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    command: node server-modular.js
    restart: unless-stopped
    volumes:
      - ./logs:/opt/wisptools/logs

  hss-service:
    build: .
    container_name: wisptools-hss
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    command: node server.js
    restart: unless-stopped
    volumes:
      - ./logs:/opt/wisptools/logs

  nginx:
    image: nginx:alpine
    container_name: wisptools-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend-api
      - hss-service
    restart: unless-stopped
EOF

# Create Dockerfile
print_status "Creating Dockerfile..."
cat > "$DEPLOY_DIR/Dockerfile" << 'EOF'
FROM node:20-alpine

WORKDIR /opt/wisptools

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose ports
EXPOSE 3000 3001

# Default command
CMD ["node", "server-modular.js"]
EOF

# Create nginx configuration
print_status "Creating nginx configuration..."
cat > "$DEPLOY_DIR/nginx.conf" << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream backend_api {
        server backend-api:3000;
    }
    
    upstream hss_service {
        server hss-service:3001;
    }
    
    server {
        listen 80;
        server_name _;
        
        location /api/ {
            proxy_pass http://backend_api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location /hss/ {
            proxy_pass http://hss_service/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location /health {
            proxy_pass http://backend_api/health;
        }
    }
}
EOF

# Create management scripts
print_status "Creating management scripts..."

# Start all services
cat > "$DEPLOY_DIR/start-all.sh" << 'EOF'
#!/bin/bash
echo "🚀 Starting all WISPTools services..."

# Check if Docker is available
if command -v docker-compose &> /dev/null; then
    echo "🐳 Starting with Docker Compose..."
    docker-compose up -d
else
    echo "📦 Starting with Node.js directly..."
    nohup ./start-backend.sh > logs/backend.log 2>&1 &
    nohup ./start-hss.sh > logs/hss.log 2>&1 &
    echo "✅ Services started in background"
fi
EOF

# Stop all services
cat > "$DEPLOY_DIR/stop-all.sh" << 'EOF'
#!/bin/bash
echo "🛑 Stopping all WISPTools services..."

if command -v docker-compose &> /dev/null; then
    echo "🐳 Stopping Docker Compose services..."
    docker-compose down
else
    echo "📦 Stopping Node.js processes..."
    pkill -f "node server-modular.js" || true
    pkill -f "node server.js" || true
    echo "✅ Services stopped"
fi
EOF

# Status check
cat > "$DEPLOY_DIR/status.sh" << 'EOF'
#!/bin/bash
echo "📊 WISPTools Service Status"
echo "=========================="

# Check backend API
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend API: Running (port 3000)"
else
    echo "❌ Backend API: Not responding"
fi

# Check HSS service
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ HSS Service: Running (port 3001)"
else
    echo "❌ HSS Service: Not responding"
fi

# Check processes
echo ""
echo "🔍 Running processes:"
ps aux | grep -E "(node server|wisptools)" | grep -v grep || echo "No WISPTools processes found"
EOF

# Make all scripts executable
chmod +x "$DEPLOY_DIR"/*.sh

# Create logs directory
mkdir -p "$DEPLOY_DIR/logs"

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

# Display summary
echo ""
print_status "🎉 Container deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "  • Branch: $CURRENT_BRANCH"
echo "  • Commit: $(git rev-parse --short HEAD)"
echo "  • Deploy Directory: $DEPLOY_DIR"
echo "  • Backup: $BACKUP_DIR"
echo ""
echo "🐳 Docker Deployment:"
echo "  • cd $DEPLOY_DIR"
echo "  • docker-compose up -d"
echo ""
echo "📦 Direct Node.js Deployment:"
echo "  • cd $DEPLOY_DIR"
echo "  • ./start-all.sh"
echo ""
echo "🌐 Service URLs:"
echo "  • Backend API: http://$SERVER_IP:3000"
echo "  • HSS API: http://$SERVER_IP:3001"
echo "  • Health Check: http://$SERVER_IP:3000/health"
echo ""
echo "🔧 Management Commands:"
echo "  • Start: ./start-all.sh"
echo "  • Stop: ./stop-all.sh"
echo "  • Status: ./status.sh"
echo "  • Logs: tail -f logs/backend.log"
echo ""

print_status "Container deployment completed!"