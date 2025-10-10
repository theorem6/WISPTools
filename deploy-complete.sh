#!/bin/bash

################################################################################
# Complete Deployment Script with Guided Walkthrough
# LTE WISP Management Platform - Firebase + GCE Backend
#
# This script will:
# 1. Check prerequisites
# 2. Create GCE instance and firewall rules
# 3. Install and configure all backend services
# 4. Configure and deploy the frontend
# 5. Verify the deployment
#
# Time: ~25-30 minutes
# Requirements: gcloud CLI, Firebase CLI (will check and help install)
################################################################################

set -e  # Exit on error

# Color codes for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Icons
CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
ARROW="${BLUE}→${NC}"
INFO="${CYAN}ℹ${NC}"
WARN="${YELLOW}⚠${NC}"
ROCKET="${MAGENTA}🚀${NC}"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo ""
    echo -e "${BOLD}${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${WHITE}$1${NC}"
    echo -e "${BOLD}${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo ""
    echo -e "${BOLD}${CYAN}▶ Step $1${NC}"
    echo -e "${BOLD}${WHITE}$2${NC}"
    echo ""
}

print_info() {
    echo -e "${INFO} ${CYAN}$1${NC}"
}

print_success() {
    echo -e "${CHECK} ${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${WARN} ${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${CROSS} ${RED}$1${NC}"
}

print_progress() {
    echo -e "${ARROW} ${WHITE}$1${NC}"
}

pause_for_user() {
    echo ""
    echo -e "${YELLOW}Press Enter to continue...${NC}"
    read -r
}

