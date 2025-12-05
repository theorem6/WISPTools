<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import TenantGuard from '$lib/components/admin/TenantGuard.svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import type { CBSDDevice, CBSDCategory, CBSDState } from './lib/models/cbsdDevice';
  import { CBRS_BAND } from './lib/models/cbsdDevice';
  import { createCBRSService, type CBRSServiceConfig } from './lib/services/cbrsService';
import { loadCBRSConfig, saveCBRSConfig, getConfigStatus, loadPlatformCBRSConfig, type CBRSConfig, type PlatformCBRSConfig } from './lib/services/configService';
  import DeviceList from './components/DeviceList.svelte';
  import GrantStatus from './components/GrantStatus.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
  import UserIDSelector from './components/UserIDSelector.svelte';
  
  // State
  let devices: CBSDDevice[] = [];
  let selectedDevice: CBSDDevice | null = null;
  let cbrsService: any = null;
  let isLoading = true;
  let error: string | null = null;
  let mapContainer: HTMLDivElement;
  let map: any = null;
  let showAddDeviceModal = false;
  let showGrantRequestModal = false;
  let showSettingsModal = false;
  let showUserIDSelector = false;
  let currentUserID: string | null = null;
  let currentUserIDDisplay: string | null = null;
  
  // Configuration
  let cbrsConfig: CBRSConfig | null = null;
  let platformConfig: PlatformCBRSConfig | null = null;
