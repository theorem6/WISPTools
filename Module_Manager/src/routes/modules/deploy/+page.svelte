<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { planService, type PlanProject } from '$lib/services/planService';
  import SettingsButton from '$lib/components/SettingsButton.svelte';
  import PCIPlannerModal from './components/PCIPlannerModal.svelte';
  import FrequencyPlannerModal from './components/FrequencyPlannerModal.svelte';
  import PlanApprovalModal from './components/PlanApprovalModal.svelte';
  import DeployedHardwareModal from './components/DeployedHardwareModal.svelte';
  import ProjectFilterPanel from './components/ProjectFilterPanel.svelte';
import SharedMap from '$lib/map/SharedMap.svelte';
import { mapLayerManager, type MapLayerManagerState } from '$lib/map/MapLayerManager';
import { mapContext } from '$lib/map/mapContext';
import type { MapModuleMode } from '$lib/map/MapCapabilities';

  let currentUser: any = null;
  let mapContainer: HTMLDivElement;
  let mapState: MapLayerManagerState | undefined;
  let mapMode: MapModuleMode = 'deploy';
  
  // Plan approval workflow
  let showPlanApprovalModal = false;
  let readyPlans: PlanProject[] = [];
  let selectedPlan: PlanProject | null = null;
  let isLoadingPlans = false;
  let approvalMode: 'approve' | 'reject' | null = null;
  
  // Project filtering
  let showProjectFilters = false;
  let approvedPlans: PlanProject[] = [];
  let visiblePlanIds: Set<string> = new Set();
  
  // PCI Planner
  let showPCIPlannerModal = false;

  // Frequency Planner
  let showFrequencyPlannerModal = false;
  
  // Deployed Hardware
  let showDeployedHardwareModal = false;
  let deployedCount = 0;
  let error = '';
  let deploymentMessage = '';



  // Reactive tenant tracking
  $: console.log('[Deploy] Tenant state changed:', $currentTenant);
  $: isAdmin = currentUser?.email === 'david@david.com' || currentUser?.email?.includes('admin');
  $: buttonsDisabled = !isAdmin && !$currentTenant;

  $: mapState = $mapContext as MapLayerManagerState;
  $: mapMode = mapState?.mode ?? 'deploy';

  onMount(async () => {
    if (browser) {
      currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        goto('/login');
        return;
      }
      
      mapLayerManager.setMode('deploy');
      await loadReadyPlans();
    }
    
    return () => {
    };
  });


  async function loadReadyPlans() {
    isLoadingPlans = true;
    try {
      const tenantId = $currentTenant?.id;
      if (tenantId) {
        // Get plans that are ready for approval OR approved (for deployment)
        const allPlans = await planService.getPlans(tenantId);
        readyPlans = allPlans.filter(plan => 
          plan.status === 'ready' || plan.status === 'approved' || plan.status === 'authorized'
        );
        
        // Separate approved plans for filtering
        approvedPlans = allPlans.filter(plan => plan.status === 'approved' || plan.status === 'authorized');
        
        // Initialize visible plan IDs from plans with showOnMap = true
        visiblePlanIds = new Set(
          approvedPlans.filter(p => p.showOnMap).map(p => p.id)
        );
        
        await mapLayerManager.loadProductionHardware(tenantId);
        const planToLoad = approvedPlans.find(p => p.showOnMap) || approvedPlans[0];
        if (planToLoad) {
          await mapLayerManager.loadPlan(tenantId, planToLoad);
        }
        
        // Load deployed hardware count
        try {
          const { coverageMapService } = await import('../coverage-map/lib/coverageMapService.mongodb');
          const deployments = await coverageMapService.getAllHardwareDeployments(tenantId);
          deployedCount = deployments.length;
        } catch (err) {
          console.error('Failed to load deployment count:', err);
        }
      }
    } catch (err) {
      console.error('Failed to load ready plans:', err);
    } finally {
      isLoadingPlans = false;
    }
  }

  async function focusPlanOnMap(planId: string | null) {
    const tenantId = $currentTenant?.id;
    if (!tenantId || !planId) return;
    const plan = approvedPlans.find(p => p.id === planId);
    if (plan) {
      await mapLayerManager.loadPlan(tenantId, plan);
    }
  }

  function goBack() {
    goto('/dashboard');
  }

  async function pushActivePlanToField() {
    const tenantId = $currentTenant?.id;
    const plan = mapState?.activePlan;

    if (!tenantId || !plan) {
      deploymentMessage = 'Select an authorized plan to deploy.';
      setTimeout(() => (deploymentMessage = ''), 4000);
      return;
    }

    try {
      const { features } = await planService.getPlanFeatures(plan.id);
      console.log('[Deploy] Preparing deployment package', {
        planId: plan.id,
        tenantId,
        featureCount: features.length
      });
      deploymentMessage = `Deployment package for "${plan.name}" prepared (${features.length} items).`;
    } catch (err: any) {
      console.error('Failed to prepare deployment package:', err);
      deploymentMessage = err?.message || 'Failed to prepare deployment package.';
    } finally {
      setTimeout(() => (deploymentMessage = ''), 6000);
    }
  }

  // Plan approval functions
  function openPlanApproval() {
    showPlanApprovalModal = true;
    if (readyPlans.length > 0 && !selectedPlan) {
      selectedPlan = readyPlans[0];
    }
  }

  function closePlanApprovalModal() {
    showPlanApprovalModal = false;
    selectedPlan = null;
    approvalMode = null;
  }

  function selectPlanForApproval(plan: PlanProject) {
    selectedPlan = plan;
    showPlanApprovalModal = true;
  }

  async function handlePlanApproved(event: CustomEvent) {
    await loadReadyPlans();
    // Keep modal open but update selected plan
    if (selectedPlan) {
      const updatedPlan = readyPlans.find(p => p.id === selectedPlan?.id);
      if (updatedPlan) {
        selectedPlan = updatedPlan;
        // Automatically show approved plan on map
        if (updatedPlan.status === 'approved') {
          await planService.updatePlan(updatedPlan.id, { showOnMap: true });
          visiblePlanIds.add(updatedPlan.id);
          visiblePlanIds = new Set(visiblePlanIds);
          await focusPlanOnMap(updatedPlan.id);
        } else if (updatedPlan.status === 'authorized') {
          visiblePlanIds.delete(updatedPlan.id);
          visiblePlanIds = new Set(visiblePlanIds);
          const nextPlanId = [...visiblePlanIds][0] || null;
          await focusPlanOnMap(nextPlanId);
        }
      }
    }
  }

  async function handlePlanRejected(event: CustomEvent) {
      await loadReadyPlans();
    // Remove rejected plan from selection
    if (selectedPlan && selectedPlan.status === 'rejected') {
      selectedPlan = readyPlans.find(p => p.status === 'ready' || p.status === 'approved' || p.status === 'authorized') || null;
      const nextPlanId = [...visiblePlanIds][0] || null;
      await focusPlanOnMap(nextPlanId);
    }
  }

  // PCI Planner functions
  function openPCIPlanner() {
    console.log('[Deploy] Opening PCI Planner modal');
    console.log('[Deploy] Current tenant:', $currentTenant);
    console.log('[Deploy] Tenant ID:', $currentTenant?.id);
    
    // Check if user is admin - if so, allow opening without tenant
    const isAdmin = currentUser?.email === 'david@david.com' || currentUser?.email?.includes('admin');
    
    if (!isAdmin && !$currentTenant?.id) {
      console.error('[Deploy] No tenant available and user is not admin - cannot open PCI Planner');
      alert('No tenant selected. Please ensure you are properly logged in and have selected a tenant.');
      return;
    }
    
    showPCIPlannerModal = true;
  }

  function closePCIPlannerModal() {
    console.log('[Deploy] Closing PCI Planner modal');
    showPCIPlannerModal = false;
  }

  // Frequency Planner functions
  function openFrequencyPlanner() {
    console.log('[Deploy] Opening Frequency Planner modal');
    console.log('[Deploy] Current tenant:', $currentTenant);
    console.log('[Deploy] Tenant ID:', $currentTenant?.id);
    
    // Check if user is admin - if so, allow opening without tenant
    const isAdmin = currentUser?.email === 'david@david.com' || currentUser?.email?.includes('admin');
    
    if (!isAdmin && !$currentTenant?.id) {
      console.error('[Deploy] No tenant available and user is not admin - cannot open Frequency Planner');
      alert('No tenant selected. Please ensure you are properly logged in and have selected a tenant.');
      return;
    }
    
    showFrequencyPlannerModal = true;
  }

  function closeFrequencyPlannerModal() {
    console.log('[Deploy] Closing Frequency Planner modal');
    showFrequencyPlannerModal = false;
  }

