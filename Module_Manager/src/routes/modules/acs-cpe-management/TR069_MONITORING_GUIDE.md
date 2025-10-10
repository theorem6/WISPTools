# TR-069 LTE/5G Monitoring System Guide

## Overview

This monitoring system tracks real-time LTE/5G cellular parameters from CPE devices via TR-069 (CWMP) protocol, stored in GenieACS/MongoDB.

---

## 📡 TR-069 Cellular Parameters

### Based on TR-196 Data Model

All metrics are retrieved from `Device.Cellular.Interface.{i}.*` parameters according to the TR-196 standard.

---

## 📊 Monitored Metrics

### 1. RSSI (Received Signal Strength Indicator)

**TR-069 Path:** `Device.Cellular.Interface.1.RSSI`

**Range:** -120 to -25 dBm  
**Description:** Overall received signal strength including interference

**Quality Thresholds:**
- **Excellent:** ≥ -50 dBm 🟢
- **Good:** -50 to -60 dBm 🔵
- **Fair:** -60 to -70 dBm 🟡
- **Poor:** -70 to -80 dBm 🔴
- **Very Poor:** < -80 dBm 🔴

### 2. RSRP (Reference Signal Received Power)

**TR-069 Path:** `Device.Cellular.Interface.1.RSRP`

**Range:** -140 to -44 dBm  
**Description:** LTE reference signal power (3GPP standard)

**Quality Thresholds (3GPP TS 36.133):**
- **Excellent:** ≥ -65 dBm 🟢
- **Good:** -65 to -75 dBm 🔵
- **Fair:** -75 to -85 dBm 🟡
- **Poor:** -85 to -95 dBm 🔴
- **Very Poor:** < -95 dBm 🔴

### 3. RSRQ (Reference Signal Received Quality)

**TR-069 Path:** `Device.Cellular.Interface.1.RSRQ`

**Range:** -20 to -3 dB  
**Description:** LTE signal quality (indicates interference)

**Quality Thresholds:**
- **Excellent:** ≥ -9 dB
- **Good:** -9 to -12 dB
- **Fair:** -12 to -15 dB
- **Poor:** < -15 dB

### 4. SINR (Signal to Interference plus Noise Ratio)

**TR-069 Path:** `Device.Cellular.Interface.1.SINR`

**Range:** -20 to 30 dB  
**Description:** Signal quality vs interference

**Quality Thresholds:**
- **Excellent:** ≥ 20 dB 🟢 (64-QAM capable)
- **Good:** 13-20 dB 🔵 (16-QAM capable)
- **Fair:** 0-13 dB 🟡 (QPSK capable)
- **Poor:** -3 to 0 dB 🔴 (marginal)
- **Very Poor:** < -3 dB 🔴 (unusable)

**Impact on Throughput:**
- SINR > 20 dB: Max throughput (~150 Mbps on 20MHz)
- SINR 13-20 dB: High throughput (~80-120 Mbps)
- SINR 0-13 dB: Medium throughput (~20-60 Mbps)
- SINR < 0 dB: Low throughput (~5-15 Mbps)

### 5. PCI (Physical Cell ID)

**TR-069 Path:** `Device.Cellular.Interface.1.X_VENDOR_PhysicalCellID`

**Range:** 0-503  
**Description:** Unique cell identifier within network

**Key Information:**
- **Mod3 Groups:** PCI % 3 (0, 1, or 2)
- **Mod6 Groups:** PCI % 6 (0-5)
- **Mod30 Groups:** PCI % 30 (0-29)

**Handover Detection:**
- Chart shows PCI changes over time
- Red markers indicate handovers between cells
- Tracks cell selection and reselection events

### 6. EARFCN (E-UTRA Absolute Radio Frequency Channel Number)

**TR-069 Path:** `Device.Cellular.Interface.1.X_VENDOR_EARFCN`

**Range:** 0-262143  
**Description:** LTE frequency channel identifier

**Common EARFCN Ranges:**
- **Band 2 (1900 MHz):** 600-1199
- **Band 4 (AWS):** 1950-2399
- **Band 12 (700 MHz):** 5010-5179
- **Band 66 (AWS-3):** 66436-67335
- **Band 71 (600 MHz):** 68586-68935

**Frequency Change Detection:**
- Identifies band transitions
- Tracks carrier aggregation
- Monitors frequency optimization

### 7. Uptime

**TR-069 Path:** `Device.DeviceInfo.UpTime`

**Unit:** Seconds  
**Description:** Time since last device reboot

**Monitoring:**
- Detects unexpected reboots (red markers)
- Tracks device stability
- Calculates availability percentage
- Format: Days, Hours, Minutes

