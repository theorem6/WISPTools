#!/bin/bash
# Fix nginx to properly route /api/ requests to backend on port 3001.
# Updates both hss-api and hss.wisptools.io so whichever is enabled gets the fix.
# Run on GCE server: sudo bash fix-nginx-api-routing.sh

set -e

echo "=== Fixing Nginx API Routing ==="

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo)"
    exit 1
fi

STAMP=$(date +%Y%m%d%H%M%S)
for name in hss-api hss.wisptools.io; do
  if [ -f /etc/nginx/sites-available/"$name" ]; then
    cp /etc/nginx/sites-available/"$name" /etc/nginx/sites-available/"$name".backup."$STAMP"
  fi
done

# Patch existing configs: ensure proxy_pass to backend has NO trailing slash (so path is preserved).
# "proxy_pass http://localhost:3001/" would strip /api/ and send wrong path; "proxy_pass http://localhost:3001" is correct.
for name in hss-api hss.wisptools.io; do
  if [ -f /etc/nginx/sites-available/"$name" ]; then
    if grep -q 'location /api/' /etc/nginx/sites-available/"$name"; then
      sed -i 's|proxy_pass http://localhost:3001/;|proxy_pass http://localhost:3001;|g' /etc/nginx/sites-available/"$name"
      sed -i 's|proxy_pass http://127.0.0.1:3001/;|proxy_pass http://127.0.0.1:3001;|g' /etc/nginx/sites-available/"$name"
      echo "Patched $name: removed trailing slash from proxy_pass in /api/ block"
    else
      echo "Inserting location /api/ block in $name (before location /)"
      # Insert location /api/ block before the first "location /" so path is preserved (no trailing slash on proxy_pass)
      f="/etc/nginx/sites-available/$name"
      awk '
        /^\s*location \/ \{\s*$/ && !done {
          print "    location /api/ {"
          print "        proxy_pass http://localhost:3001;"
          print "        proxy_http_version 1.1;"
          print "        proxy_set_header Host \\$host;"
          print "        proxy_set_header X-Real-IP \\$remote_addr;"
          print "        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;"
          print "        proxy_set_header X-Forwarded-Proto \\$scheme;"
          print "    }"
          print ""
          done=1
        }
        { print }
      ' "$f" > "$f.new" && mv "$f.new" "$f"
      echo "Inserted location /api/ block in $name"
    fi
  fi
done
rm -f /tmp/nginx-ssl-config.conf 2>/dev/null || true

# Test configuration
echo ""
echo "Testing nginx configuration..."
if nginx -t; then
    echo "✅ Configuration is valid"
else
    echo "❌ Configuration test failed - restoring backups"
    for name in hss-api hss.wisptools.io; do
      bak=$(find /etc/nginx/sites-available -name "${name}.backup.${STAMP}" -type f 2>/dev/null | head -1)
      [ -n "$bak" ] && mv "$bak" /etc/nginx/sites-available/"$name"
    done
    exit 1
fi

# Reload nginx
echo ""
echo "Reloading nginx..."
systemctl reload nginx

echo ""
echo "=== Complete ==="
echo "Test: curl -vI https://hss.wisptools.io/api/health"

