<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import type { TowerSite, Sector, CPEDevice, NetworkEquipment, CoverageMapFilters } from '../lib/models';
  import type { PlanLayerFeature } from '$lib/services/planService';
  import { CoverageMapController } from '../lib/arcgisMapController';

  export let towers: TowerSite[] = [];
  export let sectors: Sector[] = [];
  export let cpeDevices: CPEDevice[] = [];
  export let equipment: NetworkEquipment[] = [];
  export let filters: CoverageMapFilters;
  export let externalPlanFeatures: PlanLayerFeature[] = [];
export let planId: string | null = null;
export let isPlanMode = false;

  const dispatch = createEventDispatcher();

  let mapContainer: HTMLDivElement;
  let mapView: any = null;
  let controller: CoverageMapController | null = null;

  onMount(async () => {
    controller = new CoverageMapController((event, detail) => dispatch(event, detail));
    const { mapView: view } = await controller.initialize({
      container: mapContainer,
      filters,
      towers,
      sectors,
      cpeDevices,
      equipment,
      externalPlanFeatures
    });
    mapView = view;
  });

  onDestroy(() => {
    controller?.destroy();
    controller = null;
    mapView = null;
  });

  $: controller && controller.setData({ towers, sectors, cpeDevices, equipment });
  $: controller && controller.setFilters(filters);
  $: controller && controller.setPlanFeatures(externalPlanFeatures);

  export function changeBasemap(basemapId: string) {
    controller?.changeBasemap(basemapId);
  }
</script>

<div class="coverage-map-container">
  <div bind:this={mapContainer} class="map-container"></div>
  <arcgis-basemap-toggle view={mapView}></arcgis-basemap-toggle>
</div>

<style>
  .coverage-map-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .map-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  /* Mobile-specific styles */
  @media (max-width: 768px) {
    .coverage-map-container {
      height: 100vh;
      height: 100dvh; /* Dynamic viewport height for mobile */
    }
    
    .map-container {
      touch-action: pan-x pan-y; /* Enable touch scrolling */
    }
    
    /* Larger touch targets for ArcGIS widgets */
    :global(.esri-zoom__button) {
      min-height: 44px !important;
      min-width: 44px !important;
      font-size: 18px !important;
    }
    
    :global(.esri-basemap-toggle) {
      min-height: 44px !important;
      min-width: 44px !important;
    }
    
    :global(.esri-locate) {
      min-height: 44px !important;
      min-width: 44px !important;
    }
    
    :global(.esri-compass) {
      min-height: 44px !important;
      min-width: 44px !important;
    }
    
    /* Mobile popup styling */
    :global(.esri-popup) {
      max-width: 90vw !important;
      max-height: 60vh !important;
      font-size: 16px !important; /* Prevent zoom on iOS */
    }
    
    :global(.esri-popup__content) {
      font-size: 16px !important; /* Prevent zoom on iOS */
      padding: 12px !important;
    }
    
    :global(.esri-popup__header) {
      font-size: 18px !important;
      padding: 12px !important;
    }
    
    :global(.esri-popup__button) {
      min-height: 44px !important;
      padding: 12px 16px !important;
      font-size: 16px !important;
    }
    
    /* Mobile context menu */
    :global(.context-menu) {
      min-width: 200px !important;
      font-size: 16px !important;
    }
    
    :global(.context-menu button) {
      min-height: 44px !important;
      padding: 12px 16px !important;
      font-size: 16px !important;
    }
    
    /* Mobile floating controls */
    :global(.floating-controls) {
      top: 10px !important;
      right: 10px !important;
      gap: 8px !important;
    }
    
    :global(.floating-controls button) {
      min-height: 44px !important;
      min-width: 44px !important;
      font-size: 18px !important;
    }
    
    /* Mobile filter panel */
    :global(.filter-panel) {
      max-height: 70vh !important;
      overflow-y: auto !important;
    }
    
    :global(.filter-panel button) {
      min-height: 44px !important;
      padding: 12px 16px !important;
      font-size: 16px !important;
    }
    
    /* Mobile modal adjustments */
    :global(.modal) {
      margin: 10px !important;
      max-width: calc(100vw - 20px) !important;
      max-height: calc(100vh - 20px) !important;
    }
    
    :global(.modal-content) {
      padding: 16px !important;
    }
    
    :global(.modal button) {
      min-height: 44px !important;
      padding: 12px 16px !important;
      font-size: 16px !important;
    }
  }

  /* Tablet-specific styles */
  @media (min-width: 769px) and (max-width: 1024px) {
    .coverage-map-container {
      height: 100vh;
    }
    
    :global(.esri-zoom__button) {
      min-height: 40px !important;
      min-width: 40px !important;
    }
    
    :global(.esri-popup) {
      max-width: 400px !important;
    }
  }

  /* High DPI mobile screens */
  @media (max-width: 768px) and (-webkit-min-device-pixel-ratio: 2) {
    :global(.esri-zoom__button),
    :global(.esri-basemap-toggle),
    :global(.esri-locate),
    :global(.esri-compass) {
      border-width: 0.5px !important;
    }
  }

  /* Landscape mobile orientation */
  @media (max-width: 768px) and (orientation: landscape) {
    .coverage-map-container {
      height: 100vh;
      height: 100dvh;
    }
    
    :global(.esri-popup) {
      max-height: 50vh !important;
    }
  }

  /* Prevent text selection on mobile */
  @media (max-width: 768px) {
    .map-container {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
    }
  }

  /* Accessibility improvements for mobile */
  @media (max-width: 768px) {
    :global(.esri-zoom__button:focus),
    :global(.esri-basemap-toggle:focus),
    :global(.esri-locate:focus),
    :global(.esri-compass:focus) {
      outline: 3px solid var(--primary-color) !important;
      outline-offset: 2px !important;
    }
  }
</style>
