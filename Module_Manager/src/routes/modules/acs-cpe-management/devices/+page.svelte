<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../components/MainMenu.svelte';
  import CPEDeviceRow from '../components/CPEDeviceRow.svelte';
  import TR069Actions from '../components/TR069Actions.svelte';
  import { loadCPEDevices, type CPEDevice } from '../lib/cpeDataService';

  let devices: CPEDevice[] = [];
  let isLoading = false;
  let searchTerm = '';
  let statusFilter = 'all';
  let expandedDeviceId: string | null = null;
  let actionDevice: CPEDevice | null = null;
  let showActionsModal = false;

  onMount(async () => {
    await loadDevices();
  });

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
      const response = await fetch('/api/tr069/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    // TODO: Open parameter editor
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

  <!-- Devices Table -->
  <div class="devices-table-container">
    <table class="devices-table">
      <thead>
        <tr>
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
            <td colspan="10" class="loading-cell">
              <div class="loading-container">
                <div class="spinner-large"></div>
                <p>Loading devices...</p>
              </div>
            </td>
          </tr>
        {:else if filteredDevices.length === 0}
          <tr>
            <td colspan="10" class="empty-cell">
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
              on:toggleExpand={handleToggleExpand}
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

