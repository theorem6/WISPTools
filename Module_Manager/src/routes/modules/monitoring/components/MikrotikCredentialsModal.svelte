<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { apiService } from '$lib/services/apiService';
  
  const dispatch = createEventDispatcher();
  
  export let device: any = null;
  export let open = false;
  
  let username = '';
  let password = '';
  let port = 8728;
  let useSSL = false;
  let loading = false;
  let error = '';
  let success = '';
  
  $: if (open && device) {
    loadCredentials();
  }
  
  async function loadCredentials() {
    if (!device?.id) return;
    
    try {
      loading = true;
      error = '';
      
      const response = await apiService.get(`/api/mikrotik/devices/${device.id}/credentials`);
      
      if (response.success && response.data?.credentials) {
        const creds = response.data.credentials;
        username = creds.username || 'admin';
        password = creds.password || '';
        port = creds.port || 8728;
        useSSL = creds.useSSL || false;
      } else {
        // Default values if not configured
        username = 'admin';
        password = '';
        port = 8728;
        useSSL = false;
      }
    } catch (e) {
      console.error('Failed to load credentials:', e);
      error = 'Failed to load current credentials';
    } finally {
      loading = false;
    }
  }
  
  async function saveCredentials() {
    if (!device?.id) return;
    
    if (!username.trim()) {
      error = 'Username is required';
      return;
    }
    
    try {
      loading = true;
      error = '';
      success = '';
      
      const response = await apiService.put(`/api/mikrotik/devices/${device.id}/credentials`, {
        username: username.trim(),
        password: password,
        port: port,
        useSSL: useSSL
      });
      
      if (response.success) {
        success = 'Credentials saved successfully';
        setTimeout(() => {
          dispatch('saved', { deviceId: device.id });
          close();
        }, 1500);
      } else {
        error = response.error || 'Failed to save credentials';
      }
    } catch (e: any) {
      console.error('Failed to save credentials:', e);
      error = e.message || 'Failed to save credentials';
    } finally {
      loading = false;
    }
  }
  
  function close() {
    open = false;
    username = '';
    password = '';
    port = 8728;
    useSSL = false;
    error = '';
    success = '';
    dispatch('close');
  }
  
  function testConnection() {
    // TODO: Implement connection test
    alert('Connection test feature coming soon');
  }
</script>

{#if open && device}
<div class="modal-overlay" on:click={close} on:keydown={(e) => e.key === 'Escape' && close()}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>🔐 Mikrotik Device Credentials</h2>
      <button class="close-button" on:click={close}>×</button>
    </div>
    
    <div class="modal-body">
      <div class="device-info">
        <h3>{device.name || device.ipAddress || 'Unknown Device'}</h3>
        <p class="device-details">
          <span>IP: {device.ipAddress || 'Unknown'}</span>
          {#if device.model}
            <span>Model: {device.model}</span>
          {/if}
        </p>
      </div>
      
      {#if error}
        <div class="alert alert-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      {/if}
      
      {#if success}
        <div class="alert alert-success">
          <span>✅</span>
          <span>{success}</span>
        </div>
      {/if}
      
      <form on:submit|preventDefault={saveCredentials}>
        <div class="form-group">
          <label for="username">Username *</label>
          <input
            id="username"
            type="text"
            bind:value={username}
            placeholder="admin"
            required
            disabled={loading}
          />
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            placeholder="Leave blank to keep current password"
            disabled={loading}
          />
        </div>
        
        <div class="form-group">
          <label for="port">RouterOS API Port</label>
          <input
            id="port"
            type="number"
            bind:value={port}
            min="1"
            max="65535"
            disabled={loading}
          />
          <small>Default: 8728 (non-SSL) or 8729 (SSL)</small>
        </div>
        
        <div class="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              bind:checked={useSSL}
              disabled={loading}
            />
            Use SSL (RouterOS API SSL port 8729)
          </label>
        </div>
        
        <div class="form-actions">
          <button
            type="button"
            class="btn btn-secondary"
            on:click={testConnection}
            disabled={loading}
          >
            🔌 Test Connection
          </button>
          <div class="action-buttons">
            <button
              type="button"
              class="btn btn-secondary"
              on:click={close}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={loading || !username.trim()}
            >
              {loading ? '💾 Saving...' : '💾 Save Credentials'}
            </button>
          </div>
        </div>
      </form>
      
      <div class="info-box">
        <p><strong>Note:</strong> Credentials are used by the SNMP monitoring agent to connect to this Mikrotik device via RouterOS API.</p>
        <p>After saving, the agent will automatically use these credentials on the next network scan.</p>
      </div>
    </div>
  </div>
</div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
  }
  
  .modal-content {
    background: var(--bg-primary, #ffffff);
    border-radius: 12px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary, #000000);
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: var(--text-secondary, #666);
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .close-button:hover {
    background: var(--bg-hover, #f5f5f5);
    color: var(--text-primary, #000);
  }
  
  .modal-body {
    padding: 1.5rem;
  }
  
  .device-info {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }
  
  .device-info h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: var(--text-primary, #000);
  }
  
  .device-details {
    display: flex;
    gap: 1rem;
    margin: 0;
    color: var(--text-secondary, #666);
    font-size: 0.875rem;
  }
  
  .alert {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    align-items: center;
  }
  
  .alert-error {
    background: #fee;
    color: #c33;
    border: 1px solid #fcc;
  }
  
  .alert-success {
    background: #efe;
    color: #3c3;
    border: 1px solid #cfc;
  }
  
  .form-group {
    margin-bottom: 1.25rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--text-primary, #000);
  }
  
  .form-group input[type="text"],
  .form-group input[type="password"],
  .form-group input[type="number"] {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--brand-primary, #007bff);
  }
  
  .form-group input:disabled {
    background: var(--bg-secondary, #f5f5f5);
    cursor: not-allowed;
  }
  
  .form-group small {
    display: block;
    margin-top: 0.25rem;
    color: var(--text-secondary, #666);
    font-size: 0.875rem;
  }
  
  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }
  
  .checkbox-group input[type="checkbox"] {
    width: auto;
    cursor: pointer;
  }
  
  .form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color, #e0e0e0);
  }
  
  .action-buttons {
    display: flex;
    gap: 0.75rem;
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-primary {
    background: var(--brand-primary, #007bff);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--brand-primary-hover, #0056b3);
  }
  
  .btn-secondary {
    background: var(--bg-secondary, #f5f5f5);
    color: var(--text-primary, #000);
    border: 1px solid var(--border-color, #ddd);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-hover, #e9e9e9);
  }
  
  .info-box {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--bg-secondary, #f9f9f9);
    border-radius: 6px;
    border-left: 3px solid var(--brand-primary, #007bff);
  }
  
  .info-box p {
    margin: 0.5rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary, #666);
    line-height: 1.5;
  }
  
  .info-box p:first-child {
    margin-top: 0;
  }
  
  .info-box p:last-child {
    margin-bottom: 0;
  }
</style>

