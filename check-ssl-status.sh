#!/bin/bash

# Check SSL certificate status for wisptools.io
echo "🔍 Checking SSL certificate status for wisptools.io..."
echo "======================================================"

SSL_CERT_NAME="wisptools-ssl-cert"

# Check SSL certificate status
echo "SSL Certificate Status:"
gcloud compute ssl-certificates describe $SSL_CERT_NAME --global --format="table(name,status,managed.status,managed.domains[].list():label=DOMAINS)"

echo ""
echo "Load Balancer Status:"
FORWARDING_RULE_NAME="wisptools-https-rule"
gcloud compute forwarding-rules describe $FORWARDING_RULE_NAME --global --format="table(name,IPAddress,status,target)"

echo ""
echo "Backend Service Health:"
BACKEND_SERVICE_NAME="wisptools-api-backend"
gcloud compute backend-services get-health $BACKEND_SERVICE_NAME --global

echo ""
echo "To test HTTPS endpoint:"
STATIC_IP=$(gcloud compute addresses describe wisptools-api-ip --global --format="get(address)")
echo "curl -I https://$STATIC_IP/health"
echo "curl -I https://wisptools.io/health"
