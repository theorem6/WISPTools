<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { workOrderService, type WorkOrder } from '$lib/services/workOrderService';
  import { customerService, type Customer } from '$lib/services/customerService';
  import { authService } from '$lib/services/authService';
  import CreateTicketModal from '../help-desk/components/CreateTicketModal.svelte';
  import TicketDetailsModal from '../help-desk/components/TicketDetailsModal.svelte';
  import CustomerLookupModal from '../help-desk/components/CustomerLookupModal.svelte';
  import AddEditCustomerModal from '../customers/components/AddEditCustomerModal.svelte';
  import { API_CONFIG } from '$lib/config/api';
  
  // Use centralized API configuration
  const MAINTAIN_API = API_CONFIG.PATHS.MAINTAIN;
  
  // Tab management
  let activeTab: Tab = 'help-desk'; // Help Desk is now the default and most prominent tab
  
  // Dashboard stats
  let dashboardStats = {
    openTickets: 0,
    criticalTickets: 0,
    scheduledMaintenance: 0,
    totalCustomers: 0,
    activeCustomers: 0,
    avgResponseTime: '0h',
    resolvedTickets: 0
  };
  let loadingStats = true;
  
  // Tickets
  let tickets: WorkOrder[] = [];
  let filteredTickets: WorkOrder[] = [];
  let loadingTickets = false;
  
  // Customers
  let customers: Customer[] = [];
  let filteredCustomers: Customer[] = [];
  let loadingCustomers = false;
  
  // Filters
  let ticketStatusFilter: WorkOrder['status'] | 'all' = 'all';
  let ticketPriorityFilter: WorkOrder['priority'] | 'all' = 'all';
  let ticketSearchQuery = '';
  let customerSearchQuery = '';
  let customerStatusFilter = '';
  
  // Modals
  let showCreateTicket = false;
  let showTicketDetails = false;
  let showCustomerLookup = false;
  let showAddCustomer = false;
  let showEditCustomer = false;
  let selectedTicket: WorkOrder | null = null;
  let selectedCustomer: Customer | null = null;
  
  // Recent activity
  let recentActivity: any[] = [];
  
  $: tenantId = $currentTenant?.id || '';
  
  // Sync tenantId to localStorage for services that use it
  $: if (tenantId && browser) {
    localStorage.setItem('selectedTenantId', tenantId);
  }
  
  onMount(() => {
    if (tenantId) {
      // Ensure localStorage is set
      if (browser) {
        localStorage.setItem('selectedTenantId', tenantId);
      }
      loadDashboardStats();
      loadTickets();
      loadCustomers();
      loadRecentActivity();
    }
  });

  $: if (tenantId) {
    if (activeTab === 'tickets' || activeTab === 'help-desk') {
      loadTickets();
      loadDashboardStats();
    }
    if (activeTab === 'incidents') {
      loadDashboardStats();
    }
    if (activeTab === 'customers') loadCustomers();
    if (activeTab === 'help-desk') {
      loadDashboardStats();
      loadRecentActivity();
    }
  }

  
  $: applyTicketFilters();
  $: applyCustomerFilters();
