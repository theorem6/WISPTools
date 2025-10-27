<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import type { TowerSite, Sector, CPEDevice, NetworkEquipment, CoverageMapFilters } from '../lib/models';
  import { createLocationIcon } from '$lib/mapIcons';
  import BasemapSwitcher from '$lib/components/maps/BasemapSwitcher.svelte';

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
  let currentBasemap = 'topo-vector'; // Use valid ArcGIS basemap ID
  
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
      
      // Import ArcGIS modules (same as working modules - no config needed)
      const [
        { default: Map },
        { default: MapView },
        { default: GraphicsLayer }
      ] = await Promise.all([
        import('@arcgis/core/Map.js'),
        import('@arcgis/core/views/MapView.js'),
        import('@arcgis/core/layers/GraphicsLayer.js')
      ]);

      // Create graphics layers
      backhaulLayer = new GraphicsLayer({ title: 'Backhaul Links' });
      graphicsLayer = new GraphicsLayer({ title: 'Network Assets' });

      // Create map with fallback basemap
      try {
        map = new Map({
          basemap: currentBasemap,
          layers: [backhaulLayer, graphicsLayer]
        });
      } catch (basemapError) {
        console.warn('Failed to load basemap, trying fallback...', basemapError);
        // Fallback to a simpler basemap
        map = new Map({
          basemap: 'gray-vector',
          layers: [backhaulLayer, graphicsLayer]
        });
        currentBasemap = 'gray-vector';
      }

      // Detect mobile device
      const isMobile = window.innerWidth <= 768;
      
      // Create view with mobile-optimized settings
      mapView = new MapView({
        container: mapContainer,
        map: map,
        center: [-98.5795, 39.8283], // Center of USA
        zoom: isMobile ? 6 : 5, // Slightly more zoomed on mobile
        ui: {
          components: [] // Remove all default UI components
        },
        // Mobile-specific constraints
        constraints: {
          rotationEnabled: !isMobile, // Disable rotation on mobile
          snapToZoom: true,
          minZoom: 3,
          maxZoom: 20
        },
        // Enable touch interactions
        navigation: {
          gamepad: {
            enabled: false
          },
          browserTouchPanEnabled: true,
          momentumEnabled: true,
          frictionFactor: 0.9
        },
        // Mobile-optimized popup
        popup: {
          dockEnabled: true,
          dockOptions: {
            buttonEnabled: true,
            breakpoint: {
              width: 544, // Mobile breakpoint
              height: 544
            },
            position: isMobile ? "bottom-center" : "top-right"
          },
          // Mobile-specific popup styling
          viewModel: {
            includeDefaultActions: false,
            actions: isMobile ? [
              {
                title: "View Details",
                id: "view-details",
                className: "esri-icon-description"
              }
            ] : []
          }
        }
      });

      // Wait for view to be ready before adding handlers
      try {
        await mapView.when();
        console.log('MapView ready');
        
        // Add mobile-optimized UI controls
        await addMobileUIControls();
      } catch (viewError) {
        console.error('MapView failed to initialize:', viewError);
        // Still try to set up handlers
      }

      // Add click handler for map interactions
      mapView.on('click', handleMapClick);
      
      // Add touch event handling for mobile
      addTouchEventHandling();
      
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

      console.log('Coverage Map initialized');
      
      // Render all assets
      await renderAllAssets();
    } catch (err) {
      console.error('Failed to initialize Coverage Map:', err);
      throw err;
    }
  }

  // Add mobile-optimized UI controls
  async function addMobileUIControls() {
    if (!mapView) return;
    
    const isMobile = window.innerWidth <= 768;
    
    try {
      // Add zoom controls
      const [
        { default: Zoom },
        { default: BasemapToggle },
        { default: Locate },
        { default: Compass }
      ] = await Promise.all([
        import('@arcgis/core/widgets/Zoom.js'),
        import('@arcgis/core/widgets/BasemapToggle.js'),
        import('@arcgis/core/widgets/Locate.js'),
        import('@arcgis/core/widgets/Compass.js')
      ]);
      
      // Mobile-friendly zoom controls
      const zoom = new Zoom({
        view: mapView,
        layout: isMobile ? "horizontal" : "vertical"
      });
      
      mapView.ui.add(zoom, {
        position: "bottom-right",
        index: 0
      });
      
      // Basemap toggle
      const basemapToggle = new BasemapToggle({
        view: mapView,
        nextBasemap: "satellite"
      });
      
      mapView.ui.add(basemapToggle, {
        position: "top-right",
        index: 0
      });
      
      // Add locate button for mobile users
      if (isMobile && navigator.geolocation) {
        const locate = new Locate({
          view: mapView,
          useHeadingEnabled: false,
          goToOverride: (view, options) => {
            options.target.scale = 15000; // Zoom level for mobile
            return view.goTo(options.target);
          }
        });
        
        mapView.ui.add(locate, {
          position: "top-left",
          index: 0
        });
      }
      
      // Add compass for mobile
      if (isMobile) {
        const compass = new Compass({
          view: mapView,
          label: "Reset rotation"
        });
        
        mapView.ui.add(compass, {
          position: "top-left",
          index: 1
        });
      }
      
    } catch (err) {
      console.error('Failed to add mobile UI controls:', err);
    }
  }

  // Export function to change basemap from parent component or widget
  export function changeBasemap(basemapId: string) {
    if (map) {
      currentBasemap = basemapId;
      map.basemap = basemapId;
      console.log('Basemap changed to:', basemapId);
    }
  }

  // Handle basemap change from widget
  function handleBasemapChange(event: CustomEvent<string>) {
    changeBasemap(event.detail);
  }

  // Add touch event handling for mobile devices
  function addTouchEventHandling() {
    if (!mapView) return;
    
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let longPressTimer: number | null = null;
    
    // Handle touch start
    mapView.on('pointer-down', (event: any) => {
      if (event.pointerType === 'touch') {
        touchStartTime = Date.now();
        touchStartX = event.x;
        touchStartY = event.y;
        
        // Set up long press timer
        longPressTimer = window.setTimeout(() => {
          handleLongPress(event);
        }, 500); // 500ms for long press
      }
    });
    
    // Handle touch end
    mapView.on('pointer-up', (event: any) => {
      if (event.pointerType === 'touch') {
        // Clear long press timer
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        
        const touchDuration = Date.now() - touchStartTime;
        const touchDistance = Math.sqrt(
          Math.pow(event.x - touchStartX, 2) + Math.pow(event.y - touchStartY, 2)
        );
        
        // If it was a short tap and didn't move much, treat as click
        if (touchDuration < 500 && touchDistance < 10) {
          // Let the normal click handler take care of it
          return;
        }
      }
    });
    
    // Handle touch move (cancel long press if user moves)
    mapView.on('pointer-move', (event: any) => {
      if (event.pointerType === 'touch' && longPressTimer) {
        const touchDistance = Math.sqrt(
          Math.pow(event.x - touchStartX, 2) + Math.pow(event.y - touchStartY, 2)
        );
        
        // Cancel long press if user moved more than 10 pixels
        if (touchDistance > 10) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    });
  }
  
  // Handle long press on mobile
  function handleLongPress(event: any) {
    const point = mapView.toMap(event);
    dispatch('map-right-click', {
      latitude: point.latitude,
      longitude: point.longitude,
      screenX: event.x,
      screenY: event.y
    });
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
      
      // Render towers and locations
      if (filters.showTowers) {
        // Load PictureMarkerSymbol for custom icons
        const { default: PictureMarkerSymbol } = await import('@arcgis/core/symbols/PictureMarkerSymbol.js');
        
        towers.forEach(tower => {
          let symbol;
          
          // Responsive sizing based on screen size
          const isMobile = window.innerWidth <= 768;
          const iconSize = isMobile ? 48 : 40;
          const symbolSize = isMobile ? '28px' : '20px';
          const outlineWidth = isMobile ? 4 : 3;
          
          // Use custom SVG icons for specific location types
          const customIcon = createLocationIcon(tower.type, iconSize);
          
          if (customIcon) {
            // NOC, Warehouse, Vehicle, RMA, Vendor - use custom SVG
            symbol = new PictureMarkerSymbol(customIcon);
          } else {
            // Towers, rooftops, monopoles - use colored circles
            symbol = new SimpleMarkerSymbol({
              style: 'circle',
              color: getTowerColor(tower.type),
              size: symbolSize,
              outline: {
                color: 'white',
                width: outlineWidth
              }
            });
          }

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
          // Responsive sizing for equipment
          const isMobile = window.innerWidth <= 768;
          const symbolSize = isMobile ? '16px' : '12px';
          const outlineWidth = isMobile ? 2 : 1;
          
          const symbol = new SimpleMarkerSymbol({
            style: 'circle',
            color: getEquipmentColor(eq.status),
            size: symbolSize,
            outline: {
              color: 'white',
              width: outlineWidth
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

  // Reactive statement to re-render when data changes
  $: if (mapView && graphicsLayer) {
    renderAllAssets();
  }
</script>

<div class="coverage-map-container">
  <div bind:this={mapContainer} class="map-container"></div>
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