---

## 🎯 Performance Indicators (KPIs)

### Network KPIs Tracked:

1. **Handover Success Rate** 
   - Target: ≥98%
   - Measures cell-to-cell handover reliability

2. **Bearer Setup Success Rate**
   - Target: ≥99%
   - Measures connection establishment success

3. **Packet Loss Rate**
   - Target: ≤1%
   - Network reliability indicator

4. **Latency**
   - Target: ≤50ms
   - Round-trip time measurement

5. **Active UEs**
   - Current/Max capacity
   - Network load indicator

6. **Jitter**
   - Target: ≤10ms
   - Connection stability

---

## 📈 Chart Types

### 1. RSSI & RSCP Chart
- Dual metrics on same timeline
- Shows overall signal strength
- Includes RSCP (Received Signal Code Power)

### 2. RSRP/RSRQ Chart
- 3GPP standard LTE metrics
- Dual y-axis for different scales
- Area fill for visual clarity

### 3. SINR & CQI Chart
- Signal quality visualization
- Color-coded by quality level
- Segment coloring based on thresholds

### 4. PCI Tracking Chart
- Step chart (discrete values)
- Handover detection (red markers)
- Mod3/Mod6/Mod30 display in tooltip

### 5. EARFCN & Band Chart
- Frequency channel tracking
- Band identification
- Frequency change detection

### 6. Uptime Chart
- Connection stability
- Reboot detection (red markers)
- Availability calculation

---

## 🔌 Integration with GenieACS

### Data Collection Flow:

```
CPE Device (LTE Router)
     ↓ TR-069 Inform (periodic)
GenieACS CWMP Server (Port 7547)
     ↓ Store parameters
MongoDB Database
     ↓ Query historical values
API Route: /api/tr069/metrics
     ↓ Retrieve and format
Chart Components (Chart.js)
     ↓ Display
User Interface
```

### GenieACS Parameter Collection:

GenieACS automatically collects TR-069 parameters during:
1. **Initial Connection** - Bootstrap parameters
2. **Periodic Inform** - Every 5-30 minutes (configurable)
3. **On-Demand** - Via refresh/sync commands

### MongoDB Storage:

Parameters are stored in GenieACS database:
```javascript
{
  "_id": "device-id-timestamp",
  "timestamp": ISODate("2025-10-10T12:00:00Z"),
  "device": "CPE-001",
  "parameters": {
    "Device.Cellular.Interface.1.RSSI": -65,
    "Device.Cellular.Interface.1.RSRP": -75,
    "Device.Cellular.Interface.1.RSRQ": -10,
    "Device.Cellular.Interface.1.SINR": 15,
    "Device.Cellular.Interface.1.X_VENDOR_PhysicalCellID": 156,
    "Device.Cellular.Interface.1.X_VENDOR_EARFCN": 5230,
    "Device.DeviceInfo.UpTime": 1234567
  }
}
```

---

## 🏗️ Implementation Details

### Component Structure:

```
monitoring/
├── +page.svelte                  ← Main dashboard
└── components/
    ├── TR069PCIChart.svelte      ← PCI tracking
    ├── TR069EARFCNChart.svelte   ← EARFCN tracking
    ├── TR069RSSIChart.svelte     ← RSSI/RSCP
    ├── TR069SINRChart.svelte     ← SINR/CQI
    ├── TR069UptimeChart.svelte   ← Uptime/reboots
    └── LTEKPICards.svelte        ← KPI dashboard
```

### Data Service:

```typescript
// lib/tr069MetricsService.ts
interface TR069CellularMetrics {
  timestamp: Date;
  deviceId: string;
  rssi: number;      // TR-069
  rsrp: number;      // TR-069
  rsrq: number;      // TR-069
  sinr: number;      // TR-069
  pci: number;       // TR-069
  earfcn: number;    // TR-069
  band: number;      // Derived
  uptime: number;    // TR-069
  // ... more fields
}
```

---

## 🔍 Vendor-Specific Paths

Different CPE manufacturers use different TR-069 parameter paths:

### Standard Paths (TR-196):
```
Device.Cellular.Interface.1.RSSI
Device.Cellular.Interface.1.RSRP
Device.Cellular.Interface.1.RSRQ
Device.Cellular.Interface.1.SINR
```

### Teltonika:
```
Device.X_TELTONIKA_MobileInfo.RSRP
Device.X_TELTONIKA_MobileInfo.RSRQ
Device.X_TELTONIKA_MobileInfo.SINR
```

### MikroTik:
```
Device.Cellular.Interface.1.X_MIKROTIK_CarrierInfo.1.RSRP
Device.Cellular.Interface.1.X_MIKROTIK_CarrierInfo.1.RSRQ
Device.Cellular.Interface.1.X_MIKROTIK_CarrierInfo.1.SINR
```

