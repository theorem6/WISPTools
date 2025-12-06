#!/bin/bash
# Setup NTP and Timezone for EPC Device
# Usage: sudo bash setup-ntp-timezone.sh [timezone]
# Example: sudo bash setup-ntp-timezone.sh America/Chicago

set -e

TIMEZONE="${1:-America/Chicago}"  # Default to Central Time US

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [NTP-TZ-SETUP] $1"
}

log "========================================="
log "Configuring NTP and Timezone"
log "========================================="

# Install required packages
log "Installing NTP and timezone packages..."
apt-get update -qq
apt-get install -y ntp ntpdate tzdata >/dev/null 2>&1 || {
    log "ERROR: Failed to install NTP packages"
    exit 1
}

# Configure NTP servers
log "Configuring NTP servers..."
cat > /etc/ntp.conf << 'NTPEOF'
# NTP Configuration for EPC Device
# Use pool.ntp.org and Google's NTP servers for reliability

# Default pool servers
server 0.pool.ntp.org iburst
server 1.pool.ntp.org iburst
server 2.pool.ntp.org iburst
server 3.pool.ntp.org iburst

# Google's public NTP servers (backup)
server time.google.com iburst
server time1.google.com iburst

# Restrict access
restrict default kod nomodify notrap nopeer noquery
restrict -6 default kod nomodify notrap nopeer noquery

# Allow localhost
restrict 127.0.0.1
restrict -6 ::1

# Logging
logfile /var/log/ntp.log
driftfile /var/lib/ntp/ntp.drift
NTPEOF

# Set timezone
log "Setting timezone to: $TIMEZONE"
if [ -f "/usr/share/zoneinfo/$TIMEZONE" ]; then
    timedatectl set-timezone "$TIMEZONE" || {
        ln -sf "/usr/share/zoneinfo/$TIMEZONE" /etc/localtime
        echo "$TIMEZONE" > /etc/timezone
        dpkg-reconfigure -f noninteractive tzdata >/dev/null 2>&1 || true
    }
    log "✅ Timezone set to: $TIMEZONE"
else
    log "ERROR: Invalid timezone: $TIMEZONE"
    log "Available US timezones:"
    log "  - America/Chicago (Central Time)"
    log "  - America/New_York (Eastern Time)"
    log "  - America/Denver (Mountain Time)"
    log "  - America/Los_Angeles (Pacific Time)"
    exit 1
fi

# Enable and start NTP
log "Enabling NTP synchronization..."
timedatectl set-ntp true || {
    systemctl enable ntp.service 2>/dev/null || systemctl enable systemd-timesyncd.service
    systemctl start ntp.service 2>/dev/null || systemctl start systemd-timesyncd.service
}

# Sync time immediately
log "Synchronizing time with NTP servers..."
if command -v ntpdate >/dev/null 2>&1; then
    ntpdate -s 0.pool.ntp.org >/dev/null 2>&1 || true
fi

# Force sync with systemd-timesyncd if available
if systemctl is-active systemd-timesyncd.service >/dev/null 2>&1; then
    systemctl restart systemd-timesyncd.service
fi

# Verify configuration
log "Verifying configuration..."
CURRENT_TZ=$(timedatectl show --property=Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo "unknown")
CURRENT_TIME=$(date)
NTP_STATUS=$(timedatectl show --property=NTPSynchronized --value 2>/dev/null || echo "unknown")

log "Current timezone: $CURRENT_TZ"
log "Current time: $CURRENT_TIME"
log "NTP synchronized: $NTP_STATUS"

log "========================================="
log "NTP and timezone configuration complete"
log "========================================="

