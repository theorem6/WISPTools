/**
 * Project Status & Next Steps – in-app documentation content.
 * Single source of truth for this page; repo docs/ folder holds full planning.
 */
export const projectStatusTitle = 'Project Status & Next Steps';

export const projectStatusContent = `
<h2>Where We Are</h2>
<ul>
  <li><strong>Frontend:</strong> Firebase Hosting. Deploy: <code>npm run build</code> in Module_Manager, then <code>firebase deploy --only hosting:app</code>.</li>
  <li><strong>Backend:</strong> GCE VM. Deploy: <code>deploy-backend-to-gce.ps1</code> (Upload or Git).</li>
  <li><strong>Functions:</strong> <code>firebase deploy --only functions</code>.</li>
  <li><strong>Wizards:</strong> Site Deployment, Subscriber Creation, RMA Tracking, Customer Onboarding, Bandwidth Plan, Subscriber Group, Troubleshooting (ACS), Device Onboarding – all integrated in-app. Remaining: Deployment, ConflictResolution, CBRS DeviceRegistration, OrganizationSetup, InitialConfiguration.</li>
  <li><strong>Customer form:</strong> Add/Edit Customer includes service type (4G/5G, FWA, WiFi, Fiber), LTE auth (IMSI, Ki, OPc), MAC address, and QoS.</li>
  <li><strong>ACS:</strong> Preset Management at <code>/modules/acs-cpe-management/presets</code>. Parameter editor, customer link/unlink, diagnostics/reboot/refresh.</li>
  <li><strong>Documentation:</strong> Integrated into this app at <code>/help</code>; no separate docs site.</li>
</ul>

<h2>Next Items (Summary)</h2>
<ol>
  <li><strong>Wizards:</strong> 5 remaining (Deployment, ConflictResolution, CBRS DeviceRegistration, OrganizationSetup, InitialConfiguration).</li>
  <li><strong>Customer Portal:</strong> Branding schema + UI, ticket wiring, route polish.</li>
  <li><strong>ACS:</strong> Alert integration; firmware UI/scheduling.</li>
  <li><strong>Customer billing:</strong> Billing cycles, invoicing, SLA tracking (when prioritized).</li>
  <li><strong>Documentation:</strong> Add frontmatter to repo <code>docs/</code> files; fix links; optional code examples and diagrams.</li>
  <li><strong>Optional:</strong> Connection topology (ArcGIS), advanced alerting, field app branded icon, API_BASE_URL for deployment photos.</li>
</ol>

<h2>Key Docs in Repository</h2>
<p>In the repo <code>docs/</code> folder:</p>
<ul>
  <li><strong>docs/WHERE_WE_ARE_AND_NEXT_STEPS.md</strong> – Snapshot and prioritized next steps.</li>
  <li><strong>docs/NEXT_ITEMS_TO_ADD.md</strong> – Full list of items needing to be added.</li>
  <li><strong>docs/PROJECT_WORKFLOW_STATUS.md</strong> – Plan/deploy/field app workflow status.</li>
</ul>
<p>These are the single source of truth for planning and status.</p>
`;
