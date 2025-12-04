#!/bin/bash
# Verify remote EPC agent is working correctly

REMOTE_HOST="10.0.25.134"
USERNAME="wisp"

echo "🔍 Verifying remote EPC agent status..."
echo ""

echo "1️⃣ Checking service status..."
ssh "$USERNAME@$REMOTE_HOST" "sudo systemctl status wisptools-checkin --no-pager -l | head -15"

echo ""
echo "2️⃣ Checking recent check-in logs..."
ssh "$USERNAME@$REMOTE_HOST" "tail -30 /var/log/wisptools-checkin.log"

echo ""
echo "3️⃣ Testing manual check-in..."
ssh "$USERNAME@$REMOTE_HOST" "sudo /opt/wisptools/epc-checkin-agent.sh once 2>&1 | tail -20"

echo ""
echo "✅ Verification complete!"


