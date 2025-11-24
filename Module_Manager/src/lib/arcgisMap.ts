import { browser } from '$app/environment';

export interface MapCell {
  id: string;
  eNodeB: number;
  sector: number;
  pci: number;
  latitude: number;
  longitude: number;
  frequency: number;
  rsPower: number;
}

export class PCIArcGISMapper {
  private map: any;
  public mapView: any;
  private cellLayer: any;
  private conflictLayer: any;
  private onCellClickCallback: ((cellId: string) => void) | null = null;
  private onMapRightClickCallback: ((latitude: number, longitude: number, screenX: number, screenY: number, cellId: string | null) => void) | null = null;
  private isInitialized = false;
  private initPromise: Promise<void>;
  
  constructor(container: string | HTMLDivElement) {
    this.initPromise = this.initializeMap(container);
  }
  
  async waitForInit() {
    await this.initPromise;
    return this.isInitialized;
  }
  
  private async initializeMap(container: string | HTMLDivElement) {
    if (!browser) return;

    // Dynamically import ArcGIS modules
    const [
      { default: Map },
      { default: MapView },
      { default: GraphicsLayer },
      { default: Zoom }
    ] = await Promise.all([
      import('@arcgis/core/Map.js'),
      import('@arcgis/core/views/MapView.js'),
      import('@arcgis/core/layers/GraphicsLayer.js'),
      import('@arcgis/core/widgets/Zoom.js')
    ]);

    // Check for dark mode
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Initialize the map with topographic basemap
    this.map = new Map({
      basemap: isDarkMode ? "dark-gray-vector" : "topo-vector"
    });
    
    // Detect mobile device
    const isMobile = window.innerWidth <= 768;
    
    // Create the map view with mobile-optimized settings
    this.mapView = new MapView({
      container,
      map: this.map,
      center: [-98.5795, 39.8283], // Geographic center of contiguous US
      zoom: isMobile ? 6 : 5, // Show most of US
      ui: {
        components: [] // Remove default UI components, we'll add custom ones
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
        mouseWheelZoomEnabled: false // Disable mouse wheel zoom to prevent accidental zooming, especially on Mac trackpads
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
        }
      }
    });
    
    // Initialize layers
    this.cellLayer = new GraphicsLayer({
      title: "LTE Cells"
    });
    
    this.conflictLayer = new GraphicsLayer({
      title: "PCI Conflicts"
    });
    
    this.map.add(this.cellLayer);
    this.map.add(this.conflictLayer);
    
    // Wait for the view to be ready before allowing interactions
    await this.mapView.when();
    
    // Add mobile-optimized UI controls
    await this.addMobileUIControls();
    
    // Note: ArcGIS widgets are deprecated in favor of web components
    // Users can right-click on map to access basemap options via native ArcGIS context menu
    // Or use the mapView.map.basemap property to change basemaps programmatically
    
