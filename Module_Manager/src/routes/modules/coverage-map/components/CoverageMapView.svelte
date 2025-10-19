<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import type { TowerSite, Sector, CPEDevice, NetworkEquipment, CoverageMapFilters } from '../lib/models';

  export let towers: TowerSite[] = [];
  export let sectors: Sector[] = [];
  export let cpeDevices: CPEDevice[] = [];
  export let equipment: NetworkEquipment[] = [];
  export let filters: CoverageMapFilters;

  const dispatch = createEventDispatcher();
  
  let mapContainer: HTMLDivElement;
  let map: any = null;
  let mapView: any = null;
  let graphicsLayer: any = null;
  let backhaulLayer: any = null;
  let currentBasemap = 'streets-navigation-vector';
  
  // Extract backhaul links from equipment
  $: backhaulLinks = equipment.filter(eq => {
    if (eq.type !== 'backhaul') return false;
    try {
      const notes = JSON.parse(eq.notes || '{}');
      return notes.fromSiteId && notes.toSiteId;
    } catch {
      return false;
    }
  });

  onMount(async () => {
    await initializeMap();
  });

  onDestroy(() => {
    if (mapView) {
      mapView.destroy();
    }
    if (map) {
      map.destroy();
    }
  });

  async function initializeMap() {
    try {
      console.log('Initializing Coverage Map with ArcGIS...');
      
      // Import ArcGIS modules
      const [
        { default: Map },
        { default: MapView },
        { default: GraphicsLayer },
        { default: esriConfig }
      ] = await Promise.all([
        import('@arcgis/core/Map.js'),
        import('@arcgis/core/views/MapView.js'),
        import('@arcgis/core/layers/GraphicsLayer.js'),
        import('@arcgis/core/config.js')
      ]);

      // Set API key if available
      if (import.meta.env.PUBLIC_ARCGIS_API_KEY) {
        esriConfig.default.apiKey = import.meta.env.PUBLIC_ARCGIS_API_KEY;
      }

      // Create graphics layers
      backhaulLayer = new GraphicsLayer({ title: 'Backhaul Links' });
      graphicsLayer = new GraphicsLayer({ title: 'Network Assets' });

      // Create map (backhaul layer first so it renders underneath)
      map = new Map({
        basemap: currentBasemap,
        layers: [backhaulLayer, graphicsLayer]
      });

      // Create view
      mapView = new MapView({
        container: mapContainer,
        map: map,
        center: [-98.5795, 39.8283], // Center of USA
        zoom: 5,
        popup: {
          dockEnabled: true,
          dockOptions: {
            buttonEnabled: false,
            breakpoint: false
          }
        }
      });

      // Add click handler for map interactions
      mapView.on('click', handleMapClick);
      
      // Add right-click handler for adding equipment
      mapView.on('pointer-move', (event: any) => {
        event.stopPropagation();
      });

      // Disable default right-click context menu
      mapView.container.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
      });
      
      // Listen for right-click
      mapView.on('pointer-down', (event: any) => {
        if (event.button === 2) { // Right mouse button
          const point = mapView.toMap(event);
          dispatch('map-right-click', {
            latitude: point.latitude,
            longitude: point.longitude,
            screenX: event.x,
            screenY: event.y
          });
        }
      });

      await mapView.when();
      console.log('Coverage Map initialized');
      
      // Render all assets
      await renderAllAssets();
    } catch (err) {
      console.error('Failed to initialize Coverage Map:', err);
      throw err;
    }
  }

  async function renderAllAssets() {
    if (!graphicsLayer || !mapView) return;

    try {
      const [
        { default: Graphic },
        { default: Point },
        { default: Polygon },
        { default: SimpleMarkerSymbol },
        { default: SimpleFillSymbol },
        { default: SimpleLineSymbol },
        { default: TextSymbol }
      ] = await Promise.all([
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/geometry/Point.js'),
        import('@arcgis/core/geometry/Polygon.js'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol.js'),
        import('@arcgis/core/symbols/SimpleFillSymbol.js'),
        import('@arcgis/core/symbols/SimpleLineSymbol.js'),
        import('@arcgis/core/symbols/TextSymbol.js')
      ]);

      graphicsLayer.removeAll();
      if (backhaulLayer) backhaulLayer.removeAll();
      
      // Render backhaul links first (so they appear under other assets)
      if (filters.showBackhaul && backhaulLinks.length > 0 && backhaulLayer) {
        await renderBackhaulLinks();
      }
      
      // Render towers
      if (filters.showTowers) {
        towers.forEach(tower => {
          const symbol = new SimpleMarkerSymbol({
            style: 'circle',
            color: getTowerColor(tower.type),
            size: '20px',
            outline: {
              color: 'white',
              width: 3
            }
          });

          const point = new Point({
            longitude: tower.location.longitude,
            latitude: tower.location.latitude
          });

          const graphic = new Graphic({
            geometry: point,
            symbol: symbol,
            attributes: {
              type: 'tower',
              id: tower.id,
              name: tower.name,
              ...tower
            },
            popupTemplate: {
              title: '{name}',
              content: createTowerPopupContent
            }
          });

          graphicsLayer.add(graphic);
        });
      }

      // Render sectors with directional cones
      if (filters.showSectors) {
        const filteredSectors = filterSectorsByBand(sectors);
        
        filteredSectors.forEach(sector => {
          // Create sector cone polygon
          const sectorPolygon = createSectorCone(
            sector.location.latitude,
            sector.location.longitude,
            sector.azimuth,
            sector.beamwidth,
            0.01 // ~1km radius
          );

          const color = getBandColor(sector.band || sector.technology);
          
          const fillSymbol = new SimpleFillSymbol({
            color: [...hexToRgb(color), 0.4],
            outline: {
              color: color,
              width: 2
            }
          });

          const graphic = new Graphic({
            geometry: sectorPolygon,
            symbol: fillSymbol,
            attributes: {
              type: 'sector',
              id: sector.id,
              ...sector
            },
            popupTemplate: {
              title: '{name}',
              content: createSectorPopupContent
            }
          });

          graphicsLayer.add(graphic);
        });
      }

      // Render CPE devices with 30-degree directional cones
      if (filters.showCPE) {
        cpeDevices.forEach(cpe => {
          if (cpe.status === 'inventory') return; // Don't show inventory items on map

          // Create CPE cone (30 degrees beamwidth)
          const cpePolygon = createSectorCone(
            cpe.location.latitude,
            cpe.location.longitude,
            cpe.azimuth,
            cpe.beamwidth || 30,
            0.002 // ~200m radius
          );

          const color = cpe.status === 'online' ? '#10b981' : '#ef4444';
          
          const fillSymbol = new SimpleFillSymbol({
            color: [...hexToRgb(color), 0.5],
            outline: {
              color: color,
              width: 1
            }
          });

          const graphic = new Graphic({
            geometry: cpePolygon,
            symbol: fillSymbol,
            attributes: {
              type: 'cpe',
              id: cpe.id,
              ...cpe
            },
            popupTemplate: {
              title: '{name}',
              content: createCPEPopupContent
            }
          });

          graphicsLayer.add(graphic);
        });
      }

      // Render other equipment as markers
      if (filters.showEquipment) {
        const visibleEquipment = equipment.filter(eq => 
          filters.locationTypeFilter.length === 0 || 
          filters.locationTypeFilter.includes(eq.locationType)
        );

        visibleEquipment.forEach(eq => {
          const symbol = new SimpleMarkerSymbol({
            style: 'circle',
            color: getEquipmentColor(eq.status),
            size: '12px',
            outline: {
              color: 'white',
              width: 1
            }
          });

          const point = new Point({
            longitude: eq.location.longitude,
            latitude: eq.location.latitude
          });

          const graphic = new Graphic({
            geometry: point,
            symbol: symbol,
            attributes: {
              type: 'equipment',
              id: eq.id,
              ...eq
            },
            popupTemplate: {
              title: '{name}',
              content: createEquipmentPopupContent
            }
          });

          graphicsLayer.add(graphic);
        });
      }

      // Fit map to show all graphics
      if (graphicsLayer.graphics.length > 0) {
        try {
          await mapView.when(); // Ensure view is fully loaded
          await mapView.goTo({
            target: graphicsLayer.graphics,
            padding: 50
          }).catch(err => {
            console.warn('Could not fit map to graphics:', err);
            // Fallback: just center on first graphic
            if (graphicsLayer.graphics.length > 0) {
              const firstGraphic = graphicsLayer.graphics.getItemAt(0);
              if (firstGraphic && firstGraphic.geometry) {
                mapView.center = firstGraphic.geometry;
              }
            }
          });
        } catch (err) {
          console.warn('Map animation error:', err);
        }
      }

      console.log(`Rendered ${graphicsLayer.graphics.length} assets on map`);
    } catch (err) {
      console.error('Failed to render assets:', err);
    }
  }

  function createSectorCone(lat: number, lon: number, azimuth: number, beamwidth: number, radius: number): any {
    const startAngle = azimuth - beamwidth / 2;
    const endAngle = azimuth + beamwidth / 2;
    const rings = [[
      [lon, lat], // Center point
    ]];
    
    // Add arc points
    for (let angle = startAngle; angle <= endAngle; angle += 5) {
      const radians = (angle * Math.PI) / 180;
      const x = lon + radius * Math.sin(radians);
      const y = lat + radius * Math.cos(radians);
      rings[0].push([x, y]);
    }
    
    // Close the polygon
    rings[0].push([lon, lat]);
    
    return {
      type: "polygon",
      rings: rings,
      spatialReference: { wkid: 4326 }
    };
  }

  function filterSectorsByBand(allSectors: Sector[]): Sector[] {
    const activeBandFilters = filters.bandFilters.filter(f => f.enabled);
    if (activeBandFilters.length === 0) return allSectors;
    
    return allSectors.filter(sector => 
      activeBandFilters.some(filter => 
        sector.band === filter.band || 
        sector.technology === filter.band
      )
    );
  }

  async function renderBackhaulLinks() {
    if (!backhaulLayer || !mapView) return;
    
    try {
      const [
        { default: Polyline },
        { default: Graphic },
        { default: SimpleLineSymbol }
      ] = await Promise.all([
        import('@arcgis/core/geometry/Polyline.js'),
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/symbols/SimpleLineSymbol.js')
      ]);
      
      backhaulLinks.forEach(link => {
        try {
          const notes = JSON.parse(link.notes || '{}');
          const backhaulType = notes.backhaulType;
          
          // Check type filters
          if (backhaulType === 'fiber' && !filters.showFiber) return;
          if (backhaulType === 'fixed-wireless-licensed' && !filters.showWirelessLicensed) return;
          if (backhaulType === 'fixed-wireless-unlicensed' && !filters.showWirelessUnlicensed) return;
          
          const fromSite = towers.find(s => s.id === notes.fromSiteId);
          const toSite = towers.find(s => s.id === notes.toSiteId);
          
          if (!fromSite || !toSite) return;
          
          // Determine line style based on backhaul type
          let lineColor: [number, number, number, number];
          let lineStyle: string;
          let lineWidth: number;
          
          if (backhaulType === 'fiber') {
            lineColor = [34, 197, 94, 0.8]; // Green
            lineStyle = 'solid';
            lineWidth = 3;
          } else if (backhaulType === 'fixed-wireless-licensed') {
            lineColor = [59, 130, 246, 0.8]; // Blue
            lineStyle = 'dash';
            lineWidth = 2;
          } else {
            lineColor = [251, 191, 36, 0.8]; // Yellow/Orange
            lineStyle = 'dot';
            lineWidth = 2;
          }
          
          const polyline = new Polyline({
            paths: [
              [
                [fromSite.location.longitude, fromSite.location.latitude],
                [toSite.location.longitude, toSite.location.latitude]
              ]
            ],
            spatialReference: { wkid: 4326 }
          });
          
          const lineSymbol = new SimpleLineSymbol({
            color: lineColor,
            width: lineWidth,
            style: lineStyle
          });
          
          const graphic = new Graphic({
            geometry: polyline,
            symbol: lineSymbol,
            attributes: {
              id: link.id,
              name: link.name,
              type: 'backhaul',
              backhaulType: backhaulType,
              fromSite: fromSite.name,
              toSite: toSite.name,
              capacity: notes.capacity || 'N/A',
              status: link.status
            },
            popupTemplate: {
              title: '🔗 {name}',
              content: createBackhaulPopupContent
            }
          });
          
          backhaulLayer.add(graphic);
        } catch (err) {
          console.error('Error rendering backhaul link:', err);
        }
      });
    } catch (err) {
      console.error('Failed to render backhaul links:', err);
    }
  }
  
  function createBackhaulPopupContent(feature: any): string {
    const attrs = feature.graphic.attributes;
    let typeIcon = '🌐';
    let typeName = 'Fiber';
    
    if (attrs.backhaulType === 'fixed-wireless-licensed') {
      typeIcon = '📡';
      typeName = 'Licensed Wireless';
    } else if (attrs.backhaulType === 'fixed-wireless-unlicensed') {
      typeIcon = '📻';
      typeName = 'Unlicensed Wireless';
    }
    
    return `
      <div class="popup-content">
        <p><strong>Type:</strong> ${typeIcon} ${typeName}</p>
        <p><strong>From:</strong> ${attrs.fromSite}</p>
        <p><strong>To:</strong> ${attrs.toSite}</p>
        <p><strong>Capacity:</strong> ${attrs.capacity} Mbps</p>
        <p><strong>Status:</strong> ${attrs.status}</p>
      </div>
    `;
  }
  
  function getTowerColor(type: string): string {
    const colors: Record<string, string> = {
      tower: '#3b82f6',        // Blue
      rooftop: '#8b5cf6',      // Purple
      monopole: '#06b6d4',     // Cyan
      warehouse: '#f59e0b',    // Orange
      noc: '#ef4444',          // Red
      vehicle: '#10b981',      // Green
      rma: '#f97316',          // Dark Orange
      vendor: '#6366f1',       // Indigo
      other: '#6b7280'         // Gray
    };
    return colors[type] || colors.other;
  }
  
  function getLocationIcon(type: string): string {
    const icons: Record<string, string> = {
      tower: '📡',
      rooftop: '🏢',
      monopole: '📍',
      warehouse: '🏭',
      noc: '🖥️',
      vehicle: '🚚',
      rma: '🔧',
      vendor: '🏪',
      other: '📍'
    };
    return icons[type] || icons.other;
  }

  function getBandColor(band: string): string {
    const colors: Record<string, string> = {
      'LTE': '#ef4444',
      'CBRS': '#3b82f6',
      'FWA': '#10b981',
      '5G': '#8b5cf6',
      'WiFi': '#f59e0b'
    };
    return colors[band] || '#6b7280';
  }

  function getEquipmentColor(status: string): string {
    const colors: Record<string, string> = {
      deployed: '#10b981',
      inventory: '#3b82f6',
      rma: '#f59e0b',
      retired: '#6b7280',
      lost: '#ef4444'
    };
    return colors[status] || colors.deployed;
  }

  function hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  }

  function createTowerPopupContent(feature: any): string {
    const attrs = feature.graphic.attributes;
    const isReadOnly = attrs.modules?.pci || attrs.modules?.cbrs;
    return `
      <div class="popup-content">
        <p><strong>Type:</strong> ${attrs.type}</p>
        <p><strong>Height:</strong> ${attrs.height || 'N/A'} ft</p>
        ${attrs.fccId ? `<p><strong>FCC ID:</strong> ${attrs.fccId}</p>` : ''}
        ${attrs.towerOwner ? `<p><strong>Owner:</strong> ${attrs.towerOwner}</p>` : ''}
        ${attrs.gateCode ? `<p><strong>Gate Code:</strong> ${attrs.gateCode}</p>` : ''}
        ${isReadOnly ? '<p style="color: #f59e0b;">🔒 Read-only (managed by other module)</p>' : ''}
      </div>
    `;
  }

  function createSectorPopupContent(feature: any): string {
    const attrs = feature.graphic.attributes;
    const isReadOnly = attrs.modules?.pci || attrs.modules?.cbrs;
    const managedBy = attrs.modules?.pci ? 'PCI Module' : attrs.modules?.cbrs ? 'CBRS Module' : null;
    return `
      <div class="popup-content">
        <p><strong>Technology:</strong> ${attrs.technology}</p>
        <p><strong>Band:</strong> ${attrs.band || 'N/A'}</p>
        <p><strong>Azimuth:</strong> ${attrs.azimuth}°</p>
        <p><strong>Beamwidth:</strong> ${attrs.beamwidth}°</p>
        <p><strong>Status:</strong> ${attrs.status}</p>
        ${attrs.antennaModel ? `<p><strong>Antenna:</strong> ${attrs.antennaModel}</p>` : ''}
        ${isReadOnly ? `<p style="color: #f59e0b;">🔒 Read-only (${managedBy})</p>` : ''}
      </div>
    `;
  }

  function createCPEPopupContent(feature: any): string {
    const attrs = feature.graphic.attributes;
    const isReadOnly = attrs.modules?.acs || attrs.modules?.hss;
    const managedBy = attrs.modules?.acs ? 'ACS Module' : attrs.modules?.hss ? 'HSS Module' : null;
    return `
      <div class="popup-content">
        <p><strong>Manufacturer:</strong> ${attrs.manufacturer}</p>
        <p><strong>Model:</strong> ${attrs.model}</p>
        <p><strong>Serial:</strong> ${attrs.serialNumber}</p>
        <p><strong>Status:</strong> ${attrs.status}</p>
        ${attrs.subscriberName ? `<p><strong>Subscriber:</strong> ${attrs.subscriberName}</p>` : ''}
        ${attrs.azimuth ? `<p><strong>Pointing:</strong> ${attrs.azimuth}°</p>` : ''}
        ${isReadOnly ? `<p style="color: #f59e0b;">🔒 Read-only (${managedBy})</p>` : ''}
      </div>
    `;
  }

  function createEquipmentPopupContent(feature: any): string {
    const attrs = feature.graphic.attributes;
    return `
      <div class="popup-content">
        <p><strong>Type:</strong> ${attrs.type}</p>
        <p><strong>Manufacturer:</strong> ${attrs.manufacturer}</p>
        <p><strong>Model:</strong> ${attrs.model}</p>
        <p><strong>Serial:</strong> ${attrs.serialNumber}</p>
        <p><strong>Location:</strong> ${attrs.locationType}</p>
        <p><strong>Status:</strong> ${attrs.status}</p>
        <button onclick="window.dispatchEvent(new CustomEvent('edit-equipment', {detail: '${attrs.id}'}))">Edit</button>
      </div>
    `;
  }

  async function handleMapClick(event: any) {
    const response = await mapView.hitTest(event);
    if (response.results.length > 0) {
      const graphic = response.results[0].graphic;
      if (graphic && graphic.attributes) {
        dispatch('asset-click', {
          type: graphic.attributes.type,
          id: graphic.attributes.id,
          data: graphic.attributes,
          screenX: event.x,
          screenY: event.y
        });
      }
    }
  }

  async function handleRightClick(event: any) {
    event.preventDefault();
    const point = mapView.toMap({ x: event.x, y: event.y });
    
    dispatch('map-right-click', {
      latitude: point.latitude,
      longitude: point.longitude,
      screenX: event.x,
      screenY: event.y
    });
  }

  export async function changeBasemap(basemapId: string) {
    if (map) {
      currentBasemap = basemapId;
      map.basemap = basemapId;
    }
  }

  // Reactive statement to re-render when data changes
  $: if (mapView && graphicsLayer) {
    renderAllAssets();
  }
</script>

<div class="map-container" bind:this={mapContainer}></div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    min-height: 600px;
  }
</style>

