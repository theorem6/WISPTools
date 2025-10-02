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
  private mapView: any;
  private cellLayer: any;
  private conflictLayer: any;
  private onCellClickCallback: ((cellId: string) => void) | null = null;
  private onMapRightClickCallback: ((latitude: number, longitude: number, screenX: number, screenY: number, cellId: string | null) => void) | null = null;
  private isInitialized = false;
  private initPromise: Promise<void>;
  
  constructor(containerId: string) {
    this.initPromise = this.initializeMap(containerId);
  }
  
  async waitForInit() {
    await this.initPromise;
    return this.isInitialized;
  }
  
  private async initializeMap(containerId: string) {
    if (!browser) return;

    // Dynamically import ArcGIS modules
    const [
      { default: Map },
      { default: MapView },
      { default: GraphicsLayer }
    ] = await Promise.all([
      import('@arcgis/core/Map.js'),
      import('@arcgis/core/views/MapView.js'),
      import('@arcgis/core/layers/GraphicsLayer.js')
    ]);

    // Check for dark mode
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // Initialize the map
    this.map = new Map({
      basemap: isDarkMode ? "dark-gray-vector" : "streets-vector"
    });
    
    // Create the map view
    this.mapView = new MapView({
      container: containerId,
      map: this.map,
      center: [-74.5, 40], // Default to New York area
      zoom: 10
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
    this.isInitialized = true;
    console.log('PCIArcGISMapper: Map initialized and ready');
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
      const hasConflict = conflictInfo && conflictInfo.count > 0;
      
      // Create a sector cone instead of a simple marker
      const azimuth = (cell as any).azimuth || 0;
      const sectorWidth = (cell as any).beamwidth || 65; // Use sector-specific beamwidth
      const sectorRadius = 0.005; // ~500m in degrees
      
      // Calculate sector polygon points
      const startAngle = azimuth - sectorWidth / 2;
      const endAngle = azimuth + sectorWidth / 2;
      const rings = [[
        [cell.longitude, cell.latitude], // Center point
      ]];
      
      // Add arc points
      for (let angle = startAngle; angle <= endAngle; angle += 5) {
        const radians = (angle * Math.PI) / 180;
        const x = cell.longitude + sectorRadius * Math.sin(radians);
        const y = cell.latitude + sectorRadius * Math.cos(radians);
        rings[0].push([x, y]);
      }
      
      // Close the polygon
      rings[0].push([cell.longitude, cell.latitude]);
      
      const sectorPolygon = {
        type: "polygon",
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
        type: "polyline",
        paths: [
          [primaryCell.longitude, primaryCell.latitude],
          [conflictingCell.longitude, conflictingCell.latitude]
        ],
        spatialReference: { wkid: 4326 }
      };
      
      const color = this.getConflictColorArray(conflict.severity);
      const symbol = {
        type: "simple-line",
        color: color,
        width: this.getConflictWidth(conflict.severity),
        style: "solid"
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
    
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
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
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 255];
  }
  
  /**
   * Get color for conflict severity as array
   */
  private getConflictColorArray(severity: string): number[] {
    switch (severity) {
      case 'CRITICAL':
        return [255, 0, 0, 255]; // Red
      case 'HIGH':
        return [255, 128, 0, 255]; // Orange
      case 'MEDIUM':
        return [255, 255, 0, 255]; // Yellow
      case 'LOW':
        return [0, 255, 255, 255]; // Cyan
      default:
        return [128, 128, 128, 255]; // Gray
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
      
      const graphic = new Graphic({
        geometry: point,
        symbol: {
          type: "simple-marker",
          color: this.getConflictColorArray(severity),
          size: 16,
          outline: { color: [255, 255, 255, 255], width: 3 }
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
   * Enable cell click events
   */
  onCellClick(callback: (cellId: string) => void) {
    this.onCellClickCallback = callback;
    
    if (this.mapView) {
      this.mapView.on('click', async (event: any) => {
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
      layers: this.map.layers.items.map(layer => ({
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
      const layer = this.map.layers.items.find(l => l.id === layerState.id);
      if (layer) {
        layer.visible = layerState.visible;
      }
    });
  }

  /**
   * Update map theme for dark mode
   */
  updateTheme(isDarkMode: boolean) {
    const basemap = isDarkMode ? "dark-gray-vector" : "streets-vector";
    this.map.basemap = basemap;
  }
}
