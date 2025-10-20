<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WorkOrder } from '$lib/services/workOrderService';
  
  export let workOrder: WorkOrder;
  
  const dispatch = createEventDispatcher();
  
  function getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      critical: '#ef4444',
      high: '#f59e0b',
      medium: '#3b82f6',
      low: '#6b7280'
    };
    return colors[priority] || '#6b7280';
  }
  
  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      open: '#6b7280',
      assigned: '#3b82f6',
      'in-progress': '#f59e0b',
      'waiting-parts': '#8b5cf6',
      resolved: '#10b981',
      closed: '#374151'
    };
    return colors[status] || '#6b7280';
  }
  
  function getPriorityIcon(priority: string): string {
    const icons: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '⚪'
    };
    return icons[priority] || '⚪';
  }
  
  function formatTimeAgo(date: Date | string | undefined): string {
    if (!date) return '';
    
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} min ago`;
    }
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
</script>

<div 
  class="work-order-card" 
  style="border-left: 4px solid {getPriorityColor(workOrder.priority)}"
  on:click={() => dispatch('click')}
  on:keydown
  role="button"
  tabindex="0"
>
  <div class="card-header">
    <div class="header-left">
      <span class="priority-icon">{getPriorityIcon(workOrder.priority)}</span>
      <div class="title-group">
        <h3 class="ticket-number">{workOrder.ticketNumber || 'TKT-NEW'}</h3>
        <span class="ticket-type">{workOrder.type}</span>
      </div>
    </div>
    
    <div 
      class="status-badge" 
      style="background-color: {getStatusColor(workOrder.status)}"
    >
      {workOrder.status}
    </div>
  </div>
  
  <p class="ticket-title">{workOrder.title}</p>
  
  {#if workOrder.description}
    <p class="ticket-description">{workOrder.description.substring(0, 150)}{workOrder.description.length > 150 ? '...' : ''}</p>
  {/if}
  
  {#if workOrder.location}
    <div class="location-info">
      <span class="location-icon">📍</span>
      <span class="location-text">
        {workOrder.location.siteName || workOrder.location.address || workOrder.location.type}
      </span>
    </div>
  {/if}
  
  <div class="card-footer">
    <div class="footer-left">
      <span class="time-ago">{formatTimeAgo(workOrder.createdAt)}</span>
      {#if workOrder.assignedToName}
        <span class="assignee">👤 {workOrder.assignedToName}</span>
      {/if}
    </div>
    
    {#if workOrder.sla?.breached}
      <span class="sla-breach">⚠️ SLA Breach</span>
    {/if}
  </div>
</div>

<style>
  .work-order-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .work-order-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: var(--brand-primary);
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .priority-icon {
    font-size: 1.5rem;
  }
  
  .title-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .ticket-number {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-primary);
  }
  
  .ticket-type {
    font-size: 0.875rem;
    color: var(--text-secondary);
    text-transform: capitalize;
  }
  
  .status-badge {
    padding: 0.375rem 0.875rem;
    border-radius: 12px;
    color: white;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
  }
  
  .ticket-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.75rem 0;
  }
  
  .ticket-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0 0 1rem 0;
    line-height: 1.5;
  }
  
  .location-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    margin-bottom: 1rem;
  }
  
  .location-icon {
    font-size: 1rem;
  }
  
  .location-text {
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color);
  }
  
  .footer-left {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  
  .time-ago {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .assignee {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .sla-breach {
    font-size: 0.75rem;
    font-weight: 700;
    color: #ef4444;
  }
</style>

