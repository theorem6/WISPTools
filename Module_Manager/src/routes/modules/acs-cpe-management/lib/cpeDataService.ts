// CPE Device Data Service
// Handles loading and managing CPE device data with multi-tenant support

import { apiService } from '$lib/services/apiService';

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
}

/**
 * Load CPE devices from the API (multi-tenant, authenticated)
 */
export async function loadCPEDevices(): Promise<CPEDevice[]> {
  try {
    console.log('Loading CPE devices from multi-tenant API...');
    
    // Use authenticated API service with tenant context
    const result = await apiService.getDevices();
    
    if (result.success && result.data) {
      const devices = Array.isArray(result.data) ? result.data : result.data.devices || [];
      
      if (devices.length > 0) {
        console.log(`Loaded ${devices.length} tenant-specific devices`);
        return devices.map(convertGenieACSDevice);
      }
    }
    
    console.log('No devices found for tenant, using sample data');
    return getFallbackSampleData();
    
  } catch (error) {
    console.error('Error loading CPE devices from API:', error);
    console.log('Using sample data as fallback');
    return getFallbackSampleData();
  }
}

/**
 * Convert GenieACS device format to CPE format
 */
function convertGenieACSDevice(device: any): CPEDevice {
  return {
    id: device._id || device.id,
    manufacturer: device.manufacturer || device.parameters?.['InternetGatewayDevice.DeviceInfo.Manufacturer'] || 'Unknown',
    status: device.status || (device._lastInform ? 'Online' : 'Offline'),
    location: device.location || {
      latitude: 0,
      longitude: 0
    },
    lastContact: device.lastContact || device._lastInform || new Date(),
    parameters: device.parameters || {},
    tenantId: device._tenantId || device.tenantId
  };
}

/**
 * Get fallback sample data when API is unavailable
 */
function getFallbackSampleData(): CPEDevice[] {
  return [
    {
      id: 'nokia-lte-router-001',
      manufacturer: 'Nokia',
      status: 'Online',
      location: {
        latitude: 40.7128,
        longitude: -74.0060
      },
      lastContact: new Date(),
      parameters: {
        SoftwareVersion: '1.2.3',
        HardwareVersion: 'HW-2.1'
      }
    },
    {
      id: 'nokia-lte-router-002',
      manufacturer: 'Nokia',
      status: 'Online',
      location: {
        latitude: 34.0522,
        longitude: -118.2437
      },
      lastContact: new Date(),
      parameters: {
        SoftwareVersion: '1.2.4',
        HardwareVersion: 'HW-2.1'
      }
    },
    {
      id: 'nokia-lte-router-003',
      manufacturer: 'Nokia',
      status: 'Offline',
      location: {
        latitude: 41.8781,
        longitude: -87.6298
      },
      lastContact: new Date(Date.now() - 3600000), // 1 hour ago
      parameters: {
        SoftwareVersion: '1.2.2',
        HardwareVersion: 'HW-2.0'
      }
    }
  ];
}

/**
 * Sync CPE devices with GenieACS (multi-tenant, authenticated)
 */
export async function syncCPEDevices(): Promise<{ success: boolean; message: string; devices?: CPEDevice[] }> {
  try {
    console.log('Starting tenant-specific device sync...');
    
    // Use authenticated API service with tenant context
    const result = await apiService.syncGenieACSDevices();
    
    if (result.success && result.data) {
      const syncCount = result.data.synced || result.data.deviceCount || 0;
      console.log(`Successfully synced ${syncCount} tenant devices`);
      
      // Reload devices after sync
      const devices = await loadCPEDevices();
      
      return {
        success: true,
        message: result.data.message || `Successfully synced ${syncCount} devices`,
        devices
      };
    } else {
      throw new Error(result.error || 'Sync failed');
    }
    
  } catch (error: any) {
    console.error('Failed to sync CPE devices:', error);
    return {
      success: false,
      message: error.message || 'Failed to sync devices'
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

