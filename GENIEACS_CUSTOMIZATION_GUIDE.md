# 🎨 GenieACS Customization Guide

## Yes, You Can Customize GenieACS from NPM!

GenieACS installed via NPM is fully customizable through:
1. Configuration files
2. Extensions (custom scripts)
3. Provisions (device templates)
4. Virtual parameters
5. Custom integrations

---

## 🎯 Customization for Your LTE WISP Use Case

### **What You Can Customize:**

1. ✅ **Device Discovery** - Auto-detect LTE parameters (EARFCN, PCI, RSSI)
2. ✅ **PCI Management** - Extract and manage PCI values
3. ✅ **Location Tracking** - GPS coordinates from CPE devices
4. ✅ **Performance Monitoring** - Signal strength, throughput, SINR
5. ✅ **Firmware Management** - Automated updates
6. ✅ **Custom UI** - Integrate with your frontend
7. ✅ **API Integration** - Connect to your PCI resolution module

---

## 📁 GenieACS Directory Structure

When installed via NPM, customizations go here:

```
/opt/genieacs/
├── ext/                    # Extensions (custom scripts)
│   ├── provisions/         # Device provisioning scripts
│   ├── virtual-parameters/ # Custom parameters
│   └── extensions/         # Custom functions
├── config/
│   └── config.json        # Main configuration
└── firmware/              # Firmware files for download
```

---

## 🔧 Customization Methods

### **1. Configuration File (`config.json`)**

```bash
# Create config directory
sudo mkdir -p /opt/genieacs/config
cd /opt/genieacs/config

# Create config.json
cat > config.json << 'EOF'
{
  "MONGODB_CONNECTION_URL": "mongodb+srv://...",
  "CWMP_PORT": 7547,
  "CWMP_INTERFACE": "0.0.0.0",
  "NBI_PORT": 7557,
  "FS_PORT": 7567,
  "UI_PORT": 3000,
  
  "LOG_LEVEL": "info",
  
  "EXT_DIR": "/opt/genieacs/ext",
  
  "FS_HOSTNAME": "your-domain.com",
  "FS_SSL": true,
  
  "UI_JWT_SECRET": "your-secret-key",
  
  "CUSTOM_COMMANDS": {
    "reboot": true,
    "factoryReset": true,
    "download": true
  }
}
EOF
```

### **2. Virtual Parameters (Custom Device Info)**

Extract custom data from TR-069 parameters:

```bash
mkdir -p /opt/genieacs/ext/virtual-parameters

# Create LTE-specific virtual parameters
cat > /opt/genieacs/ext/virtual-parameters/lte-info.js << 'EOF'
// Extract LTE PCI value
const pci = declare("Device.X_LTE.Cell.PCI", {value: now});
return pci.value[0];
EOF

cat > /opt/genieacs/ext/virtual-parameters/signal-strength.js << 'EOF'
// Calculate signal strength quality
const rssi = declare("Device.X_LTE.Cell.RSSI", {value: now});
const rssiValue = rssi.value[0];

if (rssiValue > -70) return "Excellent";
if (rssiValue > -85) return "Good";
if (rssiValue > -100) return "Fair";
return "Poor";
EOF

cat > /opt/genieacs/ext/virtual-parameters/gps-location.js << 'EOF'
// Get GPS coordinates
const lat = declare("Device.X_GPS.Latitude", {value: now});
const lon = declare("Device.X_GPS.Longitude", {value: now});

return {
  latitude: lat.value[0],
  longitude: lon.value[0],
  timestamp: Date.now()
};
EOF
```

### **3. Provisions (Auto-Configuration Templates)**

Automate device configuration:

```bash
mkdir -p /opt/genieacs/ext/provisions

# Create provision for LTE monitoring
cat > /opt/genieacs/ext/provisions/lte-monitoring.js << 'EOF'
// Provision: LTE Monitoring Setup
// Runs when device connects

const now = Date.now();

// Refresh LTE parameters every 5 minutes
declare("Device.X_LTE.Cell.PCI", {value: now}, {value: now + 300000});
declare("Device.X_LTE.Cell.EARFCN", {value: now}, {value: now + 300000});
declare("Device.X_LTE.Cell.RSSI", {value: now}, {value: now + 300000});
declare("Device.X_LTE.Cell.RSRP", {value: now}, {value: now + 300000});
declare("Device.X_LTE.Cell.RSRQ", {value: now}, {value: now + 300000});
declare("Device.X_LTE.Cell.SINR", {value: now}, {value: now + 300000});

// Set inform interval to 5 minutes
declare("Device.ManagementServer.PeriodicInformInterval", {value: now}, {value: 300});

log("LTE monitoring enabled");
EOF

# Create provision for firmware updates
cat > /opt/genieacs/ext/provisions/firmware-check.js << 'EOF'
// Check if firmware update is needed
const currentVersion = declare("Device.DeviceInfo.SoftwareVersion", {value: now});
const targetVersion = "1.2.3"; // Your target version

if (currentVersion.value[0] !== targetVersion) {
  log("Firmware update needed: " + currentVersion.value[0] + " -> " + targetVersion);
  
  // Schedule download
  declare("Downloads.[FileType:1 Firmware Upgrade Image]", {path: 1}, {path: 1});
  declare("Downloads.[FileType:1 Firmware Upgrade Image].URL", {value: 1}, 
    {value: "http://your-server.com/firmware/latest.bin"});
  declare("Downloads.[FileType:1 Firmware Upgrade Image].Download", {value: now}, {value: 1});
}
EOF
```

