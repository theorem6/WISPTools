<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/firebase';
  
  interface ServiceStatus {
    name: string;
    displayName: string;
    status: 'online' | 'offline' | 'unknown';
    port: number;
    canRestart: boolean;
    lastChecked?: Date;
  }
  
  let services: ServiceStatus[] = [
    { name: 'genieacs-nbi', displayName: 'GenieACS NBI', status: 'unknown', port: 7557, canRestart: true },
    { name: 'genieacs-cwmp', displayName: 'GenieACS CWMP (TR-069)', status: 'unknown', port: 7547, canRestart: true },
    { name: 'genieacs-fs', displayName: 'GenieACS File Server', status: 'unknown', port: 7567, canRestart: true },
    { name: 'genieacs-ui', displayName: 'GenieACS Web UI', status: 'unknown', port: 8080, canRestart: true },
    { name: 'hss-api', displayName: 'HSS API', status: 'unknown', port: 3000, canRestart: true },
    { name: 'mongodb', displayName: 'MongoDB', status: 'unknown', port: 27017, canRestart: false }
  ];
  
  let isLoading = false;
  let error: string | null = null;
  
  onMount(() => {
    checkAllServices();
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkAllServices, 30000);
    return () => clearInterval(interval);
  });
  
  async function checkAllServices() {
    isLoading = true;
    error = null;
    
    for (const service of services) {
      await checkServiceStatus(service);
    }
    
    isLoading = false;
  }
  
  async function checkServiceStatus(service: ServiceStatus) {
    try {
      const user = auth().currentUser;
      if (!user) {
        service.status = 'unknown';
        return;
      }
      
      const token = await user.getIdToken();
      
      // Try to fetch from the service endpoint
      const response = await fetch(`https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/services/${service.name}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        service.status = data.status === 'online' || data.running ? 'online' : 'offline';
      } else {
        // Service endpoint doesn't exist, try basic health check
        service.status = 'unknown';
      }
      
      service.lastChecked = new Date();
    } catch (err) {
      console.error(`Error checking ${service.name}:`, err);
      service.status = 'unknown';
    }
  }
  
  async function handleServiceAction(service: ServiceStatus, action: 'restart' | 'stop' | 'start') {
    if (!confirm(`Are you sure you want to ${action} ${service.displayName}?`)) {
      return;
    }
    
    isLoading = true;
    error = null;
    
    try {
      const user = auth().currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }
      
      const token = await user.getIdToken();
      
      const response = await fetch(`https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net/hssProxy/api/services/${service.name}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        alert(`✅ ${service.displayName} ${action} command sent successfully`);
        // Wait a moment then refresh status
        setTimeout(() => checkServiceStatus(service), 2000);
      } else {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${action} service`);
      }
    } catch (err: any) {
      console.error(`Error ${action}ing service:`, err);
      error = err.message || `Failed to ${action} ${service.displayName}`;
      alert(`❌ ${error}`);
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Service Management - ACS Administration</title>
</svelte:head>

<div class="services-page">
  <div class="page-header">
    <div>
      <h2>Service Management</h2>
      <p class="description">Monitor and control backend services</p>
    </div>
    <button class="btn-refresh" on:click={checkAllServices} disabled={isLoading}>
      {isLoading ? '🔄 Checking...' : '🔄 Refresh Status'}
    </button>
  </div>
  
  {#if error}
    <div class="error-banner">
      <span>⚠️</span>
      <span>{error}</span>
    </div>
  {/if}
  
  <div class="services-grid">
    {#each services as service}
      <div class="service-card" class:online={service.status === 'online'} class:offline={service.status === 'offline'}>
        <div class="service-header">
          <div class="service-info">
            <h3>{service.displayName}</h3>
            <span class="service-port">Port {service.port}</span>
          </div>
          <div class="service-status status-{service.status}">
            {service.status === 'online' ? '🟢' : service.status === 'offline' ? '🔴' : '⚪'}
            {service.status.toUpperCase()}
          </div>
        </div>
        
        {#if service.lastChecked}
          <div class="last-checked">
            Last checked: {service.lastChecked.toLocaleTimeString()}
          </div>
        {/if}
        
        {#if service.canRestart}
          <div class="service-actions">
            <button 
              class="btn-action btn-restart" 
              on:click={() => handleServiceAction(service, 'restart')}
              disabled={isLoading}
            >
              🔄 Restart
            </button>
            {#if service.status === 'online'}
              <button 
                class="btn-action btn-stop" 
                on:click={() => handleServiceAction(service, 'stop')}
                disabled={isLoading}
              >
                ⏹️ Stop
              </button>
            {:else if service.status === 'offline'}
              <button 
                class="btn-action btn-start" 
                on:click={() => handleServiceAction(service, 'start')}
                disabled={isLoading}
              >
                ▶️ Start
              </button>
            {/if}
          </div>
        {:else}
          <div class="service-note">
            <small>⚠️ Service management handled externally</small>
          </div>
        {/if}
      </div>
    {/each}
  </div>
  
  <div class="info-box">
    <h4>ℹ️ Service Information</h4>
    <ul>
      <li><strong>GenieACS NBI:</strong> Northbound Interface for device management API</li>
      <li><strong>GenieACS CWMP:</strong> TR-069 Auto Configuration Server</li>
      <li><strong>GenieACS FS:</strong> File server for firmware and configurations</li>
      <li><strong>GenieACS UI:</strong> Web-based management interface</li>
      <li><strong>HSS API:</strong> Home Subscriber Server REST API</li>
      <li><strong>MongoDB:</strong> Database for GenieACS and HSS data</li>
    </ul>
    
    <div class="warning-box">
      <strong>⚠️ Important:</strong> Stopping critical services may affect network operations. 
      Use caution when managing services during active operations.
    </div>
  </div>
</div>

<style>
  .services-page {
    padding: var(--spacing-xl);
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-xl);
  }
  
  .page-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.75rem;
    font-weight: 600;
  }
  
  .description {
    color: var(--text-secondary);
    margin: var(--spacing-xs) 0 0 0;
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
  }
  
  .btn-refresh:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  .btn-refresh:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .error-banner {
    background: var(--danger-light);
    border: 1px solid var(--danger-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
    color: var(--danger-color);
  }
  
  .services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
  }
  
  .service-card {
    background: var(--card-bg);
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    transition: var(--transition);
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
    margin-bottom: var(--spacing-md);
  }
  
  .service-info h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  .service-port {
    display: inline-block;
    margin-top: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: monospace;
  }
  
  .service-status {
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
  
  .last-checked {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: var(--spacing-md);
  }
  
  .service-actions {
    display: flex;
    gap: var(--spacing-sm);
  }
  
  .btn-action {
    flex: 1;
    padding: var(--spacing-sm);
    border: none;
    border-radius: var(--border-radius-sm);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
  }
  
  .btn-restart {
    background: var(--primary-color);
    color: white;
  }
  
  .btn-restart:hover:not(:disabled) {
    background: var(--primary-hover);
  }
  
  .btn-stop {
    background: var(--danger-color);
    color: white;
  }
  
  .btn-stop:hover:not(:disabled) {
    background: #dc2626;
  }
  
  .btn-start {
    background: var(--success-color);
    color: white;
  }
  
  .btn-start:hover:not(:disabled) {
    background: #059669;
  }
  
  .btn-action:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .service-note {
    text-align: center;
    color: var(--text-muted);
    font-style: italic;
  }
  
  .info-box {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
  }
  
  .info-box h4 {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 600;
  }
  
  .info-box ul {
    margin: 0 0 var(--spacing-lg) 0;
    padding-left: var(--spacing-lg);
    color: var(--text-secondary);
  }
  
  .info-box li {
    margin-bottom: var(--spacing-sm);
    line-height: 1.5;
  }
  
  .warning-box {
    background: var(--warning-light);
    border: 1px solid var(--warning-color);
    border-radius: var(--border-radius-sm);
    padding: var(--spacing-md);
    color: #92400e;
  }
  
  .warning-box strong {
    display: block;
    margin-bottom: var(--spacing-xs);
  }
</style>
