export const deployDocs = `
<h3>🚀 Deploy Module</h3>

<div class="info">
  <strong>Purpose:</strong> Approve, authorize, and deploy network infrastructure projects. Deploy hardware to tower sites, configure EPC systems, and manage the deployment workflow from planning to production.
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#key-features">🎯 Key Features</a></li>
    <li><a href="#getting-started">🚀 Getting Started</a></li>
    <li><a href="#deployment-workflow">📊 Deployment Workflow</a></li>
    <li><a href="#hardware-deployment">🔧 Hardware Deployment</a></li>
    <li><a href="#epc-deployment">📡 EPC Deployment</a></li>
    <li><a href="#snmp-configuration">🔍 SNMP Configuration</a></li>
    <li><a href="#pci-planning">📐 PCI Planning</a></li>
    <li><a href="#frequency-planning">📻 Frequency Planning</a></li>
    <li><a href="#deployment-wizard">🧙 Deployment Wizard</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
    <li><a href="#next-steps">📚 Next Steps</a></li>
  </ul>
</div>

<h4 id="key-features">🎯 Key Features</h4>
<ul>
  <li><strong>Plan Approval:</strong> Review and approve projects from Plan module</li>
  <li><strong>Hardware Deployment:</strong> Deploy equipment from inventory to tower sites</li>
  <li><strong>EPC Deployment:</strong> Configure and deploy Evolved Packet Core systems</li>
  <li><strong>SNMP Configuration:</strong> Set up SNMP monitoring for deployed equipment</li>
  <li><strong>PCI Planning:</strong> Plan Physical Cell ID assignments for LTE sectors</li>
  <li><strong>Frequency Planning:</strong> Optimize frequency assignments across network</li>
  <li><strong>Site Equipment Management:</strong> View and manage equipment at each site</li>
</ul>

<h4 id="getting-started">🚀 Getting Started</h4>

<h4>Step 1: Review Ready Plans</h4>
<ol>
  <li>Navigate to <strong>Deploy</strong> module</li>
  <li>Click <strong>"Plans"</strong> button</li>
  <li>Review projects in <strong>"Ready"</strong> status</li>
  <li>Each plan shows:
    <ul>
      <li>Project name and description</li>
      <li>Planned sites and sectors</li>
      <li>Hardware requirements</li>
      <li>Marketing addresses discovered</li>
    </ul>
  </li>
</ol>

<h4>Step 2: Approve or Reject Plans</h4>
<ol>
  <li>Select a ready plan</li>
  <li>Review all planned assets</li>
  <li>Click <strong>"Approve"</strong> or <strong>"Reject"</strong></li>
  <li>If approved:
    <ul>
      <li>Plan status changes to <strong>"Approved"</strong></li>
      <li>Plan becomes available for deployment</li>
      <li>You can authorize deployment</li>
    </ul>
  </li>
  <li>If rejected:
    <ul>
      <li>Plan returns to Plan module</li>
      <li>Add rejection reason</li>
      <li>Project owner can revise and resubmit</li>
    </ul>
  </li>
</ol>

<h4>Step 3: Authorize Deployment</h4>
<ol>
  <li>Select an approved plan</li>
  <li>Verify inventory is available</li>
  <li>Click <strong>"Authorize Deployment"</strong></li>
  <li>Plan status changes to <strong>"Authorized"</strong></li>
  <li>Deployment can now begin</li>
</ol>

<h4>Step 4: Deploy Hardware to Sites</h4>
<ol>
  <li>Right-click on a tower site on the map</li>
  <li>Select <strong>"Deploy Hardware"</strong></li>
  <li>Hardware Deployment Modal opens</li>
  <li>Select equipment from inventory:
    <ul>
      <li>Filter by equipment type</li>
      <li>View available quantities</li>
      <li>Select items to deploy</li>
    </ul>
  </li>
  <li>Enter deployment details:
    <ul>
      <li>Deployment date</li>
      <li>Installer name</li>
      <li>Installation notes</li>
    </ul>
  </li>
  <li>Click <strong>"Deploy"</strong></li>
  <li>Equipment status changes to "Deployed"</li>
</ol>

<h4>Step 5: Configure EPC Systems</h4>
<ol>
  <li>Click <strong>"EPC Deployment"</strong> button</li>
  <li>Select tower site for EPC deployment</li>
  <li>Configure EPC parameters:
    <ul>
      <li>MME connection settings</li>
      <li>HSS integration</li>
      <li>Network configuration</li>
    </ul>
  </li>
  <li>Deploy EPC system</li>
  <li>Verify EPC connectivity</li>
</ol>

<h4>Step 6: Configure SNMP Monitoring</h4>
<ol>
  <li>Click <strong>"SNMP Configuration"</strong> button</li>
  <li>Select deployed equipment</li>
  <li>Enter SNMP credentials:
    <ul>
      <li>SNMP community string</li>
      <li>SNMP version (v2c or v3)</li>
      <li>Device IP address</li>
    </ul>
  </li>
  <li>Test SNMP connection</li>
  <li>Save configuration</li>
  <li>Equipment appears in Monitor module</li>
</ol>

<h4>Step 7: Plan PCI Assignments</h4>
<ol>
  <li>Click <strong>"PCI Planner"</strong> button</li>
  <li>System analyzes deployed LTE sectors</li>
  <li>Detects PCI conflicts</li>
  <li>Review conflict report</li>
  <li>Apply PCI assignments:
    <ul>
      <li>Auto-optimize all conflicts</li>
      <li>Manually assign specific PCIs</li>
      <li>Export Nokia configuration scripts</li>
    </ul>
  </li>
</ol>

<h4>Step 8: Plan Frequency Assignments</h4>
<ol>
  <li>Click <strong>"Frequency Planner"</strong> button</li>
  <li>System analyzes deployed sectors</li>
  <li>Optimizes frequency assignments</li>
  <li>Reviews interference patterns</li>
  <li>Applies frequency plan</li>
</ol>

<h4>Step 9: Mark Project as Deployed</h4>
<ol>
  <li>Verify all hardware is deployed</li>
  <li>Confirm EPC systems are operational</li>
  <li>Verify SNMP monitoring is active</li>
  <li>Click <strong>"Mark as Deployed"</strong></li>
  <li>Project status changes to <strong>"Deployed"</strong></li>
  <li>Assets appear in Monitor module</li>
</ol>

<h4 id="deployment-workflow">📊 Deployment Workflow</h4>

<h4>Workflow States</h4>
<ul>
  <li><strong>Ready:</strong> Project finalized in Plan module</li>
  <li><strong>Approved:</strong> Project approved for deployment</li>
  <li><strong>Authorized:</strong> Deployment authorized to begin</li>
  <li><strong>Deploying:</strong> Hardware being deployed</li>
  <li><strong>Deployed:</strong> All assets deployed and operational</li>
</ul>

<h4>Deployment Checklist</h4>
<ul>
  <li>✅ Plan approved and authorized</li>
  <li>✅ Inventory available for deployment</li>
  <li>✅ Hardware deployed to sites</li>
  <li>✅ EPC systems configured</li>
  <li>✅ SNMP monitoring configured</li>
  <li>✅ PCI assignments optimized</li>
  <li>✅ Frequency plan applied</li>
  <li>✅ All systems operational</li>
</ul>

<h4 id="hardware-deployment">🔧 Hardware Deployment</h4>

<h4>Deployment Process</h4>
<p>When deploying hardware:</p>
<ol>
  <li>Equipment must be in inventory</li>
  <li>Equipment status must be "Available"</li>
  <li>Select equipment from inventory list</li>
  <li>Assign to specific tower site</li>
  <li>Record deployment details</li>
  <li>Equipment status changes to "Deployed"</li>
  <li>Location updates to tower site</li>
</ol>

<h4>Viewing Site Equipment</h4>
<ol>
  <li>Right-click on tower site</li>
  <li>Select <strong>"View Equipment"</strong></li>
  <li>Modal shows:
    <ul>
      <li>All deployed hardware</li>
      <li>EPC devices</li>
      <li>Sectors configured</li>
      <li>Equipment details and serial numbers</li>
    </ul>
  </li>
</ol>

<h4 id="epc-deployment">📡 EPC Deployment</h4>

<h4>What is EPC?</h4>
<p>Evolved Packet Core (EPC) is the core network for LTE:</p>
<ul>
  <li><strong>MME:</strong> Mobility Management Entity</li>
  <li><strong>SGW:</strong> Serving Gateway</li>
  <li><strong>PGW:</strong> Packet Data Network Gateway</li>
  <li><strong>HSS:</strong> Home Subscriber Server</li>
</ul>

<h4>Deploying EPC</h4>
<ol>
  <li>Select tower site for EPC</li>
  <li>Configure MME connection to HSS</li>
  <li>Set up network interfaces</li>
  <li>Configure subscriber routing</li>
  <li>Test connectivity</li>
  <li>Verify EPC is operational</li>
</ol>

<h4 id="snmp-configuration">🔍 SNMP Configuration</h4>

<h4>SNMP Setup</h4>
<p>Configure SNMP for network monitoring:</p>
<ul>
  <li><strong>SNMP v2c:</strong> Community string authentication</li>
  <li><strong>SNMP v3:</strong> User-based security</li>
  <li><strong>Device IP:</strong> Management IP address</li>
  <li><strong>OIDs:</strong> Object identifiers to monitor</li>
</ul>

<h4>SNMP Monitoring</h4>
<p>Once configured, equipment appears in Monitor module:</p>
<ul>
  <li>Real-time status monitoring</li>
  <li>Performance metrics</li>
  <li>Uptime tracking</li>
  <li>Alert generation</li>
</ul>

<h4 id="pci-planning">📐 PCI Planning</h4>

<h4>What is PCI?</h4>
<p>Physical Cell ID (PCI) identifies LTE cells:</p>
<ul>
  <li>Range: 0-503 (504 possible values)</li>
  <li>Must be unique within interference range</li>
  <li>Mod3 conflicts can cause confusion</li>
  <li>Mod6 conflicts can cause interference</li>
</ul>

<h4>PCI Planner Features</h4>
<ul>
  <li>Automatic conflict detection</li>
  <li>AI-powered optimization</li>
  <li>Neighbor relationship analysis</li>
  <li>Export Nokia configuration scripts</li>
</ul>

<h4 id="frequency-planning">📻 Frequency Planning</h4>

<h4>Frequency Optimization</h4>
<p>Plan frequency assignments to minimize interference:</p>
<ul>
  <li>Analyze deployed sectors</li>
  <li>Detect frequency conflicts</li>
  <li>Optimize assignments</li>
  <li>Consider band availability</li>
</ul>

<h4 id="deployment-wizard">🧙 Deployment Wizard</h4>

<div class="info">
  <strong>Purpose:</strong> Step-by-step guided workflow for deploying equipment (sectors, radios, CPE) with proper configuration, location assignment, and documentation.
</div>

<h4>Accessing the Wizard</h4>
<ol>
  <li>Navigate to <strong>Deploy</strong> module</li>
  <li>Click <strong>"📦 Deploy Equipment"</strong> button in module header</li>
  <li>Wizard opens with welcome screen</li>
</ol>

<h4>Wizard Overview</h4>
<p>The Deployment Wizard guides you through:</p>
<ul>
  <li>Selecting deployment type (Sector, Radio, or CPE)</li>
  <li>Choosing location (existing site or GPS coordinates)</li>
  <li>Selecting equipment from inventory</li>
  <li>Configuring equipment parameters</li>
  <li>Completing deployment checklist</li>
  <li>Uploading photos and documentation</li>
</ul>

<h4>Deployment Types</h4>

<h4>Sector Deployment</h4>
<ul>
  <li>Deploy complete sector (radio + antenna + configuration)</li>
  <li>Auto-creates sector in Coverage Map</li>
  <li>Links equipment to sector</li>
  <li>Configures azimuth, frequency, bandwidth</li>
</ul>

<h4>Radio Deployment</h4>
<ul>
  <li>Deploy radio unit to existing site</li>
  <li>Links equipment to site</li>
  <li>Configures radio parameters</li>
</ul>

<h4>CPE Deployment</h4>
<ul>
  <li>Deploy customer premise equipment</li>
  <li>Links to customer account</li>
  <li>Assigns service plan</li>
  <li>Configures CPE settings</li>
</ul>

<h4>Wizard Steps</h4>
<ol>
  <li><strong>Welcome:</strong> Overview of deployment process</li>
  <li><strong>Type:</strong> Select deployment type</li>
  <li><strong>Location:</strong> Choose site or enter GPS coordinates</li>
  <li><strong>Equipment:</strong> Select equipment from inventory</li>
  <li><strong>Configure:</strong> Set equipment parameters</li>
  <li><strong>Checklist:</strong> Complete deployment checklist</li>
  <li><strong>Complete:</strong> Review summary and finish</li>
</ol>

<h4>Tips for Using the Wizard</h4>
<ul>
  <li>Have equipment serial numbers ready</li>
  <li>Know exact GPS coordinates or select existing site</li>
  <li>Take photos during deployment for documentation</li>
  <li>Complete all checklist items before finishing</li>
  <li>Link to work orders for tracking</li>
</ul>

<div class="success">
  <strong>✅ Quick Access:</strong> The Deployment Wizard can also be accessed by right-clicking on a tower site and selecting "Deploy Hardware" from the context menu.
</div>

<h4 id="best-practices">💡 Best Practices</h4>
<ul>
  <li><strong>Verify Inventory:</strong> Ensure equipment is available before approving</li>
  <li><strong>Test Before Deploy:</strong> Test EPC and SNMP before marking deployed</li>
  <li><strong>Document Everything:</strong> Record all deployment details</li>
  <li><strong>Coordinate Teams:</strong> Work with field technicians</li>
  <li><strong>Monitor Progress:</strong> Track deployment status</li>
  <li><strong>Validate Configuration:</strong> Verify all settings before going live</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>No plans showing:</h4>
<ul>
  <li>Verify plans are finalized in Plan module</li>
  <li>Check plan status is "Ready"</li>
  <li>Ensure you have approval permissions</li>
</ul>

<h4>Can't deploy hardware:</h4>
<ul>
  <li>Verify equipment is in inventory</li>
  <li>Check equipment status is "Available"</li>
  <li>Ensure inventory has sufficient quantity</li>
</ul>

<h4>EPC deployment failed:</h4>
<ul>
  <li>Verify HSS is accessible</li>
  <li>Check network connectivity</li>
  <li>Review EPC configuration</li>
  <li>Check firewall rules</li>
</ul>

<h4>SNMP not working:</h4>
<ul>
  <li>Verify SNMP credentials</li>
  <li>Check device IP is correct</li>
  <li>Test SNMP connection</li>
  <li>Verify SNMP is enabled on device</li>
</ul>

<h4 id="next-steps">📚 Next Steps</h4>

<p>After deployment:</p>
<ul>
  <li>Deployed hardware appears in <strong>Monitor</strong> module</li>
  <li>SNMP monitoring begins automatically</li>
  <li>EPC devices are tracked and monitored</li>
  <li>Performance graphs and uptime data become available</li>
</ul>
`;