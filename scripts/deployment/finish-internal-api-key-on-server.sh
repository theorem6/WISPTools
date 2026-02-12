#!/usr/bin/env bash
# Run this ON the GCE instance (e.g. after SSH or from Cloud Shell) to apply
# INTERNAL_API_KEY from /tmp/internal_api_key.txt to backend .env and restart main-api.
# If the key file is missing, run the PowerShell script from your PC first to upload it:
#   .\scripts\set-internal-api-key-on-gce.ps1
set -e
BACKEND_DIR="${BACKEND_DIR:-/opt/lte-pci-mapper/backend-services}"
KEY_FILE="/tmp/internal_api_key.txt"

if [ ! -f "$KEY_FILE" ]; then
  echo "Missing $KEY_FILE. From your PC run: .\\scripts\\set-internal-api-key-on-gce.ps1"
  echo "That uploads the key; if SSH fails, SSH to this box and run this script again."
  exit 1
fi

cd "$BACKEND_DIR"
if [ -f .env ]; then
  grep -v '^INTERNAL_API_KEY=' .env > .env.tmp || true
else
  touch .env.tmp
fi
echo -n 'INTERNAL_API_KEY=' >> .env.tmp
cat "$KEY_FILE" >> .env.tmp
echo '' >> .env.tmp
mv .env.tmp .env
rm -f "$KEY_FILE"

# Restart main-api (pm2 may be under root or current user)
(sudo PM2_HOME=/root/.pm2 /usr/lib/node_modules/pm2/bin/pm2 restart main-api --update-env 2>/dev/null) || \
(pm2 restart main-api --update-env 2>/dev/null) || true
echo "Done. /api/user-tenants should now return 200."
