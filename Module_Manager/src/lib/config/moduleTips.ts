/**
 * Module Tips Configuration
 * Extracts helpful tips from help documentation for each module
 */

export interface ModuleTip {
  id: string;
  title: string;
  content: string;
  icon?: string;
}

export interface ModuleTipsConfig {
  [moduleId: string]: ModuleTip[];
}

export const moduleTips: ModuleTipsConfig = {
  'monitoring': [
    {
      id: 'monitoring-1',
      title: '📊 Getting Started with Monitoring',
      icon: '📊',
      content: `
        <h4>Before devices appear in Monitor:</h4>
        <p>Devices must be configured in the <strong>Deploy</strong> module first:</p>
        <ol>
          <li>Go to <strong>Deploy</strong> module</li>
          <li>Right-click on deployed equipment</li>
          <li>Select <strong>"Configure SNMP"</strong></li>
          <li>Enter SNMP credentials and test connection</li>
          <li>Device will then appear in Monitor module</li>
        </ol>
        <p><strong>💡 Tip:</strong> If no devices are showing, check that SNMP is configured in Deploy module.</p>
      `
    },
    {
      id: 'monitoring-2',
      title: '📈 Viewing Performance Metrics',
      icon: '📈',
      content: `
        <h4>Performance Graphs Tab</h4>
        <p>View detailed metrics for any device:</p>
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
        <p><strong>💡 Tip:</strong> Use graphs to identify performance issues and capacity planning.</p>
      `
    },
    {
      id: 'monitoring-3',
      title: '🚨 Understanding Alerts',
      icon: '🚨',
      content: `
        <h4>Network Dashboard</h4>
        <p>The dashboard shows:</p>
        <ul>
          <li><strong>System Health:</strong> Overall network status</li>
          <li><strong>Active Alerts:</strong> Critical warnings and errors</li>
          <li><strong>Service Status:</strong> SNMP, EPC, and other services</li>
          <li><strong>Key Metrics:</strong> Uptime, device counts, performance</li>
        </ul>
        <p><strong>💡 Tip:</strong> Check the dashboard regularly to catch issues early.</p>
      `
    },
    {
      id: 'monitoring-4',
      title: '📡 Monitoring SNMP Devices',
      icon: '📡',
      content: `
        <h4>SNMP Devices Tab</h4>
        <p>View all SNMP-enabled devices:</p>
        <ol>
          <li>Click <strong>"SNMP Devices"</strong> tab</li>
          <li>View device list with:
            <ul>
              <li>Device name and type</li>
              <li>Online/Offline status</li>
              <li>IP address</li>
              <li>Last seen timestamp</li>
              <li>Uptime percentage</li>
            </ul>
          </li>
          <li>Click device to view detailed information</li>
          <li>View performance graphs for specific devices</li>
        </ol>
        <p><strong>💡 Tip:</strong> Devices show as offline if they haven't checked in within 5 minutes.</p>
      `
    },
    {
      id: 'monitoring-5',
      title: '🖥️ Monitoring EPC Systems',
      icon: '🖥️',
      content: `
        <h4>EPC Devices Tab</h4>
        <p>Monitor Evolved Packet Core systems:</p>
        <ol>
          <li>Click <strong>"EPC Devices"</strong> tab</li>
          <li>View EPC systems:
            <ul>
              <li>MME connections</li>
              <li>HSS status</li>
              <li>Active subscribers</li>
              <li>System health metrics</li>
            </ul>
          </li>
          <li>Click device for detailed view</li>
          <li>Monitor CPU, memory, and uptime</li>
        </ol>
        <p><strong>💡 Tip:</strong> EPC devices must be deployed in Deploy module before they appear here.</p>
      `
    },
    {
      id: 'monitoring-6',
      title: '🗺️ Geographic Map View',
      icon: '🗺️',
      content: `
        <h4>Map Tab</h4>
        <p>Visualize device locations on map:</p>
        <ul>
          <li><strong>Green markers:</strong> Online devices</li>
          <li><strong>Red markers:</strong> Offline devices</li>
          <li><strong>Orange markers:</strong> Maintenance mode</li>
        </ul>
        <p>Actions:</p>
        <ol>
          <li>Click marker for device details</li>
          <li>Right-click for site details</li>
          <li>View all equipment at a site</li>
        </ol>
        <p><strong>💡 Tip:</strong> Use the map to quickly identify which sites need attention.</p>
      `
    }
  ],
  'deploy': [
    {
      id: 'deploy-1',
      title: '📋 Reviewing and Approving Plans',
      icon: '📋',
      content: `
        <h4>Step 1: Review Ready Plans</h4>
        <p>Plans come from the Plan module:</p>
        <ol>
          <li>Click <strong>"Projects"</strong> button in header</li>
          <li>View projects in <strong>"Ready"</strong> status</li>
          <li>Review each plan:
            <ul>
              <li>Project name and description</li>
              <li>Planned sites and sectors</li>
              <li>Hardware requirements</li>
              <li>Marketing addresses discovered</li>
            </ul>
          </li>
          <li>Select a plan to review details</li>
        </ol>
        <p><strong>💡 Tip:</strong> Only "Ready" plans can be approved for deployment.</p>
      `
    },
    {
      id: 'deploy-2',
      title: '✅ Approving or Rejecting Plans',
      icon: '✅',
      content: `
        <h4>Step 2: Make Approval Decision</h4>
        <p>After reviewing a plan:</p>
        <ol>
          <li>Select the ready plan</li>
          <li>Review all planned assets carefully</li>
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
              <li>Add rejection reason</li>
              <li>Plan returns to Plan module for revision</li>
            </ul>
          </li>
        </ol>
        <p><strong>💡 Tip:</strong> Verify inventory availability before approving.</p>
      `
    },
    {
      id: 'deploy-3',
      title: '🔐 Authorizing Deployment',
      icon: '🔐',
      content: `
        <h4>Step 3: Authorize Approved Plans</h4>
        <p>Before deployment can begin:</p>
        <ol>
          <li>Select an approved plan</li>
          <li>Verify inventory is available for all requirements</li>
          <li>Click <strong>"Authorize Deployment"</strong></li>
          <li>Plan status changes to <strong>"Authorized"</strong></li>
          <li>Deployment can now begin</li>
        </ol>
        <p><strong>💡 Tip:</strong> Authorization locks the plan and allows field deployment to start.</p>
      `
    },
    {
      id: 'deploy-4',
      title: '🔧 Deploying Hardware to Sites',
      icon: '🔧',
      content: `
        <h4>Step 4: Deploy Equipment</h4>
        <p>Deploy hardware from inventory to sites:</p>
        <ol>
          <li>Right-click on a tower site marker on the map</li>
          <li>Select <strong>"View Equipment"</strong> or <strong>"Deploy Hardware"</strong></li>
          <li>Choose equipment from inventory:
            <ul>
              <li>Filter by equipment type</li>
              <li>View available quantities</li>
              <li>Select items to deploy</li>
            </ul>
          </li>
          <li>Enter deployment details (date, installer, notes)</li>
          <li>Click <strong>"Deploy"</strong></li>
          <li>Equipment status changes to "Deployed"</li>
        </ol>
        <p><strong>💡 Tip:</strong> Equipment must be in inventory before it can be deployed.</p>
      `
    },
    {
      id: 'deploy-5',
      title: '📡 Deploying EPC Systems',
      icon: '📡',
      content: `
        <h4>Step 5: Deploy EPC/SNMP Agents</h4>
        <p>To deploy remote EPC/SNMP agents:</p>
        <ol>
          <li>Click the <strong>EPC Deployment</strong> button in header</li>
          <li>Select a <strong>site</strong> from the dropdown (required)</li>
          <li>Choose deployment type:
            <ul>
              <li><strong>EPC Core Only:</strong> Open5GS EPC components</li>
              <li><strong>SNMP Only:</strong> Monitoring agents</li>
              <li><strong>Both:</strong> EPC + SNMP together</li>
            </ul>
          </li>
          <li>Configure network and HSS settings</li>
          <li>Generate deployment script or ISO</li>
        </ol>
        <p><strong>💡 Tip:</strong> Site selection is required - create sites in Coverage Map first if needed.</p>
      `
    },
    {
      id: 'deploy-6',
      title: '🔍 Configuring SNMP Monitoring',
      icon: '🔍',
      content: `
        <h4>Step 6: Set Up SNMP Monitoring</h4>
        <p>Enable monitoring for deployed equipment:</p>
        <ol>
          <li>Right-click on deployed equipment on the map</li>
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
        <p><strong>💡 Tip:</strong> SNMP must be configured before devices show up in Monitoring module.</p>
      `
    },
    {
      id: 'deploy-7',
      title: '📊 PCI and Frequency Planning',
      icon: '📊',
      content: `
        <h4>Planning Tools</h4>
        <p>Use built-in planning tools to optimize your network:</p>
        <ul>
          <li><strong>PCI Planner:</strong> Plan Physical Cell ID assignments for LTE sectors
            <ul>
              <li>Prevents PCI conflicts</li>
              <li>Optimizes cell identification</li>
            </ul>
          </li>
          <li><strong>Frequency Planner:</strong> Optimize frequency assignments across network
            <ul>
              <li>Prevents interference</li>
              <li>Maximizes spectrum efficiency</li>
            </ul>
          </li>
        </ul>
        <p><strong>💡 Tip:</strong> Run these planners before deploying to avoid conflicts.</p>
      `
    }
  ],
  'coverage-map': [
    {
      id: 'coverage-1',
      title: '🗺️ Getting Started with Coverage Map',
      icon: '🗺️',
      content: `
        <h4>Coverage Map is Your Central Hub</h4>
        <p>The Coverage Map consolidates all network equipment into a single interactive map:</p>
        <ul>
          <li><strong>Tower Sites:</strong> Add and manage tower locations</li>
          <li><strong>Sectors:</strong> Configure sectors per tower</li>
          <li><strong>CPE Devices:</strong> View customer equipment locations</li>
          <li><strong>Backhaul Links:</strong> Visualize network connections</li>
          <li><strong>Equipment Inventory:</strong> Track deployed equipment at sites</li>
        </ul>
        <p><strong>💡 Tip:</strong> This is the central hub for viewing your entire network infrastructure.</p>
      `
    },
    {
      id: 'coverage-2',
      title: '📡 Adding Tower Sites',
      icon: '📡',
      content: `
        <h4>Step 1: Add a Tower Site</h4>
        <ol>
          <li>Click <strong>"Add Site"</strong> button</li>
          <li>Enter site information:
            <ul>
              <li>Site name and address</li>
              <li>GPS coordinates (or click on map)</li>
              <li>Site type (Tower, Building, Pole, etc.)</li>
              <li>Tower height in meters</li>
            </ul>
          </li>
          <li>Click <strong>"Save"</strong></li>
        </ol>
        <p><strong>💡 Tip:</strong> You can click directly on the map to set GPS coordinates automatically.</p>
      `
    },
    {
      id: 'coverage-3',
      title: '📶 Adding Sectors',
      icon: '📶',
      content: `
        <h4>Step 2: Add Sectors to Sites</h4>
        <ol>
          <li>Click on a tower site marker on the map</li>
          <li>Click <strong>"Add Sector"</strong> from site popup</li>
          <li>Enter sector details:
            <ul>
              <li><strong>Azimuth:</strong> Direction (0-360°)</li>
              <li><strong>Tilt:</strong> Antenna downtilt angle</li>
              <li><strong>Frequency:</strong> Operating frequency band</li>
              <li><strong>Technology:</strong> LTE, 5G, WiMAX, etc.</li>
              <li><strong>Power:</strong> Transmit power in dBm</li>
            </ul>
          </li>
          <li>Save sector</li>
        </ol>
        <p><strong>💡 Tip:</strong> Plan 3-6 sectors per tower for 360° coverage.</p>
      `
    },
    {
      id: 'coverage-4',
      title: '📱 Managing CPE Devices',
      icon: '📱',
      content: `
        <h4>Step 3: Add CPE Devices</h4>
        <p>Customer Premise Equipment represents customer devices:</p>
        <ol>
          <li>Click <strong>"Add CPE"</strong> button</li>
          <li>Enter CPE information:
            <ul>
              <li>Serial number and model</li>
              <li>Associated customer</li>
              <li>Location (GPS or click map)</li>
              <li>Status (Active, Inactive, Maintenance)</li>
            </ul>
          </li>
          <li>Save CPE device</li>
        </ol>
        <p><strong>💡 Tip:</strong> CPE devices link to customer accounts and track installation locations.</p>
      `
    },
    {
      id: 'coverage-5',
      title: '🔗 Managing Backhaul Links',
      icon: '🔗',
      content: `
        <h4>Step 4: Add Backhaul Connections</h4>
        <p>Visualize point-to-point network connections:</p>
        <ol>
          <li>Click on a site marker</li>
          <li>Select <strong>"Add Backhaul"</strong></li>
          <li>Choose source and destination sites</li>
          <li>Enter link details:
            <ul>
              <li>Link type (Point-to-point, Point-to-multipoint)</li>
              <li>Frequency and bandwidth</li>
              <li>Status (Active, Planned, Maintenance)</li>
            </ul>
          </li>
          <li>Save backhaul link</li>
        </ol>
        <p><strong>💡 Tip:</strong> Backhaul links show how sites connect to your network backbone.</p>
      `
    },
    {
      id: 'coverage-6',
      title: '📦 Viewing Site Equipment',
      icon: '📦',
      content: `
        <h4>Step 5: Manage Equipment at Sites</h4>
        <p>View and manage equipment deployed at each site:</p>
        <ol>
          <li>Click on a site marker</li>
          <li>Click <strong>"View Equipment"</strong> or <strong>"Deploy Hardware"</strong></li>
          <li>See all equipment at that site:
            <ul>
              <li>Radios and antennas</li>
              <li>Routers and switches</li>
              <li>EPC systems</li>
              <li>SNMP monitoring devices</li>
            </ul>
          </li>
          <li>Add or remove equipment as needed</li>
        </ol>
        <p><strong>💡 Tip:</strong> Equipment must be in inventory before it can be deployed to sites.</p>
      `
    }
  ],
  'inventory': [
    {
      id: 'inventory-1',
      title: '📦 Adding Equipment to Inventory',
      icon: '📦',
      content: `
        <h4>Step 1: Add Equipment</h4>
        <ol>
          <li>Navigate to <strong>Inventory</strong> module</li>
          <li>Click <strong>"Add Equipment"</strong> button</li>
          <li>Enter equipment details:
            <ul>
              <li><strong>Serial Number</strong> (required, unique identifier)</li>
              <li><strong>Model/Type</strong> and Manufacturer</li>
              <li><strong>Category:</strong> Router, Radio, Antenna, CPE, etc.</li>
              <li><strong>Purchase Date</strong> and Warranty Expiration</li>
              <li><strong>Initial Location:</strong> Warehouse, vehicle, or site</li>
            </ul>
          </li>
          <li>Click <strong>"Save"</strong></li>
        </ol>
        <p><strong>💡 Tip:</strong> Each item automatically gets a QR code for quick lookup.</p>
      `
    },
    {
      id: 'inventory-2',
      title: '📱 Using QR Codes',
      icon: '📱',
      content: `
        <h4>Step 2: QR Code Scanning</h4>
        <p>QR codes make equipment tracking easy:</p>
        <ul>
          <li>QR code appears on equipment detail page</li>
          <li>Print QR code labels for physical equipment</li>
          <li>Use mobile app scanner to quickly lookup equipment</li>
          <li>QR codes link directly to equipment records</li>
          <li>Scan QR code to check out, deploy, or update status</li>
        </ul>
        <p><strong>💡 Tip:</strong> Use QR codes in the field to quickly check equipment status and location.</p>
      `
    },
    {
      id: 'inventory-3',
      title: '🚚 Checking Out Equipment',
      icon: '🚚',
      content: `
        <h4>Step 3: Check Out Equipment</h4>
        <p>When deploying equipment to field:</p>
        <ol>
          <li>Select equipment from inventory list</li>
          <li>Click <strong>"Check Out"</strong> button</li>
          <li>Select destination:
            <ul>
              <li><strong>Field Technician</strong> - Assign to specific tech</li>
              <li><strong>Vehicle</strong> - Assign to service vehicle</li>
              <li><strong>Site</strong> - Deploy to tower site</li>
            </ul>
          </li>
          <li>Add notes (optional)</li>
          <li>Click <strong>"Check Out"</strong></li>
        </ol>
        <p><strong>💡 Tip:</strong> Track equipment location at all times for better inventory management.</p>
      `
    },
    {
      id: 'inventory-4',
      title: '🔧 Maintenance Tracking',
      icon: '🔧',
      content: `
        <h4>Step 4: Track Maintenance</h4>
        <p>Record maintenance history for equipment:</p>
        <ol>
          <li>Open equipment details</li>
          <li>Click <strong>"Add Maintenance Record"</strong></li>
          <li>Enter maintenance information:
            <ul>
              <li>Type (Repair, Firmware Update, Inspection)</li>
              <li>Date and technician</li>
              <li>Description and cost</li>
            </ul>
          </li>
          <li>Save maintenance record</li>
        </ol>
        <p><strong>💡 Tip:</strong> Track maintenance history to identify recurring issues and warranty status.</p>
      `
    },
    {
      id: 'inventory-5',
      title: '📊 Inventory Reports',
      icon: '📊',
      content: `
        <h4>Step 5: Generate Reports</h4>
        <p>Create reports for inventory management:</p>
        <ul>
          <li><strong>Inventory Summary:</strong> Total equipment by category and status</li>
          <li><strong>Location Report:</strong> Equipment distribution by location</li>
          <li><strong>Maintenance Report:</strong> Maintenance history and costs</li>
          <li><strong>Warranty Report:</strong> Equipment with expiring warranties</li>
          <li><strong>Deployment Report:</strong> Equipment deployed at customer sites</li>
        </ul>
        <p><strong>💡 Tip:</strong> Export reports to CSV for Excel analysis or schedule automated reports.</p>
      `
    }
  ],
  'plan': [
    {
      id: 'plan-1',
      title: '📋 Creating a New Project',
      icon: '📋',
      content: `
        <h4>Step 1: Create a New Project</h4>
        <p>To start planning your network expansion:</p>
        <ol>
          <li>Click the <strong>"Projects"</strong> button in the header</li>
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
        </ol>
        <p><strong>💡 Tip:</strong> Projects start in "Draft" status and can be edited until submitted.</p>
      `
    },
    {
      id: 'plan-2',
      title: '🔍 Discovering Marketing Addresses',
      icon: '🔍',
      content: `
        <h4>Step 2: Find Potential Customers</h4>
        <p>Discover addresses in your target area:</p>
        <ol>
          <li>With a project active, click <strong>"Find Addresses"</strong> button</li>
          <li>Draw a rectangle on the map to define the search area</li>
          <li>System discovers potential customer addresses automatically</li>
          <li>Review discovered addresses:
            <ul>
              <li>Address details and coordinates</li>
              <li>Estimated serviceability</li>
              <li>Distance from planned towers</li>
            </ul>
          </li>
          <li>Addresses are automatically saved to your project</li>
        </ol>
        <p><strong>💡 Tip:</strong> Use this to identify potential customers before deploying infrastructure.</p>
      `
    },
    {
      id: 'plan-3',
      title: '📡 Planning Tower Sites',
      icon: '📡',
      content: `
        <h4>Step 3: Add Tower Sites to Plan</h4>
        <p>Plan where to deploy towers:</p>
        <ol>
          <li>Right-click on the map where you want a tower</li>
          <li>Select <strong>"Add to Plan" → "Add Site"</strong></li>
          <li>Enter tower details:
            <ul>
              <li>Site name and type (Tower, Building, Pole)</li>
              <li>Height and location coordinates</li>
              <li>FCC ID (if applicable)</li>
            </ul>
          </li>
          <li>Tower is automatically linked to your active project</li>
          <li>Repeat for all planned tower locations</li>
        </ol>
        <p><strong>💡 Tip:</strong> Plan towers strategically to maximize coverage of discovered addresses.</p>
      `
    },
    {
      id: 'plan-4',
      title: '📶 Planning Sectors',
      icon: '📶',
      content: `
        <h4>Step 4: Configure Sectors per Tower</h4>
        <p>Add sectors to each planned tower:</p>
        <ol>
          <li>Right-click on a planned tower marker</li>
          <li>Select <strong>"Add to Plan" → "Add Sector"</strong></li>
          <li>Configure sector parameters:
            <ul>
              <li><strong>Azimuth</strong> - Direction (0-360 degrees)</li>
              <li><strong>Beamwidth</strong> - Coverage angle</li>
              <li><strong>Tilt</strong> - Antenna tilt angle</li>
              <li><strong>Frequency Band</strong> - Operating frequency</li>
              <li><strong>Technology</strong> - LTE, CBRS, FWA, etc.</li>
            </ul>
          </li>
          <li>Sector is linked to your project</li>
        </ol>
        <p><strong>💡 Tip:</strong> Plan 3-6 sectors per tower for 360° coverage.</p>
      `
    },
    {
      id: 'plan-5',
      title: '📦 Adding Hardware Requirements',
      icon: '📦',
      content: `
        <h4>Step 5: Plan Required Equipment</h4>
        <p>Track what equipment you'll need:</p>
        <ol>
          <li>Click <strong>"Hardware"</strong> button in the header</li>
          <li>Click <strong>"Add Requirement"</strong></li>
          <li>Enter equipment details:
            <ul>
              <li>Category (Radio, Antenna, Router, etc.)</li>
              <li>Equipment type and model</li>
              <li>Quantity needed</li>
              <li>Priority level</li>
            </ul>
          </li>
          <li>Requirements are tracked for inventory planning</li>
        </ol>
        <p><strong>💡 Tip:</strong> Add all hardware requirements before submitting for approval.</p>
      `
    },
    {
      id: 'plan-6',
      title: '✅ Submitting Plans for Approval',
      icon: '✅',
      content: `
        <h4>Step 6: Submit Plan for Review</h4>
        <p>When your plan is complete:</p>
        <ol>
          <li>Review all planned sites, sectors, and hardware</li>
          <li>Click <strong>"Projects"</strong> button</li>
          <li>Select your project</li>
          <li>Click <strong>"Submit for Approval"</strong> or change status to <strong>"Ready"</strong></li>
          <li>Plan moves to Deploy module for approval</li>
        </ol>
        <p><strong>💡 Tip:</strong> Plans must be approved in Deploy module before hardware can be deployed.</p>
      `
    },
    {
      id: 'plan-7',
      title: '🗺️ Using the Plan Layer',
      icon: '🗺️',
      content: `
        <h4>Visualizing Your Plan</h4>
        <p>The plan layer shows all your planned infrastructure:</p>
        <ul>
          <li><strong>Planned Sites:</strong> Tower locations marked on map</li>
          <li><strong>Planned Sectors:</strong> Coverage areas for each sector</li>
          <li><strong>Equipment Requirements:</strong> Tracked in hardware view</li>
          <li><strong>Marketing Addresses:</strong> Discovered customer locations</li>
          <li><strong>Coverage Areas:</strong> Visualize planned coverage</li>
        </ul>
        <p><strong>💡 Tip:</strong> Use the Layers button to toggle visibility of different plan elements.</p>
      `
    }
  ],
  'hss-management': [
    {
      id: 'hss-1',
      title: '🔐 Adding Subscribers',
      icon: '🔐',
      content: `
        <h4>Step 1: Add a Subscriber</h4>
        <p>Create subscriber profiles for LTE/5G networks:</p>
        <ol>
          <li>Click <strong>"Add Subscriber"</strong> button</li>
          <li>Enter subscriber information:
            <ul>
              <li><strong>IMSI:</strong> 15-digit identifier (MCC + MNC + MSIN)</li>
              <li><strong>MSISDN:</strong> Phone number (E.164 format, optional)</li>
              <li><strong>Ki:</strong> 128-bit authentication key (hex format, required)</li>
              <li><strong>OP/OPc:</strong> Operator variant key (optional)</li>
              <li><strong>APN:</strong> Access Point Name (default: internet)</li>
            </ul>
          </li>
          <li>Click <strong>"Create Subscriber"</strong></li>
        </ol>
        <p><strong>💡 Tip:</strong> IMSI must be unique and Ki is required for authentication.</p>
      `
    },
    {
      id: 'hss-2',
      title: '📱 Managing Subscriber Groups',
      icon: '📱',
      content: `
        <h4>Step 2: Organize Subscribers</h4>
        <p>Group subscribers for bulk operations:</p>
        <ol>
          <li>Click <strong>"Groups"</strong> tab</li>
          <li>Create or select a group</li>
          <li>Assign subscribers to groups</li>
          <li>Use groups for:
            <ul>
              <li>Bulk operations (suspend, activate, delete)</li>
              <li>Service profile management</li>
              <li>Bandwidth plan assignments</li>
            </ul>
          </li>
        </ol>
        <p><strong>💡 Tip:</strong> Groups help organize subscribers by service tier or location.</p>
      `
    },
    {
      id: 'hss-3',
      title: '🌐 Deploying EPC Systems',
      icon: '🌐',
      content: `
        <h4>Step 3: Deploy EPC</h4>
        <p>Deploy Evolved Packet Core systems:</p>
        <ol>
          <li>Click <strong>"Deploy EPC"</strong> button</li>
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
        <p><strong>💡 Tip:</strong> EPC systems must be deployed before subscribers can connect.</p>
      `
    },
    {
      id: 'hss-4',
      title: '🔌 Connecting MME',
      icon: '🔌',
      content: `
        <h4>Step 4: Connect MME</h4>
        <p>Connect Mobile Management Entities to HSS:</p>
        <ol>
          <li>Click <strong>"MME Connections"</strong> tab</li>
          <li>Add MME connection</li>
          <li>Enter MME details:
            <ul>
              <li>MME hostname or IP</li>
              <li>Port number</li>
              <li>Authentication credentials</li>
            </ul>
          </li>
          <li>Test connection</li>
          <li>Save MME connection</li>
        </ol>
        <p><strong>💡 Tip:</strong> MME connections enable subscriber authentication and session management.</p>
      `
    }
  ],
  'cbrs-management': [
    {
      id: 'cbrs-1',
      title: '📡 Registering CBSD Devices',
      icon: '📡',
      content: `
        <h4>Step 1: Add CBSD Device</h4>
        <p>Register Citizens Broadband Service Devices:</p>
        <ol>
          <li>Click <strong>"+ Add CBSD Device"</strong></li>
          <li>Enter device information:
            <ul>
              <li><strong>CBSD Serial Number:</strong> Unique identifier</li>
              <li><strong>FCC ID:</strong> FCC equipment authorization</li>
              <li><strong>Category:</strong> A (indoor) or B (outdoor)</li>
              <li><strong>SAS Provider:</strong> Google SAS or Federated Wireless</li>
              <li><strong>Location:</strong> GPS coordinates</li>
            </ul>
          </li>
          <li>Save device</li>
        </ol>
        <p><strong>💡 Tip:</strong> Category B devices have higher power limits and require outdoor installation.</p>
      `
    },
    {
      id: 'cbrs-2',
      title: '📊 Requesting Spectrum Grants',
      icon: '📊',
      content: `
        <h4>Step 2: Request Spectrum</h4>
        <p>Get spectrum authorization from SAS:</p>
        <ol>
          <li>Select registered CBSD device</li>
          <li>Click <strong>"Request Grant"</strong></li>
          <li>SAS evaluates request:
            <ul>
              <li>Checks for incumbent protection</li>
              <li>Assigns available spectrum</li>
              <li>Returns grant with frequency and power</li>
            </ul>
          </li>
          <li>Monitor grant status</li>
        </ol>
        <p><strong>💡 Tip:</strong> Grants are automatically renewed via heartbeat messages.</p>
      `
    },
    {
      id: 'cbrs-3',
      title: '🗺️ Geographic Visualization',
      icon: '🗺️',
      content: `
        <h4>Step 3: View Device Map</h4>
        <p>Visualize CBSD locations on interactive map:</p>
        <ul>
          <li><strong>Color-coded status:</strong> Green (authorized), Yellow (pending), Red (error)</li>
          <li><strong>Click markers:</strong> View device details and grant status</li>
          <li><strong>Multi-site coordination:</strong> See all devices in your network</li>
          <li><strong>Coverage analysis:</strong> Visualize coverage areas</li>
        </ul>
        <p><strong>💡 Tip:</strong> Use the map to coordinate multi-site deployments and avoid interference.</p>
      `
    }
  ],
  'pci-resolution': [
    {
      id: 'pci-1',
      title: '📊 Importing Cell Data',
      icon: '📊',
      content: `
        <h4>Step 1: Import Cell Data</h4>
        <p>Add cell sites to analyze:</p>
        <ol>
          <li>Click <strong>"📊 Manage Towers"</strong> button</li>
          <li>Choose import method:
            <ul>
              <li><strong>Manual Entry:</strong> Add sites one by one</li>
              <li><strong>CSV Import:</strong> Upload CSV file with cell data</li>
              <li><strong>KML Import:</strong> Import from Google Earth KML files</li>
            </ul>
          </li>
          <li>Required fields: eNodeB, Cell ID, PCI, Latitude, Longitude</li>
          <li>Save imported data</li>
        </ol>
        <p><strong>💡 Tip:</strong> CSV format: eNodeB,Cell ID,PCI,Latitude,Longitude,Azimuth,Height</p>
      `
    },
    {
      id: 'pci-2',
      title: '🔍 Analyzing Network',
      icon: '🔍',
      content: `
        <h4>Step 2: Detect PCI Conflicts</h4>
        <p>Analyze network for PCI conflicts:</p>
        <ol>
          <li>Click <strong>"🔍 Analyze Network"</strong></li>
          <li>System detects:
            <ul>
              <li><strong>High Severity:</strong> Same PCI in neighboring cells</li>
              <li><strong>Medium Severity:</strong> Mod3 conflicts (PCI % 3)</li>
              <li><strong>Low Severity:</strong> Mod6 conflicts (PCI % 6)</li>
            </ul>
          </li>
          <li>Review conflict table with affected cells</li>
          <li>See distance between conflicting cells</li>
        </ol>
        <p><strong>💡 Tip:</strong> High severity conflicts cause the most interference and should be resolved first.</p>
      `
    },
    {
      id: 'pci-3',
      title: '🤖 AI Recommendations',
      icon: '🤖',
      content: `
        <h4>Step 3: Get AI Optimization</h4>
        <p>Use Google Gemini AI for intelligent recommendations:</p>
        <ol>
          <li>Click <strong>"🤖 Get AI Recommendations"</strong></li>
          <li>AI analyzes:
            <ul>
              <li>Network topology</li>
              <li>Neighbor relationships</li>
              <li>Interference patterns</li>
            </ul>
          </li>
          <li>Receive prioritized PCI reallocation suggestions</li>
          <li>Review AI recommendations</li>
        </ol>
        <p><strong>💡 Tip:</strong> AI recommendations consider network-wide optimization, not just individual conflicts.</p>
      `
    },
    {
      id: 'pci-4',
      title: '✨ Optimizing Network',
      icon: '✨',
      content: `
        <h4>Step 4: Resolve Conflicts</h4>
        <p>Automatically resolve all PCI conflicts:</p>
        <ol>
          <li>Click <strong>"✨ Optimize Network"</strong></li>
          <li>System automatically:
            <ul>
              <li>Reassigns conflicting PCIs</li>
              <li>Maintains existing PCIs where possible</li>
              <li>Considers neighbor relationships</li>
            </ul>
          </li>
          <li>Review before/after comparison</li>
          <li>Export updated configuration</li>
        </ol>
        <p><strong>💡 Tip:</strong> Optimization maintains existing PCIs when possible to minimize changes.</p>
      `
    },
    {
      id: 'pci-5',
      title: '📤 Exporting Results',
      icon: '📤',
      content: `
        <h4>Step 5: Export Configuration</h4>
        <p>Export optimized PCI assignments:</p>
        <ul>
          <li><strong>Conflict Report (PDF):</strong> Detailed analysis and recommendations</li>
          <li><strong>CSV Export:</strong> Updated cell data with new PCIs</li>
          <li><strong>Nokia Configuration:</strong> Ready-to-use CLI commands for Nokia eNodeBs</li>
        </ul>
        <p><strong>💡 Tip:</strong> Use Nokia configuration export to directly apply changes to your eNodeBs.</p>
      `
    }
  ]
};

/**
 * Get tips for a specific module
 */

/**
 * Get tips for a specific module
 */
export function getModuleTips(moduleId: string): ModuleTip[] {
  return moduleTips[moduleId] || [];
}

/**
 * Get module ID from route path
 */
export function getModuleIdFromPath(path: string): string | null {
  const moduleMatch = path.match(/\/modules\/([^\/]+)/);
  if (moduleMatch) {
    return moduleMatch[1];
  }
  return null;
}