confirm() {
    echo ""
    echo -e "${YELLOW}$1 (y/n): ${NC}"
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

################################################################################
# Welcome Screen
################################################################################

clear
print_header "🚀 Complete Deployment - LTE WISP Management Platform"

cat << EOF
${BOLD}Welcome!${NC}

This script will guide you through deploying your complete application:

${GREEN}Frontend:${NC}  Firebase App Hosting (SvelteKit + ArcGIS)
${GREEN}Backend:${NC}   Google Compute Engine (GenieACS + STUN + API)

${BOLD}What will be created:${NC}
  ${CHECK} GCE instance (e2-standard-2: 2 vCPU, 8 GB RAM)
  ${CHECK} Static external IP address
  ${CHECK} Firewall rules (HTTP/HTTPS, TR-069, STUN)
  ${CHECK} GenieACS services (CWMP, NBI, FS, UI)
  ${CHECK} Backend API server
  ${CHECK} STUN server for NAT traversal
  ${CHECK} Nginx reverse proxy with SSL
  ${CHECK} Frontend deployment to Firebase

${BOLD}Estimated time:${NC} 25-30 minutes
${BOLD}Estimated cost:${NC} ~\$125/month (can be stopped when not in use)

${BOLD}Prerequisites:${NC}
  • gcloud CLI (we'll check and help install)
  • Firebase CLI (we'll check and help install)
  • MongoDB Atlas connection URI (you'll need this)
  • Domain name (optional, can use IP only)

EOF

if ! confirm "Ready to start the deployment?"; then
    print_error "Deployment cancelled by user"
    exit 0
fi

################################################################################
# Step 1: Prerequisites Check
################################################################################

print_step "1/8" "Checking Prerequisites"

print_info "Checking for required tools..."
echo ""

# Check gcloud
print_progress "Checking gcloud CLI..."
if command -v gcloud &> /dev/null; then
    GCLOUD_VERSION=$(gcloud version --format="value(core)")
    print_success "gcloud CLI is installed (version: $GCLOUD_VERSION)"
    GCLOUD_OK=true
else
    print_error "gcloud CLI is not installed"
    print_info "Install from: https://cloud.google.com/sdk/docs/install"
    GCLOUD_OK=false
fi

# Check firebase
print_progress "Checking Firebase CLI..."
if command -v firebase &> /dev/null; then
    FIREBASE_VERSION=$(firebase --version)
    print_success "Firebase CLI is installed (version: $FIREBASE_VERSION)"
    FIREBASE_OK=true
else
    print_warning "Firebase CLI is not installed"
    if confirm "Would you like to install Firebase CLI now?"; then
        npm install -g firebase-tools
        FIREBASE_OK=true
        print_success "Firebase CLI installed successfully"
    else
        FIREBASE_OK=false
    fi
fi

# Check if we're in Cloud Shell
if [ -n "$CLOUD_SHELL" ]; then
    print_success "Running in Google Cloud Shell (all tools available)"
    GCLOUD_OK=true
    FIREBASE_OK=true
fi

# Check git
print_progress "Checking git..."
if command -v git &> /dev/null; then
    print_success "git is installed"
else
    print_error "git is not installed"
    exit 1
fi

echo ""
if [ "$GCLOUD_OK" = false ] || [ "$FIREBASE_OK" = false ]; then
    print_error "Missing required tools. Please install them and run again."
    exit 1
fi

pause_for_user

################################################################################
# Step 2: Authentication & Project Setup
################################################################################

print_step "2/8" "Authentication & Project Setup"

print_info "Let's make sure you're authenticated and the project is set correctly."
echo ""

# Set project
PROJECT_ID="lte-pci-mapper-65450042-bbf71"
print_progress "Setting GCP project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" = "$PROJECT_ID" ]; then
    print_success "Project set correctly: $PROJECT_ID"
else
    print_error "Failed to set project"
    exit 1
fi

# Check authentication
print_progress "Checking authentication..."
if gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1)
    print_success "Authenticated as: $ACCOUNT"
else
    print_warning "Not authenticated"
    print_info "Please authenticate now..."
    if [ -n "$CLOUD_SHELL" ]; then
        gcloud auth login --no-launch-browser
    else
        gcloud auth login
    fi
fi

# Firebase authentication
print_progress "Checking Firebase authentication..."
if firebase projects:list &> /dev/null; then
    print_success "Firebase authenticated"
else
    print_warning "Not authenticated with Firebase"
    print_info "Please authenticate now..."
    if [ -n "$CLOUD_SHELL" ]; then
        firebase login --no-localhost
    else
        firebase login
    fi
fi

pause_for_user

################################################################################
# Step 3: Gather Configuration
################################################################################

print_step "3/8" "Configuration & Information Gathering"

print_info "I need some information to configure your deployment."
echo ""

# MongoDB URI
print_progress "MongoDB Configuration"
echo -e "${CYAN}You'll need your MongoDB Atlas connection URI.${NC}"
echo -e "${CYAN}It should look like: mongodb+srv://user:password@cluster.mongodb.net/...${NC}"
echo ""
read -p "MongoDB Connection URI: " MONGODB_URI
if [ -z "$MONGODB_URI" ]; then
    print_error "MongoDB URI is required"
    exit 1
fi

echo ""
read -p "MongoDB Database Name (default: genieacs): " MONGODB_DATABASE
MONGODB_DATABASE=${MONGODB_DATABASE:-genieacs}
print_success "Will use database: $MONGODB_DATABASE"

echo ""
print_progress "Domain Configuration"
echo -e "${CYAN}You can use either:${NC}"
echo -e "${CYAN}  1. A custom domain (e.g., genieacs.yourdomain.com)${NC}"
echo -e "${CYAN}  2. Just the IP address (we'll show it after creating the instance)${NC}"
echo ""
read -p "Do you have a custom domain? (y/n): " HAS_DOMAIN

if [[ "$HAS_DOMAIN" =~ ^[Yy] ]]; then
    read -p "Enter your domain (e.g., genieacs.yourdomain.com): " DOMAIN_NAME
    USE_DOMAIN=true
    print_info "You'll need to point your domain to the GCE IP after creation"
else
    print_info "We'll configure with IP address only"
    USE_DOMAIN=false
fi

echo ""
read -p "Email for SSL certificate (required): " SSL_EMAIL
if [ -z "$SSL_EMAIL" ]; then
    print_error "Email is required for SSL certificates"
    exit 1
fi

# Firebase App URL
FIREBASE_APP_URL="https://lte-pci-mapper-nfomthzoza-uc.a.run.app"
echo ""
print_success "Firebase App URL: $FIREBASE_APP_URL"

echo ""
print_header "Configuration Summary"
cat << EOF
${BOLD}MongoDB:${NC}
  URI: ${MONGODB_URI:0:30}...
  Database: $MONGODB_DATABASE

${BOLD}Domain:${NC}
  ${USE_DOMAIN:+Domain: $DOMAIN_NAME}
  ${USE_DOMAIN:-Will use IP address only}

${BOLD}SSL:${NC}
  Email: $SSL_EMAIL

${BOLD}Firebase:${NC}
  App URL: $FIREBASE_APP_URL

${BOLD}GCP:${NC}
  Project: $PROJECT_ID
  Region: us-central1
  Zone: us-central1-a
EOF

echo ""
if ! confirm "Is this configuration correct?"; then
    print_error "Deployment cancelled. Please run again with correct information."
    exit 0
fi

pause_for_user

################################################################################
# Step 4: Create GCE Instance
################################################################################

print_step "4/8" "Creating GCE Instance & Infrastructure"

print_info "This will create:"
echo "  • Static external IP"
echo "  • Firewall rules"
echo "  • GCE instance (e2-standard-2)"
echo ""

INSTANCE_NAME="genieacs-backend"
ZONE="us-central1-a"
REGION="us-central1"

# Reserve static IP
print_progress "Reserving static external IP..."
if gcloud compute addresses describe ${INSTANCE_NAME}-ip --region=$REGION &>/dev/null; then
    print_warning "Static IP already exists"
    EXTERNAL_IP=$(gcloud compute addresses describe ${INSTANCE_NAME}-ip --region=$REGION --format='value(address)')
else
    gcloud compute addresses create ${INSTANCE_NAME}-ip \
        --region=$REGION \
        --network-tier=PREMIUM
    EXTERNAL_IP=$(gcloud compute addresses describe ${INSTANCE_NAME}-ip --region=$REGION --format='value(address)')
    print_success "Static IP reserved: $EXTERNAL_IP"
fi

# If no domain, use IP
if [ "$USE_DOMAIN" = false ]; then
    DOMAIN_NAME=$EXTERNAL_IP
fi

# Create firewall rules
print_progress "Creating firewall rules..."

# HTTP/HTTPS
if ! gcloud compute firewall-rules describe allow-http-https &>/dev/null; then
    gcloud compute firewall-rules create allow-http-https \
        --allow tcp:80,tcp:443 \
        --target-tags=genieacs-backend \
        --description="Allow HTTP and HTTPS traffic" \
        --direction=INGRESS
    print_success "Created HTTP/HTTPS firewall rule"
else
    print_info "HTTP/HTTPS rule already exists"
fi

# TR-069 CWMP
if ! gcloud compute firewall-rules describe allow-tr069-cwmp &>/dev/null; then
    gcloud compute firewall-rules create allow-tr069-cwmp \
        --allow tcp:7547 \
        --target-tags=genieacs-backend \
        --description="Allow TR-069 CWMP connections from CPE devices" \
        --direction=INGRESS
    print_success "Created TR-069 CWMP firewall rule"
else
    print_info "TR-069 rule already exists"
fi

# STUN/TURN
if ! gcloud compute firewall-rules describe allow-stun-turn &>/dev/null; then
    gcloud compute firewall-rules create allow-stun-turn \
        --allow udp:3478,tcp:3478 \
        --target-tags=genieacs-backend \
        --description="Allow STUN/TURN for NAT traversal" \
        --direction=INGRESS
    print_success "Created STUN/TURN firewall rule"
else
    print_info "STUN/TURN rule already exists"
fi

# Create instance
print_progress "Creating GCE instance (this takes 2-3 minutes)..."

if gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE &>/dev/null; then
    print_warning "Instance already exists"
    if ! confirm "Do you want to delete and recreate it?"; then
        print_info "Using existing instance"
    else
        gcloud compute instances delete $INSTANCE_NAME --zone=$ZONE --quiet
        sleep 5
    fi
fi

if ! gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE &>/dev/null; then
    gcloud compute instances create $INSTANCE_NAME \
        --project=$PROJECT_ID \
        --zone=$ZONE \
        --machine-type=e2-standard-2 \
        --network-interface=network-tier=PREMIUM,subnet=default,address=$EXTERNAL_IP \
        --maintenance-policy=MIGRATE \
        --tags=genieacs-backend,http-server,https-server \
        --image-family=ubuntu-2004-lts \
        --image-project=ubuntu-os-cloud \
        --boot-disk-size=50GB \
        --boot-disk-type=pd-balanced
    
    print_success "GCE instance created successfully!"
else
    print_success "GCE instance ready"
fi

echo ""
print_success "Infrastructure created!"
print_info "External IP: $EXTERNAL_IP"
print_info "Instance: $INSTANCE_NAME"

pause_for_user

################################################################################
# Step 5: Setup Backend Services
################################################################################

print_step "5/8" "Setting Up Backend Services on GCE"

print_info "This will install and configure:"
echo "  • Docker & Docker Compose"
echo "  • Node.js 20"
echo "  • GenieACS services (CWMP, NBI, FS, UI)"
echo "  • Backend API server"
echo "  • STUN server (Coturn)"
echo "  • Nginx reverse proxy"
echo ""

print_progress "Waiting for instance to be ready..."
sleep 10

# Create setup script with embedded configuration
print_progress "Creating configuration file..."

cat > /tmp/setup-config.env << EOF
MONGODB_URI=${MONGODB_URI}
MONGODB_DATABASE=${MONGODB_DATABASE}
EXTERNAL_DOMAIN=${DOMAIN_NAME}
EXTERNAL_IP=${EXTERNAL_IP}
FIREBASE_APP_URL=${FIREBASE_APP_URL}
SSL_EMAIL=${SSL_EMAIL}
USE_DOMAIN=${USE_DOMAIN}
EOF

# Copy setup script and config
print_progress "Copying setup script to instance..."
gcloud compute scp gce-backend/setup-gce-instance.sh $INSTANCE_NAME:~ --zone=$ZONE
gcloud compute scp /tmp/setup-config.env $INSTANCE_NAME:~ --zone=$ZONE

# Run setup with pre-configured values
print_progress "Running setup on GCE instance (10-15 minutes)..."
print_info "You can watch the progress below..."
echo ""

gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    chmod +x setup-gce-instance.sh
    
    # Source configuration
    source setup-config.env
    
    # Run setup with auto-responses
    echo \"Starting automated setup...\"
    
    # Create non-interactive version of setup
    export DEBIAN_FRONTEND=noninteractive
    
    # Run setup with config
    bash setup-gce-instance.sh <<SETUPEOF
\${MONGODB_URI}
\${MONGODB_DATABASE}
\${EXTERNAL_DOMAIN}
\${FIREBASE_APP_URL}
\${SSL_EMAIL}
y
SETUPEOF
"

print_success "Backend services installed and configured!"

pause_for_user

################################################################################
# Step 6: Verify Backend
################################################################################

print_step "6/8" "Verifying Backend Services"

print_progress "Checking service health..."

# Give services time to start
sleep 10

# Check health endpoint
print_progress "Testing health endpoint..."
HEALTH_CHECK=$(gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="curl -s http://localhost:3000/health" 2>/dev/null)

if echo "$HEALTH_CHECK" | grep -q "healthy"; then
    print_success "Backend health check passed!"
    echo ""
    echo "$HEALTH_CHECK" | head -20
else
    print_warning "Health check returned unexpected response"
    print_info "Services may still be starting up..."
fi

echo ""
print_info "Backend Services Status:"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    echo 'Docker Containers:'
    docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null || echo 'Checking...'
    echo ''
    echo 'Backend API:'
    systemctl is-active backend-api || echo 'Starting...'
    echo ''
    echo 'STUN Server:'
    systemctl is-active coturn || echo 'Starting...'
    echo ''
    echo 'Nginx:'
    systemctl is-active nginx || echo 'Starting...'
"

pause_for_user

################################################################################
# Step 7: Configure & Deploy Frontend
################################################################################

print_step "7/8" "Configuring & Deploying Frontend"

print_info "Updating frontend configuration with backend URLs..."
echo ""

# Navigate to Module_Manager
cd Module_Manager

# Update apphosting.yaml
print_progress "Creating apphosting.yaml with your configuration..."

cp apphosting.yaml.gce-backend apphosting.yaml

# Replace placeholders
if [ "$USE_DOMAIN" = true ]; then
    BACKEND_URL="https://${DOMAIN_NAME}"
else
    BACKEND_URL="https://${EXTERNAL_IP}"
fi

sed -i.bak "s|<YOUR-GCE-DOMAIN>|${BACKEND_URL}|g" apphosting.yaml
sed -i.bak "s|<YOUR-GCE-IP>|${EXTERNAL_IP}|g" apphosting.yaml

print_success "Frontend configuration updated"

echo ""
print_info "Configuration:"
echo "  Backend API:  ${BACKEND_URL}/api"
echo "  GenieACS NBI: ${BACKEND_URL}/nbi"
echo "  CWMP:         http://${EXTERNAL_IP}:7547"
echo "  STUN:         stun:${EXTERNAL_IP}:3478"

echo ""
print_progress "Deploying frontend to Firebase App Hosting..."
print_info "This may take 5-10 minutes..."
echo ""

cd ..
firebase deploy --only apphosting --project=$PROJECT_ID

print_success "Frontend deployed!"

# Route traffic
print_progress "Routing traffic to latest version..."
gcloud run services update-traffic lte-pci-mapper \
    --region=us-central1 \
    --project=$PROJECT_ID \
    --to-latest

print_success "Traffic routed to latest deployment"

pause_for_user

################################################################################
# Step 8: Final Verification & Summary
################################################################################

print_step "8/8" "Final Verification & Summary"

print_progress "Testing all endpoints..."
echo ""

# Test backend
print_progress "Testing backend health..."
if curl -s "${BACKEND_URL}/api/health" | grep -q "healthy"; then
    print_success "Backend API is responding"
else
    print_warning "Backend may still be starting up"
fi

# Test frontend
print_progress "Testing frontend..."
if curl -s -o /dev/null -w "%{http_code}" "https://lte-pci-mapper-nfomthzoza-uc.a.run.app" | grep -q "200\|301\|302"; then
    print_success "Frontend is accessible"
else
    print_warning "Frontend may still be deploying"
fi

################################################################################
# Success Summary
################################################################################

clear
print_header "🎉 Deployment Complete!"

cat << EOF
${BOLD}${GREEN}Success! Your LTE WISP Management Platform is now deployed!${NC}

${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

${BOLD}🌐 Your URLs:${NC}

${CYAN}Frontend Application:${NC}
  https://lte-pci-mapper-nfomthzoza-uc.a.run.app

${CYAN}Backend API:${NC}
  ${BACKEND_URL}/api/health    ${YELLOW}← Test this first!${NC}

${CYAN}GenieACS Services:${NC}
  ${BACKEND_URL}/nbi/devices   ${YELLOW}← GenieACS NBI API${NC}
  ${BACKEND_URL}/admin/        ${YELLOW}← Admin Dashboard${NC}
  ${BACKEND_URL}/fs/           ${YELLOW}← Firmware Server${NC}

${CYAN}TR-069 CWMP (for CPE devices):${NC}
  http://${EXTERNAL_IP}:7547

${CYAN}STUN Server:${NC}
  stun:${EXTERNAL_IP}:3478

${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

${BOLD}📊 What Was Created:${NC}

${CHECK} GCE Instance: ${INSTANCE_NAME}
${CHECK} External IP: ${EXTERNAL_IP} (static)
${CHECK} Docker Containers: 4 (CWMP, NBI, FS, UI)
${CHECK} Backend API: Running on port 3000
${CHECK} STUN Server: Running on port 3478
${CHECK} Nginx: Configured with SSL
${CHECK} Frontend: Deployed to Firebase App Hosting
${CHECK} Firewall Rules: HTTP/HTTPS, TR-069, STUN

${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

${BOLD}🔍 Next Steps:${NC}

${YELLOW}1. Test Your Deployment${NC}
   curl ${BACKEND_URL}/api/health
   
${YELLOW}2. Access Frontend${NC}
   Open: https://lte-pci-mapper-nfomthzoza-uc.a.run.app
   
${YELLOW}3. GenieACS Admin${NC}
   Open: ${BACKEND_URL}/admin/

EOF

if [ "$USE_DOMAIN" = true ]; then
    cat << EOF
${YELLOW}4. Configure DNS (IMPORTANT!)${NC}
   Add an A record pointing to: ${EXTERNAL_IP}
   Domain: ${DOMAIN_NAME}
   
   After DNS propagates, get SSL certificate:
   gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE}
   sudo certbot --nginx -d ${DOMAIN_NAME}

EOF
fi

cat << EOF
${YELLOW}5. Configure CPE Devices${NC}
   Set ACS URL to: http://${EXTERNAL_IP}:7547
   
${YELLOW}6. Monitor Services${NC}
   gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE}
   /opt/monitor.sh

${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

${BOLD}📚 Useful Commands:${NC}

${CYAN}SSH to Backend:${NC}
  gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE}

${CYAN}View Backend Logs:${NC}
  gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="sudo journalctl -u backend-api -f"

${CYAN}Restart Services:${NC}
  gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="cd /opt/genieacs && docker-compose restart"

${CYAN}Update Frontend:${NC}
  firebase deploy --only apphosting

${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

${BOLD}💰 Cost Estimate:${NC}
  GCE Instance: ~\$50/month (can be stopped when not in use)
  Firebase: ~\$50/month
  Total: ~\$100-125/month

${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

${BOLD}📖 Documentation:${NC}
  README_REFACTORING.md         - Start here
  DEPLOYMENT_SUMMARY.md         - Deployment overview
  COMMAND_REFERENCE.md          - Quick commands
  gce-backend/README.md         - Operations guide

${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

${GREEN}${BOLD}🎉 Congratulations! Your deployment is complete!${NC}

${CYAN}Questions? Check the documentation or run:${NC}
  gcloud compute ssh ${INSTANCE_NAME} --zone=${ZONE} --command="/opt/monitor.sh"

${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

EOF

# Save deployment info
cat > deployment-info.txt << EOF
Deployment completed: $(date)

Frontend URL: https://lte-pci-mapper-nfomthzoza-uc.a.run.app
Backend URL: ${BACKEND_URL}
External IP: ${EXTERNAL_IP}
Instance: ${INSTANCE_NAME}
Zone: ${ZONE}

Health Check: ${BACKEND_URL}/api/health
GenieACS NBI: ${BACKEND_URL}/nbi/devices
GenieACS Admin: ${BACKEND_URL}/admin/
CWMP: http://${EXTERNAL_IP}:7547
STUN: stun:${EXTERNAL_IP}:3478
EOF

print_success "Deployment information saved to: deployment-info.txt"

echo ""
echo -e "${BOLD}${GREEN}Thank you for using the automated deployment script!${NC}"
echo ""

