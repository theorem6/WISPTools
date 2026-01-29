---
title: EPC Monitoring Status
description: EPC monitoring graphs and real device data status.
---

# EPC Monitoring Status Summary

## ✅ **Graphs ARE Real - Using Actual Device Data**

The monitoring graphs on the frontend are displaying **real, live data** from your EPC device. Here's the proof:

### Data Being Collected:
- **CPU Usage**: 50-100% (varies, showing real usage)
- **Memory Usage**: 7% (consistent, 610MB / 7816MB)
- **Disk Usage**: 3% (2.6GB / 116.3GB)
- **Uptime**: Increasing (37986 seconds = ~10.5 hours)
- **Load Average**: 0.25, 0.19, 0.18 (real system load)

### How It Works:
1. **Check-in Agent** (`epc-checkin-agent.sh`) runs on your EPC every 60 seconds
2. Collects real system metrics using:
   - `top`, `df`, `/proc/uptime`, `/proc/loadavg` for CPU/memory/disk
   - `systemctl` for service status
3. Sends data to `/api/epc/checkin` via HTTP POST
4. Stored in `EPCServiceStatus` collection in MongoDB
5. Frontend graphs query `/api/epc/:epc_id/status/history` to display historical data

### Data Points Collected:
- **System Metrics**: CPU %, memory %, disk %, uptime, load average
- **Service Status**: Open5GS services (MME, SGW, SMF, UPF), SNMP daemon
- **Network Info**: IP address, network interfaces
- **Versions**: OS version, Open5GS version, kernel version

---

## 📡 **SNMP Daemon Status**

### SNMP Daemon (`snmpd`) is Running:
- **Status**: Active ✓
- **Uptime**: 37978 seconds (~10.5 hours)
- **Memory**: 13 MB

### How SNMP Works:
1. **`snmpd`** is the SNMP daemon running on your EPC
   - It's a **passive service** that responds to SNMP GET requests
   - It does NOT actively send data to the cloud
   - It's available for **external SNMP polling** if needed

2. **Active Data Collection** is done by:
   - **Check-in Agent** - Collects system metrics and sends via HTTP POST
   - This is the primary method for monitoring your EPC

3. **Optional SNMP Polling**:
   - The central server CAN poll your EPC via SNMP if you configure it
   - This would be for external monitoring tools (e.g., Zabbix, Nagios)
   - Currently, the check-in agent is the primary data source

### Current Data Flow:
```
EPC Device → Check-in Agent (every 60s) → HTTP POST → Cloud API → MongoDB → Frontend Graphs
```

### Optional SNMP Flow (if configured):
```
Cloud SNMP Collector → SNMP GET → EPC snmpd → SNMP Response → Cloud API → MongoDB
```

---

## 🔍 **Verification**

You can verify the real data by checking:
1. **Backend API**: `GET /api/epc/EPC-CB4C5042/status` - Shows latest metrics
2. **History API**: `GET /api/epc/EPC-CB4C5042/status/history` - Shows historical data points
3. **Database**: `EPCServiceStatus` collection contains all check-in data

The graphs are **100% real** and showing actual device performance! 📊