### **4. Extensions (Custom Functions)**

Add custom business logic:

```bash
mkdir -p /opt/genieacs/ext/extensions

# Create extension for PCI conflict detection
cat > /opt/genieacs/ext/extensions/pci-conflict.js << 'EOF'
// Extension: Check for PCI conflicts
const devices = ext.query("Device.X_LTE.Cell.PCI", {value: 1});

const pciMap = {};
const conflicts = [];

devices.forEach(device => {
  const pci = device["Device.X_LTE.Cell.PCI"];
  if (pciMap[pci]) {
    conflicts.push({
      pci: pci,
      device1: pciMap[pci],
      device2: device._id
    });
  } else {
    pciMap[pci] = device._id;
  }
});

return {
  conflicts: conflicts,
  totalDevices: devices.length
};
EOF
```

---

## 🔌 Integration with Your Frontend

### **Method 1: REST API (GenieACS NBI)**

Your frontend can query GenieACS directly:

```javascript
// In your frontend (Module_Manager)
import { genieacsClient } from '$lib/api/genieacsClient';

// Get all devices with LTE info
const devices = await genieacsClient.getDevices({
  query: {
    'Device.X_LTE.Cell.PCI': { $exists: true }
  },
  projection: {
    'Device.X_LTE.Cell.PCI': 1,
    'Device.X_LTE.Cell.EARFCN': 1,
    'Device.X_LTE.Cell.RSSI': 1,
    'Device.X_GPS.Latitude': 1,
    'Device.X_GPS.Longitude': 1
  }
});

// Extract PCI values for conflict detection
const pciData = devices.map(d => ({
  deviceId: d._id,
  pci: d['Device.X_LTE.Cell.PCI']._value,
  earfcn: d['Device.X_LTE.Cell.EARFCN']._value,
  location: {
    lat: d['Device.X_GPS.Latitude']._value,
    lon: d['Device.X_GPS.Longitude']._value
  }
}));

// Send to your PCI resolution module
await analyzePCIConflicts(pciData);
```

### **Method 2: Backend API (Custom Integration)**

Create custom endpoints in your Backend API:

```javascript
// /opt/backend-api/server.js

// Endpoint to get LTE devices for PCI analysis
app.get('/api/lte/devices', async (req, res) => {
  try {
    // Query GenieACS NBI
    const response = await fetch('http://localhost:7557/devices?query={"Device.X_LTE.Cell.PCI":{"$exists":true}}');
    const devices = await response.json();
    
    // Transform for your frontend
    const lteDevices = devices.map(d => ({
      id: d._id,
      pci: d['Device.X_LTE.Cell.PCI']?._value,
      earfcn: d['Device.X_LTE.Cell.EARFCN']?._value,
      rssi: d['Device.X_LTE.Cell.RSSI']?._value,
      location: {
        lat: parseFloat(d['Device.X_GPS.Latitude']?._value),
        lon: parseFloat(d['Device.X_GPS.Longitude']?._value)
      },
      lastInform: d._lastInform
    }));
    
    res.json(lteDevices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to update device PCI
app.post('/api/lte/device/:id/pci', async (req, res) => {
  const { id } = req.params;
  const { pci } = req.body;
  
  try {
    // Create task to set PCI via GenieACS
    const task = await fetch('http://localhost:7557/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'setParameterValues',
        device: id,
        parameterValues: [
          ['Device.X_LTE.Cell.PCI', pci, 'xsd:string']
        ]
      })
    });
    
    res.json({ success: true, taskId: (await task.json())._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📊 Custom Database Queries

Query MongoDB directly for advanced analytics:

```javascript
// In your backend
const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db('genieacs');

// Query devices with specific PCI values
const devices = await db.collection('devices').find({
  'Device.X_LTE.Cell.PCI._value': { $in: [10, 11, 12] }
}).toArray();

// Aggregate by PCI for conflict detection
const pciAggregation = await db.collection('devices').aggregate([
  {
    $match: {
      'Device.X_LTE.Cell.PCI._value': { $exists: true }
    }
  },
  {
    $group: {
      _id: '$Device.X_LTE.Cell.PCI._value',
      count: { $sum: 1 },
      devices: { $push: '$_id' }
    }
  },
  {
    $match: {
      count: { $gt: 1 } // PCI conflicts
    }
  }
]).toArray();
```

---

## 🎨 Custom UI Integration

### **Option 1: Use GenieACS UI as-is**

Access at: `http://your-server:3000`

