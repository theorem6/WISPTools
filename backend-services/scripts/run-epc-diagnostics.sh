#!/bin/bash
# Comprehensive EPC Diagnostic and Update Script
# Runs all diagnostics and forces an update if needed

EPC_ID=${1:-"EPC-CB4C5042"}
DEVICE_CODE=${2:-"YALNTFQC"}
TENANT_ID=${3:-"690abdc14a6f067977986db3"}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=========================================="
echo "EPC Diagnostic and Update Script"
echo "=========================================="
echo "EPC ID: $EPC_ID"
echo "Device Code: $DEVICE_CODE"
echo "Tenant ID: $TENANT_ID"
echo ""

cd "$BASE_DIR" || exit 1

# Step 1: Check EPC Status
echo "Step 1: Checking EPC Status..."
echo "----------------------------------------"
node backend-services/scripts/check-epc-status.js "$EPC_ID" "$TENANT_ID"
echo ""

# Step 2: Check Server Logs
echo "Step 2: Checking Recent Server Logs..."
echo "----------------------------------------"
pm2 logs main-api --lines 30 --nostream | grep -E "EPC Check-in|Auto-Update|YALNTFQC|EPC-CB4C5042" | tail -20
echo ""

# Step 3: Force Update
echo "Step 3: Forcing Update..."
echo "----------------------------------------"
node backend-services/scripts/create-epc-update-command.js "$EPC_ID" "$TENANT_ID"
UPDATE_RESULT=$?
echo ""

# Step 4: Verify Update Command Created
echo "Step 4: Verifying Update Command..."
echo "----------------------------------------"
node backend-services/scripts/check-epc-status.js "$EPC_ID" "$TENANT_ID" | grep -A 10 "Queued Commands"
echo ""

# Step 5: Monitor Next Check-in (wait 70 seconds)
echo "Step 5: Waiting for next check-in (70 seconds)..."
echo "----------------------------------------"
for i in {70..1}; do
    echo -ne "\rWaiting $i seconds... (Press Ctrl+C to skip)"
    sleep 1
done
echo -e "\rChecking logs for update execution...              "
echo ""

# Step 6: Check logs for update execution
echo "Step 6: Checking for Update Execution..."
echo "----------------------------------------"
pm2 logs main-api --lines 50 --nostream | grep -E "EPC Check-in|Commands:" | tail -10
echo ""

echo "=========================================="
echo "Diagnostic Complete"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Check EPC device logs: tail -f /var/log/wisptools-checkin.log"
echo "2. Wait for next check-in cycle (60 seconds)"
echo "3. Verify metrics appear in monitoring page"
echo ""

