# Firewall Configuration Check

## Current Firewall Rules

### Port 3001 (Main API)
✅ **allow-hss-api-3001**
- Port: 3001
- Direction: INGRESS
- Source: `0.0.0.0/0` (all IPs - including Firebase Functions)
- Target Tags: **NONE** (applies to all instances)
- Status: ✅ Active

### Port 3000 (GenieACS UI / Alternative API)
✅ **allow-acs-all** (targets `acs-hss-server` tag)
- Ports: 80, 443, 7547, 3868, **3000**, 7557, 3333
- Direction: INGRESS
- Source: `0.0.0.0/0`
- Target Tags: `acs-hss-server` ✅ (matches instance)
- Status: ✅ Active

✅ **allow-hss-api** (targets `acs-server` tag - may not match)
- Port: 3000
- Direction: INGRESS  
- Source: `0.0.0.0/0`
- Target Tags: `acs-server` ⚠️ (instance has `acs-hss-server` tag)
- Status: Active but may not apply to this instance

### Port 3002 (EPC/ISO API)
✅ **allow-hss-api-3002**
- Port: 3002
- Direction: INGRESS
- Source: `0.0.0.0/0`
- Target Tags: **NONE** (applies to all instances)
- Status: ✅ Active

## Instance Configuration

- **Instance Name**: `acs-hss-server`
- **Zone**: `us-central1-a`
- **External IP**: `136.112.111.167`
- **Internal IP**: `10.128.0.4`
- **Tags**: `acs-hss-server`, `https-server`

## Services Listening

```
Port 3001: ✅ Listening (node process 2726098)
Port 3002: ✅ Listening (node process 3870360)
Port 3000: ❓ Not shown in netstat (may be listening on IPv6 only)
```

## Firebase Functions Access

Firebase Functions in `us-central1` should be able to access:
- ✅ Port 3001 - `0.0.0.0/0` (open to all)
- ✅ Port 3002 - `0.0.0.0/0` (open to all)  
- ✅ Port 3000 - Covered by `allow-acs-all` rule

## Summary

✅ **All required ports are open**
- Port 3001 is accessible from anywhere (including Firebase Functions)
- Port 3000 is accessible via `allow-acs-all` rule
- Port 3002 is accessible from anywhere

**No firewall changes needed** - the rules are correctly configured.

## Potential Issues

1. **Service Status**: The systemd service shows "activating (auto-restart)" but health endpoint responds
   - Multiple node processes may be running
   - One process is successfully serving on port 3001

2. **Import Path**: Customer API still uses `../models/customer` instead of `./customer-schema`
   - But service is working, so may not be critical
   - Or a different server instance is handling requests

## Recommendations

1. ✅ Firewall is properly configured - no changes needed
2. ⚠️ Check which process is actually serving on port 3001
3. ⚠️ Verify customer API import path matches server structure
4. ✅ Port 3001 is accessible from Firebase Functions (no firewall block)

The 500 errors are likely **not firewall-related** but rather:
- Backend application errors
- Database connection issues  
- Missing/invalid data validation
- Code path issues

The enhanced error logging should now reveal the actual cause.

