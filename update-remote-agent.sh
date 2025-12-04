#!/bin/bash
# Update remote EPC agent script

REMOTE_HOST="10.0.25.134"
USERNAME="wisp"
PASSWORD="wisp123"

echo "🔧 Updating EPC check-in agent on $USERNAME@$REMOTE_HOST..."

# Check if sshpass is available
if ! command -v sshpass &> /dev/null; then
    echo "⚠️  sshpass not found. Installing..."
    # Try to install (Ubuntu/Debian)
    sudo apt-get update && sudo apt-get install -y sshpass 2>/dev/null || {
        echo "❌ Could not install sshpass. Please install manually:"
        echo "   sudo apt-get install sshpass"
        exit 1
    }
fi

# Update the agent script
echo "📥 Downloading updated agent script..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    "$USERNAME@$REMOTE_HOST" \
    "sudo curl -fsSL https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh -o /opt/wisptools/epc-checkin-agent.sh && \
     sudo chmod +x /opt/wisptools/epc-checkin-agent.sh && \
     echo '✅ Script updated successfully' && \
     ls -lh /opt/wisptools/epc-checkin-agent.sh"

if [ $? -eq 0 ]; then
    echo ""
    echo "🔄 Restarting check-in service..."
    sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$USERNAME@$REMOTE_HOST" \
        "sudo systemctl restart wisptools-checkin && \
         sudo systemctl status wisptools-checkin --no-pager -l | head -15"
    
    echo ""
    echo "📋 Checking recent logs..."
    sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$USERNAME@$REMOTE_HOST" \
        "tail -20 /var/log/wisptools-checkin.log"
    
    echo ""
    echo "✅ Update complete! Monitoring check-in status..."
    echo "   Run 'tail -f /var/log/wisptools-checkin.log' on the remote device to monitor"
else
    echo "❌ Failed to update agent script"
    exit 1
fi


