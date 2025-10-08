// Enhanced ArcGIS Mapper for CPE Devices
// Extends the existing PCI ArcGIS mapper to include CPE device visualization

import { browser } from '$app/environment';
import type { CPEDevice } from '../models/cpeDevice';
import { CPEDeviceUtils } from '../models/cpeDevice';
import type { LocationCluster } from '../services/locationService';

export interface CPEMapCell {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  status: 'online' | 'offline' | 'unknown' | 'error';
  signalStrength: number;
  manufacturer: string;
  productClass: string;
  serialNumber: string;
  accuracy?: number;
  lastUpdate: Date;
}

export interface CPEPerformanceData {
  deviceId: string;
  signalStrength: number;
  bandwidth: number;
  latency: number;
  packetLoss: number;
  uptime: number;
  timestamp: Date;
}

export class EnhancedPCIArcGISMapper {
  private map: any;
  private mapView: any;
  private cellLayer: any;           // Existing cell sites layer
  private conflictLayer: any;       // Existing conflicts layer
  private cpeLayer: any;            // CPE devices layer
  private performanceLayer: any;    // Performance indicators layer
  private clusterLayer: any;        // Location clusters layer
  
  private onCPEClickCallback: ((deviceId: string) => void) | null = null;
  private onMapRightClickCallback: ((latitude: number, longitude: number, screenX: number, screenY: number, deviceId: string | null) => void) | null = null;
  private onCellClickCallback: ((cellId: string) => void) | null = null;
  
