export const adminDocs = `
<h3>⚙️ ACS Administration</h3>

<div class="info">
  <strong>Purpose:</strong> Configure and monitor GenieACS services, manage database, and view system status.
</div>

<h4>📊 Service Status</h4>

<p>Monitor all 4 GenieACS services in real-time:</p>

<h4>Services:</h4>
<ul>
  <li><strong>CWMP Server (Port 7547):</strong> TR-069 endpoint for CPE devices
    <ul>
      <li>Handles device connections and parameter exchanges</li>
      <li>Processes device inform messages</li>
      <li>Executes remote procedure calls (RPCs)</li>
    </ul>
  </li>
  
  <li><strong>NBI API (Port 7557):</strong> REST API for device management
    <ul>
      <li>Provides programmatic access to device data</li>
      <li>CRUD operations for devices, presets, provisions</li>
      <li>Used by this web application</li>
    </ul>
  </li>
  
  <li><strong>File Server (Port 7567):</strong> Firmware and configuration files
    <ul>
      <li>Stores and serves firmware images</li>
      <li>Configuration file downloads</li>
      <li>CPE file upload endpoint</li>
    </ul>
  </li>
  
  <li><strong>Web UI (Port 3000):</strong> GenieACS admin interface
    <ul>
      <li>Direct access to GenieACS configuration</li>
      <li>Advanced device management</li>
      <li>Provision and virtual parameter editing</li>
    </ul>
  </li>
</ul>

<h4>Service Controls:</h4>
<ul>
  <li><strong>Check Status:</strong> Refresh to see current service health</li>
  <li><strong>Response Time:</strong> Monitor API performance</li>
  <li><strong>Auto-Refresh:</strong> Status updates every 30 seconds</li>
</ul>

<h4>🗄️ Database Management</h4>

<p>MongoDB stores all persistent data for GenieACS and application.</p>

<h4>Database Operations:</h4>
<ul>
  <li><strong>Check Status:</strong> View connection health and collection counts</li>
  <li><strong>Initialize Data:</strong> Create sample presets and faults for testing</li>
  <li><strong>View Statistics:</strong> Document counts per collection</li>
  <li><strong>Test Connection:</strong> Verify MongoDB connectivity</li>
</ul>

<h4>Collections:</h4>
<ul>
  <li><strong>devices:</strong> CPE device information (synced from GenieACS)</li>
  <li><strong>presets:</strong> Configuration templates</li>
  <li><strong>faults:</strong> Device fault records</li>
  <li><strong>provisions:</strong> JavaScript provisioning scripts</li>
  <li><strong>virtualParameters:</strong> Custom parameter definitions</li>
  <li><strong>files:</strong> Firmware and configuration file metadata</li>
</ul>

<h4>Initialize Sample Data:</h4>
<ol>
  <li>Click <strong>"Initialize Sample Data"</strong></li>
  <li>Creates 5 test presets (WiFi, VoIP, QoS, etc.)</li>
  <li>Creates 3 sample faults for testing</li>
  <li>Useful for development and testing</li>
</ol>

<div class="warning">
  <strong>Production Warning:</strong> Don't initialize sample data in production. It will create test records in your live database.
</div>

<h4>🚀 Setup Status</h4>

<p>View GenieACS deployment configuration and status.</p>

<h4>What This Page Shows:</h4>
<ul>
  <li><strong>Service Status:</strong> Real-time health of all 4 services</li>
  <li><strong>Auto-Deployment:</strong> How services are automatically started</li>
  <li><strong>Port Configuration:</strong> Internal and external endpoints</li>
  <li><strong>Troubleshooting:</strong> Common issues and solutions</li>
</ul>

<h4>Service Endpoints:</h4>
<table style="width: 100%; margin: 1rem 0; border-collapse: collapse;">
  <thead>
    <tr style="background: var(--bg-secondary);">
      <th style="padding: 0.75rem; text-align: left; border: 1px solid var(--border-color);">Service</th>
      <th style="padding: 0.75rem; text-align: left; border: 1px solid var(--border-color);">Internal</th>
      <th style="padding: 0.75rem; text-align: left; border: 1px solid var(--border-color);">External</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 0.75rem; border: 1px solid var(--border-color);">CWMP</td>
      <td style="padding: 0.75rem; border: 1px solid var(--border-color);"><code>localhost:7547</code></td>
      <td style="padding: 0.75rem; border: 1px solid var(--border-color);"><code>https://your-app.web.app/cwmp</code></td>
    </tr>
    <tr>
      <td style="padding: 0.75rem; border: 1px solid var(--border-color);">NBI</td>
      <td style="padding: 0.75rem; border: 1px solid var(--border-color);"><code>localhost:7557</code></td>
      <td style="padding: 0.75rem; border: 1px solid var(--border-color);"><code>https://your-app.web.app/nbi</code></td>
    </tr>
    <tr>
      <td style="padding: 0.75rem; border: 1px solid var(--border-color);">FS</td>
      <td style="padding: 0.75rem; border: 1px solid var(--border-color);"><code>localhost:7567</code></td>
      <td style="padding: 0.75rem; border: 1px solid var(--border-color);"><code>https://your-app.web.app/fs</code></td>
    </tr>
    <tr>
      <td style="padding: 0.75rem; border: 1px solid var(--border-color);">UI</td>
      <td style="padding: 0.75rem; border: 1px solid var(--border-color);"><code>localhost:3000</code></td>
      <td style="padding: 0.75rem; border: 1px solid var(--border-color);">Not proxied</td>
    </tr>
  </tbody>
</table>

<h4>🔍 Troubleshooting</h4>

<h4>Services show as offline:</h4>
<ul>
  <li>Wait 60 seconds after deployment for services to start</li>
  <li>Click "Refresh" to update status</li>
  <li>Check Firebase App Hosting logs</li>
  <li>Verify MongoDB connection is configured</li>
</ul>

<h4>Can't access GenieACS UI:</h4>
<ul>
  <li>GenieACS UI (port 3000) is not exposed externally</li>
  <li>Use this web app for device management</li>
  <li>Or deploy GenieACS UI separately to Cloud Run</li>
</ul>

<h4>Database connection failed:</h4>
<ul>
  <li>Check <code>MONGODB_URI</code> environment variable</li>
  <li>Verify password in connection string</li>
  <li>Ensure MongoDB Atlas allows connections from Firebase</li>
  <li>Check network access settings in Atlas</li>
</ul>

<h4>CPE devices won't connect:</h4>
<ul>
  <li>Verify ACS URL: <code>https://your-app.web.app/cwmp</code></li>
  <li>Check CWMP proxy route is working</li>
  <li>Ensure devices can reach the URL (test with ping/curl)</li>
  <li>Verify no firewall blocking on device side</li>
</ul>

<h4>🏗️ Architecture</h4>

<h4>Deployment Model:</h4>
<pre><code>┌─────────────────────────────────────┐
│ Firebase App Hosting (Port 8080)    │
│  ├─ SvelteKit Web App               │
│  ├─ Proxy Routes (/cwmp, /nbi, /fs) │
│  └─ GenieACS Services (internal)    │
│     ├─ CWMP (7547)                  │
│     ├─ NBI (7557)                   │
│     ├─ FS (7567)                    │
│     └─ UI (3000)                    │
└─────────┬───────────────────────────┘
          │
          ▼
┌─────────────────────────────────────┐
│ MongoDB Atlas                       │
│  └─ genieacs database               │
└─────────────────────────────────────┘</code></pre>

<h4>📚 Configuration Files</h4>

<h4>Environment Variables:</h4>
<ul>
  <li><code>MONGODB_URI</code> - MongoDB Atlas connection string</li>
  <li><code>MONGODB_DATABASE</code> - Database name (genieacs)</li>
  <li><code>GENIEACS_CWMP_PORT</code> - CWMP port (7547)</li>
  <li><code>GENIEACS_ENABLE_FIRESTORE_SYNC</code> - Sync to Firestore</li>
  <li><code>GENIEACS_SYNC_INTERVAL</code> - Sync frequency (ms)</li>
</ul>

<h4>💡 Tips</h4>
<ul>
  <li>Services auto-restart if they crash</li>
  <li>Database operations are atomic and safe</li>
  <li>Proxy routes handle all TR-069 protocol requirements</li>
  <li>Status checks run every API call for real-time accuracy</li>
  <li>All logs available in Firebase Console</li>
</ul>
`;

