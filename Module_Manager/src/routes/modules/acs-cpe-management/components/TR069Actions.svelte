<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let device: any;
  export let show: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let actionInProgress = false;
  let actionResult = '';
  
  async function executeReboot() {
    if (!confirm(`Reboot ${device.id}? This will disconnect the device temporarily.`)) {
      return;
    }
    
    actionInProgress = true;
    try {
      // TODO: Call GenieACS API
      const response = await fetch(`/api/tr069/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          action: 'reboot'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        actionResult = '✅ Reboot command sent successfully';
        setTimeout(() => dispatch('close'), 2000);
      } else {
        actionResult = '❌ Failed to send reboot command';
      }
    } catch (error) {
      console.error('Reboot error:', error);
      actionResult = '⚠️ Error: ' + error.message;
    } finally {
      actionInProgress = false;
    }
  }
  
  async function executeFactoryReset() {
    if (!confirm(`⚠️ FACTORY RESET ${device.id}?\n\nThis will erase ALL configuration and data!\n\nType the device ID to confirm.`)) {
      return;
    }
    
    const confirmation = prompt(`Type "${device.id}" to confirm factory reset:`);
    if (confirmation !== device.id) {
      alert('Confirmation failed. Factory reset cancelled.');
      return;
    }
    
    actionInProgress = true;
    try {
      const response = await fetch(`/api/tr069/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          action: 'factoryReset'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        actionResult = '✅ Factory reset command sent';
        setTimeout(() => dispatch('close'), 2000);
      } else {
        actionResult = '❌ Failed to send factory reset command';
      }
    } catch (error) {
      console.error('Factory reset error:', error);
      actionResult = '⚠️ Error: ' + error.message;
    } finally {
      actionInProgress = false;
    }
  }
  
  async function executeRefresh() {
    actionInProgress = true;
    try {
      const response = await fetch(`/api/tr069/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          action: 'refreshParameters'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        actionResult = '✅ Refresh command sent';
        setTimeout(() => dispatch('close'), 1500);
      } else {
        actionResult = '❌ Failed to refresh device';
      }
    } catch (error) {
      console.error('Refresh error:', error);
      actionResult = '⚠️ Error: ' + error.message;
    } finally {
      actionInProgress = false;
    }
  }
  
  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose} on:keydown={(e) => e.key === 'Escape' && handleClose()}>
    <div class="modal-content" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2>TR-069 Device Actions - {device.id}</h2>
        <button class="close-btn" on:click={handleClose} aria-label="Close">×</button>
      </div>
      
      <div class="modal-body">
        {#if actionResult}
          <div class="action-result">{actionResult}</div>
        {/if}
        
        <div class="actions-grid">
          <div class="action-card">
            <div class="action-icon">🔄</div>
            <h3>Refresh Parameters</h3>
            <p>Request device to send current parameter values</p>
            <button class="btn btn-primary" on:click={executeRefresh} disabled={actionInProgress}>
              Refresh Now
            </button>
          </div>
          
          <div class="action-card">
            <div class="action-icon">⚡</div>
            <h3>Reboot Device</h3>
            <p>Restart the CPE device remotely via TR-069</p>
            <button class="btn btn-warning" on:click={executeReboot} disabled={actionInProgress}>
              Reboot Device
            </button>
          </div>
          
          <div class="action-card danger-card">
            <div class="action-icon">🔥</div>
            <h3>Factory Reset</h3>
            <p>⚠️ Reset device to factory defaults (DESTRUCTIVE)</p>
            <button class="btn btn-danger" on:click={executeFactoryReset} disabled={actionInProgress}>
              Factory Reset
            </button>
          </div>
          
          <div class="action-card">
            <div class="action-icon">📈</div>
            <h3>Monitoring</h3>
            <p>View real-time TR-069 metrics and graphs</p>
            <a href="/modules/acs-cpe-management/monitoring?deviceId={device.id}" class="btn btn-primary">
              Open Monitoring
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .device-row {
    transition: all 0.2s;
    cursor: pointer;
  }

  .device-row:hover {
    background: var(--bg-tertiary);
  }

  .device-row.expanded {
    background: var(--bg-secondary);
    border-left: 3px solid var(--accent-color);
  }

  .expand-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.25rem 0.5rem;
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
  }

  .status-indicator.online {
    background: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
    animation: pulse 2s infinite;
  }

  .status-indicator.offline {
    background: #ef4444;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .device-id-cell {
    font-family: monospace;
  }

  .device-id {
    color: var(--accent-color);
    font-weight: 600;
  }

  .actions-cell {
    white-space: nowrap;
  }

  .action-buttons {
    display: flex;
    gap: 0.25rem;
  }

  .action-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    padding: 0.375rem 0.625rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
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
  }

  .details-section {
    margin-bottom: 1.5rem;
  }

  .details-section h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 600;
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
  }

  .parameters-table {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
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
    border-bottom: 1px solid var(--border-color);
  }

  .parameters-table td {
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .parameters-table code {
    background: var(--bg-primary);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--accent-color);
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
    text-decoration: none;
    display: inline-flex;
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

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-primary);
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
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
    font-size: 1.5rem;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .action-result {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    font-weight: 600;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .action-card {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.75rem;
  }

  .action-card.danger-card {
    border-color: #ef4444;
    background: linear-gradient(135deg, var(--bg-tertiary) 0%, rgba(239, 68, 68, 0.05) 100%);
  }

  .action-icon {
    font-size: 2.5rem;
  }

  .action-card h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary);
  }

  .action-card p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .btn-warning {
    background: #f59e0b;
    color: white;
  }

  .btn-warning:hover:not(:disabled) {
    background: #d97706;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
  }
</style>

