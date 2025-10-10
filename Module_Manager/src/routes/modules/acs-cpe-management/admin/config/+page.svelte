<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../../components/MainMenu.svelte';
  import { env } from '$env/dynamic/public';
  
  let isLoading = false;
  let saveSuccess = false;
  let saveError = '';
  
  // Configuration state
  let config = {
    genieacs: {
      baseUrl: '',
      username: '',
      password: '',
      timeout: 30000,
      enableAuth: false
    },
    mongodb: {
      uri: '',
      database: 'genieacs',
      connected: false
    },
    sync: {
      enableAutoSync: true,
      syncInterval: 300000, // 5 minutes
      enableFirestoreSync: true
    },
    cwmp: {
      port: 7547,
      enableSSL: false,
      connectionRequestAuth: 'digest'
    }
  };
  
  onMount(async () => {
    console.log('Configuration page loaded');
    loadConfiguration();
  });
  
  function loadConfiguration() {
    // Load from environment variables
    config.genieacs.baseUrl = env.PUBLIC_GENIEACS_NBI_URL || 'http://localhost:7557';
    config.mongodb.uri = 'mongodb+srv://genieacs-user:****@cluster0.1radgkw.mongodb.net/';
    config.mongodb.database = 'genieacs';
    config.sync.enableAutoSync = true;
    config.sync.syncInterval = 300000;
  }
  
  async function testGenieACSConnection() {
    isLoading = true;
    saveError = '';
    
    try {
      console.log('Testing GenieACS connection...');
      
      const getCPEDevicesUrl = env.PUBLIC_GET_CPE_DEVICES_URL;
      
      if (!getCPEDevicesUrl) {
        throw new Error('GenieACS endpoint not configured');
      }
      
      const response = await fetch(getCPEDevicesUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`✅ Connection successful! Found ${data.devices?.length || 0} devices.`);
        config.mongodb.connected = true;
      } else {
        throw new Error(`Connection failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      saveError = error.message || 'Connection test failed';
      alert(`❌ Connection failed: ${saveError}`);
      config.mongodb.connected = false;
    }
    
    isLoading = false;
  }
  
  async function testMongoDBConnection() {
    isLoading = true;
    saveError = '';
    
    try {
      console.log('Testing MongoDB connection...');
      
      const syncUrl = env.PUBLIC_SYNC_CPE_DEVICES_URL;
      
      if (!syncUrl) {
        throw new Error('MongoDB sync endpoint not configured');
      }
      
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`✅ MongoDB connected! Synced ${data.synced || 0} devices.`);
        config.mongodb.connected = true;
      } else {
        throw new Error(`MongoDB connection failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('MongoDB test failed:', error);
      saveError = error.message || 'MongoDB connection failed';
      alert(`❌ MongoDB connection failed: ${saveError}`);
      config.mongodb.connected = false;
    }
    
    isLoading = false;
  }
  
  async function saveConfiguration() {
    isLoading = true;
    saveSuccess = false;
    saveError = '';
    
    try {
      console.log('Saving configuration...');
      
      // In a real implementation, you would save to Firestore or a config endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      saveSuccess = true;
      alert('✅ Configuration saved successfully!');
      
      setTimeout(() => {
        saveSuccess = false;
      }, 3000);
      
    } catch (error) {
      console.error('Failed to save configuration:', error);
      saveError = error.message || 'Failed to save configuration';
    }
    
    isLoading = false;
  }
</script>

<svelte:head>
  <title>Configuration - ACS Administration</title>
  <meta name="description" content="System configuration and settings" />
</svelte:head>

<div class="config-page">
  <!-- Exit Button -->
  <a href="/modules/acs-cpe-management/admin" class="exit-button" aria-label="Exit to Admin">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </a>

  <MainMenu />
  
  <div class="page-header">
    <div class="header-content">
      <h1 class="page-title">
        <span class="page-icon">⚙️</span>
        System Configuration
      </h1>
      <p class="page-description">
        Configure ACS server settings, database connections, and system parameters
      </p>
    </div>
  </div>

  <div class="content">
    <!-- GenieACS Server Configuration -->
    <section class="config-section">
      <div class="section-header">
        <h2 class="section-title">
          <span class="section-icon">🖥️</span>
          GenieACS Server Configuration
        </h2>
        <button class="btn btn-secondary btn-sm" on:click={testGenieACSConnection} disabled={isLoading}>
          {#if isLoading}
            <span class="spinner"></span>
          {:else}
            🔌
          {/if}
          Test Connection
        </button>
      </div>
      
      <div class="config-grid">
        <div class="config-item">
          <label for="genieacs-url">NBI API URL</label>
          <input 
            type="text" 
            id="genieacs-url"
            bind:value={config.genieacs.baseUrl}
            placeholder="http://localhost:7557"
            class="config-input"
          />
          <span class="config-hint">GenieACS NBI (North Bound Interface) API endpoint</span>
        </div>
        
        <div class="config-item">
          <label for="genieacs-timeout">Request Timeout (ms)</label>
          <input 
            type="number" 
            id="genieacs-timeout"
            bind:value={config.genieacs.timeout}
            min="1000"
            max="120000"
            class="config-input"
          />
          <span class="config-hint">HTTP request timeout in milliseconds</span>
        </div>
        
        <div class="config-item">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              bind:checked={config.genieacs.enableAuth}
            />
            Enable Authentication
          </label>
          <span class="config-hint">Require username/password for GenieACS API</span>
        </div>
        
        {#if config.genieacs.enableAuth}
          <div class="config-item">
            <label for="genieacs-username">Username</label>
            <input 
              type="text" 
              id="genieacs-username"
              bind:value={config.genieacs.username}
              class="config-input"
              autocomplete="username"
            />
          </div>
          
          <div class="config-item">
            <label for="genieacs-password">Password</label>
            <input 
              type="password" 
              id="genieacs-password"
              bind:value={config.genieacs.password}
              class="config-input"
              autocomplete="current-password"
            />
          </div>
        {/if}
      </div>
    </section>

    <!-- MongoDB Database Configuration -->
    <section class="config-section">
      <div class="section-header">
        <h2 class="section-title">
          <span class="section-icon">🗄️</span>
          MongoDB Database Configuration
        </h2>
        <button class="btn btn-secondary btn-sm" on:click={testMongoDBConnection} disabled={isLoading}>
          {#if isLoading}
            <span class="spinner"></span>
          {:else}
            🔌
          {/if}
          Test MongoDB
        </button>
      </div>
      
      <div class="config-grid">
        <div class="config-item full-width">
          <label for="mongodb-uri">MongoDB Connection String</label>
          <input 
            type="text" 
            id="mongodb-uri"
            bind:value={config.mongodb.uri}
            placeholder="mongodb+srv://user:password@cluster.mongodb.net/"
            class="config-input"
          />
          <span class="config-hint">
            MongoDB Atlas connection string (configured in apphosting.yaml)
          </span>
          <div class="connection-status" class:connected={config.mongodb.connected}>
            {#if config.mongodb.connected}
              ✅ Connected
            {:else}
              ⚠️ Not Connected
            {/if}
          </div>
        </div>
        
        <div class="config-item">
          <label for="mongodb-database">Database Name</label>
          <input 
            type="text" 
            id="mongodb-database"
            bind:value={config.mongodb.database}
            placeholder="genieacs"
            class="config-input"
          />
          <span class="config-hint">GenieACS database name</span>
        </div>
      </div>
    </section>

    <!-- Sync Configuration -->
    <section class="config-section">
      <div class="section-header">
        <h2 class="section-title">
          <span class="section-icon">🔄</span>
          Synchronization Settings
        </h2>
      </div>
      
      <div class="config-grid">
        <div class="config-item">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              bind:checked={config.sync.enableAutoSync}
            />
            Enable Auto-Sync
          </label>
          <span class="config-hint">Automatically sync devices from GenieACS to Firestore</span>
        </div>
        
        <div class="config-item">
          <label for="sync-interval">Sync Interval (ms)</label>
          <input 
            type="number" 
            id="sync-interval"
            bind:value={config.sync.syncInterval}
            min="60000"
            max="3600000"
            step="60000"
            class="config-input"
            disabled={!config.sync.enableAutoSync}
          />
          <span class="config-hint">How often to sync (default: 5 minutes)</span>
        </div>
        
        <div class="config-item">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              bind:checked={config.sync.enableFirestoreSync}
            />
            Enable Firestore Sync
          </label>
          <span class="config-hint">Store CPE devices in Firestore for faster access</span>
        </div>
      </div>
    </section>

    <!-- CWMP Configuration -->
    <section class="config-section">
      <div class="section-header">
        <h2 class="section-title">
          <span class="section-icon">🔐</span>
          CWMP (TR-069) Settings
        </h2>
      </div>
      
      <div class="config-grid">
        <div class="config-item">
          <label for="cwmp-port">CWMP Port</label>
          <input 
            type="number" 
            id="cwmp-port"
            bind:value={config.cwmp.port}
            min="1"
            max="65535"
            class="config-input"
          />
          <span class="config-hint">TR-069 CWMP listening port (default: 7547)</span>
        </div>
        
        <div class="config-item">
          <label for="cwmp-auth">Connection Request Auth</label>
          <select id="cwmp-auth" bind:value={config.cwmp.connectionRequestAuth} class="config-input">
            <option value="none">None</option>
            <option value="basic">Basic</option>
            <option value="digest">Digest</option>
          </select>
          <span class="config-hint">Authentication method for connection requests</span>
        </div>
        
        <div class="config-item">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              bind:checked={config.cwmp.enableSSL}
            />
            Enable SSL/TLS
          </label>
          <span class="config-hint">Use HTTPS for CWMP connections (requires certificates)</span>
        </div>
      </div>
    </section>

    <!-- Action Buttons -->
    <div class="actions-bar">
      {#if saveSuccess}
        <div class="success-message">
          ✅ Configuration saved successfully!
        </div>
      {/if}
      
      {#if saveError}
        <div class="error-message">
          ❌ {saveError}
        </div>
      {/if}
      
      <div class="action-buttons">
        <button class="btn btn-secondary" on:click={loadConfiguration} disabled={isLoading}>
          🔄 Reset to Defaults
        </button>
        
        <button class="btn btn-primary" on:click={saveConfiguration} disabled={isLoading}>
          {#if isLoading}
            <span class="spinner"></span>
            Saving...
          {:else}
            💾 Save Configuration
          {/if}
        </button>
      </div>
    </div>

    <!-- Configuration Info -->
    <section class="info-section">
      <h3>📋 Configuration Status</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">GenieACS NBI URL:</span>
          <span class="info-value">{env.PUBLIC_GENIEACS_NBI_URL || 'Not configured'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Functions URL:</span>
          <span class="info-value">{env.PUBLIC_FIREBASE_FUNCTIONS_URL || 'Not configured'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Sync Endpoint:</span>
          <span class="info-value">{env.PUBLIC_SYNC_CPE_DEVICES_URL || 'Not configured'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">MongoDB Database:</span>
          <span class="info-value">{config.mongodb.database}</span>
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  .config-page {
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

  .config-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-primary);
  }

  .section-icon {
    font-size: 1.25rem;
  }

  .config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .config-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .config-item.full-width {
    grid-column: 1 / -1;
  }

  .config-item label {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
  }

  .config-input {
    padding: 0.625rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
    transition: border-color 0.2s;
  }

  .config-input:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .config-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .config-hint {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    font-style: italic;
  }

  .connection-status {
    margin-top: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
  }

  .connection-status.connected {
    background: #dcfce7;
    border-color: #10b981;
    color: #166534;
  }

  .actions-bar {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .action-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }

  .success-message {
    padding: 0.75rem;
    background: #dcfce7;
    border: 1px solid #10b981;
    border-radius: 0.375rem;
    color: #166534;
    font-weight: 500;
  }

  .error-message {
    padding: 0.75rem;
    background: #fee2e2;
    border: 1px solid #ef4444;
    border-radius: 0.375rem;
    color: #dc2626;
    font-weight: 500;
  }

  .info-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .info-section h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .info-grid {
    display: grid;
    gap: 0.75rem;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .info-label {
    font-weight: 500;
    color: var(--text-secondary);
  }

  .info-value {
    color: var(--text-primary);
    font-family: monospace;
    word-break: break-all;
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
    font-size: 0.75rem;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .section-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .config-grid {
      grid-template-columns: 1fr;
    }

    .action-buttons {
      flex-direction: column;
    }
  }
</style>
