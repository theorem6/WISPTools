# Remote Agents Status API

## Overview

The Remote Agents Status API provides a comprehensive view of all remote EPC/SNMP units checking in and their hardware linking status. This endpoint helps administrators identify which agents are actively checking in and whether they are properly linked to hardware deployments.

## Endpoints

### GET /api/remote-agents/status

Returns a complete list of all remote EPC agents and SNMP discovered devices with their check-in status and hardware linking information.

#### Headers
- `X-Tenant-ID` (required): Tenant identifier

#### Query Parameters
- `tenant_id` (optional): Override tenant ID from header
- `include_offline` (optional, default: `true`): Include offline devices
- `include_unlinked` (optional, default: `true`): Include devices not linked to hardware

#### Response Format

```json
{
  "success": true,
  "summary": {
    "total_agents": 15,
    "epc_agents": 8,
    "snmp_devices": 7,
    "linked_count": 12,
    "unlinked_count": 3,
    "active_checkins": 6,
    "offline_checkins": 2,
    "by_link_type": {
      "hardware_id": 3,
      "inventory": 5,
      "hardware_deployment": 2,
      "site": 2
    }
  },
  "agents": [
    {
      "type": "epc_agent",
      "epc_id": "EPC-001",
      "site_name": "Main Tower",
      "device_code": "ABC12345",
      "deployment_type": "both",
      "status": "online",
      "checkin_status": "active",
      "last_checkin": "2024-01-15T10:30:00Z",
      "time_since_checkin": 45,
      "ip_address": "192.168.1.100",
      "hardware_id": "00:11:22:33:44:55",
      "hardware_linked": true,
      "hardware_link_type": "hardware_id",
      "hardware_link_id": "00:11:22:33:44:55",
      "site_id": "site-123",
      "location": {
        "address": "123 Main St",
        "coordinates": {
          "latitude": 40.7128,
          "longitude": -74.0060
        }
      },
      "version": {
        "open5gs": "2.6.0",
        "os": "Ubuntu 22.04"
      },
      "metrics": {
        "system_uptime_seconds": 86400,
        "cpu_percent": 25.5,
        "memory_percent": 60.2
      }
    },
    {
      "type": "snmp_device",
      "device_id": "device-456",
      "name": "Router-01",
      "ip_address": "192.168.1.10",
      "mac_address": "AA:BB:CC:DD:EE:FF",
      "device_type": "router",
      "manufacturer": "Mikrotik",
      "model": "RB4011",
      "status": "discovered",
      "hardware_linked": false,
      "hardware_link_type": null,
      "hardware_link_id": null,
      "site_id": null,
      "discovered_at": "2024-01-15T09:00:00Z",
      "time_since_discovery": 5400,
      "discovered_by_epc": {
        "epc_id": "EPC-001",
        "site_name": "Main Tower",
        "device_code": "ABC12345"
      },
      "snmp_config": {
        "community": "public",
        "version": "2c",
        "enabled": true
      }
    }
  ],
  "timestamp": "2024-01-15T10:30:45Z"
}
```

#### Agent Types

**EPC Agent** (`type: "epc_agent"`):
- Remote EPC devices checking in via `/api/epc/checkin`
- Includes check-in status, uptime, and service metrics
- Can be linked via `hardware_id`, inventory item, or hardware deployment

**SNMP Device** (`type: "snmp_device"`):
- Network devices discovered by EPC agents via SNMP
- Includes discovery metadata and SNMP configuration
- Can be linked via site, hardware deployment, or inventory item

#### Check-in Status Values

- `active`: Last check-in within 5 minutes
- `recent`: Last check-in within 30 minutes
- `stale`: Last check-in within 1 hour
- `offline`: Last check-in more than 1 hour ago
- `never`: No check-in recorded
- `unknown`: Status cannot be determined

#### Hardware Link Types

- `hardware_id`: Linked via hardware_id field (MAC address or unique identifier)
- `inventory`: Linked to inventory item
- `hardware_deployment`: Linked to hardware deployment record
- `site`: Linked to site (for SNMP devices)

### GET /api/remote-agents/status/unlinked

Convenience endpoint that returns only agents not linked to hardware.

