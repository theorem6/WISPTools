#!/bin/bash
# Quick diagnostic script to check EPC status and logs on GCE server

GCE_INSTANCE="acs-hss-server"
GCE_ZONE="us-central1-a"
REPO_DIR="/opt/lte-pci-mapper"
DEVICE_CODE="YALNTFQC"
TENANT_ID="690abdc14a6f067977986db3"

echo "=========================================="
echo "EPC Status Diagnostic"
echo "=========================================="
echo ""

echo "1. Checking recent check-ins..."
gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command="pm2 logs main-api --lines 50 --nostream | grep -E 'EPC Check-in|Saved service status|YALNTFQC' | tail -20"

echo ""
echo "2. Running database diagnostic..."
gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command="cd $REPO_DIR && node backend-services/scripts/debug-epc-data.js $DEVICE_CODE $TENANT_ID"

echo ""
echo "3. Checking API endpoint response..."
gcloud compute ssh $GCE_INSTANCE --zone=$GCE_ZONE --command="cd $REPO_DIR && curl -s -H 'X-Tenant-ID: $TENANT_ID' http://localhost:3001/api/hss/epc/remote/list | jq '.' | head -50"

echo ""
echo "=========================================="
echo "Diagnostic Complete"
echo "=========================================="

