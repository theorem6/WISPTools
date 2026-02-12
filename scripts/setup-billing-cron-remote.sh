#!/bin/bash
set -e
CRON_SCRIPT=""
for p in /opt/lte-pci-mapper/backend-services/scripts/cron-billing.sh \
         /opt/lte-pci-mapper/backend-services/backend-services-deploy/scripts/cron-billing.sh; do
  [ -f "$p" ] && { CRON_SCRIPT="$p"; break; }
done
if [ -z "$CRON_SCRIPT" ]; then
  echo "Error: cron-billing.sh not found"
  exit 1
fi
echo "Using: $CRON_SCRIPT"
chmod +x "$CRON_SCRIPT" 2>/dev/null || true
CRON_LINE="5 0 * * * $CRON_SCRIPT"
echo "Adding: $CRON_LINE"
{ crontab -l 2>/dev/null || true | grep -v 'cron-billing.sh' || true; echo "$CRON_LINE"; } | crontab -
echo "Done. Crontab:"
crontab -l 2>/dev/null || echo "(empty)"
