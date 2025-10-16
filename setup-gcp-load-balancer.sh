#!/bin/bash
# Setup Google Cloud Load Balancer with SSL for HSS API
# Run this from your LOCAL machine with gcloud CLI

set -e

PROJECT_ID="lte-pci-mapper-65450042-bbf71"
REGION="us-east4"
ZONE="us-east4-c"
INSTANCE_NAME="acs-h"
INSTANCE_IP="136.112.111.167"
BACKEND_NAME="hss-api-backend"
HEALTH_CHECK_NAME="hss-api-health"
LB_NAME="hss-api-lb"
IP_NAME="hss-api-ip"

# Domain for HSS API
DOMAIN="hss.4gengineer.com"

echo "🔧 Setting up Google Cloud Load Balancer for HSS API..."
echo ""
echo "⚠️  IMPORTANT: You MUST have a domain name for this to work!"
echo "   Update DOMAIN variable in this script to your domain."
echo "   Example: api.yourdomain.com or hss.yourdomain.com"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

gcloud config set project $PROJECT_ID

# 1. Reserve a static IP address
echo "📍 Reserving static IP address..."
gcloud compute addresses create $IP_NAME \
    --ip-version=IPV4 \
    --global \
    || echo "IP address already exists"

STATIC_IP=$(gcloud compute addresses describe $IP_NAME --global --format="get(address)")
echo "✅ Static IP: $STATIC_IP"
echo ""
echo "🔔 ACTION REQUIRED: Point your domain $DOMAIN to this IP: $STATIC_IP"
echo "   Create an A record in your DNS settings:"
echo "   Type: A"
echo "   Name: @ (or subdomain)"
echo "   Value: $STATIC_IP"
echo ""
read -p "Press Enter once DNS is configured..."

# 2. Create health check
echo "🏥 Creating health check..."
gcloud compute health-checks create http $HEALTH_CHECK_NAME \
    --port=3000 \
    --request-path=/health \
    --check-interval=10s \
    --timeout=5s \
    --unhealthy-threshold=3 \
    --healthy-threshold=2 \
    || echo "Health check already exists"

# 3. Create instance group
echo "👥 Creating instance group..."
gcloud compute instance-groups unmanaged create hss-api-group \
    --zone=$ZONE \
    || echo "Instance group already exists"

gcloud compute instance-groups unmanaged add-instances hss-api-group \
    --zone=$ZONE \
    --instances=$INSTANCE_NAME \
    || echo "Instance already in group"

# 4. Create backend service
echo "🔧 Creating backend service..."
gcloud compute backend-services create $BACKEND_NAME \
    --protocol=HTTP \
    --health-checks=$HEALTH_CHECK_NAME \
    --port-name=http \
    --timeout=30s \
    --global \
    || echo "Backend service already exists"

gcloud compute instance-groups unmanaged set-named-ports hss-api-group \
    --zone=$ZONE \
    --named-ports=http:3000

gcloud compute backend-services add-backend $BACKEND_NAME \
    --instance-group=hss-api-group \
    --instance-group-zone=$ZONE \
    --global \
    || echo "Backend already added"

# 5. Create URL map
echo "🗺️  Creating URL map..."
gcloud compute url-maps create $LB_NAME \
    --default-service=$BACKEND_NAME \
    || echo "URL map already exists"

# 6. Create managed SSL certificate
echo "🔐 Creating managed SSL certificate..."
gcloud compute ssl-certificates create hss-api-cert \
    --domains=$DOMAIN \
    --global \
    || echo "SSL certificate already exists"

# 7. Create HTTPS proxy
echo "🔌 Creating HTTPS proxy..."
gcloud compute target-https-proxies create hss-api-https-proxy \
    --url-map=$LB_NAME \
    --ssl-certificates=hss-api-cert \
    --global \
    || echo "HTTPS proxy already exists"

# 8. Create forwarding rule
echo "📨 Creating forwarding rule..."
gcloud compute forwarding-rules create hss-api-https-rule \
    --address=$IP_NAME \
    --target-https-proxy=hss-api-https-proxy \
    --global \
    --ports=443 \
    || echo "Forwarding rule already exists"

echo ""
echo "✅ Load Balancer setup complete!"
echo ""
echo "📋 Summary:"
echo "  Static IP: $STATIC_IP"
echo "  Domain: $DOMAIN"
echo "  HSS API URL: https://$DOMAIN"
echo ""
echo "⏳ IMPORTANT: SSL certificate provisioning takes 15-60 minutes"
echo "   Check status: gcloud compute ssl-certificates describe hss-api-cert --global"
echo ""
echo "🔧 Once SSL is active, update your apphosting.yaml:"
echo "   VITE_HSS_API_URL: https://$DOMAIN"
echo ""
echo "🔥 Add firewall rule for health checks:"
gcloud compute firewall-rules create allow-health-check \
    --allow tcp:3000 \
    --source-ranges 130.211.0.0/22,35.191.0.0/16 \
    --target-tags http-server \
    || echo "Firewall rule already exists"

echo ""
echo "✅ All done! Wait for SSL to provision, then test:"
echo "   curl https://$DOMAIN/bandwidth-plans"

