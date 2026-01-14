export const pciResolutionDocs = `
<h3>📊 PCI Resolution & Network Optimization</h3>

<div class="info">
  <strong>Purpose:</strong> Detect and resolve Physical Cell ID (PCI) conflicts in LTE networks, optimize neighbor relationships, and implement Self-Organizing Network (SON) features.
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#key-features">🎯 Key Features</a></li>
    <li><a href="#getting-started">🚀 Getting Started</a></li>
    <li><a href="#map-features">🗺️ Map Features</a></li>
    <li><a href="#technical-details">📐 Technical Details</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#network-management">📞 Network Management</a></li>
  </ul>
</div>

<h4 id="key-features">🎯 Key Features</h4>
<ul>
  <li><strong>PCI Conflict Detection:</strong> Automatically identifies cells with conflicting PCIs</li>
  <li><strong>Neighbor Analysis:</strong> Analyzes cell adjacency and interference</li>
  <li><strong>AI-Powered Recommendations:</strong> Uses Google Gemini AI for optimization suggestions</li>
  <li><strong>Visual Network Map:</strong> Interactive ArcGIS map showing cell sites and conflicts</li>
  <li><strong>Export Capabilities:</strong> Generate reports and Nokia configuration scripts</li>
</ul>

<h4 id="getting-started">🚀 Getting Started</h4>

<h4>Step 1: Import Cell Data</h4>
<p>Click the <strong>"📊 Manage Towers"</strong> button to:</p>
<ul>
  <li>Add cell sites manually</li>
  <li>Import from CSV files</li>
  <li>Import from KML files (Google Earth)</li>
</ul>

<p><strong>CSV Format Example:</strong></p>
<pre><code>eNodeB,Cell ID,PCI,Latitude,Longitude,Azimuth,Height
12345,0,150,40.7128,-74.0060,0,30
12345,1,151,40.7128,-74.0060,120,30
12345,2,152,40.7128,-74.0060,240,30</code></pre>

<h4>Step 2: Analyze Network</h4>
<p>Click <strong>"🔍 Analyze Network"</strong> to:</p>
<ul>
  <li>Detect PCI conflicts (same PCI within interference range)</li>
  <li>Calculate neighbor relationships</li>
  <li>Identify potential interference</li>
  <li>Generate conflict severity ratings (High/Medium/Low)</li>
</ul>

<h4>Step 3: Review Conflicts</h4>
<p>The conflict table shows:</p>
<ul>
  <li><strong>Severity:</strong> High (same PCI neighbors), Medium (mod3 conflicts), Low (mod6 conflicts)</li>
  <li><strong>Affected Cells:</strong> Which cells are involved</li>
  <li><strong>Distance:</strong> How far apart the conflicting cells are</li>
  <li><strong>Recommendations:</strong> Suggested PCI changes</li>
</ul>

<h4>Step 4: Get AI Recommendations</h4>
<p>Click <strong>"🤖 Get AI Recommendations"</strong> for:</p>
<ul>
  <li>Intelligent PCI reallocation suggestions</li>
  <li>Network-wide optimization strategies</li>
  <li>Prioritized conflict resolution</li>
</ul>

<h4>Step 5: Optimize Network</h4>
<p>Click <strong>"✨ Optimize Network"</strong> to:</p>
<ul>
  <li>Automatically resolve all PCI conflicts</li>
  <li>Reassign PCIs based on neighbor relationships</li>
  <li>Maintain existing PCIs where possible</li>
  <li>Generate before/after comparison</li>
</ul>

<h4>Step 6: Export Results</h4>
<p>Click <strong>"📤 Export"</strong> for:</p>
<ul>
  <li><strong>Conflict Report (PDF):</strong> Detailed analysis and recommendations</li>
  <li><strong>CSV Export:</strong> Updated cell data with new PCIs</li>
  <li><strong>Nokia Configuration:</strong> Ready-to-use CLI commands for Nokia eNodeBs</li>
</ul>

<h4 id="map-features">🗺️ Map Features</h4>
<ul>
  <li><strong>Color Coding:</strong> Cells colored by PCI conflict status</li>
  <li><strong>Click Cells:</strong> View detailed cell information</li>
  <li><strong>Right-Click:</strong> Add sites, edit sectors, delete sectors</li>
  <li><strong>Neighbor Lines:</strong> Shows cell adjacency relationships</li>
  <li><strong>Basemap Options:</strong> Streets, Satellite, Hybrid, Topographic</li>
</ul>

<h4 id="technical-details">📐 Technical Details</h4>

<h4>PCI Conflict Rules:</h4>
<ul>
  <li><strong>Mod3 Conflict:</strong> PCIs with same value mod 3 (can cause confusion)</li>
  <li><strong>Mod6 Conflict:</strong> PCIs with same value mod 6 (can cause interference)</li>
  <li><strong>Direct Conflict:</strong> Identical PCIs within range (must be fixed)</li>
</ul>

<h4>Interference Range Calculation:</h4>
<ul>
  <li>Based on cell height, azimuth, and distance</li>
  <li>Typical range: 2-5 km for interference detection</li>
  <li>Adjustable in analysis settings</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>No conflicts detected but cells are close:</h4>
<p>Increase the interference range in analysis settings</p>

<h4>Optimization changes too many PCIs:</h4>
<p>Review AI recommendations first and apply selectively</p>

<h4>Map not loading:</h4>
<p>Check ArcGIS API key in environment variables</p>

<h4 id="best-practices">💡 Best Practices</h4>
<ul>
  <li>Import all cell data before analysis</li>
  <li>Review AI recommendations before auto-optimization</li>
  <li>Export backup before applying PCI changes</li>
  <li>Test PCI changes on small clusters first</li>
  <li>Coordinate with network operations before deployment</li>
  <li>Use Nokia export for quick configuration deployment</li>
</ul>

<h4 id="network-management">📞 Network Management</h4>
<p>Use the <strong>"🌐 Networks"</strong> button to:</p>
<ul>
  <li>Create multiple isolated networks</li>
  <li>Switch between different deployments</li>
  <li>Keep production and staging separate</li>
  <li>Manage different geographical areas</li>
</ul>
`;


</ul>

<h4 id="network-management">📞 Network Management</h4>
<p>Use the <strong>"🌐 Networks"</strong> button to:</p>
<ul>
  <li>Create multiple isolated networks</li>
  <li>Switch between different deployments</li>
  <li>Keep production and staging separate</li>
  <li>Manage different geographical areas</li>
</ul>
`;


</ul>

<h4 id="network-management">📞 Network Management</h4>
<p>Use the <strong>"🌐 Networks"</strong> button to:</p>
<ul>
  <li>Create multiple isolated networks</li>
  <li>Switch between different deployments</li>
  <li>Keep production and staging separate</li>
  <li>Manage different geographical areas</li>
</ul>
`;

