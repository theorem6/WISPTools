<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../../components/MainMenu.svelte';
  
  // Sample provisions data
  let provisions = [
    {
      id: 'default-provision',
      name: 'Default Device Provisioning',
      description: 'Basic device configuration and parameter setup',
      script: `// Default device provisioning script
declare("InternetGatewayDevice.ManagementServer.URL", [], "https://acs.example.com/cwmp");
declare("InternetGatewayDevice.ManagementServer.Username", [], "acs-user");
declare("InternetGatewayDevice.ManagementServer.Password", [], "acs-pass");
declare("InternetGatewayDevice.ManagementServer.PeriodicInformInterval", [], 86400);

// Enable periodic inform
declare("InternetGatewayDevice.ManagementServer.PeriodicInformEnable", [], true);`,
      enabled: true,
      tags: ['default', 'provisioning'],
      created: '2025-01-01T00:00:00Z'
    },
    {
      id: 'firmware-upgrade',
      name: 'Automated Firmware Upgrade',
      description: 'Automatic firmware update for compatible devices',
      script: `// Automated firmware upgrade script
if (device["InternetGatewayDevice.DeviceInfo.SoftwareVersion"] < "2.0") {
  declare("InternetGatewayDevice.ManagementServer.Download", [], {
    "CommandKey": "firmware-upgrade",
    "FileType": "1 Firmware Upgrade Image",
    "URL": "http://files.example.com/firmware/v2.0.bin",
    "Username": "firmware-user",
    "Password": "firmware-pass",
    "TargetFileName": "firmware-upgrade.bin"
  });
}`,
      enabled: true,
      tags: ['firmware', 'upgrade', 'automation'],
      created: '2025-01-01T00:00:00Z'
    }
  ];

  let isLoading = false;
  let selectedProvision = null;
  let showCreateModal = false;
  let showEditModal = false;

  onMount(async () => {
    console.log('Provisions page loaded');
    await loadProvisions();
  });

  async function loadProvisions() {
    isLoading = true;
    try {
      console.log('Loading provisions from Firebase Functions...');
      
      // Use SvelteKit API route (no Firebase Functions needed!)
      const response = await fetch('/api/provisions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.provisions.length > 0) {
          console.log(`Loaded ${data.provisions.length} provisions from Firebase Functions`);
          provisions = data.provisions;
          isLoading = false;
          return;
        }
      }
      
      console.log('Firebase Functions not available, using sample data');
      // Fallback to sample data
      loadSampleProvisions();
      
    } catch (err) {
      console.error('Failed to load provisions from Firebase Functions:', err);
      console.log('Using sample data as fallback');
      loadSampleProvisions();
    }
    isLoading = false;
  }

  function loadSampleProvisions() {
    // Load sample provisions (fallback)
    provisions = [
      {
        id: 'default-provision',
        name: 'Default Device Provisioning',
        description: 'Basic device configuration and parameter setup',
        script: `// Default device provisioning script
declare("InternetGatewayDevice.ManagementServer.URL", [], "https://acs.example.com/cwmp");
declare("InternetGatewayDevice.ManagementServer.Username", [], "acs-user");
declare("InternetGatewayDevice.ManagementServer.Password", [], "acs-pass");`,
        enabled: true,
        tags: ['default', 'provisioning'],
        created: '2025-01-01T00:00:00Z'
      }
    ];
    console.log(`Loaded ${provisions.length} sample provisions (fallback)`);
  }

  function createProvision() {
    showCreateModal = true;
  }

  function editProvision(provision) {
    selectedProvision = provision;
    showEditModal = true;
  }

  async function deleteProvision(provision) {
    if (confirm(`Are you sure you want to delete provision "${provision.name}"?`)) {
      try {
        console.log(`Deleting provision ${provision.id}...`);
        
        // Use SvelteKit API route
        const response = await fetch('/api/provisions', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: provision.id })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log(`Successfully deleted provision ${provision.id}`);
            // Remove from local array
            const index = provisions.findIndex(p => p.id === provision.id);
            if (index > -1) {
              provisions.splice(index, 1);
              provisions = [...provisions];
            }
            return;
          }
        }
        
        console.log('Firebase Functions not available, using local delete');
        // Fallback to local delete
        const index = provisions.findIndex(p => p.id === provision.id);
        if (index > -1) {
          provisions.splice(index, 1);
          provisions = [...provisions];
        }
        
      } catch (error) {
        console.error('Failed to delete provision:', error);
        // Still remove from local array even if API call failed
        const index = provisions.findIndex(p => p.id === provision.id);
        if (index > -1) {
          provisions.splice(index, 1);
          provisions = [...provisions];
        }
      }
    }
  }

  async function initializeSampleProvisions() {
    if (confirm('Initialize sample provisions in the database? This will create 3 sample provisions for testing.')) {
      try {
        console.log('Initializing sample provisions...');
        
        // Use MongoDB init route (provisions are created with database init)
        const response = await fetch('/api/mongo/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log(`Sample provisions initialized: ${data.created} created, ${data.skipped} already existed`);
            alert(`Sample provisions initialized successfully!\n${data.created} created, ${data.skipped} already existed`);
            // Reload provisions to show the new data
            await loadProvisions();
            return;
          }
        }
        
        console.log('Firebase Functions not available for initialization');
        alert('Firebase Functions not available. Please deploy the functions first.');
        
      } catch (error) {
        console.error('Failed to initialize sample provisions:', error);
        alert('Failed to initialize sample provisions. Check console for details.');
      }
    }
  }
