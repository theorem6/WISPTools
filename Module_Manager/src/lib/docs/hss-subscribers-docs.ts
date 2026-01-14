export const hssSubscribersDocs = `
<h3>🔐 HSS & Subscriber Management</h3>

<div class="info">
  <strong>Purpose:</strong> Manage Home Subscriber Server (HSS) database for LTE/5G networks. Create, configure, and manage subscriber profiles, authentication credentials, and service access for mobile network subscribers.
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#key-features">🎯 Key Features</a></li>
    <li><a href="#getting-started">🚀 Getting Started</a></li>
    <li><a href="#subscriber-management">📱 Subscriber Management</a></li>
    <li><a href="#authentication">🔐 Authentication</a></li>
    <li><a href="#group-management">👥 Group Management</a></li>
    <li><a href="#epc-deployment">🌐 EPC Deployment</a></li>
    <li><a href="#mme-connection">🔌 MME Connection</a></li>
    <li><a href="#monitoring">📊 Monitoring</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
    <li><a href="#technical-details">📚 Technical Details</a></li>
  </ul>
</div>

<h4 id="key-features">🎯 Key Features</h4>
<ul>
  <li><strong>Subscriber Management:</strong> Create, edit, and delete subscriber profiles</li>
  <li><strong>Authentication:</strong> Manage authentication vectors (AUTN, RAND, XRES, CK, IK)</li>
  <li><strong>Service Profiles:</strong> Configure APN (Access Point Name) and service access</li>
  <li><strong>Group Management:</strong> Organize subscribers into groups for bulk operations</li>
  <li><strong>EPC Integration:</strong> Deploy and manage Evolved Packet Core (EPC) systems</li>
  <li><strong>MME Connection:</strong> Connect Mobile Management Entities (MMEs) to HSS</li>
  <li><strong>Monitoring:</strong> Track subscriber activity and authentication events</li>
</ul>

<h4 id="getting-started">🚀 Getting Started</h4>

<h4>Step 1: Add a Subscriber</h4>
<ol>
  <li>Navigate to <strong>HSS Management</strong> module</li>
  <li>Click <strong>"Add Subscriber"</strong> button</li>
  <li>Enter subscriber information:
    <ul>
      <li><strong>IMSI</strong> - International Mobile Subscriber Identity (15 digits, required)</li>
      <li><strong>MSISDN</strong> - Mobile Station International Subscriber Directory Number (phone number, optional)</li>
      <li><strong>Ki</strong> - Authentication key (128-bit hex, required)</li>
      <li><strong>OP/OPc</strong> - Operator variant key (optional, for enhanced security)</li>
      <li><strong>APN</strong> - Access Point Name (default: internet)</li>
      <li><strong>QoS Profile</strong> - Quality of Service settings</li>
    </ul>
  </li>
  <li>Click <strong>"Create Subscriber"</strong></li>
</ol>

<h4>Step 2: Configure APN</h4>
<p>Access Point Names define network access:</p>
<ul>
  <li><strong>Default APN:</strong> Usually "internet" for data access</li>
  <li><strong>Custom APNs:</strong> Create APNs for specific services</li>
  <li><strong>APN Settings:</strong> Configure IP allocation, DNS, and routing</li>
</ul>

<h4>Step 3: Assign to Group</h4>
<ol>
  <li>Select subscriber from list</li>
  <li>Click <strong>"Edit"</strong></li>
  <li>Select subscriber group</li>
  <li>Groups help organize subscribers for bulk operations</li>
  <li>Save changes</li>
</ol>

<h4 id="subscriber-management">📱 Subscriber Management</h4>

<h4>Subscriber Fields</h4>
<ul>
  <li><strong>IMSI:</strong> Unique 15-digit identifier (MCC + MNC + MSIN)</li>
  <li><strong>MSISDN:</strong> Phone number (E.164 format)</li>
  <li><strong>Ki:</strong> 128-bit authentication key (hex format)</li>
  <li><strong>OP/OPc:</strong> Operator variant key for enhanced security</li>
  <li><strong>APN:</strong> Access Point Name for data services</li>
  <li><strong>QoS:</strong> Quality of Service profile</li>
  <li><strong>Status:</strong> Active, Suspended, Deleted</li>
</ul>

<h4>Editing Subscribers</h4>
<ol>
  <li>Click subscriber from list</li>
  <li>Click <strong>"Edit"</strong> button</li>
  <li>Update subscriber information</li>
  <li><strong>Note:</strong> Changing Ki requires re-authentication</li>
  <li>Save changes</li>
</ol>

<h4>Suspending Subscribers</h4>
<p>Temporarily disable subscriber access:</p>
<ol>
  <li>Select subscriber</li>
  <li>Click <strong>"Suspend"</strong></li>
  <li>Subscriber cannot authenticate</li>
  <li>Click <strong>"Activate"</strong> to restore access</li>
</ol>

<h4 id="authentication">🔐 Authentication</h4>

<h4>How Authentication Works</h4>
<p>The HSS generates authentication vectors for MMEs:</p>
<ol>
  <li>MME requests authentication vector from HSS</li>
  <li>HSS generates RAND (random challenge)</li>
  <li>HSS calculates AUTN, XRES, CK, IK using Ki</li>
  <li>HSS sends authentication vector to MME</li>
  <li>MME challenges subscriber with RAND</li>
  <li>Subscriber calculates RES using Ki</li>
  <li>MME compares RES with XRES</li>
  <li>If match, subscriber is authenticated</li>
</ol>

<h4>Security Best Practices</h4>
<ul>
  <li><strong>Secure Ki Storage:</strong> Encrypt Ki values in database</li>
  <li><strong>Unique Ki:</strong> Each subscriber must have unique Ki</li>
  <li><strong>OP/OPc:</strong> Use operator variant keys for enhanced security</li>
  <li><strong>Regular Rotation:</strong> Consider rotating Ki periodically</li>
  <li><strong>Access Control:</strong> Limit who can view/edit Ki values</li>
</ul>

<h4 id="group-management">👥 Group Management</h4>

<h4>Creating Groups</h4>
<ol>
  <li>Navigate to <strong>Groups</strong> section</li>
  <li>Click <strong>"Create Group"</strong></li>
  <li>Enter group name and description</li>
  <li>Set group settings (APN, QoS, etc.)</li>
  <li>Save group</li>
</ol>

<h4>Using Groups</h4>
<ul>
  <li>Assign subscribers to groups</li>
  <li>Apply group settings to all members</li>
  <li>Bulk operations on group members</li>
  <li>Organize by service tier or location</li>
</ul>

<h4 id="epc-deployment">🌐 EPC Deployment</h4>

<h4>What is EPC?</h4>
<p>Evolved Packet Core (EPC) is the core network for LTE:</p>
<ul>
  <li><strong>HSS:</strong> Home Subscriber Server (this module)</li>
  <li><strong>MME:</strong> Mobility Management Entity</li>
  <li><strong>SGW:</strong> Serving Gateway</li>
  <li><strong>PGW:</strong> Packet Data Network Gateway</li>
  <li><strong>PCRF:</strong> Policy and Charging Rules Function</li>
</ul>

<h4>Deploying EPC</h4>
<ol>
  <li>Navigate to <strong>EPC Deployment</strong> section</li>
  <li>Select deployment type (Cloud, On-Premise, Hybrid)</li>
  <li>Configure network settings</li>
  <li>Deploy HSS component</li>
  <li>Connect MMEs to HSS</li>
  <li>Test authentication flow</li>
</ol>

<h4 id="mme-connection">🔌 MME Connection</h4>

<h4>Connecting MMEs</h4>
<p>MMEs connect to HSS via S6a interface:</p>
<ol>
  <li>Configure MME with HSS address</li>
  <li>Set up Diameter protocol connection</li>
  <li>Configure TLS/SSL for security</li>
  <li>Test connection</li>
  <li>Monitor authentication requests</li>
</ol>

<h4>MME Configuration</h4>
<ul>
  <li><strong>HSS Address:</strong> IP address or hostname</li>
  <li><strong>Port:</strong> Diameter port (usually 3868)</li>
  <li><strong>Realm:</strong> Diameter realm</li>
  <li><strong>TLS:</strong> Enable TLS for secure connection</li>
  <li><strong>Heartbeat:</strong> Configure watchdog/heartbeat</li>
</ul>

<h4 id="monitoring">📊 Monitoring</h4>

<h4>Subscriber Activity</h4>
<p>Monitor subscriber activity:</p>
<ul>
  <li>Authentication success/failure rates</li>
  <li>Active sessions</li>
  <li>Data usage</li>
  <li>Location updates</li>
</ul>

<h4>HSS Performance</h4>
<ul>
  <li>Authentication request rate</li>
  <li>Response times</li>
  <li>Error rates</li>
  <li>Database performance</li>
</ul>

<h4 id="best-practices">💡 Best Practices</h4>
<ul>
  <li><strong>Unique IMSIs:</strong> Ensure each subscriber has unique IMSI</li>
  <li><strong>Secure Ki:</strong> Protect authentication keys</li>
  <li><strong>Regular Backups:</strong> Backup subscriber database regularly</li>
  <li><strong>Monitor Activity:</strong> Track authentication events</li>
  <li><strong>Group Organization:</strong> Use groups for easier management</li>
  <li><strong>Documentation:</strong> Document APN configurations</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>Subscriber cannot authenticate:</h4>
<ul>
  <li>Verify Ki is correct</li>
  <li>Check IMSI format (15 digits)</li>
  <li>Verify subscriber status is Active</li>
  <li>Check MME connection to HSS</li>
  <li>Review authentication logs</li>
</ul>

<h4>MME connection failed:</h4>
<ul>
  <li>Verify HSS address and port</li>
  <li>Check firewall rules</li>
  <li>Test Diameter connection</li>
  <li>Verify TLS certificates</li>
  <li>Check HSS service status</li>
</ul>

<h4>Authentication failures:</h4>
<ul>
  <li>Verify Ki matches subscriber device</li>
  <li>Check OP/OPc configuration</li>
  <li>Review authentication algorithm</li>
  <li>Check for Ki mismatch</li>
  <li>Verify MME configuration</li>
</ul>

<h4 id="technical-details">📚 Technical Details</h4>

<h4>IMSI Format</h4>
<p>IMSI consists of:</p>
<ul>
  <li><strong>MCC:</strong> Mobile Country Code (3 digits)</li>
  <li><strong>MNC:</strong> Mobile Network Code (2-3 digits)</li>
  <li><strong>MSIN:</strong> Mobile Subscriber Identification Number (9-10 digits)</li>
</ul>
<p>Example: 310150123456789 (MCC: 310, MNC: 150, MSIN: 123456789)</p>

<h4>Authentication Algorithms</h4>
<ul>
  <li><strong>MILENAGE:</strong> Standard 3GPP authentication algorithm</li>
  <li><strong>TUAK:</strong> Alternative authentication algorithm</li>
  <li><strong>Custom:</strong> Proprietary algorithms (not recommended)</li>
</ul>

<h4>APN Configuration</h4>
<ul>
  <li><strong>APN Name:</strong> Access Point Name identifier</li>
  <li><strong>IP Type:</strong> IPv4, IPv6, or both</li>
  <li><strong>QoS:</strong> Quality of Service profile</li>
  <li><strong>Charging:</strong> Charging characteristics</li>
</ul>
`;