#!/bin/bash
# Paste this entire script into SSH terminal

cd /opt/hss-api

# Restore clean backup
echo "Restoring backup..."
cp $(ls -t server.js.backup.* | head -1) server.js

# Add require statement after the dotenv line
echo "Adding require statement..."
sed -i "/require('dotenv').config()/a\\
const unifiedNetworkAPI = require('./unified-network-api');" server.js

# Find where to add the route - look for app.listen and add before it
echo "Adding route registration..."
sed -i "/^app.listen/i\\
\\
// Unified Network API\\
app.use('/api/network', unifiedNetworkAPI);\\
" server.js

# Verify it was added
echo "Verifying changes..."
grep -n "unified-network" server.js

# Start service
echo "Starting service..."
systemctl start hss-api
sleep 3

# Test
echo "Testing..."
curl -s -H "X-Tenant-ID: test" http://localhost:3000/api/network/sites

echo ""
echo "Done! If you see [] above, it's working!"

