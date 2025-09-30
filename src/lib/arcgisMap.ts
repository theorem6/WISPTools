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
  
  constructor(containerId: string) {
    this.initializeMap(containerId);
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
  }
  
  /**
   * Render cells on the map with PCI information
   */
  async renderCells(cells: MapCell[]) {
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
    
    cells.forEach((cell: MapCell) => {
      const point = new Point({
        longitude: cell.longitude,
        latitude: cell.latitude,
        spatialReference: { wkid: 4326 }
      });
      
      const graphic = new Graphic({
        geometry: point,
        symbol: {
          type: "simple-marker",
          color: this.getPCIColorArray(cell.pci),
          size: 12,
          outline: {
            color: [255, 255, 255, 1],
            width: 2
          }
        },
        attributes: {
          CellId: cell.id,
          eNodeB: cell.eNodeB,
          Sector: cell.sector,
          PCI: cell.pci,
          Frequency: cell.frequency,
          RSPower: cell.rsPower
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
