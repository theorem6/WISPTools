# EPC Agent Automatic Update System

This document describes the automatic update system for EPC agent scripts, similar to package managers like `apt`.

## Overview

The system automatically:
1. Tracks versions of all agent scripts using SHA256 hashes
2. Checks for updates during each check-in
3. Queues update commands when scripts are out of date
4. Automatically downloads and installs updated scripts

## Components

### 1. Agent Manifest (`agent-manifest.json`)

The manifest file tracks all agent scripts with:
- Version number
- SHA256 hash
- Download URL
- Install path
- Permissions

**Location:** `backend-services/agent-manifest.json`

**Manifest Endpoint:** `GET /api/agent/manifest` (public, no auth required)

### 2. Version Manager (`utils/agent-version-manager.js`)

Core logic for:
- Loading and comparing script versions
- Detecting which scripts need updates
- Generating update commands

### 3. Update Command Generator

Automatically creates `script_execution` commands that:
- Download the updated script from the server
- Verify SHA256 hash
- Install to the correct location with proper permissions
- Log all actions

### 4. Check-in Integration

During each check-in:
1. Agent reports current script versions (via hash)
2. Server compares with manifest
3. If differences found, update commands are queued
4. Agent executes update commands on next check-in

## Workflow

```
┌─────────────────┐
│ EPC Agent       │
│ Check-in        │
└────────┬────────┘
         │ Reports script versions (hashes)
         ▼
┌─────────────────┐
│ Check-in        │
│ Endpoint        │
└────────┬────────┘
         │ Compare with manifest
         ▼
┌─────────────────┐
│ Version Manager │
│ Compare         │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
Need Update?  No
    │         │
    │         └───► Continue normally
    ▼
┌─────────────────┐
│ Queue Update    │
│ Command         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Agent Executes  │
│ Update Command  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Script Updated  │
│ (via download)  │
└─────────────────┘
```

## Maintaining Script Versions

### Update Manifest After Script Changes

Whenever you modify an agent script, update the manifest:

```bash
cd backend-services/scripts
node update-agent-manifest.js
```

This will:
- Calculate new SHA256 hashes for all scripts
- Update the manifest file
- Make the changes available to agents

### Deploy Updated Scripts

After updating scripts and manifest:

1. Copy scripts to download directory:
```bash
sudo cp epc-checkin-agent.sh /var/www/html/downloads/scripts/
```

2. Restart backend (to reload manifest):
```bash
sudo systemctl restart lte-wisp-backend
```

3. Agents will automatically detect and install updates on next check-in

## Agent Script Reporting

The check-in agent automatically reports script versions using SHA256 hashes:

```bash
# In epc-checkin-agent.sh
get_versions() {
    # Calculate hash for each script
    local agent_hash=$(get_file_hash "/opt/wisptools/epc-checkin-agent.sh")
    # ... more scripts ...
    
    echo '{"scripts":{"epc-checkin-agent.sh":{"hash":"abc123..."}}}'
}
```

## Update Command Structure

Update commands are `script_execution` type commands that:

1. Download script from server URL
2. Verify SHA256 hash matches manifest
3. Install to configured path with correct permissions
4. Log all actions to `/var/log/wisptools-checkin.log`

## Configuration

### Manifest Location

- **Source:** `backend-services/agent-manifest.json`
- **Public URL:** `https://hss.wisptools.io/downloads/agent-manifest.json`
- **API Endpoint:** `GET /api/agent/manifest`

### Script Download Base URL

All scripts are served from:
- `https://hss.wisptools.io/downloads/scripts/{script-name}`

### Update Priority

Update commands are queued with **priority 2** (medium):
- Higher than regular commands (priority 3)
- Lower than emergency commands (priority 1)
- Ensures updates happen promptly but don't block critical commands

### Update Expiration

Update commands expire after **24 hours** if not executed.

## Tracking Scripts

The manifest currently tracks:

1. **epc-checkin-agent.sh** (required)
   - Main check-in agent script
   - Installed to: `/opt/wisptools/epc-checkin-agent.sh`

2. **epc-snmp-discovery.js** (optional)
   - SNMP network discovery (Node.js)
   - Installed to: `/opt/wisptools/epc-snmp-discovery.js`

3. **epc-snmp-discovery.sh** (optional)
   - SNMP network discovery (bash fallback)
   - Installed to: `/opt/wisptools/epc-snmp-discovery.sh`

4. **install-epc-dependencies.sh** (optional)
   - Dependency installer
   - Installed to: `/opt/wisptools/install-epc-dependencies.sh`

## Adding New Scripts

To add a new script to the update system:

1. Add script info to `agent-manifest.json`:
```json
"my-new-script.sh": {
  "version": "1.0.0",
  "filename": "my-new-script.sh",
  "url": "https://hss.wisptools.io/downloads/scripts/my-new-script.sh",
  "sha256": "",
  "required": false,
  "description": "My new script",
  "install_path": "/opt/wisptools/my-new-script.sh",
  "chmod": "755"
}
```

2. Run manifest updater to calculate hash:
```bash
node update-agent-manifest.js
```

3. Deploy script to download directory

4. Agents will automatically receive updates on next check-in

## Troubleshooting

### Scripts Not Updating

1. Check manifest hash matches script file:
```bash
sha256sum backend-services/scripts/epc-checkin-agent.sh
# Compare with manifest.json
```

2. Verify script is in download directory:
```bash
ls -la /var/www/html/downloads/scripts/
```

3. Check agent logs for update errors:
```bash
tail -f /var/log/wisptools-checkin.log | grep UPDATE
```

### Update Commands Not Being Queued

1. Check check-in endpoint logs:
```bash
journalctl -u lte-wisp-backend -f | grep "Agent Version Manager"
```

2. Verify agent is reporting script versions:
```bash
# Check check-in payload includes versions.scripts
```

### Hash Mismatch Errors

If agents report hash mismatches:

1. Ensure manifest was updated after script changes
2. Verify script file on server matches manifest hash
3. Check download URL is accessible from agent

## Manual Update

To manually trigger an update for an EPC:

1. Clear existing update commands:
```javascript
await EPCCommand.deleteMany({
  epc_id: epcId,
  notes: /Auto-update/
});
```

2. Next check-in will detect out-of-date scripts and queue new updates

## Future Enhancements

Potential improvements:

1. **Version numbers**: Use semantic versioning instead of just hashes
2. **Rollback**: Store previous versions for rollback capability
3. **Update channels**: Allow different update channels (stable, beta, etc.)
4. **Dependencies**: Track script dependencies
5. **Update notifications**: Notify when updates are available

