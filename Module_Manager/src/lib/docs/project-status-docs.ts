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
  <li><strong>Wizards:</strong> All 19+ wizards implemented and in-app (Site/Deployment, Subscriber/Plan/Group, RMA, Customer Onboarding, Conflict Resolution, CBRS Device Registration, Organization Setup, Initial Configuration, Troubleshooting, Device Onboarding, etc.). Access via <code>/wizards</code> or each module’s wizard menu.</li>
  <li><strong>Customer form:</strong> Add/Edit Customer includes service type (4G/5G, FWA, WiFi, Fiber), LTE auth (IMSI, Ki, OPc), MAC address, and QoS.</li>
  <li><strong>Customer Portal:</strong> Branding (Portal Setup), tickets, billing (Stripe/PayPal, invoices), FAQ, KB, service status, live-chat placeholder. Routes at <code>/modules/customers/portal/*</code>.</li>
  <li><strong>ACS:</strong> Preset Management at <code>/modules/acs-cpe-management/presets</code>. Parameter editor, customer link/unlink, diagnostics/reboot/refresh; alerts and firmware UI exist.</li>
  <li><strong>Documentation:</strong> Integrated at <code>/help</code> and <code>/docs</code>; key repo docs have frontmatter. API_BASE_URL documented in <code>.env.example</code> and deployment docs.</li>
</ul>

<h2>Next Items (Optional / Polish)</h2>
<ol>
  <li><strong>Documentation:</strong> Add frontmatter to more <code>docs/</code> files; fix any broken links; optional code examples and diagrams.</li>
  <li><strong>Customer Portal:</strong> Optional live chat integration, KB search enhancements.</li>
  <li><strong>ACS:</strong> Optional alert email/SMS integration; device grouping/tags.</li>
  <li><strong>Optional:</strong> Connection topology (ArcGIS), advanced alerting, field app branded icon.</li>
</ol>

<h2>Key Docs in Repository</h2>
<p>In the repo <code>docs/</code> folder:</p>
<ul>
  <li><strong>docs/README.md</strong> – Master documentation index (status, operational setup, full index).</li>
  <li><strong>docs/WHERE_WE_ARE_AND_NEXT_STEPS.md</strong> – Snapshot and prioritized next steps.</li>
  <li><strong>docs/NEXT_ITEMS_TO_ADD.md</strong> – Full list: wizards, portal, billing, ACS, docs (all implemented or optional).</li>
  <li><strong>docs/OPTIONAL_ITEMS.md</strong> – Optional work only (documentation, portal, ACS, monitoring, field app, reporting).</li>
  <li><strong>docs/WHATS_MISSING_IN_APP.md</strong> – One-page checklist (done vs remaining).</li>
  <li><strong>docs/PROJECT_WORKFLOW_STATUS.md</strong> – Plan/deploy/field app workflow status.</li>
  <li><strong>docs/BILLING_CRON_AND_DUNNING_SCHEDULE.md</strong> – Billing automation (cron or Cloud Scheduler).</li>
  <li><strong>docs/FIELD_APP_DOWNLOAD.md</strong> – Field App APK build and download URL.</li>
</ul>
<p>These are the single source of truth for planning, status, and operational setup.</p>
`;
