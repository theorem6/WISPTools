# Graph and Alarm System Implementation

## Overview
This document describes the comprehensive graph and alarm system for monitoring deployed hardware devices.

## Components

### 1. Ping Monitoring Service
**File:** `backend-services/services/ping-monitoring-service.js`

- Pings all deployed devices with IP addresses every 5 minutes
- Stores ping metrics for uptime tracking
- Triggers alarms after 3 consecutive failures
- Supports both inventory items and network equipment

**Key Features:**
- Automatic ping monitoring every 5 minutes
- Stores response times and success/failure status
- Tracks consecutive failures for alarm triggering
- Cross-platform ping support (Linux/Windows)

### 2. Ping Metrics Schema
**File:** `backend-services/models/ping-metrics-schema.js`

Stores time-series ping data:
- Device ID and tenant ID
- IP address
- Success/failure status
- Response time (ms)
- Consecutive failure count
- 90-day TTL for data retention

### 3. Device Assignment System
**File:** `backend-services/routes/device-assignment.js`

**Endpoints:**
- `POST /api/device-assignment/assign` - Assign hardware to SNMP device
- `POST /api/device-assignment/manual-ip` - Manually assign IP address
- `GET /api/device-assignment/unassigned` - Get devices without IP addresses

### 4. Graph API Endpoints
**File:** `backend-services/routes/monitoring-graphs.js`

**Endpoints:**
- `GET /api/monitoring/graphs/ping/:deviceId` - Get ping metrics for graphing
- `GET /api/monitoring/graphs/snmp/:deviceId` - Get SNMP metrics for graphing
- `GET /api/monitoring/graphs/devices` - Get list of devices available for graphing

**Query Parameters:**
- `hours` - Time range (1-720 hours, default: 24)
- `metric` - For SNMP: cpu, memory, uptime, throughput_in, throughput_out

### 5. Alarm System
Alarms are automatically created when:
- Device fails 3+ consecutive pings
- Alarms are stored in inventory item alerts
- Severity: `warning` (3-4 failures) or `critical` (5+ failures)

## Inventory Schema Updates

**File:** `backend-services/models/inventory.js`

Added top-level `ipAddress` field for easy access:
```javascript
ipAddress: { type: String, index: true }
```

This is in addition to `technicalSpecs.ipAddress` for backward compatibility.

## Server Integration

**File:** `backend-services/server.js`

- Ping monitoring service starts automatically on server startup
- Graph routes registered at `/api/monitoring/graphs`
- Device assignment routes registered at `/api/device-assignment`

## Frontend Integration

### Current Status
- Chart.js already installed and configured
- SNMPGraphsPanel exists but needs updates to support ping metrics

### Next Steps for Frontend
1. Update `SNMPGraphsPanel.svelte` to:
   - Load devices from `/api/monitoring/graphs/devices`
   - Support both ping and SNMP graphs
   - Show ping uptime graphs alongside SNMP metrics
   - Display device assignment status

2. Create device assignment UI:
   - Show unassigned devices
   - Allow manual IP assignment
   - Link hardware to SNMP discovered devices

3. Alarm display:
   - Show active alarms on devices
   - Display in hardware inventory list
   - Alert badges for devices with failures

## Usage

### Assigning IP Address to Hardware

**Method 1: Via SNMP Discovery**
When a device is discovered via SNMP and added to hardware inventory, the IP address is automatically assigned.

**Method 2: Manual Assignment**
```javascript
POST /api/device-assignment/manual-ip
{
  "hardwareId": "inventory_item_id",
  "ipAddress": "192.168.1.100"
}
```

**Method 3: Link to SNMP Device**
```javascript
POST /api/device-assignment/assign
{
  "hardwareId": "inventory_item_id",
  "snmpDeviceId": "network_equipment_id"
}
```

### Viewing Graphs

**Ping Uptime Graph:**
```
GET /api/monitoring/graphs/ping/{deviceId}?hours=24
```

**SNMP Metrics Graph:**
```
GET /api/monitoring/graphs/snmp/{deviceId}?hours=24&metric=cpu
```

### Alarm Thresholds

- **Warning:** 3-4 consecutive ping failures
- **Critical:** 5+ consecutive ping failures
- Alarms are automatically created and stored in inventory item alerts
- Alarms can be acknowledged via the inventory management UI

## Data Retention

- Ping metrics: 90 days (TTL index)
- SNMP metrics: 90 days (TTL index)
- Alarms: Stored permanently until acknowledged/deleted

## Performance Considerations

- Ping batch size: 20 devices at a time
- Delay between batches: 500ms
- Ping timeout: 3 seconds per device
- Total ping cycle time: Varies based on number of devices

## Future Enhancements

1. **Graph Frontend:**
   - Real-time updates via WebSocket
   - Multiple metric comparison
   - Export graph data

2. **Advanced Alarms:**
   - Email notifications
   - SMS alerts
   - Alert escalation
   - Custom alarm rules

3. **Device Discovery:**
   - Auto-assignment of discovered devices to hardware
   - Duplicate detection
   - Conflict resolution

4. **Performance Optimization:**
   - Caching of recent metrics
   - Aggregation of old data
   - Index optimization

