export const monitoringDocs = `
<h3>📊 Network Monitoring Module</h3>

<div class="info">
  <strong>Purpose:</strong> Monitor network health, device status, and performance metrics. Track SNMP devices, EPC systems, and network uptime. View real-time alerts and system health.
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#key-features">🎯 Key Features</a></li>
    <li><a href="#getting-started">🚀 Getting Started</a></li>
    <li><a href="#monitoring-views">📊 Monitoring Views</a></li>
    <li><a href="#device-details">🔍 Device Details</a></li>
    <li><a href="#performance-metrics">📈 Performance Metrics</a></li>
    <li><a href="#alert-management">🚨 Alert Management</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
    <li><a href="#getting-devices">📚 Getting Devices to Monitor</a></li>
  </ul>
</div>

<h4 id="key-features">🎯 Key Features</h4>
<ul>
  <li><strong>SNMP Monitoring:</strong> Monitor network equipment via SNMP</li>
  <li><strong>EPC Device Tracking:</strong> Monitor Evolved Packet Core systems</li>
  <li><strong>Uptime Tracking:</strong> Track device and network uptime</li>
  <li><strong>Performance Graphs:</strong> Visualize CPU, memory, throughput metrics</li>
  <li><strong>Geographic Map:</strong> View device locations on interactive map</li>
  <li><strong>Network Topology:</strong> Visualize network connections and topology</li>
  <li><strong>Alert Management:</strong> View and manage network alerts</li>
  <li><strong>Site Details:</strong> View comprehensive site equipment and status</li>
</ul>

<h4 id="getting-started">🚀 Getting Started</h4>

<h4>Step 1: Configure SNMP Devices</h4>
<p>Before devices appear in Monitor, they must be configured in Deploy module:</p>
<ol>
  <li>Go to <strong>Deploy</strong> module</li>
  <li>Right-click on deployed equipment</li>
  <li>Select <strong>"Configure SNMP"</strong></li>
  <li>Enter SNMP credentials:
    <ul>
      <li>SNMP community string (v2c) or username (v3)</li>
      <li>Device IP address</li>
      <li>SNMP version</li>
    </ul>
  </li>
  <li>Test connection</li>
  <li>Save configuration</li>
  <li>Device appears in Monitor module</li>
</ol>

<h4>Step 2: View Network Dashboard</h4>
<p>The dashboard shows:</p>
<ul>
  <li><strong>System Health:</strong> Overall network status</li>
  <li><strong>Active Alerts:</strong> Critical warnings and errors</li>
  <li><strong>Service Status:</strong> SNMP, EPC, and other services</li>
  <li><strong>Key Metrics:</strong> Uptime, device counts, performance</li>
</ul>

<h4>Step 3: Monitor SNMP Devices</h4>
<ol>
  <li>Click <strong>"SNMP Devices"</strong> tab</li>
  <li>View device list:
    <ul>
      <li>Device name and type</li>
      <li>Online/Offline status</li>
      <li>IP address</li>
      <li>Last seen timestamp</li>
      <li>Uptime percentage</li>
    </ul>
  </li>
  <li>Click device to view details</li>
  <li>View performance graphs</li>
</ol>

<h4>Step 4: View Performance Graphs</h4>
<ol>
  <li>Click <strong>"Graphs"</strong> tab</li>
  <li>Select device from dropdown</li>
  <li>View metrics:
    <ul>
      <li>CPU usage over time</li>
      <li>Memory utilization</li>
      <li>Network throughput</li>
      <li>Interface statistics</li>
    </ul>
  </li>
  <li>Adjust time range (1 hour, 24 hours, 7 days)</li>
</ol>

<h4>Step 5: Monitor EPC Devices</h4>
<ol>
  <li>Click <strong>"EPC Devices"</strong> tab</li>
  <li>View EPC systems:
    <ul>
      <li>MME connections</li>
      <li>HSS status</li>
      <li>Active subscribers</li>
      <li>System health</li>
    </ul>
  </li>
  <li>Click device for detailed view</li>
</ol>

<h4>Step 6: View Geographic Map</h4>
<ol>
  <li>Click <strong>"Map"</strong> tab</li>
  <li>View device locations:
    <ul>
      <li>Green markers: Online devices</li>
      <li>Red markers: Offline devices</li>
      <li>Orange markers: Maintenance mode</li>
    </ul>
  </li>
  <li>Click marker for device details</li>
  <li>Right-click for site details</li>
</ol>

<h4 id="monitoring-views">📊 Monitoring Views</h4>

<h4>Geographic View</h4>
<p>Interactive map showing:</p>
<ul>
  <li>All network sites (towers, NOCs)</li>
  <li>Deployed equipment locations</li>
  <li>Device status (color-coded)</li>
  <li>Sectors with uptime data</li>
  <li>CPE devices</li>
  <li>Backhaul equipment</li>
</ul>

<h4>Network Topology View</h4>
<p>Visual network diagram showing:</p>
<ul>
  <li>Device connections</li>
  <li>Network hierarchy</li>
  <li>Backhaul links</li>
  <li>Traffic flow</li>
</ul>

<h4>EPC Devices View</h4>
<p>Evolved Packet Core monitoring:</p>
<ul>
  <li>MME status and connections</li>
  <li>HSS integration status</li>
  <li>Active subscriber counts</li>
  <li>EPC system health</li>
</ul>

<h4>SNMP Graphs View</h4>
<p>Performance visualization:</p>
<ul>
  <li>Multi-device comparison</li>
  <li>Historical trends</li>
  <li>Metric overlays</li>
  <li>Export capabilities</li>
</ul>

<h4 id="device-details">🔍 Device Details</h4>

<h4>Site Details Modal</h4>
<p>Right-click on site marker to view:</p>
<ul>
  <li><strong>Hardware Tab:</strong>
    <ul>
      <li>All deployed hardware</li>
      <li>Equipment serial numbers</li>
      <li>Deployment dates</li>
      <li>Equipment status</li>
    </ul>
  </li>
  <li><strong>Devices Tab:</strong>
    <ul>
      <li>SNMP-configured devices</li>
      <li>Device status and metrics</li>
      <li>Uptime information</li>
    </ul>
  </li>
  <li><strong>Equipment Tab:</strong>
    <ul>
      <li>Network equipment</li>
      <li>Backhaul devices</li>
      <li>Equipment details</li>
    </ul>
  </li>
  <li><strong>Sectors Tab:</strong>
    <ul>
      <li>Configured sectors</li>
      <li>Sector uptime data</li>
      <li>Status information</li>
    </ul>
  </li>
</ul>

<h4 id="performance-metrics">📈 Performance Metrics</h4>

<h4>SNMP Metrics</h4>
<p>Monitored via SNMP:</p>
<ul>
  <li><strong>CPU Usage:</strong> Processor utilization percentage</li>
  <li><strong>Memory Usage:</strong> RAM utilization</li>
  <li><strong>Network Throughput:</strong> Data transfer rates</li>
  <li><strong>Interface Statistics:</strong> Port-level metrics</li>
  <li><strong>Uptime:</strong> System uptime in seconds</li>
</ul>

<h4>EPC Metrics</h4>
<p>Evolved Packet Core metrics:</p>
<ul>
  <li><strong>Active Subscribers:</strong> Current connected users</li>
  <li><strong>MME Connections:</strong> Mobility Management Entity status</li>
  <li><strong>HSS Queries:</strong> Subscriber database queries</li>
  <li><strong>System Load:</strong> EPC system utilization</li>
</ul>

<h4>Uptime Calculation</h4>
<p>Uptime is calculated from:</p>
<ul>
  <li>SNMP device uptime values</li>
  <li>Last seen timestamps</li>
  <li>Device status changes</li>
  <li>Historical data</li>
</ul>

<h4 id="alert-management">🚨 Alert Management</h4>

<h4>Alert Types</h4>
<ul>
  <li><strong>Critical:</strong> Immediate attention required</li>
  <li><strong>Warning:</strong> Potential issues</li>
  <li><strong>Info:</strong> Informational messages</li>
</ul>

<h4>Alert Sources</h4>
<ul>
  <li>SNMP device failures</li>
  <li>EPC connectivity issues</li>
  <li>High CPU/memory usage</li>
  <li>Device offline detection</li>
  <li>Service health checks</li>
</ul>

<h4 id="best-practices">💡 Best Practices</h4>
<ul>
  <li><strong>Configure SNMP First:</strong> Set up SNMP in Deploy before monitoring</li>
  <li><strong>Regular Monitoring:</strong> Check dashboard daily</li>
  <li><strong>Respond to Alerts:</strong> Address critical alerts immediately</li>
  <li><strong>Review Trends:</strong> Analyze performance graphs regularly</li>
  <li><strong>Document Issues:</strong> Record troubleshooting steps</li>
  <li><strong>Maintain Configurations:</strong> Keep SNMP credentials updated</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>No devices showing:</h4>
<ul>
  <li>Verify SNMP is configured in Deploy module</li>
  <li>Check devices are deployed</li>
  <li>Ensure SNMP credentials are correct</li>
  <li>Verify network connectivity</li>
</ul>

<h4>Devices showing offline:</h4>
<ul>
  <li>Check device power and connectivity</li>
  <li>Verify SNMP is enabled on device</li>
  <li>Test SNMP connection manually</li>
  <li>Check firewall rules</li>
  <li>Review device logs</li>
</ul>

<h4>Graphs not loading:</h4>
<ul>
  <li>Verify SNMP data collection is working</li>
  <li>Check time range selection</li>
  <li>Ensure device has historical data</li>
  <li>Refresh page</li>
</ul>

<h4>EPC not showing:</h4>
<ul>
  <li>Verify EPC is deployed in Deploy module</li>
  <li>Check EPC connectivity</li>
  <li>Verify HSS connection</li>
  <li>Review EPC logs</li>
</ul>

<h4 id="getting-devices">📚 Getting Devices to Monitor</h4>

<p>To monitor devices, you need to:</p>
<ol>
  <li>Deploy hardware in the <strong>Deploy</strong> module</li>
  <li>Configure SNMP credentials for network devices</li>
  <li>Deploy EPC systems for LTE core monitoring</li>
  <li>Devices will automatically appear in this module</li>
</ol>

<h4>Auto-Refresh</h4>
<p>The module automatically refreshes every 30 seconds:</p>
<ul>
  <li>Device status updates</li>
  <li>Performance metrics refresh</li>
  <li>Alert status updates</li>
  <li>Uptime calculations update</li>
</ul>

<div class="warning">
  <strong>Important:</strong> Monitoring requires deployed hardware with SNMP or EPC agents configured. If no devices are showing, ensure hardware has been deployed and SNMP/EPC has been configured in the Deploy module.
</div>
`;

