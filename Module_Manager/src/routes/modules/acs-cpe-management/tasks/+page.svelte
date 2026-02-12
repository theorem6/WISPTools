<script lang="ts">
  import { onMount } from 'svelte';
  import MainMenu from '../components/MainMenu.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';

  let tasks: any[] = [];
  let isLoading = false;
  let error = '';
  let deviceFilter = '';

  onMount(() => {
    loadTasks();
  });

  async function loadTasks() {
    if (!$currentTenant?.id) return;
    isLoading = true;
    error = '';
    try {
      const { authService } = await import('$lib/services/authService');
      const user = authService.getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      const token = await authService.getAuthTokenForApi();
      let url = '/api/tr069/tasks';
      if (deviceFilter) url += `?device=${encodeURIComponent(deviceFilter)}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': $currentTenant.id
        }
      });
      const data = await response.json();
      if (data.success) {
        tasks = data.tasks || [];
      } else {
        throw new Error(data.error || 'Failed to load tasks');
      }
    } catch (e: any) {
      error = e.message || 'Failed to load task queue';
      tasks = [];
    } finally {
      isLoading = false;
    }
  }

  function formatDate(val: string | number | undefined) {
    if (!val) return '—';
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
  }
</script>

<svelte:head>
  <title>Task Queue – ACS CPE Management</title>
</svelte:head>

<div class="tasks-page">
  <MainMenu />
  <main class="content">
    <header class="page-header">
      <h1>TR-069 Task Queue</h1>
      <p class="subtitle">Pending and recent tasks sent to CPE devices via GenieACS.</p>
    </header>

    <div class="toolbar">
      <input
        type="text"
        placeholder="Filter by device ID"
        bind:value={deviceFilter}
        on:keydown={(e) => e.key === 'Enter' && loadTasks()}
        class="filter-input"
      />
      <button class="btn-primary" on:click={loadTasks} disabled={isLoading}>
        {isLoading ? 'Loading…' : 'Refresh'}
      </button>
    </div>

    {#if error}
      <div class="error-banner">{error}</div>
    {/if}

    {#if isLoading && tasks.length === 0}
      <div class="loading">Loading task queue…</div>
    {:else if tasks.length === 0}
      <div class="empty">No tasks in the queue. Tasks appear when you reboot, refresh, or run operations on devices.</div>
    {:else}
      <div class="table-wrap">
        <table class="tasks-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Name</th>
              <th>Status</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {#each tasks as task (task._id || task.timestamp + task.device)}
              <tr>
                <td><code>{task.device || '—'}</code></td>
                <td>{task.name || '—'}</td>
                <td><span class="status">{task.status ?? 'pending'}</span></td>
                <td>{formatDate(task.timestamp)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </main>
</div>

<style>
  .tasks-page {
    display: flex;
    gap: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem;
  }
  .content {
    flex: 1;
    min-width: 0;
  }
  .page-header {
    margin-bottom: 1.5rem;
  }
  .page-header h1 {
    font-size: 1.75rem;
    margin: 0 0 0.25rem 0;
  }
  .subtitle {
    color: var(--text-secondary, #6b7280);
    margin: 0;
    font-size: 0.95rem;
  }
  .toolbar {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .filter-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 6px;
    min-width: 220px;
  }
  .btn-primary {
    padding: 0.5rem 1rem;
    background: var(--primary, #3b82f6);
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .error-banner {
    padding: 0.75rem 1rem;
    background: #fef2f2;
    color: #b91c1c;
    border-radius: 8px;
    margin-bottom: 1rem;
  }
  .loading, .empty {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary, #6b7280);
  }
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
  }
  .tasks-table {
    width: 100%;
    border-collapse: collapse;
  }
  .tasks-table th,
  .tasks-table td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }
  .tasks-table th {
    background: var(--bg-secondary, #f9fafb);
    font-weight: 600;
  }
  .tasks-table tbody tr:last-child td {
    border-bottom: none;
  }
  .tasks-table code {
    font-size: 0.875rem;
    background: var(--bg-secondary, #f3f4f6);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
  }
  .status {
    text-transform: capitalize;
  }
</style>