</script>

<svelte:head>
  <title>Provisions - ACS Administration</title>
  <meta name="description" content="JavaScript provisioning scripts for device management" />
</svelte:head>

<div class="provisions-page">
  <!-- Main Navigation -->
  <MainMenu />
  
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-content">
      <a href="/modules/acs-cpe-management/admin" class="back-button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Admin
      </a>
      <h1 class="page-title">
        <span class="page-icon">📜</span>
        Provisioning Scripts
      </h1>
      <p class="page-description">
        JavaScript scripts for automated device provisioning
      </p>
    </div>
    <div class="header-actions">
      <button class="btn btn-secondary" on:click={initializeSampleProvisions}>
        <span class="btn-icon">🗂️</span>
        Initialize Sample Data
      </button>
      <button class="btn btn-primary" on:click={createProvision}>
        <span class="btn-icon">➕</span>
        Create Provision
      </button>
    </div>
  </div>

  <!-- Provisions List -->
  <div class="provisions-container">
    {#if isLoading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading provisions...</p>
      </div>
    {:else}
      <div class="provisions-grid">
        {#each provisions as provision}
          <div class="provision-card">
            <div class="provision-header">
              <div class="provision-info">
                <h3 class="provision-name">{provision.name}</h3>
                <p class="provision-description">{provision.description}</p>
              </div>
              <div class="provision-actions">
                <button class="btn btn-sm btn-primary" on:click={() => editProvision(provision)}>
                  Edit
                </button>
                <button class="btn btn-sm btn-danger" on:click={() => deleteProvision(provision)}>
                  Delete
                </button>
              </div>
            </div>
            
            <div class="provision-script">
              <h4>Script:</h4>
              <pre><code>{provision.script}</code></pre>
            </div>
            
            <div class="provision-footer">
              <div class="provision-tags">
                {#each provision.tags as tag}
                  <span class="tag">{tag}</span>
                {/each}
              </div>
              <div class="provision-meta">
                <span class="meta-text">Created: {new Date(provision.created).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .provisions-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    margin-bottom: 0.5rem;
  }

  .back-button:hover {
    color: var(--accent-color);
    background: var(--bg-tertiary);
  }

  .back-button svg {
    flex-shrink: 0;
  }

  .page-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-content {
    flex: 1;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .page-icon {
    font-size: 1.25rem;
  }

  .page-description {
    color: var(--text-secondary);
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 1rem;
  }

  .provisions-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    color: var(--text-secondary);
  }

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid var(--border-color);
    border-top: 2px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .provisions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
    gap: 1.5rem;
  }

  .provision-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    transition: all 0.2s ease;
  }

  .provision-card:hover {
    border-color: var(--accent-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .provision-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .provision-info {
    flex: 1;
  }

  .provision-name {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .provision-description {
    color: var(--text-secondary);
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .provision-actions {
    display: flex;
    gap: 0.5rem;
  }

  .provision-script {
    margin-bottom: 1rem;
  }

  .provision-script h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .provision-script pre {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    padding: 1rem;
    overflow-x: auto;
    font-size: 0.75rem;
    line-height: 1.4;
    margin: 0;
  }

  .provision-script code {
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
  }

  .provision-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .provision-tags {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .tag {
    background: var(--accent-color);
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .meta-text {
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid transparent;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover {
    background: var(--accent-color-hover);
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover {
    background: #dc2626;
  }

  .btn-sm {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
  }

  .btn-icon {
    font-size: 0.875rem;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .provisions-container {
      padding: 1rem;
    }

    .provisions-grid {
      grid-template-columns: 1fr;
    }

    .provision-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .provision-actions {
      justify-content: flex-end;
    }

    .provision-footer {
      flex-direction: column;
      gap: 0.5rem;
      align-items: stretch;
    }
  }
</style>
