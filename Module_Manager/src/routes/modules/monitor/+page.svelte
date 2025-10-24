<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';

  interface MapTool {
    id: string;
    name: string;
    description: string;
    icon: string;
    action: () => void;
    color: string;
  }

  const mapTools: MapTool[] = [
    {
      id: 'network-monitoring',
      name: 'Network Monitoring',
      description: 'Monitor network performance and health',
      icon: '📊',
      action: () => monitorNetwork(),
      color: '#3b82f6'
    },
    {
      id: 'cpe-monitoring',
      name: 'CPE Monitoring',
      description: 'Monitor customer equipment status',
      icon: '📡',
      action: () => monitorCPE(),
      color: '#10b981'
    },
    {
      id: 'alerts',
      name: 'Alerts',
      description: 'View and manage system alerts',
      icon: '🚨',
      action: () => viewAlerts(),
      color: '#ef4444'
    },
    {
      id: 'analytics',
      name: 'Analytics',
      description: 'Analyze network performance data',
      icon: '📈',
      action: () => viewAnalytics(),
      color: '#8b5cf6'
    },
    {
      id: 'reports',
      name: 'Reports',
      description: 'Generate monitoring reports',
      icon: '📋',
      action: () => generateReports(),
      color: '#f59e0b'
    },
    {
      id: 'maintenance',
      name: 'Maintenance',
      description: 'Schedule and track maintenance tasks',
      icon: '🔧',
      action: () => scheduleMaintenance(),
      color: '#06b6d4'
    }
  ];

  let currentUser: any = null;
  let mapContainer: HTMLDivElement;
  let showToolsModal = false;

  onMount(async () => {
    if (browser) {
      currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        goto('/login');
      }
    }
  });

  function handleToolClick(tool: MapTool) {
    tool.action();
  }

  function monitorNetwork() {
    goto('/modules/monitoring');
  }

  function monitorCPE() {
    goto('/modules/acs-cpe-management/monitoring');
  }

  function viewAlerts() {
    goto('/modules/monitoring/alerts');
  }

  function viewAnalytics() {
    goto('/modules/monitoring/analytics');
  }

  function generateReports() {
    goto('/modules/monitoring/reports');
  }

  function scheduleMaintenance() {
    goto('/modules/work-orders');
  }

  function goBack() {
    goto('/dashboard');
  }
</script>

<TenantGuard requireTenant={true}>
  <div class="monitor-module">
    <!-- Simplified Header -->
    <div class="module-header-simple">
      <h1>📊 Monitor</h1>
    </div>

    <!-- Map Container -->
    <div class="map-container">
      <!-- Map Area -->
      <div class="map-area" bind:this={mapContainer}>
        <iframe 
          src="/modules/coverage-map" 
          title="Network Coverage Map"
          class="coverage-map-iframe"
        ></iframe>
      </div>
      
      <!-- Floating Tools Modal -->
      <div class="tools-modal" class:open={showToolsModal}>
        <div class="tools-content">
          <div class="tools-header">
            <h3>Monitoring Tools</h3>
            <button class="close-btn" on:click={() => showToolsModal = false}>×</button>
          </div>
          <div class="tools-list">
            {#each mapTools as tool (tool.id)}
              <button 
                class="tool-btn"
                style="--tool-color: {tool.color};"
                on:click={() => handleToolClick(tool)}
              >
                <span class="tool-icon">{tool.icon}</span>
                <div class="tool-info">
                  <h4>{tool.name}</h4>
                  <p>{tool.description}</p>
                </div>
              </button>
            {/each}
          </div>
        </div>
      </div>
      
      <!-- Tools Toggle Button -->
      <button class="tools-toggle" on:click={() => showToolsModal = !showToolsModal}>
        <span class="toggle-icon">🛠️</span>
        <span class="toggle-text">Tools</span>
      </button>
    </div>

  </div>
</TenantGuard>

<style>
  .monitor-module {
    background: var(--background-color);
    min-height: 100vh;
    padding: 0.5rem;
    color: var(--text-color);
    display: flex;
    flex-direction: column;
  }

  .module-header-simple {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    border-radius: var(--border-radius-md);
    padding: 0.5rem 1rem;
    margin-bottom: 0.5rem;
    box-shadow: var(--shadow-sm);
    color: white;
    text-align: center;
    flex-shrink: 0;
  }

  .module-header-simple h1 {
    font-size: 1.2rem;
    margin: 0;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .map-container {
    flex-grow: 1;
    position: relative;
    background: var(--card-bg);
    border-radius: var(--border-radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    min-height: calc(100vh - 100px);
  }

  .map-area {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .coverage-map-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }

  .tools-modal {
    position: absolute;
    top: 20px;
    left: 20px;
    width: 320px;
    max-height: calc(100vh - 120px);
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-xl);
    z-index: 1000;
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    transition: all 0.3s ease;
  }

  .tools-modal.open {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  .tools-content {
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 120px);
  }

  .tools-header {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }

  .tools-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    font-size: 1.2rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .tools-list {
    flex-grow: 1;
    padding: 1rem;
    overflow-y: auto;
  }

  .tool-btn {
    width: 100%;
    background: var(--secondary-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: 0.75rem;
    margin-bottom: 0.75rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .tool-btn:hover {
    background: var(--primary-color-light);
    border-color: var(--primary-color);
    transform: translateX(2px);
  }

  .tool-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .tool-info h4 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 0.25rem 0;
  }

  .tool-info p {
    font-size: 0.75rem;
    color: var(--text-color-light);
    margin: 0;
    line-height: 1.3;
  }

  .tools-toggle {
    position: absolute;
    top: 20px;
    right: 20px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--border-radius-md);
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    box-shadow: var(--shadow-md);
    transition: all 0.2s ease;
    z-index: 999;
  }

  .tools-toggle:hover {
    background: var(--primary-color-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .toggle-icon {
    font-size: 1.2rem;
  }

  .toggle-text {
    font-size: 0.9rem;
    font-weight: 600;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .monitor-module {
      padding: 0.25rem;
    }

    .module-header-simple h1 {
      font-size: 1rem;
    }

    .tools-modal {
      width: 280px;
      top: 10px;
      left: 10px;
      max-height: calc(100vh - 80px);
    }

    .tools-toggle {
      top: 10px;
      right: 10px;
      padding: 0.5rem 0.75rem;
    }

    .toggle-text {
      display: none;
    }

    .map-container {
      min-height: calc(100vh - 80px);
    }
  }
</style>