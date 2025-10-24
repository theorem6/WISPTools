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
      id: 'coverage-analysis',
      name: 'Coverage Analysis',
      description: 'Analyze current coverage and identify gaps',
      icon: '📊',
      action: () => analyzeCoverage(),
      position: { x: 20, y: 30 },
      color: '#3b82f6'
    },
    {
      id: 'site-planning',
      name: 'Site Planning',
      description: 'Plan new tower locations and sectors',
      icon: '🗼',
      action: () => planNewSite(),
      position: { x: 80, y: 25 },
      color: '#10b981'
    },
    {
      id: 'inventory-check',
      name: 'Inventory Check',
      description: 'Check equipment availability and capacity',
      icon: '📦',
      action: () => checkInventory(),
      position: { x: 15, y: 70 },
      color: '#f59e0b'
    },
    {
      id: 'cbrs-spectrum',
      name: 'CBRS Spectrum',
      description: 'Manage CBRS grants and spectrum allocation',
      icon: '📡',
      action: () => manageCBRS(),
      position: { x: 85, y: 70 },
      color: '#ef4444'
    },
    {
      id: 'capacity-planning',
      name: 'Capacity Planning',
      description: 'Plan bandwidth and capacity requirements',
      icon: '📈',
      action: () => planCapacity(),
      position: { x: 50, y: 15 },
      color: '#8b5cf6'
    },
    {
      id: 'cost-analysis',
      name: 'Cost Analysis',
      description: 'Calculate ROI and project costs',
      icon: '💰',
      action: () => analyzeCosts(),
      position: { x: 50, y: 85 },
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

  function analyzeCoverage() {
    goto('/modules/coverage-map');
  }

  function planNewSite() {
    goto('/modules/coverage-map');
  }

  function checkInventory() {
    goto('/modules/inventory');
  }

  function manageCBRS() {
    goto('/modules/cbrs-management');
  }

  function planCapacity() {
    goto('/modules/monitoring');
  }

  function analyzeCosts() {
    goto('/modules/inventory/reports');
  }

  function goBack() {
    goto('/dashboard');
  }
</script>

<TenantGuard requireTenant={true}>
  <div class="plan-module">
    <!-- Header -->
    <div class="module-header">
      <div class="header-content">
        <button class="back-btn" on:click={goBack}>
          <span class="back-icon">←</span>
          Back to Dashboard
        </button>
        <div class="module-title">
          <h1>📋 Plan Module</h1>
          <p>Interactive map-based planning tools for network expansion</p>
        </div>
        <div class="user-info">
          {#if currentUser}
            <span class="user-name">{currentUser.email}</span>
            <span class="user-role">{$currentTenant?.name || 'No Tenant'}</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Map Container with Sidebar -->
    <div class="map-container-with-sidebar">
      <!-- Tools Sidebar -->
      <div class="tools-sidebar">
        <h3>Planning Tools</h3>
        <p class="sidebar-subtitle">Select a tool to access features</p>
        {#each mapTools as tool (tool.id)}
          <button 
            class="sidebar-tool"
            style="--tool-color: {tool.color};"
            on:click={() => handleToolClick(tool)}
          >
            <span class="sidebar-icon">{tool.icon}</span>
            <div class="sidebar-tool-info">
              <h4>{tool.name}</h4>
              <p>{tool.description}</p>
            </div>
          </button>
        {/each}
      </div>
      
      <!-- Map Area (Embedded Coverage Map) -->
      <div class="map-area-full" bind:this={mapContainer}>
        <iframe 
          src="/modules/coverage-map" 
          title="Network Coverage Map"
          class="coverage-map-iframe"
        ></iframe>
      </div>
    </div>

  </div>
</TenantGuard>

<style>
  .plan-module {
    background: var(--background-color);
    min-height: 100vh;
    padding: 2rem;
    color: var(--text-color);
  }

  .module-header {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
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

  /* New Sidebar Layout */
  .map-container-with-sidebar {
    flex-grow: 1;
    display: flex;
    gap: 1.5rem;
    overflow: hidden;
  }

  .tools-sidebar {
    width: 300px;
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    padding: 1.5rem;
    box-shadow: var(--shadow-md);
    overflow-y: auto;
    flex-shrink: 0;
  }

  .tools-sidebar h3 {
    font-size: 1.3rem;
    color: var(--primary-color);
    margin: 0 0 0.5rem 0;
  }

  .sidebar-subtitle {
    font-size: 0.85rem;
    color: var(--text-color-light);
    margin: 0 0 1.5rem 0;
  }

  .sidebar-tool {
    width: 100%;
    background: var(--secondary-bg);
    border: 2px solid var(--border-color);
    border-radius: var(--border-radius-md);
    padding: 1rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .sidebar-tool:hover {
    background: var(--primary-color-light);
    border-color: var(--primary-color);
    transform: translateX(3px);
  }

  .sidebar-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .sidebar-tool-info h4 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 0.25rem 0;
  }

  .sidebar-tool-info p {
    font-size: 0.75rem;
    color: var(--text-color-light);
    margin: 0;
    line-height: 1.3;
  }

  .map-area-full {
    flex-grow: 1;
    position: relative;
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    min-height: 600px;
  }

  .coverage-map-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
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
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
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

  .coverage-indicators {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .coverage-circle {
    position: absolute;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0.1) 50%, transparent 70%);
    transform: translate(-50%, -50%);
    animation: pulse 3s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
    50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.4; }
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


  /* Responsive Design */
  @media (max-width: 768px) {
    .plan-module {
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