#### Response Format

```json
{
  "success": true,
  "count": 3,
  "agents": [
    {
      "type": "epc_agent",
      "epc_id": "EPC-003",
      "site_name": "Remote Site",
      "device_code": "XYZ98765",
      "status": "online",
      "last_checkin": "2024-01-15T10:25:00Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:45Z"
}
```

## Use Cases

1. **Inventory Management**: Identify which agents are checking in but not linked to hardware
2. **Deployment Tracking**: Verify all deployed hardware has active agents
3. **Troubleshooting**: Find agents that stopped checking in
4. **Compliance**: Ensure all remote units are properly registered and linked

## Example Usage

```bash
# Get all agents for a tenant
curl -H "X-Tenant-ID: tenant-123" \
  https://api.example.com/api/remote-agents/status

# Get only unlinked agents
curl -H "X-Tenant-ID: tenant-123" \
  https://api.example.com/api/remote-agents/status/unlinked

# Exclude offline devices
curl -H "X-Tenant-ID: tenant-123" \
  "https://api.example.com/api/remote-agents/status?include_offline=false"
```

## Notes

- The endpoint requires tenant authentication via `X-Tenant-ID` header
- Check-in times are calculated in seconds since last check-in
- Hardware linking checks multiple sources (hardware_id, inventory, deployments, sites)
- SNMP devices are only included if they were discovered by EPC agents (`discovery_source: 'epc_snmp_agent'`)

# Remote Agents Status API

## Overview

The Remote Agents Status API provides a comprehensive view of all remote EPC/SNMP units checking in and their hardware linking status. This endpoint helps administrators identify which agents are actively checking in and whether they are properly linked to hardware deployments.

## Endpoints

### GET /api/remote-agents/status

Returns a complete list of all remote EPC agents and SNMP discovered devices with their check-in status and hardware linking information.

#### Headers
- `X-Tenant-ID` (required): Tenant identifier

#### Query Parameters
- `tenant_id` (optional): Override tenant ID from header
- `include_offline` (optional, default: `true`): Include offline devices
- `include_unlinked` (optional, default: `true`): Include devices not linked to hardware

#### Response Format

```json
{
  "success": true,
  "summary": {
    "total_agents": 15,
    "epc_agents": 8,
    "snmp_devices": 7,
    "linked_count": 12,
    "unlinked_count": 3,
    "active_checkins": 6,
    "offline_checkins": 2,
    "by_link_type": {
      "hardware_id": 3,
      "inventory": 5,
      "hardware_deployment": 2,
      "site": 2
    }
  },
  "agents": [
    {
      "type": "epc_agent",
      "epc_id": "EPC-001",
      "site_name": "Main Tower",
      "device_code": "ABC12345",
      "deployment_type": "both",
      "status": "online",
      "checkin_status": "active",
      "last_checkin": "2024-01-15T10:30:00Z",
      "time_since_checkin": 45,
      "ip_address": "192.168.1.100",
      "hardware_id": "00:11:22:33:44:55",
      "hardware_linked": true,
      "hardware_link_type": "hardware_id",
      "hardware_link_id": "00:11:22:33:44:55",
      "site_id": "site-123",
      "location": {
        "address": "123 Main St",
        "coordinates": {
          "latitude": 40.7128,
          "longitude": -74.0060
        }
      },
      "version": {
        "open5gs": "2.6.0",
        "os": "Ubuntu 22.04"
      },
      "metrics": {
        "system_uptime_seconds": 86400,
        "cpu_percent": 25.5,
        "memory_percent": 60.2
      }
    },
    {
      "type": "snmp_device",
      "device_id": "device-456",
      "name": "Router-01",
      "ip_address": "192.168.1.10",
      "mac_address": "AA:BB:CC:DD:EE:FF",
      "device_type": "router",
      "manufacturer": "Mikrotik",
      "model": "RB4011",
      "status": "discovered",
      "hardware_linked": false,
      "hardware_link_type": null,
      "hardware_link_id": null,
      "site_id": null,
      "discovered_at": "2024-01-15T09:00:00Z",
      "time_since_discovery": 5400,
      "discovered_by_epc": {
        "epc_id": "EPC-001",
        "site_name": "Main Tower",
        "device_code": "ABC12345"
      },
      "snmp_config": {
        "community": "public",
        "version": "2c",
        "enabled": true
      }
    }
  ],
  "timestamp": "2024-01-15T10:30:45Z"
}
```

