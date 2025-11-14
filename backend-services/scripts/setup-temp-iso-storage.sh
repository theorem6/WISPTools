#!/bin/bash
# Setup script for temporary ISO storage
# Creates /tmp/iso-downloads directory and symlink for nginx
# This script should be run once during server setup

TEMP_DIR="/tmp/iso-downloads"
NGINX_DIR="/var/www/html/downloads/isos"

# Create temporary directory if it doesn't exist
mkdir -p "$TEMP_DIR"
chmod 777 "$TEMP_DIR"

# If nginx directory exists and is not a symlink, move its contents and create symlink
if [ -d "$NGINX_DIR" ] && [ ! -L "$NGINX_DIR" ]; then
  echo "Moving existing ISO files from $NGINX_DIR to $TEMP_DIR..."
  # Move any existing files (optional - can be skipped if directory is already empty)
  if [ "$(ls -A $NGINX_DIR 2>/dev/null)" ]; then
    mv "$NGINX_DIR"/* "$TEMP_DIR"/ 2>/dev/null || true
  fi
  # Remove old directory
  rm -rf "$NGINX_DIR"
fi

# Create symlink if it doesn't exist
if [ ! -L "$NGINX_DIR" ]; then
  ln -sf "$TEMP_DIR" "$NGINX_DIR"
  echo "Created symlink: $NGINX_DIR -> $TEMP_DIR"
else
  echo "Symlink already exists: $NGINX_DIR -> $TEMP_DIR"
fi

# Ensure nginx can read from the directory
chmod 755 "$TEMP_DIR" || true

echo "Temporary ISO storage setup complete"

