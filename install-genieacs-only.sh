#!/bin/bash
# Install GenieACS on server where Open5GS HSS is already running
# Uses Docker for easy deployment
# Connects to cloud MongoDB Atlas

set -e

MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

echo "═══════════════════════════════════════════════════════════"
echo "  📡 Installing GenieACS (ACS/TR-069)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "✅ Open5GS HSS already installed"
echo "✅ Adding GenieACS services"
echo "✅ Using cloud MongoDB Atlas"
echo ""

# Install Docker if needed
if ! command -v docker &> /dev/null; then
  echo "📦 Installing Docker..."
  apt-get update
  apt-get install -y docker.io docker-compose
  systemctl enable docker
  systemctl start docker
  echo "✅ Docker installed"
else
  echo "✅ Docker already installed"
fi

# Create GenieACS directory
echo ""
echo "📂 Creating GenieACS directory..."
mkdir -p /opt/genieacs
cd /opt/genieacs

# Create docker-compose.yml
echo "⚙️  Creating GenieACS configuration..."
cat > docker-compose.yml << EOF
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
      - GENIEACS_MONGODB_CONNECTION_URL=$MONGODB_URI
    command: genieacs-cwmp

  genieacs-nbi:
    image: drumsergio/genieacs:latest
    container_name: genieacs-nbi
    restart: always
    network_mode: host
    environment:
      - GENIEACS_NBI_INTERFACE=0.0.0.0
      - GENIEACS_NBI_PORT=7557
      - GENIEACS_MONGODB_CONNECTION_URL=$MONGODB_URI
    command: genieacs-nbi

  genieacs-fs:
    image: drumsergio/genieacs:latest
    container_name: genieacs-fs
    restart: always
    network_mode: host
    environment:
      - GENIEACS_FS_INTERFACE=0.0.0.0
      - GENIEACS_FS_PORT=7567
      - GENIEACS_MONGODB_CONNECTION_URL=$MONGODB_URI
    command: genieacs-fs

  genieacs-ui:
    image: drumsergio/genieacs:latest
    container_name: genieacs-ui
    restart: always
    network_mode: host
    environment:
      - GENIEACS_UI_INTERFACE=0.0.0.0
      - GENIEACS_UI_PORT=3333
      - GENIEACS_MONGODB_CONNECTION_URL=$MONGODB_URI
    command: genieacs-ui
EOF

# Start GenieACS containers
echo "🚀 Starting GenieACS containers..."
docker-compose up -d

echo "⏳ Waiting for containers to start (10 seconds)..."
sleep 10

# Verify
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  📊 VERIFICATION"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check containers
echo "🐳 Docker Containers:"
docker ps | grep genieacs || echo "  ⚠️  No GenieACS containers running"
echo ""

# Check ports
echo "🔌 Port Status:"
netstat -tulpn 2>/dev/null | grep -E ":(7547|7557|7567|3333|3868)" || ss -tulpn | grep -E ":(7547|7557|7567|3333|3868)"
echo ""

# Get external IP
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo "═══════════════════════════════════════════════════════════"
echo "  ✅ GENIEACS INSTALLATION COMPLETE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 External IP: $EXTERNAL_IP"
echo ""
echo "📡 Your Services:"
echo "   Open5GS HSS (existing): $EXTERNAL_IP:3868 (S6a/Diameter for MME)"
echo "   GenieACS CWMP (new):    http://$EXTERNAL_IP:7547 (TR-069 for CPE)"
echo "   GenieACS NBI (new):     http://$EXTERNAL_IP:7557 (API)"
echo "   GenieACS FS (new):      http://$EXTERNAL_IP:7567 (Firmware server)"
echo "   GenieACS UI (new):      http://$EXTERNAL_IP:3333 (Admin dashboard)"
echo ""
echo "🧪 Test GenieACS:"
echo "   curl http://localhost:7557/devices"
echo "   Open browser: http://$EXTERNAL_IP:3333"
echo ""
echo "🔧 Manage GenieACS:"
echo "   View containers: docker ps"
echo "   View logs: docker-compose logs -f"
echo "   Restart: docker-compose restart"
echo "   Stop: docker-compose stop"
echo "   Start: docker-compose start"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

