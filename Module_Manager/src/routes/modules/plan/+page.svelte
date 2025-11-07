<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { planService, type PlanProject } from '$lib/services/planService';
  import SettingsButton from '$lib/components/SettingsButton.svelte';
  import { mapLayerManager, type MapLayerManagerState } from '$lib/map/MapLayerManager';
  import { mapContext } from '$lib/map/mapContext';
  import SharedMap from '$lib/map/SharedMap.svelte';
  import type { MapModuleMode } from '$lib/map/MapCapabilities';

  let currentUser: any = null;
  let mapContainer: HTMLDivElement;
  let showReportModal = false;
  let showHardwareModal = false;
  let showProjectModal = false;
  let showCreateProjectModal = false;
  let showMissingHardwareModal = false;
  let showAddRequirementModal = false;
  
  // Data
  let projects: PlanProject[] = [];
  let selectedProject: PlanProject | null = null;
  let isLoading = false;
  let error: string = '';
  let successMessage: string = '';
  let loadedTenantId: string | null = null; // Track which tenant's data is loaded
  let mapState: MapLayerManagerState | undefined;
  let mapMode: MapModuleMode = 'plan';

  $: mapState = $mapContext as MapLayerManagerState;
  $: mapMode = (mapState?.mode ?? 'plan');
  
  // New project form
  let newProject = {
    name: '',
    description: ''
  };
  
  // New hardware requirement form
  let newRequirement = {
    category: 'Radio Equipment',
    equipmentType: '',
    manufacturer: '',
    model: '',
    quantity: 1,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    specifications: {}
  };

  // Project workflow states
  let activeProject: PlanProject | null = null;
  let showProjectActions = false;
  
  // Plan visibility toggle
  let visiblePlans: Set<string> = new Set(); // Plans currently visible on map

  // Module context for object state management
  let moduleContext: ModuleContext = {
    module: 'plan',
    userRole: 'admin',
    projectId: undefined
  };

  $: {
    const tenantRole = $currentTenant?.userRole;
    const normalizedRole: 'admin' | 'operator' | 'viewer' = tenantRole === 'viewer'
      ? 'viewer'
      : tenantRole === 'operator'
        ? 'operator'
        : 'admin';

    moduleContext = {
      module: 'plan',
      userRole: normalizedRole,
      projectId: activeProject?.id
    };
  }

  $: if (iframeReady) {
    iframeCommunicationService.updateContext(moduleContext);
  }

  // Equipment categories (matching inventory module)
  const equipmentCategories = {
    'Radio Equipment': [
      'Base Station (eNodeB/gNodeB)',
      'Remote Radio Head (RRH)',
      'Radio Unit (RU)',
      'Baseband Unit (BBU)',
      'Distributed Unit (DU)',
      'Centralized Unit (CU)',
      'Small Cell',
      'Repeater',
      'Microwave Radio',
      'Point-to-Point Radio'
    ],
    'Antennas': [
      'Sector Antenna',
      'Panel Antenna',
      'Omni Antenna',
      'Parabolic Dish',
      'MIMO Antenna',
      'Massive MIMO Array',
      'GPS Antenna',
      'Combiner'
    ],
    'Power Systems': [
      'Rectifier',
      'Battery Bank',
      'UPS',
      'Generator',
      'Solar Panel System',
      'Power Distribution Unit',
      'DC Power Plant',
      'Surge Protector'
    ],
    'Networking Equipment': [
      'Core Router',
      'Edge Router',
      'Layer 2/3 Switch',
      'Firewall',
      'Load Balancer',
      'Optical Network Terminal',
      'Media Converter',
      'Ethernet Switch'
    ],
    'Transmission Equipment': [
      'Fiber Optic Terminal',
      'Multiplexer (DWDM/CWDM)',
      'Fiber Distribution Panel',
      'Coaxial Cable',
      'Fiber Optic Cable',
      'Hybrid Cable',
      'RF Cables/Jumpers',
      'Waveguide'
    ],
    'Environmental Control': [
      'HVAC Unit',
      'Air Conditioner',
      'Heat Exchanger',
      'Ventilation Fan',
      'Temperature Sensor',
      'Humidity Sensor',
      'Fire Suppression System'
    ],
    'Monitoring & Control': [
      'Remote Monitoring Unit',
      'SNMP Agent',
      'GPS Clock/Timing Source',
      'Network Management System',
      'CCTV Camera',
      'Access Control System',
      'Alarm Panel'
    ],
    'Structural & Housing': [
      'Equipment Shelter',
      'Equipment Cabinet/Rack',
      'Weatherproof Enclosure',
      'Cable Tray',
      'Tower Lighting System',
      'Grounding System',
      'Lightning Arrestor',
      'Surge Arrestor'
    ],
    'Test Equipment': [
      'Spectrum Analyzer',
      'Cable Tester',
      'OTDR',
      'Power Meter',
      'Multimeter',
      'Signal Generator'
    ],
    'CPE Devices': [
      'LTE CPE',
      'CBRS CPE',
      'Fixed Wireless CPE',
      'Cable Modem',
      'ONT',
      'WiFi Router'
    ],
    'SIM Cards': [
      'SIM Card',
      'eSIM Profile'
    ],
    'Cables & Accessories': [
      'Ethernet Cable',
      'Fiber Patch Cable',
      'RF Jumper',
      'Connector',
      'Adapter'
    ],
    'Tools': [
      'Drill',
      'Crimper',
      'Cable Stripper',
      'Torque Wrench',
      'Ladder'
    ]
  };

  const categories = Object.keys(equipmentCategories);
  
  // Reactive variable for available equipment types based on selected category
  $: availableTypes = equipmentCategories[newRequirement.category as keyof typeof equipmentCategories] || [];

  // Watch for tenant changes and load data when tenant is available
  $: if ($currentTenant && $currentTenant.id && browser && !isLoading && currentUser && loadedTenantId !== $currentTenant.id) {
    loadData();
  }

  onMount(async () => {
    if (browser) {
      currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        goto('/login');
        return;
      }
      
      // Initialize iframe communication
      const iframe = mapContainer?.querySelector('iframe') as HTMLIFrameElement;
      if (iframe) {
        iframeCommunicationService.initialize(iframe, moduleContext);
        iframeReady = true;
        iframeCommunicationService.updateContext(moduleContext);
        
        // Listen for iframe object actions
        window.addEventListener('iframe-object-action', handleIframeObjectAction);
      }
      
      // Don't load data here - wait for tenant store to initialize via reactive statement
    }
    
    return () => {
      window.removeEventListener('iframe-object-action', handleIframeObjectAction);
      iframeCommunicationService.destroy();
    };
  });

  // Handle iframe object actions
  function handleIframeObjectAction(event: CustomEvent) {
    const { objectId, action, allowed, message, state } = event.detail;
    
    if (!allowed) {
      // Show user-friendly error message
      error = message || `Action '${action}' is not allowed for this object.`;
      setTimeout(() => error = '', 5000);
    } else {
      // Handle allowed actions
      console.log(`Action '${action}' allowed for object ${objectId}`);
      // Add specific handling for different actions here
    }
  }

  async function loadData() {
    if (!currentUser) return;

    if (!$currentTenant || !$currentTenant.id) {
      console.log('[Plan] Waiting for tenant to be available...');
      return;
    }

    if (isLoading || loadedTenantId === $currentTenant.id) {
      return;
    }

    isLoading = true;
    error = '';
    try {
      const tenantId = $currentTenant.id;

      const plans = await planService.getPlans(tenantId).catch(err => {
        console.error('Error loading projects:', err);
        error = `Failed to load projects: ${err.message}`;
        return [];
      });

      projects = plans;
      loadedTenantId = tenantId;
      visiblePlans = new Set(projects.filter(p => p.showOnMap).map(p => p.id));

      if (error) {
        setTimeout(() => error = '', 5000);
      }

      await mapLayerManager.loadProductionHardware(tenantId);
    } catch (err: any) {
      console.error('Error loading plan data:', err);
      error = err.message || 'Failed to load plan data. Please try again.';
      setTimeout(() => error = '', 8000);
      loadedTenantId = null;
    } finally {
      isLoading = false;
    }
  }

  function goBack() {
    goto('/dashboard');
  }

  function openPlanningReport() {
    showReportModal = true;
  }

  function closeReportModal() {
    showReportModal = false;
  }

  function openHardwareView() {
    showHardwareModal = true;
  }

  function closeHardwareModal() {
    showHardwareModal = false;
  }

  function openProjectList() {
    showProjectModal = true;
  }

  function closeProjectModal() {
    showProjectModal = false;
  }

  function openCreateProject() {
    showCreateProjectModal = true;
    newProject = { name: '', description: '' };
  }

  function closeCreateProjectModal() {
    showCreateProjectModal = false;
  }

  async function createProject() {
    if (!newProject.name.trim()) {
      error = 'Project name is required';
      setTimeout(() => error = '', 5000);
      return;
    }
    
    isLoading = true;
    error = '';
    successMessage = '';
    
    try {
      const tenantId = localStorage.getItem('selectedTenantId');
      if (!tenantId) {
        throw new Error('No tenant selected');
      }
      
      const project = await planService.createPlan(tenantId, {
        name: newProject.name,
        description: newProject.description,
        createdBy: currentUser.email
      });
      
      // Reload projects list
      await loadData();
      
      successMessage = `Project "${project.name}" created successfully`;
      closeCreateProjectModal();
      
      // Show success message briefly
      setTimeout(() => successMessage = '', 3000);
    } catch (err: any) {
      console.error('Error creating project:', err);
      error = err.message || 'Failed to create project. Please check the console for details.';
      setTimeout(() => error = '', 8000);
    } finally {
      isLoading = false;
    }
  }

  async function selectProject(project: PlanProject) {
    selectedProject = project;
    closeProjectModal();
    if ($currentTenant?.id) {
      await mapLayerManager.loadPlan($currentTenant.id, project);
    }
  }

  function getHardwareByModule(module: string) {
    return mapState?.productionHardware?.filter(h => h.module === module) || [];
  }

  function getHardwareByType(type: string) {
    return mapState?.productionHardware?.filter(h => h.type === type) || [];
  }

  function openMissingHardwareModal() {
    if (!selectedProject) return;
    showMissingHardwareModal = true;
  }

  function closeMissingHardwareModal() {
    showMissingHardwareModal = false;
  }

  function openAddRequirementModal() {
    if (!selectedProject) return;
    showAddRequirementModal = true;
    newRequirement = {
      category: 'equipment',
      equipmentType: '',
      manufacturer: '',
      model: '',
      quantity: 1,
      priority: 'medium',
      specifications: {}
    };
  }

  function closeAddRequirementModal() {
    showAddRequirementModal = false;
  }


  async function addHardwareRequirement() {
    if (!selectedProject || !newRequirement.equipmentType.trim()) return;
    
    try {
      await planService.addHardwareRequirement(selectedProject.id, newRequirement);
      await loadData(); // Reload to get updated project
      closeAddRequirementModal();
    } catch (error) {
      console.error('Error adding hardware requirement:', error);
    }
  }

  async function analyzeMissingHardware() {
    if (!selectedProject) return;
    
    try {
      const updatedProject = await planService.analyzeMissingHardware(selectedProject.id);
      if (updatedProject) {
        selectedProject = updatedProject;
        // Update projects array
        const index = projects.findIndex(p => p.id === selectedProject?.id);
        if (index !== -1) {
          projects[index] = updatedProject;
        }
      }
    } catch (error) {
      console.error('Error analyzing missing hardware:', error);
    }
  }

  async function generatePurchaseOrder() {
    if (!selectedProject) return;
    
    try {
      const purchaseOrder = await planService.generatePurchaseOrder(selectedProject.id);
      if (purchaseOrder) {
        // Create a downloadable purchase order
        const content = `
PURCHASE ORDER
Order ID: ${purchaseOrder.purchaseOrderId}
Project: ${selectedProject.name}
Generated: ${purchaseOrder.generatedAt.toLocaleDateString()}

ITEMS:
${purchaseOrder.items.map(item => 
  `- ${item.equipmentType}: ${item.quantity} units @ $${item.estimatedCost} (${item.priority} priority)`
).join('\n')}

TOTAL COST: $${purchaseOrder.totalCost.toLocaleString()}
        `;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PurchaseOrder_${purchaseOrder.purchaseOrderId}.txt`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error generating purchase order:', error);
    }
  }

  // Project workflow functions
  async function startProject(project: PlanProject) {
    try {
      activeProject = project;
      showProjectActions = true;
      await planService.updatePlan(project.id, { status: 'active' });
      await loadData();
      alert(`Project "${project.name}" is now active. All map changes will be saved to this project.`);

      if ($currentTenant?.id) {
        await mapLayerManager.loadPlan($currentTenant.id, project);
      }
    } catch (error) {
      console.error('Error starting project:', error);
      alert('Failed to start project');
    }
  }
  
  // Toggle plan visibility on map
  async function togglePlanVisibility(project: PlanProject) {
    try {
      if (project.status === 'authorized') {
        alert('Authorized projects are already part of the production network and cannot be toggled.');
        return;
      }
      const updatedPlan = await planService.togglePlanVisibility(project.id);
      // Update local state
      const index = projects.findIndex(p => p.id === project.id);
      if (index !== -1) {
        projects[index] = updatedPlan;
      }
      if (activeProject?.id === project.id) {
        activeProject = updatedPlan;
      }
      
      // Update visibility set
      if (updatedPlan.showOnMap) {
        visiblePlans.add(project.id);
      } else {
        visiblePlans.delete(project.id);
      }
      
      // Reload map to reflect visibility changes
      await loadData();
    } catch (error) {
      console.error('Error toggling plan visibility:', error);
      alert('Failed to toggle plan visibility');
    }
  }

  async function finishProject() {
    if (!activeProject) return;

    try {
      await planService.updatePlan(activeProject.id, { status: 'ready' });
      await loadData();
      alert(`Project "${activeProject.name}" has been marked as ready for deployment.`);
      activeProject = null;
      showProjectActions = false;
      mapLayerManager.setMode('plan');
    } catch (error) {
      console.error('Error finishing project:', error);
      alert('Failed to finish project');
    }
  }

  async function cancelProject() {
    if (!activeProject) return;
    
    try {
      await planService.updatePlan(activeProject.id, { status: 'cancelled' });
      await loadData();
      alert(`Project "${activeProject.name}" has been cancelled.`);
      activeProject = null;
      showProjectActions = false;
    } catch (error) {
      console.error('Error cancelling project:', error);
      alert('Failed to cancel project');
    }
  }

  async function approveProject(project: PlanProject) {
    try {
      await planService.updatePlan(project.id, { status: 'approved' });
      await loadData();
      alert(`Project "${project.name}" has been approved for deployment.`);
      if ($currentTenant?.id && activeProject?.id === project.id) {
        await mapLayerManager.refreshPlan(project.id);
      }
    } catch (error) {
      console.error('Error approving project:', error);
      alert('Failed to approve project');
    }
  }

  async function rejectProject(project: PlanProject) {
    try {
      await planService.updatePlan(project.id, { status: 'rejected' });
      await loadData();
      alert(`Project "${project.name}" has been rejected.`);
    } catch (error) {
      console.error('Error rejecting project:', error);
      alert('Failed to reject project');
    }
  }

  async function authorizeProject(project: PlanProject) {
    try {
      await planService.authorizePlan(project.id);
      await loadData();
      alert(`Project "${project.name}" has been authorized and promoted to production.`);
      if ($currentTenant?.id) {
        await mapLayerManager.loadProductionHardware($currentTenant.id);
      }
    } catch (error) {
      console.error('Error authorizing project:', error);
      alert('Failed to authorize project');
    }
  }
</script>

<TenantGuard>
  <div class="app">
    <!-- Full Screen Map -->
    <div class="map-fullscreen" bind:this={mapContainer}>
      <SharedMap mode={mapMode} />
    </div>

    <!-- Enhanced Header Overlay -->
    <div class="header-overlay">
      <div class="header-left">
        <button class="back-btn" on:click={() => goto('/dashboard')} title="Back to Dashboard">
          ←
        </button>
        <h1>📋 Plan</h1>
      </div>
      <div class="header-controls">
        <button class="control-btn" on:click={openHardwareView} title="View All Hardware">
          🔧
        </button>
        <button class="control-btn" on:click={openProjectList} title="Project List">
          📁
        </button>
        <button class="control-btn" on:click={openCreateProject} title="Create New Project">
          ➕
        </button>
        {#if selectedProject}
          <button class="control-btn" on:click={openMissingHardwareModal} title="Missing Hardware Analysis">
            🛒
          </button>
          <button class="control-btn" on:click={openAddRequirementModal} title="Add Hardware Requirement">
            📋
          </button>
          <button 
            class="control-btn {selectedProject.showOnMap ? 'active' : ''}" 
            on:click={() => togglePlanVisibility(selectedProject)} 
            title={selectedProject.showOnMap ? "Hide plan on map" : "Show plan on map"}
          >
            {selectedProject.showOnMap ? "👁️" : "👁️‍🗨️"}
          </button>
        {/if}
        
        <!-- Project Workflow Actions -->
        {#if activeProject}
          <button class="control-btn finish-btn" on:click={finishProject} title="Finish Project">
            ✅
          </button>
          <button class="control-btn cancel-btn" on:click={cancelProject} title="Cancel Project">
            ❌
          </button>
          <button 
            class="control-btn {activeProject.showOnMap ? 'active' : ''}" 
            on:click={() => togglePlanVisibility(activeProject)} 
            title={activeProject.showOnMap ? "Hide plan on map" : "Show plan on map"}
          >
            {activeProject.showOnMap ? "👁️ Visible" : "👁️‍🗨️ Hidden"}
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Hardware View Modal -->
  {#if showHardwareModal}
    <div class="modal-overlay" on:click={closeHardwareModal}>
      <div class="modal-content hardware-modal" on:click|stopPropagation>
        <div class="modal-header">
          <h2>🔧 All Existing Hardware</h2>
          <button class="close-btn" on:click={closeHardwareModal}>✕</button>
        </div>
        
        <div class="modal-body">
          {#if isLoading}
            <div class="loading-state">
              <div class="spinner"></div>
              <p>Loading hardware data...</p>
            </div>
          {:else}
            <div class="hardware-summary">
              <div class="summary-cards">
                <div class="summary-card">
                  <div class="card-icon">📡</div>
                  <div class="card-content">
                    <div class="card-value">{getHardwareByType('tower').length}</div>
                    <div class="card-label">Tower Sites</div>
                  </div>
                </div>
                <div class="summary-card">
                  <div class="card-icon">📶</div>
                  <div class="card-content">
                    <div class="card-value">{getHardwareByType('sector').length}</div>
                    <div class="card-label">Sectors</div>
                  </div>
                </div>
                <div class="summary-card">
                  <div class="card-icon">📱</div>
                  <div class="card-content">
                    <div class="card-value">{getHardwareByType('cpe').length}</div>
                    <div class="card-label">CPE Devices</div>
                  </div>
                </div>
                <div class="summary-card">
                  <div class="card-icon">🔧</div>
                  <div class="card-content">
                    <div class="card-value">{getHardwareByType('equipment').length}</div>
                    <div class="card-label">Equipment</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="hardware-tabs">
              <div class="tab-buttons">
                <button class="tab-btn active">By Module</button>
                <button class="tab-btn">By Type</button>
              </div>
              
              <div class="tab-content">
                <div class="module-breakdown">
                  <h4>📱 ACS Managed ({getHardwareByModule('acs').length})</h4>
                  <div class="hardware-list">
                    {#each getHardwareByModule('acs') as hardware}
                      <div class="hardware-item readonly">
                        <div class="item-icon">📱</div>
                        <div class="item-info">
                          <div class="item-name">{hardware.name}</div>
                          <div class="item-details">{hardware.status} • {hardware.type}</div>
                        </div>
                        <div class="item-badge readonly">Read Only</div>
                      </div>
                    {/each}
                  </div>
                  
                  <h4>🏢 HSS Managed ({getHardwareByModule('hss').length})</h4>
                  <div class="hardware-list">
                    {#each getHardwareByModule('hss') as hardware}
                      <div class="hardware-item readonly">
                        <div class="item-icon">🏢</div>
                        <div class="item-info">
                          <div class="item-name">{hardware.name}</div>
                          <div class="item-details">{hardware.status} • {hardware.type}</div>
                        </div>
                        <div class="item-badge readonly">Read Only</div>
                      </div>
                    {/each}
                  </div>
                  
                  <h4>📦 Inventory ({getHardwareByModule('inventory').length})</h4>
                  <div class="hardware-list">
                    {#each getHardwareByModule('inventory') as hardware}
                      <div class="hardware-item readonly">
                        <div class="item-icon">📦</div>
                        <div class="item-info">
                          <div class="item-name">{hardware.name}</div>
                          <div class="item-details">{hardware.status} • {hardware.type}</div>
                        </div>
                        <div class="item-badge readonly">Read Only</div>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closeHardwareModal}>Close</button>
          <button class="btn-primary" on:click={() => { goto('/modules/inventory'); closeHardwareModal(); }}>
            View Full Inventory
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Project List Modal -->
  {#if showProjectModal}
    <div class="modal-overlay" on:click={closeProjectModal}>
      <div class="modal-content project-modal" on:click|stopPropagation>
        <div class="modal-header">
          <h2>📁 Deployment Projects</h2>
          <button class="close-btn" on:click={closeProjectModal}>✕</button>
        </div>
        
        <div class="modal-body">
          <div class="project-list">
            {#each projects as project}
              <div class="project-item">
                <div class="project-content" on:click={() => selectProject(project)}>
                  <div class="project-header">
                    <h3>{project.name}</h3>
                    <span class="status-badge {project.status}">{project.status}</span>
                  </div>
                  <p class="project-description">{project.description}</p>
                  <div class="project-meta">
                    <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
                    <span>Hardware: {project.scope.towers.length + project.scope.sectors.length + project.scope.cpeDevices.length + project.scope.equipment.length} items</span>
                  </div>
                </div>
                
                <div class="project-actions" on:click|stopPropagation>
                  {#if project.status === 'draft'}
                    <button class="action-btn start-btn" on:click={() => startProject(project)} title="Start Project - Begin working on this project">
                      ▶️ Start
                    </button>
                  {/if}
                  
                  {#if project.status === 'ready'}
                    <button class="action-btn approve-btn" on:click={() => approveProject(project)} title="Approve Project - Mark as ready for deployment">
                      ✅ Approve
                    </button>
                    <button class="action-btn reject-btn" on:click={() => rejectProject(project)} title="Reject Project - Send back for revision">
                      ❌ Reject
                    </button>
                  {/if}
                  
                  {#if project.status === 'active'}
                    <span class="active-indicator" title="This project is currently active - all map changes will be saved to this project">🔄 Active</span>
                  {/if}
                  
                  <button 
                    class="action-btn {project.showOnMap ? 'visibility-active' : 'visibility-inactive'} {project.status === 'authorized' ? 'disabled' : ''}" 
                    on:click={() => togglePlanVisibility(project)} 
                    title={project.status === 'authorized' ? "Authorized projects are always visible in production" : project.showOnMap ? "Hide on map" : "Show on map"}
                    disabled={project.status === 'authorized'}
                  >
                    {project.showOnMap ? "👁️ Visible" : "👁️‍🗨️ Hidden"}
                  </button>
                  
                  {#if project.status === 'approved'}
                    <button 
                      class="action-btn authorize-btn" 
                      on:click={() => authorizeProject(project)} 
                      title="Authorize Project - Promote this plan to production"
                    >
                      🚀 Authorize
                    </button>
                    <span class="approved-indicator" title="This project has been approved and is ready for deployment">✅ Approved</span>
                  {/if}

                  {#if project.status === 'authorized'}
                    <span class="authorized-indicator" title="This project has been authorized and merged into production">🚀 Authorized</span>
                  {/if}
                  
                  {#if project.status === 'rejected'}
                    <span class="rejected-indicator" title="This project was rejected and needs revision">❌ Rejected</span>
                  {/if}
                  
                  {#if project.status === 'cancelled'}
                    <span class="cancelled-indicator" title="This project was cancelled">🚫 Cancelled</span>
                  {/if}
                </div>
              </div>
            {/each}
            
            {#if projects.length === 0}
              <div class="empty-state">
                <div class="empty-icon">📁</div>
                <h3>No Projects Yet</h3>
                <p>Create your first deployment project to get started.</p>
                <button class="btn-primary" on:click={openCreateProject}>Create Project</button>
              </div>
            {/if}
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closeProjectModal}>Close</button>
          <button class="btn-primary" on:click={openCreateProject}>Create New Project</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Create Project Modal -->
  {#if showCreateProjectModal}
    <div class="modal-overlay" on:click={closeCreateProjectModal}>
      <div class="modal-content create-modal" on:click|stopPropagation>
        <div class="modal-header">
          <h2>➕ Create New Project</h2>
          <button class="close-btn" on:click={closeCreateProjectModal}>✕</button>
        </div>
        
        <div class="modal-body">
          {#if error}
            <div class="alert alert-error">
              <strong>Error:</strong> {error}
            </div>
          {/if}
          {#if successMessage}
            <div class="alert alert-success">
              <strong>Success:</strong> {successMessage}
            </div>
          {/if}
          <form on:submit|preventDefault={createProject}>
            <div class="form-group">
              <label for="projectName">Project Name *</label>
              <input
                id="projectName"
                type="text"
                bind:value={newProject.name}
                placeholder="Enter project name"
                required
                disabled={isLoading}
              />
            </div>
            
            <div class="form-group">
              <label for="projectDescription">Description</label>
              <textarea
                id="projectDescription"
                bind:value={newProject.description}
                placeholder="Describe the project scope and objectives"
                rows="3"
                disabled={isLoading}
              ></textarea>
            </div>
          </form>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closeCreateProjectModal} disabled={isLoading}>Cancel</button>
          <button class="btn-primary" on:click={createProject} disabled={!newProject.name.trim() || isLoading}>
            {isLoading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Missing Hardware Modal -->
  {#if showMissingHardwareModal && selectedProject}
    <div class="modal-overlay" on:click={closeMissingHardwareModal}>
      <div class="modal-content missing-hardware-modal" on:click|stopPropagation>
        <div class="modal-header">
          <h2>🛒 Missing Hardware Analysis - {selectedProject.name}</h2>
          <button class="close-btn" on:click={closeMissingHardwareModal}>✕</button>
        </div>
        
        <div class="modal-body">
          <div class="analysis-summary">
            <div class="summary-card">
              <div class="card-icon">💰</div>
              <div class="card-content">
                <div class="card-value">${selectedProject.purchasePlan.totalEstimatedCost.toLocaleString()}</div>
                <div class="card-label">Total Estimated Cost</div>
              </div>
            </div>
            <div class="summary-card">
              <div class="card-icon">📦</div>
              <div class="card-content">
                <div class="card-value">{selectedProject.purchasePlan.missingHardware.length}</div>
                <div class="card-label">Missing Items</div>
              </div>
            </div>
            <div class="summary-card">
              <div class="card-icon">⚠️</div>
              <div class="card-content">
                <div class="card-value">{selectedProject.purchasePlan.missingHardware.filter(item => item.priority === 'critical').length}</div>
                <div class="card-label">Critical Items</div>
              </div>
            </div>
          </div>
          
          <div class="missing-hardware-list">
            {#if selectedProject.purchasePlan.missingHardware.length === 0}
              <div class="empty-state">
                <div class="empty-icon">✅</div>
                <h3>No Missing Hardware</h3>
                <p>All required hardware is available in inventory.</p>
                <button class="btn-primary" on:click={analyzeMissingHardware}>Re-analyze</button>
              </div>
            {:else}
              <div class="hardware-requirements">
                <h4>Hardware Requirements</h4>
                <div class="requirements-list">
                  {#each selectedProject.hardwareRequirements.needed as requirement, index}
                    <div class="requirement-item">
                      <div class="requirement-info">
                        <div class="requirement-name">{requirement.equipmentType}</div>
                        <div class="requirement-details">
                          {requirement.manufacturer} {requirement.model} • Qty: {requirement.quantity} • {requirement.priority} priority
                        </div>
                      </div>
                      <div class="requirement-cost">${requirement.estimatedCost?.toLocaleString() || 'TBD'}</div>
                    </div>
                  {/each}
                </div>
              </div>
              
              <div class="missing-items">
                <h4>Missing Hardware</h4>
                <div class="missing-list">
                  {#each selectedProject.purchasePlan.missingHardware as item}
                    <div class="missing-item">
                      <div class="item-header">
                        <div class="item-info">
                          <div class="item-name">{item.manufacturer} {item.model || item.equipmentType}</div>
                          <div class="item-details">Qty: {item.quantity} • ${item.estimatedCost.toLocaleString()} • {item.priority} priority</div>
                        </div>
                        <div class="priority-badge {item.priority}">{item.priority}</div>
                      </div>
                      <div class="item-reason">{item.reason}</div>
                      {#if item.alternatives && item.alternatives.length > 0}
                        <div class="alternatives">
                          <h5>Alternatives:</h5>
                          <div class="alternatives-list">
                            {#each item.alternatives as alt}
                              <div class="alternative-item">
                                <span class="alt-name">{alt.manufacturer} {alt.model}</span>
                                <span class="alt-cost">${alt.estimatedCost}</span>
                                <span class="alt-availability {alt.availability}">{alt.availability}</span>
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closeMissingHardwareModal}>Close</button>
          <button class="btn-secondary" on:click={analyzeMissingHardware}>Re-analyze</button>
          <button class="btn-primary" on:click={generatePurchaseOrder} disabled={selectedProject.purchasePlan.missingHardware.length === 0}>
            Generate Purchase Order
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Add Hardware Requirement Modal -->
  {#if showAddRequirementModal && selectedProject}
    <div class="modal-overlay" on:click={closeAddRequirementModal}>
      <div class="modal-content add-requirement-modal" on:click|stopPropagation>
        <div class="modal-header">
          <h2>📋 Add Hardware Requirement - {selectedProject.name}</h2>
          <button class="close-btn" on:click={closeAddRequirementModal}>✕</button>
        </div>
        
        <div class="modal-body">
          <form on:submit|preventDefault={addHardwareRequirement}>
            <div class="form-group">
              <label for="category">Category *</label>
              <select id="category" bind:value={newRequirement.category} required>
                <option value="">Select category...</option>
                {#each categories as category}
                  <option value={category}>{category}</option>
                {/each}
              </select>
            </div>
            
            <div class="form-group">
              <label for="equipmentType">Equipment Type *</label>
              <select id="equipmentType" bind:value={newRequirement.equipmentType} required>
                <option value="">Select equipment type...</option>
                {#each availableTypes as type}
                  <option value={type}>{type}</option>
                {/each}
              </select>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="manufacturer">Manufacturer</label>
                <input
                  id="manufacturer"
                  type="text"
                  bind:value={newRequirement.manufacturer}
                  placeholder="e.g., Ubiquiti, Cisco"
                />
              </div>
              
              <div class="form-group">
                <label for="model">Model</label>
                <input
                  id="model"
                  type="text"
                  bind:value={newRequirement.model}
                  placeholder="e.g., NanoStation M5"
                />
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="quantity">Quantity *</label>
                <input
                  id="quantity"
                  type="number"
                  bind:value={newRequirement.quantity}
                  min="1"
                  required
                />
              </div>
              
              <div class="form-group">
                <label for="priority">Priority *</label>
                <select id="priority" bind:value={newRequirement.priority} required>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
          </form>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" on:click={closeAddRequirementModal}>Cancel</button>
          <button class="btn-primary" on:click={addHardwareRequirement} disabled={!newRequirement.equipmentType.trim()}>
            Add Requirement
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Planning Report Modal -->
  {#if showReportModal}
    <div class="modal-overlay" on:click={closeReportModal}>
      <div class="modal-content" on:click|stopPropagation>
        <div class="modal-header">
          <h2>📊 Planning Reports</h2>
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
  
  <!-- Global Settings Button -->
  <SettingsButton />
</TenantGuard>

<!-- TODO: integrate MapLayerManager feature CRUD controls for staging (site/equipment) -->

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
    background: var(--gradient-primary);
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

  .header-controls {
    display: flex;
    gap: 0.5rem;
  }

  .control-btn {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
    cursor: pointer;
    color: white;
    transition: all 0.2s;
    backdrop-filter: blur(10px);
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-1px);
  }

  /* Enhanced Tooltips */
  .control-btn {
    position: relative;
  }

  .control-btn::after {
    content: attr(title);
    position: absolute;
    bottom: -35px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-size: 0.875rem;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    z-index: 1000;
  }

  .control-btn:hover::after {
    opacity: 1;
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

  /* Hardware Modal Styles */
  .hardware-modal {
    max-width: 1000px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(59, 130, 246, 0.1);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .hardware-summary {
    margin-bottom: 2rem;
  }

  .summary-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .summary-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .card-icon {
    font-size: 2rem;
  }

  .card-content {
    flex: 1;
  }

  .card-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--brand-primary);
  }

  .card-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .hardware-tabs {
    margin-top: 1rem;
  }

  .tab-buttons {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tab-btn {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn.active {
    background: var(--brand-primary);
    color: white;
    border-color: var(--brand-primary);
  }

  .module-breakdown h4 {
    margin: 1.5rem 0 0.75rem 0;
    color: var(--text-primary);
    font-weight: 600;
  }

  .hardware-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .hardware-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    transition: all 0.2s;
  }

  .hardware-item.readonly {
    opacity: 0.7;
    background: var(--bg-tertiary);
  }

  .item-icon {
    font-size: 1.25rem;
  }

  .item-info {
    flex: 1;
  }

  .item-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .item-details {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .item-badge {
    padding: 0.25rem 0.5rem;
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .item-badge.readonly {
    background: rgba(156, 163, 175, 0.1);
    color: #6b7280;
  }

  /* Project Modal Styles */
  .project-modal {
    max-width: 800px;
  }

  .project-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .project-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    padding: 1.5rem;
    transition: all 0.2s;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .project-content {
    flex: 1;
    cursor: pointer;
  }

  .project-content:hover {
    border-color: var(--brand-primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .project-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .action-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--border-radius-sm);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .action-btn.disabled,
  .action-btn:disabled {
    background: rgba(156, 163, 175, 0.2);
    color: var(--text-secondary);
    cursor: not-allowed;
    opacity: 0.7;
  }

  .action-btn::after {
    content: attr(title);
    position: absolute;
    bottom: -35px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-size: 0.875rem;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    z-index: 1000;
  }

  .action-btn:hover::after {
    opacity: 1;
  }

  .start-btn {
    background: #10b981;
    color: white;
  }

  .start-btn:hover {
    background: #059669;
  }

  .approve-btn {
    background: #10b981;
    color: white;
  }

  .approve-btn:hover {
    background: #059669;
  }

  .authorize-btn {
    background: #0ea5e9;
    color: white;
  }

  .authorize-btn:hover {
    background: #0284c7;
  }

  .reject-btn {
    background: #ef4444;
    color: white;
  }

  .reject-btn:hover {
    background: #dc2626;
  }

  .finish-btn {
    background: #3b82f6;
    color: white;
  }

  .finish-btn:hover {
    background: #2563eb;
  }

  .cancel-btn {
    background: #ef4444;
    color: white;
  }

  .cancel-btn:hover {
    background: #dc2626;
  }

  .active-indicator,
  .approved-indicator,
  .authorized-indicator,
  .rejected-indicator,
  .cancelled-indicator {
    padding: 0.5rem 1rem;
    border-radius: var(--border-radius-sm);
    font-size: 0.875rem;
    font-weight: 500;
    position: relative;
    cursor: help;
  }

  .active-indicator::after,
  .approved-indicator::after,
  .authorized-indicator::after,
  .rejected-indicator::after,
  .cancelled-indicator::after {
    content: attr(title);
    position: absolute;
    bottom: -35px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-size: 0.875rem;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    z-index: 1000;
  }

  .active-indicator:hover::after,
  .approved-indicator:hover::after,
  .authorized-indicator:hover::after,
  .rejected-indicator:hover::after,
  .cancelled-indicator:hover::after {
    opacity: 1;
  }

  .active-indicator {
    background: #fef3c7;
    color: #92400e;
  }

  .approved-indicator {
    background: #d1fae5;
    color: #065f46;
  }

  .authorized-indicator {
    background: #dbeafe;
    color: #1d4ed8;
  }

  .rejected-indicator {
    background: #fee2e2;
    color: #991b1b;
  }

  .cancelled-indicator {
    background: #f3f4f6;
    color: #374151;
  }

  .project-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .project-header h3 {
    margin: 0;
    color: var(--text-primary);
    font-weight: 600;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-badge.draft {
    background: rgba(156, 163, 175, 0.1);
    color: #6b7280;
  }

  .status-badge.ready {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }

  .status-badge.authorized {
    background: rgba(59, 130, 246, 0.1);
    color: #1d4ed8;
  }

  .status-badge.deployed {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
  }

  .status-badge.cancelled {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }

  .project-description {
    margin: 0 0 1rem 0;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .project-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-state h3 {
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }

  .empty-state p {
    margin: 0 0 1.5rem 0;
    color: var(--text-secondary);
  }

  /* Create Project Modal Styles */
  .create-modal {
    max-width: 500px;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--brand-primary);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 80px;
  }

  /* Missing Hardware Modal Styles */
  .missing-hardware-modal {
    max-width: 1200px;
  }

  .analysis-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .hardware-requirements {
    margin-bottom: 2rem;
  }

  .hardware-requirements h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-weight: 600;
  }

  .requirements-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .requirement-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
  }

  .requirement-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .requirement-details {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .requirement-cost {
    font-weight: 600;
    color: var(--brand-primary);
  }

  .missing-items h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-weight: 600;
  }

  .missing-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .missing-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-md);
    padding: 1.5rem;
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .item-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .item-details {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .priority-badge {
    padding: 0.25rem 0.75rem;
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .priority-badge.critical {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }

  .priority-badge.high {
    background: rgba(245, 158, 11, 0.1);
    color: #d97706;
  }

  .priority-badge.medium {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
  }

  .priority-badge.low {
    background: rgba(156, 163, 175, 0.1);
    color: #6b7280;
  }

  .item-reason {
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: rgba(239, 68, 68, 0.05);
    border-left: 3px solid #ef4444;
    border-radius: var(--border-radius-sm);
    color: var(--text-secondary);
    font-style: italic;
  }

  .alternatives {
    margin-top: 1rem;
  }

  .alternatives h5 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    color: var(--text-primary);
    font-weight: 600;
  }

  .alternatives-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .alternative-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--bg-tertiary);
    border-radius: var(--border-radius-sm);
    font-size: 0.875rem;
  }

  .alt-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .alt-cost {
    font-weight: 600;
    color: var(--brand-primary);
  }

  .alt-availability {
    padding: 0.125rem 0.5rem;
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .alt-availability.in-stock {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }

  .alt-availability.backorder {
    background: rgba(245, 158, 11, 0.1);
    color: #d97706;
  }

  .alt-availability.discontinued {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }

  /* Add Requirement Modal Styles */
  .add-requirement-modal {
    max-width: 600px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .form-group select:focus {
    outline: none;
    border-color: var(--brand-primary);
  }

  /* Alert Styles */
  .alert {
    padding: 0.75rem 1rem;
    border-radius: var(--border-radius-sm);
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    color: #dc2626;
  }

  .alert-success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid #22c55e;
    color: #16a34a;
  }

  .alert strong {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 600;
  }
</style>