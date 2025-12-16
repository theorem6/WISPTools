<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { currentTenant } from '$lib/stores/tenantStore';
  import CoverageMapView from '../../coverage-map/components/CoverageMapView.svelte';
  import { coverageMapService } from '../../coverage-map/lib/coverageMapService.mongodb';
  import type { TowerSite, Sector, CPEDevice, NetworkEquipment, CoverageMapFilters } from '../../coverage-map/lib/models';
  
  const dispatch = createEventDispatcher();
  
  export let devices = [];
  export let alerts = [];
  export let dashboardData = null;
  export let networkDevices = [];
  export let height = '600px';
  
  // Convert monitoring devices to network equipment for the map
  let equipment: NetworkEquipment[] = [];
  let towers: TowerSite[] = [];
  let sectors: Sector[] = [];
  let cpeDevices: CPEDevice[] = [];
  
  // Map component reference for preserving zoom/center
  let mapComponent: any = null;
  let savedViewState: { center?: [number, number], zoom?: number } | null = null;
  let isRefreshing = false; // Flag to prevent multiple simultaneous refreshes
  
  $: tenantId = $currentTenant?.id || '';
  
  // Monitoring-specific filters (show all network equipment)
  let filters: CoverageMapFilters = {
    showTowers: true,
    showSectors: true,
    showCPE: true,
    showEquipment: true,
    showBackhaul: true,
    showVehicles: false,
    showWarehouses: false,
    showNOCs: false,
    showRMA: false,
    showInventory: false,
    showCoverage: false,
    showLabels: true,
    showConnections: true,
    towerTypes: [] as string[],
    sectorTypes: [] as string[],
    equipmentTypes: [] as string[],
    statusFilter: 'all' as 'all' | 'active' | 'inactive' | 'maintenance'
  };
  
  // Helper function to check if coordinates are valid (not 0,0 or null)
  function hasValidCoordinates(lat: number | null | undefined, lon: number | null | undefined): boolean {
    if (lat == null || lon == null) return false;
    if (typeof lat !== 'number' || typeof lon !== 'number') return false;
    if (lat === 0 && lon === 0) return false; // 0,0 is in the ocean
    if (lat < -90 || lat > 90) return false; // Invalid latitude range
    if (lon < -180 || lon > 180) return false; // Invalid longitude range
    return true;
  }

  // Calculate system uptime percentage
  function getSystemUptimePercent(): number {
    if (!networkDevices || networkDevices.length === 0) return 0;
    const onlineDevices = networkDevices.filter(d => d.status === 'online').length;
    return Math.round((onlineDevices / networkDevices.length) * 100);
  }

  // Convert devices to equipment format for the map
  // Enhance devices with location from their siteId if missing
  function convertDevicesToEquipment() {
    // Calculate system uptime first
    const systemUptime = getSystemUptimePercent();
    
    // Create a map of siteId -> site location for quick lookup
    const siteLocationMap = new Map();
    towers.forEach(site => {
      const siteId = site.id || site._id;
      if (siteId && site.location) {
        const lat = site.location.latitude || site.location.coordinates?.latitude;
        const lon = site.location.longitude || site.location.coordinates?.longitude;
        if (hasValidCoordinates(lat, lon)) {
          siteLocationMap.set(String(siteId), {
            latitude: lat,
            longitude: lon,
            address: site.location.address || site.name || 'Unknown Location'
          });
        }
      }
    });
    
    // Filter devices: only show devices with valid coordinates (get from site if needed)
    let validDevices = 0;
    let skippedDevices = 0;
    
    equipment = devices
      .map(device => {
        // Try to get location from device first
        let lat = device.location?.coordinates?.latitude || device.location?.latitude;
        let lon = device.location?.coordinates?.longitude || device.location?.longitude;
        let address = device.location?.address || device.location?.coordinates?.address;
        
        // If device doesn't have valid location, try to get it from siteId
        if (!hasValidCoordinates(lat, lon)) {
          const deviceSiteId = device.siteId || device.site_id;
          if (deviceSiteId) {
            const siteLocation = siteLocationMap.get(String(deviceSiteId));
            if (siteLocation) {
              lat = siteLocation.latitude;
              lon = siteLocation.longitude;
              address = siteLocation.address || address;
              console.log(`[MonitoringMap] Device ${device.name || device.id} got location from site ${deviceSiteId}`);
            }
          }
        }
        
        const hasValid = hasValidCoordinates(lat, lon);
        
        if (hasValid) {
          validDevices++;
        } else {
          skippedDevices++;
        }
        
        // Only include devices with valid coordinates
        if (!hasValid) {
          return null;
        }
        
        const equipmentItem = {
          id: device.id,
          name: device.name,
          type: getEquipmentType(device),
          status: device.status,
          location: {
            latitude: lat,
            longitude: lon,
            address: address || 'Unknown Location'
          },
          ipAddress: device.ipAddress,
          siteId: device.siteId || device.site_id,
          lastSeen: new Date().toISOString(),
          metrics: device.metrics || {},
          monitoringData: {
            cpuUsage: device.metrics?.cpuUsage,
            memoryUsage: device.metrics?.memoryUsage,
            uptime: device.metrics?.uptime,
            throughput: device.metrics?.throughput,
            connectedClients: device.metrics?.connectedClients,
            signalStrength: device.metrics?.signalStrength
          }
        };
        
        return equipmentItem;
      })
      .filter(item => item !== null); // Remove null entries (devices without valid locations)
    
    // Summary log only
    if (devices.length > 0) {
      console.log(`[MonitoringMap] Processed ${devices.length} devices: ${validDevices} with valid locations, ${skippedDevices} skipped (no valid coordinates), system uptime: ${systemUptime}%`);
    }
    // Note: Towers are now loaded separately via loadSites() function
  }
  
  function getEquipmentType(device) {
    switch (device.type) {
      case 'epc':
        return 'EPC Core';
      case 'mikrotik':
        switch (device.deviceType) {
          case 'router': return 'Router';
          case 'ap': return 'Access Point';
          case 'cpe': return 'CPE';
          default: return 'Network Device';
        }
      case 'snmp':
        return device.deviceType === 'switch' ? 'Switch' : 'SNMP Device';
      default:
        return 'Unknown Device';
    }
  }
  
  // Handle map events
  function handleMapEvent(event) {
    dispatch(event.type, event.detail);
  }
  
  // Calculate distance between two coordinates (in kilometers)
  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  // Note: Left-click functionality removed - only right-click opens modal

  // Helper function to get alert severity color
  function getAlertSeverityColor(severity) {
    switch (severity?.toLowerCase()) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  }

  // Calculate uptime percentage (device availability)
  function calculateUptime() {
    if (!networkDevices || networkDevices.length === 0) return 0;
    const onlineDevices = networkDevices.filter(d => d.status === 'online').length;
    return Math.round((onlineDevices / networkDevices.length) * 100);
  }
  
  // Get EPC system uptime (actual system runtime)
  function getEPCSystemUptime() {
    if (!networkDevices || networkDevices.length === 0) return null;
    
    // Find EPC devices with uptime metrics
    const epcDevices = networkDevices.filter(d => d.type === 'epc' && d.metrics?.uptime);
    
    if (epcDevices.length === 0) return null;
    
    // Return the longest uptime (most reliable EPC)
    const uptimes = epcDevices
      .map(d => {
        const uptimeStr = d.metrics?.uptime;
        if (!uptimeStr) return null;
        
        // Parse formatted uptime string (e.g., "10d 5h 30m" or "5h 30m" or "30m")
        // Or if it's a number (seconds), convert it
        if (typeof uptimeStr === 'number') {
          return uptimeStr;
        }
        
        // Parse formatted string
        const daysMatch = uptimeStr.match(/(\d+)d/);
        const hoursMatch = uptimeStr.match(/(\d+)h/);
        const minutesMatch = uptimeStr.match(/(\d+)m/);
        
        const days = daysMatch ? parseInt(daysMatch[1]) : 0;
        const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
        const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
        
        return (days * 24 * 60 * 60) + (hours * 60 * 60) + (minutes * 60);
      })
      .filter(u => u !== null && u > 0);
    
    if (uptimes.length === 0) return null;
    
    // Return the longest uptime in seconds
    const maxUptime = Math.max(...uptimes);
    
    // Format it nicely
    const days = Math.floor(maxUptime / (24 * 60 * 60));
    const hours = Math.floor((maxUptime % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((maxUptime % (60 * 60)) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
  
  // Calculate uptime percentage for a site based on devices
  function calculateSiteUptime(siteId: string): number {
    if (!networkDevices || networkDevices.length === 0) return 0;
    
    // Find all devices at this site
    const siteDevices = networkDevices.filter(device => {
      // Try multiple ways to get siteId from device (handle ObjectId objects)
      const deviceSiteId = device.siteId?._id || device.siteId?.id || device.siteId || 
                          device.site_id?._id || device.site_id?.id || device.site_id;
      
      // Normalize both IDs to strings for comparison
      const normalizedSiteId = String(siteId);
      const normalizedDeviceSiteId = deviceSiteId ? String(deviceSiteId) : null;
      
      return normalizedSiteId && normalizedDeviceSiteId && normalizedSiteId === normalizedDeviceSiteId;
    });
    
    if (siteDevices.length === 0) return 0;
    
    // Calculate uptime based on device statuses
    // Count online devices, and don't penalize unknown devices (they might just not have monitoring data yet)
    const onlineDevices = siteDevices.filter(d => d.status === 'online').length;
    const offlineDevices = siteDevices.filter(d => d.status === 'offline').length;
    const unknownDevices = siteDevices.filter(d => d.status === 'unknown' || !d.status).length;
    
    // If we have online devices, calculate based on online vs offline (ignore unknown)
    if (onlineDevices > 0 || offlineDevices > 0) {
      const monitoredDevices = onlineDevices + offlineDevices;
      if (monitoredDevices > 0) {
        return Math.round((onlineDevices / monitoredDevices) * 100);
      }
    }
    
    // If all devices are unknown but we have devices, assume 50% (maintenance) rather than 0% (inactive)
    // This prevents sites from showing as inactive just because monitoring hasn't started yet
    if (unknownDevices === siteDevices.length && siteDevices.length > 0) {
      return 50; // Show as maintenance (yellow) rather than inactive (red)
    }
    
    // Default: if we have devices but no clear status, return 0 (will show as inactive)
    return 0;
  }
  
  // Get worst alert severity for devices at a site
  function getWorstAlertSeverity(siteId: string): 'critical' | 'error' | 'warning' | 'info' | null {
    if (!alerts || alerts.length === 0) return null;
    if (!networkDevices || networkDevices.length === 0) return null;
    
    // Find all devices at this site
    const siteDevices = networkDevices.filter(device => {
      const deviceSiteId = device.siteId || device.site_id;
      return deviceSiteId && (String(deviceSiteId) === String(siteId));
    });
    
    if (siteDevices.length === 0) return null;
    
    // Get device IDs at this site
    const siteDeviceIds = new Set(siteDevices.map(d => String(d.id || d._id)));
    
    // Find alerts for devices at this site
    const siteAlerts = alerts.filter((alert: any) => {
      const alertDeviceId = alert.deviceId || alert.device_id;
      return alertDeviceId && siteDeviceIds.has(String(alertDeviceId));
    });
    
    if (siteAlerts.length === 0) return null;
    
    // Determine worst severity (critical > error > warning > info)
    const severityOrder: Record<string, number> = { critical: 4, error: 3, warning: 2, info: 1 };
    let worstSeverity: 'critical' | 'error' | 'warning' | 'info' | null = null;
    let worstOrder = 0;
    
    siteAlerts.forEach((alert: any) => {
      const severity = alert.severity?.toLowerCase();
      const order = severityOrder[severity] || 0;
      if (order > worstOrder) {
        worstOrder = order;
        worstSeverity = severity as 'critical' | 'error' | 'warning' | 'info';
      }
    });
    
    return worstSeverity;
  }
  
  // Get site status based on uptime and alerts
  function getSiteStatus(siteId: string, systemUptime: number): 'active' | 'inactive' | 'maintenance' {
    const worstAlert = getWorstAlertSeverity(siteId);
    
    // Priority: alerts > system uptime > site-specific uptime
    if (worstAlert === 'critical' || worstAlert === 'error') {
      return 'inactive'; // Red
    } else if (worstAlert === 'warning') {
      return 'maintenance'; // Yellow
    } else if (systemUptime === 100) {
      return 'active'; // Green - system is 100% uptime
    } else {
      const siteUptime = calculateSiteUptime(siteId);
      
      // Check if site has any devices at all
      const siteDevices = networkDevices?.filter(device => {
        // Try multiple ways to get siteId from device (handle ObjectId objects)
        const deviceSiteId = device.siteId?._id || device.siteId?.id || device.siteId || 
                            device.site_id?._id || device.site_id?.id || device.site_id;
        
        // Normalize both IDs to strings for comparison
        const normalizedSiteId = String(siteId);
        const normalizedDeviceSiteId = deviceSiteId ? String(deviceSiteId) : null;
        
        return normalizedSiteId && normalizedDeviceSiteId && normalizedSiteId === normalizedDeviceSiteId;
      }) || [];
      
      // If site has devices but all are unknown (no monitoring data yet), show as maintenance not inactive
      if (siteDevices.length > 0) {
        const allUnknown = siteDevices.every(d => d.status === 'unknown' || !d.status);
        if (allUnknown && siteUptime === 50) {
          return 'maintenance'; // Yellow - devices exist but monitoring hasn't started
        }
      }
      
      if (siteUptime === 100) return 'active';
      if (siteUptime === 0 && siteDevices.length === 0) return 'inactive'; // No devices = inactive
      if (siteUptime === 0 && siteDevices.length > 0) return 'maintenance'; // Has devices but all offline = maintenance
      return 'maintenance'; // Partial uptime = maintenance
    }
  }
  
  // Check if a site is a fake New York test site
  function isFakeNewYorkSite(site: any): boolean {
    if (!site || !site.location) return false;
    
    const lat = site.location.latitude || site.location.coordinates?.latitude;
    const lon = site.location.longitude || site.location.coordinates?.longitude;
    const name = (site.name || '').toLowerCase();
    
    // Check for New York coordinates (from test script)
    const fakeCoords = [
      { lat: 40.7128, lon: -74.0060 },
      { lat: 40.7589, lon: -73.9851 },
      { lat: 40.7505, lon: -73.9934 },
      { lat: 40.7282, lon: -73.9942 },
      { lat: 40.7614, lon: -73.9776 }
    ];
    
    if (lat && lon) {
      for (const coord of fakeCoords) {
        if (Math.abs(lat - coord.lat) < 0.01 && Math.abs(lon - coord.lon) < 0.01) {
          return true;
        }
      }
    }
    
    // Check for fake site names
    const fakeNames = ['main tower site', 'secondary tower', 'noc facility', 'customer site a', 'customer site b'];
    if (fakeNames.some(n => name.includes(n))) {
      return true;
    }
    
    return false;
  }
  
  // Save current map view state before refreshing
  async function saveMapViewState() {
    if (mapComponent && mapComponent.mapView) {
      try {
        const view = mapComponent.mapView;
        await view.when();
        const center = view.center;
        const zoom = view.zoom;
        if (center && zoom !== undefined) {
          savedViewState = {
            center: [center.longitude, center.latitude],
            zoom: zoom
          };
          console.log('[MonitoringMap] Saved map view state:', savedViewState);
        }
      } catch (error) {
        console.warn('[MonitoringMap] Error saving map view state:', error);
      }
    }
  }
  
  // Restore map view state after refreshing
  async function restoreMapViewState() {
    if (savedViewState && mapComponent && mapComponent.mapView) {
      try {
        const view = mapComponent.mapView;
        await view.when();
        if (savedViewState.center && savedViewState.zoom !== undefined) {
          await view.goTo({
            center: savedViewState.center,
            zoom: savedViewState.zoom
          }, { animate: false });
          console.log('[MonitoringMap] Restored map view state:', savedViewState);
        }
      } catch (error) {
        console.warn('[MonitoringMap] Error restoring map view state:', error);
      }
    }
  }
  
  // Load sites, sectors, backhauls, and CPE from database with uptime data
  async function loadSites() {
    if (!tenantId) {
      towers = [];
      sectors = [];
      cpeDevices = [];
      return;
    }
    
    // Save map view state before refreshing (preserve zoom/center)
    await saveMapViewState();
    
    try {
      // Load actual sites from database
      const loadedSites = await coverageMapService.getTowerSites(tenantId);
      
      // Filter out fake New York sites
      const realSites = loadedSites.filter((site: any) => !isFakeNewYorkSite(site));
      
      // Calculate system uptime for status determination
      const systemUptime = getSystemUptimePercent();
      
      // Process sites with status calculation
      const processedSites = realSites.map((site: any) => {
        const siteId = site.id || site._id;
        const status = getSiteStatus(siteId, systemUptime);
        
        return {
          ...site,
          id: siteId,
          status: status,
          uptimePercent: calculateSiteUptime(siteId),
          worstAlertSeverity: getWorstAlertSeverity(siteId)
        };
      });
      
      // Also create device-based towers (for devices without sites but with valid locations)
      const deviceTowers = devices
        .filter(device => {
          // Only create tower if device doesn't already have a site in the database
          const deviceSiteId = device.siteId || device.site_id;
          if (deviceSiteId) {
            // Check if site already exists in database
            const existingSite = processedSites.find(s => String(s.id) === String(deviceSiteId));
            if (existingSite) return false; // Site already exists, skip device tower
          }
          
          // Only create towers for devices with valid coordinates
          const lat = device.location?.coordinates?.latitude || device.location?.latitude;
          const lon = device.location?.coordinates?.longitude || device.location?.longitude;
          if (!hasValidCoordinates(lat, lon)) return false;
          
          // Only create towers for major devices (EPCs, routers) - not every device needs a tower
          return device.type === 'epc' || (device.type === 'mikrotik' && device.deviceType === 'router');
        })
        .map(device => {
          const lat = device.location?.coordinates?.latitude || device.location?.latitude || 0;
          const lon = device.location?.coordinates?.longitude || device.location?.longitude || 0;
          const systemUptime = getSystemUptimePercent();
          const status = getSiteStatus(device.id, systemUptime);
          
          return {
            id: `tower-${device.id}`,
            name: `${device.name} Site`,
            type: 'tower',
            status: status,
            location: {
              latitude: lat,
              longitude: lon,
              address: device.location?.address || 'Unknown Location'
            },
            height: 50,
            equipment: [device.id],
            deviceId: device.id
          };
        });
      
      // Merge database sites with device-based towers
      towers = [...processedSites, ...deviceTowers];
      
      console.log(`[MonitoringMap] Loaded ${towers.length} sites (${processedSites.length} from DB, ${deviceTowers.length} device-based)`);
      
      // Re-process devices now that sites are loaded so they can get locations from sites
      if (devices && devices.length > 0) {
        convertDevicesToEquipment();
      }
      
      // Restore map view state after loading (preserve zoom/center)
      setTimeout(() => restoreMapViewState(), 100); // Small delay to ensure map updates first
      
      // Load sectors from database
      try {
        const allSectors = await coverageMapService.getSectors(tenantId);
        
        // Process sectors with uptime calculation based on associated devices
        sectors = allSectors.map((sector: any) => {
          const sectorSiteId = sector.towerId?._id || sector.towerId?.id || sector.towerId || 
                               sector.siteId?._id || sector.siteId?.id || sector.siteId;
          
          // Calculate uptime for this sector based on devices at its site
          let sectorStatus = sector.status || 'active';
          let uptimePercent = 100;
          
          if (sectorSiteId && networkDevices) {
            const siteDevices = networkDevices.filter((device: any) => {
              const deviceSiteId = device.siteId || device.site_id;
              return deviceSiteId && String(deviceSiteId) === String(sectorSiteId);
            });
            
            if (siteDevices.length > 0) {
              const onlineDevices = siteDevices.filter((d: any) => d.status === 'online').length;
              uptimePercent = Math.round((onlineDevices / siteDevices.length) * 100);
              
              // Set status based on uptime
              if (uptimePercent === 100) {
                sectorStatus = 'active';
              } else if (uptimePercent === 0) {
                sectorStatus = 'inactive';
              } else {
                sectorStatus = 'maintenance';
              }
            }
          }
          
          return {
            ...sector,
            id: sector.id || sector._id,
            status: sectorStatus,
            uptimePercent: uptimePercent
          };
        });
        
        console.log(`[MonitoringMap] Loaded ${sectors.length} sectors with uptime data`);
      } catch (error) {
        console.error('[MonitoringMap] Failed to load sectors:', error);
        sectors = [];
      }
      
      // Load backhauls from equipment (type: 'backhaul')
      // Backhauls are already included in equipment from convertDevicesToEquipment()
      // But we enhance them with uptime data here
      try {
        const allEquipment = await coverageMapService.getEquipment(tenantId);
        const backhaulEquipment = allEquipment.filter((eq: any) => eq.type === 'backhaul');
        
        // Update equipment array to include backhauls with uptime data
        if (backhaulEquipment.length > 0) {
          backhaulEquipment.forEach((backhaul: any) => {
            // Find if this backhaul is already in the equipment array
            const existingIndex = equipment.findIndex((eq: any) => 
              String(eq.id) === String(backhaul.id || backhaul._id)
            );
            
            // Get IP address from backhaul notes or config
            let ipAddress = null;
            if (backhaul.notes) {
              try {
                const notes = typeof backhaul.notes === 'string' ? JSON.parse(backhaul.notes) : backhaul.notes;
                ipAddress = notes.management_ip || notes.ip_address || notes.ipAddress;
              } catch {
                // Ignore parse errors
              }
            }
            
            // Find matching device in networkDevices for uptime
            let backhaulStatus = backhaul.status || 'active';
            let uptimePercent = 100;
            
            if (networkDevices) {
              const matchingDevice = networkDevices.find((device: any) => {
                return (device.id === String(backhaul.id || backhaul._id)) ||
                       (ipAddress && device.ipAddress === ipAddress) ||
                       (backhaul.serialNumber && device.serialNumber === backhaul.serialNumber);
              });
              
              if (matchingDevice) {
                backhaulStatus = matchingDevice.status || 'unknown';
                // Status-based uptime estimation
                if (backhaulStatus === 'online') {
                  uptimePercent = 100;
                } else if (backhaulStatus === 'offline') {
                  uptimePercent = 0;
                } else {
                  uptimePercent = 50; // Unknown status
                }
              }
            }
            
            const backhaulWithUptime = {
              ...backhaul,
              id: backhaul.id || backhaul._id,
              type: 'backhaul',
              status: backhaulStatus,
              uptimePercent: uptimePercent,
              ipAddress: ipAddress,
              location: backhaul.location || {
                latitude: 0,
                longitude: 0,
                address: 'Unknown Location'
              }
            };
            
            if (existingIndex >= 0) {
              // Update existing equipment entry
              equipment[existingIndex] = { ...equipment[existingIndex], ...backhaulWithUptime };
            } else {
              // Add new backhaul equipment
              equipment.push(backhaulWithUptime);
            }
          });
        }
        
        console.log(`[MonitoringMap] Processed ${backhaulEquipment.length} backhaul equipment items with uptime data`);
      } catch (error) {
        console.error('[MonitoringMap] Failed to load backhaul equipment:', error);
      }
      
      // Load CPE devices from database
      try {
        const allCPE = await coverageMapService.getCPEDevices(tenantId);
        
        // Process CPE with uptime from networkDevices
        cpeDevices = allCPE.map((cpe: any) => {
          const cpeSiteId = cpe.siteId?._id || cpe.siteId?.id || cpe.siteId;
          
          // Find matching device in networkDevices for uptime
          let cpeStatus = cpe.status || 'active';
          let uptimePercent = 100;
          
          if (networkDevices) {
            const matchingDevice = networkDevices.find((device: any) => {
              return (device.id === String(cpe.id || cpe._id)) ||
                     (device.serialNumber === cpe.serialNumber) ||
                     (cpeSiteId && (device.siteId || device.site_id) && 
                      String(device.siteId || device.site_id) === String(cpeSiteId) && 
                      (device.type === 'cpe' || device.deviceType === 'cpe'));
            });
            
            if (matchingDevice) {
              cpeStatus = matchingDevice.status || 'unknown';
              // Status-based uptime
              if (cpeStatus === 'online') {
                uptimePercent = 100;
              } else if (cpeStatus === 'offline') {
                uptimePercent = 0;
              } else {
                uptimePercent = 0; // Unknown status - grey
              }
            } else {
              // No matching device - show as unknown (grey)
              cpeStatus = 'unknown';
              uptimePercent = 0;
            }
          }
          
          return {
            ...cpe,
            id: cpe.id || cpe._id,
            status: cpeStatus,
            uptimePercent: uptimePercent,
            location: cpe.location || {
              latitude: 0,
              longitude: 0,
              address: 'Unknown Location'
            }
          };
        });
        
        console.log(`[MonitoringMap] Loaded ${cpeDevices.length} CPE devices from database with uptime data`);
      } catch (error) {
        console.error('[MonitoringMap] Failed to load CPE devices:', error);
        cpeDevices = [];
      }
    } catch (error) {
      console.error('[MonitoringMap] Failed to load sites:', error);
      towers = [];
      sectors = [];
      cpeDevices = [];
    }
  }
  
  // Watch for device changes - wait for towers to be loaded so devices can get locations from sites
  $: if (devices && towers.length > 0) {
    convertDevicesToEquipment();
  }
  
  // Also re-process devices when towers change (sites loaded)
  $: if (devices && towers.length > 0) {
    convertDevicesToEquipment();
  }
  
  // Watch for tenant, devices, and alerts to reload sites with updated status
  $: if (tenantId) {
    loadSites();
  }
  
  // Handle refreshData event from parent - reload sites when data refreshes
  export function handleRefresh() {
    if (tenantId) {
      loadSites();
    }
  }
  
  // Also listen to refreshData event dispatched by this component's refresh button
  function handleInternalRefresh() {
    handleRefresh();
    dispatch('refreshData'); // Forward to parent
  }
  
  // Load sites on mount
  onMount(() => {
    if (tenantId) {
      loadSites();
    }
  });
</script>

<div class="monitoring-map" style="height: {height};">
  <!-- Combined Monitoring Panel - Right Side -->
  <div class="combined-controls">
    <div class="combined-panel">
      <!-- System Status Section - Top -->
      <div class="status-section">
        <div class="section-header">
          <h3>📊 System Status</h3>
          <button class="refresh-btn" on:click={() => dispatch('refreshData')} title="Refresh Data">
            🔄
          </button>
        </div>
        <div class="status-cards">
          <div class="status-card critical">
            <div class="status-icon">🚨</div>
            <div class="status-content">
              <div class="status-value">{dashboardData?.summary?.critical_alerts || 0}</div>
              <div class="status-label">Critical</div>
            </div>
          </div>
          
          <div class="status-card warning">
            <div class="status-icon">⚠️</div>
            <div class="status-content">
              <div class="status-value">{dashboardData?.summary?.total_alerts || 0}</div>
              <div class="status-label">Alerts</div>
            </div>
          </div>
          
          <div class="status-card success">
            <div class="status-icon">✅</div>
            <div class="status-content">
              <div class="status-value">{networkDevices.filter(d => d.status === 'online').length}</div>
              <div class="status-label">Online</div>
            </div>
          </div>
          
          <div class="status-card info">
            <div class="status-icon">📊</div>
            <div class="status-content">
              <div class="status-value">{calculateUptime()}%</div>
              <div class="status-label">Device Uptime</div>
            </div>
          </div>
          
          {#if getEPCSystemUptime()}
            <div class="status-card success">
              <div class="status-icon">⏱️</div>
              <div class="status-content">
                <div class="status-value" style="font-size: 0.9rem;">{getEPCSystemUptime()}</div>
                <div class="status-label">EPC System Uptime</div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Active Alerts Section - Bottom -->
      <div class="alerts-section">
        <div class="section-header">
          <h3>🚨 Active Alerts</h3>
          <span class="alerts-count">{alerts.length}</span>
        </div>

        <div class="alerts-list">
          {#if alerts.length > 0}
            {#each alerts as alert, index}
              <div 
                class="alert-item clickable" 
                style="border-left-color: {getAlertSeverityColor(alert.severity)}"
                on:click={() => dispatch('alertClick', alert)}
                on:keydown={(e) => e.key === 'Enter' && dispatch('alertClick', alert)}
                tabindex="0"
                role="button"
              >
                <div class="alert-content">
                  <div class="alert-header">
                    <div class="alert-severity {alert.severity?.toLowerCase()}">{alert.severity}</div>
                    <div class="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <div class="alert-message">{alert.message}</div>
                  <div class="alert-actions">
                    <button 
                      class="alert-action-btn details"
                      on:click|stopPropagation={() => dispatch('showAlertDetails', alert)}
                    >
                      📋 Details
                    </button>
                    <button 
                      class="alert-action-btn ticket"
                      on:click|stopPropagation={() => dispatch('createTicketFromAlert', alert)}
                    >
                      🎫 Create Ticket
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          {:else}
            <div class="no-alerts">
              <div class="no-alerts-icon">✅</div>
              <div class="no-alerts-text">No active alerts</div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Coverage Map with hidden plan/deploy elements -->
  <div class="map-wrapper">
    <CoverageMapView
      bind:this={mapComponent}
      {towers}
      {sectors}
      {cpeDevices}
      {equipment}
      {filters}
      externalPlanFeatures={[]}
      marketingLeads={[]}
      planId={null}
      on:asset-click={(e) => {
        // Handle asset-click events from map (towers emit this)
        // Only right-click opens the modal - no left-click functionality
        const asset = e.detail;
        if (asset && asset.type === 'tower' && asset.id && asset.isRightClick) {
          const site = towers.find(t => String(t.id) === String(asset.id));
          if (site) {
            // Right-click opens comprehensive site details modal
            dispatch('siteRightClick', { site });
          }
        }
        handleMapEvent(e);
      }}
      on:sectorSelected={handleMapEvent}
      on:cpeSelected={handleMapEvent}
      on:equipmentSelected={handleMapEvent}
      on:mapClick={handleMapEvent}
      on:contextMenu={handleMapEvent}
    />
  </div>
</div>

<style>
  .monitoring-map {
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: var(--bg-secondary, #f9fafb);
  }
  
  .combined-controls {
    position: absolute;
    top: 20px; /* Same height as exit menu */
    right: 10px;
    z-index: 1000;
    pointer-events: none;
  }
  
  .combined-panel {
    background: var(--color-background-primary);
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--color-border);
    pointer-events: auto;
    width: 350px;
    max-height: calc(100vh - 60px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .section-header h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 1.1rem;
    font-weight: 600;
  }

  .refresh-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    color: var(--color-text-secondary);
  }

  .refresh-btn:hover {
    background: var(--color-background-secondary);
    color: var(--color-text-primary);
    transform: translateY(-1px);
  }
  
  .combined-panel h4 {
    margin: 1.5rem 0 0.75rem 0;
    color: var(--color-text-primary);
    font-size: 0.95rem;
    font-weight: 600;
  }

  /* Status Section */
  .status-section {
    flex-shrink: 0;
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid var(--color-border);
  }

  .status-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }
  
  /* If there are 5 cards, make them wrap nicely */
  .status-cards:has(> :nth-child(5)) {
    grid-template-columns: repeat(3, 1fr);
  }

  .status-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem;
    background: var(--color-background-primary);
    border-radius: 8px;
    border: 1px solid var(--color-border);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
  }

  .status-card:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .status-card.critical {
    border-left: 4px solid var(--color-danger);
  }

  .status-card.warning {
    border-left: 4px solid var(--color-warning);
  }

  .status-card.success {
    border-left: 4px solid var(--color-success);
  }

  .status-card.info {
    border-left: 4px solid var(--color-info);
  }

  .status-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .status-content {
    flex: 1;
    min-width: 0;
  }

  .status-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1.2;
    margin-bottom: 0.25rem;
  }

  .status-label {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }
  
  
  .map-wrapper {
    width: 100%;
    height: 100%;
  }
  
  /* Hide ALL plan/deploy specific UI elements */
  :global(.monitoring-map .layer-panel),
  :global(.monitoring-map .plan-panel),
  :global(.monitoring-map .deploy-panel),
  :global(.monitoring-map .project-panel),
  :global(.monitoring-map .marketing-panel),
  :global(.monitoring-map .plan-controls),
  :global(.monitoring-map .deploy-controls),
  :global(.monitoring-map .filter-panel),
  :global(.monitoring-map .esri-ui-top-left > div:not(.esri-zoom)),
  :global(.monitoring-map .esri-ui-top-right > div),
  :global(.monitoring-map .esri-ui-bottom-left > div),
  :global(.monitoring-map .esri-ui-bottom-right > div:not(.esri-attribution)) {
    display: none !important;
  }
  
  /* Override coverage map styles for monitoring */
  :global(.monitoring-map .esri-view) {
    border-radius: 8px;
  }

  /* Alerts Section */
  .alerts-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .alerts-count {
    background: var(--color-danger);
    color: var(--color-text-inverse);
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .alerts-list {
    flex: 1;
    overflow-y: auto;
    margin: 1rem 0 0 0;
    padding-right: 0.5rem;
    min-height: 0;
  }

  /* Custom scrollbar for alerts list */
  .alerts-list::-webkit-scrollbar {
    width: 6px;
  }

  .alerts-list::-webkit-scrollbar-track {
    background: var(--color-background-secondary);
    border-radius: 3px;
  }

  .alerts-list::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }

  .alerts-list::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-tertiary);
  }

  .alert-item {
    padding: 1rem;
    border-bottom: 1px solid var(--color-border);
    border-left: 4px solid transparent;
    transition: all 0.2s ease;
    border-radius: 8px;
    margin-bottom: 0.75rem;
    background: var(--color-background-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .alert-item.clickable {
    cursor: pointer;
  }

  .alert-item.clickable:hover {
    background: var(--color-background-secondary);
    border-left-width: 6px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .alert-item.clickable:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .alert-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .alert-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .alert-severity {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    letter-spacing: 0.025em;
  }

  .alert-severity.critical {
    color: var(--color-danger);
    background: rgba(239, 68, 68, 0.1);
  }

  .alert-severity.warning {
    color: var(--color-warning);
    background: rgba(245, 158, 11, 0.1);
  }

  .alert-severity.info {
    color: var(--color-info);
    background: rgba(59, 130, 246, 0.1);
  }

  .alert-message {
    font-size: 0.875rem;
    color: var(--color-text-primary);
    line-height: 1.5;
    font-weight: 500;
  }

  .alert-time {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .alert-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .alert-action-btn {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-background-primary);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .alert-action-btn:hover {
    background: var(--color-background-secondary);
    border-color: var(--color-primary);
    color: var(--color-primary);
    transform: translateY(-1px);
  }

  .alert-action-btn.details:hover {
    border-color: var(--color-info);
    color: var(--color-info);
  }

  .alert-action-btn.ticket:hover {
    border-color: var(--color-success);
    color: var(--color-success);
  }

  .no-alerts {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    color: var(--color-text-secondary);
  }

  .no-alerts-icon {
    font-size: 2rem;
    margin-bottom: 0.75rem;
  }

  .no-alerts-text {
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
    color: var(--color-text-primary);
  }
</style>
