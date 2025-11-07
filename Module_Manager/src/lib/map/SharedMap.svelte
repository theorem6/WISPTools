<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { mapContext } from './mapContext';
  import type { MapModuleMode } from './MapCapabilities';
  import type { MapLayerState } from './mapContext';
  import type { HardwareView, PlanLayerFeature } from '$lib/services/planService';

  export let mode: MapModuleMode = 'plan';

  let mapContainer: HTMLDivElement | null = null;
  let mapReady = false;
  let initializing = true;
  let state: MapLayerState = get(mapContext);
  let unsubscribe: (() => void) | undefined;
  let view: __esri.MapView | null = null;
  let productionLayer: __esri.GraphicsLayer | null = null;
  let planLayer: __esri.GraphicsLayer | null = null;
  let lastExtentUpdate = 0;

  let modulesLoaded = false;
  let ArcGIS: {
    Map: typeof import('@arcgis/core/Map').default;
    MapView: typeof import('@arcgis/core/views/MapView').default;
    GraphicsLayer: typeof import('@arcgis/core/layers/GraphicsLayer').default;
    Graphic: typeof import('@arcgis/core/Graphic').default;
    Point: typeof import('@arcgis/core/geometry/Point').default;
    Polyline: typeof import('@arcgis/core/geometry/Polyline').default;
    Polygon: typeof import('@arcgis/core/geometry/Polygon').default;
    SimpleMarkerSymbol: typeof import('@arcgis/core/symbols/SimpleMarkerSymbol').default;
    SimpleLineSymbol: typeof import('@arcgis/core/symbols/SimpleLineSymbol').default;
    SimpleFillSymbol: typeof import('@arcgis/core/symbols/SimpleFillSymbol').default;
  } | null = null;

  const productionColors: Record<string, string> = {
    tower: '#38bdf8',
    sector: '#a855f7',
    cpe: '#f97316',
    equipment: '#facc15',
    backhaul: '#22c55e',
    default: '#94a3b8'
  };

  const planColors: Record<string, string> = {
    site: '#ef4444',
    sector: '#fb923c',
    cpe: '#ec4899',
    equipment: '#84cc16',
    link: '#22d3ee',
    note: '#fbbf24',
    default: '#f97316'
  };

  const loadModules = async () => {
    if (modulesLoaded && ArcGIS) return;
    const [
      MapMod,
      MapViewMod,
      GraphicsLayerMod,
      GraphicMod,
      PointMod,
      PolylineMod,
      PolygonMod,
      SimpleMarkerSymbolMod,
      SimpleLineSymbolMod,
      SimpleFillSymbolMod
    ] = await Promise.all([
      import('@arcgis/core/Map'),
      import('@arcgis/core/views/MapView'),
      import('@arcgis/core/layers/GraphicsLayer'),
      import('@arcgis/core/Graphic'),
      import('@arcgis/core/geometry/Point'),
      import('@arcgis/core/geometry/Polyline'),
      import('@arcgis/core/geometry/Polygon'),
      import('@arcgis/core/symbols/SimpleMarkerSymbol'),
      import('@arcgis/core/symbols/SimpleLineSymbol'),
      import('@arcgis/core/symbols/SimpleFillSymbol')
    ]);

    ArcGIS = {
      Map: MapMod.default,
      MapView: MapViewMod.default,
      GraphicsLayer: GraphicsLayerMod.default,
      Graphic: GraphicMod.default,
      Point: PointMod.default,
      Polyline: PolylineMod.default,
      Polygon: PolygonMod.default,
      SimpleMarkerSymbol: SimpleMarkerSymbolMod.default,
      SimpleLineSymbol: SimpleLineSymbolMod.default,
      SimpleFillSymbol: SimpleFillSymbolMod.default
    };
    modulesLoaded = true;
  };

  const initialiseMap = async () => {
    if (!mapContainer) return;
    await loadModules();
    if (!ArcGIS) return;

    const { Map, MapView, GraphicsLayer } = ArcGIS;
    productionLayer = new GraphicsLayer({ id: 'production-layer' });
    planLayer = new GraphicsLayer({ id: 'plan-layer' });

    const map = new Map({
      basemap: 'dark-gray-vector',
      layers: [productionLayer, planLayer]
    });

    view = new MapView({
      container: mapContainer,
      map,
      center: [-98.5, 39.8],
      zoom: 5,
      constraints: {
        minZoom: 3,
        snapToZoom: true
      },
      popup: {
        dockEnabled: true,
        dockOptions: {
          breakpoint: false,
          position: 'auto'
        }
      }
    });

    await view.when();
    mapReady = true;
    initializing = false;
    renderState(state, true);
  };

  const colorForProduction = (type: string) => productionColors[type] ?? productionColors.default;
  const colorForPlan = (type: string) => planColors[type] ?? planColors.default;

  const ensurePoint = (lon?: number, lat?: number) => {
    if (!ArcGIS || lon === undefined || lat === undefined || Number.isNaN(lon) || Number.isNaN(lat)) {
      return null;
    }
    return new ArcGIS.Point({ longitude: lon, latitude: lat });
  };

  const createGeometry = (feature: PlanLayerFeature) => {
    if (!ArcGIS) return null;
    const { geometry } = feature;
    if (!geometry) {
      const loc = feature.properties?.location || feature.properties?.coordinates;
      if (Array.isArray(loc) && loc.length >= 2) {
        return ensurePoint(loc[0], loc[1]);
      }
      if (loc?.longitude !== undefined && loc?.latitude !== undefined) {
        return ensurePoint(loc.longitude, loc.latitude);
      }
      return null;
    }

    if (geometry.type === 'Point') {
      const [lon, lat] = geometry.coordinates as [number, number];
      return ensurePoint(lon, lat);
    }

    if (geometry.type === 'LineString') {
      return new ArcGIS.Polyline({ paths: [geometry.coordinates] });
    }

    if (geometry.type === 'Polygon') {
      return new ArcGIS.Polygon({ rings: geometry.coordinates });
    }

    return null;
  };

  const renderState = (nextState: MapLayerState, forceExtent = false) => {
    if (!ArcGIS || !mapReady || !productionLayer || !planLayer) return;

    productionLayer.removeAll();
    planLayer.removeAll();

    nextState.productionHardware?.forEach((item: HardwareView) => {
      const point = ensurePoint(item.location?.longitude, item.location?.latitude);
      if (!point) return;

      const symbol = new ArcGIS.SimpleMarkerSymbol({
        style: 'circle',
        color: colorForProduction(item.type),
        size: 8,
        outline: {
          color: '#0f172a',
          width: 1
        }
      });

      const graphic = new ArcGIS.Graphic({
        geometry: point,
        symbol,
        attributes: {
          id: item.id,
          name: item.name,
          type: item.type,
          status: item.status,
          module: item.module
        },
        popupTemplate: {
          title: '{name}',
          content: `Type: {type}<br>Status: {status}<br>Module: {module}`
        }
      });

      productionLayer?.add(graphic);
    });

    nextState.stagedFeatures?.forEach((feature: PlanLayerFeature) => {
      const geometry = createGeometry(feature);
      if (!geometry) return;

      let graphic: __esri.Graphic | null = null;
      const color = colorForPlan(feature.featureType);

      if (geometry.type === 'point') {
        const symbol = new ArcGIS.SimpleMarkerSymbol({
          style: 'diamond',
          color,
          size: 12,
          outline: {
            color: '#1e293b',
            width: 1.5
          }
        });
        graphic = new ArcGIS.Graphic({ geometry, symbol });
      } else if (geometry.type === 'polyline') {
        const symbol = new ArcGIS.SimpleLineSymbol({
          color,
          width: 2,
          style: 'dash'
        });
        graphic = new ArcGIS.Graphic({ geometry, symbol });
      } else if (geometry.type === 'polygon') {
        const symbol = new ArcGIS.SimpleFillSymbol({
          color: `${color}55`,
          outline: {
            color,
            width: 1.5
          }
        });
        graphic = new ArcGIS.Graphic({ geometry, symbol });
      }

      if (!graphic) return;

      graphic.attributes = {
        id: feature.id,
        type: feature.featureType,
        status: feature.status,
        name: feature.properties?.name || feature.properties?.label || feature.featureType
      };

      graphic.popupTemplate = {
        title: '{name}',
        content: `Type: {type}<br>Status: {status}`
      };

      planLayer?.add(graphic);
    });

    const shouldAdjust = forceExtent || Date.now() - lastExtentUpdate > 4000;
    if (shouldAdjust && view && (productionLayer.graphics.length || planLayer.graphics.length)) {
      const graphics = [
        ...productionLayer.graphics.toArray(),
        ...planLayer.graphics.toArray()
      ].filter(Boolean);
      if (graphics.length > 0) {
        view.goTo(graphics, { duration: 800, easing: 'ease' }).catch(() => undefined);
        lastExtentUpdate = Date.now();
      }
    }
  };

  onMount(async () => {
    unsubscribe = mapContext.subscribe((next) => {
      state = next;
      if (mapReady) {
        renderState(next);
      }
    });

    await initialiseMap();
  });

  onDestroy(() => {
    unsubscribe?.();
    if (view) {
      view.destroy();
      view = null;
    }
    productionLayer = null;
    planLayer = null;
    mapReady = false;
  });