type ConfigStatus = ReturnType<typeof getConfigStatus>;
let configStatus: ConfigStatus = getConfigStatus(null);
  
  // Tenant info - use currentTenant store
  $: tenantId = $currentTenant?.id || '';
  $: tenantName = $currentTenant?.displayName || 'No Tenant Selected';
  
  // Watch for tenant changes and reload
  $: if (browser && tenantId && cbrsService === null) {
    console.log('[CBRS Module] Tenant loaded:', tenantId);
    loadCBRSConfig(tenantId).then(config => {
      cbrsConfig = config;
      if (config) {
        loadDevices();
      }
    });
  }
  
  // Add device form (fixed to Google SAS only)
  let newDevice = {
    cbsdSerialNumber: '',
    fccId: '',
    cbsdCategory: 'A' as CBSDCategory,
    sasProviderId: 'google' as const, // Fixed to Google SAS
    latitude: 40.7128,
    longitude: -74.0060,
    height: 10,
    antennaGain: 5
  };
  
  // Grant request form
  let grantRequest = {
    maxEirp: 20,
    lowFrequency: 3550000000,
    highFrequency: 3560000000
  };
  
  onMount(async () => {
    try {
      if (browser) {
        console.log('[CBRS Module] Initializing...');
        console.log('[CBRS Module] Tenant:', tenantName);
        
        // Load configurations
        if (tenantId) {
          // Load tenant configuration
          cbrsConfig = await loadCBRSConfig(tenantId);
          
          // Load platform configuration (for shared-platform mode)
          platformConfig = await loadPlatformCBRSConfig();
          
          configStatus = getConfigStatus(cbrsConfig);
        } else {
          // No tenant selected - show warning
          configStatus = {
            status: 'missing',
            message: 'No tenant selected. Please select a tenant from the dashboard.'
          } as ConfigStatus;
        }
        
        if (cbrsConfig && configStatus.status === 'complete') {
          // Initialize CBRS service with hybrid configuration logic
          const config = await buildServiceConfig(cbrsConfig, platformConfig, tenantId);
          cbrsService = createCBRSService(config);
        }
        
        // Load devices (only if we have a tenant)
        if (tenantId) {
          await loadDevices();
        }
        
        // Initialize map
        await initializeMap();
      }
      
      isLoading = false;
    } catch (err: any) {
      console.error('Failed to initialize CBRS module:', err);
      error = err?.message || 'Failed to initialize';
      isLoading = false;
    }
  });
  
  onDestroy(() => {
    if (cbrsService) {
      cbrsService.cleanup();
    }
    if (map) {
      map.remove();
    }
  });
  
  async function loadDevices() {
    try {
      if (!tenantId) {
        console.warn('No tenant selected, skipping device load');
        return;
      }
      if (!cbrsService) {
        console.warn('CBRS service not initialized, skipping device load');
        return;
      }
      devices = await cbrsService.getDevices();
      console.log('Loaded', devices.length, 'CBRS devices');
    } catch (err: any) {
      console.error('Failed to load devices:', err);
      error = err?.message || 'Failed to load devices';
    }
  }
  
  async function initializeMap() {
    if (!mapContainer) return;

    try {
      const [
        { default: Map },
        { default: MapView },
        { default: GraphicsLayer },
        { default: SimpleMarkerSymbol },
        { default: Graphic },
        { default: Point },
        { default: Polygon },
        { default: SimpleFillSymbol }
      ] = await Promise.all([
        import('@arcgis/core/Map.js'),
        import('@arcgis/core/views/MapView.js'),
        import('@arcgis/core/layers/GraphicsLayer.js'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol.js'),
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/geometry/Point.js'),
        import('@arcgis/core/geometry/Polygon.js'),
        import('@arcgis/core/symbols/SimpleFillSymbol.js')
      ]);

      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      const basemap = isDarkMode ? 'dark-gray-vector' : 'streets-navigation-vector';

      map = new Map({ basemap });

      const view = new MapView({
        container: mapContainer,
        map: map,
        center: [-95.7129, 37.0902], // Center of US
        zoom: 4,
        navigation: {
          mouseWheelZoomEnabled: true // Re-enable mouse wheel zoom
        }
      });

      const graphicsLayer = new GraphicsLayer();
      map.add(graphicsLayer);

      map._view = view;
      map._graphicsLayer = graphicsLayer;

      // Require modifier key (Ctrl/Cmd) for mouse wheel zoom to prevent accidental zooming
      // Mac-specific: Handle trackpad vs mouse differently
      await view.when();
      if (view.container) {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
                      navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
        
        view.container.addEventListener('wheel', (event: WheelEvent) => {
          const hasModifier = event.ctrlKey || event.metaKey;
          const isSmoothScroll = Math.abs(event.deltaY) < 10 && event.deltaMode === 0;
          const isPinchGesture = event.ctrlKey && Math.abs(event.deltaY) > 0;
          
          // On Mac: allow pinch-to-zoom and trackpad panning
          if (isMac) {
            if (hasModifier || isPinchGesture) {
              // Intentional zoom gesture - allow it
              return;
            }
            if (isSmoothScroll && !hasModifier) {
              // Mac trackpad panning - allow default behavior
              return;
            }
          }
          
          // Prevent zoom if no modifier key is pressed
          if (!hasModifier) {
            event.preventDefault();
            event.stopPropagation();
          }
        }, { passive: false });
      }

      // Add click handler
      view.on('click', async (event) => {
        const response = await view.hitTest(event);
        if (response.results.length > 0) {
          const interactiveResult = response.results.find((result) => {
            return typeof (result as any)?.graphic?.attributes === 'object';
          }) as { graphic?: { attributes?: Record<string, unknown> } } | undefined;

          const attributes = interactiveResult?.graphic?.attributes as { device?: CBSDDevice } | undefined;
          if (attributes?.device) {
            handleDeviceSelect(attributes.device);
          }
        }
      });

      await addDeviceMarkers();

      console.log('ArcGIS map initialized');
    } catch (err) {
      console.error('Failed to initialize map:', err);
    }
  }
  
  async function addDeviceMarkers() {
    if (!map || !map._graphicsLayer) return;

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

      map._graphicsLayer.removeAll();

      devices.forEach(device => {
        const color = device.state === 'GRANTED' || device.state === 'AUTHORIZED' ? '#10b981' :
                     device.state === 'REGISTERED' ? '#3b82f6' :
                     device.state === 'SUSPENDED' ? '#f59e0b' : '#6b7280';

        const symbol = new SimpleMarkerSymbol({
          style: 'circle',
          color: color,
          size: device.cbsdCategory === 'B' ? '20px' : '16px',
          outline: {
            color: 'white',
            width: 2
          }
        });

        const point = new Point({
          longitude: device.installationParam.longitude,
          latitude: device.installationParam.latitude
        });

        const graphic = new Graphic({
          geometry: point,
          symbol: symbol,
          attributes: {
            id: device.id,
            device: device
          }
        });

        map._graphicsLayer.add(graphic);
      });

      if (devices.length > 0 && map._view && map._graphicsLayer.graphics.length > 0) {
        try {
          await map._view.when();
          await map._view.goTo({
            target: map._graphicsLayer.graphics,
            padding: 50
          });
        } catch (goToError) {
          console.warn('Could not animate to markers:', goToError);
        }
      }

      console.log(`Added ${devices.length} device markers`);
    } catch (err) {
      console.error('Failed to add markers:', err);
    }
  }
  
  function handleDeviceSelect(device: CBSDDevice) {
    selectedDevice = device;
  }
  
  async function handleRegisterDevice(device: CBSDDevice) {
    try {
      if (!cbrsService) return;
      await cbrsService.registerDevice(device);
      await loadDevices();
      await addDeviceMarkers();
    } catch (err: any) {
      console.error('Registration failed:', err);
      error = err?.message || 'Registration failed';
    }
  }
  
  async function handleDeregisterDevice(device: CBSDDevice) {
    try {
      if (!cbrsService) return;
      await cbrsService.deregisterDevice(device);
      await loadDevices();
      await addDeviceMarkers();
      if (selectedDevice?.id === device.id) {
        selectedDevice = null;
      }
    } catch (err: any) {
      console.error('Deregistration failed:', err);
      error = err?.message || 'Deregistration failed';
    }
  }
  
  async function handleAddDevice() {
    try {
      if (!tenantId) {
        error = 'Please select a tenant before adding devices.';
        return;
      }
      
      const device: CBSDDevice = {
        id: `cbsd-${Date.now()}`,
        cbsdSerialNumber: newDevice.cbsdSerialNumber,
        fccId: newDevice.fccId,
        cbsdCategory: newDevice.cbsdCategory,
        sasProviderId: newDevice.sasProviderId,
        installationParam: {
          latitude: newDevice.latitude,
          longitude: newDevice.longitude,
          height: newDevice.height,
          heightType: 'AGL',
          antennaGain: newDevice.antennaGain
        },
        state: 'UNREGISTERED' as CBSDState,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      devices = [...devices, device];
      await addDeviceMarkers();
      showAddDeviceModal = false;
      
      // Reset form
      newDevice = {
        cbsdSerialNumber: '',
        fccId: '',
        cbsdCategory: 'A' as CBSDCategory,
        sasProviderId: 'google' as const, // Fixed to Google SAS
        latitude: 40.7128,
        longitude: -74.0060,
        height: 10,
        antennaGain: 5
      };
    } catch (err: any) {
      console.error('Failed to add device:', err);
      error = err?.message || 'Failed to add device';
    }
  }
  
  function handleRequestGrant(device: CBSDDevice) {
    selectedDevice = device;
    showGrantRequestModal = true;
  }
  
  async function handleSubmitGrantRequest() {
    try {
      if (!cbrsService || !selectedDevice) return;
      
      await cbrsService.requestGrant(selectedDevice, grantRequest);
      await loadDevices();
      await addDeviceMarkers();
      showGrantRequestModal = false;
      
      // Find updated device
      selectedDevice = devices.find(d => d.id === selectedDevice!.id) || null;
    } catch (err: any) {
      console.error('Grant request failed:', err);
      error = err?.message || 'Grant request failed';
    }
  }
  
  async function handleRelinquishGrant(device: CBSDDevice, grantId: string) {
    try {
      if (!cbrsService) return;
      
      await cbrsService.relinquishGrant(device, grantId);
      await loadDevices();
      await addDeviceMarkers();
      
      // Find updated device
      selectedDevice = devices.find(d => d.id === device.id) || null;
    } catch (err: any) {
      console.error('Grant relinquishment failed:', err);
      error = err?.message || 'Grant relinquishment failed';
    }
  }
  
  /**
   * Build service configuration for shared platform mode with Google SAS
   * Uses platform API key with tenant's credentials and certificates
   */
  async function buildServiceConfig(
    tenantConfig: CBRSConfig, 
    platformConfig: PlatformCBRSConfig | null,
    tenantId: string
  ): Promise<CBRSServiceConfig> {
    console.log('[CBRS] Using shared platform mode with Google SAS');
    console.log('[CBRS] User ID:', tenantConfig.googleUserId);
    console.log('[CBRS] Email:', tenantConfig.googleEmail);
    console.log('[CBRS] Has certificate:', !!tenantConfig.googleCertificate);
    
    // Use platform's Google SAS API key (if available)
    const googleApiKey = platformConfig?.googleApiKey;
    const googleApiEndpoint = platformConfig?.googleApiEndpoint || 'https://sas.googleapis.com/v1';
    
    return {
      provider: 'google', // Fixed to Google only
      tenantId,
      googleConfig: {
        apiEndpoint: googleApiEndpoint,
        apiKey: googleApiKey,
        userId: tenantConfig.googleUserId, // Tenant's unique User ID
        email: tenantConfig.googleEmail,   // Tenant's Google account email
        certificate: tenantConfig.googleCertificate, // Client certificate (base64)
        privateKey: tenantConfig.googlePrivateKey,   // Private key (base64)
        tenantId
      },
      federatedEnhancements: {
        analyticsEnabled: tenantConfig.enableAnalytics || false,
        autoOptimization: tenantConfig.enableOptimization || false,
        multiSiteCoordination: tenantConfig.enableMultiSite || false,
        interferenceMonitoring: tenantConfig.enableInterferenceMonitoring || false
      }
    };
  }
  
  async function handleSaveSettings(event: CustomEvent) {
    try {
      const newConfig: CBRSConfig = {
        ...event.detail,
        tenantId
      };
      
      await saveCBRSConfig(newConfig);
      cbrsConfig = newConfig;
      configStatus = getConfigStatus(cbrsConfig);
      showSettingsModal = false;
      
      // Reinitialize service with new configuration
      if (configStatus.status === 'complete') {
        const config = await buildServiceConfig(cbrsConfig, platformConfig, tenantId);
        
        if (cbrsService) {
          cbrsService.cleanup();
        }
        cbrsService = createCBRSService(config);
        
        // Reload devices with new service
        await loadDevices();
        await addDeviceMarkers();
      }
      
      // Show success message
      error = null;
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      error = 'Failed to save settings: ' + (err?.message || 'Unknown error');
    }
  }
  
  async function handleUserIdSelected(event: CustomEvent) {
    try {
      const { userId, googleEmail, accessToken } = event.detail;
      console.log('[CBRS] User ID selected, loading SAS devices:', userId);
      
      // Call Cloud Function to fetch installations from Google SAS
      const { functions } = await import('$lib/firebase');
      const { httpsCallable } = await import('firebase/functions');
      
      const getSASInstallations = httpsCallable(functions(), 'getSASInstallations');
      
      const response = await getSASInstallations({
        tenantId,
        userId,
        googleEmail,
        googleAccessToken: accessToken
      });
      
      const result = response.data as any;
      
      if (result.success && result.installations) {
        console.log('[CBRS] Loaded', result.installations.length, 'installations from Google SAS');
        console.log('[CBRS] Cloud Function returned:', result);
        if (result.note) {
          console.log('[CBRS] Note from Cloud Function:', result.note);
        }
        
        // Convert installations to CBSD devices and update devices list
        devices = convertInstallationsToCBSDs(result.installations);
        console.log('[CBRS] Converted to', devices.length, 'CBSD devices');
        
        // Add installations to map
        await addSASInstallationsToMap(result.installations);
      } else {
        console.warn('[CBRS] No installations found for this User ID');
        devices = []; // Clear devices if none found
        
        if (map && map._graphicsLayer) {
          map._graphicsLayer.removeAll();
        }
      }
      
    } catch (err: any) {
      console.error('[CBRS] Failed to load SAS installations:', err);
      error = 'Failed to load SAS devices: ' + (err?.message || 'Unknown error');
    }
  }
  
  function convertInstallationsToCBSDs(installations: any[]): CBSDDevice[] {
    console.log('[CBRS] Converting', installations.length, 'installations to CBSD devices');
    if (installations[0]) {
      console.log('[CBRS] ===== SAMPLE INSTALLATION STRUCTURE =====');
      console.log('[CBRS] Full object:', JSON.stringify(installations[0], null, 2));
      console.log('[CBRS] Top-level keys:', Object.keys(installations[0]));
      
      if (installations[0].activeConfig) {
        console.log('[CBRS] Has activeConfig with keys:', Object.keys(installations[0].activeConfig));
        if (installations[0].activeConfig.installationParams) {
          console.log('[CBRS] activeConfig.installationParams:', JSON.stringify(installations[0].activeConfig.installationParams, null, 2));
        }
      }
      if (installations[0].preloadedConfig) {
        console.log('[CBRS] Has preloadedConfig with keys:', Object.keys(installations[0].preloadedConfig));
        if (installations[0].preloadedConfig.installationParams) {
          console.log('[CBRS] preloadedConfig.installationParams:', JSON.stringify(installations[0].preloadedConfig.installationParams, null, 2));
        }
      }
      
      // Check if these are deployments (locations) or actual devices
      if (installations[0].deploymentName || installations[0].deployment) {
        console.log('[CBRS] ⚠️ These appear to be DEPLOYMENTS, not devices!');
      }
      console.log('[CBRS] =====================================');
    }
    
    return installations.map((installation: any, index: number) => {
      // Extract coordinates from Google SAS Portal API device structure
      let lat = 0;
      let lon = 0;
      let coordSource = 'none';
      
      // Check all possible locations for installationParams
      if (installation.activeConfig?.installationParams?.latitude) {
        lat = installation.activeConfig.installationParams.latitude;
        lon = installation.activeConfig.installationParams.longitude;
        coordSource = 'activeConfig.installationParams';
      } else if (installation.preloadedConfig?.installationParams?.latitude) {
        lat = installation.preloadedConfig.installationParams.latitude;
        lon = installation.preloadedConfig.installationParams.longitude;
        coordSource = 'preloadedConfig.installationParams';
      } else if (installation.installationParams?.latitude) {
        lat = installation.installationParams.latitude;
        lon = installation.installationParams.longitude;
        coordSource = 'installationParams';
      } else if (installation.latitude) {
        lat = installation.latitude;
        lon = installation.longitude;
        coordSource = 'top-level';
      }
      
      if (index === 0 && lat && lon) {
        console.log(`[CBRS] ✅ Found coordinates from: ${coordSource}`, { lat, lon });
      }
      
      // Create a CBSD device from installation data
      const device: CBSDDevice = {
        id: installation.name || `sas-${index}`,
        cbsdSerialNumber: installation.serialNumber || installation.name || `SAS-${index}`,
        fccId: installation.fccId || 'UNKNOWN',
        cbsdCategory: (installation.cbsdCategory || 'A') as CBSDCategory,
        userId: installation.userId || currentUserID || 'unknown',
        callSign: installation.callSign || '',
        cbsdInfo: installation.cbsdInfo ?? undefined,
        airInterface: installation.airInterface ?? undefined,
        installationParam: {
          latitude: lat,
          longitude: lon,
          height: (installation.activeConfig?.installationParams?.height || 
                  installation.preloadedConfig?.installationParams?.height ||
                  installation.installationParams?.height || 10),
          heightType: (installation.activeConfig?.installationParams?.heightType || 
                      installation.preloadedConfig?.installationParams?.heightType ||
                      installation.installationParams?.heightType || 'AGL').replace('HEIGHT_TYPE_', ''),
          indoorDeployment: installation.activeConfig?.installationParams?.indoorDeployment || 
                           installation.preloadedConfig?.installationParams?.indoorDeployment ||
                           installation.installationParams?.indoorDeployment || false,
          antennaAzimuth: installation.activeConfig?.installationParams?.antennaAzimuth || 
                         installation.preloadedConfig?.installationParams?.antennaAzimuth ||
                         installation.installationParams?.antennaAzimuth || 0,
          antennaDowntilt: installation.activeConfig?.installationParams?.antennaDowntilt || 
                          installation.preloadedConfig?.installationParams?.antennaDowntilt ||
                          installation.installationParams?.antennaDowntilt || 0,
          antennaGain: installation.activeConfig?.installationParams?.antennaGain || 
                      installation.preloadedConfig?.installationParams?.antennaGain ||
                      installation.installationParams?.antennaGain || 5,
          antennaBeamwidth: installation.activeConfig?.installationParams?.antennaBeamwidth || 
                           installation.preloadedConfig?.installationParams?.antennaBeamwidth ||
                           installation.installationParams?.antennaBeamwidth || 360,
          horizontalAccuracy: installation.activeConfig?.installationParams?.horizontalAccuracy || 
                             installation.preloadedConfig?.installationParams?.horizontalAccuracy ||
                             installation.installationParams?.horizontalAccuracy || 50,
          verticalAccuracy: installation.activeConfig?.installationParams?.verticalAccuracy || 
                           installation.preloadedConfig?.installationParams?.verticalAccuracy ||
                           installation.installationParams?.verticalAccuracy || 3
        },
        measCapability: installation.measCapability || [],
        groupingParam: installation.groupingParam || [],
        state: (installation.state || 'REGISTERED') as CBSDState,
        grantStates: installation.grantStates || [],
        sasProviderId: 'google' as const,
        tenantId,
        createdAt: new Date(installation.createdAt || Date.now()),
        updatedAt: new Date(installation.updatedAt || Date.now())
      };
      
      // Log if coordinates are missing
      if (lat === 0 || lon === 0) {
        console.warn('[CBRS] Device has no valid coordinates:', {
          id: device.id,
          serialNumber: device.cbsdSerialNumber,
          extractedLat: lat,
          extractedLon: lon,
          coordSource: coordSource,
          allFields: Object.keys(installation),
          hasActiveConfig: !!installation.activeConfig,
          hasPreloadedConfig: !!installation.preloadedConfig,
          hasActiveConfigInstallationParams: !!installation.activeConfig?.installationParams,
          hasPreloadedConfigInstallationParams: !!installation.preloadedConfig?.installationParams,
          installationName: installation.name || installation.displayName
        });
      }
      
      return device;
    }); // Don't filter out - show all devices even without coordinates
  }
  
  async function handleShowUserIDSelector() {
    console.log('[CBRS] Opening User ID selector...');
    // UserIDSelector will handle authentication and User ID fetching internally
    showUserIDSelector = true;
  }
  
  async function handleMainUserIDSelect(event: CustomEvent) {
    const { userId, googleEmail, accessToken } = event.detail;
    console.log('[CBRS] User ID selected from main page:', userId);
    
    currentUserID = userId;
    currentUserIDDisplay = userId;
    showUserIDSelector = false;
    
    // Load installations for this User ID
    await handleUserIdSelected({
      detail: {
        userId,
        googleEmail,
        accessToken
      }
    } as CustomEvent);
  }
  
  // Helper function to create a sector polygon for antenna coverage
  function createSectorPolygon(centerLon: number, centerLat: number, azimuth: number, beamwidth: number, radiusKm: number = 0.5): number[][] {
    const points: number[][] = [];
    
    // Start at center
    points.push([centerLon, centerLat]);
    
    // Calculate start and end angles
    const startAngle = azimuth - (beamwidth / 2);
    const endAngle = azimuth + (beamwidth / 2);
    
    // Convert km to approximate degrees (rough approximation: 1 degree ≈ 111 km)
    const radiusDegrees = radiusKm / 111;
    
    // Create arc points (30 points for smooth curve)
    const numPoints = 30;
    for (let i = 0; i <= numPoints; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / numPoints);
      const radians = (angle - 90) * Math.PI / 180; // -90 to make 0° = North
      
      const x = centerLon + radiusDegrees * Math.cos(radians);
      const y = centerLat + radiusDegrees * Math.sin(radians);
      points.push([x, y]);
    }
    
    // Close the polygon back to center
    points.push([centerLon, centerLat]);
    
    return points;
  }

  async function addSASInstallationsToMap(installations: any[]) {
    if (!map || !map._graphicsLayer) {
      console.error('[CBRS] Map or graphics layer not available');
      return;
    }
    
    console.log('[CBRS] Adding', installations.length, 'installations to map');
    
    try {
      console.log('[CBRS] Importing ArcGIS modules...');
      const [
        { default: Graphic },
        { default: Point },
        { default: Polygon },
        { default: SimpleMarkerSymbol },
        { default: SimpleFillSymbol }
      ] = await Promise.all([
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/geometry/Point.js'),
        import('@arcgis/core/geometry/Polygon.js'),
        import('@arcgis/core/symbols/SimpleMarkerSymbol.js'),
        import('@arcgis/core/symbols/SimpleFillSymbol.js')
      ]);
      
      console.log('[CBRS] ArcGIS modules loaded successfully');

      // Clear existing markers
      map._graphicsLayer.removeAll();
      
      let addedCount = 0;

      installations.forEach((installation: any, index: number) => {
        // Extract location from installation - Google SAS Portal API structure
        let lat = 0;
        let lon = 0;
        
        // Check all possible locations for installationParams
        if (installation.activeConfig?.installationParams?.latitude) {
          lat = installation.activeConfig.installationParams.latitude;
          lon = installation.activeConfig.installationParams.longitude;
        } else if (installation.preloadedConfig?.installationParams?.latitude) {
          lat = installation.preloadedConfig.installationParams.latitude;
          lon = installation.preloadedConfig.installationParams.longitude;
        } else if (installation.installationParams?.latitude) {
          lat = installation.installationParams.latitude;
          lon = installation.installationParams.longitude;
        } else if (installation.latitude) {
          lat = installation.latitude;
          lon = installation.longitude;
        }
        
        if (!lat || !lon) {
          console.warn('[CBRS] Installation missing coordinates - showing all fields:', {
            index,
            name: installation.name || installation.displayName,
            allFields: Object.keys(installation),
            fullObject: installation
          });
          return;
        }

        // Extract antenna parameters
        const installParams = installation.activeConfig?.installationParams || 
                             installation.preloadedConfig?.installationParams || 
                             installation.installationParams || {};
        
        const azimuth = installParams.antennaAzimuth ?? 0;
        const beamwidth = installParams.antennaBeamwidth ?? 360;
        const height = installParams.height ?? 10;
        const heightType = installParams.heightType?.replace('HEIGHT_TYPE_', '') ?? 'AGL';
        const gain = installParams.antennaGain ?? 5;
        
        // Create sector polygon for antenna coverage (only if beamwidth < 360)
        let sectorGraphic = null;
        
        try {
          if (beamwidth < 360) {
            const sectorPoints = createSectorPolygon(lon, lat, azimuth, beamwidth, 0.5); // 0.5 km radius
            
            const sectorPolygon = new Polygon({
              rings: [sectorPoints],
              spatialReference: { wkid: 4326 }
            });
            
            // Sector fill symbol - semi-transparent purple
            const sectorSymbol = new SimpleFillSymbol({
              color: [124, 58, 237, 0.3], // Purple with 30% opacity
              outline: {
                color: [124, 58, 237, 0.8],
                width: 2
              }
            });
            
            sectorGraphic = {
              geometry: sectorPolygon,
              symbol: sectorSymbol,
              attributes: {
                type: 'sas_sector',
                name: installation.displayName || installation.name || 'SAS Installation',
                installation: installation
              }
            };
          }
        } catch (err) {
          console.warn('[CBRS] Failed to create sector for device:', installation.serialNumber, err);
        }
        
        // Create site center marker - circle
        const siteSymbol = new SimpleMarkerSymbol({
          style: 'circle',
          color: '#7c3aed', // Purple for SAS installations
          size: '10px',
          outline: {
            color: 'white',
            width: 2
          }
        });

        const point = new Point({
          longitude: lon,
          latitude: lat
        });

        // Popup content
        const popupContent = `
          <b>Serial Number:</b> ${installation.serialNumber || 'N/A'}<br>
          <b>FCC ID:</b> ${installation.fccId || 'N/A'}<br>
          <b>Location:</b> ${lat.toFixed(6)}, ${lon.toFixed(6)}<br>
          <b>Height:</b> ${height}m ${heightType}<br>
          <b>Antenna Azimuth:</b> ${azimuth}°<br>
          <b>Antenna Beamwidth:</b> ${beamwidth}°<br>
          <b>Antenna Gain:</b> ${gain} dBi<br>
          <b>Deployment:</b> ${installation.deploymentName || 'N/A'}
        `;

        // Add sector polygon if created
        if (sectorGraphic) {
          const sectorGraphicObj = new Graphic({
            geometry: sectorGraphic.geometry,
            symbol: sectorGraphic.symbol,
            attributes: sectorGraphic.attributes,
            popupTemplate: {
              title: `${installation.displayName || installation.serialNumber || 'SAS Installation'} - Coverage`,
              content: popupContent
            }
          });
          map._graphicsLayer.add(sectorGraphicObj);
        }

        // Add site center marker
        const siteGraphicObj = new Graphic({
          geometry: point,
          symbol: siteSymbol,
          attributes: {
            type: 'sas_installation',
            name: installation.displayName || installation.name || 'SAS Installation',
            installation: installation
          },
          popupTemplate: {
            title: installation.displayName || installation.serialNumber || 'SAS Installation',
            content: popupContent
          }
        });

        map._graphicsLayer.add(siteGraphicObj);
        addedCount++;
      });

      // Zoom to installations if any were added
      if (addedCount > 0 && map._view && map._graphicsLayer.graphics.length > 0) {
        try {
          await map._view.when();
          await map._view.goTo({
            target: map._graphicsLayer.graphics,
            padding: 80,
            duration: 1500
          });
        } catch (goToError) {
          console.warn('[CBRS] Could not animate to installations:', goToError);
        }
      }

      console.log(`[CBRS] ✅ Added ${addedCount} SAS installations to map`);
      
      if (addedCount === 0 && installations.length > 0) {
        console.warn('[CBRS] ⚠️ No installations added - they may be missing coordinates');
        error = 'Installations loaded but none have valid coordinates to display on map';
      }
      
    } catch (err: any) {
      console.error('[CBRS] Error adding installations to map:', err);
      error = 'Failed to display installations on map: ' + (err?.message || 'Unknown error');
    }
  }
