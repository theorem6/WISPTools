export const wizardDocs = `
<h3>🧙 Wizards - Guided Workflows</h3>

<div class="info">
  <strong>Purpose:</strong> Wizards provide step-by-step guided workflows for complex operations across the platform. They simplify multi-step processes, ensure data completeness, and reduce errors through validation and helpful prompts.
</div>

<div class="toc">
  <h4>📑 Table of Contents</h4>
  <ul>
    <li><a href="#overview">📋 Overview</a></li>
    <li><a href="#accessing-wizards">🚀 Accessing Wizards</a></li>
    <li><a href="#deployment-wizard">🚀 Deployment Wizard</a></li>
    <li><a href="#troubleshooting-wizard">🔍 Troubleshooting Wizard</a></li>
    <li><a href="#device-onboarding-wizard">👋 Device Onboarding Wizard</a></li>
    <li><a href="#inventory-checkin-wizard">📦 Inventory Check-in Wizard</a></li>
    <li><a href="#work-order-wizard">📋 Work Order Creation Wizard</a></li>
    <li><a href="#wizard-features">✨ Wizard Features</a></li>
    <li><a href="#best-practices">💡 Best Practices</a></li>
    <li><a href="#troubleshooting">🔧 Troubleshooting</a></li>
  </ul>
</div>

<h4 id="overview">📋 Overview</h4>

<p>Wizards are interactive, multi-step forms that guide users through complex workflows. They provide:</p>
<ul>
  <li><strong>Step-by-step guidance:</strong> Break complex tasks into manageable steps</li>
  <li><strong>Validation:</strong> Ensure required information is provided before proceeding</li>
  <li><strong>Contextual help:</strong> Show relevant information at each step</li>
  <li><strong>Progress tracking:</strong> Visual indicators show completion status</li>
  <li><strong>Error prevention:</strong> Validate inputs and prevent common mistakes</li>
</p>

<h4 id="accessing-wizards">🚀 Accessing Wizards</h4>

<p>Wizards are accessed from their respective modules via buttons in the module header or action areas:</p>

<h4>Deployment Wizard</h4>
<ul>
  <li><strong>Location:</strong> Deploy Module</li>
  <li><strong>Access:</strong> Click <strong>"📦 Deploy Equipment"</strong> button in module header</li>
  <li><strong>Use Case:</strong> Deploy equipment (sectors, radios, CPE) to field locations</li>
</ul>

<h4>Troubleshooting Wizard</h4>
<ul>
  <li><strong>Location:</strong> ACS CPE Management Module</li>
  <li><strong>Access:</strong> Select a device, then click <strong>"🔍 Troubleshoot"</strong> button</li>
  <li><strong>Use Case:</strong> Diagnose and fix CPE device issues</li>
</ul>

<h4>Device Onboarding Wizard</h4>
<ul>
  <li><strong>Location:</strong> ACS CPE Management Module</li>
  <li><strong>Access:</strong> Click <strong>"👋 Onboard Device"</strong> button in module actions</li>
  <li><strong>Use Case:</strong> Comprehensive device onboarding with customer linking</li>
</ul>

<h4>Inventory Check-in Wizard</h4>
<ul>
  <li><strong>Location:</strong> Inventory Module</li>
  <li><strong>Access:</strong> Click <strong>"📦 Check-in Wizard"</strong> button (primary action)</li>
  <li><strong>Use Case:</strong> Check in received inventory items with location assignment</li>
</ul>

<h4>Work Order Creation Wizard</h4>
<ul>
  <li><strong>Location:</strong> Work Orders Module</li>
  <li><strong>Access:</strong> Click <strong>"📋 Create Work Order Wizard"</strong> button (primary action)</li>
  <li><strong>Use Case:</strong> Create comprehensive work orders with all details</li>
</ul>

<h4 id="deployment-wizard">🚀 Deployment Wizard</h4>

<div class="info">
  <strong>Purpose:</strong> Guide field technicians through deploying equipment (sectors, radios, CPE) with proper configuration, location assignment, and documentation.
</div>

<h4>Accessing the Wizard</h4>
<ol>
  <li>Navigate to <strong>Deploy</strong> module</li>
  <li>Click <strong>"📦 Deploy Equipment"</strong> button in the module header</li>
  <li>Wizard opens with welcome screen</li>
</ol>

<h4>Wizard Steps</h4>

<h4>Step 1: Welcome</h4>
<ul>
  <li>Overview of deployment process</li>
  <li>Explanation of deployment types</li>
  <li>What to expect in the wizard</li>
</ul>

<h4>Step 2: Deployment Type</h4>
<p>Select the type of deployment:</p>
<ul>
  <li><strong>Sector Deployment:</strong> Complete sector with radio, antenna, and configuration</li>
  <li><strong>Radio Deployment:</strong> Radio unit to an existing site</li>
  <li><strong>CPE Deployment:</strong> Customer premise equipment</li>
</ul>

<h4>Step 3: Location</h4>
<p>Choose deployment location:</p>
<ul>
  <li><strong>Select Existing Site:</strong> Choose from list of tower sites</li>
  <li><strong>Enter GPS Coordinates:</strong> Manual entry or map click</li>
  <li>Location is validated before proceeding</li>
</ul>

<h4>Step 4: Equipment Selection</h4>
<ul>
  <li>Browse available equipment from inventory</li>
  <li>Filter by category and status</li>
  <li>Select multiple items if needed</li>
  <li>View selected equipment summary</li>
</ul>

<h4>Step 5: Configuration</h4>
<p>Configure equipment based on deployment type:</p>
<ul>
  <li><strong>Sector:</strong> Name, azimuth, frequency, bandwidth</li>
  <li><strong>Radio:</strong> Radio-specific parameters</li>
  <li><strong>CPE:</strong> Customer and service plan assignment</li>
</ul>

<h4>Step 6: Checklist</h4>
<ul>
  <li>Complete deployment checklist items</li>
  <li>Add deployment notes</li>
  <li>Upload photos (optional)</li>
  <li>Link to work order (optional)</li>
</ul>

<h4>Step 7: Complete</h4>
<ul>
  <li>Review deployment summary</li>
  <li>Equipment status updated to "Deployed"</li>
  <li>Sector created automatically (if sector deployment)</li>
  <li>Next steps displayed</li>
</ul>

<h4>Tips</h4>
<ul>
  <li>Have equipment serial numbers ready</li>
  <li>Take photos during deployment for documentation</li>
  <li>Link to work orders for tracking</li>
  <li>Complete all checklist items before finishing</li>
</ul>

<h4 id="troubleshooting-wizard">🔍 Troubleshooting Wizard</h4>

<div class="info">
  <strong>Purpose:</strong> Diagnose and fix CPE device issues through automated diagnostics and guided solutions.
</div>

<h4>Accessing the Wizard</h4>
<ol>
  <li>Navigate to <strong>ACS CPE Management</strong> module</li>
  <li>Select a device from the device list or map</li>
  <li>Click <strong>"🔍 Troubleshoot"</strong> button</li>
  <li>Wizard opens with device pre-selected</li>
</ol>

<h4>Wizard Steps</h4>

<h4>Step 1: Welcome</h4>
<ul>
  <li>Overview of troubleshooting process</li>
  <li>Common problem types explained</li>
</ul>

<h4>Step 2: Select Device</h4>
<ul>
  <li>Device list displayed (if not pre-selected)</li>
  <li>View device status and details</li>
  <li>Select device to troubleshoot</li>
</ul>

<h4>Step 3: Problem Type</h4>
<p>Identify the issue:</p>
<ul>
  <li><strong>Device Offline:</strong> Device not responding</li>
  <li><strong>Slow Performance:</strong> Device responding slowly</li>
  <li><strong>Configuration Issue:</strong> Device misconfigured</li>
  <li><strong>Signal Problem:</strong> Poor signal strength</li>
  <li><strong>Other Issue:</strong> Different problem</li>
</ul>

<h4>Step 4: Diagnostics</h4>
<ul>
  <li>Automated diagnostic tests run</li>
  <li>Results displayed with status:
    <ul>
      <li>✅ Pass - Test successful</li>
      <li>❌ Fail - Test failed</li>
      <li>⚠️ Warning - Test completed with warnings</li>
    </ul>
  </li>
  <li>Review diagnostic messages</li>
</ul>

<h4>Step 5: Solutions</h4>
<ul>
  <li>Suggested solutions based on diagnostics</li>
  <li>Each solution includes:
    <ul>
      <li>Title and description</li>
      <li>Action type (automatic or manual)</li>
      <li>Expected outcome</li>
    </ul>
  </li>
  <li>Select solution to apply</li>
</ul>

<h4>Step 6: Apply Fix</h4>
<ul>
  <li>Review selected solution</li>
  <li>For automatic fixes: Click "Apply Solution"</li>
  <li>For manual fixes: Follow instructions provided</li>
  <li>Confirmation shown when applied</li>
</ul>

<h4>Step 7: Verify</h4>
<ul>
  <li>Device status checked automatically</li>
  <li>Verification results displayed</li>
  <li>If successful: Issue resolved</li>
  <li>If failed: Additional steps suggested</li>
</ul>

<h4>Step 8: Complete</h4>
<ul>
  <li>Troubleshooting summary</li>
  <li>Status: Resolved or Needs Attention</li>
  <li>Next steps if issue persists</li>
</ul>

<h4>Tips</h4>
<ul>
  <li>Select the correct problem type for better diagnostics</li>
  <li>Review all diagnostic results before selecting solution</li>
  <li>For manual fixes, follow instructions carefully</li>
  <li>Verify fix before closing wizard</li>
</ul>

<h4 id="device-onboarding-wizard">👋 Device Onboarding Wizard</h4>

<div class="info">
  <strong>Purpose:</strong> Comprehensive device onboarding workflow including discovery, customer linking, service plan assignment, and configuration.
</div>

<h4>Accessing the Wizard</h4>
<ol>
  <li>Navigate to <strong>ACS CPE Management</strong> module</li>
  <li>Click <strong>"👋 Onboard Device"</strong> button in module actions</li>
  <li>Wizard opens with welcome screen</li>
</ol>

<h4>Wizard Steps</h4>

<h4>Step 1: Welcome</h4>
<ul>
  <li>Overview of onboarding process</li>
  <li>What will be completed</li>
</ul>

<h4>Step 2: Discover Device</h4>
<p>Choose discovery method:</p>
<ul>
  <li><strong>Scan Serial:</strong> Use camera to scan barcode</li>
  <li><strong>Enter Manually:</strong> Type serial number and device info</li>
  <li><strong>Auto-Discover:</strong> Device will register automatically on first connection</li>
</ul>

<h4>Step 3: Link Customer</h4>
<ul>
  <li>Browse customer list</li>
  <li>Search for customer</li>
  <li>Select customer for this device</li>
  <li>Customer info pre-filled</li>
</ul>

<h4>Step 4: Service Plan</h4>
<ul>
  <li>Browse available service plans</li>
  <li>Select plan for customer</li>
  <li>View plan details (speed, features)</li>
</ul>

<h4>Step 5: Configure</h4>
<ul>
  <li>Review device information</li>
  <li>Verify serial number, manufacturer, product class</li>
  <li>Configuration will be applied in next step</li>
</ul>

<h4>Step 6: Apply Preset</h4>
<ul>
  <li>Browse available configuration presets</li>
  <li>Select preset to apply</li>
  <li>Preset applied automatically</li>
  <li>Can skip if configuring manually later</li>
</ul>

<h4>Step 7: Test</h4>
<ul>
  <li>Run connectivity tests</li>
  <li>Verify configuration applied</li>
  <li>Check signal strength</li>
  <li>Verify service plan active</li>
  <li>All tests must pass to complete</li>
</ul>

<h4>Step 8: Complete</h4>
<ul>
  <li>Onboarding summary displayed</li>
  <li>Device linked to customer</li>
  <li>Service plan assigned</li>
  <li>Next steps shown</li>
</ul>

<h4>Tips</h4>
<ul>
  <li>Have device serial number ready</li>
  <li>Ensure customer exists before onboarding</li>
  <li>Select appropriate service plan</li>
  <li>Run tests before completing</li>
</ul>

<h4 id="inventory-checkin-wizard">📦 Inventory Check-in Wizard</h4>

<div class="info">
  <strong>Purpose:</strong> Guide warehouse staff through receiving and checking in inventory items with proper location assignment and labeling.
</div>

<h4>Accessing the Wizard</h4>
<ol>
  <li>Navigate to <strong>Inventory</strong> module</li>
  <li>Click <strong>"📦 Check-in Wizard"</strong> button (primary action)</li>
  <li>Wizard opens with welcome screen</li>
</ol>

<h4>Wizard Steps</h4>

<h4>Step 1: Welcome</h4>
<ul>
  <li>Overview of check-in process</li>
  <li>Check-in methods explained</li>
</ul>

<h4>Step 2: Scan Item</h4>
<p>Choose identification method:</p>
<ul>
  <li><strong>Scan Barcode:</strong> Use camera to scan barcode/QR code</li>
  <li><strong>Manual Entry:</strong> Enter serial number manually</li>
  <li><strong>Bulk Check-in:</strong> Check in multiple items at once</li>
</ul>

<h4>Step 3: Verify</h4>
<ul>
  <li>Item details displayed (if found in system)</li>
  <li>For new items: Enter details:
    <ul>
      <li>Item name</li>
      <li>Category</li>
      <li>Manufacturer</li>
      <li>Model</li>
    </ul>
  </li>
  <li>Verify serial number</li>
</ul>

<h4>Step 4: Set Location</h4>
<p>Choose storage location:</p>
<ul>
  <li><strong>Warehouse:</strong> Section and shelf</li>
  <li><strong>Tower Site:</strong> Site, rack, and rack unit</li>
  <li><strong>NOC:</strong> Room and rack</li>
  <li><strong>Vehicle:</strong> Vehicle ID and name</li>
  <li><strong>Other:</strong> Custom description</li>
</ul>

<h4>Step 5: Print Label</h4>
<ul>
  <li>Preview asset tag label</li>
  <li>Choose to print label</li>
  <li>Label printed automatically after check-in</li>
</ul>

<h4>Step 6: Complete</h4>
<ul>
  <li>Check-in summary</li>
  <li>Item status updated to "Available"</li>
  <li>Location recorded</li>
  <li>Next steps displayed</li>
</ul>

<h4>Tips</h4>
<ul>
  <li>Have serial numbers or barcodes ready</li>
  <li>Know storage location before starting</li>
  <li>Print labels immediately for easy tracking</li>
  <li>Link to purchase orders when available</li>
</ul>

<h4 id="work-order-wizard">📋 Work Order Creation Wizard</h4>

<div class="info">
  <strong>Purpose:</strong> Create comprehensive work orders with all necessary details including affected items, priority, SLA, and assignment.
</div>

<h4>Accessing the Wizard</h4>
<ol>
  <li>Navigate to <strong>Work Orders</strong> module</li>
  <li>Click <strong>"📋 Create Work Order Wizard"</strong> button (primary action)</li>
  <li>Wizard opens with welcome screen</li>
</ol>

<h4>Wizard Steps</h4>

<h4>Step 1: Welcome</h4>
<ul>
  <li>Overview of work order creation</li>
  <li>Work order types explained</li>
</ul>

<h4>Step 2: Work Order Type</h4>
<p>Select the type:</p>
<ul>
  <li><strong>Installation:</strong> New equipment installation</li>
  <li><strong>Repair:</strong> Fix broken equipment</li>
  <li><strong>Maintenance:</strong> Scheduled maintenance</li>
  <li><strong>Upgrade:</strong> Equipment upgrade</li>
  <li><strong>Removal:</strong> Remove equipment</li>
  <li><strong>Troubleshoot:</strong> Diagnose issues</li>
  <li><strong>Inspection:</strong> Site inspection</li>
</ul>

<h4>Step 3: Affected Items</h4>
<ul>
  <li><strong>Sites:</strong> Select affected tower sites</li>
  <li><strong>Equipment:</strong> Select affected equipment</li>
  <li>Multiple selections allowed</li>
  <li>Summary shows selected items</li>
</ul>

<h4>Step 4: Details</h4>
<ul>
  <li><strong>Title:</strong> Brief description (required)</li>
  <li><strong>Description:</strong> Detailed information (required)</li>
  <li><strong>Issue Category:</strong> Categorize the issue</li>
  <li><strong>Customer Reported:</strong> Check if customer reported</li>
  <li>If customer reported:
    <ul>
      <li>Lookup customer</li>
      <li>Enter customer name and phone</li>
    </ul>
  </li>
  <li><strong>Attach Files:</strong> Upload photos or documents</li>
</ul>

<h4>Step 5: Priority & SLA</h4>
<ul>
  <li><strong>Priority:</strong> Low, Medium, High, Critical</li>
  <li><strong>Scheduled Date:</strong> Optional scheduling</li>
  <li><strong>Estimated Duration:</strong> Time in minutes</li>
  <li><strong>SLA Settings:</strong>
    <ul>
      <li>Response time (hours)</li>
      <li>Resolution time (hours)</li>
    </ul>
  </li>
</ul>

<h4>Step 6: Assign</h4>
<ul>
  <li>Browse available technicians</li>
  <li>Select technician to assign (optional)</li>
  <li>If assigned: Work order status becomes "Assigned"</li>
  <li>If unassigned: Status remains "Open"</li>
</ul>

<h4>Step 7: Complete</h4>
<ul>
  <li>Work order summary</li>
  <li>Work order created successfully</li>
  <li>Next steps displayed</li>
</ul>

<h4>Tips</h4>
<ul>
  <li>Provide detailed descriptions</li>
  <li>Select all affected items</li>
  <li>Set appropriate priority</li>
  <li>Attach photos for visual reference</li>
  <li>Assign to technician if urgent</li>
</ul>

<h4 id="wizard-features">✨ Wizard Features</h4>

<h4>Common Features Across All Wizards</h4>

<h4>Navigation</h4>
<ul>
  <li><strong>Previous/Next:</strong> Navigate between steps</li>
  <li><strong>Step Indicator:</strong> Visual progress bar</li>
  <li><strong>Cancel:</strong> Close wizard at any time</li>
  <li><strong>Validation:</strong> Cannot proceed without required fields</li>
</ul>

<h4>Validation</h4>
<ul>
  <li>Required fields marked with asterisk (*)</li>
  <li>Error messages shown for invalid inputs</li>
  <li>Cannot proceed until errors resolved</li>
  <li>Success messages confirm actions</li>
</ul>

<h4>Loading States</h4>
<ul>
  <li>Loading indicators during API calls</li>
  <li>Disabled buttons prevent double-submission</li>
  <li>Progress messages shown</li>
</ul>

<h4>Error Handling</h4>
<ul>
  <li>Clear error messages</li>
  <li>Suggestions for fixing errors</li>
  <li>Ability to retry failed operations</li>
</ul>

<h4>Data Refresh</h4>
<ul>
  <li>Module data refreshes after wizard completion</li>
  <li>New items appear immediately</li>
  <li>Status updates reflected</li>
</ul>

<h4 id="best-practices">💡 Best Practices</h4>

<h4>Before Starting a Wizard</h4>
<ul>
  <li>Gather required information</li>
  <li>Have serial numbers, IDs, or references ready</li>
  <li>Know the location or site details</li>
  <li>Have photos ready if needed</li>
</ul>

<h4>During Wizard Flow</h4>
<ul>
  <li>Read each step carefully</li>
  <li>Complete all required fields</li>
  <li>Review selections before proceeding</li>
  <li>Don't skip validation steps</li>
</ul>

<h4>After Completion</h4>
<ul>
  <li>Review the summary</li>
  <li>Verify data in the module</li>
  <li>Check for any follow-up actions</li>
  <li>Document any issues encountered</li>
</ul>

<h4>Tips for Specific Wizards</h4>

<h4>Deployment Wizard</h4>
<ul>
  <li>Have equipment serial numbers ready</li>
  <li>Know exact GPS coordinates or site</li>
  <li>Take photos during deployment</li>
  <li>Complete checklist thoroughly</li>
</ul>

<h4>Troubleshooting Wizard</h4>
<ul>
  <li>Select correct problem type</li>
  <li>Review all diagnostic results</li>
  <li>Try solutions in order of least impact</li>
  <li>Verify fix before closing</li>
</ul>

<h4>Device Onboarding Wizard</h4>
<ul>
  <li>Ensure customer exists first</li>
  <li>Have service plan ready</li>
  <li>Run all tests before completing</li>
  <li>Verify device appears in ACS</li>
</ul>

<h4>Inventory Check-in Wizard</h4>
<ul>
  <li>Scan barcodes when possible</li>
  <li>Know storage location before starting</li>
  <li>Print labels immediately</li>
  <li>Link to purchase orders</li>
</ul>

<h4>Work Order Creation Wizard</h4>
<ul>
  <li>Provide detailed descriptions</li>
  <li>Select all affected items</li>
  <li>Set realistic SLAs</li>
  <li>Attach photos for context</li>
</ul>

<h4 id="troubleshooting">🔧 Troubleshooting</h4>

<h4>Wizard Won't Open</h4>
<ul>
  <li>Check that you're in the correct module</li>
  <li>Verify you have necessary permissions</li>
  <li>Refresh the page and try again</li>
  <li>Check browser console for errors</li>
</ul>

<h4>Cannot Proceed to Next Step</h4>
<ul>
  <li>Check for required fields marked with (*)</li>
  <li>Review error messages</li>
  <li>Ensure all validation passes</li>
  <li>Check that selections are valid</li>
</ul>

<h4>Data Not Saving</h4>
<ul>
  <li>Check internet connection</li>
  <li>Verify tenant is selected</li>
  <li>Check browser console for API errors</li>
  <li>Try again after a moment</li>
</ul>

<h4>Wizard Closes Unexpectedly</h4>
<ul>
  <li>Check for validation errors</li>
  <li>Review browser console</li>
  <li>Ensure all required data is provided</li>
  <li>Contact support if issue persists</li>
</ul>

<h4>Getting Help</h4>
<ul>
  <li>Click the <strong>Help (?)</strong> button in any module</li>
  <li>Review module-specific documentation</li>
  <li>Check wizard tooltips and hints</li>
  <li>Contact your administrator</li>
</ul>

<div class="success">
  <strong>✅ Ready to Use:</strong> All wizards are fully functional and ready for production use. Start with the Deployment Wizard or Inventory Check-in Wizard for the most common workflows.
</div>
`;
