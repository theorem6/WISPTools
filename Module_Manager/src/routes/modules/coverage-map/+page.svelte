<script lang="ts">
  const DEFAULT_LATITUDE = 40.7128;
  const DEFAULT_LONGITUDE = -74.0060;
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { currentTenant } from '$lib/stores/tenantStore';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import CoverageMapView from './components/CoverageMapView.svelte';
  import FilterPanel from './components/FilterPanel.svelte';
  import AddSiteModal from './components/AddSiteModal.svelte';
  import AddNOCModal from './components/AddNOCModal.svelte';
  import AddWarehouseModal from './components/AddWarehouseModal.svelte';
  import AddVehicleModal from './components/AddVehicleModal.svelte';
  import AddRMAModal from './components/AddRMAModal.svelte';
  import AddSectorModal from './components/AddSectorModal.svelte';
  import SettingsButton from '$lib/components/SettingsButton.svelte';
  import AddCPEModal from './components/AddCPEModal.svelte';
  import AddBackhaulLinkModal from './components/AddBackhaulLinkModal.svelte';
  import AddInventoryModal from './components/AddInventoryModal.svelte';
  import MapContextMenu from './components/MapContextMenu.svelte';
  import TowerActionsMenu from './components/TowerActionsMenu.svelte';
  import EPCDeploymentModal from '../deploy/components/EPCDeploymentModal.svelte';
  import HSSRegistrationModal from './components/HSSRegistrationModal.svelte';
  import HardwareDeploymentModal from './components/HardwareDeploymentModal.svelte';
  import SiteEditModal from './components/SiteEditModal.svelte';
import { coverageMapService } from './lib/coverageMapService.mongodb';
  import { reportGenerator } from './lib/reportGenerator';
  import { objectStateManager, type ModuleContext } from '$lib/services/objectStateManager';
import { mapLayerManager } from '$lib/map/MapLayerManager';
  import type { 
    TowerSite, Sector, CPEDevice, NetworkEquipment, 
    CoverageMapFilters, Location 
  } from './lib/models';
