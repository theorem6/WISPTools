#!/bin/bash
# Aggressively kill all processes on port 3000

echo "🔥 Force killing all processes on port 3000..."
echo "=============================================="

# Stop systemd service
systemctl stop hss-api 2>/dev/null
sleep 1

# Method 1: Kill by port
echo "Method 1: Killing by port..."
fuser -k 3000/tcp 2>/dev/null
sleep 1

# Method 2: Kill by lsof
echo "Method 2: Killing via lsof..."
lsof -ti:3000 | xargs -r kill -9 2>/dev/null
sleep 1

# Method 3: Kill all node processes
echo "Method 3: Killing all node in /opt/hss-api..."
ps aux | grep "[/]opt/hss-api" | awk '{print $2}' | xargs -r kill -9 2>/dev/null
sleep 1

# Method 4: Killall node (nuclear option - may affect GenieACS)
echo "Method 4: Finding any remaining node on port 3000..."
if lsof -ti:3000 >/dev/null 2>&1; then
    PID=$(lsof -ti:3000)
    echo "Found process $PID still on port 3000"
    kill -9 $PID 2>/dev/null
    sleep 2
fi

# Final check
echo ""
echo "Final verification..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Port 3000 STILL in use:"
    lsof -i :3000
    echo ""
    echo "Trying one more time with extreme force..."
    pkill -9 node
    sleep 3
    
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ Failed to free port. Manual intervention needed."
        echo "Run: kill -9 $(lsof -ti:3000)"
        exit 1
    fi
fi

echo "✅ Port 3000 is now free!"
echo ""
echo "Starting service..."
systemctl start hss-api
sleep 5

if systemctl is-active --quiet hss-api; then
    echo "✅ Service started successfully!"
    curl -s -H "X-Tenant-ID: test" http://localhost:3000/health
    echo ""
else
    echo "❌ Service failed to start. Check logs:"
    journalctl -u hss-api -n 20 --no-pager
    exit 1
fi

