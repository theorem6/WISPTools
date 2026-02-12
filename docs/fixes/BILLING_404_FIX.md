---
title: Billing 404 Fix (generate-invoices and dunning)
description: How to fix 404s for customer-billing generate-invoices and dunning/run.
---

# Billing 404 Fix: generate-invoices and dunning/run

## Symptom

In the browser console when using **Customers → Billing**:

- `POST https://wisptools.io/api/customer-billing/generate-invoices 404 (Not Found)`
- `POST https://wisptools.io/api/customer-billing/dunning/run 404 (Not Found)`

## Cause

The **frontend** (Module_Manager on Firebase Hosting) and **apiProxy** (Cloud Function) are correct. Requests are forwarded to the GCE backend at `hss.wisptools.io`. The **backend running on GCE** does not yet have the routes for:

- `POST /api/customer-billing/generate-invoices`
- `POST /api/customer-billing/dunning/run`

These routes exist in this repo in `backend-services/routes/customer-billing.js` but have not been deployed to the GCE server.

## Fix (one-time): Deploy backend to GCE

Deploy the latest `backend-services` code to the GCE instance so these routes are available.

### Option A: SSH to GCE and pull + restart

```bash
# SSH to the server (use gcloud if needed)
gcloud compute ssh INSTANCE_NAME --zone=ZONE --tunnel-through-iap
# or: ssh user@hss.wisptools.io

cd /opt/lte-pci-mapper 2>/dev/null || cd /root/lte-pci-mapper
git pull origin main
cd backend-services
npm install --production
pm2 restart all
pm2 save
pm2 status
```

### Option B: Use the repo deploy script (from your machine)

From the repo root (Windows):

```powershell
.\deploy-backend-to-gce.ps1 -DeployMethod Git
```

Or if you use upload:

```powershell
.\deploy-backend-to-gce.ps1 -DeployMethod Upload
```

See **docs/deployment/BACKEND_DEPLOYMENT_INSTRUCTIONS.md** for full steps and options.

### Option C: Upload already ran but SSH failed — complete manually

If you ran `.\deploy-backend-to-gce.ps1 -DeployMethod Upload` and the upload succeeded but the remote install failed (e.g. plink/SSH error), the new code is already on the server at `/tmp/backend-services-deploy`. Complete the deploy by running these commands **on the GCE server** (e.g. via **Google Cloud Shell**, where SSH is more reliable):

```bash
# From Cloud Shell or any machine with gcloud:
gcloud compute ssh acs-hss-server --project=lte-pci-mapper-65450042-bbf71 --zone=us-central1-a --tunnel-through-iap --command="
  set -e
  TARGET=/opt/lte-pci-mapper/backend-services
  PARENT=\$(dirname \"\$TARGET\")
  sudo mkdir -p \"\$PARENT\"
  sudo mv \"\$TARGET\" \"\${TARGET}.bak\" 2>/dev/null || true
  sudo mv /tmp/backend-services-deploy \"\$TARGET\"
  sudo chown -R \$(whoami):\$(whoami) \"\$TARGET\"
  cd \"\$TARGET\" && npm install --omit=dev
  command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2
  pm2 reload ecosystem.config.js 2>/dev/null || (cd \"\$TARGET\" && pm2 start ecosystem.config.js)
  pm2 save
  echo Done.
"
```

Or SSH in and run the same steps interactively:

```bash
gcloud compute ssh acs-hss-server --project=lte-pci-mapper-65450042-bbf71 --zone=us-central1-a --tunnel-through-iap
# Then on the server:
TARGET=/opt/lte-pci-mapper/backend-services
sudo mv "$TARGET" "${TARGET}.bak" 2>/dev/null || true
sudo mv /tmp/backend-services-deploy "$TARGET"
sudo chown -R $(whoami):$(whoami) "$TARGET"
cd "$TARGET" && npm install --omit=dev && pm2 reload ecosystem.config.js && pm2 save
```

## After deployment

- **Generate invoices** and **Run dunning** buttons in Customers → Billing should return 200 (or appropriate JSON) instead of 404.
- If you still see 404, check Firebase Functions logs for `apiProxy` to confirm the request path and backend URL, and backend logs on GCE to confirm the main API process received the request.
