<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let device: any = null;
  export let show: boolean = false;
  
  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if show && device}
  <div
    class="modal-overlay"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="cpe-performance-modal-title"
    tabindex="-1"
  >
    <div class="modal-content" on:click|stopPropagation on:keydown|stopPropagation role="document">
      <div class="modal-header">
        <h2 id="cpe-performance-modal-title">CPE Device Performance</h2>
        <button class="close-btn" on:click={handleClose} aria-label="Close">×</button>
      </div>
      
      <div class="modal-body">
        <div class="device-info">
          <div class="info-section">
            <h3>Device Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Device ID:</span>
                <span class="info-value">{device.id}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Manufacturer:</span>
                <span class="info-value">{device.manufacturer}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Status:</span>
                <span class="info-value status" class:online={device.status === 'Online'} class:offline={device.status === 'Offline'}>
                  {device.status}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Last Contact:</span>
                <span class="info-value">{device.lastContact ? new Date(device.lastContact).toLocaleString() : 'Unknown'}</span>
              </div>
            </div>
          </div>

          {#if device.location}
            <div class="info-section">
              <h3>Location</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Latitude:</span>
                  <span class="info-value">{device.location.latitude.toFixed(6)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Longitude:</span>
                  <span class="info-value">{device.location.longitude.toFixed(6)}</span>
                </div>
              </div>
            </div>
          {/if}

          {#if device.parameters && Object.keys(device.parameters).length > 0}
            <div class="info-section">
              <h3>Parameters</h3>
              <div class="parameters-list">
                {#each Object.entries(device.parameters) as [key, value]}
                  <div class="parameter-item">
                    <span class="param-key">{key}:</span>
                    <span class="param-value">{JSON.stringify(value)}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>Close</button>
        <button class="btn btn-primary">Manage Device</button>
      </div>
    </div>
  </div>
{/if}

<style>
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
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
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
    transition: all 0.2s;
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

  .device-info {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .info-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    color: var(--text-primary);
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .info-value {
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .info-value.status {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .info-value.status.online {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }

  .info-value.status.offline {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .parameters-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .parameter-item {
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 0.375rem;
    display: flex;
    gap: 0.5rem;
  }

  .param-key {
    font-weight: 600;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .param-value {
    color: var(--text-primary);
    word-break: break-word;
  }

  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }

  .btn {
    padding: 0.5rem 1.5rem;
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
  }

  .btn-secondary:hover {
    background: var(--bg-primary);
  }

  @media (max-width: 640px) {
    .modal-content {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