export const monitoringDocs = `
<h3>📊 Network Monitoring Module</h3>

<div class="info">
  <strong>Purpose:</strong> Monitor network health, device status, and performance metrics. Track SNMP devices, EPC systems, and network uptime. View real-time alerts and system health.
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#key-features">🎯 Key Features</a></li>
    <li><a href="#getting-started">🚀 Getting Started</a></li>
    <li><a href="#monitoring-views">📊 Monitoring Views</a></li>
    <li><a href="#device-details">🔍 Device Details</a></li>
    <li><a href="#performance-metrics">📈 Performance Metrics</a></li>
    <li><a href="#alert-management">🚨 Alert Management</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
    <li><a href="#getting-devices">📚 Getting Devices to Monitor</a></li>
  </ul>
</div>

<h4 id="key-features">🎯 Key Features</h4>
<ul>
  <li><strong>SNMP Monitoring:</strong> Monitor network equipment via SNMP</li>
  <li><strong>EPC Device Tracking:</strong> Monitor Evolved Packet Core systems</li>
  <li><strong>Uptime Tracking:</strong> Track device and network uptime</li>
  <li><strong>Performance Graphs:</strong> Visualize CPU, memory, throughput metrics</li>
  <li><strong>Geographic Map:</strong> View device locations on interactive map</li>
  <li><strong>Network Topology:</strong> Visualize network connections and topology</li>
  <li><strong>Alert Management:</strong> View and manage network alerts</li>
  <li><strong>Site Details:</strong> View comprehensive site equipment and status</li>
</ul>

<h4 id="getting-started">🚀 Getting Started</h4>

<h4>Step 1: Configure SNMP Devices</h4>
<p>Before devices appear in Monitor, they must be configured in Deploy module:</p>
<ol>
  <li>Go to <strong>Deploy</strong> module</li>
  <li>Right-click on deployed equipment</li>
  <li>Select <strong>"Configure SNMP"</strong></li>
  <li>Enter SNMP credentials:
    <ul>
      <li>SNMP community string (v2c) or username (v3)</li>
      <li>Device IP address</li>
      <li>SNMP version</li>
    </ul>
  </li>
  <li>Test connection</li>
  <li>Save configuration</li>
  <li>Device appears in Monitor module</li>
</ol>

<h4>Step 2: View Network Dashboard</h4>
<p>The dashboard shows:</p>
<ul>
  <li><strong>System Health:</strong> Overall network status</li>
  <li><strong>Active Alerts:</strong> Critical warnings and errors</li>
  <li><strong>Service Status:</strong> SNMP, EPC, and other services</li>
  <li><strong>Key Metrics:</strong> Uptime, device counts, performance</li>
</ul>

<h4>Step 3: Monitor SNMP Devices</h4>
<ol>
  <li>Click <strong>"SNMP Devices"</strong> tab</li>
  <li>View device list:
    <ul>
      <li>Device name and type</li>
      <li>Online/Offline status</li>
      <li>IP address</li>
      <li>Last seen timestamp</li>
      <li>Uptime percentage</li>
    </ul>
  </li>
  <li>Click device to view details</li>
  <li>View performance graphs</li>
</ol>

<h4>Step 4: View Performance Graphs</h4>
<ol>
  <li>Click <strong>"Graphs"</strong> tab</li>
  <li>Select device from dropdown</li>
  <li>View metrics:
    <ul>
      <li>CPU usage over time</li>
      <li>Memory utilization</li>
      <li>Network throughput</li>
      <li>Interface statistics</li>
    </ul>
  </li>
  <li>Adjust time range (1 hour, 24 hours, 7 days)</li>
</ol>

<h4>Step 5: Monitor EPC Devices</h4>
<ol>
  <li>Click <strong>"EPC Devices"</strong> tab</li>
  <li>View EPC systems:
    <ul>
      <li>MME connections</li>
      <li>HSS status</li>
      <li>Active subscribers</li>
      <li>System health</li>
    </ul>
  </li>
  <li>Click device for detailed view</li>
</ol>

<h4>Step 6: View Geographic Map</h4>
<ol>
  <li>Click <strong>"Map"</strong> tab</li>
  <li>View device locations:
    <ul>
      <li>Green markers: Online devices</li>
      <li>Red markers: Offline devices</li>
      <li>Orange markers: Maintenance mode</li>
    </ul>
  </li>
  <li>Click marker for device details</li>
  <li>Right-click for site details</li>
</ol>

<h4 id="monitoring-views">📊 Monitoring Views</h4>

<h4>Geographic View</h4>
<p>Interactive map showing:</p>
<ul>
  <li>All network sites (towers, NOCs)</li>
  <li>Deployed equipment locations</li>
  <li>Device status (color-coded)</li>
  <li>Sectors with uptime data</li>
  <li>CPE devices</li>
  <li>Backhaul equipment</li>
</ul>

<h4>Network Topology View</h4>
<p>Visual network diagram showing:</p>
<ul>
  <li>Device connections</li>
  <li>Network hierarchy</li>
  <li>Backhaul links</li>
  <li>Traffic flow</li>
</ul>

<h4>EPC Devices View</h4>
<p>Evolved Packet Core monitoring:</p>
<ul>
  <li>MME status and connections</li>
  <li>HSS integration status</li>
  <li>Active subscriber counts</li>
  <li>EPC system health</li>
</ul>

<h4>SNMP Graphs View</h4>
<p>Performance visualization:</p>
<ul>
  <li>Multi-device comparison</li>
  <li>Historical trends</li>
  <li>Metric overlays</li>
  <li>Export capabilities</li>
</ul>

<h4 id="device-details">🔍 Device Details</h4>

<h4>Site Details Modal</h4>
<p>Right-click on site marker to view:</p>
<ul>
  <li><strong>Hardware Tab:</strong>
    <ul>
      <li>All deployed hardware</li>
      <li>Equipment serial numbers</li>
      <li>Deployment dates</li>
      <li>Equipment status</li>
    </ul>
  </li>
  <li><strong>Devices Tab:</strong>
    <ul>
      <li>SNMP-configured devices</li>
      <li>Device status and metrics</li>
      <li>Uptime information</li>
    </ul>
  </li>
  <li><strong>Equipment Tab:</strong>
    <ul>
      <li>Network equipment</li>
      <li>Backhaul devices</li>
      <li>Equipment details</li>
    </ul>
  </li>
  <li><strong>Sectors Tab:</strong>
    <ul>
      <li>Configured sectors</li>
      <li>Sector uptime data</li>
      <li>Status information</li>
    </ul>
  </li>
</ul>

<h4 id="performance-metrics">📈 Performance Metrics</h4>

<h4>SNMP Metrics</h4>
<p>Monitored via SNMP:</p>
<ul>
  <li><strong>CPU Usage:</strong> Processor utilization percentage</li>
  <li><strong>Memory Usage:</strong> RAM utilization</li>
  <li><strong>Network Throughput:</strong> Data transfer rates</li>
  <li><strong>Interface Statistics:</strong> Port-level metrics</li>
  <li><strong>Uptime:</strong> System uptime in seconds</li>
</ul>

<h4>EPC Metrics</h4>
<p>Evolved Packet Core metrics:</p>
<ul>
  <li><strong>Active Subscribers:</strong> Current connected users</li>
  <li><strong>MME Connections:</strong> Mobility Management Entity status</li>
  <li><strong>HSS Queries:</strong> Subscriber database queries</li>
  <li><strong>System Load:</strong> EPC system utilization</li>
</ul>

<h4>Uptime Calculation</h4>
<p>Uptime is calculated from:</p>
<ul>
  <li>SNMP device uptime values</li>
  <li>Last seen timestamps</li>
  <li>Device status changes</li>
  <li>Historical data</li>
</ul>

<h4 id="alert-management">🚨 Alert Management</h4>

<h4>Alert Types</h4>
<ul>
  <li><strong>Critical:</strong> Immediate attention required</li>
  <li><strong>Warning:</strong> Potential issues</li>
  <li><strong>Info:</strong> Informational messages</li>
</ul>

<h4>Alert Sources</h4>
<ul>
  <li>SNMP device failures</li>
  <li>EPC connectivity issues</li>
  <li>High CPU/memory usage</li>
  <li>Device offline detection</li>
  <li>Service health checks</li>
</ul>

<h4 id="best-practices">💡 Best Practices</h4>
<ul>
  <li><strong>Configure SNMP First:</strong> Set up SNMP in Deploy before monitoring</li>
  <li><strong>Regular Monitoring:</strong> Check dashboard daily</li>
  <li><strong>Respond to Alerts:</strong> Address critical alerts immediately</li>
  <li><strong>Review Trends:</strong> Analyze performance graphs regularly</li>
  <li><strong>Document Issues:</strong> Record troubleshooting steps</li>
  <li><strong>Maintain Configurations:</strong> Keep SNMP credentials updated</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>No devices showing:</h4>
<ul>
  <li>Verify SNMP is configured in Deploy module</li>
  <li>Check devices are deployed</li>
  <li>Ensure SNMP credentials are correct</li>
  <li>Verify network connectivity</li>
</ul>

<h4>Devices showing offline:</h4>
<ul>
  <li>Check device power and connectivity</li>
  <li>Verify SNMP is enabled on device</li>
  <li>Test SNMP connection manually</li>
  <li>Check firewall rules</li>
  <li>Review device logs</li>
</ul>

<h4>Graphs not loading:</h4>
<ul>
  <li>Verify SNMP data collection is working</li>
  <li>Check time range selection</li>
  <li>Ensure device has historical data</li>
  <li>Refresh page</li>
</ul>

<h4>EPC not showing:</h4>
<ul>
  <li>Verify EPC is deployed in Deploy module</li>
  <li>Check EPC connectivity</li>
  <li>Verify HSS connection</li>
  <li>Review EPC logs</li>
</ul>

<h4 id="getting-devices">📚 Getting Devices to Monitor</h4>

<p>To monitor devices, you need to:</p>
<ol>
  <li>Deploy hardware in the <strong>Deploy</strong> module</li>
  <li>Configure SNMP credentials for network devices</li>
  <li>Deploy EPC systems for LTE core monitoring</li>
  <li>Devices will automatically appear in this module</li>
</ol>

<h4>Auto-Refresh</h4>
<p>The module automatically refreshes every 30 seconds:</p>
<ul>
  <li>Device status updates</li>
  <li>Performance metrics refresh</li>
  <li>Alert status updates</li>
  <li>Uptime calculations update</li>
</ul>

<div class="warning">
  <strong>Important:</strong> Monitoring requires deployed hardware with SNMP or EPC agents configured. If no devices are showing, ensure hardware has been deployed and SNMP/EPC has been configured in the Deploy module.
</div>
`;

