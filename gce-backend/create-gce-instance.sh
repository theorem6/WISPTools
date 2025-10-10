#!/bin/bash

# Script to create Google Compute Engine instance for GenieACS Backend
# Run this from your local machine with gcloud CLI installed

set -e

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

echo "============================================"
echo "GCE Instance Creation for GenieACS Backend"
echo "============================================"
echo ""

# Configuration
PROJECT_ID="lte-pci-mapper-65450042-bbf71"
INSTANCE_NAME="genieacs-backend"
ZONE="us-central1-a"
REGION="us-central1"
MACHINE_TYPE="e2-standard-2"  # 2 vCPU, 8 GB RAM
BOOT_DISK_SIZE="50GB"
BOOT_DISK_TYPE="pd-balanced"  # Balance between performance and cost
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"
NETWORK_TIER="PREMIUM"

print_status "Configuration:"
echo "  Project ID:    $PROJECT_ID"
echo "  Instance:      $INSTANCE_NAME"
echo "  Zone:          $ZONE"
echo "  Machine Type:  $MACHINE_TYPE"
echo "  Disk Size:     $BOOT_DISK_SIZE"
echo ""

# Confirm
read -p "Continue with instance creation? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    print_error "Cancelled"
    exit 1
fi

# Set project
print_status "Setting project..."
gcloud config set project $PROJECT_ID

# Reserve static external IP
print_status "Reserving static external IP..."
if gcloud compute addresses describe ${INSTANCE_NAME}-ip --region=$REGION &>/dev/null; then
    print_warning "Static IP already exists"
else
    gcloud compute addresses create ${INSTANCE_NAME}-ip \
        --region=$REGION \
        --network-tier=$NETWORK_TIER
fi

# Get the reserved IP
EXTERNAL_IP=$(gcloud compute addresses describe ${INSTANCE_NAME}-ip \
    --region=$REGION \
    --format='value(address)')
print_status "Reserved IP: $EXTERNAL_IP"

# Create firewall rules
print_status "Creating firewall rules..."

# HTTP/HTTPS
if ! gcloud compute firewall-rules describe allow-http-https &>/dev/null; then
    gcloud compute firewall-rules create allow-http-https \
        --allow tcp:80,tcp:443 \
        --target-tags=genieacs-backend \
        --description="Allow HTTP and HTTPS traffic" \
        --direction=INGRESS \
        --priority=1000
    print_status "Created HTTP/HTTPS firewall rule"
else
    print_warning "HTTP/HTTPS firewall rule already exists"
fi

# TR-069 CWMP
if ! gcloud compute firewall-rules describe allow-tr069-cwmp &>/dev/null; then
    gcloud compute firewall-rules create allow-tr069-cwmp \
        --allow tcp:7547 \
        --target-tags=genieacs-backend \
        --description="Allow TR-069 CWMP connections from CPE devices" \
        --direction=INGRESS \
        --priority=1000
    print_status "Created TR-069 CWMP firewall rule"
else
    print_warning "TR-069 CWMP firewall rule already exists"
fi

# STUN/TURN
if ! gcloud compute firewall-rules describe allow-stun-turn &>/dev/null; then
    gcloud compute firewall-rules create allow-stun-turn \
        --allow udp:3478,tcp:3478 \
        --target-tags=genieacs-backend \
        --description="Allow STUN/TURN for NAT traversal" \
        --direction=INGRESS \
        --priority=1000
    print_status "Created STUN/TURN firewall rule"
else
    print_warning "STUN/TURN firewall rule already exists"
fi

# Create the instance
print_status "Creating GCE instance..."
if gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE &>/dev/null; then
    print_error "Instance $INSTANCE_NAME already exists!"
    read -p "Do you want to delete and recreate it? (y/n): " RECREATE
    if [ "$RECREATE" == "y" ]; then
        print_warning "Deleting existing instance..."
        gcloud compute instances delete $INSTANCE_NAME --zone=$ZONE --quiet
    else
        print_error "Cancelled"
        exit 1
    fi
fi

gcloud compute instances create $INSTANCE_NAME \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --network-interface=network-tier=$NETWORK_TIER,subnet=default,address=$EXTERNAL_IP \
    --maintenance-policy=MIGRATE \
    --provisioning-model=STANDARD \
    --tags=genieacs-backend,http-server,https-server \
    --create-disk=auto-delete=yes,boot=yes,device-name=$INSTANCE_NAME,image=projects/$IMAGE_PROJECT/global/images/family/$IMAGE_FAMILY,mode=rw,size=$BOOT_DISK_SIZE,type=projects/$PROJECT_ID/zones/$ZONE/diskTypes/$BOOT_DISK_TYPE \
    --no-shielded-secure-boot \
    --shielded-vtpm \
    --shielded-integrity-monitoring \
    --labels=environment=production,service=genieacs,component=backend \
    --reservation-affinity=any

print_status "Instance created successfully!"

# Wait for instance to be ready
print_status "Waiting for instance to be ready..."
sleep 15

# Get instance details
INSTANCE_DETAILS=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format=json)

echo ""
echo "==========================================="
print_status "Instance Created Successfully!"
echo "==========================================="
echo ""
echo "Instance Details:"
echo "  Name:          $INSTANCE_NAME"
echo "  Zone:          $ZONE"
echo "  External IP:   $EXTERNAL_IP"
echo "  Machine Type:  $MACHINE_TYPE"
echo "  Disk Size:     $BOOT_DISK_SIZE"
echo ""
echo "Firewall Rules:"
echo "  HTTP/HTTPS:    Ports 80, 443"
echo "  TR-069 CWMP:   Port 7547"
echo "  STUN/TURN:     Port 3478 (UDP/TCP)"
echo ""
echo "Next Steps:"
echo ""
echo "1. SSH into the instance:"
echo "   gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
echo ""
echo "2. Copy the setup script to the instance:"
echo "   gcloud compute scp gce-backend/setup-gce-instance.sh $INSTANCE_NAME:~ --zone=$ZONE"
echo ""
echo "3. Run the setup script on the instance:"
echo "   chmod +x setup-gce-instance.sh"
echo "   ./setup-gce-instance.sh"
echo ""
echo "4. Configure DNS (if using a custom domain):"
echo "   Point your domain to: $EXTERNAL_IP"
echo ""
echo "5. Update frontend environment variables with:"
echo "   PUBLIC_BACKEND_API_URL=https://<your-domain>/api"
echo "   PUBLIC_GENIEACS_CWMP_URL=http://$EXTERNAL_IP:7547"
echo "   PUBLIC_STUN_SERVER=stun:$EXTERNAL_IP:3478"
echo ""
echo "==========================================="
print_status "Done!"

