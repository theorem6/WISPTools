<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  export let cpeDevices: any[] = [];
  
  const dispatch = createEventDispatcher();
  let mapContainer: HTMLDivElement;
  let map: any = null;

  onMount(async () => {
    await initializeMap();
  });

  onDestroy(() => {
    if (map) {
      map.remove();
    }
  });

  async function initializeMap() {
    try {
      console.log('Initializing ArcGIS map...');
      
      // Import ArcGIS modules
      const [
        { default: Map },
        { default: MapView },
        { default: GraphicsLayer },
        { default: BasemapGallery },
        { default: Expand },
        esriConfig
      ] = await Promise.all([
        import('@arcgis/core/Map.js'),
        import('@arcgis/core/views/MapView.js'),
        import('@arcgis/core/layers/GraphicsLayer.js'),
        import('@arcgis/core/widgets/BasemapGallery.js'),
        import('@arcgis/core/widgets/Expand.js'),
        import('@arcgis/core/config.js')
      ]);

      // Set up ArcGIS API key (if you have one)
      const arcgisApiKey = import.meta.env.PUBLIC_ARCGIS_API_KEY || '';
      esriConfig.default.apiKey = arcgisApiKey;

      // Create graphics layer for CPE markers
      const graphicsLayer = new GraphicsLayer();

      // Create map
      const newMap = new Map({
        basemap: 'streets-navigation-vector',
        layers: [graphicsLayer]
      });

      // Create view
      const view = new MapView({
        container: mapContainer,
        map: newMap,
        center: [-98.5795, 39.8283], // Center of USA
        zoom: 4,
        navigation: {
          mouseWheelZoomEnabled: true // Re-enable mouse wheel zoom
        },
        popup: {
          dockEnabled: true,
          dockOptions: {
            buttonEnabled: false,
            breakpoint: false
          }
        }
      });

      // Add basemap gallery widget
      const basemapGallery = new BasemapGallery({
        view: view
      });

      const bgExpand = new Expand({
        view: view,
        content: basemapGallery,
        expanded: false
      });

      view.ui.add(bgExpand, 'top-right');

      // Require modifier key (Ctrl/Cmd) for mouse wheel zoom to prevent accidental zooming
      // Mac-specific: Handle trackpad vs mouse differently
      await view.when();
      if (view.container) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                      navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
        
        view.container.addEventListener('wheel', (event: WheelEvent) => {
          const hasModifier = event.ctrlKey || event.metaKey;
          const isSmoothScroll = Math.abs(event.deltaY) < 10 && event.deltaMode === 0;
          const isPinchGesture = event.ctrlKey && Math.abs(event.deltaY) > 0;
          
          // On Mac: allow pinch-to-zoom and trackpad panning
          if (isMac) {
            if (hasModifier || isPinchGesture) {
              // Intentional zoom gesture - allow it
              return;
            }
            if (isSmoothScroll && !hasModifier) {
              // Mac trackpad panning - allow default behavior
              return;
            }
          }
          
          // Prevent zoom if no modifier key is pressed
          if (!hasModifier) {
            event.preventDefault();
            event.stopPropagation();
          }
        }, { passive: false });
      }

      // Handle click on markers - navigate to monitoring page
      view.on('click', (event) => {
        view.hitTest(event).then((response) => {
          if (response.results.length > 0) {
            const graphicHit = response.results.find((result) => (result as any)?.graphic?.attributes?.device);
            const attributes = (graphicHit as any)?.graphic?.attributes as Record<string, unknown> | undefined;
            const device = attributes?.device as { id?: string } | undefined;
            if (device?.id) {
              window.location.href = `/modules/acs-cpe-management/monitoring?deviceId=${device.id}`;
            }
          }
        });
      });

      // Store references
      map = {
        _map: newMap,
        _view: view,
        _graphicsLayer: graphicsLayer,
        remove: () => {
          view.destroy();
          newMap.destroy();
        }
      };

      console.log('ArcGIS map initialized successfully');
      
      // Add markers if devices already loaded
      if (cpeDevices.length > 0) {
        await addCPEMarkers();
      }
    } catch (err) {
      console.error('Failed to initialize ArcGIS map:', err);
      throw err;
    }
  }

  async function addCPEMarkers() {
    if (!map || !map._view) return;

    try {
      // Import ArcGIS modules
      const [
        { default: Graphic },
        { default: Point },
        { default: SimpleMarkerSymbol }
      ] = await Promise.all([
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/geometry/Point.js'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol.js')
      ]);

      // Clear existing graphics
      map._graphicsLayer.removeAll();

      // Add markers for each CPE device
      cpeDevices.forEach(device => {
        if (device.location) {
          // Create symbol based on status
          const symbol = new SimpleMarkerSymbol({
            style: 'circle',
            color: device.status === 'Online' ? '#10b981' : '#ef4444',
            size: '16px',
            outline: {
              color: 'white',
              width: 2
            }
          });

          // Create point geometry
          const point = new Point({
            longitude: device.location.longitude,
            latitude: device.location.latitude
          });

          // Create graphic
          const graphic = new Graphic({
            geometry: point,
            symbol: symbol,
            attributes: {
              id: device.id,
              manufacturer: device.manufacturer,
              status: device.status,
              location: `${device.location.latitude.toFixed(4)}, ${device.location.longitude.toFixed(4)}`,
              lastContact: device.lastContact ? new Date(device.lastContact).toLocaleString() : 'Unknown',
              device: device
            }
          });

          map._graphicsLayer.add(graphic);
        }
      });

      // Fit map to show all markers if we have devices
      if (cpeDevices.length > 0 && map._view && map._graphicsLayer.graphics.length > 0) {
        try {
          // Wait for view to be ready before animating
          await map._view.when();
          await map._view.goTo({
            target: map._graphicsLayer.graphics,
            padding: 50
          });
        } catch (goToError) {
          console.warn('Could not animate to markers, skipping:', goToError);
        }
      }

      console.log(`Added ${cpeDevices.length} CPE markers to ArcGIS map`);
    } catch (err) {
      console.error('Failed to add CPE markers:', err);
    }
  }

  // Reactive statement to update markers when devices change
  $: if (map && cpeDevices) {
    addCPEMarkers();
  }
</script>

<div class="map-container" bind:this={mapContainer}></div>

<style>
  .map-container {
    width: 100%;
    height: 600px;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
</style>

