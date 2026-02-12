<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth } from '$lib/firebase';
  import { authService } from '$lib/services/authService';
  import AddSubscriberModal from './AddSubscriberModal.svelte';
  import SubscriberDetailsModal from './SubscriberDetailsModal.svelte';
  
  export let tenantId: string;
  export let HSS_API: string;
  export let groups: any[] = [];
  export let bandwidthPlans: any[] = [];
  
  let subscribers: any[] = [];
  let loading = true;
  let searchQuery = '';
  let statusFilter = 'all';
  let groupFilter = 'all';
  
  let showAddModal = false;
  let selectedSubscriber: any = null;
  let showDetailsModal = false;
  
  // Listen for quick actions
  function handleQuickAction(event: CustomEvent) {
    if (event.detail.action === 'add') {
      showAddModal = true;
    }
  }
  
  onMount(async () => {
    await loadGroups();
    await loadSubscribers();
    
    // Listen for quick action events
    window.addEventListener('quick-action' as any, handleQuickAction as any);
  });
  
  onDestroy(() => {
    window.removeEventListener('quick-action' as any, handleQuickAction as any);
  });
  
  async function loadGroups() {
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await authService.getAuthTokenForApi();
      const response = await fetch(`${HSS_API}/groups`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        groups = data.groups || [];
      }
    } catch (err) {
      console.error('Error loading groups:', err);
    }
  }
  
  async function loadSubscribers() {
    try {
      loading = true;
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await authService.getAuthTokenForApi();
      
      let url = `${HSS_API}/subscribers?`;
      if (statusFilter !== 'all') url += `status=${statusFilter}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
      if (groupFilter !== 'all') url += `group_id=${groupFilter}&`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        subscribers = data.subscribers || [];
      }
    } catch (err) {
      console.error('Error loading subscribers:', err);
    } finally {
      loading = false;
    }
  }
  
  async function toggleSubscriber(imsi: string, currentStatus: string) {
    const action = currentStatus === 'active' ? 'disable' : 'enable';
    const confirmMsg = currentStatus === 'active' 
      ? 'Are you sure you want to disable this subscriber?' 
      : 'Enable this subscriber?';
    
    if (!confirm(confirmMsg)) return;
    
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await authService.getAuthTokenForApi();
      const response = await fetch(`${HSS_API}/subscribers/${imsi}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: action === 'disable' ? 'Manual action' : undefined
        })
      });
      
      if (response.ok) {
        await loadSubscribers();
        alert(`Subscriber ${action}d successfully`);
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to ' + action + ' subscriber'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  }
  
  function viewDetails(subscriber: any) {
    selectedSubscriber = subscriber;
    showDetailsModal = true;
  }
  
  function formatDate(date: string) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  }
</script>

