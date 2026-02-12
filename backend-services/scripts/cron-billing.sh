#!/bin/bash
# Run billing cron (generate-invoices + dunning) via internal API.
# Install on GCE: chmod +x /opt/lte-pci-mapper/backend-services/scripts/cron-billing.sh
# Crontab (daily at 00:05 and 01:00):
#   5 0 * * * /opt/lte-pci-mapper/backend-services/scripts/cron-billing.sh
#   0 1 * * * /opt/lte-pci-mapper/backend-services/scripts/cron-billing.sh
# Requires INTERNAL_API_KEY in backend .env (same as apiProxy).

set -e
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:3001}"
INTERNAL_KEY="${INTERNAL_API_KEY}"
if [ -z "$INTERNAL_KEY" ]; then
  if [ -f "$(dirname "$0")/../../.env" ]; then
    source "$(dirname "$0")/../../.env" 2>/dev/null || true
    INTERNAL_KEY="${INTERNAL_API_KEY}"
  fi
fi
if [ -z "$INTERNAL_KEY" ]; then
  echo "INTERNAL_API_KEY not set. Set in .env or environment."
  exit 1
fi
curl -s -X POST "$BACKEND_URL/api/internal/cron/billing" \
  -H "Content-Type: application/json" \
  -H "x-internal-key: $INTERNAL_KEY" \
  | jq . 2>/dev/null || cat