</script>

<div class="shared-map">
  <div class="map-surface" bind:this={mapContainer}></div>

  {#if initializing || state.isLoading}
    <div class="shared-map__loading">
      <div class="spinner" />
      <span>{initializing ? 'Initializing map…' : 'Loading map data…'}</span>
    </div>
  {/if}

  {#if state.error}
    <div class="shared-map__error-banner">
      {state.error}
    </div>
  {/if}
</div>

<style>
  .shared-map {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: var(--border-radius-lg);
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.15);
    background: var(--bg-primary, #0f172a);
  }

  .map-surface {
    position: absolute;
    inset: 0;
  }

  .shared-map__loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 64, 175, 0.78));
    color: #e2e8f0;
    font-weight: 500;
    letter-spacing: 0.02em;
    z-index: 10;
    text-transform: uppercase;
  }

  .shared-map__error-banner {
    position: absolute;
    left: 50%;
    bottom: 20px;
    transform: translateX(-50%);
    background: rgba(239, 68, 68, 0.95);
    color: #f8fafc;
    padding: 0.6rem 1.2rem;
    border-radius: var(--border-radius-md);
    font-weight: 600;
    box-shadow: 0 12px 30px rgba(239, 68, 68, 0.35);
    z-index: 11;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid rgba(148, 163, 184, 0.3);
    border-top-color: #38bdf8;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
