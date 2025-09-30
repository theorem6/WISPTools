import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import Color from "@arcgis/core/Color";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";

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
  private map: Map;
  private mapView: MapView;
  private cellLayer: GraphicsLayer;
  private conflictLayer: GraphicsLayer;
  
  constructor(containerId: string) {
    this.initializeMap(containerId);
  }
  
  private async initializeMap(containerId: string) {
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
  renderCells(cells: MapCell[]) {
    // Clear existing graphics
    this.cellLayer.removeAll();
    
    cells.forEach(cell => {
      const point = new Point({
        longitude: cell.longitude,
        latitude: cell.latitude,
        spatialReference: { wkid: 4326 }
      });
      
      // Color code cells by PCI value
      const symbol = new SimpleMarkerSymbol({
        color: this.getPCIColor(cell.pci),
        size: 12,
        outline: {
         	color: [1, 1, 1, 1],
         	width: 2
        }
      });
      
      const graphic = new Graphic({
        geometry: point,
        symbol: symbol,
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
  renderConflicts(conflicts: any[]) {
    // Clear existing conflict graphics
    this.conflictLayer.removeAll();
    
    conflicts.forEach(conflict => {
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
      
      const color = this.getConflictColor(conflict.severity);
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
      this.highlightConflictingCells(primaryCell, conflictingCell, conflict.severity);
    });
  }
  
  /**
   * Get color for PCI value visualization
   */
  private getPCIColor(pci: number): Color {
    // Color scheme based on PCI modulo for better visualization
    const hue = (pci % 30) * 12; // Spread across color spectrum
    const saturation = 0.8;
    const lightness = 0.5;
    
    return Color.fromHSL(hue, saturation, lightness);
  }
  
  /**
   * Get color for conflict severity
   */
  private getConflictColor(severity: string): Color {
    switch (severity) {
      case 'CRITICAL':
        return new Color([256, 0, 0, 1]); // Red
      case 'HIGH':
        return new Color([256, 128, 0, 1]); // Orange
      case 'MEDIUM':
        return new Color([256, 256, 0, 1]); // Yellow
      case 'LOW':
        return new Color([0, 256, 256, 1]); // Cyan
      default:
        return new Color([128, 128, 128, 1]); // Gray
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
  private highlightConflictingCells(primary: MapCell, conflicting: MapCell, severity: string) {
    const symbols = [
      new SimpleMarkerSymbol({
        color: this.getConflictColor(severity),
        size: 16,
        outline: { color: [1, 1, 1, 1], width: 3 }
      })
    ];
    
    [primary, conflicting].forEach(cell => {
      const point = new Point({
        longitude: cell.longitude,
        latitude: cell.latitude,
        spatialReference: { wkid: 4326 }
      });
      
      const graphic = new Graphic({
        geometry: point,
        symbol: symbols[0],
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
    const points = cells.map(cell => 
      new Point({
        longitude: cell.longitude,
        latitude: cell.latitude,
        spatialReference: { wkid: 4326 }
      })
    );
    
    const extent = geometryEngine.union(points) as Point;
    this.mapView.goTo({
      target: points,
      zoom: 12
    });
  }
  
  /**
   * Add interactive popup for cell information
   */
  enableCellPopup() {
    this.mapView.popup.defaultPopupTemplateEnabled = true;
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
