<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import MainMenu from '../../components/MainMenu.svelte';
  import { env } from '$env/dynamic/public';
  
  interface ServiceStatus {
    name: string;
    displayName: string;
    endpoint: string;
    status: 'checking' | 'online' | 'offline' | 'degraded';
    responseTime: number | null;
    lastCheck: Date | null;
    error: string | null;
    description: string;
    icon: string;
  }
  
  let services: ServiceStatus[] = [];
  let isRefreshing = false;
  let autoRefresh = false;
  let refreshInterval: number | null = null;
  let lastRefreshTime: Date | null = null;
  
  // Initialize services
  onMount(async () => {
    console.log('Services monitoring page loaded');
    initializeServices();
    await checkAllServices();
  });
  
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
  
  function initializeServices() {
    const baseUrl = env.PUBLIC_FIREBASE_FUNCTIONS_URL || 'https://us-central1-lte-pci-mapper-65450042-bbf71.cloudfunctions.net';
    
    services = [
      {
        name: 'genieacs-cwmp',
        displayName: 'GenieACS CWMP',
        endpoint: env.PUBLIC_GENIEACS_CWMP_URL || `${baseUrl}/genieacsCWMP`,
        status: 'checking',
        responseTime: null,
        lastCheck: null,
        error: null,
        description: 'TR-069 CWMP server for device management (Port 7547)',
        icon: '🌐'
      },
      {
        name: 'genieacs-nbi',
        displayName: 'GenieACS NBI',
        endpoint: env.PUBLIC_GENIEACS_NBI_URL || `${baseUrl}/genieacsNBI`,
        status: 'checking',
        responseTime: null,
        lastCheck: null,
        error: null,
        description: 'North Bound Interface API (Port 7557)',
        icon: '🔌'
      },
      {
        name: 'genieacs-fs',
        displayName: 'GenieACS FS',
        endpoint: env.PUBLIC_GENIEACS_FS_URL || `${baseUrl}/genieacsFS`,
        status: 'checking',
        responseTime: null,
        lastCheck: null,
        error: null,
        description: 'File Server for firmware and configs (Port 7567)',
        icon: '📁'
      },
      {
        name: 'sync-devices',
        displayName: 'Sync CPE Devices',
        endpoint: env.PUBLIC_SYNC_CPE_DEVICES_URL || `${baseUrl}/syncCPEDevices`,
        status: 'checking',
        responseTime: null,
        lastCheck: null,
        error: null,
        description: 'Device synchronization from MongoDB to Firestore',
        icon: '🔄'
      },
      {
        name: 'get-devices',
        displayName: 'Get CPE Devices',
        endpoint: env.PUBLIC_GET_CPE_DEVICES_URL || `${baseUrl}/getCPEDevices`,
        status: 'checking',
        responseTime: null,
        lastCheck: null,
        error: null,
        description: 'Retrieve CPE device list from Firestore',
        icon: '📱'
      },
    ];
  }
  
  async function checkServiceHealth(service: ServiceStatus): Promise<void> {
    const startTime = performance.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(service.endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      const endTime = performance.now();
      
      service.responseTime = Math.round(endTime - startTime);
      service.lastCheck = new Date();
      
      if (response.ok) {
        service.status = service.responseTime > 5000 ? 'degraded' : 'online';
        service.error = null;
      } else {
        service.status = 'degraded';
        service.error = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (error) {
      const endTime = performance.now();
      service.responseTime = Math.round(endTime - startTime);
      service.lastCheck = new Date();
      service.status = 'offline';
      
      if (error.name === 'AbortError') {
        service.error = 'Request timeout (>10s)';
      } else {
        service.error = error.message || 'Connection failed';
      }
    }
  }
  
  async function checkAllServices() {
    isRefreshing = true;
    lastRefreshTime = new Date();
    
    // Check all services in parallel
    await Promise.all(services.map(service => checkServiceHealth(service)));
    
    // Trigger reactivity
    services = [...services];
    isRefreshing = false;
  }
  
  async function restartService(service: ServiceStatus) {
    if (confirm(`Restart ${service.displayName}?\n\nThis will trigger a health check and attempt to wake up the service if it's cold.`)) {
      service.status = 'checking';
      services = [...services];
      
      await checkServiceHealth(service);
      services = [...services];
      
      alert(`✅ ${service.displayName} health check completed.\nStatus: ${service.status}\nResponse time: ${service.responseTime}ms`);
    }
  }
  
  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    
    if (autoRefresh) {
      // Refresh every 30 seconds
      refreshInterval = setInterval(() => {
        checkAllServices();
      }, 30000);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    }
  }
  
  function getStatusColor(status: ServiceStatus['status']): string {
    switch (status) {
      case 'online': return '#10b981';
      case 'degraded': return '#f59e0b';
      case 'offline': return '#ef4444';
      case 'checking': return '#6b7280';
      default: return '#6b7280';
    }
  }
  
  function getStatusIcon(status: ServiceStatus['status']): string {
    switch (status) {
      case 'online': return '✅';
      case 'degraded': return '⚠️';
      case 'offline': return '❌';
      case 'checking': return '🔄';
      default: return '❓';
    }
  }
  
  function formatResponseTime(ms: number | null): string {
    if (ms === null) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
  
  function formatLastCheck(date: Date | null): string {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }
  
  $: overallHealth = services.length > 0 
    ? services.filter(s => s.status === 'online').length / services.length * 100
    : 0;
  
  $: onlineCount = services.filter(s => s.status === 'online').length;
  $: degradedCount = services.filter(s => s.status === 'degraded').length;
  $: offlineCount = services.filter(s => s.status === 'offline').length;
</script>

<svelte:head>
  <title>Service Status - ACS Administration</title>
  <meta name="description" content="GenieACS service monitoring and control" />
</svelte:head>

<div class="services-page">
  <MainMenu />
  
  <div class="page-header">
    <div class="header-content">
      <a href="/modules/acs-cpe-management/admin" class="back-button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Admin
      </a>
      <h1 class="page-title">
        <span class="page-icon">🔧</span>
        Service Status & Monitoring
      </h1>
      <p class="page-description">
        Monitor and manage all GenieACS services and Firebase Functions
      </p>
    </div>
  </div>

  <div class="content">
    <!-- Overall Health Dashboard -->
    <div class="health-dashboard">
      <div class="health-card overall">
        <div class="health-icon">💚</div>
        <div class="health-content">
          <div class="health-label">System Health</div>
          <div class="health-value">{overallHealth.toFixed(0)}%</div>
          <div class="health-progress">
            <div class="health-progress-bar" style="width: {overallHealth}%"></div>
          </div>
        </div>
      </div>
      
      <div class="health-card online">
        <div class="health-icon">✅</div>
        <div class="health-content">
          <div class="health-label">Online</div>
          <div class="health-value">{onlineCount}</div>
          <div class="health-subtitle">{onlineCount} of {services.length} services</div>
        </div>
      </div>
      
      <div class="health-card degraded">
        <div class="health-icon">⚠️</div>
        <div class="health-content">
          <div class="health-label">Degraded</div>
          <div class="health-value">{degradedCount}</div>
          <div class="health-subtitle">Slow response time</div>
        </div>
      </div>
      
      <div class="health-card offline">
        <div class="health-icon">❌</div>
        <div class="health-content">
          <div class="health-label">Offline</div>
          <div class="health-value">{offlineCount}</div>
          <div class="health-subtitle">Not responding</div>
        </div>
      </div>
    </div>

    <!-- Control Panel -->
    <div class="control-panel">
      <div class="control-left">
        {#if lastRefreshTime}
          <span class="last-refresh">
            Last refresh: {formatLastCheck(lastRefreshTime)}
          </span>
        {/if}
      </div>
      
      <div class="control-right">
        <label class="auto-refresh-toggle">
          <input type="checkbox" bind:checked={autoRefresh} on:change={toggleAutoRefresh} />
          <span>Auto-refresh (30s)</span>
        </label>
        
        <button class="btn btn-primary" on:click={checkAllServices} disabled={isRefreshing}>
          {#if isRefreshing}
            <span class="spinner"></span>
            Checking...
          {:else}
            🔄 Refresh All
          {/if}
        </button>
      </div>
    </div>

    <!-- Services List -->
    <div class="services-list">
      {#each services as service (service.name)}
        <div class="service-card" style="border-left: 4px solid {getStatusColor(service.status)}">
          <div class="service-header">
            <div class="service-title-area">
              <span class="service-icon">{service.icon}</span>
              <div class="service-title-content">
                <h3 class="service-title">{service.displayName}</h3>
                <p class="service-description">{service.description}</p>
              </div>
            </div>
            
            <div class="service-status-badge" style="background: {getStatusColor(service.status)}20; color: {getStatusColor(service.status)}">
              {getStatusIcon(service.status)} {service.status.toUpperCase()}
            </div>
          </div>
          
          <div class="service-details">
            <div class="service-detail">
              <span class="detail-label">Endpoint:</span>
              <span class="detail-value endpoint">{service.endpoint}</span>
            </div>
            
            <div class="service-metrics">
              <div class="metric">
                <span class="metric-label">Response Time</span>
                <span class="metric-value" class:slow={service.responseTime && service.responseTime > 3000}>
                  {formatResponseTime(service.responseTime)}
                </span>
              </div>
              
              <div class="metric">
                <span class="metric-label">Last Check</span>
                <span class="metric-value">{formatLastCheck(service.lastCheck)}</span>
              </div>
            </div>
            
            {#if service.error}
              <div class="service-error">
                <span class="error-icon">⚠️</span>
                <span class="error-text">{service.error}</span>
              </div>
            {/if}
          </div>
          
          <div class="service-actions">
            <button 
              class="btn btn-sm btn-secondary" 
              on:click={() => checkServiceHealth(service)}
              disabled={service.status === 'checking'}
            >
              {#if service.status === 'checking'}
                <span class="spinner-sm"></span>
              {:else}
                🔍
              {/if}
              Check Health
            </button>
            
            <button 
              class="btn btn-sm btn-primary" 
              on:click={() => restartService(service)}
              disabled={service.status === 'checking'}
            >
              🔄 Restart
            </button>
          </div>
        </div>
      {/each}
    </div>

    <!-- Information Panel -->
    <div class="info-panel">
      <h3>📋 Service Information</h3>
      <div class="info-content">
        <p><strong>About Service Monitoring:</strong></p>
        <ul>
          <li>All services are Firebase Cloud Functions deployed in us-central1</li>
          <li>Health checks ping each endpoint to verify availability</li>
          <li>Response times over 5 seconds are considered degraded</li>
          <li>Cold starts may cause slower initial responses</li>
          <li>"Restart" triggers a health check to wake up cold functions</li>
        </ul>
        
        <p><strong>Service Roles:</strong></p>
        <ul>
          <li><strong>CWMP:</strong> Handles TR-069 device communication</li>
          <li><strong>NBI:</strong> Provides REST API for device management</li>
          <li><strong>FS:</strong> Serves firmware and configuration files</li>
          <li><strong>Sync:</strong> Synchronizes devices from MongoDB to Firestore</li>
          <li><strong>Get Devices:</strong> Retrieves device data for UI display</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<style>
  .services-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    margin-bottom: 0.5rem;
  }

  .back-button:hover {
    color: var(--accent-color);
    background: var(--bg-tertiary);
  }

  .back-button svg {
    flex-shrink: 0;
  }

  .page-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .page-icon {
    font-size: 1.25rem;
  }

  .page-description {
    color: var(--text-secondary);
    margin: 0;
  }

  .content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  /* Health Dashboard */
  .health-dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .health-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .health-icon {
    font-size: 2.5rem;
    flex-shrink: 0;
  }

  .health-content {
    flex: 1;
  }

  .health-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
  }

  .health-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .health-subtitle {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    margin-top: 0.25rem;
  }

  .health-progress {
    width: 100%;
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    margin-top: 0.75rem;
    overflow: hidden;
  }

  .health-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #22c55e);
    transition: width 0.3s ease;
  }

  /* Control Panel */
  .control-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem 1.5rem;
    margin-bottom: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .control-left {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .control-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .auto-refresh-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .auto-refresh-toggle input {
    cursor: pointer;
  }

  /* Services List */
  .services-list {
    display: grid;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .service-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .service-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .service-title-area {
    display: flex;
    gap: 1rem;
    flex: 1;
  }

  .service-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .service-title {
    margin: 0 0 0.25rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .service-description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .service-status-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .service-details {
    margin-bottom: 1rem;
  }

  .service-detail {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
  }

  .detail-label {
    font-weight: 500;
    color: var(--text-secondary);
  }

  .detail-value {
    color: var(--text-primary);
  }

  .detail-value.endpoint {
    font-family: monospace;
    font-size: 0.8125rem;
    word-break: break-all;
  }

  .service-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-tertiary);
    border-radius: 0.375rem;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .metric-label {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .metric-value {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .metric-value.slow {
    color: #f59e0b;
  }

  .service-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #fee2e2;
    border: 1px solid #ef4444;
    border-radius: 0.375rem;
    margin-top: 1rem;
    font-size: 0.875rem;
    color: #dc2626;
  }

  .service-actions {
    display: flex;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  /* Info Panel */
  .info-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .info-panel h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .info-content {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .info-content p {
    margin: 0 0 0.5rem 0;
  }

  .info-content ul {
    margin: 0.5rem 0 1rem 1.5rem;
    padding: 0;
  }

  .info-content li {
    margin-bottom: 0.375rem;
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--accent-color);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner-sm {
    width: 12px;
    height: 12px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .content {
      padding: 1rem;
    }

    .health-dashboard {
      grid-template-columns: 1fr;
    }

    .control-panel {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .control-right {
      justify-content: space-between;
    }

    .service-header {
      flex-direction: column;
      gap: 1rem;
    }

    .service-actions {
      flex-direction: column;
    }
  }
</style>

