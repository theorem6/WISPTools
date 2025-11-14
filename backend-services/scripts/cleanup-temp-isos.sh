#!/bin/bash
# Cleanup script for temporary ISO and ZIP files
# Deletes files older than 1 hour from /tmp/iso-downloads
# This script should be run via cron every 15 minutes

TEMP_DIR="/tmp/iso-downloads"
LOG_FILE="/var/log/iso-cleanup.log"

# Create directory if it doesn't exist
mkdir -p "$TEMP_DIR"

# Find and delete files older than 1 hour (3600 seconds)
# This includes .iso, .zip, and .sha256 files
find "$TEMP_DIR" -type f \( -name "*.iso" -o -name "*.zip" -o -name "*.sha256" \) -mmin +60 -delete 2>/dev/null

# Log cleanup activity (only if files were found and deleted)
DELETED_COUNT=$(find "$TEMP_DIR" -type f \( -name "*.iso" -o -name "*.zip" -o -name "*.sha256" \) -mmin +60 2>/dev/null | wc -l)
if [ "$DELETED_COUNT" -gt 0 ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') - Cleaned up $DELETED_COUNT old ISO/ZIP files from $TEMP_DIR" >> "$LOG_FILE"
fi

# Also clean up empty directories
find "$TEMP_DIR" -type d -empty -delete 2>/dev/null

exit 0

