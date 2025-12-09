<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import { authService } from '$lib/services/authService';
  import { planService, type PlanProject } from '$lib/services/planService';
  // SettingsButton removed - now only on dashboard
  import PCIPlannerModal from './components/PCIPlannerModal.svelte';
  import FrequencyPlannerModal from './components/FrequencyPlannerModal.svelte';
  import PlanApprovalModal from './components/PlanApprovalModal.svelte';
import DeployedHardwareModal from './components/DeployedHardwareModal.svelte';
import SiteDetailsModal from './components/SiteDetailsModal.svelte';
import SiteEquipmentModal from './components/SiteEquipmentModal.svelte';
import SiteEditModal from '../coverage-map/components/SiteEditModal.svelte';
import ProjectFilterPanel from './components/ProjectFilterPanel.svelte';
  import SharedMap from '$lib/map/SharedMap.svelte';
  import { mapLayerManager } from '$lib/map/MapLayerManager';
  import { mapContext, setMapData, type MapLayerState } from '$lib/map/mapContext';
import type { MapModuleMode } from '$lib/map/MapCapabilities';
import type { ModuleContext } from '$lib/services/objectStateManager';
import { iframeCommunicationService } from '$lib/services/iframeCommunicationService';
import { isPlatformAdmin } from '$lib/services/adminService';
import '$lib/styles/moduleHeaderMenu.css';
import EPCDeploymentModal from './components/EPCDeploymentModal.svelte';

  let currentUser: any = null;
  let showEPCDeploymentModal = false;
  let showAddHardwareMenu = false;
  let mapContainer: HTMLDivElement;
  let mapState: MapLayerState | undefined;
  let mapMode: MapModuleMode = 'deploy';
  let isAdmin = false;
  let buttonsDisabled = false;
  
  // Plan approval workflow
  let showPlanApprovalModal = false;
  let readyPlans: PlanProject[] = [];
  let draftPlans: PlanProject[] = [];
  let approvedPlans: PlanProject[] = [];
  let deployedPlans: PlanProject[] = [];
  let selectedPlan: PlanProject | null = null;
  let isLoadingPlans = false;
  let approvalMode: 'approve' | 'reject' | null = null;
  
  // Project filtering
  let showProjectFilters = false;
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
  
  // Site Details Modal
  let showSiteDetailsModal = false;
  let selectedSiteForDetails: any = null;
  
  // Site Edit Modal
  let showSiteEditModal = false;
  let selectedSiteForEdit: any = null;
  
  // Site Equipment Modal
  let showSiteEquipmentModal = false;
  let selectedSiteForEquipment: any = null;
  
  // Set up global handler IMMEDIATELY - don't wait for onMount
  // This function will be called directly from SharedMap when view-inventory action is received
  if (typeof window !== 'undefined') {
    (window as any).__deployHandleViewInventory = (tower: any) => {
      console.log('[Deploy] 🔥🔥🔥 GLOBAL HANDLER CALLED with tower:', tower);
      console.log('[Deploy] 🔥🔥🔥 Tower data:', JSON.stringify(tower, null, 2));
      if (tower) {
        // Set state directly - Svelte will handle reactivity
        selectedSiteForEquipment = { ...tower };
        showSiteEquipmentModal = true;
        console.log('[Deploy] 🔥🔥🔥 Modal state set:', {
          show: showSiteEquipmentModal,
          hasSite: !!selectedSiteForEquipment,
          siteName: selectedSiteForEquipment?.name,
          siteId: selectedSiteForEquipment?.id || selectedSiteForEquipment?._id
        });
        
        // Center map on location
        const siteLocation = tower.location;
        if (siteLocation?.latitude && siteLocation?.longitude) {
          setTimeout(() => {
            const iframe = document.querySelector('.map-fullscreen iframe') as HTMLIFrameElement | null;
            if (iframe?.contentWindow) {
              iframe.contentWindow.postMessage({
                source: 'shared-map',
                type: 'center-map-on-location',
                payload: {
                  lat: siteLocation.latitude,
                  lon: siteLocation.longitude,
                  zoom: 14
                }
              }, '*');
              console.log('[Deploy] ✅ Sent center-map message to iframe');
            }
          }, 100);
        }
      } else {
        console.warn('[Deploy] ❌ Global handler called with no tower data');
      }
    };
    console.log('[Deploy] ✅ GLOBAL HANDLER SET on window');
  }
  
  // Sector counts for planner buttons
  let lteSectorCount = 0; // For PCI Planner (LTE only)
  let frequencySectorCount = 0; // For Frequency Planner (LTE + FWA)


  // Map/Iframe coordination
  let moduleContext: ModuleContext = {
    module: 'deploy',
    userRole: 'admin',
    projectId: undefined
  };
  let iframeReady = false;
  let iframeListenerAttached = false;


  // Reactive tenant tracking
  $: console.log('[Deploy] Tenant state changed:', $currentTenant);
  $: isAdmin = isPlatformAdmin(currentUser?.email ?? null);
  $: buttonsDisabled = !isAdmin && !$currentTenant;

  $: mapState = $mapContext;
  $: mapMode = mapState?.mode ?? 'deploy';

  $: {
    const tenantRole = $currentTenant?.userRole;
    const normalizedRole: 'admin' | 'operator' | 'viewer' = tenantRole === 'viewer'
      ? 'viewer'
      : tenantRole === 'operator'
        ? 'operator'
        : 'admin';

    moduleContext = {
      module: 'deploy',
      userRole: normalizedRole,
      projectId: mapState?.activePlan?.id
    };
  }

  $: if (iframeReady) {
    iframeCommunicationService.updateContext(moduleContext);
  }

  onMount(() => {
    if (!browser) {
      return;
    }

    (async () => {
      currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        goto('/login');
        return;
      }

      // Wait a bit for iframe to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const iframe = mapContainer?.querySelector('iframe') as HTMLIFrameElement | null;
      if (iframe) {
        console.log('[Deploy] ✅ Found iframe, initializing iframeCommunicationService:', iframe.src);
        iframeCommunicationService.initialize(iframe, moduleContext);
        iframeReady = true;
        window.addEventListener('iframe-object-action', handleIframeObjectAction);
        iframeListenerAttached = true;
        console.log('[Deploy] ✅ Iframe communication initialized and event listener attached');
        
        // Also add a direct message listener as a fallback - MUST be on window, not iframe
        const directMessageHandler = (event: MessageEvent) => {
          // DEBUG: Log ALL messages to see structure
          if (event.data && typeof event.data === 'object') {
            const msgType = event.data.type;
            if (msgType === 'asset-click') {
              console.log('[Deploy] 🔵🔵🔵🔵🔵 ASSET-CLICK DETECTED! FORCE LOG');
              console.log('[Deploy] 🔵🔵🔵 Full event.data:', JSON.stringify(event.data, null, 2));
              console.log('[Deploy] 🔵🔵🔵 event.data.detail:', JSON.stringify(event.data.detail, null, 2));
              console.log('[Deploy] 🔵🔵🔵 event.data keys:', Object.keys(event.data));
            }
          }
          
          // Handle asset-click messages FIRST - CRITICAL: This must run
          if (event.data && typeof event.data === 'object' && event.data.type === 'asset-click') {
            
            // Process if source matches OR if no source check (be more lenient)
            if (event.data.source === 'coverage-map' || !event.data.source) {
              console.log('[Deploy] 🔵🔵🔵 Processing asset-click - source check passed');
              
              // The detail is in event.data.detail
              const detail = event.data.detail;
              
              if (!detail || typeof detail !== 'object') {
                console.error('[Deploy] ❌❌❌ Detail is missing or invalid:', { detail, type: typeof detail });
                return;
              }
              
              const { type, id, data, screenX, screenY, isRightClick } = detail;
              
              console.log('[Deploy] 🔵🔵🔵 Extracted values:', { type, id, isRightClick, screenX, screenY });
              
              if (!isRightClick) {
                console.log('[Deploy] Ignoring left-click on asset');
                return;
              }
              
              console.log('[Deploy] 🔵🔵🔵 Right-click detected on asset:', { type, id, isRightClick });
              
              // Handle sector right-click - send message to iframe to show menu
              if (type === 'sector' && id) {
                console.log('[Deploy] 🔵🔵🔵 Handling sector right-click:', { id, type, screenX, screenY });
                // Fetch sector data and send to iframe to show menu
                (async () => {
                  try {
                    const { coverageMapService } = await import('../coverage-map/lib/coverageMapService.mongodb');
                    const tenantId = $currentTenant?.id;
                    if (!tenantId) {
                      console.error('[Deploy] No tenant ID for sector lookup');
                      return;
                    }
                    
                    // Get all sectors and find the matching one
                    const allSectors = await coverageMapService.getSectors(tenantId);
                    let sector = allSectors.find((s: any) => s.id === id);
                    if (!sector) {
                      sector = allSectors.find((s: any) => s._id === id);
                    }
                    if (!sector) {
                      sector = allSectors.find((s: any) => String(s.id) === String(id));
                    }
                    if (!sector) {
                      sector = allSectors.find((s: any) => String(s._id) === String(id));
                    }
                    
                    if (sector) {
                      console.log('[Deploy] ✅✅✅ Found sector, sending to iframe:', { sectorId: sector.id, sectorName: sector.name });
                      // Send message to iframe to show the menu
                      const iframe = mapContainer?.querySelector('iframe') as HTMLIFrameElement | null;
                      if (iframe?.contentWindow) {
                        iframe.contentWindow.postMessage({
                          source: 'deploy-module',
                          type: 'show-sector-menu',
                          payload: {
                            sector: sector,
                            screenX: screenX || 0,
                            screenY: screenY || 0
                          }
                        }, '*');
                        console.log('[Deploy] ✅✅✅ Sent show-sector-menu message to iframe');
                      } else {
                        console.error('[Deploy] ❌ Iframe contentWindow not available');
                      }
                    } else {
                      console.error('[Deploy] ❌ Sector not found:', { 
                        id, 
                        idType: typeof id,
                        allSectorIds: allSectors.map((s: any) => ({ id: s.id, _id: s._id, name: s.name }))
                      });
                    }
                  } catch (err) {
                    console.error('[Deploy] Error handling sector right-click:', err);
                  }
                })();
              }
              return; // Don't process further
            } else {
              console.log('[Deploy] ⚠️ Asset-click from wrong source, ignoring:', event.data.source);
            }
          }
          
          // Log other messages (but not asset-click, view-extent, request-state to reduce noise)
          if (event.data && typeof event.data === 'object') {
            if (event.data.type !== 'asset-click' && event.data.type !== 'view-extent' && event.data.type !== 'request-state') {
              console.log('[Deploy] 📨 Direct message listener received ANY message:', {
                data: event.data,
                type: event.data?.type,
                source: event.data?.source,
                action: event.data?.action,
                origin: event.origin,
                hasSource: !!event.source
              });
            }
          }
          
          // If the iframeCommunicationService doesn't catch it, handle it directly
          if (event.data && 
              typeof event.data === 'object' &&
              event.data.type === 'object-action' && 
              event.data.action === 'view-inventory') {
            console.log('[Deploy] ✅✅✅ DIRECTLY HANDLING view-inventory message via fallback listener');
            // Call the handler directly with the correct format
            const fakeEvent = new CustomEvent('iframe-object-action', {
              detail: {
                objectId: event.data.objectId,
                action: event.data.action,
                data: event.data.data,
                allowed: true
              }
            });
            console.log('[Deploy] ✅✅✅ Dispatching fake event:', fakeEvent.detail);
            // Call handler directly - don't wait for event system
            handleIframeObjectAction(fakeEvent).catch(err => {
              console.error('[Deploy] Error in handleIframeObjectAction:', err);
            });
          }
        };
        
        // CRITICAL: Add listener to window, not iframe
        window.addEventListener('message', directMessageHandler, false);
        console.log('[Deploy] ✅ Direct message listener attached to WINDOW as fallback');
        
        // Update the global handler to ensure it uses the latest component state
        // The handler was already set at component load, but we update it here to ensure it has access to mapContainer
        (window as any).__deployHandleViewInventory = (tower: any) => {
          console.log('[Deploy] 🔥🔥🔥 GLOBAL HANDLER CALLED FROM ONMOUNT with tower:', tower);
          if (tower) {
            selectedSiteForEquipment = { ...tower };
            showSiteEquipmentModal = true;
            console.log('[Deploy] 🔥🔥🔥 Modal opened via onMount global handler');
            
            // Center map on location
            const siteLocation = tower.location;
            if (siteLocation?.latitude && siteLocation?.longitude) {
              const iframe = mapContainer?.querySelector('iframe') as HTMLIFrameElement | null;
              if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage({
                  source: 'shared-map',
                  type: 'center-map-on-location',
                  payload: {
                    lat: siteLocation.latitude,
                    lon: siteLocation.longitude,
                    zoom: 14
                  }
                }, '*');
              }
            }
          }
        };
        console.log('[Deploy] 🔥🔥🔥 Global handler updated in onMount:', typeof (window as any).__deployHandleViewInventory);
        
        // Store handler for cleanup
        (window as any).__deployDirectMessageHandler = directMessageHandler;
      } else {
        console.warn('[Deploy] ❌ Iframe not found in mapContainer');
      }

      mapLayerManager.setMode('deploy');
      await loadReadyPlans();
    })().catch((err) => {
      console.error('[Deploy] onMount initialization failed:', err);
    });

    return () => {
      if (iframeListenerAttached) {
        window.removeEventListener('iframe-object-action', handleIframeObjectAction);
        iframeListenerAttached = false;
      }
      if ((window as any).__deployDirectMessageHandler) {
        window.removeEventListener('message', (window as any).__deployDirectMessageHandler);
        delete (window as any).__deployDirectMessageHandler;
      }
      iframeCommunicationService.destroy();
      iframeReady = false;
    };
  });


  async function handleIframeObjectAction(event: Event) {
    console.log('[Deploy] 🔵 handleIframeObjectAction EVENT RECEIVED:', event);
    const detail = (event as CustomEvent).detail;
    console.log('[Deploy] 🔵 handleIframeObjectAction called with detail:', detail);
    if (!detail) {
      console.warn('[Deploy] handleIframeObjectAction called without detail');
      return;
    }

    const { objectId, action, allowed, message, data } = detail;
    if (!allowed) {
      error = message || `Action '${action}' is not allowed for this object.`;
      setTimeout(() => (error = ''), 5000);
    } else {
      console.log(`[Deploy] Action '${action}' allowed for object ${objectId}`, detail);
      
      // Handle view-details action - open site details modal
      if (action === 'view-details' && objectId) {
        console.log('[Deploy] Handling view-details action for object:', objectId, 'with data:', data);
        try {
          // Fetch the site data using the objectId
          const { coverageMapService } = await import('../coverage-map/lib/coverageMapService.mongodb');
          const tenantId = $currentTenant?.id;
          // First check if tower data is provided in the event (more reliable)
          if (data?.tower) {
            console.log('[Deploy] Using tower data from event:', data.tower);
            selectedSiteForDetails = data.tower;
            showSiteDetailsModal = true;
            console.log('[Deploy] SiteDetailsModal should now be visible:', showSiteDetailsModal);
          } else if (tenantId) {
            // Fall back to fetching from database
            const sites = await coverageMapService.getTowerSites(tenantId);
            const site = sites.find((s: any) => String(s.id || s._id) === String(objectId));
            if (site) {
              selectedSiteForDetails = site;
              showSiteDetailsModal = true;
            } else {
              error = 'Site not found';
              setTimeout(() => error = '', 5000);
            }
          }
        } catch (err) {
          console.error('Error loading site details:', err);
          error = 'Failed to load site details';
          setTimeout(() => (error = ''), 5000);
        }
      }
      
      // Handle view-inventory action - open site equipment modal
      if (action === 'view-inventory' && objectId) {
        console.log('[Deploy] ✅ Handling view-inventory action for object:', objectId, 'with data:', data);
        
        // Immediately prevent any default navigation
        event.preventDefault?.();
        event.stopPropagation?.();
        
        try {
          const { coverageMapService } = await import('../coverage-map/lib/coverageMapService.mongodb');
          const tenantId = $currentTenant?.id;
          // First check if tower data is provided in the event
          if (data?.tower) {
            console.log('[Deploy] ✅ Using tower data from event for equipment modal:', data.tower);
            selectedSiteForEquipment = { ...data.tower }; // Create a copy to ensure reactivity
            showSiteEquipmentModal = true;
            console.log('[Deploy] ✅ SiteEquipmentModal state set:', { 
              show: showSiteEquipmentModal, 
              site: selectedSiteForEquipment?.name,
              siteId: selectedSiteForEquipment?.id,
              hasSite: !!selectedSiteForEquipment
            });
            
            // Center map on the site location
            const siteLocation = data.tower.location;
            if (siteLocation?.latitude && siteLocation?.longitude) {
              console.log('[Deploy] 🔵 Centering map on site location:', siteLocation.latitude, siteLocation.longitude);
              // Send message to map iframe to center on location
              const iframe = mapContainer?.querySelector('iframe') as HTMLIFrameElement | null;
              if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage({
                  source: 'shared-map',
                  type: 'center-map-on-location',
                  payload: {
                    lat: siteLocation.latitude,
                    lon: siteLocation.longitude,
                    zoom: 14
                  }
                }, '*');
                console.log('[Deploy] ✅ Sent center-map message to iframe');
              } else {
                // Fallback: dispatch custom event
                window.dispatchEvent(new CustomEvent('center-map-on-location', {
                  detail: { 
                    lat: siteLocation.latitude, 
                    lon: siteLocation.longitude, 
                    zoom: 14 
                  }
                }));
                console.log('[Deploy] ✅ Dispatched center-map-on-location event');
              }
            }
            
            // Force a small delay to ensure Svelte reactivity updates
            await new Promise(resolve => setTimeout(resolve, 0));
            console.log('[Deploy] ✅ After delay - Modal state:', { 
              show: showSiteEquipmentModal, 
              hasSite: !!selectedSiteForEquipment
            });
          } else if (tenantId) {
            // Fall back to fetching from database
            console.log('[Deploy] Fetching site from database for objectId:', objectId);
            const sites = await coverageMapService.getTowerSites(tenantId);
            const site = sites.find((s: any) => String(s.id || s._id) === String(objectId));
            if (site) {
              selectedSiteForEquipment = site;
              showSiteEquipmentModal = true;
              console.log('[Deploy] ✅ SiteEquipmentModal opened with fetched site:', site.name);
            } else {
              console.error('[Deploy] Site not found for objectId:', objectId);
              error = 'Site not found';
              setTimeout(() => error = '', 5000);
            }
          } else {
            console.error('[Deploy] No tenantId available');
            error = 'Tenant not available';
            setTimeout(() => error = '', 5000);
          }
        } catch (err) {
          console.error('[Deploy] Error loading site equipment:', err);
          error = 'Failed to load site equipment';
          setTimeout(() => error = '', 5000);
        }
      }
      
      // Handle change-site-type action - open site edit modal
      if (action === 'change-site-type' && objectId) {
        try {
          const { coverageMapService } = await import('../coverage-map/lib/coverageMapService.mongodb');
          const tenantId = $currentTenant?.id;
          // First check if tower data is provided in the event
          if (data?.tower) {
            selectedSiteForEdit = data.tower;
            showSiteEditModal = true;
          } else if (tenantId) {
            // Fall back to fetching from database
            const sites = await coverageMapService.getTowerSites(tenantId);
            const site = sites.find((s: any) => String(s.id || s._id) === String(objectId));
            if (site) {
              selectedSiteForEdit = site;
              showSiteEditModal = true;
            } else {
              error = 'Site not found';
              setTimeout(() => error = '', 5000);
            }
          }
        } catch (err) {
          console.error('Error loading site for editing:', err);
          error = 'Failed to load site';
          setTimeout(() => error = '', 5000);
        }
      }
    }
  }


  async function loadReadyPlans() {
    isLoadingPlans = true;
    try {
      const tenantId = $currentTenant?.id;
      if (tenantId) {
        // Get ALL projects (plans)
        const allProjects = await planService.getPlans(tenantId);
        
        // Separate projects by status for accurate menu counts
        draftPlans = allProjects.filter(project => project.status === 'draft' || project.status === 'active');
        approvedPlans = allProjects.filter(project => project.status === 'approved' || project.status === 'authorized');
        deployedPlans = allProjects.filter(project => project.status === 'deployed');
        
        // Show ALL projects in the list (for the projects modal)
        readyPlans = allProjects;
        
        // Initialize visible plan IDs from ALL plans with showOnMap = true (not just approved)
        visiblePlanIds = new Set(
          allProjects.filter(p => p.showOnMap).map(p => p.id)
        );
        
        await mapLayerManager.loadProductionHardware(tenantId);
        // Load first activated plan (any status) or first approved plan
        const planToLoad = allProjects.find(p => p.showOnMap) || approvedPlans[0];
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
        
        // Load and count sectors for planner buttons
        // Only count deployed/active sectors (not planned ones)
        try {
          const { coverageMapService } = await import('../coverage-map/lib/coverageMapService.mongodb');
          // Don't include plan layer - only count actual deployed sectors
          const allSectors = await coverageMapService.getSectors(tenantId);
          
          // Helper function to identify fake/test sectors
          function isFakeSector(sector: any): boolean {
            if (!sector || !sector.name) return true; // Treat sectors without names as fake
            const name = String(sector.name).toLowerCase();
            
            // Patterns that indicate fake/test sectors from test scripts
            const fakePatterns = [
              /main tower sector/i,
              /secondary tower sector/i,
              /customer.*cpe/i,
              /customer.*lte/i,
              /customer a/i,
              /customer b/i,
              /fake/i,
              /demo/i,
              /sample/i,
              /^test$/i,
              /mock/i
            ];
            
            return fakePatterns.some(pattern => pattern.test(name));
          }
          
          // Reset counts first
          lteSectorCount = 0;
          frequencySectorCount = 0;
          
          // Filter to only deployed/active sectors (exclude planned and fake)
          const deployedSectors = allSectors.filter((sector: any) => {
            // Exclude fake sectors
            if (isFakeSector(sector)) {
              console.log(`[Deploy] Filtering out fake sector: ${sector.name}`);
              return false;
            }
            
            const status = (sector.status || '').toLowerCase();
            if (status !== 'active' && status !== 'deployed') {
              console.log(`[Deploy] Filtering out non-deployed sector: ${sector.name} (status: ${status})`);
              return false;
            }
            
            return true;
          });
          console.log(`[Deploy] Filtered to ${deployedSectors.length} deployed sectors (from ${allSectors.length} total, filtered ${allSectors.length - deployedSectors.length} fake/planned)`);
          
          // Count LTE sectors only (for PCI Planner)
          const lteSectors = deployedSectors.filter((sector: any) => {
            const tech = (sector.technology || '').toUpperCase();
            return tech === 'LTE' || tech === 'LTECBRS' || tech === 'LTE+CBRS';
          });
          lteSectorCount = lteSectors.length;
          console.log(`[Deploy] Found ${lteSectorCount} deployed LTE (ENB) sectors for PCI planner`);
          
          // Count LTE + FWA sectors (for Frequency Planner)
          const frequencySectors = deployedSectors.filter((sector: any) => {
            const tech = (sector.technology || '').toUpperCase();
            return tech === 'LTE' || tech === 'LTECBRS' || tech === 'LTE+CBRS' || tech === 'FWA';
          });
          frequencySectorCount = frequencySectors.length;
          console.log(`[Deploy] Found ${frequencySectorCount} deployed LTE/FWA sectors for Frequency planner`);
        } catch (err) {
          console.error('Failed to load sector counts:', err);
          lteSectorCount = 0;
          frequencySectorCount = 0;
        }
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      isLoadingPlans = false;
    }
  }

  async function focusPlanOnMap(planId: string | null) {
    const tenantId = $currentTenant?.id;
    if (!tenantId || !planId) return;
    // Find plan in any status (not just approved)
    const plan = readyPlans.find(p => p.id === planId);
    if (plan) {
      await mapLayerManager.loadPlan(tenantId, plan);
    }
  }

  // Activate plan - show any plan on the map (only one active at a time)
  async function activatePlan(plan: PlanProject) {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    
    try {
      isLoadingPlans = true;
      
      // First, deactivate all other plans (set showOnMap to false)
      const otherPlans = readyPlans.filter(p => p.id !== plan.id && p.showOnMap);
      for (const otherPlan of otherPlans) {
        await planService.updatePlan(otherPlan.id, { showOnMap: false });
      }
      
      // Then activate the selected plan
      await planService.updatePlan(plan.id, { showOnMap: true });
      
      // Load the plan on the map (works for any plan status)
      await mapLayerManager.loadPlan(tenantId, plan);
      
      // Update visible plan IDs - only the activated plan
      visiblePlanIds = new Set([plan.id]);
      
      // Reload plans to update state
      await loadReadyPlans();
      
      deploymentMessage = `✅ Plan "${plan.name}" is now active and visible on the map.`;
      setTimeout(() => (deploymentMessage = ''), 5000);
    } catch (err: any) {
      error = err.message || 'Failed to activate plan';
      console.error('Error activating plan:', err);
      setTimeout(() => (error = ''), 5000);
    } finally {
      isLoadingPlans = false;
    }
  }

  // Deactivate plan - hide plan from map and clear planned objects
  async function deactivatePlan(plan: PlanProject) {
    const tenantId = $currentTenant?.id;
    if (!tenantId) return;
    
    try {
      isLoadingPlans = true;
      
      // Deactivate the plan
      await planService.updatePlan(plan.id, { showOnMap: false });
      
      // Remove from visible plans
      visiblePlanIds.delete(plan.id);
      visiblePlanIds = new Set(visiblePlanIds);
      
      // If this was the active plan on the map, clear planned objects
      if (mapState?.activePlan?.id === plan.id) {
        // Clear the plan and staged features from the map (planned objects)
        // Keep production hardware (deployed objects) visible
        setMapData({
          activePlan: null,
          stagedFeatures: [],
          stagedSummary: { total: 0, byType: {}, byStatus: {} }
        });
        
        // Try to load another active plan, or just show production hardware
        const nextActivePlan = readyPlans.find(p => p.showOnMap && p.id !== plan.id);
        if (nextActivePlan) {
          await mapLayerManager.loadPlan(tenantId, nextActivePlan);
        } else {
          // Ensure production hardware is loaded (deployed objects persist)
          await mapLayerManager.loadProductionHardware(tenantId);
        }
      }
      
      // Reload plans to update state
      await loadReadyPlans();
      
      deploymentMessage = `Plan "${plan.name}" has been deactivated. Planned objects removed from map.`;
      setTimeout(() => (deploymentMessage = ''), 5000);
    } catch (err: any) {
      error = err.message || 'Failed to deactivate plan';
      console.error('Error deactivating plan:', err);
      setTimeout(() => (error = ''), 5000);
    } finally {
      isLoadingPlans = false;
    }
  }

  // Toggle plan activation
  async function togglePlanActivation(plan: PlanProject) {
    if (plan.showOnMap) {
      await deactivatePlan(plan);
    } else {
      await activatePlan(plan);
    }
  }

  // Deploy plan - authorize and promote features to production
  async function deployPlan(plan: PlanProject) {
    if (plan.status !== 'approved') {
      error = 'Only approved plans can be deployed.';
      setTimeout(() => (error = ''), 5000);
      return;
    }

    const tenantId = $currentTenant?.id;
    if (!tenantId) return;

    if (!confirm(`Deploy plan "${plan.name}"? This will promote all plan features to production. This action cannot be undone.`)) {
      return;
    }

    try {
      isLoadingPlans = true;
      
      // Get plan features count BEFORE authorization (for message)
      const { features } = await planService.getPlanFeatures(plan.id);
      
      // Authorize the plan - this promotes features to production and sets status to 'authorized'
      await planService.authorizePlan(plan.id);
      
      // Mark plan as deployed and then archived
      await planService.updatePlan(plan.id, { status: 'deployed' });
      await planService.updatePlan(plan.id, { status: 'archived' });
      
      // Reload production hardware to show the newly promoted features
      await mapLayerManager.loadProductionHardware(tenantId);
      
      // Reload plans to update counts and status
      await loadReadyPlans();
      
      // Update map state if plan was active
      if (mapState?.activePlan?.id === plan.id) {
        // Plan is now deployed, clear it from map
        setMapData({
          activePlan: null,
          stagedFeatures: [],
          stagedSummary: { total: 0, byType: {}, byStatus: {} }
        });
        
        // Load a different approved plan if available
        const nextApprovedPlan = approvedPlans.find(p => p.id !== plan.id && p.showOnMap);
        if (nextApprovedPlan) {
          await mapLayerManager.loadPlan(tenantId, nextApprovedPlan);
        }
      }
      
      deploymentMessage = `✅ Plan "${plan.name}" has been deployed! ${features.length} features promoted to production.`;
      setTimeout(() => (deploymentMessage = ''), 8000);
    } catch (err: any) {
      error = err.message || 'Failed to deploy plan';
      console.error('Error deploying plan:', err);
      setTimeout(() => (error = ''), 8000);
    } finally {
      isLoadingPlans = false;
    }
  }

  // Take over plan - mark authorized plan as deployed (legacy function, kept for compatibility)
  async function takeOverPlan(plan: PlanProject) {
    if (plan.status !== 'authorized') {
      error = 'Only authorized plans can be taken over.';
      setTimeout(() => (error = ''), 5000);
      return;
    }

    const tenantId = $currentTenant?.id;
    if (!tenantId) return;

    try {
      isLoadingPlans = true;
      
      // Get plan features
      const { features } = await planService.getPlanFeatures(plan.id);
      
      // Mark plan as deployed (take over) and then move to archived
      await planService.updatePlan(plan.id, { status: 'deployed' });
      await planService.updatePlan(plan.id, { status: 'archived' });
      
      // Reload plans to update counts and status
      await loadReadyPlans();
      
      // Update map state if plan was active
      if (mapState?.activePlan?.id === plan.id) {
        // Plan is now deployed, so load a different approved plan if available
        const nextApprovedPlan = approvedPlans.find(p => p.id !== plan.id && p.showOnMap) || approvedPlans[0];
        if (nextApprovedPlan) {
          await mapLayerManager.loadPlan(tenantId, nextApprovedPlan);
        }
      }
      
      deploymentMessage = `✅ Plan "${plan.name}" has been taken over and marked as deployed (${features.length} items).`;
      setTimeout(() => (deploymentMessage = ''), 6000);
    } catch (err: any) {
      error = err.message || 'Failed to take over plan';
      console.error('Error taking over plan:', err);
      setTimeout(() => (error = ''), 5000);
    } finally {
      isLoadingPlans = false;
    }
  }

  function goBack() {
    goto('/dashboard');
  }

  async function pushActivePlanToField() {
    const tenantId = $currentTenant?.id;
    const plan = mapState?.activePlan;

    if (!tenantId || !plan) {
      deploymentMessage = 'Select an approved plan to deploy.';
      setTimeout(() => (deploymentMessage = ''), 4000);
      return;
    }

    // Only allow deploying approved plans
    if (plan.status !== 'approved') {
      deploymentMessage = 'Plan must be approved before deployment.';
      setTimeout(() => (deploymentMessage = ''), 4000);
      return;
    }

    // Call the deploy function which handles authorization and promotion
    await deployPlan(plan);
  }

  // Plan approval functions
  function openPlanApproval() {
    // Always show the list first - don't auto-select a plan
    selectedPlan = null;
    approvalMode = null;
    showPlanApprovalModal = true;
  }

  function closePlanApprovalModal() {
    showPlanApprovalModal = false;
    selectedPlan = null;
    approvalMode = null;
  }

  function selectPlanForApproval(plan: PlanProject) {
    // Select the plan and show the approval modal
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
        // Automatically show approved plan on map if it was already activated
        if (updatedPlan.status === 'approved' || updatedPlan.status === 'authorized') {
          // If plan was already activated (showOnMap), keep it visible
          if (updatedPlan.showOnMap) {
            visiblePlanIds.add(updatedPlan.id);
            visiblePlanIds = new Set(visiblePlanIds);
            await focusPlanOnMap(updatedPlan.id);
          } else {
            // Auto-activate approved plans
            await planService.updatePlan(updatedPlan.id, { showOnMap: true });
            visiblePlanIds.add(updatedPlan.id);
            visiblePlanIds = new Set(visiblePlanIds);
            await focusPlanOnMap(updatedPlan.id);
          }
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

  async function handleFinalizePlan(plan: PlanProject) {
    try {
      isLoadingPlans = true;
      await planService.markPlanReady(plan.id);
      await loadReadyPlans();
      
      // Update selected plan if it was the one finalized
      if (selectedPlan && selectedPlan.id === plan.id) {
        const updatedPlan = readyPlans.find(p => p.id === plan.id);
        if (updatedPlan) {
          selectedPlan = updatedPlan;
        }
      }
      
      deploymentMessage = `Plan "${plan.name}" has been finalized and is ready for approval.`;
      setTimeout(() => (deploymentMessage = ''), 5000);
    } catch (err: any) {
      error = err.message || 'Failed to finalize plan';
      console.error('Error finalizing plan:', err);
      setTimeout(() => (error = ''), 5000);
    } finally {
      isLoadingPlans = false;
    }
  }

  // PCI Planner functions
  function openPCIPlanner() {
    console.log('[Deploy] Opening PCI Planner modal');
    console.log('[Deploy] Current tenant:', $currentTenant);
    console.log('[Deploy] Tenant ID:', $currentTenant?.id);
    
    // Check if user is admin - if so, allow opening without tenant
    const isAdmin = isPlatformAdmin(currentUser?.email ?? null);
    
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
    const isAdmin = isPlatformAdmin(currentUser?.email ?? null);
    
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
    <div class="module-header-overlay" style="background: var(--gradient-success);">
      <div class="module-header-left">
        <button class="module-back-btn" onclick={() => {
          console.log('[Deploy] Back to Dashboard clicked');
          goto('/dashboard');
        }} title="Back to Dashboard">
          ←
        </button>
        <h1>🚀 Deploy</h1>
      </div>
      <div class="module-header-controls">
        <button 
          class="module-control-btn" 
          class:active={showProjectFilters}
          onclick={() => showProjectFilters = !showProjectFilters} 
          title="Project Filters - Approved projects ready for deployment"
        >
          <span class="control-icon">🔍</span>
          <span class="control-label">Approved ({approvedPlans.length})</span>
        </button>
        <button class="module-control-btn" onclick={openPlanApproval} title="Projects - View and manage all projects">
          <span class="control-icon">📋</span>
          <span class="control-label">Projects ({readyPlans.length})</span>
        </button>
        <button 
          class="module-control-btn" 
          onclick={() => showDeployedHardwareModal = true}
          title="View Deployed Projects"
        >
          <span class="control-icon">✅</span>
          <span class="control-label">Deployed ({deployedPlans.length})</span>
        </button>
        <button 
          class="module-control-btn" 
          class:disabled={buttonsDisabled}
          onclick={() => {
            console.log('[Deploy] PCI button clicked');
            openPCIPlanner();
          }} 
          title={isAdmin ? `PCI Planner (Admin) - ${lteSectorCount} LTE sectors` : ($currentTenant ? `PCI Planner - ${lteSectorCount} LTE sectors` : "PCI Planner (No tenant selected)")}
        >
          <span class="control-icon">📊</span>
          <span class="control-label">PCI {lteSectorCount > 0 ? `(${lteSectorCount})` : ''}</span>
        </button>

        <button 
          class="module-control-btn" 
          class:disabled={buttonsDisabled}
          onclick={() => {
            console.log('[Deploy] Frequency button clicked');
            openFrequencyPlanner();
          }} 
          title={isAdmin ? `Frequency Planner (Admin) - ${frequencySectorCount} LTE/FWA sectors` : ($currentTenant ? `Frequency Planner - ${frequencySectorCount} LTE/FWA sectors` : "Frequency Planner (No tenant selected)")}
        >
          <span class="control-icon">📡</span>
          <span class="control-label">Frequency {frequencySectorCount > 0 ? `(${frequencySectorCount})` : ''}</span>
        </button>
        <button 
          class="module-control-btn" 
          onclick={() => showDeployedHardwareModal = true}
          title="View and Edit Deployed Hardware"
        >
          <span class="control-icon">🔧</span>
          <span class="control-label">Hardware ({deployedCount})</span>
        </button>
        
        <!-- Add Hardware Dropdown -->
        <div class="dropdown-container">
          <button 
            class="module-control-btn add-hardware-btn" 
            onclick={() => showAddHardwareMenu = !showAddHardwareMenu}
            title="Deploy New Hardware"
          >
            <span class="control-icon">➕</span>
            <span class="control-label">Add Hardware</span>
          </button>
          {#if showAddHardwareMenu}
            <div class="dropdown-menu" onclick={() => showAddHardwareMenu = false}>
              <button class="dropdown-item" onclick={() => { showEPCDeploymentModal = true; showAddHardwareMenu = false; }}>
                📡 EPC/SNMP Server
              </button>
              <button class="dropdown-item" onclick={() => { goto('/modules/inventory/add?type=sector'); showAddHardwareMenu = false; }}>
                📶 Sector/Antenna
              </button>
              <button class="dropdown-item" onclick={() => { goto('/modules/inventory/add?type=radio'); showAddHardwareMenu = false; }}>
                📻 Radio/eNB
              </button>
              <button class="dropdown-item" onclick={() => { goto('/modules/inventory/add?type=router'); showAddHardwareMenu = false; }}>
                🌐 Router/Switch
              </button>
              <button class="dropdown-item" onclick={() => { goto('/modules/inventory/add'); showAddHardwareMenu = false; }}>
                🔧 Other Hardware
              </button>
            </div>
          {/if}
        </div>
        
        <button 
          class="module-control-btn deploy-btn" 
          class:disabled={!mapState?.activePlan}
          disabled={!mapState?.activePlan}
          onclick={pushActivePlanToField}
          title={mapState?.activePlan ? `Push ${mapState.activePlan.name} to field teams` : 'Select a plan to deploy'}
        >
          <span class="control-icon">🚀</span>
          <span class="control-label">Deploy Plan</span>
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
  
  <!-- Site Details Modal -->
  {#if showSiteDetailsModal && selectedSiteForDetails}
    <SiteDetailsModal
      show={showSiteDetailsModal}
      site={selectedSiteForDetails}
      tenantId={$currentTenant?.id || ''}
      on:close={() => {
        showSiteDetailsModal = false;
        selectedSiteForDetails = null;
      }}
    />
  {/if}

  {#if showSiteEquipmentModal && selectedSiteForEquipment}
    <SiteEquipmentModal
      show={showSiteEquipmentModal}
      site={selectedSiteForEquipment}
      tenantId={$currentTenant?.id || ''}
      on:close={() => {
        showSiteEquipmentModal = false;
        selectedSiteForEquipment = null;
      }}
    />
  {/if}
  
  <!-- Site Edit Modal -->
  {#if showSiteEditModal && selectedSiteForEdit}
    <SiteEditModal
      show={showSiteEditModal}
      site={selectedSiteForEdit}
      tenantId={$currentTenant?.id || ''}
      on:close={() => {
        showSiteEditModal = false;
        selectedSiteForEdit = null;
        loadReadyPlans(); // Reload to refresh site list
      }}
      on:saved={() => {
        showSiteEditModal = false;
        selectedSiteForEdit = null;
        loadReadyPlans(); // Reload to refresh site list
      }}
    />
  {/if}
  
  <!-- EPC Deployment Modal -->
  {#if showEPCDeploymentModal}
    <EPCDeploymentModal
      show={showEPCDeploymentModal}
      tenantId={$currentTenant?.id || ''}
      on:close={() => showEPCDeploymentModal = false}
    />
  {/if}
  
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
  
  <!-- Plan Selection Modal (shows list of all plans) -->
  {#if showPlanApprovalModal && !selectedPlan}
    <div class="modal-overlay" onclick={closePlanApprovalModal}>
      <div class="plan-list-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>📋 All Plans - Activate, Approve, or Take Over</h2>
          <button class="close-btn" onclick={closePlanApprovalModal}>✕</button>
        </div>
        
        <div class="modal-body">
          {#if isLoadingPlans}
            <div class="loading">Loading plans...</div>
          {:else if readyPlans.length === 0}
            <div class="empty-state">
              <p>No projects available</p>
              <p class="hint">Create projects in the Plan module to see them here</p>
            </div>
          {:else}
            <div class="plan-list">
              {#each readyPlans as plan}
                <div class="plan-item">
                  <div class="plan-content">
                    <div class="plan-header">
                      <h3>{plan.name}</h3>
                      <span class="status-badge {plan.status}">{plan.status}</span>
                      {#if plan.showOnMap}
                        <span class="active-badge">📍 Active</span>
                      {/if}
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
                  <div class="plan-actions">
                    <button 
                      class="btn-activate" 
                      class:btn-deactivate={plan.showOnMap}
                      onclick={() => togglePlanActivation(plan)}
                      disabled={isLoadingPlans}
                      title={plan.showOnMap ? "Deactivate this plan to hide it from the map" : "Activate this plan to view it on the map"}
                    >
                      {plan.showOnMap ? '❌ Deactivate' : '📍 Activate'}
                    </button>
                    {#if plan.status === 'draft' || plan.status === 'active'}
                      <button 
                        class="btn-finalize" 
                        onclick={() => handleFinalizePlan(plan)}
                        disabled={isLoadingPlans}
                        title="Finalize this project to make it ready for approval"
                      >
                        ✅ Finalize
                      </button>
                    {:else if plan.status === 'ready' || plan.status === 'approved' || plan.status === 'authorized'}
                      <button 
                        class="btn-action" 
                        onclick={() => selectPlanForApproval(plan)}
                        disabled={isLoadingPlans}
                        title="Approve or reject this project"
                      >
                        📋 {plan.status === 'approved' || plan.status === 'authorized' ? 'Review' : 'Approve'}
                      </button>
                    {/if}
                    {#if plan.status === 'approved'}
                      <button 
                        class="btn-deploy" 
                        onclick={() => deployPlan(plan)}
                        disabled={isLoadingPlans}
                        title="Deploy this plan - promotes all features to production"
                      >
                        🚀 Deploy
                      </button>
                    {:else if plan.status === 'authorized' && plan.showOnMap}
                      <button 
                        class="btn-takeover" 
                        onclick={() => takeOverPlan(plan)}
                        disabled={isLoadingPlans}
                        title="Mark this authorized plan as deployed"
                      >
                        ✅ Take Over
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" onclick={closePlanApprovalModal}>Close</button>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Global Settings Button - Hidden in deploy mode, shown in coverage-map iframe instead -->
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

  /* Left Horizontal Menu - Using common styles from moduleHeaderMenu.css */
  /* Additional module-specific overrides can go here */


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

  /* Control Button Styles - Using common styles from moduleHeaderMenu.css */
  /* Additional module-specific overrides */
  .module-control-btn.deploy-btn {
    background: rgba(59, 130, 246, 0.25);
  }

  .module-control-btn.deploy-btn:hover {
    background: rgba(59, 130, 246, 0.35);
  }

  .module-control-btn.deploy-btn.disabled,
  .module-control-btn.deploy-btn:disabled {
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

  .module-control-btn.disabled {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.5);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .module-control-btn.disabled:hover {
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
    transition: all 0.2s;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  
  .plan-item:hover {
    background: var(--bg-hover);
    border-color: var(--brand-primary);
    transform: translateY(-1px);
  }
  
  .plan-content {
    flex: 1;
    cursor: pointer;
    min-width: 0;
  }
  
  .plan-content:not(.disabled):hover {
    cursor: pointer;
  }
  
  .plan-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  
  .plan-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .plan-header h3 {
    margin: 0;
    flex: 1;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .active-badge {
    padding: 0.25rem 0.5rem;
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
    border-radius: var(--border-radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .btn-finalize,
  .btn-action,
  .btn-activate,
  .btn-takeover,
  .btn-deploy {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--border-radius-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .btn-activate {
    background: var(--info, #3b82f6);
    color: white;
  }

  .btn-activate:hover:not(:disabled) {
    background: var(--info-hover, #2563eb);
    transform: translateY(-1px);
  }

  .btn-activate.btn-deactivate {
    background: var(--danger, #ef4444);
    color: white;
  }

  .btn-activate.btn-deactivate:hover:not(:disabled) {
    background: var(--danger-hover, #dc2626);
    transform: translateY(-1px);
  }

  .btn-takeover {
    background: var(--success, #22c55e);
    color: white;
  }

  .btn-takeover:hover:not(:disabled) {
    background: var(--success-hover, #16a34a);
    transform: translateY(-1px);
  }

  .btn-finalize {
    background: var(--success);
    color: white;
  }
  
  .btn-finalize:hover:not(:disabled) {
    background: var(--success-hover);
    transform: translateY(-1px);
  }
  
  .btn-action {
    background: var(--brand-primary);
    color: white;
  }
  
  .btn-action:hover:not(:disabled) {
    background: var(--brand-primary-hover);
    transform: translateY(-1px);
  }

  .btn-deploy {
    background: var(--success, #22c55e);
    color: white;
  }

  .btn-deploy:hover:not(:disabled) {
    background: var(--success-hover, #16a34a);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
  }

  .btn-activate:disabled,
  .btn-takeover:disabled,
  .btn-finalize:disabled,
  .btn-action:disabled,
  .btn-deploy:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
  
  .status-badge.draft {
    background: rgba(148, 163, 184, 0.1);
    color: #64748b;
  }
  
  .status-badge.active {
    background: rgba(234, 179, 8, 0.1);
    color: #ca8a04;
  }
  
  .status-badge.ready {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }
  
  .status-badge.approved {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
  }
  
  .status-badge.authorized {
    background: rgba(139, 92, 246, 0.1);
    color: #7c3aed;
  }
  
  .status-badge.deployed {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }
  
  .loading,
  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary);
  }
  
  /* Add Hardware Dropdown */
  .dropdown-container {
    position: relative;
  }
  
  .add-hardware-btn {
    background: var(--success, #22c55e) !important;
  }
  
  .add-hardware-btn:hover {
    background: var(--success-hover, #16a34a) !important;
  }
  
  .dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    background: var(--card-bg, white);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: var(--border-radius-md);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    min-width: 200px;
    z-index: 1000;
    overflow: hidden;
  }
  
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text-primary);
    transition: background 0.15s;
  }
  
  .dropdown-item:hover {
    background: var(--bg-hover, #f1f5f9);
  }
  
  .dropdown-item:not(:last-child) {
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }
</style>