### **Option 2: Embed in Your Frontend**

```svelte
<!-- Module_Manager/src/routes/modules/acs-cpe-management/+page.svelte -->

<script>
  import { onMount } from 'svelte';
  import { genieacsClient } from '$lib/api/genieacsClient';
  
  let devices = [];
  let pciConflicts = [];
  
  onMount(async () => {
    // Get devices from GenieACS
    devices = await genieacsClient.getDevices();
    
    // Analyze PCI conflicts
    pciConflicts = analyzePCI(devices);
  });
  
  function analyzePCI(devices) {
    const pciMap = {};
    const conflicts = [];
    
    devices.forEach(d => {
      const pci = d['Device.X_LTE.Cell.PCI']?._value;
      if (pci) {
        if (pciMap[pci]) {
          conflicts.push({
            pci,
            devices: [pciMap[pci], d._id]
          });
        } else {
          pciMap[pci] = d._id;
        }
      }
    });
    
    return conflicts;
  }
</script>

<div class="genieacs-integration">
  <h2>LTE Device Management</h2>
  
  {#if pciConflicts.length > 0}
    <div class="alert">
      ⚠️ {pciConflicts.length} PCI conflicts detected!
    </div>
  {/if}
  
  <div class="device-grid">
    {#each devices as device}
      <DeviceCard {device} />
    {/each}
  </div>
</div>
```

### **Option 3: Custom Dashboard**

Build a completely custom UI using GenieACS NBI API.

---

## 🚀 Deployment Configuration

### **Install with Customizations:**

```bash
# Install GenieACS
sudo npm install -g genieacs

# Create directory structure
sudo mkdir -p /opt/genieacs/{ext/{provisions,virtual-parameters,extensions},config,firmware}

# Set ownership
sudo chown -R $USER:$USER /opt/genieacs

# Copy your customizations
cp -r your-provisions/* /opt/genieacs/ext/provisions/
cp -r your-virtual-parameters/* /opt/genieacs/ext/virtual-parameters/
cp config.json /opt/genieacs/config/

# Set environment variable
export GENIEACS_EXT_DIR=/opt/genieacs/ext

# Start services
genieacs-cwmp &
genieacs-nbi &
genieacs-fs &
genieacs-ui &
```

---

## 📝 Example: Complete LTE Monitoring Setup

```bash
#!/bin/bash
# Setup GenieACS with LTE monitoring customizations

# 1. Install GenieACS
sudo npm install -g genieacs

# 2. Create structure
sudo mkdir -p /opt/genieacs/{ext/{provisions,virtual-parameters},config,firmware}
sudo chown -R $USER:$USER /opt/genieacs

# 3. Configure
cat > /opt/genieacs/config/config.json << EOF
{
  "MONGODB_CONNECTION_URL": "${MONGODB_URI}",
  "EXT_DIR": "/opt/genieacs/ext",
  "CWMP_PORT": 7547,
  "NBI_PORT": 7557
}
EOF

# 4. Add LTE provisions
cat > /opt/genieacs/ext/provisions/lte-monitoring.js << 'EOF'
// Monitor LTE parameters
declare("Device.X_LTE.Cell.*", {value: now}, {value: now + 300000});
log("LTE monitoring enabled");
EOF

# 5. Add virtual parameters
cat > /opt/genieacs/ext/virtual-parameters/pci.js << 'EOF'
const pci = declare("Device.X_LTE.Cell.PCI", {value: now});
return pci.value[0];
EOF

# 6. Start services
export GENIEACS_EXT_DIR=/opt/genieacs/ext
genieacs-cwmp &
genieacs-nbi &
genieacs-fs &
genieacs-ui &

echo "✅ GenieACS with LTE customizations running!"
```

---

## ✅ Benefits of Customization

1. ✅ **PCI Management** - Auto-extract and monitor PCI values
2. ✅ **Location Tracking** - GPS from devices to your map
3. ✅ **Performance Metrics** - Signal strength, SINR, throughput
4. ✅ **Automated Config** - Push PCI changes to devices
5. ✅ **Integration** - Direct connection to your PCI resolution module
6. ✅ **Monitoring** - Real-time LTE network status
7. ✅ **Firmware Management** - Automated updates

---

## 🎯 Answer: YES!

**GenieACS from NPM is fully customizable** and perfect for your LTE WISP use case. You can:

- Extract LTE parameters (PCI, EARFCN, RSSI)
- Integrate with your PCI resolution module
- Auto-configure devices
- Build custom dashboards
- Monitor network performance
- Manage firmware updates

**All without modifying GenieACS source code!**

---

**Ready to set it up with customizations?** Let me know and I'll help you implement!


