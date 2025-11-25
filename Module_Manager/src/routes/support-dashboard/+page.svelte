<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authService } from '$lib/services/authService';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { getApiUrl } from '$lib/config/api';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';

  const API_URL = getApiUrl();

  let loading = true;
  let tenantId = '';
  let tenantName = '';

  // Stats
  let stats = {
    activeAlerts: 0,
    pendingTickets: 0,
    openChats: 0,
    totalCustomers: 0
  };

  // Recent tickets
  interface Ticket {
    _id: string;
    subject: string;
    status: string;
    priority: string;
    customerName?: string;
    createdAt: string;
  }
  let recentTickets: Ticket[] = [];

  // Active alerts
  interface Alert {
    _id: string;
    title: string;
    type: string;
    status: string;
    message: string;
  }
  let activeAlerts: Alert[] = [];

  // Live chats (placeholder)
  let activeChats: any[] = [];

  onMount(() => {
    const unsubscribe = currentTenant.subscribe(async (tenant) => {
      if (tenant?.id) {
        tenantId = tenant.id;
        tenantName = tenant.displayName || tenant.name || '';
        await loadDashboardData();
      }
    });

    return () => unsubscribe();
  });

  async function loadDashboardData() {
    loading = true;
    try {
      const token = await authService.getIdToken();
      
      // Load alerts
      try {
        const alertsRes = await fetch(`${API_URL}/portal-content/${tenantId}/alerts/active`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (alertsRes.ok) {
          activeAlerts = await alertsRes.json();
          stats.activeAlerts = activeAlerts.length;
        }
      } catch (e) {
        console.error('Error loading alerts:', e);
      }

      // Load recent tickets (from help desk)
      try {
        const ticketsRes = await fetch(`${API_URL}/help-desk/tickets?limit=10&tenantId=${tenantId}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId
          }
        });
        if (ticketsRes.ok) {
          const data = await ticketsRes.json();
          recentTickets = data.tickets || data || [];
          stats.pendingTickets = recentTickets.filter((t: Ticket) => t.status === 'open' || t.status === 'pending').length;
        }
      } catch (e) {
        console.error('Error loading tickets:', e);
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      loading = false;
    }
  }

  function getAlertIcon(type: string) {
    switch (type) {
      case 'outage': return '🔴';
      case 'maintenance': return '🟡';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  }

  function getTicketPriorityClass(priority: string) {
    switch (priority) {
      case 'urgent': return 'priority-urgent';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      default: return 'priority-low';
    }
  }

  function getStatusClass(status: string) {
    switch (status) {
      case 'open': return 'status-open';
      case 'pending': return 'status-pending';
      case 'resolved': return 'status-resolved';
      case 'closed': return 'status-closed';
      default: return '';
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<TenantGuard>
  <div class="support-dashboard">
    <header class="dashboard-header">
      <div class="header-content">
        <h1>🎧 Customer Support Dashboard</h1>
        <p class="subtitle">{tenantName} - Support Portal</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" on:click={() => goto('/modules/customers/portal-setup')}>
          ⚙️ Portal Settings
        </button>
      </div>
    </header>

    {#if loading}
      <div class="loading-container">
        <div class="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    {:else}
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card alerts">
          <div class="stat-icon">🚨</div>
          <div class="stat-content">
            <div class="stat-value">{stats.activeAlerts}</div>
            <div class="stat-label">Active Alerts</div>
          </div>
        </div>
        
        <div class="stat-card tickets">
          <div class="stat-icon">🎫</div>
          <div class="stat-content">
            <div class="stat-value">{stats.pendingTickets}</div>
            <div class="stat-label">Pending Tickets</div>
          </div>
        </div>
        
        <div class="stat-card chats">
          <div class="stat-icon">💬</div>
          <div class="stat-content">
            <div class="stat-value">{stats.openChats}</div>
            <div class="stat-label">Open Chats</div>
          </div>
        </div>
        
        <div class="stat-card customers">
          <div class="stat-icon">👥</div>
          <div class="stat-content">
            <div class="stat-value">{stats.totalCustomers}</div>
            <div class="stat-label">Customers</div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <h2>Quick Actions</h2>
        <div class="actions-grid">
          <button class="action-card" on:click={() => goto('/modules/customers/portal-setup?tab=alerts')}>
            <span class="action-icon">🚨</span>
            <span class="action-label">Manage Alerts</span>
          </button>
          
          <button class="action-card" on:click={() => goto('/modules/customers/portal-setup?tab=faq')}>
            <span class="action-icon">❓</span>
            <span class="action-label">Edit FAQ</span>
          </button>
          
          <button class="action-card" on:click={() => goto('/modules/customers/portal-setup?tab=knowledge')}>
            <span class="action-icon">📚</span>
            <span class="action-label">Knowledge Base</span>
          </button>
          
          <button class="action-card" on:click={() => goto('/modules/customers/portal-setup?tab=chat')}>
            <span class="action-icon">💬</span>
            <span class="action-label">Chat Settings</span>
          </button>
          
          <button class="action-card" on:click={() => goto('/modules/help-desk')}>
            <span class="action-icon">🎫</span>
            <span class="action-label">Help Desk</span>
          </button>
          
          <button class="action-card" on:click={() => goto('/modules/customers')}>
            <span class="action-icon">👥</span>
            <span class="action-label">Customers</span>
          </button>
        </div>
      </div>

      <!-- Active Alerts Section -->
      {#if activeAlerts.length > 0}
        <div class="section">
          <div class="section-header">
            <h2>🚨 Active Alerts</h2>
            <button class="btn-link" on:click={() => goto('/modules/customers/portal-setup?tab=alerts')}>
              Manage All →
            </button>
          </div>
          <div class="alerts-list">
            {#each activeAlerts as alert}
              <div class="alert-item {alert.type}">
                <span class="alert-icon">{getAlertIcon(alert.type)}</span>
                <div class="alert-content">
                  <h4>{alert.title}</h4>
                  <p>{alert.message}</p>
                </div>
                <span class="alert-status">{alert.status}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Recent Tickets Section -->
      <div class="section">
        <div class="section-header">
          <h2>🎫 Recent Support Tickets</h2>
          <button class="btn-link" on:click={() => goto('/modules/help-desk')}>
            View All →
          </button>
        </div>
        
        {#if recentTickets.length === 0}
          <div class="empty-state">
            <p>No recent tickets</p>
          </div>
        {:else}
          <div class="tickets-list">
            {#each recentTickets as ticket}
              <div class="ticket-item" on:click={() => goto(`/modules/help-desk?ticket=${ticket._id}`)}>
                <div class="ticket-main">
                  <h4>{ticket.subject}</h4>
                  <p class="ticket-meta">
                    {ticket.customerName || 'Customer'} • {formatDate(ticket.createdAt)}
                  </p>
                </div>
                <div class="ticket-badges">
                  <span class="priority-badge {getTicketPriorityClass(ticket.priority)}">{ticket.priority}</span>
                  <span class="status-badge {getStatusClass(ticket.status)}">{ticket.status}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</TenantGuard>

<style>
  .support-dashboard {
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
    min-height: 100vh;
    background: var(--bg-primary);
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .dashboard-header h1 {
    margin: 0 0 0.25rem 0;
    font-size: 2rem;
    color: var(--text-primary);
  }

  .subtitle {
    margin: 0;
    color: var(--text-secondary);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .stat-icon {
    font-size: 2.5rem;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .stat-label {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .quick-actions {
    margin-bottom: 2rem;
  }

  .quick-actions h2 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.25rem;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 1rem;
  }

  .action-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem 1rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-card:hover {
    background: var(--bg-secondary);
    border-color: var(--brand-primary);
    transform: translateY(-2px);
  }

  .action-icon {
    font-size: 2rem;
  }

  .action-label {
    font-weight: 500;
    color: var(--text-primary);
    text-align: center;
    font-size: 0.9rem;
  }

  .section {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--brand-primary);
    cursor: pointer;
    font-weight: 500;
  }

  .btn-link:hover {
    text-decoration: underline;
  }

  .alerts-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .alert-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    border-left: 4px solid var(--border-color);
  }

  .alert-item.outage {
    border-left-color: var(--danger);
    background: rgba(239, 68, 68, 0.1);
  }

  .alert-item.maintenance {
    border-left-color: var(--warning);
    background: rgba(245, 158, 11, 0.1);
  }

  .alert-item.warning {
    border-left-color: var(--warning);
  }

  .alert-icon {
    font-size: 1.5rem;
  }

  .alert-content {
    flex: 1;
  }

  .alert-content h4 {
    margin: 0 0 0.25rem 0;
    color: var(--text-primary);
  }

  .alert-content p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .alert-status {
    padding: 0.25rem 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .tickets-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .ticket-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: background 0.2s;
  }

  .ticket-item:hover {
    background: var(--bg-tertiary);
  }

  .ticket-main h4 {
    margin: 0 0 0.25rem 0;
    color: var(--text-primary);
    font-size: 0.95rem;
  }

  .ticket-meta {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .ticket-badges {
    display: flex;
    gap: 0.5rem;
  }

  .priority-badge, .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .priority-urgent { background: var(--danger); color: white; }
  .priority-high { background: var(--warning); color: white; }
  .priority-medium { background: var(--brand-primary); color: white; }
  .priority-low { background: var(--bg-tertiary); color: var(--text-secondary); }

  .status-open { background: var(--success-light); color: var(--success); }
  .status-pending { background: var(--warning-light); color: var(--warning); }
  .status-resolved { background: var(--bg-tertiary); color: var(--text-secondary); }
  .status-closed { background: var(--bg-tertiary); color: var(--text-muted); }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(59, 130, 246, 0.1);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .btn-secondary {
    padding: 0.75rem 1.25rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    color: var(--text-primary);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: var(--bg-tertiary);
    border-color: var(--brand-primary);
  }

  @media (max-width: 1200px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .actions-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 768px) {
    .support-dashboard {
      padding: 1rem;
    }

    .dashboard-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .stats-grid {
      grid-template-columns: 1fr 1fr;
    }

    .actions-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .ticket-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
  }
</style>

