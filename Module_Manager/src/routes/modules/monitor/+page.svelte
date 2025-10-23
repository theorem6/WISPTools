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
    position: { x: number; y: number };
    color: string;
  }

  const mapTools: MapTool[] = [
    {
      id: 'network-monitoring',
      name: 'Network Monitoring',
      description: 'Real-time performance metrics and network health status',
      icon: '📈',
      action: () => monitorNetwork(),
      position: { x: 30, y: 25 },
      color: '#3b82f6'
    },
    {
      id: 'device-health',
      name: 'Device Health',
      description: 'Monitor the operational status and diagnostics of all network devices',
      icon: '❤️',
      action: () => checkDeviceHealth(),
      position: { x: 70, y: 30 },
      color: '#ef4444'
    },
    {
      id: 'traffic-analysis',
      name: 'Traffic Analysis',
      description: 'Analyze bandwidth utilization and user traffic patterns',
      icon: '📊',
      action: () => analyzeTraffic(),
      position: { x: 25, y: 65 },
      color: '#10b981'
    },
    {
      id: 'performance-analytics',
      name: 'Performance Analytics',
      description: 'View key performance indicators and historical trends',
      icon: '📉',
      action: () => viewAnalytics(),
      position: { x: 75, y: 70 },
      color: '#f59e0b'
    },
    {
      id: 'alert-management',
      name: 'Alert Management',
      description: 'Configure and manage automated alerts and notifications',
      icon: '🔔',
      action: () => manageAlerts(),
      position: { x: 50, y: 20 },
      color: '#8b5cf6'
    },
    {
      id: 'hss-management',
      name: 'HSS Management',
      description: 'Manage subscriber profiles and SIM card provisioning',
      icon: '👤',
      action: () => manageHSS(),
      position: { x: 50, y: 80 },
      color: '#06b6d4'
    }
  ];

  let currentUser: any = null;
  let mapContainer: HTMLDivElement;

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

  function checkDeviceHealth() {
    goto('/modules/acs-cpe-management/monitoring');
  }

  function analyzeTraffic() {
    goto('/modules/monitoring');
  }

  function viewAnalytics() {
    goto('/modules/monitoring');
  }

  function manageAlerts() {
    goto('/modules/monitoring');
  }

  function manageHSS() {
    goto('/modules/hss-management');
  }

  function goBack() {
    goto('/dashboard');
  }
</script>

