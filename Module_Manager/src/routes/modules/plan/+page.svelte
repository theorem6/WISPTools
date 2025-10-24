<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';

  let currentUser: any = null;
  let mapContainer: HTMLDivElement;
  let showReportModal = false;

  onMount(async () => {
    if (browser) {
      currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        goto('/login');
      }
    }
  });

  function goBack() {
    goto('/dashboard');
  }

  function openPlanningReport() {
    showReportModal = true;
  }

  function closeReportModal() {
    showReportModal = false;
  }
</script>

<TenantGuard requireTenant={true}>
  <div class="app">
    <!-- Full Screen Map -->
    <div class="map-fullscreen" bind:this={mapContainer}>
      <iframe 
        src="/modules/coverage-map?hideStats=true" 
        title="Plan"
        class="coverage-map-iframe"
      ></iframe>
    </div>

    <!-- Minimal Header Overlay -->
    <div class="header-overlay">
      <h1>📋</h1>
      <button class="report-btn" on:click={openPlanningReport} title="Planning Inventory Report">
        📊
      </button>
    </div>
  </div>

  <!-- Planning Report Modal -->
  {#if showReportModal}
    <div class="modal-overlay" on:click={closeReportModal}>
      <div class="modal-content" on:click|stopPropagation>
        <div class="modal-header">
          <h2>📊 Planning Inventory Report</h2>
          <button class="close-btn" on:click={closeReportModal}>✕</button>
        </div>
        
        <div class="modal-body">
          <div class="report-section">
            <h3>📡 Tower Sites</h3>
            <p>Complete inventory of all tower sites with coverage analysis and capacity planning data.</p>
            <button class="btn-primary" on:click={() => goto('/modules/coverage-map')}>
              View Tower Sites
            </button>
          </div>
          
          <div class="report-section">
            <h3>📶 Sector Analysis</h3>
            <p>Detailed sector coverage maps, interference analysis, and optimization recommendations.</p>
            <button class="btn-primary" on:click={() => goto('/modules/coverage-map')}>
              View Sector Analysis
            </button>
          </div>
          
          <div class="report-section">
            <h3>📱 CPE Planning</h3>
            <p>Customer premises equipment planning, signal strength analysis, and deployment recommendations.</p>
            <button class="btn-primary" on:click={() => goto('/modules/coverage-map')}>
              View CPE Planning
            </button>
          </div>
          
          <div class="report-section">
            <h3>🔧 Equipment Inventory</h3>
            <p>Complete equipment inventory with maintenance schedules and replacement planning.</p>
            <button class="btn-primary" on:click={() => goto('/modules/inventory')}>
              View Equipment Inventory
            </button>
          </div>
          
          <div class="report-section">
            <h3>📋 Work Orders</h3>
            <p>Planning work orders, maintenance schedules, and deployment tasks.</p>
            <button class="btn-primary" on:click={() => goto('/modules/work-orders')}>
              View Work Orders
            </button>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closeReportModal}>Close</button>
          <button class="btn-primary" on:click={() => { goto('/modules/coverage-map'); closeReportModal(); }}>
            Open Full Coverage Map
          </button>
        </div>
      </div>
    </div>
  {/if}
</TenantGuard>

<style>
  /* App Container - Full Screen */
  .app {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-primary);
  }

  /* Full Screen Map */
  .map-fullscreen {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .coverage-map-iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }

  /* Header Overlay */
  .header-overlay {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border-radius: var(--border-radius-md);
    padding: 0.5rem 1rem;
    box-shadow: var(--shadow-sm);
    color: white;
    text-align: center;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-overlay h1 {
    font-size: 1.2rem;
    margin: 0;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .report-btn {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    padding: 0.5rem;
    font-size: 1.1rem;
    cursor: pointer;
    color: white;
    transition: all 0.2s;
    backdrop-filter: blur(10px);
  }

  .report-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-1px);
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--border-color);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    transition: var(--transition);
  }

  .close-btn:hover {
    color: var(--text-primary);
  }

  .modal-body {
    padding: var(--spacing-lg);
    overflow-y: auto;
    flex: 1;
  }

  .report-section {
    margin-bottom: var(--spacing-xl);
    padding: var(--spacing-lg);
    background: var(--bg-secondary);
    border-radius: var(--border-radius-md);
    border: 1px solid var(--border-color);
  }

  .report-section h3 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: 1.1rem;
    color: var(--brand-primary);
    font-weight: 600;
  }

  .report-section p {
    margin: 0 0 var(--spacing-md) 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .btn-primary, .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--brand-primary-hover);
    transform: translateY(-2px);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }

  .modal-footer {
    padding: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
  }
</style>