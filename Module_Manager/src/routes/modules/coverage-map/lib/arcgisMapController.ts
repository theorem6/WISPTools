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
  private planDraftGraphics: Map<string, any> = new Map();
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
      statusFilter: [],
      technologyFilter: [],
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
    if (this.extentPostTimer) {
      window.clearTimeout(this.extentPostTimer);
      this.extentPostTimer = null;
    }
    if (this.extentWatchHandle?.remove) {
      this.extentWatchHandle.remove();
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
    this.planDraftFeatures = (features ?? []).map(feature => this.normalizePlanFeature(feature));
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
      { default: GraphicsLayer },
      webMercatorUtilsModule
    ] = await Promise.all([
      import('@arcgis/core/Map.js'),
      import('@arcgis/core/views/MapView.js'),
      import('@arcgis/core/layers/GraphicsLayer.js'),
      import('@arcgis/core/geometry/support/webMercatorUtils.js')
    ]);

    this.webMercatorUtils = webMercatorUtilsModule;

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
        momentumEnabled: true
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

    await this.addMobileUIControls();
    this.addTouchEventHandling();
    this.registerPointerHandlers();
    this.registerDragHandlers();
    this.watchViewExtent();

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

    if (this.extentWatchHandle?.remove) {
      this.extentWatchHandle.remove();
    }

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

    this.extentWatchHandle = this.mapView.watch('extent', (extent: any) => {
      broadcast(extent);
    });
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

    const southWest = this.projectXYToLatLon(extent.xmin, extent.ymin, spatialReference);
    const northEast = this.projectXYToLatLon(extent.xmax, extent.ymax, spatialReference);

    if (southWest && northEast) {
      return {
        west: Math.min(southWest.lon, northEast.lon),
        south: Math.min(southWest.lat, northEast.lat),
        east: Math.max(southWest.lon, northEast.lon),
        north: Math.max(southWest.lat, northEast.lat)
      };
    }

    if (
      typeof extent.xmin === 'number' &&
      typeof extent.ymin === 'number' &&
      typeof extent.xmax === 'number' &&
      typeof extent.ymax === 'number'
    ) {
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
              ...tower,
              type: 'tower',
              id: tower.id,
              name: tower.name
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
            symbol: {
              type: 'simple-fill',
              color,
              style: 'solid',
              outline: {
                color: '#ffffff',
                width: 0.5
              }
            },
            attributes: {
              ...sector,
              type: 'sector',
              id: sector.id
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
              ...cpe,
              type: 'cpe',
              id: cpe.id
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
              ...eq,
              type: 'equipment',
              id: eq.id
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

      this.planDraftLayer.removeAll();
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
              family: 'Inter, system-ui, sans-serif',
              weight: 'bold'
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
    site: '#38bdf8',
    tower: '#3b82f6',
    sector: '#8b5cf6',
    cpe: '#10b981',
    backhaul: '#f97316',
    warehouse: '#f59e0b',
    noc: '#ef4444',
    equipment: '#0ea5e9'
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

function normalizePlanGeometry(geometry: any): any {
  if (!geometry) return undefined;

  const type = (geometry.type || '').toLowerCase();

  if (typeof geometry.longitude === 'number' && typeof geometry.latitude === 'number') {
    return {
      type: 'Point',
      coordinates: [geometry.longitude, geometry.latitude]
    };
  }

  switch (type) {
    case 'point':
      if (Array.isArray(geometry.coordinates)) {
        return {
          type: 'Point',
          coordinates: geometry.coordinates
        };
      }
      return geometry;
    case 'linestring':
      return {
        type: 'LineString',
        coordinates: geometry.coordinates ?? []
      };
    case 'polyline':
      if (Array.isArray(geometry.paths)) {
        return {
          type: 'LineString',
          coordinates: geometry.paths[0] ?? []
        };
      }
      return geometry;
    case 'polygon':
      return {
        type: 'Polygon',
        coordinates: geometry.coordinates ?? geometry.rings ?? []
      };
    default:
      return geometry;
  }
}