<TenantGuard requireTenant={true}>
  <div class="monitor-module">
    <!-- Header -->
    <div class="module-header">
      <div class="header-content">
        <button class="back-btn" on:click={goBack}>
          <span class="back-icon">←</span>
          Back to Dashboard
        </button>
        <div class="module-title">
          <h1>📊 Monitor Module</h1>
          <p>Interactive map-based monitoring tools for network oversight</p>
        </div>
        <div class="user-info">
          {#if currentUser}
            <span class="user-name">{currentUser.email}</span>
            <span class="user-role">{$currentTenant?.name || 'No Tenant'}</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Map Container -->
    <div class="map-container">
      <div class="map-header">
        <h2>Network Monitoring Map</h2>
        <p>Click on monitoring tools to access different monitoring features</p>
      </div>
      
      <div class="map-area" bind:this={mapContainer}>
        <!-- Map Background -->
        <div class="map-background">
          <div class="map-grid"></div>
          <div class="map-overlay">
            <div class="monitoring-indicators">
              <div class="monitoring-node" style="left: 30%; top: 40%;">
                <div class="node-icon">📡</div>
                <div class="node-status online"></div>
                <div class="node-signal"></div>
              </div>
              <div class="monitoring-node" style="left: 70%; top: 45%;">
                <div class="node-icon">📡</div>
                <div class="node-status warning"></div>
                <div class="node-signal"></div>
              </div>
              <div class="monitoring-node" style="left: 50%; top: 70%;">
                <div class="node-icon">📡</div>
                <div class="node-status online"></div>
                <div class="node-signal"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Monitoring Tools -->
        {#each mapTools as tool (tool.id)}
          <div 
            class="map-tool"
            style="left: {tool.position.x}%; top: {tool.position.y}%; --tool-color: {tool.color};"
            on:click={() => handleToolClick(tool)}
            on:keydown={(e) => e.key === 'Enter' && handleToolClick(tool)}
            role="button"
            tabindex="0"
          >
            <div class="tool-icon">{tool.icon}</div>
            <div class="tool-name">{tool.name}</div>
            <div class="tool-pulse"></div>
          </div>
        {/each}

        <!-- Map Legend -->
        <div class="map-legend">
          <h3>Legend</h3>
          <div class="legend-items">
            <div class="legend-item">
              <div class="legend-color" style="background: #3b82f6;"></div>
              <span>Monitoring Tools</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #ef4444;"></div>
              <span>Health Tools</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #10b981;"></div>
              <span>Analysis Tools</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #f59e0b;"></div>
              <span>Analytics Tools</span>
            </div>
          </div>
        </div>

        <!-- Status Panel -->
        <div class="status-panel">
          <h3>Network Status</h3>
          <div class="status-items">
            <div class="status-item">
              <div class="status-indicator online"></div>
              <span>Online: 2</span>
            </div>
            <div class="status-item">
              <div class="status-indicator warning"></div>
              <span>Warning: 1</span>
            </div>
            <div class="status-item">
              <div class="status-indicator offline"></div>
              <span>Offline: 0</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</TenantGuard>

<style>
  .monitor-module {
    background: var(--background-color);
    min-height: 100vh;
    padding: 2rem;
    color: var(--text-color);
  }

  .module-header {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    border-radius: var(--border-radius-lg);
    padding: 1.5rem 2rem;
    margin-bottom: 2rem;
    box-shadow: var(--shadow-md);
    color: white;
    position: relative;
    overflow: hidden;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .back-btn {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: none;
    border-radius: var(--border-radius-md);
    padding: 0.5rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background 0.2s ease;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .back-icon {
    font-size: 1.2rem;
  }

  .module-title h1 {
    font-size: 2rem;
    margin: 0;
    font-weight: 700;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .module-title p {
    font-size: 0.9rem;
    margin: 0;
    opacity: 0.8;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: 0.85rem;
    opacity: 0.9;
  }

  .user-name {
    font-weight: 600;
  }

  .user-role {
    font-style: italic;
  }

  /* Map Container */
  .map-container {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    padding: 2rem;
    box-shadow: var(--shadow-lg);
  }

  .map-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .map-header h2 {
    font-size: 1.8rem;
    color: var(--primary-color);
    margin: 0 0 0.5rem 0;
  }

  .map-header p {
    color: var(--text-color-light);
    margin: 0;
  }

  .map-area {
    position: relative;
    height: 600px;
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    border-radius: var(--border-radius-md);
    overflow: hidden;
    border: 2px solid var(--border-color);
  }

  .map-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .map-grid {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
    background-size: 50px 50px;
    opacity: 0.3;
  }

  .map-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .monitoring-indicators {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .monitoring-node {
    position: absolute;
    transform: translate(-50%, -50%);
  }

  .node-icon {
    font-size: 1.5rem;
    text-align: center;
    margin-bottom: 0.25rem;
  }

  .node-status {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin: 0 auto;
    position: relative;
  }

  .node-status.online {
    background: #10b981;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
  }

  .node-status.warning {
    background: #f59e0b;
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
  }

  .node-status.offline {
    background: #ef4444;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
  }

  .node-signal {
    position: absolute;
    top: -15px;
    left: -15px;
    width: 30px;
    height: 30px;
    border: 2px solid #f59e0b;
    border-radius: 50%;
    animation: signalPulse 2s ease-in-out infinite;
  }

  @keyframes signalPulse {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.3); opacity: 0.3; }
  }

  /* Map Tools */
  .map-tool {
    position: absolute;
    transform: translate(-50%, -50%);
    cursor: pointer;
    z-index: 10;
    transition: all 0.3s ease;
  }

  .map-tool:hover {
    transform: translate(-50%, -50%) scale(1.1);
  }

  .tool-icon {
    width: 60px;
    height: 60px;
    background: var(--tool-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    color: white;
    box-shadow: var(--shadow-md);
    border: 3px solid white;
    transition: all 0.3s ease;
  }

  .map-tool:hover .tool-icon {
    box-shadow: var(--shadow-lg);
    transform: scale(1.1);
  }

  .tool-name {
    position: absolute;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .map-tool:hover .tool-name {
    opacity: 1;
  }

  .tool-pulse {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    background: var(--tool-color);
    opacity: 0.3;
    animation: toolPulse 2s ease-in-out infinite;
  }

  @keyframes toolPulse {
    0% { transform: scale(1); opacity: 0.3; }
    50% { transform: scale(1.3); opacity: 0.1; }
    100% { transform: scale(1); opacity: 0.3; }
  }

  /* Map Legend */
  .map-legend {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.95);
    padding: 1rem;
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(10px);
  }

  .map-legend h3 {
    font-size: 0.9rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: var(--text-color);
  }

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  /* Status Panel */
  .status-panel {
    position: absolute;
    bottom: 20px;
    left: 20px;
    background: rgba(255, 255, 255, 0.95);
    padding: 1rem;
    border-radius: var(--border-radius-md);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(10px);
  }

  .status-panel h3 {
    font-size: 0.9rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: var(--text-color);
  }

  .status-items {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-indicator.online {
    background: #10b981;
  }

  .status-indicator.warning {
    background: #f59e0b;
  }

  .status-indicator.offline {
    background: #ef4444;
  }


  /* Responsive Design */
  @media (max-width: 768px) {
    .monitor-module {
      padding: 1rem;
    }

    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .user-info {
      align-items: flex-start;
    }

    .map-area {
      height: 500px;
    }

    .map-tool {
      transform: translate(-50%, -50%) scale(0.8);
    }

    .map-legend {
      position: relative;
      top: auto;
      right: auto;
      margin-top: 1rem;
      width: 100%;
    }

    .status-panel {
      position: relative;
      bottom: auto;
      left: auto;
      margin-top: 1rem;
      width: 100%;
    }

    .legend-items {
      flex-direction: row;
      flex-wrap: wrap;
    }

    .modal-actions {
      flex-direction: column;
    }
  }
</style>