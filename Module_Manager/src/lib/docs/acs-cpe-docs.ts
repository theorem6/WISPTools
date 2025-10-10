export const acsCpeDocs = `
<h3>📡 ACS CPE Management Module</h3>

<div class="info">
  <strong>Purpose:</strong> Manage TR-069 Customer Premise Equipment (CPE) devices using GenieACS Auto-Configuration Server (ACS). Monitor device status, configure parameters, and track device locations with GPS mapping.
</div>

<h4>🎯 Key Features</h4>
<ul>
  <li><strong>Device Discovery:</strong> Automatically discover CPE devices via TR-069</li>
  <li><strong>GPS Mapping:</strong> View device locations on interactive ArcGIS map</li>
  <li><strong>Real-Time Status:</strong> Monitor online/offline status and last contact time</li>
  <li><strong>Parameter Management:</strong> Read and write device parameters remotely</li>
  <li><strong>Fault Management:</strong> Track and acknowledge device faults</li>
  <li><strong>Preset Management:</strong> Create and apply configuration templates</li>
</ul>

<h4>🚀 Getting Started</h4>

<h4>Step 1: Ensure GenieACS Services Are Running</h4>
<p>Navigate to <strong>Administration → Service Status</strong> to verify:</p>
<ul>
  <li>✅ CWMP Server (Port 7547) - Running</li>
  <li>✅ NBI API (Port 7557) - Running</li>
  <li>✅ File Server (Port 7567) - Running</li>
  <li>✅ Web UI (Port 3000) - Running</li>
</ul>

<h4>Step 2: Configure CPE Devices</h4>
<p>Point your CPE devices to the ACS URL:</p>
<pre><code>ACS URL: https://your-app.web.app/cwmp
ACS Username: (optional)
ACS Password: (optional)</code></pre>

<div class="info">
  <strong>Note:</strong> The <code>/cwmp</code> endpoint proxies to the internal GenieACS CWMP server running on port 7547.
</div>

<h4>Step 3: Wait for Device Discovery</h4>
<p>Devices will automatically appear in the device list once they connect and perform the initial inform.</p>

<h4>🗺️ Map View</h4>

<h4>GPS-Enabled Devices:</h4>
<ul>
  <li><strong>Green Markers:</strong> Online devices</li>
  <li><strong>Red Markers:</strong> Offline devices</li>
  <li><strong>Click Marker:</strong> View device details popup</li>
  <li><strong>Performance Icon:</strong> Open full performance modal</li>
</ul>

<h4>Map Controls:</h4>
<ul>
  <li><strong>Zoom:</strong> Mouse wheel or +/- buttons</li>
  <li><strong>Pan:</strong> Click and drag</li>
  <li><strong>Basemap:</strong> Switch between street, satellite, hybrid views</li>
  <li><strong>Auto-Fit:</strong> Automatically centers on all devices</li>
</ul>

<h4>📊 Device Management</h4>

<h4>View Devices:</h4>
<p>Navigate to <strong>Devices</strong> tab to see:</p>
<ul>
  <li>Device ID and manufacturer</li>
  <li>Online/Offline status</li>
  <li>Last contact time</li>
  <li>IP address and connection info</li>
  <li>Software and hardware versions</li>
</ul>

<h4>Device Actions:</h4>
<ul>
  <li><strong>View Details:</strong> Click device row for full information</li>
  <li><strong>Refresh:</strong> Trigger parameter refresh</li>
  <li><strong>Reboot:</strong> Remotely reboot device</li>
  <li><strong>Factory Reset:</strong> Reset device to defaults</li>
  <li><strong>Apply Preset:</strong> Apply configuration template</li>
</ul>

<h4>⚙️ Preset Management</h4>

<p>Presets are configuration templates that can be applied to multiple devices.</p>

<h4>Create Preset:</h4>
<ol>
  <li>Navigate to <strong>Administration → Presets</strong></li>
  <li>Click <strong>"Create New Preset"</strong></li>
  <li>Enter preset name and description</li>
  <li>Define parameter paths and values</li>
  <li>Set preconditions (optional)</li>
  <li>Save preset</li>
</ol>

<h4>Preset Structure:</h4>
<pre><code>{
  "name": "Standard CPE Config",
  "configurations": [
    {
      "type": "value",
      "name": "InternetGatewayDevice.ManagementServer.PeriodicInformEnable",
      "value": "true"
    },
    {
      "type": "value", 
      "name": "InternetGatewayDevice.ManagementServer.PeriodicInformInterval",
      "value": "300"
    }
  ]
}</code></pre>

<h4>Apply Preset:</h4>
<ul>
  <li>Select devices from device list</li>
  <li>Choose preset from dropdown</li>
  <li>Click "Apply"</li>
  <li>Monitor application progress</li>
</ul>

<h4>🚨 Fault Management</h4>

<p>Track and manage device faults reported via TR-069.</p>

<h4>Fault Types:</h4>
<ul>
  <li><strong>Connection Faults:</strong> Device unable to connect</li>
  <li><strong>Parameter Faults:</strong> Invalid parameter values</li>
  <li><strong>Hardware Faults:</strong> Device hardware issues</li>
  <li><strong>Software Faults:</strong> Firmware or configuration errors</li>
</ul>

<h4>Fault Actions:</h4>
<ul>
  <li><strong>View Details:</strong> Click fault for full information</li>
  <li><strong>Acknowledge:</strong> Mark fault as seen</li>
  <li><strong>Resolve:</strong> Fix underlying issue</li>
  <li><strong>Delete:</strong> Remove resolved faults</li>
</ul>

<h4>🔧 Administration</h4>

<h4>Service Status:</h4>
<p>Monitor all GenieACS services in real-time:</p>
<ul>
  <li>Service health checks</li>
  <li>Response times</li>
  <li>Last check timestamp</li>
  <li>Restart capabilities</li>
</ul>

<h4>Database Management:</h4>
<p>Initialize and manage MongoDB database:</p>
<ul>
  <li>View collection statistics</li>
  <li>Initialize sample data</li>
  <li>Create test presets and faults</li>
  <li>Database connection status</li>
</ul>

<h4>Setup:</h4>
<p>View GenieACS deployment status and configuration</p>

<h4>📡 API Endpoints</h4>

<h4>Exposed via Proxy Routes:</h4>
<ul>
  <li><code>/cwmp/*</code> - TR-069 CWMP endpoint (port 7547)</li>
  <li><code>/nbi/*</code> - NBI REST API (port 7557)</li>
  <li><code>/fs/*</code> - File server for firmware (port 7567)</li>
</ul>

<h4>SvelteKit API Routes:</h4>
<ul>
  <li><code>/api/genieacs/status</code> - Service health status</li>
  <li><code>/api/mongo/presets/*</code> - Preset CRUD operations</li>
  <li><code>/api/mongo/faults/*</code> - Fault management</li>
  <li><code>/api/mongo/database/*</code> - Database operations</li>
</ul>

<h4>🔐 Security</h4>

<div class="warning">
  <strong>Important:</strong> 
  <ul>
    <li>Change default MongoDB password in environment variables</li>
    <li>Enable Firebase Authentication for production</li>
    <li>Restrict MongoDB Atlas network access</li>
    <li>Use HTTPS for all CPE connections</li>
    <li>Review GenieACS security best practices</li>
  </ul>
</div>

<h4>🔍 Troubleshooting</h4>

<h4>Devices not appearing:</h4>
<ul>
  <li>Verify GenieACS services are running (check Administration → Service Status)</li>
  <li>Ensure CPE devices are configured with correct ACS URL</li>
  <li>Check device can reach the server (network connectivity)</li>
  <li>Verify MongoDB is accessible and database exists</li>
  <li>Check Firebase App Hosting logs for errors</li>
</ul>

<h4>Can't apply presets:</h4>
<ul>
  <li>Verify device is online</li>
  <li>Check parameter paths are correct for device model</li>
  <li>Review preset structure matches device data model</li>
</ul>

<h4>Map not loading devices:</h4>
<ul>
  <li>Ensure devices have GPS coordinates</li>
  <li>Check ArcGIS API key is valid</li>
  <li>Verify device location data format</li>
</ul>

<h4>💡 Best Practices</h4>
<ul>
  <li><strong>Regular Monitoring:</strong> Check device status daily</li>
  <li><strong>Preset Testing:</strong> Test presets on single device before bulk apply</li>
  <li><strong>Backup Configurations:</strong> Export device configs before changes</li>
  <li><strong>Fault Response:</strong> Acknowledge and resolve faults promptly</li>
  <li><strong>Database Maintenance:</strong> Regularly check database health</li>
  <li><strong>Service Monitoring:</strong> Set up alerts for service failures</li>
</ul>

<h4>🌐 Integration</h4>

<h4>MongoDB Atlas:</h4>
<p>Stores presets, faults, and persistent configurations</p>
<ul>
  <li>Connection string in <code>MONGODB_URI</code> environment variable</li>
  <li>Database name: <code>genieacs</code></li>
  <li>Collections: presets, faults, devices (cached)</li>
</ul>

<h4>GenieACS Architecture:</h4>
<pre><code>CPE Devices
    ↓ TR-069
App Hosting (/cwmp proxy)
    ↓
Internal CWMP Server (7547)
    ↓
MongoDB (device data)
    ↓
NBI API (7557)
    ↓
App Hosting (/nbi proxy)
    ↓
Web UI (this app)</code></pre>

<h4>📚 Additional Resources</h4>
<ul>
  <li><a href="https://genieacs.com/" target="_blank">GenieACS Documentation</a></li>
  <li><a href="https://www.broadband-forum.org/technical/download/TR-069.pdf" target="_blank">TR-069 Protocol Specification</a></li>
  <li><a href="https://developers.arcgis.com/" target="_blank">ArcGIS JavaScript API Docs</a></li>
</ul>
`;

