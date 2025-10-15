#!/bin/bash
# Quick HTTPS fix for HSS API using nginx with self-signed certificate
# Run this on server: 136.112.111.167

echo "🔐 Setting up HTTPS proxy for HSS API..."

# Install nginx
apt-get update
apt-get install -y nginx

# Create nginx configuration
cat > /etc/nginx/sites-available/hss-api << 'EOF'
server {
    listen 443 ssl http2;
    server_name _;
    
    # Use Ubuntu's default self-signed certificate
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    
    # Strong SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Proxy to HSS API
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers
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
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/hss-api /etc/nginx/sites-enabled/hss-api

# Test nginx configuration
nginx -t

# Restart nginx
systemctl restart nginx
systemctl enable nginx

# Open HTTPS port in firewall
ufw allow 443/tcp

echo ""
echo "✅ HTTPS proxy setup complete!"
echo ""
echo "Your HSS API is now available at:"
echo "  https://136.112.111.167"
echo ""
echo "⚠️  NOTE: You'll see a certificate warning in the browser"
echo "    This is expected with self-signed certificates"
echo "    Click 'Advanced' → 'Proceed to 136.112.111.167'"
echo ""
echo "Update your apphosting.yaml to:"
echo "  VITE_HSS_API_URL: https://136.112.111.167"
echo ""
echo "Then commit and push to redeploy the frontend."

