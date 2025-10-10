// CPE Device Data Service
// Handles loading and managing CPE device data

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
}

/**
 * Load CPE devices from the API
 */
export async function loadCPEDevices(): Promise<CPEDevice[]> {
  try {
    console.log('Attempting to load CPE devices from API...');
    
    const response = await fetch('/api/cpe/devices', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.devices.length > 0) {
        console.log(`Loaded ${data.devices.length} real CPE devices from API`);
        return data.devices;
      }
    }
    
    console.log('API not available, using sample data');
    return getFallbackSampleData();
    
  } catch (error) {
    console.error('Error loading CPE devices from API:', error);
    console.log('Using sample data as fallback');
    return getFallbackSampleData();
  }
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
 * Sync CPE devices with GenieACS
 */
export async function syncCPEDevices(): Promise<{ success: boolean; message: string; devices?: CPEDevice[] }> {
  try {
    console.log('Starting CPE device sync...');
    
    const syncResponse = await fetch('/api/cpe/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const syncData = await syncResponse.json();
    
    if (syncData.success) {
      console.log(`Successfully synced ${syncData.deviceCount} CPE devices`);
      
      // Reload devices after sync
      const devices = await loadCPEDevices();
      
      return {
        success: true,
        message: `Successfully synced ${syncData.deviceCount} devices`,
        devices
      };
    } else {
      throw new Error(syncData.error || 'Sync failed');
    }
    
  } catch (error) {
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