    this.isInitialized = true;
    console.log('PCIArcGISMapper: Map initialized and ready');
  }
  
  /**
   * Add mobile-optimized UI controls
   */
  private async addMobileUIControls() {
    if (!this.mapView) return;
    
    const isMobile = window.innerWidth <= 768;
    
    try {
      // Add zoom controls
      const [
        { default: Zoom },
        { default: BasemapToggle },
        { default: Compass }
      ] = await Promise.all([
        import('@arcgis/core/widgets/Zoom.js'),
        import('@arcgis/core/widgets/BasemapToggle.js'),
        import('@arcgis/core/widgets/Compass.js')
      ]);
      
      // Mobile-friendly zoom controls
      const zoom = new Zoom({
        view: this.mapView,
        layout: isMobile ? "horizontal" : "vertical"
      });
      
      this.mapView.ui.add(zoom, {
        position: "bottom-right",
        index: 0
      });
      
      // Basemap toggle
      const basemapToggle = new BasemapToggle({
        view: this.mapView,
        nextBasemap: "satellite"
      });
      
      this.mapView.ui.add(basemapToggle, {
        position: "top-right",
        index: 0
      });
      
      // Note: Locate widget removed due to deprecation (ArcGIS 4.32+)
      // Users can use browser's native geolocation or manually navigate to their location
      // Future: Consider implementing <arcgis-locate> web component if needed
      
      // Add compass for mobile
      if (isMobile) {
        const compass = new Compass({
          view: this.mapView,
          label: "Reset rotation"
        });
        
        this.mapView.ui.add(compass, {
          position: "top-left",
          index: 1
        });
      }
      
    } catch (err) {
      console.error('PCIArcGISMapper: Failed to add mobile UI controls:', err);
    }
  }
  
  /**
   * Render cells on the map with PCI information and conflict status
   */
  async renderCells(cells: MapCell[], conflicts: any[] = []) {
    if (!browser || !this.cellLayer) return;

    // Dynamically import required modules
    const [
      { default: Point },
      { default: Graphic }
    ] = await Promise.all([
      import('@arcgis/core/geometry/Point.js'),
      import('@arcgis/core/Graphic.js')
    ]);

    // Clear existing graphics
    this.cellLayer.removeAll();
    
    // Build conflict map for quick lookup
    const cellConflictMap = new Map<string, { severity: string, count: number }>();
    for (const conflict of conflicts) {
      const primaryId = conflict.primaryCell?.id;
      const conflictingId = conflict.conflictingCell?.id;
      
      if (primaryId) {
        const existing = cellConflictMap.get(primaryId) || { severity: 'NONE', count: 0 };
        if (this.getSeverityWeight(conflict.severity) > this.getSeverityWeight(existing.severity)) {
          existing.severity = conflict.severity;
        }
        existing.count++;
        cellConflictMap.set(primaryId, existing);
      }
      
      if (conflictingId) {
        const existing = cellConflictMap.get(conflictingId) || { severity: 'NONE', count: 0 };
        if (this.getSeverityWeight(conflict.severity) > this.getSeverityWeight(existing.severity)) {
          existing.severity = conflict.severity;
        }
        existing.count++;
        cellConflictMap.set(conflictingId, existing);
      }
    }
    
    cells.forEach((cell: MapCell) => {
      const point = new Point({
        longitude: cell.longitude,
        latitude: cell.latitude,
        spatialReference: { wkid: 4326 }
      });
      
      // Get conflict status for this cell
      const conflictInfo = cellConflictMap.get(cell.id);
      const hasConflict = conflictInfo && conflictInfo.count > 0 && conflictInfo.severity !== 'NONE';
      
      // Create a sector cone instead of a simple marker
      const azimuth = (cell as any).azimuth || 0;
      const sectorWidth = (cell as any).beamwidth || 65; // Use sector-specific beamwidth (default 65°)
      
      // Responsive sector radius based on screen size
      const isMobile = window.innerWidth <= 768;
      const sectorRadius = isMobile ? 0.003 : 0.005; // Smaller sectors on mobile
      
      // Calculate sector polygon points
      const startAngle = azimuth - sectorWidth / 2;
      const endAngle = azimuth + sectorWidth / 2;
      const rings = [[
        [cell.longitude, cell.latitude], // Center point
      ]];
      
      // Add arc points (fewer points on mobile for better performance)
      const angleStep = isMobile ? 10 : 5; // Larger steps on mobile
      for (let angle = startAngle; angle <= endAngle; angle += angleStep) {
        const radians = (angle * Math.PI) / 180;
        const x = cell.longitude + sectorRadius * Math.sin(radians);
        const y = cell.latitude + sectorRadius * Math.cos(radians);
        rings[0].push([x, y]);
      }
      
      // Close the polygon
      rings[0].push([cell.longitude, cell.latitude]);
      
      const sectorPolygon = {
        type: "polygon" as const,
        rings: rings,
        spatialReference: { wkid: 4326 }
      };
      
      // Choose color based on conflict status
      let fillColor, outlineColor, outlineWidth;
      
      if (hasConflict) {
        // Color based on conflict severity
        const severityColor = this.getConflictColorArray(conflictInfo.severity);
        fillColor = [...severityColor, 0.5]; // Semi-transparent conflict color
        outlineColor = severityColor;
        outlineWidth = 3; // Thicker outline for conflicts
      } else {
        // No conflicts - use success green
        fillColor = [76, 175, 80, 0.4]; // Green with transparency
        outlineColor = [56, 142, 60, 255]; // Dark green outline
        outlineWidth = 2;
      }
      
      const graphic = new Graphic({
        geometry: sectorPolygon,
        symbol: {
          type: "simple-fill",
          color: fillColor,
          outline: {
            color: outlineColor,
            width: outlineWidth
          }
        },
        attributes: {
          CellId: cell.id,
          eNodeB: cell.eNodeB,
          Sector: cell.sector,
          PCI: cell.pci,
          Frequency: cell.frequency,
          RSPower: cell.rsPower,
          ConflictStatus: conflictInfo?.severity || 'NONE',
          ConflictCount: conflictInfo?.count || 0
        }
      });
      
      this.cellLayer.add(graphic);
    });
    
    // Fit view to show all cells
    if (cells.length > 0) {
      this.fitViewToCells(cells);
    }
  }
  
  /**
   * Render PCI conflicts on the map
   */
  async renderConflicts(conflicts: any[]) {
    if (!browser || !this.conflictLayer) return;

    const [{ default: Graphic }] = await Promise.all([
      import('@arcgis/core/Graphic.js')
    ]);

    // Clear existing conflict graphics
    this.conflictLayer.removeAll();
    
    for (const conflict of conflicts) {
      const primaryCell = conflict.primaryCell;
      const conflictingCell = conflict.conflictingCell;
      
      // Create line between conflicting cells
      const polyline = {
        type: "polyline" as const,
        paths: [
          [primaryCell.longitude, primaryCell.latitude],
          [conflictingCell.longitude, conflictingCell.latitude]
        ],
        spatialReference: { wkid: 4326 }
      };
      
      const color = this.getConflictColorArray(conflict.severity);
      const symbol = {
        type: "simple-line" as const,
        color: color,
        width: this.getConflictWidth(conflict.severity),
        style: "solid" as const
      };
      
      const graphic = new Graphic({
        geometry: polyline,
        symbol: symbol,
        attributes: {
          ConflictType: conflict.conflictType,
          Severity: conflict.severity,
          Distance: conflict.distance,
          PrimaryCell: primaryCell.id,
          ConflictingCell: conflictingCell.id
        }
      });
      
      this.conflictLayer.add(graphic);
      
      // Highlight conflicting cells
      await this.highlightConflictingCells(primaryCell, conflictingCell, conflict.severity);
    }
  }
  
  /**
   * Get color for PCI value visualization as array
   */
  /**
   * Get numeric weight for conflict severity (for comparison)
   */
  private getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'CRITICAL': return 4;
      case 'HIGH': return 3;
      case 'MEDIUM': return 2;
      case 'LOW': return 1;
      default: return 0;
    }
  }
  
  private getPCIColorArray(pci: number): number[] {
    // Color scheme based on PCI modulo for better visualization
    const hue = (pci % 30) * 12; // Spread across color spectrum
    
    // Convert HSL to RGB
    const h = hue / 360;
    const s = 0.8;
    const l = 0.5;
    
    // s is always 0.8, so we skip the s === 0 check
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = hue2rgb(p, q, h + 1/3);
    const g = hue2rgb(p, q, h);
    const b = hue2rgb(p, q, h - 1/3);
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 255];
  }
  
  /**
   * Get color for conflict severity as array
   */
  private getConflictColorArray(severity: string): number[] {
    switch (severity) {
      case 'CRITICAL':
        return [239, 68, 68, 255]; // Red (--danger-color)
      case 'HIGH':
        return [245, 158, 11, 255]; // Orange (--warning-color)
      case 'MEDIUM':
        return [6, 182, 212, 255]; // Cyan (--info-color)
      case 'LOW':
        return [100, 116, 139, 255]; // Gray (--text-secondary)
      case 'UNRESOLVABLE':
        return [139, 0, 139, 255]; // Purple for unresolvable
      default:
        // Should never get here - no conflict
        return [76, 175, 80, 255]; // Green (success)
    }
  }
  
  /**
   * Get line width for conflict severity
   */
  private getConflictWidth(severity: string): number {
    switch (severity) {
      case 'CRITICAL':
        return 6;
      case 'HIGH':
        return 4;
      case 'MEDIUM':
        return 3;
      case 'LOW':
        return 2;
      default:
        return 1;
    }
  }
  
  /**
   * Highlight cells involved in conflicts
   */
  private async highlightConflictingCells(primary: MapCell, conflicting: MapCell, severity: string) {
    if (!browser) return;

    const [
      { default: Point },
      { default: Graphic }
    ] = await Promise.all([
      import('@arcgis/core/geometry/Point.js'),
      import('@arcgis/core/Graphic.js')
    ]);
    
    [primary, conflicting].forEach((cell: MapCell) => {
      const point = new Point({
        longitude: cell.longitude,
        latitude: cell.latitude,
        spatialReference: { wkid: 4326 }
      });
      
      // Responsive sizing for conflict highlights
      const isMobile = window.innerWidth <= 768;
      const markerSize = isMobile ? 20 : 16;
      const outlineWidth = isMobile ? 4 : 3;
      
      const graphic = new Graphic({
        geometry: point,
        symbol: {
          type: "simple-marker",
          color: this.getConflictColorArray(severity),
          size: markerSize,
          outline: { color: [255, 255, 255, 255], width: outlineWidth }
        },
        attributes: { 
          ...cell, 
          conflictHighlight: true,
          severity: severity 
        }
      });
      
      this.conflictLayer.add(graphic);
    });
  }
  
  /**
   * Fit map view to show all cells
   */
  private fitViewToCells(cells: MapCell[]) {
    if (this.mapView && cells.length > 0) {
      const center = {
        longitude: cells.reduce((sum, cell) => sum + cell.longitude, 0) / cells.length,
        latitude: cells.reduce((sum, cell) => sum + cell.latitude, 0) / cells.length
      };
      
      this.mapView.goTo({
        center: [center.longitude, center.latitude],
        zoom: 12
      });
    }
  }
  
  /**
   * Add interactive popup for cell information
   */
  enableCellPopup() {
    if (this.mapView && this.mapView.popup) {
      this.mapView.popup.defaultPopupTemplateEnabled = true;
    }
  }
  
  /**
   * Enable cell click events (left-click only)
   */
  onCellClick(callback: (cellId: string) => void) {
    this.onCellClickCallback = callback;
    
    if (this.mapView) {
      this.mapView.on('click', async (event: any) => {
        // Only respond to left-clicks (button 0), ignore right-clicks (button 2)
        if (event.button !== 0) {
          return;
        }
        
        const response = await this.mapView.hitTest(event);
        
        if (response.results.length > 0) {
          const graphic = response.results[0].graphic;
          
          // Check if it's a cell graphic (not a conflict line)
          if (graphic && graphic.attributes && graphic.attributes.CellId) {
            const cellId = graphic.attributes.CellId;
            if (this.onCellClickCallback) {
              this.onCellClickCallback(cellId);
            }
          }
        }
      });
    }
  }
  
  /**
   * Enable right-click to show context menu
   */
  onMapRightClick(callback: (latitude: number, longitude: number, screenX: number, screenY: number, cellId: string | null) => void) {
    this.onMapRightClickCallback = callback;
    
    console.log('PCIArcGISMapper: onMapRightClick called, mapView exists:', !!this.mapView);
    
    if (this.mapView) {
      // Use the container's native contextmenu event for right-click
      const container = this.mapView.container;
      
      console.log('PCIArcGISMapper: Container exists:', !!container);
      
      if (container) {
        container.addEventListener('contextmenu', async (e: MouseEvent) => {
          console.log('PCIArcGISMapper: Right-click detected!', e.clientX, e.clientY);
          e.preventDefault();
          e.stopPropagation();
          
          // Get screen coordinates
          const rect = container.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          // Convert screen coordinates to map coordinates
          const point = this.mapView.toMap({ x, y });
          
          // Check if clicking on an existing cell
          let clickedCellId: string | null = null;
          try {
            const response = await this.mapView.hitTest({ x, y });
            if (response.results.length > 0) {
              const graphic = response.results[0].graphic;
              if (graphic && graphic.attributes && graphic.attributes.CellId) {
                clickedCellId = graphic.attributes.CellId;
                console.log('PCIArcGISMapper: Clicked on cell:', clickedCellId);
              }
            }
          } catch (err) {
            console.error('Hit test error:', err);
          }
          
          console.log('PCIArcGISMapper: Map point:', point?.latitude, point?.longitude);
          
          if (point && this.onMapRightClickCallback) {
            console.log('PCIArcGISMapper: Calling callback with coordinates and cellId');
            this.onMapRightClickCallback(point.latitude, point.longitude, e.clientX, e.clientY, clickedCellId);
          }
        });
        console.log('PCIArcGISMapper: Right-click listener attached successfully');
      }
    } else {
      console.warn('PCIArcGISMapper: MapView not initialized yet, cannot attach right-click listener');
    }
  }
  
  /**
   * Clear all map data
   */
  clearMap() {
    this.cellLayer.removeAll();
    this.conflictLayer.removeAll();
  }
  
  /**
   * Enable clustering for dense cell deployments
   */
  enableClustering() {
    // Implementation for point clustering would go here
    // This would help manage large numbers of cells efficiently
  }
  
  /**
   * Export map configuration for saving/loading
   */
  exportMapState() {
    return {
      center: this.mapView.center,
      zoom: this.mapView.zoom,
      layers: this.map.layers.items.map((layer: any) => ({
        id: layer.id,
        visible: layer.visible
      }))
    };
  }
  
  /**
   * Load map state from saved configuration
   */
  loadMapState(state: any) {
    this.mapView.goTo({
      center: state.center,
      zoom: state.zoom
    });
    
    state.layers.forEach((layerState: any) => {
      const layer = this.map.layers.items.find((l: any) => l.id === layerState.id);
      if (layer) {
        layer.visible = layerState.visible;
      }
    });
  }

  /**
   * Update map theme for dark mode
   */
  updateTheme(isDarkMode: boolean) {
    const basemap = isDarkMode ? "dark-gray-vector" : "topo-vector";
    this.map.basemap = basemap;
  }
  
  /**
   * Change map basemap programmatically
   * Available basemaps: 'topo-vector', 'streets-vector', 'satellite', 'hybrid', 
   *                     'dark-gray-vector', 'streets-night-vector', 'oceans', 'osm'
   */
  changeBasemap(basemapId: string) {
    if (!this.map) return;
    this.map.basemap = basemapId as any;
    console.log('PCIArcGISMapper: Changed basemap to', basemapId);
  }
}
