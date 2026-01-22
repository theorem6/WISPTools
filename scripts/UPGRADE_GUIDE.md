# Improved Ping & SNMP Monitoring Upgrade Guide

This guide explains how to upgrade from the current monitoring scripts to the improved versions using production-grade npm packages.

## Overview

The improved scripts use well-maintained npm packages:
- **`ping`** (v0.4.4) - Reliable ICMP ping library with cross-platform support
- **`net-snmp`** (v3.26.0) - Comprehensive SNMP library supporting v1, v2c, and v3

## Files

1. **`IMPROVED_PING_MONITOR.js`** - Improved ping monitoring using `ping` npm package
2. **`IMPROVED_SNMP_MONITOR.js`** - Improved SNMP monitoring using `net-snmp` npm package

## Dependencies

Both packages are already in `package.json`:
```json
{
  "dependencies": {
    "net-snmp": "^3.26.0",
    "ping": "^0.4.4"
  }
}
```

Ensure dependencies are installed:
```bash
cd backend-services
npm install
```

## Advantages

### Ping Monitoring (`IMPROVED_PING_MONITOR.js`)

✅ **Reliable Parsing**: Uses npm package instead of parsing system command output
✅ **Cross-platform**: Works consistently across Linux, Windows, macOS
✅ **Better Error Handling**: Proper promise-based async/await
✅ **Accurate Metrics**: Returns min/avg/max and packet loss directly
✅ **No Command Parsing**: No need to handle different ping output formats

### SNMP Monitoring (`IMPROVED_SNMP_MONITOR.js`)

✅ **Production-Ready**: Uses well-maintained `net-snmp` library
✅ **Multiple SNMP Versions**: Supports SNMPv1, v2c, and v3
✅ **Bulk Operations**: Supports getBulk for efficient table queries
✅ **Better Error Handling**: Proper error codes and messages
✅ **Type Safety**: Handles OID formats correctly
✅ **Comprehensive Metrics**: System, CPU, Memory, Disk, Network interfaces

## Migration Steps

### Option 1: Replace Existing Scripts (Recommended)

1. **Backup existing scripts**:
```bash
cd backend-services/scripts
cp epc-ping-monitor.js epc-ping-monitor.js.backup
cp epc-snmp-discovery.js epc-snmp-discovery.js.backup
```

2. **Replace with improved versions**:
```bash
mv IMPROVED_PING_MONITOR.js epc-ping-monitor.js
mv IMPROVED_SNMP_MONITOR.js epc-snmp-discovery.js
```

3. **Update check-in agent** to use the same command structure (they're compatible)

### Option 2: Side-by-Side Testing

1. **Test improved scripts alongside existing ones**:
```bash
# Test ping
node IMPROVED_PING_MONITOR.js cycle

# Test SNMP (direct query)
node IMPROVED_SNMP_MONITOR.js <device_id> <ip> <community>

# Test SNMP cycle
node IMPROVED_SNMP_MONITOR.js cycle
```

2. **Compare results** with existing scripts
3. **Switch over** once verified

## Usage Examples

### Ping Monitoring

```bash
# Run ping cycle (pings all devices from backend)
node IMPROVED_PING_MONITOR.js cycle

# In code
const { pingDevice } = require('./IMPROVED_PING_MONITOR');
const result = await pingDevice('192.168.1.1', { timeout: 3 });
console.log(result);
// {
//   success: true,
//   response_time_ms: 12.5,
//   error: null,
//   packet_loss: 0,
//   min: 10.2,
//   max: 15.3,
//   avg: 12.5
// }
```

### SNMP Monitoring

```bash
# Query single device
node IMPROVED_SNMP_MONITOR.js <device_id> <ip> <community>

# Run SNMP cycle (queries all devices from backend)
node IMPROVED_SNMP_MONITOR.js cycle

# In code
const { getAllMetrics } = require('./IMPROVED_SNMP_MONITOR');
const metrics = await getAllMetrics('192.168.1.1', 'public');
console.log(metrics);
// {
//   success: true,
//   error: null,
//   system: { sys_name: 'router', uptime_seconds: 86400, ... },
//   resources: { cpu_percent: 15.5, memory_percent: 45.2, ... },
//   network: { interface_name: 'eth0', interface_speed: 1000000000, ... }
// }
```

## Configuration

Both scripts use the same environment variables and config files as existing scripts:

- `CENTRAL_SERVER` - Backend server (default: `hss.wisptools.io`)
- `CONFIG_DIR` - Config directory (default: `/etc/wisptools`)
- `LOG_FILE` - Log file path (default: `/var/log/wisptools-*-monitor.log`)

## Deployment to Remote EPCs

The improved scripts will be automatically deployed to remote EPCs via the check-in agent's auto-update mechanism, just like the existing scripts.

## Testing Checklist

- [ ] Install dependencies (`npm install`)
- [ ] Test ping monitoring with known-good IPs
- [ ] Test SNMP monitoring with known-good SNMP devices
- [ ] Verify metrics are sent to backend correctly
- [ ] Check backend logs for successful metric storage
- [ ] Verify graphs display correctly in frontend

## Rollback

If issues occur, restore from backup:
```bash
mv epc-ping-monitor.js.backup epc-ping-monitor.js
mv epc-snmp-discovery.js.backup epc-snmp-discovery.js
```

## Support

Both npm packages are actively maintained:
- `ping`: https://www.npmjs.com/package/ping
- `net-snmp`: https://www.npmjs.com/package/net-snmp

For issues, check:
1. Package documentation
2. GitHub issues for each package
3. Backend logs for error messages

