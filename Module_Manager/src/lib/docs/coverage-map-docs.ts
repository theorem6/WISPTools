export const coverageMapDocs = `
<h3>🗺️ Coverage Map Module</h3>

<div class="info">
  <strong>Purpose:</strong> The Coverage Map is a comprehensive network asset management and visualization system that consolidates all network equipment (towers, sectors, CPE devices, and inventory) into a single interactive ArcGIS-powered map interface. This module serves as the <strong>central hub</strong> for viewing and managing your entire network infrastructure across all modules (CBRS, ACS, PCI Resolution, etc.).
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#key-features">🎯 Key Features</a></li>
    <li><a href="#getting-started">🚀 Getting Started</a></li>
    <li><a href="#map-features">🗺️ Map Features</a></li>
    <li><a href="#site-management">Site Management</a></li>
    <li><a href="#sector-configuration">Sector Configuration</a></li>
    <li><a href="#cpe-management">📡 CPE Management</a></li>
    <li><a href="#backhaul-management">🔗 Backhaul Management</a></li>
    <li><a href="#equipment-inventory">📦 Equipment Inventory</a></li>
    <li><a href="#filtering-search">🔍 Filtering and Search</a></li>
    <li><a href="#reports-export">📊 Reports and Export</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
  </ul>
</div>

<h4 id="key-features">🎯 Key Features</h4>
<ul>
  <li><strong>Interactive Map:</strong> ArcGIS-powered map with satellite, street, and hybrid views</li>
  <li><strong>Tower Site Management:</strong> Add, edit, and manage tower sites with GPS coordinates</li>
  <li><strong>Sector Management:</strong> Configure sectors per tower with azimuth, tilt, and frequency</li>
  <li><strong>CPE Device Mapping:</strong> View and manage customer premise equipment locations</li>
  <li><strong>Backhaul Links:</strong> Visualize and manage point-to-point backhaul connections</li>
  <li><strong>Equipment Inventory:</strong> Track equipment deployed at each site</li>
  <li><strong>Coverage Visualization:</strong> View coverage areas and signal strength</li>
</ul>

<h4 id="getting-started">🚀 Getting Started</h4>

<h4>Step 1: Add a Tower Site</h4>
<ol>
  <li>Navigate to <strong>Coverage Map</strong> module</li>
  <li>Click <strong>"Add Site"</strong> button</li>
  <li>Enter site information:
    <ul>
      <li><strong>Site Name</strong> - Unique identifier</li>
      <li><strong>Address</strong> - Physical location</li>
      <li><strong>GPS Coordinates</strong> - Latitude and longitude (or click on map)</li>
      <li><strong>Site Type</strong> - Tower, Building, Pole, etc.</li>
      <li><strong>Height</strong> - Tower height in meters</li>
    </ul>
  </li>
  <li>Click <strong>"Save"</strong> to create site</li>
</ol>

<h4>Step 2: Add Sectors</h4>
<ol>
  <li>Click on a tower site marker on the map</li>
  <li>Click <strong>"Add Sector"</strong> from site popup</li>
  <li>Enter sector details:
    <ul>
      <li><strong>Azimuth</strong> - Direction (0-360 degrees)</li>
      <li><strong>Tilt</strong> - Antenna tilt angle</li>
      <li><strong>Frequency</strong> - Operating frequency band</li>
      <li><strong>Technology</strong> - LTE, 5G, WiMAX, etc.</li>
      <li><strong>Power</strong> - Transmit power</li>
    </ul>
  </li>
  <li>Save sector</li>
</ol>

<h4>Step 3: Add CPE Devices</h4>
<ol>
  <li>Click <strong>"Add CPE"</strong> button</li>
  <li>Enter CPE information:
    <ul>
      <li><strong>Serial Number</strong> - Device identifier</li>
      <li><strong>Customer</strong> - Associated customer</li>
      <li><strong>Location</strong> - GPS coordinates or click on map</li>
      <li><strong>Model</strong> - CPE device model</li>
      <li><strong>Status</strong> - Active, Inactive, Maintenance</li>
    </ul>
  </li>
  <li>Save CPE device</li>
</ol>

<h4 id="map-features">🗺️ Map Features</h4>

<h4>Map Controls</h4>
<ul>
  <li><strong>Zoom:</strong> Mouse wheel or +/- buttons</li>
  <li><strong>Pan:</strong> Click and drag map</li>
  <li><strong>Basemap:</strong> Switch between street, satellite, hybrid, topographic</li>
  <li><strong>Search:</strong> Search for addresses or coordinates</li>
  <li><strong>Measure:</strong> Measure distances between points</li>
  <li><strong>Draw:</strong> Draw coverage areas and zones</li>
</ul>

<h4>Map Layers</h4>
<ul>
  <li><strong>Tower Sites:</strong> Network infrastructure sites</li>
  <li><strong>Sectors:</strong> Antenna sectors with coverage arcs</li>
  <li><strong>CPE Devices:</strong> Customer premise equipment</li>
  <li><strong>Backhaul Links:</strong> Point-to-point connections</li>
  <li><strong>Coverage Areas:</strong> Signal coverage visualization</li>
  <li><strong>Equipment:</strong> Deployed equipment markers</li>
</ul>

<h4 id="site-management">Site Management</h4>

<h4>Viewing Site Details</h4>
<p>Click on any site marker to see:</p>
<ul>
  <li>Site information and address</li>
  <li>List of sectors configured</li>
  <li>Deployed equipment inventory</li>
  <li>Connected CPE devices</li>
  <li>Backhaul links</li>
  <li>Site actions menu</li>
</ul>

<h4>Editing Sites</h4>
<ol>
  <li>Click site marker</li>
  <li>Click <strong>"Edit Site"</strong></li>
  <li>Update site information</li>
  <li>Move marker on map to update coordinates</li>
  <li>Save changes</li>
</ol>

<h4 id="sector-configuration">Sector Configuration</h4>

<h4>Adding Sectors</h4>
<p>Each tower can have multiple sectors:</p>
<ul>
  <li>Typically 3-6 sectors per tower</li>
  <li>Each sector covers 60-120 degrees</li>
  <li>Sectors can overlap for redundancy</li>
  <li>Visual coverage arcs shown on map</li>
</ul>

<h4>Sector Parameters</h4>
<ul>
  <li><strong>Azimuth:</strong> Direction sector is pointing (0-360°)</li>
  <li><strong>Tilt:</strong> Antenna downtilt angle</li>
  <li><strong>Frequency:</strong> Operating frequency band</li>
  <li><strong>Technology:</strong> LTE, 5G, WiMAX, etc.</li>
  <li><strong>Power:</strong> Transmit power in dBm</li>
  <li><strong>Height:</strong> Antenna height above ground</li>
</ul>

<h4 id="cpe-management">📡 CPE Management</h4>

<h4>Adding CPE Devices</h4>
<p>CPE devices represent customer equipment:</p>
<ul>
  <li>Link to customer accounts</li>
  <li>Track installation location</li>
  <li>Monitor connection status</li>
  <li>View signal strength</li>
  <li>Manage firmware updates</li>
</ul>

<h4>CPE Status</h4>
<ul>
  <li><strong>Active:</strong> Device is online and operational</li>
  <li><strong>Inactive:</strong> Device is offline or disconnected</li>
  <li><strong>Maintenance:</strong> Device requires service</li>
  <li><strong>Pending:</strong> Device awaiting installation</li>
</ul>

<h4 id="backhaul-management">🔗 Backhaul Management</h4>

<h4>Adding Backhaul Links</h4>
<ol>
  <li>Click <strong>"Add Backhaul Link"</strong></li>
  <li>Select source site</li>
  <li>Select destination site</li>
  <li>Enter link details:
    <ul>
      <li><strong>Link Type:</strong> Point-to-point, Point-to-multipoint</li>
      <li><strong>Frequency:</strong> Operating frequency</li>
      <li><strong>Bandwidth:</strong> Link capacity</li>
      <li><strong>Status:</strong> Active, Planned, Maintenance</li>
    </ul>
  </li>
  <li>Save backhaul link</li>
</ol>

<h4>Visualizing Backhaul</h4>
<ul>
  <li>Lines connect source and destination sites</li>
  <li>Color coding by status (green=active, red=down, yellow=maintenance)</li>
  <li>Click link to view details</li>
  <li>Monitor link utilization</li>
</ul>

<h4 id="equipment-inventory">📦 Equipment Inventory</h4>

<h4>Site Equipment</h4>
<p>Track equipment deployed at each site:</p>
<ul>
  <li>Radios and antennas</li>
  <li>Switches and routers</li>
  <li>Power systems</li>
  <li>Enclosures and mounting hardware</li>
</ul>

<h4>Adding Equipment</h4>
<ol>
  <li>Click site marker</li>
  <li>Click <strong>"Add Equipment"</strong></li>
  <li>Select equipment from inventory</li>
  <li>Enter deployment date</li>
  <li>Add notes</li>
  <li>Save equipment assignment</li>
</ol>

<h4 id="filtering-search">🔍 Filtering and Search</h4>

<h4>Filter Panel</h4>
<p>Use filters to focus on specific elements:</p>
<ul>
  <li><strong>Site Type:</strong> Filter by tower, building, pole</li>
  <li><strong>Technology:</strong> Filter by LTE, 5G, WiMAX</li>
  <li><strong>Status:</strong> Filter by active, inactive, maintenance</li>
  <li><strong>Coverage Area:</strong> Show/hide coverage visualization</li>
</ul>

<h4>Search Functionality</h4>
<ul>
  <li>Search by site name</li>
  <li>Search by address</li>
  <li>Search by customer name</li>
  <li>Search by equipment serial number</li>
</ul>

<h4 id="reports-export">📊 Reports and Export</h4>

<h4>Available Reports</h4>
<ul>
  <li><strong>Site Inventory:</strong> Equipment at each site</li>
  <li><strong>Coverage Analysis:</strong> Coverage areas and gaps</li>
  <li><strong>CPE Distribution:</strong> CPE devices by location</li>
  <li><strong>Backhaul Network:</strong> Backhaul link topology</li>
</ul>

<h4>Export Options</h4>
<ul>
  <li>Export map as image (PNG, PDF)</li>
  <li>Export site data to CSV</li>
  <li>Export coverage data for analysis</li>
  <li>Print map with annotations</li>
</ul>

<h4 id="best-practices">💡 Best Practices</h4>
<ul>
  <li><strong>Accurate Coordinates:</strong> Use GPS for precise site locations</li>
  <li><strong>Regular Updates:</strong> Keep site information current</li>
  <li><strong>Documentation:</strong> Add notes and photos to sites</li>
  <li><strong>Coverage Planning:</strong> Use coverage visualization for planning</li>
  <li><strong>Equipment Tracking:</strong> Keep equipment inventory updated</li>
  <li><strong>Backhaul Monitoring:</strong> Track backhaul link status</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>Map not loading:</h4>
<ul>
  <li>Check ArcGIS API key is configured</li>
  <li>Verify internet connection</li>
  <li>Clear browser cache</li>
  <li>Check browser console for errors</li>
</ul>

<h4>Sites not appearing:</h4>
<ul>
  <li>Check filters aren't hiding sites</li>
  <li>Verify site coordinates are valid</li>
  <li>Zoom out to see all sites</li>
  <li>Check site status filter</li>
</ul>

<h4>Can't add sectors:</h4>
<ul>
  <li>Verify site is selected</li>
  <li>Check you have edit permissions</li>
  <li>Ensure site exists and is saved</li>
</ul>
`;