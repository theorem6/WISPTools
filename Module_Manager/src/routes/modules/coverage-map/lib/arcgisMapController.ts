import type {
  TowerSite,
  Sector,
  CPEDevice,
  NetworkEquipment,
  CoverageMapFilters
} from './models';
import type { PlanLayerFeature, PlanMarketingAddress } from '$lib/services/planService';
import { createLocationIcon } from '$lib/mapIcons';
import { getTowerColor, getBandColor, getEquipmentColor, getBackhaulColor, getPlanDraftColor, hexToRgb } from './utils/mapColorUtils';
import { createSectorCone, normalizePlanGeometry } from './utils/mapGeometryUtils';
import { createBackhaulPopupContent } from './utils/mapPopupUtils';
import { toNumeric, normalizeStreetKey, getLeadSourcePriority, buildCoordinateKey, buildMarketingPopupContent } from './utils/marketingLeadUtils';
import { renderTowers, renderSectors, renderCPEDevices, renderEquipment } from './renderers';

type DispatchFn = (event: string, detail?: any) => void;

export interface CoverageMapInitOptions {
  container: HTMLDivElement;
  filters: CoverageMapFilters;
  towers: TowerSite[];
  sectors: Sector[];
  cpeDevices: CPEDevice[];
  equipment: NetworkEquipment[];
  externalPlanFeatures?: PlanLayerFeature[];
  marketingLeads?: PlanMarketingAddress[];
  projectOverlays?: Map<string, PlanLayerFeature[]>;
}

interface CoverageMapData {
  towers: TowerSite[];
  sectors: Sector[];
  cpeDevices: CPEDevice[];
  equipment: NetworkEquipment[];
}

export interface CoverageMapInitResult {
  map: any;
  mapView: any;
}

export class CoverageMapController {
  private dispatch: DispatchFn;
  private container: HTMLDivElement | null = null;

  private map: any = null;
  private mapView: any = null;
  private graphicsLayer: any = null;
  private backhaulLayer: any = null;
  private marketingLayer: any = null;
  private planDraftLayer: any = null;
  private projectOverlayLayer: any = null;
  private projectOverlays: Map<string, PlanLayerFeature[]> = new Map();
  private planDraftGraphics: Map<string, any> = new Map();
  
  // Track graphics by ID for incremental updates
  private graphicsMap: Map<string, any> = new Map(); // Map<graphicId, graphic>
  private lastDataHash: string = ''; // Hash of last rendered data to detect structural changes
  private planDraftDragContext:
    | {
        featureId: string;
        planId: string;
        graphic: any;
        startGeometry: any;
      }
    | null = null;

  private currentBasemap = 'topo-vector';
  private mapReady = false;
  private extentWatchHandle: any = null;
  private extentPostTimer: number | null = null;
  private webMercatorUtils: any = null;
  private reactiveUtils: any = null;

  private filters: CoverageMapFilters;
  private data: CoverageMapData = {
    towers: [],
    sectors: [],
    cpeDevices: [],
    equipment: []
  };
  private planDraftFeatures: PlanLayerFeature[] = [];
  private marketingLeads: PlanMarketingAddress[] = [];
  private hasPerformedInitialFit = false;
  
  // Drawing state for marketing address discovery
  private sketchWidget: any = null;
  private drawingGraphicsLayer: any = null;
  private isDrawingMode = false;

  constructor(dispatch: DispatchFn) {
    this.dispatch = dispatch;
    this.filters = {
      showTowers: true,
      showSectors: true,
      showCPE: true,
      showEquipment: true,
      showBackhaul: true,
      showFiber: true,
      showWirelessLicensed: true,
      showWirelessUnlicensed: true,
      showMarketing: true,
      bandFilters: [],
      statusFilter: [],
      technologyFilter: [],
      locationTypeFilter: []
    };
  }

  public async initialize(options: CoverageMapInitOptions): Promise<CoverageMapInitResult> {
    this.container = options.container;
    this.filters = options.filters;
    
    // Store data before map initialization
    this.data = {
      towers: options.towers || [],
      sectors: options.sectors || [],
      cpeDevices: options.cpeDevices || [],
      equipment: options.equipment || []
    };
    
    console.log('[CoverageMap] Initializing with data:', {
      towersCount: this.data.towers.length,
      sectorsCount: this.data.sectors.length,
      cpeCount: this.data.cpeDevices.length,
      equipmentCount: this.data.equipment.length
    });
    
    this.setPlanFeatures(options.externalPlanFeatures ?? []);
    this.marketingLeads = options.marketingLeads ?? [];
    this.setProjectOverlays(options.projectOverlays ?? new Map());

    await this.initializeMap();
    
    // Set mapReady BEFORE rendering so setData calls will trigger rendering
    this.mapReady = true;
    
    await this.renderAllAssets();
    await this.renderPlanDrafts();
    await this.renderMarketingLeads();
    await this.fitMapToVisibleGraphics(true);

    return {
      map: this.map,
      mapView: this.mapView
    };
  }

  public destroy(): void {
    if (this.extentPostTimer) {
      window.clearTimeout(this.extentPostTimer);
      this.extentPostTimer = null;
    }
    if (this.extentWatchHandle) {
      if (typeof this.extentWatchHandle.remove === 'function') {
        this.extentWatchHandle.remove();
      } else if (typeof this.extentWatchHandle === 'function') {
        this.extentWatchHandle();
      }
    }
    this.extentWatchHandle = null;

    if (this.mapView) {
      this.mapView.destroy();
      this.mapView = null;
    }
    if (this.map) {
      this.map.destroy();
      this.map = null;
    }
    this.graphicsLayer = null;
    this.backhaulLayer = null;
    this.marketingLayer = null;
    this.planDraftLayer = null;
    this.container = null;
    this.mapReady = false;
  }

  public getMapView(): any {
    return this.mapView;
  }

  public getCurrentExtent(): any {
    if (!this.mapView) return null;
    const extent = this.mapView.extent;
    if (!extent) return null;
    return this.buildExtentPayload(extent);
  }

  public isReady(): boolean {
    return this.mapReady;
  }

