#!/bin/bash

# Setup SSL for wisptools.io domain
# This script sets up Google Cloud Load Balancer with SSL termination

echo "🔐 Setting up SSL for wisptools.io domain..."
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    print_error "Not authenticated with gcloud. Please run 'gcloud auth login' first."
    exit 1
fi

print_info "Setting up SSL for wisptools.io..."

# 1. Create static IP address
print_info "Creating static IP address..."
STATIC_IP_NAME="wisptools-api-ip"
gcloud compute addresses create $STATIC_IP_NAME --global --quiet

# Get the IP address
STATIC_IP=$(gcloud compute addresses describe $STATIC_IP_NAME --global --format="get(address)")
print_status "Static IP created: $STATIC_IP"

# 2. Create instance group
print_info "Creating instance group..."
INSTANCE_GROUP_NAME="wisptools-api-group"
ZONE="us-central1-a"
INSTANCE_NAME="acs-hss-server"

gcloud compute instance-groups unmanaged create $INSTANCE_GROUP_NAME --zone=$ZONE --quiet

# Add VM to instance group
gcloud compute instance-groups unmanaged add-instances $INSTANCE_GROUP_NAME \
    --zone=$ZONE \
    --instances=$INSTANCE_NAME \
    --quiet

print_status "Instance group created and VM added"

# 3. Create health check
print_info "Creating health check..."
HEALTH_CHECK_NAME="wisptools-api-health"
gcloud compute health-checks create http $HEALTH_CHECK_NAME \
    --port=3000 \
    --request-path=/health \
    --quiet

print_status "Health check created"

# 4. Create backend service
print_info "Creating backend service..."
BACKEND_SERVICE_NAME="wisptools-api-backend"
gcloud compute backend-services create $BACKEND_SERVICE_NAME \
    --protocol=HTTP \
    --health-checks=$HEALTH_CHECK_NAME \
    --global \
    --quiet

# Add instance group to backend service
gcloud compute backend-services add-backend $BACKEND_SERVICE_NAME \
    --instance-group=$INSTANCE_GROUP_NAME \
    --instance-group-zone=$ZONE \
    --global \
    --quiet

print_status "Backend service created"

# 5. Create URL map
print_info "Creating URL map..."
URL_MAP_NAME="wisptools-api-lb"
gcloud compute url-maps create $URL_MAP_NAME \
    --default-service=$BACKEND_SERVICE_NAME \
    --quiet

print_status "URL map created"

# 6. Create SSL certificate
print_info "Creating SSL certificate for wisptools.io..."
SSL_CERT_NAME="wisptools-ssl-cert"
gcloud compute ssl-certificates create $SSL_CERT_NAME \
    --domains=wisptools.io \
    --global \
    --quiet

print_status "SSL certificate created (provisioning may take 15-60 minutes)"

# 7. Create HTTPS proxy
print_info "Creating HTTPS proxy..."
HTTPS_PROXY_NAME="wisptools-https-proxy"
gcloud compute target-https-proxies create $HTTPS_PROXY_NAME \
    --url-map=$URL_MAP_NAME \
    --ssl-certificates=$SSL_CERT_NAME \
    --quiet

print_status "HTTPS proxy created"

# 8. Create forwarding rule
print_info "Creating forwarding rule..."
FORWARDING_RULE_NAME="wisptools-https-rule"
gcloud compute forwarding-rules create $FORWARDING_RULE_NAME \
    --address=$STATIC_IP_NAME \
    --target-https-proxy=$HTTPS_PROXY_NAME \
    --global \
    --ports=443 \
    --quiet

print_status "Forwarding rule created"

echo ""
echo "=============================================="
print_status "SSL setup complete!"
echo "=============================================="
echo ""
print_info "Static IP Address: $STATIC_IP"
print_info "Domain: wisptools.io"
echo ""
print_warning "Next steps:"
echo "1. Update your DNS A record:"
echo "   wisptools.io → A → $STATIC_IP"
echo ""
echo "2. Wait for SSL certificate provisioning (15-60 minutes)"
echo "   Check status with:"
echo "   gcloud compute ssl-certificates describe $SSL_CERT_NAME --global"
echo ""
echo "3. Once SSL is ACTIVE, update frontend to use:"
echo "   https://wisptools.io"
echo ""
print_info "To check SSL certificate status:"
echo "gcloud compute ssl-certificates describe $SSL_CERT_NAME --global"
echo ""
print_info "To check load balancer status:"
echo "gcloud compute forwarding-rules describe $FORWARDING_RULE_NAME --global"
