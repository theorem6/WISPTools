#!/bin/bash
# Simple script to get monitoring graph logs

echo "=== Recent Monitoring Graph Requests ==="
pm2 logs main-api --lines 5000 --nostream 2>&1 | grep -i "Monitoring Graphs" | tail -30

echo ""
echo "=== Device ID Queries ==="  
pm2 logs main-api --lines 5000 --nostream 2>&1 | grep -i "device.*id\|Fetching ping\|Found.*metrics" | tail -30

echo ""
echo "=== Recent API Errors ==="
pm2 logs main-api --lines 2000 --nostream 2>&1 | grep -i "error\|exception\|failed" | grep -i "monitor\|graph\|ping" | tail -20

