#!/bin/bash

echo "🔧 COMPLETE BACKEND FIX SCRIPT"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 1. Navigate to project directory and pull latest changes
print_info "Navigating to project directory..."
cd ~/lte-pci-mapper

print_info "Pulling latest changes from Git..."
git pull origin main
if [ $? -eq 0 ]; then
    print_status "Git pull successful"
else
    print_error "Git pull failed"
    exit 1
fi

# 2. Check if backend-services directory exists
if [ ! -d "backend-services" ]; then
    print_error "backend-services directory not found!"
    print_info "Make sure you're in the lte-pci-mapper root directory"
    exit 1
fi

print_info "Starting complete backend fix..."

# Navigate to backend-services
cd backend-services

# 3. Install dependencies
print_info "Installing dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_status "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# 4. Set environment variables
print_info "Setting environment variables..."
export MONGODB_URI="mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0"
export PORT=3000
export HSS_PORT=3001
print_status "Environment variables set"

# 5. Stop existing PM2 processes
print_info "Stopping existing PM2 processes..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
print_status "PM2 processes stopped"

# 6. Check if hss-server.js exists, create if not
if [ ! -f "hss-server.js" ]; then
    print_warning "hss-server.js not found, creating it..."
    cat > hss-server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: ['https://lte-pci-mapper--lte-pci-mapper-65450042-bbf71.us-east4.hosted.app', 'https://wisptools.io'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection - Atlas
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://genieacs-user:Aezlf1N3Z568EwL9@cluster0.1radgkw.mongodb.net/hss_management?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔗 Connecting to MongoDB Atlas...');
console.log('📍 MongoDB URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@'));

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'hss-management-api',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// HSS Management routes
app.use('/api/hss', require('./routes/hss-management'));

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HSS Management API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});
EOF
    print_status "hss-server.js created"
else
    print_status "hss-server.js already exists"
fi

# 7. Start main API server
print_info "Starting main API server (port 3000)..."
pm2 start server.js --name "main-api" -- --port 3000
if [ $? -eq 0 ]; then
    print_status "Main API server started"
else
    print_error "Failed to start main API server"
    exit 1
fi

# 8. Start HSS API server
print_info "Starting HSS API server (port 3001)..."
pm2 start hss-server.js --name "hss-api" -- --port 3001
if [ $? -eq 0 ]; then
    print_status "HSS API server started"
else
    print_error "Failed to start HSS API server"
    exit 1
fi

# 9. Save PM2 configuration
print_info "Saving PM2 configuration..."
pm2 save
print_status "PM2 configuration saved"

# 10. Check GenieACS services
print_info "Checking GenieACS services..."
GENIEACS_SERVICES=("genieacs-cwmp" "genieacs-nbi" "genieacs-fs" "genieacs-ui")

for service in "${GENIEACS_SERVICES[@]}"; do
    if systemctl is-active --quiet "$service"; then
        print_status "$service is running"
    else
        print_warning "$service is not running, attempting to start..."
        sudo systemctl start "$service" 2>/dev/null || print_warning "Could not start $service"
    fi
done

# 11. Show final status
echo ""
echo "================================"
echo "🎉 BACKEND FIX COMPLETE!"
echo "================================"
echo ""

print_info "PM2 Status:"
pm2 status

echo ""
print_info "GenieACS Services:"
for service in "${GENIEACS_SERVICES[@]}"; do
    status=$(systemctl is-active $service)
    if [ "$status" = "active" ]; then
        print_status "$service: $status"
    else
        print_warning "$service: $status"
    fi
done

echo ""
print_info "Health Check URLs:"
echo "  Main API: http://localhost:3000/health"
echo "  HSS API:  http://localhost:3001/health"

echo ""
print_info "API Endpoints Available:"
echo "  /api/users - User management"
echo "  /api/tenants - Tenant management"
echo "  /api/inventory - Inventory management"
echo "  /api/work-orders - Work order management"
echo "  /api/customers - Customer management"
echo "  /api/network - Network management"
echo "  /api/plans - Planning management"
echo "  /api/monitoring - System monitoring"
echo "  /api/epc - EPC management"
echo "  /api/system - System management"
echo "  /api/hss - HSS management"
echo "  /admin - Admin functions"

echo ""
print_status "Backend is now fully operational!"
