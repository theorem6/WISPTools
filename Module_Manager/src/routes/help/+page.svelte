<script lang="ts">
  let selectedTopic = 'overview';
  
  const topics = [
    { id: 'overview', title: '📚 Overview', icon: '📚' },
    { id: 'getting-started', title: '🚀 Getting Started', icon: '🚀' },
    { id: 'user-management', title: '👥 User Management', icon: '👥' },
    { id: 'help-desk', title: '🎧 Help Desk', icon: '🎧' },
    { id: 'work-orders', title: '📋 Work Orders', icon: '📋' },
    { id: 'inventory', title: '📦 Inventory', icon: '📦' },
    { id: 'coverage-map', title: '🗺️ Coverage Map', icon: '🗺️' },
    { id: 'hss-subscribers', title: '🔐 HSS & Subscribers', icon: '🔐' },
    { id: 'acs-cpe', title: '📡 ACS CPE Management', icon: '📡' },
    { id: 'pci-resolution', title: '📊 PCI Resolution', icon: '📊' },
    { id: 'cbrs', title: '📡 CBRS Management', icon: '📡' },
    { id: 'roles', title: '🔐 User Roles', icon: '🔐' },
    { id: 'troubleshooting', title: '🔧 Troubleshooting', icon: '🔧' }
  ];
</script>

