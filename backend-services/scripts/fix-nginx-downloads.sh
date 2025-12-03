#!/bin/bash
# Fix nginx to serve /downloads/ directory on HTTPS
# Run on GCE server: sudo bash fix-nginx-downloads.sh

set -e

echo "=== Adding /downloads/ location to nginx hss-api config ==="

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo)"
    exit 1
fi

NGINX_CONFIG_FILE="/etc/nginx/sites-available/hss-api"

if [ ! -f "$NGINX_CONFIG_FILE" ]; then
    echo "ERROR: Nginx config file not found at $NGINX_CONFIG_FILE"
    exit 1
fi

echo "Nginx config file found: $NGINX_CONFIG_FILE"

# Backup current config
cp "$NGINX_CONFIG_FILE" "$NGINX_CONFIG_FILE.backup.before-downloads.$(date +%Y%m%d%H%M%S)"
echo "Backed up current config"

# Check if /downloads/ location already exists
if grep -q "location /downloads/" "$NGINX_CONFIG_FILE"; then
    echo "✅ /downloads/ location already exists in config"
    exit 0
fi

# Check if /api/ location exists - we'll add /downloads/ before it
if grep -q "location /api/" "$NGINX_CONFIG_FILE"; then
    echo "Adding /downloads/ location before /api/ location..."
    sed -i '/location \/api\//i\
    # Downloads directory - serve scripts and ISOs\
    location /downloads/ {\
        alias /var/www/html/downloads/;\
        autoindex on;\
        autoindex_exact_size off;\
        autoindex_localtime on;\
        client_max_body_size 2G;\
        sendfile on;\
    }\
\
' "$NGINX_CONFIG_FILE"
else
    echo "Adding /downloads/ location before catch-all location..."
    sed -i '/location \/ {/i\
    # Downloads directory - serve scripts and ISOs\
    location /downloads/ {\
        alias /var/www/html/downloads/;\
        autoindex on;\
        autoindex_exact_size off;\
        autoindex_localtime on;\
        client_max_body_size 2G;\
        sendfile on;\
    }\
\
' "$NGINX_CONFIG_FILE"
fi

# Test configuration
echo ""
echo "Testing nginx configuration..."
if nginx -t; then
    echo "✅ Configuration is valid"
else
    echo "❌ Configuration test failed - restoring backup"
    find /etc/nginx/sites-available -name "hss-api.backup.before-downloads.*" -type f | sort | tail -1 | xargs -I {} sh -c 'mv {} '"$NGINX_CONFIG_FILE"
    exit 1
fi

# Reload nginx
echo ""
echo "Reloading nginx..."
systemctl reload nginx

echo ""
echo "=== Complete ==="
echo "Test: curl -I https://hss.wisptools.io/downloads/scripts/epc-checkin-agent.sh"

