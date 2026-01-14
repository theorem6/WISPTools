export const planDocs = `
<h3>📋 Plan Module</h3>

<div class="info">
  <strong>Purpose:</strong> Create and manage network expansion projects. Plan new tower sites, sectors, and infrastructure before deployment. Discover marketing addresses and visualize planned network coverage.
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#key-features">🎯 Key Features</a></li>
    <li><a href="#getting-started">🚀 Getting Started</a></li>
    <li><a href="#project-workflow">📊 Project Workflow</a></li>
    <li><a href="#map-features">🗺️ Map Features</a></li>
    <li><a href="#hardware-requirements">📦 Hardware Requirements</a></li>
    <li><a href="#marketing-discovery">📈 Marketing Address Discovery</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
    <li><a href="#next-steps">📚 Next Steps</a></li>
  </ul>
</div>

<h4 id="key-features">🎯 Key Features</h4>
<ul>
  <li><strong>Project Management:</strong> Create, edit, and manage network expansion projects</li>
  <li><strong>Marketing Address Discovery:</strong> Find potential customer addresses in target areas</li>
  <li><strong>Hardware Planning:</strong> Plan required equipment and inventory for projects</li>
  <li><strong>Visual Planning:</strong> Draw coverage areas and plan tower locations on map</li>
  <li><strong>Project Workflow:</strong> Move projects from draft → ready → approved → deployed</li>
  <li><strong>Hardware Requirements:</strong> Track equipment needed for each project</li>
</ul>

<h4 id="getting-started">🚀 Getting Started</h4>

<h4>Step 1: Create a New Project</h4>
<ol>
  <li>Click <strong>"New Project"</strong> button</li>
  <li>Enter project details:
    <ul>
      <li><strong>Project Name</strong> - Descriptive name (e.g., "Downtown Expansion")</li>
      <li><strong>Description</strong> - Project goals and scope</li>
      <li><strong>Location</strong> - Target area address or coordinates</li>
      <li><strong>Target Radius</strong> - Coverage area in miles (default: 5 miles)</li>
    </ul>
  </li>
  <li>Click <strong>"Create Project"</strong></li>
  <li>Project starts in <strong>"Draft"</strong> status</li>
</ol>

<h4>Step 2: Discover Marketing Addresses</h4>
<ol>
  <li>With a project active, click <strong>"Discover Addresses"</strong></li>
  <li>Draw a rectangle on the map or use project center</li>
  <li>System discovers potential customer addresses in the area</li>
  <li>Review discovered addresses:
    <ul>
      <li>Address details and coordinates</li>
      <li>Estimated serviceability</li>
      <li>Distance from planned towers</li>
    </ul>
  </li>
  <li>Addresses are saved to the project</li>
</ol>

<h4>Step 3: Plan Tower Sites</h4>
<ol>
  <li>Right-click on map where you want a tower</li>
  <li>Select <strong>"Add to Plan" → "Add Site"</strong></li>
  <li>Enter tower details:
    <ul>
      <li>Site name and type</li>
      <li>Height and location</li>
      <li>FCC ID (if applicable)</li>
    </ul>
  </li>
  <li>Tower is linked to the active project</li>
  <li>Repeat for all planned towers</li>
</ol>

<h4>Step 4: Plan Sectors</h4>
<ol>
  <li>Right-click on a planned tower</li>
  <li>Select <strong>"Add to Plan" → "Add Sector"</strong></li>
  <li>Configure sector parameters:
    <ul>
      <li>Azimuth (direction)</li>
      <li>Beamwidth and tilt</li>
      <li>Frequency band</li>
      <li>Technology (LTE, CBRS, FWA)</li>
    </ul>
  </li>
  <li>Sector is linked to project</li>
</ol>

<h4>Step 5: Add Hardware Requirements</h4>
<ol>
  <li>Click <strong>"Hardware Requirements"</strong> button</li>
  <li>Click <strong>"Add Requirement"</strong></li>
  <li>Enter equipment details:
    <ul>
      <li>Category (Radio, Antenna, Router, etc.)</li>
      <li>Manufacturer and model</li>
      <li>Quantity needed</li>
      <li>Priority (Low, Medium, High, Critical)</li>
    </ul>
  </li>
  <li>Save requirement</li>
  <li>Repeat for all needed equipment</li>
</ol>

<h4>Step 6: Finalize Project</h4>
<ol>
  <li>Review all planned sites, sectors, and requirements</li>
  <li>Click <strong>"Finalize Project"</strong></li>
  <li>Project status changes to <strong>"Ready"</strong></li>
  <li>Project moves to <strong>Deploy</strong> module for approval</li>
</ol>

<h4 id="project-workflow">📊 Project Workflow</h4>

<h4>Project Statuses</h4>
<ul>
  <li><strong>Draft:</strong> Project is being planned (Plan module only)</li>
  <li><strong>Ready:</strong> Project is finalized and ready for approval</li>
  <li><strong>Approved:</strong> Project approved for deployment</li>
  <li><strong>Authorized:</strong> Project authorized to begin deployment</li>
  <li><strong>Deployed:</strong> Project deployment completed</li>
  <li><strong>Archived:</strong> Project completed or cancelled</li>
</ul>

<h4>Workflow Steps</h4>
<ol>
  <li><strong>Plan Module:</strong> Create project, plan sites, add requirements</li>
  <li><strong>Plan Module:</strong> Finalize project (status: Ready)</li>
  <li><strong>Deploy Module:</strong> Review and approve project</li>
  <li><strong>Deploy Module:</strong> Authorize deployment</li>
  <li><strong>Deploy Module:</strong> Deploy hardware and mark as deployed</li>
</ol>

<h4 id="map-features">🗺️ Map Features</h4>

<h4>Planning Mode</h4>
<p>In Plan module, the map shows:</p>
<ul>
  <li><strong>Planned Sites:</strong> Tower sites created in this project</li>
  <li><strong>Planned Sectors:</strong> Sectors linked to project</li>
  <li><strong>Marketing Addresses:</strong> Discovered potential customer locations</li>
  <li><strong>Existing Network:</strong> Current deployed infrastructure (read-only)</li>
  <li><strong>Hardware Inventory:</strong> Available equipment for deployment</li>
</ul>

<h4>Drawing Tools</h4>
<ul>
  <li><strong>Rectangle Tool:</strong> Draw area for marketing address discovery</li>
  <li><strong>Right-Click Menu:</strong> Add sites, sectors, CPE to project</li>
  <li><strong>Layer Filters:</strong> Show/hide planned vs. deployed assets</li>
</ul>

<h4 id="hardware-requirements">📦 Hardware Requirements</h4>

<h4>Adding Requirements</h4>
<p>Track equipment needed for project:</p>
<ul>
  <li>Radio equipment (base stations, CPE)</li>
  <li>Antennas and mounting hardware</li>
  <li>Routers and switches</li>
  <li>Power systems and batteries</li>
  <li>Cables and connectors</li>
</ul>

<h4>Requirement Priority</h4>
<ul>
  <li><strong>Critical:</strong> Must have before deployment starts</li>
  <li><strong>High:</strong> Needed early in deployment</li>
  <li><strong>Medium:</strong> Needed during deployment</li>
  <li><strong>Low:</strong> Nice to have, can be added later</li>
</ul>

<h4>Checking Inventory</h4>
<ol>
  <li>View hardware requirements list</li>
  <li>System shows available inventory</li>
  <li>Identify missing equipment</li>
  <li>Order or allocate equipment before deployment</li>
</ol>

<h4 id="marketing-discovery">📈 Marketing Address Discovery</h4>

<h4>How It Works</h4>
<p>Uses Microsoft Footprints API to discover addresses:</p>
<ol>
  <li>Draw rectangle on map or use project center</li>
  <li>System queries address database</li>
  <li>Returns potential customer locations</li>
  <li>Addresses saved to project for review</li>
</ol>

<h4>Using Discovered Addresses</h4>
<ul>
  <li>Review address list</li>
  <li>Filter by distance from towers</li>
  <li>Export addresses for marketing campaigns</li>
  <li>Use for coverage planning</li>
  <li>Prioritize high-value areas</li>
</ul>

<h4 id="best-practices">💡 Best Practices</h4>
<ul>
  <li><strong>Start with Location:</strong> Choose target area first</li>
  <li><strong>Discover Early:</strong> Find addresses before planning towers</li>
  <li><strong>Plan Coverage:</strong> Ensure towers cover discovered addresses</li>
  <li><strong>Track Requirements:</strong> Add all needed equipment</li>
  <li><strong>Review Before Finalizing:</strong> Double-check all planned assets</li>
  <li><strong>Coordinate with Deploy:</strong> Ensure inventory is available</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>Can't create project:</h4>
<ul>
  <li>Verify you have tenant selected</li>
  <li>Check project name is unique</li>
  <li>Ensure location coordinates are valid</li>
</ul>

<h4>Marketing discovery not working:</h4>
<ul>
  <li>Verify Microsoft Footprints API is configured</li>
  <li>Check rectangle is drawn correctly</li>
  <li>Ensure area is not too large (max 50 miles radius)</li>
</ul>

<h4>Planned sites not showing:</h4>
<ul>
  <li>Verify project is active (selected)</li>
  <li>Check layer filters show planned assets</li>
  <li>Ensure sites are linked to project</li>
</ul>

<h4 id="next-steps">📚 Next Steps</h4>

<p>After finalizing your project:</p>
<ul>
  <li>Project moves to <strong>Deploy</strong> module for approval</li>
  <li>Once approved, hardware can be deployed</li>
  <li>Deployed assets appear in <strong>Monitor</strong> module</li>
</ul>
`;

