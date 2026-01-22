#!/bin/bash
# Final fix for PCRF FreeDiameter config

echo "Fixing PCRF FreeDiameter Identity and Port..."

# Copy from HSS config as base
cp /etc/freeDiameter/hss.conf /etc/freeDiameter/pcrf.conf

# Change Port from 3868 to 3869
sed -i 's/^Port = 3868;/Port = 3869;/' /etc/freeDiameter/pcrf.conf

# Uncomment the Port line if it was commented
sed -i 's/^#Port = 3869;/Port = 3869;/' /etc/freeDiameter/pcrf.conf

# Verify changes
echo "Verifying config:"
grep -E "^Identity|^Port" /etc/freeDiameter/pcrf.conf

# Restart PCRF
systemctl restart open5gs-pcrfd
sleep 3

echo ""
echo "PCRF Status:"
systemctl is-active open5gs-pcrfd

echo ""
echo "Diameter Ports:"
ss -tlnp | grep 386

