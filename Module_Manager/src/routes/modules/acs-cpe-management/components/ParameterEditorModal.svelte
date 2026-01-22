<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';

  export let show = false;
  export let device: any = null;

  const dispatch = createEventDispatcher();

  let parameters: { id: string; parameter: string; value: string }[] = [];
  let loading = false;
  let error = '';
  let success = '';

  $: if (show && device) {
    const entries = device.parameters ? Object.entries(device.parameters) : [];
    parameters = entries.map(([key, val], index) => ({
      id: `${key}-${index}`,
      parameter: key,
      value: typeof val === 'string' ? val : JSON.stringify(val)
    }));
    if (parameters.length === 0) {
      parameters = [{ id: `new-${Date.now()}`, parameter: '', value: '' }];
    }
    error = '';
    success = '';
  }

  function addParameterRow() {
    parameters = [
      ...parameters,
      { id: `new-${Date.now()}-${parameters.length}`, parameter: '', value: '' }
    ];
  }

  function removeParameterRow(id: string) {
    parameters = parameters.filter(row => row.id !== id);
    if (parameters.length === 0) {
      addParameterRow();
    }
  }

  function close() {
    dispatch('close');
  }

  function parseValue(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === '') return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (!Number.isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  async function saveParameters() {
    if (!device?.id) return;
    if (!$currentTenant?.id) {
      error = 'No tenant selected';
      return;
    }

    const filtered = parameters
      .map(row => ({ parameter: row.parameter.trim(), value: row.value }))
      .filter(row => row.parameter.length > 0);

    if (filtered.length === 0) {
      error = 'Add at least one parameter to update.';
      return;
    }

    loading = true;
    error = '';
    success = '';

    try {
      const response = await fetch('/api/tr069/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': $currentTenant?.id || ''
        },
        body: JSON.stringify({
          deviceId: device.id,
          action: 'setParameterValues',
          parameters: filtered.map(row => ({
            parameter: row.parameter,
            value: parseValue(row.value)
          }))
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.details || 'Failed to update parameters');
      }

      success = 'Parameters queued for update.';
      setTimeout(() => {
        dispatch('saved', { deviceId: device.id });
        close();
      }, 1200);
    } catch (e: any) {
      console.error('Failed to save parameters:', e);
      error = e.message || 'Failed to update parameters';
    } finally {
      loading = false;
    }
  }
</script>

{#if show && device}
  <div class="modal-overlay" on:click={close} on:keydown={(e) => e.key === 'Escape' && close()}>
    <div class="modal-content" role="dialog" aria-modal="true" on:click|stopPropagation>
      <div class="modal-header">
        <h2>✏️ Edit TR-069 Parameters</h2>
        <button class="close-btn" on:click={close} aria-label="Close">×</button>
      </div>

      <div class="modal-body">
        <div class="device-summary">
          <strong>{device.id}</strong>
          <span>{device.model || device.manufacturer || 'CPE Device'}</span>
        </div>

        {#if error}
          <div class="alert alert-error">{error}</div>
        {/if}

        {#if success}
          <div class="alert alert-success">{success}</div>
        {/if}

        <div class="parameters-table">
          <div class="parameters-header">
            <span>Parameter Path</span>
            <span>Value</span>
            <span></span>
          </div>

          {#each parameters as row (row.id)}
            <div class="parameter-row">
              <input
                type="text"
                placeholder="InternetGatewayDevice.DeviceInfo.Manufacturer"
                bind:value={row.parameter}
                disabled={loading}
              />
              <input
                type="text"
                placeholder="Value"
                bind:value={row.value}
                disabled={loading}
              />
              <button class="remove-btn" on:click={() => removeParameterRow(row.id)} disabled={loading}>
                ✕
              </button>
            </div>
          {/each}
        </div>

        <button class="btn btn-secondary" on:click={addParameterRow} disabled={loading}>
          ➕ Add Parameter
        </button>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={close} disabled={loading}>
          Cancel
        </button>
        <button class="btn btn-primary" on:click={saveParameters} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    width: 90%;
    max-width: 720px;
    background: var(--bg-primary);
    border-radius: 12px;
    border: 1px solid var(--border-color);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-body {
    padding: 1.5rem;
    display: grid;
    gap: 1rem;
  }

  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .device-summary {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    color: var(--text-secondary);
  }

  .parameters-table {
    display: grid;
    gap: 0.5rem;
  }

  .parameters-header {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.5rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .parameter-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.5rem;
    align-items: center;
  }

  .parameter-row input {
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .remove-btn {
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .alert {
    padding: 0.75rem 1rem;
    border-radius: 6px;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .alert-success {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .btn {
    padding: 0.6rem 1rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    cursor: pointer;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
</style>
