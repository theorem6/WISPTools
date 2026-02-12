#!/bin/bash
# Remove all billing cron entries and add one correct one
(crontab -l 2>/dev/null || true) | grep -v 'cron-billing' > /tmp/cron.tmp || true
echo '5 0 * * * /opt/lte-pci-mapper/backend-services/scripts/cron-billing.sh' >> /tmp/cron.tmp
crontab /tmp/cron.tmp
rm -f /tmp/cron.tmp
echo "Crontab:"
crontab -l