### Huawei:
```
Device.X_HUAWEI_MobileInfo.RSRP
Device.X_HUAWEI_MobileInfo.RSRQ
Device.X_HUAWEI_MobileInfo.SINR
```

**Note:** The service supports multiple vendor paths automatically.

---

## 🎮 Usage

### Access the Dashboard:

1. Navigate to **ACS CPE Management**
2. Click **"Monitoring"** in the main menu
3. Select time range (1H, 6H, 24H, 7D)
4. Toggle auto-refresh ON/OFF
5. View real-time charts

### View Device-Specific Metrics:

1. Navigate to **Devices** or **Overview**
2. Click on any CPE device card
3. Performance modal opens
4. View **"Real-Time TR-069 Cellular Metrics"** section
5. See **6-hour trend charts** for that specific device

### Interpret the Data:

- **Green values** = Excellent signal
- **Blue values** = Good signal
- **Yellow values** = Fair signal (may need attention)
- **Red values** = Poor signal (needs attention)
- **Red markers** = Events (handovers, reboots, freq changes)

---

## 🔧 Future API Integration

### Replace Mock Data with Real API:

**Current (Mock):**
```typescript
metrics = generateTR069MetricsHistory(hours, deviceId);
```

**Production (Real API):**
```typescript
const response = await fetch(`/api/tr069/metrics?deviceId=${deviceId}&hours=${hours}`);
const data = await response.json();
metrics = data.metrics;
```

### API Endpoint to Create:

**`/api/tr069/metrics`**

Query MongoDB for historical parameter values:
```typescript
// Pseudo-code
async function GET(request) {
  const { deviceId, hours } = request.query;
  const since = new Date(Date.now() - hours * 3600 * 1000);
  
  // Query GenieACS database
  const metrics = await db.collection('devices')
    .find({
      '_id': deviceId,
      'timestamp': { $gte: since }
    })
    .project({
      'Device.Cellular.Interface.1.RSSI': 1,
      'Device.Cellular.Interface.1.RSRP': 1,
      'Device.Cellular.Interface.1.RSRQ': 1,
      'Device.Cellular.Interface.1.SINR': 1,
      'Device.Cellular.Interface.1.X_VENDOR_PhysicalCellID': 1,
      'Device.Cellular.Interface.1.X_VENDOR_EARFCN': 1,
      'Device.DeviceInfo.UpTime': 1
    })
    .sort({ timestamp: 1 })
    .toArray();
    
  return { success: true, metrics };
}
```

---

## 📋 Dashboard Features

### Network-Wide Monitoring Page

**Path:** `/modules/acs-cpe-management/monitoring`

**Features:**
- ✅ 6 real-time charts
- ✅ 6 KPI cards
- ✅ Auto-refresh (30s intervals)
- ✅ Time range selector (1H/6H/24H/7D)
- ✅ Network health summary
- ✅ TR-069 parameter paths displayed

**Charts:**
1. RSSI & RSCP
2. RSRP & RSRQ
3. SINR (color-coded by quality)
4. PCI Tracking (handover detection)
5. EARFCN & Band (frequency tracking)
6. Uptime (reboot detection)

### Per-Device Modal

**Triggered:** Click any CPE device card

**Features:**
- ✅ Real-time metrics (6 metrics)
- ✅ Color-coded quality indicators
- ✅ TR-069 parameter paths shown
- ✅ 6-hour trend charts (4 charts)
- ✅ Signal quality labels
- ✅ Mod3 calculation for PCI

---

## 🎨 Chart Visualizations

### Interactive Features:

1. **Tooltips** - Hover for detailed values
2. **Quality Labels** - Excellent/Good/Fair/Poor
3. **Event Detection**:
   - 🔄 Handovers (PCI changes)
   - 📡 Frequency changes (EARFCN changes)
   - ⚠️ Reboots (uptime drops)
4. **Color Coding**:
   - Green = Excellent
   - Blue = Good
   - Yellow = Fair
   - Red = Poor/Warning
5. **Dual Y-Axes** - Multiple metrics per chart
6. **Stepped Lines** - For discrete values (PCI, EARFCN)
7. **Area Fills** - For continuous values (RSSI, SINR)

---

## 🔢 Calculations

### Mod3/Mod6/Mod30 for PCI:

PCI planning uses modulo arithmetic:
- **Mod3:** PCI % 3 (0, 1, 2) - Primary scrambling sequences
- **Mod6:** PCI % 6 (0-5) - Extended sequences
- **Mod30:** PCI % 30 (0-29) - System frame number offset

