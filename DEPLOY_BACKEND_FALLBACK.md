# Backend Deploy Fallback (Manual)

When `deploy-backend-to-gce.ps1` uploads files but the **SSH step fails** (e.g. plink/IAP on Windows), finish the deploy manually.

## Prerequisites

- Files already uploaded to the VM (script printed “Running remote install and pm2…” then failed).
- `gcloud` installed and authenticated (e.g. on the same machine, Cloud Shell, or another host with network access to the instance).

## Defaults (match the script)

- **Instance:** `acs-hss-server`
- **Zone:** `us-central1-a`
- **Project:** from `gcloud config get-value project` (or set explicitly).
- **App dir:** `/opt/lte-pci-mapper/backend-services`

If the script was run with different `-InstanceName`, `-Zone`, `-Project`, or `-BackendDir`, use those values below.

## Option A: Script uploaded to `/tmp/backend-services-deploy`

If the **main** backend upload succeeded but the **runner** SSH failed, the app files are under `/tmp/backend-services-deploy` on the VM. From **bash or Cloud Shell** run (use single quotes so `$TARGET` runs on the VM):

```bash
gcloud compute ssh acs-hss-server \
  --project=YOUR_PROJECT \
  --zone=us-central1-a \
  --tunnel-through-iap \
  --command 'set -e
TARGET=/opt/lte-pci-mapper/backend-services
PARENT=$(dirname "$TARGET")
sudo mkdir -p "$PARENT" 2>/dev/null
sudo chown -R $USER:$USER "$PARENT" 2>/dev/null
mv "$TARGET" "${TARGET}.bak" 2>/dev/null
mv /tmp/backend-services-deploy "$TARGET"
cd "$TARGET" && npm install --omit=dev
command -v pm2 >/dev/null 2>&1 || sudo npm install -g pm2
pm2 reload ecosystem.config.js 2>/dev/null || (cd "$TARGET" && pm2 start ecosystem.config.js)
pm2 save
echo Done.'
```

Replace `YOUR_PROJECT` with your GCP project ID (e.g. `lte-pci-mapper-65450042-bbf71`). Omit `--tunnel-through-iap` if the VM has a public IP and you are not using IAP.

## Option B: Only install + pm2 (files already in place)

If the app is already at `/opt/lte-pci-mapper/backend-services` (e.g. from a prior upload or after `deploy-backend-to-gce.ps1` uploaded but SSH failed), run from **Cloud Shell** or a host with working IAP:

```bash
gcloud compute ssh acs-hss-server \
  --project=lte-pci-mapper-65450042-bbf71 \
  --zone=us-central1-a \
  --tunnel-through-iap \
  --command "cd /opt/lte-pci-mapper/backend-services && npm install --omit=dev && pm2 reload ecosystem.config.js && pm2 save"
```

Replace the project ID with yours if different. After this, backend (including deployment photos/GridFS) will be running the latest code.

## Option C: From Google Cloud Shell

1. Open [Cloud Shell](https://console.cloud.google.com).
2. Ensure project/zone and run the same `gcloud compute ssh ... --command "..."` as in Option A or B.

Cloud Shell usually has working IAP/SSH, so this avoids plink/Windows issues.

## Git deploy / update-backend-from-git.sh

On the VM, `scripts/deployment/update-backend-from-git.sh` pulls from `theorem6/WISPTools` via HTTPS. **GITHUB_TOKEN is required** (no default in repo). Set it in the environment or in `/opt/lte-pci-mapper/.env`:

```bash
export GITHUB_TOKEN=ghp_xxxxxxxx
# or add GITHUB_TOKEN=ghp_... to /opt/lte-pci-mapper/.env
```

From your machine, use `.\deploy-backend-to-gce.ps1 -DeployMethod Git` with `$env:GITHUB_TOKEN` set, or pass `-GitHubToken ghp_...`.

## Environment (optional)

On the VM, if deployment photo URLs must be absolute (e.g. field app loading GridFS photos), set **API_BASE_URL** in the app env (e.g. in `ecosystem.config.js` or a `.env` file) to the public base URL of the API (e.g. `https://api.yourdomain.com` or the Cloud Run URL). See `backend-services/.env.example` for the variable name.
