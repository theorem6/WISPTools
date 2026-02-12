---
title: EPC Auto-Update System
description: How the EPC auto-update system deploys script updates to remote EPC devices.
---

# EPC Auto-Update System

## Overview

The EPC auto-update system automatically deploys script updates to remote EPC devices during their check-in process. This ensures all EPCs stay up-to-date with the latest monitoring and management scripts without manual intervention.

## How It Works

### 1. Script Deployment to Downloads Directory

When scripts are updated in the repository, they must be deployed to `/var/www/html/downloads/scripts/` to be available for download:

```bash
# Deploy all scripts
sudo bash /opt/lte-pci-mapper/backend-services/scripts/deploy-scripts-to-downloads.sh
```

**Scripts Deployed:**
- `epc-checkin-agent.sh` - Main check-in agent
- `epc-snmp-discovery.sh` - SNMP discovery (bash version)
- `epc-snmp-discovery.js` - SNMP discovery (Node.js version)
- `epc-ping-monitor.js` - Ping monitoring script

### 2. Check-In Process

During each check-in (every 10 minutes), the EPC:

1. **Reports Script Versions**: Sends SHA256 hashes of all installed scripts
2. **Receives Update Check**: Backend compares reported hashes with server hashes
3. **Gets Update Command**: If hashes differ, receives an `update_scripts` command
4. **Executes Update**: Downloads updated scripts from git repository
5. **Restarts Agent**: Restarts check-in service to use new scripts

### 3. Update Detection

The backend uses `epc-auto-update.js` to:

- Calculate SHA256 hashes of scripts in `/var/www/html/downloads/scripts/`
- Compare with hashes reported by EPC
- Generate update commands for scripts with mismatched hashes
- Create versioned update commands to prevent duplicates

### 4. Update Command Execution

When an EPC receives an update command:

1. **Git Pull**: Updates local git repository (sparse checkout)
2. **Copy Scripts**: Copies updated scripts to `/opt/wisptools/`
3. **Set Permissions**: Makes scripts executable
4. **Restart Service**: Restarts `wisptools-checkin` service

## Scripts Monitored

The following scripts are automatically monitored and updated:

| Script | Purpose | Update Priority |
|--------|---------|----------------|
| `epc-checkin-agent.sh` | Main check-in agent | **Highest (1)** |
| `epc-ping-monitor.js` | Ping monitoring | Standard (5) |
| `epc-snmp-discovery.js` | SNMP discovery (Node.js) | Standard (5) |
| `epc-snmp-discovery.sh` | SNMP discovery (Bash) | Standard (5) |

## Update Frequency

- **Check-in Interval**: 10 minutes (600 seconds)
- **Update Detection**: Every check-in
- **Update Execution**: Immediately after receiving command
- **Version Tracking**: Prevents duplicate updates within 10 minutes

## Manual Deployment

### Deploy Scripts to Downloads Directory

```bash
# On backend server
cd /opt/lte-pci-mapper
sudo git pull origin main
sudo bash backend-services/scripts/deploy-scripts-to-downloads.sh
```

### Force Update on Specific EPC

```bash
# Queue an update command manually (via API or database)
# The EPC will receive it on next check-in
```

## Verification

### Check Script Deployment

```bash
# List deployed scripts
ls -lh /var/www/html/downloads/scripts/

# Verify script is accessible
curl -I https://hss.wisptools.io/downloads/scripts/epc-ping-monitor.js
```

### Test Auto-Update System

```bash
# On backend server
cd /opt/lte-pci-mapper/backend-services
node scripts/test-auto-update.js
```

### Check EPC Script Versions

The EPC reports script hashes in check-in logs. Check backend logs:

```bash
# Look for script version checks
grep "Script versions received" /var/log/pm2/main-api.log
```

## Troubleshooting

### Scripts Not Updating

1. **Check Downloads Directory**: Ensure scripts are in `/var/www/html/downloads/scripts/`
2. **Check Permissions**: Scripts should be readable by www-data
3. **Check Auto-Update Logs**: Look for update detection in backend logs
4. **Check EPC Logs**: Verify EPC is receiving and executing commands

### Update Commands Not Executing

1. **Check Command Queue**: Verify commands are being queued in database
2. **Check EPC Status**: Ensure EPC is online and checking in
3. **Check Command Status**: Look for `pending` or `sent` status
4. **Check Execution Logs**: Review EPC check-in logs for errors

## Best Practices

1. **Always Deploy Scripts**: After updating scripts in repo, run deployment script
2. **Test Updates**: Use test script to verify update detection
3. **Monitor Logs**: Watch for update-related errors
4. **Version Control**: Script changes are tracked via git
5. **Rollback**: Can revert by deploying previous version

## Integration with Deployment

The main deployment script (`deploy-monitoring-backend-via-git.sh`) now includes script deployment:

```bash
# Step 9b: Deploy EPC scripts to downloads directory
sudo bash "$REPO_DIR/backend-services/scripts/deploy-scripts-to-downloads.sh"
```

This ensures scripts are always deployed when the backend is updated.

## Summary

✅ **Automatic Updates**: Scripts are updated automatically during check-in  
✅ **Version Tracking**: Prevents duplicate updates  
✅ **Git-Based**: Uses git repository for reliable updates  
✅ **Zero Downtime**: Updates happen without service interruption  
✅ **Rollback Support**: Can revert to previous versions if needed