export const planDocs = `
<h3>📋 Plan Module</h3>

<div class="info">
  <strong>Purpose:</strong> Create and manage network expansion projects. Plan new tower sites, sectors, and infrastructure before deployment. Discover marketing addresses and visualize planned network coverage.
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#key-features">🎯 Key Features</a></li>
    <li><a href="#getting-started">🚀 Getting Started</a></li>
    <li><a href="#project-workflow">📊 Project Workflow</a></li>
    <li><a href="#map-features">🗺️ Map Features</a></li>
    <li><a href="#hardware-requirements">📦 Hardware Requirements</a></li>
    <li><a href="#marketing-discovery">📈 Marketing Address Discovery</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
    <li><a href="#next-steps">📚 Next Steps</a></li>
  </ul>
</div>

<h4 id="key-features">🎯 Key Features</h4>
<ul>
  <li><strong>Project Management:</strong> Create, edit, and manage network expansion projects</li>
  <li><strong>Marketing Address Discovery:</strong> Find potential customer addresses in target areas</li>
  <li><strong>Hardware Planning:</strong> Plan required equipment and inventory for projects</li>
  <li><strong>Visual Planning:</strong> Draw coverage areas and plan tower locations on map</li>
  <li><strong>Project Workflow:</strong> Move projects from draft → ready → approved → deployed</li>
  <li><strong>Hardware Requirements:</strong> Track equipment needed for each project</li>
</ul>

<h4 id="getting-started">🚀 Getting Started</h4>

<h4>Step 1: Create a New Project</h4>
<ol>
  <li>Click <strong>"New Project"</strong> button</li>
  <li>Enter project details:
    <ul>
      <li><strong>Project Name</strong> - Descriptive name (e.g., "Downtown Expansion")</li>
      <li><strong>Description</strong> - Project goals and scope</li>
      <li><strong>Location</strong> - Target area address or coordinates</li>
      <li><strong>Target Radius</strong> - Coverage area in miles (default: 5 miles)</li>
    </ul>
  </li>
  <li>Click <strong>"Create Project"</strong></li>
  <li>Project starts in <strong>"Draft"</strong> status</li>
</ol>

<h4>Step 2: Discover Marketing Addresses</h4>
<ol>
  <li>With a project active, click <strong>"Discover Addresses"</strong></li>
  <li>Draw a rectangle on the map or use project center</li>
  <li>System discovers potential customer addresses in the area</li>
  <li>Review discovered addresses:
    <ul>
      <li>Address details and coordinates</li>
      <li>Estimated serviceability</li>
      <li>Distance from planned towers</li>
    </ul>
  </li>
  <li>Addresses are saved to the project</li>
</ol>

<h4>Step 3: Plan Tower Sites</h4>
<ol>
  <li>Right-click on map where you want a tower</li>
  <li>Select <strong>"Add to Plan" → "Add Site"</strong></li>
  <li>Enter tower details:
    <ul>
      <li>Site name and type</li>
      <li>Height and location</li>
      <li>FCC ID (if applicable)</li>
    </ul>
  </li>
  <li>Tower is linked to the active project</li>
  <li>Repeat for all planned towers</li>
</ol>

<h4>Step 4: Plan Sectors</h4>
<ol>
  <li>Right-click on a planned tower</li>
  <li>Select <strong>"Add to Plan" → "Add Sector"</strong></li>
  <li>Configure sector parameters:
    <ul>
      <li>Azimuth (direction)</li>
      <li>Beamwidth and tilt</li>
      <li>Frequency band</li>
      <li>Technology (LTE, CBRS, FWA)</li>
    </ul>
  </li>
  <li>Sector is linked to project</li>
</ol>

<h4>Step 5: Add Hardware Requirements</h4>
<ol>
  <li>Click <strong>"Hardware Requirements"</strong> button</li>
  <li>Click <strong>"Add Requirement"</strong></li>
  <li>Enter equipment details:
    <ul>
      <li>Category (Radio, Antenna, Router, etc.)</li>
      <li>Manufacturer and model</li>
      <li>Quantity needed</li>
      <li>Priority (Low, Medium, High, Critical)</li>
    </ul>
  </li>
  <li>Save requirement</li>
  <li>Repeat for all needed equipment</li>
</ol>

<h4>Step 6: Finalize Project</h4>
<ol>
  <li>Review all planned sites, sectors, and requirements</li>
  <li>Click <strong>"Finalize Project"</strong></li>
  <li>Project status changes to <strong>"Ready"</strong></li>
  <li>Project moves to <strong>Deploy</strong> module for approval</li>
</ol>

<h4 id="project-workflow">📊 Project Workflow</h4>

<h4>Project Statuses</h4>
<ul>
  <li><strong>Draft:</strong> Project is being planned (Plan module only)</li>
  <li><strong>Ready:</strong> Project is finalized and ready for approval</li>
  <li><strong>Approved:</strong> Project approved for deployment</li>
  <li><strong>Authorized:</strong> Project authorized to begin deployment</li>
  <li><strong>Deployed:</strong> Project deployment completed</li>
  <li><strong>Archived:</strong> Project completed or cancelled</li>
</ul>

<h4>Workflow Steps</h4>
<ol>
  <li><strong>Plan Module:</strong> Create project, plan sites, add requirements</li>
  <li><strong>Plan Module:</strong> Finalize project (status: Ready)</li>
  <li><strong>Deploy Module:</strong> Review and approve project</li>
  <li><strong>Deploy Module:</strong> Authorize deployment</li>
  <li><strong>Deploy Module:</strong> Deploy hardware and mark as deployed</li>
</ol>

<h4 id="map-features">🗺️ Map Features</h4>

<h4>Planning Mode</h4>
<p>In Plan module, the map shows:</p>
<ul>
  <li><strong>Planned Sites:</strong> Tower sites created in this project</li>
  <li><strong>Planned Sectors:</strong> Sectors linked to project</li>
  <li><strong>Marketing Addresses:</strong> Discovered potential customer locations</li>
  <li><strong>Existing Network:</strong> Current deployed infrastructure (read-only)</li>
  <li><strong>Hardware Inventory:</strong> Available equipment for deployment</li>
</ul>

<h4>Drawing Tools</h4>
<ul>
  <li><strong>Rectangle Tool:</strong> Draw area for marketing address discovery</li>
  <li><strong>Right-Click Menu:</strong> Add sites, sectors, CPE to project</li>
  <li><strong>Layer Filters:</strong> Show/hide planned vs. deployed assets</li>
</ul>

<h4 id="hardware-requirements">📦 Hardware Requirements</h4>

<h4>Adding Requirements</h4>
<p>Track equipment needed for project:</p>
<ul>
  <li>Radio equipment (base stations, CPE)</li>
  <li>Antennas and mounting hardware</li>
  <li>Routers and switches</li>
  <li>Power systems and batteries</li>
  <li>Cables and connectors</li>
</ul>

<h4>Requirement Priority</h4>
<ul>
  <li><strong>Critical:</strong> Must have before deployment starts</li>
  <li><strong>High:</strong> Needed early in deployment</li>
  <li><strong>Medium:</strong> Needed during deployment</li>
  <li><strong>Low:</strong> Nice to have, can be added later</li>
</ul>

<h4>Checking Inventory</h4>
<ol>
  <li>View hardware requirements list</li>
  <li>System shows available inventory</li>
  <li>Identify missing equipment</li>
  <li>Order or allocate equipment before deployment</li>
</ol>

<h4 id="marketing-discovery">📈 Marketing Address Discovery</h4>

<h4>How It Works</h4>
<p>Uses Microsoft Footprints API to discover addresses:</p>
<ol>
  <li>Draw rectangle on map or use project center</li>
  <li>System queries address database</li>
  <li>Returns potential customer locations</li>
  <li>Addresses saved to project for review</li>
</ol>

<h4>Using Discovered Addresses</h4>
<ul>
  <li>Review address list</li>
  <li>Filter by distance from towers</li>
  <li>Export addresses for marketing campaigns</li>
  <li>Use for coverage planning</li>
  <li>Prioritize high-value areas</li>
</ul>

<h4 id="best-practices">💡 Best Practices</h4>
<ul>
  <li><strong>Start with Location:</strong> Choose target area first</li>
  <li><strong>Discover Early:</strong> Find addresses before planning towers</li>
  <li><strong>Plan Coverage:</strong> Ensure towers cover discovered addresses</li>
  <li><strong>Track Requirements:</strong> Add all needed equipment</li>
  <li><strong>Review Before Finalizing:</strong> Double-check all planned assets</li>
  <li><strong>Coordinate with Deploy:</strong> Ensure inventory is available</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>Can't create project:</h4>
<ul>
  <li>Verify you have tenant selected</li>
  <li>Check project name is unique</li>
  <li>Ensure location coordinates are valid</li>
</ul>

<h4>Marketing discovery not working:</h4>
<ul>
  <li>Verify Microsoft Footprints API is configured</li>
  <li>Check rectangle is drawn correctly</li>
  <li>Ensure area is not too large (max 50 miles radius)</li>
</ul>

<h4>Planned sites not showing:</h4>
<ul>
  <li>Verify project is active (selected)</li>
  <li>Check layer filters show planned assets</li>
  <li>Ensure sites are linked to project</li>
</ul>

<h4 id="next-steps">📚 Next Steps</h4>

<p>After finalizing your project:</p>
<ul>
  <li>Project moves to <strong>Deploy</strong> module for approval</li>
  <li>Once approved, hardware can be deployed</li>
  <li>Deployed assets appear in <strong>Monitor</strong> module</li>
</ul>
`;