</script>

<TenantGuard>
  <div class="app">
    <!-- Full Screen Map -->
    <div class="map-fullscreen" bind:this={mapContainer}>
      <SharedMap mode={mapMode} />
    </div>

    <!-- Minimal Header Overlay -->
    <!-- Deploy Header Overlay -->
    <div class="header-overlay">
      <div class="header-left">
        <button class="back-btn" on:click={() => {
          console.log('[Deploy] Back to Dashboard clicked');
          goto('/dashboard');
        }} title="Back to Dashboard">
          ←
        </button>
        <h1>🚀 Deploy</h1>
      </div>
      <div class="header-controls">
        <button 
          class="control-btn" 
          class:active={showProjectFilters}
          on:click={() => showProjectFilters = !showProjectFilters} 
          title="Project Filters"
        >
          🔍 Projects ({approvedPlans.length})
        </button>
        <button class="control-btn" on:click={openPlanApproval} title="Plan Approval">
          📋 Plans ({readyPlans.length})
        </button>
        <button 
          class="control-btn" 
          class:disabled={buttonsDisabled}
          on:click={() => {
            console.log('[Deploy] PCI button clicked');
            openPCIPlanner();
          }} 
          title={isAdmin ? "PCI Planner (Admin)" : ($currentTenant ? "PCI Planner" : "PCI Planner (No tenant selected)")}
        >
          📊 PCI
        </button>

        <button 
          class="control-btn" 
          class:disabled={buttonsDisabled}
          on:click={() => {
            console.log('[Deploy] Frequency button clicked');
            openFrequencyPlanner();
          }} 
          title={isAdmin ? "Frequency Planner (Admin)" : ($currentTenant ? "Frequency Planner" : "Frequency Planner (No tenant selected)")}
        >
          📡 Frequency
        </button>
        <button 
          class="control-btn" 
          on:click={() => showDeployedHardwareModal = true}
          title="View and Edit Deployed Hardware"
        >
          🔧 Deployed ({deployedCount})
        </button>
        <button 
          class="control-btn deploy-btn" 
          class:disabled={!mapState?.activePlan}
          disabled={!mapState?.activePlan}
          on:click={pushActivePlanToField}
          title={mapState?.activePlan ? `Push ${mapState.activePlan.name} to field teams` : 'Select a plan to deploy'}
        >
          🚀 Deploy Plan
        </button>
      </div>
    </div>

  </div>

  {#if mapState?.activePlan}
    <div class="plan-summary">
      <h3>Active Plan: {mapState.activePlan.name}</h3>
      <p class="summary-line">
        {mapState.stagedSummary.total} staged features • {mapState.productionHardware.length} production assets in view
      </p>
    </div>
  {/if}

  {#if deploymentMessage}
    <div class="deployment-toast">{deploymentMessage}</div>
  {/if}

  {#if error}
    <div class="error-toast">{error}</div>
  {/if}

  <!-- PCI Planner Modal -->
  {#if showPCIPlannerModal && ($currentTenant?.id || isAdmin)}
    <PCIPlannerModal
      show={showPCIPlannerModal}
      tenantId={$currentTenant?.id || ''}
      on:close={closePCIPlannerModal}
    />
  {/if}

  <!-- Frequency Planner Modal -->
  {#if showFrequencyPlannerModal && ($currentTenant?.id || isAdmin)}
    <FrequencyPlannerModal
      show={showFrequencyPlannerModal}
      tenantId={$currentTenant?.id || ''}
      on:close={closeFrequencyPlannerModal}
    />
  {/if}

  <!-- Plan Approval Modal -->
  {#if showPlanApprovalModal && selectedPlan}
    <PlanApprovalModal
      show={showPlanApprovalModal}
      plan={selectedPlan}
      on:close={closePlanApprovalModal}
      on:approved={handlePlanApproved}
      on:rejected={handlePlanRejected}
    />
  {/if}
  
  <!-- Deployed Hardware Modal -->
  <DeployedHardwareModal
    show={showDeployedHardwareModal}
    tenantId={$currentTenant?.id || ''}
    on:close={() => showDeployedHardwareModal = false}
  />
  
  <!-- Project Filter Panel -->
  <ProjectFilterPanel
    show={showProjectFilters}
    approvedPlans={approvedPlans}
    visiblePlanIds={visiblePlanIds}
    on:close={() => showProjectFilters = false}
    on:visibility-changed={async (event: CustomEvent<{ planId: string; visible: boolean }>) => {
      const { planId, visible } = event.detail;
      await loadReadyPlans();
      if (visible) {
        await focusPlanOnMap(planId);
      } else {
        const nextPlanId = [...visiblePlanIds][0] || null;
        await focusPlanOnMap(nextPlanId);
      }
    }}
  />

  <!-- TODO: replace placeholder SharedMap overlay with interactive map layers -->
  <!-- TODO: integrate deploy task assignment workflow once backend endpoints are ready -->
  
  <!-- Plan Selection Modal (if no plan selected) -->
  {#if showPlanApprovalModal && !selectedPlan && readyPlans.length > 0}
    <div class="modal-overlay" on:click={closePlanApprovalModal}>
      <div class="plan-list-modal" on:click|stopPropagation>
        <div class="modal-header">
          <h2>📋 Select Plan to Approve/Reject</h2>
          <button class="close-btn" on:click={closePlanApprovalModal}>✕</button>
        </div>
        
        <div class="modal-body">
          {#if isLoadingPlans}
            <div class="loading">Loading plans...</div>
          {:else if readyPlans.length === 0}
            <div class="empty-state">
              <p>No plans ready for approval</p>
            </div>
          {:else}
            <div class="plan-list">
              {#each readyPlans as plan}
                <div class="plan-item" on:click={() => selectPlanForApproval(plan)}>
                  <div class="plan-header">
                    <h3>{plan.name}</h3>
                    <span class="status-badge {plan.status}">{plan.status}</span>
                  </div>
                  {#if plan.description}
                    <p class="plan-description">{plan.description}</p>
                  {/if}
                  <div class="plan-meta">
                    <span>Scope: {plan.scope.towers.length} towers, {plan.scope.sectors.length} sectors</span>
                    {#if plan.purchasePlan?.totalEstimatedCost}
                      <span>Cost: ${plan.purchasePlan.totalEstimatedCost.toLocaleString()}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closePlanApprovalModal}>Cancel</button>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Global Settings Button -->
  <SettingsButton />
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

  /* Left Horizontal Menu */
  .header-overlay {
    position: absolute;
    top: 20px;
    left: 20px;
    background: var(--gradient-success);
    border-radius: var(--border-radius-md);
    padding: 0.75rem 1rem;
    box-shadow: var(--shadow-sm);
    color: white;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .back-btn {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    padding: 0.5rem;
    font-size: 1.2rem;
    cursor: pointer;
    color: white;
    transition: all 0.2s;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateX(-2px);
  }

  .header-overlay h1 {
    font-size: 1.2rem;
    margin: 0;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }


  .btn-primary, .btn-secondary {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
  }

  .btn-primary {
    background: var(--brand-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--brand-primary-hover);
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--bg-tertiary);
  }

  /* Control Button Styles */
  .control-btn {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
    backdrop-filter: blur(10px);
  }

  .control-btn.deploy-btn {
    background: rgba(59, 130, 246, 0.25);
  }

  .control-btn.deploy-btn:hover {
    background: rgba(59, 130, 246, 0.35);
  }

  .control-btn.deploy-btn.disabled,
  .control-btn.deploy-btn:disabled {
    background: rgba(148, 163, 184, 0.25);
  }

  .plan-summary {
    position: absolute;
    bottom: 40px;
    left: 20px;
    background: rgba(15, 23, 42, 0.75);
    padding: 0.85rem 1.2rem;
    border-radius: var(--border-radius-md);
    color: #e2e8f0;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(8px);
    max-width: 320px;
  }

  .plan-summary h3 {
    margin: 0 0 0.35rem 0;
    font-size: 1rem;
  }

  .plan-summary .summary-line {
    margin: 0;
    font-size: 0.9rem;
    color: rgba(226, 232, 240, 0.85);
  }

  .deployment-toast {
    position: absolute;
    bottom: 20px;
    right: 20px;
    background: rgba(34, 197, 94, 0.9);
    color: #0f172a;
    padding: 0.75rem 1.25rem;
    border-radius: var(--border-radius-md);
    box-shadow: 0 12px 30px rgba(16, 185, 129, 0.35);
    font-weight: 600;
  }

  .error-toast {
    position: absolute;
    bottom: 20px;
    left: 20px;
    background: rgba(239, 68, 68, 0.95);
    color: #f9fafb;
    padding: 0.75rem 1.25rem;
    border-radius: var(--border-radius-md);
    box-shadow: 0 12px 30px rgba(239, 68, 68, 0.35);
    font-weight: 600;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-1px);
  }

  .control-btn.disabled {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.5);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .control-btn.disabled:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    transform: none;
  }
  
  /* Plan Approval Modal Styles */
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
  
  .plan-list-modal {
    background: var(--card-bg);
    border-radius: var(--border-radius-lg);
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--border-color);
  }
  
  .plan-list-modal .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
  }
  
  .plan-list-modal .modal-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-weight: 600;
  }
  
  .plan-list-modal .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    transition: var(--transition);
  }
  
  .plan-list-modal .close-btn:hover {
    color: var(--text-primary);
  }
  
  .plan-list-modal .modal-body {
    padding: var(--spacing-lg);
    overflow-y: auto;
    flex: 1;
  }
  
  .plan-list-modal .modal-footer {
    padding: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
  }
  
  .plan-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .plan-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .plan-item:hover {
    background: var(--bg-hover);
    border-color: var(--brand-primary);
    transform: translateY(-1px);
  }
  
  .plan-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .plan-header h3 {
    margin: 0;
    color: var(--text-primary);
    font-weight: 600;
  }
  
  .plan-description {
    margin: 0.5rem 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .plan-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }
  
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .status-badge.ready {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }
  
  .status-badge.approved {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
  }
  
  .loading,
  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }
</style>