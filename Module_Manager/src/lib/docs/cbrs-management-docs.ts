/**
 * CBRS Management Module Documentation
 */

export const cbrsManagementDocs = `
<h3>📡 CBRS Management Module</h3>

<div class="info">
  <strong>Purpose:</strong> Manage Citizens Broadband Radio Service (CBRS) spectrum for the 3.5 GHz band (3550-3700 MHz) with integrated support for Google SAS and Federated Wireless.
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#overview">Overview</a></li>
    <li><a href="#key-features">🎯 Key Features</a></li>
    <li><a href="#cbrs-basics">CBRS Basics</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#device-states">Device States</a></li>
    <li><a href="#grant-management">Grant Management</a></li>
    <li><a href="#api-integration">API Integration</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#compliance">Compliance & Regulations</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
    <li><a href="#support">Support & Resources</a></li>
  </ul>
</div>

<h4 id="overview">Overview</h4>

The CBRS (Citizens Broadband Radio Service) Management module provides comprehensive spectrum management capabilities for the 3.5 GHz CBRS band (3550-3700 MHz) with integrated support for:

- **Google SAS (Spectrum Access System)** - Google's commercial SAS platform
- **Federated Wireless** - Enhanced SAS with advanced analytics and optimization

<h4>🎯 Key Features</h4>
<ul>
  <li><strong>CBSD Device Management:</strong>
    <ul>
      <li>Register and manage Citizens Broadband Service Devices (CBSDs)</li>
      <li>Support for both Category A (indoor) and Category B (outdoor) devices</li>
      <li>Real-time device status monitoring</li>
      <li>GPS-based device mapping with ArcGIS integration</li>
    </ul>
  </li>
  <li><strong>Spectrum Authorization:</strong>
    <ul>
      <li>Request spectrum grants from SAS providers</li>
      <li>Automated heartbeat management</li>
      <li>Real-time grant status tracking</li>
      <li>Grant relinquishment and renewal</li>
    </ul>
  </li>
  <li><strong>Geographic Visualization:</strong>
    <ul>
      <li>Interactive ArcGIS map showing CBSD locations</li>
      <li>Color-coded device status indicators</li>
      <li>Multi-site coordination visualization</li>
      <li>Coverage area analysis</li>
    </ul>
  </li>
  <li><strong>Analytics & Monitoring:</strong>
    <ul>
      <li>Real-time device performance metrics</li>
      <li>Spectrum utilization tracking</li>
      <li>Interference detection and monitoring</li>
      <li>Historical data analysis</li>
    </ul>
  </li>
</ul>

<h4 id="cbrs-basics">CBRS Basics</h4>

### What is CBRS?

Citizens Broadband Radio Service (CBRS) is a 150 MHz wide broadcast radio frequency band in the United States (3550-3700 MHz). It operates under an innovative three-tiered spectrum sharing framework:

1. **Incumbent Access** - Federal and fixed satellite service users (highest priority)
2. **Priority Access License (PAL)** - Licensed users with protected spectrum
3. **General Authorized Access (GAA)** - Unlicensed users on available spectrum

### Spectrum Access System (SAS)

The SAS is a cloud-based database and spectrum management system that:
- Protects incumbent users from harmful interference
- Manages spectrum assignments for PAL and GAA users
- Provides dynamic spectrum allocation
- Enforces FCC rules and regulations

<h4 id="getting-started">Getting Started</h4>

### 1. Add a CBSD Device

<p>Click <strong>"+ Add CBSD Device"</strong> and provide:</p>
<ul>
  <li><strong>CBSD Serial Number</strong> - Unique device identifier</li>
  <li><strong>FCC ID</strong> - FCC equipment authorization identifier</li>
  <li><strong>Category</strong> - A (indoor, lower power) or B (outdoor, higher power)</li>
  <li><strong>SAS Provider</strong> - Google SAS or Federated Wireless</li>
  <li><strong>Installation Parameters:</strong>
    <ul>
      <li>Latitude and Longitude (decimal degrees)</li>
      <li>Height above ground (meters)</li>
      <li>Antenna gain (dBi)</li>
    </ul>
  </li>
</ul>

<h4>Step 2: Register with SAS</h4>

<p>Once added, devices must be registered with the selected SAS provider:</p>
<ol>
  <li>Select device from the list</li>
  <li>Click <strong>"Register"</strong> button</li>
  <li>SAS validates device and installation parameters</li>
  <li>Upon success, device receives a CBSD ID</li>
</ol>

<h4>Step 3: Request Spectrum Grant</h4>

<p>After registration, request a spectrum grant:</p>
<ol>
  <li>Select registered device</li>
  <li>Click <strong>"Request New Grant"</strong></li>
  <li>Specify:
    <ul>
      <li>Maximum EIRP (Effective Isotropic Radiated Power)</li>
      <li>Frequency range (within 3550-3700 MHz)</li>
    </ul>
  </li>
  <li>SAS evaluates request and assigns available spectrum</li>
</ol>

<h4>Step 4: Automated Heartbeat</h4>

<p>Once granted, the system automatically:</p>
<ul>
  <li>Sends periodic heartbeats to SAS</li>
  <li>Maintains spectrum authorization</li>
  <li>Updates transmit expiration times</li>
  <li>Reports device status</li>
</ul>

<h4 id="device-states">Device States</h4>

<h4>UNREGISTERED</h4>
<p>Device is created but not yet registered with SAS. Cannot transmit.</p>

<h4>REGISTERED</h4>
<p>Device is registered with SAS and can request spectrum grants.</p>

<h4>GRANTED</h4>
<p>Device has one or more active spectrum grants but is not authorized to transmit.</p>

<h4>AUTHORIZED</h4>
<p>Device is authorized to transmit on granted frequencies. Active heartbeat required.</p>

<h4>SUSPENDED</h4>
<p>Spectrum grant is temporarily suspended. Cannot transmit until restored.</p>

<h4>DEREGISTERED</h4>
<p>Device is removed from SAS registration. All grants are terminated.</p>

<h4 id="grant-management">Grant Management</h4>

<h4>Requesting Grants</h4>

<p>When requesting a grant, consider:</p>

<p><strong>Frequency Range</strong></p>
<ul>
  <li>Must be within CBRS band (3550-3700 MHz)</li>
  <li>Typically 10-20 MHz channels</li>
  <li>Avoid incumbent protection zones</li>
</ul>

<p><strong>Maximum EIRP</strong></p>
<ul>
  <li>Category A: Up to 30 dBm/10MHz</li>
  <li>Category B: Up to 47 dBm/10MHz</li>
  <li>SAS may reduce based on interference analysis</li>
</ul>

<p><strong>Channel Type</strong></p>
<ul>
  <li><strong>PAL</strong> - Priority Access License (if you hold PAL)</li>
  <li><strong>GAA</strong> - General Authorized Access (most common)</li>
</ul>

<h4>Heartbeat Requirements</h4>

<p>SAS requires periodic heartbeats (typically 60-240 seconds) to:</p>
<ul>
  <li>Confirm device operational status</li>
  <li>Renew transmit authorization</li>
  <li>Update interference measurements</li>
  <li>Receive SAS commands</li>
</ul>

<p><strong>Heartbeat Process:</strong></p>
<ol>
  <li>System automatically sends heartbeats</li>
  <li>SAS responds with transmit authorization</li>
  <li>Authorization expires if heartbeat missed</li>
  <li>Device must stop transmitting if expired</li>
</ol>

<h4>Relinquishing Grants</h4>

<p>Relinquish grants when:</p>
<ul>
  <li>Device is no longer transmitting</li>
  <li>Spectrum is not needed</li>
  <li>Preparing for deregistration</li>
  <li>Changing frequency assignments</li>
</ul>

<h4 id="api-integration">API Integration</h4>

<h4>Google SAS</h4>

<p><strong>Features:</strong></p>
<ul>
  <li>WinnForum compliant SAS implementation</li>
  <li>Integration with Google Cloud Platform</li>
  <li>Real-time spectrum coordination</li>
  <li>Automated interference protection</li>
</ul>

<p><strong>Best For:</strong></p>
<ul>
  <li>Standard CBRS deployments</li>
  <li>Cost-effective spectrum management</li>
  <li>Google Cloud integration</li>
  <li>Basic compliance requirements</li>
</ul>

<h4>Federated Wireless</h4>

<p><strong>Features:</strong></p>
<ul>
  <li>Enhanced spectrum optimization</li>
  <li>Advanced interference monitoring</li>
  <li>Multi-site coordination</li>
  <li>Real-time analytics and insights</li>
  <li>Automated power optimization</li>
</ul>

<p><strong>Best For:</strong></p>
<ul>
  <li>Enterprise deployments</li>
  <li>Multi-site networks</li>
  <li>Advanced analytics needs</li>
  <li>Maximum spectrum efficiency</li>
</ul>

<h4 id="best-practices">💡 Best Practices</h4>

<h4>Device Installation</h4>

<ol>
  <li><strong>Accurate GPS Coordinates</strong>
    <ul>
      <li>Use professional GPS equipment</li>
      <li>Verify coordinates before registration</li>
      <li>Update if device is relocated</li>
    </ul>
  </li>
  <li><strong>Height Measurements</strong>
    <ul>
      <li>Measure from ground level (AGL)</li>
      <li>Include antenna height</li>
      <li>Account for building height for rooftop installations</li>
    </ul>
  </li>
  <li><strong>Antenna Parameters</strong>
    <ul>
      <li>Accurate antenna gain critical for power calculations</li>
      <li>Provide azimuth and downtilt if directional</li>
      <li>Keep documentation updated</li>
    </ul>
  </li>
</ol>

<h4>Spectrum Management</h4>

<ol>
  <li><strong>Request Appropriate Bandwidth</strong>
    <ul>
      <li>Match to actual needs</li>
      <li>Consider traffic patterns</li>
      <li>Plan for growth</li>
    </ul>
  </li>
  <li><strong>Monitor Grant Status</strong>
    <ul>
      <li>Check expiration times</li>
      <li>Renew before expiration</li>
      <li>Monitor heartbeat success rate</li>
    </ul>
  </li>
  <li><strong>Handle Suspensions Gracefully</strong>
    <ul>
      <li>Implement immediate transmit stop</li>
      <li>Wait for SAS clearance</li>
      <li>Log suspension events</li>
    </ul>
  </li>
</ol>

<h4>Network Optimization</h4>

<ol>
  <li><strong>Use Available Spectrum Efficiently</strong>
    <ul>
      <li>Deploy only needed CBSDs</li>
      <li>Use appropriate power levels</li>
      <li>Avoid over-provisioning</li>
    </ul>
  </li>
  <li><strong>Coordinate Multiple Sites</strong>
    <ul>
      <li>Use Federated Wireless multi-site coordination</li>
      <li>Plan frequency reuse</li>
      <li>Monitor inter-site interference</li>
    </ul>
  </li>
  <li><strong>Regular Maintenance</strong>
    <ul>
      <li>Update device firmware</li>
      <li>Verify GPS sync</li>
      <li>Test emergency shutdown procedures</li>
    </ul>
  </li>
</ol>

<h4 id="compliance">Compliance & Regulations</h4>

<h4>FCC Requirements</h4>

<p>All CBSD operations must comply with FCC Part 96 rules:</p>
<ul>
  <li>Use certified CBSD equipment (FCC ID required)</li>
  <li>Register all devices with SAS</li>
  <li>Respond to SAS commands immediately</li>
  <li>Maintain accurate installation records</li>
  <li>Stop transmitting when required</li>
</ul>

<h4>Incumbent Protection</h4>

<p>SAS automatically protects:</p>
<ul>
  <li>Federal radar systems (Navy shipboard radar)</li>
  <li>Fixed Satellite Service (FSS) earth stations</li>
  <li>Grandfathered Fixed Service operations</li>
</ul>

<p><strong>Protection Zones:</strong></p>
<ul>
  <li>Coastal areas (0-80 km inland)</li>
  <li>FSS earth station locations</li>
  <li>Military installation perimeters</li>
</ul>

<h4>Record Keeping</h4>

<p>Maintain records of:</p>
<ul>
  <li>Device registration details</li>
  <li>Grant requests and approvals</li>
  <li>Heartbeat logs</li>
  <li>Suspension/termination events</li>
  <li>Installation changes</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>Device Won't Register</h4>

<p><strong>Check:</strong></p>
<ul>
  <li>FCC ID is valid and certified for CBRS</li>
  <li>GPS coordinates are accurate</li>
  <li>Device category matches equipment specs</li>
  <li>No duplicate serial numbers</li>
  <li>SAS API credentials are valid</li>
</ul>

<h4>Grant Request Denied</h4>

<p><strong>Possible Causes:</strong></p>
<ul>
  <li>Requested frequency unavailable</li>
  <li>Excessive interference predicted</li>
  <li>In incumbent protection zone</li>
  <li>Installation parameters invalid</li>
  <li>Power level too high</li>
</ul>

<p><strong>Solutions:</strong></p>
<ul>
  <li>Request different frequency range</li>
  <li>Reduce max EIRP</li>
  <li>Verify installation parameters</li>
  <li>Check for nearby PAL holders</li>
  <li>Contact SAS provider support</li>
</ul>

<h4>Heartbeat Failures</h4>

<p><strong>Check:</strong></p>
<ul>
  <li>Network connectivity</li>
  <li>SAS API endpoint accessibility</li>
  <li>System clock synchronization</li>
  <li>Certificate validity (if using SSL)</li>
  <li>Grant expiration status</li>
</ul>

<p><strong>Actions:</strong></p>
<ul>
  <li>Review error logs</li>
  <li>Test network connection</li>
  <li>Verify API credentials</li>
  <li>Restart heartbeat service</li>
  <li>Contact SAS support if persistent</li>
</ul>

<h4>Unexpected Suspension</h4>

<p><strong>Causes:</strong></p>
<ul>
  <li>Incumbent activity detected</li>
  <li>Interference reported</li>
  <li>Missed heartbeats</li>
  <li>SAS maintenance</li>
  <li>Policy violation</li>
</ul>

<p><strong>Response:</strong></p>
<ol>
  <li>Immediately stop transmitting</li>
  <li>Check SAS messages</li>
  <li>Wait for AUTHORIZED state</li>
  <li>Resume only when cleared</li>
  <li>Investigate root cause</li>
</ol>

<h4 id="support">Support & Resources</h4>

<h4>Documentation</h4>
<ul>
  <li><a href="https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-96" target="_blank">FCC Part 96 Rules</a></li>
  <li><a href="https://www.wirelessinnovation.org/cbrs-spectrum-access-system" target="_blank">WinnForum SAS Specifications</a></li>
  <li><a href="https://cloud.google.com/spectrum-access-system" target="_blank">Google SAS Documentation</a></li>
  <li><a href="https://www.federatedwireless.com/" target="_blank">Federated Wireless Portal</a></li>
</ul>

<h4>Getting Help</h4>
<ul>
  <li>Technical support: support@yourcompany.com</li>
  <li>SAS Provider support links in module settings</li>
  <li>Community forums and user groups</li>
  <li>Professional services for deployment assistance</li>
</ul>

<h4>Additional Training</h4>
<ul>
  <li>CBRS fundamentals course</li>
  <li>SAS integration workshop</li>
  <li>Network planning services</li>
  <li>Compliance training</li>
</ul>
`;


<ul>
  <li>Technical support: support@yourcompany.com</li>
  <li>SAS Provider support links in module settings</li>
  <li>Community forums and user groups</li>
  <li>Professional services for deployment assistance</li>
</ul>

<h4>Additional Training</h4>
<ul>
  <li>CBRS fundamentals course</li>
  <li>SAS integration workshop</li>
  <li>Network planning services</li>
  <li>Compliance training</li>
</ul>
`;


<ul>
  <li>Technical support: support@yourcompany.com</li>
  <li>SAS Provider support links in module settings</li>
  <li>Community forums and user groups</li>
  <li>Professional services for deployment assistance</li>
</ul>

<h4>Additional Training</h4>
<ul>
  <li>CBRS fundamentals course</li>
  <li>SAS integration workshop</li>
  <li>Network planning services</li>
  <li>Compliance training</li>
</ul>
`;