import type { PlanLayerFeature, PlanFeatureSummary, HardwareView, PlanFeatureGeometry, PlanMarketingAddress } from '$lib/services/planService';
import type { MapModuleMode, MapCapabilities } from '$lib/map/MapCapabilities';
  
  // Data
  let towers: TowerSite[] = [];
  let sectors: Sector[] = [];
  let cpeDevices: CPEDevice[] = [];
  let equipment: NetworkEquipment[] = [];
  
  // UI State
  let isLoading = true;
  let error = '';
  let success = '';
  let showFilters = false;
  let showMainMenu = false;
  let showStats = false;
  let currentBasemap = 'topo-vector';
  
  // Modals
  let showAddSiteModal = false;
  let showAddNOCModal = false;
  let showAddWarehouseModal = false;
  let showAddVehicleModal = false;
  let showAddRMAModal = false;
  let showAddSectorModal = false;
  let showAddCPEModal = false;
  let showAddBackhaulModal = false;
  let showAddInventoryModal = false;
  let showContextMenu = false;
  let showTowerActionsMenu = false;
  let showEPCDeploymentModal = false;
  let showHSSRegistrationModal = false;
  let showHardwareDeploymentModal = false;
  let showSiteEditModal = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuLat = DEFAULT_LATITUDE;
  let contextMenuLon = DEFAULT_LONGITUDE;
  let selectedSiteForSector: TowerSite | null = null;
  let selectedSiteForBackhaul: TowerSite | null = null;
  let selectedSiteForInventory: TowerSite | null = null;
  let selectedTowerForMenu: TowerSite | null = null;
  let selectedTowerForEPC: TowerSite | null = null;
  let selectedSiteForEdit: TowerSite | null = null;
  let towerMenuX = 0;
  let towerMenuY = 0;
  let initialSiteType: TowerSite['type'] | null = null;
  let selectedPlanDraft: PlanLayerFeature | null = null;
  let showPlanDraftMenu = false;
  let planDraftMenuX = 0;
  let planDraftMenuY = 0;
  let selectedPlanDraftCoords = { latitude: null as number | null, longitude: null as number | null };
  let planDraftForSiteEdit: PlanLayerFeature | null = null;
  let planDraftsForMap: PlanLayerFeature[] = [];
  let planDraftSitesForActions: TowerSite[] = [];
  let combinedSites: TowerSite[] = [];
  let visiblePlanIds: string[] = [];
  let marketingLeads: PlanMarketingAddress[] = [];
  
  // Map mode derived from query parameters (default to coverage view)
  $: mapMode = (() => {
    const modeParam = $page.url.searchParams.get('mode');
    if (modeParam) {
      return modeParam.toLowerCase();
    }
    return $page.url.searchParams.get('planMode') === 'true' ? 'plan' : 'coverage';
  })();

  $: isPlanMode = mapMode === 'plan';
  $: isDeployMode = mapMode === 'deploy';
  $: isMonitorMode = mapMode === 'monitor';

  let sharedCapabilities: MapCapabilities | null = null;
  let sharedActivePlanId: string | null = null;
  let planEditingEnabled = true;

  // Module context for permissions
  $: moduleContext = (() => {
    const userRole = ($currentTenant?.userRole as string | undefined) || 'admin';
    const context: ModuleContext = {
      module: 'coverage-map',
      userRole
    };

    if (isPlanMode) {
      context.module = 'plan';
      if (planId) {
        context.projectId = planId;
      }
    } else if (isDeployMode) {
      context.module = 'deploy';
    } else if (isMonitorMode) {
      context.module = 'monitor';
    }

    return context;
  })();
  
  // Filters
  let filters: CoverageMapFilters = {
    showTowers: true,
    showSectors: true,
    showCPE: true,
    showEquipment: false,
    showMarketing: true,
    showBackhaul: true,
    showFiber: true,
    showWirelessLicensed: true,
    showWirelessUnlicensed: true,
    bandFilters: [],
    statusFilter: [],
    technologyFilter: [],
    locationTypeFilter: []
  };
  
  // References
  let mapComponent: any;
  
  // Tenant info
  $: tenantId = $currentTenant?.id || '';
  $: tenantName = $currentTenant?.displayName || 'Organization';
  
  // Check if stats should be hidden (for plan module)
  $: hideStats = isPlanMode ? true : $page.url.searchParams.get('hideStats') === 'true';
  // Plan mode - when creating sites within a plan
  let planId: string | null = null;
  $: planId = $page.url.searchParams.get('planId') || null;
  let activePlanName: string | null = null;
  let effectivePlanId: string | null = null;
  
  let externalPlanFeatures: PlanLayerFeature[] = [];
  let externalPlanSummary: PlanFeatureSummary | null = null;
  let derivedPlanSummary: PlanFeatureSummary | null = null;
  let displayPlanSummary: PlanFeatureSummary | null = null;
  function summarizePlanFeatures(features: PlanLayerFeature[]): PlanFeatureSummary {
    const summary: PlanFeatureSummary = {
      total: features.length,
      byType: {},
      byStatus: {}
    };

    for (const feature of features) {
      const typeKey = feature.featureType || feature.properties?.featureType || 'plan';
      const statusKey = feature.status || 'draft';
      summary.byType[typeKey] = (summary.byType[typeKey] ?? 0) + 1;
      summary.byStatus[statusKey] = (summary.byStatus[statusKey] ?? 0) + 1;
    }

    return summary;
  }

  let sharedMapMode: MapModuleMode | null = null;
  let externalProductionHardware: HardwareView[] = [];
  let sharedMapStateTimestamp: Date | null = null;

  $: {
    const activePlanId = planId || sharedActivePlanId;
    const mapInPlanMode = isPlanMode || sharedMapMode === 'plan' || mapMode === 'plan';
    const readOnly = sharedCapabilities?.readOnly ?? false;
    const canAddTemporary = sharedCapabilities?.canAddTemporary ?? false;

    planEditingEnabled = mapInPlanMode ? (Boolean(activePlanId) || canAddTemporary) && !readOnly : true;
  }

  $: effectivePlanId = planId ?? sharedActivePlanId ?? null;
  $: {
    const activePlanId = getActivePlanIdForActions();
    if (activePlanId && !visiblePlanIds.includes(activePlanId)) {
      visiblePlanIds = Array.from(new Set([...visiblePlanIds, activePlanId]));
    }
  }
  $: planDraftsForMap = (externalPlanFeatures ?? []).filter(feature => {
      const featurePlanId = getFeaturePlanId(feature);
      const activePlanId = getActivePlanIdForActions();
      if (activePlanId) {
        if (!featurePlanId) {
          return true;
        }
        return featurePlanId === activePlanId;
      }
      if (visiblePlanIds.length > 0) {
        return featurePlanId ? visiblePlanIds.includes(featurePlanId) : false;
      }
      return false;
    });
  $: planDraftSitesForActions = planDraftsForMap
      .filter(feature => feature.featureType === 'site')
      .map(convertPlanDraftToTowerSite);
  $: combinedSites = [...towers, ...planDraftSitesForActions];
  $: derivedPlanSummary = summarizePlanFeatures(planDraftsForMap);
  $: displayPlanSummary = externalPlanSummary ?? derivedPlanSummary;

  function getPlanDraftCoordinates(draft: PlanLayerFeature | null): { latitude: number | null; longitude: number | null } {
    if (!draft) return { latitude: null, longitude: null };

    const original = draft.metadata?.originalGeometry;
    if (original?.coordinates?.length >= 2) {
      return { longitude: original.coordinates[0], latitude: original.coordinates[1] };
    }

    const geometry: any = draft.geometry;
    if (geometry?.coordinates?.length >= 2) {
      return { longitude: geometry.coordinates[0], latitude: geometry.coordinates[1] };
    }

    if (typeof geometry?.longitude === 'number' && typeof geometry?.latitude === 'number') {
      return { longitude: geometry.longitude, latitude: geometry.latitude };
    }

    if (typeof geometry?.x === 'number' && typeof geometry?.y === 'number') {
      return { longitude: geometry.x, latitude: geometry.y };
    }

    if (typeof draft.properties?.longitude === 'number' && typeof draft.properties?.latitude === 'number') {
      return { longitude: draft.properties.longitude, latitude: draft.properties.latitude };
    }

    return { latitude: null, longitude: null };
  }

  function getFeaturePlanId(feature: PlanLayerFeature): string | null {
    return (
      feature.planId ??
      feature.properties?.planId ??
      (feature.metadata as any)?.planId ??
      (feature.metadata as any)?.originalPlanId ??
      null
    );
  }

  function getActivePlanIdForActions(): string | null {
    return effectivePlanId;
  }

  function convertPlanDraftToTowerSite(feature: PlanLayerFeature): TowerSite {
    const coords = getPlanDraftCoordinates(feature);
    const props = feature.properties ?? {};
    const latitude =
      coords.latitude ??
      props.latitude ??
      props.location?.latitude ??
      0;
    const longitude =
      coords.longitude ??
      props.longitude ??
      props.location?.longitude ??
      0;

    return {
      id: feature.id,
      name: props.name ?? props.siteName ?? 'Draft Site',
      type: (props.siteType ?? 'tower') as TowerSite['type'],
      location: {
        latitude,
        longitude,
        address: props.address ?? props.location?.address,
        city: props.city ?? props.location?.city,
        state: props.state ?? props.location?.state,
        zipCode: props.zipCode ?? props.location?.zipCode
      },
      height: props.height,
      fccId: props.fccId,
      towerOwner: props.towerOwner,
      towerContact: props.towerContact,
      siteContact: props.siteContact,
      gateCode: props.gateCode,
      accessInstructions: props.accessInstructions,
      safetyNotes: props.safetyNotes,
      tenantId: props.tenantId ?? tenantId ?? '',
      createdAt: new Date(feature.createdAt ?? Date.now()),
      updatedAt: new Date(feature.updatedAt ?? Date.now()),
      planId: getFeaturePlanId(feature),
      planDraft: true,
      status: feature.status ?? 'draft',
      metadata: feature.metadata ?? {}
    };
  }

  function handlePlanDraftMenuAction(action: 'edit-site' | 'add-sector' | 'add-backhaul' | 'add-inventory') {
    if (!selectedPlanDraft) {
      return;
    }

    const activePlan = getActivePlanIdForActions();
    if (!activePlan) {
      error = 'Select a plan to stage assets.';
      setTimeout(() => (error = ''), 4000);
      showPlanDraftMenu = false;
      return;
    }

    const draftSite = convertPlanDraftToTowerSite(selectedPlanDraft);

    switch (action) {
      case 'edit-site': {
        planDraftForSiteEdit = selectedPlanDraft;
        initialSiteType = draftSite.type;
        contextMenuLat = draftSite.location.latitude;
        contextMenuLon = draftSite.location.longitude;
        showAddSiteModal = true;
        break;
      }
      case 'add-sector': {
        selectedSiteForSector = draftSite;
        showAddSectorModal = true;
        break;
      }
      case 'add-backhaul': {
        selectedSiteForBackhaul = draftSite;
        showAddBackhaulModal = true;
        break;
      }
      case 'add-inventory': {
        selectedSiteForInventory = draftSite;
        showAddInventoryModal = true;
        break;
      }
    }

    showPlanDraftMenu = false;
  }

  function handleSiteModalClose() {
    planDraftForSiteEdit = null;
    initialSiteType = null;
  }

  $: selectedPlanDraftCoords = getPlanDraftCoordinates(selectedPlanDraft);
  $: if (selectedPlanDraft) {
      const refreshedDraft = planDraftsForMap.find(feature => feature.id === selectedPlanDraft?.id) ?? null;
      if (!refreshedDraft) {
        selectedPlanDraft = null;
        showPlanDraftMenu = false;
      } else if (refreshedDraft !== selectedPlanDraft) {
        selectedPlanDraft = refreshedDraft;
      }
    }

  onMount(async () => {
    window.addEventListener('message', handleSharedMapMessage);

    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'coverage-map', type: 'request-state' }, '*');
    }

    if (tenantId) {
      await loadAllData();
    }
    isLoading = false;
  });
  
  onDestroy(() => {
    window.removeEventListener('message', handleSharedMapMessage);
  });
  
  // Watch for tenant changes and plan visibility changes
  $: if (browser && tenantId && mapMode) {
    loadAllData();
  }
  
  // Reload when plan visibility changes
  $: if (browser && planId !== null) {
    loadAllData();
  }
  
  let currentVisiblePlanIds: Set<string> = new Set();

  async function loadAllData() {
    if (!tenantId) {
      return;
    }

    isLoading = true;
    error = '';
    
    try {
      const { planService } = await import('$lib/services/planService');

      let plans: any[] = [];
      try {
        plans = await planService.getPlans(tenantId);
      } catch (planErr) {
        console.error('Failed to load plans:', planErr);
        plans = [];
      }

      currentVisiblePlanIds = new Set(
        plans
          .filter((p: any) => p.showOnMap)
          .map((p: any) => String(p.id || p._id))
      );
      visiblePlanIds = Array.from(currentVisiblePlanIds);
      if (planId) {
        visiblePlanIds = Array.from(new Set([...visiblePlanIds, planId]));
      }
      if (sharedActivePlanId) {
        visiblePlanIds = Array.from(new Set([...visiblePlanIds, sharedActivePlanId]));
      }

      if (isPlanMode && planId) {
        const activePlan = plans.find((p: any) => String(p.id || p._id) === planId);
        activePlanName = activePlan?.name || null;
        if (!sharedActivePlanId) {
          const addresses = activePlan?.marketing?.addresses;
          marketingLeads = Array.isArray(addresses) ? addresses : [];
        }
      } else {
        activePlanName = null;
        if (!sharedActivePlanId) {
          marketingLeads = [];
        }
      }

      const planIdsForFetch: string[] = [];
      if (isPlanMode && planId) {
        planIdsForFetch.push(planId);
      }
      if (!isPlanMode && currentVisiblePlanIds.size > 0) {
        planIdsForFetch.push(...Array.from(currentVisiblePlanIds));
      }

      const includePlanLayer = planIdsForFetch.length > 0;
      const fetchOptions = includePlanLayer ? { includePlanLayer: true, planIds: planIdsForFetch } : {};

      const [
        towersResult,
        sectorsResult,
        cpeResult,
        equipmentResult
      ] = await Promise.allSettled([
        coverageMapService.getTowerSites(tenantId, fetchOptions).catch(err => {
          console.error('Failed to load towers:', err);
          return [];
        }),
        coverageMapService.getSectors(tenantId, fetchOptions).catch(err => {
          console.error('Failed to load sectors:', err);
          return [];
        }),
        coverageMapService.getCPEDevices(tenantId, fetchOptions).catch(err => {
          console.error('Failed to load CPE:', err);
          return [];
        }),
        coverageMapService.getEquipment(tenantId, fetchOptions).catch(err => {
          console.error('Failed to load equipment:', err);
          return [];
        })
      ]);

      const loadedTowers = towersResult.status === 'fulfilled' ? towersResult.value : [];
      const loadedSectors = sectorsResult.status === 'fulfilled' ? sectorsResult.value : [];
      const loadedCPE = cpeResult.status === 'fulfilled' ? cpeResult.value : [];
      const loadedEquipment = equipmentResult.status === 'fulfilled' ? equipmentResult.value : [];

      const visiblePlanIdSet = new Set(planIdsForFetch);
      currentVisiblePlanIds.forEach(id => visiblePlanIdSet.add(id));

      towers = loadedTowers.filter((site: any) => {
        if (!site.planId) return true;
        if (isPlanMode && site.planId === planId) return true;
        return visiblePlanIdSet.has(site.planId);
      });

      sectors = loadedSectors.filter((sector: any) => {
        if (!sector.planId) return true;
        if (isPlanMode && sector.planId === planId) return true;
        return visiblePlanIdSet.has(sector.planId);
      });

      cpeDevices = loadedCPE.filter((cpe: any) => {
        if (!cpe.planId) return true;
        if (isPlanMode && cpe.planId === planId) return true;
        return visiblePlanIdSet.has(cpe.planId);
      });

      equipment = loadedEquipment.filter((eq: any) => {
        if (!eq.planId) return true;
        if (isPlanMode && eq.planId === planId) return true;
        return visiblePlanIdSet.has(eq.planId);
      });

    // console.log(`Loaded: ${towers.length} towers, ${sectors.length} sectors, ${cpeDevices.length} CPE, ${equipment.length} equipment (mode=${mapMode}, planIds=${Array.from(visiblePlanIds).join(',') || 'none'})`);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      error = err.message || 'Failed to load network data';
    } finally {
      isLoading = false;
    }
  }

  async function removePlanDraft() {
    if (!selectedPlanDraft) return;

    const activePlanId = effectivePlanId ?? selectedPlanDraft.planId ?? null;
    if (!activePlanId) {
      error = 'Select a plan to remove staged objects.';
      setTimeout(() => (error = ''), 4000);
      return;
    }

    try {
      await mapLayerManager.deleteFeature(activePlanId, selectedPlanDraft.id);
      success = 'Draft removed from plan.';
      setTimeout(() => (success = ''), 3000);
    } catch (err: any) {
      console.error('[CoverageMap] Failed to remove plan draft', err);
      error = err?.message || 'Failed to remove draft';
      setTimeout(() => (error = ''), 5000);
    } finally {
      showPlanDraftMenu = false;
      selectedPlanDraft = null;
    }
  }

  function closePlanDraftMenu() {
    showPlanDraftMenu = false;
    selectedPlanDraft = null;
  }
  
  function handleFiltersChange(event: CustomEvent<CoverageMapFilters>) {
    filters = event.detail;
  }
  
  function changeBasemap(basemapId: string) {
    currentBasemap = basemapId;
    if (mapComponent) {
      mapComponent.changeBasemap(basemapId);
    }
  }
  
  async function handleExportCSV() {
    const report = {
      towers,
      sectors,
      cpeDevices,
      equipment,
      generatedAt: new Date(),
      tenantName
    };
    
    const csv = reportGenerator.generateCSV(report);
    const filename = `network-equipment-${Date.now()}.csv`;
    reportGenerator.downloadCSV(csv, filename);
    
    success = 'Equipment report downloaded as CSV';
    setTimeout(() => success = '', 3000);
  }
  
  async function handleExportPDF() {
    const report = {
      towers,
      sectors,
      cpeDevices,
      equipment,
      generatedAt: new Date(),
      tenantName
    };
    
    const html = reportGenerator.generatePDFHTML(report);
    reportGenerator.printPDF(html);
    
    success = 'Opening PDF print dialog...';
    setTimeout(() => success = '', 3000);
  }
  
  async function handleImportFromCBRS() {
    const result = await coverageMapService.importFromCBRS(tenantId);
    if (result.errors.length > 0) {
      error = result.errors.join(', ');
    } else {
      success = `Imported ${result.imported} devices from CBRS module`;
      await loadAllData();
    }
    setTimeout(() => { error = ''; success = ''; }, 5000);
  }
  
  async function handleImportFromACS() {
    const result = await coverageMapService.importFromACS(tenantId);
    if (result.errors.length > 0) {
      error = result.errors.join(', ');
    } else {
      success = `Imported ${result.imported} devices from ACS module`;
      await loadAllData();
    }
    setTimeout(() => { error = ''; success = ''; }, 5000);
  }

  function handleSharedMapMessage(event: MessageEvent) {
    const { source, type, payload } = event.data || {};
    if (source !== 'shared-map' || type !== 'state-update') return;

    const state = payload?.state ?? {};

    sharedMapMode = payload?.mode ?? state.mode ?? null;
    sharedCapabilities = state.capabilities ?? sharedCapabilities;
    externalPlanFeatures = state.stagedFeatures ?? [];
    externalPlanSummary = state.stagedSummary ?? null;
    externalProductionHardware = state.productionHardware ?? [];
    sharedMapStateTimestamp = state.lastUpdated ? new Date(state.lastUpdated) : null;

    const activePlanIdFromState = state.activePlanId ?? null;
    if (activePlanIdFromState && activePlanIdFromState !== planId) {
      planId = activePlanIdFromState;
    }
    sharedActivePlanId = activePlanIdFromState;

    const inboundMarketing = state.activePlanMarketing?.addresses ?? [];
    marketingLeads = Array.isArray(inboundMarketing) ? inboundMarketing : [];
  }
  
  function handleMapRightClick(event: CustomEvent) {
    const { latitude, longitude, screenX, screenY } = event.detail;
    // console.log('Right-click at:', latitude, longitude);

    showPlanDraftMenu = false;
    selectedPlanDraft = null;

    if ((isPlanMode || sharedMapMode === 'plan') && !planEditingEnabled) {
      showContextMenu = false;
      if (!error) {
        error = 'Start a plan to add sites or hardware.';
        setTimeout(() => error = '', 4000);
      }
      return;
    }
    
    // Show context menu
    showContextMenu = true;
    contextMenuX = screenX;
    contextMenuY = screenY;
    contextMenuLat = latitude;
    contextMenuLon = longitude;
  }
  
  function handleContextMenuAction(event: CustomEvent) {
    const { action, latitude, longitude } = event.detail;
    
    contextMenuLat = latitude;
    contextMenuLon = longitude;

    if ((isPlanMode || sharedMapMode === 'plan') && !planEditingEnabled) {
      showContextMenu = false;
      return;
    }
    
    switch (action) {
      case 'create-site-tower':
        initialSiteType = 'tower';
        showAddSiteModal = true;
        break;
      case 'create-site-noc':
        initialSiteType = 'noc';
        showAddSiteModal = true;
        break;
      case 'create-site-warehouse':
        initialSiteType = 'warehouse';
        showAddSiteModal = true;
        break;
      case 'create-site-other':
        initialSiteType = 'other';
        showAddSiteModal = true;
        break;
      case 'create-sector':
        // Create sector at clicked location (need to select site first)
        // For now, just show add sector modal
        showAddSectorModal = true;
        break;
      case 'create-cpe':
        showAddCPEModal = true;
        break;
      case 'copy-coords':
        navigator.clipboard.writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        success = 'Coordinates copied to clipboard';
        setTimeout(() => success = '', 3000);
        break;
    }
    
    showContextMenu = false;
  }
  
  async function handlePlanFeatureMoved(event: CustomEvent<{
    featureId: string;
    planId?: string | null;
    geometry: PlanFeatureGeometry;
    latitude: number;
    longitude: number;
  }>) {
    const { featureId, planId: featurePlanId, geometry, latitude, longitude } = event.detail;
    const activePlanId = effectivePlanId ?? featurePlanId ?? null;

    if (!activePlanId) {
      error = 'Select a plan to edit staged objects.';
      setTimeout(() => (error = ''), 4000);
      return;
    }

    const draft = planDraftsForMap.find(feature => feature.id === featureId) ?? null;
    const propertiesUpdate = draft
      ? {
          ...draft.properties,
          latitude,
          longitude
        }
      : { latitude, longitude };

    const coordinates =
      Array.isArray((geometry as any)?.coordinates) && (geometry as any).coordinates.length >= 2
        ? (geometry as any).coordinates
        : [longitude, latitude];

    const geometryUpdate: PlanFeatureGeometry = {
      type: 'Point',
      coordinates
    };

    try {
      await mapLayerManager.updateFeature(activePlanId, featureId, {
        geometry: geometryUpdate,
        properties: propertiesUpdate
      });
      success = 'Draft location updated.';
      setTimeout(() => (success = ''), 3000);
      showPlanDraftMenu = false;
    } catch (err: any) {
      console.error('[CoverageMap] Failed to update plan draft location', err);
      error = err?.message || 'Failed to update draft location';
      setTimeout(() => (error = ''), 5000);
    }
  }

  function handleAssetClick(event: CustomEvent) {
    const { type, id, data, screenX, screenY, isRightClick } = event.detail;
    // console.log(`Clicked ${type}:`, id, data);

    if (!type?.startsWith('plan-')) {
      showPlanDraftMenu = false;
      selectedPlanDraft = null;
    }

    const planningMode = isPlanMode || sharedMapMode === 'plan';
    if (planningMode && !planEditingEnabled && isRightClick) {
      if (!error) {
        error = 'Start a plan to edit or deploy assets.';
        setTimeout(() => error = '', 4000);
      }
      return;
    }

    if (type?.startsWith('plan-')) {
      const draft = planDraftsForMap.find(feature => feature.id === id) ?? null;
      if (!draft) {
        return;
      }

      if (isRightClick) {
        selectedPlanDraft = draft;
        planDraftMenuX = screenX;
        planDraftMenuY = screenY;
        showPlanDraftMenu = true;
      } else {
        success = `${draft.featureType?.toUpperCase() ?? 'Draft'} selected`;
        setTimeout(() => (success = ''), 3000);
      }
      return;
    }
    
    // Check if this is a read-only item from ACS or CBRS
    if (data.modules?.acs || data.modules?.cbrs) {
      success = `This ${type} is managed by the ${data.modules.acs ? 'ACS' : 'CBRS'} module (read-only)`;
      setTimeout(() => success = '', 5000);
      return;
    }
    
    // Only show menu for right-clicks
    if (isRightClick) {
      // Handle all asset types - show actions menu
      if (type === 'tower' || type === 'noc' || type === 'warehouse') {
        const tower = towers.find(t => t.id === id);
        if (tower && tower.id) {
          // console.log('[CoverageMap] Opening tower actions menu', { tower, id, towerId: tower.id });
          selectedTowerForMenu = tower;
          towerMenuX = screenX;
          towerMenuY = screenY;
          showTowerActionsMenu = true;
        } else {
          console.error('[CoverageMap] Tower not found or missing id', { id, tower, towers });
        }
      } else if (type === 'sector') {
        const sector = sectors.find(s => s.id === id);
        if (sector) {
          success = `Sector: ${data.name || 'Unknown'} - Right-click for options`;
          setTimeout(() => success = '', 3000);
        }
      } else if (type === 'cpe') {
        const cpe = cpeDevices.find(c => c.id === id);
        if (cpe) {
          success = `CPE: ${data.name || 'Unknown'} - Right-click for options`;
          setTimeout(() => success = '', 3000);
        }
      } else if (type === 'equipment') {
        const eq = equipment.find(e => e.id === id);
        if (eq) {
          success = `Equipment: ${data.name || 'Unknown'} - Right-click for options`;
          setTimeout(() => success = '', 3000);
        }
      } else if (type === 'backhaul') {
        success = `Backhaul Link: ${data.name || 'Unknown'}`;
        setTimeout(() => success = '', 3000);
      }
    }
  }
  
  function handleTowerAction(event: CustomEvent) {
    const { action, tower } = event.detail;
    
    // console.log('[CoverageMap] handleTowerAction called', { action, tower });
    
    // Guard: ensure tower exists
    if (!tower && action !== 'add-site') {
      console.error('❌ Tower action called without tower');
      return;
    }
    
    switch (action) {
      case 'edit-site':
        if (tower) {
          selectedSiteForEdit = tower;
          showSiteEditModal = true;
        }
        break;
      case 'add-sector':
        selectedSiteForSector = tower;
        showAddSectorModal = true;
        break;
      case 'add-backhaul':
        selectedSiteForBackhaul = tower;
        showAddBackhaulModal = true;
        break;
      case 'add-inventory':
        selectedSiteForInventory = tower;
        showAddInventoryModal = true;
        break;
      case 'view-inventory':
        if (tower) {
          goto(`/modules/inventory?siteId=${tower.id}&siteName=${encodeURIComponent(tower.name)}`);
        }
        break;
      case 'deploy-hardware':
        if (!tower) {
          console.error('deploy-hardware action called without tower');
          return;
        }
        
        selectedTowerForEPC = tower;
        showHardwareDeploymentModal = true;
        break;
      case 'change-site-type':
        // Change site type via edit modal
        if (tower) {
          selectedSiteForEdit = tower;
          showSiteEditModal = true;
        }
        break;
      case 'view-details':
        if (tower) {
          success = `Viewing ${tower.name}`;
          setTimeout(() => success = '', 3000);
        }
        break;
      case 'delete-site':
        if (tower && confirm(`Delete ${tower.name}?`)) {
          deleteTowerSite(tower.id);
        }
        break;
    }
  }
  
  async function deleteTowerSite(siteId: string) {
    try {
      await coverageMapService.deleteTowerSite(tenantId, siteId);
      success = 'Tower site deleted';
      setTimeout(() => success = '', 3000);
      await loadAllData();
    } catch (err: any) {
      error = err.message || 'Failed to delete site';
      setTimeout(() => error = '', 5000);
    }
  }
  
  function handleAddSite() {
    planDraftForSiteEdit = null;
    contextMenuLat = DEFAULT_LATITUDE;
    contextMenuLon = DEFAULT_LONGITUDE;
    initialSiteType = null;
    showAddSiteModal = true;
  }
  
  function handleAddSector(site: TowerSite | null = null) {
    planDraftForSiteEdit = null;
    selectedSiteForSector = site;
    showAddSectorModal = true;
  }
  
  function handleAddCPE() {
    planDraftForSiteEdit = null;
    contextMenuLat = DEFAULT_LATITUDE;
    contextMenuLon = DEFAULT_LONGITUDE;
    showAddCPEModal = true;
  }
  
  async function handleModalSaved(event?: CustomEvent<{ message?: string }>) {
    success = event?.detail?.message || 'Changes saved to plan.';
    setTimeout(() => success = '', 3000);
    planDraftForSiteEdit = null;
    initialSiteType = null;

    try {
      if (effectivePlanId && (isPlanMode || sharedMapMode === 'plan')) {
        await mapLayerManager.refreshPlan(effectivePlanId);
      } else {
        await loadAllData();
      }
    } catch (err: any) {
      console.error('Error refreshing data after modal save:', err);
      error = err?.message || 'Unable to refresh map data.';
      setTimeout(() => error = '', 4000);
    }
  }
