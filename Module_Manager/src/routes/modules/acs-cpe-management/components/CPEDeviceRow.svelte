<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let device: any;
  export let isExpanded: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  function handleReboot() {
    dispatch('reboot', device);
  }
  
  function handleFactoryReset() {
    dispatch('factoryReset', device);
  }
  
  function handleRefresh() {
    dispatch('refresh', device);
  }
  
  function handleEdit() {
    dispatch('edit', device);
  }
  
  function handleMonitoring() {
    dispatch('monitoring', device);
  }
  
  function toggleExpand() {
    dispatch('toggleExpand', device);
  }
</script>

<tr class="device-row" class:expanded={isExpanded}>
  <td class="col-expand">
    <button class="expand-btn" on:click={toggleExpand} aria-label="Expand details">
      {isExpanded ? '▼' : '▶'}
    </button>
  </td>
  <td class="col-status">
    <span class="status-indicator" class:online={device.status === 'Online'} class:offline={device.status === 'Offline'}></span>
  </td>
  <td class="col-device-id">
    <span class="device-id">{device.id}</span>
  </td>
  <td class="col-manufacturer">{device.manufacturer}</td>
  <td class="col-model">{device.model || 'N/A'}</td>
  <td class="col-serial">{device.serialNumber || 'N/A'}</td>
  <td class="col-ip">{device.ipAddress || 'N/A'}</td>
  <td class="col-firmware">{device.firmware || 'N/A'}</td>
  <td class="col-contact">{device.lastContact ? new Date(device.lastContact).toLocaleTimeString() : 'Never'}</td>
  <td class="col-actions">
    <div class="action-buttons">
      <button class="action-btn" on:click={handleMonitoring} title="View Monitoring Graphs">
        📈
      </button>
      <button class="action-btn" on:click={handleEdit} title="Edit Parameters">
        ✏️
      </button>
      <button class="action-btn" on:click={handleRefresh} title="Refresh Device">
        🔄
      </button>
      <button class="action-btn warn" on:click={handleReboot} title="Reboot Device">
        ⚡
      </button>
      <button class="action-btn danger" on:click={handleFactoryReset} title="Factory Reset">
        🔥
      </button>
    </div>
  </td>
</tr>

{#if isExpanded}
  <tr class="device-details-row">
    <td colspan="10">
      <div class="device-details">
        <div class="details-section">
          <h4>Device Information</h4>
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">Status:</span>
              <span class="detail-value">{device.status}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Uptime:</span>
              <span class="detail-value">{device.uptime || 'Unknown'}</span>
            </div>
            {#if device.location}
              <div class="detail-item">
                <span class="detail-label">Location:</span>
                <span class="detail-value">📍 {device.location.latitude.toFixed(4)}, {device.location.longitude.toFixed(4)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Address:</span>
                <span class="detail-value">{device.location.address || 'N/A'}</span>
              </div>
            {/if}
          </div>
        </div>

        {#if device.parameters && Object.keys(device.parameters).length > 0}
          <div class="details-section">
            <h4>TR-069 Parameters</h4>
            <div class="parameters-table">
              <table>
                <thead>
                  <tr>
                    <th>Parameter Path</th>
                    <th>Value</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {#each Object.entries(device.parameters) as [path, value]}
                    <tr>
                      <td><code>{path}</code></td>
                      <td>{JSON.stringify(value)}</td>
                      <td>{typeof value}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}

        <div class="details-actions">
          <button class="btn btn-primary" on:click={handleMonitoring}>
            📈 View Full Monitoring
          </button>
          <button class="btn btn-secondary" on:click={handleEdit}>
            ✏️ Edit Parameters
          </button>
        </div>
      </div>
    </td>
  </tr>
{/if}

<style>
  .device-row {
    transition: background 0.2s;
  }

  .device-row:hover {
    background: var(--bg-tertiary);
  }

  .device-row.expanded {
    background: var(--bg-secondary);
  }

  .expand-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0.25rem;
    transition: all 0.2s;
  }

  .expand-btn:hover {
    color: var(--accent-color);
  }

  .status-indicator {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin: 0 auto;
  }

  .status-indicator.online {
    background: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
  }

  .status-indicator.offline {
    background: #ef4444;
  }

  .device-id-cell {
    font-weight: 600;
  }

  .device-id {
    font-family: monospace;
    color: var(--accent-color);
  }

  .actions-cell {
    padding: 0.5rem;
  }

  .action-buttons {
    display: flex;
    gap: 0.25rem;
    justify-content: center;
  }

  .action-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    padding: 0.375rem 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--accent-color);
    border-color: var(--accent-color);
    transform: scale(1.1);
  }

  .action-btn.warn:hover {
    background: #f59e0b;
    border-color: #f59e0b;
  }

  .action-btn.danger:hover {
    background: #ef4444;
    border-color: #ef4444;
  }

  .device-details-row {
    background: var(--bg-secondary);
  }

  .device-details {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .details-section h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1rem;
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    font-weight: 600;
  }

  .detail-value {
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .parameters-table {
    overflow-x: auto;
    max-height: 300px;
    overflow-y: auto;
  }

  .parameters-table table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .parameters-table th {
    text-align: left;
    padding: 0.5rem;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-weight: 600;
    position: sticky;
    top: 0;
  }

  .parameters-table td {
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .parameters-table code {
    background: var(--bg-tertiary);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.75rem;
  }

  .details-actions {
    display: flex;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--bg-primary);
  }
</style>

