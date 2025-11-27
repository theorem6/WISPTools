#!/bin/bash
# Cleanup script for remote EPC devices
# Removes unnecessary packages and optimizes for Open5GS + SNMP only

set -e

echo "========================================"
echo "WISPTools EPC Cleanup Script"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo $0"
    exit 1
fi

echo "[1/6] Stopping unnecessary services..."
# Stop services before removing
systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true

echo "[2/6] Removing unnecessary packages..."
# Remove packages not needed for EPC/SNMP operation
apt-get remove --purge -y \
    nginx nginx-common nginx-core \
    python3-pip \
    vim vim-common vim-tiny \
    build-essential gcc g++ make \
    cmake \
    git \
    libsnmp-dev \
    snmp-mibs-downloader \
    mongodb-org-shell \
    pciutils usbutils \
    less \
    2>/dev/null || true

# Remove any orphaned packages
apt-get autoremove --purge -y 2>/dev/null || true

echo "[3/6] Cleaning apt cache..."
apt-get clean
rm -rf /var/lib/apt/lists/*
apt-get update -qq

echo "[4/6] Cleaning log files..."
# Truncate logs instead of deleting (keeps log rotation working)
find /var/log -type f -name "*.log" -exec truncate -s 0 {} \; 2>/dev/null || true
find /var/log -type f -name "*.gz" -delete 2>/dev/null || true
find /var/log -type f -name "*.1" -delete 2>/dev/null || true
journalctl --vacuum-time=1d 2>/dev/null || true

echo "[5/6] Cleaning temp files..."
rm -rf /tmp/* /var/tmp/* 2>/dev/null || true
rm -rf /root/.cache/* 2>/dev/null || true

echo "[6/6] Verifying essential services..."
# Check Open5GS services
echo ""
echo "Open5GS Services:"
for svc in open5gs-mmed open5gs-hssd open5gs-sgwcd open5gs-sgwud open5gs-smfd open5gs-upfd; do
    STATUS=$(systemctl is-active $svc 2>/dev/null || echo "not installed")
    printf "  %-20s %s\n" "$svc:" "$STATUS"
done

echo ""
echo "SNMP Service:"
STATUS=$(systemctl is-active snmpd 2>/dev/null || echo "not installed")
printf "  %-20s %s\n" "snmpd:" "$STATUS"

echo ""
echo "SSH Service:"
STATUS=$(systemctl is-active sshd 2>/dev/null || echo "not installed")
printf "  %-20s %s\n" "sshd:" "$STATUS"

# Show disk usage
echo ""
echo "Disk Usage:"
df -h / | tail -1

echo ""
echo "========================================"
echo "Cleanup complete!"
echo "========================================"

