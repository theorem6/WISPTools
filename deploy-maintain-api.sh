#!/bin/bash
# Deploy maintain-api.js to GCE server

echo "Deploying maintain-api.js to GCE..."

# Copy maintain-api.js
gcloud compute scp backend-services/maintain-api.js acs-hss-server:/home/david/ --zone=us-central1-a

# SSH and update server.js
gcloud compute ssh acs-hss-server --zone=us-central1-a << 'EOF'
cd /opt/hss-api

# Backup current server.js
sudo cp server.js server.js.backup-$(date +%Y%m%d-%H%M%S)

# Copy maintain-api.js to server location
sudo cp /home/david/maintain-api.js maintain-api.js
sudo chown root:root maintain-api.js

# Find line with workOrderAPI
LINE=$(grep -n "const workOrderAPI" server.js | cut -d: -f1)

# Add maintainAPI require after workOrderAPI
sudo sed -i "${LINE}a const maintainAPI = require('./maintain-api');" server.js

# Find line with /api/work-orders
LINE=$(grep -n "/api/work-orders" server.js | cut -d: -f1)

# Add maintain route after work-orders
sudo sed -i "${LINE}a app.use('/api/maintain', maintainAPI);" server.js

# Verify syntax
node --check server.js && echo "✅ Server.js syntax OK" || (echo "❌ Syntax error, restoring backup" && sudo cp server.js.backup-* server.js && exit 1)

# Restart service
sudo systemctl restart hss-api
sleep 3
sudo systemctl status hss-api --no-pager | head -n 10

echo "✅ Deployment complete"
EOF