  private isInitialized = false;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initializeMap('map-container');
  }

  /**
   * Initialize the enhanced map with CPE support
   */
  private async initializeMap(containerId: string): Promise<void> {
    if (!browser) return;

    try {
      // Dynamically import ArcGIS modules
      const [
        { default: Map },
        { default: MapView },
        { default: GraphicsLayer },
        { default: Zoom },
        { default: Point },
        { default: Graphic },
        { default: SimpleMarkerSymbol },
        { default: SimpleLineSymbol },
        { default: TextSymbol },
        { default: PictureMarkerSymbol },
        { default: SimpleRenderer },
        { default: ClassBreaksRenderer },
        { default: Color },
        { default: esriRequest }
      ] = await Promise.all([
        import('@arcgis/core/Map'),
        import('@arcgis/core/views/MapView'),
        import('@arcgis/core/layers/GraphicsLayer'),
        import('@arcgis/core/widgets/Zoom'),
        import('@arcgis/core/geometry/Point'),
        import('@arcgis/core/Graphic'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol'),
        import('@arcgis/core/symbols/SimpleLineSymbol'),
        import('@arcgis/core/symbols/TextSymbol'),
        import('@arcgis/core/symbols/PictureMarkerSymbol'),
        import('@arcgis/core/renderers/SimpleRenderer'),
        import('@arcgis/core/renderers/ClassBreaksRenderer'),
        import('@arcgis/core/Color'),
        import('@arcgis/core/request')
      ]);

      // Create the map
      this.map = new Map({
        basemap: 'streets-navigation-vector'
      });

      // Create the map view
      this.mapView = new MapView({
        container: containerId,
        map: this.map,
        center: [-74.5, 40], // Default to New York area
        zoom: 10,
        ui: {
          components: [] // Remove default UI components
        }
      });

      // Initialize layers
      this.cellLayer = new GraphicsLayer({
        title: "LTE Cell Sites"
      });

      this.conflictLayer = new GraphicsLayer({
        title: "PCI Conflicts"
      });

      this.cpeLayer = new GraphicsLayer({
        title: "CPE Devices"
      });

      this.performanceLayer = new GraphicsLayer({
        title: "Performance Indicators"
      });

      this.clusterLayer = new GraphicsLayer({
        title: "Device Clusters"
      });

      this.map.add(this.cellLayer);
      this.map.add(this.conflictLayer);
      this.map.add(this.cpeLayer);
      this.map.add(this.performanceLayer);
      this.map.add(this.clusterLayer);

      // Wait for the view to be ready
      await this.mapView.when();

      // Add Zoom widget
      const zoom = new Zoom({
        view: this.mapView
      });
      this.mapView.ui.add(zoom, {
        position: "top-center",
        index: 0
      });

      // Set up click handlers
      this.mapView.on('click', this.handleMapClick.bind(this));
      this.mapView.on('pointer-down', this.handleMapPointerDown.bind(this));

      this.isInitialized = true;
      console.log('Enhanced PCI ArcGIS Mapper: Map initialized with CPE support');

    } catch (error) {
      console.error('Enhanced PCI ArcGIS Mapper: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Render CPE devices on the map
   */
  async renderCPEDevices(cpeDevices: CPEDevice[]): Promise<void> {
    if (!browser || !this.cpeLayer) return;

    // Wait for initialization
    await this.initPromise;

    try {
      // Dynamically import required modules
      const [
        { default: Point },
        { default: Graphic },
        { default: SimpleMarkerSymbol },
        { default: TextSymbol },
        { default: Color }
      ] = await Promise.all([
        import('@arcgis/core/geometry/Point'),
        import('@arcgis/core/Graphic'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol'),
        import('@arcgis/core/symbols/TextSymbol'),
        import('@arcgis/core/Color')
      ]);

      // Clear existing CPE graphics
      this.cpeLayer.removeAll();

      // Filter devices with valid GPS coordinates
      const validDevices = cpeDevices.filter(device => 
        CPEDeviceUtils.validateGPS(device.location.latitude, device.location.longitude) &&
        device.location.latitude !== 0 && device.location.longitude !== 0
      );

      console.log(`Enhanced PCI ArcGIS Mapper: Rendering ${validDevices.length} CPE devices`);

      for (const device of validDevices) {
        try {
          // Create point geometry
          const point = new Point({
            longitude: device.location.longitude,
            latitude: device.location.latitude,
            spatialReference: { wkid: 4326 }
          });

          // Create symbol based on device status
          const symbol = this.createCPESymbol(device);

          // Create graphic
          const graphic = new Graphic({
            geometry: point,
            symbol: symbol,
            attributes: {
              deviceId: device.id,
              manufacturer: device.deviceId.manufacturer,
              productClass: device.deviceId.productClass,
              serialNumber: device.deviceId.serialNumber,
              status: device.status,
              signalStrength: device.performanceMetrics.signalStrength,
              ipAddress: device.networkInfo.ipAddress,
              lastContact: device.lastContact,
              accuracy: device.location.accuracy,
              locationQuality: device.location.source
            }
          });

          this.cpeLayer.add(graphic);

          // Add device label if zoomed in enough
          if (this.mapView.zoom > 12) {
            const labelSymbol = new TextSymbol({
              text: device.deviceId.serialNumber.slice(-6), // Last 6 chars of serial
              color: new Color([0, 0, 0, 0.8]),
              font: { size: 10, weight: 'bold' },
              haloColor: new Color([255, 255, 255, 0.8]),
              haloSize: 1
            });

            const labelGraphic = new Graphic({
              geometry: point,
              symbol: labelSymbol
            });

            this.cpeLayer.add(labelGraphic);
          }

        } catch (error) {
          console.warn(`Enhanced PCI ArcGIS Mapper: Failed to render device ${device.id}:`, error);
        }
      }

      console.log(`Enhanced PCI ArcGIS Mapper: Successfully rendered ${validDevices.length} CPE devices`);

    } catch (error) {
      console.error('Enhanced PCI ArcGIS Mapper: Failed to render CPE devices:', error);
      throw error;
    }
  }

  /**
   * Create symbol for CPE device based on status and signal strength
   */
  private async createCPESymbol(device: CPEDevice): Promise<any> {
    const [
      { default: SimpleMarkerSymbol },
      { default: Color }
    ] = await Promise.all([
      import('@arcgis/core/symbols/SimpleMarkerSymbol'),
      import('@arcgis/core/Color')
    ]);

    // Determine color based on status
    let color: any;
    switch (device.status) {
      case 'online':
        color = new Color([34, 197, 94, 0.8]); // Green
        break;
      case 'offline':
        color = new Color([239, 68, 68, 0.8]); // Red
        break;
      case 'error':
        color = new Color([245, 158, 11, 0.8]); // Yellow
        break;
      default:
        color = new Color([107, 114, 128, 0.8]); // Gray
    }

    // Adjust size based on signal strength
    let size = 8;
    if (device.performanceMetrics.signalStrength > -50) size = 12; // Strong signal
    else if (device.performanceMetrics.signalStrength > -70) size = 10; // Good signal
    else if (device.performanceMetrics.signalStrength > -80) size = 8; // Fair signal
    else size = 6; // Weak signal

    return new SimpleMarkerSymbol({
      style: 'circle',
      color: color,
      size: size,
      outline: {
        color: new Color([0, 0, 0, 0.6]),
        width: 1
      }
    });
  }

  /**
   * Render location clusters
   */
  async renderLocationClusters(clusters: LocationCluster[]): Promise<void> {
    if (!browser || !this.clusterLayer) return;

    await this.initPromise;

    try {
      const [
        { default: Point },
        { default: Graphic },
        { default: SimpleMarkerSymbol },
        { default: SimpleLineSymbol },
        { default: Color }
      ] = await Promise.all([
        import('@arcgis/core/geometry/Point'),
        import('@arcgis/core/Graphic'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol'),
        import('@arcgis/core/symbols/SimpleLineSymbol'),
        import('@arcgis/core/Color')
      ]);

      // Clear existing cluster graphics
      this.clusterLayer.removeAll();

      for (const cluster of clusters) {
        // Create cluster center point
        const centerPoint = new Point({
          longitude: cluster.centerLongitude,
          latitude: cluster.centerLatitude,
          spatialReference: { wkid: 4326 }
        });

        // Create cluster circle
        const circleSymbol = new SimpleMarkerSymbol({
          style: 'circle',
          color: new Color([59, 130, 246, 0.3]), // Blue with transparency
          size: Math.max(20, Math.min(100, cluster.devices.length * 5)), // Size based on device count
          outline: {
            color: new Color([59, 130, 246, 0.8]),
            width: 2
          }
        });

        const circleGraphic = new Graphic({
          geometry: centerPoint,
          symbol: circleSymbol,
          attributes: {
            clusterId: `${cluster.centerLatitude},${cluster.centerLongitude}`,
            deviceCount: cluster.devices.length,
            radius: cluster.radius,
            density: cluster.density
          }
        });

        this.clusterLayer.add(circleGraphic);

        // Add cluster label
        const labelSymbol = new TextSymbol({
          text: `${cluster.devices.length}`,
          color: new Color([59, 130, 246, 1]),
          font: { size: 12, weight: 'bold' },
          haloColor: new Color([255, 255, 255, 0.8]),
          haloSize: 1
        });

        const labelGraphic = new Graphic({
          geometry: centerPoint,
          symbol: labelSymbol
        });

        this.clusterLayer.add(labelGraphic);
      }

      console.log(`Enhanced PCI ArcGIS Mapper: Rendered ${clusters.length} location clusters`);

    } catch (error) {
      console.error('Enhanced PCI ArcGIS Mapper: Failed to render clusters:', error);
    }
  }

  /**
   * Show performance metrics popup for a device
   */
  async showPerformanceMetrics(deviceId: string, metrics: CPEPerformanceData): Promise<void> {
    if (!browser || !this.mapView) return;

    // Find the device graphic
    const deviceGraphic = this.cpeLayer.graphics.find((g: any) => 
      g.attributes.deviceId === deviceId
    );

    if (!deviceGraphic) {
      console.warn(`Enhanced PCI ArcGIS Mapper: Device ${deviceId} not found on map`);
      return;
    }

    // Create popup content
    const popupContent = {
      title: `Device Performance - ${deviceId.slice(-6)}`,
      content: `
        <div class="performance-popup">
          <div class="metric">
            <span class="label">Signal Strength:</span>
            <span class="value">${metrics.signalStrength} dBm</span>
          </div>
          <div class="metric">
            <span class="label">Bandwidth:</span>
            <span class="value">${metrics.bandwidth} Mbps</span>
          </div>
          <div class="metric">
            <span class="label">Latency:</span>
            <span class="value">${metrics.latency} ms</span>
          </div>
          <div class="metric">
            <span class="label">Packet Loss:</span>
            <span class="value">${metrics.packetLoss}%</span>
          </div>
          <div class="metric">
            <span class="label">Uptime:</span>
            <span class="value">${Math.floor(metrics.uptime / 3600)}h ${Math.floor((metrics.uptime % 3600) / 60)}m</span>
          </div>
        </div>
      `
    };

    // Show popup at device location
    this.mapView.popup.open({
      location: deviceGraphic.geometry,
      content: popupContent.content,
      title: popupContent.title
    });
  }

  /**
   * Handle map click events
   */
  private async handleMapClick(event: any): Promise<void> {
    if (!this.mapView) return;

    // Check if clicking on CPE device
    const cpeHit = await this.mapView.hitTest(event, { include: [this.cpeLayer] });
    
    if (cpeHit.results.length > 0) {
      const graphic = cpeHit.results[0].graphic;
      const deviceId = graphic.attributes.deviceId;
      
      if (this.onCPEClickCallback) {
        this.onCPEClickCallback(deviceId);
      }
      return;
    }

    // Check if clicking on cell site
    const cellHit = await this.mapView.hitTest(event, { include: [this.cellLayer] });
    
    if (cellHit.results.length > 0) {
      const graphic = cellHit.results[0].graphic;
      const cellId = graphic.attributes.id;
      
      if (this.onCellClickCallback) {
        this.onCellClickCallback(cellId);
      }
      return;
    }

    // Handle right-click for context menu
    if (event.button === 2) { // Right click
      const coordinates = this.mapView.toMap(event);
      if (this.onMapRightClickCallback) {
        this.onMapRightClickCallback(
          coordinates.latitude,
          coordinates.longitude,
          event.screenX,
          event.screenY,
          null
        );
      }
    }
  }

  /**
   * Handle map pointer down events
   */
  private handleMapPointerDown(event: any): void {
    // Prevent default right-click context menu
    if (event.button === 2) {
      event.stopPropagation();
    }
  }

  /**
   * Set CPE click callback
   */
  onCPEClick(callback: (deviceId: string) => void): void {
    this.onCPEClickCallback = callback;
  }

  /**
   * Set cell click callback (from original mapper)
   */
  onCellClick(callback: (cellId: string) => void): void {
    this.onCellClickCallback = callback;
  }

  /**
   * Set map right-click callback
   */
  onMapRightClick(callback: (latitude: number, longitude: number, screenX: number, screenY: number, deviceId: string | null) => void): void {
    this.onMapRightClickCallback = callback;
  }

  /**
   * Update CPE locations in real-time
   */
  async updateCPELocations(updates: Array<{ deviceId: string; latitude: number; longitude: number }>): Promise<void> {
    if (!browser || !this.cpeLayer) return;

    for (const update of updates) {
      const graphic = this.cpeLayer.graphics.find((g: any) => 
        g.attributes.deviceId === update.deviceId
      );

      if (graphic) {
        const [
          { default: Point }
        ] = await Promise.all([
          import('@arcgis/core/geometry/Point')
        ]);

        // Update geometry
        graphic.geometry = new Point({
          longitude: update.longitude,
          latitude: update.latitude,
          spatialReference: { wkid: 4326 }
        });
      }
    }
  }

  /**
   * Zoom to CPE device
   */
  async zoomToCPEDevice(deviceId: string): Promise<void> {
    if (!browser || !this.mapView) return;

    const graphic = this.cpeLayer.graphics.find((g: any) => 
      g.attributes.deviceId === deviceId
    );

    if (graphic) {
      await this.mapView.goTo({
        target: graphic.geometry,
        zoom: 15
      });
    }
  }

  /**
   * Zoom to show all CPE devices
   */
  async zoomToAllCPEDevices(): Promise<void> {
    if (!browser || !this.mapView || !this.cpeLayer) return;

    const graphics = this.cpeLayer.graphics;
    if (graphics.length === 0) return;

    const geometries = graphics.map((g: any) => g.geometry);
    
    await this.mapView.goTo({
      target: geometries,
      padding: 50
    });
  }

  /**
   * Get map view instance
   */
  getMapView(): any {
    return this.mapView;
  }

  /**
   * Get map instance
   */
  getMap(): any {
    return this.map;
  }

  /**
   * Check if map is initialized
   */
  isMapInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Clear all CPE devices from map
   */
  clearCPEDevices(): void {
    if (this.cpeLayer) {
      this.cpeLayer.removeAll();
    }
  }

  /**
   * Clear all clusters from map
   */
  clearClusters(): void {
    if (this.clusterLayer) {
      this.clusterLayer.removeAll();
    }
  }
}
