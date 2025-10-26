#!/bin/bash
# Update MongoDB Atlas Connection String
# Usage: bash update-mongodb-atlas.sh "mongodb+srv://username:password@cluster.mongodb.net/wisptools"

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${CYAN}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Update MongoDB Atlas Connection String           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Get connection string
if [ -z "$1" ]; then
    echo "Usage: bash update-mongodb-atlas.sh \"mongodb+srv://user:pass@cluster.mongodb.net/dbname\""
    echo ""
    echo "Get your connection string from:"
    echo "  1. Login to MongoDB Atlas"
    echo "  2. Click 'Connect' on your cluster"
    echo "  3. Choose 'Connect your application'"
    echo "  4. Copy the connection string"
    echo "  5. Replace <password> with your actual password"
    echo ""
    exit 1
fi

CONNECTION_STRING="$1"

# Validate connection string format
if [[ ! "$CONNECTION_STRING" =~ ^mongodb(\+srv)?:// ]]; then
    print_error "Invalid MongoDB connection string format"
    echo "Should start with: mongodb:// or mongodb+srv://"
    exit 1
fi

print_status "Connection string provided"

# Backend .env file location
BACKEND_ENV="/opt/gce-backend/.env"

if [ ! -f "$BACKEND_ENV" ]; then
    print_error "Backend .env file not found: $BACKEND_ENV"
    print_status "Run deployment script first: deploy-all-automated.sh"
    exit 1
fi

# Backup existing .env
print_status "Creating backup..."
cp "$BACKEND_ENV" "$BACKEND_ENV.backup.$(date +%Y%m%d_%H%M%S)"
print_success "Backup created"

# Update MongoDB URI
print_status "Updating MongoDB connection string..."
sed -i "s|MONGODB_URI=.*|MONGODB_URI=$CONNECTION_STRING|" "$BACKEND_ENV"
print_success "Connection string updated"

# Verify
if grep -q "MONGODB_URI=$CONNECTION_STRING" "$BACKEND_ENV"; then
    print_success "Verification passed"
else
    print_error "Update failed - restoring backup"
    cp "$BACKEND_ENV.backup" "$BACKEND_ENV"
    exit 1
fi

# Show updated config (masked password)
print_status "Current configuration:"
MASKED=$(echo "$CONNECTION_STRING" | sed 's/:[^:@]*@/:***@/')
echo "  MONGODB_URI=$MASKED"

# Restart backend service
echo ""
read -p "Restart backend service to apply changes? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Restarting wisptools-backend service..."
    systemctl restart wisptools-backend
    sleep 2
    
    if systemctl is-active --quiet wisptools-backend; then
        print_success "Backend service restarted successfully"
    else
        print_error "Backend service failed to start"
        print_status "Check logs: journalctl -u wisptools-backend -n 50"
        exit 1
    fi
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          MongoDB Atlas Configuration Complete             ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
print_success "Connection string updated successfully!"
echo ""
echo "Test connection:"
echo "  curl http://localhost:3001/health"
echo ""
echo "View logs:"
echo "  journalctl -u wisptools-backend -f"
echo ""

exit 0