export const planDocs = `
<h3>📋 Plan Module</h3>

<div class="info">
  <strong>Purpose:</strong> Create and manage network expansion projects. Plan new tower sites, sectors, and infrastructure before deployment. Discover marketing addresses and visualize planned network coverage.
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#key-features">🎯 Key Features</a></li>
    <li><a href="#getting-started">🚀 Getting Started</a></li>
    <li><a href="#project-workflow">📊 Project Workflow</a></li>
    <li><a href="#map-features">🗺️ Map Features</a></li>
    <li><a href="#hardware-requirements">📦 Hardware Requirements</a></li>
    <li><a href="#marketing-discovery">📈 Marketing Address Discovery</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
    <li><a href="#next-steps">📚 Next Steps</a></li>
  </ul>
</div>

<h4 id="key-features">🎯 Key Features</h4>
<ul>
  <li><strong>Project Management:</strong> Create, edit, and manage network expansion projects</li>
  <li><strong>Marketing Address Discovery:</strong> Find potential customer addresses in target areas</li>
  <li><strong>Hardware Planning:</strong> Plan required equipment and inventory for projects</li>
  <li><strong>Visual Planning:</strong> Draw coverage areas and plan tower locations on map</li>
  <li><strong>Project Workflow:</strong> Move projects from draft → ready → approved → deployed</li>
  <li><strong>Hardware Requirements:</strong> Track equipment needed for each project</li>
</ul>

<h4 id="getting-started">🚀 Getting Started</h4>

<h4>Step 1: Create a New Project</h4>
<ol>
  <li>Click <strong>"New Project"</strong> button</li>
  <li>Enter project details:
    <ul>
      <li><strong>Project Name</strong> - Descriptive name (e.g., "Downtown Expansion")</li>
      <li><strong>Description</strong> - Project goals and scope</li>
      <li><strong>Location</strong> - Target area address or coordinates</li>
      <li><strong>Target Radius</strong> - Coverage area in miles (default: 5 miles)</li>
    </ul>
  </li>
  <li>Click <strong>"Create Project"</strong></li>
  <li>Project starts in <strong>"Draft"</strong> status</li>
</ol>

<h4>Step 2: Discover Marketing Addresses</h4>
<ol>
  <li>With a project active, click <strong>"Discover Addresses"</strong></li>
  <li>Draw a rectangle on the map or use project center</li>
  <li>System discovers potential customer addresses in the area</li>
  <li>Review discovered addresses:
    <ul>
      <li>Address details and coordinates</li>
      <li>Estimated serviceability</li>
      <li>Distance from planned towers</li>
    </ul>
  </li>
  <li>Addresses are saved to the project</li>
</ol>

<h4>Step 3: Plan Tower Sites</h4>
<ol>
  <li>Right-click on map where you want a tower</li>
  <li>Select <strong>"Add to Plan" → "Add Site"</strong></li>
  <li>Enter tower details:
    <ul>
      <li>Site name and type</li>
      <li>Height and location</li>
      <li>FCC ID (if applicable)</li>
    </ul>
  </li>
  <li>Tower is linked to the active project</li>
  <li>Repeat for all planned towers</li>
</ol>

<h4>Step 4: Plan Sectors</h4>
<ol>
  <li>Right-click on a planned tower</li>
  <li>Select <strong>"Add to Plan" → "Add Sector"</strong></li>
  <li>Configure sector parameters:
    <ul>
      <li>Azimuth (direction)</li>
      <li>Beamwidth and tilt</li>
      <li>Frequency band</li>
      <li>Technology (LTE, CBRS, FWA)</li>
    </ul>
  </li>
  <li>Sector is linked to project</li>
</ol>

<h4>Step 5: Add Hardware Requirements</h4>
<ol>
  <li>Click <strong>"Hardware Requirements"</strong> button</li>
  <li>Click <strong>"Add Requirement"</strong></li>
  <li>Enter equipment details:
    <ul>
      <li>Category (Radio, Antenna, Router, etc.)</li>
      <li>Manufacturer and model</li>
      <li>Quantity needed</li>
      <li>Priority (Low, Medium, High, Critical)</li>
    </ul>
  </li>
  <li>Save requirement</li>
  <li>Repeat for all needed equipment</li>
</ol>

<h4>Step 6: Finalize Project</h4>
<ol>
  <li>Review all planned sites, sectors, and requirements</li>
  <li>Click <strong>"Finalize Project"</strong></li>
  <li>Project status changes to <strong>"Ready"</strong></li>
  <li>Project moves to <strong>Deploy</strong> module for approval</li>
</ol>

<h4 id="project-workflow">📊 Project Workflow</h4>

<h4>Project Statuses</h4>
<ul>
  <li><strong>Draft:</strong> Project is being planned (Plan module only)</li>
  <li><strong>Ready:</strong> Project is finalized and ready for approval</li>
  <li><strong>Approved:</strong> Project approved for deployment</li>
  <li><strong>Authorized:</strong> Project authorized to begin deployment</li>
  <li><strong>Deployed:</strong> Project deployment completed</li>
  <li><strong>Archived:</strong> Project completed or cancelled</li>
</ul>

<h4>Workflow Steps</h4>
<ol>
  <li><strong>Plan Module:</strong> Create project, plan sites, add requirements</li>
  <li><strong>Plan Module:</strong> Finalize project (status: Ready)</li>
  <li><strong>Deploy Module:</strong> Review and approve project</li>
  <li><strong>Deploy Module:</strong> Authorize deployment</li>
  <li><strong>Deploy Module:</strong> Deploy hardware and mark as deployed</li>
</ol>

<h4 id="map-features">🗺️ Map Features</h4>

<h4>Planning Mode</h4>
<p>In Plan module, the map shows:</p>
<ul>
  <li><strong>Planned Sites:</strong> Tower sites created in this project</li>
  <li><strong>Planned Sectors:</strong> Sectors linked to project</li>
  <li><strong>Marketing Addresses:</strong> Discovered potential customer locations</li>
  <li><strong>Existing Network:</strong> Current deployed infrastructure (read-only)</li>
  <li><strong>Hardware Inventory:</strong> Available equipment for deployment</li>
</ul>

<h4>Drawing Tools</h4>
<ul>
  <li><strong>Rectangle Tool:</strong> Draw area for marketing address discovery</li>
  <li><strong>Right-Click Menu:</strong> Add sites, sectors, CPE to project</li>
  <li><strong>Layer Filters:</strong> Show/hide planned vs. deployed assets</li>
</ul>

<h4 id="hardware-requirements">📦 Hardware Requirements</h4>

<h4>Adding Requirements</h4>
<p>Track equipment needed for project:</p>
<ul>
  <li>Radio equipment (base stations, CPE)</li>
  <li>Antennas and mounting hardware</li>
  <li>Routers and switches</li>
  <li>Power systems and batteries</li>
  <li>Cables and connectors</li>
</ul>

<h4>Requirement Priority</h4>
<ul>
  <li><strong>Critical:</strong> Must have before deployment starts</li>
  <li><strong>High:</strong> Needed early in deployment</li>
  <li><strong>Medium:</strong> Needed during deployment</li>
  <li><strong>Low:</strong> Nice to have, can be added later</li>
</ul>

<h4>Checking Inventory</h4>
<ol>
  <li>View hardware requirements list</li>
  <li>System shows available inventory</li>
  <li>Identify missing equipment</li>
  <li>Order or allocate equipment before deployment</li>
</ol>

<h4 id="marketing-discovery">📈 Marketing Address Discovery</h4>

<h4>How It Works</h4>
<p>Uses Microsoft Footprints API to discover addresses:</p>
<ol>
  <li>Draw rectangle on map or use project center</li>
  <li>System queries address database</li>
  <li>Returns potential customer locations</li>
  <li>Addresses saved to project for review</li>
</ol>

<h4>Using Discovered Addresses</h4>
<ul>
  <li>Review address list</li>
  <li>Filter by distance from towers</li>
  <li>Export addresses for marketing campaigns</li>
  <li>Use for coverage planning</li>
  <li>Prioritize high-value areas</li>
</ul>

<h4 id="best-practices">💡 Best Practices</h4>
<ul>
  <li><strong>Start with Location:</strong> Choose target area first</li>
  <li><strong>Discover Early:</strong> Find addresses before planning towers</li>
  <li><strong>Plan Coverage:</strong> Ensure towers cover discovered addresses</li>
  <li><strong>Track Requirements:</strong> Add all needed equipment</li>
  <li><strong>Review Before Finalizing:</strong> Double-check all planned assets</li>
  <li><strong>Coordinate with Deploy:</strong> Ensure inventory is available</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>Can't create project:</h4>
<ul>
  <li>Verify you have tenant selected</li>
  <li>Check project name is unique</li>
  <li>Ensure location coordinates are valid</li>
</ul>

<h4>Marketing discovery not working:</h4>
<ul>
  <li>Verify Microsoft Footprints API is configured</li>
  <li>Check rectangle is drawn correctly</li>
  <li>Ensure area is not too large (max 50 miles radius)</li>
</ul>

<h4>Planned sites not showing:</h4>
<ul>
  <li>Verify project is active (selected)</li>
  <li>Check layer filters show planned assets</li>
  <li>Ensure sites are linked to project</li>
</ul>

<h4 id="next-steps">📚 Next Steps</h4>

<p>After finalizing your project:</p>
<ul>
  <li>Project moves to <strong>Deploy</strong> module for approval</li>
  <li>Once approved, hardware can be deployed</li>
  <li>Deployed assets appear in <strong>Monitor</strong> module</li>
</ul>
`;







