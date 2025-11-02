#!/bin/bash
cd /root/lte-pci-mapper
git pull origin main
mkdir -p /opt/hss-api/routes/backups
cp /opt/hss-api/routes/plans.js /opt/hss-api/routes/backups/plans.js.backup 2>/dev/null || true
cp backend-services/routes/plans.js /opt/hss-api/routes/plans.js
node --check /opt/hss-api/routes/plans.js
systemctl daemon-reload
systemctl restart hss-api
sleep 3
systemctl status hss-api --no-pager -l | head -n 10


