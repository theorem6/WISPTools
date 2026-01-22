#!/bin/bash
# Script to fix nginx to use Let's Encrypt certificate instead of self-signed
# Run this on the GCE server: sudo bash fix-nginx-ssl-certificate.sh

set -e

echo "=== Fixing Nginx SSL Certificate Configuration ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo bash fix-nginx-ssl-certificate.sh)"
    exit 1
fi

# Check if Let's Encrypt certificate exists
if [ ! -f /etc/letsencrypt/live/hss.wisptools.io/fullchain.pem ]; then
    echo "ERROR: Let's Encrypt certificate not found at /etc/letsencrypt/live/hss.wisptools.io/"
    echo "Please obtain a certificate first:"
    echo "  sudo certbot --nginx -d hss.wisptools.io"
    exit 1
fi

echo "Let's Encrypt certificate found: /etc/letsencrypt/live/hss.wisptools.io/fullchain.pem"

# Find all nginx config files that use SSL
echo ""
echo "Checking nginx SSL configurations..."

# Update hss-api config if it exists
if [ -f /etc/nginx/sites-enabled/hss-api ]; then
    echo "Found /etc/nginx/sites-enabled/hss-api - updating SSL certificate..."
    sed -i.bak \
        -e 's|ssl_certificate.*nginx-selfsigned.crt;|ssl_certificate /etc/letsencrypt/live/hss.wisptools.io/fullchain.pem;|' \
        -e 's|ssl_certificate_key.*nginx-selfsigned.key;|ssl_certificate_key /etc/letsencrypt/live/hss.wisptools.io/privkey.pem;|' \
        /etc/nginx/sites-enabled/hss-api
    echo "Updated hss-api config"
fi

# Check if hss.wisptools.io config exists
if [ -f /etc/nginx/sites-available/hss.wisptools.io ]; then
    echo "Found /etc/nginx/sites-available/hss.wisptools.io - checking SSL certificate..."
    if ! grep -q "ssl_certificate.*letsencrypt" /etc/nginx/sites-available/hss.wisptools.io 2>/dev/null; then
        echo "Updating hss.wisptools.io config to use Let's Encrypt certificate..."
        sed -i.bak \
            -e 's|ssl_certificate.*nginx-selfsigned.crt;|ssl_certificate /etc/letsencrypt/live/hss.wisptools.io/fullchain.pem;|' \
            -e 's|ssl_certificate_key.*nginx-selfsigned.key;|ssl_certificate_key /etc/letsencrypt/live/hss.wisptools.io/privkey.pem;|' \
            /etc/nginx/sites-available/hss.wisptools.io
        echo "Updated hss.wisptools.io config"
    else
        echo "hss.wisptools.io already uses Let's Encrypt certificate"
    fi
fi

# Check default config
if [ -f /etc/nginx/sites-enabled/default ]; then
    if grep -q "ssl_certificate.*nginx-selfsigned" /etc/nginx/sites-enabled/default 2>/dev/null; then
        echo "WARNING: Default config still uses self-signed certificate"
        echo "Consider updating or disabling default config"
    fi
fi

# Test nginx configuration
echo ""
echo "Testing nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration test failed!"
    echo "Restoring backup files..."
    find /etc/nginx -name "*.bak" -exec sh -c 'mv "$1" "${1%.bak}"' _ {} \;
    exit 1
fi

# Reload nginx
echo ""
echo "Reloading nginx..."
systemctl reload nginx

echo ""
echo "=== Configuration Complete ==="
echo ""
echo "Test the SSL certificate:"
echo "  curl -vI https://hss.wisptools.io/api/health"
echo ""
echo "Verify certificate:"
echo "  openssl s_client -connect hss.wisptools.io:443 -servername hss.wisptools.io < /dev/null 2>&1 | grep -A 5 'Certificate chain'"