  public async enableRectangleDrawing(): Promise<void> {
    if (!this.mapView || !this.mapReady) {
      console.warn('[CoverageMap] Map not ready for drawing');
      return;
    }

    try {
      await this.mapView.when();
      
      // Import Sketch widget
      const [{ default: Sketch }, { default: GraphicsLayer }] = await Promise.all([
        import('@arcgis/core/widgets/Sketch.js'),
        import('@arcgis/core/layers/GraphicsLayer.js')
      ]);

      // Create drawing graphics layer if it doesn't exist
      if (!this.drawingGraphicsLayer) {
        this.drawingGraphicsLayer = new GraphicsLayer({ 
          title: 'Drawing Rectangle',
          listMode: 'hide' // Hide from layer list - it's temporary
        });
        this.map.add(this.drawingGraphicsLayer);
      }

      // Create sketch widget if it doesn't exist
      if (!this.sketchWidget) {
        this.sketchWidget = new Sketch({
          view: this.mapView,
          layer: this.drawingGraphicsLayer,
          creationMode: 'single', // Use 'single' to allow creating one rectangle at a time
          visibleElements: {
            createTools: {
              point: false,
              polygon: false,
              polyline: false,
              circle: false,
              rectangle: true
            },
            selectionTools: {
              'lasso-selection': false,
              'rectangle-selection': false
            },
            undoRedoMenu: false,
            settingsMenu: false
          }
        });

        // Handle when rectangle is created
        this.sketchWidget.on('create', async (event: any) => {
          console.log('[CoverageMap] Sketch create event:', event.state, event);
          
          if (event.state === 'complete') {
            const geometry = event.graphic.geometry;
            console.log('[CoverageMap] Rectangle completed, geometry:', geometry);
            
            if (geometry && geometry.type === 'polygon') {
              // Extract bounding box from rectangle
              const extent = geometry.extent;
              console.log('[CoverageMap] Rectangle extent (Web Mercator):', extent);
              
              if (extent && this.webMercatorUtils) {
                try {
                  // Convert Web Mercator coordinates to WGS84 (lat/lon degrees)
                  const [west, south] = this.webMercatorUtils.xyToLngLat(extent.xmin, extent.ymin);
                  const [east, north] = this.webMercatorUtils.xyToLngLat(extent.xmax, extent.ymax);
                  const [centerLon, centerLat] = this.webMercatorUtils.xyToLngLat(
                    (extent.xmin + extent.xmax) / 2,
                    (extent.ymin + extent.ymax) / 2
                  );

                  const boundingBox = {
                    west,
                    east,
                    south,
                    north
                  };

                  const center = {
                    lat: centerLat,
                    lon: centerLon
                  };

                  console.log('[CoverageMap] Extracted bounding box (WGS84):', boundingBox, 'center:', center);

                  // Keep the rectangle visible - don't clear it immediately
                  // Only disable drawing mode so user can't draw another one
                  this.isDrawingMode = false;
                  // Don't remove the widget yet - keep it visible
                  // Don't clear graphics yet - keep rectangle visible

                  // Dispatch event with bounding box
                  const eventData = {
                    boundingBox,
                    center,
                    geometry: {
                      type: 'Polygon',
                      coordinates: [geometry.rings[0].map((ring: any) => {
                        // Convert ring coordinates to WGS84
                        return ring.map((coord: any) => {
                          const [lon, lat] = this.webMercatorUtils.xyToLngLat(coord[0], coord[1]);
                          return [lon, lat];
                        });
                      })]
                    }
                  };
                  
                  console.log('[CoverageMap] Dispatching rectangle-drawn event:', eventData);
                  this.dispatch('rectangle-drawn', eventData);
                  
                  // Also post message to parent window for iframe communication
                  if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
                    console.log('[CoverageMap] Posting rectangle-drawn message to parent window', {
                      hasParent: !!window.parent,
                      parentSame: window.parent === window,
                      eventData: eventData
                    });
                    try {
                      window.parent.postMessage({
                        source: 'coverage-map',
                        type: 'rectangle-drawn',
                        detail: eventData
                      }, '*');
                      console.log('[CoverageMap] Message posted successfully to parent window');
                    } catch (err) {
                      console.error('[CoverageMap] Failed to post message to parent:', err);
                    }
                  } else {
                    console.warn('[CoverageMap] Cannot post message - no parent window or same window');
                  }
                } catch (convErr) {
                  console.error('[CoverageMap] Failed to convert coordinates:', convErr);
                  console.warn('[CoverageMap] Falling back to extent coordinates (may be wrong projection)');
                  
                  // Fallback: use extent as-is (this will be wrong but at least won't crash)
                  const boundingBox = {
                    west: extent.xmin,
                    east: extent.xmax,
                    south: extent.ymin,
                    north: extent.ymax
                  };

                  const center = {
                    lat: (extent.ymin + extent.ymax) / 2,
                    lon: (extent.xmin + extent.xmax) / 2
                  };

                  this.dispatch('rectangle-drawn', { boundingBox, center });
                }
              } else {
                console.warn('[CoverageMap] Rectangle extent is null or webMercatorUtils not available');
              }
            } else {
              console.warn('[CoverageMap] Rectangle geometry type is not polygon:', geometry?.type);
            }
          } else {
            console.log('[CoverageMap] Sketch create event state:', event.state);
          }
        });
      }

      // Wait for widget to be ready before adding to UI
      try {
        await this.sketchWidget.when();
        console.log('[CoverageMap] Sketch widget ready');
      } catch (widgetError) {
        console.error('[CoverageMap] Failed to wait for sketch widget:', widgetError);
      }

      // Show the sketch widget (only if it's not already in the UI)
      try {
        // Try to remove it first if it exists
        try {
          this.mapView.ui.remove(this.sketchWidget);
        } catch (e) {
          // Not in UI, that's okay
        }
        
        // Add to UI
        this.mapView.ui.add(this.sketchWidget, {
          position: 'top-left',
          index: 0
        });
        console.log('[CoverageMap] Sketch widget added to UI');
      } catch (e) {
        // Widget might already be in UI, that's okay
        console.log('[CoverageMap] Sketch widget already in UI or error adding:', e);
      }

      // Enable rectangle creation
      try {
        // Ensure the view is ready and interactive
        await this.mapView.when();
        console.log('[CoverageMap] MapView ready');
        
        // Ensure view is interactive
        if (!this.mapView.interactive) {
          this.mapView.interactive = true;
          console.log('[CoverageMap] Enabled map view interactivity');
        }
        
        // Ensure drawing layer exists and is visible
        if (!this.drawingGraphicsLayer) {
          const { default: GraphicsLayer } = await import('@arcgis/core/layers/GraphicsLayer.js');
          this.drawingGraphicsLayer = new GraphicsLayer({ 
            title: 'Drawing Rectangle',
            listMode: 'hide'
          });
          this.map.add(this.drawingGraphicsLayer);
        }
        this.drawingGraphicsLayer.visible = true;
        
        // Wait a bit for UI to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Cancel any existing drawing first
        if (this.sketchWidget && this.sketchWidget.activeTool) {
          this.sketchWidget.cancel();
        }
        
        // Ensure sketch widget is properly initialized
        if (!this.sketchWidget) {
          throw new Error('Sketch widget not initialized');
        }
        
        // Wait for sketch widget to be ready
        await this.sketchWidget.when();
        
        console.log('[CoverageMap] Starting rectangle creation tool...');
        this.isDrawingMode = true;
        
        // Start rectangle creation - this makes the map interactive for drawing
        await this.sketchWidget.create('rectangle');
        
        console.log('[CoverageMap] Rectangle drawing enabled - click and drag on map to draw');
        console.log('[CoverageMap] Sketch widget state:', {
          activeTool: this.sketchWidget.activeTool,
          creationMode: this.sketchWidget.creationMode,
          isDrawingMode: this.isDrawingMode,
          viewReady: this.mapView.ready,
          viewInteractive: this.mapView.interactive,
          drawingLayerVisible: this.drawingGraphicsLayer.visible
        });
      } catch (error: any) {
        console.error('[CoverageMap] Failed to start rectangle creation:', error);
        console.error('[CoverageMap] Error details:', {
          errorMessage: error?.message,
          errorStack: error?.stack,
          sketchWidgetExists: !!this.sketchWidget,
          mapViewExists: !!this.mapView,
          mapViewReady: this.mapView?.ready,
          mapViewInteractive: this.mapView?.interactive,
          drawingLayerExists: !!this.drawingGraphicsLayer
        });
        // Reset drawing mode if creation failed
        this.isDrawingMode = false;
        
        // Try to remove widget if creation failed
        try {
          if (this.mapView && this.sketchWidget) {
            this.mapView.ui.remove(this.sketchWidget);
          }
        } catch (removeErr) {
          // Ignore removal errors
        }
      }
    } catch (error) {
      console.error('[CoverageMap] Failed to enable rectangle drawing:', error);
    }
  }

  public async disableRectangleDrawing(clearGraphics: boolean = false): Promise<void> {
    if (!this.mapView || !this.sketchWidget) {
      return;
    }

    try {
      // Cancel any active drawing
      if (this.sketchWidget.activeTool) {
        this.sketchWidget.cancel();
      }

      // Remove widget from UI
      try {
        this.mapView.ui.remove(this.sketchWidget);
      } catch (e) {
        // Widget might not be in UI, that's okay
        console.log('[CoverageMap] Widget not in UI or error removing:', e);
      }

      // Only clear drawing graphics if requested (e.g., after discovery completes)
      if (clearGraphics && this.drawingGraphicsLayer && this.drawingGraphicsLayer.graphics) {
        this.drawingGraphicsLayer.removeAll();
      }

      this.isDrawingMode = false;
      console.log('[CoverageMap] Rectangle drawing disabled', { clearGraphics });
    } catch (error) {
      console.error('[CoverageMap] Failed to disable rectangle drawing:', error);
    }
  }

  public clearDrawingGraphics(): void {
    if (this.drawingGraphicsLayer && this.drawingGraphicsLayer.graphics) {
      this.drawingGraphicsLayer.removeAll();
      console.log('[CoverageMap] Drawing graphics cleared');
    }
  }

  public isDrawingRectangle(): boolean {
    return this.isDrawingMode;
  }

  public changeBasemap(basemapId: string): void {
    if (!this.map) return;
    this.currentBasemap = basemapId;
    try {
      this.map.basemap = basemapId;
      console.log('[CoverageMap] Basemap changed to:', basemapId);
    } catch (error) {
      console.error(`[CoverageMap] Failed to change basemap to "${basemapId}"`, error);
    }
  }

  public setData(data: CoverageMapData): void {
    const newData = {
      towers: data.towers || [],
      sectors: data.sectors || [],
      cpeDevices: data.cpeDevices || [],
      equipment: data.equipment || []
    };
    
    // Check if this is a structural change (items added/removed) or just status updates
    const newDataHash = this.getDataStructureHash(newData);
    const isStructuralChange = newDataHash !== this.lastDataHash;
    
    // If structure hasn't changed, check if status/uptime actually changed
    if (!isStructuralChange && this.lastDataHash) {
      const statusChanged = this.hasStatusChanged(newData, this.data);
      if (!statusChanged) {
        // No structural or status changes - skip update entirely
        return;
      }
    }
    
    console.log('[CoverageMap] setData called:', {
      towersCount: newData.towers?.length || 0,
      sectorsCount: newData.sectors?.length || 0,
      cpeCount: newData.cpeDevices?.length || 0,
      equipmentCount: newData.equipment?.length || 0,
      mapReady: this.mapReady,
      isStructuralChange
    });
    
    this.data = newData;
    this.lastDataHash = newDataHash;

    if (this.mapReady) {
      if (isStructuralChange) {
        console.log('[CoverageMap] Structural change detected, full re-render');
        this.renderAllAssets().catch(err => {
          console.error('[CoverageMap] Asset render error:', err);
          console.error('[CoverageMap] Error stack:', err?.stack);
        });
      } else {
        console.log('[CoverageMap] Status update only, incremental update');
        this.updateGraphicsIncremental().catch(err => {
          console.error('[CoverageMap] Incremental update error:', err);
          // Fallback to full render on error
          this.renderAllAssets().catch(renderErr => {
            console.error('[CoverageMap] Fallback render error:', renderErr);
          });
        });
      }
    } else {
      console.log('[CoverageMap] Map not ready yet, data stored for later rendering');
    }
  }
  
  // Check if status/uptime has changed between old and new data
  private hasStatusChanged(newData: CoverageMapData, oldData: CoverageMapData): boolean {
    // Check towers
    if (newData.towers?.length !== oldData.towers?.length) return true;
    for (let i = 0; i < (newData.towers?.length || 0); i++) {
      const newTower = newData.towers[i];
      const oldTower = oldData.towers.find(t => String(t.id || t._id) === String(newTower.id || newTower._id));
      if (!oldTower) return true;
      if (newTower.status !== oldTower.status || 
          newTower.uptimePercent !== oldTower.uptimePercent) {
        return true;
      }
    }
    
    // Check sectors
    if (newData.sectors?.length !== oldData.sectors?.length) return true;
    for (let i = 0; i < (newData.sectors?.length || 0); i++) {
      const newSector = newData.sectors[i];
      const oldSector = oldData.sectors.find(s => String(s.id || s._id) === String(newSector.id || newSector._id));
      if (!oldSector) return true;
      if (newSector.status !== oldSector.status || 
          newSector.uptimePercent !== oldSector.uptimePercent) {
        return true;
      }
    }
    
    // Check CPE
    if (newData.cpeDevices?.length !== oldData.cpeDevices?.length) return true;
    for (let i = 0; i < (newData.cpeDevices?.length || 0); i++) {
      const newCPE = newData.cpeDevices[i];
      const oldCPE = oldData.cpeDevices.find(c => String(c.id || c._id) === String(newCPE.id || newCPE._id));
      if (!oldCPE) return true;
      if (newCPE.status !== oldCPE.status || 
          newCPE.uptimePercent !== oldCPE.uptimePercent) {
        return true;
      }
    }
    
    // Check equipment
    if (newData.equipment?.length !== oldData.equipment?.length) return true;
    for (let i = 0; i < (newData.equipment?.length || 0); i++) {
      const newEquip = newData.equipment[i];
      const oldEquip = oldData.equipment.find(e => String(e.id || e._id) === String(newEquip.id || newEquip._id));
      if (!oldEquip) return true;
      if (newEquip.status !== oldEquip.status || 
          newEquip.uptimePercent !== oldEquip.uptimePercent) {
        return true;
      }
    }
    
    return false;
  }
  
  // Public method to update only status/uptime without full data refresh
  public updateUptimeStatus(updates: {
    towers?: Array<{ id: string, status?: string, uptimePercent?: number }>;
    sectors?: Array<{ id: string, status?: string, uptimePercent?: number }>;
    cpeDevices?: Array<{ id: string, status?: string, uptimePercent?: number }>;
    equipment?: Array<{ id: string, status?: string, uptimePercent?: number }>;
  }): void {
    if (!this.mapReady || !this.graphicsLayer) {
      return;
    }
    
    console.log('[CoverageMap] updateUptimeStatus called, updating colors only');
    this.updateGraphicsIncrementalFromUpdates(updates).catch(err => {
      console.error('[CoverageMap] Error updating uptime status:', err);
    });
  }
  
  // Update graphics from status updates only
  private async updateGraphicsIncrementalFromUpdates(updates: {
    towers?: Array<{ id: string, status?: string, uptimePercent?: number }>;
    sectors?: Array<{ id: string, status?: string, uptimePercent?: number }>;
    cpeDevices?: Array<{ id: string, status?: string, uptimePercent?: number }>;
    equipment?: Array<{ id: string, status?: string, uptimePercent?: number }>;
  }): Promise<void> {
    if (!this.graphicsLayer || !this.mapView) return;
    
    try {
      const [
        { default: SimpleMarkerSymbol },
        { default: SimpleFillSymbol },
        { default: PictureMarkerSymbol }
      ] = await Promise.all([
        import('@arcgis/core/symbols/SimpleMarkerSymbol.js'),
        import('@arcgis/core/symbols/SimpleFillSymbol.js'),
        import('@arcgis/core/symbols/PictureMarkerSymbol.js')
      ]);
      
      let updatedCount = 0;
      const isMobile = window.innerWidth <= 768;
      const iconSize = isMobile ? 48 : 40;
      const symbolSize = isMobile ? '28px' : '20px';
      const outlineWidth = isMobile ? 4 : 3;
      
      // Update towers
      if (updates.towers) {
        for (const update of updates.towers) {
          const graphicId = `tower-${update.id}`;
          const graphic = this.graphicsMap.get(graphicId);
          
          if (graphic) {
            // Find full tower data to get type
            const tower = this.data.towers.find(t => String(t.id || t._id) === update.id);
            if (tower) {
              let towerType: string;
              if (Array.isArray(tower.type)) {
                const preferredTypes = ['noc', 'warehouse', 'vehicle', 'rma', 'vendor', 'internet-access', 'internet'];
                const preferredType = tower.type.find((t: string) => preferredTypes.includes(t));
                towerType = preferredType || tower.type[0] || 'tower';
              } else {
                towerType = tower.type || 'tower';
              }
              
              const status = update.status || tower.status;
              let symbol;
              const customIcon = createLocationIcon(towerType, iconSize);
              
              if (customIcon) {
                symbol = new PictureMarkerSymbol(customIcon);
              } else {
                const color = getTowerColor(towerType, status);
                symbol = new SimpleMarkerSymbol({
                  style: 'circle',
                  color: color,
                  size: symbolSize,
                  outline: {
                    color: 'white',
                    width: outlineWidth
                  }
                });
              }
              
              graphic.symbol = symbol;
              graphic.attributes = {
                ...graphic.attributes,
                status: status,
                uptimePercent: update.uptimePercent ?? tower.uptimePercent
              };
              updatedCount++;
            }
          }
        }
      }
      
      // Update sectors
      if (updates.sectors) {
        for (const update of updates.sectors) {
          const graphicId = `sector-${update.id}`;
          const graphic = this.graphicsMap.get(graphicId);
          
          if (graphic) {
            const sector = this.data.sectors.find(s => String(s.id || s._id) === update.id);
            if (sector) {
              const color = getBandColor(sector.band || sector.technology);
              const rgbaColor = hexToRgb(color);
              const transparentColor = [...rgbaColor, 0.3];
              
              const symbol = new SimpleFillSymbol({
                style: 'solid',
                color: transparentColor,
                outline: {
                  color: color,
                  width: 1
                }
              });
              
              graphic.symbol = symbol;
              graphic.attributes = {
                ...graphic.attributes,
                status: update.status ?? sector.status,
                uptimePercent: update.uptimePercent ?? sector.uptimePercent
              };
              updatedCount++;
            }
          }
        }
      }
      
      // Update CPE
      if (updates.cpeDevices) {
        for (const update of updates.cpeDevices) {
          const graphicId = `cpe-${update.id}`;
          const graphic = this.graphicsMap.get(graphicId);
          
          if (graphic) {
            const status = update.status;
            const color = status === 'online' ? '#10b981' : '#ef4444';
            const fillSymbol = new SimpleFillSymbol({
              color: [...hexToRgb(color), 0.5],
              outline: {
                color: color,
                width: 1
              }
            });
            
            graphic.symbol = fillSymbol;
            graphic.attributes = {
              ...graphic.attributes,
              status: status,
              uptimePercent: update.uptimePercent
            };
            updatedCount++;
          }
        }
      }
      
      // Update equipment
      if (updates.equipment) {
        for (const update of updates.equipment) {
          const graphicId = `equipment-${update.id}`;
          const graphic = this.graphicsMap.get(graphicId);
          
          if (graphic) {
            const status = update.status;
            const color = getEquipmentColor(status);
            const symbolSize = isMobile ? '16px' : '12px';
            const outlineWidth = isMobile ? 2 : 1;
            
            const symbol = new SimpleMarkerSymbol({
              style: 'circle',
              color: color,
              size: symbolSize,
              outline: {
                color: 'white',
                width: outlineWidth
              }
            });
            
            graphic.symbol = symbol;
            graphic.attributes = {
              ...graphic.attributes,
              status: status,
              uptimePercent: update.uptimePercent
            };
            updatedCount++;
          }
        }
      }
      
      console.log(`[CoverageMap] ✅ Updated ${updatedCount} graphics with new status/uptime`);
    } catch (error) {
      console.error('[CoverageMap] Error updating graphics from status updates:', error);
      throw error;
    }
  }
  
  // Generate a hash of data structure (IDs only, not status/uptime)
  private getDataStructureHash(data: CoverageMapData): string {
    const towerIds = (data.towers || []).map(t => String(t.id || t._id)).sort().join(',');
    const sectorIds = (data.sectors || []).map(s => String(s.id || s._id)).sort().join(',');
    const cpeIds = (data.cpeDevices || []).map(c => String(c.id || c._id)).sort().join(',');
    const equipmentIds = (data.equipment || []).map(e => String(e.id || e._id)).sort().join(',');
    return `${towerIds}|${sectorIds}|${cpeIds}|${equipmentIds}`;
  }

  public setFilters(filters: CoverageMapFilters): void {
    const previousShowMarketing = this.filters?.showMarketing ?? true;
    this.filters = filters;
    
    // Clear marketing layer when filter is turned off
    if (this.mapReady && previousShowMarketing && !filters.showMarketing && this.marketingLayer && this.marketingLayer.graphics) {
      this.marketingLayer.removeAll();
      console.log('[CoverageMap] Marketing layer cleared (filter hidden)');
    }
    
    if (this.mapReady) {
      this.renderAllAssets().catch(err => console.error('[CoverageMap] Asset render error:', err));
      this.renderMarketingLeads().catch(err => console.error('[CoverageMap] Marketing render error:', err));
    }
  }

  public setPlanFeatures(features: PlanLayerFeature[]): void {
    this.planDraftFeatures = (features ?? []).map(feature => this.normalizePlanFeature(feature));
    this.hasPerformedInitialFit = false;
    if (this.mapReady) {
      this.renderPlanDrafts()
        .then(() => {
          // Always fit to plan features if they exist, otherwise check for other graphics
          if (this.planDraftFeatures.length > 0) {
            return this.fitMapToVisibleGraphics(true);
          }
          return this.fitMapToVisibleGraphics();
        })
        .catch(err => console.error('[CoverageMap] Plan draft render error:', err));
    }
  }

  public setPlanFeaturesVisibility(visible: boolean): void {
    if (this.planDraftLayer && this.mapReady) {
      this.planDraftLayer.visible = visible;
      if (!visible && this.planDraftLayer.graphics) {
        this.planDraftLayer.removeAll();
        console.log('[CoverageMap] Plan features layer hidden and cleared');
      } else {
        // Re-render plan features if visible
        this.renderPlanDrafts().catch(err => console.error('[CoverageMap] Plan draft render error:', err));
      }
    }
  }

  public setProjectOverlays(overlays: Map<string, PlanLayerFeature[]>): void {
    this.projectOverlays = overlays;
    this.hasPerformedInitialFit = false;
    if (this.mapReady) {
      this.renderProjectOverlays()
        .then(() => {
          // Fit to project overlays if they exist and no other content
          if (this.projectOverlays.size > 0 && this.getTotalFeatureCount() === this.getProjectOverlayCount()) {
            return this.fitMapToVisibleGraphics(true);
          }
          return this.fitMapToVisibleGraphics();
        })
        .catch(err => console.error('[CoverageMap] Project overlay render error:', err));
    }
  }

  public setMarketingLeads(leads: PlanMarketingAddress[]): void {
    const previousCount = this.marketingLeads.length;
    const incomingLeads = Array.isArray(leads) ? [...leads] : [];
    
    // Check if leads have changed (different count or different content)
    // If leads changed, we need to clear and re-render to remove markers from hidden plans
    let leadsChanged = previousCount !== incomingLeads.length;
    if (!leadsChanged && previousCount > 0 && incomingLeads.length > 0) {
      // Check if the content is different by comparing address keys
      const previousKeys = new Set(this.marketingLeads.map(l => 
        `${toNumeric(l.latitude) ?? ''},${toNumeric(l.longitude) ?? ''},${(l.addressLine1 ?? '').toLowerCase()}`
      ));
      const incomingKeys = new Set(incomingLeads.map(l => 
        `${toNumeric(l.latitude) ?? ''},${toNumeric(l.longitude) ?? ''},${(l.addressLine1 ?? '').toLowerCase()}`
      ));
      // Different if sizes don't match or if there are keys in one but not the other
      leadsChanged = previousKeys.size !== incomingKeys.size || 
        [...previousKeys].some(key => !incomingKeys.has(key)) ||
        [...incomingKeys].some(key => !previousKeys.has(key));
    }
    
    // Clear layer if leads changed (visibility toggle, project deleted, etc.)
    // This ensures markers from hidden projects are removed
    if (leadsChanged && this.marketingLayer && this.marketingLayer.graphics && this.mapReady) {
      this.marketingLayer.removeAll();
      console.log('[CoverageMap] Marketing layer cleared (leads changed)', {
        previousCount,
        incomingCount: incomingLeads.length
      });
    }
    
    // Always update the leads array (even if empty) to reflect current state
    // Backend returns full list, not incremental updates
    this.marketingLeads = incomingLeads;

    const shouldAutoFit =
      previousCount === 0 &&
      this.marketingLeads.length > 0 &&
      !this.hasPerformedInitialFit;
    
    if (this.mapReady) {
      // Render leads (layer is already cleared if leads changed)
      this.renderMarketingLeads()
        .then(() => {
          console.log('[CoverageMap] Marketing leads rendered', {
            leadCount: this.marketingLeads.length,
            markerCount: this.marketingLayer?.graphics?.length || 0,
            hadPrevious: previousCount > 0,
            leadsChanged
          });
          
          if (!shouldAutoFit) {
            return;
          }

          const hasPlanFeatures = this.planDraftLayer?.graphics?.length > 0;
          if (hasPlanFeatures) {
            return;
          }

          const hasOtherGraphics = this.graphicsLayer?.graphics?.length > 0;
          const hasMarketingGraphics =
            this.filters.showMarketing && this.marketingLayer?.graphics?.length > 0;

          if (hasOtherGraphics || hasMarketingGraphics) {
            return this.fitMapToVisibleGraphics(true);
          }
        })
        .catch(err => console.error('[CoverageMap] Marketing render error:', err));
    }
  }

  public clearMarketingLeads(): void {
    // Clear marketing leads data and layer
    this.marketingLeads = [];
    if (this.marketingLayer && this.marketingLayer.graphics) {
      this.marketingLayer.removeAll();
    }
    console.log('[CoverageMap] Marketing leads cleared');
  }

  public async centerMapOnLocation(lat: number, lon: number, zoom?: number): Promise<void> {
    if (!this.mapView || !this.mapReady) {
      console.warn('[CoverageMap] Map not ready for centering');
      return;
    }

    try {
      await this.mapView.when();
      const targetZoom = zoom ?? this.mapView.zoom ?? 12;
      
      await this.mapView.goTo(
        {
          center: [lon, lat],
          zoom: targetZoom
        },
        {
          animate: true,
          duration: 1000
        }
      );
      console.log('[CoverageMap] Map centered on location:', lat, lon);
    } catch (error: any) {
      if (error?.name === 'view:goto-interrupted') {
        console.log('[CoverageMap] Map centering interrupted by new data load (expected)');
        return;
      }
      console.warn('[CoverageMap] Map centering failed:', error);
    }
  }

  private async centerOnUSOrLastDeployedPlan(): Promise<void> {
    // Center on contiguous US by default
    try {
      await this.mapView.when();
      await this.mapView.goTo({
        center: [-98.5795, 39.8283], // Geographic center of contiguous US
        zoom: 5
      }, {
        animate: false
      });
      this.hasPerformedInitialFit = true;
      console.log('[CoverageMap] Centered on US (no objects to display)');
    } catch (err) {
      console.warn('[CoverageMap] Failed to center on US:', err);
    }
  }

  public async centerMapOnFeatures(features: PlanLayerFeature[]): Promise<void> {
    if (!this.mapView || !this.mapReady || !features || features.length === 0) {
      return;
    }

    try {
      await this.mapView.when();
      
      const coordinates: Array<{ lat: number; lon: number }> = [];
      
      for (const feature of features) {
        if (feature.geometry?.type === 'Point' && feature.geometry.coordinates) {
          const [lon, lat] = feature.geometry.coordinates;
          if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
            coordinates.push({ lat, lon });
          }
        } else if (feature.geometry?.type === 'Polygon' && feature.geometry.coordinates) {
          // Get center of polygon
          const rings = feature.geometry.coordinates;
          if (rings && rings.length > 0 && rings[0].length > 0) {
            let sumLat = 0;
            let sumLon = 0;
            let count = 0;
            for (const ring of rings) {
              for (const coord of ring) {
                const [lon, lat] = coord;
                if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
                  sumLat += lat;
                  sumLon += lon;
                  count++;
                }
              }
            }
            if (count > 0) {
              coordinates.push({ lat: sumLat / count, lon: sumLon / count });
            }
          }
        }
      }

      if (coordinates.length === 0) {
        return;
      }

      // Calculate bounding box
      const lats = coordinates.map(c => c.lat);
      const lons = coordinates.map(c => c.lon);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);

      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;

      // Calculate zoom level based on bounding box
      const latSpan = maxLat - minLat;
      const lonSpan = maxLon - minLon;
      const maxSpan = Math.max(latSpan, lonSpan);
      
      let targetZoom = 12;
      if (maxSpan > 1) targetZoom = 8;
      else if (maxSpan > 0.5) targetZoom = 9;
      else if (maxSpan > 0.25) targetZoom = 10;
      else if (maxSpan > 0.1) targetZoom = 11;
      else if (maxSpan > 0.05) targetZoom = 12;
      else if (maxSpan > 0.01) targetZoom = 13;
      else targetZoom = 14;

      await this.mapView.goTo(
        {
          center: [centerLon, centerLat],
          zoom: targetZoom
        },
        {
          animate: true,
          duration: 1000
        }
      );
      console.log('[CoverageMap] Map centered on features:', coordinates.length, 'features');
    } catch (error: any) {
      if (error?.name === 'view:goto-interrupted') {
        console.log('[CoverageMap] Map centering interrupted by new data load (expected)');
        return;
      }
      console.warn('[CoverageMap] Map centering on features failed:', error);
    }
  }

  public async renderPlanDrafts(features?: PlanLayerFeature[]): Promise<void> {
    if (!this.planDraftLayer || !this.mapView) return;

    const planFeatures = features ?? this.planDraftFeatures;
    await this.internalRenderPlanDrafts(planFeatures);
  }

  private async initializeMap(): Promise<void> {
    if (!this.container) {
      throw new Error('Coverage map container not available');
    }

    console.log('Initializing Coverage Map with ArcGIS...');

    // Set ArcGIS API key if available
    try {
      const { default: esriConfig } = await import('@arcgis/core/config.js');
      const arcgisApiKey = import.meta.env.PUBLIC_ARCGIS_API_KEY;
      if (arcgisApiKey) {
        esriConfig.apiKey = arcgisApiKey;
        console.log('[CoverageMap] ArcGIS API key configured');
      }
    } catch (configError) {
      console.warn('[CoverageMap] Failed to configure ArcGIS API key:', configError);
    }

    const [
      { default: Map },
      { default: MapView },
      { default: GraphicsLayer },
      webMercatorUtilsModule,
      reactiveUtilsModule
    ] = await Promise.all([
      import('@arcgis/core/Map.js'),
      import('@arcgis/core/views/MapView.js'),
      import('@arcgis/core/layers/GraphicsLayer.js'),
      import('@arcgis/core/geometry/support/webMercatorUtils.js'),
      import('@arcgis/core/core/reactiveUtils.js')
    ]);

    this.webMercatorUtils =
      (webMercatorUtilsModule && 'default' in webMercatorUtilsModule
        ? webMercatorUtilsModule.default
        : webMercatorUtilsModule) ?? null;
    this.reactiveUtils =
      (reactiveUtilsModule && 'default' in reactiveUtilsModule
        ? reactiveUtilsModule.default
        : reactiveUtilsModule) ?? null;

    this.backhaulLayer = new GraphicsLayer({ title: 'Backhaul Links', listMode: 'show' });
    this.graphicsLayer = new GraphicsLayer({ title: 'Network Assets', listMode: 'show' });
    this.marketingLayer = new GraphicsLayer({ title: 'Marketing Addresses', listMode: 'show' });
    this.planDraftLayer = new GraphicsLayer({ title: 'Plan Features', listMode: 'show' });
    this.projectOverlayLayer = new GraphicsLayer({ title: 'Project Overlays', listMode: 'show' });

    try {
      this.map = new Map({
        basemap: this.currentBasemap,
        layers: [this.backhaulLayer, this.graphicsLayer, this.marketingLayer, this.planDraftLayer, this.projectOverlayLayer]
      });
    } catch (basemapError) {
      console.warn('Failed to load basemap, trying fallback...', basemapError);
      this.map = new Map({
        basemap: 'gray-vector',
        layers: [this.backhaulLayer, this.graphicsLayer, this.marketingLayer, this.planDraftLayer, this.projectOverlayLayer]
      });
      this.currentBasemap = 'gray-vector';
    }

    const isMobile = window.innerWidth <= 768;
    this.mapView = new MapView({
      container: this.container,
      map: this.map,
      center: [-98.5795, 39.8283],
      zoom: isMobile ? 6 : 5,
      ui: {
        components: []
      },
      constraints: {
        rotationEnabled: !isMobile,
        snapToZoom: true,
        minZoom: 3,
        maxZoom: 20
      },
      navigation: {
        gamepad: {
          enabled: false
        },
        browserTouchPanEnabled: true,
        momentumEnabled: true
        // Mouse wheel zoom is enabled by default in ArcGIS 4.x
      },
      popup: {
        dockEnabled: true,
        dockOptions: {
          buttonEnabled: true,
          breakpoint: {
            width: 544,
            height: 544
          },
          position: isMobile ? 'bottom-center' : 'top-right'
        },
        viewModel: {
          includeDefaultActions: false,
          actions: isMobile
            ? [
                {
                  type: 'button' as const,
                  title: 'View Details',
                  id: 'view-details',
                  className: 'esri-icon-description'
                }
              ]
            : []
        },
        ...(isMobile && {
          width: '90vw',
          height: 'auto',
          maxHeight: '60vh'
        })
      }
    });

    await this.mapView.when();
    console.log('MapView ready');

    // Require modifier key (Ctrl/Cmd) for mouse wheel zoom to prevent accidental zooming
    this.setupModifierKeyZoom();
    
    await this.addMobileUIControls();
    this.addTouchEventHandling();
    this.registerPointerHandlers();
    this.registerDragHandlers();
    this.watchViewExtent();
    this.setupMessageListener();

    console.log('Coverage Map initialized');
  }

  private async addMobileUIControls(): Promise<void> {
    if (!this.mapView) return;

    const isMobile = window.innerWidth <= 768;
    
    // Check if we're in plan mode or deploy mode - if so, don't show LayerList (we have custom filter panel or it's not needed)
    const isPlanMode = (() => {
      if (typeof window === 'undefined') return false;
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode');
      if (modeParam) {
        return modeParam.toLowerCase() === 'plan';
      }
      return urlParams.get('planMode') === 'true';
    })();

    const isDeployMode = (() => {
      if (typeof window === 'undefined') return false;
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode');
      return modeParam?.toLowerCase() === 'deploy' || urlParams.get('deployMode') === 'true';
    })();

    const shouldHideLayerList = isPlanMode || isDeployMode;

    try {
      // Import widgets conditionally to avoid type issues
      const [
        { default: Zoom },
        { default: Compass }
      ] = await Promise.all([
        import('@arcgis/core/widgets/Zoom.js'),
        import('@arcgis/core/widgets/Compass.js')
      ]);
      
      // Only import LayerList if not in plan mode or deploy mode
      let LayerList: any = null;
      if (!shouldHideLayerList) {
        const layerListModule = await import('@arcgis/core/widgets/LayerList.js');
        LayerList = layerListModule.default;
      }

      const zoom = new Zoom({
        view: this.mapView,
        layout: isMobile ? 'horizontal' : 'vertical'
      });

      this.mapView.ui.add(zoom, {
        position: 'bottom-right',
        index: 0
      });

      // Only add LayerList widget if not in plan mode or deploy mode (plan mode has custom filter panel, deploy mode doesn't need it)
      if (!shouldHideLayerList && LayerList) {
        const layerList = new LayerList({
          view: this.mapView,
          listItemCreatedFunction: (event: any) => {
            const item = event.item;
            // Customize layer list items if needed
            if (item.layer === this.drawingGraphicsLayer) {
              // Hide drawing layer from list (it's temporary)
              item.visible = false;
            }
          }
        });

        this.mapView.ui.add(layerList, {
          position: 'top-right',
          index: 1
        });
      }

      if (isMobile) {
        const compass = new Compass({
          view: this.mapView,
          label: 'Reset rotation'
        });

        this.mapView.ui.add(compass, {
          position: 'top-left',
          index: 2
        });
      }
    } catch (err) {
      console.error('Failed to add mobile UI controls:', err);
    }
  }

  private registerPointerHandlers(): void {
    if (!this.mapView) return;

    this.mapView.on('click', (event: any) => {
      // Don't handle clicks when drawing - let Sketch widget handle them
      if (this.isDrawingMode && this.sketchWidget) {
        console.log('[CoverageMap] Click during drawing mode - letting Sketch widget handle it');
        return;
      }
      this.handleMapClick(event).catch(err => console.error('Map click error:', err));
    });

    this.mapView.on('pointer-move', (event: any) => {
      event.stopPropagation();
    });

    // Prevent browser context menu on right-click
    this.mapView.container.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }, true); // Use capture phase to catch it early

    this.mapView.on('pointer-down', async (event: any) => {
      if (event.button !== 2) {
        return;
      }

      const hitTest = await this.mapView!.hitTest(event);
      if (hitTest.results.length > 0) {
        const interactiveResult = hitTest.results.find((result: any) => {
          const attrs = result?.graphic?.attributes;
          return attrs && typeof attrs.type !== 'undefined' && typeof attrs.id !== 'undefined';
        });

        if (interactiveResult) {
          const attrs = interactiveResult.graphic.attributes;
          this.dispatch('asset-click', {
            type: attrs.type,
            id: attrs.id,
            data: attrs,
            screenX: event.x,
            screenY: event.y,
            isRightClick: true
          });
          return;
        }
      }

      const mapPoint = event.mapPoint ?? this.mapView!.toMap({ x: event.x, y: event.y });
      if (!mapPoint) {
        return;
      }

      this.dispatch('map-right-click', {
        latitude: mapPoint.latitude,
        longitude: mapPoint.longitude,
        screenX: event.x,
        screenY: event.y
      });
    });
  }

  private registerDragHandlers(): void {
    if (!this.mapView) return;

    this.mapView.on('drag', async (event: any) => {
      if (!this.mapView) return;

      if (event.action === 'start') {
        const hitTest = await this.mapView.hitTest(event);
        const target = hitTest.results.find((result: any) => {
          return (
            result?.graphic?.layer === this.planDraftLayer &&
            result?.graphic?.attributes?.isPlanDraft &&
            result?.graphic?.geometry?.type === 'point'
          );
        });

        if (!target) {
          return;
        }

        if (event.native && event.native.button !== 0 && event.native.buttons !== 1) {
          return;
        }

        event.stopPropagation();
        this.planDraftDragContext = {
          featureId: target.graphic.attributes.id,
          planId: target.graphic.attributes.planId,
          graphic: target.graphic,
          startGeometry: target.graphic.geometry?.clone ? target.graphic.geometry.clone() : { ...target.graphic.geometry }
        };
        this.mapView.cursor = 'grabbing';
      } else if (event.action === 'update' && this.planDraftDragContext) {
        event.stopPropagation();
        const mapPoint = event.mapPoint ?? this.mapView.toMap(event);
        if (!mapPoint) {
          return;
        }
        this.planDraftDragContext.graphic.geometry = mapPoint;
      } else if (event.action === 'end' && this.planDraftDragContext) {
        event.stopPropagation();
        const mapPoint = event.mapPoint ?? this.mapView.toMap(event);
        if (mapPoint) {
          const planGeometry = this.toPlanGeometryFromPoint(mapPoint);
          this.updatePlanDraftFeatureGeometryInMemory(this.planDraftDragContext.featureId, planGeometry);
          this.dispatch('plan-feature-moved', {
            featureId: this.planDraftDragContext.featureId,
            planId: this.planDraftDragContext.planId,
            geometry: planGeometry,
            latitude: mapPoint.latitude,
            longitude: mapPoint.longitude
          });
        }
        this.mapView.cursor = 'default';
        this.planDraftDragContext = null;
      } else if (event.action === 'cancel' && this.planDraftDragContext) {
        event.stopPropagation();
        if (this.planDraftDragContext.startGeometry) {
          this.planDraftDragContext.graphic.geometry = this.planDraftDragContext.startGeometry;
        }
        this.mapView.cursor = 'default';
        this.planDraftDragContext = null;
      }
    });
  }

  private watchViewExtent(): void {
    if (!this.mapView) return;

    if (this.extentWatchHandle) {
      if (typeof this.extentWatchHandle.remove === 'function') {
        this.extentWatchHandle.remove();
      } else if (typeof this.extentWatchHandle === 'function') {
        this.extentWatchHandle();
      }
    }
    this.extentWatchHandle = null;

    const broadcast = (extent: any) => {
      if (!extent) return;
      if (this.extentPostTimer) {
        window.clearTimeout(this.extentPostTimer);
      }
      this.extentPostTimer = window.setTimeout(() => {
        this.broadcastViewExtent(extent);
      }, 200);
    };

    if (this.mapView.extent) {
      broadcast(this.mapView.extent);
    }

    if (this.reactiveUtils?.watch) {
      this.extentWatchHandle = this.reactiveUtils.watch(
        () => this.mapView?.extent,
        (extent: any) => {
          broadcast(extent);
        },
        { initial: false }
      );
    } else if (typeof this.mapView.watch === 'function') {
      this.extentWatchHandle = this.mapView.watch('extent', (extent: any) => {
        broadcast(extent);
      });
    }
  }

  private broadcastViewExtent(extent: any): void {
    const payload = this.buildExtentPayload(extent);
    if (!payload) return;

    try {
      window.parent?.postMessage(
        {
          source: 'coverage-map',
          type: 'view-extent',
          payload
        },
        '*'
      );
    } catch (err) {
      console.warn('[CoverageMap] Failed to post view extent', err);
    }
  }

  private handleMessage(event: MessageEvent): void {
    const { source, type, payload } = event.data || {};
    
    // Handle messages from shared-map (internal communication)
    if (source === 'shared-map') {
      if (type === 'request-extent') {
        const currentExtent = this.mapView?.extent;
        if (currentExtent) {
          this.broadcastViewExtent(currentExtent);
        }
      } else if (type === 'center-map-on-location' && payload) {
        const { lat, lon, zoom } = payload;
        if (typeof lat === 'number' && typeof lon === 'number') {
          this.centerMapOnLocation(lat, lon, zoom).catch(err => {
            console.error('[CoverageMap] Failed to center map on location:', err);
          });
        }
      }
      return;
    }
    
    // Handle messages from plan-page (external communication from parent iframe)
    if (source === 'plan-page') {
      if (type === 'enable-rectangle-drawing') {
        console.log('[CoverageMap] Received message from plan-page: enable-rectangle-drawing');
        this.enableRectangleDrawing().catch(err => {
          console.error('[CoverageMap] Failed to enable rectangle drawing:', err);
        });
      } else if (type === 'disable-rectangle-drawing') {
        console.log('[CoverageMap] Received message from plan-page: disable-rectangle-drawing');
        this.disableRectangleDrawing(false); // Don't clear graphics when disabling
      } else if (type === 'clear-drawing-graphics') {
        console.log('[CoverageMap] Received message from plan-page: clear-drawing-graphics');
        this.clearDrawingGraphics();
      }
      return;
    }
  }

  private setupMessageListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleMessage.bind(this));
    }
  }

  private buildExtentPayload(extent: any): any {
    const center = this.extractLatLon(extent?.center ?? this.mapView?.center);
    const boundingBox = this.extractBoundingBox(extent);
    if (!center || !boundingBox) {
      return null;
    }

    const spans = {
      latSpan: Math.abs(boundingBox.north - boundingBox.south),
      lonSpan: Math.abs(boundingBox.east - boundingBox.west)
    };

    return {
      center,
      boundingBox,
      spans,
      scale: this.mapView?.scale ?? null,
      zoom: this.mapView?.zoom ?? null
    };
  }

  private extractBoundingBox(extent: any): { west: number; south: number; east: number; north: number } | null {
    if (!extent) return null;
    const spatialReference = extent.spatialReference ?? this.mapView?.spatialReference;

    // Project Web Mercator or other coordinate systems to WGS84 lat/lon with full precision
    const southWest = this.projectXYToLatLon(extent.xmin, extent.ymin, spatialReference);
    const northEast = this.projectXYToLatLon(extent.xmax, extent.ymax, spatialReference);

    if (southWest && northEast) {
      // Return bounding box with full precision (JavaScript numbers preserve ~15-17 significant digits)
      // No rounding - use exact coordinates from map viewport
      return {
        west: Math.min(southWest.lon, northEast.lon),
        south: Math.min(southWest.lat, northEast.lat),
        east: Math.max(southWest.lon, northEast.lon),
        north: Math.max(southWest.lat, northEast.lat)
      };
    }

    // Fallback for geographic coordinates (WGS84) - already in lat/lon format
    if (
      typeof extent.xmin === 'number' &&
      typeof extent.ymin === 'number' &&
      typeof extent.xmax === 'number' &&
      typeof extent.ymax === 'number'
    ) {
      // Use full precision - no rounding
      return {
        west: extent.xmin,
        south: extent.ymin,
        east: extent.xmax,
        north: extent.ymax
      };
    }

    return null;
  }

  private extractLatLon(point: any): { lat: number; lon: number } | null {
    if (!point) return null;

    const lat = typeof point.latitude === 'number' ? point.latitude : undefined;
    const lon = typeof point.longitude === 'number' ? point.longitude : undefined;
    if (lat !== undefined && lon !== undefined && Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon };
    }

    if (typeof point.y === 'number' && typeof point.x === 'number') {
      return this.projectXYToLatLon(point.x, point.y, point.spatialReference);
    }

    return null;
  }

  private projectXYToLatLon(x: number, y: number, spatialReference?: any): { lat: number; lon: number } | null {
    if (typeof x !== 'number' || typeof y !== 'number') {
      return null;
    }

    if (spatialReference?.isGeographic || spatialReference?.wkid === 4326) {
      return { lat: y, lon: x };
    }

    if (
      (spatialReference?.isWebMercator || spatialReference?.wkid === 3857 || spatialReference?.wkid === 102100) &&
      this.webMercatorUtils?.xyToLngLat
    ) {
      try {
        const [lon, lat] = this.webMercatorUtils.xyToLngLat(x, y);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return { lat, lon };
        }
      } catch (err) {
        console.warn('[CoverageMap] Failed to convert WebMercator point', err);
      }
      return null;
    }

    if (this.webMercatorUtils?.xyToLngLat) {
      try {
        const [lon, lat] = this.webMercatorUtils.xyToLngLat(x, y);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return { lat, lon };
        }
      } catch {
        // ignore conversion error
      }
    }

    return null;
  }

  private updatePlanDraftFeatureGeometryInMemory(featureId: string, planGeometry: any): void {
    this.planDraftFeatures = this.planDraftFeatures.map(feature =>
      feature.id === featureId
        ? {
            ...feature,
            geometry: planGeometry,
            metadata: {
              ...(feature.metadata ?? {}),
              originalGeometry: planGeometry
            },
            updatedAt: new Date()
          }
        : feature
    );
  }

  private toPlanGeometryFromPoint(point: any): any {
    if (!point) return null;
    return {
      type: 'Point',
      coordinates: [point.longitude, point.latitude]
    };
  }

  private toEsriGeometryFromPlan(feature: PlanLayerFeature): any {
    const planGeometry = normalizePlanGeometry(feature.metadata?.originalGeometry ?? feature.geometry);
    if (!planGeometry) return null;

    const type = (planGeometry.type || '').toLowerCase();
    if (typeof planGeometry.longitude === 'number' && typeof planGeometry.latitude === 'number') {
      return {
        type: 'point',
        longitude: planGeometry.longitude,
        latitude: planGeometry.latitude,
        spatialReference: { wkid: 4326 }
      };
    }

    switch (type) {
      case 'point': {
        const [longitude, latitude] = planGeometry.coordinates || [0, 0];
        return {
          type: 'point',
          longitude,
          latitude,
          spatialReference: { wkid: 4326 }
        };
      }
      case 'linestring': {
        const coordinates = planGeometry.coordinates || [];
        return {
          type: 'polyline',
          paths: [coordinates],
          spatialReference: { wkid: 4326 }
        };
      }
      case 'polygon': {
        const rings = planGeometry.coordinates || [];
        return {
          type: 'polygon',
          rings,
          spatialReference: { wkid: 4326 }
        };
      }
      default:
        return planGeometry;
    }
  }

  private normalizePlanFeature(feature: PlanLayerFeature): PlanLayerFeature {
    const planGeometry = normalizePlanGeometry(feature.metadata?.originalGeometry ?? feature.geometry);
    return {
      ...feature,
      featureType: feature.featureType || (feature as any).type || feature.properties?.featureType || 'plan',
      geometry: planGeometry,
      metadata: {
        ...(feature.metadata ?? {}),
        originalGeometry: planGeometry ?? feature.metadata?.originalGeometry ?? null
      }
    };
  }

  /**
   * Setup modifier key requirement for mouse wheel zoom
   * Prevents accidental zooming on Mac trackpads while allowing intentional zoom with Ctrl/Cmd
   * Mac-specific: Detects trackpad vs mouse and handles accordingly
   */
  private setupModifierKeyZoom(): void {
    if (!this.mapView || !this.mapView.container) return;
    
    const container = this.mapView.container;
    let isMacTrackpad = false;
    
    // Detect Mac trackpad (pinch gestures typically have ctrlKey set, but we want to allow panning)
    const detectMacTrackpad = (event: WheelEvent) => {
      // Mac trackpad characteristics:
      // - deltaY is typically small and smooth
      // - ctrlKey is often set for pinch-to-zoom gestures
      // - deltaMode is usually DOM_DELTA_PIXEL (0)
      const isSmoothScroll = Math.abs(event.deltaY) < 10 && event.deltaMode === 0;
      const isPinchGesture = event.ctrlKey && Math.abs(event.deltaY) > 0;
      
      // On Mac, allow pinch-to-zoom (ctrlKey + wheel) but prevent accidental scroll-zoom
      if (event.metaKey || (event.ctrlKey && isPinchGesture)) {
        // Intentional zoom gesture - allow it
        return false;
      }
      
      // For Mac trackpads, allow panning (scroll without modifier) but prevent zoom
      // For Windows/Linux mice, require Ctrl for zoom
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                    navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
      
      if (isMac && isSmoothScroll && !event.ctrlKey && !event.metaKey) {
        // Mac trackpad panning - allow default behavior (panning)
        return false;
      }
      
      // Prevent zoom if no modifier key is pressed
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      
      return false;
    };
    
    // Intercept wheel events
    container.addEventListener('wheel', (event: WheelEvent) => {
      detectMacTrackpad(event);
    }, { passive: false });
  }

  private addTouchEventHandling(): void {
    if (!this.mapView) return;

    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let longPressTimer: number | null = null;

    this.mapView.on('pointer-down', (event: any) => {
      if (event.pointerType === 'touch') {
        touchStartTime = Date.now();
        touchStartX = event.x;
        touchStartY = event.y;

        longPressTimer = window.setTimeout(() => {
          this.handleLongPress(event);
        }, 500);
      }
    });

    this.mapView.on('pointer-up', (event: any) => {
      if (event.pointerType === 'touch') {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }

        const touchDuration = Date.now() - touchStartTime;
        const touchDistance = Math.sqrt(
          Math.pow(event.x - touchStartX, 2) + Math.pow(event.y - touchStartY, 2)
        );

        if (touchDuration < 500 && touchDistance < 10) {
          return;
        }
      }
    });

    this.mapView.on('pointer-move', (event: any) => {
      if (event.pointerType === 'touch' && longPressTimer) {
        const touchDistance = Math.sqrt(
          Math.pow(event.x - touchStartX, 2) + Math.pow(event.y - touchStartY, 2)
        );

        if (touchDistance > 10) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    });
  }

  private handleLongPress(event: any): void {
    if (!this.mapView) return;
    const point = this.mapView.toMap(event);
    this.dispatch('map-right-click', {
      latitude: point.latitude,
      longitude: point.longitude,
      screenX: event.x,
      screenY: event.y
    });
  }

  private async handleMapClick(event: any): Promise<void> {
    if (!this.mapView) return;

    if (event.native && event.native.button !== 0) {
      return;
    }

    const response = await this.mapView.hitTest(event);
    if (response.results.length > 0) {
      const graphic = response.results[0].graphic;
      if (graphic && graphic.attributes) {
        const attrs = graphic.attributes;
        this.dispatch('asset-click', {
          type: attrs.type || attrs.featureType || null,
          id: attrs.id || attrs._id || null,
          data: attrs,
          screenX: event.x || event.native?.clientX || 0,
          screenY: event.y || event.native?.clientY || 0,
          isRightClick: false
        });
      }
    }
  }

  private async renderAllAssets(): Promise<void> {
    if (!this.graphicsLayer || !this.mapView) {
      console.warn('[CoverageMap] renderAllAssets called but map not ready:', {
        hasGraphicsLayer: !!this.graphicsLayer,
        hasMapView: !!this.mapView,
        mapReady: this.mapReady
      });
      return;
    }
    
    console.log('[CoverageMap] renderAllAssets starting:', {
      towersCount: this.data.towers?.length || 0,
      sectorsCount: this.data.sectors?.length || 0,
      cpeCount: this.data.cpeDevices?.length || 0,
      equipmentCount: this.data.equipment?.length || 0,
      filters: {
        showTowers: this.filters.showTowers,
        showSectors: this.filters.showSectors,
        showCPE: this.filters.showCPE,
        showEquipment: this.filters.showEquipment
      }
    });

    try {
      // Clear graphics tracking map on full render
      this.graphicsMap.clear();
      
      if (this.graphicsLayer) {
        this.graphicsLayer.removeAll();
      }
      if (this.backhaulLayer) {
        this.backhaulLayer.removeAll();
      }

      if (this.filters.showBackhaul && this.backhaulLayer) {
        await this.renderBackhaulLinks();
      }

      // Render towers
      if (this.filters.showTowers && Array.isArray(this.data.towers) && this.data.towers.length > 0) {
        const result = await renderTowers(this.data.towers, {
          graphicsLayer: this.graphicsLayer,
          graphicsMap: this.graphicsMap,
          mapView: this.mapView
        });
        console.log(`[CoverageMap] Towers rendering complete: ${result.rendered} rendered, ${result.skipped} skipped`);
      }

      // Render sectors
      if (this.filters.showSectors && this.graphicsLayer) {
        const filteredSectors = this.filterSectorsByBand(this.data.sectors || []);
        console.log('[CoverageMap] Filtered sectors by band:', {
          originalCount: this.data.sectors?.length || 0,
          filteredCount: filteredSectors.length
        });

        const result = await renderSectors(filteredSectors, {
          graphicsLayer: this.graphicsLayer,
          graphicsMap: this.graphicsMap,
          mapView: this.mapView,
          towers: this.data.towers || []
        });
        console.log(`[CoverageMap] Sectors rendering complete: ${result.rendered} rendered, ${result.skipped} skipped`);
      }

      // Render CPE devices
      if (this.filters.showCPE && Array.isArray(this.data.cpeDevices)) {
        const result = await renderCPEDevices(this.data.cpeDevices, {
          graphicsLayer: this.graphicsLayer,
          graphicsMap: this.graphicsMap
        });
        console.log(`[CoverageMap] CPE rendering complete: ${result.rendered} rendered, ${result.skipped} skipped`);
      }

      // Render equipment
      if (this.filters.showEquipment && Array.isArray(this.data.equipment)) {
        const locationTypeFilter = Array.isArray(this.filters.locationTypeFilter) ? this.filters.locationTypeFilter : [];
        const result = await renderEquipment(this.data.equipment, {
          graphicsLayer: this.graphicsLayer,
          graphicsMap: this.graphicsMap,
          locationTypeFilter
        });
        console.log(`[CoverageMap] Equipment rendering complete: ${result.rendered} rendered, ${result.skipped} skipped`);
      }

      const graphicsCount = this.graphicsLayer?.graphics?.length || 0;
      const towersCount = this.data.towers?.length || 0;
      const sectorsCount = this.data.sectors?.length || 0;
      const cpeCount = this.data.cpeDevices?.length || 0;
      const equipmentCount = this.data.equipment?.length || 0;
      
      // Log detailed information for debugging
      const towersWithLocation = this.data.towers?.filter((t: any) => 
        t.location && t.location.latitude != null && t.location.longitude != null
      ).length || 0;
      
      // Log actual tower data for first few towers
      const sampleTowers = this.data.towers?.slice(0, 3).map((t: any) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        hasLocation: !!t.location,
        lat: t.location?.latitude,
        lon: t.location?.longitude
      })) || [];
      
      console.log(`[CoverageMap] ✅ Rendered ${graphicsCount} graphics on map`, {
        totalGraphics: graphicsCount,
        dataCounts: {
          towers: towersCount,
          towersWithLocation: towersWithLocation,
          sectors: sectorsCount,
          cpe: cpeCount,
          equipment: equipmentCount
        },
        sampleTowers: sampleTowers,
        filters: {
          showTowers: this.filters.showTowers,
          showSectors: this.filters.showSectors,
          showCPE: this.filters.showCPE,
          showEquipment: this.filters.showEquipment
        },
        mapReady: this.mapReady,
        hasGraphicsLayer: !!this.graphicsLayer,
        hasMapView: !!this.mapView,
        graphicsLayerGraphicsCount: this.graphicsLayer?.graphics?.length
      });
    } catch (err) {
      console.error('Failed to render assets:', err);
      console.error('Error details:', err);
    }
  }

  // Incremental update method - only updates symbols for existing graphics
  private async updateGraphicsIncremental(): Promise<void> {
    if (!this.graphicsLayer || !this.mapView) {
      console.warn('[CoverageMap] updateGraphicsIncremental called but map not ready');
      return;
    }
    
    console.log('[CoverageMap] Starting incremental update');
    
    try {
      const [
        { default: SimpleMarkerSymbol },
        { default: SimpleFillSymbol },
        { default: PictureMarkerSymbol }
      ] = await Promise.all([
        import('@arcgis/core/symbols/SimpleMarkerSymbol.js'),
        import('@arcgis/core/symbols/SimpleFillSymbol.js'),
        import('@arcgis/core/symbols/PictureMarkerSymbol.js')
      ]);
      
      let updatedCount = 0;
      const isMobile = window.innerWidth <= 768;
      const iconSize = isMobile ? 48 : 40;
      const symbolSize = isMobile ? '28px' : '20px';
      const outlineWidth = isMobile ? 4 : 3;
      
      // Update tower graphics
      if (this.filters.showTowers && Array.isArray(this.data.towers)) {
        for (const tower of this.data.towers) {
          const graphicId = `tower-${tower.id}`;
          const graphic = this.graphicsMap.get(graphicId);
          
          if (graphic) {
            // Update symbol based on status
            let towerType: string;
            if (Array.isArray(tower.type)) {
              const preferredTypes = ['noc', 'warehouse', 'vehicle', 'rma', 'vendor', 'internet-access', 'internet'];
              const preferredType = tower.type.find((t: string) => preferredTypes.includes(t));
              towerType = preferredType || tower.type[0] || 'tower';
            } else {
              towerType = tower.type || 'tower';
            }
            
            let symbol;
            const customIcon = createLocationIcon(towerType, iconSize);
            
            if (customIcon) {
              symbol = new PictureMarkerSymbol(customIcon);
            } else {
              const color = getTowerColor(towerType, tower.status);
              symbol = new SimpleMarkerSymbol({
                style: 'circle',
                color: color,
                size: symbolSize,
                outline: {
                  color: 'white',
                  width: outlineWidth
                }
              });
            }
            
            graphic.symbol = symbol;
            // Update attributes
            graphic.attributes = {
              ...graphic.attributes,
              ...tower,
              status: tower.status
            };
            updatedCount++;
          }
        }
      }
      
      // Update sector graphics
      if (this.filters.showSectors && Array.isArray(this.data.sectors)) {
        for (const sector of this.data.sectors) {
          const graphicId = `sector-${sector.id}`;
          const graphic = this.graphicsMap.get(graphicId);
          
          if (graphic) {
            // Get color based on band/technology (same as full render)
            const color = getBandColor(sector.band || sector.technology);
            const rgbaColor = hexToRgb(color);
            const transparentColor = [...rgbaColor, 0.3];
            
            const symbol = new SimpleFillSymbol({
              style: 'solid',
              color: transparentColor,
              outline: {
                color: color,
                width: 1
              }
            });
            
            graphic.symbol = symbol;
            graphic.attributes = {
              ...graphic.attributes,
              ...sector,
              status: sector.status,
              uptimePercent: sector.uptimePercent
            };
            updatedCount++;
          }
        }
      }
      
      // Update CPE graphics
      if (this.filters.showCPE && Array.isArray(this.data.cpeDevices)) {
        for (const cpe of this.data.cpeDevices) {
          const graphicId = `cpe-${cpe.id}`;
          const graphic = this.graphicsMap.get(graphicId);
          
          if (graphic) {
            // CPE uses fill symbol (polygon) - same logic as full render
            const color = cpe.status === 'online' ? '#10b981' : '#ef4444';
            const fillSymbol = new SimpleFillSymbol({
              color: [...hexToRgb(color), 0.5],
              outline: {
                color: color,
                width: 1
              }
            });
            
            graphic.symbol = fillSymbol;
            graphic.attributes = {
              ...graphic.attributes,
              ...cpe,
              status: cpe.status,
              uptimePercent: cpe.uptimePercent
            };
            updatedCount++;
          }
        }
      }
      
      // Update equipment graphics
      if (this.filters.showEquipment && Array.isArray(this.data.equipment)) {
        for (const equip of this.data.equipment) {
          const graphicId = `equipment-${equip.id}`;
          const graphic = this.graphicsMap.get(graphicId);
          
          if (graphic) {
            // Equipment uses marker symbol - same logic as full render
            const color = getEquipmentColor(equip.status);
            const symbolSize = isMobile ? '16px' : '12px';
            const outlineWidth = isMobile ? 2 : 1;
            
            const symbol = new SimpleMarkerSymbol({
              style: 'circle',
              color: color,
              size: symbolSize,
              outline: {
                color: 'white',
                width: outlineWidth
              }
            });
            
            graphic.symbol = symbol;
            graphic.attributes = {
              ...graphic.attributes,
              ...equip,
              status: equip.status,
              uptimePercent: equip.uptimePercent
            };
            updatedCount++;
          }
        }
      }
      
      console.log(`[CoverageMap] ✅ Incrementally updated ${updatedCount} graphics`);
    } catch (error) {
      console.error('[CoverageMap] Error in incremental update:', error);
      throw error;
    }
  }

  private async renderMarketingLeads(): Promise<void> {
    if (!this.marketingLayer || !this.mapView) return;

    // Don't clear existing markers - accumulate them so user can see progress
    // Only add new markers that don't already exist

    if (!this.filters.showMarketing || !Array.isArray(this.marketingLeads) || this.marketingLeads.length === 0) {
      return;
    }

    try {
      const [
        { default: Graphic },
        { default: Point },
        { default: SimpleMarkerSymbol }
      ] = await Promise.all([
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/geometry/Point.js'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol.js')
      ]);

      const isMobile = window.innerWidth <= 768;
      const markerSize = isMobile ? '18px' : '12px';
      const outlineWidth = isMobile ? 2 : 1.5;

      // Deduplicate by normalized "house number + street" before rendering
      const deduplicatedLeads: PlanMarketingAddress[] = [];
      const streetKeyIndex = new Map<string, number>();
      const fallbackKeys = new Set<string>();

      this.marketingLeads.forEach((lead) => {
        const streetKey = this.normalizeStreetKey(lead.addressLine1);
        if (streetKey) {
          const existingIndex = streetKeyIndex.get(streetKey);
          if (existingIndex === undefined) {
            streetKeyIndex.set(streetKey, deduplicatedLeads.length);
            deduplicatedLeads.push(lead);
          } else {
            const existingLead = deduplicatedLeads[existingIndex];
            if (getLeadSourcePriority(lead) > getLeadSourcePriority(existingLead)) {
              deduplicatedLeads[existingIndex] = lead;
            }
          }
          return;
        }

        const fallbackKey = buildCoordinateKey(lead);
        if (!fallbackKey) {
          deduplicatedLeads.push(lead);
          return;
        }
        if (!fallbackKeys.has(fallbackKey)) {
          fallbackKeys.add(fallbackKey);
          deduplicatedLeads.push(lead);
        }
      });

      // Track which markers are already on the map to avoid duplicates
      const existingGraphicHashes = new Set<string>();
      if (this.marketingLayer && this.marketingLayer.graphics?.length > 0) {
        this.marketingLayer.graphics.forEach((graphic: any) => {
          const attrs = graphic.attributes || {};
          const lat = attrs.latitude;
          const lon = attrs.longitude;
          const addr = attrs.addressLine1 || '';
          const postal = attrs.postalCode || '';
          if (typeof lat === 'number' && typeof lon === 'number') {
            const hash = `${lat.toFixed(7)}|${lon.toFixed(7)}|${addr.toLowerCase()}|${postal}`;
            existingGraphicHashes.add(hash);
          }
        });
      }

      const seen = new Set<string>();
      let newMarkersAdded = 0;

      deduplicatedLeads.forEach((lead, index) => {
        const latitude = toNumeric(lead.latitude);
        const longitude = toNumeric(lead.longitude);
        if (latitude === null || longitude === null) {
          return;
        }

        const hash = `${latitude.toFixed(7)}|${longitude.toFixed(7)}|${(lead.addressLine1 ?? '').toLowerCase()}|${lead.postalCode ?? ''}`;
        
        // Skip if already in this batch or already on the map
        if (seen.has(hash) || existingGraphicHashes.has(hash)) {
          return;
        }
        seen.add(hash);
        existingGraphicHashes.add(hash); // Track as rendered

        const point = new Point({
          latitude,
          longitude
        });

        const symbol = new SimpleMarkerSymbol({
          style: 'diamond',
          color: '#f97316',
          size: markerSize,
          outline: {
            color: '#ffffff',
            width: outlineWidth
          }
        });

        const title = lead.addressLine1 ?? 'Potential Customer';
        const popupContent = buildMarketingPopupContent(lead, latitude, longitude);

        const graphic = new Graphic({
          geometry: point,
          symbol,
          attributes: {
            type: 'marketing-lead',
            id: `marketing-${index}-${hash}`,
            latitude,
            longitude,
            city: lead.city,
            state: lead.state,
            postalCode: lead.postalCode,
            country: lead.country,
            source: lead.source ?? 'marketing',
            addressLine1: lead.addressLine1,
            addressLine2: lead.addressLine2
          },
          popupTemplate: {
            title,
            content: popupContent
          }
        });

        this.marketingLayer!.add(graphic);
        newMarkersAdded++;
      });

      console.log(`[CoverageMap] Added ${newMarkersAdded} new marketing leads (${this.marketingLayer?.graphics?.length ?? 0} total on map)`);
    } catch (err) {
      console.error('[CoverageMap] Failed to render marketing leads:', err);
    }
  }

  private async fitMapToVisibleGraphics(force = false): Promise<void> {
    if (!this.mapView) return;
    if (this.hasPerformedInitialFit && !force) return;

    const graphics: any[] = [];

    // Prioritize plan features - if they exist, center on them
    if (this.planDraftLayer?.graphics?.length) {
      this.planDraftLayer.graphics.forEach((graphic: any) => graphics.push(graphic));
    }

    // Add other graphics if no plan features
    if (graphics.length === 0) {
      if (this.graphicsLayer?.graphics?.length) {
        this.graphicsLayer.graphics.forEach((graphic: any) => graphics.push(graphic));
      }

      if (this.filters.showMarketing && this.marketingLayer?.graphics?.length) {
        if (this.marketingLayer?.graphics) {
          this.marketingLayer.graphics.forEach((graphic: any) => graphics.push(graphic));
        }
      }
    }

    if (!graphics.length) {
      // No graphics to fit - only center on US if we have no plan features AND no marketing leads
      // If we have plan features or marketing leads (even if not visible), preserve the current view
      const hasMarketingLeads = this.marketingLeads.length > 0;
      if (this.planDraftFeatures.length === 0 && !hasMarketingLeads) {
        await this.centerOnUSOrLastDeployedPlan();
      }
      // Otherwise, preserve current map view (don't recenter)
      return;
    }

    try {
      await this.mapView.when();
      await this.mapView.goTo(graphics, {
        padding: 50
      });
      this.hasPerformedInitialFit = true;
    } catch (err) {
      console.warn('Map fit error:', err);
      const first = graphics[0];
      if (first?.geometry) {
        this.mapView.center = first.geometry;
      }
    }
  }

  private async renderBackhaulLinks(): Promise<void> {
    if (!this.backhaulLayer || !this.mapView) return;

    try {
      const [
        { default: Polyline },
        { default: Graphic },
        { default: SimpleLineSymbol },
        { default: Point }
      ] = await Promise.all([
        import('@arcgis/core/geometry/Polyline.js'),
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/symbols/SimpleLineSymbol.js'),
        import('@arcgis/core/geometry/Point.js')
      ]);

      this.data.equipment
        .filter(eq => eq.type === 'backhaul')
        .forEach(link => {
          try {
            const notes = JSON.parse(link.notes || '{}');
            const backhaulType = notes.backhaulType;

            if (backhaulType === 'fiber' && !this.filters.showFiber) return;
            if (backhaulType === 'fixed-wireless-licensed' && !this.filters.showWirelessLicensed) return;
            if (backhaulType === 'fixed-wireless-unlicensed' && !this.filters.showWirelessUnlicensed) return;

            let fromSite = this.data.towers.find(s => s.id === notes.fromSiteId);
            let toSite = this.data.towers.find(s => s.id === notes.toSiteId);

            if (!fromSite || !toSite) return;

            const polyline = new Polyline({
              paths: [
                [
                  [fromSite.location.longitude, fromSite.location.latitude],
                  [toSite.location.longitude, toSite.location.latitude]
                ]
              ]
            });

            const color = getBackhaulColor(backhaulType);

            const lineSymbol = new SimpleLineSymbol({
              color,
              width: 2,
              style: backhaulType === 'fiber' ? 'solid' : 'dash'
            });

            const graphic = new Graphic({
              geometry: polyline,
              symbol: lineSymbol,
              attributes: {
                type: 'backhaul',
                id: link.id,
                backhaulType: backhaulType,
                name: link.name || `${fromSite.name} ➜ ${toSite.name}`,
                fromSite: fromSite.name,
                toSite: toSite.name,
                capacity: notes.capacity || 'N/A',
                status: link.status
              },
              popupTemplate: {
                title: '{name}',
                content: createBackhaulPopupContent
              }
            });

            this.backhaulLayer!.add(graphic);
          } catch (err) {
            console.warn('Failed to render backhaul link:', err);
          }
        });
    } catch (err) {
      console.error('Failed to render backhaul links:', err);
    }
  }

  private async internalRenderPlanDrafts(features: PlanLayerFeature[]): Promise<void> {
    if (!this.planDraftLayer || !this.mapView) return;

    try {
      const [
        { default: Graphic },
        { default: SimpleMarkerSymbol },
        { default: PictureMarkerSymbol },
        { default: SimpleFillSymbol },
        { default: SimpleLineSymbol },
        { default: TextSymbol }
      ] = await Promise.all([
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol.js'),
        import('@arcgis/core/symbols/PictureMarkerSymbol.js'),
        import('@arcgis/core/symbols/SimpleFillSymbol.js'),
        import('@arcgis/core/symbols/SimpleLineSymbol.js'),
        import('@arcgis/core/symbols/TextSymbol.js')
      ]);

      if (this.planDraftLayer && this.planDraftLayer.graphics) {
        this.planDraftLayer.removeAll();
      }
      this.planDraftGraphics.clear();

      const isMobile = window.innerWidth <= 768;

      for (const feature of features) {
        const normalized = this.normalizePlanFeature(feature);
        const color = getPlanDraftColor(normalized.featureType || 'plan');
        const status = normalized.status || 'draft';
        const label =
          normalized.properties?.name ||
          normalized.properties?.siteName ||
          normalized.properties?.label ||
          `${normalized.featureType || 'plan'} draft`;

        const esriGeometry = this.toEsriGeometryFromPlan(normalized);
        if (!esriGeometry) {
          continue;
        }

        if (esriGeometry.type === 'point') {
          const iconConfig = createLocationIcon(normalized.featureType || 'plan', isMobile ? 48 : 36);
          const symbol = iconConfig
            ? new PictureMarkerSymbol(iconConfig)
            : new SimpleMarkerSymbol({
                style: 'circle',
                color,
                size: isMobile ? '24px' : '18px',
                outline: {
                  color: '#ffffff',
                  width: isMobile ? 3 : 2
                }
              });

          const attributes = {
            id: normalized.id,
            planId: normalized.planId,
            featureType: normalized.featureType,
            type: `plan-${normalized.featureType}`,
            status,
            name: label,
            isPlanDraft: true,
            properties: normalized.properties ?? {},
            latitude: esriGeometry.latitude ?? esriGeometry.y ?? null,
            longitude: esriGeometry.longitude ?? esriGeometry.x ?? null
          };

          const graphic = new Graphic({
            geometry: esriGeometry,
            symbol,
            attributes,
            popupTemplate: {
              title: label,
              content: `Type: ${normalized.featureType}<br>Status: ${status}`
            }
          });

          this.planDraftLayer!.add(graphic);
          this.planDraftGraphics.set(normalized.id, graphic);

          const textSymbol = new TextSymbol({
            text: label,
            color: '#1f2937',
            haloColor: '#ffffff',
            haloSize: isMobile ? '3px' : '2px',
            font: {
              size: isMobile ? 14 : 12,
              family: 'Arial'
            },
            yoffset: isMobile ? 18 : 12
          });

          const labelGraphic = new Graphic({ geometry: esriGeometry, symbol: textSymbol });
          this.planDraftLayer!.add(labelGraphic);
        } else if (esriGeometry.type === 'polyline') {
          const symbol = new SimpleLineSymbol({
            color,
            width: 2,
            style: 'short-dash'
          });

          const attributes = {
            id: normalized.id,
            planId: normalized.planId,
            featureType: normalized.featureType,
            type: `plan-${normalized.featureType}`,
            status,
            name: label,
            isPlanDraft: true,
            properties: normalized.properties ?? {}
          };

          const graphic = new Graphic({
            geometry: esriGeometry,
            symbol,
            attributes,
            popupTemplate: {
              title: label,
              content: `Type: ${normalized.featureType}<br>Status: ${status}`
            }
          });

          this.planDraftLayer!.add(graphic);
          this.planDraftGraphics.set(normalized.id, graphic);
        } else if (esriGeometry.type === 'polygon') {
          const symbol = new SimpleFillSymbol({
            color: `${color}40`,
            outline: {
              color,
              width: 1.5
            }
          });

          const attributes = {
            id: normalized.id,
            planId: normalized.planId,
            featureType: normalized.featureType,
            type: `plan-${normalized.featureType}`,
            status,
            name: label,
            isPlanDraft: true,
            properties: normalized.properties ?? {}
          };

          const graphic = new Graphic({
            geometry: esriGeometry,
            symbol,
            attributes,
            popupTemplate: {
              title: label,
              content: `Type: ${normalized.featureType}<br>Status: ${status}`
            }
          });

          this.planDraftLayer!.add(graphic);
          this.planDraftGraphics.set(normalized.id, graphic);
        }
      }
    } catch (err) {
      console.error('[CoverageMap] Failed to render plan drafts:', err);
    }
  }

  private async renderProjectOverlays(): Promise<void> {
    if (!this.projectOverlayLayer || !this.mapView) return;

    try {
      // Clear existing project overlay graphics
      this.projectOverlayLayer.removeAll();

      if (!this.projectOverlays || this.projectOverlays.size === 0) {
        return;
      }

      const [
        { default: Graphic },
        { default: Point },
        { default: SimpleMarkerSymbol },
        { default: SimpleFillSymbol },
        { default: Polyline },
        { default: Polygon }
      ] = await Promise.all([
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/geometry/Point.js'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol.js'),
        import('@arcgis/core/symbols/SimpleFillSymbol.js'),
        import('@arcgis/core/geometry/Polyline.js'),
        import('@arcgis/core/geometry/Polygon.js')
      ]);

      // Render features from all visible projects
      for (const [projectId, features] of this.projectOverlays.entries()) {
        const projectInfo = Array.from(this.projectOverlays.keys()).find(id => id === projectId);
        if (!projectInfo) continue;

        for (const feature of features) {
          const normalized = this.normalizePlanFeature(feature);
          const color = '#10b981'; // Green for project overlays
          const status = normalized.status || 'overlay';

          let esriGeometry: any = null;
          try {
            esriGeometry = this.planGeometryToEsriGeometry(normalized.geometry);
          } catch (geomError) {
            console.warn('[CoverageMap] Failed to convert project overlay geometry:', geomError);
            continue;
          }

          if (!esriGeometry) continue;

          const label = normalized.properties?.name ||
                       normalized.properties?.label ||
                       `${normalized.featureType} (${status})`;

          if (esriGeometry.type === 'point') {
            const symbol = new SimpleMarkerSymbol({
              style: 'circle',
              color,
              size: '14px',
              outline: {
                color: 'white',
                width: 2
              }
            });

            const attributes = {
              id: normalized.id,
              projectId,
              featureType: normalized.featureType,
              type: `project-${normalized.featureType}`,
              status,
              name: label,
              isProjectOverlay: true,
              properties: normalized.properties ?? {}
            };

            const graphic = new Graphic({
              geometry: esriGeometry,
              symbol,
              attributes,
              popupTemplate: {
                title: `${label} (Project Overlay)`,
                content: `Type: ${normalized.featureType}<br>Status: ${status}<br>Project: ${projectId}`
              }
            });

            this.projectOverlayLayer!.add(graphic);
          } else if (esriGeometry.type === 'polyline') {
            const symbol = {
              type: 'simple-line',
              color,
              width: 3,
              style: 'solid'
            };

            const attributes = {
              id: normalized.id,
              projectId,
              featureType: normalized.featureType,
              type: `project-${normalized.featureType}`,
              status,
              name: label,
              isProjectOverlay: true,
              properties: normalized.properties ?? {}
            };

            const graphic = new Graphic({
              geometry: esriGeometry,
              symbol,
              attributes,
              popupTemplate: {
                title: `${label} (Project Overlay)`,
                content: `Type: ${normalized.featureType}<br>Status: ${status}<br>Project: ${projectId}`
              }
            });

            this.projectOverlayLayer!.add(graphic);
          } else if (esriGeometry.type === 'polygon') {
            const symbol = new SimpleFillSymbol({
              color: `${color}30`,
              outline: {
                color,
                width: 2
              }
            });

            const attributes = {
              id: normalized.id,
              projectId,
              featureType: normalized.featureType,
              type: `project-${normalized.featureType}`,
              status,
              name: label,
              isProjectOverlay: true,
              properties: normalized.properties ?? {}
            };

            const graphic = new Graphic({
              geometry: esriGeometry,
              symbol,
              attributes,
              popupTemplate: {
                title: `${label} (Project Overlay)`,
                content: `Type: ${normalized.featureType}<br>Status: ${status}<br>Project: ${projectId}`
              }
            });

            this.projectOverlayLayer!.add(graphic);
          }
        }
      }

      console.log(`[CoverageMap] Rendered project overlays for ${this.projectOverlays.size} projects`);
    } catch (err) {
      console.error('[CoverageMap] Failed to render project overlays:', err);
    }
  }

  private getProjectOverlayCount(): number {
    let count = 0;
    for (const features of this.projectOverlays.values()) {
      count += features.length;
    }
    return count;
  }

  private planGeometryToEsriGeometry(geometry: any): any {
    if (!geometry) return null;

    if (typeof geometry.longitude === 'number' && typeof geometry.latitude === 'number') {
      return {
        type: 'point',
        longitude: geometry.longitude,
        latitude: geometry.latitude,
        spatialReference: { wkid: 4326 }
      };
    }

    if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
      return {
        type: 'polyline',
        paths: [geometry.coordinates],
        spatialReference: { wkid: 4326 }
      };
    }

    if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
      return {
        type: 'polygon',
        rings: geometry.coordinates,
        spatialReference: { wkid: 4326 }
      };
    }

    return null;
  }

  private filterSectorsByBand(allSectors: Sector[]): Sector[] {
    if (!allSectors || !Array.isArray(allSectors)) return [];
    if (!this.filters.bandFilters || !Array.isArray(this.filters.bandFilters)) return allSectors;

    const activeBandFilters = this.filters.bandFilters.filter(f => f.enabled);
    if (activeBandFilters.length === 0) return allSectors;

    return allSectors.filter(sector =>
      activeBandFilters.some(filter =>
        sector.band === filter.band ||
        sector.technology === filter.band
      )
    );
  }
}



