<script lang="ts">
  import { onMount } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { workOrderService, type WorkOrder } from '$lib/services/workOrderService';
  import CreateTicketModal from './components/CreateTicketModal.svelte';
  import TicketDetailsModal from './components/TicketDetailsModal.svelte';
  import CustomerLookupModal from './components/CustomerLookupModal.svelte';
  import APKDownload from '$lib/components/APKDownload.svelte';
  
  let tickets: WorkOrder[] = [];
  let filteredTickets: WorkOrder[] = [];
  let loading = true;
  let error = '';
  
  let searchQuery = '';
  let statusFilter: WorkOrder['status'] | 'all' = 'all';
  let priorityFilter: WorkOrder['priority'] | 'all' = 'all';
  
  let showCreateModal = false;
  let showDetailsModal = false;
  let showCustomerLookup = false;
  let selectedTicket: WorkOrder | null = null;
  
  // Stats
  let stats = {
    open: 0,
    inProgress: 0,
    resolved: 0,
    avgResolutionTime: '0h'
  };
  
  onMount(async () => {
    await loadTickets();
  });
  
  async function loadTickets() {
    if (!$currentTenant) return;
    
    loading = true;
    error = '';
    
    try {
      tickets = await workOrderService.getWorkOrders();
      calculateStats();
      applyFilters();
    } catch (err: any) {
      error = err.message || 'Failed to load tickets';
      console.error('Error loading tickets:', err);
    } finally {
      loading = false;
    }
  }
  
  function calculateStats() {
    stats.open = tickets.filter(t => t.status === 'open').length;
    stats.inProgress = tickets.filter(t => t.status === 'in-progress' || t.status === 'assigned').length;
    stats.resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    
    // Calculate average resolution time (simplified)
    const resolved = tickets.filter(t => t.status === 'resolved' && t.createdAt && t.resolvedAt);
    if (resolved.length > 0) {
      const totalHours = resolved.reduce((sum, t) => {
        const created = new Date(t.createdAt!).getTime();
        const resolvedTime = new Date(t.resolvedAt!).getTime();
        return sum + (resolvedTime - created) / (1000 * 60 * 60);
      }, 0);
      stats.avgResolutionTime = Math.round(totalHours / resolved.length) + 'h';
    }
  }
  
  function applyFilters() {
    filteredTickets = tickets.filter(ticket => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          ticket.ticketNumber?.toLowerCase().includes(query) ||
          ticket.title?.toLowerCase().includes(query) ||
          ticket.description?.toLowerCase().includes(query) ||
          ticket.affectedCustomers?.some(c => c.customerName?.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }
      
      // Status filter
      if (statusFilter !== 'all' && ticket.status !== statusFilter) {
        return false;
      }
      
      // Priority filter
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) {
        return false;
      }
      
      return true;
    });
    
    // Sort by priority and date
    filteredTickets.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
    });
  }
  
  function handleSearch() {
    applyFilters();
  }
  
  function openCreateModal() {
    showCreateModal = true;
  }
  
  function closeCreateModal() {
    showCreateModal = false;
    loadTickets();
  }
  
  function openTicketDetails(ticket: WorkOrder) {
    selectedTicket = ticket;
    showDetailsModal = true;
  }
  
  function closeDetailsModal() {
    showDetailsModal = false;
    selectedTicket = null;
    loadTickets();
  }
  
  function openCustomerLookup() {
    showCustomerLookup = true;
  }
  
  function closeCustomerLookup() {
    showCustomerLookup = false;
  }
  
  function getPriorityBadgeClass(priority: string): string {
    switch (priority) {
      case 'critical': return 'badge-critical';
      case 'high': return 'badge-high';
      case 'medium': return 'badge-medium';
      case 'low': return 'badge-low';
      default: return 'badge-neutral';
    }
  }
  
  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'open': return 'badge-open';
      case 'assigned': return 'badge-assigned';
      case 'in-progress': return 'badge-in-progress';
      case 'waiting-parts': return 'badge-waiting';
      case 'resolved': return 'badge-resolved';
      case 'closed': return 'badge-closed';
      default: return 'badge-neutral';
    }
  }
  
  function formatTimeAgo(dateString: string | Date | undefined): string {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
</script>

<div class="help-desk-container">
  <div class="header">
    <div class="title-section">
      <h1>🎧 Help Desk</h1>
      <p class="subtitle">Customer support and ticket management for {$currentTenant?.name || 'your organization'}</p>
    </div>
    
    <div class="header-actions">
      <button class="btn btn-secondary" on:click={openCustomerLookup}>
        🔍 Customer Lookup
      </button>
      <button class="btn btn-primary" on:click={openCreateModal}>
        ➕ Create Ticket
      </button>
    </div>
  </div>
  
  {#if error}
    <div class="alert alert-error">
      <span>❌</span>
      <span>{error}</span>
      <button on:click={() => error = ''}>✕</button>
    </div>
  {/if}
  
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon open">📋</div>
      <div class="stat-content">
        <div class="stat-value">{stats.open}</div>
        <div class="stat-label">Open Tickets</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon in-progress">⚙️</div>
      <div class="stat-content">
        <div class="stat-value">{stats.inProgress}</div>
        <div class="stat-label">In Progress</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon resolved">✅</div>
      <div class="stat-content">
        <div class="stat-value">{stats.resolved}</div>
        <div class="stat-label">Resolved</div>
      </div>
    </div>
    
    <div class="stat-card">
      <div class="stat-icon time">⏱️</div>
      <div class="stat-content">
        <div class="stat-value">{stats.avgResolutionTime}</div>
        <div class="stat-label">Avg Resolution</div>
      </div>
    </div>
  </div>
  
  <!-- Mobile App Download -->
  <div style="margin-bottom: 2rem;">
    <APKDownload />
  </div>
  
  <div class="filters">
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input
        type="text"
        placeholder="Search tickets, customers..."
        bind:value={searchQuery}
        on:input={handleSearch}
      />
    </div>
    
    <select bind:value={statusFilter} on:change={() => applyFilters()} class="select">
      <option value="all">All Status</option>
      <option value="open">Open</option>
      <option value="assigned">Assigned</option>
      <option value="in-progress">In Progress</option>
      <option value="waiting-parts">Waiting Parts</option>
      <option value="resolved">Resolved</option>
      <option value="closed">Closed</option>
    </select>
    
    <select bind:value={priorityFilter} on:change={() => applyFilters()} class="select">
      <option value="all">All Priority</option>
      <option value="critical">Critical</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
    
    <div class="results-count">
      {filteredTickets.length} of {tickets.length} tickets
    </div>
  </div>
  
  {#if loading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading tickets...</p>
    </div>
  {:else if filteredTickets.length === 0}
    <div class="empty-state">
      <span class="empty-icon">🎧</span>
      <h3>No tickets found</h3>
      {#if searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'}
        <p>Try adjusting your filters</p>
        <button class="btn btn-secondary" on:click={() => { searchQuery = ''; statusFilter = 'all'; priorityFilter = 'all'; applyFilters(); }}>
          Clear Filters
        </button>
      {:else}
        <p>All caught up! No pending tickets.</p>
        <button class="btn btn-primary" on:click={openCreateModal}>
          Create First Ticket
        </button>
      {/if}
    </div>
  {:else}
    <div class="tickets-grid">
      {#each filteredTickets as ticket (ticket._id)}
        <div class="ticket-card" on:click={() => openTicketDetails(ticket)}>
          <div class="ticket-header">
            <div class="ticket-number">{ticket.ticketNumber || ticket._id}</div>
            <div class="badges">
              <span class="badge {getPriorityBadgeClass(ticket.priority)}">
                {ticket.priority}
              </span>
              <span class="badge {getStatusBadgeClass(ticket.status)}">
                {ticket.status}
              </span>
            </div>
          </div>
          
          <h3 class="ticket-title">{ticket.title}</h3>
          
          {#if ticket.description}
            <p class="ticket-description">{ticket.description.substring(0, 100)}{ticket.description.length > 100 ? '...' : ''}</p>
          {/if}
          
          <div class="ticket-meta">
            {#if ticket.affectedCustomers && ticket.affectedCustomers.length > 0}
              <div class="meta-item">
                <span class="meta-icon">👤</span>
                <span class="meta-text">{ticket.affectedCustomers[0].customerName}</span>
              </div>
            {/if}
            
            {#if ticket.assignedToName}
              <div class="meta-item">
                <span class="meta-icon">👷</span>
                <span class="meta-text">{ticket.assignedToName}</span>
              </div>
            {/if}
            
            <div class="meta-item">
              <span class="meta-icon">🕒</span>
              <span class="meta-text">{formatTimeAgo(ticket.createdAt)}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showCreateModal}
  <CreateTicketModal on:close={closeCreateModal} />
{/if}

{#if showDetailsModal && selectedTicket}
  <TicketDetailsModal ticket={selectedTicket} on:close={closeDetailsModal} />
{/if}

{#if showCustomerLookup}
  <CustomerLookupModal on:close={closeCustomerLookup} />
{/if}

<style>
  .help-desk-container {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }
  
  .title-section h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
  }
  
  .subtitle {
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }
  
  .header-actions {
    display: flex;
    gap: 1rem;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .stat-card {
    background: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .stat-icon {
    font-size: 2rem;
    width: 60px;
    height: 60px;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .stat-icon.open { background: #fef3c7; }
  .stat-icon.in-progress { background: #dbeafe; }
  .stat-icon.resolved { background: #d1fae5; }
  .stat-icon.time { background: #e0e7ff; }
  
  .stat-content {
    flex: 1;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.25rem;
  }
  
  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .search-box {
    position: relative;
    flex: 1;
    min-width: 300px;
  }
  
  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.5;
  }
  
  .search-box input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 3rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 1rem;
  }
  
  .select {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: white;
    cursor: pointer;
  }
  
  .results-count {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-left: auto;
  }
  
  .tickets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1rem;
  }
  
  .ticket-card {
    background: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    cursor: pointer;
    transition: all 0.2s;
    border: 2px solid transparent;
  }
  
  .ticket-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    border-color: var(--primary);
  }
  
  .ticket-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }
  
  .ticket-number {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
  }
  
  .badges {
    display: flex;
    gap: 0.5rem;
  }
  
  .badge {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }
  
  .badge-critical { background: #fee2e2; color: #991b1b; }
  .badge-high { background: #fed7aa; color: #9a3412; }
  .badge-medium { background: #fef3c7; color: #92400e; }
  .badge-low { background: #dbeafe; color: #1e40af; }
  
  .badge-open { background: #fef3c7; color: #92400e; }
  .badge-assigned { background: #e0e7ff; color: #3730a3; }
  .badge-in-progress { background: #dbeafe; color: #1e40af; }
  .badge-waiting { background: #fed7aa; color: #9a3412; }
  .badge-resolved { background: #d1fae5; color: #065f46; }
  .badge-closed { background: #f3f4f6; color: #374151; }
  
  .ticket-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
    color: var(--text-primary);
  }
  
  .ticket-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
    line-height: 1.5;
  }
  
  .ticket-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .meta-icon {
    opacity: 0.7;
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }
  
  .btn-primary { background: var(--primary); color: white; }
  .btn-secondary { background: #6b7280; color: white; }
  
  .btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .alert {
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  
  .alert-error {
    background: #fee;
    border: 1px solid #fcc;
    color: #c00;
  }
  
  .alert button {
    margin-left: auto;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    opacity: 0.5;
  }
  
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem;
    text-align: center;
  }
  
  .empty-icon {
    font-size: 4rem;
    opacity: 0.3;
    margin-bottom: 1rem;
  }
  
  .empty-state h3 {
    margin: 0 0 0.5rem;
  }
  
  .empty-state p {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
  }
</style>

