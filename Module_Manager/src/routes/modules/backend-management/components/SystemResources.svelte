<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth } from '$lib/firebase';
  
  let systemInfo: any = null;
  let isLoading = true;
  let refreshInterval: any = null;
  
  onMount(() => {
    loadSystemInfo();
    // Refresh every 15 seconds
    refreshInterval = setInterval(loadSystemInfo, 15000);
  });
  
  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });
  
  async function loadSystemInfo() {
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      
      const response = await fetch('https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/system/resources', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        systemInfo = await response.json();
      }
      
      isLoading = false;
    } catch (err) {
      console.error('Error loading system info:', err);
      isLoading = false;
    }
  }
</script>

<div class="system-resources">
  <h2>📊 System Resources</h2>
  
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading system information...</p>
    </div>
  {:else if systemInfo}
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-icon">💾</div>
        <div class="metric-content">
          <div class="metric-label">Memory Usage</div>
          <div class="metric-value">{systemInfo.memory?.percent || 'N/A'}%</div>
          {#if systemInfo.memory}
            <div class="metric-detail">
              {formatBytes(systemInfo.memory.used)} / {formatBytes(systemInfo.memory.total)}
            </div>
          {/if}
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-icon">⚡</div>
        <div class="metric-content">
          <div class="metric-label">CPU Usage</div>
          <div class="metric-value">{systemInfo.cpu?.percent || 'N/A'}%</div>
          {#if systemInfo.cpu?.cores}
            <div class="metric-detail">{systemInfo.cpu.cores} cores</div>
          {/if}
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-icon">💿</div>
        <div class="metric-content">
          <div class="metric-label">Disk Usage</div>
          <div class="metric-value">{systemInfo.disk?.percent || 'N/A'}%</div>
          {#if systemInfo.disk}
            <div class="metric-detail">
              {formatBytes(systemInfo.disk.used)} / {formatBytes(systemInfo.disk.total)}
            </div>
          {/if}
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-icon">⏱️</div>
        <div class="metric-content">
          <div class="metric-label">Uptime</div>
          <div class="metric-value">{formatUptime(systemInfo.uptime || 0)}</div>
          {#if systemInfo.loadAvg}
            <div class="metric-detail">Load: {systemInfo.loadAvg.join(', ')}</div>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>System information unavailable. Configure backend API endpoint.</p>
    </div>
  {/if}
</div>

<style>
  .system-resources h2 {
    margin: 0 0 var(--spacing-lg) 0;
    color: var(--text-primary);
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .loading-state, .empty-state {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--text-secondary);
  }
  
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top: 3px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto var(--spacing-md);
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md);
  }
  
  .metric-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    display: flex;
    gap: var(--spacing-md);
  }
  
  .metric-icon {
    font-size: 2.5rem;
  }
  
  .metric-content {
    flex: 1;
  }
  
  .metric-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xs);
  }
  
  .metric-value {
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--primary-color);
    font-family: monospace;
  }
  
  .metric-detail {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: var(--spacing-xs);
  }
  
  @media (max-width: 768px) {
    .metrics-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

<script context="module" lang="ts">
  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
</script>

