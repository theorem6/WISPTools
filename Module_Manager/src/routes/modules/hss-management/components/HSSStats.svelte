<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let stats: any;
  
  const dispatch = createEventDispatcher();
  
  function refresh() {
    dispatch('refresh');
  }
  
  $: subscribers = stats?.subscribers || {};
  $: cpe = stats?.cpe_correlation || {};
  $: health = stats?.health || {};
</script>

<div class="hss-stats">
  <div class="stats-header">
    <h2>Dashboard Overview</h2>
    <button class="refresh-btn" on:click={refresh}>
      🔄 Refresh
    </button>
  </div>
  
  <div class="stats-grid">
    <!-- Subscriber Stats -->
    <div class="stat-card primary">
      <div class="stat-icon">👥</div>
      <div class="stat-content">
        <div class="stat-value">{subscribers.total_active || 0}</div>
        <div class="stat-label">Active Subscribers</div>
      </div>
    </div>
    
    <div class="stat-card danger">
      <div class="stat-icon">🚫</div>
      <div class="stat-content">
        <div class="stat-value">{subscribers.total_inactive || 0}</div>
        <div class="stat-label">Inactive Subscribers</div>
      </div>
    </div>
    
    <div class="stat-card warning">
      <div class="stat-icon">⏸️</div>
      <div class="stat-content">
        <div class="stat-value">{subscribers.total_suspended || 0}</div>
        <div class="stat-label">Suspended</div>
      </div>
    </div>
    
    <div class="stat-card info">
      <div class="stat-icon">📱</div>
      <div class="stat-content">
        <div class="stat-value">{subscribers.total_with_acs || 0}</div>
        <div class="stat-label">With CPE Device</div>
      </div>
    </div>
  </div>
  
  <!-- CPE Correlation -->
  <div class="section">
    <h3>CPE Device Correlation</h3>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-content">
          <div class="stat-value">{cpe.subscribers_with_cpe || 0}</div>
          <div class="stat-label">Subscribers with CPE</div>
        </div>
      </div>
      
      <div class="stat-card success">
        <div class="stat-content">
          <div class="stat-value">{cpe.cpe_online || 0}</div>
          <div class="stat-label">CPE Online</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-content">
          <div class="stat-value">{cpe.cpe_offline || 0}</div>
          <div class="stat-label">CPE Offline</div>
        </div>
      </div>
      
      <div class="stat-card warning">
        <div class="stat-content">
          <div class="stat-value">{cpe.subscribers_without_cpe || 0}</div>
          <div class="stat-label">No CPE Detected</div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Health Indicators -->
  <div class="section">
    <h3>System Health</h3>
    <div class="health-grid">
      <div class="health-item">
        <span class="health-label">Active & Online:</span>
        <span class="health-value success">{health.active_and_online || 0}</span>
      </div>
      <div class="health-item">
        <span class="health-label">Subscribers without CPE:</span>
        <span class="health-value {health.subscribers_without_cpe > 10 ? 'warning' : ''}">
          {health.subscribers_without_cpe || 0}
        </span>
      </div>
      <div class="health-item">
        <span class="health-label">CPE Offline:</span>
        <span class="health-value {health.cpe_offline > 5 ? 'warning' : ''}">
          {health.cpe_offline || 0}
        </span>
      </div>
    </div>
  </div>
  
  <!-- Quick Actions -->
  <div class="quick-actions">
    <h3>Quick Actions</h3>
    <div class="action-buttons">
      <a href="/modules/hss-management?tab=subscribers&action=add" class="action-btn primary">
        ➕ Add Subscriber
      </a>
      <a href="/modules/hss-management?tab=import" class="action-btn">
        📥 Bulk Import
      </a>
      <a href="/modules/hss-management?tab=groups&action=create" class="action-btn">
        📦 Create Group
      </a>
      <a href="/modules/hss-management?tab=plans&action=create" class="action-btn">
        🚀 New Plan
      </a>
    </div>
  </div>
</div>

<style>
  .hss-stats {
    padding: 1rem 0;
  }
  
  .stats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }
  
  .stats-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #1a1a1a;
  }
  
  .refresh-btn {
    padding: 0.5rem 1rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.2s;
  }
  
  .refresh-btn:hover {
    background: #1d4ed8;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .stat-card {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  }
  
  .stat-card.primary {
    border-left: 4px solid #2563eb;
  }
  
  .stat-card.success {
    border-left: 4px solid #10b981;
  }
  
  .stat-card.warning {
    border-left: 4px solid #f59e0b;
  }
  
  .stat-card.danger {
    border-left: 4px solid #ef4444;
  }
  
  .stat-card.info {
    border-left: 4px solid #06b6d4;
  }
  
  .stat-icon {
    font-size: 2rem;
  }
  
  .stat-content {
    flex: 1;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: #1a1a1a;
    line-height: 1;
  }
  
  .stat-label {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .section {
    margin-bottom: 2rem;
  }
  
  .section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    color: #1a1a1a;
  }
  
  .health-grid {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .health-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .health-item:last-child {
    border-bottom: none;
  }
  
  .health-label {
    font-weight: 500;
    color: #4b5563;
  }
  
  .health-value {
    font-weight: 700;
    font-size: 1.125rem;
    color: #1a1a1a;
  }
  
  .health-value.success {
    color: #10b981;
  }
  
  .health-value.warning {
    color: #f59e0b;
  }
  
  .quick-actions {
    background: #f9fafb;
    padding: 1.5rem;
    border-radius: 8px;
  }
  
  .quick-actions h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    color: #1a1a1a;
  }
  
  .action-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  
  .action-btn {
    display: block;
    padding: 0.75rem 1rem;
    background: white;
    color: #4b5563;
    text-decoration: none;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    text-align: center;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .action-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    border-color: #2563eb;
    color: #2563eb;
  }
  
  .action-btn.primary {
    background: #2563eb;
    color: white;
    border-color: #2563eb;
  }
  
  .action-btn.primary:hover {
    background: #1d4ed8;
    border-color: #1d4ed8;
    color: white;
  }
  
  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
    
    .stats-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
    
    .action-buttons {
      grid-template-columns: 1fr;
    }
  }
</style>

