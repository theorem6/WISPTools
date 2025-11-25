<script lang="ts">
  import { onMount } from 'svelte';
  import { customerAuthService } from '$lib/services/customerAuthService';
  import { customerPortalService } from '$lib/services/customerPortalService';
  import { goto } from '$app/navigation';
  import type { WorkOrder } from '$lib/services/workOrderService';
  import { portalBranding } from '$lib/stores/portalBranding';
  
  let customer: any = null;
  let tickets: WorkOrder[] = [];
  let serviceInfo: any = null;
  let loading = true;
  let error = '';
  let featureFlags = {
    faq: true,
    serviceStatus: true,
    knowledgeBase: false,
    liveChat: false
  };
  
  // Stats
  let stats = {
    openTickets: 0,
    resolvedTickets: 0,
    totalTickets: 0
  };
  
  onMount(async () => {
    try {
      // Load customer
      customer = await customerAuthService.getCurrentCustomer();
      if (!customer) {
        goto('/modules/customers/portal/login');
        return;
      }
      
      // Load tickets
      tickets = await customerPortalService.getCustomerTickets();
      
      // Load service info
      serviceInfo = await customerPortalService.getCustomerServiceInfo();
      
      // Calculate stats
      stats.totalTickets = tickets.length;
      stats.openTickets = tickets.filter(t => 
        ['open', 'assigned', 'in-progress', 'waiting-parts'].includes(t.status)
      ).length;
      stats.resolvedTickets = tickets.filter(t => 
        ['resolved', 'closed'].includes(t.status)
      ).length;
    } catch (err: any) {
      error = err.message || 'Failed to load dashboard';
    } finally {
      loading = false;
    }
  });
  
  $: featureFlags = {
    faq: $portalBranding?.features?.enableFAQ !== false,
    serviceStatus: $portalBranding?.features?.enableServiceStatus !== false,
    knowledgeBase: !!$portalBranding?.features?.enableKnowledgeBase,
    liveChat: !!$portalBranding?.features?.enableLiveChat
  };

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      'open': '#3b82f6',
      'assigned': '#f59e0b',
      'in-progress': '#8b5cf6',
      'waiting-parts': '#ef4444',
      'resolved': '#10b981',
      'closed': '#6b7280'
    };
    return colors[status] || '#6b7280';
  }
</script>