#### Agent Types

**EPC Agent** (`type: "epc_agent"`):
- Remote EPC devices checking in via `/api/epc/checkin`
- Includes check-in status, uptime, and service metrics
- Can be linked via `hardware_id`, inventory item, or hardware deployment

**SNMP Device** (`type: "snmp_device"`):
- Network devices discovered by EPC agents via SNMP
- Includes discovery metadata and SNMP configuration
- Can be linked via site, hardware deployment, or inventory item

#### Check-in Status Values

- `active`: Last check-in within 5 minutes
- `recent`: Last check-in within 30 minutes
- `stale`: Last check-in within 1 hour
- `offline`: Last check-in more than 1 hour ago
- `never`: No check-in recorded
- `unknown`: Status cannot be determined

#### Hardware Link Types

- `hardware_id`: Linked via hardware_id field (MAC address or unique identifier)
- `inventory`: Linked to inventory item
- `hardware_deployment`: Linked to hardware deployment record
- `site`: Linked to site (for SNMP devices)

### GET /api/remote-agents/status/unlinked

Convenience endpoint that returns only agents not linked to hardware.

#### Response Format

```json
{
  "success": true,
  "count": 3,
  "agents": [
    {
      "type": "epc_agent",
      "epc_id": "EPC-003",
      "site_name": "Remote Site",
      "device_code": "XYZ98765",
      "status": "online",
      "last_checkin": "2024-01-15T10:25:00Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:45Z"
}
```

## Use Cases

1. **Inventory Management**: Identify which agents are checking in but not linked to hardware
2. **Deployment Tracking**: Verify all deployed hardware has active agents
3. **Troubleshooting**: Find agents that stopped checking in
4. **Compliance**: Ensure all remote units are properly registered and linked

## Example Usage

```bash
# Get all agents for a tenant
curl -H "X-Tenant-ID: tenant-123" \
  https://api.example.com/api/remote-agents/status

# Get only unlinked agents
curl -H "X-Tenant-ID: tenant-123" \
  https://api.example.com/api/remote-agents/status/unlinked

# Exclude offline devices
curl -H "X-Tenant-ID: tenant-123" \
  "https://api.example.com/api/remote-agents/status?include_offline=false"
```

## Notes

- The endpoint requires tenant authentication via `X-Tenant-ID` header
- Check-in times are calculated in seconds since last check-in
- Hardware linking checks multiple sources (hardware_id, inventory, deployments, sites)
- SNMP devices are only included if they were discovered by EPC agents (`discovery_source: 'epc_snmp_agent'`)

# Remote Agents Status API

## Overview

The Remote Agents Status API provides a comprehensive view of all remote EPC/SNMP units checking in and their hardware linking status. This endpoint helps administrators identify which agents are actively checking in and whether they are properly linked to hardware deployments.

## Endpoints

### GET /api/remote-agents/status

Returns a complete list of all remote EPC agents and SNMP discovered devices with their check-in status and hardware linking information.

#### Headers
- `X-Tenant-ID` (required): Tenant identifier

#### Query Parameters
- `tenant_id` (optional): Override tenant ID from header
- `include_offline` (optional, default: `true`): Include offline devices
- `include_unlinked` (optional, default: `true`): Include devices not linked to hardware

#### Response Format

