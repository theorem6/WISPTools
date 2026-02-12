// CPE Device Data Service
// Handles loading and managing CPE device data with multi-tenant support
// Connects directly to GenieACS backend API

export interface CPEDevice {
  id: string;
  manufacturer: string;
  status: 'Online' | 'Offline';
  location: {
    latitude: number;
    longitude: number;
  };
  lastContact: Date | string;
  parameters?: Record<string, any>;
  tenantId?: string;
  model?: string;
  serialNumber?: string;
  ipAddress?: string;
  firmware?: string;
  tags?: string[];
}

/**
 * Load CPE devices from the API (multi-tenant, authenticated)
 */
export async function loadCPEDevices(): Promise<CPEDevice[]> {
  try {
    console.log('Loading CPE devices from GenieACS backend API...');
    
    // Get auth token and tenant ID
    const { authService } = await import('$lib/services/authService');
    const { currentTenant } = await import('$lib/stores/tenantStore');
    const { get } = await import('svelte/store');
    
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }
    
    const token = await authService.getAuthTokenForApi();
    const tenantId = get(currentTenant)?.id;
    
    if (!tenantId) {
      throw new Error('No tenant selected');
    }
    
    // Call backend API directly - /api/tr069/devices
    const response = await fetch('/api/tr069/devices', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CPE Data Service] API error:', response.status, errorText);
      throw new Error(`Failed to load devices: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success && result.devices) {
      const devices = Array.isArray(result.devices) ? result.devices : [];
      
      if (devices.length > 0) {
        console.log(`✅ Loaded ${devices.length} real devices from GenieACS`);
        return devices.map(convertGenieACSDevice);
      } else {
        console.log('⚠️ No devices found in GenieACS for this tenant');
        return [];
      }
    }
    
    console.log('⚠️ No devices returned from API');
    return [];
    
  } catch (error) {
    console.error('Error loading CPE devices from GenieACS:', error);
    // Don't return fake data - return empty array so user knows there's an issue
    return [];
  }
}

/**
 * Convert GenieACS device format to CPE format
 */
function convertGenieACSDevice(device: any): CPEDevice {
  // Extract location from device parameters or metadata
  let location = { latitude: 0, longitude: 0 };
  
  if (device.location) {
    location = {
      latitude: device.location.latitude || device.location.coordinates?.latitude || 0,
      longitude: device.location.longitude || device.location.coordinates?.longitude || 0
    };
  } else if (device.parameters) {
    // Try to extract GPS from TR-069 parameters
    const gpsLat = device.parameters['Device.DeviceInfo.GPS.Latitude'] || 
                   device.parameters['Device.DeviceInfo.GPS.Latitude._value'];
    const gpsLon = device.parameters['Device.DeviceInfo.GPS.Longitude'] || 
                   device.parameters['Device.DeviceInfo.GPS.Longitude._value'];
    
    if (gpsLat && gpsLon) {
      location = {
        latitude: parseFloat(gpsLat) || 0,
        longitude: parseFloat(gpsLon) || 0
      };
    }
  }
  
  // Determine status based on last inform time
  let status: 'Online' | 'Offline' = 'Offline';
  const lastInform = device._lastInform ? new Date(device._lastInform) : null;
  if (lastInform) {
    // Device is online if last inform was within last 5 minutes
    const minutesSinceInform = (Date.now() - lastInform.getTime()) / 1000 / 60;
    status = minutesSinceInform < 5 ? 'Online' : 'Offline';
  }
  
  return {
    id: device._id || device.id,
    manufacturer: device.manufacturer || 
                  device.parameters?.['InternetGatewayDevice.DeviceInfo.Manufacturer']?._value ||
                  device.parameters?.['InternetGatewayDevice.DeviceInfo.Manufacturer'] ||
                  device._deviceId?.Manufacturer ||
                  'Unknown',
    status: status,
    location: location,
    lastContact: lastInform || device.lastContact || new Date(),
    parameters: device.parameters || {},
    tenantId: device._tenantId || device.tenantId,
    // Additional fields for display
    model: device.model || 
           device.parameters?.['InternetGatewayDevice.DeviceInfo.ModelName']?._value ||
           device.parameters?.['InternetGatewayDevice.DeviceInfo.ModelName'] ||
           device._deviceId?.ModelName ||
           'Unknown',
    serialNumber: device.serialNumber ||
                  device.parameters?.['InternetGatewayDevice.DeviceInfo.SerialNumber']?._value ||
                  device.parameters?.['InternetGatewayDevice.DeviceInfo.SerialNumber'] ||
                  device._deviceId?.SerialNumber ||
                  '',
    ipAddress: device.ipAddress ||
               device.parameters?.['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress']?._value ||
               device.parameters?.['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress'] ||
               '',
    firmware: device.firmware ||
              device.parameters?.['InternetGatewayDevice.DeviceInfo.SoftwareVersion']?._value ||
              device.parameters?.['InternetGatewayDevice.DeviceInfo.SoftwareVersion'] ||
              '',
    tags: Array.isArray(device.tags) ? device.tags : []
  };
}

/**
 * Get fallback sample data when API is unavailable
 * NOTE: This should only be used for development/testing
 */
function getFallbackSampleData(): CPEDevice[] {
  // Return empty array instead of fake data - let user know there's an issue
  console.warn('⚠️ No devices available - GenieACS may not be configured or no devices are connected');
  return [];
}

/**
 * Sync CPE devices with GenieACS (multi-tenant, authenticated)
 */
export async function syncCPEDevices(): Promise<{ success: boolean; message: string; devices?: CPEDevice[] }> {
  try {
    console.log('Starting device sync from GenieACS...');
    
    // Get auth token and tenant ID
    const { authService } = await import('$lib/services/authService');
    const { currentTenant } = await import('$lib/stores/tenantStore');
    const { get } = await import('svelte/store');
    
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }
    
    const token = await authService.getAuthTokenForApi();
    const tenantId = get(currentTenant)?.id;
    
    if (!tenantId) {
      throw new Error('No tenant selected');
    }
    
    // Call backend sync endpoint
    const response = await fetch('/api/tr069/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      const syncCount = result.synced || 0;
      console.log(`✅ Successfully synced ${syncCount} devices from GenieACS`);
      
      // Reload devices after sync
      const devices = await loadCPEDevices();
      
      return {
        success: true,
        message: result.message || `Successfully synced ${syncCount} devices from GenieACS`,
        devices
      };
    } else {
      throw new Error(result.error || 'Sync failed');
    }
    
  } catch (error: any) {
    console.error('Failed to sync CPE devices:', error);
    return {
      success: false,
      message: error.message || 'Failed to sync devices from GenieACS'
    };
  }
}

/**
 * Get statistics about CPE devices
 */
export function getCPEStats(devices: CPEDevice[]) {
  const onlineDevices = devices.filter(d => d.status === 'Online').length;
  const offlineDevices = devices.filter(d => d.status === 'Offline').length;
  
  return {
    total: devices.length,
    online: onlineDevices,
    offline: offlineDevices,
    onlinePercentage: devices.length > 0 ? Math.round((onlineDevices / devices.length) * 100) : 0
  };
}

