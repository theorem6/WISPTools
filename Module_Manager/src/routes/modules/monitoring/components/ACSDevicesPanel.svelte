<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/firebase';
  import { authService } from '$lib/services/authService';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { goto } from '$app/navigation';
  import CPEPerformanceModal from '../../acs-cpe-management/components/CPEPerformanceModal.svelte';
  import TR069Actions from '../../acs-cpe-management/components/TR069Actions.svelte';
  
  export let tenantId: string = '';
  export let devices: any[] = [];
  export let onRefresh: (() => void) | null = null;
  
  let selectedDevice: any = null;
  let showPerformanceModal = false;
  let showActionsModal = false;
  let loading = false;
  let error: string | null = null;
  let selectedDevices = new Set<string>();
  let isBulkActionInProgress = false;
  let bulkActionMessage = '';
  let showPresetSelectModal = false;
  let availablePresets: any[] = [];
  let isLoadingPresets = false;
  
  $: if ($currentTenant?.id) {
    tenantId = $currentTenant.id;
    if (tenantId) {
      loadPresets();
    }
  }

  async function loadPresets() {
    if (!$currentTenant?.id) return;
    
    isLoadingPresets = true;
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch('/api/tr069/presets', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        availablePresets = data.presets || [];
      }
    } catch (err) {
      console.error('Failed to load presets:', err);
    } finally {
      isLoadingPresets = false;
    }
  }

  function toggleDeviceSelection(deviceId: string) {
    if (selectedDevices.has(deviceId)) {
      selectedDevices.delete(deviceId);
    } else {
      selectedDevices.add(deviceId);
    }
    selectedDevices = selectedDevices; // Trigger reactivity
  }

  function openPresetSelectModal() {
    if (selectedDevices.size === 0) {
      bulkActionMessage = '⚠️ Please select at least one device';
      setTimeout(() => bulkActionMessage = '', 3000);
      return;
    }
    showPresetSelectModal = true;
  }

  async function applySelectedPreset(presetId: string) {
    showPresetSelectModal = false;
    await executeBulkAction('applyPreset', presetId);
  }

  async function executeBulkAction(action: 'refreshParameters' | 'reboot' | 'applyPreset', presetId?: string) {
    if (selectedDevices.size === 0) {
      bulkActionMessage = '⚠️ Please select at least one device';
      return;
    }

    if (!$currentTenant?.id) {
      bulkActionMessage = '❌ No tenant selected';
      return;
    }

    isBulkActionInProgress = true;
    bulkActionMessage = '';

    try {
      const user = auth().currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch('/api/tr069/bulk-tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceIds: Array.from(selectedDevices),
          action,
          ...(presetId ? { presetId } : {})
        })
      });

      const data = await response.json();
      if (data.success) {
        bulkActionMessage = `✅ ${data.results.success} device(s) processed successfully`;
        if (data.results.failed > 0) {
          bulkActionMessage += `, ${data.results.failed} failed`;
        }
        selectedDevices.clear();
        selectedDevices = selectedDevices; // Trigger reactivity
        if (onRefresh) {
          setTimeout(() => onRefresh(), 1000);
        }
      } else {
        bulkActionMessage = `❌ ${data.error || 'Bulk action failed'}`;
      }
    } catch (err: any) {
      console.error('Bulk action failed:', err);
      bulkActionMessage = `❌ ${err.message || 'Bulk action failed'}`;
    } finally {
      isBulkActionInProgress = false;
      setTimeout(() => bulkActionMessage = '', 5000);
    }
  }
  
  function handleDeviceClick(device: any) {
    selectedDevice = device;
    showPerformanceModal = true;
  }
  
  function handleActionsClick(device: any, event: MouseEvent) {
    event.stopPropagation();
    selectedDevice = device;
    showActionsModal = true;
  }
  
  function handleClosePerformance() {
    showPerformanceModal = false;
    selectedDevice = null;
  }
  
  function handleCloseActions() {
    showActionsModal = false;
    selectedDevice = null;
  }
  
  async function syncDevices() {
    if (!tenantId) return;
    
    loading = true;
    error = null;
    
    try {
      const user = auth().currentUser;
      if (!user) {
        error = 'Not authenticated';
        return;
      }
      
      const token = await authService.getAuthTokenForApi();
      
      const response = await fetch('/api/tr069/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Refresh devices
          if (onRefresh) {
            onRefresh();
          }
        } else {
          error = data.error || 'Sync failed';
        }
      } else {
        error = `Sync failed: ${response.status}`;
      }
    } catch (err: any) {
      console.error('[ACS Devices] Error syncing devices:', err);
      error = err.message || 'Failed to sync devices';
    } finally {
      loading = false;
    }
  }
  
  function getStatusColor(status: string) {
    if (status === 'Online' || status === 'online') return '#10b981';
    if (status === 'Offline' || status === 'offline') return '#ef4444';
    return '#6b7280';
  }
  
  function formatLastContact(lastContact: any) {
    if (!lastContact) return 'Never';
    const date = new Date(lastContact);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
</script>

<div class="acs-devices-panel">
  <div class="panel-header">
    <h2>📡 ACS/TR-069 CPE Devices</h2>
    <div class="panel-actions">
      <a href="/modules/acs-cpe-management/presets" class="btn btn-link" title="Manage Presets">
        ⚙️ Presets
      </a>
      <a href="/modules/acs-cpe-management/devices" class="btn btn-link" title="Full ACS Management">
        📱 Full Management
      </a>
      <button class="btn btn-secondary" on:click={syncDevices} disabled={loading}>
        {loading ? 'Syncing...' : '🔄 Sync'}
      </button>
      {#if onRefresh}
        <button class="btn btn-secondary" on:click={onRefresh}>
          ↻ Refresh
        </button>
      {/if}
    </div>
  </div>

  {#if selectedDevices.size > 0}
    <div class="bulk-actions-bar">
      <div class="bulk-info">
        <span class="bulk-count">{selectedDevices.size}</span>
        <span>device(s) selected</span>
      </div>
      <div class="bulk-buttons">
        <button 
          class="btn btn-primary btn-sm" 
          on:click={() => executeBulkAction('refreshParameters')}
          disabled={isBulkActionInProgress}
        >
          {isBulkActionInProgress ? 'Processing...' : '🔄 Refresh'}
        </button>
        <button 
          class="btn btn-warning btn-sm" 
          on:click={() => executeBulkAction('reboot')}
          disabled={isBulkActionInProgress}
        >
          {isBulkActionInProgress ? 'Processing...' : '⚡ Reboot'}
        </button>
        <button 
          class="btn btn-primary btn-sm" 
          on:click={openPresetSelectModal}
          disabled={isBulkActionInProgress || isLoadingPresets}
        >
          {isLoadingPresets ? 'Loading...' : '⚙️ Apply Preset'}
        </button>
        <button 
          class="btn btn-secondary btn-sm" 
          on:click={() => { selectedDevices.clear(); selectedDevices = selectedDevices; }}
          disabled={isBulkActionInProgress}
        >
          Clear
        </button>
      </div>
      {#if bulkActionMessage}
        <div class="bulk-message {bulkActionMessage.includes('✅') ? 'success' : bulkActionMessage.includes('⚠️') ? 'warning' : 'error'}">
          {bulkActionMessage}
        </div>
      {/if}
    </div>
  {/if}
  
  {#if error}
    <div class="error-state">
      <p>⚠️ {error}</p>
    </div>
  {/if}
  
  {#if devices.length === 0}
    <div class="empty-state">
      <p>📡 No TR-069 devices found</p>
      <p class="hint">TR-069 CPE devices managed by GenieACS will appear here</p>
      <button class="btn btn-primary" on:click={syncDevices} disabled={loading}>
        {loading ? 'Syncing...' : '🔄 Sync from GenieACS'}
      </button>
    </div>
  {:else}
    <div class="devices-list">
      {#each devices as device (device._id || device.id)}
        <div 
          class="device-card {selectedDevice?.id === device.id ? 'selected' : ''} {selectedDevices.has(device._id || device.id) ? 'bulk-selected' : ''}"
          on:click={() => handleDeviceClick(device)}
        >
          <div class="device-header">
            <input 
              type="checkbox" 
              class="device-checkbox"
              checked={selectedDevices.has(device._id || device.id)}
              on:click|stopPropagation={(e) => {
                e.stopPropagation();
                toggleDeviceSelection(device._id || device.id);
              }}
            />
            <div class="device-status" style="background-color: {getStatusColor(device.status)}"></div>
            <div class="device-info">
              <h4>{device.manufacturer || 'Unknown'} {device.model || ''}</h4>
              <p class="device-id">{device._id || device.id}</p>
            </div>
          </div>
          
          <div class="device-details">
            {#if device.serialNumber}
              <div class="detail-item">
                <span class="label">Serial Number</span>
                <span class="value">{device.serialNumber}</span>
              </div>
            {/if}
            {#if device.ipAddress}
              <div class="detail-item">
                <span class="label">IP Address</span>
                <span class="value">{device.ipAddress}</span>
              </div>
            {/if}
            {#if device.firmware}
              <div class="detail-item">
                <span class="label">Firmware</span>
                <span class="value">{device.firmware}</span>
              </div>
            {/if}
            <div class="detail-item">
              <span class="label">Last Contact</span>
              <span class="value">{formatLastContact(device.lastContact || device._lastInform)}</span>
            </div>
          </div>
          
          {#if device.location && device.location.latitude && device.location.longitude}
            <div class="device-location">
              <span>📍</span>
              <span>{device.location.latitude.toFixed(4)}, {device.location.longitude.toFixed(4)}</span>
            </div>
          {/if}
          
          <div class="device-actions">
            <button 
              class="btn btn-primary"
              on:click={(e) => {
                e.stopPropagation();
                handleDeviceClick(device);
              }}
            >
              View Details
            </button>
            <button 
              class="btn btn-secondary"
              on:click={(e) => handleActionsClick(device, e)}
              title="TR-069 Actions"
            >
              Actions
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showPerformanceModal && selectedDevice}
  <CPEPerformanceModal 
    device={selectedDevice}
    show={showPerformanceModal}
    on:close={handleClosePerformance}
  />
{/if}

{#if showActionsModal && selectedDevice}
  <TR069Actions 
    device={selectedDevice}
    show={showActionsModal}
    on:close={handleCloseActions}
  />
{/if}

<!-- Preset Selection Modal -->
{#if showPresetSelectModal}
  <div class="modal-overlay" on:click={() => showPresetSelectModal = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Apply Preset to {selectedDevices.size} Device(s)</h2>
        <button class="close-btn" on:click={() => showPresetSelectModal = false}>×</button>
      </div>
      
      <div class="modal-body">
        {#if isLoadingPresets}
          <div class="loading">Loading presets...</div>
        {:else if availablePresets.length === 0}
          <div class="empty-state">
            <p>No presets available. Create a preset first.</p>
            <a href="/modules/acs-cpe-management/presets" class="btn btn-primary">Go to Presets</a>
          </div>
        {:else}
          <p>Select a preset to apply to {selectedDevices.size} selected device(s):</p>
          <div class="preset-list">
            {#each availablePresets.filter(p => p.enabled) as preset}
              <div class="preset-item" on:click={() => applySelectedPreset(preset._id)}>
                <div class="preset-name">{preset.name}</div>
                <div class="preset-description">{preset.description || 'No description'}</div>
                <div class="preset-meta">
                  <span>{preset.configurations?.length || 0} configurations</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => showPresetSelectModal = false}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .acs-devices-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 1rem;
    overflow: hidden;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .panel-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .panel-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-primary {
    background: var(--color-primary);
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  .btn-link {
    background: transparent;
    color: var(--color-primary);
    text-decoration: none;
    padding: 0.5rem 0.75rem;
  }

  .btn-link:hover {
    text-decoration: underline;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  }

  .btn-warning {
    background: #f59e0b;
    color: white;
  }

  .btn-warning:hover:not(:disabled) {
    background: #d97706;
  }

  .bulk-actions-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 8px;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .bulk-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }

  .bulk-count {
    background: var(--color-primary);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .bulk-buttons {
    display: flex;
    gap: 0.5rem;
    flex: 1;
  }

  .bulk-message {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.875rem;
    margin-left: auto;
  }

  .bulk-message.success {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .bulk-message.warning {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .bulk-message.error {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .device-checkbox {
    margin-right: 0.5rem;
    cursor: pointer;
  }

  .device-card.bulk-selected {
    border-color: var(--color-primary);
    background: rgba(var(--color-primary-rgb), 0.05);
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
    background: var(--bg-primary);
    border-radius: 8px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow: hidden;
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

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    line-height: 1;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .preset-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .preset-item {
    padding: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-item:hover {
    background: var(--bg-secondary);
    border-color: var(--color-primary);
  }

  .preset-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .preset-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .preset-meta {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .btn-icon {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background 0.2s;
  }
  
  .btn-icon:hover {
    background: var(--bg-hover);
  }
  
  .error-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
  }
  
  .empty-state .hint {
    font-size: 0.875rem;
    margin-top: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .devices-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    overflow-y: auto;
    flex: 1;
    padding: 0.5rem 0;
  }
  
  .device-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .device-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
  
  .device-card.selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.2), 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .device-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .device-status {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 0.25rem;
  }
  
  .device-info {
    flex: 1;
    min-width: 0;
  }
  
  .device-info h4 {
    margin: 0 0 0.25rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.3;
  }
  
  .device-id {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: monospace;
    word-break: break-all;
  }
  
  .device-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-size: 0.875rem;
    margin-bottom: 1rem;
    flex: 1;
  }
  
  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .detail-item .label {
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .detail-item .value {
    color: var(--text-primary);
    font-family: monospace;
    font-size: 0.875rem;
    word-break: break-all;
  }
  
  .device-location {
    margin-top: auto;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.75rem;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .device-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color);
  }
  
  .device-actions .btn {
    flex: 1;
    padding: 0.5rem;
    font-size: 0.875rem;
  }
</style>