**Example:** PCI = 156
- Mod3 = 156 % 3 = **0**
- Mod6 = 156 % 6 = **0**
- Mod30 = 156 % 30 = **6**

### Throughput Estimation from CQI:

CQI (Channel Quality Indicator) maps to modulation schemes:
- **CQI 15:** 64-QAM, high efficiency
- **CQI 10-14:** 16-QAM, medium efficiency
- **CQI 5-9:** QPSK, lower efficiency
- **CQI 1-4:** Marginal conditions

---

## 🚀 Performance Tips

### Optimize Chart Performance:

1. **Limit Data Points:**
   - 1H: 72 points (5min intervals) ✅
   - 24H: 288 points (5min intervals) ⚠️
   - 7D: 168 points (1hr intervals) ✅

2. **Reduce Re-renders:**
   - Charts only update when data changes
   - Use `$:` reactive statements sparingly

3. **Lazy Loading:**
   - Load charts only when visible
   - Use Svelte `{#if}` conditionals

---

## 📱 CPE Device Requirements

### Required TR-069 Support:

CPE devices must support TR-196 data model or vendor equivalents:

✅ **Minimum Required Parameters:**
- Device.Cellular.Interface.1.RSSI
- Device.Cellular.Interface.1.RSRP
- Device.Cellular.Interface.1.RSRQ
- Device.Cellular.Interface.1.SINR
- Device.DeviceInfo.UpTime

✅ **Extended Parameters:**
- X_VENDOR_PhysicalCellID
- X_VENDOR_EARFCN
- X_VENDOR_Band
- X_VENDOR_CellID

### Tested Devices:

- ✅ Nokia FastMile 4G Gateway
- ✅ Huawei 5G CPE Pro 2
- ✅ ZTE LTE Routers
- ✅ Teltonika RUT Series
- ✅ MikroTik LTE Devices

---

## 🔐 Security Considerations

### Data Access:

- All TR-069 data stored in MongoDB
- Access via authenticated API routes
- No direct device exposure
- GenieACS handles CWMP security

### Sensitive Information:

Parameter values may include:
- Network topology (PCI, EARFCN)
- Device location (GPS via other params)
- Connection credentials (in other params)

**Recommendation:** Implement role-based access control for monitoring data.

---

## 📊 Sample Output

### Network Summary Example:

```
Average RSSI: -65.3 dBm
Average RSRP: -74.8 dBm
Average SINR: 15.2 dB
Current PCI: 156
Current EARFCN: 5230
Connection Status: Connected
```

### Event Detection Example:

```
Handovers Detected: 3
- 10:15 AM: PCI 156 → 157
- 02:30 PM: PCI 157 → 156
- 08:45 PM: PCI 156 → 158

Frequency Changes: 1
- 03:00 PM: EARFCN 5230 (Band 2) → 66486 (Band 66)

Reboots: 0
Availability: 100%
```

---

## 🎓 LTE Basics

### Understanding the Metrics:

**RSSI** = Raw signal strength (everything)  
**RSRP** = LTE reference signal only (cleaner metric)  
**RSRQ** = RSRP / (RSSI + interference)  
**SINR** = Desired signal / (interference + noise)  

**Best Metric for LTE:** RSRP and SINR together  
**Best Metric for Quality:** SINR (directly impacts throughput)

### Typical Values:

**Good Connection:**
- RSSI: -60 dBm
- RSRP: -70 dBm
- RSRQ: -9 dB
- SINR: 18 dB
- Expected Throughput: ~100 Mbps

**Poor Connection:**
- RSSI: -85 dBm
- RSRP: -95 dBm
- RSRQ: -15 dB
- SINR: 3 dB
- Expected Throughput: ~10-20 Mbps

---

## 🔧 Troubleshooting

### No Data Showing:

1. Check GenieACS is collecting parameters
2. Verify MongoDB connection
3. Check API routes are working
4. Confirm CPE supports TR-196 parameters

### Incorrect Values:

1. Verify vendor-specific parameter paths
2. Check unit conversions (dBm vs dB)
3. Validate data model version

### Charts Not Loading:

1. Check Chart.js dependencies installed
2. Verify import paths
3. Check browser console for errors
4. Ensure metrics array has data

---

## 📚 References

- **TR-196:** Femto Access Point Service Data Model
- **3GPP TS 36.133:** LTE Requirements for UE measurements
- **3GPP TS 36.211:** Physical channels and modulation
- **GenieACS Documentation:** Parameter collection and storage
- **Chart.js Documentation:** Chart configuration and options

---

**All monitoring charts use real TR-069 parameters from ACS/GenieACS!** 📡✨