<div class="help-container">
  <div class="help-header">
    <h1>📖 WISP Multitool Documentation</h1>
    <p class="subtitle">Complete guide to using the platform</p>
  </div>
  
  <div class="help-layout">
    <aside class="help-sidebar">
      <nav>
        {#each topics as topic}
          <button
            class="topic-btn"
            class:active={selectedTopic === topic.id}
            on:click={() => selectedTopic = topic.id}
          >
            <span class="topic-icon">{topic.icon}</span>
            <span class="topic-title">{topic.title}</span>
          </button>
        {/each}
      </nav>
    </aside>
    
    <main class="help-content">
      {#if selectedTopic === 'overview'}
        <article>
          <h2>📚 Welcome to WISP Multitool</h2>
          <p class="lead">Your complete wireless ISP management platform.</p>
          
          <section>
            <h3>What is WISP Multitool?</h3>
            <p><strong>WISP Multitool</strong> is an all-in-one platform designed for wireless Internet service providers (WISPs) to manage every aspect of their operations:</p>
            
            <ul>
              <li><strong>Network Planning</strong> - PCI resolution, CBRS spectrum, coverage mapping</li>
              <li><strong>Field Operations</strong> - Mobile app for technicians, work orders, inventory</li>
              <li><strong>Customer Support</strong> - Help desk ticketing, subscriber management</li>
              <li><strong>Device Management</strong> - ACS/TR-069 CPE management, HSS subscriber auth</li>
              <li><strong>Team Management</strong> - Role-based access, user invitations, permissions</li>
            </ul>
          </section>
          
          <section>
            <h3>Platform Components</h3>
            
            <div class="component-grid">
              <div class="component-card">
                <div class="component-icon">🌐</div>
                <h4>Web Platform</h4>
                <p>Browser-based management console for administrators, engineers, and support staff.</p>
              </div>
              
              <div class="component-card">
                <div class="component-icon">📱</div>
                <h4>Mobile App</h4>
                <p>Android app for field technicians with work orders, equipment scanning, and GPS navigation.</p>
              </div>
              
              <div class="component-card">
                <div class="component-icon">☁️</div>
                <h4>Cloud Backend</h4>
                <p>Scalable backend APIs, push notifications, and data storage on Firebase and GCE.</p>
              </div>
            </div>
          </section>
          
          <section>
            <h3>Who Uses WISP Multitool?</h3>
            
            <div class="role-cards">
              <div class="role-card">
                <h4>🏢 Owner / Admin</h4>
                <p>Manage users, configure system, view all modules, control organization settings.</p>
              </div>
              
              <div class="role-card">
                <h4>👷 Network Engineer</h4>
                <p>Plan network coverage, configure CBRS, manage HSS subscribers, optimize PCI.</p>
              </div>
              
              <div class="role-card">
                <h4>🔧 Field Technician</h4>
                <p>Use mobile app for work orders, equipment deployment, inventory checkout, site visits.</p>
              </div>
              
              <div class="role-card">
                <h4>🎧 Help Desk</h4>
                <p>Create support tickets, assist customers, lookup subscribers, troubleshoot CPE devices.</p>
              </div>
            </div>
          </section>
        </article>
      
      {:else if selectedTopic === 'getting-started'}
        <article>
          <h2>🚀 Getting Started</h2>
          
          <section>
            <h3>1. First Login</h3>
            <ol>
              <li>Navigate to the platform URL</li>
              <li>Click <strong>"Sign in with Google"</strong></li>
              <li>Authorize with your Google account</li>
              <li>Select or create your organization (tenant)</li>
            </ol>
          </section>
          
          <section>
            <h3>2. Dashboard Overview</h3>
            <p>After login, you'll see the main dashboard with module cards:</p>
            <ul>
              <li><strong>PCI Resolution</strong> - Network optimization</li>
              <li><strong>CBRS Management</strong> - Spectrum coordination</li>
              <li><strong>ACS CPE Management</strong> - Customer equipment</li>
              <li><strong>HSS Management</strong> - Subscriber authentication</li>
              <li><strong>Coverage Map</strong> - Network visualization</li>
              <li><strong>Inventory</strong> - Equipment tracking</li>
              <li><strong>Work Orders</strong> - Field operations</li>
              <li><strong>Help Desk</strong> - Customer support</li>
              <li><strong>User Management</strong> - Team administration</li>
            </ul>
            <p><em>Note: Available modules depend on your user role and tenant configuration.</em></p>
          </section>
          
          <section>
            <h3>3. Inviting Team Members</h3>
            <ol>
              <li>Go to <strong>User Management</strong> module</li>
              <li>Click <strong>"Invite User"</strong></li>
              <li>Enter email address</li>
              <li>Select role (Admin, Engineer, Installer, Help Desk, Viewer)</li>
              <li>Click <strong>"Send Invitation"</strong></li>
              <li>User receives email and can accept invitation</li>
            </ol>
          </section>
          
          <section>
            <h3>4. Mobile App Setup</h3>
            <p><strong>For Field Technicians:</strong></p>
            <ol>
              <li>Install <strong>WISP Multitool</strong> APK on Android device</li>
              <li>Open app and grant permissions (Camera, Location, Notifications)</li>
              <li>Login with same Google account as web platform</li>
              <li>Select your organization</li>
              <li>Start receiving work orders!</li>
            </ol>
          </section>
        </article>
      
      {:else if selectedTopic === 'user-management'}
        <article>
          <h2>👥 User Management</h2>
          <p class="lead">Manage your team members, roles, and permissions.</p>
          
          <section>
            <h3>Inviting Users</h3>
            <ol>
              <li>Navigate to <code>/modules/user-management</code></li>
              <li>Click <strong>"Invite User"</strong> button</li>
              <li>Enter user's email address</li>
              <li>Select appropriate role:
                <ul>
                  <li><strong>Admin</strong> - Can manage users and configure modules</li>
                  <li><strong>Engineer</strong> - Access to technical/network modules</li>
                  <li><strong>Field Technician</strong> - Mobile app and field operations</li>
                  <li><strong>Help Desk</strong> - Customer support and ticketing</li>
                  <li><strong>Viewer</strong> - Read-only access to reports</li>
                </ul>
              </li>
              <li>Click <strong>"Send Invitation"</strong></li>
            </ol>
            <p class="tip">💡 <strong>Tip:</strong> Invited users will appear with "Pending" status until they accept the invitation and login.</p>
          </section>
          
          <section>
            <h3>Editing User Roles</h3>
            <ol>
              <li>In User Management, click <strong>"Edit"</strong> next to a user</li>
              <li>Select new role from dropdown</li>
              <li>Click <strong>"Update Role"</strong></li>
              <li>Changes take effect immediately</li>
            </ol>
            <p class="warning">⚠️ <strong>Note:</strong> Owner role cannot be changed. Only one owner per organization.</p>
          </section>
          
          <section>
            <h3>Suspending Users</h3>
            <p>Temporarily disable a user's access without removing them:</p>
            <ol>
              <li>Click <strong>"Edit"</strong> on the user</li>
              <li>Click <strong>"Suspend User"</strong></li>
              <li>User can still login but API calls will fail</li>
              <li>To re-enable, click <strong>"Activate User"</strong></li>
            </ol>
          </section>
          
          <section>
            <h3>Removing Users</h3>
            <ol>
              <li>Click <strong>"Edit"</strong> on the user</li>
              <li>Click <strong>"Remove from Organization"</strong></li>
              <li>Confirm deletion</li>
              <li>User is removed from tenant (cannot be undone)</li>
            </ol>
            <p class="warning">⚠️ <strong>Warning:</strong> Cannot remove the owner. Transfer ownership first.</p>
          </section>
        </article>
      
      {:else if selectedTopic === 'help-desk'}
        <article>
          <h2>🎧 Help Desk Module</h2>
          <p class="lead">Customer support ticketing and equipment troubleshooting.</p>
          
          <section>
            <h3>Creating Support Tickets</h3>
            <ol>
              <li>Go to <strong>Help Desk</strong> module</li>
              <li>Click <strong>"Create Ticket"</strong></li>
              <li>Enter ticket information:
                <ul>
                  <li><strong>Title</strong> - Brief description</li>
                  <li><strong>Type</strong> - Troubleshoot, Repair, Installation, Other</li>
                  <li><strong>Priority</strong> - Critical, High, Medium, Low</li>
                  <li><strong>Description</strong> - Detailed issue description</li>
                  <li><strong>Customer</strong> - Name and phone (optional)</li>
                </ul>
              </li>
              <li>Click <strong>"Create Ticket"</strong></li>
            </ol>
          </section>
          
          <section>
            <h3>Assigning Tickets</h3>
            <p>Help desk staff can assign tickets to field technicians:</p>
            <ol>
              <li>Click on a ticket card to open details</li>
              <li>Click <strong>"Assign"</strong> button</li>
              <li>Select field technician from dropdown</li>
              <li>Technician receives push notification on mobile app</li>
            </ol>
          </section>
          
          <section>
            <h3>Filtering Tickets</h3>
            <p>Use filters to find specific tickets:</p>
            <ul>
              <li><strong>Status</strong> - Open, Assigned, In Progress, Resolved, Closed</li>
              <li><strong>Priority</strong> - Critical, High, Medium, Low</li>
              <li><strong>Search</strong> - Search by ticket number, title, or customer name</li>
            </ul>
          </section>
          
          <section>
            <h3>Customer Lookup</h3>
            <ol>
              <li>Click <strong>"Customer Lookup"</strong> button</li>
              <li>Search by phone, email, or IMSI</li>
              <li>View customer information and service status</li>
              <li>See active equipment and recent tickets</li>
            </ol>
          </section>
        </article>
      
      {:else if selectedTopic === 'roles'}
        <article>
          <h2>🔐 User Roles & Permissions</h2>
          <p class="lead">Understanding the role-based access control system.</p>
          
          <section>
            <h3>Role Hierarchy</h3>
            
            <div class="role-detail">
              <h4>🏢 Platform Admin</h4>
              <p><strong>Who:</strong> System administrator (admin@wisptools.io)</p>
              <p><strong>Access:</strong> ALL tenants, ALL modules, ALL permissions</p>
              <p><strong>Can:</strong> Manage all tenants, create owners, override any permission</p>
            </div>
            
            <div class="role-detail">
              <h4>👑 Owner</h4>
              <p><strong>Who:</strong> Organization creator</p>
              <p><strong>Access:</strong> ALL modules in their tenant</p>
              <p><strong>Can:</strong> Manage users, configure modules, full administrative control</p>
              <p><strong>Cannot:</strong> Be changed or removed (permanent role)</p>
            </div>
            
            <div class="role-detail">
              <h4>⚙️ Admin</h4>
              <p><strong>Who:</strong> Assistant administrators</p>
              <p><strong>Access:</strong> Configurable module access</p>
              <p><strong>Can:</strong> Manage users, configure permissions, access enabled modules</p>
              <p><strong>Cannot:</strong> Change owner role, delete organization</p>
            </div>
            
            <div class="role-detail">
              <h4>👷 Engineer</h4>
              <p><strong>Who:</strong> Network engineers</p>
              <p><strong>Access:</strong> Technical modules only (PCI, CBRS, HSS, ACS, Distributed EPC)</p>
              <p><strong>Can:</strong> Configure network, manage subscribers, view all work orders</p>
              <p><strong>Cannot:</strong> Manage users, access help desk</p>
            </div>
            
            <div class="role-detail">
              <h4>🔧 Field Technician (Installer)</h4>
              <p><strong>Who:</strong> Field workers</p>
              <p><strong>Access:</strong> Mobile app, assigned work orders, inventory checkout</p>
              <p><strong>Can:</strong> Deploy equipment, complete tickets, checkout inventory</p>
              <p><strong>Cannot:</strong> View other techs' tickets, configure network</p>
            </div>
            
            <div class="role-detail">
              <h4>🎧 Help Desk</h4>
              <p><strong>Who:</strong> Customer support staff</p>
              <p><strong>Access:</strong> Help desk, work orders, ACS troubleshooting</p>
              <p><strong>Can:</strong> Create tickets, assign to techs, troubleshoot CPE</p>
              <p><strong>Cannot:</strong> Manage users, configure network</p>
            </div>
            
            <div class="role-detail">
              <h4>👁️ Viewer</h4>
              <p><strong>Who:</strong> Read-only users, auditors</p>
              <p><strong>Access:</strong> View-only access to all modules</p>
              <p><strong>Can:</strong> View dashboards, reports, export data</p>
              <p><strong>Cannot:</strong> Make any changes</p>
            </div>
          </section>
          
          <section>
            <h3>Configuring Module Access</h3>
            <ol>
              <li>Go to <strong>Settings</strong> → <strong>Module Access</strong></li>
              <li>See matrix of roles vs. modules</li>
              <li>Check/uncheck boxes to enable/disable modules per role</li>
              <li>Click <strong>"Save Configuration"</strong></li>
              <li>Changes apply immediately to all users</li>
            </ol>
            <p class="tip">💡 <strong>Tip:</strong> Use the reset button to restore default permissions for a role.</p>
          </section>
        </article>
      
      {:else if selectedTopic === 'work-orders'}
        <article>
          <h2>📋 Work Orders & Field Operations</h2>
          
          <section>
            <h3>Creating Work Orders</h3>
            <ol>
              <li>Go to <strong>Work Orders</strong> or <strong>Help Desk</strong> module</li>
              <li>Click <strong>"Create Work Order"</strong></li>
              <li>Fill in details:
                <ul>
                  <li><strong>Title</strong> - Brief description</li>
                  <li><strong>Type</strong> - Installation, Repair, Maintenance, etc.</li>
                  <li><strong>Priority</strong> - Critical to Low</li>
                  <li><strong>Site</strong> - Affected tower site (optional)</li>
                  <li><strong>Customer</strong> - Customer details (optional)</li>
                  <li><strong>Description</strong> - Full details</li>
                </ul>
              </li>
              <li>Click <strong>"Create"</strong></li>
            </ol>
          </section>
          
          <section>
            <h3>Assigning Work Orders</h3>
            <ol>
              <li>Open work order details</li>
              <li>Click <strong>"Assign"</strong></li>
              <li>Select field technician</li>
              <li>Technician receives push notification on mobile app</li>
              <li>Status changes to "Assigned"</li>
            </ol>
          </section>
          
          <section>
            <h3>Mobile App Workflow</h3>
            <p><strong>Field Technician receives notification:</strong></p>
            <ol>
              <li>Push notification appears on phone</li>
              <li>Tap notification to open app</li>
              <li>View work order details</li>
              <li>Navigate to site using GPS</li>
              <li>Complete work</li>
              <li>Update status to "Resolved"</li>
              <li>Add notes and photos</li>
            </ol>
          </section>
        </article>
      
      {:else if selectedTopic === 'troubleshooting'}
        <article>
          <h2>🔧 Troubleshooting</h2>
          
          <section>
            <h3>Common Issues</h3>
            
            <div class="troubleshoot-item">
              <h4>❌ Can't see a module on dashboard</h4>
              <p><strong>Cause:</strong> Module not enabled for your role</p>
              <p><strong>Solution:</strong> Ask your administrator to enable the module in Settings → Module Access</p>
            </div>
            
            <div class="troubleshoot-item">
              <h4>❌ API calls fail with 403 Forbidden</h4>
              <p><strong>Cause:</strong> Insufficient permissions for the action</p>
              <p><strong>Solution:</strong> Contact your administrator to update your role or permissions</p>
            </div>
            
            <div class="troubleshoot-item">
              <h4>❌ Mobile app not receiving notifications</h4>
              <p><strong>Solutions:</strong></p>
              <ul>
                <li>Check app has notification permissions granted</li>
                <li>Check user is logged in</li>
                <li>Restart app to re-register FCM token</li>
                <li>Check system notification settings</li>
              </ul>
            </div>
            
            <div class="troubleshoot-item">
              <h4>❌ Work order not appearing in mobile app</h4>
              <p><strong>Cause:</strong> Work order not assigned to your user</p>
              <p><strong>Solution:</strong> Field technicians only see tickets assigned to them. Ask help desk to assign the ticket.</p>
            </div>
          </section>
          
          <section>
            <h3>Getting Help</h3>
            <p>If you encounter issues:</p>
            <ol>
              <li>Check this documentation first</li>
              <li>Contact your organization administrator</li>
              <li>Check browser console for errors (F12)</li>
              <li>Clear browser cache and cookies</li>
              <li>Try logging out and back in</li>
            </ol>
          </section>
        </article>
      
      {:else}
        <article>
          <h2>Documentation Coming Soon</h2>
          <p>Detailed documentation for <strong>{topics.find(t => t.id === selectedTopic)?.title || selectedTopic}</strong> will be added here.</p>
          <p>In the meantime, explore the module and use tooltips for guidance.</p>
        </article>
      {/if}
    </main>
  </div>
</div>

<style>
  .help-container {
    min-height: 100vh;
    background: var(--bg-primary);
  }
  
  .help-header {
    background: white;
    padding: 2rem;
    border-bottom: 2px solid var(--border-color);
    text-align: center;
  }
  
  .help-header h1 {
    margin: 0 0 0.5rem;
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  
  .subtitle {
    color: var(--text-secondary);
    font-size: 1.125rem;
    margin: 0;
  }
  
  .help-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    max-width: 1400px;
    margin: 0 auto;
    gap: 2rem;
    padding: 2rem;
  }
  
  .help-sidebar {
    position: sticky;
    top: 2rem;
    height: fit-content;
  }
  
  .help-sidebar nav {
    background: white;
    border-radius: 0.75rem;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  
  .topic-btn {
    width: 100%;
    text-align: left;
    padding: 0.75rem 1rem;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.2s;
    margin-bottom: 0.25rem;
  }
  
  .topic-btn:hover {
    background: var(--bg-hover);
  }
  
  .topic-btn.active {
    background: var(--primary);
    color: white;
  }
  
  .topic-icon {
    font-size: 1.5rem;
  }
  
  .topic-title {
    font-weight: 500;
  }
  
  .help-content {
    background: white;
    border-radius: 0.75rem;
    padding: 2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  
  article {
    max-width: 900px;
  }
  
  article h2 {
    margin: 0 0 1rem;
    font-size: 2rem;
    font-weight: 700;
  }
  
  .lead {
    font-size: 1.25rem;
    color: var(--text-secondary);
    margin-bottom: 2rem;
  }
  
  section {
    margin-bottom: 3rem;
  }
  
  section h3 {
    margin: 0 0 1rem;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  section h4 {
    margin: 0 0 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  section p, section li {
    line-height: 1.7;
    color: var(--text-secondary);
  }
  
  ol, ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }
  
  li {
    margin-bottom: 0.5rem;
  }
  
  code {
    background: var(--bg-secondary);
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.9em;
  }
  
  .tip {
    background: #eff6ff;
    border-left: 4px solid #3b82f6;
    padding: 1rem;
    border-radius: 0.5rem;
    margin: 1rem 0;
  }
  
  .warning {
    background: #fef3c7;
    border-left: 4px solid #f59e0b;
    padding: 1rem;
    border-radius: 0.5rem;
    margin: 1rem 0;
  }
  
  .component-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin: 2rem 0;
  }
  
  .component-card {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 0.75rem;
    text-align: center;
  }
  
  .component-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  
  .component-card h4 {
    margin: 0 0 0.5rem;
  }
  
  .role-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin: 2rem 0;
  }
  
  .role-card {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 0.5rem;
  }
  
  .role-card h4 {
    margin: 0 0 0.5rem;
  }
  
  .role-card p {
    font-size: 0.875rem;
  }
  
  .role-detail {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 0.75rem;
    margin-bottom: 1.5rem;
    border-left: 4px solid var(--primary);
  }
  
  .role-detail h4 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
  }
  
  .role-detail p {
    margin: 0.5rem 0;
  }
  
  .troubleshoot-item {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 0.75rem;
    margin-bottom: 1.5rem;
  }
  
  .troubleshoot-item h4 {
    margin: 0 0 0.75rem;
  }
  
  .troubleshoot-item p {
    margin: 0.5rem 0;
  }
</style>