<div class="subscriber-list">
  <div class="list-header">
    <h2>Subscribers</h2>
    <button class="add-btn" on:click={() => showAddModal = true}>
      ➕ Add Subscriber
    </button>
  </div>
  
  <!-- Filters -->
  <div class="filters">
    <input 
      type="text" 
      placeholder="Search by IMSI, name, or email..." 
      bind:value={searchQuery}
      on:input={loadSubscribers}
      class="search-input"
    />
    
    <select bind:value={statusFilter} on:change={loadSubscribers} class="filter-select">
      <option value="all">All Status</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
      <option value="suspended">Suspended</option>
    </select>
    
    <select bind:value={groupFilter} on:change={loadSubscribers} class="filter-select">
      <option value="all">All Groups</option>
      {#each groups as group}
        <option value={group.group_id}>{group.group_name}</option>
      {/each}
    </select>
  </div>
  
  {#if loading}
    <div class="loading">Loading subscribers...</div>
  {:else if subscribers.length === 0}
    <div class="empty-state">
      <div class="empty-icon">👤</div>
      <h3>No subscribers found</h3>
      <p>Add your first subscriber to get started</p>
      <button class="add-btn" on:click={() => showAddModal = true}>
        ➕ Add Subscriber
      </button>
    </div>
  {:else}
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>IMSI</th>
            <th>Name</th>
            <th>Group</th>
            <th>Status</th>
            <th>IMEI</th>
            <th>CPE Status</th>
            <th>Last Seen</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each subscribers as sub}
            <tr>
              <td class="imsi">{sub.imsi}</td>
              <td>{sub.user_info?.full_name || 'N/A'}</td>
              <td>
                {#if sub.group_membership?.group_name}
                  <span class="group-badge">{sub.group_membership.group_name}</span>
                {:else}
                  <span class="text-muted">No group</span>
                {/if}
              </td>
              <td>
                <span class="status-badge status-{sub.status}">
                  {sub.status}
                </span>
              </td>
              <td class="imei">{sub.device_info?.imei || 'Not captured'}</td>
              <td>
                {#if sub.cpe}
                  <span class="cpe-status" class:online={sub.cpe.online}>
                    {sub.cpe.online ? '🟢 Online' : '🔴 Offline'}
                  </span>
                {:else}
                  <span class="text-muted">No CPE</span>
                {/if}
              </td>
              <td class="text-small">{formatDate(sub.device_info?.last_seen)}</td>
              <td>
                <div class="actions">
                  <button 
                    class="action-icon"
                    on:click={() => viewDetails(sub)}
                    title="View Details"
                  >
                    👁️
                  </button>
                  <button 
                    class="action-icon {sub.status === 'active' ? 'danger' : 'success'}"
                    on:click={() => toggleSubscriber(sub.imsi, sub.status)}
                    title={sub.status === 'active' ? 'Disable' : 'Enable'}
                  >
                    {sub.status === 'active' ? '🚫' : '✅'}
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

{#if showAddModal}
  <AddSubscriberModal 
    {tenantId} 
    {HSS_API}
    {groups}
    {bandwidthPlans}
    on:close={() => showAddModal = false}
    on:success={loadSubscribers}
  />
{/if}

{#if showDetailsModal && selectedSubscriber}
  <SubscriberDetailsModal 
    subscriber={selectedSubscriber}
    {HSS_API}
    on:close={() => {
      showDetailsModal = false;
      selectedSubscriber = null;
    }}
    on:updated={loadSubscribers}
  />
{/if}

<style>
  .subscriber-list {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }
  
  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .list-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary);
  }
  
  .add-btn {
    padding: 0.625rem 1.25rem;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.2s;
  }
  
  .add-btn:hover {
    background: var(--primary-hover);
  }
  
  .filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .search-input {
    flex: 1;
    padding: 0.625rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 0.875rem;
  }
  
  .filter-select {
    padding: 0.625rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 0.875rem;
    background: white;
    cursor: pointer;
  }
  
  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }
  
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
  }
  
  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  .empty-state h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }
  
  .empty-state p {
    margin: 0 0 1.5rem 0;
    color: var(--text-secondary);
  }
  
  .table-container {
    overflow-x: auto;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  thead {
    background: var(--bg-secondary);
    border-bottom: 2px solid var(--border-color);
  }
  
  th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-secondary);
    white-space: nowrap;
  }
  
  td {
    padding: 1rem;
    border-bottom: 1px solid var(--border-light);
    font-size: 0.875rem;
  }
  
  tr:hover {
    background: var(--bg-secondary);
  }
  
  .imsi {
    font-family: 'Courier New', monospace;
    font-weight: 600;
    color: #2563eb;
  }
  
  .imei {
    font-family: 'Courier New', monospace;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }
  
  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .status-active {
    background: #d1fae5;
    color: #065f46;
  }
  
  .status-inactive {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .status-suspended {
    background: #fed7aa;
    color: #92400e;
  }
  
  .group-badge {
    display: inline-block;
    padding: 0.25rem 0.625rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .cpe-status {
    font-size: 0.875rem;
  }
  
  .cpe-status.online {
    color: #059669;
    font-weight: 500;
  }
  
  .text-muted {
    color: #9ca3af;
  }
  
  .text-small {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }
  
  .actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .action-icon {
    padding: 0.375rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.125rem;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .action-icon:hover {
    opacity: 1;
  }
  
  .action-icon.danger {
    filter: hue-rotate(-10deg);
  }
  
  .action-icon.success {
    filter: hue-rotate(100deg);
  }
  
  @media (max-width: 768px) {
    .filters {
      flex-direction: column;
    }
    
    table {
      font-size: 0.8125rem;
    }
    
    th, td {
      padding: 0.5rem;
    }
  }
</style>

