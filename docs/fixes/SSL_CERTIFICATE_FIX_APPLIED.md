# SSL Certificate Fix Applied

## Problem Identified

The remote EPC agent was getting SSL certificate errors:
```
SSL certificate problem: self-signed certificate
```

## Root Cause

Nginx was using a **self-signed certificate** at `/etc/ssl/certs/nginx-selfsigned.crt` instead of the valid **Let's Encrypt certificate** that exists at `/etc/letsencrypt/live/hss.wisptools.io/fullchain.pem`.

## Fix Applied

Updated the nginx configuration file `/etc/nginx/sites-available/hss-api` to use the Let's Encrypt certificate:

**Before:**
```nginx
ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt;
ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key;
```

**After:**
```nginx
ssl_certificate /etc/letsencrypt/live/hss.wisptools.io/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/hss.wisptools.io/privkey.pem;
```

## Verification

After the fix, remote agents should now be able to connect using proper SSL certificate validation. The Let's Encrypt certificate is trusted by default on modern systems.

## Next Steps

1. Remote EPC agents should now be able to connect without SSL errors
2. Test from remote EPC: `curl -v https://hss.wisptools.io/api/health`
3. Check-in agent should work without HTTP 000 errors (assuming network connectivity is OK)

## Files Modified

- `/etc/nginx/sites-available/hss-api` - Updated SSL certificate paths
- Backup created: `/etc/nginx/sites-available/hss-api.bak`

## Scripts Created

- `backend-services/scripts/fix-nginx-letsencrypt-cert.sh` - Script to fix SSL certificate configuration
- Can be run on server: `sudo bash fix-nginx-letsencrypt-cert.sh`

