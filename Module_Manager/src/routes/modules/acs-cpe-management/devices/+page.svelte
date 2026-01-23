<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../components/MainMenu.svelte';
  import CPEDeviceRow from '../components/CPEDeviceRow.svelte';
  import TR069Actions from '../components/TR069Actions.svelte';
  import ParameterEditorModal from '../components/ParameterEditorModal.svelte';
  import { loadCPEDevices, type CPEDevice } from '../lib/cpeDataService';
  import { currentTenant } from '$lib/stores/tenantStore';

  let devices: CPEDevice[] = [];
  let isLoading = false;
  let searchTerm = '';
  let statusFilter = 'all';
  let expandedDeviceId: string | null = null;
  let actionDevice: CPEDevice | null = null;
  let showActionsModal = false;
  let showParameterEditor = false;
  let editDevice: CPEDevice | null = null;
  let selectedDevices = new Set<string>();
  let isBulkActionInProgress = false;
  let bulkActionMessage = '';
  let showPresetSelectModal = false;
  let availablePresets: any[] = [];
  let isLoadingPresets = false;

  onMount(async () => {
    await loadDevices();
    await loadPresets();
  });

  async function loadPresets() {
    if (!$currentTenant?.id) return;
    
    isLoadingPresets = true;
    try {
      const { authService } = await import('$lib/services/authService');
      const user = authService.getCurrentUser();
      if (!user) return;
      
      const token = await user.getIdToken();
      
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

  async function loadDevices() {
    isLoading = true;
    try {
      devices = await loadCPEDevices();
      console.log(`Loaded ${devices.length} CPE devices`);
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      isLoading = false;
    }
  }

  function handleToggleExpand(event: CustomEvent) {
    const device = event.detail;
    expandedDeviceId = expandedDeviceId === device.id ? null : device.id;
  }

  function handleReboot(event: CustomEvent) {
    actionDevice = event.detail;
    showActionsModal = true;
  }

  function handleFactoryReset(event: CustomEvent) {
    actionDevice = event.detail;
    showActionsModal = true;
  }

  function handleRefresh(event: CustomEvent) {
    const device = event.detail;
    console.log('Refreshing device:', device.id);
    // Quick refresh without modal
    refreshDevice(device.id);
  }

  async function refreshDevice(deviceId: string) {
    try {
      const tenantId = $currentTenant?.id;
      if (!tenantId) {
        console.warn('No tenant selected for refresh');
        return;
      }
      const response = await fetch('/api/tr069/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({
          deviceId,
          action: 'refreshParameters'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        console.log('✅ Refresh command sent to', deviceId);
      }
    } catch (error) {
      console.error('Refresh error:', error);
    }
  }

  function handleEdit(event: CustomEvent) {
    const device = event.detail;
    console.log('Edit device:', device.id);
    editDevice = device;
    showParameterEditor = true;
  }

  function handleMonitoring(event: CustomEvent) {
    const device = event.detail;
    window.location.href = `/modules/acs-cpe-management/monitoring?deviceId=${device.id}`;
  }

  // Filtered devices
  $: filteredDevices = devices.filter(device => {
    const matchesSearch = device.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.manufacturer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  $: onlineCount = devices.filter(d => d.status === 'Online').length;
  $: offlineCount = devices.filter(d => d.status === 'Offline').length;
  $: selectedCount = selectedDevices.size;
  $: allSelected = filteredDevices.length > 0 && filteredDevices.every(d => selectedDevices.has(d.id));
  $: someSelected = selectedDevices.size > 0 && !allSelected;

  function toggleSelectAll() {
    if (allSelected) {
      selectedDevices.clear();
    } else {
      filteredDevices.forEach(d => selectedDevices.add(d.id));
    }
    selectedDevices = selectedDevices; // Trigger reactivity
  }

  function toggleSelectDevice(deviceId: string) {
    if (selectedDevices.has(deviceId)) {
      selectedDevices.delete(deviceId);
    } else {
      selectedDevices.add(deviceId);
    }
    selectedDevices = selectedDevices; // Trigger reactivity
  }

  async function executeBulkAction(action: 'refreshParameters' | 'reboot' | 'applyPreset', presetId?: string) {
    if (selectedDevices.size === 0) {
      bulkActionMessage = '⚠️ Please select at least one device';
      setTimeout(() => bulkActionMessage = '', 3000);
      return;
    }

    const confirmMessage = action === 'reboot' 
      ? `Reboot ${selectedDevices.size} device(s)? This will disconnect them temporarily.`
      : action === 'applyPreset'
      ? `Apply preset to ${selectedDevices.size} device(s)?`
      : `Refresh parameters for ${selectedDevices.size} device(s)?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    if (!$currentTenant?.id) {
      bulkActionMessage = '⚠️ No tenant selected';
      setTimeout(() => bulkActionMessage = '', 3000);
      return;
    }

    isBulkActionInProgress = true;
    bulkActionMessage = '';
    const deviceIds = Array.from(selectedDevices);

    try {
      const { authService } = await import('$lib/services/authService');
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      
      const response = await fetch('/api/tr069/bulk-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-tenant-id': $currentTenant.id
        },
        body: JSON.stringify({
          deviceIds,
          action,
          ...(presetId ? { presetId } : {})
        })
      });

      const data = await response.json();
      if (data.success) {
        bulkActionMessage = `✅ ${data.message || `Bulk operation completed: ${data.results.success} succeeded, ${data.results.failed} failed`}`;
        selectedDevices.clear();
        selectedDevices = selectedDevices;
        await loadDevices(); // Reload to show updated status
      } else {
        bulkActionMessage = `❌ ${data.error || 'Bulk operation failed'}`;
      }
    } catch (error) {
      console.error('Bulk operation error:', error);
      bulkActionMessage = `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isBulkActionInProgress = false;
      setTimeout(() => bulkActionMessage = '', 5000);
    }
  }
</script>

<svelte:head>
  <title>CPE Devices - ACS CPE Management</title>
  <meta name="description" content="TR-069 device management and monitoring" />
</svelte:head>

<div class="devices-page">
  <MainMenu />
  
  <!-- Page Header -->
  <div class="page-header">
    <div class="header-content">
      <div class="header-top">
        <a href="/dashboard" class="back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          ← Back to Dashboard
        </a>
      </div>
      <h1 class="page-title">
        <span class="page-icon">📱</span>
        CPE Device Management
      </h1>
      <p class="page-description">
        Manage TR-069 enabled CPE devices with remote control capabilities
      </p>
    </div>
    <div class="header-actions">
      <button class="btn btn-primary" on:click={loadDevices} disabled={isLoading}>
        {#if isLoading}
          <span class="spinner-sm"></span>
        {:else}
          🔄
        {/if}
        Refresh
      </button>
    </div>
  </div>

  <!-- Stats Bar -->
  <div class="stats-bar">
    <div class="stat-item">
      <span class="stat-icon">📊</span>
      <span class="stat-value">{devices.length}</span>
      <span class="stat-label">Total</span>
    </div>
    <div class="stat-item online">
      <span class="stat-icon">🟢</span>
      <span class="stat-value">{onlineCount}</span>
      <span class="stat-label">Online</span>
    </div>
    <div class="stat-item offline">
      <span class="stat-icon">🔴</span>
      <span class="stat-value">{offlineCount}</span>
      <span class="stat-label">Offline</span>
    </div>
    <div class="stat-item">
      <span class="stat-icon">📈</span>
      <span class="stat-value">{filteredDevices.length}</span>
      <span class="stat-label">Shown</span>
    </div>
  </div>

  <!-- Filters -->
  <div class="filters-bar">
    <div class="filter-group">
      <input
        type="text"
        placeholder="Search devices..."
        bind:value={searchTerm}
        class="search-input"
      />
    </div>
    <div class="filter-group">
      <select bind:value={statusFilter} class="filter-select">
        <option value="all">All Status</option>
        <option value="Online">Online</option>
        <option value="Offline">Offline</option>
      </select>
    </div>
  </div>

  <!-- Bulk Actions Bar -->
  {#if selectedCount > 0}
    <div class="bulk-actions-bar">
      <div class="bulk-info">
        <span class="bulk-count">{selectedCount}</span>
        <span>device(s) selected</span>
      </div>
      <div class="bulk-buttons">
        <button 
          class="btn btn-secondary btn-sm" 
          on:click={() => { selectedDevices.clear(); selectedDevices = selectedDevices; }}
          disabled={isBulkActionInProgress}
        >
          Clear Selection
        </button>
        <button 
          class="btn btn-primary btn-sm" 
          on:click={() => executeBulkAction('refreshParameters')}
          disabled={isBulkActionInProgress}
        >
          {isBulkActionInProgress ? 'Processing...' : '🔄 Refresh Selected'}
        </button>
        <button 
          class="btn btn-warning btn-sm" 
          on:click={() => executeBulkAction('reboot')}
          disabled={isBulkActionInProgress}
        >
          {isBulkActionInProgress ? 'Processing...' : '⚡ Reboot Selected'}
        </button>
        <button 
          class="btn btn-primary btn-sm" 
          on:click={openPresetSelectModal}
          disabled={isBulkActionInProgress || isLoadingPresets}
        >
          {isLoadingPresets ? 'Loading...' : '⚙️ Apply Preset'}
        </button>
      </div>
      {#if bulkActionMessage}
        <div class="bulk-message {bulkActionMessage.includes('✅') ? 'success' : bulkActionMessage.includes('⚠️') ? 'warning' : 'error'}">
          {bulkActionMessage}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Devices Table -->
  <div class="devices-table-container">
    <table class="devices-table">
      <thead>
        <tr>
          <th class="col-select">
            <input
              type="checkbox"
              checked={allSelected}
              indeterminate={someSelected}
              on:change={toggleSelectAll}
              class="select-all-checkbox"
            />
          </th>
          <th class="col-expand"></th>
          <th class="col-status">Status</th>
          <th class="col-device-id">Device ID</th>
          <th class="col-manufacturer">Manufacturer</th>
          <th class="col-model">Model</th>
          <th class="col-serial">Serial Number</th>
          <th class="col-ip">IP Address</th>
          <th class="col-firmware">Firmware</th>
          <th class="col-contact">Last Contact</th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#if isLoading}
          <tr>
            <td colspan="11" class="loading-cell">
              <div class="loading-container">
                <div class="spinner-large"></div>
                <p>Loading devices...</p>
              </div>
            </td>
          </tr>
        {:else if filteredDevices.length === 0}
          <tr>
            <td colspan="11" class="empty-cell">
              <div class="empty-state">
                <div class="empty-icon">📱</div>
                <h3>No devices found</h3>
                <p>Try adjusting your filters or add devices via GenieACS</p>
              </div>
            </td>
          </tr>
        {:else}
          {#each filteredDevices as device (device.id)}
            <CPEDeviceRow 
              {device}
              isExpanded={expandedDeviceId === device.id}
              isSelected={selectedDevices.has(device.id)}
              on:toggleExpand={handleToggleExpand}
              on:toggleSelect={(e) => toggleSelectDevice(e.detail.id)}
              on:reboot={handleReboot}
              on:factoryReset={handleFactoryReset}
              on:refresh={handleRefresh}
              on:edit={handleEdit}
              on:monitoring={handleMonitoring}
            />
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>

<!-- TR-069 Actions Modal -->
{#if showActionsModal && actionDevice}
  <TR069Actions 
    device={actionDevice}
    show={showActionsModal}
    on:close={() => { showActionsModal = false; actionDevice = null; }}
  />
{/if}

{#if showParameterEditor && editDevice}
  <ParameterEditorModal
    show={showParameterEditor}
    device={editDevice}
    on:close={() => { showParameterEditor = false; editDevice = null; }}
    on:saved={() => {
      showParameterEditor = false;
      editDevice = null;
      loadDevices();
    }}
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
                  {#if preset.tags && preset.tags.length > 0}
                    <span class="preset-tags">
                      {#each preset.tags as tag}
                        <span class="tag">{tag}</span>
                      {/each}
                    </span>
                  {/if}
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
  .devices-page {
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
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-content {
    flex: 1;
  }

  .page-title {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .page-icon {
    font-size: 2rem;
  }

  .page-description {
    margin: 0;
    color: var(--text-secondary);
  }

  .header-actions {
    display: flex;
    gap: 1rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .spinner-sm {
    width: 1rem;
    height: 1rem;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .stats-bar {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1rem 2rem;
    display: flex;
    gap: 3rem;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .stat-icon {
    font-size: 1.5rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .stat-item.online .stat-value {
    color: #10b981;
  }

  .stat-item.offline .stat-value {
    color: #ef4444;
  }

  .filters-bar {
    padding: 1rem 2rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    gap: 1rem;
  }

  .bulk-actions-bar {
    padding: 1rem 2rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .bulk-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .bulk-count {
    background: var(--accent-color);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .bulk-buttons {
    display: flex;
    gap: 0.5rem;
    flex: 1;
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

  .bulk-message {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
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

  /* Preset Selection Modal Styles */
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
    max-width: 600px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
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
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
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
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-item:hover {
    background: var(--bg-secondary);
    border-color: var(--brand-primary);
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .preset-tags {
    display: flex;
    gap: 0.25rem;
  }

  .preset-tags .tag {
    background: var(--bg-tertiary);
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
  }

  .filter-group {
    flex: 1;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .filter-select {
    width: 100%;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
  }

  .devices-table-container {
    padding: 2rem;
    overflow-x: auto;
  }

  .devices-table {
    width: 100%;
    border-collapse: collapse;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .devices-table thead {
    background: var(--bg-tertiary);
    border-bottom: 2px solid var(--border-color);
  }

  .devices-table th {
    text-align: left;
    padding: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .devices-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
    vertical-align: middle;
  }

  /* Column widths */
  .col-select {
    width: 40px;
    text-align: center;
  }

  .select-all-checkbox,
  .device-checkbox {
    cursor: pointer;
    width: 18px;
    height: 18px;
  }

  .device-row.selected {
    background: rgba(59, 130, 246, 0.1);
  }

  .col-expand {
    width: 50px;
    text-align: center;
  }

  .col-status {
    width: 80px;
    text-align: center;
  }

  .col-device-id {
    width: 150px;
    min-width: 120px;
  }

  .col-manufacturer {
    width: 140px;
    min-width: 100px;
  }

  .col-model {
    width: 180px;
    min-width: 140px;
  }

  .col-serial {
    width: 160px;
    min-width: 120px;
  }

  .col-ip {
    width: 140px;
    min-width: 100px;
  }

  .col-firmware {
    width: 100px;
    min-width: 80px;
  }

  .col-contact {
    width: 140px;
    min-width: 120px;
  }

  .col-actions {
    width: 260px;
    min-width: 260px;
    text-align: center;
  }

  .loading-cell, .empty-cell {
    text-align: center;
    padding: 4rem 2rem;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .spinner-large {
    width: 3rem;
    height: 3rem;
    border: 4px solid var(--border-color);
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .empty-icon {
    font-size: 4rem;
    opacity: 0.5;
  }

  .empty-state h3 {
    margin: 0;
    color: var(--text-primary);
  }

  .empty-state p {
    margin: 0;
    color: var(--text-secondary);
  }

  @media (max-width: 1400px) {
    .devices-table {
      font-size: 0.875rem;
    }

    .devices-table th,
    .devices-table td {
      padding: 0.625rem 0.5rem;
    }

    .col-model,
    .col-serial {
      min-width: 100px;
    }
  }

  @media (max-width: 1024px) {
    /* Hide less critical columns on smaller screens */
    .col-model,
    .col-serial {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .stats-bar {
      flex-wrap: wrap;
      gap: 1rem;
    }

    .filters-bar {
      flex-direction: column;
    }

    .devices-table-container {
      padding: 1rem;
    }
  }
</style>