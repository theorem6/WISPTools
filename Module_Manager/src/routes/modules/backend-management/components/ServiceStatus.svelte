<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { auth } from '$lib/firebase';
  
  interface Service {
    name: string;
    displayName: string;
    port: number;
    status: 'online' | 'offline' | 'unknown';
    uptime?: number;
    memory?: number;
    cpu?: number;
    restarts?: number;
    canControl: boolean;
  }
  
  let services: Service[] = [];
  let isLoading = true;
  let error: string | null = null;
  let refreshInterval: any = null;
  
  const BACKEND_SERVICES = [
    { name: 'genieacs-nbi', displayName: 'GenieACS NBI (7557)', port: 7557, canControl: true },
    { name: 'genieacs-cwmp', displayName: 'GenieACS CWMP (7547)', port: 7547, canControl: true },
    { name: 'genieacs-fs', displayName: 'GenieACS FS (7567)', port: 7567, canControl: true },
    { name: 'genieacs-ui', displayName: 'GenieACS UI (8080)', port: 8080, canControl: true },
    { name: 'hss-api', displayName: 'User Management API (3000)', port: 3000, canControl: true },
    { name: 'open5gs-hss', displayName: 'Open5GS HSS (3001)', port: 3001, canControl: false },
    { name: 'mongodb', displayName: 'MongoDB Atlas (27017)', port: 27017, canControl: false }
  ];
  
  onMount(() => {
    loadServices();
    // Refresh every 10 seconds
    refreshInterval = setInterval(loadServices, 10000);
  });
  
  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });
  
  async function loadServices() {
    try {
      const user = auth().currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      
      const response = await fetch('https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/apiProxy/api/system/services/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.services) {
          services = data.services;
        }
      } else {
        // Fallback: show services with unknown status
        services = BACKEND_SERVICES.map(s => ({
          ...s,
          status: 'unknown' as const
        }));
      }
      
      isLoading = false;
    } catch (err: any) {
      console.error('Error loading services:', err);
      error = err.message;
      isLoading = false;
    }
  }
  
  async function handleServiceAction(serviceName: string, action: 'restart' | 'stop' | 'start') {
    if (!confirm(`⚠️ Are you sure you want to ${action.toUpperCase()} ${serviceName}?\n\nThis will affect all users!`)) {
      return;
    }
    
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();
      
      const response = await fetch(`https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/apiProxy/api/system/services/${serviceName}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`✅ ${serviceName} ${action} successful!`);
        // Refresh status after action
        setTimeout(loadServices, 2000);
      } else {
        throw new Error(data.error || `Failed to ${action} service`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    }
  }
</script>

<div class="service-status">
  <div class="section-header">
    <h2>🔧 Service Status</h2>
    <button class="btn-refresh" on:click={loadServices} disabled={isLoading}>
      {isLoading ? '🔄 Refreshing...' : '🔄 Refresh'}
    </button>
  </div>
  
  {#if error}
    <div class="error-message">⚠️ {error}</div>
  {/if}
  
  <div class="services-grid">
    {#each services as service}
      <div class="service-card" class:online={service.status === 'online'} class:offline={service.status === 'offline'}>
        <div class="service-header">
          <div>
            <h3>{service.displayName}</h3>
            <div class="service-meta">
              <span class="port">Port {service.port}</span>
              {#if service.uptime}
                <span class="uptime">Uptime: {formatUptime(service.uptime)}</span>
              {/if}
            </div>
          </div>
          <div class="status-badge status-{service.status}">
            {service.status === 'online' ? '🟢' : service.status === 'offline' ? '🔴' : '⚪'}
            {service.status.toUpperCase()}
          </div>
        </div>
        
        {#if service.status === 'online' && (service.memory || service.cpu !== undefined)}
          <div class="service-metrics">
            {#if service.memory}
              <div class="metric">
                <span class="label">Memory:</span>
                <span class="value">{formatBytes(service.memory)}</span>
              </div>
            {/if}
            {#if service.cpu !== undefined}
              <div class="metric">
                <span class="label">CPU:</span>
                <span class="value">{service.cpu.toFixed(1)}%</span>
              </div>
            {/if}
            {#if service.restarts !== undefined}
              <div class="metric">
                <span class="label">Restarts:</span>
                <span class="value">{service.restarts}</span>
              </div>
            {/if}
          </div>
        {/if}
        
        {#if service.canControl}
          <div class="service-actions">
            <button 
              class="btn-action btn-restart" 
              on:click={() => handleServiceAction(service.name, 'restart')}
            >
              🔄 Restart
            </button>
            {#if service.status === 'online'}
              <button 
                class="btn-action btn-stop" 
                on:click={() => handleServiceAction(service.name, 'stop')}
              >
                ⏹️ Stop
              </button>
            {:else}
              <button 
                class="btn-action btn-start" 
                on:click={() => handleServiceAction(service.name, 'start')}
              >
                ▶️ Start
              </button>
            {/if}
          </div>
        {:else}
          <div class="no-control">
            <small>⚠️ External service - no direct control</small>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .service-status {
    background: var(--card-bg);
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-md);
    border-bottom: 2px solid var(--border-color);
  }
  
  .section-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
    font-weight: 600;
  }
  
  .btn-refresh {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--border-radius-sm);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    font-size: 0.875rem;
  }
  
  .btn-refresh:hover:not(:disabled) {
    background: var(--primary-hover);
  }
  
  .btn-refresh:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .error-message {
    background: var(--danger-light);
    border: 1px solid var(--danger-color);
    color: var(--danger-color);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-lg);
  }
  
  .services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: var(--spacing-xl);
    margin-bottom: var(--spacing-xl);
  }
  
  .service-card {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-xxl);
    transition: var(--transition);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: var(--spacing-lg);
  }
  
  .service-card:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
  
  .service-card.online {
    border-color: var(--success-color);
  }
  
  .service-card.offline {
    border-color: var(--danger-color);
  }
  
  .service-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--spacing-xl);
    padding-bottom: var(--spacing-lg);
    border-bottom: 2px solid var(--border-color);
  }
  
  .service-header h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.025em;
  }
  
  .service-meta {
    display: flex;
    gap: var(--spacing-lg);
    margin-top: var(--spacing-md);
    font-size: 0.9rem;
  }
  
  .port, .uptime {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-tertiary);
    border-radius: var(--border-radius);
    color: var(--text-secondary);
    font-family: monospace;
    font-weight: 600;
    font-size: 0.85rem;
    border: 1px solid var(--border-color);
  }
  
  .status-badge {
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }
  
  .status-online {
    background: var(--success-light);
    color: var(--success-color);
  }
  
  .status-offline {
    background: var(--danger-light);
    color: var(--danger-color);
  }
  
  .status-unknown {
    background: var(--bg-tertiary);
    color: var(--text-secondary);
  }
  
  .service-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-xl);
    margin-bottom: var(--spacing-xl);
    padding: var(--spacing-xl);
    background: var(--bg-primary);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }
  
  .metric {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    text-align: center;
  }
  
  .metric .label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.75px;
    font-weight: 600;
  }
  
  .metric .value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: monospace;
  }
  
  .service-actions {
    display: flex;
    gap: var(--spacing-lg);
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
  }
  
  .btn-action {
    flex: 1;
    padding: var(--spacing-lg) var(--spacing-xl);
    border: none;
    border-radius: var(--border-radius);
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .btn-action:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  
  .btn-action:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .btn-restart {
    background: var(--primary-color);
    color: white;
  }
  
  .btn-restart:hover {
    background: var(--primary-hover);
  }
  
  .btn-stop {
    background: var(--danger-color);
    color: white;
  }
  
  .btn-stop:hover {
    background: #dc2626;
  }
  
  .btn-start {
    background: var(--success-color);
    color: white;
  }
  
  .btn-start:hover {
    background: #059669;
  }
  
  .no-control {
    text-align: center;
    padding: var(--spacing-sm);
    color: var(--text-muted);
    font-style: italic;
  }
  
  .admin-banner {
    background: var(--danger-color);
    color: white;
    padding: var(--spacing-sm) var(--spacing-xl);
    display: flex;
    justify-content: space-between;
    font-weight: 600;
  }
  
  .page-header {
    padding: var(--spacing-xl);
    background: var(--card-bg);
    border-bottom: 2px solid var(--border-color);
  }
  
  .page-header h1 {
    margin: 0 0 var(--spacing-xs) 0;
    font-size: 1.75rem;
  }
  
  .subtitle {
    color: var(--text-secondary);
    margin: 0;
  }
  
  .content-grid {
    padding: var(--spacing-xl);
    max-width: 1600px;
    margin: 0 auto;
  }
  
  .btn-back {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
  }
</style>

<script context="module" lang="ts">
  function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
  
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
</script>

