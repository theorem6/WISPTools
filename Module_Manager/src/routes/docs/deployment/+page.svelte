<script lang="ts">
</script>

<svelte:head>
  <title>Deployment – WISPTools Docs</title>
</svelte:head>

<h1>Deployment Overview</h1>
<p class="lead">How to deploy the WISPTools platform: frontend, backend, and infrastructure.</p>

<section class="doc-section">
  <h2>Stack overview</h2>
  <ul>
    <li><strong>Frontend</strong> – SvelteKit app on Firebase Hosting</li>
    <li><strong>Backend</strong> – Node.js/Express API (e.g. Google Compute Engine)</li>
    <li><strong>Database</strong> – MongoDB (Atlas or self-hosted)</li>
    <li><strong>Auth</strong> – Firebase Authentication</li>
    <li><strong>Functions</strong> – Firebase Cloud Functions (API proxy, CWMP, etc.)</li>
  </ul>
</section>

<section class="doc-section">
  <h2>Deploy steps</h2>
  <h3>1. Frontend</h3>
  <p>Build and deploy the main app:</p>
  <pre class="code-block">cd Module_Manager
npm run build
firebase deploy --only hosting:app</pre>
  <p>Output is in <code>Module_Manager/build/client</code>. Firebase Hosting serves it with rewrites to the API proxy.</p>

  <h3>2. Backend</h3>
  <p>Deploy the API (GCE or other Node host):</p>
  <pre class="code-block">.\deploy-backend-to-gce.ps1 -DeployMethod Upload</pre>
  <p>Or use <code>-DeployMethod Git</code> if the server pulls from the repo. Ensure <code>X-Tenant-ID</code>, MongoDB, and GenieACS URLs are configured.</p>

  <h3>3. Firebase Functions</h3>
  <pre class="code-block">firebase deploy --only functions</pre>
  <p>Required for API proxy, notifications, CWMP multitenant, and any callable functions (e.g. CBRS config encryption).</p>
</section>

<section class="doc-section">
  <h2>Environment</h2>
  <p>Configure:</p>
  <ul>
    <li>Firebase config (frontend)</li>
    <li>MongoDB connection string (backend)</li>
    <li>GenieACS NBI URL (per tenant or global)</li>
    <li>Optional: ArcGIS API key, SendGrid, GitHub token for Git deploy</li>
  </ul>
  <p>See <code>docs/WHERE_WE_ARE_AND_NEXT_STEPS.md</code> and repo <code>.env.example</code> for references.</p>
</section>

<section class="doc-section">
  <h2>After deployment</h2>
  <ul>
    <li>Verify health: <code>/health</code> on backend, app loads on hosting URL</li>
    <li>Test login and tenant selection</li>
    <li>Create initial admin and configure first tenant</li>
  </ul>
  <p><a href="/docs">← Documentation home</a></p>
</section>

<style>
  .lead {
    font-size: 1.125rem;
    color: var(--text-secondary);
    margin-bottom: 2rem;
  }
  .doc-section {
    margin-bottom: 2rem;
  }
  .doc-section h2 {
    font-size: 1.5rem;
    margin-bottom: 0.75rem;
    color: var(--text-primary);
  }
  .doc-section h3 {
    font-size: 1.2rem;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }
  .doc-section ul {
    padding-left: 1.5rem;
  }
  .code-block {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 1rem;
    overflow-x: auto;
    font-size: 0.9rem;
    margin: 0.75rem 0;
  }
  .doc-section a {
    color: var(--primary-color);
    text-decoration: none;
  }
  .doc-section a:hover {
    text-decoration: underline;
  }
  .doc-section code {
    background: var(--bg-secondary);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.9em;
  }
</style>
