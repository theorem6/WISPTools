<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../../components/MainMenu.svelte';
  import { env } from '$env/dynamic/public';
  
  let isLoading = false;
  let mongoStatus = null;
  let error = '';
  let successMessage = '';
  
  let autoInitialize = false;
  let showAutoInitDialog = false;
  let activeTab = 'status'; // 'status' or 'reset'
  
  onMount(async () => {
    console.log('Database initialization page loaded');
    await checkMongoDBStatus();
    
    // Check if database is empty and offer auto-initialization
    if (mongoStatus && mongoStatus.collections.presets === 0 && mongoStatus.collections.faults === 0) {
      showAutoInitDialog = true;
    }
  });
  
  async function checkMongoDBStatus() {
    isLoading = true;
    error = '';
    
    try {
      // Use SvelteKit API route (no Firebase Functions needed!)
      const response = await fetch('/api/mongo/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        mongoStatus = data;
      } else {
        error = data.error || 'Failed to check MongoDB status';
      }
    } catch (err) {
      console.error('Failed to check MongoDB status:', err);
      error = err.message || 'Failed to connect to MongoDB';
    }
    
    isLoading = false;
  }
  
  async function initializeDatabase(skipConfirm = false) {
    if (!skipConfirm) {
      if (!confirm('Initialize MongoDB database with sample data?\n\nThis will create:\n- Sample presets (4 items)\n- Sample faults (3 items)\n\nExisting data will not be overwritten.')) {
        return;
      }
    }
    
    showAutoInitDialog = false;
    
    isLoading = true;
    error = '';
    successMessage = '';
    
    try {
      // Use SvelteKit API route (no Firebase Functions needed!)
      const response = await fetch('/api/mongo/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        successMessage = `✅ Database initialized!\n\nPresets: ${data.presets.created} created, ${data.presets.skipped} existed (${data.presets.total} total)\nFaults: ${data.faults.created} created, ${data.faults.skipped} existed (${data.faults.total} total)`;
        
        // Refresh status
        await checkMongoDBStatus();
      } else {
        error = data.error || 'Failed to initialize database';
      }
    } catch (err) {
      console.error('Failed to initialize database:', err);
      error = err.message || 'Failed to initialize database';
    }
    
    isLoading = false;
  }
  
  async function initializePresets() {
    if (!confirm('Initialize sample presets?\n\nThis will create 4 sample presets if they don\'t exist.')) {
      return;
    }
    
    isLoading = true;
    error = '';
    successMessage = '';
    
    try {
      const response = await fetch('/api/mongo/init', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        successMessage = `✅ ${data.message}`;
        await checkMongoDBStatus();
      } else {
        error = data.error;
      }
    } catch (err) {
      error = err.message || 'Failed to initialize presets';
    }
    
    isLoading = false;
  }
  
  async function initializeFaults() {
    if (!confirm('Initialize sample faults?\n\nThis will create 3 sample faults if they don\'t exist.')) {
      return;
    }
    
    isLoading = true;
    error = '';
    successMessage = '';
    
    try {
      const response = await fetch('/api/mongo/init', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        successMessage = `✅ ${data.message}`;
        await checkMongoDBStatus();
      } else {
        error = data.error;
      }
    } catch (err) {
      error = err.message || 'Failed to initialize faults';
    }
    
    isLoading = false;
  }
</script>

<svelte:head>
  <title>Database Initialization - ACS Administration</title>
  <meta name="description" content="Initialize and manage MongoDB database" />
</svelte:head>

