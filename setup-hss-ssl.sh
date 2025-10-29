#!/bin/bash

# Setup SSL for hss.wisptools.io using Let's Encrypt certbot
# This script configures nginx with SSL/TLS for the hss.wisptools.io domain

set -e

echo "🔐 Setting up SSL for hss.wisptools.io..."

# Install nginx if not already installed
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing nginx..."
    apt-get update
    apt-get install -y nginx certbot python3-certbot-nginx
fi

# Configure nginx for hss.wisptools.io
echo "⚙️  Configuring nginx..."
cat > /etc/nginx/sites-available/hss.wisptools.io << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name hss.wisptools.io;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

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

# Create directory for acme challenge
mkdir -p /var/www/html/.well-known/acme-challenge

# Enable site
ln -sf /etc/nginx/sites-available/hss.wisptools.io /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Reload nginx
systemctl reload nginx

# Request SSL certificate with certbot
echo "🔒 Requesting SSL certificate from Let's Encrypt..."
certbot --nginx -d hss.wisptools.io \
    --non-interactive \
    --agree-tos \
    --email admin@wisptools.io \
    --redirect

# Setup auto-renewal if not already configured
if ! systemctl is-enabled certbot.timer &> /dev/null; then
    systemctl enable certbot.timer
fi

echo "✅ SSL setup complete!"
echo "Your backend is now available at: https://hss.wisptools.io"

