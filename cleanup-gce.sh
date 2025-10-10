#!/bin/bash

# Quick cleanup script to remove partial GCE deployment

echo ""
echo "🧹 GCE Cleanup Script"
echo "===================="
echo ""
echo "This will delete:"
echo "  • GCE instance (genieacs-backend)"
echo "  • Static IP (genieacs-backend-ip)"
echo "  • Firewall rules (allow-http-https, allow-tr069-cwmp, allow-stun-turn)"
echo ""

read -p "Continue? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "❌ Cancelled"
    exit 0
fi

echo ""
echo "🔍 Checking what exists..."
echo ""

# Check instance
if gcloud compute instances describe genieacs-backend --zone=us-central1-a &>/dev/null; then
    echo "📦 Instance exists: genieacs-backend"
    HAS_INSTANCE=true
else
    echo "✓ No instance found"
    HAS_INSTANCE=false
fi

# Check IP
if gcloud compute addresses describe genieacs-backend-ip --region=us-central1 &>/dev/null; then
    IP_ADDRESS=$(gcloud compute addresses describe genieacs-backend-ip --region=us-central1 --format='value(address)')
    echo "📍 Static IP exists: $IP_ADDRESS"
    HAS_IP=true
else
    echo "✓ No static IP found"
    HAS_IP=false
fi

# Check firewall rules
FIREWALL_COUNT=0
if gcloud compute firewall-rules describe allow-http-https &>/dev/null; then
    echo "🔥 Firewall rule exists: allow-http-https"
    ((FIREWALL_COUNT++))
fi
if gcloud compute firewall-rules describe allow-tr069-cwmp &>/dev/null; then
    echo "🔥 Firewall rule exists: allow-tr069-cwmp"
    ((FIREWALL_COUNT++))
fi
if gcloud compute firewall-rules describe allow-stun-turn &>/dev/null; then
    echo "🔥 Firewall rule exists: allow-stun-turn"
    ((FIREWALL_COUNT++))
fi

if [ $FIREWALL_COUNT -eq 0 ]; then
    echo "✓ No firewall rules found"
fi

echo ""
echo "🗑️  Starting cleanup..."
echo ""

# Delete instance
if [ "$HAS_INSTANCE" = true ]; then
    echo "Deleting instance..."
    gcloud compute instances delete genieacs-backend --zone=us-central1-a --quiet
    if [ $? -eq 0 ]; then
        echo "✅ Instance deleted"
    else
        echo "⚠️  Failed to delete instance (may not exist)"
    fi
else
    echo "✓ No instance to delete"
fi

# Release static IP
if [ "$HAS_IP" = true ]; then
    echo "Releasing static IP..."
    gcloud compute addresses delete genieacs-backend-ip --region=us-central1 --quiet
    if [ $? -eq 0 ]; then
        echo "✅ IP released"
    else
        echo "⚠️  Failed to release IP"
    fi
else
    echo "✓ No IP to release"
fi

# Delete firewall rules
echo "Deleting firewall rules..."
gcloud compute firewall-rules delete allow-http-https --quiet 2>/dev/null && echo "✅ Deleted: allow-http-https"
gcloud compute firewall-rules delete allow-tr069-cwmp --quiet 2>/dev/null && echo "✅ Deleted: allow-tr069-cwmp"
gcloud compute firewall-rules delete allow-stun-turn --quiet 2>/dev/null && echo "✅ Deleted: allow-stun-turn"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Cleanup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "You can now run the deployment script again:"
echo "  ./gce-backend/create-gce-instance.sh"
echo ""