<div class="database-page">
  <MainMenu />
  
  <div class="page-header">
    <div class="header-content">
      <div class="header-top">
        <a href="/modules/acs-cpe-management/admin" class="back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Admin
        </a>
      </div>
      <h1 class="page-title">
        <span class="page-icon">🗄️</span>
        MongoDB Database Management
      </h1>
      <p class="page-description">
        Monitor database status and manage system data
      </p>
    </div>
  </div>
  
  <!-- Tabs -->
  <div class="tabs-container">
    <button 
      class="tab" 
      class:active={activeTab === 'status'}
      on:click={() => activeTab = 'status'}
    >
      📊 Database Status
    </button>
    <button 
      class="tab tab-danger" 
      class:active={activeTab === 'reset'}
      on:click={() => activeTab = 'reset'}
    >
      ⚠️ Reset Systems
    </button>
  </div>

  <div class="content">
    {#if activeTab === 'status'}
      <!-- Database Status Tab -->
    
    <!-- Auto-Initialize Dialog -->
    {#if showAutoInitDialog && activeTab === 'status'}
      <div class="auto-init-banner">
        <div class="banner-content">
          <div class="banner-icon">🚀</div>
          <div class="banner-text">
            <h3>Database is Empty</h3>
            <p>Would you like to automatically initialize the database with sample data?</p>
            <p class="banner-hint">This creates 4 presets and 3 faults for testing and development.</p>
          </div>
          <div class="banner-actions">
            <button class="btn btn-primary btn-lg" on:click={() => initializeDatabase(true)} disabled={isLoading}>
              {#if isLoading}
                <span class="spinner"></span>
              {:else}
                ✨
              {/if}
              Yes, Initialize Now
            </button>
            <button class="btn btn-secondary" on:click={() => showAutoInitDialog = false}>
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- MongoDB Status Card -->
    <div class="status-card">
      <div class="card-header">
        <h2>📊 MongoDB Status</h2>
        <button class="btn btn-sm btn-secondary" on:click={checkMongoDBStatus} disabled={isLoading}>
          {#if isLoading}
            <span class="spinner-sm"></span>
          {:else}
            🔄
          {/if}
          Refresh
        </button>
      </div>
      
      {#if mongoStatus}
        <div class="status-details">
          <div class="status-row">
            <span class="status-label">Connection:</span>
            <span class="status-value success">✅ Connected</span>
          </div>
          
          <div class="status-row">
            <span class="status-label">Database:</span>
            <span class="status-value">{mongoStatus.database}</span>
          </div>
          
          <div class="status-row">
            <span class="status-label">Server Version:</span>
            <span class="status-value">{mongoStatus.serverVersion}</span>
          </div>
          
          <div class="status-row">
            <span class="status-label">Presets Count:</span>
            <span class="status-value highlight">{mongoStatus.collections.presets}</span>
          </div>
          
          <div class="status-row">
            <span class="status-label">Faults Count:</span>
            <span class="status-value highlight">{mongoStatus.collections.faults}</span>
          </div>
          
          <div class="status-row">
            <span class="status-label">Total Collections:</span>
            <span class="status-value">{mongoStatus.stats.totalCollections}</span>
          </div>
          
          <div class="status-row">
            <span class="status-label">Data Size:</span>
            <span class="status-value">{(mongoStatus.stats.dataSize / 1024).toFixed(2)} KB</span>
          </div>
        </div>
      {:else if error}
        <div class="error-box">
          <span class="error-icon">❌</span>
          <div class="error-content">
            <strong>Connection Failed</strong>
            <p>{error}</p>
            <p class="error-hint">Make sure MONGODB_URI is configured in apphosting.yaml</p>
          </div>
        </div>
      {:else}
        <div class="loading-box">
          <span class="spinner"></span>
          <span>Checking MongoDB connection...</span>
        </div>
      {/if}
    </div>

    <!-- Success Message -->
    {#if successMessage}
      <div class="message-box success">
        <div class="message-content">
          {#each successMessage.split('\n') as line}
            <div>{line}</div>
          {/each}
        </div>
        <button class="close-btn" on:click={() => successMessage = ''}>×</button>
      </div>
    {/if}

    <!-- Error Message -->
    {#if error && !mongoStatus}
      <div class="message-box error">
        <div class="message-content">
          <strong>❌ Error:</strong> {error}
        </div>
        <button class="close-btn" on:click={() => error = ''}>×</button>
      </div>
    {/if}

    <!-- End of Status Tab -->
    {/if}
    
    {#if activeTab === 'reset'}
      <!-- Reset Systems Tab -->
      <div class="reset-warning-card">
        <div class="warning-icon">⚠️</div>
        <h2>Danger Zone</h2>
        <p>These actions should only be used for testing and development. Use caution in production environments.</p>
      </div>
      
      <!-- Quick Actions Banner -->
      {#if mongoStatus && (mongoStatus.collections.presets === 0 || mongoStatus.collections.faults === 0)}
        <div class="quick-action-banner">
          <div class="banner-icon-large">💡</div>
          <div class="banner-content-inline">
            <h3>Quick Start</h3>
            <p>Initialize your database with sample data to get started immediately!</p>
          </div>
          <button class="btn btn-primary btn-xl" on:click={() => initializeDatabase()} disabled={isLoading}>
            {#if isLoading}
              <span class="spinner"></span>
              Initializing...
            {:else}
              🚀 Initialize Database Now
            {/if}
          </button>
        </div>
      {/if}

      <!-- Initialization Actions -->
      <div class="actions-grid">
      <div class="action-card" class:highlight={mongoStatus && mongoStatus.collections.presets === 0 && mongoStatus.collections.faults === 0}>
        <div class="action-icon">🚀</div>
        <h3>Initialize All</h3>
        <p>Create all sample collections and data at once</p>
        <div class="action-details">
          <ul>
            <li>✅ 4 sample presets</li>
            <li>✅ 3 sample faults</li>
            <li>✅ Creates collections if needed</li>
            <li>✅ Safe (won't overwrite existing)</li>
          </ul>
        </div>
        <button class="btn btn-primary" on:click={initializeDatabase} disabled={isLoading || !env.PUBLIC_FIREBASE_FUNCTIONS_URL}>
          {#if isLoading}
            <span class="spinner-sm"></span>
            Initializing...
          {:else}
            🗄️ Initialize Database
          {/if}
        </button>
      </div>

      <div class="action-card">
        <div class="action-icon">⚙️</div>
        <h3>Initialize Presets</h3>
        <p>Create sample device provisioning presets</p>
        <div class="action-details">
          <ul>
            <li>Default Provisioning</li>
            <li>Nokia LTE Configuration</li>
            <li>Huawei 5G Configuration</li>
            <li>Firmware Upgrade Preset</li>
          </ul>
        </div>
        <button class="btn btn-secondary" on:click={initializePresets} disabled={isLoading || !env.PUBLIC_FIREBASE_FUNCTIONS_URL}>
          {#if isLoading}
            <span class="spinner-sm"></span>
          {:else}
            ⚙️
          {/if}
          Initialize Presets
        </button>
      </div>

      <div class="action-card">
        <div class="action-icon">⚠️</div>
        <h3>Initialize Faults</h3>
        <p>Create sample device faults for testing</p>
        <div class="action-details">
          <ul>
            <li>Connection Timeout (Critical)</li>
            <li>Firmware Update Failed (Warning)</li>
            <li>Config Mismatch (Info)</li>
          </ul>
        </div>
        <button class="btn btn-secondary" on:click={initializeFaults} disabled={isLoading || !env.PUBLIC_FIREBASE_FUNCTIONS_URL}>
          {#if isLoading}
            <span class="spinner-sm"></span>
          {:else}
            ⚠️
          {/if}
          Initialize Faults
        </button>
      </div>
    </div>

    <!-- Information Panel -->
    <div class="info-panel">
      <h3>📋 About Database Initialization</h3>
      <div class="info-content">
        <p><strong>What happens when you initialize:</strong></p>
        <ul>
          <li>MongoDB collections are created if they don't exist</li>
          <li>Sample data is inserted for testing and development</li>
          <li>Existing data is NOT overwritten</li>
          <li>Safe to run multiple times</li>
        </ul>
        
        <p><strong>After initialization, you can:</strong></p>
        <ul>
          <li>View and edit presets in the Presets page</li>
          <li>View and acknowledge faults in the Faults page</li>
          <li>Test all CRUD operations</li>
          <li>Verify MongoDB integration is working</li>
        </ul>
        
        <p><strong>MongoDB Configuration:</strong></p>
        <ul>
          <li>Connection string configured in apphosting.yaml</li>
          <li>Database: <code>{mongoStatus?.database || 'genieacs'}</code></li>
          <li>Collections: presets, faults, devices, tasks</li>
        </ul>
      </div>
    </div>
    {/if}
    <!-- End of Reset Tab -->
  </div>
</div>

<style>
  /* Tabs */
  .tabs-container {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    border-bottom: 2px solid var(--border-color);
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
    padding: 0 2rem;
  }
  
  .tab {
    padding: 1rem 2rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    color: var(--text-secondary);
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    bottom: -2px;
  }
  
  .tab:hover {
    color: var(--text-primary);
    background: var(--hover-bg);
  }
  
  .tab.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
    font-weight: 600;
  }
  
  .tab.tab-danger {
    color: var(--danger-color);
  }
  
  .tab.tab-danger.active {
    border-bottom-color: var(--danger-color);
  }
  
  /* Reset Warning Card */
  .reset-warning-card {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    padding: 2rem;
    border-radius: 0.75rem;
    margin-bottom: 2rem;
    text-align: center;
  }
  
  .warning-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  .reset-warning-card h2 {
    margin: 0 0 1rem 0;
    font-size: 1.75rem;
    color: white;
  }
  
  .reset-warning-card p {
    margin: 0;
    font-size: 1.125rem;
    opacity: 0.95;
  }
  
  .database-page {
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
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
  }

  .back-button:hover {
    color: var(--accent-color);
    background: var(--bg-tertiary);
    border-color: var(--accent-color);
  }

  .back-button svg {
    flex-shrink: 0;
  }

  .header-top {
    margin-bottom: 1rem;
  }

  .page-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
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

  .content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  /* Auto-Initialize Banner */
  .auto-init-banner {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 0.75rem;
    padding: 2rem;
    margin-bottom: 2rem;
    color: white;
    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
    animation: slideDown 0.5s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .banner-content {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .banner-icon {
    font-size: 4rem;
    flex-shrink: 0;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }

  .banner-text {
    flex: 1;
  }

  .banner-text h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .banner-text p {
    margin: 0.25rem 0;
    font-size: 1rem;
    opacity: 0.95;
  }

  .banner-hint {
    font-size: 0.875rem !important;
    opacity: 0.8 !important;
    font-style: italic;
  }

  .banner-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .btn-lg {
    padding: 1rem 2rem;
    font-size: 1.125rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .btn-xl {
    padding: 1.25rem 2.5rem;
    font-size: 1.25rem;
    font-weight: 700;
  }

  /* Quick Action Banner */
  .quick-action-banner {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    border-radius: 0.75rem;
    padding: 2rem;
    margin-bottom: 2rem;
    color: white;
    display: flex;
    align-items: center;
    gap: 2rem;
    box-shadow: 0 10px 30px rgba(240, 147, 251, 0.3);
  }

  .banner-icon-large {
    font-size: 5rem;
    flex-shrink: 0;
  }

  .banner-content-inline {
    flex: 1;
  }

  .banner-content-inline h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
    font-weight: 700;
  }

  .banner-content-inline p {
    margin: 0;
    font-size: 1.125rem;
    opacity: 0.95;
  }

  .quick-action-banner .btn {
    flex-shrink: 0;
  }

  .status-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .card-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .status-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .status-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 0.375rem;
  }

  .status-label {
    font-weight: 500;
    color: var(--text-secondary);
  }

  .status-value {
    font-family: monospace;
    color: var(--text-primary);
  }

  .status-value.success {
    color: #10b981;
    font-weight: 600;
  }

  .status-value.highlight {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--accent-color);
  }

  .error-box,
  .loading-box {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    border-radius: 0.5rem;
  }

  .error-box {
    background: #fee2e2;
    border: 1px solid #ef4444;
    color: #dc2626;
  }

  .error-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .error-content strong {
    display: block;
    margin-bottom: 0.5rem;
  }

  .error-hint {
    font-size: 0.875rem;
    margin-top: 0.5rem;
    font-style: italic;
  }

  .loading-box {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    justify-content: center;
  }

  .message-box {
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    margin-bottom: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .message-box.success {
    background: #dcfce7;
    border: 1px solid #10b981;
    color: #166534;
  }

  .message-box.error {
    background: #fee2e2;
    border: 1px solid #ef4444;
    color: #dc2626;
  }

  .message-content {
    flex: 1;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
  }

  .close-btn:hover {
    opacity: 1;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .action-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    transition: all 0.3s ease;
  }

  .action-card.highlight {
    border: 2px solid var(--accent-color);
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
    animation: glow 2s infinite;
  }

  @keyframes glow {
    0%, 100% {
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
    }
    50% {
      box-shadow: 0 4px 30px rgba(102, 126, 234, 0.4);
    }
  }

  .action-icon {
    font-size: 3rem;
    text-align: center;
  }

  .action-card h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    text-align: center;
  }

  .action-card p {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0;
  }

  .action-details {
    flex: 1;
  }

  .action-details ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .action-details li {
    padding: 0.375rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .info-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .info-panel h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .info-content {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .info-content p {
    margin: 0.5rem 0;
  }

  .info-content ul {
    margin: 0.5rem 0 1rem 1.5rem;
  }

  .info-content li {
    margin: 0.25rem 0;
  }

  .info-content code {
    background: var(--bg-tertiary);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.8125rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner,
  .spinner-sm {
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner {
    width: 16px;
    height: 16px;
  }

  .spinner-sm {
    width: 12px;
    height: 12px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .content {
      padding: 1rem;
    }

    .actions-grid {
      grid-template-columns: 1fr;
    }

    .auto-init-banner,
    .quick-action-banner {
      flex-direction: column;
      text-align: center;
    }

    .banner-content {
      flex-direction: column;
      text-align: center;
    }

    .banner-actions {
      width: 100%;
    }

    .banner-actions .btn {
      width: 100%;
    }

    .banner-content-inline {
      text-align: center;
    }
  }
</style>

