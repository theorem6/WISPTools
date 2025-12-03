#!/bin/bash
# Fix nginx to properly route /api/ requests to backend on port 3001
# Run on GCE server: sudo bash fix-nginx-api-routing.sh

set -e

echo "=== Fixing Nginx API Routing ==="

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo)"
    exit 1
fi

# Backup hss-api config
if [ -f /etc/nginx/sites-available/hss-api ]; then
    cp /etc/nginx/sites-available/hss-api /etc/nginx/sites-available/hss-api.backup.$(date +%Y%m%d%H%M%S)
fi

# Update hss-api config to add /api/ location block
cat > /tmp/hss-api-updated.conf << 'EOF'
server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate /etc/letsencrypt/live/hss.wisptools.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hss.wisptools.io/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # API routes - MUST come before catch-all location
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;

        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Catch-all for other routes
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Install the updated config
mv /tmp/hss-api-updated.conf /etc/nginx/sites-available/hss-api

# Test configuration
echo ""
echo "Testing nginx configuration..."
if nginx -t; then
    echo "✅ Configuration is valid"
else
    echo "❌ Configuration test failed - restoring backup"
    find /etc/nginx/sites-available -name "hss-api.backup.*" -type f | sort | tail -1 | xargs -I {} sh -c 'mv {} /etc/nginx/sites-available/hss-api'
    exit 1
fi

# Reload nginx
echo ""
echo "Reloading nginx..."
systemctl reload nginx

echo ""
echo "=== Complete ==="
echo "Test: curl -vI https://hss.wisptools.io/api/health"

