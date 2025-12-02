#!/bin/bash
# Test if the backend server can start without errors

cd /opt/lte-pci-mapper/backend-services

echo "Testing server startup..."
timeout 10 node server.js 2>&1 | head -50 || echo "Server failed to start or timed out"

echo ""
echo "Checking for syntax errors in route files..."
for file in routes/**/*.js; do
  if node -c "$file" 2>&1 | grep -q "SyntaxError"; then
    echo "❌ Syntax error in: $file"
    node -c "$file"
  fi
done

