#!/bin/bash
# Install Open5GS on remote EPC device

set -e

echo "======================================"
echo "Installing Open5GS EPC Core"
echo "======================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo $0"
    exit 1
fi

echo "[1/4] Adding Open5GS repository..."
echo "deb [trusted=yes] https://download.opensuse.org/repositories/home:/acetcom:/open5gs:/latest/Debian_12/ ./" > /etc/apt/sources.list.d/open5gs.list

echo "[2/4] Updating package lists..."
apt-get update -qq

echo "[3/4] Installing Open5GS..."
apt-get install -y --no-install-recommends open5gs

echo "[4/4] Starting Open5GS services..."
for svc in open5gs-mmed open5gs-hssd open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd open5gs-pcrfd; do
    systemctl enable $svc 2>/dev/null || true
    systemctl start $svc 2>/dev/null || true
done

echo ""
echo "Open5GS Service Status:"
for svc in open5gs-mmed open5gs-hssd open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
    STATUS=$(systemctl is-active $svc 2>/dev/null || echo "failed")
    printf "  %-20s %s\n" "$svc:" "$STATUS"
done

echo ""
echo "======================================"
echo "Open5GS installation complete!"
echo "======================================"

