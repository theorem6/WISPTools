<script lang="ts">
  import type { CBSDDevice } from '../lib/models/cbsdDevice';
  
  export let devices: CBSDDevice[] = [];
  export let onDeviceSelect: (device: CBSDDevice) => void;
  export let onRegister: (device: CBSDDevice) => void;
  export let onDeregister: (device: CBSDDevice) => void;
  
  let searchTerm = '';
  let filterState = 'all';
  
  $: filteredDevices = devices.filter(device => {
    const matchesSearch = device.cbsdSerialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.fccId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesState = filterState === 'all' || device.state === filterState;
    return matchesSearch && matchesState;
  });
  
  function getStateColor(state: string): string {
    switch (state) {
      case 'REGISTERED': return '#3b82f6';
      case 'GRANTED': return '#10b981';
      case 'AUTHORIZED': return '#22c55e';
      case 'SUSPENDED': return '#f59e0b';
      case 'DEREGISTERED': return '#6b7280';
      default: return '#9ca3af';
    }
  }
  
  function getProviderBadge(provider: string): string {
    switch (provider) {
      case 'google': return '🔵 Google SAS';
      case 'federated-wireless': return '🟢 Federated Wireless';
      default: return '⚪ Other';
    }
  }
</script>

<div class="device-list">
  <div class="list-header">
    <div class="search-section">
      <input
        type="text"
        class="search-input"
        placeholder="Search devices..."
        bind:value={searchTerm}
      />
      <select class="filter-select" bind:value={filterState}>
        <option value="all">All States</option>
        <option value="UNREGISTERED">Unregistered</option>
        <option value="REGISTERED">Registered</option>
        <option value="GRANTED">Granted</option>
        <option value="AUTHORIZED">Authorized</option>
        <option value="SUSPENDED">Suspended</option>
        <option value="DEREGISTERED">Deregistered</option>
      </select>
    </div>
    <div class="device-count">
      {filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''}
    </div>
  </div>
  
  <div class="device-table-container">
    <table class="device-table">
      <thead>
        <tr>
          <th>Serial Number</th>
          <th>FCC ID</th>
          <th>Category</th>
          <th>Provider</th>
          <th>State</th>
          <th>Active Grants</th>
          <th>Location</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredDevices as device}
          <tr class="device-row" on:click={() => onDeviceSelect(device)}>
            <td class="serial-number">{device.cbsdSerialNumber}</td>
            <td class="fcc-id">{device.fccId}</td>
            <td class="category">
              <span class="category-badge category-{device.cbsdCategory.toLowerCase()}">
                {device.cbsdCategory}
              </span>
            </td>
            <td class="provider">
              <span class="provider-badge">
                {getProviderBadge(device.sasProviderId)}
              </span>
            </td>
            <td class="state">
              <span class="state-badge" style="--state-color: {getStateColor(device.state)}">
                {device.state}
              </span>
            </td>
            <td class="grants">
              {device.activeGrants?.length || 0}
            </td>
            <td class="location">
              📍 {device.installationParam.latitude.toFixed(4)}, {device.installationParam.longitude.toFixed(4)}
            </td>
            <td class="actions" on:click|stopPropagation>
              {#if device.state === 'UNREGISTERED'}
                <button class="btn btn-sm btn-primary" on:click={() => onRegister(device)}>
                  Register
                </button>
              {:else if device.state === 'REGISTERED' || device.state === 'GRANTED' || device.state === 'AUTHORIZED'}
                <button class="btn btn-sm btn-danger" on:click={() => onDeregister(device)}>
                  Deregister
                </button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    
    {#if filteredDevices.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📡</div>
        <p class="empty-text">No devices found</p>
        <p class="empty-subtext">Try adjusting your search or filters</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .device-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  
  .search-section {
    display: flex;
    gap: 0.5rem;
    flex: 1;
  }
  
  .search-input {
    flex: 1;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
  }
  
  .filter-select {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  .device-count {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .device-table-container {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .device-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .device-table thead {
    background: var(--bg-tertiary);
  }
  
  .device-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .device-table td {
    padding: 1rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.875rem;
  }
  
  .device-row {
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .device-row:hover {
    background: var(--bg-hover);
  }
  
  .serial-number {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .fcc-id {
    font-family: monospace;
    color: var(--text-secondary);
  }
  
  .category-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .category-a {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }
  
  .category-b {
    background: rgba(139, 92, 246, 0.1);
    color: #8b5cf6;
  }
  
  .provider-badge {
    font-size: 0.875rem;
  }
  
  .state-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--state-color) 10%, transparent);
    color: var(--state-color);
    text-transform: uppercase;
  }
  
  .grants {
    font-weight: 600;
    color: var(--accent-color);
  }
  
  .location {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .actions {
    text-align: right;
  }
  
  .btn {
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-sm {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }
  
  .btn-primary {
    background: var(--accent-color);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--accent-hover);
  }
  
  .btn-danger {
    background: #ef4444;
    color: white;
  }
  
  .btn-danger:hover {
    background: #dc2626;
  }
  
  .empty-state {
    padding: 4rem 2rem;
    text-align: center;
  }
  
  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  .empty-text {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }
  
  .empty-subtext {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  @media (max-width: 768px) {
    .device-table {
      font-size: 0.75rem;
    }
    
    .device-table th,
    .device-table td {
      padding: 0.5rem;
    }
    
    .location {
      display: none;
    }
  }
</style>

