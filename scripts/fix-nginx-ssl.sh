#!/bin/bash
# Script to fix nginx SSL configuration for ISO downloads
# Run this on the GCE server: sudo bash fix-nginx-ssl.sh

set -e

echo "=== Fixing Nginx SSL Configuration ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo bash fix-nginx-ssl.sh)"
    exit 1
fi

# Backup current config
if [ -f /etc/nginx/sites-enabled/default ]; then
    cp /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.backup.$(date +%Y%m%d%H%M%S)
    echo "Backed up current config"
fi

# Check if SSL cert exists
if [ ! -f /etc/letsencrypt/live/hss.wisptools.io/fullchain.pem ]; then
    echo "SSL certificate not found at /etc/letsencrypt/live/hss.wisptools.io/"
    echo "Please install certbot and obtain a certificate first:"
    echo "  sudo apt install certbot python3-certbot-nginx"
    echo "  sudo certbot --nginx -d hss.wisptools.io"
    exit 1
fi

# Create downloads directory if not exists
mkdir -p /var/www/html/downloads/isos
mkdir -p /var/www/html/apt

# Check if ISO exists
if [ ! -f /var/www/html/downloads/isos/wisptools-epc-generic-netinstall.iso ]; then
    echo "WARNING: ISO file not found at /var/www/html/downloads/isos/wisptools-epc-generic-netinstall.iso"
    echo "Please run the ISO build script first"
fi

# Copy new nginx config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/nginx-ssl-config.conf" ]; then
    cp "$SCRIPT_DIR/nginx-ssl-config.conf" /etc/nginx/sites-available/hss.wisptools.io
    rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/hss.wisptools.io /etc/nginx/sites-enabled/
    echo "Installed new nginx config"
else
    echo "Config file not found. Creating inline..."
    cat > /etc/nginx/sites-available/hss.wisptools.io << 'NGINXCONF'
# HTTP - Redirect to HTTPS
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name hss.wisptools.io _;
    return 301 https://$host$request_uri;
}

# HTTPS - Main server
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name hss.wisptools.io;

    ssl_certificate /etc/letsencrypt/live/hss.wisptools.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hss.wisptools.io/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    root /var/www/html;

    # ISO downloads - MUST come before API proxy
    location /downloads/ {
        alias /var/www/html/downloads/;
        autoindex on;
        sendfile on;
    }

    # APT repository
    location /apt/ {
        alias /var/www/html/apt/;
        autoindex on;
    }

    # Health check
    location /health {
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }

    # API proxy to Node.js
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Default - try static then proxy
    location / {
        try_files $uri $uri/ @backend;
    }
    
    location @backend {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
NGINXCONF
    rm -f /etc/nginx/sites-enabled/default
    ln -sf /etc/nginx/sites-available/hss.wisptools.io /etc/nginx/sites-enabled/
fi

# Test nginx config
echo "Testing nginx configuration..."
nginx -t

# Reload nginx
echo "Reloading nginx..."
systemctl reload nginx

echo ""
echo "=== Configuration Complete ==="
echo "Test the download URL:"
echo "  curl -I https://hss.wisptools.io/downloads/isos/wisptools-epc-generic-netinstall.iso"
echo ""

