# Nginx 502 Bad Gateway Fix Applied

## Problem

Remote EPC agents were getting 502 Bad Gateway errors:
```
ERROR: Check-in failed - Backend returned HTML error page (HTTP 502)
```

## Root Cause

Nginx was proxying to `localhost:3000` but the backend service is running on port `3001`.

The nginx configuration at `/etc/nginx/sites-available/hss-api` had:
```nginx
proxy_pass http://localhost:3000;
```

But the backend (PM2 service) is actually running on port 3001.

## Fix Applied

1. **Updated proxy_pass port**: Changed from port 3000 to port 3001
2. **Added explicit /api/ location block**: Ensures API routes are properly routed

## Changes Made

Updated `/etc/nginx/sites-available/hss-api`:
- Changed `proxy_pass http://localhost:3000;` to `proxy_pass http://localhost:3001;`
- Added explicit `location /api/` block for proper API routing

## Verification

After the fix:
- ✅ Backend responds correctly: `{"error":"device_code is required"}` (expected)
- ✅ Nginx configuration is valid
- ✅ Nginx reloaded successfully

## Next Steps

Remote EPC agents should now be able to check in successfully. The 502 errors should be resolved.

Test from remote EPC:
```bash
curl -v https://hss.wisptools.io/api/epc/checkin
```

## Files Modified

- `/etc/nginx/sites-available/hss-api` - Updated proxy_pass port to 3001
- Backup created: `/etc/nginx/sites-available/hss-api.backup.before-api-fix`

## Related Fixes

- SSL Certificate: Fixed to use Let's Encrypt certificate (not self-signed)
- Port Configuration: Fixed to proxy to correct backend port (3001)