export const monitoringDocs = `
<h3>📊 Network Monitoring Module</h3>

<div class="info">
  <strong>Purpose:</strong> Monitor network health, device status, and performance metrics. Track SNMP devices, EPC systems, and network uptime. View real-time alerts and system health.
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#key-features">🎯 Key Features</a></li>
    <li><a href="#getting-started">🚀 Getting Started</a></li>
    <li><a href="#monitoring-views">📊 Monitoring Views</a></li>
    <li><a href="#device-details">🔍 Device Details</a></li>
    <li><a href="#performance-metrics">📈 Performance Metrics</a></li>
    <li><a href="#alert-management">🚨 Alert Management</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
    <li><a href="#getting-devices">📚 Getting Devices to Monitor</a></li>
  </ul>
</div>

<h4 id="key-features">🎯 Key Features</h4>
<ul>
  <li><strong>SNMP Monitoring:</strong> Monitor network equipment via SNMP</li>
  <li><strong>EPC Device Tracking:</strong> Monitor Evolved Packet Core systems</li>
  <li><strong>Uptime Tracking:</strong> Track device and network uptime</li>
  <li><strong>Performance Graphs:</strong> Visualize CPU, memory, throughput metrics</li>
  <li><strong>Geographic Map:</strong> View device locations on interactive map</li>
  <li><strong>Network Topology:</strong> Visualize network connections and topology</li>
  <li><strong>Alert Management:</strong> View and manage network alerts</li>
  <li><strong>Site Details:</strong> View comprehensive site equipment and status</li>
</ul>

<h4 id="getting-started">🚀 Getting Started</h4>

<h4>Step 1: Configure SNMP Devices</h4>
<p>Before devices appear in Monitor, they must be configured in Deploy module:</p>
<ol>
  <li>Go to <strong>Deploy</strong> module</li>
  <li>Right-click on deployed equipment</li>
  <li>Select <strong>"Configure SNMP"</strong></li>
  <li>Enter SNMP credentials:
    <ul>
      <li>SNMP community string (v2c) or username (v3)</li>
      <li>Device IP address</li>
      <li>SNMP version</li>
    </ul>
  </li>
  <li>Test connection</li>
  <li>Save configuration</li>
  <li>Device appears in Monitor module</li>
</ol>

<h4>Step 2: View Network Dashboard</h4>
<p>The dashboard shows:</p>
<ul>
  <li><strong>System Health:</strong> Overall network status</li>
  <li><strong>Active Alerts:</strong> Critical warnings and errors</li>
  <li><strong>Service Status:</strong> SNMP, EPC, and other services</li>
  <li><strong>Key Metrics:</strong> Uptime, device counts, performance</li>
</ul>

<h4>Step 3: Monitor SNMP Devices</h4>
<ol>
  <li>Click <strong>"SNMP Devices"</strong> tab</li>
  <li>View device list:
    <ul>
      <li>Device name and type</li>
      <li>Online/Offline status</li>
      <li>IP address</li>
      <li>Last seen timestamp</li>
      <li>Uptime percentage</li>
    </ul>
  </li>
  <li>Click device to view details</li>
  <li>View performance graphs</li>
</ol>

<h4>Step 4: View Performance Graphs</h4>
<ol>
  <li>Click <strong>"Graphs"</strong> tab</li>
  <li>Select device from dropdown</li>
  <li>View metrics:
    <ul>
      <li>CPU usage over time</li>
      <li>Memory utilization</li>
      <li>Network throughput</li>
      <li>Interface statistics</li>
    </ul>
  </li>
  <li>Adjust time range (1 hour, 24 hours, 7 days)</li>
</ol>

<h4>Step 5: Monitor EPC Devices</h4>
<ol>
  <li>Click <strong>"EPC Devices"</strong> tab</li>
  <li>View EPC systems:
    <ul>
      <li>MME connections</li>
      <li>HSS status</li>
      <li>Active subscribers</li>
      <li>System health</li>
    </ul>
  </li>
  <li>Click device for detailed view</li>
</ol>

<h4>Step 6: View Geographic Map</h4>
<ol>
  <li>Click <strong>"Map"</strong> tab</li>
  <li>View device locations:
    <ul>
      <li>Green markers: Online devices</li>
      <li>Red markers: Offline devices</li>
      <li>Orange markers: Maintenance mode</li>
    </ul>
  </li>
  <li>Click marker for device details</li>
  <li>Right-click for site details</li>
</ol>

<h4 id="monitoring-views">📊 Monitoring Views</h4>

<h4>Geographic View</h4>
<p>Interactive map showing:</p>
<ul>
  <li>All network sites (towers, NOCs)</li>
  <li>Deployed equipment locations</li>
  <li>Device status (color-coded)</li>
  <li>Sectors with uptime data</li>
  <li>CPE devices</li>
  <li>Backhaul equipment</li>
</ul>

<h4>Network Topology View</h4>
<p>Visual network diagram showing:</p>
<ul>
  <li>Device connections</li>
  <li>Network hierarchy</li>
  <li>Backhaul links</li>
  <li>Traffic flow</li>
</ul>

<h4>EPC Devices View</h4>
<p>Evolved Packet Core monitoring:</p>
<ul>
  <li>MME status and connections</li>
  <li>HSS integration status</li>
  <li>Active subscriber counts</li>
  <li>EPC system health</li>
</ul>

<h4>SNMP Graphs View</h4>
<p>Performance visualization:</p>
<ul>
  <li>Multi-device comparison</li>
  <li>Historical trends</li>
  <li>Metric overlays</li>
  <li>Export capabilities</li>
</ul>

<h4 id="device-details">🔍 Device Details</h4>

<h4>Site Details Modal</h4>
<p>Right-click on site marker to view:</p>
<ul>
  <li><strong>Hardware Tab:</strong>
    <ul>
      <li>All deployed hardware</li>
      <li>Equipment serial numbers</li>
      <li>Deployment dates</li>
      <li>Equipment status</li>
    </ul>
  </li>
  <li><strong>Devices Tab:</strong>
    <ul>
      <li>SNMP-configured devices</li>
      <li>Device status and metrics</li>
      <li>Uptime information</li>
    </ul>
  </li>
  <li><strong>Equipment Tab:</strong>
    <ul>
      <li>Network equipment</li>
      <li>Backhaul devices</li>
      <li>Equipment details</li>
    </ul>
  </li>
  <li><strong>Sectors Tab:</strong>
    <ul>
      <li>Configured sectors</li>
      <li>Sector uptime data</li>
      <li>Status information</li>
    </ul>
  </li>
</ul>

<h4 id="performance-metrics">📈 Performance Metrics</h4>

<h4>SNMP Metrics</h4>
<p>Monitored via SNMP:</p>
<ul>
  <li><strong>CPU Usage:</strong> Processor utilization percentage</li>
  <li><strong>Memory Usage:</strong> RAM utilization</li>
  <li><strong>Network Throughput:</strong> Data transfer rates</li>
  <li><strong>Interface Statistics:</strong> Port-level metrics</li>
  <li><strong>Uptime:</strong> System uptime in seconds</li>
</ul>

<h4>EPC Metrics</h4>
<p>Evolved Packet Core metrics:</p>
<ul>
  <li><strong>Active Subscribers:</strong> Current connected users</li>
  <li><strong>MME Connections:</strong> Mobility Management Entity status</li>
  <li><strong>HSS Queries:</strong> Subscriber database queries</li>
  <li><strong>System Load:</strong> EPC system utilization</li>
</ul>

<h4>Uptime Calculation</h4>
<p>Uptime is calculated from:</p>
<ul>
  <li>SNMP device uptime values</li>
  <li>Last seen timestamps</li>
  <li>Device status changes</li>
  <li>Historical data</li>
</ul>

<h4 id="alert-management">🚨 Alert Management</h4>

<h4>Alert Types</h4>
<ul>
  <li><strong>Critical:</strong> Immediate attention required</li>
  <li><strong>Warning:</strong> Potential issues</li>
  <li><strong>Info:</strong> Informational messages</li>
</ul>

<h4>Alert Sources</h4>
<ul>
  <li>SNMP device failures</li>
  <li>EPC connectivity issues</li>
  <li>High CPU/memory usage</li>
  <li>Device offline detection</li>
  <li>Service health checks</li>
</ul>

<h4 id="best-practices">💡 Best Practices</h4>
<ul>
  <li><strong>Configure SNMP First:</strong> Set up SNMP in Deploy before monitoring</li>
  <li><strong>Regular Monitoring:</strong> Check dashboard daily</li>
  <li><strong>Respond to Alerts:</strong> Address critical alerts immediately</li>
  <li><strong>Review Trends:</strong> Analyze performance graphs regularly</li>
  <li><strong>Document Issues:</strong> Record troubleshooting steps</li>
  <li><strong>Maintain Configurations:</strong> Keep SNMP credentials updated</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>No devices showing:</h4>
<ul>
  <li>Verify SNMP is configured in Deploy module</li>
  <li>Check devices are deployed</li>
  <li>Ensure SNMP credentials are correct</li>
  <li>Verify network connectivity</li>
</ul>

<h4>Devices showing offline:</h4>
<ul>
  <li>Check device power and connectivity</li>
  <li>Verify SNMP is enabled on device</li>
  <li>Test SNMP connection manually</li>
  <li>Check firewall rules</li>
  <li>Review device logs</li>
</ul>

<h4>Graphs not loading:</h4>
<ul>
  <li>Verify SNMP data collection is working</li>
  <li>Check time range selection</li>
  <li>Ensure device has historical data</li>
  <li>Refresh page</li>
</ul>

<h4>EPC not showing:</h4>
<ul>
  <li>Verify EPC is deployed in Deploy module</li>
  <li>Check EPC connectivity</li>
  <li>Verify HSS connection</li>
  <li>Review EPC logs</li>
</ul>

<h4 id="getting-devices">📚 Getting Devices to Monitor</h4>

<p>To monitor devices, you need to:</p>
<ol>
  <li>Deploy hardware in the <strong>Deploy</strong> module</li>
  <li>Configure SNMP credentials for network devices</li>
  <li>Deploy EPC systems for LTE core monitoring</li>
  <li>Devices will automatically appear in this module</li>
</ol>

<h4>Auto-Refresh</h4>
<p>The module automatically refreshes every 30 seconds:</p>
<ul>
  <li>Device status updates</li>
  <li>Performance metrics refresh</li>
  <li>Alert status updates</li>
  <li>Uptime calculations update</li>
</ul>

<div class="warning">
  <strong>Important:</strong> Monitoring requires deployed hardware with SNMP or EPC agents configured. If no devices are showing, ensure hardware has been deployed and SNMP/EPC has been configured in the Deploy module.
</div>
`;







