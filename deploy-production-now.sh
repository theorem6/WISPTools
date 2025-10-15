#!/bin/bash
# One-Command Production Deployment
# Creates new VM with Ubuntu 24.04 + GenieACS + rapid5gs HSS
# Run from Firebase Studio

set -e

PROJECT_ID="lte-pci-mapper-65450042-bbf71"

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Deploying Production ACS + HSS Server"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "This will:"
echo "  1. Create new Ubuntu 24.04 VM"
echo "  2. Install GenieACS (ACS/TR-069)"
echo "  3. Install rapid5gs HSS (S6a/MME)"
echo "  4. Configure cloud MongoDB connection"
echo ""
echo "VM Name: acs-hss-server"
echo "Zone: us-central1-a"
echo "OS: Ubuntu 24.04 LTS"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Trigger Cloud Build
gcloud builds submit \
  --config=deploy-acs-hss-production.yaml \
  --project=$PROJECT_ID

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "Monitor: https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
echo ""

