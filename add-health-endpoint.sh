#!/bin/bash
# Add health check endpoint to HSS API
# Run this on your server: 136.112.111.167

echo "🏥 Adding health check endpoint to HSS API..."

# Add health endpoint before the "Start server" line
sed -i '/app.listen(PORT/i \
// Health check endpoint for load balancer\
app.get("/health", (req, res) => {\
  res.json({ status: "ok", timestamp: new Date().toISOString() });\
});\
' /opt/hss-api/server.js

# Restart the service
systemctl restart hss-api.service

# Test the health endpoint
sleep 2
echo ""
echo "Testing health endpoint:"
curl http://localhost:3000/health

echo ""
echo "✅ Health endpoint added!"

