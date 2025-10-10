<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../../components/MainMenu.svelte';
  
  // Sample presets data based on GenieACS structure
  let presets = [
    {
      id: 'default',
      name: 'Default Provisioning',
      description: 'Basic configuration for all CPE devices',
      weight: 0,
      configurations: [
        {
          type: 'value',
          path: 'InternetGatewayDevice.ManagementServer.URL',
          value: 'https://acs.example.com/cwmp'
        },
        {
          type: 'value',
          path: 'InternetGatewayDevice.ManagementServer.Username',
          value: 'acs-username'
        },
        {
          type: 'value',
          path: 'InternetGatewayDevice.ManagementServer.Password',
          value: 'acs-password'
        }
      ],
      preCondition: '',
      events: ['0 BOOTSTRAP', '1 BOOT', '2 PERIODIC'],
      tags: ['default', 'provisioning'],
      enabled: true,
      created: '2025-01-01T00:00:00Z'
    },
    {
      id: 'nokia-lte',
      name: 'Nokia LTE CPE Configuration',
      description: 'Specific configuration for Nokia LTE CPE devices',
      weight: 100,
      configurations: [
        {
          type: 'value',
          path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Enable',
          value: true
        },
        {
          type: 'value',
          path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
          value: 'nokia-lte-user'
        }
      ],
      preCondition: 'InternetGatewayDevice.DeviceInfo.Manufacturer = "Nokia"',
      events: ['0 BOOTSTRAP', '1 BOOT'],
      tags: ['nokia', 'lte', 'wan'],
      enabled: true,
      created: '2025-01-01T00:00:00Z'
    },
    {
      id: 'huawei-5g',
      name: 'Huawei 5G CPE Configuration',
      description: 'Advanced configuration for Huawei 5G CPE devices',
      weight: 200,
      configurations: [
        {
          type: 'value',
          path: 'InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.DHCPEnabled',
          value: true
        },
        {
          type: 'value',
          path: 'InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.IPInterface.1.IPInterfaceIPAddress',
          value: '192.168.1.1'
        }
      ],
      preCondition: 'InternetGatewayDevice.DeviceInfo.Manufacturer = "Huawei"',
      events: ['0 BOOTSTRAP', '1 BOOT', '2 PERIODIC'],
      tags: ['huawei', '5g', 'lan'],
      enabled: true,
      created: '2025-01-01T00:00:00Z'
    }
  ];

  let isLoading = false;
  let selectedPreset = null;
  let showCreateModal = false;
  let showEditModal = false;

  onMount(async () => {
    console.log('Presets page loaded');
    await loadPresets();
  });

  async function loadPresets() {
    isLoading = true;
    try {
      console.log('Loading presets from MongoDB...');
      
      // Use SvelteKit API route
      const response = await fetch('/api/presets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`Loaded ${data.presets.length} presets from MongoDB`);
          presets = data.presets.map(p => ({
            ...p,
            id: p._id || p.id
          }));
          isLoading = false;
          return;
        }
      }
      
      console.log('MongoDB not available, using sample data');
      loadSamplePresets();
      
    } catch (err) {
      console.error('Failed to load presets from MongoDB:', err);
      console.log('Using sample data as fallback');
      loadSamplePresets();
    }
    isLoading = false;
  }

  function loadSamplePresets() {
    // Load sample presets (fallback)
    presets = [
      {
        id: 'default',
        name: 'Default Provisioning',
        description: 'Basic configuration for all CPE devices',
        weight: 0,
        configurations: [
          {
            type: 'value',
            path: 'InternetGatewayDevice.ManagementServer.URL',
            value: 'https://acs.example.com/cwmp'
          }
        ],
        preCondition: '',
        events: ['0 BOOTSTRAP', '1 BOOT', '2 PERIODIC'],
        tags: ['default', 'provisioning'],
        enabled: true,
        created: '2025-01-01T00:00:00Z'
      }
    ];
    console.log(`Loaded ${presets.length} sample presets (fallback)`);
  }

  function createPreset() {
    showCreateModal = true;
  }

  function editPreset(preset) {
    selectedPreset = preset;
    showEditModal = true;
  }

  async function deletePreset(preset) {
    if (confirm(`Are you sure you want to delete preset "${preset.name}"?`)) {
      try {
        console.log(`Deleting preset ${preset.id}...`);
        
        // Use SvelteKit API route
        const response = await fetch('/api/presets', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: preset.id })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log(`Successfully deleted preset ${preset.id}`);
            alert('✅ Preset deleted!');
            // Reload from database
            await loadPresets();
            return;
          }
        }
        
        console.error('Failed to delete preset:', await response.text());
        alert('❌ Failed to delete preset. Check console for details.');
        
      } catch (error) {
        console.error('Failed to delete preset:', error);
        alert('❌ Failed to delete preset. Check console for details.');
      }
    }
  }

  async function togglePreset(preset) {
    try {
      console.log(`Toggling preset ${preset.id}...`);
      
      // Update in MongoDB
      const response = await fetch('/api/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: preset.id,
          enabled: !preset.enabled
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log(`Toggled preset ${preset.id}`);
          // Reload from database
          await loadPresets();
        }
      } else {
        console.error('Failed to toggle preset:', await response.text());
      }
    } catch (err) {
      console.error('Failed to toggle preset:', err);
    }
  }

  function getStatusClass(status) {
    return status ? 'status-enabled' : 'status-disabled';
  }

  function getStatusText(status) {
    return status ? 'Enabled' : 'Disabled';
  }

  async function initializeSamplePresets() {
    if (confirm('Initialize sample presets in the database? This will create 5 sample presets for testing.')) {
      try {
        console.log('Initializing sample presets...');
        
        const projectId = 'lte-pci-mapper'; // Replace with your actual project ID
        const functionsUrl = `https://us-central1-${projectId}.cloudfunctions.net`;
        
        const response = await fetch(`${functionsUrl}/initializeSamplePresets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log(`Sample presets initialized: ${data.created} created, ${data.skipped} already existed`);
            alert(`Sample presets initialized successfully!\n${data.created} created, ${data.skipped} already existed`);
            // Reload presets to show the new data
            await loadPresets();
            return;
          }
        }
        
        console.log('Firebase Functions not available for initialization');
        alert('Firebase Functions not available. Please deploy the functions first.');
        
      } catch (error) {
        console.error('Failed to initialize sample presets:', error);
        alert('Failed to initialize sample presets. Check console for details.');
      }
    }
  }
</script>

<svelte:head>
  <title>Presets - ACS Administration</title>
  <meta name="description" content="Manage ACS device provisioning presets" />
</svelte:head>

<div class="presets-page">
  <!-- Exit Button -->
  <a href="/modules/acs-cpe-management/admin" class="exit-button" aria-label="Exit to Admin">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </a>

  <!-- Main Navigation -->
  <MainMenu />
  
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-content">
      <h1 class="page-title">
        <span class="page-icon">⚙️</span>
        Device Presets
      </h1>
      <p class="page-description">
        Manage provisioning presets and device configurations
      </p>
    </div>
    <div class="header-actions">
      <button class="btn btn-secondary" on:click={initializeSamplePresets}>
        <span class="btn-icon">🗂️</span>
        Initialize Sample Data
      </button>
      <button class="btn btn-primary" on:click={createPreset}>
        <span class="btn-icon">➕</span>
        Create Preset
      </button>
    </div>
  </div>

  <!-- Presets List -->
  <div class="presets-container">
    {#if isLoading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading presets...</p>
      </div>
    {:else}
      <div class="presets-grid">
        {#each presets as preset}
          <div class="preset-card">
            <div class="preset-header">
              <div class="preset-info">
                <h3 class="preset-name">{preset.name}</h3>
                <p class="preset-description">{preset.description}</p>
              </div>
              <div class="preset-actions">
                <button 
                  class="btn btn-sm" 
                  class:btn-primary={preset.enabled} 
                  class:btn-secondary={!preset.enabled}
                  on:click={() => togglePreset(preset)}
                >
                  {getStatusText(preset.enabled)}
                </button>
                <div class="dropdown">
                  <button class="btn btn-sm btn-outline">⋮</button>
                  <div class="dropdown-menu">
                    <button class="dropdown-item" on:click={() => editPreset(preset)}>
                      ✏️ Edit
                    </button>
                    <button class="dropdown-item" on:click={() => deletePreset(preset)}>
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="preset-details">
              <div class="detail-row">
                <span class="detail-label">Weight:</span>
                <span class="detail-value">{preset.weight}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Configurations:</span>
                <span class="detail-value">{preset.configurations.length}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Events:</span>
                <span class="detail-value">{preset.events.join(', ')}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Tags:</span>
                <div class="tags">
                  {#each preset.tags as tag}
                    <span class="tag">{tag}</span>
                  {/each}
                </div>
              </div>
              {#if preset.preCondition}
                <div class="detail-row">
                  <span class="detail-label">Pre-condition:</span>
                  <code class="detail-code">{preset.preCondition}</code>
                </div>
              {/if}
            </div>
            
            <div class="preset-footer">
              <div class="preset-status">
                <span class="status-indicator" class:status-enabled={preset.enabled}></span>
                <span class="status-text">{getStatusText(preset.enabled)}</span>
              </div>
              <div class="preset-meta">
                <span class="meta-text">Created: {new Date(preset.created).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .presets-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .exit-button {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 1000;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    border: 2px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
  }

  .exit-button:hover {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
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

  .presets-container {
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

  .presets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  .preset-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    transition: all 0.2s ease;
  }

  .preset-card:hover {
    border-color: var(--accent-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .preset-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .preset-info {
    flex: 1;
  }

  .preset-name {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .preset-description {
    color: var(--text-secondary);
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .preset-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .preset-details {
    margin-bottom: 1rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color);
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .detail-label {
    font-weight: 500;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .detail-value {
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .detail-code {
    background: var(--bg-tertiary);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-primary);
    font-family: monospace;
  }

  .tags {
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

  .preset-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .preset-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-indicator {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: #ef4444;
  }

  .status-indicator.status-enabled {
    background: #10b981;
  }

  .status-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
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

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    border-color: var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .btn-outline {
    background: transparent;
    color: var(--text-secondary);
    border-color: var(--border-color);
  }

  .btn-outline:hover {
    background: var(--bg-tertiary);
  }

  .btn-sm {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
  }

  .dropdown {
    position: relative;
    display: inline-block;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 120px;
    z-index: 1000;
    display: none;
  }

  .dropdown:hover .dropdown-menu {
    display: block;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: none;
    background: none;
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .dropdown-item:hover {
    background: var(--bg-tertiary);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .presets-container {
      padding: 1rem;
    }

    .presets-grid {
      grid-template-columns: 1fr;
    }

    .preset-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .preset-actions {
      justify-content: flex-end;
    }

    .detail-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
</style>
