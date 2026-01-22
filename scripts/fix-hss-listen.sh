#!/bin/bash
# Fix HSS FreeDiameter config to listen on all interfaces

echo "Fixing HSS FreeDiameter configuration..."

# Backup first
cp /etc/freeDiameter/hss.conf /etc/freeDiameter/hss.conf.bak2

# Fix the ListenOn line to use 0.0.0.0 (all interfaces)
sed -i 's/^ListenOn = .*/ListenOn = "0.0.0.0";/' /etc/freeDiameter/hss.conf

echo "Updated ListenOn setting:"
grep "^ListenOn" /etc/freeDiameter/hss.conf

# Restart HSS
systemctl restart open5gs-hssd
sleep 2

echo ""
echo "HSS Status:"
systemctl is-active open5gs-hssd

echo ""
echo "HSS Diameter Port:"
ss -tlnp | grep 3868 || echo "Port 3868 not listening yet"