</script>

<svelte:window on:click={() => showPlanDraftMenu && closePlanDraftMenu()} />

<TenantGuard>
<div class="fullscreen-map">
  <!-- Full Screen Map -->
  {#if isLoading}
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p>Loading network assets...</p>
    </div>
  {:else}
    <CoverageMapView 
      bind:this={mapComponent}
      {towers}
      {sectors}
      {cpeDevices}
      {equipment}
      {filters}
      externalPlanFeatures={planDraftsForMap}
      {marketingLeads}
      on:map-right-click={handleMapRightClick}
      on:asset-click={handleAssetClick}
      on:plan-feature-moved={handlePlanFeatureMoved}
    />
  {/if}

  {#if showPlanDraftMenu && selectedPlanDraft}
    <div
      class="plan-draft-menu"
      style="left: {planDraftMenuX}px; top: {planDraftMenuY}px"
      on:click|stopPropagation
      on:contextmenu|preventDefault
    >
      <div class="menu-header">
        <strong>{selectedPlanDraft.properties?.name ?? selectedPlanDraft.featureType ?? 'Draft Object'}</strong>
        <small>Status: {selectedPlanDraft.status ?? 'draft'}</small>
      </div>
      <div class="menu-body">
        <p>Drag the marker to refine this deployment location.</p>
        <p class="coords">
          📍
          {selectedPlanDraftCoords.latitude !== null ? selectedPlanDraftCoords.latitude.toFixed(5) : '—'},
          {selectedPlanDraftCoords.longitude !== null ? selectedPlanDraftCoords.longitude.toFixed(5) : '—'}
        </p>
      </div>
      <button class="menu-item" on:click={() => handlePlanDraftMenuAction('edit-site')}>
        ✏️ Edit Draft Details
      </button>
      <button class="menu-item" on:click={() => handlePlanDraftMenuAction('add-sector')}>
        📶 Add Sector
      </button>
      <button class="menu-item" on:click={() => handlePlanDraftMenuAction('add-backhaul')}>
        🔗 Add Backhaul Link
      </button>
      <button class="menu-item" on:click={() => handlePlanDraftMenuAction('add-inventory')}>
        📦 Add Equipment
      </button>
      <button class="menu-item danger" on:click={removePlanDraft}>
        🗑️ Remove From Plan
      </button>
      <button class="menu-item" on:click={closePlanDraftMenu}>
        ✕ Close
      </button>
    </div>
  {/if}

  <!-- Floating Control Panel -->
  <div class="floating-controls">
    <button class="control-btn" on:click={() => goto('/dashboard')} title="Back to Dashboard">
      ←
    </button>
    <button class="control-btn" on:click={() => showFilters = !showFilters} title="Toggle Filters">
      🔍
    </button>
    <button class="control-btn" on:click={() => showStats = !showStats} title="Toggle Statistics">
      📊
    </button>
    <button class="control-btn main-menu-btn" on:click={() => showMainMenu = !showMainMenu} title="Main Menu">
      ☰
    </button>
  </div>

  {#if displayPlanSummary && (isPlanMode || sharedMapMode === 'plan' || sharedMapMode === 'deploy')}
    <div class="plan-summary-card">
      <div class="plan-summary-header">
        <span>Plan Drafts</span>
        {#if sharedMapStateTimestamp}
          <small>Updated {sharedMapStateTimestamp.toLocaleTimeString()}</small>
        {/if}
      </div>
      <div class="plan-summary-total">{displayPlanSummary.total} objects</div>
      <div class="plan-summary-grid">
        {#each Object.entries(displayPlanSummary.byType ?? {}) as [type, count]}
          <div class="plan-summary-item">
            <span class="label">{type}</span>
            <span class="value">{count}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}


  <!-- Main Menu Modal -->
  {#if showMainMenu}
  <div class="modal-overlay" on:click={() => showMainMenu = false}>
    <div class="modal-content main-menu-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>🗺️ Coverage Map Controls</h3>
        <button class="close-btn" on:click={() => showMainMenu = false}>✕</button>
      </div>
      
      <div class="modal-body">
        <!-- Basemap Switcher -->
        <div class="menu-section">
          <h4>🗺️ Map View</h4>
          <div class="basemap-switcher">
            <button 
              class="basemap-btn" 
              class:active={currentBasemap === 'streets-vector'}
              on:click={() => changeBasemap('streets-vector')}
            >
              🛣️ Streets
            </button>
            <button 
              class="basemap-btn" 
              class:active={currentBasemap === 'hybrid'}
              on:click={() => changeBasemap('hybrid')}
            >
              🛰️ Satellite
            </button>
            <button 
              class="basemap-btn" 
              class:active={currentBasemap === 'topo-vector'}
              on:click={() => changeBasemap('topo-vector')}
            >
              🗺️ Topographic
            </button>
          </div>
        </div>

        <!-- Add Equipment -->
        <div class="menu-section">
          <h4>➕ Add Equipment</h4>
          <div class="action-grid">
            <button class="action-btn" on:click={handleAddSite}>
              📡 Tower Site
            </button>
            <button class="action-btn" on:click={() => handleAddSector(null)}>
              📶 Sector
            </button>
            <button class="action-btn" on:click={handleAddCPE}>
              📱 CPE Device
            </button>
            <button class="action-btn" on:click={() => showAddNOCModal = true}>
              🏢 NOC
            </button>
            <button class="action-btn" on:click={() => showAddWarehouseModal = true}>
              🏭 Warehouse
            </button>
            <button class="action-btn" on:click={() => showAddVehicleModal = true}>
              🚛 Vehicle
            </button>
          </div>
        </div>

        <!-- Import/Export -->
        <div class="menu-section">
          <h4>📥 Import & Export</h4>
          <div class="action-grid">
            <button class="action-btn" on:click={handleImportFromCBRS}>
              📡 Import from CBRS
            </button>
            <button class="action-btn" on:click={handleImportFromACS}>
              📱 Import from ACS
            </button>
            <button class="action-btn" on:click={handleExportCSV}>
              📊 Export CSV
            </button>
            <button class="action-btn" on:click={handleExportPDF}>
              🖨️ Print PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  {/if}

  <!-- Filters Modal -->
  {#if showFilters}
  <div class="modal-overlay" on:click={() => showFilters = false}>
    <div class="modal-content filters-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>🔍 Map Filters</h3>
        <button class="close-btn" on:click={() => showFilters = false}>✕</button>
      </div>
      <div class="modal-body">
        <FilterPanel {filters} on:change={handleFiltersChange} />
      </div>
    </div>
  </div>
  {/if}

  <!-- Statistics Modal -->
  {#if showStats && !hideStats}
  <div class="modal-overlay" on:click={() => showStats = false}>
    <div class="modal-content stats-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>📊 Network Statistics</h3>
        <button class="close-btn" on:click={() => showStats = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📡</div>
            <div class="stat-content">
              <div class="stat-value">{towers.length}</div>
              <div class="stat-label">Tower Sites</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📶</div>
            <div class="stat-content">
              <div class="stat-value">{sectors.length}</div>
              <div class="stat-label">Sectors</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📱</div>
            <div class="stat-content">
              <div class="stat-value">{cpeDevices.length}</div>
              <div class="stat-label">CPE Devices</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">🔧</div>
            <div class="stat-content">
              <div class="stat-value">{equipment.length}</div>
              <div class="stat-label">Equipment</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  {/if}

  <!-- Messages -->
  {#if error}
    <div class="message-banner error">
      <span>⚠️</span>
      <span>{error}</span>
      <button class="dismiss-btn" on:click={() => error = ''}>✕</button>
    </div>
  {/if}
  
  {#if success}
    <div class="message-banner success">
      <span>✅</span>
      <span>{success}</span>
      <button class="dismiss-btn" on:click={() => success = ''}>✕</button>
    </div>
  {/if}
</div>

<!-- Modals -->
<AddSiteModal 
  bind:show={showAddSiteModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  initialType={initialSiteType}
  planId={effectivePlanId}
  {tenantId}
  existingDraft={planDraftForSiteEdit}
  on:saved={handleModalSaved}
  on:close={handleSiteModalClose}
/>

<AddNOCModal 
  bind:show={showAddNOCModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<AddWarehouseModal 
  bind:show={showAddWarehouseModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<AddVehicleModal 
  bind:show={showAddVehicleModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<AddRMAModal 
  bind:show={showAddRMAModal}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<AddSectorModal 
  bind:show={showAddSectorModal}
  sites={combinedSites}
  selectedSite={selectedSiteForSector}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<AddCPEModal 
  bind:show={showAddCPEModal}
  sites={combinedSites}
  initialLatitude={contextMenuLat}
  initialLongitude={contextMenuLon}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<AddBackhaulLinkModal 
  bind:show={showAddBackhaulModal}
  fromSite={selectedSiteForBackhaul}
  sites={combinedSites}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<AddInventoryModal 
  bind:show={showAddInventoryModal}
  site={selectedSiteForInventory}
  {tenantId}
  planId={effectivePlanId}
  on:saved={handleModalSaved}
/>

<!-- Context Menus -->
<MapContextMenu 
  bind:show={showContextMenu}
  x={contextMenuX}
  y={contextMenuY}
  latitude={contextMenuLat}
  longitude={contextMenuLon}
  planMode={isPlanMode || sharedMapMode === 'plan'}
  planName={activePlanName}
  disabled={(isPlanMode || sharedMapMode === 'plan') && !planEditingEnabled}
  on:action={handleContextMenuAction}
/>

<TowerActionsMenu 
  bind:show={showTowerActionsMenu}
  tower={selectedTowerForMenu}
  x={towerMenuX}
  y={towerMenuY}
  moduleContext={moduleContext}
  on:action={handleTowerAction}
/>

<!-- EPC Deployment Modal -->
<EPCDeploymentModal
  bind:show={showEPCDeploymentModal}
  tenantId={tenantId}
  siteData={selectedTowerForEPC}
  on:close={() => {
    showEPCDeploymentModal = false;
    selectedTowerForEPC = null;
  }}
/>

<!-- HSS Registration Modal -->
<HSSRegistrationModal
  bind:show={showHSSRegistrationModal}
  tenantId={tenantId}
  siteData={selectedTowerForEPC}
  on:close={() => {
    showHSSRegistrationModal = false;
    selectedTowerForEPC = null;
  }}
/>

<!-- Hardware Deployment Modal -->
<HardwareDeploymentModal
  bind:show={showHardwareDeploymentModal}
  tower={selectedTowerForEPC}
  {tenantId}
  on:close={() => {
    showHardwareDeploymentModal = false;
    selectedTowerForEPC = null;
  }}
  on:deploy-epc={(e) => {
    selectedTowerForEPC = e.detail;
    showHardwareDeploymentModal = false;
    showEPCDeploymentModal = true;
  }}
/>

<!-- Site Edit Modal -->
<SiteEditModal
  show={showSiteEditModal}
  site={selectedSiteForEdit}
  {tenantId}
  on:saved={handleModalSaved}
  on:close={() => {
    showSiteEditModal = false;
    selectedSiteForEdit = null;
  }}
/>

<!-- Global Settings Button -->
<SettingsButton />
</TenantGuard>

<style>
  .fullscreen-map {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background: #000;
    z-index: 1;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: white;
    z-index: 1000;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(255, 255, 255, 0.2);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .floating-controls {
    position: fixed;
    top: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 100;
  }

  .control-btn {
    width: 50px;
    height: 50px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }

  .control-btn:hover {
    background: rgba(124, 58, 237, 0.8);
    border-color: rgba(124, 58, 237, 0.5);
    transform: scale(1.1);
  }

  .main-menu-btn {
    background: rgba(124, 58, 237, 0.8);
    border-color: rgba(124, 58, 237, 0.5);
  }

  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }


  .modal-overlay {
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
    padding: 1rem;
  }

  .modal-content {
    background: var(--card-bg);
    border-radius: 12px;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 100%;
  }

  .main-menu-modal {
    width: 600px;
    max-width: calc(100vw - 2rem);
  }

  .filters-modal {
    width: 400px;
    max-width: calc(100vw - 2rem);
  }

  .stats-modal {
    width: 500px;
    max-width: calc(100vw - 2rem);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    margin: 0;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .menu-section {
    margin-bottom: 2rem;
  }

  .menu-section h4 {
    margin: 0 0 1rem 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .basemap-switcher {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .basemap-btn {
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
  }

  .basemap-btn:hover {
    background: var(--bg-hover);
  }

  .basemap-btn.active {
    background: var(--brand-primary);
    color: white;
    border-color: var(--brand-primary);
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .action-btn {
    padding: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    font-size: 0.875rem;
  }

  .action-btn:hover {
    background: var(--bg-hover);
    border-color: var(--brand-primary);
    transform: translateY(-2px);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .stat-icon {
    font-size: 2rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--brand-primary);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .message-banner {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 1rem 1.5rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    z-index: 1001;
    max-width: 500px;
    backdrop-filter: blur(10px);
  }

  .message-banner.error {
    background: rgba(239, 68, 68, 0.9);
    color: white;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .message-banner.success {
    background: rgba(34, 197, 94, 0.9);
    color: white;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .dismiss-btn {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    padding: 0.25rem;
    border-radius: 4px;
  }

  .dismiss-btn:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  .plan-summary-card {
    position: absolute;
    bottom: 2.5rem;
    right: 1rem;
    padding: 1rem;
    background: rgba(15, 23, 42, 0.88);
    border-radius: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    color: #e2e8f0;
    min-width: 220px;
    backdrop-filter: blur(12px);
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.35);
  }

  .plan-summary-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    font-weight: 600;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.75rem;
    color: #38bdf8;
  }

  .plan-summary-header small {
    font-weight: 400;
    color: rgba(226, 232, 240, 0.65);
  }

  .plan-summary-total {
    font-size: 1.65rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
    color: #f8fafc;
  }

  .plan-summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .plan-draft-menu {
    position: fixed;
    min-width: 260px;
    background: var(--card-bg, #0f172a);
    border: 1px solid rgba(59, 130, 246, 0.35);
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.4);
    z-index: 2200;
    overflow: hidden;
    color: var(--text-primary, #e2e8f0);
  }

  .plan-draft-menu .menu-header {
    padding: 0.75rem 1rem;
    background: rgba(59, 130, 246, 0.12);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .plan-draft-menu .menu-header strong {
    font-size: 0.95rem;
  }

  .plan-draft-menu .menu-header small {
    font-size: 0.75rem;
    color: rgba(148, 163, 184, 0.85);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .plan-draft-menu .menu-body {
    padding: 0.75rem 1rem;
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--text-secondary, #cbd5f5);
  }

  .plan-draft-menu .menu-body .coords {
    margin-top: 0.5rem;
    font-family: monospace;
    color: rgba(129, 140, 248, 0.9);
  }

  .plan-draft-menu .menu-item {
    width: 100%;
    background: transparent;
    border: none;
    text-align: left;
    padding: 0.75rem 1rem;
    color: inherit;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .plan-draft-menu .menu-item:hover {
    background: rgba(59, 130, 246, 0.18);
  }

  .plan-draft-menu .menu-item.danger {
    color: #fca5a5;
  }

  .plan-draft-menu .menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.18);
  }

  .plan-summary-item {
    padding: 0.5rem 0.6rem;
    background: rgba(30, 41, 59, 0.85);
    border-radius: 0.5rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
  }

  .plan-summary-item .label {
    display: block;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(148, 163, 184, 0.85);
  }

  .plan-summary-item .value {
    font-size: 1.1rem;
    font-weight: 600;
    color: #f8fafc;
  }

  @media (max-width: 768px) {
    .floating-controls {
      display: none;
    }
    
    .control-btn {
      width: 48px;
      height: 48px;
      font-size: 1.25rem;
      min-height: 48px;
      min-width: 48px;
    }
    
    .coverage-map-page {
      height: 100vh;
      height: 100dvh; /* Dynamic viewport height for mobile */
    }
    
    .map-container {
      touch-action: pan-x pan-y;
    }
    
    .filter-panel {
      max-height: 70vh;
      overflow-y: auto;
    }
    
    .filter-panel button {
      min-height: 44px;
      padding: 12px 16px;
      font-size: 16px;
    }
    
    .modal-overlay {
      padding: 0.5rem;
      align-items: flex-start;
      padding-top: 2rem;
    }
    
    .modal-content {
      max-height: calc(100vh - 4rem);
      margin: 0;
    }
    
    .main-menu-modal,
    .filters-modal,
    .stats-modal {
      width: 100%;
      max-width: calc(100vw - 1rem);
    }
    
    .modal-header {
      padding: 1rem;
      position: sticky;
      top: 0;
      background: var(--card-bg);
      border-bottom: 1px solid var(--border-color);
      z-index: 10;
    }
    
    .modal-body {
      padding: 1rem;
    }
    
    .action-grid {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
    
    .action-btn {
      min-height: 48px;
      padding: 12px 16px;
      font-size: 16px;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .basemap-switcher {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
    
    .basemap-btn {
      min-height: 48px;
      padding: 12px 16px;
      font-size: 16px;
    }
    
    .stats-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
    
    .stat-card {
      padding: 1rem;
    }
    
    .message-banner {
      left: 1rem;
      right: 1rem;
      transform: none;
      max-width: none;
      bottom: 80px; /* Above mobile controls */
    }
    
    /* Improve touch targets */
    .close-btn {
      min-height: 44px;
      min-width: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* Better spacing for mobile */
    .modal-body {
      padding-bottom: 2rem; /* Extra space for mobile controls */
    }
    
    /* Prevent zoom on input focus */
    input, select, textarea {
      font-size: 16px;
    }

    .plan-summary-card {
      position: static;
      margin: 0.75rem;
      min-width: unset;
    }
    .plan-summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>