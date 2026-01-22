#!/bin/bash
# Fix nginx to use Let's Encrypt certificate instead of self-signed
# Run on GCE server: sudo bash fix-nginx-letsencrypt-cert.sh

set -e

echo "=== Fixing Nginx SSL Certificate ==="

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo)"
    exit 1
fi

CERT_PATH="/etc/letsencrypt/live/hss.wisptools.io/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/hss.wisptools.io/privkey.pem"

if [ ! -f "$CERT_PATH" ]; then
    echo "ERROR: Let's Encrypt certificate not found at $CERT_PATH"
    exit 1
fi

echo "Let's Encrypt certificate found"

# Update hss-api config
if [ -f /etc/nginx/sites-available/hss-api ]; then
    echo "Updating hss-api config..."
    cp /etc/nginx/sites-available/hss-api /etc/nginx/sites-available/hss-api.backup.$(date +%Y%m%d%H%M%S)
    
    # Replace self-signed certificate paths with Let's Encrypt
    sed -i "s|ssl_certificate.*nginx-selfsigned.crt;|ssl_certificate $CERT_PATH;|" /etc/nginx/sites-available/hss-api
    sed -i "s|ssl_certificate_key.*nginx-selfsigned.key;|ssl_certificate_key $KEY_PATH;|" /etc/nginx/sites-available/hss-api
    
    echo "✅ Updated hss-api config"
fi

# Update hss.wisptools.io config if it exists
if [ -f /etc/nginx/sites-available/hss.wisptools.io ]; then
    echo "Checking hss.wisptools.io config..."
    if grep -q "nginx-selfsigned" /etc/nginx/sites-available/hss.wisptools.io 2>/dev/null; then
        cp /etc/nginx/sites-available/hss.wisptools.io /etc/nginx/sites-available/hss.wisptools.io.backup.$(date +%Y%m%d%H%M%S)
        sed -i "s|ssl_certificate.*nginx-selfsigned.crt;|ssl_certificate $CERT_PATH;|" /etc/nginx/sites-available/hss.wisptools.io
        sed -i "s|ssl_certificate_key.*nginx-selfsigned.key;|ssl_certificate_key $KEY_PATH;|" /etc/nginx/sites-available/hss.wisptools.io
        echo "✅ Updated hss.wisptools.io config"
    fi
fi

# Test configuration
echo ""
echo "Testing nginx configuration..."
if nginx -t; then
    echo "✅ Configuration is valid"
else
    echo "❌ Configuration test failed - restoring backups"
    find /etc/nginx/sites-available -name "*.backup.*" -type f | head -1 | xargs -I {} sh -c 'mv {} $(echo {} | sed "s/.backup.*//")'
    exit 1
fi

# Reload nginx
echo ""
echo "Reloading nginx..."
systemctl reload nginx

echo ""
echo "=== Complete ==="
echo "Test: curl -vI https://hss.wisptools.io/api/health"