```json
{
  "success": true,
  "summary": {
    "total_agents": 15,
    "epc_agents": 8,
    "snmp_devices": 7,
    "linked_count": 12,
    "unlinked_count": 3,
    "active_checkins": 6,
    "offline_checkins": 2,
    "by_link_type": {
      "hardware_id": 3,
      "inventory": 5,
      "hardware_deployment": 2,
      "site": 2
    }
  },
  "agents": [
    {
      "type": "epc_agent",
      "epc_id": "EPC-001",
      "site_name": "Main Tower",
      "device_code": "ABC12345",
      "deployment_type": "both",
      "status": "online",
      "checkin_status": "active",
      "last_checkin": "2024-01-15T10:30:00Z",
      "time_since_checkin": 45,
      "ip_address": "192.168.1.100",
      "hardware_id": "00:11:22:33:44:55",
      "hardware_linked": true,
      "hardware_link_type": "hardware_id",
      "hardware_link_id": "00:11:22:33:44:55",
      "site_id": "site-123",
      "location": {
        "address": "123 Main St",
        "coordinates": {
          "latitude": 40.7128,
          "longitude": -74.0060
        }
      },
      "version": {
        "open5gs": "2.6.0",
        "os": "Ubuntu 22.04"
      },
      "metrics": {
        "system_uptime_seconds": 86400,
        "cpu_percent": 25.5,
        "memory_percent": 60.2
      }
    },
    {
      "type": "snmp_device",
      "device_id": "device-456",
      "name": "Router-01",
      "ip_address": "192.168.1.10",
      "mac_address": "AA:BB:CC:DD:EE:FF",
      "device_type": "router",
      "manufacturer": "Mikrotik",
      "model": "RB4011",
      "status": "discovered",
      "hardware_linked": false,
      "hardware_link_type": null,
      "hardware_link_id": null,
      "site_id": null,
      "discovered_at": "2024-01-15T09:00:00Z",
      "time_since_discovery": 5400,
      "discovered_by_epc": {
        "epc_id": "EPC-001",
        "site_name": "Main Tower",
        "device_code": "ABC12345"
      },
      "snmp_config": {
        "community": "public",
        "version": "2c",
        "enabled": true
      }
    }
  ],
  "timestamp": "2024-01-15T10:30:45Z"
}
```

#### Agent Types

**EPC Agent** (`type: "epc_agent"`):
- Remote EPC devices checking in via `/api/epc/checkin`
- Includes check-in status, uptime, and service metrics
- Can be linked via `hardware_id`, inventory item, or hardware deployment

**SNMP Device** (`type: "snmp_device"`):
- Network devices discovered by EPC agents via SNMP
- Includes discovery metadata and SNMP configuration
- Can be linked via site, hardware deployment, or inventory item

#### Check-in Status Values

- `active`: Last check-in within 5 minutes
- `recent`: Last check-in within 30 minutes
- `stale`: Last check-in within 1 hour
- `offline`: Last check-in more than 1 hour ago
- `never`: No check-in recorded
- `unknown`: Status cannot be determined

#### Hardware Link Types

- `hardware_id`: Linked via hardware_id field (MAC address or unique identifier)
- `inventory`: Linked to inventory item
- `hardware_deployment`: Linked to hardware deployment record
- `site`: Linked to site (for SNMP devices)

### GET /api/remote-agents/status/unlinked

Convenience endpoint that returns only agents not linked to hardware.

#### Response Format

```json
{
  "success": true,
  "count": 3,
  "agents": [
    {
      "type": "epc_agent",
      "epc_id": "EPC-003",
      "site_name": "Remote Site",
      "device_code": "XYZ98765",
      "status": "online",
      "last_checkin": "2024-01-15T10:25:00Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:45Z"
}
```

## Use Cases

1. **Inventory Management**: Identify which agents are checking in but not linked to hardware
2. **Deployment Tracking**: Verify all deployed hardware has active agents
3. **Troubleshooting**: Find agents that stopped checking in
4. **Compliance**: Ensure all remote units are properly registered and linked

## Example Usage

```bash
# Get all agents for a tenant
curl -H "X-Tenant-ID: tenant-123" \
  https://api.example.com/api/remote-agents/status

# Get only unlinked agents
curl -H "X-Tenant-ID: tenant-123" \
  https://api.example.com/api/remote-agents/status/unlinked

# Exclude offline devices
curl -H "X-Tenant-ID: tenant-123" \
  "https://api.example.com/api/remote-agents/status?include_offline=false"
```

## Notes

- The endpoint requires tenant authentication via `X-Tenant-ID` header
- Check-in times are calculated in seconds since last check-in
- Hardware linking checks multiple sources (hardware_id, inventory, deployments, sites)
- SNMP devices are only included if they were discovered by EPC agents (`discovery_source: 'epc_snmp_agent'`)







