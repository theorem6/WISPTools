#!/bin/bash
# Script to check monitoring graph logs and database device_ids

echo "=== Checking PM2 logs for monitoring graphs ==="
pm2 logs main-api --lines 500 --nostream | grep -i "Monitoring Graphs\|monitoring.*graphs\|device_id\|ping.*metrics" | tail -30

echo ""
echo "=== Checking recent API requests ==="
pm2 logs main-api --lines 200 --nostream | grep -E "/api/monitoring/graphs" | tail -20

