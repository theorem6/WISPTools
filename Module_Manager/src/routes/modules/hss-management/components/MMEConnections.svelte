<script lang="ts">
  import { onMount } from 'svelte';

  export let tenantId: string;
  export let HSS_API: string;

  let connections: any[] = [];
  let loading = false;
  let error = '';
  let lastUpdated: Date | null = null;

  const getApiBase = () => {
    if (HSS_API && HSS_API.endsWith('/hss')) {
      return HSS_API.replace(/\/hss$/, '');
    }
    return '/api';
  };

  async function loadConnections() {
    if (!tenantId) return;
    loading = true;
    error = '';
    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/remote-agents/status?tenant_id=${tenantId}&include_offline=true`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load MME connections');
      }
      connections = Array.isArray(data?.epc_agents) ? data.epc_agents : [];
      lastUpdated = new Date();
    } catch (err: any) {
      console.error('[MME Connections] Failed to load:', err);
      error = err?.message || 'Failed to load MME connections';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (tenantId) {
      loadConnections();
    }
  });

  $: if (tenantId) {
    loadConnections();
  }
</script>

<div class="mme-connections">
  <div class="header">
    <div>
      <h2>MME Connections</h2>
      <p class="subtitle">Remote EPC agents reporting subscriber status</p>
    </div>
    <button class="btn-secondary" on:click={loadConnections} disabled={loading}>
      {loading ? 'Refreshing...' : 'Refresh'}
    </button>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  {#if loading}
    <div class="loading">Loading MME connections...</div>
  {:else if connections.length === 0}
    <div class="empty-state">
      <p>No EPC agents reporting yet for this tenant.</p>
    </div>
  {:else}
    <div class="connections-table">
      <div class="table-row table-header">
        <span>EPC ID</span>
        <span>Status</span>
        <span>Check-in</span>
        <span>Site</span>
        <span>Customers</span>
      </div>
      {#each connections as connection}
        <div class="table-row">
          <span class="mono">{connection.epc_id}</span>
          <span class={`status ${connection.checkin_status || 'unknown'}`}>
            {connection.checkin_status || 'unknown'}
          </span>
          <span>
            {#if connection.last_checkin}
              {new Date(connection.last_checkin).toLocaleString()}
            {:else}
              Never
            {/if}
          </span>
          <span>{connection.site_name || 'Unknown'}</span>
          <span>
            {connection.metrics?.customer_count?.online ?? 0} /
            {connection.metrics?.customer_count?.total ?? 0}
          </span>
        </div>
      {/each}
    </div>
  {/if}

  {#if lastUpdated}
    <p class="timestamp">Last updated {lastUpdated.toLocaleString()}</p>
  {/if}
</div>

<style>
  .mme-connections {
    padding: 2rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .subtitle {
    margin: 0.25rem 0 0;
    color: var(--text-secondary);
  }

  .connections-table {
    display: grid;
    gap: 0.5rem;
  }

  .table-row {
    display: grid;
    grid-template-columns: 1.2fr 0.7fr 1.3fr 1fr 0.8fr;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--bg-primary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .table-header {
    font-weight: 600;
    color: var(--text-secondary);
    background: transparent;
    border: none;
  }

  .mono {
    font-family: monospace;
  }

  .status {
    text-transform: capitalize;
  }

  .status.active {
    color: #10b981;
  }

  .status.recent {
    color: #3b82f6;
  }

  .status.stale,
  .status.offline {
    color: #f59e0b;
  }

  .status.never,
  .status.unknown {
    color: #94a3b8;
  }

  .loading,
  .empty-state {
    padding: 1rem;
    color: var(--text-secondary);
  }

  .timestamp {
    margin-top: 0.75rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 0.9rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }
</style>



