#!/bin/bash
# Setup HTTPS for HSS API using nginx and Let's Encrypt
# Run this on your server: 136.112.111.167

set -e

echo "🔐 Setting up HTTPS for HSS API..."

# Variables - CHANGE THESE!
DOMAIN="hss-api.yourdomain.com"  # You need a domain name pointing to 136.112.111.167
EMAIL="your-email@example.com"   # For Let's Encrypt notifications

# Install nginx and certbot
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# Create nginx configuration for HSS API
cat > /etc/nginx/sites-available/hss-api << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/hss-api /etc/nginx/sites-enabled/

# Test nginx configuration
nginx -t

# Restart nginx
systemctl restart nginx

# Get SSL certificate from Let's Encrypt
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL

# Open HTTPS port
ufw allow 443/tcp
ufw allow 80/tcp

echo ""
echo "✅ HTTPS setup complete!"
echo ""
echo "Your HSS API is now available at:"
echo "  https://$DOMAIN"
echo ""
echo "Update apphosting.yaml to use:"
echo "  VITE_HSS_API_URL: https://$DOMAIN"

