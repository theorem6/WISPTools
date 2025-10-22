# Diagnose backend API issue

Write-Host "=== Diagnosing Backend API ===" -ForegroundColor Cyan

Write-Host "`nChecking backend server structure..." -ForegroundColor Yellow

# Check what's in server.js
$command = @"
cd /opt/hss-api
echo "=== Files in /opt/hss-api ==="
ls -lh *.js | grep -E '(server|api)'
echo ""
echo "=== Content of server.js (first 100 lines) ==="
head -100 server.js
echo ""
echo "=== API registrations in server.js ==="
grep -n "require.*api" server.js || echo "No API requires found"
echo ""
echo "=== app.use registrations ==="
grep -n "app.use" server.js || echo "No app.use found"
echo ""
echo "=== Checking if user-tenant-api.js exists ==="
ls -lh user-tenant-api.js 2>&1
echo ""
echo "=== Current service status ==="
systemctl status hss-api --no-pager -l | tail -20
"@

ssh root@136.112.111.167 $command

Write-Host "`n=== Diagnosis Complete ===" -ForegroundColor Green

