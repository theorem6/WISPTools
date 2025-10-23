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
      id: 'pci-resolution',
      name: 'PCI Resolution',
      description: 'Automated Physical Cell ID conflict detection and resolution',
      icon: '📶',
      action: () => resolvePCI(),
      position: { x: 25, y: 20 },
      color: '#ef4444'
    },
    {
      id: 'acs-cpe-management',
      name: 'ACS CPE Management',
      description: 'Configure and manage Customer Premises Equipment via TR-069',
      icon: '📡',
      action: () => manageCPE(),
      position: { x: 75, y: 25 },
      color: '#10b981'
    },
    {
      id: 'work-orders',
      name: 'Work Orders',
      description: 'Manage and track all network deployment and maintenance tasks',
      icon: '📋',
      action: () => manageWorkOrders(),
      position: { x: 20, y: 60 },
      color: '#3b82f6'
    },
    {
      id: 'installation-management',
      name: 'Installation Management',
      description: 'Schedule technicians and track installation progress',
      icon: '👷',
      action: () => manageInstallations(),
      position: { x: 80, y: 65 },
      color: '#f59e0b'
    },
    {
      id: 'equipment-configuration',
      name: 'Equipment Configuration',
      description: 'Automate device provisioning and configuration',
      icon: '⚙️',
      action: () => configureEquipment(),
      position: { x: 50, y: 15 },
      color: '#8b5cf6'
    },
    {
      id: 'quality-assurance',
      name: 'Quality Assurance',
      description: 'Perform post-deployment testing and validation',
      icon: '✅',
      action: () => performQA(),
      position: { x: 50, y: 80 },
      color: '#06b6d4'
    }
  ];

  let currentUser: any = null;
  let mapContainer: HTMLDivElement;
  let selectedTool: MapTool | null = null;
  let showToolDetails = false;

  onMount(async () => {
    if (browser) {
      currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        goto('/login');
      }
    }
  });

  function handleToolClick(tool: MapTool) {
    selectedTool = tool;
    showToolDetails = true;
    tool.action();
  }

  function closeToolDetails() {
    showToolDetails = false;
    selectedTool = null;
  }

  function resolvePCI() {
    console.log('Starting PCI resolution...');
    goto('/modules/pci-resolution');
  }

  function manageCPE() {
    console.log('Managing CPE devices...');
    goto('/modules/acs-cpe-management');
  }

  function manageWorkOrders() {
    console.log('Managing work orders...');
    goto('/modules/work-orders');
  }

  function manageInstallations() {
    console.log('Managing installations...');
    goto('/modules/work-orders?view=installations');
  }

  function configureEquipment() {
    console.log('Configuring equipment...');
    goto('/modules/acs-cpe-management?mode=configuration');
  }

  function performQA() {
    console.log('Performing quality assurance...');
    goto('/modules/monitoring?view=qa');
  }

  function goBack() {
    goto('/dashboard');
  }
</script>

<TenantGuard requireTenant={true}>
  <div class="deploy-module">
    <!-- Header -->
    <div class="module-header">
      <div class="header-content">
        <button class="back-btn" on:click={goBack}>
          <span class="back-icon">←</span>
          Back to Dashboard
        </button>
        <div class="module-title">
          <h1>🚀 Deploy Module</h1>
          <p>Interactive map-based deployment tools for network rollouts</p>
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
        <h2>Network Deployment Map</h2>
        <p>Click on deployment tools to access different deployment features</p>
      </div>
      
      <div class="map-area" bind:this={mapContainer}>
        <!-- Map Background -->
        <div class="map-background">
          <div class="map-grid"></div>
          <div class="map-overlay">
            <div class="deployment-indicators">
              <div class="deployment-site" style="left: 30%; top: 40%;">
                <div class="site-tower"></div>
                <div class="site-signal"></div>
              </div>
              <div class="deployment-site" style="left: 70%; top: 45%;">
                <div class="site-tower"></div>
                <div class="site-signal"></div>
              </div>
              <div class="deployment-site" style="left: 50%; top: 70%;">
                <div class="site-tower"></div>
                <div class="site-signal"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Deployment Tools -->
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
              <div class="legend-color" style="background: #ef4444;"></div>
              <span>Resolution Tools</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #10b981;"></div>
              <span>Management Tools</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #3b82f6;"></div>
              <span>Workflow Tools</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #f59e0b;"></div>
              <span>Process Tools</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tool Details Modal -->
    {#if showToolDetails && selectedTool}
      <div class="tool-modal-overlay" on:click={closeToolDetails}>
        <div class="tool-modal" on:click|stopPropagation>
          <div class="modal-header">
            <h3>{selectedTool.name}</h3>
            <button class="close-btn" on:click={closeToolDetails}>×</button>
          </div>
          <div class="modal-content">
            <div class="tool-icon-large">{selectedTool.icon}</div>
            <p class="tool-description">{selectedTool.description}</p>
            <div class="modal-actions">
              <button class="action-btn primary" on:click={() => { selectedTool.action(); closeToolDetails(); }}>
                Open Tool
              </button>
              <button class="action-btn secondary" on:click={closeToolDetails}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</TenantGuard>

<style>
  .deploy-module {
    background: var(--background-color);
    min-height: 100vh;
    padding: 2rem;
    color: var(--text-color);
  }

  .module-header {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
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

  .deployment-indicators {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .deployment-site {
    position: absolute;
    transform: translate(-50%, -50%);
  }

  .site-tower {
    width: 8px;
    height: 40px;
    background: #374151;
    border-radius: 4px;
    position: relative;
  }

  .site-tower::before {
    content: '';
    position: absolute;
    top: -8px;
    left: -4px;
    width: 16px;
    height: 8px;
    background: #6b7280;
    border-radius: 8px 8px 0 0;
  }

  .site-signal {
    position: absolute;
    top: -20px;
    left: -20px;
    width: 40px;
    height: 40px;
    border: 2px solid #10b981;
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

  /* Tool Modal */
  .tool-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(5px);
  }

  .tool-modal {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    padding: 2rem;
    max-width: 400px;
    width: 90%;
    box-shadow: var(--shadow-xl);
    animation: modalSlideIn 0.3s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .modal-header h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--primary-color);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-color-light);
    padding: 0.25rem;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: var(--secondary-bg);
    color: var(--text-color);
  }

  .modal-content {
    text-align: center;
  }

  .tool-icon-large {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .tool-description {
    font-size: 1rem;
    color: var(--text-color-light);
    margin-bottom: 2rem;
    line-height: 1.5;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .action-btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--border-radius-md);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn.primary {
    background: var(--primary-color);
    color: white;
  }

  .action-btn.primary:hover {
    background: var(--primary-color-dark);
    transform: translateY(-1px);
  }

  .action-btn.secondary {
    background: var(--secondary-bg);
    color: var(--text-color);
    border: 1px solid var(--border-color);
  }

  .action-btn.secondary:hover {
    background: var(--border-color);
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .deploy-module {
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

    .legend-items {
      flex-direction: row;
      flex-wrap: wrap;
    }

    .modal-actions {
      flex-direction: column;
    }
  }
</style>