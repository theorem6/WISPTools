#!/bin/bash
# Script to update and restart backend server on GCE

cd /opt/lte-pci-mapper
git pull origin main || git fetch origin && git reset --hard origin/main

# Restart the backend service
pm2 restart main-api

# Wait a moment
sleep 3

# Check status
pm2 status

# Test health endpoint
curl -s http://localhost:3001/health || echo "Health check failed"