$: if (showCreateTicket) {
  console.info('[Maintain] showCreateTicket set to true');
}
$: if (showTicketDetails) {
  console.info('[Maintain] showTicketDetails set to true', selectedTicket);
}
  
  // ========== API Calls ==========
  async function loadDashboardStats() {
    if (!tenantId || !browser) return;
    
    loadingStats = true;
    try {
      // Try unified maintain API first
      const response = await fetch(`${MAINTAIN_API}/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        dashboardStats = {
          openTickets: data.tickets?.open || 0,
          criticalTickets: data.tickets?.critical || 0,
          scheduledMaintenance: data.tickets?.scheduled || 0,
          totalCustomers: data.customers?.total || 0,
          activeCustomers: data.customers?.active || 0,
          avgResponseTime: data.metrics?.avgResponseTime || '0h',
          resolvedTickets: data.metrics?.resolvedTickets || 0
        };
      } else {
        // Fallback to individual API calls
        await loadStatsFallback();
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      await loadStatsFallback();
    } finally {
      loadingStats = false;
    }
  }
  
  async function loadStatsFallback() {
    if (!tenantId || !browser) return;
    
    // Ensure localStorage is set
    localStorage.setItem('selectedTenantId', tenantId);
    
    try {
      // Services use localStorage for tenantId
      const allTickets = await workOrderService.getWorkOrders();
      dashboardStats.openTickets = allTickets.filter(t => 
        ['open', 'assigned', 'in-progress'].includes(t.status)
      ).length;
      dashboardStats.criticalTickets = allTickets.filter(t => 
        t.priority === 'critical' && ['open', 'assigned', 'in-progress'].includes(t.status)
      ).length;
      dashboardStats.scheduledMaintenance = allTickets.filter(t => 
        t.type === 'maintenance' && !['closed', 'cancelled'].includes(t.status)
      ).length;
      dashboardStats.resolvedTickets = allTickets.filter(t => 
        ['resolved', 'closed'].includes(t.status)
      ).length;
      
      const allCustomers = await customerService.searchCustomers();
      dashboardStats.totalCustomers = allCustomers.length;
      dashboardStats.activeCustomers = allCustomers.filter(c => c.serviceStatus === 'active').length;
    } catch (error) {
      console.error('Error loading fallback stats:', error);
    }
  }
  
  async function loadTickets() {
    if (!tenantId || !browser) return;
    
    // Ensure localStorage is set
    localStorage.setItem('selectedTenantId', tenantId);
    
    loadingTickets = true;
    try {
      console.info('[Maintain] Loading tickets for tenant', tenantId);
      // Services use localStorage for tenantId
      tickets = await workOrderService.getWorkOrders();
      console.info('[Maintain] Loaded tickets', tickets);
      applyTicketFilters();
    } catch (error: any) {
      console.error('Error loading tickets:', error);
    } finally {
      loadingTickets = false;
    }
  }
  
  async function loadCustomers() {
    if (!tenantId || !browser) return;
    
    // Ensure localStorage is set
    localStorage.setItem('selectedTenantId', tenantId);
    
    loadingCustomers = true;
    try {
      // Services use localStorage for tenantId
      customers = await customerService.searchCustomers();
      applyCustomerFilters();
    } catch (error: any) {
      console.error('Error loading customers:', error);
    } finally {
      loadingCustomers = false;
    }
  }
  
  async function loadRecentActivity() {
    if (!tenantId || !browser) return;
    
    try {
      const response = await fetch(`${MAINTAIN_API}/dashboard/activity?limit=10`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        recentActivity = await response.json();
      }
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  }
  
  // ========== Filters ==========
  function applyTicketFilters() {
    filteredTickets = tickets.filter(ticket => {
      if (ticketStatusFilter !== 'all' && ticket.status !== ticketStatusFilter) return false;
      if (ticketPriorityFilter !== 'all' && ticket.priority !== ticketPriorityFilter) return false;
      if (ticketSearchQuery) {
        const query = ticketSearchQuery.toLowerCase();
        if (!ticket.title?.toLowerCase().includes(query) &&
            !ticket.description?.toLowerCase().includes(query) &&
            !ticket.ticketNumber?.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
    
    filteredTickets.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }
  
  function applyCustomerFilters() {
    filteredCustomers = customers.filter(customer => {
      if (customerStatusFilter && customer.serviceStatus !== customerStatusFilter) return false;
      if (customerSearchQuery) {
        const query = customerSearchQuery.toLowerCase();
        if (!customer.fullName?.toLowerCase().includes(query) &&
            !customer.primaryPhone?.includes(query) &&
            !customer.email?.toLowerCase().includes(query) &&
            !customer.customerId?.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }
  
  // ========== Helpers ==========
  async function getAuthToken(): Promise<string> {
    const token = await authService.getAuthToken();
    if (!token) throw new Error('Not authenticated');
    return token;
  }
  
  function getApiUrl(): string {
    // Use centralized API configuration
    return MAINTAIN_API;
  }
  
  function formatDate(date: Date | string | undefined): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      open: 'var(--warning)',
      'in-progress': 'var(--info)',
      resolved: 'var(--success)',
      closed: 'var(--text-secondary)',
      active: 'var(--success)',
      pending: 'var(--warning)',
      suspended: 'var(--danger)',
      cancelled: 'var(--text-secondary)'
    };
    return colors[status] || 'var(--text-secondary)';
  }
  
  function getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      critical: 'var(--danger)',
      high: 'var(--warning)',
      medium: 'var(--info)',
      low: 'var(--text-secondary)'
    };
    return colors[priority] || 'var(--text-secondary)';
  }
  
  function handleTicketCreated() {
    console.info('[Maintain] Ticket created event received');
    showCreateTicket = false;
    loadTickets();
    loadDashboardStats();
  }
  
  function handleCustomerCreated() {
    showAddCustomer = false;
    showEditCustomer = false;
    loadCustomers();
    loadDashboardStats();
  }
</script>


<style>
  .maintain-module {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg-primary);
  }
  
  .module-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1rem;
  }
  
  .header-top {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .back-btn {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .header-top h1 {
    margin: 0;
    flex: 1;
    font-size: 1.5rem;
  }
  
  .header-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 2px solid var(--border-color);
  }
  
  .tab {
    background: transparent;
    border: none;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: all 0.2s;
  }
  
  .tab:hover {
    color: var(--text-primary);
  }
  
  .tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }
  
  .module-content {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
  }
  
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  
  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .stat-icon {
    font-size: 2.5rem;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: bold;
    color: var(--primary);
  }
  
  .stat-label {
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .stat-sub {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .filters-bar {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .search-input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  .filter-select {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  .items-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .ticket-card,
  .customer-card {
    display: block;
    width: 100%;
    text-align: left;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s;
    color: inherit;
    font: inherit;
  }
  
  .ticket-card:hover,
  .customer-card:hover,
  .ticket-card:focus-visible,
  .customer-card:focus-visible {
    border-color: var(--primary);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    outline: none;
  }
  
  .ticket-header, .customer-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  
  .ticket-id {
    font-weight: bold;
    color: var(--primary);
  }
  
  .priority-badge, .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    color: white;
    text-transform: capitalize;
  }
  
  .ticket-title, .customer-name {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  
  .ticket-meta, .customer-info {
    display: flex;
    gap: 1rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .customer-address {
    margin-top: 0.5rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
  
  .activity-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
  }
  
  .activity-list {
    margin-top: 1rem;
  }
  
  .activity-item {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .activity-item:last-child {
    border-bottom: none;
  }
  
  .activity-icon {
    font-size: 1.5rem;
  }
  
  .activity-title {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }
  
  .activity-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .empty-state, .loading {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: var(--primary);
    color: white;
  }
  
  .btn-primary:hover {
    opacity: 0.9;
  }
  
  .btn-secondary {
    background: #6b7280;
    color: white;
    border: 1px solid var(--border-color, #e5e7eb);
  }
  
  .btn-secondary:hover {
    background: #4b5563;
  }
  
  .btn-reports {
    background: #3b82f6 !important;
    color: white !important;
    border: 1px solid #2563eb !important;
  }
  
  .btn-reports:hover {
    background: #2563eb !important;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
  }
  
  .info-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
  }
  
  .info-section h2 {
    margin-bottom: 1rem;
  }
</style>


