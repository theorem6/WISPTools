#!/bin/bash
# Quick fix for the server.js syntax error on line 340

echo "🔧 Fixing server.js syntax error..."

# Stop the service
systemctl stop hss-api.service

# Fix the syntax error on line 340
sed -i "387s/\\\\\`/\`/g" /opt/hss-api/server.js
sed -i "387s/\\\\\$/$/g" /opt/hss-api/server.js

# Or alternatively, replace the entire problematic line with correct syntax
sed -i '387s/.*/        results.errors.push(`IMSI ${sub.imsi}: ${error.message}`);/' /opt/hss-api/server.js

# Restart the service
systemctl start hss-api.service

# Check status
sleep 2
systemctl status hss-api.service --no-pager

echo ""
echo "✅ Fix applied! Check the status above."

