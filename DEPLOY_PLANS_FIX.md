# Deploy Plans.js Fix to GCE Backend

## Quick Deployment Commands

Run these commands on the GCE server (via SSH or gcloud):

```bash
# SSH into the server
ssh root@136.112.111.167
# OR use gcloud:
# gcloud compute ssh acs-hss-server --zone=us-central1-a

# Once connected, run:
cd /root/lte-pci-mapper
git pull origin main
mkdir -p /opt/hss-api/routes/backups
cp /opt/hss-api/routes/plans.js /opt/hss-api/routes/backups/plans.js.backup
cp backend-services/routes/plans.js /opt/hss-api/routes/plans.js
node --check /opt/hss-api/routes/plans.js
systemctl daemon-reload
systemctl restart hss-api
sleep 3
systemctl status hss-api --no-pager -l | head -n 10
```

## What This Fix Does

The updated `plans.js` route now:
- Properly uses `createdBy` from the request body (instead of requiring `req.user`)
- Sets proper defaults for all required plan fields (scope, hardwareRequirements, purchasePlan, etc.)
- Ensures plan creation works even if some optional fields are missing

## Verification

After deployment, test the create project functionality in the Plan module. It should now work correctly with proper error messages if something goes wrong.