{#if loading}
  <div class="loading">Loading dashboard...</div>
{:else if error}
  <div class="error">{error}</div>
{:else}
  <div class="dashboard">
    <div class="dashboard-header">
      <h1>Welcome, {customer?.firstName || 'Customer'}!</h1>
      <p class="subtitle">Manage your tickets and view your service information</p>
    </div>
    
    <div class="dashboard-stats">
      <div class="stat-card">
        <div class="stat-value">{stats.totalTickets}</div>
        <div class="stat-label">Total Tickets</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{stats.openTickets}</div>
        <div class="stat-label">Open Tickets</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{stats.resolvedTickets}</div>
        <div class="stat-label">Resolved</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{serviceInfo?.serviceStatus || 'N/A'}</div>
        <div class="stat-label">Service Status</div>
      </div>
    </div>
    
    <div class="dashboard-actions">
      <a href="/modules/customers/portal/tickets/new" class="btn-primary">
        Create New Ticket
      </a>
      <a href="/modules/customers/portal/tickets" class="btn-secondary">
        View All Tickets
      </a>
    </div>
    
    {#if featureFlags.faq || featureFlags.serviceStatus || featureFlags.knowledgeBase || featureFlags.liveChat}
      <div class="support-tools">
        {#if featureFlags.serviceStatus}
          <div class="support-card">
            <h3>Service Status &amp; Outages</h3>
            <p>Check real-time service health, scheduled maintenance, and network alerts.</p>
            <a class="support-link" href="/modules/customers/portal/service">View Status</a>
          </div>
        {/if}
        {#if featureFlags.faq}
          <div class="support-card">
            <h3>FAQ &amp; Help Center</h3>
            <p>Browse answers to the most common account, billing, and technical questions.</p>
            <a class="support-link" href="/modules/customers/portal/faq">Visit FAQ</a>
          </div>
        {/if}
        {#if featureFlags.knowledgeBase}
          <div class="support-card">
            <h3>Knowledge Base</h3>
            <p>Step-by-step guides and tutorials curated by { $portalBranding?.company?.displayName || 'our team' }.</p>
            <a class="support-link" href="/modules/customers/portal/knowledge">Browse Articles</a>
          </div>
        {/if}
        {#if featureFlags.liveChat}
          <div class="support-card">
            <h3>Live Chat Support</h3>
            <p>Connect with a support specialist for hands-on troubleshooting.</p>
            <a class="support-link" href="/modules/customers/portal/live-chat">Start Chat</a>
          </div>
        {/if}
      </div>
    {/if}
    
    {#if tickets.length > 0}
      <div class="recent-tickets">
        <h2>Recent Tickets</h2>
        <div class="tickets-list">
          {#each tickets.slice(0, 5) as ticket}
            <div class="ticket-card" on:click={() => goto(`/modules/customers/portal/tickets/${ticket._id}`)}>
              <div class="ticket-header">
                <span class="ticket-number">{ticket.ticketNumber || 'N/A'}</span>
                <span 
                  class="ticket-status" 
                  style="background: {getStatusColor(ticket.status)}"
                >
                  {ticket.status}
                </span>
              </div>
              <h3 class="ticket-title">{ticket.title}</h3>
              <p class="ticket-description">{ticket.description || 'No description'}</p>
              <div class="ticket-meta">
                <span>Priority: {ticket.priority}</span>
                <span>Created: {new Date(ticket.createdAt || '').toLocaleDateString()}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    
    {#if serviceInfo}
      <div class="service-info">
        <h2>Service Information</h2>
        <div class="info-card">
          <div class="info-row">
            <span class="info-label">Service Status:</span>
            <span class="info-value">{serviceInfo.serviceStatus || 'N/A'}</span>
          </div>
          {#if serviceInfo.servicePlan}
            <div class="info-row">
              <span class="info-label">Service Plan:</span>
              <span class="info-value">{serviceInfo.servicePlan}</span>
            </div>
          {/if}
          {#if serviceInfo.serviceAddress}
            <div class="info-row">
              <span class="info-label">Service Address:</span>
              <span class="info-value">
                {serviceInfo.serviceAddress.street || ''}
                {serviceInfo.serviceAddress.city || ''}, {serviceInfo.serviceAddress.state || ''} {serviceInfo.serviceAddress.zipCode || ''}
              </span>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .dashboard {
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .dashboard-header {
    margin-bottom: 2rem;
  }
  
  .dashboard-header h1 {
    font-size: 2rem;
    color: var(--brand-text, #111827);
    margin-bottom: 0.5rem;
  }
  
  .subtitle {
    color: var(--brand-text-secondary, #6b7280);
  }
  
  .dashboard-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .stat-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 600;
    color: var(--brand-primary, #3b82f6);
    margin-bottom: 0.5rem;
  }
  
  .stat-label {
    color: var(--brand-text-secondary, #6b7280);
    font-size: 0.875rem;
  }
  
  .dashboard-actions {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .support-tools {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.25rem;
    margin-bottom: 2.5rem;
  }

  .support-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 1.5rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .support-card h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--brand-text, #111827);
  }

  .support-card p {
    margin: 0;
    color: var(--brand-text-secondary, #6b7280);
    line-height: 1.4;
  }

  .support-link {
    margin-top: auto;
    align-self: flex-start;
    color: var(--brand-primary, #3b82f6);
    font-weight: 600;
    text-decoration: none;
    border-bottom: 1px solid transparent;
    padding-bottom: 0.1rem;
  }

  .support-link:hover {
    border-color: currentColor;
  }
  
  .btn-primary {
    background: var(--brand-primary, #3b82f6);
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 500;
    transition: background 0.2s;
  }
  
  .btn-primary:hover {
    background: var(--brand-accent, #10b981);
  }
  
  .btn-secondary {
    background: white;
    color: var(--brand-primary, #3b82f6);
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 500;
    border: 1px solid var(--brand-primary, #3b82f6);
    transition: background 0.2s;
  }
  
  .btn-secondary:hover {
    background: #f3f4f6;
  }
  
  .recent-tickets {
    margin-bottom: 2rem;
  }
  
  .recent-tickets h2 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: var(--brand-text, #111827);
  }
  
  .tickets-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .ticket-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    cursor: pointer;
    transition: box-shadow 0.2s;
  }
  
  .ticket-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .ticket-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .ticket-number {
    font-weight: 600;
    color: var(--brand-text, #111827);
  }
  
  .ticket-status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    color: white;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }
  
  .ticket-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--brand-text, #111827);
    margin-bottom: 0.5rem;
  }
  
  .ticket-description {
    color: var(--brand-text-secondary, #6b7280);
    margin-bottom: 0.75rem;
    line-height: 1.5;
  }
  
  .ticket-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--brand-text-secondary, #6b7280);
  }
  
  .service-info {
    margin-bottom: 2rem;
  }
  
  .service-info h2 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: var(--brand-text, #111827);
  }
  
  .info-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .info-row:last-child {
    border-bottom: none;
  }
  
  .info-label {
    font-weight: 500;
    color: var(--brand-text-secondary, #6b7280);
  }
  
  .info-value {
    color: var(--brand-text, #111827);
  }
  
  .loading, .error {
    text-align: center;
    padding: 2rem;
    color: var(--brand-text-secondary, #6b7280);
  }
  
  .error {
    color: #dc2626;
  }
  
  @media (max-width: 768px) {
    .dashboard-stats {
      grid-template-columns: 1fr;
    }
    
    .dashboard-actions {
      flex-direction: column;
    }
  }
</style>

