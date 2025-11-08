import type {
  TowerSite,
  Sector,
  CPEDevice,
  NetworkEquipment,
  CoverageMapFilters
} from './models';
import type { PlanLayerFeature } from '$lib/services/planService';
import { createLocationIcon } from '$lib/mapIcons';

type DispatchFn = (event: string, detail?: any) => void;

export interface CoverageMapInitOptions {
  container: HTMLDivElement;
  filters: CoverageMapFilters;
  towers: TowerSite[];
  sectors: Sector[];
  cpeDevices: CPEDevice[];
  equipment: NetworkEquipment[];
  externalPlanFeatures?: PlanLayerFeature[];
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
  private planDraftLayer: any = null;

  private currentBasemap = 'topo-vector';
  private mapReady = false;

  private filters: CoverageMapFilters;
  private data: CoverageMapData = {
    towers: [],
    sectors: [],
    cpeDevices: [],
    equipment: []
  };
  private planDraftFeatures: PlanLayerFeature[] = [];

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
      bandFilters: [],
      locationTypeFilter: []
    };
  }

  public async initialize(options: CoverageMapInitOptions): Promise<CoverageMapInitResult> {
    this.container = options.container;
    this.filters = options.filters;
    this.setData({
      towers: options.towers,
      sectors: options.sectors,
      cpeDevices: options.cpeDevices,
      equipment: options.equipment
    });
    this.setPlanFeatures(options.externalPlanFeatures ?? []);

    await this.initializeMap();
    await this.renderAllAssets();
    await this.renderPlanDrafts();

    this.mapReady = true;

    return {
      map: this.map,
      mapView: this.mapView
    };
  }

  public destroy(): void {
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
    this.planDraftLayer = null;
    this.container = null;
    this.mapReady = false;
  }

  public getMapView(): any {
    return this.mapView;
  }

  public isReady(): boolean {
    return this.mapReady;
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
    this.data = {
      towers: data.towers,
      sectors: data.sectors,
      cpeDevices: data.cpeDevices,
      equipment: data.equipment
    };

    if (this.mapReady) {
      this.renderAllAssets().catch(err => console.error('[CoverageMap] Asset render error:', err));
    }
  }

  public setFilters(filters: CoverageMapFilters): void {
    this.filters = filters;
    if (this.mapReady) {
      this.renderAllAssets().catch(err => console.error('[CoverageMap] Asset render error:', err));
    }
  }

  public setPlanFeatures(features: PlanLayerFeature[]): void {
    this.planDraftFeatures = features ?? [];
    if (this.mapReady) {
      this.renderPlanDrafts().catch(err => console.error('[CoverageMap] Plan draft render error:', err));
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

    const [
      { default: Map },
      { default: MapView },
      { default: GraphicsLayer }
    ] = await Promise.all([
      import('@arcgis/core/Map.js'),
      import('@arcgis/core/views/MapView.js'),
      import('@arcgis/core/layers/GraphicsLayer.js')
    ]);

    this.backhaulLayer = new GraphicsLayer({ title: 'Backhaul Links' });
    this.graphicsLayer = new GraphicsLayer({ title: 'Network Assets' });
    this.planDraftLayer = new GraphicsLayer({ title: 'Plan Drafts', listMode: 'hide' });

    try {
      this.map = new Map({
        basemap: this.currentBasemap,
        layers: [this.backhaulLayer, this.graphicsLayer, this.planDraftLayer]
      });
    } catch (basemapError) {
      console.warn('Failed to load basemap, trying fallback...', basemapError);
      this.map = new Map({
        basemap: 'gray-vector',
        layers: [this.backhaulLayer, this.graphicsLayer, this.planDraftLayer]
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
        momentumEnabled: true,
        frictionFactor: 0.9
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

    await this.addMobileUIControls();
    this.addTouchEventHandling();
    this.registerPointerHandlers();

    console.log('Coverage Map initialized');
  }

  private async addMobileUIControls(): Promise<void> {
    if (!this.mapView) return;

    const isMobile = window.innerWidth <= 768;

    try {
      const [
        { default: Zoom },
        { default: Compass }
      ] = await Promise.all([
        import('@arcgis/core/widgets/Zoom.js'),
        import('@arcgis/core/widgets/Compass.js')
      ]);

      const zoom = new Zoom({
        view: this.mapView,
        layout: isMobile ? 'horizontal' : 'vertical'
      });

      this.mapView.ui.add(zoom, {
        position: 'bottom-right',
        index: 0
      });

      if (isMobile) {
        const compass = new Compass({
          view: this.mapView,
          label: 'Reset rotation'
        });

        this.mapView.ui.add(compass, {
          position: 'top-left',
          index: 1
        });
      }
    } catch (err) {
      console.error('Failed to add mobile UI controls:', err);
    }
  }

  private registerPointerHandlers(): void {
    if (!this.mapView) return;

    this.mapView.on('click', (event: any) => {
      this.handleMapClick(event).catch(err => console.error('Map click error:', err));
    });

    this.mapView.on('pointer-move', (event: any) => {
      event.stopPropagation();
    });

    this.mapView.container.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
    });

    this.mapView.on('pointer-down', async (event: any) => {
      if (event.button !== 2) {
        return;
      }

      const hitTest = await this.mapView!.hitTest(event);
      if (hitTest.results.length > 0) {
        const interactiveResult = hitTest.results.find(result => {
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
        this.dispatch('asset-click', {
          type: graphic.attributes.type,
          id: graphic.attributes.id,
          data: graphic.attributes,
          screenX: event.x,
          screenY: event.y
        });
      }
    }
  }

  private async renderAllAssets(): Promise<void> {
    if (!this.graphicsLayer || !this.mapView) return;

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

      this.graphicsLayer.removeAll();
      if (this.backhaulLayer) this.backhaulLayer.removeAll();

      if (this.filters.showBackhaul && this.backhaulLayer) {
        await this.renderBackhaulLinks();
      }

      if (this.filters.showTowers) {
        const { default: PictureMarkerSymbol } = await import('@arcgis/core/symbols/PictureMarkerSymbol.js');

        const isMobile = window.innerWidth <= 768;
        const iconSize = isMobile ? 48 : 40;
        const symbolSize = isMobile ? '28px' : '20px';
        const outlineWidth = isMobile ? 4 : 3;

        this.data.towers.forEach(tower => {
          let symbol;
          const customIcon = createLocationIcon(tower.type, iconSize);

          if (customIcon) {
            symbol = new PictureMarkerSymbol(customIcon);
          } else {
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
            symbol,
            attributes: {
              type: 'tower',
              id: tower.id,
              name: tower.name,
              ...tower
            }
          });

          this.graphicsLayer!.add(graphic);
        });
      }

      if (this.filters.showSectors) {
        const filteredSectors = this.filterSectorsByBand(this.data.sectors);

        filteredSectors.forEach(async sector => {
          const sectorPolygon = createSectorCone(
            sector.location.latitude,
            sector.location.longitude,
            sector.azimuth,
            sector.beamwidth,
            0.01
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
            }
          });

          this.graphicsLayer!.add(graphic);
        });
      }

      if (this.filters.showCPE) {
        this.data.cpeDevices.forEach(cpe => {
          if (cpe.status === 'inventory') return;

          const cpePolygon = createSectorCone(
            cpe.location.latitude,
            cpe.location.longitude,
            cpe.azimuth,
            cpe.beamwidth || 30,
            0.002
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
            }
          });

          this.graphicsLayer!.add(graphic);
        });
      }

      if (this.filters.showEquipment) {
        const visibleEquipment = this.data.equipment.filter(eq =>
          this.filters.locationTypeFilter.length === 0 ||
          this.filters.locationTypeFilter.includes(eq.locationType)
        );

        const isMobile = window.innerWidth <= 768;
        const symbolSize = isMobile ? '16px' : '12px';
        const outlineWidth = isMobile ? 2 : 1;

        visibleEquipment.forEach(eq => {
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
            symbol,
            attributes: {
              type: 'equipment',
              id: eq.id,
              ...eq
            }
          });

          this.graphicsLayer!.add(graphic);
        });
      }

      if (this.graphicsLayer.graphics.length > 0) {
        try {
          await this.mapView.when();
          await this.mapView.goTo({
            target: this.graphicsLayer.graphics,
            padding: 50
          }).catch((err: unknown) => {
            console.warn('Could not fit map to graphics:', err);
            if (this.graphicsLayer!.graphics.length > 0) {
              const firstGraphic = this.graphicsLayer!.graphics.getItemAt(0);
              if (firstGraphic && firstGraphic.geometry) {
                this.mapView!.center = firstGraphic.geometry;
              }
            }
          });
        } catch (err) {
          console.warn('Map animation error:', err);
        }
      }

      console.log(`Rendered ${this.graphicsLayer.graphics.length} assets on map`);
    } catch (err) {
      console.error('Failed to render assets:', err);
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
        { default: SimpleFillSymbol },
        { default: SimpleLineSymbol },
        { default: TextSymbol }
      ] = await Promise.all([
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/symbols/SimpleFillSymbol.js'),
        import('@arcgis/core/symbols/SimpleLineSymbol.js'),
        import('@arcgis/core/symbols/TextSymbol.js')
      ]);

      this.planDraftLayer.removeAll();

      for (const feature of features) {
        const color = getPlanDraftColor(feature.type || 'plan');
        const label = feature.label || `Plan Draft (${feature.type || 'plan'})`;
        const status = feature.status || 'draft';
        const type = feature.type || 'plan';

        const esriGeometry = feature.geometry;
        if (!esriGeometry) continue;

        if (esriGeometry.type === 'point') {
          const symbol = new SimpleMarkerSymbol({
            color,
            size: '18px',
            outline: {
              color: '#ffffff',
              width: 2
            }
          });

          this.planDraftLayer.add(new Graphic({
            geometry: esriGeometry,
            symbol,
            attributes: {
              id: feature.id,
              type,
              status
            },
            popupTemplate: {
              title: label,
              content: `Type: ${type}<br>Status: ${status}`
            }
          }));

          const textSymbol = new TextSymbol({
            text: label,
            color: '#1f2937',
            haloColor: '#ffffff',
            haloSize: '2px',
            font: {
              size: 12,
              family: 'Inter, system-ui, sans-serif',
              weight: 'bold'
            },
            yoffset: 12
          });

          this.planDraftLayer.add(new Graphic({ geometry: esriGeometry, symbol: textSymbol }));
        } else if (esriGeometry.type === 'polyline') {
          const symbol = new SimpleLineSymbol({
            color,
            width: 2,
            style: 'short-dash'
          });

          this.planDraftLayer.add(new Graphic({
            geometry: esriGeometry,
            symbol,
            attributes: {
              id: feature.id,
              type,
              status
            },
            popupTemplate: {
              title: label,
              content: `Type: ${type}<br>Status: ${status}`
            }
          }));
        } else if (esriGeometry.type === 'polygon') {
          const symbol = new SimpleFillSymbol({
            color: `${color}40`,
            outline: {
              color,
              width: 1.5
            }
          });

          this.planDraftLayer.add(new Graphic({
            geometry: esriGeometry,
            symbol,
            attributes: {
              id: feature.id,
              type,
              status
            },
            popupTemplate: {
              title: label,
              content: `Type: ${type}<br>Status: ${status}`
            }
          }));
        }
      }
    } catch (err) {
      console.error('[CoverageMap] Failed to render plan drafts:', err);
    }
  }

  private filterSectorsByBand(allSectors: Sector[]): Sector[] {
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

function createSectorCone(lat: number, lon: number, azimuth: number, beamwidth: number, radius: number): any {
  const startAngle = azimuth - beamwidth / 2;
  const endAngle = azimuth + beamwidth / 2;
  const rings = [[
    [lon, lat]
  ]];

  for (let angle = startAngle; angle <= endAngle; angle += 5) {
    const radians = (angle * Math.PI) / 180;
    const x = lon + radius * Math.sin(radians);
    const y = lat + radius * Math.cos(radians);
    rings[0].push([x, y]);
  }

  rings[0].push([lon, lat]);

  return {
    type: 'polygon',
    rings,
    spatialReference: { wkid: 4326 }
  };
}

function getTowerColor(type: string): string {
  const colors: Record<string, string> = {
    tower: '#3b82f6',
    rooftop: '#8b5cf6',
    monopole: '#06b6d4',
    warehouse: '#f59e0b',
    noc: '#ef4444',
    'internet-access': '#06b6d4',
    internet: '#06b6d4',
    vehicle: '#10b981',
    rma: '#f97316',
    vendor: '#6366f1',
    other: '#6b7280'
  };
  return colors[type] || colors.other;
}

function getBandColor(band: string): string {
  const colors: Record<string, string> = {
    LTE: '#ef4444',
    CBRS: '#3b82f6',
    FWA: '#10b981',
    '5G': '#8b5cf6',
    WiFi: '#f59e0b'
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

function getBackhaulColor(type: string): string {
  const colors: Record<string, string> = {
    fiber: '#3b82f6',
    'fixed-wireless-licensed': '#10b981',
    'fixed-wireless-unlicensed': '#f97316'
  };

  return colors[type] || '#6366f1';
}

function getPlanDraftColor(type: string): string {
  const colors: Record<string, string> = {
    plan: '#6366f1',
    tower: '#3b82f6',
    sector: '#8b5cf6',
    cpe: '#10b981',
    backhaul: '#f97316'
  };
  return colors[type] || '#6366f1';
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ]
    : [0, 0, 0];
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

