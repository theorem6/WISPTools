<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../components/MainMenu.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';

  interface FirmwareVersion {
    version: string;
    deviceCount: number;
    devices: Array<{
      id: string;
      manufacturer: string;
      model: string;
    }>;
  }

  let firmwareVersions: FirmwareVersion[] = [];
  let isLoading = false;
  let showUpgradeModal = false;
  let selectedDevices: string[] = [];
  let firmwareUrl = '';
  let scheduleAt = '';
  let error = '';
  let success = '';

  onMount(async () => {
    await loadFirmwareVersions();
  });

  async function loadFirmwareVersions() {
    if (!$currentTenant?.id) return;
    
    isLoading = true;
    error = '';
    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch('/api/tr069/firmware', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        firmwareVersions = data.firmwareVersions || [];
      } else {
        error = data.error || 'Failed to load firmware versions';
      }
    } catch (err: any) {
      console.error('Failed to load firmware versions:', err);
      error = err.message || 'Failed to load firmware versions';
    } finally {
      isLoading = false;
    }
  }

  function openUpgradeModal(version: FirmwareVersion) {
    selectedDevices = version.devices.map(d => d.id);
    showUpgradeModal = true;
  }

  async function scheduleUpgrade() {
    if (!firmwareUrl.trim()) {
      error = 'Firmware URL is required';
      return;
    }

    if (selectedDevices.length === 0) {
      error = 'No devices selected';
      return;
    }

    if (!$currentTenant?.id) {
      error = 'No tenant selected';
      return;
    }

    error = '';
    success = '';
    isLoading = true;

    try {
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch('/api/tr069/firmware/upgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceIds: selectedDevices,
          firmwareUrl: firmwareUrl.trim(),
          scheduleAt: scheduleAt || undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        success = `Firmware upgrade scheduled for ${data.results.success} device(s)`;
        showUpgradeModal = false;
        firmwareUrl = '';
        scheduleAt = '';
        selectedDevices = [];
        setTimeout(() => success = '', 5000);
      } else {
        error = data.error || 'Failed to schedule firmware upgrade';
      }
    } catch (err: any) {
      console.error('Failed to schedule firmware upgrade:', err);
      error = err.message || 'Failed to schedule firmware upgrade';
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Firmware Management - ACS CPE Management</title>
</svelte:head>

<div class="firmware-page">
  <MainMenu />
  
  <div class="page-header">
    <div class="header-content">
      <a href="/modules/acs-cpe-management" class="back-button">← Back to ACS Management</a>
      <h1>💾 Firmware Management</h1>
      <p>Track firmware versions and schedule upgrades</p>
    </div>
    <button class="btn btn-secondary" on:click={loadFirmwareVersions} disabled={isLoading}>
      {isLoading ? 'Loading...' : '🔄 Refresh'}
    </button>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if success}
    <div class="alert alert-success">{success}</div>
  {/if}

  {#if isLoading && firmwareVersions.length === 0}
    <div class="loading">Loading firmware versions...</div>
  {:else if firmwareVersions.length === 0}
    <div class="empty-state">
      <p>No firmware version data available. Devices will appear here once they connect.</p>
    </div>
  {:else}
    <div class="firmware-grid">
      {#each firmwareVersions as version}
        <div class="firmware-card">
          <div class="firmware-header">
            <h3>{version.version}</h3>
            <span class="device-count">{version.deviceCount} device(s)</span>
          </div>
          
          <div class="firmware-devices">
            {#each version.devices.slice(0, 5) as device}
              <div class="device-item">
                <span class="device-name">{device.manufacturer} {device.model}</span>
              </div>
            {/each}
            {#if version.devices.length > 5}
              <div class="device-more">... and {version.devices.length - 5} more</div>
            {/if}
          </div>

          <div class="firmware-actions">
            <button class="btn btn-primary" on:click={() => openUpgradeModal(version)}>
              Schedule Upgrade
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Upgrade Modal -->
{#if showUpgradeModal}
  <div class="modal-overlay" on:click={() => showUpgradeModal = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Schedule Firmware Upgrade</h2>
        <button class="close-btn" on:click={() => showUpgradeModal = false}>×</button>
      </div>
      
      <div class="modal-body">
        <p>Upgrading {selectedDevices.length} device(s)</p>
        
        <div class="form-group">
          <label>Firmware URL *</label>
          <input 
            type="url" 
            bind:value={firmwareUrl} 
            placeholder="https://example.com/firmware/firmware.bin"
            disabled={isLoading}
          />
          <small>URL to firmware file (must be accessible by devices)</small>
        </div>

        <div class="form-group">
          <label>Schedule At (Optional)</label>
          <input 
            type="datetime-local" 
            bind:value={scheduleAt}
            disabled={isLoading}
          />
          <small>Leave empty to upgrade immediately</small>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => showUpgradeModal = false} disabled={isLoading}>
          Cancel
        </button>
        <button class="btn btn-primary" on:click={scheduleUpgrade} disabled={isLoading || !firmwareUrl.trim()}>
          {isLoading ? 'Scheduling...' : 'Schedule Upgrade'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .firmware-page {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 2rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  .back-button {
    color: var(--brand-primary);
    text-decoration: none;
    margin-bottom: 0.5rem;
    display: inline-block;
  }

  .firmware-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .firmware-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .firmware-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .firmware-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-family: monospace;
  }

  .device-count {
    background: var(--bg-secondary);
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .firmware-devices {
    margin-bottom: 1rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .device-item {
    padding: 0.5rem;
    font-size: 0.875rem;
    border-bottom: 1px solid var(--border-color);
  }

  .device-more {
    padding: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  .firmware-actions {
    display: flex;
    justify-content: flex-end;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: 0.5rem;
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
  }

  .form-group small {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .alert-success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }
</style>
