<!-- ACS Parameter Editor - Edit TR-069 parameters per device -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { apiService } from '$lib/services/apiService';

  export let device: { id: string } | null = null;
  export let show = false;

  const dispatch = createEventDispatcher();

  let parameters: Record<string, unknown> = {};
  let loading = false;
  let saving = false;
  let error = '';
  let success = '';
  let editedParams: Record<string, string> = {};

  $: if (show && device) {
    loadParameters();
  }

  async function loadParameters() {
    if (!device?.id || !$currentTenant?.id) return;
    loading = true;
    error = '';
    try {
      const res = await apiService.getDeviceParameters(device.id);
      if (res.success && res.data?.parameters) {
        parameters = res.data.parameters as Record<string, unknown>;
        editedParams = {};
      } else {
        error = res.error || 'Failed to load parameters';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  function setEdited(path: string, value: string) {
    editedParams = { ...editedParams, [path]: value };
  }

  async function saveParameters() {
    if (!device?.id || !$currentTenant?.id || Object.keys(editedParams).length === 0) return;
    saving = true;
    error = '';
    success = '';
    try {
      const params = Object.entries(editedParams).map(([parameter, value]) => ({ parameter, value }));
      const data = await apiService.post('/tr069/tasks', {
        deviceId: device.id,
        action: 'setParameterValues',
        parameters: params
      });
      const ok = data.success || (data as { data?: { success?: boolean } }).data?.success;
      if (ok) {
        success = `✅ ${params.length} parameter(s) updated`;
        editedParams = {};
        loadParameters();
        setTimeout(() => dispatch('saved'), 1500);
      } else {
        error = (data as { error?: string }).error || 'Failed to save';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save';
    } finally {
      saving = false;
    }
  }

  function formatValue(v: unknown): string {
    if (v == null) return '';
    if (typeof v === 'object' && '_value' in (v as object)) return String((v as { _value: unknown })._value);
    return String(v);
  }

  const EDITABLE_PREFIXES = [
    'Device.DeviceInfo.FriendlyName',
    'Device.DeviceInfo.Location',
    'Device.ManagementServer.',
    'Device.WANDevice.',
    'InternetGatewayDevice.DeviceInfo.FriendlyName',
    'InternetGatewayDevice.DeviceInfo.Location'
  ];

  $: displayParams = Object.entries(parameters)
    .filter(([path]) => EDITABLE_PREFIXES.some((p) => path === p || path.startsWith(p)))
    .slice(0, 25);

  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose} on:keydown={(e) => e.key === 'Escape' && handleClose()}>
    <div class="modal-content" on:click|stopPropagation role="dialog" aria-modal="true" aria-labelledby="param-editor-title">
      <div class="modal-header">
        <h2 id="param-editor-title">Edit Parameters - {device?.id}</h2>
        <button type="button" class="close-btn" on:click={handleClose} aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        {#if loading}
          <p>Loading parameters…</p>
        {:else if error}
          <p class="error">{error}</p>
          <button type="button" class="btn" on:click={loadParameters}>Retry</button>
        {:else if success}
          <p class="success">{success}</p>
        {:else}
          <p class="hint">Edit writable parameters. Changes are sent to the device via TR-069.</p>
          <div class="params-list">
            {#each displayParams as [path, rawValue]}
              {@const value = formatValue(rawValue)}
              {@const displayPath = path.split('.').slice(-2).join('.')}
              <div class="param-row">
                <label for="param-{path}">{displayPath}</label>
                <input
                  id="param-{path}"
                  type="text"
                  value={editedParams[path] ?? value}
                  on:input={(e) => setEdited(path, e.currentTarget.value)}
                  placeholder={value}
                />
              </div>
            {/each}
          </div>
          {#if Object.keys(editedParams).length > 0}
            <div class="actions">
              <button type="button" class="btn btn-primary" on:click={saveParameters} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" class="btn" on:click={() => editedParams = {}}>Reset</button>
            </div>
          {/if}
        {/if}
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
    z-index: 2000;
  }
  .modal-content {
    background: var(--bg-primary);
    border-radius: 12px;
    max-width: 520px;
    width: 90%;
    max-height: 80vh;
    overflow: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color);
  }
  .modal-header h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
  }
  .modal-body {
    padding: 1.25rem;
  }
  .hint {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }
  .params-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .param-row {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 0.5rem;
    align-items: center;
  }
  .param-row label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    word-break: break-all;
  }
  .param-row input {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-family: monospace;
    font-size: 0.9rem;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .error { color: var(--error-color, #ef4444); }
  .success { color: var(--success-color, #10b981); }
</style>
