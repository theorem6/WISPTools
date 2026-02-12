#!/bin/bash
# Setup billing cron on GCE. Run on the backend server (e.g. via gcloud compute ssh).
# Usage: ./scripts/setup-billing-cron.sh
# See: docs/BILLING_CRON_AND_DUNNING_SCHEDULE.md

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CRON_SCRIPT="$(cd "${SCRIPT_DIR}/../backend-services/scripts" && pwd)/cron-billing.sh"
CRON_LINE="5 0 * * * $CRON_SCRIPT"

if [ ! -f "$CRON_SCRIPT" ]; then
  echo "Error: cron-billing.sh not found at $CRON_SCRIPT"
  exit 1
fi

# Ensure cron script is executable
chmod +x "$CRON_SCRIPT"

# Check if INTERNAL_API_KEY is available (in backend .env)
BACKEND_ENV="${SCRIPT_DIR}/../backend-services/.env"
if [ -f "$BACKEND_ENV" ]; then
  if grep -q "INTERNAL_API_KEY" "$BACKEND_ENV" 2>/dev/null; then
    echo "OK: INTERNAL_API_KEY found in backend .env"
  else
    echo "WARNING: INTERNAL_API_KEY not set in $BACKEND_ENV"
    echo "  Add it before the cron runs. Same value as apiProxy Cloud Function uses."
  fi
else
  echo "WARNING: Backend .env not found at $BACKEND_ENV"
fi

# Add or update crontab entry
if crontab -l 2>/dev/null | grep -q "cron-billing.sh"; then
  echo "Billing cron already in crontab. Updating..."
  (crontab -l 2>/dev/null | grep -v "cron-billing.sh"; echo "$CRON_LINE") | crontab -
else
  echo "Adding billing cron to crontab..."
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
fi

echo "Done. Crontab now:"
crontab -l | grep cron-billing || true
echo ""
echo "Cron runs daily at 00:05. To test manually: $CRON_SCRIPT"
