#!/bin/bash
# Open5GS Performance Tuning Script
# Apply socket buffer optimization and service priority tuning to existing EPC installations
# Based on production tuning that eliminated UDP socket buffer overflows

set -e

echo "======================================"
echo "Open5GS Performance Tuning"
echo "======================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

echo "[1/4] Creating sysctl configuration for socket buffer tuning..."

# Create sysctl configuration for socket buffer tuning
cat > /etc/sysctl.d/99-open5gs.conf << 'SYSCTLEOF'
# Open5GS Performance Tuning: Socket Buffer Optimization for High-Throughput LTE Core
# Based on production tuning that eliminated UDP socket buffer overflows
# Date: December 2025

# Socket Buffer Sizes - 64MB/128MB max
net.core.rmem_max = 67108864
net.core.wmem_max = 134217728
net.core.rmem_default = 16777216
net.core.wmem_default = 16777216

# UDP Buffer Minimums
net.ipv4.udp_rmem_min = 131072
net.ipv4.udp_wmem_min = 262144

# UDP Memory (pages: min pressure max)
net.ipv4.udp_mem = 65536 131072 262144

# Backlog Queue (handle bursts)
net.core.netdev_max_backlog = 250000
net.core.netdev_budget = 600

# TCP Tuning
net.ipv4.tcp_rmem = 4096 87380 67108864
net.ipv4.tcp_wmem = 4096 65536 67108864
net.core.somaxconn = 65535

# Connection Handling
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15

# Required for GTP tunneling
net.ipv4.ip_forward = 1
SYSCTLEOF

# Apply sysctl settings immediately
sysctl -p /etc/sysctl.d/99-open5gs.conf
echo "✅ Socket buffer tuning applied"

echo ""
echo "[2/4] Configuring SGWU/UPF service priority..."

# Create systemd override for open5gs-sgwud service priority
mkdir -p /etc/systemd/system/open5gs-sgwud.service.d
cat > /etc/systemd/system/open5gs-sgwud.service.d/priority.conf << 'PRIORITYEOF'
[Service]
Nice=-10
CPUSchedulingPolicy=fifo
CPUSchedulingPriority=50
PRIORITYEOF

echo "✅ SGWU/UPF service priority configured"

echo ""
echo "[3/4] Creating GTP tunnel interface tuning service..."

# Create systemd service for GTP tunnel interface tuning
cat > /etc/systemd/system/open5gs-tuning.service << 'TUNINGEOFSERVICE'
[Unit]
Description=Open5GS Performance Tuning Service
After=network.target open5gs-upfd.service
Wants=open5gs-upfd.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c 'if ip link show ogstun >/dev/null 2>&1; then ip link set ogstun txqueuelen 10000; echo "GTP tunnel interface tuned"; else echo "Waiting for ogstun interface..."; sleep 5; ip link set ogstun txqueuelen 10000 || true; fi'
ExecStartPost=/bin/sleep 2
StandardOutput=journal
StandardError=journal
SyslogIdentifier=open5gs-tuning

[Install]
WantedBy=multi-user.target
TUNINGEOFSERVICE

systemctl daemon-reload
systemctl enable open5gs-tuning.service

echo "✅ GTP tunnel interface tuning service created"

echo ""
echo "[4/4] Applying tuning and restarting services..."

# Apply GTP tunnel tuning immediately if interface exists
if ip link show ogstun >/dev/null 2>&1; then
    ip link set ogstun txqueuelen 10000
    echo "✅ GTP tunnel interface tuned immediately"
else
    echo "⚠️  ogstun interface not found yet (will be tuned when UPF starts)"
fi

# Restart SGWU service to apply priority settings
if systemctl is-enabled open5gs-sgwud >/dev/null 2>&1; then
    echo "Restarting open5gs-sgwud to apply priority settings..."
    systemctl restart open5gs-sgwud
    echo "✅ SGWU service restarted with new priority"
fi

# Start tuning service
systemctl start open5gs-tuning 2>/dev/null || true

echo ""
echo "======================================"
echo "Performance Tuning Complete!"
echo "======================================"
echo ""
echo "Applied tuning:"
echo "  ✅ Socket buffers: 64MB receive / 128MB transmit max"
echo "  ✅ UDP buffer minimums configured"
echo "  ✅ SGWU/UPF service priority: Nice=-10, FIFO scheduling"
echo "  ✅ GTP tunnel queue length: 10000"
echo ""
echo "Current socket buffer settings:"
sysctl net.core.rmem_max net.core.wmem_max | sed 's/^/  /'
echo ""
echo "These settings will persist across reboots."
echo ""
echo "To verify tuning is working, check for UDP errors:"
echo "  cat /proc/net/snmp | grep -A1 '^Udp:'"
echo ""
echo "Expected: Zero new errors after tuning is applied"
echo ""

