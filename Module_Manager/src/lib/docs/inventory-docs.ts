export const inventoryDocs = `
<h3>📦 Inventory Management</h3>

<div class="info">
  <strong>Purpose:</strong> Centralized asset tracking with location management, maintenance history, and warranty tracking for all network equipment and hardware.
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#key-features">🎯 Key Features</a></li>
    <li><a href="#getting-started">🚀 Getting Started</a></li>
    <li><a href="#inventory-management">📊 Inventory Management</a></li>
    <li><a href="#maintenance-tracking">🔧 Maintenance Tracking</a></li>
    <li><a href="#bundles-kits">📦 Bundles and Kits</a></li>
    <li><a href="#checkin-wizard">🧙 Check-in Wizard</a></li>
    <li><a href="#reports">📊 Reports</a></li>
    <li><a href="#mobile-integration">🔍 Mobile App Integration</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
  </ul>
</div>

<h4 id="key-features">🎯 Key Features</h4>
<ul>
  <li><strong>Equipment Tracking:</strong> Track all network equipment, CPE devices, and hardware</li>
  <li><strong>Location Management:</strong> Assign equipment to sites, vehicles, warehouses, or field technicians</li>
  <li><strong>QR Code Scanning:</strong> Quick lookup and checkout using mobile app scanner</li>
  <li><strong>Maintenance History:</strong> Track repairs, firmware updates, and service records</li>
  <li><strong>Warranty Tracking:</strong> Monitor warranty expiration dates and service contracts</li>
  <li><strong>Inventory Reports:</strong> Generate reports for audits, depreciation, and planning</li>
</ul>

<h4 id="getting-started">🚀 Getting Started</h4>

<h4>Step 1: Add Equipment to Inventory</h4>
<ol>
  <li>Navigate to <strong>Inventory</strong> module</li>
  <li>Click <strong>"Add Equipment"</strong> button</li>
  <li>Enter equipment details:
    <ul>
      <li><strong>Serial Number</strong> - Unique identifier (required)</li>
      <li><strong>Model/Type</strong> - Equipment model and manufacturer</li>
      <li><strong>Category</strong> - Router, Radio, Antenna, CPE, etc.</li>
      <li><strong>Purchase Date</strong> - When equipment was acquired</li>
      <li><strong>Warranty Expiration</strong> - Warranty end date</li>
      <li><strong>Initial Location</strong> - Warehouse, vehicle, or site</li>
    </ul>
  </li>
  <li>Click <strong>"Save"</strong> to add equipment</li>
</ol>

<h4>Step 2: Generate QR Codes</h4>
<p>Each equipment item automatically gets a QR code:</p>
<ul>
  <li>QR code appears on equipment detail page</li>
  <li>Print QR code labels for physical equipment</li>
  <li>Use mobile app scanner to quickly lookup equipment</li>
  <li>QR codes link directly to equipment records</li>
</ul>

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

<h4>Step 4: Deploy Equipment</h4>
<p>When installing equipment at customer site:</p>
<ol>
  <li>Use mobile app to scan QR code</li>
  <li>Select <strong>"Deploy"</strong> action</li>
  <li>Enter deployment details:
    <ul>
      <li>Customer site location</li>
      <li>Installation date</li>
      <li>Installation notes</li>
    </ul>
  </li>
  <li>Equipment status changes to "Deployed"</li>
  <li>Location updates automatically</li>
</ol>

<h4 id="inventory-management">📊 Inventory Management</h4>

<h4>Viewing Inventory</h4>
<p>The inventory list shows:</p>
<ul>
  <li><strong>Equipment Details:</strong> Serial number, model, category</li>
  <li><strong>Current Location:</strong> Where equipment is currently located</li>
  <li><strong>Status:</strong> Available, Checked Out, Deployed, Maintenance</li>
  <li><strong>Last Updated:</strong> When location or status last changed</li>
</ul>

<h4>Filtering and Search</h4>
<ul>
  <li><strong>Search:</strong> Search by serial number, model, or location</li>
  <li><strong>Filter by Status:</strong> Available, Checked Out, Deployed, Maintenance</li>
  <li><strong>Filter by Category:</strong> Router, Radio, Antenna, CPE, etc.</li>
  <li><strong>Filter by Location:</strong> Warehouse, Vehicle, Site, Technician</li>
</ul>

<h4>Equipment Actions</h4>
<ul>
  <li><strong>View Details:</strong> Click equipment row for full information</li>
  <li><strong>Edit:</strong> Update equipment information</li>
  <li><strong>Check Out:</strong> Assign to technician or vehicle</li>
  <li><strong>Check In:</strong> Return equipment to warehouse</li>
  <li><strong>Deploy:</strong> Install at customer site</li>
  <li><strong>Maintenance:</strong> Mark for repair or service</li>
  <li><strong>Delete:</strong> Remove from inventory (requires confirmation)</li>
</ul>

<h4 id="maintenance-tracking">🔧 Maintenance Tracking</h4>

<h4>Adding Maintenance Records</h4>
<ol>
  <li>Open equipment details</li>
  <li>Click <strong>"Add Maintenance Record"</strong></li>
  <li>Enter maintenance information:
    <ul>
      <li><strong>Type:</strong> Repair, Firmware Update, Inspection, etc.</li>
      <li><strong>Date:</strong> When maintenance was performed</li>
      <li><strong>Technician:</strong> Who performed the work</li>
      <li><strong>Description:</strong> What was done</li>
      <li><strong>Cost:</strong> Maintenance cost (optional)</li>
    </ul>
  </li>
  <li>Save maintenance record</li>
</ol>

<h4>Maintenance History</h4>
<p>View all maintenance records for equipment:</p>
<ul>
  <li>Chronological list of all maintenance</li>
  <li>Filter by maintenance type</li>
  <li>Export maintenance history for reporting</li>
  <li>Track total maintenance costs</li>
</ul>

<h4 id="bundles-kits">📦 Bundles and Kits</h4>

<h4>Creating Equipment Bundles</h4>
<p>Group related equipment for easier deployment:</p>
<ol>
  <li>Navigate to <strong>Bundles</strong> section</li>
  <li>Click <strong>"Create Bundle"</strong></li>
  <li>Enter bundle name and description</li>
  <li>Add equipment items to bundle</li>
  <li>Save bundle</li>
</ol>

<h4>Using Bundles</h4>
<ul>
  <li>Check out entire bundle at once</li>
  <li>Deploy bundle to customer site</li>
  <li>Track bundle as single unit</li>
  <li>Individual items still tracked separately</li>
</ul>

<h4 id="checkin-wizard">🧙 Check-in Wizard</h4>

<div class="info">
  <strong>Purpose:</strong> Step-by-step guided workflow for checking in received inventory items with proper location assignment, verification, and labeling.
</div>

<h4>Accessing the Wizard</h4>
<ol>
  <li>Navigate to <strong>Inventory</strong> module</li>
  <li>Click <strong>"📦 Check-in Wizard"</strong> button (primary action button)</li>
  <li>Wizard opens with welcome screen</li>
</ol>

<h4>Wizard Overview</h4>
<p>The Check-in Wizard guides you through:</p>
<ul>
  <li>Scanning or entering item serial number</li>
  <li>Verifying item details</li>
  <li>Setting storage location</li>
  <li>Printing asset tag label</li>
  <li>Completing check-in</li>
</ul>

<h4>Check-in Methods</h4>

<h4>Barcode Scan</h4>
<ul>
  <li>Use camera to scan barcode/QR code</li>
  <li>Automatic item lookup</li>
  <li>Fastest method for bulk check-ins</li>
</ul>

<h4>Manual Entry</h4>
<ul>
  <li>Enter serial number manually</li>
  <li>Enter purchase order ID (optional)</li>
  <li>Lookup item in system</li>
</ul>

<h4>Bulk Check-in</h4>
<ul>
  <li>Check in multiple items at once</li>
  <li>Streamlined workflow</li>
  <li>Efficient for large shipments</li>
</ul>

<h4>Wizard Steps</h4>
<ol>
  <li><strong>Welcome:</strong> Overview of check-in process</li>
  <li><strong>Scan Item:</strong> Identify item via scan or manual entry</li>
  <li><strong>Verify:</strong> Review and update item details</li>
  <li><strong>Set Location:</strong> Choose storage location (warehouse, tower, NOC, vehicle, other)</li>
  <li><strong>Print Label:</strong> Preview and print asset tag</li>
  <li><strong>Complete:</strong> Review summary and finish</li>
</ol>

<h4>Location Types</h4>
<ul>
  <li><strong>Warehouse:</strong> Section and shelf</li>
  <li><strong>Tower Site:</strong> Site, rack, and rack unit</li>
  <li><strong>NOC:</strong> Room and rack</li>
  <li><strong>Vehicle:</strong> Vehicle ID and name</li>
  <li><strong>Other:</strong> Custom description</li>
</ul>

<h4>Tips for Using the Wizard</h4>
<ul>
  <li>Have serial numbers or barcodes ready</li>
  <li>Know storage location before starting</li>
  <li>Print labels immediately for easy tracking</li>
  <li>Link to purchase orders when available</li>
  <li>Add notes for any special handling requirements</li>
</ul>

<div class="success">
  <strong>✅ Quick Access:</strong> The Check-in Wizard can also be accessed from the "Scan Check In" modal by selecting "Wizard Mode" option.
</div>

<h4 id="reports">📊 Reports</h4>

<h4>Available Reports</h4>
<ul>
  <li><strong>Inventory Summary:</strong> Total equipment by category and status</li>
  <li><strong>Location Report:</strong> Equipment distribution by location</li>
  <li><strong>Maintenance Report:</strong> Maintenance history and costs</li>
  <li><strong>Warranty Report:</strong> Equipment with expiring warranties</li>
  <li><strong>Deployment Report:</strong> Equipment deployed at customer sites</li>
</ul>

<h4>Exporting Reports</h4>
<ul>
  <li>Export to CSV for Excel analysis</li>
  <li>Print PDF reports</li>
  <li>Schedule automated reports</li>
  <li>Email reports to stakeholders</li>
</ul>

<h4 id="mobile-integration">🔍 Mobile App Integration</h4>

<h4>QR Code Scanner</h4>
<p>Field technicians can use mobile app to:</p>
<ul>
  <li>Scan QR codes on equipment</li>
  <li>View equipment details instantly</li>
  <li>Check out equipment to vehicle</li>
  <li>Deploy equipment at customer sites</li>
  <li>Add maintenance records</li>
  <li>Update equipment status</li>
</ul>

<h4>Field Workflow</h4>
<ol>
  <li>Scan equipment QR code with mobile app</li>
  <li>View equipment details and history</li>
  <li>Check out equipment to vehicle</li>
  <li>Navigate to customer site</li>
  <li>Install equipment</li>
  <li>Deploy equipment via mobile app</li>
  <li>Add installation notes and photos</li>
</ol>

<h4 id="best-practices">💡 Best Practices</h4>
<ul>
  <li><strong>Label Everything:</strong> Print and attach QR codes to all equipment</li>
  <li><strong>Regular Audits:</strong> Periodically verify equipment locations</li>
  <li><strong>Update Status:</strong> Keep equipment status current</li>
  <li><strong>Track Maintenance:</strong> Record all repairs and updates</li>
  <li><strong>Monitor Warranties:</strong> Review warranty expiration regularly</li>
  <li><strong>Use Bundles:</strong> Group common equipment for faster deployment</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>Equipment not appearing in inventory:</h4>
<ul>
  <li>Verify equipment was added correctly</li>
  <li>Check filters aren't hiding equipment</li>
  <li>Ensure you have permission to view inventory</li>
</ul>

<h4>Can't check out equipment:</h4>
<ul>
  <li>Verify equipment status is "Available"</li>
  <li>Check equipment isn't already checked out</li>
  <li>Ensure you have checkout permissions</li>
</ul>

<h4>QR code not scanning:</h4>
<ul>
  <li>Verify QR code is printed clearly</li>
  <li>Check mobile app has camera permissions</li>
  <li>Ensure QR code hasn't been damaged</li>
  <li>Try manual serial number lookup</li>
</ul>
`;