# Ping Monitoring System Fix

**Date:** 2025-12-06  
**Status:** ✅ Complete

## Overview

Fixed the ping monitoring and SNMP system to work properly with the following requirements:
1. Hourly subnet ping sweep - ping all subnets in SNMP settings
2. Every 5 minutes (before check-in) - ping all monitored devices and report
3. Graph ping and SNMP data

## Changes Made

### 1. Check-In Interval Updated
- **Changed from:** 60 seconds (1 minute)
- **Changed to:** 300 seconds (5 minutes)
- **File:** `backend-services/scripts/epc-checkin-agent.sh`

### 2. Ping Monitoring System

#### Ping Monitor Script (`backend-services/scripts/epc-ping-monitor.js`)
- **Two modes:**
  - `cycle` - Pings known monitored devices (runs every 5 minutes before check-in)
  - `sweep` - Subnet ping sweep (runs hourly)

- **Features:**
  - Subnet ping sweep - generates IP addresses from CIDR subnets and pings them
  - Device ping cycle - pings all devices from monitoring-devices endpoint
  - Automatic data submission to backend
  - Proper error handling and logging

#### Check-In Agent Integration (`backend-services/scripts/epc-checkin-agent.sh`)
- **Ping runs BEFORE check-in** (synchronously, every 5 minutes)
- **Subnet sweep runs hourly** (in background)
- Script automatically downloads/updates from git repository

### 3. Backend API Endpoints

#### New Endpoint: GET `/api/epc/checkin/snmp-subnets`
- Returns list of SNMP subnets configured for the EPC
- Used for hourly subnet ping sweeps
- Gets subnets from `epc.snmp_config.targets`

#### Existing Endpoint: GET `/api/epc/checkin/monitoring-devices`
- Returns list of devices to monitor
- Used for 5-minute ping cycles

### 4. SNMP Configuration
- **Polling Interval:** Updated to 300 seconds (5 minutes)
- **Discovery:** Remains hourly (resource-intensive operation)
- **File:** `backend-services/models/distributed-epc-schema.js`

## How It Works

### Every 5 Minutes (Before Check-In)
1. **Ping Cycle:** Agent runs `epc-ping-monitor.js cycle`
   - Fetches list of monitored devices from backend
   - Pings each device
   - Sends metrics to backend for storage/graphing

2. **Check-In:** Agent checks in with backend
   - Reports service status
   - Receives commands
   - Reports command results

### Hourly (Background)
1. **Subnet Ping Sweep:** Agent runs `epc-ping-monitor.js sweep`
   - Fetches SNMP subnets from backend
   - Generates IP addresses from each subnet (max /24)
   - Pings all IPs in subnets
   - Records responding devices
   - Sends metrics to backend

2. **SNMP Discovery:** Agent runs SNMP discovery
   - Scans network for SNMP-enabled devices
   - Discovers new devices
   - Reports to backend

## Data Flow

### Ping Metrics Storage
- Metrics stored in `PingMetrics` collection
- Includes: device_id, ip_address, success, response_time_ms, timestamp
- TTL: 90 days

### Graphing
- Frontend retrieves ping metrics via `/api/monitoring/graphs/ping/:deviceId`
- SNMP metrics via `/api/monitoring/graphs/snmp/:deviceId`
- Charts display uptime and response times

## Configuration

### Default Intervals
- **Check-in:** 300 seconds (5 minutes)
- **Ping cycle:** 300 seconds (5 minutes, before check-in)
- **Subnet sweep:** 3600 seconds (1 hour)
- **SNMP discovery:** 3600 seconds (1 hour)
- **SNMP polling:** 300 seconds (5 minutes)

### Override via Backend
- Backend can send `checkin_interval` in check-in response
- Agent will update interval dynamically

## Testing

To test the system:
1. **Check ping cycle:** Wait for next check-in (5 minutes), check logs
2. **Check subnet sweep:** Wait 1 hour, check logs for sweep
3. **Check graphs:** View monitoring module, verify ping/SNMP data appears

## Files Modified

1. `backend-services/scripts/epc-ping-monitor.js` - Complete rewrite
2. `backend-services/scripts/epc-checkin-agent.sh` - Updated intervals and ping integration
3. `backend-services/routes/epc-checkin.js` - Added SNMP subnets endpoint
4. `backend-services/models/distributed-epc-schema.js` - Updated default polling intervals

## Next Steps

1. Deploy updated scripts to agents via git update command
2. Monitor logs to verify ping cycles are running
3. Check graphs in monitoring module to verify data flow