</script>

<svelte:head>
  <title>CBRS Management - LTE WISP Platform</title>
  <meta name="description" content="Citizens Broadband Radio Service management with Google SAS and Federated Wireless integration" />
</svelte:head>

<TenantGuard>
<div class="cbrs-module">
  <!-- Header -->
  <div class="module-header">
    <div class="header-content">
      <div class="header-left">
        <a href="/dashboard" class="back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Dashboard
        </a>
        <h1 class="module-title">
          <span class="module-icon">📡</span>
          CBRS Management
        </h1>
        <p class="module-description">Citizens Broadband Radio Service spectrum management</p>
        
        {#if tenantName}
          <div class="tenant-badge">
            <span class="tenant-icon">🏢</span>
            <span class="tenant-text">{tenantName}</span>
          </div>
        {/if}
      </div>
      
      <div class="header-actions">
        {#if currentUserID}
          <button 
            class="btn btn-network-selector active" 
            on:click={handleShowUserIDSelector}
            title="Switch network/User ID"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span class="network-name">{currentUserIDDisplay}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        {:else}
          <button 
            class="btn btn-network-selector" 
            on:click={handleShowUserIDSelector}
            title="Select network/User ID"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            Select Network
          </button>
        {/if}
        <button class="btn btn-secondary" on:click={() => showSettingsModal = true} title="Configure SAS providers">
          ⚙️ Settings
        </button>
        <button class="btn btn-primary" on:click={() => showAddDeviceModal = true}>
          + Add CBSD Device
        </button>
      </div>
    </div>
  </div>

  {#if error}
    <div class="error-banner">
      <span class="error-icon">⚠️</span>
      <span class="error-message">{error}</span>
      <button class="btn btn-sm" on:click={() => error = null}>✕</button>
    </div>
  {/if}
  
  {#if !tenantId}
    <div class="error-banner">
      <span class="error-icon">⚠️</span>
      <span class="error-message">
        No tenant selected. Please return to the 
        <a href="/dashboard" class="inline-link">dashboard</a> 
        and select a tenant first.
      </span>
    </div>
  {:else if configStatus.status !== 'complete'}
    <div class="warning-banner">
      <span class="warning-icon">⚠️</span>
      <span class="warning-message">
        {configStatus.message}
        <button class="btn btn-link" on:click={() => showSettingsModal = true}>
          Configure Now →
        </button>
      </span>
    </div>
  {/if}

  <!-- Main Content -->
  <div class="module-content">
    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📡</div>
        <div class="stat-content">
          <div class="stat-number">{devices.length}</div>
          <div class="stat-label">Total Devices</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-number">{devices.filter(d => d.state === 'REGISTERED' || d.state === 'GRANTED' || d.state === 'AUTHORIZED').length}</div>
          <div class="stat-label">Registered</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-number">{devices.reduce((sum, d) => sum + (d.activeGrants?.length || 0), 0)}</div>
          <div class="stat-label">Active Grants</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">🌐</div>
        <div class="stat-content">
          <div class="stat-number">{CBRS_BAND.BANDWIDTH / 1000000} MHz</div>
          <div class="stat-label">CBRS Band</div>
        </div>
      </div>
    </div>

    <!-- Map -->
    <div class="map-section">
      <div class="map-header">
        <h3>CBSD Device Map</h3>
        <div class="legend">
          <div class="legend-item">
            <span class="legend-color" style="background: #10b981;"></span>
            <span>Active</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #3b82f6;"></span>
            <span>Registered</span>
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #6b7280;"></span>
            <span>Unregistered</span>
          </div>
        </div>
      </div>
      
      <div class="map-container">
        <div bind:this={mapContainer} class="arcgis-map"></div>
        
        {#if isLoading}
          <div class="map-loading">
            <div class="loading-spinner"></div>
            <p>Loading CBRS devices...</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Device List and Grant Status -->
    <div class="content-grid">
      <div class="device-list-section">
        <h3>CBSD Devices</h3>
        <DeviceList 
          {devices}
          onDeviceSelect={handleDeviceSelect}
          onRegister={handleRegisterDevice}
          onDeregister={handleDeregisterDevice}
        />
      </div>
      
      {#if selectedDevice}
        <div class="grant-status-section">
          <GrantStatus 
            device={selectedDevice}
            onRequestGrant={handleRequestGrant}
            onRelinquishGrant={handleRelinquishGrant}
          />
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Add Device Modal -->
{#if showAddDeviceModal}
  <div class="modal-overlay" on:click={() => showAddDeviceModal = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>Add CBSD Device</h3>
        <button class="modal-close" on:click={() => showAddDeviceModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <form on:submit|preventDefault={handleAddDevice}>
          <div class="form-group">
            <label>CBSD Serial Number</label>
            <input type="text" bind:value={newDevice.cbsdSerialNumber} required />
          </div>
          
          <div class="form-group">
            <label>FCC ID</label>
            <input type="text" bind:value={newDevice.fccId} required />
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Category</label>
              <select bind:value={newDevice.cbsdCategory}>
                <option value="A">Category A (Indoor)</option>
                <option value="B">Category B (Outdoor)</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>SAS Provider</label>
              <div class="readonly-field">
                <span class="provider-badge">🔵 Google SAS</span>
                <span class="provider-note">Shared Platform Mode</span>
              </div>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Latitude</label>
              <input type="number" step="0.0001" bind:value={newDevice.latitude} required />
            </div>
            
            <div class="form-group">
              <label>Longitude</label>
              <input type="number" step="0.0001" bind:value={newDevice.longitude} required />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Height (m)</label>
              <input type="number" step="0.1" bind:value={newDevice.height} required />
            </div>
            
            <div class="form-group">
              <label>Antenna Gain (dBi)</label>
              <input type="number" step="0.1" bind:value={newDevice.antennaGain} required />
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" on:click={() => showAddDeviceModal = false}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              Add Device
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Grant Request Modal -->
{#if showGrantRequestModal && selectedDevice}
  <div class="modal-overlay" on:click={() => showGrantRequestModal = false}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h3>Request Spectrum Grant</h3>
        <button class="modal-close" on:click={() => showGrantRequestModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="device-info-card">
          <p><strong>Device:</strong> {selectedDevice.cbsdSerialNumber}</p>
          <p><strong>FCC ID:</strong> {selectedDevice.fccId}</p>
          <p><strong>Category:</strong> {selectedDevice.cbsdCategory}</p>
        </div>
        
        <form on:submit|preventDefault={handleSubmitGrantRequest}>
          <div class="form-group">
            <label>Max EIRP (dBm/MHz)</label>
            <input type="number" step="0.1" bind:value={grantRequest.maxEirp} required />
            <span class="form-hint">Maximum Effective Isotropic Radiated Power</span>
          </div>
          
          <div class="form-group">
            <label>Low Frequency (Hz)</label>
            <input type="number" bind:value={grantRequest.lowFrequency} required />
            <span class="form-hint">Must be between 3550 MHz and 3700 MHz</span>
          </div>
          
          <div class="form-group">
            <label>High Frequency (Hz)</label>
            <input type="number" bind:value={grantRequest.highFrequency} required />
            <span class="form-hint">Must be between 3550 MHz and 3700 MHz</span>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" on:click={() => showGrantRequestModal = false}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              Request Grant
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Settings Modal -->
  <SettingsModal 
    show={showSettingsModal}
    config={cbrsConfig || {}}
    on:close={() => showSettingsModal = false}
    on:save={handleSaveSettings}
  />

<!-- User ID / Network Selector Modal (includes Google login) -->
<UserIDSelector
  show={showUserIDSelector}
  tenantId={tenantId}
  on:select={handleMainUserIDSelect}
  on:close={() => showUserIDSelector = false}
/>
</TenantGuard>

<style>
  .cbrs-module {
    min-height: 100vh;
    background: var(--bg-primary);
  }
  
  .module-header {
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    padding: 1.5rem 2rem;
  }
  
  .header-content {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    transition: all 0.2s;
    width: fit-content;
  }
  
  .back-button:hover {
    color: var(--accent-color);
    border-color: var(--accent-color);
  }
  
  .module-title {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .module-icon {
    font-size: 1.5rem;
  }
  
  .module-description {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0;
  }
  
  .tenant-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 0.5rem;
  }
  
  .tenant-icon {
    font-size: 1rem;
  }
  
  .tenant-text {
    font-weight: 600;
    color: #8b5cf6;
    font-size: 0.875rem;
  }
  
  .header-actions {
    display: flex;
    gap: 1rem;
  }
  
  .btn {
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
  }
  
  .btn-network-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 0.875rem;
  }
  
  .btn-network-selector:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
  }
  
  .btn-network-selector.active {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  }
  
  .btn-network-selector.active:hover {
    box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
  }
  
  .network-name {
    font-weight: 600;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .btn-primary {
    background: var(--accent-color);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--accent-hover);
  }
  
  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  
  .btn-secondary:hover {
    background: var(--bg-hover);
  }
  
  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }
  
  .error-banner {
    background: #fee2e2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 1rem 2rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .error-message {
    flex: 1;
  }
  
  .warning-banner {
    background: #fef3c7;
    border: 1px solid #fde047;
    color: #a16207;
    padding: 1rem 2rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .warning-message {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .btn-link {
    padding: 0;
    background: none;
    border: none;
    color: #9333ea;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  }
  
  .btn-link:hover {
    color: #7e22ce;
  }
  
  .inline-link {
    color: #9333ea;
    font-weight: 600;
    text-decoration: underline;
  }
  
  .inline-link:hover {
    color: #7e22ce;
  }
  
  .module-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.5rem;
  }
  
  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .stat-icon {
    font-size: 2.5rem;
  }
  
  .stat-number {
    font-size: 2rem;
    font-weight: 700;
    color: var(--accent-color);
    line-height: 1;
  }
  
  .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }
  
  .map-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .map-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .map-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .legend {
    display: flex;
    gap: 1.5rem;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }
  
  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid white;
  }
  
  .map-container {
    position: relative;
    height: 500px;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .arcgis-map {
    width: 100%;
    height: 100%;
  }
  
  .map-loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    background: var(--bg-primary);
    padding: 2rem;
    border-radius: 0.5rem;
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .content-grid {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2rem;
  }
  
  .device-list-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .device-list-section h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .grant-status-section {
    min-width: 400px;
    max-width: 500px;
  }
  
  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: var(--bg-primary);
    border-radius: 0.5rem;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .modal-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    border-radius: 0.25rem;
    transition: background-color 0.2s;
  }
  
  .modal-close:hover {
    background: var(--bg-hover);
  }
  
  .modal-body {
    padding: 1.5rem;
  }
  
  .device-info-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .device-info-card p {
    margin: 0.5rem 0;
    font-size: 0.875rem;
  }
  
  .form-group {
    margin-bottom: 1.25rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.625rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.875rem;
  }
  
  .readonly-field {
    padding: 0.625rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .provider-badge {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .provider-note {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-style: italic;
  }
  
  .form-hint {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }
  
  @media (max-width: 1024px) {
    .content-grid {
      grid-template-columns: 1fr;
    }
    
    .grant-status-section {
      min-width: auto;
      max-width: none;
    }
  }
  
  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      gap: 1rem;
    }
    
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .map-container {
      height: 400px;
    }
    
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>

